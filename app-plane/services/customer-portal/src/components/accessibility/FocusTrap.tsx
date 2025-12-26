/**
 * Focus Trap Component
 *
 * Traps keyboard focus within a container (for modals, dialogs, etc.)
 * Implements proper focus management for accessibility.
 *
 * WCAG 2.1 Level A: 2.1.2 No Keyboard Trap (allows escape)
 */

import React, { useRef, useEffect, useCallback } from 'react';
import { Box } from '@mui/material';

interface FocusTrapProps {
  children: React.ReactNode;
  active?: boolean;
  onEscape?: () => void;
  restoreFocus?: boolean;
}

const FOCUSABLE_SELECTORS = [
  'button:not([disabled])',
  'a[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

export const FocusTrap: React.FC<FocusTrapProps> = ({
  children,
  active = true,
  onEscape,
  restoreFocus = true,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<Element | null>(null);

  // Get all focusable elements within the container
  const getFocusableElements = useCallback(() => {
    if (!containerRef.current) return [];
    return Array.from(containerRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS));
  }, []);

  // Handle tab key to trap focus
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!active) return;

      if (event.key === 'Escape' && onEscape) {
        event.preventDefault();
        onEscape();
        return;
      }

      if (event.key !== 'Tab') return;

      const focusableElements = getFocusableElements();
      if (focusableElements.length === 0) return;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (event.shiftKey) {
        // Shift+Tab: if on first element, go to last
        if (document.activeElement === firstElement) {
          event.preventDefault();
          lastElement.focus();
        }
      } else {
        // Tab: if on last element, go to first
        if (document.activeElement === lastElement) {
          event.preventDefault();
          firstElement.focus();
        }
      }
    },
    [active, getFocusableElements, onEscape]
  );

  // Store previous focus and focus first element when activated
  useEffect(() => {
    if (active) {
      previousFocusRef.current = document.activeElement;

      // Focus first focusable element
      const focusableElements = getFocusableElements();
      if (focusableElements.length > 0) {
        requestAnimationFrame(() => {
          focusableElements[0].focus();
        });
      }
    }

    return () => {
      // Restore focus when deactivated
      if (restoreFocus && previousFocusRef.current instanceof HTMLElement) {
        previousFocusRef.current.focus();
      }
    };
  }, [active, getFocusableElements, restoreFocus]);

  // Add keydown listener
  useEffect(() => {
    if (active) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [active, handleKeyDown]);

  return (
    <Box ref={containerRef} role="region" aria-modal={active ? 'true' : undefined}>
      {children}
    </Box>
  );
};

export default FocusTrap;
