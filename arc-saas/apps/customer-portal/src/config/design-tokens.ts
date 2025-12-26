/**
 * Design Token System for Customer Portal
 *
 * Centralized design tokens compatible with Tailwind CSS and shadcn/ui.
 * Provides TypeScript constants and helper functions for consistent design.
 *
 * Usage:
 * ```typescript
 * import { tokens, getToken, spacing, fontSize } from '@/config/design-tokens';
 *
 * // Access token values
 * const primaryColor = tokens.color.brand.primary.value;
 *
 * // Use helper functions
 * const padding = spacing(4); // '1rem'
 * const size = fontSize('lg'); // { fontSize: '1.125rem', lineHeight: '1.75rem' }
 * ```
 */

// =============================================================================
// COLOR TOKENS
// =============================================================================

export const colorTokens = {
  brand: {
    primary: {
      value: 'hsl(221.2 83.2% 53.3%)',
      css: '--primary',
      description: 'Primary brand color for main actions and highlights',
    },
    primaryForeground: {
      value: 'hsl(210 40% 98%)',
      css: '--primary-foreground',
      description: 'Text color on primary backgrounds',
    },
    secondary: {
      value: 'hsl(210 40% 96.1%)',
      css: '--secondary',
      description: 'Secondary brand color for supporting elements',
    },
    secondaryForeground: {
      value: 'hsl(222.2 47.4% 11.2%)',
      css: '--secondary-foreground',
      description: 'Text color on secondary backgrounds',
    },
  },
  semantic: {
    success: {
      value: 'hsl(142.1 76.2% 36.3%)',
      css: '--success',
      description: 'Success state color (green)',
    },
    successForeground: {
      value: 'hsl(355.7 100% 97.3%)',
      css: '--success-foreground',
      description: 'Text color on success backgrounds',
    },
    warning: {
      value: 'hsl(38 92% 50%)',
      css: '--warning',
      description: 'Warning state color (amber)',
    },
    warningForeground: {
      value: 'hsl(48 96% 89%)',
      css: '--warning-foreground',
      description: 'Text color on warning backgrounds',
    },
    error: {
      value: 'hsl(0 84.2% 60.2%)',
      css: '--destructive',
      description: 'Error/destructive state color (red)',
    },
    errorForeground: {
      value: 'hsl(210 40% 98%)',
      css: '--destructive-foreground',
      description: 'Text color on error backgrounds',
    },
    info: {
      value: 'hsl(199 89% 48%)',
      css: '--info',
      description: 'Informational state color (blue)',
    },
    infoForeground: {
      value: 'hsl(0 0% 100%)',
      css: '--info-foreground',
      description: 'Text color on info backgrounds',
    },
  },
  neutral: {
    background: {
      value: 'hsl(0 0% 100%)',
      css: '--background',
      description: 'Main background color',
    },
    foreground: {
      value: 'hsl(222.2 84% 4.9%)',
      css: '--foreground',
      description: 'Main text color',
    },
    muted: {
      value: 'hsl(210 40% 96.1%)',
      css: '--muted',
      description: 'Muted background color',
    },
    mutedForeground: {
      value: 'hsl(215.4 16.3% 46.9%)',
      css: '--muted-foreground',
      description: 'Muted text color',
    },
    accent: {
      value: 'hsl(210 40% 96.1%)',
      css: '--accent',
      description: 'Accent background color',
    },
    accentForeground: {
      value: 'hsl(222.2 47.4% 11.2%)',
      css: '--accent-foreground',
      description: 'Accent text color',
    },
  },
  ui: {
    border: {
      value: 'hsl(214.3 31.8% 91.4%)',
      css: '--border',
      description: 'Default border color',
    },
    input: {
      value: 'hsl(214.3 31.8% 91.4%)',
      css: '--input',
      description: 'Input field border color',
    },
    ring: {
      value: 'hsl(221.2 83.2% 53.3%)',
      css: '--ring',
      description: 'Focus ring color',
    },
    card: {
      value: 'hsl(0 0% 100%)',
      css: '--card',
      description: 'Card background color',
    },
    cardForeground: {
      value: 'hsl(222.2 84% 4.9%)',
      css: '--card-foreground',
      description: 'Card text color',
    },
    popover: {
      value: 'hsl(0 0% 100%)',
      css: '--popover',
      description: 'Popover background color',
    },
    popoverForeground: {
      value: 'hsl(222.2 84% 4.9%)',
      css: '--popover-foreground',
      description: 'Popover text color',
    },
  },
  sidebar: {
    background: {
      value: 'hsl(0 0% 98%)',
      css: '--sidebar-background',
      description: 'Sidebar background color',
    },
    foreground: {
      value: 'hsl(240 5.3% 26.1%)',
      css: '--sidebar-foreground',
      description: 'Sidebar text color',
    },
    primary: {
      value: 'hsl(240 5.9% 10%)',
      css: '--sidebar-primary',
      description: 'Sidebar primary color',
    },
    primaryForeground: {
      value: 'hsl(0 0% 98%)',
      css: '--sidebar-primary-foreground',
      description: 'Sidebar primary text color',
    },
    accent: {
      value: 'hsl(240 4.8% 95.9%)',
      css: '--sidebar-accent',
      description: 'Sidebar accent background',
    },
    accentForeground: {
      value: 'hsl(240 5.9% 10%)',
      css: '--sidebar-accent-foreground',
      description: 'Sidebar accent text color',
    },
    border: {
      value: 'hsl(220 13% 91%)',
      css: '--sidebar-border',
      description: 'Sidebar border color',
    },
    ring: {
      value: 'hsl(217.2 91.2% 59.8%)',
      css: '--sidebar-ring',
      description: 'Sidebar focus ring color',
    },
  },
} as const;

