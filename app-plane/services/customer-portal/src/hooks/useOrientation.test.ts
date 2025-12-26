import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useOrientation, useIsPortrait, useIsLandscape } from './useOrientation';

describe('useOrientation', () => {
  const originalInnerWidth = window.innerWidth;
  const originalInnerHeight = window.innerHeight;

  beforeEach(() => {
    // Mock window dimensions
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1024,
    });
    Object.defineProperty(window, 'innerHeight', {
      writable: true,
      configurable: true,
      value: 768,
    });
  });

  afterEach(() => {
    // Restore original dimensions
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: originalInnerWidth,
    });
    Object.defineProperty(window, 'innerHeight', {
      writable: true,
      configurable: true,
      value: originalInnerHeight,
    });
  });

  it('should detect landscape orientation when width > height', () => {
    const { result } = renderHook(() => useOrientation());

    expect(result.current.orientation).toBe('landscape');
    expect(result.current.isLandscape).toBe(true);
    expect(result.current.isPortrait).toBe(false);
  });

  it('should detect portrait orientation when height > width', () => {
    Object.defineProperty(window, 'innerWidth', { value: 768, writable: true });
    Object.defineProperty(window, 'innerHeight', { value: 1024, writable: true });

    const { result } = renderHook(() => useOrientation());

    expect(result.current.orientation).toBe('portrait');
    expect(result.current.isPortrait).toBe(true);
    expect(result.current.isLandscape).toBe(false);
  });

  it('should update orientation on window resize', () => {
    const { result } = renderHook(() => useOrientation());

    expect(result.current.isLandscape).toBe(true);

    act(() => {
      Object.defineProperty(window, 'innerWidth', { value: 768, writable: true });
      Object.defineProperty(window, 'innerHeight', { value: 1024, writable: true });
      window.dispatchEvent(new Event('resize'));
    });

    expect(result.current.isPortrait).toBe(true);
  });
});

describe('useIsPortrait', () => {
  it('should return true when in portrait mode', () => {
    Object.defineProperty(window, 'innerWidth', { value: 768, writable: true });
    Object.defineProperty(window, 'innerHeight', { value: 1024, writable: true });

    const { result } = renderHook(() => useIsPortrait());
    expect(result.current).toBe(true);
  });

  it('should return false when in landscape mode', () => {
    Object.defineProperty(window, 'innerWidth', { value: 1024, writable: true });
    Object.defineProperty(window, 'innerHeight', { value: 768, writable: true });

    const { result } = renderHook(() => useIsPortrait());
    expect(result.current).toBe(false);
  });
});

describe('useIsLandscape', () => {
  it('should return true when in landscape mode', () => {
    Object.defineProperty(window, 'innerWidth', { value: 1024, writable: true });
    Object.defineProperty(window, 'innerHeight', { value: 768, writable: true });

    const { result } = renderHook(() => useIsLandscape());
    expect(result.current).toBe(true);
  });

  it('should return false when in portrait mode', () => {
    Object.defineProperty(window, 'innerWidth', { value: 768, writable: true });
    Object.defineProperty(window, 'innerHeight', { value: 1024, writable: true });

    const { result } = renderHook(() => useIsLandscape());
    expect(result.current).toBe(false);
  });
});
