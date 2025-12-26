/**
 * Safe MUI Material Re-Exports
 *
 * This module re-exports everything from @mui/material but replaces
 * the Chip component with SafeChip.
 *
 * Used via Vite alias to intercept all @mui/material imports.
 */

// Re-export everything from @mui/material
export * from '@mui/material';

// Import SafeChip
import { SafeChip, ValidChipColor, VALID_CHIP_COLORS, isValidChipColor, validateChipColor } from './SafeChip';

// Override Chip export with SafeChip
export { SafeChip as Chip };

// Also export the validation utilities for direct use
export { ValidChipColor, VALID_CHIP_COLORS, isValidChipColor, validateChipColor };