// =============================================================================
// TYPOGRAPHY TOKENS
// =============================================================================

export const typographyTokens = {
  fontFamily: {
    sans: {
      value: [
        'ui-sans-serif',
        'system-ui',
        '-apple-system',
        'BlinkMacSystemFont',
        '"Segoe UI"',
        'Roboto',
        '"Helvetica Neue"',
        'Arial',
        'sans-serif',
      ],
      css: 'font-family',
      description: 'Default sans-serif font stack',
    },
    mono: {
      value: [
        'ui-monospace',
        'SFMono-Regular',
        '"SF Mono"',
        'Menlo',
        'Consolas',
        '"Liberation Mono"',
        'monospace',
      ],
      css: 'font-family',
      description: 'Monospace font stack for code',
    },
  },
  fontSize: {
    xs: {
      value: '0.75rem',
      lineHeight: '1rem',
      description: '12px - Extra small text',
    },
    sm: {
      value: '0.875rem',
      lineHeight: '1.25rem',
      description: '14px - Small text',
    },
    base: {
      value: '1rem',
      lineHeight: '1.5rem',
      description: '16px - Base text size',
    },
    lg: {
      value: '1.125rem',
      lineHeight: '1.75rem',
      description: '18px - Large text',
    },
    xl: {
      value: '1.25rem',
      lineHeight: '1.75rem',
      description: '20px - Extra large text',
    },
    '2xl': {
      value: '1.5rem',
      lineHeight: '2rem',
      description: '24px - Heading level 3',
    },
    '3xl': {
      value: '1.875rem',
      lineHeight: '2.25rem',
      description: '30px - Heading level 2',
    },
    '4xl': {
      value: '2.25rem',
      lineHeight: '2.5rem',
      description: '36px - Heading level 1',
    },
    '5xl': {
      value: '3rem',
      lineHeight: '1',
      description: '48px - Display heading',
    },
    '6xl': {
      value: '3.75rem',
      lineHeight: '1',
      description: '60px - Large display heading',
    },
  },
  fontWeight: {
    thin: {
      value: '100',
      description: 'Thin font weight',
    },
    extralight: {
      value: '200',
      description: 'Extra light font weight',
    },
    light: {
      value: '300',
      description: 'Light font weight',
    },
    normal: {
      value: '400',
      description: 'Normal/regular font weight',
    },
    medium: {
      value: '500',
      description: 'Medium font weight',
    },
    semibold: {
      value: '600',
      description: 'Semibold font weight',
    },
    bold: {
      value: '700',
      description: 'Bold font weight',
    },
    extrabold: {
      value: '800',
      description: 'Extra bold font weight',
    },
    black: {
      value: '900',
      description: 'Black font weight',
    },
  },
  lineHeight: {
    none: {
      value: '1',
      description: 'Line height 1',
    },
    tight: {
      value: '1.25',
      description: 'Tight line height',
    },
    snug: {
      value: '1.375',
      description: 'Snug line height',
    },
    normal: {
      value: '1.5',
      description: 'Normal line height',
    },
    relaxed: {
      value: '1.625',
      description: 'Relaxed line height',
    },
    loose: {
      value: '2',
      description: 'Loose line height',
    },
  },
} as const;

