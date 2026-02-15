# Voice Engine

Modular real-time voice conversation module powered by NVIDIA PersonaPlex.

## What This Is

A standalone voice server that wraps PersonaPlex (7B full-duplex speech-to-speech model) into a clean API. Any app can plug in to give AI agents real-time voice capabilities.

## Architecture

```
┌─────────────────────────────────────┐
│  Client (Browser / Mobile)          │
│  WebRTC / WebSocket audio stream    │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│  Voice Engine Server (Node.js)      │
│  - Session management               │
│  - Voice/persona routing             │
│  - WebSocket relay                   │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│  PersonaPlex Backend (Python/GPU)   │
│  - moshi.server on port 8998        │
│  - Full-duplex speech-to-speech     │
│  - Voice conditioning + role prompts │
└─────────────────────────────────────┘
```

## Deployment Options

1. **Local GPU** — RTX 4090 / 3090 (24GB VRAM)
2. **RunPod** — A40 ($0.39/hr) or any 24GB+ GPU pod
3. **Any cloud** — Anything with CUDA + 24GB VRAM

## API

### REST
- `GET /voices` — List available voices
- `POST /session` — Create voice session (persona + voice)
- `DELETE /session/:id` — End session

### WebSocket
- `ws://host:3460/voice` — Bidirectional audio stream (Opus codec)

## Quick Start

```bash
# 1. Start PersonaPlex backend (GPU machine)
cd personaplex/
pip install moshi/.
SSL_DIR=$(mktemp -d); HF_TOKEN=xxx python -m moshi.server --ssl "$SSL_DIR"

# 2. Start Voice Engine relay
cd voice-engine/
npm install
PERSONAPLEX_HOST=localhost:8998 npm start

# 3. Open client or integrate into your app
```

## Integration

```javascript
// Connect from any web app
const ws = new WebSocket('ws://localhost:3460/voice');
ws.send(JSON.stringify({
  type: 'start',
  voice: 'NATF2',
  persona: 'You are a helpful AI assistant named Nova.'
}));
// Then stream audio frames bidirectionally
```
