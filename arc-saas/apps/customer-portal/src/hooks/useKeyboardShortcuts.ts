/**
 * useKeyboardShortcuts Hook
 *
 * Manages global keyboard shortcuts for the application
 * Provides a centralized way to register and handle keyboard shortcuts
 */

import { useEffect, useCallback } from 'react';
import { createLogger } from '@/lib/utils';

const log = createLogger('KeyboardShortcuts');

export interface ShortcutConfig {
  /** Unique identifier for the shortcut */
  id: string;
  /** Key to listen for (e.g., 'k', 'Enter', 'Escape') */
  key: string;
  /** Whether Ctrl/Cmd is required */
  ctrlOrCmd?: boolean;
  /** Whether Shift is required */
  shift?: boolean;
  /** Whether Alt is required */
  alt?: boolean;
  /** Callback when shortcut is triggered */
  callback: () => void;
  /** Whether shortcut is enabled */
  enabled?: boolean;
  /** Description for accessibility/documentation */
  description?: string;
}

/**
 * Hook to manage keyboard shortcuts
 * @param shortcuts - Array of shortcut configurations
 */
export function useKeyboardShortcuts(shortcuts: ShortcutConfig[]) {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      // Find matching shortcut
      for (const shortcut of shortcuts) {
        if (shortcut.enabled === false) continue;

        const isKey = event.key.toLowerCase() === shortcut.key.toLowerCase();
        const hasCtrlOrCmd = shortcut.ctrlOrCmd
          ? event.ctrlKey || event.metaKey
          : true;
        // When shift/alt is not required, ensure they are NOT pressed
        // This prevents Cmd+Shift+K from triggering a Cmd+K shortcut
        const hasShift = shortcut.shift ? event.shiftKey : !event.shiftKey;
        const hasAlt = shortcut.alt ? event.altKey : !event.altKey;

        if (isKey && hasCtrlOrCmd && hasShift && hasAlt) {
          event.preventDefault();
          log.debug('Shortcut triggered', {
            id: shortcut.id,
            key: shortcut.key,
          });
          shortcut.callback();
          break;
        }
      }
    },
    [shortcuts]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);
}

/**
 * Hook for a single keyboard shortcut
 * Convenience wrapper around useKeyboardShortcuts
 */
export function useKeyboardShortcut(
  key: string,
  callback: () => void,
  options: Omit<ShortcutConfig, 'id' | 'key' | 'callback'> = {}
) {
  useKeyboardShortcuts([
    {
      id: `shortcut-${key}`,
      key,
      callback,
      ...options,
    },
  ]);
}

/**
 * Format shortcut display text (e.g., "Cmd+K" or "Ctrl+K")
 */
export function formatShortcut(shortcut: ShortcutConfig): string {
  const isMac =
    typeof navigator !== 'undefined' &&
    /Mac|iPhone|iPad|iPod/.test(navigator.platform);
  const parts: string[] = [];

  if (shortcut.ctrlOrCmd) {
    parts.push(isMac ? 'Cmd' : 'Ctrl');
  }
  if (shortcut.shift) {
    parts.push('Shift');
  }
  if (shortcut.alt) {
    parts.push('Alt');
  }
  parts.push(shortcut.key.toUpperCase());

  return parts.join('+');
}

/**
 * Common shortcuts used throughout the app
 */
export const COMMON_SHORTCUTS = {
  COMMAND_PALETTE: {
    id: 'command-palette',
    key: 'k',
    ctrlOrCmd: true,
    description: 'Open command palette',
  },
  SEARCH: {
    id: 'search',
    key: '/',
    description: 'Focus search',
  },
  ESCAPE: {
    id: 'escape',
    key: 'Escape',
    description: 'Close dialog/cancel',
  },
  HELP: {
    id: 'help',
    key: '?',
    shift: true,
    description: 'Show help',
  },
} as const;
