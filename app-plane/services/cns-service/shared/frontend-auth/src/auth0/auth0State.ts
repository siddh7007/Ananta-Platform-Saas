/**
 * Auth0 State Bridge
 *
 * This module bridges Auth0's React context with React Admin's auth provider.
 * It provides a way for the auth provider (which can't use React hooks) to
 * access Auth0's authentication state.
 */

export type Auth0User = {
  email?: string;
  name?: string;
  picture?: string;
  sub?: string;
  [key: string]: any; // Allow additional properties like org_id
} | null;

export type Auth0State = {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: Auth0User;
  error: Error | null;
  /**
   * Function to get Auth0 access token silently
   * This is set by Auth0StateSync when Auth0 initializes
   */
  getAccessTokenSilently: (() => Promise<string>) | null;
};

// Shared state that can be updated by Auth0Provider wrapper
let auth0State: Auth0State = {
  isAuthenticated: false,
  isLoading: true,
  user: null,
  error: null,
  getAccessTokenSilently: null,
};

// Subscribers for state changes
type StateSubscriber = (state: Auth0State) => void;
const subscribers: Set<StateSubscriber> = new Set();

/**
 * Update Auth0 state (called by Auth0 wrapper component)
 */
export function updateAuth0State(newState: Partial<Auth0State>) {
  auth0State = { ...auth0State, ...newState };

  // Notify subscribers
  subscribers.forEach(subscriber => subscriber(auth0State));
}

/**
 * Get current Auth0 state
 */
export function getAuth0State(): Auth0State {
  return auth0State;
}

/**
 * Wait for Auth0 to finish initializing with production-grade retry logic
 *
 * Production SPAs (Next.js, Okta) wait 5-10 seconds with retries before declaring NO_SESSION.
 * This handles slow networks, browser extensions, and cold starts gracefully.
 *
 * @param timeoutMs - Max wait time in milliseconds (default: 10000ms = 10 seconds)
 * @param maxRetries - Number of retry attempts (default: 2)
 * @param requireTokenFunction - Wait for getAccessTokenSilently to be set (for Option A: Direct Auth0 JWT)
 */
export function waitForAuth0Ready(
  timeoutMs: number = 10000,
  maxRetries: number = 2,
  requireTokenFunction: boolean = false
): Promise<Auth0State> {
  return new Promise((resolve, reject) => {
    let attempts = 0;

    // Helper to check if state is fully ready
    const isStateReady = (state: Auth0State): boolean => {
      if (state.isLoading) return false;
      // If Option A mode requires the token function, wait for it
      if (requireTokenFunction && !state.getAccessTokenSilently) return false;
      return true;
    };

    const tryWait = () => {
      attempts++;

      // If already loaded, resolve immediately
      if (isStateReady(auth0State)) {
        resolve(auth0State);
        return;
      }

      // Calculate timeout for this attempt (with exponential backoff)
      const attemptTimeout = attempts === 1
        ? timeoutMs
        : timeoutMs * Math.pow(1.5, attempts - 1);

      // Set timeout
      const timeout = setTimeout(() => {
        if (attempts < maxRetries) {
          console.log(`[Auth0] Initialization timeout (attempt ${attempts}/${maxRetries}), retrying...`);
          tryWait(); // Retry
        } else {
          console.error(`[Auth0] Initialization timeout after ${maxRetries} attempts`);
          reject(new Error('Auth0 initialization timeout'));
        }
      }, attemptTimeout);

      // Subscribe to state changes
      const unsubscribe = () => {
        subscribers.delete(checkLoaded);
        clearTimeout(timeout);
      };

      const checkLoaded = (state: Auth0State) => {
        if (isStateReady(state)) {
          unsubscribe();
          console.log(`[Auth0] Initialized successfully (attempt ${attempts}/${maxRetries})`);
          resolve(state);
        }
      };

      subscribers.add(checkLoaded);
    };

    tryWait();
  });
}

/**
 * Subscribe to Auth0 state changes
 */
export function subscribeToAuth0State(subscriber: StateSubscriber): () => void {
  subscribers.add(subscriber);

  // Return unsubscribe function
  return () => {
    subscribers.delete(subscriber);
  };
}

/**
 * Reset Auth0 state (for logout)
 */
export function resetAuth0State() {
  // Preserve getAccessTokenSilently on reset - it's still valid from Auth0 SDK
  const currentGetToken = auth0State.getAccessTokenSilently;

  auth0State = {
    isAuthenticated: false,
    isLoading: false,
    user: null,
    error: null,
    getAccessTokenSilently: currentGetToken,
  };

  // Notify subscribers
  subscribers.forEach(subscriber => subscriber(auth0State));
}
