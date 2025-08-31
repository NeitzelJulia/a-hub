import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  server: {
    https: {
      key:  fs.readFileSync(path.resolve(__dirname, '../certs/192.168.0.163-key.pem')),
      cert: fs.readFileSync(path.resolve(__dirname, '../certs/192.168.0.163.pem')),
    },
    host: '192.168.0.163',
    port: 5173,
    strictPort: true,
    hmr: { protocol: 'wss', host: '192.168.0.163' },
    proxy: {
      '/api':    { target: 'http://localhost:8080', changeOrigin: true },
      '/socket': { target: 'ws://localhost:8080',   changeOrigin: true, ws: true },
    },
  },
})
