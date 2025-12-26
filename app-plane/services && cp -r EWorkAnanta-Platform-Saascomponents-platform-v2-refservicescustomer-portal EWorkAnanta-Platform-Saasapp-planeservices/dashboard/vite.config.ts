import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/cns/',  // Base path for Traefik routing at http://localhost:27500/cns
  server: {
    port: 27710,
    host: '0.0.0.0',
  },
  build: {
    outDir: 'dist',
  },
});
