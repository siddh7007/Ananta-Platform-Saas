/**
 * Color Contrast Utilities
 * CBP-P1-008: Color Contrast Compliance
 */

// Convert hex to RGB
export function hexToRgb(hex: string): Readonly<{ r: number; g: number; b: number }> | null {
  // Support both 3-digit and 6-digit hex codes
  const shortHex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
  const longHex = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i;

  // Expand shorthand form (e.g., "03F") to full form (e.g., "0033FF")
  const expandedHex = hex.replace(shortHex, (_, r, g, b) => r + r + g + g + b + b);

  const result = longHex.exec(expandedHex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}

// Convert RGB to relative luminance
export function getLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    c = c / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

// Calculate contrast ratio between two colors
export function getContrastRatio(color1: string, color2: string): number {
  const rgb1 = hexToRgb(color1);
  const rgb2 = hexToRgb(color2);

  if (!rgb1 || !rgb2) return 0;

  const l1 = getLuminance(rgb1.r, rgb1.g, rgb1.b);
  const l2 = getLuminance(rgb2.r, rgb2.g, rgb2.b);

  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);

  return (lighter + 0.05) / (darker + 0.05);
}

// WCAG compliance levels
export type WCAGLevel = 'AAA' | 'AA' | 'AA-large' | 'fail';

export interface ContrastResult {
  ratio: number;
  level: WCAGLevel;
  passesAA: boolean;
  passesAAA: boolean;
  passesAALarge: boolean;
}

// Check WCAG compliance
export function checkContrast(foreground: string, background: string): ContrastResult {
  const ratio = getContrastRatio(foreground, background);

  return {
    ratio,
    level: ratio >= 7 ? 'AAA' : ratio >= 4.5 ? 'AA' : ratio >= 3 ? 'AA-large' : 'fail',
    passesAA: ratio >= 4.5,
    passesAAA: ratio >= 7,
    passesAALarge: ratio >= 3,
  };
}

// CSS custom property values for compliant colors
export const COMPLIANT_COLORS = {
  // Text colors (on white background)
  textPrimary: '#1a1a1a',      // 16.1:1 contrast
  textSecondary: '#525252',    // 7.5:1 contrast
  textMuted: '#737373',        // 4.6:1 contrast (AA)

  // Status colors (text on their background)
  success: { bg: '#ecfdf5', text: '#065f46' },  // 7.3:1
  warning: { bg: '#fffbeb', text: '#92400e' },  // 5.1:1
  error: { bg: '#fef2f2', text: '#991b1b' },    // 6.8:1
  info: { bg: '#eff6ff', text: '#1e40af' },     // 6.2:1

  // Interactive elements
  link: '#2563eb',             // 4.5:1 on white
  linkHover: '#1d4ed8',        // 5.8:1 on white
  focus: '#3b82f6',            // For focus rings

  // Borders
  border: '#d4d4d4',           // 1.8:1 (decorative)
  borderStrong: '#a3a3a3',     // 2.6:1 (UI components)
};

// Helper to convert RGB to hex
function rgbToHex(r: number, g: number, b: number): string {
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

// Generate accessible color pair
export function findAccessibleColor(
  baseColor: string,
  background: string,
  minRatio = 4.5
): string {
  const rgb = hexToRgb(baseColor);
  if (!rgb) return baseColor;

  let { r, g, b } = rgb;
  const bgRgb = hexToRgb(background);
  if (!bgRgb) return baseColor;

  const bgLuminance = getLuminance(bgRgb.r, bgRgb.g, bgRgb.b);
  const shouldDarken = bgLuminance > 0.5;

  // Check if already meets ratio
  const initialRatio = getContrastRatio(baseColor, background);
  if (initialRatio >= minRatio) {
    return baseColor;
  }

  // Adjust color until it meets contrast ratio
  const MAX_ITERATIONS = 100;
  const STEP = 5;

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const currentHex = rgbToHex(r, g, b);
    const currentRatio = getContrastRatio(currentHex, background);

    if (currentRatio >= minRatio) {
      return currentHex;
    }

    // Check if we've reached the bounds
    const atBounds = shouldDarken
      ? (r === 0 && g === 0 && b === 0)
      : (r === 255 && g === 255 && b === 255);

    if (atBounds) {
      // Can't adjust further, return best effort
      return currentHex;
    }

    // Adjust color
    if (shouldDarken) {
      r = Math.max(0, r - STEP);
      g = Math.max(0, g - STEP);
      b = Math.max(0, b - STEP);
    } else {
      r = Math.min(255, r + STEP);
      g = Math.min(255, g + STEP);
      b = Math.min(255, b + STEP);
    }
  }

  // Fallback: return black or white based on background
  return bgLuminance > 0.5 ? '#000000' : '#ffffff';
}
