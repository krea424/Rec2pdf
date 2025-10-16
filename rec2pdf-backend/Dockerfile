# syntax=docker/dockerfile:1.4
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

# 3. Copia i manifest del backend indipendentemente dalla directory di build
RUN --mount=type=bind,source=.,target=/src \
    set -eux; \
    if [ -f /src/package.json ]; then \
      cp /src/package.json /app/package.json; \
      if [ -f /src/package-lock.json ]; then cp /src/package-lock.json /app/package-lock.json; fi; \
    elif [ -f /src/rec2pdf-backend/package.json ]; then \
      cp /src/rec2pdf-backend/package.json /app/package.json; \
      if [ -f /src/rec2pdf-backend/package-lock.json ]; then cp /src/rec2pdf-backend/package-lock.json /app/package-lock.json; fi; \
    else \
      echo "Unable to locate backend package.json" >&2; \
      exit 1; \
    fi

# 4. Installa le dipendenze Node.js (solo runtime)
RUN npm install --production

# 5. Copia il codice backend e il bundle professionale di publishing
RUN --mount=type=bind,source=.,target=/src \
    set -eux; \
    if [ -f /src/server.js ]; then \
      cd /src; \
      tar -cf - --exclude=node_modules --exclude=.git --exclude=.DS_Store . | tar -xf - -C /app; \
    elif [ -d /src/rec2pdf-backend ]; then \
      cd /src/rec2pdf-backend; \
      tar -cf - --exclude=node_modules --exclude=.git --exclude=.DS_Store . | tar -xf - -C /app; \
    else \
      echo "Unable to locate backend sources" >&2; \
      exit 1; \
    fi

ENV PUBLISH_BUNDLE_ROOT=/app/publish-bundle

# 6. Installa Whisper via pip (richiede python3/pip già presenti)
RUN pip3 install --no-cache-dir --break-system-packages openai-whisper

# 7. Porta esposta dal server Express
EXPOSE 10000

# 8. Comando di avvio del backend
CMD ["node", "server.js"]
