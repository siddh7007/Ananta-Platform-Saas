/**
 * API retry utilities with exponential backoff and circuit breaker
 */

export interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  retryableStatuses: number[];
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 10000,
  retryableStatuses: [408, 429, 500, 502, 503, 504],
};

/**
 * Calculate exponential backoff delay with jitter
 */
export function calculateBackoff(
  attempt: number,
  baseDelay: number,
  maxDelay: number
): number {
  const exponentialDelay = baseDelay * Math.pow(2, attempt);
  const jitter = Math.random() * 0.3 * exponentialDelay; // 30% jitter
  return Math.min(exponentialDelay + jitter, maxDelay);
}

/**
 * Determine if a request should be retried based on error
 */
export function shouldRetry(
  error: unknown,
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): boolean {
  // Network errors - always retry
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return true;
  }

  // HTTP errors with retryable status codes
  if (error && typeof error === 'object' && 'status' in error) {
    const status = (error as { status: number }).status;
    return config.retryableStatuses.includes(status);
  }

  // Axios errors
  if (error && typeof error === 'object' && 'response' in error) {
    const response = (error as { response?: { status: number } }).response;
    if (response?.status) {
      return config.retryableStatuses.includes(response.status);
    }
    // Network error (no response)
    return true;
  }

  return false;
}

/**
 * Sleep for specified milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Execute a function with retry logic
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  config: Partial<RetryConfig> = {}
): Promise<T> {
  const fullConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
  let lastError: unknown;

  for (let attempt = 0; attempt <= fullConfig.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt === fullConfig.maxRetries || !shouldRetry(error, fullConfig)) {
        throw error;
      }

      const delay = calculateBackoff(
        attempt,
        fullConfig.baseDelayMs,
        fullConfig.maxDelayMs
      );

      console.warn(
        `Request failed (attempt ${attempt + 1}/${fullConfig.maxRetries + 1}), ` +
          `retrying in ${Math.round(delay)}ms...`,
        error
      );

      await sleep(delay);
    }
  }

  throw lastError;
}

// ============================================
// Circuit Breaker
// ============================================

export interface CircuitBreakerConfig {
  failureThreshold: number;
  successThreshold: number;
  timeout: number; // ms before trying half-open
}

export const DEFAULT_CIRCUIT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  successThreshold: 2,
  timeout: 30000, // 30 seconds
};

type CircuitState = 'closed' | 'open' | 'half-open';

interface CircuitBreakerState {
  state: CircuitState;
  failures: number;
  successes: number;
  lastFailure: number | null;
}

const circuitStates = new Map<string, CircuitBreakerState>();

function getCircuitState(key: string): CircuitBreakerState {
  if (!circuitStates.has(key)) {
    circuitStates.set(key, {
      state: 'closed',
      failures: 0,
      successes: 0,
      lastFailure: null,
    });
  }
  return circuitStates.get(key)!;
}

/**
 * Execute a function with circuit breaker protection
 */
export async function withCircuitBreaker<T>(
  key: string,
  fn: () => Promise<T>,
  config: Partial<CircuitBreakerConfig> = {}
): Promise<T> {
  const fullConfig = { ...DEFAULT_CIRCUIT_CONFIG, ...config };
  const circuit = getCircuitState(key);

  // Check if circuit is open
  if (circuit.state === 'open') {
    const timeSinceFailure = Date.now() - (circuit.lastFailure || 0);
    if (timeSinceFailure < fullConfig.timeout) {
      throw new Error(`Circuit breaker open for "${key}". Try again later.`);
    }
    // Transition to half-open
    circuit.state = 'half-open';
    circuit.successes = 0;
  }

  try {
    const result = await fn();

    // Success handling
    if (circuit.state === 'half-open') {
      circuit.successes++;
      if (circuit.successes >= fullConfig.successThreshold) {
        // Close circuit
        circuit.state = 'closed';
        circuit.failures = 0;
        circuit.successes = 0;
        console.log(`Circuit breaker closed for "${key}"`);
      }
    } else {
      circuit.failures = 0; // Reset on success
    }

    return result;
  } catch (error) {
    // Failure handling
    circuit.failures++;
    circuit.lastFailure = Date.now();

    if (circuit.state === 'half-open') {
      // Immediately re-open on failure
      circuit.state = 'open';
      console.warn(`Circuit breaker re-opened for "${key}"`);
    } else if (circuit.failures >= fullConfig.failureThreshold) {
      circuit.state = 'open';
      console.warn(
        `Circuit breaker opened for "${key}" after ${circuit.failures} failures`
      );
    }

    throw error;
  }
}

/**
 * Get current state of a circuit
 */
export function getCircuitStatus(key: string): CircuitState {
  return getCircuitState(key).state;
}

/**
 * Reset a circuit breaker
 */
export function resetCircuit(key: string): void {
  circuitStates.delete(key);
}

/**
 * Combined retry + circuit breaker
 */
export async function withResilience<T>(
  key: string,
  fn: () => Promise<T>,
  retryConfig?: Partial<RetryConfig>,
  circuitConfig?: Partial<CircuitBreakerConfig>
): Promise<T> {
  return withCircuitBreaker(key, () => withRetry(fn, retryConfig), circuitConfig);
}
