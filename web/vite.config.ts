import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: 5173, strictPort: true },
  css: { devSourcemap: true },
  build: { target: 'chrome120', sourcemap: true, chunkSizeWarningLimit: 1500 },
})
