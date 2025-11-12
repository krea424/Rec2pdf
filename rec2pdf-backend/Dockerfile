# =================================================================
# === Dockerfile v3.1 - Definitivo per Cloud Deploy ===
# =================================================================

FROM node:20-slim

# Imposta variabili d'ambiente globali
ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    NODE_ENV=production \
    PORT=8080 \
    # Aggiunge la cartella degli eseguibili di pip al PATH di sistema
    PATH="/root/.local/bin:${PATH}"

# Installa dipendenze di sistema
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    pandoc \
    texlive-latex-base \
    texlive-latex-extra \
    texlive-fonts-recommended \
    texlive-xetex \
    python3 \
    python3-pip \
    git \
    build-essential \
    bash \
    && rm -rf /var/lib/apt/lists/*

# === Installazione Dipendenze Python a Passi ===

# 1. Aggiorna pip
RUN pip3 install --no-cache-dir --break-system-packages --upgrade pip

# 2. Installa PyTorch CPU-only (la dipendenza più pesante)
RUN pip3 install --no-cache-dir --break-system-packages --timeout 600 \
    torch --index-url https://download.pytorch.org/whl/cpu

# 3. Installa WhisperX (che fornisce il comando 'whisperx')
RUN pip3 install --no-cache-dir --break-system-packages \
    git+https://github.com/m-bain/whisperX.git

# 4. Pre-scarica il modello Whisper per evitare download in runtime
RUN python3 -c "from faster_whisper import WhisperModel; WhisperModel('base', device='cpu', compute_type='int8')"

# Pulisce la cache di pip per ridurre la dimensione dell'immagine
RUN rm -rf /root/.cache/pip

# === Configurazione Applicazione Node.js ===

WORKDIR /app

# Copia package files per cache npm
COPY rec2pdf-backend/package*.json ./rec2pdf-backend/

# Installa dipendenze Node
WORKDIR /app/rec2pdf-backend
RUN npm ci && npm cache clean --force

# Copia il resto del codice
WORKDIR /app
COPY . .

# Assicura che lo script sia eseguibile
RUN chmod +x Scripts/publish.sh

# Crea e usa utente non-root per sicurezza (opzionale per debug, ma buona pratica)
# RUN useradd -m appuser && chown -R appuser:appuser /app
# WORKDIR /app/rec2pdf-backend
# USER appuser

# Imposta la directory di lavoro finale
WORKDIR /app/rec2pdf-backend

EXPOSE 8080
CMD ["node", "server.js"]