/**
 * Customer Portal - Configuration Index
 *
 * Central exports for all configuration modules
 */

// Design Token System (CBP-P4-001)
export {
  // Token objects
  tokens,
  colorTokens,
  typographyTokens,
  spacingTokens,
  borderRadiusTokens,
  shadowTokens,
  zIndexTokens,
  breakpointTokens,
  animationTokens,

  // Helper functions
  getToken,
  spacing,
  fontSize,
  getCssVar,
  zIndex,
  shadow,
  borderRadius,
  animationDuration,
  animationTiming,
  transition,
  mediaQuery,
  matchesBreakpoint,
  breakpoint,

  // Types
  type ColorTokens,
  type TypographyTokens,
  type SpacingTokens,
  type BorderRadiusTokens,
  type ShadowTokens,
  type ZIndexTokens,
  type BreakpointTokens,
  type AnimationTokens,
  type Tokens,
} from './design-tokens';

// Re-export existing config modules
export * from './auth';
export * from './env';
export * from './navigation';
