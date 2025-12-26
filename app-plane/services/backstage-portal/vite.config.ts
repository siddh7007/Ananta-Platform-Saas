import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react({
      jsxRuntime: 'automatic',
      // Ensure React symbol is available in any stray classic-JSX modules
      jsxInject: "import React from 'react'",
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'react-admin': ['react-admin', 'ra-core'],
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 27500,  // Backstage Admin Portal (Platform Management)
    strictPort: false,
    allowedHosts: [
      'localhost',
      '127.0.0.1',
      'host.docker.internal',
      '.local'
    ],
  },
  preview: {
    host: '0.0.0.0',
    port: 27500,  // Backstage Admin Portal preview
    strictPort: true,
  },
})
