#!/bin/bash
# PersonaPlex RunPod Setup Script
# Run this inside a RunPod pod with GPU (A40/A100/L4 24GB+)
#
# Prerequisites:
#   - RunPod pod with PyTorch template + CUDA
#   - Port 8998 exposed
#   - HuggingFace token (accept PersonaPlex license first)

set -e

echo "🎙️ PersonaPlex Setup — RunPod"
echo "=============================="

# Check GPU
echo ""
echo "GPU Info:"
nvidia-smi --query-gpu=name,memory.total --format=csv,noheader
echo ""

# Install system deps
echo "📦 Installing opus codec..."
apt-get update -qq && apt-get install -y -qq libopus-dev > /dev/null 2>&1
echo "✅ opus installed"

# Clone PersonaPlex
if [ ! -d "/workspace/personaplex" ]; then
  echo "📥 Cloning PersonaPlex..."
  git clone https://github.com/NVIDIA/personaplex.git /workspace/personaplex
else
  echo "📁 PersonaPlex already cloned"
  cd /workspace/personaplex && git pull
fi

cd /workspace/personaplex

# Install Python deps
echo "📦 Installing PersonaPlex..."
pip install -q moshi/.
echo "✅ PersonaPlex installed"

# Check for HF token
if [ -z "$HF_TOKEN" ]; then
  echo ""
  echo "⚠️  HF_TOKEN not set!"
  echo "   1. Go to https://huggingface.co/nvidia/personaplex-7b-v1"
  echo "   2. Accept the license"
  echo "   3. Export your token: export HF_TOKEN=hf_xxxxx"
  echo "   4. Re-run this script"
  exit 1
fi

echo ""
echo "✅ Setup complete!"
echo ""
echo "To start the server:"
echo "  cd /workspace/personaplex"
echo "  SSL_DIR=\$(mktemp -d); HF_TOKEN=$HF_TOKEN python -m moshi.server --ssl \"\$SSL_DIR\""
echo ""
echo "Server will be available at: https://<your-pod-ip>:8998"
echo "Use --cpu-offload if you get OOM errors"
