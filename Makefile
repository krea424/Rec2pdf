backend:
	@echo "Avvio Backend..."
	docker-compose up

tunnel:
	@echo "Avvio Tunnel..."
	npm run tunnel --prefix rec2pdf-backend

frontend:
	@echo "Avvio Frontend..."
	npm run dev --prefix rec2pdf-frontend
