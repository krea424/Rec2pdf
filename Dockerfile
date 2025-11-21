# ==========================================
# STAGE 1: BUILDER (Costruzione e Download)
# ==========================================
FROM node:20-slim as builder

# Variabili per evitare interazioni e cache python
ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    HF_HOME="/app/ai_models" 

WORKDIR /app

# Installiamo i tool di compilazione (che POI butteremo via)
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    python3-venv \
    git \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Creiamo un Virtual Environment (VENV) per isolare le librerie Python
# Questo ci permette di copiare facilmente tutta la cartella nel prossimo stage
RUN python3 -m venv /app/venv
ENV PATH="/app/venv/bin:$PATH"

# Installiamo le dipendenze Python nel VENV
# Nota: Aggiorniamo pip e installiamo le dipendenze pesanti
RUN pip install --upgrade pip && \
    pip install timeout-decorator && \
    pip install torch torchaudio --index-url https://download.pytorch.org/whl/cpu && \
    pip install git+https://github.com/m-bain/whisperX.git

# "Preriscaldamento" Modelli AI (Embedding & Whisper)
# Li scarichiamo in HF_HOME (/app/ai_models) così possiamo copiarli dopo.
# Il comando "whisperx dummy.wav" forza il download.
RUN echo "Pre-scaricamento modelli..." && \
    touch dummy.wav && \
    whisperx dummy.wav --model small --language it --device cpu --compute_type float32 --align_model WAV2VEC2_ASR_BASE_10K_VOXPOPULI_ASR_ITALIAN_V2 || true && \
    rm dummy.wav

# Prepariamo le dipendenze Node del backend
# Copiamo solo i file di definizione prima (per sfruttare la cache di Docker)
COPY rec2pdf-backend/package*.json ./rec2pdf-backend/
WORKDIR /app/rec2pdf-backend
RUN npm ci --omit=dev

# ==========================================
# STAGE 2: RUNNER (Immagine Finale Leggera)
# ==========================================
FROM node:20-slim

ENV NODE_ENV=production \
    PORT=8080 \
    # Diciamo all'app dove trovare i modelli scaricati prima
    HF_HOME="/app/ai_models" \
    # Aggiungiamo il venv al path di sistema
    PATH="/app/venv/bin:${PATH}"

WORKDIR /app

# Installiamo SOLO le dipendenze di runtime (niente compilatori!)
# Nota: texlive è pesante ma necessario. 
# Rimuoviamo texlive-latex-extra se non strettamente necessario per risparmiare ~1GB, 
# ma per ora lo teniamo per evitare regressioni sui template complessi.
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    pandoc \
    texlive-latex-base \
    texlive-latex-extra \
    texlive-fonts-recommended \
    texlive-xetex \
    python3 \
    && rm -rf /var/lib/apt/lists/*

# --- COPIA DAGLI ARTEFATTI DEL BUILDER ---

# 1. Copiamo il Virtual Environment Python (con torch, whisperx già installati)
COPY --from=builder /app/venv /app/venv

# 2. Copiamo i Modelli AI scaricati (così non li scarica al boot)
COPY --from=builder /app/ai_models /app/ai_models

# 3. Copiamo i node_modules installati
COPY --from=builder /app/rec2pdf-backend/node_modules /app/rec2pdf-backend/node_modules

# 4. Copiamo il codice sorgente (filtrato dal .dockerignore)
# Nota: Copiamo le cartelle specifiche per mantenere la struttura
COPY rec2pdf-backend /app/rec2pdf-backend
COPY Scripts /app/Scripts
COPY Templates /app/Templates
COPY assets /app/assets

# Setup permessi e workdir finale
WORKDIR /app/rec2pdf-backend
RUN chmod +x ../Scripts/publish.sh

EXPOSE 8080

# Avvio
CMD ["node", "server.js"]