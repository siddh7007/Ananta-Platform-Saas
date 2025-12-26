# Design Token System

Centralized design tokens for the Customer Portal, providing TypeScript constants and helper functions for consistent design across the application.

## Overview

The design token system provides:
- **Type-safe token access** via TypeScript constants
- **CSS custom property compatibility** with Tailwind CSS and shadcn/ui
- **Helper functions** for common token operations
- **Theme-aware tokens** that support light/dark/mid-light/mid-dark themes

## Installation

Tokens are automatically available. Import from `@/config/design-tokens`:

```typescript
import { tokens, getToken, spacing, fontSize } from '@/config/design-tokens';
```

## Token Categories

### 1. Colors

#### Brand Colors
```typescript
import { tokens } from '@/config/design-tokens';

// Primary brand color
tokens.color.brand.primary.value // 'hsl(221.2 83.2% 53.3%)'
tokens.color.brand.primary.css   // '--primary'

// Secondary brand color
tokens.color.brand.secondary.value
```

#### Semantic Colors
```typescript
// Success (green)
tokens.color.semantic.success.value // 'hsl(142.1 76.2% 36.3%)'

// Warning (amber)
tokens.color.semantic.warning.value // 'hsl(38 92% 50%)'

// Error/Destructive (red)
tokens.color.semantic.error.value // 'hsl(0 84.2% 60.2%)'

// Info (blue)
tokens.color.semantic.info.value // 'hsl(199 89% 48%)'
```

#### Neutral Colors
```typescript
// Background and foreground
tokens.color.neutral.background.value
tokens.color.neutral.foreground.value

// Muted colors
tokens.color.neutral.muted.value
tokens.color.neutral.mutedForeground.value
```

#### UI Colors
```typescript
// Borders and inputs
tokens.color.ui.border.value
tokens.color.ui.input.value
tokens.color.ui.ring.value // Focus ring

// Cards and popovers
tokens.color.ui.card.value
tokens.color.ui.popover.value
```

### 2. Typography

#### Font Families
```typescript
tokens.typography.fontFamily.sans.value
// ['ui-sans-serif', 'system-ui', '-apple-system', ...]

tokens.typography.fontFamily.mono.value
// ['ui-monospace', 'SFMono-Regular', ...]
```

#### Font Sizes
```typescript
tokens.typography.fontSize.xs    // { value: '0.75rem', lineHeight: '1rem' }
tokens.typography.fontSize.sm    // { value: '0.875rem', lineHeight: '1.25rem' }
tokens.typography.fontSize.base  // { value: '1rem', lineHeight: '1.5rem' }
tokens.typography.fontSize.lg    // { value: '1.125rem', lineHeight: '1.75rem' }
tokens.typography.fontSize.xl    // { value: '1.25rem', lineHeight: '1.75rem' }
tokens.typography.fontSize['2xl'] // { value: '1.5rem', lineHeight: '2rem' }
tokens.typography.fontSize['3xl'] // { value: '1.875rem', lineHeight: '2.25rem' }
tokens.typography.fontSize['4xl'] // { value: '2.25rem', lineHeight: '2.5rem' }
```

#### Font Weights
```typescript
tokens.typography.fontWeight.normal   // '400'
tokens.typography.fontWeight.medium   // '500'
tokens.typography.fontWeight.semibold // '600'
tokens.typography.fontWeight.bold     // '700'
```

#### Line Heights
```typescript
tokens.typography.lineHeight.tight   // '1.25'
tokens.typography.lineHeight.normal  // '1.5'
tokens.typography.lineHeight.relaxed // '1.625'
```

### 3. Spacing

Spacing scale from 0 to 96 (0.25rem increments):

```typescript
tokens.spacing[0].value   // '0'
tokens.spacing[1].value   // '0.25rem'  (4px)
tokens.spacing[2].value   // '0.5rem'   (8px)
tokens.spacing[3].value   // '0.75rem'  (12px)
tokens.spacing[4].value   // '1rem'     (16px)
tokens.spacing[6].value   // '1.5rem'   (24px)
tokens.spacing[8].value   // '2rem'     (32px)
tokens.spacing[12].value  // '3rem'     (48px)
tokens.spacing[16].value  // '4rem'     (64px)
tokens.spacing[24].value  // '6rem'     (96px)
tokens.spacing[32].value  // '8rem'     (128px)
```

