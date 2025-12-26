/**
 * useKeyboardShortcuts Hook Tests
 *
 * Tests for keyboard shortcut matching logic, especially modifier key handling.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useKeyboardShortcuts, formatShortcut, type ShortcutConfig } from './useKeyboardShortcuts';

// Helper to create and dispatch keyboard events
function dispatchKeyEvent(
  key: string,
  options: {
    ctrlKey?: boolean;
    metaKey?: boolean;
    shiftKey?: boolean;
    altKey?: boolean;
  } = {}
) {
  const event = new KeyboardEvent('keydown', {
    key,
    ctrlKey: options.ctrlKey ?? false,
    metaKey: options.metaKey ?? false,
    shiftKey: options.shiftKey ?? false,
    altKey: options.altKey ?? false,
    bubbles: true,
    cancelable: true,
  });
  document.dispatchEvent(event);
  return event;
}

describe('useKeyboardShortcuts', () => {
  let callback: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    callback = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('basic shortcut matching', () => {
    it('should trigger callback when exact key is pressed', () => {
      const shortcuts: ShortcutConfig[] = [
        { id: 'test', key: 'k', callback },
      ];

      renderHook(() => useKeyboardShortcuts(shortcuts));
      dispatchKeyEvent('k');

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should be case-insensitive for key matching', () => {
      const shortcuts: ShortcutConfig[] = [
        { id: 'test', key: 'K', callback },
      ];

      renderHook(() => useKeyboardShortcuts(shortcuts));
      dispatchKeyEvent('k');

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should not trigger disabled shortcuts', () => {
      const shortcuts: ShortcutConfig[] = [
        { id: 'test', key: 'k', callback, enabled: false },
      ];

      renderHook(() => useKeyboardShortcuts(shortcuts));
      dispatchKeyEvent('k');

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('modifier key handling', () => {
    it('should trigger Ctrl+K shortcut with Ctrl pressed', () => {
      const shortcuts: ShortcutConfig[] = [
        { id: 'test', key: 'k', ctrlOrCmd: true, callback },
      ];

      renderHook(() => useKeyboardShortcuts(shortcuts));
      dispatchKeyEvent('k', { ctrlKey: true });

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should trigger Cmd+K shortcut with Meta pressed (Mac)', () => {
      const shortcuts: ShortcutConfig[] = [
        { id: 'test', key: 'k', ctrlOrCmd: true, callback },
      ];

      renderHook(() => useKeyboardShortcuts(shortcuts));
      dispatchKeyEvent('k', { metaKey: true });

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should NOT trigger Ctrl+K when only K is pressed', () => {
      const shortcuts: ShortcutConfig[] = [
        { id: 'test', key: 'k', ctrlOrCmd: true, callback },
      ];

      renderHook(() => useKeyboardShortcuts(shortcuts));
      dispatchKeyEvent('k');

      expect(callback).not.toHaveBeenCalled();
    });

    it('should trigger Shift+? shortcut', () => {
      const shortcuts: ShortcutConfig[] = [
        { id: 'help', key: '?', shift: true, callback },
      ];

      renderHook(() => useKeyboardShortcuts(shortcuts));
      dispatchKeyEvent('?', { shiftKey: true });

      expect(callback).toHaveBeenCalledTimes(1);
    });
  });

  describe('modifier key exclusivity - CRITICAL REGRESSION TESTS', () => {
    /**
     * CRITICAL: These tests ensure that shortcuts without specific modifiers
     * do NOT fire when those modifiers are pressed. This prevents unintended
     * shortcut triggers (e.g., Cmd+Shift+K should NOT trigger Cmd+K).
     */

    it('should NOT trigger Cmd+K when Cmd+Shift+K is pressed', () => {
      const shortcuts: ShortcutConfig[] = [
        { id: 'command-palette', key: 'k', ctrlOrCmd: true, callback },
      ];

      renderHook(() => useKeyboardShortcuts(shortcuts));
      dispatchKeyEvent('k', { metaKey: true, shiftKey: true });

      expect(callback).not.toHaveBeenCalled();
    });

    it('should NOT trigger Cmd+K when Cmd+Alt+K is pressed', () => {
      const shortcuts: ShortcutConfig[] = [
        { id: 'command-palette', key: 'k', ctrlOrCmd: true, callback },
      ];

      renderHook(() => useKeyboardShortcuts(shortcuts));
      dispatchKeyEvent('k', { metaKey: true, altKey: true });

      expect(callback).not.toHaveBeenCalled();
    });

    it('should NOT trigger plain K shortcut when Shift+K is pressed', () => {
      const shortcuts: ShortcutConfig[] = [
        { id: 'test', key: 'k', callback },
      ];

      renderHook(() => useKeyboardShortcuts(shortcuts));
      dispatchKeyEvent('k', { shiftKey: true });

      expect(callback).not.toHaveBeenCalled();
    });

    it('should NOT trigger plain K shortcut when Alt+K is pressed', () => {
      const shortcuts: ShortcutConfig[] = [
        { id: 'test', key: 'k', callback },
      ];

      renderHook(() => useKeyboardShortcuts(shortcuts));
      dispatchKeyEvent('k', { altKey: true });

      expect(callback).not.toHaveBeenCalled();
    });

    it('should trigger Cmd+Shift+K when explicitly configured', () => {
      const shortcuts: ShortcutConfig[] = [
        { id: 'test', key: 'k', ctrlOrCmd: true, shift: true, callback },
      ];

      renderHook(() => useKeyboardShortcuts(shortcuts));
      dispatchKeyEvent('k', { metaKey: true, shiftKey: true });

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should NOT trigger Cmd+Shift+K when only Cmd+K is pressed', () => {
      const shortcuts: ShortcutConfig[] = [
        { id: 'test', key: 'k', ctrlOrCmd: true, shift: true, callback },
      ];

      renderHook(() => useKeyboardShortcuts(shortcuts));
      dispatchKeyEvent('k', { metaKey: true });

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('multiple shortcuts', () => {
    it('should only trigger the first matching shortcut', () => {
      const callback2 = vi.fn();
      const shortcuts: ShortcutConfig[] = [
        { id: 'first', key: 'k', callback },
        { id: 'second', key: 'k', callback: callback2 },
      ];

      renderHook(() => useKeyboardShortcuts(shortcuts));
      dispatchKeyEvent('k');

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback2).not.toHaveBeenCalled();
    });

    it('should match different shortcuts independently', () => {
      const callbackJ = vi.fn();
      const shortcuts: ShortcutConfig[] = [
        { id: 'shortcut-k', key: 'k', ctrlOrCmd: true, callback },
        { id: 'shortcut-j', key: 'j', ctrlOrCmd: true, callback: callbackJ },
      ];

      renderHook(() => useKeyboardShortcuts(shortcuts));

      dispatchKeyEvent('k', { metaKey: true });
      expect(callback).toHaveBeenCalledTimes(1);
      expect(callbackJ).not.toHaveBeenCalled();

      dispatchKeyEvent('j', { metaKey: true });
      expect(callback).toHaveBeenCalledTimes(1);
      expect(callbackJ).toHaveBeenCalledTimes(1);
    });
  });
});

