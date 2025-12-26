/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 27555,
    strictPort: true, // Fail if port is in use instead of auto-incrementing
    proxy: {
      // Proxy API requests to tenant-management-service
      '/api': {
        target: 'http://localhost:14000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
  define: {
    'process.env': {},
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Core vendor chunk - React and React DOM
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          // Refine framework chunk
          'vendor-refine': ['@refinedev/core', '@refinedev/kbar', '@refinedev/react-router-v6'],
          // UI components and utilities
          'vendor-ui': ['lucide-react', 'react-idle-timer'],
          // OIDC/Auth chunk
          'vendor-auth': ['react-oidc-context', 'oidc-client-ts'],
        },
      },
    },
    // Increase chunk size warning limit slightly since we're optimizing
    chunkSizeWarningLimit: 600,
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{js,ts,jsx,tsx}'],
  },
});
