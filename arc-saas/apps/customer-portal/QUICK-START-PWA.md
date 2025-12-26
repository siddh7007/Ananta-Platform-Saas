# PWA Quick Start Guide

## Installation (Required First Step)

```bash
cd e:\Work\Ananta-Platform-Saas\arc-saas\apps\customer-portal
bun add -D vite-plugin-pwa
```

## Generate Icons (Before Testing)

1. Go to https://www.pwabuilder.com/imageGenerator
2. Upload your 512x512 logo
3. Download generated icons
4. Place in `public/` directory:
   - `pwa-192x192.png`
   - `pwa-512x512.png`
   - `favicon.ico`
   - `apple-touch-icon.png`

## Test PWA Features

### Development Mode
```bash
bun run dev
# Open http://localhost:27100
# F12 > Application > Service Workers (verify registered)
# Network > Offline checkbox (test offline mode)
```

### Production Build
```bash
bun run build
bun run preview
# Try installing PWA (Chrome: address bar "+" icon)
# Test offline functionality
```

## What's Implemented

✓ Service worker with intelligent caching
✓ Offline indicator (shows banner when disconnected)
✓ Update prompt (notifies when new version available)
✓ PWA manifest (installable app)
✓ Network-first API caching (3s timeout)
✓ Cache-first static assets (images, fonts)

## How It Works

### When Online
- API calls go to network first (3s timeout)
- Static assets load from cache instantly
- Updates check hourly

### When Offline
- Yellow banner appears at top
- Cached pages continue to work
- API calls fall back to cache (if available)
- Upload/write operations gracefully fail

### When Update Available
- Blue notification at bottom
- "Reload Now" button updates app
- "Later" button dismisses (reminder in 1 hour)

## Common Issues

### Service Worker Not Registering
```bash
# Check package installed
bun list | grep vite-plugin-pwa

# Clear cache and rebuild
rm -rf dist node_modules/.vite
bun run build
```

### Icons Not Showing
- Verify files exist in `public/` directory
- Check `public/manifest.json` paths
- Clear browser cache (Ctrl+Shift+Delete)

### Update Not Detected
- Build creates new hash for files
- Wait 1 hour or manually: `registration.update()`
- Hard refresh (Ctrl+Shift+R)

## Usage Examples

### Check Online Status
```tsx
import { useOnlineStatus } from '@/components/ui/offline-indicator';

function MyComponent() {
  const isOnline = useOnlineStatus();
  return <div>Status: {isOnline ? 'Online' : 'Offline'}</div>;
}
```

### Manual Service Worker Control
```tsx
import { isServiceWorkerActive } from '@/lib/service-worker-registration';

if (isServiceWorkerActive()) {
  console.log('Service worker is running');
}
```

## Next Steps

1. Install `vite-plugin-pwa` package
2. Generate and add icon files
3. Test in development mode
4. Build and test production bundle
5. Run Lighthouse PWA audit (target: 90+)
6. Deploy to production with HTTPS

## Documentation

- **Full Guide**: `PWA-IMPLEMENTATION.md`
- **Icon Setup**: `public/ICON-REQUIREMENTS.md`
- **Checklist**: `PWA-CHECKLIST.md`

## Support

For issues or questions, refer to the full implementation guide or:
- vite-plugin-pwa: https://vite-pwa-org.netlify.app/
- Workbox: https://developers.google.com/web/tools/workbox
