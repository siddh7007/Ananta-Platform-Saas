# App Plane Theme Centralization Analysis

**Date**: 2025-12-19
**Scope**: All app-plane services theme systems

---

## Executive Summary

**Finding**: **NO centralized theme mechanism exists** across app-plane services.

Each service maintains its **own independent theme system** with varying levels of sophistication:
- **Customer Portal**: Most comprehensive theme with semantic tokens and MUI type augmentation
- **CNS Dashboard**: Domain-specific semantic tokens (quality, lifecycle, enrichment, supplier)
- **Backstage Portal**: Two distinct theme variants (cyberpunk dark, linear light)
- **Dashboard (React Admin)**: Inline theme creation, no separate theme file

---

## Current Theme Architecture

### 1. Customer Portal (CBP) - Port 27100

**Location**: `app-plane/services/customer-portal/src/theme/`

**File**: `index.ts` (608 lines)

**Characteristics**:
- ✅ Most advanced implementation
- ✅ Comprehensive semantic color tokens (9 palettes)
- ✅ MUI TypeScript type augmentation with `customTokens`
- ✅ Helper functions (getRiskColor, getQualityColor, etc.)
- ✅ Typography, spacing, shadow, border radius scales
- ✅ Theme context provider support ([ThemeModeContext.tsx](customer-portal/src/contexts/ThemeModeContext.tsx))
- ❌ Single theme variant (light mode only)

**Semantic Palettes**:
```typescript
riskColors          // low, medium, high, critical
riskFactorColors    // lifecycle, supply_chain, compliance, obsolescence, single_source
gradeColors         // A, B, C, D, F
alertTypeColors     // LIFECYCLE, RISK, PRICE, AVAILABILITY, COMPLIANCE, PCN, SUPPLY_CHAIN
alertSeverityColors // info, warning, critical
projectTypeColors   // development, production, maintenance, archived, other
projectStatusColors // active, on_hold, archived, completed, in_progress
workflowStatusColors // pending, processing, completed, failed, cancelled, mapping_pending
qualityColors       // excellent, good, fair, poor
```

**MUI Integration**:
```typescript
// Type-safe access to custom tokens
declare module '@mui/material/styles' {
  interface Theme {
    customTokens: {
      risk: typeof riskColors;
      grade: typeof gradeColors;
      // ... all semantic palettes
    };
  }
}

export const themeWithTokens = createTheme({
  ...themeOptions,
  customTokens: { risk, grade, alertType, ... }
});
```

**Usage Example**:
```typescript
import { theme } from '@/theme';
// Access via theme.customTokens.risk.high
// Or use helpers: getRiskColor(75) => '#f44336'
```

---

### 2. CNS Dashboard - Port 27250

**Location**: `app-plane/services/cns-service/dashboard/src/theme/`

**File**: `index.ts` (391 lines)

**Characteristics**:
- ✅ Domain-specific semantic tokens (quality routing, supplier branding, enrichment status)
- ✅ Helper functions for business logic (getQualityColor, getSupplierColor, getLifecycleColor)
- ✅ Typography and spacing scales
- ❌ No type augmentation (colors exported as standalone objects)
- ❌ No dark/light mode variants
- ❌ No theme context provider

**Semantic Palettes**:
```typescript
qualityColors          // production, staging, rejected, failed (quality routing)
supplierColors         // mouser, digikey, element14, octopart, newark, arrow, avnet
enrichmentStatusColors // pending, queued, processing, completed, failed, partial
lifecycleColors        // active, nrnd, obsolete, eol, unknown
jobStatusColors        // created, uploading, validating, enriching, completed, failed, cancelled
completenessColors     // excellent, good, fair, poor, minimal (data completeness)
workflowStatusColors   // pending, processing, completed, failed, cancelled, mapping_pending
riskColors             // low, medium, high, critical
gradeColors            // A, B, C, D, F
```

**MUI Integration**:
```typescript
// Simple theme creation, no type augmentation
export const theme = createTheme(themeOptions);
export default theme;

// Helpers used directly in components
import { getQualityColor } from '@/theme';
const color = getQualityColor(95); // '#22c55e'
```

**Business Logic Helpers**:
```typescript
getQualityColor(score: number)       // Score-based quality routing colors
getQualityStatus(score: number)      // Returns 'production' | 'staging' | 'rejected' | 'failed'
getCompletenessColor(percentage)     // Data completeness color
getSupplierColor(supplier: string)   // Supplier branding color with fuzzy matching
getLifecycleColor(status: string)    // Lifecycle status color with aliases
withAlpha(color: string, alpha)      // Hex to rgba conversion
```

