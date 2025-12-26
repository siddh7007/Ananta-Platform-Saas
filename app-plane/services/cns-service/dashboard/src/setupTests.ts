import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock environment variables
process.env.VITE_CNS_API_URL = 'http://localhost:27200';
process.env.VITE_AUTH0_DOMAIN = 'test.auth0.com';
process.env.VITE_AUTH0_CLIENT_ID = 'test-client-id';
process.env.VITE_AUTH0_AUDIENCE = 'test-audience';
process.env.VITE_KEYCLOAK_URL = 'http://localhost:8180';
process.env.VITE_KEYCLOAK_REALM = 'test-realm';
process.env.VITE_KEYCLOAK_CLIENT_ID = 'test-client';

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  takeRecords() {
    return [];
  }
  unobserve() {}
} as any;

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
} as any;

// Mock scrollTo
window.scrollTo = vi.fn();

// Suppress console errors during tests (optional - can be removed if you want to see all errors)
const originalError = console.error;
beforeAll(() => {
  console.error = (...args: any[]) => {
    if (
      typeof args[0] === 'string' &&
      (args[0].includes('Warning: ReactDOM.render') ||
        args[0].includes('Not implemented: HTMLFormElement.prototype.submit'))
    ) {
      return;
    }
    originalError.call(console, ...args);
  };
});

afterAll(() => {
  console.error = originalError;
});
