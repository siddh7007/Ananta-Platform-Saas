/**
 * SafeChip - MUI Chip with Color Validation
 *
 * ROOT CAUSE FIX: This component intercepts ALL Chip color props and
 * validates them BEFORE they reach MUI. This prevents the
 * "palette[t.color] is undefined" error.
 */

import React from 'react';
// Import directly from the internal MUI path to avoid alias loop
import MuiChip from '@mui/material/Chip';
import type { ChipProps as MuiChipProps } from '@mui/material/Chip';

// Valid MUI Chip color values - immutable and exported for other use
export const VALID_CHIP_COLORS = [
  'default',
  'primary',
  'secondary',
  'error',
  'info',
  'success',
  'warning',
] as const;

export type ValidChipColor = (typeof VALID_CHIP_COLORS)[number];

/**
 * Type guard for valid chip colors
 */
export function isValidChipColor(color: unknown): color is ValidChipColor {
  return (
    typeof color === 'string' &&
    VALID_CHIP_COLORS.includes(color as ValidChipColor)
  );
}

/**
 * Validates and sanitizes a chip color value.
 * Returns 'default' for any invalid input.
 *
 * @param color - The color value to validate (can be any type)
 * @param context - Optional context for debugging (e.g., chip label)
 * @returns A valid MUI chip color
 */
export function validateChipColor(
  color: unknown,
  context?: string
): ValidChipColor {
  // Handle undefined/null
  if (color === undefined || color === null) {
    return 'default';
  }

  // Valid color - pass through
  if (isValidChipColor(color)) {
    return color;
  }

  // Invalid color - log warning and return fallback
  const contextStr = context ? ` [context: ${context}]` : '';

  // Check if it's a HEX color (common mistake)
  if (typeof color === 'string' && color.startsWith('#')) {
    console.warn(
      `[SafeChip] HEX color "${color}" passed to color prop${contextStr}. ` +
      `Use sx={{ backgroundColor: '${color}' }} instead. Falling back to 'default'.`
    );
  } else {
    console.warn(
      `[SafeChip] Invalid color "${String(color)}" blocked${contextStr}. ` +
      `Valid: ${VALID_CHIP_COLORS.join(', ')}. Using 'default'.`
    );
  }

  return 'default';
}

/**
 * Extended ChipProps that allows any value for color (will be validated)
 */
export interface SafeChipProps extends Omit<MuiChipProps, 'color'> {
  /**
   * The color of the chip.
   * Accepts MUI standard colors: 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning'
   * Invalid values are automatically converted to 'default' with a console warning.
   */
  color?: MuiChipProps['color'] | string | undefined | null;
}

/**
 * SafeChip Component
 *
 * A drop-in replacement for MUI Chip that validates the color prop
 * before passing it to MUI, preventing palette errors.
 */
export const SafeChip = React.forwardRef<HTMLDivElement, SafeChipProps>(
  function SafeChip({ color, ...props }, ref) {
    // Validate color BEFORE passing to MUI
    const validatedColor = validateChipColor(
      color,
      props.label ? String(props.label) : undefined
    );

    return <MuiChip {...props} ref={ref} color={validatedColor} />;
  }
);

// Export as both named and default
export default SafeChip;

// Also export as Chip for easy migration
export { SafeChip as Chip };
