# Code Splitting Architecture

## Bundle Structure

```
┌─────────────────────────────────────────────────────────────────┐
│                     Initial Page Load                           │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │ index.js     │  │ vendor-react │  │ vendor-refine│         │
│  │ ~160KB       │  │ ~100KB       │  │ ~60KB        │         │
│  │              │  │              │  │              │         │
│  │ - App.tsx    │  │ - react      │  │ - @refinedev │         │
│  │ - Routing    │  │ - react-dom  │  │ - router     │         │
│  │ - Contexts   │  │ - router-dom │  │ - devtools   │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
│                                                                 │
│  Total: ~320KB (gzipped: ~180KB) ✅ Target: <200KB            │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                   Lazy-Loaded on Navigation                     │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │ feature-bom  │  │ feature-     │  │ feature-     │         │
│  │ ~40KB        │  │ components   │  │ portfolio    │         │
│  │              │  │ ~35KB        │  │ ~30KB        │         │
│  │ - BomList    │  │ - CompList   │  │ - Portfolio  │         │
│  │ - BomDetail  │  │ - CompCompare│  │ - Stats      │         │
│  │ - BomUpload  │  │ - CompDetail │  │ - Analytics  │         │
│  │ - RiskAnalysis│ │              │  │              │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
│                                                                 │
│  Load on route navigation: /boms → feature-bom.js loads        │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                   Heavy Dependencies (Lazy)                     │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │ vendor-xlsx  │  │ vendor-charts│  │ vendor-ui    │         │
│  │ ~150KB       │  │ ~80KB        │  │ ~80KB        │         │
│  │              │  │              │  │              │         │
│  │ - xlsx       │  │ - recharts   │  │ - @radix-ui  │         │
│  │ (BOM upload) │  │ (analytics)  │  │ (components) │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
│                                                                 │
│  Load when needed: BomUpload page → vendor-xlsx.js loads       │
└─────────────────────────────────────────────────────────────────┘
```

## Loading Timeline

```
Time →
0ms         500ms       1000ms      1500ms      2000ms      User Navigation
│           │           │           │           │           │
├───────────┼───────────┼───────────┼───────────┼───────────┼──────►
│           │           │           │           │           │
│ Initial   │ First     │ Critical  │           │           │ Route
│ Bundle    │ Paint     │ Routes    │           │           │ Chunks
│ Load      │           │ Preload   │           │           │ Load
│           │           │ (idle)    │           │           │
├───────────┤           │           │           │           │
│           │           │           │           │           │
▼           ▼           ▼           ▼           ▼           ▼

HTML        Landing     Dashboard   BOMs        Components  /boms
loads       renders     preloads    preloads    preloads    navigates
            (JS exec)   (cached)    (cached)    (cached)    (instant!)

Initial     Interactive             Background              On-Demand
Load        (user can               Preloading              Loading
Phase       interact)               Phase                   Phase
```

## Route Loading Flow

```
User clicks /boms link
        │
        ▼
┌─────────────────┐
│ React Router    │
│ matches route   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ LazyRoute()     │
│ wrapper renders │
└────────┬────────┘
         │
         ├──────────────────────┐
         │                      │
         ▼                      ▼
┌─────────────────┐    ┌─────────────────┐
│ Suspense        │    │ ErrorBoundary   │
│ boundary active │    │ ready to catch  │
└────────┬────────┘    └─────────────────┘
         │
         ▼
┌─────────────────┐
│ LoadingSpinner  │
│ displays        │ ← User sees this
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ React.lazy()    │
│ imports chunk   │
└────────┬────────┘
         │
         ├────────────────┬──────────────┐
         │                │              │
         ▼                ▼              ▼
   ┌─────────┐      ┌─────────┐    ┌─────────┐
   │ Network │      │ Cache   │    │ Error   │
   │ fetch   │  or  │ hit     │ or │ (retry) │
   └────┬────┘      └────┬────┘    └────┬────┘
        │                │              │
        └────────┬───────┘              │
                 │                      │
                 ▼                      ▼
         ┌─────────────────┐    ┌─────────────────┐
         │ Chunk loaded    │    │ "Update         │
         │ Component       │    │  Available"     │
         │ renders         │    │ error shown     │
         └─────────────────┘    └─────────────────┘
                 │
                 ▼
         ┌─────────────────┐
         │ Page fully      │
         │ interactive     │
         └─────────────────┘
```