// =============================================================================
// SPACING TOKENS
// =============================================================================

export const spacingTokens = {
  0: {
    value: '0',
    description: 'No spacing',
  },
  px: {
    value: '1px',
    description: '1 pixel',
  },
  0.5: {
    value: '0.125rem',
    description: '2px',
  },
  1: {
    value: '0.25rem',
    description: '4px',
  },
  1.5: {
    value: '0.375rem',
    description: '6px',
  },
  2: {
    value: '0.5rem',
    description: '8px',
  },
  2.5: {
    value: '0.625rem',
    description: '10px',
  },
  3: {
    value: '0.75rem',
    description: '12px',
  },
  3.5: {
    value: '0.875rem',
    description: '14px',
  },
  4: {
    value: '1rem',
    description: '16px',
  },
  5: {
    value: '1.25rem',
    description: '20px',
  },
  6: {
    value: '1.5rem',
    description: '24px',
  },
  7: {
    value: '1.75rem',
    description: '28px',
  },
  8: {
    value: '2rem',
    description: '32px',
  },
  9: {
    value: '2.25rem',
    description: '36px',
  },
  10: {
    value: '2.5rem',
    description: '40px',
  },
  11: {
    value: '2.75rem',
    description: '44px',
  },
  12: {
    value: '3rem',
    description: '48px',
  },
  14: {
    value: '3.5rem',
    description: '56px',
  },
  16: {
    value: '4rem',
    description: '64px',
  },
  20: {
    value: '5rem',
    description: '80px',
  },
  24: {
    value: '6rem',
    description: '96px',
  },
  28: {
    value: '7rem',
    description: '112px',
  },
  32: {
    value: '8rem',
    description: '128px',
  },
  36: {
    value: '9rem',
    description: '144px',
  },
  40: {
    value: '10rem',
    description: '160px',
  },
  44: {
    value: '11rem',
    description: '176px',
  },
  48: {
    value: '12rem',
    description: '192px',
  },
  52: {
    value: '13rem',
    description: '208px',
  },
  56: {
    value: '14rem',
    description: '224px',
  },
  60: {
    value: '15rem',
    description: '240px',
  },
  64: {
    value: '16rem',
    description: '256px',
  },
  72: {
    value: '18rem',
    description: '288px',
  },
  80: {
    value: '20rem',
    description: '320px',
  },
  96: {
    value: '24rem',
    description: '384px',
  },
} as const;

// =============================================================================
// BORDER RADIUS TOKENS
// =============================================================================

