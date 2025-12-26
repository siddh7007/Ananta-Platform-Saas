# CNS Dashboard Theme System

Comprehensive guide to the CNS Dashboard theme architecture, semantic color tokens, and usage patterns.

## Table of Contents

- [Overview](#overview)
- [Theme Variants](#theme-variants)
- [Semantic Color Tokens](#semantic-color-tokens)
- [Helper Functions](#helper-functions)
- [Usage Examples](#usage-examples)
- [Adding New Status Colors](#adding-new-status-colors)
- [Migration Guide](#migration-guide)

---

## Overview

The CNS Dashboard uses a centralized theme system built on MUI (Material-UI) with:

1. **4 Theme Variants**: light, dark, mid-light, mid-dark
2. **10 Semantic Color Palettes**: Business logic-driven colors for statuses, suppliers, risks, etc.
3. **Helper Functions**: Utility functions to map scores/statuses to colors
4. **Type Safety**: Full TypeScript type augmentation for customTokens
5. **Theme Toggle**: User-selectable theme switcher in the AppBar

### File Structure

```
src/
├── theme/
│   ├── index.ts          # Main theme exports, createTheme configurations
│   ├── variants.ts       # 4 palette variants (light, dark, mid-light, mid-dark)
│   ├── tokens.ts         # Semantic color palettes (200 lines)
│   └── helpers.ts        # Status → color mapping utilities (240+ lines)
├── contexts/
│   └── ThemeContext.tsx  # Theme state management with localStorage
└── CustomAppBar.tsx      # Theme toggle UI component
```

---

## Theme Variants

Four palette variants for different user preferences and accessibility needs.

### Light Theme (Default)

- **Background**: Grey-50 (#f9fafb)
- **Paper**: White (#ffffff)
- **Text**: Grey-900 (#111827) primary, Grey-500 (#6b7280) secondary
- **Use case**: Standard bright interface

### Dark Theme

- **Background**: Grey-900 (#111827)
- **Paper**: Grey-800 (#1f2937)
- **Text**: Grey-50 (#f9fafb) primary, Grey-400 (#9ca3af) secondary
- **Use case**: Low-light environments, reduced eye strain

### Mid-Light Theme

- **Background**: Grey-100 (#f3f4f6)
- **Paper**: White (#ffffff)
- **Text**: Grey-800 (#1f2937) primary, Grey-600 (#4b5563) secondary
- **Use case**: Softer contrast than light theme

### Mid-Dark Theme

- **Background**: Grey-800 (#1f2937)
- **Paper**: Grey-700 (#374151)
- **Text**: Grey-100 (#f3f4f6) primary, Grey-400 (#9ca3af) secondary
- **Use case**: Softer contrast than dark theme

### Switching Themes

Users can switch themes via the palette icon in the AppBar. Theme selection is persisted in localStorage.

```tsx
import { useThemeContext } from '@/contexts/ThemeContext';

const MyComponent = () => {
  const { themeVariant, setThemeVariant, currentTheme } = useThemeContext();

  // themeVariant: 'light' | 'dark' | 'midLight' | 'midDark'
  // currentTheme: MUI Theme object

  return <div>Current theme: {themeVariant}</div>;
};
```

---

## Semantic Color Tokens

### 1. Quality Routing Colors (CNS-specific)

Quality routing determines whether enriched components auto-approve to production, require manual staging review, or get rejected.

| Status | Score | Color | Use Case |
|--------|-------|-------|----------|
| `production` | ≥95% | `#22c55e` (green) | Auto-approved to production catalog |
| `staging` | 70-94% | `#facc15` (yellow) | Manual quality review required |
| `rejected` | <70% | `#ef4444` (red) | Failed quality threshold |
| `failed` | N/A | `#6b7280` (gray) | Enrichment process failed |

**Usage:**

```tsx
import { qualityColors } from '@/theme';

<Chip
  label="Production"
  sx={{ backgroundColor: qualityColors.production }}
/>
```

**Helper Function:**

```tsx
import { getQualityColor, getQualityStatus } from '@/theme';

const color = getQualityColor(96); // '#22c55e' (production)
const status = getQualityStatus(75); // 'staging'
```

---

### 2. Supplier Branding Colors

Standard brand colors for electronic component suppliers.

| Supplier | Color | Hex |
|----------|-------|-----|
| `mouser` | Mouser Blue | `#0066cc` |
| `digikey` | DigiKey Red | `#cc0000` |
| `element14` | Element14 Orange | `#ff6600` |
| `octopart` | Octopart Teal | `#00b894` |
| `newark` | Newark Dark Blue | `#003366` |
| `arrow` | Arrow Orange | `#f26522` |
| `avnet` | Avnet Red | `#ed1c24` |

**Usage with Fuzzy Matching:**

```tsx
import { getSupplierColor } from '@/theme';

// Handles case-insensitive, hyphenated, and aliased names
const color1 = getSupplierColor('Mouser'); // '#0066cc'
const color2 = getSupplierColor('digi-key'); // '#cc0000'
const color3 = getSupplierColor('element14'); // '#ff6600'
const color4 = getSupplierColor('Unknown Supplier'); // '#6b7280' (default gray)
```

---

### 3. Enrichment Status Colors

Status colors for component enrichment workflow states.

| Status | Color | Meaning |
|--------|-------|---------|
| `pending` | `#9ca3af` (gray) | Waiting in queue |
| `queued` | `#a78bfa` (purple) | Queued for processing |
| `processing` | `#3b82f6` (blue) | Currently enriching |
| `completed` | `#22c55e` (green) | Successfully enriched |
| `failed` | `#ef4444` (red) | Enrichment error |
| `partial` | `#f59e0b` (amber) | Partial success |

**Direct Access:**

```tsx
import { enrichmentStatusColors } from '@/theme';

<Box sx={{ color: enrichmentStatusColors.processing }} />
```

**Helper Function:**

```tsx
import { getEnrichmentStatusColor } from '@/theme';

const color = getEnrichmentStatusColor('completed'); // '#22c55e'
```

---

### 4. Lifecycle Status Colors

Component lifecycle status indicators (NRND, EOL, Active, Obsolete).

| Status | Color | Meaning |
|--------|-------|---------|
| `active` | `#22c55e` (green) | In production |
| `nrnd` | `#f59e0b` (amber) | Not Recommended for New Designs |
| `obsolete` | `#ef4444` (red) | No longer manufactured |
| `eol` | `#dc2626` (dark red) | End of Life |
| `unknown` | `#6b7280` (gray) | Status unavailable |

**Fuzzy Matching with Aliases:**

```tsx
import { getLifecycleColor, getLifecycleStatus } from '@/theme';

// Handles common aliases
const color1 = getLifecycleColor('active'); // '#22c55e'
const color2 = getLifecycleColor('not recommended'); // '#f59e0b'
const color3 = getLifecycleColor('end of life'); // '#dc2626'

const status = getLifecycleStatus('NRND'); // 'nrnd'
```

---

### 5. Job Status Colors

BOM upload job workflow states.

| Status | Color |
|--------|-------|
| `created` | `#9ca3af` (gray) |
| `uploading` | `#a78bfa` (light purple) |
| `validating` | `#8b5cf6` (purple) |
| `enriching` | `#3b82f6` (blue) |
| `completed` | `#22c55e` (green) |
| `failed` | `#ef4444` (red) |
| `cancelled` | `#6b7280` (dark gray) |

**Helper Function:**

```tsx
import { getJobStatusColor } from '@/theme';

const color = getJobStatusColor('enriching'); // '#3b82f6'
```

---

### 6. Data Completeness Colors

Data quality/completeness percentage indicators.

| Level | Percentage | Color | Hex |
|-------|-----------|-------|-----|
| `excellent` | 90-100% | Green | `#22c55e` |
| `good` | 70-89% | Lime | `#84cc16` |
| `fair` | 50-69% | Yellow | `#facc15` |
| `poor` | 30-49% | Orange | `#f97316` |
| `minimal` | 0-29% | Red | `#ef4444` |

**Helper Functions:**

```tsx
import { getCompletenessColor, getCompletenessLevel } from '@/theme';

const color = getCompletenessColor(85); // '#84cc16' (good)
const level = getCompletenessLevel(45); // 'poor'
```

---

### 7. Workflow Status Colors

BOM upload workflow stepper states.

| Status | Color | Hex |
|--------|-------|-----|
| `pending` | Gray | `#9E9E9E` |
| `processing` | Blue | `#2196F3` |
| `completed` | Green | `#4CAF50` |
| `failed` | Red | `#f44336` |
| `cancelled` | Dark Gray | `#757575` |
| `mapping_pending` | Yellow | `#FFC107` |

**Helper Function:**

```tsx
import { getWorkflowStatusColor } from '@/theme';

const color = getWorkflowStatusColor('processing'); // '#2196F3'
```

---

### 8. Risk Colors

Component risk scoring (supply chain, obsolescence, quality).

| Level | Score | Color | Hex |
|-------|-------|-------|-----|
| `low` | 0-24 | Green | `#4caf50` |
| `medium` | 25-49 | Orange | `#ff9800` |
| `high` | 50-74 | Red | `#f44336` |
| `critical` | 75-100 | Purple | `#9c27b0` |

**Helper Functions:**

```tsx
import { getRiskColor, getRiskLevel } from '@/theme';

const color = getRiskColor(80); // '#9c27b0' (critical)
const level = getRiskLevel(35); // 'medium'
```

---

### 9. Grade Colors

BOM health letter grades (A-F).

| Grade | Color | Hex |
|-------|-------|-----|
| `A` | Green | `#4caf50` |
| `B` | Light Green | `#8bc34a` |
| `C` | Orange | `#ff9800` |
| `D` | Red | `#f44336` |
| `F` | Purple | `#9c27b0` |

**Helper Functions:**

```tsx
import { getGradeColor, getGradeFromScore } from '@/theme';

const color = getGradeColor('A'); // '#4caf50'
const grade = getGradeFromScore(92); // 'A'
```

---

### 10. Alert Severity Colors

Standard alert/notification severity levels.

| Severity | Color | Hex |
|----------|-------|-----|
| `info` | Blue | `#2196f3` |
| `warning` | Orange | `#ff9800` |
| `error` | Red | `#f44336` |
| `success` | Green | `#4caf50` |

**Helper Function:**

```tsx
import { getAlertSeverityColor } from '@/theme';

const color = getAlertSeverityColor('warning'); // '#ff9800'
```

---

## Helper Functions

All helper functions are exported from `@/theme` for convenience.

### withAlpha(color, alpha)

Convert hex colors to rgba with transparency.

```tsx
import { withAlpha } from '@/theme';

const transparentRed = withAlpha('#ef4444', 0.2); // 'rgba(239, 68, 68, 0.2)'

<Box sx={{ backgroundColor: withAlpha(qualityColors.staging, 0.15) }} />
```

---

## Usage Examples

### 1. Component with Theme Tokens

```tsx
import { useTheme } from '@mui/material/styles';
import { enrichmentStatusColors, getQualityColor } from '@/theme';

const MyComponent = () => {
  const theme = useTheme();
  const qualityScore = 95;

  return (
    <Box>
      {/* Option 1: Direct token access */}
      <Chip
        label="Processing"
        sx={{ backgroundColor: enrichmentStatusColors.processing }}
      />

      {/* Option 2: Helper function */}
      <Box sx={{ color: getQualityColor(qualityScore) }}>
        Quality: {qualityScore}%
      </Box>

      {/* Option 3: Theme customTokens (type-safe) */}
      <Typography sx={{ color: theme.customTokens.risk.high }}>
        High Risk Component
      </Typography>

      {/* Option 4: Standard MUI palette */}
      <Button sx={{ backgroundColor: theme.palette.primary.main }}>
        Upload
      </Button>
    </Box>
  );
};
```

### 2. Status Chip with Dynamic Color

```tsx
import { getEnrichmentStatusColor } from '@/theme';

const EnrichmentStatusChip = ({ status }: { status: string }) => {
  const color = getEnrichmentStatusColor(status);

  return (
    <Chip
      label={status}
      sx={{
        backgroundColor: `${color}20`, // 20% opacity background
        color: color,
        fontWeight: 600,
      }}
    />
  );
};
```

### 3. Lifecycle Badge

```tsx
import { getLifecycleColor } from '@/theme';

const LifecycleBadge = ({ status }: { status: string }) => {
  const color = getLifecycleColor(status);

  return (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        px: 1,
        py: 0.5,
        borderRadius: 1,
        backgroundColor: `${color}15`,
        color: color,
        fontSize: '0.75rem',
        fontWeight: 600,
      }}
    >
      {status.toUpperCase()}
    </Box>
  );
};
```

### 4. Risk Score Progress Bar

```tsx
import { getRiskColor, getRiskLevel } from '@/theme';
import { LinearProgress, Box, Typography } from '@mui/material';

const RiskProgressBar = ({ score }: { score: number }) => {
  const color = getRiskColor(score);
  const level = getRiskLevel(score);

  return (
    <Box>
      <Typography variant="caption" sx={{ color }}>
        Risk: {level.toUpperCase()} ({score}/100)
      </Typography>
      <LinearProgress
        variant="determinate"
        value={score}
        sx={{
          '& .MuiLinearProgress-bar': {
            backgroundColor: color,
          },
        }}
      />
    </Box>
  );
};
```

---

## Adding New Status Colors

### Step 1: Add to tokens.ts

```tsx
// In theme/tokens.ts
export const myNewStatusColors = {
  pending: '#9ca3af',
  active: '#22c55e',
  expired: '#ef4444',
} as const;

export type MyNewStatus = keyof typeof myNewStatusColors;
```

### Step 2: Export from index.ts

```tsx
// In theme/index.ts
import { myNewStatusColors } from './tokens';

// Add to customTokens
const customTokens = {
  // ... existing tokens
  myNewStatus: myNewStatusColors,
};

// Update type augmentation
declare module '@mui/material/styles' {
  interface Theme {
    customTokens: {
      // ... existing tokens
      myNewStatus: typeof myNewStatusColors;
    };
  }
}
```

### Step 3: (Optional) Add Helper Function

```tsx
// In theme/helpers.ts
export function getMyNewStatusColor(status: string): string {
  const key = status.toLowerCase() as MyNewStatus;
  return myNewStatusColors[key] || myNewStatusColors.pending;
}
```

### Step 4: Use in Components

```tsx
import { useTheme } from '@mui/material/styles';

const MyComponent = () => {
  const theme = useTheme();

  return (
    <Chip
      label="Active"
      sx={{ backgroundColor: theme.customTokens.myNewStatus.active }}
    />
  );
};
```

---

## Migration Guide

### Before (Hardcoded Colors)

```tsx
const statusConfig = {
  healthy: { color: '#22c55e' },
  degraded: { color: '#facc15' },
  down: { color: '#ef4444' },
};

<Box sx={{ borderColor: '#e5e7eb' }} />
```

### After (Theme Tokens)

```tsx
import { useTheme } from '@mui/material/styles';
import { enrichmentStatusColors, alertSeverityColors } from '@/theme';

const MyComponent = () => {
  const theme = useTheme();

  const statusConfig = {
    healthy: { color: enrichmentStatusColors.completed },
    degraded: { color: alertSeverityColors.warning },
    down: { color: alertSeverityColors.error },
  };

  return <Box sx={{ borderColor: theme.palette.grey[200] }} />;
};
```

### Replacement Patterns

| Before | After |
|--------|-------|
| `'#22c55e'` | `enrichmentStatusColors.completed` or `theme.palette.success.main` |
| `'#ef4444'` | `alertSeverityColors.error` or `theme.palette.error.main` |
| `'#facc15'` | `alertSeverityColors.warning` or `theme.palette.warning.main` |
| `'#3b82f6'` | `theme.palette.primary.main` |
| `'#e5e7eb'` | `theme.palette.grey[200]` |
| `'#6b7280'` | `theme.palette.grey[500]` |

---

## Best Practices

1. **Always use theme tokens**: Never hardcode hex colors
2. **Use helper functions**: Prefer `getQualityColor(score)` over switch statements
3. **Type-safe access**: Use `theme.customTokens.risk.high` for type safety
4. **Semantic naming**: Use business logic names (production, staging, rejected) over generic colors (green, yellow, red)
5. **Consistent opacity**: Use `${color}20` (20% opacity) for backgrounds, `${color}15` (15%) for hover states
6. **Theme-aware grays**: Use `theme.palette.grey[N]` instead of hardcoded grays for theme compatibility

---

## Resources

- **MUI Theme Documentation**: https://mui.com/material-ui/customization/theming/
- **MUI Palette Configuration**: https://mui.com/material-ui/customization/palette/
- **TypeScript Type Augmentation**: https://mui.com/material-ui/guides/typescript/#augmenting-your-props-using-module-augmentation

---

## FAQ

**Q: How do I change the default theme?**

A: Edit the `DEFAULT_THEME` constant in `contexts/ThemeContext.tsx` (line 12).

**Q: Can I add more theme variants (e.g., "high-contrast")?**

A: Yes! Add a new palette in `theme/variants.ts`, create the theme in `theme/index.ts`, update the `ThemeVariant` type, and add it to the `themes` object.

**Q: Why are there both `enrichmentStatusColors.completed` and `theme.palette.success.main`?**

A: `enrichmentStatusColors` are CNS-specific business logic colors (enrichment workflow), while `theme.palette.success` is a general MUI semantic color. Use the most specific token for your use case.

**Q: How do I test theme changes during development?**

A: Use the palette icon in the AppBar to switch between all 4 theme variants and verify your colors work in each.

**Q: Are theme changes persisted across page reloads?**

A: Yes, the selected theme is saved to localStorage with the key `cns_dashboard_theme_variant`.
