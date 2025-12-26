import { vi } from 'vitest';

// Mock environment variables
process.env.NEXT_PUBLIC_LOG_LEVEL = 'INFO';
process.env.NEXT_PUBLIC_ENABLE_CONSOLE_LOGGING = 'true';
process.env.NEXT_PUBLIC_ENABLE_REMOTE_LOGGING = 'false';
process.env.NEXT_PUBLIC_PLATFORM_API_URL = 'http://localhost:14000';
process.env.NEXT_PUBLIC_PLATFORM_API_PREFIX = '/cns';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

global.localStorage = localStorageMock as Storage;

// Mock console methods to suppress logs during tests
global.console = {
  ...console,
  log: vi.fn(),
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};
