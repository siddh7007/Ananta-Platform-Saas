import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useDebouncedCallback, useDebouncedValue } from '../../hooks/useDebounce';

describe('useDebounce hooks', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('useDebouncedCallback', () => {
    it('should debounce callback execution', () => {
      const callback = vi.fn();
      const { result } = renderHook(() => useDebouncedCallback(callback, 300));

      // Call multiple times rapidly
      act(() => {
        result.current('call1');
        result.current('call2');
        result.current('call3');
      });

      // Callback should not be called immediately
      expect(callback).not.toHaveBeenCalled();

      // Fast-forward time
      act(() => {
        vi.advanceTimersByTime(300);
      });

      // Callback should be called once with last argument
      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith('call3');
    });

    it('should reset timer on subsequent calls', () => {
      const callback = vi.fn();
      const { result } = renderHook(() => useDebouncedCallback(callback, 300));

      act(() => {
        result.current('call1');
      });

      act(() => {
        vi.advanceTimersByTime(200);
      });

      act(() => {
        result.current('call2');
      });

      act(() => {
        vi.advanceTimersByTime(200);
      });

      // Callback should not be called yet
      expect(callback).not.toHaveBeenCalled();

      act(() => {
        vi.advanceTimersByTime(100);
      });

      // Now it should be called
      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith('call2');
    });

    it('should use default delay of 300ms', () => {
      const callback = vi.fn();
      const { result } = renderHook(() => useDebouncedCallback(callback));

      act(() => {
        result.current();
      });

      act(() => {
        vi.advanceTimersByTime(299);
      });

      expect(callback).not.toHaveBeenCalled();

      act(() => {
        vi.advanceTimersByTime(1);
      });

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should handle custom delay', () => {
      const callback = vi.fn();
      const { result } = renderHook(() => useDebouncedCallback(callback, 1000));

      act(() => {
        result.current();
      });

      act(() => {
        vi.advanceTimersByTime(999);
      });

      expect(callback).not.toHaveBeenCalled();

      act(() => {
        vi.advanceTimersByTime(1);
      });

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should cleanup on unmount', () => {
      const callback = vi.fn();
      const { result, unmount } = renderHook(() => useDebouncedCallback(callback, 300));

      act(() => {
        result.current();
      });

      unmount();

      act(() => {
        vi.advanceTimersByTime(300);
      });

      // Callback should not be called after unmount
      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('useDebouncedValue', () => {
    it('should debounce value changes', async () => {
      const { result, rerender } = renderHook(
        ({ value }) => useDebouncedValue(value, 300),
        { initialProps: { value: 'initial' } }
      );

      expect(result.current).toBe('initial');

      // Change value rapidly
      rerender({ value: 'change1' });
      rerender({ value: 'change2' });
      rerender({ value: 'change3' });

      // Value should still be initial
      expect(result.current).toBe('initial');

      // Fast-forward time
      await act(async () => {
        vi.advanceTimersByTime(300);
      });

      // Value should update to last value
      await waitFor(() => {
        expect(result.current).toBe('change3');
      });
    });

    it('should use default delay of 300ms', async () => {
      const { result, rerender } = renderHook(
        ({ value }) => useDebouncedValue(value),
        { initialProps: { value: 'initial' } }
      );

      rerender({ value: 'updated' });

      await act(async () => {
        vi.advanceTimersByTime(299);
      });

      expect(result.current).toBe('initial');

      await act(async () => {
        vi.advanceTimersByTime(1);
      });

      await waitFor(() => {
        expect(result.current).toBe('updated');
      });
    });

    it('should reset timer on rapid changes', async () => {
      const { result, rerender } = renderHook(
        ({ value }) => useDebouncedValue(value, 300),
        { initialProps: { value: 'initial' } }
      );

      rerender({ value: 'change1' });

      await act(async () => {
        vi.advanceTimersByTime(200);
      });

      rerender({ value: 'change2' });

      await act(async () => {
        vi.advanceTimersByTime(200);
      });

      // Still initial because timer was reset
      expect(result.current).toBe('initial');

      await act(async () => {
        vi.advanceTimersByTime(100);
      });

      await waitFor(() => {
        expect(result.current).toBe('change2');
      });
    });

    it('should cleanup on unmount', async () => {
      const { result, rerender, unmount } = renderHook(
        ({ value }) => useDebouncedValue(value, 300),
        { initialProps: { value: 'initial' } }
      );

      rerender({ value: 'updated' });
      unmount();

      await act(async () => {
        vi.advanceTimersByTime(300);
      });

      // Value should not update after unmount
      expect(result.current).toBe('initial');
    });
  });
});
