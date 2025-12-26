# Enhanced Input Component - CBP-P4-005

## Overview

The enhanced Input component provides a powerful, accessible input field with built-in support for icons, validation, character counting, and clear functionality. It maintains full backward compatibility with the base `Input` component while offering advanced features through the `InputWrapper` component.

## File Location

`e:\Work\Ananta-Platform-Saas\arc-saas\apps\customer-portal\src\components\ui\input.tsx`

## Components

### Input (Base Component)
The original, simple input component that maintains backward compatibility.

```tsx
import { Input } from '@/components/ui/input';

<Input placeholder="Simple input" />
```

### InputWrapper (Enhanced Component)
Wrapper component with advanced features including icons, error states, character counter, and clear button.

```tsx
import { InputWrapper } from '@/components/ui/input';

<InputWrapper
  leftIcon={<Search className="h-4 w-4" />}
  clearable
  onClear={() => setValue('')}
  placeholder="Search..."
  value={value}
  onChange={(e) => setValue(e.target.value)}
/>
```

## Props

### InputWrapperProps

Extends all standard HTML input attributes plus:

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `leftIcon` | `React.ReactNode` | `undefined` | Icon displayed on the left side of input |
| `rightIcon` | `React.ReactNode` | `undefined` | Icon displayed on the right side (hidden when error or clear button shows) |
| `clearable` | `boolean` | `false` | Shows X button to clear input when value exists |
| `onClear` | `() => void` | `undefined` | Called when clear button is clicked |
| `error` | `string` | `undefined` | Error message displayed below input with red styling |
| `showCounter` | `boolean` | `false` | Shows character count (requires `maxLength`) |
| `maxLength` | `number` | `undefined` | Maximum characters allowed (required for counter) |
| `hint` | `string` | `undefined` | Helper text displayed below input (hidden when error is shown) |

## Features

### 1. Icon Support

Display icons on the left or right side of the input field.

```tsx
// Left icon
<InputWrapper
  leftIcon={<Mail className="h-4 w-4" />}
  placeholder="Email address"
/>

// Right icon
<InputWrapper
  rightIcon={<DollarSign className="h-4 w-4" />}
  placeholder="Amount"
/>

// Both icons
<InputWrapper
  leftIcon={<Search className="h-4 w-4" />}
  rightIcon={<Filter className="h-4 w-4" />}
  placeholder="Search and filter"
/>
```

**Notes:**
- Left icon: Input gets `pl-10` padding automatically
- Right icon: Input gets `pr-10` padding automatically
- Icons use `text-muted-foreground` color and are `pointer-events-none`

### 2. Clear Button

Automatically shows an X button when the input has a value.

```tsx
const [value, setValue] = useState('');

<InputWrapper
  clearable
  onClear={() => setValue('')}
  value={value}
  onChange={(e) => setValue(e.target.value)}
  placeholder="Type something..."
/>
```

**Behavior:**
- Only shows when `clearable={true}` AND input has a value
- Hidden when input is disabled
- Clicking clear button:
  1. Calls `onClear()` callback
  2. Dispatches synthetic input event for form compatibility
  3. Updates internal state if using uncontrolled mode

### 3. Error State

Display validation errors with visual feedback.

```tsx
<InputWrapper
  error="Email is required"
  placeholder="Email address"
/>

// With validation
<InputWrapper
  value={email}
  onChange={(e) => setEmail(e.target.value)}
  error={email && !email.includes('@') ? 'Invalid email' : undefined}
/>
```

**Visual Changes:**
- Red border (`border-red-500`)
- Red focus ring (`focus-visible:ring-red-500`)
- Red error icon (AlertCircle) on the right
- Error message below in red text
- Sets `aria-invalid="true"`

### 4. Character Counter

Show current/max character count with visual feedback.

```tsx
<InputWrapper
  maxLength={100}
  showCounter
  value={value}
  onChange={(e) => setValue(e.target.value)}
/>
```

**Display:**
- Format: `XX/100` (current/max)
- Position: Bottom right corner
- Color: Gray normally, red when ≥90% of limit
- Uses `tabular-nums` for consistent width
- Updates live with `aria-live="polite"`

### 5. Helper Text

Display helpful hints below the input.

```tsx
<InputWrapper
  hint="Enter your full name as it appears on your ID"
  placeholder="Full name"
/>
```

**Behavior:**
- Shown when no error is present
- Hidden when error is displayed
- Sets `aria-describedby` for accessibility

## Accessibility

The component follows WCAG 2.1 AA standards:

- **Keyboard Navigation**: Full keyboard support, clear button is tabbable
- **ARIA Attributes**:
  - `aria-invalid="true"` when error exists
  - `aria-describedby` links to error/hint text
  - `aria-label="Clear input"` on clear button
  - `aria-hidden="true"` on decorative icons
  - `aria-live="polite"` on character counter
- **Focus Management**: Proper focus rings and visual indicators
- **Touch Targets**: 44px min height on mobile, 40px on desktop
- **Error Messages**: Associated with input via `role="alert"`

## Usage Examples

### Basic Search

