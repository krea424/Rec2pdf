#!/bin/bash
set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

PROJECT_ID="rec2pdf"
REGION="europe-west3"
SERVICE_NAME="rec2pdf-backend-v2"
IMAGE_URL="${REGION}-docker.pkg.dev/${PROJECT_ID}/rec2pdf-repo/backend:latest"

echo -e "${GREEN}�� Deploy Cloud Run${NC}"

# Vai alla root del progetto
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_ROOT"

echo -e "${YELLOW}📁 Building from: $(pwd)${NC}"

# Verifica struttura
for dir in Scripts Templates rec2pdf-backend; do
    if [ ! -d "$dir" ]; then
        echo -e "${RED}❌ Directory $dir non trovata!${NC}"
        exit 1
    fi
done

echo -e "${YELLOW}🔨 Build con Cloud Build...${NC}"
gcloud builds submit --tag ${IMAGE_URL} .

echo -e "${YELLOW}☁️  Deploy...${NC}"
gcloud run deploy ${SERVICE_NAME} \
    --image ${IMAGE_URL} \
    --region ${REGION} \
    --platform managed \
    --allow-unauthenticated \
    --memory 8Gi \
    --cpu 2 \
    --timeout 3600 \
    --min-instances 1 \
    --max-instances 3 \
    --set-env-vars "AI_TEXT_PROVIDER=openai,AI_TEXT_PROVIDER_FALLBACK=gemini,AI_EMBEDDING_PROVIDER=openai,NODE_ENV=production"

echo -e "${GREEN}✅ Fatto!${NC}"
SERVICE_URL=$(gcloud run services describe ${SERVICE_NAME} --region ${REGION} --format='value(status.url)')
echo "🌐 URL: $SERVICE_URL"
