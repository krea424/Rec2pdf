import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl' // 1. Importa il plugin SSL

export default defineConfig({
  plugins: [
    react(),
    basicSsl() // 2. Aggiungi il plugin alla lista
  ],
  server: {
    // 3. Abilita HTTPS e l'hosting sulla rete locale
    https: false,
    host: true, // Questo rende il server accessibile tramite il tuo IP locale
    port: 5173
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/setupTests.js',
    css: true,
    globals: true,
    include: ['src/**/*.test.{js,jsx,ts,tsx}'],
    exclude: ['tests/e2e/**', 'playwright.config.js']
  }
})