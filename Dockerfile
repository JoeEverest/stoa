# Self-hosted learning app: server + React app + the tools the teacher needs to make videos.
FROM node:24-bookworm

# ffmpeg for audio and video, Python for the Kokoro voice model, build tools so HyperFrames can
# build whisper.cpp for word timings, and the libraries headless Chrome needs to render frames.
RUN apt-get update && apt-get install -y --no-install-recommends \
      ffmpeg python3 python3-venv git cmake build-essential unzip ca-certificates curl jq \
      fonts-liberation fonts-noto-color-emoji \
      libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 libxkbcommon0 libxcomposite1 \
      libxdamage1 libxfixes3 libxrandr2 libgbm1 libasound2 libpango-1.0-0 libcairo2 \
    && rm -rf /var/lib/apt/lists/*

RUN python3 -m venv /opt/py && /opt/py/bin/pip install --no-cache-dir kokoro-onnx soundfile
ENV HYPERFRAMES_PYTHON=/opt/py/bin/python \
    PATH=/opt/py/bin:$PATH

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# The agent runs with all permissions inside the container, which Claude Code allows only for a
# non-root user. Everything that must survive a restart lives in /data.
RUN mkdir -p /data && chown -R node:node /data /app
USER node
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3210 \
    DATA_DIR=/data \
    HOME=/data/home \
    CLAUDE_CONFIG_DIR=/data/claude \
    HYPERFRAMES_NO_TELEMETRY=1
VOLUME /data
EXPOSE 3210
CMD ["node", "server/index.ts"]
