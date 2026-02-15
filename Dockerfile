FROM node:20-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci --production

COPY . .

ENV VOICE_PORT=3460
ENV PERSONAPLEX_HOST=localhost
ENV PERSONAPLEX_PORT=8998

EXPOSE 3460

CMD ["node", "server.js"]
