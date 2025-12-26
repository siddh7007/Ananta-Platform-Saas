/**
 * Safe MUI Component Imports
 *
 * This module re-exports MUI components with runtime safety patches.
 * Import Chip (and other components) from here instead of @mui/material
 * to prevent runtime errors from invalid props.
 *
 * Usage:
 * // Instead of:
 * import { Chip } from '@mui/material';
 *
 * // Use:
 * import { Chip } from '../components/mui-safe-imports';
 */

import React from 'react';
import { Chip as MuiChip, ChipProps as MuiChipProps } from '@mui/material';

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

function isValidChipColor(color: unknown): color is ValidChipColor {
  return typeof color === 'string' && VALID_CHIP_COLORS.includes(color as ValidChipColor);
}

/**
 * Safe Chip - MUI Chip with automatic color validation
 *
 * Prevents the "palette[t.color] is undefined" error by validating
 * the color prop before passing it to MUI's Chip component.
 */
export interface ChipProps extends Omit<MuiChipProps, 'color'> {
  color?: MuiChipProps['color'] | string;
}

export const Chip: React.FC<ChipProps> = ({ color, ...props }) => {
  // Validate color at render time
  let validatedColor: MuiChipProps['color'] = 'default';

  if (color === undefined || color === null) {
    validatedColor = 'default';
  } else if (isValidChipColor(color)) {
    validatedColor = color;
  } else {
    // Log invalid color for debugging
    console.warn(
      `[SafeChip] Invalid color "${String(color)}" detected. ` +
        `Label: "${props.label || 'unknown'}". ` +
        `Valid colors: ${VALID_CHIP_COLORS.join(', ')}. Using 'default'.`
    );
    validatedColor = 'default';
  }

  return <MuiChip {...props} color={validatedColor} />;
};

// Re-export everything else from MUI as-is
// This allows gradual migration
export * from '@mui/material';

// Override the Chip export
export { Chip };
export type { ChipProps };
