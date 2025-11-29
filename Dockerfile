# Usa Debian 12 (Bookworm) Full - Massima compatibilità
FROM node:20-bookworm

# 1. Configurazione Ambiente per Cloud Run
ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    # Variabili Cache su /tmp (RAM)
    HF_HOME="/tmp/hf" \
    TORCH_HOME="/tmp/torch" \
    XDG_CACHE_HOME="/tmp/cache" \
    MPLCONFIGDIR="/tmp/matplotlib" \
    NUMBA_CACHE_DIR="/tmp/numba" \
    # Percorsi App
    PROJECT_ROOT=/app \
    TEMPLATES_DIR=/app/Templates \
    ASSETS_DIR=/app/assets \
    PUBLISH_SCRIPT=/app/Scripts/publish.sh

WORKDIR /app

# 2. Installazione Dipendenze di Sistema (TUTTO INSIEME)
# Installiamo Python, FFmpeg, e le librerie per Weasyprint e WhisperX
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    python3-dev \
    python3-venv \
    ffmpeg \
    git \
    libsndfile1 \
    build-essential \
    # Dipendenze WeasyPrint
    libpango-1.0-0 \
    libpangoft2-1.0-0 \
    libharfbuzz-subset0 \
    libjpeg-dev \
    libopenjp2-7-dev \
    libffi-dev \
    # Dipendenze LaTeX
    pandoc \
    texlive-latex-base \
    texlive-fonts-recommended \
    texlive-latex-extra \
    texlive-xetex \
    && rm -rf /var/lib/apt/lists/*

# 3. Setup Python Environment Globale
# Usiamo --break-system-packages perché siamo in un container isolato, è ok.
RUN python3 -m pip install --upgrade pip --break-system-packages

# Installiamo Torch CPU (per risparmiare spazio)
RUN python3 -m pip install torch torchaudio --index-url https://download.pytorch.org/whl/cpu --break-system-packages

# Installiamo WhisperX e Weasyprint
RUN python3 -m pip install git+https://github.com/m-bain/whisperX.git --break-system-packages
RUN python3 -m pip install weasyprint --break-system-packages

# 4. Setup Node.js Backend
COPY rec2pdf-backend/package*.json ./rec2pdf-backend/
WORKDIR /app/rec2pdf-backend
RUN npm ci --omit=dev

# 5. Copia del Codice Sorgente
WORKDIR /app
COPY rec2pdf-backend /app/rec2pdf-backend
COPY Scripts /app/Scripts
COPY Templates /app/Templates
COPY assets /app/assets

# 6. Permessi
WORKDIR /app/rec2pdf-backend
RUN chmod +x ../Scripts/publish.sh

# Esposizione
EXPOSE 8080
CMD ["node", "server.js"]