# =================================================================
# === Dockerfile Finale e Semplificato per Monorepo ===
# =================================================================

FROM node:20-slim

# 1. Installazione delle dipendenze di sistema (ffmpeg, whisper, pandoc, etc.)
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

# 2. Installazione di Whisper
RUN pip3 install --no-cache-dir --break-system-packages openai-whisper

# 3. Imposta la directory di lavoro
WORKDIR /app

# 4. Copia l'intero monorepo nel container
# Questo assicura che Scripts, Templates, e il backend siano tutti presenti
COPY . .

# 5. Imposta la directory di lavoro sulla cartella del backend
WORKDIR /app/rec2pdf-backend

# 6. Installa le dipendenze di Node.js
RUN npm install --production

# 7. Esponi la porta che il server userà
EXPOSE 10000

# 8. Il comando per avviare il server
CMD ["node", "server.js"]