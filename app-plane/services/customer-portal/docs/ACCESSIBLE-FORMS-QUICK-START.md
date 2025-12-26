# Accessible Forms Quick Start Guide

## 5-Minute Quick Reference

### Basic Pattern

```tsx
import { AccessibleField, AccessibleForm } from '@/components/ui';

function MyForm() {
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');

  return (
    <AccessibleForm
      ariaLabel="Contact form"
      onSubmit={handleSubmit}
      isSubmitting={isSubmitting}
    >
      <AccessibleField
        label="Email Address"
        required
        hint="We'll never share your email"
        error={emailError}
      >
        <TextField
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </AccessibleField>

      <Button type="submit" disabled={isSubmitting}>
        Submit
      </Button>
    </AccessibleForm>
  );
}
```

## Common Patterns

### Text Input
```tsx
<AccessibleField label="Name" required>
  <TextField value={name} onChange={(e) => setName(e.target.value)} />
</AccessibleField>
```

### Email with Validation
```tsx
<AccessibleField
  label="Email"
  required
  error={emailError}
>
  <TextField
    type="email"
    value={email}
    onChange={(e) => {
      setEmail(e.target.value);
      validateEmail(e.target.value);
    }}
  />
</AccessibleField>
```

### Select Dropdown
```tsx
<AccessibleField label="Role" required>
  <FormControl fullWidth>
    <Select
      value={role}
      onChange={(e) => setRole(e.target.value)}
    >
      <MenuItem value="admin">Admin</MenuItem>
      <MenuItem value="user">User</MenuItem>
    </Select>
  </FormControl>
</AccessibleField>
```

### Checkbox
```tsx
<FormControlLabel
  control={
    <Checkbox
      checked={agreed}
      onChange={(e) => setAgreed(e.target.checked)}
      aria-describedby="terms-hint"
    />
  }
  label="I agree to the terms"
/>
<Typography id="terms-hint" variant="caption">
  You must agree to continue
</Typography>
```

### File Upload
```tsx
<Box role="group" aria-labelledby="upload-label">
  <Typography id="upload-label" fontWeight={500}>
    Upload File
  </Typography>
  <input
    type="file"
    id="file-upload"
    onChange={handleFileChange}
    aria-describedby="file-hint"
  />
  <label htmlFor="file-upload">
    <Button component="span">Choose File</Button>
  </label>
  <Typography id="file-hint" variant="caption">
    Max 10MB, CSV or XLSX
  </Typography>
</Box>
```

### Search Input
```tsx
<TextField
  placeholder="Search..."
  value={query}
  onChange={(e) => setQuery(e.target.value)}
  inputProps={{
    'aria-label': 'Search items by name or description',
  }}
/>
```

## Do's and Don'ts

### ✅ DO

```tsx
// DO: Use AccessibleField for all inputs
<AccessibleField label="Email" required>
  <TextField type="email" />
</AccessibleField>

// DO: Add aria-label to inputs without visible labels
<TextField inputProps={{ 'aria-label': 'Search' }} />

// DO: Use aria-describedby for hints
<input aria-describedby="email-hint" />
<span id="email-hint">We'll never share your email</span>

// DO: Mark required fields
<AccessibleField label="Email" required>
  <TextField />
</AccessibleField>

// DO: Link errors to inputs
<AccessibleField label="Email" error="Invalid email">
  <TextField />
</AccessibleField>
```

### ❌ DON'T

```tsx
// DON'T: Use placeholder as sole label
<TextField placeholder="Email" />

// DON'T: Separate label and input without association
<span>Email</span>
<TextField />

// DON'T: Use color alone for errors
<TextField error /> {/* No error message! */}

// DON'T: Forget aria-label on icon-only buttons
<IconButton onClick={handleDelete}>
  <DeleteIcon />
</IconButton>

// DO THIS INSTEAD:
<IconButton onClick={handleDelete} aria-label="Delete item">
  <DeleteIcon />
</IconButton>
```

## Checklist

Before submitting a PR with form changes:

- [ ] All inputs have associated labels
- [ ] Required fields marked with `required` prop
- [ ] Error messages linked via `aria-describedby`
- [ ] Forms submit with Enter key
- [ ] Tab order is logical
- [ ] Icon-only buttons have `aria-label`
- [ ] Loading states have `aria-busy`
- [ ] Dynamic content has `aria-live`
- [ ] Tested with keyboard only
- [ ] Tested with screen reader (NVDA/VoiceOver)

## Testing Commands

```bash
# Run accessibility linter
npm run lint:a11y

# Run accessibility tests
npm run test:a11y

# Manual testing
1. Disconnect mouse
2. Use Tab to navigate
3. Use Enter to submit
4. Test with screen reader
```

## Need Help?

- See: `docs/ACCESSIBILITY.md` for full guide
- Ask in: #accessibility Slack channel
- Reference: [WCAG 2.1 Quick Reference](https://www.w3.org/WAI/WCAG21/quickref/)
