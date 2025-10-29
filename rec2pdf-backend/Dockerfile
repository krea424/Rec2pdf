# =================================================================
# === Dockerfile v2.0 per Cloud Deploy (Render/Cloud Run) ===
# =================================================================

FROM node:20-slim

ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    NODE_ENV=production \
    PORT=8080

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
    && rm -rf /var/lib/apt/lists/*

# Installa PyTorch CPU-only
RUN pip3 install --no-cache-dir --break-system-packages \
    torch --index-url https://download.pytorch.org/whl/cpu

# Installa WhisperX (dal repo git per avere la versione completa)
RUN pip3 install --no-cache-dir --break-system-packages \
    git+https://github.com/m-bain/whisperX.git

WORKDIR /app

# Copia package files per cache npm
COPY rec2pdf-backend/package*.json ./rec2pdf-backend/

# Installa dipendenze Node
WORKDIR /app/rec2pdf-backend
RUN npm ci --only=production && npm cache clean --force

# Copia il resto del codice
WORKDIR /app
COPY . .

# Assicura che lo script sia eseguibile
RUN chmod +x Scripts/publish.sh

# Crea e usa utente non-root
RUN useradd -m appuser && chown -R appuser:appuser /app
WORKDIR /app/rec2pdf-backend
USER appuser

EXPOSE 8080
CMD ["node", "server.js"]