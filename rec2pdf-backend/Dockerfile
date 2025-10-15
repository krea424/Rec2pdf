# =================================================================
# === Dockerfile Finale e Semplificato per Monorepo (v2) ===
# =================================================================

FROM node:20-slim

# 1. Imposta la directory di lavoro principale
WORKDIR /app

# 2. Copia l'intero monorepo nel container
COPY . .

# 3. Installazione delle dipendenze di sistema
#    Aggiungiamo '&&' per unire i comandi e migliorare la cache
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

# 4. Installazione di Whisper
RUN pip3 install --no-cache-dir --break-system-packages openai-whisper

# 5. Installa le dipendenze di Node.js
#    Specifichiamo esplicitamente la cartella con --prefix
RUN npm install --production --prefix rec2pdf-backend

# 6. Esponi la porta
EXPOSE 10000

# 7. Comando di avvio con percorso assoluto
CMD ["node", "rec2pdf-backend/server.js"]