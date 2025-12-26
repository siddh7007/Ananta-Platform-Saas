/**
 * SafeChip Component
 *
 * A wrapper around MUI Chip that validates the color prop before passing it to MUI.
 * This prevents the "palette[t.color] is undefined" error that occurs when an invalid
 * color value is passed to MUI's Chip component.
 *
 * Usage:
 * 1. Replace `import { Chip } from '@mui/material'` with `import { SafeChip as Chip } from '../components/shared/SafeChip'`
 * 2. Or use SafeChip directly for components that need extra safety
 *
 * The component:
 * - Validates color values at render time
 * - Falls back to 'default' for invalid colors
 * - Logs warnings in development mode for invalid colors
 * - Preserves all other Chip props
 */

import React from 'react';
import { Chip, ChipProps } from '@mui/material';

// Valid MUI Chip color values
const VALID_CHIP_COLORS = [
  'default',
  'primary',
  'secondary',
  'error',
  'info',
  'success',
  'warning',
] as const;

type ValidChipColor = (typeof VALID_CHIP_COLORS)[number];

/**
 * Type guard to check if a value is a valid MUI chip color
 */
function isValidChipColor(color: unknown): color is ValidChipColor {
  return typeof color === 'string' && VALID_CHIP_COLORS.includes(color as ValidChipColor);
}

/**
 * Validates and returns a safe MUI chip color.
 * Returns the color if valid, 'default' otherwise.
 */
function validateChipColor(color: unknown, context?: string): ValidChipColor {
  if (isValidChipColor(color)) {
    return color;
  }

  // Only log in development mode to avoid production console spam
  if (process.env.NODE_ENV === 'development' || import.meta.env.DEV) {
    console.warn(
      `[SafeChip] Invalid color "${String(color)}" detected${context ? ` in: ${context}` : ''}. ` +
      `Valid colors: ${VALID_CHIP_COLORS.join(', ')}. Using 'default' as fallback.`
    );
  }

  return 'default';
}

/**
 * SafeChip props - extends ChipProps but allows any string for color
 * (which will be validated and converted to a valid color)
 */
export interface SafeChipProps extends Omit<ChipProps, 'color'> {
  color?: ChipProps['color'] | string;
  /** Optional context string for debugging (shown in console warnings) */
  debugContext?: string;
}

/**
 * SafeChip - MUI Chip with automatic color validation
 *
 * Prevents the "palette[t.color] is undefined" error by validating
 * the color prop before passing it to MUI's Chip component.
 */
export const SafeChip: React.FC<SafeChipProps> = ({
  color,
  debugContext,
  ...props
}) => {
  // Validate color at render time
  const validatedColor = validateChipColor(
    color,
    debugContext || (props.label ? String(props.label) : undefined)
  );

  return <Chip {...props} color={validatedColor} />;
};

// Default export for convenience
export default SafeChip;

// Re-export the validation utilities for use in other components
export { VALID_CHIP_COLORS, isValidChipColor, validateChipColor };
export type { ValidChipColor };
