import { useState, useCallback, useEffect } from 'react';
import { useOrientation } from './useOrientation';

export interface TabletNavigationState {
  isOpen: boolean;
  isExpanded: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
  expand: () => void;
  collapse: () => void;
  toggleExpanded: () => void;
}

/**
 * Hook to manage tablet navigation state
 *
 * Behavior:
 * - Portrait: Overlay sidebar (hamburger menu)
 * - Landscape: Slim sidebar (icons only, expand on hover/click)
 *
 * @returns Navigation state and control functions
 *
 * @example
 * const nav = useTabletNavigation();
 *
 * <button onClick={nav.toggle}>Menu</button>
 * <Sidebar isOpen={nav.isOpen} isExpanded={nav.isExpanded} />
 */
export function useTabletNavigation(): TabletNavigationState {
  const { isPortrait } = useOrientation();
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((prev) => !prev), []);

  const expand = useCallback(() => setIsExpanded(true), []);
  const collapse = useCallback(() => setIsExpanded(false), []);
  const toggleExpanded = useCallback(() => setIsExpanded((prev) => !prev), []);

  // Auto-close sidebar when switching to landscape
  useEffect(() => {
    if (!isPortrait) {
      setIsOpen(false);
    }
  }, [isPortrait]);

  // Close sidebar when clicking outside (portrait mode)
  useEffect(() => {
    if (!isPortrait || !isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const sidebar = document.querySelector('[data-tablet-sidebar]');

      if (sidebar && !sidebar.contains(target)) {
        close();
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [isPortrait, isOpen, close]);

  // Handle escape key to close
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        close();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, close]);

  return {
    isOpen,
    isExpanded,
    open,
    close,
    toggle,
    expand,
    collapse,
    toggleExpanded,
  };
}
