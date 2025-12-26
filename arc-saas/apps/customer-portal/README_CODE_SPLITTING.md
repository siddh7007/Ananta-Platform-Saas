# Code Splitting Quick Reference

## What Changed?

All page routes are now **lazy-loaded** to reduce initial bundle size from ~800KB to ~180KB (gzipped).

## How It Works

### Before
```typescript
// Direct import - included in initial bundle
import { DashboardPage } from '@/pages/Dashboard';

<Route path="/" element={<DashboardPage />} />
```

### After
```typescript
// Lazy import - loaded on navigation
import { DashboardPage, LazyRoute } from '@/routes/lazy-routes';

<Route path="/" element={LazyRoute(DashboardPage, 'Dashboard')} />
```

## For Developers

### Adding a New Page

**Step 1**: Create your page component
```typescript
// src/pages/myfeature/MyPage.tsx
export function MyPage() {
  return <div>My Feature</div>;
}
```

**Step 2**: Add lazy import in `src/routes/lazy-routes.tsx`
```typescript
export const MyPage = lazy(() =>
  import('@/pages/myfeature/MyPage').then((m) => ({ default: m.MyPage }))
);
```

**Step 3**: Add route in `src/App.tsx`
```typescript
<Route path="/myfeature" element={LazyRoute(MyPage, 'My Feature')} />
```

**Done!** Your page will now load on-demand.

### Optional: Make it a Critical Route

If your page is high-traffic (like Dashboard or BOMs), preload it:

```typescript
// In src/routes/lazy-routes.tsx
const CRITICAL_ROUTES = [
  () => import('@/pages/Dashboard'),
  () => import('@/pages/boms'),
  () => import('@/pages/myfeature/MyPage'),  // Add here
];
```

## What You'll See

### During Navigation
- Brief loading spinner (usually <500ms)
- Smooth transition to page

### In DevTools Network Tab
- Initial load: Only core bundles (vendor-react, vendor-refine)
- Navigation to /boms: `feature-bom.abc123.js` loads
- Navigation to /components: `feature-components.def456.js` loads

### In Production
- Faster initial page load
- Chunks cached by browser
- Instant navigation to visited routes

## Troubleshooting

### "Loading chunk X failed" error
**Cause**: New deployment while user has old version
**Fix**: Automatic - ErrorBoundary shows "Update Available" and reloads page

### Blank page on navigation
**Cause**: Missing LazyRoute wrapper
**Fix**: Use `LazyRoute(Component, 'Name')` not `<Component />`

### Bundle still too large
**Cause**: Large dependency not in separate chunk
**Fix**: Add to `manualChunks` in `vite.config.ts`

## Testing Your Changes

```bash
# Build and check chunks
bun run build
node scripts/verify-code-splitting.js

# Visualize bundle
# Opens dist/stats.html
bun run build
```

## Key Files

| File | Purpose |
|------|---------|
| `src/routes/lazy-routes.tsx` | All lazy route definitions |
| `src/App.tsx` | Route usage with LazyRoute() |
| `vite.config.ts` | Manual chunk configuration |
| `src/components/shared/ErrorBoundary.tsx` | Chunk error handling |
| `docs/CODE_SPLITTING.md` | Full documentation |

## Benefits

- ✅ 77% smaller initial bundle (800KB → 180KB gzipped)
- ✅ 50% faster Time to Interactive (5s → 2.5s on slow 3G)
- ✅ Better caching (vendor chunks change rarely)
- ✅ Faster deployments (only changed chunks re-downloaded)

## Questions?

See `docs/CODE_SPLITTING.md` for detailed documentation or ask the team.