export const borderRadiusTokens = {
  none: {
    value: '0',
    description: 'No border radius',
  },
  sm: {
    value: 'calc(var(--radius) - 4px)',
    fallback: '0.125rem',
    description: 'Small border radius (2px)',
  },
  base: {
    value: 'calc(var(--radius) - 2px)',
    fallback: '0.25rem',
    description: 'Base border radius (4px)',
  },
  md: {
    value: 'calc(var(--radius) - 2px)',
    fallback: '0.375rem',
    description: 'Medium border radius (6px)',
  },
  lg: {
    value: 'var(--radius)',
    fallback: '0.5rem',
    description: 'Large border radius (8px)',
  },
  xl: {
    value: '0.75rem',
    description: 'Extra large border radius (12px)',
  },
  '2xl': {
    value: '1rem',
    description: '2X large border radius (16px)',
  },
  '3xl': {
    value: '1.5rem',
    description: '3X large border radius (24px)',
  },
  full: {
    value: '9999px',
    description: 'Fully rounded (pill shape)',
  },
} as const;

// =============================================================================
// SHADOW TOKENS
// =============================================================================

export const shadowTokens = {
  xs: {
    value: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
    description: 'Extra small shadow',
  },
  sm: {
    value: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
    description: 'Small shadow',
  },
  base: {
    value: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
    description: 'Base shadow',
  },
  md: {
    value: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
    description: 'Medium shadow',
  },
  lg: {
    value: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
    description: 'Large shadow',
  },
  xl: {
    value: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
    description: 'Extra large shadow',
  },
  '2xl': {
    value: '0 25px 50px -12px rgb(0 0 0 / 0.25)',
    description: '2X large shadow',
  },
  inner: {
    value: 'inset 0 2px 4px 0 rgb(0 0 0 / 0.05)',
    description: 'Inner shadow',
  },
  none: {
    value: '0 0 #0000',
    description: 'No shadow',
  },
  // Semantic shadows
  primary: {
    value: 'var(--shadow-primary, 0 4px 14px 0 rgb(59 130 246 / 0.15))',
    description: 'Primary colored shadow',
  },
  success: {
    value: 'var(--shadow-success, 0 4px 14px 0 rgb(34 197 94 / 0.15))',
    description: 'Success colored shadow',
  },
  warning: {
    value: 'var(--shadow-warning, 0 4px 14px 0 rgb(251 146 60 / 0.15))',
    description: 'Warning colored shadow',
  },
  error: {
    value: 'var(--shadow-error, 0 4px 14px 0 rgb(239 68 68 / 0.15))',
    description: 'Error colored shadow',
  },
  hover: {
    value: 'var(--shadow-hover, 0 8px 24px 0 rgb(0 0 0 / 0.12))',
    description: 'Hover state shadow',
  },
  focus: {
    value: 'var(--shadow-focus, 0 0 0 3px rgb(59 130 246 / 0.2))',
    description: 'Focus state shadow',
  },
} as const;

// =============================================================================
// Z-INDEX TOKENS
// =============================================================================

export const zIndexTokens = {
  base: {
    value: 0,
    description: 'Base z-index',
  },
  dropdown: {
    value: 1000,
    description: 'Dropdown menus',
  },
  sticky: {
    value: 1020,
    description: 'Sticky elements',
  },
  fixed: {
    value: 1030,
    description: 'Fixed position elements',
  },
  modalBackdrop: {
    value: 1040,
    description: 'Modal backdrop',
  },
  modal: {
    value: 1050,
    description: 'Modal dialogs',
  },
  popover: {
    value: 1060,
    description: 'Popovers',
  },
  tooltip: {
    value: 1070,
    description: 'Tooltips',
  },
  toast: {
    value: 1080,
    description: 'Toast notifications',
  },
  max: {
    value: 9999,
    description: 'Maximum z-index',
  },
} as const;

// =============================================================================
// BREAKPOINT TOKENS
// =============================================================================

export const breakpointTokens = {
  xs: {
    value: '475px',
    min: 475,
    description: 'Extra small devices (mobile)',
  },
  sm: {
    value: '640px',
    min: 640,
    description: 'Small devices (large phones)',
  },
  md: {
    value: '768px',
    min: 768,
    description: 'Medium devices (tablets)',
  },
  lg: {
    value: '1024px',
    min: 1024,
    description: 'Large devices (desktops)',
  },
  xl: {
    value: '1280px',
    min: 1280,
    description: 'Extra large devices (large desktops)',
  },
  '2xl': {
    value: '1536px',
    min: 1536,
    description: '2X large devices (ultra-wide)',
  },
} as const;

