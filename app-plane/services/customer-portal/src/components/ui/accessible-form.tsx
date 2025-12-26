/**
 * Accessible Form Components
 *
 * WCAG 2.1 AA compliant form components with proper label associations,
 * ARIA attributes, and keyboard navigation support.
 *
 * Usage:
 * ```tsx
 * <AccessibleField
 *   label="Email Address"
 *   required
 *   hint="We'll never share your email"
 *   error={errors.email}
 * >
 *   <TextField type="email" value={email} onChange={handleChange} />
 * </AccessibleField>
 * ```
 */

import React, { useId, cloneElement, isValidElement, ReactElement } from 'react';
import { Box, Typography } from '@mui/material';

interface AccessibleFieldProps {
  /** Label text for the field */
  label: string;
  /** Whether the field is required */
  required?: boolean;
  /** Hint text to help users */
  hint?: string;
  /** Error message to display */
  error?: string;
  /** The input element (TextField, Select, etc.) */
  children: ReactElement;
  /** Additional CSS class name */
  className?: string;
}

/**
 * AccessibleField Component
 *
 * Wraps form inputs with proper label association, ARIA attributes,
 * and accessible error handling.
 *
 * Features:
 * - Unique ID generation for label/input association
 * - aria-required for required fields
 * - aria-describedby linking hints and errors
 * - aria-invalid when validation fails
 * - Visual required indicator (*)
 * - Screen reader announcements for errors
 */
export function AccessibleField({
  label,
  required = false,
  hint,
  error,
  children,
  className,
}: AccessibleFieldProps) {
  const uniqueId = useId();
  const inputId = `field-${uniqueId}`;
  const hintId = hint ? `hint-${uniqueId}` : undefined;
  const errorId = error ? `error-${uniqueId}` : undefined;

  // Build describedby string from available IDs
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  // Clone the child input element with accessibility props
  const enhancedChild = isValidElement(children)
    ? cloneElement(children, {
        id: inputId,
        'aria-required': required ? 'true' : undefined,
        'aria-describedby': describedBy,
        'aria-invalid': error ? 'true' : undefined,
        error: !!error, // For Material-UI styling
      } as any)
    : children;

  return (
    <Box className={className} sx={{ mb: 2 }}>
      {/* Label with required indicator */}
      <Box
        component="label"
        htmlFor={inputId}
        sx={{
          display: 'block',
          mb: 0.5,
          fontSize: '0.875rem',
          fontWeight: 500,
          color: error ? 'error.main' : 'text.primary',
        }}
      >
        {label}
        {required && (
          <Typography
            component="span"
            sx={{ color: 'error.main', ml: 0.5 }}
            aria-hidden="true"
          >
            *
          </Typography>
        )}
      </Box>

      {/* Input field */}
      {enhancedChild}

      {/* Hint text */}
      {hint && !error && (
        <Typography
          id={hintId}
          variant="caption"
          sx={{ display: 'block', mt: 0.5, color: 'text.secondary' }}
        >
          {hint}
        </Typography>
      )}

      {/* Error message with aria-live for screen readers */}
      {error && (
        <Typography
          id={errorId}
          role="alert"
          variant="caption"
          sx={{
            display: 'block',
            mt: 0.5,
            color: 'error.main',
            fontWeight: 500,
          }}
          aria-live="polite"
        >
          {error}
        </Typography>
      )}
    </Box>
  );
}

interface AccessibleFieldsetProps {
  /** Legend text for the fieldset */
  legend: string;
  /** Child form fields */
  children: React.ReactNode;
  /** Additional CSS class name */
  className?: string;
  /** Optional description for the fieldset */
  description?: string;
}

/**
 * AccessibleFieldset Component
 *
 * Groups related form fields with proper semantic HTML and ARIA attributes.
 *
 * Use for:
 * - Grouping related inputs (e.g., address fields, contact info)
 * - Radio button groups
 * - Checkbox groups
 * - Multi-step form sections
 */
export function AccessibleFieldset({
  legend,
  children,
  className,
  description,
}: AccessibleFieldsetProps) {
  const uniqueId = useId();
  const descriptionId = description ? `fieldset-desc-${uniqueId}` : undefined;

  return (
    <Box
      component="fieldset"
      className={className}
      sx={{
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 1,
        p: 2,
        mb: 3,
      }}
      aria-describedby={descriptionId}
    >
      <Typography
        component="legend"
        sx={{
          fontSize: '1rem',
          fontWeight: 600,
          px: 1,
          mb: description ? 1 : 2,
        }}
      >
        {legend}
      </Typography>

      {description && (
        <Typography
          id={descriptionId}
          variant="body2"
          sx={{ mb: 2, color: 'text.secondary' }}
        >
          {description}
        </Typography>
      )}

      {children}
    </Box>
  );
}

interface AccessibleFormProps {
  /** Form title for screen readers */
  ariaLabel: string;
  /** Form submit handler */
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  /** Child form elements */
  children: React.ReactNode;
  /** Additional CSS class name */
  className?: string;
  /** Whether the form is currently submitting */
  isSubmitting?: boolean;
}

/**
 * AccessibleForm Component
 *
 * Root form wrapper with proper ARIA attributes and keyboard support.
 *
 * Features:
 * - aria-labelledby for form identification
 * - Prevents double submission when isSubmitting=true
 * - Keyboard accessible (Enter to submit)
 */
export function AccessibleForm({
  ariaLabel,
  onSubmit,
  children,
  className,
  isSubmitting = false,
}: AccessibleFormProps) {
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!isSubmitting) {
      onSubmit(e);
    }
  };

  return (
    <Box
      component="form"
      className={className}
      onSubmit={handleSubmit}
      aria-label={ariaLabel}
      noValidate // Use custom validation with accessible error messages
    >
      {children}
    </Box>
  );
}

/**
 * Helper function to generate unique IDs for form fields
 * Use when you need more control over ID generation
 */
export function useFormFieldId(fieldName: string): string {
  const uniqueId = useId();
  return `${fieldName}-${uniqueId}`;
}
