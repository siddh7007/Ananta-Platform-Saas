/**
 * Development Accessibility Checker
 * 
 * Integrates axe-core React for live accessibility auditing during development.
 * Violations are logged to the browser console with detailed information.
 * 
 * Only runs in development mode - automatically disabled in production.
 */

import { useEffect } from 'react';

export function AccessibilityChecker() {
  useEffect(() => {
    // Only run in development mode
    if (import.meta.env.DEV) {
      // Dynamic import to avoid including in production bundle
      import('@axe-core/react')
        .then(({ default: axe }) => {
          import('react')
            .then((React) => {
              import('react-dom')
                .then((ReactDOM) => {
                  // Initialize axe with React and ReactDOM
                  // Third parameter is debounce time in ms
                  axe(React, ReactDOM, 1000, {
                    rules: [
                      // Enable all WCAG 2.1 AA rules
                      { id: 'color-contrast', enabled: true },
                      { id: 'label', enabled: true },
                      { id: 'button-name', enabled: true },
                      { id: 'link-name', enabled: true },
                      { id: 'image-alt', enabled: true },
                      { id: 'aria-valid-attr', enabled: true },
                      { id: 'aria-valid-attr-value', enabled: true },
                      { id: 'heading-order', enabled: true },
                      { id: 'landmark-one-main', enabled: true },
                      { id: 'region', enabled: true },
                    ],
                  });
                  
                  console.log(
                    '%c[Accessibility Checker] axe-core initialized',
                    'color: #4CAF50; font-weight: bold;',
                    '\nWCAG 2.1 Level AA compliance checking enabled.',
                    '\nViolations will be logged to console.'
                  );
                })
                .catch((err) => {
                  console.error('Failed to load react-dom for axe-core:', err);
                });
            })
            .catch((err) => {
              console.error('Failed to load react for axe-core:', err);
            });
        })
        .catch((err) => {
          console.warn('axe-core not available in development:', err);
        });
    }
  }, []);

  // Component does not render anything
  return null;
}
