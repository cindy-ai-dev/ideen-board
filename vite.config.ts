import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // localStorage ist an die vollständige Browser-Origin gebunden. Wenn Vite
  // bei belegtem Port still auf 5174 ausweicht, erscheint das Board deshalb
  // leer, obwohl die Daten weiterhin unter localhost:5173 gespeichert sind.
  // Mit festem Port wird dieser gefährliche Wechsel sichtbar verhindert.
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
  },
})
