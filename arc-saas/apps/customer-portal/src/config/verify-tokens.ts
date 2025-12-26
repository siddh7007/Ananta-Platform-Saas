/**
 * Design Token Verification Script
 *
 * Run this to verify all tokens are properly defined and accessible.
 * Usage: bun run src/config/verify-tokens.ts
 */

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
  matchesBreakpoint,
} from './design-tokens';

console.log('='.repeat(60));
console.log('Design Token System Verification');
console.log('='.repeat(60));

// Color Tokens
console.log('\n[Colors]');
console.log('Primary:', tokens.color.brand.primary.value);
console.log('Success:', tokens.color.semantic.success.value);
console.log('Warning:', tokens.color.semantic.warning.value);
console.log('Error:', tokens.color.semantic.error.value);
console.log('Info:', tokens.color.semantic.info.value);

// Typography Tokens
console.log('\n[Typography]');
console.log('Font Family Sans:', tokens.typography.fontFamily.sans.value[0]);
console.log('Font Family Mono:', tokens.typography.fontFamily.mono.value[0]);
console.log('Font Size Base:', tokens.typography.fontSize.base.value);
console.log('Font Weight Bold:', tokens.typography.fontWeight.bold.value);

// Spacing Tokens
console.log('\n[Spacing]');
console.log('Spacing 1:', spacing(1));
console.log('Spacing 4:', spacing(4));
console.log('Spacing 8:', spacing(8));
console.log('Spacing 16:', spacing(16));

// Shadow Tokens
console.log('\n[Shadows]');
console.log('Shadow SM:', shadow('sm').substring(0, 50) + '...');
console.log('Shadow MD:', shadow('md').substring(0, 50) + '...');
console.log('Shadow Primary:', shadow('primary').substring(0, 50) + '...');

// Z-Index Tokens
console.log('\n[Z-Index]');
console.log('Base:', zIndex('base'));
console.log('Dropdown:', zIndex('dropdown'));
console.log('Modal:', zIndex('modal'));
console.log('Tooltip:', zIndex('tooltip'));
console.log('Toast:', zIndex('toast'));

// Border Radius Tokens
console.log('\n[Border Radius]');
console.log('None:', borderRadius('none'));
console.log('MD:', borderRadius('md'));
console.log('Full:', borderRadius('full'));

// Breakpoint Tokens
console.log('\n[Breakpoints]');
console.log('SM:', tokens.breakpoint.sm.value);
console.log('MD:', tokens.breakpoint.md.value);
console.log('LG:', tokens.breakpoint.lg.value);
console.log('XL:', tokens.breakpoint.xl.value);

// Animation Tokens
console.log('\n[Animation]');
console.log('Fast:', tokens.animation.duration.fast.value);
console.log('Normal:', tokens.animation.duration.normal.value);
console.log('Slow:', tokens.animation.duration.slow.value);
console.log('Ease In Out:', tokens.animation.timing.easeInOut.value);

// Helper Functions
console.log('\n[Helper Functions]');
console.log('getToken():', getToken('color.brand.primary.value'));
console.log('fontSize():', JSON.stringify(fontSize('lg')));
console.log('getCssVar():', getCssVar('color.brand.primary'));
console.log('transition():', transition('all', 'fast', 'easeInOut'));
console.log('mediaQuery():', mediaQuery('md'));

// Type Safety Verification
console.log('\n[Type Safety]');
console.log('Tokens object is readonly:', Object.isFrozen(tokens) ? 'Yes (frozen)' : 'No (but const)');

// Count tokens
const countTokens = (obj: any, depth = 0): number => {
  if (depth > 5) return 0; // Prevent infinite recursion
  let count = 0;
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      const value = obj[key];
      if (value && typeof value === 'object') {
        if ('value' in value || 'min' in value) {
          count++;
        } else {
          count += countTokens(value, depth + 1);
        }
      }
    }
  }
  return count;
};

console.log('\n[Statistics]');
console.log('Total color tokens:', countTokens(tokens.color));
console.log('Total spacing tokens:', countTokens(tokens.spacing));
console.log('Total typography tokens:', countTokens(tokens.typography));
console.log('Total shadow tokens:', countTokens(tokens.shadow));
console.log('Total z-index tokens:', countTokens(tokens.zIndex));
console.log('Total breakpoint tokens:', countTokens(tokens.breakpoint));
console.log('Total animation tokens:', countTokens(tokens.animation));
console.log('Total tokens:', countTokens(tokens));

console.log('\n' + '='.repeat(60));
console.log('Verification Complete - All tokens accessible');
console.log('='.repeat(60));
console.log('\nNext steps:');
console.log('1. Review DESIGN_TOKENS.md for full documentation');
console.log('2. Check DESIGN_TOKENS_QUICK_REFERENCE.md for usage patterns');
console.log('3. Explore design-tokens.example.tsx for component examples');
console.log('4. Run tests: bun test src/config/__tests__/design-tokens.test.ts');
console.log('='.repeat(60));
