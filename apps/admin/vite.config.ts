import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // Local dev: proxy the REST API to the Functions emulator.
    proxy: { '/api': { target: 'http://127.0.0.1:5001/svr-maths-academy/asia-south1/api', changeOrigin: true, rewrite: (p) => p.replace(/^\/api/, '') } },
  },
  build: { chunkSizeWarningLimit: 1200 },
});
