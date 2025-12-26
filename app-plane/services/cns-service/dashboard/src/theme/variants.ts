/**
 * CNS Dashboard Theme Variants
 *
 * Four theme variants: light, dark, mid-light, mid-dark
 * Each variant defines the core MUI palette used by createTheme()
 *
 * @see THEME_SYSTEM.md for usage and customization guide
 */

import { PaletteOptions } from '@mui/material/styles';

// ============================================================
// Light Theme (Default)
// ============================================================
export const lightPalette: PaletteOptions = {
  mode: 'light',
  primary: {
    main: '#3b82f6',      // blue-500
    light: '#60a5fa',     // blue-400
    dark: '#2563eb',      // blue-600
  },
  secondary: {
    main: '#8b5cf6',      // purple-500
    light: '#a78bfa',     // purple-400
    dark: '#7c3aed',      // purple-600
  },
  success: {
    main: '#22c55e',      // green-500
    light: '#4ade80',     // green-400
    dark: '#16a34a',      // green-600
  },
  warning: {
    main: '#eab308',      // yellow-600 (improved contrast for WCAG AA on white)
    light: '#facc15',     // yellow-500
    dark: '#ca8a04',      // yellow-700
  },
  error: {
    main: '#ef4444',      // red-500
    light: '#f87171',     // red-400
    dark: '#dc2626',      // red-600
  },
  info: {
    main: '#3b82f6',      // blue-500
    light: '#60a5fa',     // blue-400
    dark: '#2563eb',      // blue-600
  },
  grey: {
    50: '#f9fafb',
    100: '#f3f4f6',
    200: '#e5e7eb',
    300: '#d1d5db',
    400: '#9ca3af',
    500: '#6b7280',
    600: '#4b5563',
    700: '#374151',
    800: '#1f2937',
    900: '#111827',
  },
  background: {
    default: '#f9fafb',   // grey-50
    paper: '#ffffff',
  },
  text: {
    primary: '#111827',   // grey-900
    secondary: '#6b7280', // grey-500
  },
  divider: '#e5e7eb',     // grey-200
};

// ============================================================
// Dark Theme
// ============================================================
export const darkPalette: PaletteOptions = {
  mode: 'dark',
  primary: {
    main: '#60a5fa',      // blue-400 (lighter for dark bg)
    light: '#93c5fd',     // blue-300
    dark: '#3b82f6',      // blue-500
  },
  secondary: {
    main: '#a78bfa',      // purple-400
    light: '#c4b5fd',     // purple-300
    dark: '#8b5cf6',      // purple-500
  },
  success: {
    main: '#4ade80',      // green-400
    light: '#86efac',     // green-300
    dark: '#22c55e',      // green-500
  },
  warning: {
    main: '#fde047',      // yellow-400
    light: '#fef08a',     // yellow-300
    dark: '#facc15',      // yellow-500
  },
  error: {
    main: '#f87171',      // red-400
    light: '#fca5a5',     // red-300
    dark: '#ef4444',      // red-500
  },
  info: {
    main: '#60a5fa',      // blue-400
    light: '#93c5fd',     // blue-300
    dark: '#3b82f6',      // blue-500
  },
  grey: {
    50: '#111827',        // Inverted for dark mode
    100: '#1f2937',
    200: '#374151',
    300: '#4b5563',
    400: '#6b7280',
    500: '#9ca3af',
    600: '#d1d5db',
    700: '#e5e7eb',
    800: '#f3f4f6',
    900: '#f9fafb',
  },
  background: {
    default: '#111827',   // grey-900
    paper: '#1f2937',     // grey-800
  },
  text: {
    primary: '#f9fafb',   // grey-50
    secondary: '#d1d5db', // grey-300 (improved contrast for WCAG AA)
  },
  divider: '#374151',     // grey-700
};

// ============================================================
// Mid-Light Theme (Softer contrast)
// ============================================================
export const midLightPalette: PaletteOptions = {
  mode: 'light',
  primary: {
    main: '#3b82f6',      // blue-500
    light: '#60a5fa',     // blue-400
    dark: '#2563eb',      // blue-600
  },
  secondary: {
    main: '#8b5cf6',      // purple-500
    light: '#a78bfa',     // purple-400
    dark: '#7c3aed',      // purple-600
  },
  success: {
    main: '#22c55e',      // green-500
    light: '#4ade80',     // green-400
    dark: '#16a34a',      // green-600
  },
  warning: {
    main: '#eab308',      // yellow-600 (improved contrast for WCAG AA on white)
    light: '#facc15',     // yellow-500
    dark: '#ca8a04',      // yellow-700
  },
  error: {
    main: '#ef4444',      // red-500
    light: '#f87171',     // red-400
    dark: '#dc2626',      // red-600
  },
  info: {
    main: '#3b82f6',      // blue-500
    light: '#60a5fa',     // blue-400
    dark: '#2563eb',      // blue-600
  },
  grey: {
    50: '#f9fafb',
    100: '#f3f4f6',
    200: '#e5e7eb',
    300: '#d1d5db',
    400: '#9ca3af',
    500: '#6b7280',
    600: '#4b5563',
    700: '#374151',
    800: '#1f2937',
    900: '#111827',
  },
  background: {
    default: '#f3f4f6',   // grey-100 (slightly darker than light)
    paper: '#ffffff',
  },
  text: {
    primary: '#1f2937',   // grey-800 (slightly lighter)
    secondary: '#4b5563', // grey-600
  },
  divider: '#d1d5db',     // grey-300
};

// ============================================================
// Mid-Dark Theme (Softer contrast)
// ============================================================
export const midDarkPalette: PaletteOptions = {
  mode: 'dark',
  primary: {
    main: '#60a5fa',      // blue-400
    light: '#93c5fd',     // blue-300
    dark: '#3b82f6',      // blue-500
  },
  secondary: {
    main: '#a78bfa',      // purple-400
    light: '#c4b5fd',     // purple-300
    dark: '#8b5cf6',      // purple-500
  },
  success: {
    main: '#4ade80',      // green-400
    light: '#86efac',     // green-300
    dark: '#22c55e',      // green-500
  },
  warning: {
    main: '#fde047',      // yellow-400
    light: '#fef08a',     // yellow-300
    dark: '#facc15',      // yellow-500
  },
  error: {
    main: '#f87171',      // red-400
    light: '#fca5a5',     // red-300
    dark: '#ef4444',      // red-500
  },
  info: {
    main: '#60a5fa',      // blue-400
    light: '#93c5fd',     // blue-300
    dark: '#3b82f6',      // blue-500
  },
  grey: {
    50: '#1f2937',        // Lighter than dark mode
    100: '#374151',
    200: '#4b5563',
    300: '#6b7280',
    400: '#9ca3af',
    500: '#d1d5db',
    600: '#e5e7eb',
    700: '#f3f4f6',
    800: '#f9fafb',
    900: '#ffffff',
  },
  background: {
    default: '#1f2937',   // grey-800 (lighter than dark)
    paper: '#374151',     // grey-700
  },
  text: {
    primary: '#f3f4f6',   // grey-100 (slightly dimmer)
    secondary: '#d1d5db', // grey-300 (improved contrast for WCAG AA)
  },
  divider: '#4b5563',     // grey-600
};
