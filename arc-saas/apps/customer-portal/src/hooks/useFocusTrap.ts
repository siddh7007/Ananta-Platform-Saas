/**
 * Focus Trap Hook
 * CBP-P1-003: Keyboard Navigation & Focus Management
 * Traps focus within a container (for modals/dialogs)
 */

import { useEffect, useRef, useCallback } from 'react';

const FOCUSABLE_SELECTOR = [
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'a[href]',
  'audio[controls]',
  'video[controls]',
  'details > summary',
  '[contenteditable="true"]',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export function useFocusTrap<T extends HTMLElement = HTMLElement>(isActive: boolean) {
  const containerRef = useRef<T>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const focusTimeoutRef = useRef<number | null>(null);

  const getFocusableElements = useCallback(() => {
    if (!containerRef.current) return [];
    return Array.from(
      containerRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
    );
  }, []); // Empty deps - only created once

  useEffect(() => {
    if (!isActive) return;

    // Store currently focused element
    previousFocus.current = document.activeElement as HTMLElement;

    // Focus first focusable element
    const elements = getFocusableElements();
    if (elements.length > 0) {
      focusTimeoutRef.current = window.setTimeout(() => {
        elements[0]?.focus();
      }, 0);
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      const focusableElements = getFocusableElements();
      if (focusableElements.length === 0) return;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (e.shiftKey && document.activeElement === firstElement) {
        e.preventDefault();
        lastElement?.focus();
      } else if (!e.shiftKey && document.activeElement === lastElement) {
        e.preventDefault();
        firstElement?.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      // Clear pending focus timeout
      if (focusTimeoutRef.current !== null) {
        clearTimeout(focusTimeoutRef.current);
        focusTimeoutRef.current = null;
      }

      document.removeEventListener('keydown', handleKeyDown);

      // Restore focus only if element still exists in DOM
      if (previousFocus.current && document.body.contains(previousFocus.current)) {
        previousFocus.current.focus();
      }
    };
  }, [isActive, getFocusableElements]);

  return containerRef;
}

export default useFocusTrap;
