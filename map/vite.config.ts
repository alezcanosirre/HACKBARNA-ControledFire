import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      // El proxy local de incendios en vivo (api/src/live/server.ts) tiene
      // que estar corriendo aparte: `npm run live` dentro de api/.
      '/api': 'http://localhost:3001',
    },
  },
})
