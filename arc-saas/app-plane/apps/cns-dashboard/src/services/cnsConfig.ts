const DEFAULT_CNS_BASE_URL = 'http://localhost:27800';

export function getCnsBaseUrl(): string {
  return import.meta.env.VITE_CNS_API_URL || DEFAULT_CNS_BASE_URL;
}

