import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Send only auth routes to the auth server
      '/api/auth': { target: 'http://localhost:8001', changeOrigin: true }
    }
  }
});
