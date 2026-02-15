# PersonaPlex Docker Image for RunPod / Self-Hosting
FROM pytorch/pytorch:2.4.0-cuda12.4-cudnn9-runtime

WORKDIR /app

# System deps
RUN apt-get update && apt-get install -y libopus-dev git && rm -rf /var/lib/apt/lists/*

# Clone and install PersonaPlex
RUN git clone https://github.com/NVIDIA/personaplex.git /app/personaplex
RUN cd /app/personaplex && pip install --no-cache-dir moshi/.

# Voice Engine relay server
RUN apt-get update && apt-get install -y curl && \
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && \
    apt-get install -y nodejs && rm -rf /var/lib/apt/lists/*

COPY package.json server.js /app/voice-engine/
COPY public/ /app/voice-engine/public/
RUN cd /app/voice-engine && npm install --production

# Start script
COPY deploy/start.sh /app/start.sh
RUN chmod +x /app/start.sh

EXPOSE 8998 3460

CMD ["/app/start.sh"]
