# PersonaPlex Voice Engine

> Self-hosted real-time voice AI powered by [NVIDIA PersonaPlex](https://github.com/NVIDIA/personaplex). One-click deploy to RunPod.

![License](https://img.shields.io/badge/license-MIT-blue)
![Node](https://img.shields.io/badge/node-%3E%3D18-green)

## Features

- 🎙️ **Real-time voice conversations** — full-duplex audio streaming
- 🎭 **Persona presets** — Assistant, Medical, Bank, Astronaut, or custom
- 🗣️ **Multiple voices** — 12+ natural and variety voices
- ⚡ **One-click deploy** — single script sets up everything on RunPod
- 🎨 **Clean web UI** — ElevenLabs-inspired minimal interface
- 🔌 **Relay server** — bridges browser WebSocket to PersonaPlex backend
- 🐳 **Docker support** — containerized deployment option
- 🤖 **Agent-friendly** — comprehensive setup docs for AI agents

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
│   (Web UI)   │    Audio PCM16    │  (Relay)     │    Audio PCM16    │  (NVIDIA Model)  │
│   port 3460  │                   │  port 3460   │                   │   port 8998      │
└──────────────┘                   └──────────────┘                   └──────────────────┘
        │                                │
        │  REST API                      │  Serves static UI
        │  /api/voices                   │  from public/
        │  /api/session                  │
        │  /api/health                   │
```

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

- **Backend Model:** NVIDIA PersonaPlex 7B (Moshi-based)
- **Relay Server:** Node.js, Express, ws
- **Frontend:** Vanilla HTML/CSS/JS, Inter font
- **Audio:** PCM16 @ 24kHz, Web Audio API
- **Infra:** RunPod GPU pods, Docker

## API

| Endpoint | Method | Description |
|---|---|---|
| `/api/health` | GET | Health check + active sessions |
| `/api/voices` | GET | List available voices |
| `/api/session` | POST | Create voice session |
| `/api/session/:id` | GET | Get session info |
| `/api/sessions` | GET | List active sessions |
| `/api/session/:id` | DELETE | End session |
| `/voice` | WS | Audio streaming endpoint |

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
