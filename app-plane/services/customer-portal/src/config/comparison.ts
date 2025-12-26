/**
 * Comparison Tray Configuration
 *
 * P1-2: Unlimited Comparison Tray - Removed hard-coded 5-item limit
 * Users can now compare as many components as they want.
 *
 * @module config/comparison
 */

/**
 * Maximum components for comparison display purposes.
 * Set to Infinity for truly unlimited comparisons.
 * Can be overridden per-organization if needed.
 */
export const COMPARISON_CONFIG = {
  /**
   * Maximum number of components that can be selected for comparison.
   * Infinity = no limit (P1-2 requirement)
   */
  maxComponents: Infinity,

  /**
   * Display limit for the collapsed tray view (chips).
   * Shows "N more" if components exceed this.
   */
  collapsedDisplayLimit: 6,

  /**
   * Minimum components required for a valid comparison.
   */
  minComponentsForComparison: 2,

  /**
   * Enable warning when comparing many components.
   * Performance may degrade with very large comparisons.
   */
  performanceWarningThreshold: 20,
} as const;

/**
 * Type-safe access to comparison limits
 */
export type ComparisonConfig = typeof COMPARISON_CONFIG;
