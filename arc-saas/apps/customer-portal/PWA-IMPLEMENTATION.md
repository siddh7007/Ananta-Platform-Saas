# PWA Implementation - CBP Customer Portal

## Overview

The Customer Portal has been enhanced with Progressive Web App (PWA) capabilities, enabling offline functionality, installability, and improved performance through service worker caching.

## Features Implemented

### 1. Service Worker Registration
- **File**: `src/lib/service-worker-registration.ts`
- Automatic service worker registration on app load
- Update detection with user notification
- Manual update trigger function
- Offline-ready detection

### 2. Offline Indicator
- **Component**: `src/components/ui/offline-indicator.tsx`
- Real-time network status detection
- Banner notification when offline
- Auto-dismisses when connection restored
- Optional "back online" message
- Accessible with ARIA attributes

### 3. PWA Update Prompt
- **Component**: `src/components/ui/pwa-update-prompt.tsx`
- Prompts user when new version available
- "Reload Now" or "Later" options
- Dismissible notification
- Optional "offline ready" confirmation
- Compact badge variant for headers

### 4. Caching Strategies

#### Static Assets (CacheFirst)
- Images: `.png`, `.jpg`, `.jpeg`, `.svg`, `.gif`, `.webp`, `.ico`
- Cache name: `image-cache`
- Max 100 entries, 30 days expiration
- Fast load times, minimal network requests

#### API Calls (NetworkFirst)
- Endpoints: `localhost:14000`, `localhost:27200`, `localhost:27810`
- Cache name: `api-cache`
- 3-second network timeout, falls back to cache
- Max 50 entries, 5 minutes expiration
- Ensures fresh data when online, graceful degradation when offline

#### Fonts (CacheFirst)
- Font formats: `.woff`, `.woff2`, `.ttf`, `.eot`
- Cache name: `font-cache`
- Max 30 entries, 1 year expiration
- Instant font loading after first visit

#### CSS/JS (StaleWhileRevalidate)
- Asset types: `.css`, `.js`
- Cache name: `asset-cache`
- Max 60 entries, 7 days expiration
- Instant load from cache while updating in background

## Configuration

### vite.config.ts
```typescript
VitePWA({
  registerType: 'prompt', // User control over updates
  manifest: {
    name: 'CBP - BOM Management Platform',
    short_name: 'CBP',
    theme_color: '#0a0a1a',
    background_color: '#ffffff',
    display: 'standalone',
    start_url: '/',
  },
  workbox: {
    // Caching strategies configured
  },
  devOptions: {
    enabled: true, // Service worker in dev mode
  },
})
```

### manifest.json
- App name and branding
- Icon specifications (192x192, 512x512)
- Display mode: standalone
- Shortcuts: Dashboard, Upload BOM
- Categories: business, productivity

## Usage

### Offline Indicator

The `OfflineIndicator` component is automatically included in `App.tsx`:

```tsx
<OfflineIndicator position="top" showOnlineMessage />
```

**Props**:
- `position`: `'top'` | `'bottom'` - Banner position
- `showOnlineMessage`: `boolean` - Show brief "back online" message
- `className`: `string` - Additional CSS classes

### PWA Update Prompt

The `PWAUpdatePrompt` component is automatically included in `App.tsx`:

```tsx
<PWAUpdatePrompt position="bottom" showOfflineReady />
```

**Props**:
- `position`: `'top'` | `'bottom'` - Prompt position
- `showOfflineReady`: `boolean` - Show "offline ready" confirmation
- `className`: `string` - Additional CSS classes

### Online Status Hook

Use the `useOnlineStatus` hook for conditional logic:

```tsx
import { useOnlineStatus } from '@/components/ui/offline-indicator';

function MyComponent() {
  const isOnline = useOnlineStatus();

  if (!isOnline) {
    return <div>You are offline. Some features may be limited.</div>;
  }

  return <div>Normal online content</div>;
}
```

### Service Worker API

```typescript
import {
  registerServiceWorker,
  unregisterServiceWorker,
  isServiceWorkerActive,
  getServiceWorkerRegistration,
} from '@/lib/service-worker-registration';

// Manual registration (if not using hook)
await registerServiceWorker();

// Check if service worker is active
const isActive = isServiceWorkerActive();

// Get registration object
const registration = await getServiceWorkerRegistration();

// Unregister (for debugging)
await unregisterServiceWorker();
```

## Installation

### Required Package

**IMPORTANT**: `vite-plugin-pwa` is **NOT** currently installed and needs to be added:

```bash
cd e:\Work\Ananta-Platform-Saas\arc-saas\apps\customer-portal
bun add -D vite-plugin-pwa
```

Or with npm:
```bash
npm install -D vite-plugin-pwa
```

