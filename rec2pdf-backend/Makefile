.PHONY: help backend tunnel frontend install-all

# Colori per l'output (opzionale, per stile)
GREEN=\033[0;32m
NC=\033[0m # No Color

help:
	@echo "${GREEN}Centro di Comando Rec2pdf${NC}"
	@echo "Usa tre terminali separati per lanciare l'ambiente:"
	@echo "  make backend   -> Avvia Docker Compose (Server + DB)"
	@echo "  make tunnel    -> Avvia Ngrok con dominio statico"
	@echo "  make frontend  -> Avvia la UI React"
	@echo ""
	@echo "Altri comandi:"
	@echo "  make install-all -> Installa dipendenze in entrambe le cartelle"

# Terminale 1: Infrastruttura
backend:
	@echo "${GREEN}Avvio Backend e Infrastruttura Docker...${NC}"
	docker-compose up

# Terminale 2: Connettività
tunnel:
	@echo "${GREEN}Avvio Tunnel Ngrok...${NC}"
	npm run tunnel --prefix rec2pdf-backend

# Terminale 3: Interfaccia
frontend:
	@echo "${GREEN}Avvio Frontend...${NC}"
	npm run dev --prefix rec2pdf-frontend

# Utility: Installa tutto (utile se cloni su un nuovo pc)
install-all:
	@echo "${GREEN}Installazione dipendenze Backend...${NC}"
	cd rec2pdf-backend && npm install
	@echo "${GREEN}Installazione dipendenze Frontend...${NC}"
	cd rec2pdf-frontend && npm install
	@echo "${GREEN}Tutto pronto!${NC}"