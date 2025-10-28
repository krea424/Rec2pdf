# =================================================================
# === Dockerfile Definitivo per Deploy Monorepo (rec2pdf-backend) ===
# =================================================================

# Usa un'immagine base ufficiale e leggera di Node.js
FROM node:20-slim

# 1. Installazione delle dipendenze di sistema
#    - usiamo --no-install-recommends per un'immagine più piccola
#    - includiamo tutte le dipendenze necessarie per la pipeline
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

# 2. Installazione delle dipendenze Python (Whisper e WhisperX)
#    Installiamo direttamente whisperX che include whisper come dipendenza
#    Impostiamo un timeout più alto perché il pacchetto scarica runtime NVIDIA molto grandi
ENV PIP_DEFAULT_TIMEOUT=1000
RUN pip3 install --no-cache-dir --break-system-packages git+https://github.com/m-bain/whisperX.git

# 3. Imposta la directory di lavoro principale nel container
WORKDIR /app

# 4. Copia l'intero monorepo nel container
#    Questo è il passaggio chiave che assicura che le cartelle 'Scripts' e 'Templates' siano presenti
COPY . .

# 5. Imposta la directory di lavoro sulla cartella specifica del backend
WORKDIR /app/rec2pdf-backend

# 6. Installa le dipendenze di Node.js
#    Usiamo --omit=dev per installare solo le dipendenze di produzione
RUN npm install --omit=dev

# 7. Esponi la porta che il nostro server ascolterà
#    Le piattaforme come Render e Cloud Run si aspettano 10000 di default
EXPOSE 10000

# 8. Il comando per avviare il server
#    Usa il percorso relativo alla WORKDIR corrente
CMD ["node", "server.js"]
