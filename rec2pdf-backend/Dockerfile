# =================================================================
# === Dockerfile backend Rec2PDF (monorepo aware)               ===
# =================================================================

FROM node:20-slim

# 1. Directory di lavoro dell'applicazione
WORKDIR /app

# 2. Dipendenze di sistema richieste dalla toolchain audio + PDF
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    pandoc \
    texlive-latex-extra \
    python3 \
    python3-pip \
    git \
    build-essential \
    rustc \
    && rm -rf /var/lib/apt/lists/*

# 3. Installa le dipendenze Node.js (solo runtime)
COPY rec2pdf-backend/package*.json ./
RUN npm install --production

# 4. Copia il codice backend e il bundle professionale di publishing
COPY rec2pdf-backend/. ./
ENV PUBLISH_BUNDLE_ROOT="/app/publish-bundle"

# 5. Installa Whisper via pip (richiede python3/pip già presenti)
RUN pip3 install --no-cache-dir --break-system-packages openai-whisper

# 6. Porta esposta dal server Express
EXPOSE 10000

# 7. Comando di avvio del backend
CMD ["node", "server.js"]
