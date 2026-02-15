# PersonaPlex Voice Engine — Setup Guide

## What You'll Need
- A credit card (for RunPod GPU rental, ~$0.40/hr only when running)
- 10 minutes of setup time

## Step 1: Create a HuggingFace Account
1. Go to https://huggingface.co/join
2. Sign up with email
3. Go to https://huggingface.co/nvidia/personaplex-7b-v1
4. Click "Agree and access repository" (required to download the AI model)
5. Go to https://huggingface.co/settings/tokens
6. Click "New token" → name it "personaplex" → select "Read" → Create
7. Copy and save this token (starts with hf_...)

## Step 2: Create a RunPod Account
1. Go to https://runpod.io/signup
2. Sign up and add a payment method (Settings → Billing)
3. Go to https://runpod.io/console/user/settings → API Keys
4. Click "Create API Key" → name it "personaplex" → copy and save it (starts with rpa_...)

## Step 3: Give These to Your Agent
Tell your AI agent:
- "Here's my HuggingFace token: hf_..."
- "Here's my RunPod API key: rpa_..."
- "Set up PersonaPlex voice engine"

Your agent will handle everything else — creating the GPU pod, installing the software, and starting the server.

## Step 4: Using PersonaPlex
Once your agent confirms setup is complete, you'll get a URL like:
https://xxxxx-8998.proxy.runpod.net

Open it in your browser, pick a persona and voice, click Connect, and start talking!

## Managing Costs
- Your GPU pod costs ~$0.40/hr while running
- Stop it when not in use (your agent can do this for you)
- Storage while stopped: ~$2-3/month
- Say "stop my PersonaPlex pod" to your agent anytime

## Troubleshooting
- "502 Bad Gateway" → The server needs a minute to start up, wait and refresh
- "Access denied" on HuggingFace → Make sure you accepted the model license in Step 1
- Want to restart? Just tell your agent "restart PersonaPlex"
