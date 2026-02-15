# Twilio Phone Integration

Give your PersonaPlex AI a real phone number anyone can call.

## Prerequisites
- PersonaPlex server running (see SETUP.md)
- Twilio account (free trial at https://twilio.com)

## Step 1: Create Twilio Account & Get a Number

1. Sign up at **https://www.twilio.com/try-twilio** (free $15 trial credit)
2. Verify your phone number
3. Go to **Phone Numbers → Buy a Number**
   - Select your country
   - Check "Voice" capability
   - Buy a number (~$1.15/month)
4. Note your:
   - **Account SID** (on dashboard, starts with `AC...`)
   - **Auth Token** (on dashboard, click to reveal)
   - **Phone Number** (e.g., `+12025551234`)

## Step 2: Configure Environment

Set these environment variables:

```bash
export TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
export TWILIO_AUTH_TOKEN=your_auth_token_here
export TWILIO_PHONE_NUMBER=+12025551234
export PERSONAPLEX_URL=ws://localhost:8998/ws
export PUBLIC_URL=https://your-pod-3462.proxy.runpod.net
```

## Step 3: Install & Run the Bridge

```bash
cd voice-engine
npm install twilio ws express
node twilio-bridge.js
```

The bridge runs on port 3462 by default.

## Step 4: Configure Twilio Webhooks

1. Go to **Phone Numbers → Active Numbers → Your Number**
2. Under "Voice Configuration":
   - **When a call comes in:** Webhook
   - **URL:** `https://your-pod-3462.proxy.runpod.net/incoming`
   - **HTTP Method:** POST
3. Under "Call status changes":
   - **URL:** `https://your-pod-3462.proxy.runpod.net/status`
4. Click **Save**

## Step 5: Test It!

Call your Twilio number from any phone. You'll hear "Connecting you to the AI assistant" then be connected to PersonaPlex.

### Make Outbound Calls

```bash
curl -X POST https://your-pod-3462.proxy.runpod.net/call \
  -H "Content-Type: application/json" \
  -d '{"to": "+1XXXXXXXXXX"}'
```

## Costs

| Item | Cost |
|------|------|
| Twilio phone number | ~$1.15/month |
| Incoming calls | ~$0.0085/min |
| Outgoing calls | ~$0.014/min |
| GPU (PersonaPlex) | ~$0.40/hr while running |

A 10-minute call costs roughly $0.10-0.15 in Twilio fees + GPU time.

## Customization

### Change Voice
```bash
export VOICE_PROMPT=NATM0  # Use male natural voice
```

### Change Persona
```bash
export TEXT_PROMPT="You are a helpful customer support agent for Acme Corp."
```

### Available Voices
Natural: NATF0, NATF1, NATF2, NATF3, NATM0, NATM1, NATM2, NATM3
Variety: VARF0-VARF4, VARM0-VARM4

## Architecture

```
Phone (any carrier)
    ↕ PSTN
Twilio (media stream)
    ↕ WebSocket (8kHz μ-law)
Twilio Bridge (twilio-bridge.js, port 3462)
    ↕ WebSocket (24kHz PCM)
PersonaPlex (port 8998, GPU)
```

The bridge handles:
- Audio format conversion (μ-law ↔ PCM)
- Sample rate conversion (8kHz ↔ 24kHz)
- Session management
- Outbound call initiation

## Troubleshooting

| Problem | Solution |
|---------|----------|
| "Application error" on call | Check PUBLIC_URL is correct and accessible |
| No audio | Verify PersonaPlex is running on the expected port |
| One-way audio | Check firewall allows WebSocket connections |
| "Cannot route" | Verify Twilio number has Voice capability |
| Latency | Ensure bridge runs on same machine as PersonaPlex |

## Agent Integration

For OpenClaw agents: add Twilio setup to the SKILL.md flow after PersonaPlex is running. Ask the user for Twilio credentials and configure automatically.
