/**
 * Twilio ↔ PersonaPlex Bridge
 * 
 * Connects Twilio phone calls to PersonaPlex for real-time voice AI conversations.
 * 
 * Architecture:
 *   Phone Call → Twilio → This Bridge (WebSocket) → PersonaPlex (GPU)
 * 
 * Setup:
 *   1. Get a Twilio account + phone number
 *   2. Set environment variables (see below)
 *   3. Run this alongside the PersonaPlex server
 *   4. Point Twilio webhook to this server's /incoming endpoint
 * 
 * Environment Variables:
 *   TWILIO_ACCOUNT_SID  - Your Twilio Account SID
 *   TWILIO_AUTH_TOKEN    - Your Twilio Auth Token
 *   TWILIO_PHONE_NUMBER  - Your Twilio phone number (+1XXXXXXXXXX)
 *   PERSONAPLEX_URL      - PersonaPlex WebSocket URL (default: ws://localhost:8998)
 *   BRIDGE_PORT          - Port for this bridge server (default: 3462)
 *   VOICE_PROMPT         - Default voice embedding (default: NATF0)
 *   TEXT_PROMPT           - Default persona prompt
 *   PUBLIC_URL           - Public URL for Twilio webhooks (e.g., https://your-pod-3462.proxy.runpod.net)
 */

const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const twilio = require('twilio');

const app = express();
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

const PORT = process.env.BRIDGE_PORT || 3462;
const PERSONAPLEX_URL = process.env.PERSONAPLEX_URL || 'ws://localhost:8998/ws';
const VOICE_PROMPT = process.env.VOICE_PROMPT || 'NATF0';
const TEXT_PROMPT = process.env.TEXT_PROMPT || 'You are a wise and friendly teacher. Answer questions or provide advice in a clear and engaging way.';
const PUBLIC_URL = process.env.PUBLIC_URL || `http://localhost:${PORT}`;

// Active call sessions
const sessions = new Map();

/**
 * Twilio incoming call webhook
 * Returns TwiML that starts a media stream
 */
