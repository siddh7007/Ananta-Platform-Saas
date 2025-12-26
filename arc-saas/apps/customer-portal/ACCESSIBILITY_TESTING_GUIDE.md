# Accessibility Testing Guide - Customer Portal

## Overview

Comprehensive accessibility testing using axe-core for WCAG 2.1 AA compliance.

## Quick Start

### Run Automated Tests

```bash
cd arc-saas/apps/customer-portal

# Run all accessibility tests
bun run test:e2e e2e/accessibility.spec.ts

# Run with UI mode
bun run test:e2e:ui e2e/accessibility.spec.ts

# Generate HTML report
bun run test:e2e e2e/accessibility.spec.ts --reporter=html
bun run test:e2e:report
```

### Development Mode

The AccessibilityChecker component runs automatically in development:

```bash
bun run dev
```

Open browser console to see violations logged in real-time.

## Test Coverage

### Pages Tested
- Dashboard
- BOM List
- BOM Upload wizard
- Component Search
- Team Management
- Settings
- Portfolio

### Standards Checked
- WCAG 2.0 Level A
- WCAG 2.0 Level AA
- WCAG 2.1 Level A
- WCAG 2.1 Level AA

### Rules Validated
- Color contrast (4.5:1 for text)
- Form labels
- Button names
- Image alt text
- ARIA attributes
- Heading hierarchy
- Keyboard navigation
- Screen reader compatibility

## Manual Testing Checklist

### Keyboard Navigation
- Tab through all interactive elements
- Shift+Tab to navigate backwards
- Enter activates buttons/links
- Space toggles checkboxes
- Escape closes modals
- Focus is always visible

### Screen Readers
- NVDA (Windows, free)
- JAWS (Windows, trial)
- VoiceOver (macOS, built-in)

## Common Fixes

### Missing Labels
```tsx
// Good
<label htmlFor="email">Email</label>
<input id="email" type="text" />
```

### Button Names
```tsx
// Good
<button aria-label="Delete item">
  <TrashIcon />
</button>
```

### Color Contrast
Use contrast checker: https://webaim.org/resources/contrastchecker/
Minimum 4.5:1 for normal text, 3:1 for large text.

## Resources
- WCAG 2.1: https://www.w3.org/WAI/WCAG21/quickref/
- axe-core: https://github.com/dequelabs/axe-core
- NVDA: https://www.nvaccess.org/
