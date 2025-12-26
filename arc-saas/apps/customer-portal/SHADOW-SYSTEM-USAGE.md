# Enhanced Shadow System - Usage Guide

## Overview
The Customer Portal now includes a comprehensive theme-aware shadow system with semantic variants that automatically adapt to light and dark themes.

## Shadow Variables

### Semantic Shadow Types
```css
--shadow-primary   /* Blue-tinted shadow for primary elements */
--shadow-success   /* Green-tinted shadow for success states */
--shadow-warning   /* Amber-tinted shadow for warning states */
--shadow-error     /* Red-tinted shadow for error states */
--shadow-hover     /* Elevated shadow for hover states */
--shadow-focus     /* Focus ring shadow */
```

### Theme Adaptation
- **Light & Mid-Light**: Subtle shadows (0.12-0.15 opacity)
- **Dark & Mid-Dark**: Stronger shadows (0.28-0.35 opacity) for better visibility

## Utility Classes

### Basic Semantic Shadows
```tsx
// Primary shadow (blue-tinted)
<div className="shadow-primary">Primary Card</div>

// Success shadow (green-tinted)
<div className="shadow-success">Success Alert</div>

// Warning shadow (amber-tinted)
<div className="shadow-warning">Warning Banner</div>

// Error shadow (red-tinted)
<div className="shadow-error">Error Message</div>
```

### Interactive Effects

#### Hover Lift Effect
```tsx
<button className="shadow-hover-lift">
  Hover Me
</button>
```
- Adds smooth transition
- Elevates on hover with `var(--shadow-hover)`
- Translates up 2px for depth

#### Focus Ring
```tsx
<input
  type="text"
  className="shadow-focus-ring"
  placeholder="Focus me"
/>
```
- Removes default outline
- Shows theme-aware focus shadow

### Animation Effects

#### Pulsing Shadow
```tsx
<div className="shadow-pulse shadow-primary">
  Attention-grabbing element
</div>
```
- Pulses between primary and hover shadow
- 2-second infinite loop
- Subtle opacity change

#### Glowing Effect
```tsx
<div className="shadow-glow">
  Special Feature Badge
</div>
```
- Creates soft glowing animation
- Ideal for CTAs or feature highlights
- Automatically uses primary color

## Component Examples

### Primary Button with Hover
```tsx
<button className="bg-primary text-primary-foreground px-4 py-2 rounded-md shadow-primary shadow-hover-lift">
  Click Me
</button>
```

### Success Alert Card
```tsx
<div className="bg-card border border-success rounded-lg p-4 shadow-success">
  <h3 className="text-success font-semibold">Success!</h3>
  <p>Your changes have been saved.</p>
</div>
```

### Warning Banner with Pulse
```tsx
<div className="bg-warning/10 border border-warning rounded-md p-3 shadow-warning shadow-pulse">
  <p className="text-warning-foreground">Action required</p>
</div>
```

### Feature Card with Glow
```tsx
<div className="bg-card rounded-xl p-6 shadow-glow">
  <h2 className="text-2xl font-bold">Premium Feature</h2>
  <p className="text-muted-foreground">Exclusive content</p>
</div>
```

### Form Input with Focus
```tsx
<input
  type="email"
  className="w-full px-3 py-2 border rounded-md shadow-focus-ring"
  placeholder="Enter your email"
/>
```

## Combining with Tailwind

The shadow utilities work seamlessly with Tailwind classes:

```tsx
// Card with primary shadow and hover effect
<div className="bg-card rounded-lg p-6 shadow-primary shadow-hover-lift transition-all duration-200">
  <h3 className="text-lg font-semibold">Interactive Card</h3>
</div>

// Button with success shadow
<button className="bg-success text-success-foreground px-6 py-3 rounded-full shadow-success hover:bg-success/90">
  Confirm
</button>

// Alert with error shadow and pulse
<div className="bg-destructive/10 border-2 border-destructive rounded-md p-4 shadow-error shadow-pulse">
  <p className="text-destructive font-medium">Critical Error</p>
</div>
```

## Advanced Usage

### Custom Combinations
```tsx
// Combine multiple effects
<div className="shadow-primary shadow-hover-lift shadow-pulse">
  Multi-effect element
</div>
```

### Conditional Shadows
```tsx
// Use with state
const AlertCard = ({ type }: { type: 'success' | 'warning' | 'error' }) => {
  const shadowClass = {
    success: 'shadow-success',
    warning: 'shadow-warning',
    error: 'shadow-error'
  }[type];

  return (
    <div className={`bg-card rounded-lg p-4 ${shadowClass}`}>
      Alert content
    </div>
  );
};
```

### Direct CSS Variable Usage
```tsx
// Use in inline styles when needed
<div style={{ boxShadow: 'var(--shadow-primary)' }}>
  Custom styled element
</div>
```

## Animation Keyframes

### shadowPulse
- Oscillates between primary and hover shadow
- 2-second duration
- Infinite loop
- Includes subtle opacity change (1 → 0.8 → 1)

### shadowGlow
- Creates glowing effect with blue tint
- Expands shadow from 14px to 20px
- 2-second duration
- Infinite loop

## Best Practices

1. **Semantic Usage**: Use shadow variants that match content meaning
   - `shadow-primary` for main actions
   - `shadow-success` for confirmations
   - `shadow-warning` for cautions
   - `shadow-error` for errors

2. **Accessibility**: Always maintain sufficient contrast
   - Shadows enhance but don't replace color contrast
   - Ensure text remains readable with shadows

3. **Performance**: Use animations sparingly
   - Limit `shadow-pulse` and `shadow-glow` to key elements
   - Avoid animating too many elements simultaneously

4. **Theme Consistency**: Let CSS variables handle theme adaptation
   - Don't hard-code shadow values
   - Trust the theme-aware system

## File Location
`e:\Work\Ananta-Platform-Saas\arc-saas\apps\customer-portal\src\styles\globals.css`

## Implementation Details
- Lines 51-57: Light theme shadows
- Lines 103-109: Dark theme shadows
- Lines 156-162: Mid-light theme shadows
- Lines 209-215: Mid-dark theme shadows
- Lines 284-327: Utility classes
- Lines 334-352: Animation keyframes