### 4. Border Radius

```typescript
tokens.borderRadius.none.value // '0'
tokens.borderRadius.sm.value   // 'calc(var(--radius) - 4px)'
tokens.borderRadius.md.value   // 'calc(var(--radius) - 2px)'
tokens.borderRadius.lg.value   // 'var(--radius)'
tokens.borderRadius.xl.value   // '0.75rem'
tokens.borderRadius['2xl'].value // '1rem'
tokens.borderRadius.full.value // '9999px' (pill shape)
```

### 5. Shadows

```typescript
// Standard shadows
tokens.shadow.xs.value   // Extra small
tokens.shadow.sm.value   // Small
tokens.shadow.md.value   // Medium
tokens.shadow.lg.value   // Large
tokens.shadow.xl.value   // Extra large
tokens.shadow['2xl'].value // 2X large
tokens.shadow.inner.value  // Inner shadow

// Semantic shadows (colored)
tokens.shadow.primary.value  // Blue shadow
tokens.shadow.success.value  // Green shadow
tokens.shadow.warning.value  // Amber shadow
tokens.shadow.error.value    // Red shadow
tokens.shadow.hover.value    // Hover state shadow
tokens.shadow.focus.value    // Focus state shadow
```

### 6. Z-Index

```typescript
tokens.zIndex.base.value         // 0
tokens.zIndex.dropdown.value     // 1000
tokens.zIndex.sticky.value       // 1020
tokens.zIndex.fixed.value        // 1030
tokens.zIndex.modalBackdrop.value // 1040
tokens.zIndex.modal.value        // 1050
tokens.zIndex.popover.value      // 1060
tokens.zIndex.tooltip.value      // 1070
tokens.zIndex.toast.value        // 1080
tokens.zIndex.max.value          // 9999
```

### 7. Breakpoints

```typescript
tokens.breakpoint.xs.value   // '475px' (mobile)
tokens.breakpoint.sm.value   // '640px' (large phones)
tokens.breakpoint.md.value   // '768px' (tablets)
tokens.breakpoint.lg.value   // '1024px' (desktops)
tokens.breakpoint.xl.value   // '1280px' (large desktops)
tokens.breakpoint['2xl'].value // '1536px' (ultra-wide)
```

### 8. Animation

#### Durations
```typescript
tokens.animation.duration.instant.value  // '0ms'
tokens.animation.duration.fast.value     // '150ms'
tokens.animation.duration.normal.value   // '300ms'
tokens.animation.duration.slow.value     // '500ms'
```

#### Timing Functions
```typescript
tokens.animation.timing.linear.value    // 'linear'
tokens.animation.timing.ease.value      // 'ease'
tokens.animation.timing.easeIn.value    // 'ease-in'
tokens.animation.timing.easeOut.value   // 'ease-out'
tokens.animation.timing.easeInOut.value // 'ease-in-out'
tokens.animation.timing.spring.value    // 'cubic-bezier(0.68, -0.55, 0.265, 1.55)'
tokens.animation.timing.bounce.value    // 'cubic-bezier(0.68, -0.55, 0.27, 1.55)'
```

## Helper Functions

### `getToken(path: string)`

Get any token value by dot notation path:

```typescript
import { getToken } from '@/config/design-tokens';

getToken('color.brand.primary.value'); // 'hsl(221.2 83.2% 53.3%)'
getToken('spacing.4.value');           // '1rem'
getToken('typography.fontSize.lg.value'); // '1.125rem'
```

### `spacing(value: number)`

Get spacing value by numeric key:

```typescript
import { spacing } from '@/config/design-tokens';

spacing(4);   // '1rem'
spacing(8);   // '2rem'
spacing(0.5); // '0.125rem'
```

### `fontSize(size: string)`

Get font size with line height:

```typescript
import { fontSize } from '@/config/design-tokens';

fontSize('base'); // { fontSize: '1rem', lineHeight: '1.5rem' }
fontSize('lg');   // { fontSize: '1.125rem', lineHeight: '1.75rem' }

// Use in components
const textStyles = fontSize('lg');
<p style={textStyles}>Text</p>
```

