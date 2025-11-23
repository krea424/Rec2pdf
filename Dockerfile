# ==========================================
# STAGE 1: BUILDER (Costruzione Robusta)
# ==========================================
FROM node:20-slim as builder

ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    HF_HOME="/app/ai_models" \
    TORCH_HOME="/app/ai_models/torch"

WORKDIR /app

# 1. Installiamo tool + ffmpeg + certificati
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    python3-venv \
    git \
    build-essential \
    wget \
    ffmpeg \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# 2. Virtual Environment
RUN python3 -m venv /app/venv
ENV PATH="/app/venv/bin:$PATH"

# 3. Installazione Python "Golden Config" + WEASYPRINT
RUN pip install --upgrade pip && \
    # Torch CPU (versione stabile per WhisperX)
    pip install "torch==2.1.2" "torchaudio==2.1.2" --index-url https://download.pytorch.org/whl/cpu && \
    # Dipendenze core
    pip install "numpy<2.0.0" "pandas<2.2.0" "transformers==4.36.2" "pyannote.audio==3.1.1" && \
    # WhisperX
    pip install git+https://github.com/m-bain/whisperX.git && \
    # --- NUOVO: Installiamo il motore PDF ---
    pip install weasyprint

# 4. Preriscaldamento Modelli
RUN mkdir -p /app/ai_models/torch && \
    echo "Scaricamento modelli base..." && \
    ffmpeg -f lavfi -i "anullsrc=r=16000:cl=mono" -t 1 -q:a 9 dummy.wav && \
    whisperx dummy.wav --model small --language it --device cpu --compute_type float32 --align_model WAV2VEC2_ASR_BASE_10K_VOXPOPULI_ASR_ITALIAN_V2 || true && \
    rm dummy.wav

# 5. Dipendenze Node
COPY rec2pdf-backend/package*.json ./rec2pdf-backend/
WORKDIR /app/rec2pdf-backend
RUN npm ci --omit=dev


# ==========================================
# STAGE 2: RUNNER (Produzione Stabile)
# ==========================================
FROM node:20-slim

ENV NODE_ENV=production \
    PORT=8080 \
    HF_HOME="/app/ai_models" \
    TORCH_HOME="/app/ai_models/torch" \
    PATH="/app/venv/bin:${PATH}"

WORKDIR /app

# 6. Installazione Librerie di Sistema
# Rimosso: wkhtmltopdf, xvfb
# Aggiunto: Librerie Pango per WeasyPrint
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    pandoc \
    # --- Dipendenze Grafiche per WeasyPrint ---
    libpango-1.0-0 \
    libpangoft2-1.0-0 \
    libharfbuzz-subset0 \
    libjpeg-dev \
    libopenjp2-7-dev \
    libffi-dev \
    # ------------------------------------------
    libsndfile1 \
    libgomp1 \
    git \
    procps \
    ca-certificates \
    texlive-latex-base \
    texlive-latex-extra \
    texlive-fonts-recommended \
    texlive-xetex \
    python3 \
    && update-ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# 7. Copia Artefatti
COPY --from=builder /app/venv /app/venv
# Link simbolico per whisperx
RUN ln -s /app/venv/bin/whisperx /usr/local/bin/whisperx
# Link simbolico anche per weasyprint (per sicurezza, così pandoc lo trova)
RUN ln -s /app/venv/bin/weasyprint /usr/local/bin/weasyprint

COPY --from=builder /app/ai_models /app/ai_models
COPY --from=builder /app/rec2pdf-backend/node_modules /app/rec2pdf-backend/node_modules

COPY rec2pdf-backend /app/rec2pdf-backend
COPY Scripts /app/Scripts
COPY Templates /app/Templates
COPY assets /app/assets

# Setup Finale
WORKDIR /app/rec2pdf-backend
RUN chmod +x ../Scripts/publish.sh

EXPOSE 8080
CMD ["node", "server.js"]