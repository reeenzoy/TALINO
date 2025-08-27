import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
    server: {
    proxy: {
      '/api/auth': { target: 'http://localhost:8001', changeOrigin: true },
      '/api/app':  { target: 'http://localhost:8001', changeOrigin: true }, // <-- these routes
      '/api':      { target: 'http://localhost:8000', changeOrigin: true }, // FastAPI
    }
  }
});
