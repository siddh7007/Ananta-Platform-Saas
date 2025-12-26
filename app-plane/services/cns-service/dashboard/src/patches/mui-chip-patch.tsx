/**
 * MUI Chip Safe Wrapper
 *
 * This module exports a SafeChip component that validates colors BEFORE
 * passing them to MUI's Chip. Import this instead of @mui/material Chip.
 *
 * ROOT CAUSE: MUI Chip crashes with "palette[t.color] is undefined" when
 * it receives an invalid color. This wrapper validates colors at the
 * React component level, which runs BEFORE MUI tries to access the palette.
 */

import React from 'react';
import { Chip as MuiChip, ChipProps as MuiChipProps } from '@mui/material';

// Valid MUI Chip color values
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

export function isValidChipColor(color: unknown): color is ValidChipColor {
  return typeof color === 'string' && VALID_CHIP_COLORS.includes(color as ValidChipColor);
}

/**
 * Validates a chip color and returns a safe fallback if invalid.
 * Logs warnings in development for debugging.
 */
export function validateChipColor(
  color: unknown,
  context?: string
): ValidChipColor {
  if (color === undefined || color === null) {
    return 'default';
  }

  if (isValidChipColor(color)) {
    return color;
  }

  // Log the invalid color for debugging with stack trace
  const contextStr = context ? ` (context: ${context})` : '';
  console.warn(
    `[SafeChip] Invalid color "${String(color)}" blocked${contextStr}. ` +
    `Valid colors: ${VALID_CHIP_COLORS.join(', ')}. Using 'default'.`
  );

  // Log stack trace only in development for performance
  if (import.meta.env.DEV) {
    console.trace('[SafeChip] Stack trace for invalid color:');
  }

  return 'default';
}

// Extended props to allow any string for color (will be validated)
export interface SafeChipProps extends Omit<MuiChipProps, 'color'> {
  color?: MuiChipProps['color'] | string | undefined | null;
}

/**
 * SafeChip - Drop-in replacement for MUI Chip with color validation.
 *
 * Use this EVERYWHERE instead of importing Chip directly from @mui/material.
 */
export const SafeChip = React.forwardRef<HTMLDivElement, SafeChipProps>(
  function SafeChip({ color, ...props }, ref) {
    const validatedColor = validateChipColor(
      color,
      props.label ? String(props.label) : undefined
    );

    return <MuiChip {...props} ref={ref} color={validatedColor} />;
  }
);

// Default export for convenience
export default SafeChip;

// Also export as Chip for easy migration
export { SafeChip as Chip };
