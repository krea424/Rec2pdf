import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: 'localhost',
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