### `getCssVar(path: string)`

Get CSS custom property reference:

```typescript
import { getCssVar } from '@/config/design-tokens';

getCssVar('color.brand.primary');    // 'hsl(var(--primary))'
getCssVar('color.semantic.success'); // 'hsl(var(--success))'
```

### `zIndex(level: string)`

Get z-index value:

```typescript
import { zIndex } from '@/config/design-tokens';

zIndex('modal');   // 1050
zIndex('tooltip'); // 1070
zIndex('toast');   // 1080
```

### `shadow(size: string)`

Get shadow value:

```typescript
import { shadow } from '@/config/design-tokens';

shadow('md');      // '0 4px 6px -1px rgb(0 0 0 / 0.1), ...'
shadow('primary'); // 'var(--shadow-primary, ...)'
```

### `borderRadius(size: string)`

Get border radius value:

```typescript
import { borderRadius } from '@/config/design-tokens';

borderRadius('md');   // 'calc(var(--radius) - 2px)'
borderRadius('full'); // '9999px'
```

### `transition(property, duration, timing)`

Generate CSS transition string:

```typescript
import { transition } from '@/config/design-tokens';

transition('all', 'normal', 'easeInOut'); // 'all 300ms ease-in-out'
transition('opacity', 'fast');            // 'opacity 150ms ease'
transition('transform', 'slow', 'spring'); // 'transform 500ms cubic-bezier(...)'
```

### `mediaQuery(size, type?)`

Generate media query string:

```typescript
import { mediaQuery } from '@/config/design-tokens';

mediaQuery('md');        // '@media (min-width: 768px)'
mediaQuery('lg', 'max'); // '@media (max-width: 1024px)'
```

### `matchesBreakpoint(size)`

Check if viewport matches breakpoint (client-side only):

```typescript
import { matchesBreakpoint } from '@/config/design-tokens';

if (matchesBreakpoint('md')) {
  // Viewport is >= 768px
}
```

## Usage Examples

### In React Components

```typescript
import { tokens, spacing, fontSize, shadow, transition } from '@/config/design-tokens';

function MyComponent() {
  const buttonStyles = {
    padding: `${spacing(2)} ${spacing(4)}`,
    ...fontSize('base'),
    boxShadow: shadow('md'),
    transition: transition('all', 'fast', 'easeInOut'),
  };

  return <button style={buttonStyles}>Click me</button>;
}
```

### With Tailwind CSS Classes

Tokens are compatible with Tailwind's utility classes:

```tsx
// These use the same CSS custom properties
<div className="bg-primary text-primary-foreground">
  Primary button
</div>

// Equivalent to:
import { getCssVar } from '@/config/design-tokens';
<div style={{
  backgroundColor: getCssVar('color.brand.primary'),
  color: getCssVar('color.brand.primaryForeground'),
}}>
  Primary button
</div>
```

### Inline Styles

```tsx
import { tokens } from '@/config/design-tokens';

<div
  style={{
    backgroundColor: tokens.color.brand.primary.value,
    padding: tokens.spacing[4].value,
    borderRadius: tokens.borderRadius.lg.value,
    boxShadow: tokens.shadow.md.value,
  }}
>
  Content
</div>
```

### Styled Components (if using)

```typescript
import styled from 'styled-components';
import { tokens, spacing, fontSize } from '@/config/design-tokens';

const Button = styled.button`
  padding: ${spacing(2)} ${spacing(4)};
  font-size: ${fontSize('base').fontSize};
  line-height: ${fontSize('base').lineHeight};
  background-color: ${tokens.color.brand.primary.value};
  color: ${tokens.color.brand.primaryForeground.value};
  border-radius: ${tokens.borderRadius.md.value};
  box-shadow: ${tokens.shadow.md.value};
`;
```

### Conditional Styling

```tsx
import { tokens, zIndex } from '@/config/design-tokens';

function Modal({ isOpen }: { isOpen: boolean }) {
  return (
    <div
      style={{
        display: isOpen ? 'block' : 'none',
        zIndex: zIndex('modal'),
        backgroundColor: tokens.color.ui.popover.value,
      }}
    >
      Modal content
    </div>
  );
}
```

