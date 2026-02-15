# PersonaPlex Voice Engine — Agent Setup Guide

Step-by-step instructions for deploying PersonaPlex on RunPod. Written for AI agents but humans can follow too.

---

## Prerequisites

- **RunPod account** with billing enabled — [runpod.io](https://runpod.io)
- **RunPod API key** — Settings → API Keys
- **HuggingFace account** with access token — [huggingface.co/settings/tokens](https://huggingface.co/settings/tokens)
- **Model license accepted** — User must visit [nvidia/personaplex-7b-v1](https://huggingface.co/nvidia/personaplex-7b-v1) and click "Agree and access repository"

> ⚠️ The model license must be accepted by the HuggingFace account owner before deployment. An agent cannot do this.

---

## Step 1: Create RunPod GPU Pod

### Via Web UI
1. Go to [runpod.io/console/pods](https://runpod.io/console/pods)
2. Click **+ GPU Pod**
3. Select GPU: **A40 48GB** ($0.39/hr) or **A100 80GB** ($1.09/hr)
4. Template: **RunPod PyTorch 2.x** (or any CUDA 12+ image)
5. Under **Expose Ports**, add: `8998, 3460, 8888`
6. Volume: 50GB minimum (model is ~15GB)
7. Click **Deploy**

### Via API (for agents)
```bash
curl -s https://api.runpod.io/v2/pods \
  -H "Authorization: Bearer $RUNPOD_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "personaplex",
    "imageName": "runpod/pytorch:2.1.0-py3.10-cuda12.1.0-devel-ubuntu22.04",
    "gpuTypeId": "NVIDIA A40",
    "volumeInGb": 50,
    "containerDiskInGb": 20,
    "ports": "8998/http,3460/http,8888/http",
    "env": [{"key": "HF_TOKEN", "value": "YOUR_HF_TOKEN"}]
  }'
```

Wait for pod status to be `RUNNING` (1-3 minutes).

---

## Step 2: Install PersonaPlex on the Pod

Connect via SSH, web terminal, or Jupyter (`https://<pod-id>-8888.proxy.runpod.net`):

```bash
# System dependencies
apt-get update && apt-get install -y libopus-dev ffmpeg

# Clone PersonaPlex
cd /workspace
git clone https://github.com/NVIDIA/personaplex.git
cd personaplex

# Install Python packages
pip install ./moshi
pip install rustymimi
```

Estimated time: 3-5 minutes.

---

## Step 3: Start PersonaPlex Server

```bash
export HF_TOKEN=<your-huggingface-token>
cd /workspace/personaplex
python -m moshi.server --host 0.0.0.0 --port 8998
```

**First run:** Downloads ~15GB of model weights. Takes 5-15 minutes depending on connection.

**Server is ready when you see:**
```
Running on http://0.0.0.0:8998
```

### Run in background (recommended)
```bash
export HF_TOKEN=<your-huggingface-token>
nohup python -m moshi.server --host 0.0.0.0 --port 8998 > /workspace/personaplex.log 2>&1 &
echo $! > /workspace/personaplex.pid

# Check logs
tail -f /workspace/personaplex.log
```

---

## Step 4: Deploy Voice Engine (Optional Relay)

The Voice Engine relay server provides a clean web UI and bridges browser audio to PersonaPlex.

```bash
# Install Node.js if not present
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

# Clone and install Voice Engine
cd /workspace
git clone https://github.com/nikolateslasagent/voice-engine.git
cd voice-engine
npm install

# Point to PersonaPlex backend
export PERSONAPLEX_HOST=localhost
export PERSONAPLEX_PORT=8998

# Start
nohup node server.js > /workspace/voice-engine.log 2>&1 &
echo $! > /workspace/voice-engine.pid
```

---

## Step 5: Verify

Get your pod ID from the RunPod dashboard, then test:

| Service | URL |
|---|---|
| PersonaPlex (native UI) | `https://<pod-id>-8998.proxy.runpod.net` |
| Voice Engine (relay UI) | `https://<pod-id>-3460.proxy.runpod.net` |
| Jupyter | `https://<pod-id>-8888.proxy.runpod.net` |

### Health check
```bash
curl https://<pod-id>-3460.proxy.runpod.net/api/health
# Expected: {"status":"ok","activeSessions":0,"backendHost":"localhost:8998"}
```

---

## Step 6: Using the Voice Engine

1. Open the Voice Engine URL in a browser
2. Click the ⚙️ gear icon to configure settings (optional)
3. Select a persona preset or write a custom one
4. Choose a voice from the dropdown
5. Click **Start Call**
6. Grant microphone permission when prompted
7. Speak naturally — the AI responds in real-time

---

## One-Click Setup (Alternative)

Instead of steps 2-4, run this single command on the pod:

```bash
curl -sSL https://raw.githubusercontent.com/nikolateslasagent/voice-engine/main/setup.sh | HF_TOKEN=<your-token> bash
```

---

## Troubleshooting

### Port already in use
```bash
ss -tlnp | grep 8998
kill -9 <PID>
```

### Model license not accepted
Error: `401 Unauthorized` or `Access denied` when downloading model.
**Fix:** User must visit https://huggingface.co/nvidia/personaplex-7b-v1 and accept the license.

### 502 Bad Gateway on proxy URL
Server is still starting or crashed. Check:
```bash
tail -50 /workspace/personaplex.log
```

### Out of GPU memory
Use a larger GPU (A100 80GB) or reduce batch size. The 7B model needs ~20GB VRAM.

### WebSocket connection fails in browser
- Ensure ports 8998 and 3460 are exposed in pod settings
- Check that the relay server is running: `curl localhost:3460/api/health`
- Browser must use HTTPS for microphone access (RunPod proxy URLs are HTTPS)

### Audio quality issues
- Use Chrome or Edge (best Web Audio API support)
- Use wired headphones to prevent echo
- Check that sample rate is 24kHz (default)

---

## Stopping Services

```bash
# Stop PersonaPlex
kill $(cat /workspace/personaplex.pid)

# Stop Voice Engine
kill $(cat /workspace/voice-engine.pid)
```

## Cost Estimate

| GPU | Cost/hr | Cost/day |
|---|---|---|
| A40 48GB | $0.39 | $9.36 |
| A100 80GB | $1.09 | $26.16 |

**Remember to stop your pod when not in use!**
