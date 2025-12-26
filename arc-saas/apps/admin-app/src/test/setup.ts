/**
 * Vitest Test Setup
 *
 * Configures the test environment with jsdom and testing-library matchers.
 */

import '@testing-library/jest-dom/vitest';
import { vi, beforeEach } from 'vitest';

// Mock localStorage for tests
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn(),
};

// Set up window mocks if window is defined (jsdom environment)
// In jsdom, localStorage is already provided, so we just need to spy on it
if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
  // jsdom provides localStorage, so we use it directly
  vi.spyOn(window.localStorage, 'getItem').mockImplementation(localStorageMock.getItem);
  vi.spyOn(window.localStorage, 'setItem').mockImplementation(localStorageMock.setItem);
  vi.spyOn(window.localStorage, 'removeItem').mockImplementation(localStorageMock.removeItem);
  vi.spyOn(window.localStorage, 'clear').mockImplementation(localStorageMock.clear);
}

// Reset mocks between tests
beforeEach(() => {
  vi.clearAllMocks();
  localStorageMock.getItem.mockReset();
  localStorageMock.setItem.mockReset();
});
