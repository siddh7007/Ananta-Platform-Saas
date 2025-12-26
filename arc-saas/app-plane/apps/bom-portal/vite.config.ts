/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // When building for Docker (any build), use the subpath base
  // Only use root base for local dev server (vite serve)
  const isServing = process.env.npm_lifecycle_event === 'dev' || process.env.npm_lifecycle_event === 'serve';

  return {
    base: isServing ? '/' : '/customer-portal/',
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
      // Dedupe dependencies to ensure single instances of React context providers
      // This is critical when using npm link with packages that have peer dependencies
      dedupe: [
        'react',
        'react-dom',
        '@auth0/auth0-react',
        '@supabase/supabase-js',
        'react-admin',
        '@mui/material',
        '@mui/icons-material',
      ],
    },
    server: {
      host: '0.0.0.0',
      port: 27510, // Customer Portal (Customer-facing React Admin)
      strictPort: false,
      allowedHosts: [
        'localhost',
        '127.0.0.1',
        'host.docker.internal',
        '.local',
      ],
    },
    preview: {
      host: '0.0.0.0',
      port: 27510, // Customer Portal preview
      strictPort: true,
    },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: './src/test/setup.ts',
      include: ['src/**/*.{test,spec}.{ts,tsx}'],
      coverage: {
        reporter: ['text', 'json', 'html'],
        exclude: ['node_modules/', 'src/test/'],
      },
    },
  };
});