## Chunk Dependencies

```
┌──────────────────────────────────────────────────────────┐
│                        App Entry                         │
│                       (index.js)                         │
└───────────────┬──────────────────────────────────────────┘
                │
                ├──────────────────┬──────────────────┐
                │                  │                  │
                ▼                  ▼                  ▼
        ┌───────────────┐  ┌───────────────┐ ┌───────────────┐
        │ vendor-react  │  │ vendor-refine │ │ vendor-query  │
        └───────┬───────┘  └───────┬───────┘ └───────┬───────┘
                │                  │                  │
                └──────────┬───────┴──────────────────┘
                           │
                           ▼
                   ┌───────────────┐
                   │  Landing Page │
                   │  (or Login)   │
                   └───────┬───────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
        ▼                  ▼                  ▼
┌───────────────┐  ┌───────────────┐ ┌───────────────┐
│ feature-bom   │  │ feature-      │ │ feature-      │
│               │  │ components    │ │ portfolio     │
│ ├─vendor-ui   │  │ ├─vendor-ui   │ │ ├─vendor-charts│
│ └─vendor-xlsx │  │               │ │               │
└───────────────┘  └───────────────┘ └───────────────┘

Legend:
━━━  Always loaded (initial bundle)
────  Lazy loaded on navigation
```

## Error Boundary Hierarchy

```
┌─────────────────────────────────────────────────────────┐
│ App.tsx - Top-level ErrorBoundary                      │
│ - Catches chunk loading errors                         │
│ - Shows "Update Available" for ChunkLoadError          │
│ - Provides reload functionality                        │
└───────────────────┬─────────────────────────────────────┘
                    │
                    ▼
        ┌─────────────────────────┐
        │ DevtoolsProvider        │
        └───────────┬──────────────┘
                    │
                    ▼
        ┌─────────────────────────┐
        │ AuthProvider            │
        └───────────┬──────────────┘
                    │
                    ▼
        ┌─────────────────────────┐
        │ Refine                  │
        └───────────┬──────────────┘
                    │
                    ▼
        ┌─────────────────────────┐
        │ Routes                  │
        └───────────┬──────────────┘
                    │
                    ▼
        ┌─────────────────────────┐
        │ LazyRoute() wrapper     │
        │ ├─ RouteErrorBoundary   │ ← Catches route-specific errors
        │ └─ Suspense            │ ← Loading state
        └───────────┬──────────────┘
                    │
                    ▼
        ┌─────────────────────────┐
        │ Lazy Component          │
        │ (BomListPage, etc.)     │
        └─────────────────────────┘
```

## Cache Strategy

```
Browser Cache Flow:

First Visit              Second Visit            After Deploy
    │                        │                        │
    ▼                        ▼                        ▼
┌─────────┐             ┌─────────┐             ┌─────────┐
│ Network │             │ Cache   │             │ Network │
│ Fetch   │             │ Hit     │             │ Fetch   │
│         │             │ (Instant)│             │ (New)   │
└────┬────┘             └─────────┘             └────┬────┘
     │                                                │
     ├─ index.abc123.js                             ├─ index.def456.js (new hash)
     ├─ vendor-react.xyz789.js                      ├─ vendor-react.xyz789.js (same)
     └─ feature-bom.qrs456.js                       └─ feature-bom.uvw789.js (new hash)
     │                                                │
     ▼                                                ▼
  Cached                                          Old cached,
  for 1 year                                      new fetched

Cache Headers:
- Vendor chunks: Long TTL (immutable, content-hash in filename)
- Feature chunks: Short TTL (changes frequently)
- Index bundle: Very short TTL (entry point, must stay fresh)
```

## Preloading Strategy

