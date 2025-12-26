/**
 * Accessible Form Components
 * CBP-P1-001: Form Label Association & ARIA Roles
 */

import { useId, cloneElement, isValidElement, ReactElement, ReactNode, FormEvent } from 'react';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

// Hook for generating unique form field IDs
export function useFormFieldId(prefix?: string): string {
  const id = useId();
  return prefix ? `${prefix}-${id}` : `field-${id}`;
}

// Accessible Field Props
interface AccessibleFieldProps {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: ReactElement | ((props: { inputId: string; describedBy?: string }) => ReactNode);
  className?: string;
}

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
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  // Support render props for complex components (Select, etc.)
  const enhancedChild =
    typeof children === 'function'
      ? children({ inputId, describedBy })
      : isValidElement(children)
        ? cloneElement(children, {
            id: inputId,
            'aria-required': required ? 'true' : undefined,
            'aria-describedby': describedBy,
            'aria-invalid': error ? 'true' : undefined,
          } as Record<string, unknown>)
        : children;

  return (
    <div className={cn('space-y-2', className)}>
      <Label htmlFor={inputId}>
        {label}
        {required && (
          <span className="text-destructive ml-1" aria-hidden="true">
            *
          </span>
        )}
      </Label>
      {enhancedChild}
      {hint && !error && (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="text-xs text-destructive" aria-live="polite">
          {error}
        </p>
      )}
    </div>
  );
}

// Accessible Fieldset for grouped fields
interface AccessibleFieldsetProps {
  legend: string;
  children: ReactNode;
  className?: string;
}

export function AccessibleFieldset({ legend, children, className }: AccessibleFieldsetProps) {
  return (
    <fieldset className={cn('space-y-4', className)}>
      <legend className="text-sm font-medium mb-4">{legend}</legend>
      {children}
    </fieldset>
  );
}

// Accessible Form wrapper
interface AccessibleFormProps {
  children: ReactNode;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  ariaLabel?: string;
  ariaLabelledBy?: string;
  className?: string;
  isSubmitting?: boolean;
}

export function AccessibleForm({
  children,
  onSubmit,
  ariaLabel,
  ariaLabelledBy,
  className,
  isSubmitting,
}: AccessibleFormProps) {
  return (
    <form
      onSubmit={onSubmit}
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
      aria-busy={isSubmitting}
      className={className}
      noValidate
    >
      {children}
    </form>
  );
}
