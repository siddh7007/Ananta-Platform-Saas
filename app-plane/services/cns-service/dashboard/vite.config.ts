import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

/**
 * Security Headers Plugin for Vite Dev Server
 *
 * Adds security headers to all responses during development.
 * Production deployments should configure these in nginx/reverse proxy.
 */
function securityHeadersPlugin(): Plugin {
  return {
    name: 'security-headers',
    configureServer(server) {
      server.middlewares.use((_req, res, next) => {
        // Prevent MIME type sniffing
        res.setHeader('X-Content-Type-Options', 'nosniff');

        // Prevent clickjacking
        res.setHeader('X-Frame-Options', 'SAMEORIGIN');

        // XSS Protection (legacy browsers)
        res.setHeader('X-XSS-Protection', '1; mode=block');

        // Referrer Policy
        res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

        // Permissions Policy (disable sensitive features)
        res.setHeader(
          'Permissions-Policy',
          'camera=(), microphone=(), geolocation=(), payment=()'
        );

        // Note: CSP is set in index.html via meta tag for broader compatibility
        // Production should set CSP via HTTP header in nginx

        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    securityHeadersPlugin(),
  ],
  resolve: {
    alias: {
      // Alias for consistent imports
      '@': path.resolve(__dirname, './src'),
    },
  },
  base: '/',  // Base path - standalone deployment at root
  server: {
    port: 27710,
    host: '0.0.0.0',
    // Additional security for dev server
    cors: {
      // Restrict CORS to known origins in development
      origin: [
        'http://localhost:27710',
        'http://localhost:27500',
        'http://localhost:27800',
      ],
      credentials: true,
    },
  },
  build: {
    outDir: 'dist',
    // Enable source maps for debugging but exclude in production
    sourcemap: process.env.NODE_ENV !== 'production',
  },
  // Ensure environment variables are explicitly listed
  envPrefix: 'VITE_',
});