```tsx
const [search, setSearch] = useState('');

<InputWrapper
  leftIcon={<Search className="h-4 w-4" />}
  clearable
  onClear={() => setSearch('')}
  placeholder="Search components..."
  value={search}
  onChange={(e) => setSearch(e.target.value)}
  hint="Search by MPN, manufacturer, or category"
/>
```

### Form Field with Validation

```tsx
<InputWrapper
  leftIcon={<Mail className="h-4 w-4" />}
  type="email"
  placeholder="Email address"
  value={email}
  onChange={(e) => setEmail(e.target.value)}
  error={errors.email}
  clearable
  onClear={() => setEmail('')}
/>
```

### Text Input with Character Limit

```tsx
<InputWrapper
  placeholder="BOM name"
  value={name}
  onChange={(e) => setName(e.target.value)}
  maxLength={100}
  showCounter
  error={name.length < 3 ? 'Name too short' : undefined}
  hint="Enter a descriptive name for your BOM"
  clearable
  onClear={() => setName('')}
/>
```

### React Hook Form Integration

```tsx
import { useForm } from 'react-hook-form';
import { InputWrapper } from '@/components/ui/input';

function MyForm() {
  const { register, formState: { errors } } = useForm();

  return (
    <form>
      <InputWrapper
        error={errors.name?.message as string}
        maxLength={100}
        showCounter
        hint="Enter the component name"
        {...register('name', {
          required: 'Name is required',
          minLength: { value: 3, message: 'Minimum 3 characters' },
          maxLength: { value: 100, message: 'Maximum 100 characters' }
        })}
      />
    </form>
  );
}
```

### Password Field

```tsx
<InputWrapper
  leftIcon={<Lock className="h-4 w-4" />}
  type="password"
  placeholder="Enter password"
  value={password}
  onChange={(e) => setPassword(e.target.value)}
  maxLength={128}
  showCounter
  hint="Minimum 8 characters, including uppercase and lowercase"
/>
```

## Controlled vs Uncontrolled

The component supports both controlled and uncontrolled modes:

### Controlled (Recommended)
```tsx
const [value, setValue] = useState('');

<InputWrapper
  value={value}
  onChange={(e) => setValue(e.target.value)}
  clearable
  onClear={() => setValue('')}
/>
```

### Uncontrolled
```tsx
const inputRef = useRef<HTMLInputElement>(null);

<InputWrapper
  ref={inputRef}
  defaultValue="initial"
  clearable
  onClear={() => {
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  }}
/>
```

## Styling

### Custom Styling

Pass `className` to customize the input styles:

```tsx
<InputWrapper
  className="font-mono text-lg"
  placeholder="Custom styled"
/>
```

### Layout Integration

The component automatically takes full width of its container:

```tsx
<div className="max-w-md">
  <InputWrapper placeholder="Constrained width" />
</div>
```

## Performance Considerations

- **Ref Merging**: Uses `useImperativeHandle` for proper ref forwarding
- **Synthetic Events**: Clear button dispatches native input events for form compatibility
- **Conditional Rendering**: Icons and features only render when needed
- **Memoization**: Consider wrapping in `React.memo` if used in lists

## Browser Support

- Modern browsers (Chrome, Firefox, Safari, Edge)
- iOS Safari (touch-optimized)
- Android Chrome (touch-optimized)
- Requires ES2015+ support

## Migration from Base Input

Existing code using `Input` continues to work:

```tsx
// Old code - still works
<Input placeholder="Simple" />

// Enhanced version
<InputWrapper placeholder="Enhanced" clearable />
```

## Best Practices

1. **Always provide `onClear` with `clearable`**: Ensure state is properly reset
2. **Use `maxLength` with `showCounter`**: Counter requires max length
3. **Provide helpful `hint` text**: Guide users on expected input
4. **Keep error messages concise**: Single line preferred
5. **Use appropriate icons**: Match icon to input purpose
6. **Test keyboard navigation**: Ensure all interactive elements are accessible
7. **Validate on blur**: Don't show errors while user is typing

## Common Patterns

### Search Bar
```tsx
<InputWrapper
  leftIcon={<Search />}
  clearable
  placeholder="Search..."
  hint="Press / to focus"
/>
```

### Email Input
```tsx
<InputWrapper
  leftIcon={<Mail />}
  type="email"
  clearable
  error={emailError}
/>
```

### Name Field
```tsx
<InputWrapper
  leftIcon={<User />}
  maxLength={50}
  showCounter
  clearable
/>
```

## Troubleshooting

### Clear button not showing
- Ensure `clearable={true}` is set
- Check that input has a value
- Verify input is not disabled

### Character counter not visible
- Must set both `showCounter={true}` and `maxLength={number}`
- Counter only shows when both props are present

### Icons misaligned
- Ensure icon components have consistent size (`h-4 w-4`)
- Icons are automatically centered vertically

### Error state not showing
- Pass `error` prop with string message
- Empty string doesn't trigger error state
- Pass `undefined` to clear error

## Related Components

- `Input`: Base input component
- `Label`: Form label component
- `FormField`: Complete form field wrapper
- `Textarea`: Multi-line text input

## Changelog

### Version 1.0.0 (CBP-P4-005)
- Initial implementation with all features
- Full backward compatibility with base Input
- Comprehensive accessibility support
- Touch-optimized for mobile devices
