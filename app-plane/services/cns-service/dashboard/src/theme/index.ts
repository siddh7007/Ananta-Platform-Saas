/**
 * CNS Dashboard Theme Configuration
 *
 * Centralized theme with semantic tokens for:
 * - Quality routing (production, staging, rejected, failed)
 * - Supplier branding (mouser, digikey, element14, octopart)
 * - Enrichment status (pending, processing, completed, failed)
 * - Lifecycle status (active, nrnd, obsolete, eol)
 *
 * Theme Variants:
 * - light: Default light theme
 * - dark: Dark theme
 * - midLight: Light theme with softer contrast
 * - midDark: Dark theme with softer contrast
 *
 * @see THEME_SYSTEM.md for usage guide
 */

import { createTheme, ThemeOptions } from '@mui/material/styles';
import { lightPalette, darkPalette, midLightPalette, midDarkPalette } from './variants';
import {
  qualityColors,
  supplierColors,
  enrichmentStatusColors,
  lifecycleColors,
  jobStatusColors,
  completenessColors,
  workflowStatusColors,
  riskColors,
  gradeColors,
  alertSeverityColors,
  typographyScale,
} from './tokens';
import { VALID_CHIP_COLORS, ValidChipColor } from './chipColors';

// Re-export tokens, helpers, and chip color utilities for convenience
export * from './tokens';
export * from './helpers';
export * from './chipColors';

// ============================================================
// Global Chip Color Validation (Root-Level Fix)
// ============================================================

/**
 * Validates chip color at runtime and returns a safe value.
 * This function is used by the global MUI Chip component override
 * to prevent "palette[t.color] is undefined" errors.
 */
function validateChipColorAtRuntime(color: unknown): ValidChipColor {
  if (color === undefined || color === null) {
    return 'default';
  }

  if (typeof color === 'string' && VALID_CHIP_COLORS.includes(color as ValidChipColor)) {
    return color as ValidChipColor;
  }

  // Log invalid colors in development
  if (typeof color === 'string' && color.startsWith('#')) {
    console.warn(
      `[MUI Theme] Chip received HEX color "${color}" instead of MUI color name. ` +
      `HEX colors should be passed via "sx" prop, not "color" prop. ` +
      `Valid colors: ${VALID_CHIP_COLORS.join(', ')}. Using 'default'.`
    );
  } else {
    console.warn(
      `[MUI Theme] Invalid Chip color "${String(color)}". ` +
      `Valid colors: ${VALID_CHIP_COLORS.join(', ')}. Using 'default'.`
    );
  }

  return 'default';
}

// ============================================================
// Shared Theme Options (Typography, Components, etc.)
// ============================================================

const sharedThemeOptions: Pick<ThemeOptions, 'typography' | 'shape' | 'components'> = {
  typography: {
    fontFamily: [
      '-apple-system',
      'BlinkMacSystemFont',
      '"Segoe UI"',
      'Roboto',
      'Arial',
      'sans-serif',
    ].join(','),
    h1: typographyScale.pageTitle,
    h2: typographyScale.sectionTitle,
    h3: typographyScale.cardTitle,
    h4: {
      fontSize: '1.5rem',
      fontWeight: 600,
    },
    h5: {
      fontSize: '1.25rem',
      fontWeight: 600,
    },
    h6: {
      fontSize: '1rem',
      fontWeight: 600,
    },
  },
  shape: {
    borderRadius: 8,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 600,
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 12,
        },
      },
    },
    MuiChip: {
      defaultProps: {
        // Color prop will be validated at runtime by SafeChip wrapper
        // This default ensures chips without color prop get 'default'
        color: 'default',
      },
      styleOverrides: {
        root: ({ ownerState }) => {
          // Runtime validation: Log invalid colors passed to chips
          const color = ownerState.color;
          if (color && !VALID_CHIP_COLORS.includes(color as ValidChipColor)) {
            console.error(
              `[MUI Theme] Invalid Chip color "${String(color)}" detected! ` +
              `Label: "${ownerState.label || 'unknown'}". ` +
              `Valid colors: ${VALID_CHIP_COLORS.join(', ')}. ` +
              `This will cause a palette error. Fix the component passing this color.`
            );
          }
          return {
            fontWeight: 600,
          };
        },
        sizeSmall: {
          fontSize: '0.6875rem',
        },
      },
    },
    MuiTableHead: {
      styleOverrides: {
        root: {
          '& .MuiTableCell-head': {
            fontWeight: 600,
            fontSize: '0.75rem',
            textTransform: 'uppercase',
            letterSpacing: '0.03em',
            // backgroundColor is intentionally NOT set here
            // Each theme variant sets its own backgroundColor
          },
        },
      },
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: {
          borderRadius: 4,
          height: 8,
        },
      },
    },
  },
};

