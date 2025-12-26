import { renderHook } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  useTouchDevice,
  useIsTablet,
  useIsMobile,
  useIsDesktop,
} from './useTouchDevice';

describe('useTouchDevice', () => {
  beforeEach(() => {
    // Mock touch support
    Object.defineProperty(window, 'ontouchstart', {
      writable: true,
      configurable: true,
      value: undefined,
    });
    Object.defineProperty(navigator, 'maxTouchPoints', {
      writable: true,
      configurable: true,
      value: 0,
    });
  });

  it('should detect touch device', () => {
    Object.defineProperty(window, 'ontouchstart', { value: null, writable: true });
    Object.defineProperty(navigator, 'maxTouchPoints', { value: 5, writable: true });

    const { result } = renderHook(() => useTouchDevice());

    expect(result.current.isTouchDevice).toBe(true);
  });

  it('should detect non-touch device', () => {
    const { result } = renderHook(() => useTouchDevice());
    expect(result.current.isTouchDevice).toBe(false);
  });

  it('should detect tablet device', () => {
    Object.defineProperty(window, 'ontouchstart', { value: null, writable: true });
    Object.defineProperty(navigator, 'maxTouchPoints', { value: 5, writable: true });
    Object.defineProperty(window, 'innerWidth', { value: 1024, writable: true });
    Object.defineProperty(window, 'innerHeight', { value: 768, writable: true });

    const { result } = renderHook(() => useTouchDevice());

    expect(result.current.isTablet).toBe(true);
    expect(result.current.isMobile).toBe(false);
    expect(result.current.isDesktop).toBe(false);
  });

  it('should detect mobile device', () => {
    Object.defineProperty(window, 'ontouchstart', { value: null, writable: true });
    Object.defineProperty(navigator, 'maxTouchPoints', { value: 5, writable: true });
    Object.defineProperty(window, 'innerWidth', { value: 375, writable: true });
    Object.defineProperty(window, 'innerHeight', { value: 667, writable: true });

    const { result } = renderHook(() => useTouchDevice());

    expect(result.current.isMobile).toBe(true);
    expect(result.current.isTablet).toBe(false);
    expect(result.current.isDesktop).toBe(false);
  });

  it('should detect desktop device', () => {
    Object.defineProperty(window, 'innerWidth', { value: 1920, writable: true });
    Object.defineProperty(window, 'innerHeight', { value: 1080, writable: true });

    const { result } = renderHook(() => useTouchDevice());

    expect(result.current.isDesktop).toBe(true);
    expect(result.current.isTablet).toBe(false);
    expect(result.current.isMobile).toBe(false);
  });
});

describe('useIsTablet', () => {
  it('should return true for tablet', () => {
    Object.defineProperty(window, 'ontouchstart', { value: null, writable: true });
    Object.defineProperty(navigator, 'maxTouchPoints', { value: 5, writable: true });
    Object.defineProperty(window, 'innerWidth', { value: 1024, writable: true });
    Object.defineProperty(window, 'innerHeight', { value: 768, writable: true });

    const { result } = renderHook(() => useIsTablet());
    expect(result.current).toBe(true);
  });
});

describe('useIsMobile', () => {
  it('should return true for mobile', () => {
    Object.defineProperty(window, 'ontouchstart', { value: null, writable: true });
    Object.defineProperty(navigator, 'maxTouchPoints', { value: 5, writable: true });
    Object.defineProperty(window, 'innerWidth', { value: 375, writable: true });
    Object.defineProperty(window, 'innerHeight', { value: 667, writable: true });

    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(true);
  });
});

describe('useIsDesktop', () => {
  it('should return true for desktop', () => {
    Object.defineProperty(window, 'innerWidth', { value: 1920, writable: true });
    Object.defineProperty(window, 'innerHeight', { value: 1080, writable: true });

    const { result } = renderHook(() => useIsDesktop());
    expect(result.current).toBe(true);
  });
});
