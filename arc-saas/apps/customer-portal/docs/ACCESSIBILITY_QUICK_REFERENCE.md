# Accessibility Quick Reference

## Running Tests

```bash
# All accessibility tests
bun run test:e2e e2e/accessibility.spec.ts

# With UI
bun run test:e2e:ui e2e/accessibility.spec.ts

# Specific page
bun run test:e2e -g "Dashboard"
```

## Common Patterns

### Forms
```tsx
// Label association
<label htmlFor="email">Email</label>
<input id="email" type="email" />

// Error handling
<input aria-invalid="true" aria-describedby="error" />
<span id="error" role="alert">Invalid email</span>
```

### Buttons
```tsx
// Icon buttons
<button aria-label="Delete">
  <TrashIcon />
</button>
```

### Images
```tsx
// Meaningful
<img alt="Revenue chart showing growth" />

// Decorative
<img alt="" role="presentation" />
```

## WCAG Checklist

### Level AA (Target)
- [ ] Color contrast 4.5:1
- [ ] Focus visible
- [ ] Keyboard accessible
- [ ] Form labels
- [ ] Alt text
- [ ] Logical headings

## Tools
- axe-core (integrated)
- NVDA screen reader
- Contrast checker