// =============================================================================
// ANIMATION TOKENS
// =============================================================================

export const animationTokens = {
  duration: {
    instant: {
      value: '0ms',
      description: 'Instant (no animation)',
    },
    fast: {
      value: '150ms',
      description: 'Fast animation',
    },
    normal: {
      value: '300ms',
      description: 'Normal animation speed',
    },
    slow: {
      value: '500ms',
      description: 'Slow animation',
    },
    slower: {
      value: '700ms',
      description: 'Slower animation',
    },
    slowest: {
      value: '1000ms',
      description: 'Slowest animation',
    },
  },
  timing: {
    linear: {
      value: 'linear',
      description: 'Linear timing function',
    },
    ease: {
      value: 'ease',
      description: 'Default ease timing',
    },
    easeIn: {
      value: 'ease-in',
      description: 'Ease in timing',
    },
    easeOut: {
      value: 'ease-out',
      description: 'Ease out timing',
    },
    easeInOut: {
      value: 'ease-in-out',
      description: 'Ease in-out timing',
    },
    spring: {
      value: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
      description: 'Spring-like animation',
    },
    bounce: {
      value: 'cubic-bezier(0.68, -0.55, 0.27, 1.55)',
      description: 'Bounce animation',
    },
  },
} as const;

// =============================================================================
// COMBINED TOKENS OBJECT
// =============================================================================

export const tokens = {
  color: colorTokens,
  typography: typographyTokens,
  spacing: spacingTokens,
  borderRadius: borderRadiusTokens,
  shadow: shadowTokens,
  zIndex: zIndexTokens,
  breakpoint: breakpointTokens,
  animation: animationTokens,
} as const;

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

export type ColorTokens = typeof colorTokens;
export type TypographyTokens = typeof typographyTokens;
export type SpacingTokens = typeof spacingTokens;
export type BorderRadiusTokens = typeof borderRadiusTokens;
export type ShadowTokens = typeof shadowTokens;
export type ZIndexTokens = typeof zIndexTokens;
export type BreakpointTokens = typeof breakpointTokens;
export type AnimationTokens = typeof animationTokens;
export type Tokens = typeof tokens;

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get a token value by dot notation path
 *
 * @example
 * getToken('color.brand.primary.value') // 'hsl(221.2 83.2% 53.3%)'
 * getToken('spacing.4.value') // '1rem'
 */
export function getToken(path: string): string | number | string[] | undefined {
  const parts = path.split('.');
  let current: any = tokens;

  for (const part of parts) {
    if (current && typeof current === 'object' && part in current) {
      current = current[part];
    } else {
      return undefined;
    }
  }

  return current;
}

/**
 * Get spacing value by numeric key
 *
 * @example
 * spacing(4) // '1rem'
 * spacing(8) // '2rem'
 * spacing(0.5) // '0.125rem'
 */
export function spacing(value: keyof SpacingTokens): string {
  const token = spacingTokens[value];
  return token?.value || '0';
}

/**
 * Get font size with line height
 *
 * @example
 * fontSize('base') // { fontSize: '1rem', lineHeight: '1.5rem' }
 * fontSize('lg') // { fontSize: '1.125rem', lineHeight: '1.75rem' }
 */
export function fontSize(
  size: keyof TypographyTokens['fontSize']
): { fontSize: string; lineHeight: string } {
  const token = typographyTokens.fontSize[size];
  return {
    fontSize: token.value,
    lineHeight: token.lineHeight,
  };
}

/**
 * Get CSS custom property reference
 *
 * @example
 * getCssVar('color.brand.primary') // 'hsl(var(--primary))'
 * getCssVar('color.semantic.success') // 'hsl(var(--success))'
 */
