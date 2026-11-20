import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  worker: { format: 'es' },
  // Online play: `npm run dev:server` runs the game server on 8787; Vite forwards to it.
  server: {
    proxy: {
      '/api': 'http://localhost:8787',
      '/ws': { target: 'ws://localhost:8787', ws: true },
    },
  },
  // The opening book (src/analysis/openings.json, ~100 kB gzipped) is its own
  // lazy chunk, loaded only by the review page.
  build: { chunkSizeWarningLimit: 750 },
})
