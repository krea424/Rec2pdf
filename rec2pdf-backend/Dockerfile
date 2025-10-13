# NUOVO Dockerfile per Monorepo

# Fase 1: Build
FROM node:18-alpine AS builder

# Imposta la directory di lavoro alla root del monorepo
WORKDIR /app

# Copia i file package.json e package-lock.json del backend
COPY rec2pdf-backend/package*.json ./rec2pdf-backend/

# Entra nella cartella del backend e installa le dipendenze
RUN cd rec2pdf-backend && npm install --production

# Fase 2: Produzione
FROM node:18-alpine

WORKDIR /app

# Copia le dipendenze installate dalla fase di build
COPY --from=builder /app/rec2pdf-backend/node_modules ./rec2pdf-backend/node_modules

# Copia l'intero codice sorgente del monorepo
COPY . .

# Imposta la directory di lavoro finale sulla cartella del backend
WORKDIR /app/rec2pdf-backend

# Esponi la porta che il server userà
EXPOSE 10000

# Il comando per avviare il server
CMD ["node", "server.js"]