### Responsive Design

```tsx
import { matchesBreakpoint } from '@/config/design-tokens';
import { useState, useEffect } from 'react';

function ResponsiveComponent() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(!matchesBreakpoint('md'));
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return (
    <div>{isMobile ? 'Mobile view' : 'Desktop view'}</div>
  );
}
```

## Integration with Tailwind CSS

The design tokens are fully compatible with Tailwind CSS custom properties defined in `globals.css`. You can:

1. **Use Tailwind classes** for most styling (recommended)
2. **Use token helpers** for dynamic or computed styles
3. **Mix both approaches** as needed

```tsx
// Tailwind classes (preferred for static styles)
<button className="bg-primary text-primary-foreground px-4 py-2 rounded-md shadow-md">
  Button
</button>

// Token helpers (for dynamic styles)
import { spacing, shadow } from '@/config/design-tokens';
<button style={{
  padding: `${spacing(2)} ${spacing(4)}`,
  boxShadow: isHovered ? shadow('lg') : shadow('md'),
}}>
  Button
</button>
```

## Theme Compatibility

Tokens work with all four themes:
- **Light** - High contrast, bright backgrounds
- **Dark** - High contrast, dark backgrounds
- **Mid-Light** - Reduced contrast, soft light (easier on eyes)
- **Mid-Dark** - Reduced contrast, soft dark (comfortable for OLED)

The CSS custom properties automatically update when the theme changes via `data-theme` attribute.

## Best Practices

1. **Prefer Tailwind classes** for static styles (cleaner JSX)
2. **Use token helpers** for dynamic/computed styles
3. **Use semantic color tokens** (success, warning, error) over raw colors
4. **Use spacing scale** instead of arbitrary values
5. **Use z-index tokens** to maintain layering hierarchy
6. **Use animation tokens** for consistent timing
7. **Document custom tokens** if extending the system

## Extending Tokens

To add new tokens, edit `design-tokens.ts` and add to the appropriate section:

```typescript
// Example: Add a new semantic color
export const colorTokens = {
  // ... existing tokens
  semantic: {
    // ... existing semantic colors
    custom: {
      value: 'hsl(280 70% 50%)',
      css: '--custom',
      description: 'Custom semantic color',
    },
  },
};
```

Then update `globals.css` to add the CSS custom property:

```css
:root {
  /* ... existing properties */
  --custom: 280 70% 50%;
  --custom-foreground: 0 0% 100%;
}
```

## Type Safety

All tokens are fully typed with TypeScript. Your IDE will provide:
- **Autocomplete** for token paths
- **Type checking** for invalid keys
- **Documentation** on hover

```typescript
import { tokens, spacing } from '@/config/design-tokens';

// Autocomplete suggests: 0, 0.5, 1, 1.5, 2, 2.5, 3, ...
const padding = spacing(4);

// Type error: Argument of type '999' is not assignable
const invalid = spacing(999);
```

## Performance

- Tokens are **tree-shakeable** - only imported tokens are included in bundle
- CSS custom properties are **cached by browser**
- Helper functions are **lightweight** (no dependencies)
- No runtime overhead for static token access

## Migration from Hard-Coded Values

```diff
// Before
- <div style={{ padding: '16px', fontSize: '18px' }}>
+ <div style={{ padding: spacing(4), fontSize: fontSize('lg').fontSize }}>

// Before
- <div className="z-50 shadow-xl">
+ <div style={{ zIndex: zIndex('modal') }} className="shadow-xl">

// Before
- transition: all 0.3s ease-in-out;
+ transition: ${transition('all', 'normal', 'easeInOut')};
```

## Related Files

- **Token Definition**: `src/config/design-tokens.ts`
- **CSS Variables**: `src/styles/globals.css`
- **Tailwind Config**: `tailwind.config.js`
- **Theme Provider**: `src/providers/theme-provider.tsx`

## Reference

- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [shadcn/ui Theming](https://ui.shadcn.com/docs/theming)
- [CSS Custom Properties](https://developer.mozilla.org/en-US/docs/Web/CSS/Using_CSS_custom_properties)