---

### 3. Backstage Portal - Port 27150

**Location**: `app-plane/services/backstage-portal/src/`

**File**: `theme.ts` (404 lines)

**Characteristics**:
- ✅ **Two distinct theme variants** (cyberpunk dark, linear light)
- ✅ Complete MUI component overrides
- ✅ Glassmorphism effects (cyberpunk)
- ✅ Micro-borders design (linear)
- ❌ No semantic color tokens
- ❌ No helper functions
- ❌ No theme context (must manually swap themes)

**Theme Variants**:

| Theme | Style | Colors | Typography |
|-------|-------|--------|------------|
| `cyberpunkTheme` | Dark mode, glassmorphism, neon accents | Cyan (#06b6d4), Magenta (#d946ef), Deep blue/black (#0f172a) | JetBrains Mono (headers, data), Inter (body) |
| `linearTheme` | Light mode, minimalist, micro-borders | Black (#000000), White (#ffffff), Gray (#525252) | Inter |

**Cyberpunk Theme Features**:
```typescript
- Translucent cards: backdrop-filter blur(12px)
- Neon borders: cyan glow on hover
- Radial background gradient
- Sharp edges (borderRadius: 0)
- Monospace fonts for data-heavy elements
```

**Linear Theme Features**:
```typescript
- High contrast black/white
- 1px borders instead of shadows
- Very subtle rounding (borderRadius: 2)
- Clean sans-serif typography
- Flat design (boxShadow: 'none')
```

**Usage**:
```typescript
import { cyberpunkTheme, linearTheme } from './theme';

// Manually select theme
<ThemeProvider theme={cyberpunkTheme}>
  <App />
</ThemeProvider>
```

---

### 4. Dashboard (React Admin) - Port 27400

**Location**: `app-plane/services/dashboard/src/admin/`

**File**: `App.tsx` (inline theme)

**Characteristics**:
- ❌ No separate theme file
- ❌ Inline theme creation in App.tsx
- ❌ No semantic tokens
- ❌ No helper functions
- ✅ Simple MUI theme for React Admin

**Implementation**:
```typescript
// In App.tsx
import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    primary: { main: '#1976d2' },
    secondary: { main: '#dc004e' },
  },
});

<Admin theme={theme} ...>
```

---

## Comparison Matrix

| Feature | Customer Portal | CNS Dashboard | Backstage Portal | Dashboard (Admin) |
|---------|----------------|---------------|------------------|-------------------|
| **Semantic Tokens** | ✅ 9 palettes | ✅ 9 palettes | ❌ None | ❌ None |
| **Helper Functions** | ✅ 5 functions | ✅ 6 functions | ❌ None | ❌ None |
| **Type Augmentation** | ✅ Full TS types | ❌ None | ❌ None | ❌ None |
| **Theme Variants** | ❌ Single | ❌ Single | ✅ 2 themes | ❌ Single |
| **Dark/Light Mode** | ❌ Context exists, not used | ❌ No | ✅ Yes (2 themes) | ❌ No |
| **Typography Scale** | ✅ Yes | ✅ Yes | ✅ Yes | ❌ Inline |
| **Spacing Scale** | ✅ Yes | ✅ Yes | ❌ No | ❌ No |
| **Shadow Scale** | ✅ Yes | ❌ No | ❌ No | ❌ No |
| **Border Radius Scale** | ✅ Yes | ❌ No | ❌ No | ❌ No |
| **Component Overrides** | ✅ Moderate | ✅ Moderate | ✅ Extensive | ❌ Minimal |
| **Lines of Code** | 608 | 391 | 404 | ~20 (inline) |

---

## Shared Patterns (Overlap)

Despite no centralization, there are **common semantic palettes** across services:

### Common Risk Colors
```typescript
// Customer Portal & CNS Dashboard (IDENTICAL)
riskColors = {
  low: '#4caf50',      // Green
  medium: '#ff9800',   // Orange
  high: '#f44336',     // Red
  critical: '#9c27b0', // Purple
}
```

### Common Grade Colors
```typescript
// Customer Portal & CNS Dashboard (IDENTICAL)
gradeColors = {
  A: '#4caf50',   // Green
  B: '#8bc34a',   // Light Green
  C: '#ff9800',   // Orange
  D: '#f44336',   // Red
  F: '#9c27b0',   // Purple
}
```

### Common Workflow Status
```typescript
// Customer Portal & CNS Dashboard (IDENTICAL)
workflowStatusColors = {
  pending: '#9E9E9E',      // Gray
  processing: '#2196F3',   // Blue
  completed: '#4CAF50',    // Green
  failed: '#f44336',       // Red
  cancelled: '#757575',    // Dark Gray
  mapping_pending: '#FFC107', // Yellow (CNS only)
}
```

### Common Quality Colors (Different Naming)
```typescript
// CNS Dashboard: qualityColors (quality routing)
qualityColors = {
  production: '#22c55e',  // ≥95%
  staging: '#facc15',     // 70-94%
  rejected: '#ef4444',    // <70%
  failed: '#6b7280',      // enrichment failed
}

// Customer Portal: qualityColors (data quality)
qualityColors = {
  excellent: '#4caf50',  // 90-100
  good: '#8bc34a',       // 70-89
  fair: '#ff9800',       // 50-69
  poor: '#f44336',       // 0-49
}
```

---

## Gaps & Inconsistencies

### 1. Duplicate Color Definitions
- `riskColors`, `gradeColors`, `workflowStatusColors` defined identically in 2 services
- Maintenance burden: must update in 2 places when color standards change

### 2. Naming Conflicts
- `qualityColors` has different meanings:
  - CNS: Quality routing (production/staging/rejected)
  - CBP: Data quality score (excellent/good/fair/poor)

### 3. Missing Theme Context
- Only Customer Portal has `ThemeModeContext.tsx` (unused)
- CNS Dashboard has no dark mode support
- Backstage Portal has 2 themes but no toggle mechanism

### 4. TypeScript Coverage
- Only Customer Portal uses MUI type augmentation for theme tokens
- Other services rely on direct imports (no type safety for theme.customTokens)

### 5. No Shared Package
- Each service duplicates typography, spacing, shadow scales
- No `@app-plane/theme` package for shared tokens

---

## Recommendations

### Option 1: Create Shared Theme Package (Recommended)

**Structure**:
```
app-plane/
├── packages/
│   └── shared-theme/                    # NEW
│       ├── src/
│       │   ├── tokens/
│       │   │   ├── colors.ts           # Shared semantic colors
│       │   │   ├── typography.ts       # Shared typography scales
│       │   │   ├── spacing.ts          # Shared spacing scales
│       │   │   └── index.ts
│       │   ├── helpers/
│       │   │   ├── color-helpers.ts    # getRiskColor, getGradeColor, etc.
│       │   │   └── index.ts
│       │   ├── themes/
│       │   │   ├── light.ts            # Light theme variant
│       │   │   ├── dark.ts             # Dark theme variant
│       │   │   ├── cyberpunk.ts        # Cyberpunk variant (from backstage)
│       │   │   ├── linear.ts           # Linear variant (from backstage)
│       │   │   └── index.ts
│       │   └── index.ts
│       ├── package.json
│       └── tsconfig.json
└── services/
    ├── customer-portal/
    │   └── src/theme/
    │       ├── index.ts                # Import from shared + CBP-specific tokens
    │       └── custom-tokens.ts        # alertTypeColors, projectTypeColors (CBP-only)
    ├── cns-service/dashboard/
    │   └── src/theme/
    │       ├── index.ts                # Import from shared + CNS-specific tokens
    │       └── custom-tokens.ts        # supplierColors, enrichmentStatusColors (CNS-only)
    └── backstage-portal/
        └── src/theme.ts                # Import shared themes + customizations
```

**Shared Tokens** (`packages/shared-theme/src/tokens/colors.ts`):
```typescript
// Tokens that are IDENTICAL across services
export const sharedRiskColors = { low, medium, high, critical };
export const sharedGradeColors = { A, B, C, D, F };
export const sharedWorkflowStatusColors = { pending, processing, completed, failed, cancelled };
export const sharedLifecycleColors = { active, nrnd, obsolete, eol, unknown };
```

**Service-Specific Tokens** (remain in each service):
```typescript
// customer-portal/src/theme/custom-tokens.ts
export const alertTypeColors = { LIFECYCLE, RISK, PRICE, ... };  // CBP-only
export const projectTypeColors = { development, production, ... }; // CBP-only

// cns-dashboard/src/theme/custom-tokens.ts
export const supplierColors = { mouser, digikey, ... };          // CNS-only
export const enrichmentStatusColors = { pending, queued, ... };  // CNS-only
export const qualityRoutingColors = { production, staging, ... }; // CNS-only
```

**Benefits**:
- ✅ Single source of truth for shared tokens
- ✅ Easy to maintain (update once, apply everywhere)
- ✅ Type safety with TypeScript
- ✅ Services can extend with domain-specific tokens
- ✅ Theme variants available to all services

**Effort**: ~2-3 days
- Create shared package structure
- Extract common tokens
- Update service imports
- Test all services

---

### Option 2: Standardize Within Services (Minimal)

Keep services independent but enforce **common patterns**:

**Standard Structure** (each service):
```
services/<service>/src/theme/
├── index.ts                # Main theme export
├── tokens/
│   ├── colors.ts          # Semantic color palettes
│   ├── typography.ts      # Typography scale
│   ├── spacing.ts         # Spacing scale
│   └── index.ts
├── helpers/
│   ├── color-helpers.ts   # getRiskColor, getGradeColor, etc.
│   └── index.ts
└── variants/              # Theme variants (light, dark, etc.)
    ├── light.ts
    ├── dark.ts
    └── index.ts
```

**Benefits**:
- ✅ Consistent structure across services
- ✅ No new dependencies
- ✅ Services remain independent

**Drawbacks**:
- ❌ Still duplicates shared tokens
- ❌ Must manually sync color changes

**Effort**: ~1 day per service

---

### Option 3: Status Quo (No Changes)

**Keep current architecture**:
- Each service maintains own theme
- No shared package
- Manual synchronization when needed

**Benefits**:
- ✅ No migration effort
- ✅ Services fully independent

**Drawbacks**:
- ❌ Duplicate definitions (risk, grade, workflow status)
- ❌ Inconsistent naming (`qualityColors` conflict)
- ❌ Hard to maintain brand consistency
- ❌ No dark mode standardization

---

## Recommendation: Option 1 (Shared Theme Package)

**Why**:
1. **Duplicate code exists**: `riskColors`, `gradeColors`, `workflowStatusColors` already identical
2. **Brand consistency**: Easier to maintain unified design system
3. **Future-proof**: New services can easily adopt standard theme
4. **TypeScript benefits**: Shared types for theme tokens
5. **Dark mode**: Can provide standard light/dark variants for all services

**Migration Path**:
1. Week 1: Create `@app-plane/shared-theme` package with common tokens
2. Week 2: Migrate Customer Portal to use shared package + custom tokens
3. Week 3: Migrate CNS Dashboard to use shared package + custom tokens
4. Week 4: Migrate Backstage Portal, add theme toggle mechanism
5. Week 5: Add dark mode variants to Customer Portal and CNS Dashboard

---

## Next Steps

**User Decision Required**:
1. **Proceed with shared package** (Option 1) - 2-3 weeks effort
2. **Standardize structure only** (Option 2) - 1 week effort
3. **Keep status quo** (Option 3) - no effort, accept duplication

**If proceeding with Option 1**, follow this order:
1. Create `packages/shared-theme` with common tokens
2. Extract shared helpers (getRiskColor, getGradeColor, etc.)
3. Create theme variants (light, dark, cyberpunk, linear)
4. Migrate Customer Portal first (most comprehensive)
5. Migrate CNS Dashboard second
6. Migrate Backstage Portal last (already has variants)
7. Update Dashboard (React Admin) to use shared theme

---

## Files Referenced

| Service | Theme File(s) | Lines | Status |
|---------|--------------|-------|--------|
| Customer Portal | `customer-portal/src/theme/index.ts` | 608 | ✅ Most advanced |
| Customer Portal | `customer-portal/src/contexts/ThemeModeContext.tsx` | - | ✅ Context exists |
| CNS Dashboard | `cns-service/dashboard/src/theme/index.ts` | 391 | ✅ Domain-specific |
| Backstage Portal | `backstage-portal/src/theme.ts` | 404 | ✅ 2 variants |
| Dashboard | `dashboard/src/admin/App.tsx` | ~20 | ⚠️ Inline only |

---

**Summary**: No centralized theme exists. Each service has independent themes with overlapping tokens. Recommend creating `@app-plane/shared-theme` package to consolidate common tokens while allowing service-specific extensions.
