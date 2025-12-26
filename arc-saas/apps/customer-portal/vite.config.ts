import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { visualizer } from 'rollup-plugin-visualizer';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';
import crypto from 'crypto';

/**
 * CSP Nonce Plugin
 * Injects nonces into script and style tags for Content Security Policy
 *
 * Development: Uses a static nonce per build session
 * Production: Nginx generates nonce per request using $request_id
 */
function cspNoncePlugin(): Plugin {
  // Generate a nonce for dev builds (regenerated on each build)
  const devNonce = crypto.randomBytes(16).toString('base64');

  return {
    name: 'csp-nonce',
    transformIndexHtml: {
      order: 'pre',
      handler(html: string) {
        const isDev = process.env.NODE_ENV === 'development';
        const nonce = isDev ? devNonce : '{{CSP_NONCE}}'; // Placeholder for nginx sub_filter

        // Add nonce to all script and style tags
        let transformed = html
          .replace(/<script(?!.*nonce=)/g, `<script nonce="${nonce}"`)
          .replace(/<style(?!.*nonce=)/g, `<style nonce="${nonce}"`);

        // Add nonce to CSP meta tag if present
        transformed = transformed.replace(
          /script-src ([^;]+);/g,
          `script-src $1 'nonce-${nonce}';`
        ).replace(
          /style-src ([^;]+);/g,
          `style-src $1 'nonce-${nonce}';`
        );

        return transformed;
      },
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    cspNoncePlugin(),
    react(),
    // Bundle visualizer - generates stats.html after build
    visualizer({
      filename: 'dist/stats.html',
      open: false,
      gzipSize: true,
      brotliSize: true,
      template: 'treemap',
    }),
    // PWA configuration for offline support and service worker
    VitePWA({
      registerType: 'autoUpdate', // Changed from 'prompt' for immediate updates
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
      manifest: {
        name: 'Component Platform',
        short_name: 'CP',
        description: 'Component Platform - Manage and analyze your Bill of Materials',
        theme_color: '#0a0a1a',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        // Only precache HTML and essential assets - JS/CSS use NetworkFirst at runtime
        // This prevents stale JS from being served during SW updates
        globPatterns: ['**/*.{html,ico,png,svg,woff,woff2}'],
        // Exclude stats.html (bundle visualizer) from precaching
        globIgnores: ['**/node_modules/**/*', 'stats.html', '**/assets/*.js', '**/assets/*.css'],
        // Allow larger files to be cached (default is 2MB)
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5MB
        // Force immediate activation of new service worker
        skipWaiting: true,
        clientsClaim: true,
        // Clean up outdated caches from previous versions
        cleanupOutdatedCaches: true,
        // IMPORTANT: SSE/EventSource endpoints must NOT be intercepted by ServiceWorker
        // They are streaming connections that cannot be cached. List patterns to skip.
        navigateFallbackDenylist: [
          /\/api\/enrichment\/stream\//,  // SSE enrichment progress stream
          /\/api\/bom\/workflow\/stream/,  // SSE workflow status stream
          /\/events$/,                      // Generic SSE endpoints
          /\/sse$/,
        ],
        runtimeCaching: [
          {
            // Only cache same-origin images (local assets)
            // External images (mouser.com, digikey.com, etc.) are NOT cached
            // to avoid CORS issues with cross-origin ServiceWorker caching
            urlPattern: ({ url, sameOrigin }) => {
              const isImage = /\.(png|jpg|jpeg|svg|gif|webp|ico)$/i.test(url.pathname);
              // Only cache if same origin (local assets)
              return sameOrigin && isImage;
            },
            handler: 'CacheFirst',
            options: {
              cacheName: 'image-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            // API caching - EXCLUDES SSE/streaming endpoints
            // SSE endpoints contain 'stream', 'events', or 'sse' in path and must be skipped
            urlPattern: ({ url }) => {
              const isApiHost = /^https?:\/\/localhost:(14000|27200|27810)/.test(url.href);
              const isStreaming = /\/(stream|events|sse)(\/|$)/i.test(url.pathname);
              // Only cache API requests that are NOT streaming
              return isApiHost && !isStreaming;
            },
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              networkTimeoutSeconds: 3,
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 5, // 5 minutes
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: /^https?.*\.(woff|woff2|ttf|eot)$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'font-cache',
              expiration: {
                maxEntries: 30,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            // JS/CSS: Use NetworkFirst to ensure fresh code on navigation
            // Longer timeout prevents premature cache fallback during slow loads
            urlPattern: /^https?.*\.(css|js)$/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'asset-cache',
              networkTimeoutSeconds: 10, // Increased from 3s to prevent stale cache fallback
              expiration: {
                maxEntries: 60,
                maxAgeSeconds: 60 * 60 * 24, // 1 day
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
      },
      devOptions: {
        enabled: true,
        type: 'module',
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 27100,
    strictPort: true,
    headers: {
      // CSP for development with Vite HMR
      // Note: 'unsafe-inline' and 'unsafe-eval' required for Vite HMR + React Refresh in development
      // Production builds use stricter CSP with nonces via nginx
      'Content-Security-Policy': [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Required for Vite dev server + React Refresh
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com", // unsafe-inline for Tailwind
        "img-src 'self' data: blob: https:",
        "font-src 'self' https://fonts.gstatic.com data:",
        "connect-src 'self' http://localhost:14000 http://localhost:27000 http://localhost:27200 http://localhost:27810 http://localhost:8180 http://localhost:4318 http://localhost:13100 ws://localhost:27100 ws://localhost:5001 https://*.sentry.io",
        "frame-src 'self' http://localhost:8180",
        "form-action 'self' http://localhost:8180",
        "base-uri 'self'",
        "object-src 'none'",
        "worker-src 'self' blob:",
        "frame-ancestors 'none'",
      ].join('; '),
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'SAMEORIGIN',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
    },
    proxy: {
      '/api/cns': {
        target: 'http://localhost:27200',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/cns/, '/api'),
      },
      '/platform': {
        target: 'http://localhost:14000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    chunkSizeWarningLimit: 250,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-refine': ['@refinedev/core', '@refinedev/react-router-v6', '@refinedev/devtools'],
          'vendor-query': ['@tanstack/react-query'],
          'vendor-ui': ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu', '@radix-ui/react-select', '@radix-ui/react-tabs', '@radix-ui/react-alert-dialog', '@radix-ui/react-tooltip', '@radix-ui/react-popover', '@radix-ui/react-label', '@radix-ui/react-progress', '@radix-ui/react-slot'],
          'vendor-icons': ['lucide-react'],
          'vendor-charts': ['recharts'],
          'vendor-date': ['date-fns'],
          'vendor-xlsx': ['xlsx'],
          'feature-bom': ['./src/pages/boms/BomList', './src/pages/boms/BomDetail', './src/pages/boms/BomUpload', './src/pages/boms/RiskAnalysis'],
          'feature-components': ['./src/pages/components/ComponentList', './src/pages/components/ComponentCompareView', './src/pages/components/ComponentDetailDrawer'],
          'feature-portfolio': ['./src/pages/portfolio/index', './src/pages/portfolio/components/PortfolioStats', './src/pages/portfolio/components/BomsByEngineer', './src/pages/portfolio/components/SpendOverview', './src/pages/portfolio/components/RiskSummary', './src/pages/portfolio/components/RecentActivity'],
        },
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
});
