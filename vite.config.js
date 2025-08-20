import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Auth server (your Express + Prisma on :8001)
      '/api/auth': { target: 'http://localhost:8001', changeOrigin: true },

      // RAG API (FastAPI on :8000)
      '/api': { target: 'http://localhost:8000', changeOrigin: true },
    },
  },
});
