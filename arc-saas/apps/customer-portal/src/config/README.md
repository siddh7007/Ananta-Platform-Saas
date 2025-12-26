# Configuration Directory

Central configuration for the Customer Portal application.

## Design Token System (CBP-P4-001)

### Quick Start

```typescript
import { spacing, fontSize, getCssVar, shadow } from '@/config/design-tokens';

// Use in your components
const styles = {
  padding: spacing(4),
  ...fontSize('base'),
  backgroundColor: getCssVar('color.brand.primary'),
  boxShadow: shadow('md'),
};
```

### Files

| File | Purpose |
|------|---------|
| `design-tokens.ts` | Core token system (148 tokens + 15 helpers) |
| `DESIGN_TOKENS.md` | Comprehensive documentation |
| `DESIGN_TOKENS_QUICK_REFERENCE.md` | Quick reference cheat sheet |
| `design-tokens.example.tsx` | 9 component examples |
| `verify-tokens.ts` | Verification script |
| `__tests__/design-tokens.test.ts` | Test suite (40+ tests) |

### Documentation

1. **Quick Start**: See `DESIGN_TOKENS_QUICK_REFERENCE.md`
2. **Full Documentation**: See `DESIGN_TOKENS.md`
3. **Integration Guide**: See `../../DESIGN_TOKENS_INTEGRATION.md`
4. **Implementation Report**: See `../../CBP-P4-001-IMPLEMENTATION.md`

### Verify Installation

```bash
# Run verification script
bun run src/config/verify-tokens.ts

# Run tests
bun test src/config/__tests__/design-tokens.test.ts
```

### Usage

```typescript
// Import what you need
import {
  tokens,       // All tokens
  spacing,      // Spacing helper
  fontSize,     // Font size helper
  getCssVar,    // CSS var helper
  zIndex,       // Z-index helper
  shadow,       // Shadow helper
  transition,   // Transition helper
} from '@/config/design-tokens';

// Or import from config index
import { spacing, fontSize } from '@/config';
```

## Other Configuration

| File | Purpose |
|------|---------|
| `auth.ts` | Authentication configuration |
| `env.ts` | Environment variables |
| `navigation.ts` | Navigation manifest with RBAC |
| `index.ts` | Central exports |

## Token Categories

- **Colors** (33 tokens): Brand, semantic, neutral, UI, sidebar
- **Typography** (27 tokens): Fonts, sizes, weights, line heights
- **Spacing** (35 tokens): 0 to 96 in 0.25rem increments
- **Shadows** (15 tokens): Standard + semantic colored
- **Z-Index** (10 tokens): Layering hierarchy
- **Border Radius** (9 tokens): None to full pill
- **Breakpoints** (6 tokens): Responsive sizes
- **Animation** (13 tokens): Durations + timing functions

**Total**: 148 design tokens

## Features

- Zero dependencies
- Type-safe with full autocomplete
- Theme-aware (4 themes: light, dark, mid-light, mid-dark)
- Tailwind CSS compatible
- Tree-shakeable
- Zero runtime overhead
- Production ready

## Next Steps

1. Review the quick reference guide
2. Explore component examples
3. Start using tokens in new components
4. Gradually migrate existing components

For questions, see the comprehensive documentation in `DESIGN_TOKENS.md`.