export function getCssVar(path: string): string {
  const parts = path.split('.');
  let current: any = tokens;

  for (const part of parts) {
    if (current && typeof current === 'object' && part in current) {
      current = current[part];
    } else {
      return '';
    }
  }

  if (current && typeof current === 'object' && 'css' in current) {
    // Most colors use HSL format
    if (path.startsWith('color.')) {
      return `hsl(var(${current.css}))`;
    }
    return `var(${current.css})`;
  }

  return '';
}

/**
 * Get z-index value
 *
 * @example
 * zIndex('modal') // 1050
 * zIndex('tooltip') // 1070
 */
export function zIndex(level: keyof ZIndexTokens): number {
  return zIndexTokens[level]?.value || 0;
}

/**
 * Get breakpoint value
 *
 * @example
 * breakpoint('md') // '768px'
 * breakpoint('lg') // '1024px'
 */
export function breakpoint(size: keyof BreakpointTokens): string {
  return breakpointTokens[size]?.value || '0px';
}

/**
 * Get shadow value
 *
 * @example
 * shadow('md') // '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)'
 * shadow('primary') // 'var(--shadow-primary, 0 4px 14px 0 rgb(59 130 246 / 0.15))'
 */
export function shadow(size: keyof ShadowTokens): string {
  return shadowTokens[size]?.value || 'none';
}

/**
 * Get border radius value
 *
 * @example
 * borderRadius('md') // 'calc(var(--radius) - 2px)'
 * borderRadius('full') // '9999px'
 */
export function borderRadius(size: keyof BorderRadiusTokens): string {
  const token = borderRadiusTokens[size];
  return token?.value || '0';
}

/**
 * Get animation duration
 *
 * @example
 * animationDuration('fast') // '150ms'
 * animationDuration('normal') // '300ms'
 */
export function animationDuration(
  speed: keyof AnimationTokens['duration']
): string {
  return animationTokens.duration[speed]?.value || '0ms';
}

/**
 * Get animation timing function
 *
 * @example
 * animationTiming('easeInOut') // 'ease-in-out'
 * animationTiming('spring') // 'cubic-bezier(0.68, -0.55, 0.265, 1.55)'
 */
export function animationTiming(
  timing: keyof AnimationTokens['timing']
): string {
  return animationTokens.timing[timing]?.value || 'ease';
}

/**
 * Generate CSS transition string
 *
 * @example
 * transition('all', 'normal', 'easeInOut') // 'all 300ms ease-in-out'
 * transition('opacity', 'fast') // 'opacity 150ms ease'
 */
export function transition(
  property: string = 'all',
  duration: keyof AnimationTokens['duration'] = 'normal',
  timing: keyof AnimationTokens['timing'] = 'ease'
): string {
  return `${property} ${animationDuration(duration)} ${animationTiming(timing)}`;
}

// =============================================================================
// MEDIA QUERY HELPERS
// =============================================================================

/**
 * Generate media query string
 *
 * @example
 * mediaQuery('md') // '@media (min-width: 768px)'
 * mediaQuery('lg', 'max') // '@media (max-width: 1024px)'
 */
export function mediaQuery(
  size: keyof BreakpointTokens,
  type: 'min' | 'max' = 'min'
): string {
  const breakpointValue = breakpointTokens[size]?.value || '0px';
  return `@media (${type}-width: ${breakpointValue})`;
}

/**
 * Check if viewport matches breakpoint (client-side only)
 *
 * @example
 * matchesBreakpoint('md') // true if viewport >= 768px
 */
export function matchesBreakpoint(size: keyof BreakpointTokens): boolean {
  if (typeof window === 'undefined') return false;
  const minWidth = breakpointTokens[size]?.min || 0;
  return window.matchMedia(`(min-width: ${minWidth}px)`).matches;
}

// =============================================================================
// EXPORT DEFAULT
// =============================================================================

export default tokens;
