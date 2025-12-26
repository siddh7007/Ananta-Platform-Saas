# Accessibility Implementation Guide

## Overview

The Customer Portal implements WCAG 2.1 AA accessibility standards to ensure all users can effectively interact with forms and navigation, regardless of ability.

## Implemented Features

### 1. Form Label Associations (CBP-P1-001)

All form inputs have properly associated labels using `htmlFor` and `id` attributes:

```tsx
// GOOD - Accessible pattern
<AccessibleField label="Email Address" required>
  <TextField type="email" value={email} onChange={handleChange} />
</AccessibleField>

// BAD - Avoid this
<div>
  <span>Email</span>
  <TextField type="email" />
</div>
```

### 2. ARIA Attributes

#### Required Fields
- `aria-required="true"` on all required inputs
- Visual indicator (*) with `aria-hidden="true"` to prevent double announcement

#### Error Handling
- `aria-invalid="true"` when validation fails
- `aria-describedby` links error messages to inputs
- Error messages use `role="alert"` for screen reader announcements
- `aria-live="polite"` for dynamic error updates

#### Form Descriptions
- `aria-label` for forms without visible labels
- `aria-labelledby` for forms with visible headings
- `aria-describedby` for hint text and help content

### 3. Accessible Components

#### AccessibleField
Wraps form inputs with proper label associations and ARIA attributes:

```tsx
<AccessibleField
  label="Organization Name"
  required
  hint="The public name of your organization"
  error={errors.name}
>
  <TextField value={name} onChange={handleChange} />
</AccessibleField>
```

**Features:**
- Auto-generates unique IDs for label/input association
- Adds `aria-required` for required fields
- Links hint text via `aria-describedby`
- Links error messages via `aria-describedby`
- Sets `aria-invalid` when errors present
- Screen reader announcements for errors

#### AccessibleFieldset
Groups related form fields semantically:

```tsx
<AccessibleFieldset
  legend="Contact Information"
  description="Provide your organization's contact details"
>
  <AccessibleField label="Email">...</AccessibleField>
  <AccessibleField label="Phone">...</AccessibleField>
</AccessibleFieldset>
```

#### AccessibleForm
Root form wrapper with ARIA support:

```tsx
<AccessibleForm
  ariaLabel="User invitation form"
  onSubmit={handleSubmit}
  isSubmitting={isSubmitting}
>
  {/* Form fields */}
</AccessibleForm>
```

### 4. Keyboard Navigation

All interactive elements are keyboard accessible:

- **Tab**: Navigate between form fields
- **Enter**: Submit forms
- **Space**: Activate buttons and checkboxes
- **Arrow keys**: Navigate select dropdowns and radio groups
- **Escape**: Close modals and dialogs

### 5. Focus Management

- Visible focus indicators on all interactive elements
- Focus trapped in modals/dialogs
- Focus returned to trigger element when dialogs close
- Skip links for keyboard users (future enhancement)

### 6. Screen Reader Support

All forms tested with:
- **NVDA** (Windows)
- **JAWS** (Windows)
- **VoiceOver** (macOS/iOS)
- **TalkBack** (Android)

## Modified Components

### TeamManagement.tsx
**Location:** `src/pages/team/TeamManagement.tsx`

**Changes:**
- Invite form wrapped with `AccessibleForm`
- Email and Role fields use `AccessibleField`
- Search input has `aria-label`
- Table has `aria-labelledby`
- Dialog has `aria-labelledby` and `aria-describedby`
- Submit button has `aria-busy` during submission

**Testing:**
```bash
# Navigate with keyboard
Tab → Email field (announced: "Email Address, required, edit text")
Tab → Role dropdown (announced: "Role, required, combo box")
Tab → Send Invitation button
Enter → Submit form
```

### OrganizationSettings.tsx
**Location:** `src/pages/OrganizationSettings.tsx`

**Changes:**
- All text fields wrapped with `AccessibleField`
- Logo upload has proper `aria-describedby` for hints
- Email validation errors announced to screen readers
- Slug availability status announced via `aria-label` on icons
- All dialogs have proper ARIA attributes

**Testing:**
```bash
# Navigate organization profile form
Tab → Organization Name (announced: "Organization Name, required, edit text")
Tab → Organization Slug (announced: "Organization Slug, required, edit text")
# If slug taken: "Organization Slug, required, invalid, edit text. Error: This slug is already taken"
```

### KeycloakLogin.tsx
**Location:** `src/lib/keycloak/KeycloakLogin.tsx`

**Changes:**
- Main content has `role="main"`
- Login heading has proper `h1` hierarchy
- Loading state has `role="status"` and `aria-live="polite"`
- Error state has `role="alert"` and `aria-live="assertive"`
- Sign-in button has descriptive `aria-label`

### BOMUploadWorkflow.tsx
**Location:** `src/bom/BOMUploadWorkflow.tsx`

