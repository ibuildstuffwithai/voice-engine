# PersonaPlex Voice Engine

> Self-hosted real-time voice AI powered by [NVIDIA PersonaPlex](https://github.com/NVIDIA/personaplex). One-click deploy to RunPod.

![License](https://img.shields.io/badge/license-MIT-blue)
![Node](https://img.shields.io/badge/node-%3E%3D18-green)

## Features

- 🎙️ **Real-time voice conversations** — full-duplex audio streaming via PersonaPlex 7B
- 🎭 **Persona presets** — Assistant, Medical, Bank, Astronaut, or custom
- 🗣️ **18 voices** — 8 natural + 10 variety voices with audio previews
- ⚡ **One-click deploy** — single script sets up everything on RunPod
- 🎨 **Clean web UI** — dark call UI with pulsing orb, chat bubbles, timer
- 📞 **Voice call page** — branded call experience at `/call.html`
- 🔊 **Voice notes** — TTS endpoint for sending audio responses (Telegram integration)
- 🧠 **AI gateway** — optional OpenClaw gateway integration for Claude-powered responses
- 🔌 **Relay server** — bridges browser WebSocket to PersonaPlex backend
- 🐳 **Docker support** — containerized deployment option
- 🤖 **Agent-friendly** — comprehensive setup docs for AI agents

## How to Use

### 🎙️ Voice Call (Web UI)
1. Open `http://localhost:3460`
2. Pick a voice and persona preset
3. Click **Start Call** — opens the call page
4. Allow microphone access and start talking!

### 💬 Chat Commands (Telegram / OpenClaw)
If connected to an OpenClaw agent, you can:
- Say **"send me a voice note"** or **"send me an audio message"** → AI responds with TTS audio
- Say **"call me"** → Agent opens the voice call page

### 🔊 TTS API
```bash
curl -X POST http://localhost:3460/api/tts \
  -H "Content-Type: application/json" \
  -d '{"text": "Hello world"}' \
  --output response.mp3
```

### 🧠 Chat API (requires OpenClaw gateway)
```bash
curl -X POST http://localhost:3460/api/chat \
  -H "Content-Type: application/json" \
  -d '{"messages": [{"role": "user", "content": "Hello"}]}'
```

## Quick Start

### One-liner (RunPod)

SSH into a RunPod GPU pod (A40 48GB+ recommended) and run:

```bash
curl -sSL https://raw.githubusercontent.com/nikolateslasagent/voice-engine/main/setup.sh | bash
```

This installs everything and starts the PersonaPlex server on port 8998.

### Manual Setup

See [SETUP.md](SETUP.md) for detailed step-by-step instructions (agent-friendly).

## Architecture

```
┌──────────────┐     WebSocket      ┌──────────────┐     WebSocket      ┌──────────────────┐
│   Browser    │ ◄──────────────► │ Voice Engine │ ◄──────────────►  │   PersonaPlex    │
│   (Web UI)   │   Ogg/Opus audio  │  (Relay)     │   Ogg/Opus audio  │  (NVIDIA 7B)     │
│   port 3460  │                   │  port 3460   │                   │   port 8998      │
└──────────────┘                   └──────────────┘                   └──────────────────┘
        │                                │                                     │
        │  REST API                      │  Serves static UI                   │ GPU (A40/A100)
        │  /api/chat (→ AI gateway)      │  from public/                       │ Self-contained LLM
        │  /api/tts  (→ MP3 audio)       │                                     │ 18 voice embeddings
        │  /api/voices                   │
        │  /api/health                   │
```

### PersonaPlex Protocol
- **Control message** `[0x03, 0x00]` — starts the session (must be sent after WS connect)
- **Handshake** `[0x00]` — server confirms session is ready
- **Audio** `[0x01, ...ogg_opus_bytes]` — bidirectional audio stream
- **Text** `[0x02, ...utf8_bytes]` — text transcript tokens
- **Control types:** `0x00`=start, `0x01`=endTurn, `0x02`=pause, `0x03`=restart

## Local Development

```bash
# Install dependencies
npm install

# Set backend URL (default: localhost:8998)
export PERSONAPLEX_HOST=localhost
export PERSONAPLEX_PORT=8998

# Start relay server
npm start

# Open http://localhost:3460
```

## Tech Stack

- **Backend Model:** NVIDIA PersonaPlex 7B (Moshi-based, full-duplex speech-to-speech)
- **Relay Server:** Node.js, Express, ws
- **Frontend:** Vanilla HTML/CSS/JS, Inter font
- **Audio:** Ogg/Opus @ 24kHz (PersonaPlex native format)
- **TTS Fallback:** macOS `say` + ffmpeg → MP3
- **AI Gateway:** OpenClaw `/v1/chat/completions` for Claude-powered responses
- **Infra:** RunPod GPU pods (A40 48GB recommended, ~$0.40/hr)

## API

| Endpoint | Method | Description |
|---|---|---|
| `/api/health` | GET | Health check + active sessions |
| `/api/voices` | GET | List available voices |
| `/api/chat` | POST | AI chat (routes through OpenClaw gateway) |
| `/api/tts` | POST | Text-to-speech → MP3 audio |
| `/api/session` | POST | Create voice session |
| `/api/session/:id` | GET | Get session info |
| `/api/sessions` | GET | List active sessions |
| `/api/session/:id` | DELETE | End session |
| `/voice` | WS | Audio streaming endpoint |

## Pages

| URL | Description |
|---|---|
| `/` | Homepage — voice picker, persona presets, Start Call |
| `/call.html` | Voice call UI — dark theme, pulsing orb, chat bubbles |
| `/samples.html` | Voice preview samples for all 8 natural voices |
| `/manage.html` | RunPod management dashboard |

## First-Time Setup

New to RunPod and HuggingFace? See the [Setup Guide](GUIDE.md) for step-by-step instructions.

## Management Dashboard

Open `public/manage.html` (or click "Manage" in the Voice UI header) to:
- Start/stop your RunPod pod
- Monitor uptime and estimated costs
- Check server health
- Quick-link to Voice UI and Jupyter terminal

All settings are saved in your browser's localStorage.

## OpenClaw Skill

The `skill/` directory contains an [OpenClaw](https://openclaw.ai) skill definition (`SKILL.md`) that enables AI agents to autonomously set up, manage, and troubleshoot PersonaPlex deployments using the RunPod API.

## License

MIT
