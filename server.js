/**
 * Voice Engine Server
 * 
 * Relay server that bridges browser WebSocket audio to PersonaPlex backend.
 * Manages sessions, voice selection, and persona routing.
 * 
 * Runs standalone on port 3460 or can be imported as a module.
 */

const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const { v4: uuidv4 } = require('uuid');
const WebSocket = require('ws');
const path = require('path');

// Config
const PORT = process.env.VOICE_PORT || 3460;
const PERSONAPLEX_HOST = process.env.PERSONAPLEX_HOST || 'localhost';
const PERSONAPLEX_PORT = process.env.PERSONAPLEX_PORT || 8998;
const PERSONAPLEX_WS = `wss://${PERSONAPLEX_HOST}:${PERSONAPLEX_PORT}/ws`;

// Available voices (shipped with PersonaPlex)
const VOICES = {
  natural_female: [
    { id: 'NATF0', name: 'Nova', gender: 'female', style: 'warm, conversational' },
    { id: 'NATF1', name: 'Aria', gender: 'female', style: 'clear, professional' },
    { id: 'NATF2', name: 'Luna', gender: 'female', style: 'friendly, engaging' },
    { id: 'NATF3', name: 'Sage', gender: 'female', style: 'calm, thoughtful' },
  ],
  natural_male: [
    { id: 'NATM0', name: 'Atlas', gender: 'male', style: 'confident, articulate' },
    { id: 'NATM1', name: 'Orion', gender: 'male', style: 'warm, approachable' },
    { id: 'NATM2', name: 'Felix', gender: 'male', style: 'energetic, upbeat' },
    { id: 'NATM3', name: 'Reed', gender: 'male', style: 'deep, composed' },
  ],
  variety_female: [
    { id: 'VARF0', name: 'Vox-F0', gender: 'female', style: 'varied' },
    { id: 'VARF1', name: 'Vox-F1', gender: 'female', style: 'varied' },
    { id: 'VARF2', name: 'Vox-F2', gender: 'female', style: 'varied' },
    { id: 'VARF3', name: 'Vox-F3', gender: 'female', style: 'varied' },
    { id: 'VARF4', name: 'Vox-F4', gender: 'female', style: 'varied' },
  ],
  variety_male: [
    { id: 'VARM0', name: 'Vox-M0', gender: 'male', style: 'varied' },
    { id: 'VARM1', name: 'Vox-M1', gender: 'male', style: 'varied' },
    { id: 'VARM2', name: 'Vox-M2', gender: 'male', style: 'varied' },
    { id: 'VARM3', name: 'Vox-M3', gender: 'male', style: 'varied' },
    { id: 'VARM4', name: 'Vox-M4', gender: 'male', style: 'varied' },
  ],
};

// Active sessions
const sessions = new Map();

// Express app
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- REST API ---

// List all voices
app.get('/api/voices', (req, res) => {
  res.json(VOICES);
});

// Create a voice session
app.post('/api/session', (req, res) => {
  const { voice = 'NATF2', persona = 'You are a helpful AI assistant.', agentId } = req.body;
  const id = uuidv4();
  const session = {
    id,
    voice,
    persona,
    agentId: agentId || null,
    status: 'created',
    createdAt: Date.now(),
    backendWs: null,
    clientWs: null,
  };
  sessions.set(id, session);
  res.json({ id, voice, persona, status: 'created', wsUrl: `/voice?session=${id}` });
});

// Get session info
app.get('/api/session/:id', (req, res) => {
  const session = sessions.get(req.params.id);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  res.json({
    id: session.id,
    voice: session.voice,
    persona: session.persona,
    agentId: session.agentId,
    status: session.status,
    createdAt: session.createdAt,
  });
});

// List active sessions
app.get('/api/sessions', (req, res) => {
  const list = [];
  sessions.forEach((s) => {
    list.push({
      id: s.id,
      voice: s.voice,
      persona: s.persona,
      agentId: s.agentId,
      status: s.status,
      createdAt: s.createdAt,
    });
  });
  res.json(list);
});

// End a session
app.delete('/api/session/:id', (req, res) => {
  const session = sessions.get(req.params.id);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  cleanupSession(session);
  sessions.delete(session.id);
  res.json({ id: session.id, status: 'ended' });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    activeSessions: sessions.size,
    backendHost: `${PERSONAPLEX_HOST}:${PERSONAPLEX_PORT}`,
  });
});

// --- WebSocket: Audio Bridge ---

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/voice' });

