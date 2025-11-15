FROM --platform=linux/amd64 node:20-slim

ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    NODE_ENV=production \
    PORT=8080 \
    PATH="/root/.local/bin:${PATH}"

# Dipendenze sistema
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg pandoc texlive-latex-base texlive-latex-extra \
    texlive-fonts-recommended texlive-xetex python3 python3-pip \
    git build-essential bash && rm -rf /var/lib/apt/lists/*

# Python
RUN pip3 install --no-cache-dir --break-system-packages --upgrade pip && \
    pip3 install --no-cache-dir --break-system-packages --timeout 600 \
    torch --index-url https://download.pytorch.org/whl/cpu && \
    pip3 install --no-cache-dir --break-system-packages \
    git+https://github.com/m-bain/whisperX.git && \
    python3 -c "from faster_whisper import WhisperModel; WhisperModel('base', device='cpu', compute_type='int8')" && \
    rm -rf /root/.cache/pip

# Copia tutto e poi installa
WORKDIR /app
COPY . .

RUN cd rec2pdf-backend && npm ci && npm cache clean --force
RUN chmod +x Scripts/publish.sh

WORKDIR /app/rec2pdf-backend
EXPOSE 8080
CMD ["node", "server.js"]