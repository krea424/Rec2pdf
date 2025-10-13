# =================================================================
# === Dockerfile Finale per Monorepo con Dipendenze di Sistema ===
# =================================================================

# --- Fase 1: Builder ---
# Questa fase installa solo le dipendenze Node.js in modo pulito
FROM node:20-slim AS builder

WORKDIR /app

# Copia solo i file package.json del backend per sfruttare la cache di Docker
COPY rec2pdf-backend/package*.json ./rec2pdf-backend/

# Entra nella cartella del backend e installa le dipendenze di produzione
RUN cd rec2pdf-backend && npm install --production


# --- Fase 2: Produzione ---
# Questa fase costruisce l'immagine finale
FROM node:20-slim

# Installazione delle dipendenze di sistema (ffmpeg, whisper, pandoc, etc.)
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

# Installazione di Whisper
RUN pip3 install --no-cache-dir --break-system-packages openai-whisper

WORKDIR /app

# Copia le dipendenze Node.js pre-installate dalla fase di build
COPY --from=builder /app/rec2pdf-backend/node_modules ./rec2pdf-backend/node_modules

# Copia l'intero codice sorgente del monorepo (Scripts, Templates, etc.)
COPY . .

# Imposta la directory di lavoro finale sulla cartella del backend
WORKDIR /app/rec2pdf-backend

# Esponi la porta che il server userà (Render si aspetta 10000 di default)
EXPOSE 10000

# Il comando per avviare il server
CMD ["node", "server.js"]