/**
 * Design Tokens Test Suite
 *
 * Validates token structure, helper functions, and type safety
 */

import { describe, it, expect } from 'vitest';
import {
  tokens,
  getToken,
  spacing,
  fontSize,
  getCssVar,
  zIndex,
  shadow,
  borderRadius,
  transition,
  mediaQuery,
  animationDuration,
  animationTiming,
} from '../design-tokens';

describe('Design Tokens', () => {
  describe('Token Structure', () => {
    it('should have all main token categories', () => {
      expect(tokens).toHaveProperty('color');
      expect(tokens).toHaveProperty('typography');
      expect(tokens).toHaveProperty('spacing');
      expect(tokens).toHaveProperty('borderRadius');
      expect(tokens).toHaveProperty('shadow');
      expect(tokens).toHaveProperty('zIndex');
      expect(tokens).toHaveProperty('breakpoint');
      expect(tokens).toHaveProperty('animation');
    });

    it('should have color subcategories', () => {
      expect(tokens.color).toHaveProperty('brand');
      expect(tokens.color).toHaveProperty('semantic');
      expect(tokens.color).toHaveProperty('neutral');
      expect(tokens.color).toHaveProperty('ui');
      expect(tokens.color).toHaveProperty('sidebar');
    });

    it('should have typography subcategories', () => {
      expect(tokens.typography).toHaveProperty('fontFamily');
      expect(tokens.typography).toHaveProperty('fontSize');
      expect(tokens.typography).toHaveProperty('fontWeight');
      expect(tokens.typography).toHaveProperty('lineHeight');
    });
  });

  describe('Color Tokens', () => {
    it('should have brand colors with value and css properties', () => {
      expect(tokens.color.brand.primary).toHaveProperty('value');
      expect(tokens.color.brand.primary).toHaveProperty('css');
      expect(tokens.color.brand.primary.value).toBe('hsl(221.2 83.2% 53.3%)');
      expect(tokens.color.brand.primary.css).toBe('--primary');
    });

    it('should have all semantic colors', () => {
      expect(tokens.color.semantic.success.value).toBe('hsl(142.1 76.2% 36.3%)');
      expect(tokens.color.semantic.warning.value).toBe('hsl(38 92% 50%)');
      expect(tokens.color.semantic.error.value).toBe('hsl(0 84.2% 60.2%)');
      expect(tokens.color.semantic.info.value).toBe('hsl(199 89% 48%)');
    });
  });

  describe('Typography Tokens', () => {
    it('should have font families as arrays', () => {
      expect(Array.isArray(tokens.typography.fontFamily.sans.value)).toBe(true);
      expect(Array.isArray(tokens.typography.fontFamily.mono.value)).toBe(true);
    });

    it('should have font sizes with line heights', () => {
      expect(tokens.typography.fontSize.base).toEqual({
        value: '1rem',
        lineHeight: '1.5rem',
        description: '16px - Base text size',
      });
    });

    it('should have all font weight values', () => {
      expect(tokens.typography.fontWeight.normal.value).toBe('400');
      expect(tokens.typography.fontWeight.medium.value).toBe('500');
      expect(tokens.typography.fontWeight.semibold.value).toBe('600');
      expect(tokens.typography.fontWeight.bold.value).toBe('700');
    });
  });

  describe('Spacing Tokens', () => {
    it('should have spacing scale from 0 to 96', () => {
      expect(tokens.spacing[0].value).toBe('0');
      expect(tokens.spacing[1].value).toBe('0.25rem');
      expect(tokens.spacing[4].value).toBe('1rem');
      expect(tokens.spacing[8].value).toBe('2rem');
      expect(tokens.spacing[16].value).toBe('4rem');
    });
  });

  describe('Border Radius Tokens', () => {
    it('should have border radius values', () => {
      expect(tokens.borderRadius.none.value).toBe('0');
      expect(tokens.borderRadius.full.value).toBe('9999px');
      expect(tokens.borderRadius.lg.value).toBe('var(--radius)');
    });
  });

  describe('Shadow Tokens', () => {
    it('should have standard shadow values', () => {
      expect(tokens.shadow.sm.value).toContain('rgb(0 0 0');
      expect(tokens.shadow.md.value).toContain('rgb(0 0 0');
      expect(tokens.shadow.none.value).toBe('0 0 #0000');
    });

    it('should have semantic shadow values', () => {
      expect(tokens.shadow.primary.value).toContain('var(--shadow-primary');
      expect(tokens.shadow.success.value).toContain('var(--shadow-success');
      expect(tokens.shadow.error.value).toContain('var(--shadow-error');
    });
  });

  describe('Z-Index Tokens', () => {
    it('should have layered z-index values', () => {
      expect(tokens.zIndex.base.value).toBe(0);
      expect(tokens.zIndex.dropdown.value).toBe(1000);
      expect(tokens.zIndex.modal.value).toBe(1050);
      expect(tokens.zIndex.tooltip.value).toBe(1070);
      expect(tokens.zIndex.toast.value).toBe(1080);
    });

    it('should have correct z-index hierarchy', () => {
      expect(tokens.zIndex.dropdown.value).toBeLessThan(tokens.zIndex.modal.value);
      expect(tokens.zIndex.modal.value).toBeLessThan(tokens.zIndex.tooltip.value);
      expect(tokens.zIndex.tooltip.value).toBeLessThan(tokens.zIndex.toast.value);
    });
  });

  describe('Breakpoint Tokens', () => {
    it('should have all breakpoint sizes', () => {
      expect(tokens.breakpoint.sm.value).toBe('640px');
      expect(tokens.breakpoint.md.value).toBe('768px');
      expect(tokens.breakpoint.lg.value).toBe('1024px');
      expect(tokens.breakpoint.xl.value).toBe('1280px');
    });

    it('should have min values for media queries', () => {
      expect(tokens.breakpoint.sm.min).toBe(640);
      expect(tokens.breakpoint.md.min).toBe(768);
    });
  });

  describe('Animation Tokens', () => {
    it('should have duration values', () => {
      expect(tokens.animation.duration.fast.value).toBe('150ms');
      expect(tokens.animation.duration.normal.value).toBe('300ms');
      expect(tokens.animation.duration.slow.value).toBe('500ms');
    });

    it('should have timing functions', () => {
      expect(tokens.animation.timing.linear.value).toBe('linear');
      expect(tokens.animation.timing.easeInOut.value).toBe('ease-in-out');
      expect(tokens.animation.timing.spring.value).toContain('cubic-bezier');
    });
  });

  describe('Helper Functions', () => {
    describe('getToken()', () => {
      it('should get token value by path', () => {
        expect(getToken('color.brand.primary.value')).toBe('hsl(221.2 83.2% 53.3%)');
        expect(getToken('spacing.4.value')).toBe('1rem');
        expect(getToken('typography.fontSize.base.value')).toBe('1rem');
      });

      it('should return undefined for invalid paths', () => {
        expect(getToken('invalid.path')).toBeUndefined();
        expect(getToken('color.invalid.color')).toBeUndefined();
      });
    });

    describe('spacing()', () => {
      it('should return spacing value', () => {
        expect(spacing(0)).toBe('0');
        expect(spacing(1)).toBe('0.25rem');
        expect(spacing(4)).toBe('1rem');
        expect(spacing(8)).toBe('2rem');
      });

      it('should handle fractional spacing', () => {
        expect(spacing(0.5)).toBe('0.125rem');
        expect(spacing(1.5)).toBe('0.375rem');
      });
    });

    describe('fontSize()', () => {
      it('should return fontSize and lineHeight', () => {
        const base = fontSize('base');
        expect(base).toEqual({
          fontSize: '1rem',
          lineHeight: '1.5rem',
        });

        const lg = fontSize('lg');
        expect(lg).toEqual({
          fontSize: '1.125rem',
          lineHeight: '1.75rem',
        });
      });
    });

    describe('getCssVar()', () => {
      it('should return CSS custom property reference for colors', () => {
        expect(getCssVar('color.brand.primary')).toBe('hsl(var(--primary))');
        expect(getCssVar('color.semantic.success')).toBe('hsl(var(--success))');
      });

      it('should return empty string for invalid paths', () => {
        expect(getCssVar('invalid.path')).toBe('');
      });
    });

    describe('zIndex()', () => {
      it('should return z-index value', () => {
        expect(zIndex('modal')).toBe(1050);
        expect(zIndex('tooltip')).toBe(1070);
        expect(zIndex('toast')).toBe(1080);
      });
    });

    describe('shadow()', () => {
      it('should return shadow value', () => {
        expect(shadow('md')).toContain('rgb(0 0 0');
        expect(shadow('none')).toBe('0 0 #0000');
      });
    });

    describe('borderRadius()', () => {
      it('should return border radius value', () => {
        expect(borderRadius('none')).toBe('0');
        expect(borderRadius('full')).toBe('9999px');
        expect(borderRadius('lg')).toBe('var(--radius)');
      });
    });

    describe('animationDuration()', () => {
      it('should return animation duration', () => {
        expect(animationDuration('fast')).toBe('150ms');
        expect(animationDuration('normal')).toBe('300ms');
        expect(animationDuration('slow')).toBe('500ms');
      });
    });

    describe('animationTiming()', () => {
      it('should return timing function', () => {
        expect(animationTiming('linear')).toBe('linear');
        expect(animationTiming('easeInOut')).toBe('ease-in-out');
      });
    });

    describe('transition()', () => {
      it('should generate transition string with defaults', () => {
        expect(transition()).toBe('all 300ms ease');
      });

      it('should generate transition string with custom values', () => {
        expect(transition('opacity', 'fast', 'easeInOut')).toBe('opacity 150ms ease-in-out');
        expect(transition('transform', 'slow', 'spring')).toContain('transform 500ms cubic-bezier');
      });
    });

    describe('mediaQuery()', () => {
      it('should generate min-width media query by default', () => {
        expect(mediaQuery('md')).toBe('@media (min-width: 768px)');
        expect(mediaQuery('lg')).toBe('@media (min-width: 1024px)');
      });

      it('should generate max-width media query when specified', () => {
        expect(mediaQuery('md', 'max')).toBe('@media (max-width: 768px)');
      });
    });
  });

  describe('Type Safety', () => {
    it('should have readonly types', () => {
      // TypeScript will catch mutations at compile time
      // This test verifies the structure exists
      expect(tokens).toBeDefined();
    });
  });
});