describe('formatShortcut', () => {
  // Mock navigator.platform for consistent tests
  const originalPlatform = Object.getOwnPropertyDescriptor(navigator, 'platform');

  afterEach(() => {
    if (originalPlatform) {
      Object.defineProperty(navigator, 'platform', originalPlatform);
    }
  });

  it('should format Ctrl+K on non-Mac', () => {
    Object.defineProperty(navigator, 'platform', {
      value: 'Win32',
      configurable: true,
    });

    const shortcut: ShortcutConfig = {
      id: 'test',
      key: 'k',
      ctrlOrCmd: true,
      callback: vi.fn(),
    };

    expect(formatShortcut(shortcut)).toBe('Ctrl+K');
  });

  it('should format Cmd+K on Mac', () => {
    Object.defineProperty(navigator, 'platform', {
      value: 'MacIntel',
      configurable: true,
    });

    const shortcut: ShortcutConfig = {
      id: 'test',
      key: 'k',
      ctrlOrCmd: true,
      callback: vi.fn(),
    };

    expect(formatShortcut(shortcut)).toBe('Cmd+K');
  });

  it('should format Shift+? correctly', () => {
    Object.defineProperty(navigator, 'platform', {
      value: 'Win32',
      configurable: true,
    });

    const shortcut: ShortcutConfig = {
      id: 'help',
      key: '?',
      shift: true,
      callback: vi.fn(),
    };

    expect(formatShortcut(shortcut)).toBe('Shift+?');
  });

  it('should format complex shortcuts with multiple modifiers', () => {
    Object.defineProperty(navigator, 'platform', {
      value: 'Win32',
      configurable: true,
    });

    const shortcut: ShortcutConfig = {
      id: 'test',
      key: 'p',
      ctrlOrCmd: true,
      shift: true,
      alt: true,
      callback: vi.fn(),
    };

    expect(formatShortcut(shortcut)).toBe('Ctrl+Shift+Alt+P');
  });
});