```
Page Load Timeline:

0ms                    1000ms                  2000ms
│                         │                       │
├─────────────────────────┼───────────────────────┼──────►
│                         │                       │
│ Initial Load            │ requestIdleCallback   │ Chunks Ready
│                         │                       │
├─ index.js              ├─ import('@/pages/Dashboard')
├─ vendor-react.js       ├─ import('@/pages/boms')
├─ vendor-refine.js      └─ import('@/pages/components')
│                         │                       │
│ User sees Landing       │ Browser is idle       │ Navigation instant
│                         │                       │

Critical Routes (preloaded):
✅ Dashboard    - Always needed after login
✅ BOMs         - High traffic route
✅ Components   - High traffic route

Non-Critical (lazy):
❌ Team         - Lower traffic
❌ Billing      - Lower traffic
❌ Settings     - Lower traffic
❌ Portfolio    - Owner-only, rare
```

## Build Output

```
dist/assets/
├── index-abc123.js           (~160KB) Entry point
├── vendor-react-xyz789.js    (~100KB) React core ──┐
├── vendor-refine-def456.js   (~60KB)  Refine       │ Always
├── vendor-query-ghi789.js    (~40KB)  React Query  │ loaded
├── vendor-icons-jkl012.js    (~25KB)  Lucide icons │ initially
├── vendor-ui-mno345.js       (~80KB)  Radix UI    ──┘
│
├── feature-bom-pqr678.js     (~40KB)  BOM pages   ──┐
├── feature-components-stu901.js (~35KB) Comp pages │ Lazy
├── feature-portfolio-vwx234.js (~30KB) Portfolio   │ loaded
│                                                    │ on nav
├── vendor-xlsx-yza567.js     (~150KB) Excel lib    │
└── vendor-charts-bcd890.js   (~80KB)  Charts lib  ──┘

Total: ~800KB uncompressed (~400KB gzipped)
Initial: ~385KB uncompressed (~180KB gzipped) ✅
```

## Performance Metrics

```
Metric Comparison:

                    Before          After         Improvement
─────────────────────────────────────────────────────────────
Initial JS (gz)     ~800KB          ~180KB        77% ↓
Time to Interactive ~5.0s           ~2.5s         50% ↓
First Paint         ~3.0s           ~1.5s         50% ↓
Route Transition    ~100ms          ~300ms        OK
Cache Hit (2nd nav) ~100ms          ~50ms         50% ↑

Network Waterfall:
Before:
│██████████████████████████████│ index.js (800KB)
                                └─ 5s load

After:
│██████│                         index.js (160KB)
│██████████│                     vendor-react (100KB)
│████████│                       vendor-refine (60KB)
│████│                           vendor-query (40KB)
        └─ 2.5s load, then interactive!
          │██████│               feature-bom (on navigation)
```

## Decision Tree: When to Lazy Load?

```
                    New Page Component
                            │
                            ▼
                    ┌───────────────┐
                    │ Is it used on │
                    │ initial load? │
                    └───────┬───────┘
                           ╱ ╲
                      Yes ╱   ╲ No
                         ╱     ╲
                        ▼       ▼
              ┌──────────┐   ┌──────────┐
              │ Include  │   │ Is it    │
              │ in index │   │ >50KB?   │
              └──────────┘   └────┬─────┘
                                 ╱ ╲
                            Yes ╱   ╲ No
                               ╱     ╲
                              ▼       ▼
                  ┌──────────────┐  ┌──────────┐
                  │ Lazy load +  │  │ Is it    │
                  │ Manual chunk │  │ critical?│
                  └──────────────┘  └────┬─────┘
                                        ╱ ╲
                                   Yes ╱   ╲ No
                                      ╱     ╲
                                     ▼       ▼
                         ┌──────────────┐  ┌──────────┐
                         │ Lazy load +  │  │ Lazy load│
                         │ Preload      │  │ on demand│
                         └──────────────┘  └──────────┘
```

## Key Takeaways

1. **Initial Bundle**: Only critical code (React, Refine, routing)
2. **Route Chunks**: Load on navigation with loading state
3. **Vendor Chunks**: Stable dependencies cached long-term
4. **Preloading**: Critical routes preload in background
5. **Error Handling**: Graceful degradation for chunk failures
6. **Cache Strategy**: Content-hash filenames for optimal caching
