#!/bin/bash
# Start both PersonaPlex backend + Voice Engine relay

echo "🎙️ Starting PersonaPlex + Voice Engine"

# Start PersonaPlex in background
cd /app/personaplex
SSL_DIR=$(mktemp -d)
HF_TOKEN=${HF_TOKEN} python -m moshi.server --ssl "$SSL_DIR" ${CPU_OFFLOAD:+--cpu-offload} &
PERSONA_PID=$!

echo "⏳ Waiting for PersonaPlex to load model..."
sleep 30

# Start Voice Engine relay
cd /app/voice-engine
PERSONAPLEX_HOST=localhost PERSONAPLEX_PORT=8998 node server.js &
VOICE_PID=$!

echo "✅ Both services running"
echo "   PersonaPlex: https://localhost:8998"
echo "   Voice Engine: http://localhost:3460"

# Wait for either to exit
wait $PERSONA_PID $VOICE_PID