**Changes:**
- File upload form has `aria-label`
- Progress indicators have `aria-live` regions
- Status updates announced to screen readers
- Column mapping fields have proper labels

## Testing Checklist

Use this checklist to verify accessibility compliance:

### Keyboard Navigation
- [ ] All form inputs reachable via Tab
- [ ] Tab order is logical (top to bottom, left to right)
- [ ] Enter submits forms
- [ ] Escape closes dialogs
- [ ] Focus visible on all interactive elements

### Screen Readers
- [ ] Form labels announced correctly
- [ ] Required fields announced as "required"
- [ ] Error messages announced when validation fails
- [ ] Hint text announced via describedby
- [ ] Form submission status announced

### Visual
- [ ] Required fields have visual indicator (*)
- [ ] Error messages visible and color is not sole indicator
- [ ] Focus indicators have 3:1 contrast ratio
- [ ] Form labels are visible (not placeholder-only)

### Validation
- [ ] Client-side validation with accessible error messages
- [ ] Errors linked to inputs via aria-describedby
- [ ] Form doesn't submit with invalid data
- [ ] Error summary at top of form (future enhancement)

## Common Patterns

### Email Field with Validation
```tsx
<AccessibleField
  label="Email Address"
  required
  hint="We'll use this for account notifications"
  error={emailError}
>
  <TextField
    type="email"
    value={email}
    onChange={(e) => {
      setEmail(e.target.value);
      validateEmail(e.target.value);
    }}
    inputProps={{
      'aria-label': 'Email address',
    }}
  />
</AccessibleField>
```

### Select Dropdown
```tsx
<AccessibleField
  label="Role"
  required
  hint="Select the user's role in your organization"
>
  <FormControl fullWidth>
    <Select
      value={role}
      onChange={(e) => setRole(e.target.value)}
      aria-label="Select user role"
    >
      <MenuItem value="admin">Admin</MenuItem>
      <MenuItem value="engineer">Engineer</MenuItem>
      <MenuItem value="analyst">Analyst</MenuItem>
    </Select>
  </FormControl>
</AccessibleField>
```

### File Upload
```tsx
<Box role="group" aria-labelledby="file-upload-label">
  <Typography id="file-upload-label" fontWeight={500}>
    Upload BOM File
  </Typography>
  <input
    type="file"
    id="bom-upload"
    onChange={handleFileChange}
    aria-describedby="file-upload-hint"
  />
  <label htmlFor="bom-upload">
    <Button component="span" aria-label="Choose file to upload">
      Choose File
    </Button>
  </label>
  <Typography id="file-upload-hint" variant="caption">
    Accepted formats: CSV, XLSX, XLS (max 10MB)
  </Typography>
</Box>
```

### Search Input
```tsx
<TextField
  placeholder="Search team members..."
  value={searchQuery}
  onChange={(e) => setSearchQuery(e.target.value)}
  inputProps={{
    'aria-label': 'Search team members by name, email, or role',
  }}
  InputProps={{
    startAdornment: <SearchIcon aria-hidden="true" />
  }}
/>
```

### Loading States
```tsx
<Box role="status" aria-live="polite">
  {isLoading && (
    <>
      <CircularProgress aria-hidden="true" />
      <Typography>Loading...</Typography>
    </>
  )}
</Box>
```

### Error Alerts
```tsx
<Box aria-live="polite" aria-atomic="true">
  {error && (
    <Alert severity="error" role="alert">
      {error}
    </Alert>
  )}
</Box>
```

## Browser & AT Support

### Tested Combinations
| Browser | Screen Reader | Status |
|---------|---------------|--------|
| Chrome | NVDA | ✅ Pass |
| Firefox | NVDA | ✅ Pass |
| Edge | JAWS | ✅ Pass |
| Safari | VoiceOver | ✅ Pass |
| Chrome | ChromeVox | ✅ Pass |

### Known Issues
None at this time.

## Future Enhancements

1. **Error Summary**: Add form-level error summary at top when validation fails
2. **Skip Links**: Add "Skip to main content" link for keyboard users
3. **Live Region Announcer**: Centralized service for toast notifications
4. **Focus Trap Component**: Reusable dialog focus trap
5. **Autocomplete**: ARIA 1.2 combobox pattern for search/autocomplete
6. **Tooltips**: ARIA 1.2 compliant tooltip component
7. **Progress Indicators**: Enhanced progress bar announcements

## Resources

- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [ARIA Authoring Practices Guide](https://www.w3.org/WAI/ARIA/apg/)
- [Material-UI Accessibility](https://mui.com/material-ui/guides/accessibility/)
- [WebAIM Articles](https://webaim.org/articles/)

## Support

For accessibility questions or issues:
- Email: accessibility@example.com
- Slack: #accessibility
- JIRA: Create ticket with label `accessibility`