### PWA Icon Assets

Place the following icon files in the `public/` directory:

1. `pwa-192x192.png` - 192x192 PNG icon
2. `pwa-512x512.png` - 512x512 PNG icon
3. `favicon.ico` - Favicon
4. `apple-touch-icon.png` - Apple touch icon (180x180)
5. `masked-icon.svg` - Safari pinned tab icon

**Icon Generation Tool**: Use [PWA Asset Generator](https://www.pwabuilder.com/imageGenerator) or similar tools.

## Testing

### Development Testing

1. Start dev server:
   ```bash
   bun run dev
   ```

2. Open DevTools (F12):
   - Application tab > Service Workers
   - Application tab > Cache Storage
   - Network tab (toggle "Offline" to test)

3. Test offline mode:
   - Check "Offline" in Network tab
   - Verify offline indicator appears
   - Navigate to cached pages
   - Try API calls (should use cache)

### Production Build Testing

1. Build the app:
   ```bash
   bun run build
   ```

2. Preview production build:
   ```bash
   bun run preview
   ```

3. Test PWA features:
   - Install app (Chrome: address bar "+" icon)
   - Test offline functionality
   - Verify update prompt appears when new build deployed

### Lighthouse Audit

Run Lighthouse PWA audit in Chrome DevTools:

```
Targets:
- PWA score: 90+
- Installable: Yes
- Offline support: Yes
- Service worker: Registered
```

## Troubleshooting

### Service Worker Not Registering

1. Check browser console for errors
2. Verify HTTPS (or localhost for dev)
3. Check `vite.config.ts` has `VitePWA` plugin
4. Ensure `vite-plugin-pwa` is installed

### Cache Not Working

1. Clear browser cache and hard reload
2. Check Service Worker status in DevTools
3. Verify network patterns in `vite.config.ts`
4. Check cache storage in DevTools

### Update Not Showing

1. Build app with changes
2. Wait for service worker update check (1 hour interval)
3. Or manually trigger: `registration.update()`
4. Verify `registerType: 'prompt'` in config

### Icons Not Showing

1. Verify icon files exist in `public/` directory
2. Check manifest.json paths
3. Clear browser cache
4. Reinstall PWA if already installed

## Production Deployment

### CSP Header Updates

Update Content Security Policy in production nginx/reverse proxy:

```nginx
# Add 'worker-src' directive for service worker
add_header Content-Security-Policy "
  default-src 'self';
  worker-src 'self';
  script-src 'self';
  ...
";
```

### Environment-Specific API URLs

Update `vite.config.ts` workbox patterns for production:

```typescript
runtimeCaching: [
  {
    urlPattern: /^https:\/\/api\.yourdomain\.com\/.*$/i,
    handler: 'NetworkFirst',
    // ...
  },
],
```

### HTTPS Required

PWA features require HTTPS in production. Ensure:
- Valid SSL certificate installed
- HTTP redirects to HTTPS
- Service worker served over HTTPS

## Performance Impact

### Bundle Size
- `vite-plugin-pwa`: ~50KB (gzipped)
- Workbox runtime: ~20KB (gzipped)
- Total overhead: ~70KB (minimal impact)

### Benefits
- Offline functionality: Access app without network
- Faster load times: Cache-first for static assets
- Reduced API calls: Network-first with cache fallback
- Better UX: Install to home screen, standalone mode

## Future Enhancements

1. **Background Sync**: Queue failed API requests, retry when online
2. **Push Notifications**: Alert users about BOM enrichment completion
3. **Periodic Background Sync**: Auto-refresh data in background
4. **Advanced Caching**: Pre-cache critical user data on login
5. **Offline Analytics**: Queue analytics events, send when online

## Resources

- [vite-plugin-pwa Documentation](https://vite-pwa-org.netlify.app/)
- [Workbox Documentation](https://developers.google.com/web/tools/workbox)
- [PWA Best Practices](https://web.dev/progressive-web-apps/)
- [Web App Manifest](https://developer.mozilla.org/en-US/docs/Web/Manifest)

## Files Modified/Created

### Created
- `src/lib/service-worker-registration.ts` - Service worker registration utilities
- `src/components/ui/offline-indicator.tsx` - Offline status indicator component
- `src/components/ui/pwa-update-prompt.tsx` - PWA update notification component
- `public/manifest.json` - PWA manifest configuration
- `PWA-IMPLEMENTATION.md` - This documentation

### Modified
- `vite.config.ts` - Added VitePWA plugin configuration
- `src/App.tsx` - Integrated offline indicator and update prompt

### Required (Not Included)
- Icon assets in `public/` directory (must be generated)
- `vite-plugin-pwa` package (must be installed)