wss.on('connection', (clientWs, req) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const sessionId = url.searchParams.get('session');

  // Allow creating session on-the-fly via WS
  let session = sessionId ? sessions.get(sessionId) : null;

  clientWs.on('message', (data) => {
    try {
      // First message can be a JSON control message
      if (!session && typeof data === 'string') {
        const msg = JSON.parse(data);
        if (msg.type === 'start') {
          const id = uuidv4();
          session = {
            id,
            voice: msg.voice || 'NATF2',
            persona: msg.persona || 'You are a helpful AI assistant.',
            agentId: msg.agentId || null,
            status: 'connecting',
            createdAt: Date.now(),
            backendWs: null,
            clientWs,
          };
          sessions.set(id, session);
          clientWs.send(JSON.stringify({ type: 'session_created', id, voice: session.voice }));
          connectToBackend(session);
          return;
        }
      }

      if (typeof data === 'string') {
        const msg = JSON.parse(data);

        if (msg.type === 'start' && session) {
          session.clientWs = clientWs;
          session.status = 'connecting';
          connectToBackend(session);
          return;
        }

        // Forward text control messages to backend
        if (session?.backendWs?.readyState === WebSocket.OPEN) {
          session.backendWs.send(data);
        }
      } else {
        // Binary audio data — relay to PersonaPlex
        if (session?.backendWs?.readyState === WebSocket.OPEN) {
          session.backendWs.send(data);
        }
      }
    } catch (e) {
      console.error('[voice-engine] Message handling error:', e.message);
    }
  });

  clientWs.on('close', () => {
    if (session) {
      session.status = 'disconnected';
      cleanupSession(session);
      sessions.delete(session.id);
    }
  });

  // If session already exists (created via REST), attach client and connect
  if (session) {
    session.clientWs = clientWs;
    session.status = 'connecting';
    connectToBackend(session);
  }
});

/**
 * Connect to PersonaPlex backend WebSocket.
 * Relays audio bidirectionally between client and PersonaPlex.
 */
function connectToBackend(session) {
  // PersonaPlex uses WSS with self-signed certs
  const backendWs = new WebSocket(PERSONAPLEX_WS, {
    rejectUnauthorized: false, // Self-signed SSL from PersonaPlex
    headers: {
      'X-Voice': session.voice,
      'X-Persona': session.persona,
    },
  });

  session.backendWs = backendWs;

  backendWs.on('open', () => {
    session.status = 'active';
    console.log(`[voice-engine] Session ${session.id} connected to PersonaPlex`);

    // Send initial config to PersonaPlex
    backendWs.send(JSON.stringify({
      type: 'config',
      voice_prompt: session.voice,
      text_prompt: session.persona,
    }));

    if (session.clientWs?.readyState === WebSocket.OPEN) {
      session.clientWs.send(JSON.stringify({ type: 'connected', sessionId: session.id }));
    }
  });

  backendWs.on('message', (data) => {
    // Relay audio/messages from PersonaPlex back to client
    if (session.clientWs?.readyState === WebSocket.OPEN) {
      session.clientWs.send(data);
    }
  });

  backendWs.on('error', (err) => {
    console.error(`[voice-engine] Backend error for session ${session.id}:`, err.message);
    session.status = 'error';
    if (session.clientWs?.readyState === WebSocket.OPEN) {
      session.clientWs.send(JSON.stringify({
        type: 'error',
        message: 'Voice backend unavailable. Is PersonaPlex running?',
      }));
    }
  });

  backendWs.on('close', () => {
    session.status = 'backend_disconnected';
    if (session.clientWs?.readyState === WebSocket.OPEN) {
      session.clientWs.send(JSON.stringify({ type: 'backend_disconnected' }));
    }
  });
}

function cleanupSession(session) {
  if (session.backendWs) {
    try { session.backendWs.close(); } catch (e) {}
  }
  if (session.clientWs) {
    try { session.clientWs.close(); } catch (e) {}
  }
}

// --- Module Export (for embedding in other apps) ---

function createVoiceEngine(existingServer, opts = {}) {
  const voiceWss = new WebSocketServer({ noServer: true });

  existingServer.on('upgrade', (req, socket, head) => {
    if (req.url.startsWith('/voice')) {
      voiceWss.handleUpgrade(req, socket, head, (ws) => {
        voiceWss.emit('connection', ws, req);
      });
    }
  });

  // Attach same connection handler
  voiceWss.on('connection', (clientWs, req) => {
    // Same logic as above — reuse by importing
    wss.emit('connection', clientWs, req);
  });

  return { app, sessions, VOICES };
}

module.exports = { createVoiceEngine, VOICES, sessions };

// --- Start standalone ---

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`\n🎙️  Voice Engine running on http://localhost:${PORT}`);
    console.log(`   PersonaPlex backend: ${PERSONAPLEX_HOST}:${PERSONAPLEX_PORT}`);
    console.log(`   WebSocket: ws://localhost:${PORT}/voice`);
    console.log(`   REST API:  http://localhost:${PORT}/api/voices\n`);
  });
}
