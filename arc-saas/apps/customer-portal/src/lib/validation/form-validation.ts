/**
 * Form Validation Utilities
 * CBP-P1-009: Form Validation UX
 */

export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

export interface FieldValidation {
  required?: boolean | string;
  minLength?: { value: number; message?: string };
  maxLength?: { value: number; message?: string };
  pattern?: { value: RegExp; message?: string };
  custom?: (value: unknown) => ValidationResult;
}

// Common validation patterns
export const PATTERNS = {
  // More strict email validation following RFC 5322
  email: /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/,
  phone: /^\+?[\d\s-()]{10,}$/,
  url: /^https?:\/\/(?:www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()@:%_+.~#?&/=]*)$/,
  slug: /^[a-z0-9-]+$/,
  // UUID v4 specifically (as commonly used in the codebase)
  uuidv4: /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  // Any UUID version
  uuid: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
};

// Validate a single field
export function validateField(value: unknown, rules: FieldValidation): ValidationResult {
  // Handle null/undefined
  if (value === null || value === undefined) {
    if (rules.required) {
      return {
        isValid: false,
        error: typeof rules.required === 'string' ? rules.required : 'This field is required',
      };
    }
    return { isValid: true };
  }

  // Convert to string for string-based validations
  const stringValue = String(value).trim();

  // Required check
  if (rules.required && !stringValue) {
    return {
      isValid: false,
      error: typeof rules.required === 'string' ? rules.required : 'This field is required',
    };
  }

  // Skip other validations if empty and not required
  if (!stringValue && !rules.required) {
    return { isValid: true };
  }

  // Min length
  if (rules.minLength && stringValue.length < rules.minLength.value) {
    return {
      isValid: false,
      error: rules.minLength.message || `Must be at least ${rules.minLength.value} characters`,
    };
  }

  // Max length
  if (rules.maxLength && stringValue.length > rules.maxLength.value) {
    return {
      isValid: false,
      error: rules.maxLength.message || `Must be at most ${rules.maxLength.value} characters`,
    };
  }

  // Pattern
  if (rules.pattern && !rules.pattern.value.test(stringValue)) {
    return {
      isValid: false,
      error: rules.pattern.message || 'Invalid format',
    };
  }

  // Custom validation
  if (rules.custom) {
    return rules.custom(value);
  }

  return { isValid: true };
}

// Common validators
export const validators = {
  email: (value: string): ValidationResult => {
    if (!PATTERNS.email.test(value)) {
      return { isValid: false, error: 'Please enter a valid email address' };
    }
    return { isValid: true };
  },

  required: (message = 'This field is required') => (value: unknown): ValidationResult => {
    if (!value || (typeof value === 'string' && !value.trim())) {
      return { isValid: false, error: message };
    }
    return { isValid: true };
  },

  minLength: (min: number, message?: string) => (value: string): ValidationResult => {
    if (value.length < min) {
      return { isValid: false, error: message || `Must be at least ${min} characters` };
    }
    return { isValid: true };
  },

  maxLength: (max: number, message?: string) => (value: string): ValidationResult => {
    if (value.length > max) {
      return { isValid: false, error: message || `Must be at most ${max} characters` };
    }
    return { isValid: true };
  },

  pattern: (regex: RegExp, message: string) => (value: string): ValidationResult => {
    if (!regex.test(value)) {
      return { isValid: false, error: message };
    }
    return { isValid: true };
  },
};

// Debounced validation for real-time feedback
export function createDebouncedValidator(
  validator: (value: unknown) => ValidationResult,
  delay = 300
) {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const debouncedFn = (value: unknown, callback: (result: ValidationResult) => void): void => {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      callback(validator(value));
    }, delay);
  };

  // Cleanup function to prevent memory leaks
  debouncedFn.cancel = () => {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
      timeoutId = undefined;
    }
  };

  return debouncedFn;
}
