/**
 * Centralized MUI Chip Color Validation and Utilities
 *
 * This module provides type-safe chip color handling to prevent
 * MUI palette errors from invalid color values.
 *
 * @see THEME_SYSTEM.md for usage guidelines
 */

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

/**
 * Type guard to check if a value is a valid MUI chip color
 */
export function isValidChipColor(color: unknown): color is ValidChipColor {
  return typeof color === 'string' && VALID_CHIP_COLORS.includes(color as ValidChipColor);
}

/**
 * Validates and returns a safe MUI chip color.
 * Logs a warning to console if an invalid color is detected.
 *
 * @param color - The color value to validate
 * @param context - Description of where this color is used (for debugging)
 * @param fallback - The fallback color to use if invalid (default: 'default')
 * @returns A valid MUI chip color
 *
 * @example
 * // In a component
 * const chipColor = validateChipColor(component.status, 'ComponentCard status');
 * return <Chip color={chipColor} label="Status" />;
 */
export function validateChipColor(
  color: unknown,
  context: string,
  fallback: ValidChipColor = 'default'
): ValidChipColor {
  if (isValidChipColor(color)) {
    return color;
  }

  // Log detailed warning for debugging
  console.warn(
    `[ChipColor] Invalid color "${String(color)}" detected in: ${context}\n` +
      `  Valid colors: ${VALID_CHIP_COLORS.join(', ')}\n` +
      `  Using fallback: "${fallback}"\n` +
      `  Stack trace:`,
    new Error().stack
  );

  return fallback;
}

/**
 * Status to chip color mapping
 * Used for component status, BOM status, enrichment status etc.
 */
export const statusColorMap: Record<string, ValidChipColor> = {
  // Component/Quality status
  production: 'success',
  staging: 'warning',
  rejected: 'error',
  pending: 'default',

  // Enrichment status
  enriching: 'info',
  completed: 'success',
  failed: 'error',
  paused: 'warning',
  queued: 'info',
  processing: 'info',

  // Lifecycle status
  active: 'success',
  nrnd: 'warning',
  obsolete: 'error',
  eol: 'error',

  // Generic
  unknown: 'default',
  default: 'default',
};

/**
 * Get chip color from status string with validation
 *
 * @param status - The status value
 * @param context - Description for debugging
 * @returns A valid MUI chip color
 *
 * @example
 * const color = getStatusChipColor(component.enrichment_status, 'Component enrichment');
 */
export function getStatusChipColor(
  status: string | undefined | null,
  context: string
): ValidChipColor {
  if (!status) {
    console.debug(`[ChipColor] Empty status in: ${context}, using 'default'`);
    return 'default';
  }

  const normalizedStatus = status.toLowerCase().trim();
  const mappedColor = statusColorMap[normalizedStatus];

  if (mappedColor) {
    return mappedColor;
  }

  // Try partial matching for common patterns
  if (normalizedStatus.includes('success') || normalizedStatus.includes('complete')) {
    console.debug(`[ChipColor] Partial match for status "${status}" -> 'success' in: ${context}`);
    return 'success';
  }
  if (normalizedStatus.includes('error') || normalizedStatus.includes('fail')) {
    console.debug(`[ChipColor] Partial match for status "${status}" -> 'error' in: ${context}`);
    return 'error';
  }
  if (normalizedStatus.includes('warning') || normalizedStatus.includes('pending')) {
    console.debug(`[ChipColor] Partial match for status "${status}" -> 'warning' in: ${context}`);
    return 'warning';
  }
  if (normalizedStatus.includes('info') || normalizedStatus.includes('process')) {
    console.debug(`[ChipColor] Partial match for status "${status}" -> 'info' in: ${context}`);
    return 'info';
  }

  console.warn(
    `[ChipColor] Unknown status "${status}" in: ${context}\n` +
      `  Known statuses: ${Object.keys(statusColorMap).join(', ')}\n` +
      `  Using fallback: 'default'`
  );
  return 'default';
}

/**
 * Get chip color for quality score
 *
 * @param score - Quality score (0-100)
 * @param context - Description for debugging
 * @returns A valid MUI chip color
 */
export function getQualityScoreChipColor(
  score: number | undefined | null,
  context: string
): ValidChipColor {
  if (score === undefined || score === null) {
    console.debug(`[ChipColor] No quality score in: ${context}, using 'default'`);
    return 'default';
  }

  if (typeof score !== 'number' || isNaN(score)) {
    console.warn(`[ChipColor] Invalid quality score "${score}" in: ${context}, using 'default'`);
    return 'default';
  }

  if (score >= 95) return 'success';
  if (score >= 70) return 'warning';
  return 'error';
}

/**
 * Type-safe chip color config for status arrays
 */
export interface ChipColorConfig {
  key: string;
  label: string;
  color: ValidChipColor;
}

/**
 * Pre-defined status chip configs for common use cases
 */
export const STATUS_CHIP_CONFIGS = {
  componentStatus: [
    { key: 'all', label: 'All', color: 'default' as ValidChipColor },
    { key: 'production', label: 'Production', color: 'success' as ValidChipColor },
    { key: 'staging', label: 'Staging', color: 'warning' as ValidChipColor },
    { key: 'pending', label: 'Pending', color: 'info' as ValidChipColor },
    { key: 'rejected', label: 'Rejected', color: 'error' as ValidChipColor },
  ],
  enrichmentStatus: [
    { key: 'enriching', label: 'Enriching', color: 'info' as ValidChipColor },
    { key: 'completed', label: 'Completed', color: 'success' as ValidChipColor },
    { key: 'paused', label: 'Paused', color: 'warning' as ValidChipColor },
    { key: 'failed', label: 'Failed', color: 'error' as ValidChipColor },
    { key: 'pending', label: 'Pending', color: 'default' as ValidChipColor },
  ],
  bomStatus: [
    { key: 'enriching', label: 'Enriching', color: 'info' as ValidChipColor },
    { key: 'completed', label: 'Completed', color: 'success' as ValidChipColor },
    { key: 'paused', label: 'Paused', color: 'warning' as ValidChipColor },
    { key: 'failed', label: 'Failed', color: 'error' as ValidChipColor },
    { key: 'pending', label: 'Pending', color: 'default' as ValidChipColor },
  ],
} as const;

/**
 * Debug helper: Log all chip color usages in the current render
 * Call this in development to trace color issues
 */
export function debugChipColorUsage(
  color: unknown,
  component: string,
  props?: Record<string, unknown>
): void {
  if (process.env.NODE_ENV === 'development') {
    const isValid = isValidChipColor(color);
    console.log(
      `[ChipColor Debug] ${component}:\n` +
        `  Color: "${String(color)}"\n` +
        `  Valid: ${isValid}\n` +
        `  Props: ${JSON.stringify(props, null, 2)}`
    );
    if (!isValid) {
      console.trace('[ChipColor Debug] Stack trace for invalid color:');
    }
  }
}