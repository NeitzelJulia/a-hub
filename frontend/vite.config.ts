import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'

const host = process.env.VITE_DEV_HOST || 'localhost'
const port = Number(process.env.VITE_DEV_PORT) || 5173
const apiPort = Number(process.env.VITE_API_PORT) || 8080

export default defineConfig({
  plugins: [react()],
  server: {
    https: {
      key:  fs.readFileSync(path.resolve(__dirname, '../certs/cert-key.pem')),
      cert: fs.readFileSync(path.resolve(__dirname, '../certs/cert.pem')),
    },
    host,
    port,
    strictPort: true,
    hmr: { protocol: 'wss', host },
    proxy: {
      '/api': { target: `http://localhost:${apiPort}`, changeOrigin: true },
    },
  },
})