// ============================================================
// MUI Theme Type Augmentation
// ============================================================

declare module '@mui/material/styles' {
  interface Theme {
    customTokens: {
      quality: typeof qualityColors;
      supplier: typeof supplierColors;
      enrichmentStatus: typeof enrichmentStatusColors;
      lifecycle: typeof lifecycleColors;
      jobStatus: typeof jobStatusColors;
      completeness: typeof completenessColors;
      workflowStatus: typeof workflowStatusColors;
      risk: typeof riskColors;
      grade: typeof gradeColors;
      alertSeverity: typeof alertSeverityColors;
    };
  }
  interface ThemeOptions {
    customTokens?: {
      quality?: typeof qualityColors;
      supplier?: typeof supplierColors;
      enrichmentStatus?: typeof enrichmentStatusColors;
      lifecycle?: typeof lifecycleColors;
      jobStatus?: typeof jobStatusColors;
      completeness?: typeof completenessColors;
      workflowStatus?: typeof workflowStatusColors;
      risk?: typeof riskColors;
      grade?: typeof gradeColors;
      alertSeverity?: typeof alertSeverityColors;
    };
  }
}

// ============================================================
// Custom Tokens (Semantic Colors)
// ============================================================

const customTokens = {
  quality: qualityColors,
  supplier: supplierColors,
  enrichmentStatus: enrichmentStatusColors,
  lifecycle: lifecycleColors,
  jobStatus: jobStatusColors,
  completeness: completenessColors,
  workflowStatus: workflowStatusColors,
  risk: riskColors,
  grade: gradeColors,
  alertSeverity: alertSeverityColors,
};

// ============================================================
// Theme Variants Creation
// ============================================================

/**
 * Light Theme (Default)
 */
export const lightTheme = createTheme({
  ...sharedThemeOptions,
  palette: lightPalette,
  customTokens,
  components: {
    ...sharedThemeOptions.components,
    MuiTableHead: {
      styleOverrides: {
        root: {
          '& .MuiTableCell-head': {
            fontWeight: 600,
            fontSize: '0.75rem',
            textTransform: 'uppercase',
            letterSpacing: '0.03em',
            backgroundColor: '#f9fafb', // Light theme table header (grey-50)
          },
        },
      },
    },
  },
});

/**
 * Dark Theme
 */
export const darkTheme = createTheme({
  ...sharedThemeOptions,
  palette: darkPalette,
  customTokens,
  components: {
    ...sharedThemeOptions.components,
    MuiTableHead: {
      styleOverrides: {
        root: {
          '& .MuiTableCell-head': {
            fontWeight: 600,
            fontSize: '0.75rem',
            textTransform: 'uppercase',
            letterSpacing: '0.03em',
            backgroundColor: '#1f2937', // Dark mode table header
          },
        },
      },
    },
  },
});

/**
 * Mid-Light Theme (Softer contrast light theme)
 */
export const midLightTheme = createTheme({
  ...sharedThemeOptions,
  palette: midLightPalette,
  customTokens,
  components: {
    ...sharedThemeOptions.components,
    MuiTableHead: {
      styleOverrides: {
        root: {
          '& .MuiTableCell-head': {
            fontWeight: 600,
            fontSize: '0.75rem',
            textTransform: 'uppercase',
            letterSpacing: '0.03em',
            backgroundColor: '#e5e7eb', // Mid-light table header
          },
        },
      },
    },
  },
});

/**
 * Mid-Dark Theme (Softer contrast dark theme)
 */
export const midDarkTheme = createTheme({
  ...sharedThemeOptions,
  palette: midDarkPalette,
  customTokens,
  components: {
    ...sharedThemeOptions.components,
    MuiTableHead: {
      styleOverrides: {
        root: {
          '& .MuiTableCell-head': {
            fontWeight: 600,
            fontSize: '0.75rem',
            textTransform: 'uppercase',
            letterSpacing: '0.03em',
            backgroundColor: '#374151', // Mid-dark table header
          },
        },
      },
    },
  },
});

// ============================================================
// Default Export (for backwards compatibility)
// ============================================================

/**
 * Default theme (light)
 * @deprecated Use named imports (lightTheme, darkTheme, etc.) instead
 */
export const theme = lightTheme;

export default lightTheme;

// ============================================================
// Theme Variant Type
// ============================================================

export type ThemeVariant = 'light' | 'dark' | 'midLight' | 'midDark';

export const themes = {
  light: lightTheme,
  dark: darkTheme,
  midLight: midLightTheme,
  midDark: midDarkTheme,
} as const;
