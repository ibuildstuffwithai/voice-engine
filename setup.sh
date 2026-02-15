#!/bin/bash
# PersonaPlex Voice Engine — One-Click Setup
# Usage: curl -sSL https://raw.githubusercontent.com/nikolateslasagent/voice-engine/main/setup.sh | bash
# Or:    curl -sSL ... | HF_TOKEN=hf_xxx bash
set -e

echo "╔══════════════════════════════════════════╗"
echo "║   PersonaPlex Voice Engine Setup          ║"
echo "║   github.com/nikolateslasagent/voice-engine║"
echo "╚══════════════════════════════════════════╝"
echo ""

# HuggingFace token
if [ -z "$HF_TOKEN" ]; then
  read -rp "🔑 Enter your HuggingFace token (hf_...): " HF_TOKEN
fi

if [ -z "$HF_TOKEN" ]; then
  echo "❌ HF_TOKEN is required. Get one at https://huggingface.co/settings/tokens"
  exit 1
fi

export HF_TOKEN

echo ""
echo "📦 Installing system dependencies..."
apt-get update -qq && apt-get install -y -qq libopus-dev ffmpeg > /dev/null 2>&1
echo "   ✅ System deps installed"

echo ""
echo "📥 Cloning PersonaPlex..."
cd /workspace
if [ -d "personaplex" ]; then
  echo "   ℹ️  PersonaPlex directory exists, pulling latest..."
  cd personaplex && git pull && cd ..
else
  git clone https://github.com/NVIDIA/personaplex.git
fi
echo "   ✅ PersonaPlex cloned"

echo ""
echo "🐍 Installing Python packages..."
cd /workspace/personaplex
pip install -q ./moshi
pip install -q rustymimi
echo "   ✅ Python packages installed"

echo ""
echo "🌐 Installing Voice Engine relay..."
if ! command -v node &> /dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash - > /dev/null 2>&1
  apt-get install -y -qq nodejs > /dev/null 2>&1
fi

cd /workspace
if [ -d "voice-engine" ]; then
  cd voice-engine && git pull && cd ..
else
  git clone https://github.com/nikolateslasagent/voice-engine.git
fi
cd voice-engine && npm install --silent
echo "   ✅ Voice Engine installed"

echo ""
echo "🚀 Starting PersonaPlex server on port 8998..."
cd /workspace/personaplex
nohup python -m moshi.server --host 0.0.0.0 --port 8998 > /workspace/personaplex.log 2>&1 &
echo $! > /workspace/personaplex.pid
echo "   PID: $(cat /workspace/personaplex.pid)"

echo ""
echo "🎙️  Starting Voice Engine relay on port 3460..."
cd /workspace/voice-engine
export PERSONAPLEX_HOST=localhost
export PERSONAPLEX_PORT=8998
nohup node server.js > /workspace/voice-engine.log 2>&1 &
echo $! > /workspace/voice-engine.pid
echo "   PID: $(cat /workspace/voice-engine.pid)"

# Get pod ID for URL
POD_ID=$(hostname | sed 's/-.*//')

echo ""
echo "════════════════════════════════════════════"
echo "  ✅ Setup complete!"
echo ""
echo "  ⏳ PersonaPlex is downloading model weights (~15GB)"
echo "     This takes 5-15 minutes on first run."
echo "     Monitor: tail -f /workspace/personaplex.log"
echo ""
echo "  🌐 URLs (once model is loaded):"
echo "     PersonaPlex: https://${POD_ID}-8998.proxy.runpod.net"
echo "     Voice Engine: https://${POD_ID}-3460.proxy.runpod.net"
echo ""
echo "  📋 Commands:"
echo "     Logs:  tail -f /workspace/personaplex.log"
echo "     Stop:  kill \$(cat /workspace/personaplex.pid)"
echo "════════════════════════════════════════════"
