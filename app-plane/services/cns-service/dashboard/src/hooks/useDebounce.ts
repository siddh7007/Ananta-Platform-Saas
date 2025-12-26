/**
 * Debounce Hook
 *
 * Provides debouncing utilities for preventing rapid-fire API calls.
 *
 * Features:
 * - useDebouncedCallback: Debounce function calls
 * - useDebouncedValue: Debounce state value changes
 */

import { useCallback, useRef, useEffect, useState } from 'react';

/**
 * Returns a debounced version of the callback function.
 * Useful for refresh buttons, search inputs, etc.
 *
 * @param callback - The function to debounce
 * @param delay - Debounce delay in milliseconds (default: 300ms)
 * @returns Debounced callback function
 */
export function useDebouncedCallback<T extends (...args: unknown[]) => unknown>(
  callback: T,
  delay = 300
): (...args: Parameters<T>) => void {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callbackRef = useRef(callback);

  // Keep callback ref updated
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return useCallback(
    (...args: Parameters<T>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        callbackRef.current(...args);
      }, delay);
    },
    [delay]
  );
}

/**
 * Returns a debounced version of the value.
 * Useful for search input values that trigger API calls.
 *
 * @param value - The value to debounce
 * @param delay - Debounce delay in milliseconds (default: 300ms)
 * @returns Debounced value
 */
export function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

export default useDebouncedCallback;
