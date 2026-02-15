# PersonaPlex Voice Engine — OpenClaw Skill

## Overview
This skill guides setup of PersonaPlex, NVIDIA's real-time voice AI, on a RunPod GPU pod.

## Interactive Setup Flow

### Phase 1: Gather Credentials
Ask the user for:
1. **HuggingFace Token** — If they don't have one, send them GUIDE.md instructions (Steps 1)
2. **RunPod API Key** — If they don't have one, send them GUIDE.md instructions (Step 2)

Important: User MUST accept the model license at https://huggingface.co/nvidia/personaplex-7b-v1 before proceeding. Ask them to confirm they've done this.

### Phase 2: Create RunPod Pod (Agent does this autonomously)
Use RunPod GraphQL API to create a pod:

```bash
curl -s -H "Authorization: Bearer $RUNPOD_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "mutation { podFindAndDeployOnDemand(input: { name: \"personaplex\", gpuTypeId: \"48GB\", gpuCount: 1, volumeInGb: 50, containerDiskInGb: 20, templateId: \"runpod-torch-v21\", ports: \"8998/http,3460/http,8888/http\", startSsh: true }) { id machineId } }"
  }' \
  https://api.runpod.io/graphql
```

Alternative: Tell user to create pod manually:
- Go to runpod.io → Pods → Deploy
- GPU: A40 48GB (cheapest that works)
- Template: RunPod PyTorch 2.x
- Disk: 50GB volume
- Expose ports: 8998, 3460, 8888

### Phase 3: Install PersonaPlex (Agent does this via Jupyter terminal or SSH)
Once pod is running:
1. Access Jupyter terminal: https://<pod-id>-8888.proxy.runpod.net
2. Run commands:
```bash
apt-get update && apt-get install -y libopus-dev
cd /workspace
git clone https://github.com/NVIDIA/personaplex.git
cd personaplex
pip install ./moshi
pip install rustymimi
```

### Phase 4: Start Server
```bash
export HF_TOKEN=<user-provided-token>
python -m moshi.server --host 0.0.0.0 --port 8998
```
Wait for "Running on http://0.0.0.0:8998"

### Phase 5: Verify & Deliver
- Test: curl https://<pod-id>-8998.proxy.runpod.net (should return HTML)
- Tell user: "PersonaPlex is live! Open this URL: https://<pod-id>-8998.proxy.runpod.net"

### Ongoing Management Commands
User can say:
- "Stop my PersonaPlex pod" → Use RunPod API to stop
- "Start my PersonaPlex pod" → Use RunPod API to start, then restart server
- "Check my PersonaPlex status" → Query RunPod API for pod status
- "How much have I spent on PersonaPlex?" → Check RunPod billing

### RunPod API Reference
Stop pod: `mutation { podStop(input: { podId: "$POD_ID" }) { id } }`
Start pod: `mutation { podResume(input: { podId: "$POD_ID", gpuCount: 1 }) { id } }`
Pod status: `query { pod(input: { podId: "$POD_ID" }) { id name desiredStatus runtime { uptimeInSeconds } } }`

### Error Handling
- If port 8998 already in use: `ss -tlnp | grep 8998` then `kill -9 <pid>`
- If pip install fails: check disk space with `df -h`
- If model download fails: verify HF token and license acceptance
- If pod won't start: try different datacenter/GPU type
