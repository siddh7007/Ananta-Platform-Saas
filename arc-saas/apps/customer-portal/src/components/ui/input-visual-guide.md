# InputWrapper Visual Guide

## Component States

### 1. Basic Input
```
┌────────────────────────────────────┐
│ Enter text...                      │
└────────────────────────────────────┘
  Helper text goes here
```

### 2. With Left Icon
```
┌────────────────────────────────────┐
│ 🔍 Search components...            │
└────────────────────────────────────┘
```

### 3. With Left Icon + Clear Button
```
┌────────────────────────────────────┐
│ 🔍 Search query text             ✕ │
└────────────────────────────────────┘
  Search by MPN, manufacturer, or category
```

### 4. Error State
```
┌────────────────────────────────────┐ (RED BORDER)
│ ✉ invalid-email                 ⚠ │
└────────────────────────────────────┘
  Please enter a valid email address (RED TEXT)
```

### 5. Error State + Clear Button
```
┌────────────────────────────────────┐ (RED BORDER)
│ 👤 AB                          ⚠ ✕ │
└────────────────────────────────────┘
  Name must be at least 3 characters (RED TEXT)     2/100
```

### 6. With Character Counter (Normal)
```
┌────────────────────────────────────┐
│ 👤 John Doe                      ✕ │
└────────────────────────────────────┘
  Enter your full name                              8/50
```

### 7. Character Counter Near Limit (90%+)
```
┌────────────────────────────────────┐
│ This text is very close to max  ✕ │
└────────────────────────────────────┘
  Character count turns red at 90%                 46/50 (RED)
```

### 8. Password Field
```
┌────────────────────────────────────┐
│ 🔒 ••••••••                          │
└────────────────────────────────────┘
  Minimum 8 characters                              8/128
```

### 9. Disabled State
```
┌────────────────────────────────────┐ (GRAYED OUT)
│ 👤 Disabled input value            │
└────────────────────────────────────┘
  This field is read-only
```

## Layout Structure

```
<div class="w-full">                         ← Outer wrapper
  <div class="relative">                     ← Input container

    <!-- Left Icon (if provided) -->
    <div class="absolute left-3 ...">
      {leftIcon}
    </div>

    <!-- Input Field -->
    <Input
      className="pl-10 pr-16 ..."             ← Dynamic padding
      ...
    />

    <!-- Right Icons Container -->
    <div class="absolute right-3 ...">
      {error && <AlertCircle />}              ← Error icon
      {clearable && <X />}                    ← Clear button
      {rightIcon}                             ← Custom right icon
    </div>

  </div>

  <!-- Helper Row -->
  <div class="mt-1.5 flex ...">
    <div class="flex-1">
      {error ? <p>{error}</p> : <p>{hint}</p>}
    </div>
    <div class="shrink-0">
      {showCounter && <span>{current}/{max}</span>}
    </div>
  </div>
</div>
```

## Icon Priority (Right Side)

When multiple right-side elements are present, they display in this priority:

1. **Error Icon** (⚠) - Always shows when error exists
2. **Clear Button** (✕) - Shows when clearable=true AND has value
3. **Custom Right Icon** - Only shows when no error/clear button

Example combinations:
```
No value, no error:          [          ]
Has value, clearable:        [text    ✕]
Has error:                   [text   ⚠ ]
Has error + clearable:       [text  ⚠ ✕]
Custom right icon:           [text   💰]
```

## Spacing

```
Padding:
- Left icon present:    pl-10  (40px)
- Right icon present:   pr-10  (40px)
- Error + Clear:        pr-16  (64px)

Heights:
- Mobile:     min-h-[44px]  (Touch-optimized)
- Desktop:    min-h-[40px]

Helper text spacing:
- Top margin:    mt-1.5     (6px)
- Font size:     text-xs    (12px)
```

## Color Scheme

```
Normal State:
├─ Border:        border-input (gray)
├─ Background:    bg-background
├─ Text:          text-foreground
├─ Placeholder:   text-muted-foreground
└─ Icon:          text-muted-foreground

Error State:
├─ Border:        border-red-500
├─ Focus ring:    ring-red-500
├─ Error icon:    text-red-500
├─ Error text:    text-red-500
└─ Input text:    text-foreground

Counter:
├─ Normal:        text-muted-foreground
└─ Near limit:    text-red-500 font-medium

Disabled:
├─ Opacity:       opacity-50
└─ Cursor:        cursor-not-allowed
```