app.post('/incoming', (req, res) => {
  const callSid = req.body.CallSid;
  console.log(`[${callSid}] Incoming call from ${req.body.From}`);
  
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>Connecting you to the AI assistant. Please wait.</Say>
  <Connect>
    <Stream url="wss://${new URL(PUBLIC_URL).host}/media-stream" />
  </Connect>
</Response>`;
  
  res.type('text/xml');
  res.send(twiml);
});

/**
 * Twilio call status webhook
 */
app.post('/status', (req, res) => {
  const callSid = req.body.CallSid;
  const status = req.body.CallStatus;
  console.log(`[${callSid}] Status: ${status}`);
  
  if (status === 'completed' || status === 'failed' || status === 'canceled') {
    const session = sessions.get(callSid);
    if (session) {
      if (session.personaplex) session.personaplex.close();
      sessions.delete(callSid);
    }
  }
  res.sendStatus(200);
});

/**
 * Health check
 */
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    activeCalls: sessions.size,
    personaplexUrl: PERSONAPLEX_URL,
    voicePrompt: VOICE_PROMPT,
  });
});

/**
 * Make an outbound call
 * POST /call { to: "+1XXXXXXXXXX" }
 */
app.post('/call', async (req, res) => {
  const { to } = req.body;
  if (!to) return res.status(400).json({ error: 'Missing "to" phone number' });
  
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_PHONE_NUMBER;
  
  if (!accountSid || !authToken || !from) {
    return res.status(500).json({ error: 'Twilio credentials not configured' });
  }
  
  try {
    const client = twilio(accountSid, authToken);
    const call = await client.calls.create({
      to,
      from,
      url: `${PUBLIC_URL}/incoming`,
      statusCallback: `${PUBLIC_URL}/status`,
    });
    console.log(`Outbound call initiated: ${call.sid} → ${to}`);
    res.json({ callSid: call.sid, status: 'initiated' });
  } catch (err) {
    console.error('Failed to initiate call:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Create HTTP server
const server = http.createServer(app);

// WebSocket server for Twilio Media Streams
const wss = new WebSocket.Server({ server, path: '/media-stream' });

wss.on('connection', (twilioWs) => {
  console.log('[Bridge] Twilio media stream connected');
  
  let callSid = null;
  let streamSid = null;
  let personaplexWs = null;
  
  // Connect to PersonaPlex
  function connectPersonaPlex() {
    const ppUrl = PERSONAPLEX_URL;
    console.log(`[Bridge] Connecting to PersonaPlex: ${ppUrl}`);
    
    personaplexWs = new WebSocket(ppUrl);
    
    personaplexWs.on('open', () => {
      console.log('[Bridge] Connected to PersonaPlex');
      
      // Send initial config (voice + text prompt)
      personaplexWs.send(JSON.stringify({
        type: 'config',
        voice_prompt: VOICE_PROMPT,
        text_prompt: TEXT_PROMPT,
      }));
    });
    
    personaplexWs.on('message', (data) => {
      // PersonaPlex sends back audio frames
      // Convert and relay to Twilio
      if (Buffer.isBuffer(data)) {
        // PersonaPlex outputs 24kHz 16-bit PCM mono
        // Twilio expects 8kHz mulaw
        const mulawPayload = pcmToMulaw(data, 24000, 8000);
        const base64Audio = mulawPayload.toString('base64');
        
        if (twilioWs.readyState === WebSocket.OPEN && streamSid) {
          twilioWs.send(JSON.stringify({
            event: 'media',
            streamSid,
            media: { payload: base64Audio }
          }));
        }
      }
    });
    
    personaplexWs.on('close', () => {
      console.log('[Bridge] PersonaPlex connection closed');
    });
    
    personaplexWs.on('error', (err) => {
      console.error('[Bridge] PersonaPlex error:', err.message);
    });
    
    return personaplexWs;
  }
  
  twilioWs.on('message', (message) => {
    const msg = JSON.parse(message.toString());
    
    switch (msg.event) {
      case 'connected':
        console.log('[Twilio] Stream connected');
        break;
        
      case 'start':
        streamSid = msg.start.streamSid;
        callSid = msg.start.callSid;
        console.log(`[Twilio] Stream started: ${streamSid} (Call: ${callSid})`);
        
        // Connect to PersonaPlex when stream starts
        personaplexWs = connectPersonaPlex();
        sessions.set(callSid, { twilioWs, personaplex: personaplexWs, streamSid });
        break;
        
      case 'media':
        // Twilio sends 8kHz mulaw audio
        // Convert to 24kHz 16-bit PCM for PersonaPlex
        if (personaplexWs && personaplexWs.readyState === WebSocket.OPEN) {
          const audioBuffer = Buffer.from(msg.media.payload, 'base64');
          const pcmData = mulawToPcm(audioBuffer, 8000, 24000);
          personaplexWs.send(pcmData);
        }
        break;
        
      case 'stop':
        console.log(`[Twilio] Stream stopped: ${streamSid}`);
        if (personaplexWs) personaplexWs.close();
        if (callSid) sessions.delete(callSid);
        break;
    }
  });
  
  twilioWs.on('close', () => {
    console.log('[Twilio] WebSocket closed');
    if (personaplexWs) personaplexWs.close();
    if (callSid) sessions.delete(callSid);
  });
});

/**
 * Audio conversion: PCM 16-bit → μ-law
 * Includes sample rate conversion via simple linear interpolation
 */
function pcmToMulaw(pcmBuffer, fromRate, toRate) {
  const samples = new Int16Array(pcmBuffer.buffer, pcmBuffer.byteOffset, pcmBuffer.length / 2);
  const ratio = fromRate / toRate;
  const outLen = Math.floor(samples.length / ratio);
  const output = Buffer.alloc(outLen);
  
  for (let i = 0; i < outLen; i++) {
    const srcIdx = Math.min(Math.floor(i * ratio), samples.length - 1);
    const sample = samples[srcIdx];
    output[i] = linearToMulaw(sample);
  }
  
  return output;
}

/**
 * Audio conversion: μ-law → PCM 16-bit
 * Includes sample rate conversion
 */
function mulawToPcm(mulawBuffer, fromRate, toRate) {
  const ratio = toRate / fromRate;
  const outLen = Math.floor(mulawBuffer.length * ratio);
  const output = Buffer.alloc(outLen * 2); // 16-bit = 2 bytes per sample
  const view = new Int16Array(output.buffer);
  
  for (let i = 0; i < outLen; i++) {
    const srcIdx = Math.min(Math.floor(i / ratio), mulawBuffer.length - 1);
    view[i] = mulawToLinear(mulawBuffer[srcIdx]);
  }
  
  return output;
}

// μ-law encoding table
function linearToMulaw(sample) {
  const MULAW_MAX = 0x1FFF;
  const MULAW_BIAS = 33;
  const sign = (sample >> 8) & 0x80;
  if (sign !== 0) sample = -sample;
  sample = Math.min(sample + MULAW_BIAS, MULAW_MAX);
  const exponent = Math.floor(Math.log2(sample)) - 5;
  const exp = Math.max(0, Math.min(7, exponent));
  const mantissa = (sample >> (exp + 3)) & 0x0F;
  return ~(sign | (exp << 4) | mantissa) & 0xFF;
}

// μ-law decoding
function mulawToLinear(mulaw) {
  mulaw = ~mulaw & 0xFF;
  const sign = (mulaw & 0x80) ? -1 : 1;
  const exponent = (mulaw >> 4) & 0x07;
  const mantissa = mulaw & 0x0F;
  const sample = ((mantissa << 3) + 0x84) << exponent;
  return sign * (sample - 0x84);
}

server.listen(PORT, () => {
  console.log(`\n🔗 Twilio ↔ PersonaPlex Bridge`);
  console.log(`   Bridge:      http://localhost:${PORT}`);
  console.log(`   Health:      http://localhost:${PORT}/health`);
  console.log(`   PersonaPlex: ${PERSONAPLEX_URL}`);
  console.log(`   Voice:       ${VOICE_PROMPT}`);
  console.log(`\n   Twilio Webhooks:`);
  console.log(`   Incoming:    ${PUBLIC_URL}/incoming`);
  console.log(`   Status:      ${PUBLIC_URL}/status`);
  console.log(`   Outbound:    POST ${PUBLIC_URL}/call { "to": "+1XXXXXXXXXX" }`);
  console.log('');
});
