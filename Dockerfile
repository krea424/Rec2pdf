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
    torch torchaudio --index-url https://download.pytorch.org/whl/cpu && \
    pip3 install --no-cache-dir --break-system-packages \
    git+https://github.com/m-bain/whisperX.git

# "Preriscalda" whisperx forzando il download di TUTTI i modelli necessari durante la build.
# Questo comando scaricherà il modello 'small' di Whisper e il modello di allineamento per l'italiano.
RUN whisperx dummy.wav --model small --language it --device cpu --compute_type float32 --align_model WAV2VEC2_ASR_BASE_10K_VOXPOPULI_ASR_ITALIAN_V2 || true

# Pulisci la cache di pip alla fine
RUN rm -rf /root/.cache/pip

# Copia tutto e poi installa
WORKDIR /app
COPY . .

RUN cd rec2pdf-backend && npm ci && npm cache clean --force
RUN chmod +x Scripts/publish.sh

WORKDIR /app/rec2pdf-backend
EXPOSE 8080
CMD ["node", "server.js"]