## Interactive States

### Focus
```
┌────────────────────────────────────┐
│ 🔍 Search...                     ✕ │ ← Blue ring (ring-ring)
└────────────────────────────────────┘
```

### Hover (Clear Button)
```
                                    ✕  ← Changes from gray to black
                                       (hover:text-foreground)
```

### Active (Clear Button Clicked)
```
                                    ✕  ← Focus ring appears
                                       (focus:ring-2)
```

## Responsive Behavior

### Mobile (< 768px)
- Input height: 44px (larger touch target)
- All padding and spacing remain the same
- Clear button sized for touch (16px icon)

### Desktop (≥ 768px)
- Input height: 40px (standard desktop size)
- Hover states active
- Mouse cursor changes appropriately

## Accessibility Indicators

```
<input
  aria-invalid="true"                ← When error exists
  aria-describedby="field-error"     ← Links to error message
/>

<div
  role="alert"                       ← Error message
  id="field-error"
>
  Error text
</div>

<button
  aria-label="Clear input"           ← Clear button label
  tabIndex={-1}                      ← Not in tab order
>
  ✕
</button>

<div
  aria-live="polite"                 ← Counter updates
  aria-atomic="true"
>
  45/50
</div>
```

## Animation/Transitions

```
Clear Button:
- Opacity transition when appearing
- Color transition on hover (transition-colors)

Focus Ring:
- Appears instantly with focus-visible
- Smooth transition

Character Counter:
- Color change to red at 90% (no animation)
- Live region announces changes to screen readers
```

## Z-Index Layers

```
Layer 0: Input background
Layer 1: Input border
Layer 2: Input text/placeholder
Layer 3: Icons (absolute positioned)
Layer 4: Clear button (interactive)
Layer 5: Focus ring (ring-offset)
```

## Examples in Context

### Search Bar
```
┌──────────────────────────────────────────────────────┐
│ 🔍 Search 10,000+ components...                    ✕ │
└──────────────────────────────────────────────────────┘
  Try searching by MPN, manufacturer, or part category
```

### Form Field
```
Email Address *
┌──────────────────────────────────────────────────────┐
│ ✉ user@example.com                                 ✕ │
└──────────────────────────────────────────────────────┘
  We'll never share your email with anyone else
```

### Validation Error
```
BOM Name *
┌──────────────────────────────────────────────────────┐ RED
│ AB                                              ⚠  ✕ │
└──────────────────────────────────────────────────────┘
  Name must be at least 3 characters                  2/100
```

### Success State (Custom Implementation)
```
Email Address *
┌──────────────────────────────────────────────────────┐ GREEN
│ ✉ valid@email.com                               ✓  ✕ │
└──────────────────────────────────────────────────────┘
  Email verified successfully
```

## CSS Classes Reference

### Base Input
```css
.input-base {
  flex, min-h-[44px], md:min-h-[40px], w-full, rounded-md,
  border, border-input, bg-background, px-3, py-2, text-sm,
  ring-offset-background,
  file:border-0, file:bg-transparent, file:text-sm, file:font-medium,
  placeholder:text-muted-foreground,
  focus-visible:outline-none, focus-visible:ring-2,
  focus-visible:ring-ring, focus-visible:ring-offset-2,
  disabled:cursor-not-allowed, disabled:opacity-50
}
```

### With Icons
```css
.with-left-icon {
  pl-10  /* 40px left padding */
}

.with-right-icon {
  pr-10  /* 40px right padding */
}

.with-error-and-clear {
  pr-16  /* 64px right padding for both icons */
}
```

### Error State
```css
.error-state {
  border-red-500,
  focus-visible:ring-red-500
}
```

### Icon Container
```css
.icon-container {
  absolute, left-3, top-1/2, -translate-y-1/2,
  text-muted-foreground, pointer-events-none
}
```

### Clear Button
```css
.clear-button {
  text-muted-foreground,
  hover:text-foreground,
  transition-colors,
  focus:outline-none, focus:ring-2, focus:ring-ring, rounded-sm
}
```

### Helper Text
```css
.helper-row {
  mt-1.5, flex, items-start, justify-between, gap-2, text-xs
}

.error-text {
  text-red-500
}

.hint-text {
  text-muted-foreground
}
```

### Character Counter
```css
.counter-normal {
  text-muted-foreground, tabular-nums, shrink-0
}

.counter-near-limit {
  text-red-500, font-medium, tabular-nums, shrink-0
}
```
