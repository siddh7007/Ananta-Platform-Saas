/**
 * Keycloak State Management
 *
 * Shared state for Keycloak authentication similar to Auth0 state.
 * Used to bridge the gap between Keycloak's context-based auth
 * and the auth provider which runs outside React context.
 */

export interface KeycloakUser {
  sub: string;
  email?: string;
  name?: string;
  given_name?: string;
  family_name?: string;
  preferred_username?: string;
  picture?: string;
  // Keycloak-specific claims
  realm_access?: {
    roles: string[];
  };
  resource_access?: {
    [clientId: string]: {
      roles: string[];
    };
  };
  // Custom claims for tenant context
  tenant_id?: string;
  organization_id?: string;
  // Groups from Keycloak
  groups?: string[];
}

export interface KeycloakState {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: KeycloakUser | null;
  token: string | null;
  refreshToken: string | null;
  getToken: (() => Promise<string>) | null;
  logout: (() => void) | null;
}

// Default state
const defaultState: KeycloakState = {
  isAuthenticated: false,
  isLoading: true,
  user: null,
  token: null,
  refreshToken: null,
  getToken: null,
  logout: null,
};

// Shared Keycloak state
let keycloakState: KeycloakState = { ...defaultState };

// Listeners for state changes
const stateChangeListeners: Array<(state: KeycloakState) => void> = [];

/**
 * Get current Keycloak state
 */
export function getKeycloakState(): KeycloakState {
  return keycloakState;
}

/**
 * Set Keycloak state (called by KeycloakStateSync component)
 */
export function setKeycloakState(newState: Partial<KeycloakState>): void {
  keycloakState = { ...keycloakState, ...newState };

  // Notify listeners
  stateChangeListeners.forEach(listener => {
    try {
      listener(keycloakState);
    } catch (err) {
      console.error('[KeycloakState] Error in state change listener:', err);
    }
  });
}

/**
 * Reset Keycloak state to default
 */
export function resetKeycloakState(): void {
  keycloakState = { ...defaultState };
  stateChangeListeners.forEach(listener => {
    try {
      listener(keycloakState);
    } catch (err) {
      console.error('[KeycloakState] Error in state change listener:', err);
    }
  });
}

/**
 * Subscribe to state changes
 */
export function subscribeToKeycloakState(
  listener: (state: KeycloakState) => void
): () => void {
  stateChangeListeners.push(listener);
  return () => {
    const index = stateChangeListeners.indexOf(listener);
    if (index > -1) {
      stateChangeListeners.splice(index, 1);
    }
  };
}

/**
 * Wait for Keycloak to be ready
 */
export async function waitForKeycloakReady(
  timeoutMs: number = 10000,
  retries: number = 2
): Promise<KeycloakState> {
  const startTime = Date.now();
  let attempts = 0;

  while (attempts <= retries) {
    // Check if already ready
    if (!keycloakState.isLoading) {
      return keycloakState;
    }

    // Wait for state change
    const result = await new Promise<KeycloakState | 'timeout'>((resolve) => {
      const cleanup = () => {
        clearTimeout(timeoutId);
        unsubscribe();
      };

      const timeoutId = setTimeout(() => {
        cleanup();
        resolve('timeout');
      }, timeoutMs);

      const unsubscribe = subscribeToKeycloakState((state) => {
        if (!state.isLoading) {
          cleanup();
          resolve(state);
        }
      });

      // Check again in case state changed while setting up
      if (!keycloakState.isLoading) {
        cleanup();
        resolve(keycloakState);
      }
    });

    if (result !== 'timeout') {
      return result;
    }

    attempts++;
    console.warn(`[KeycloakState] Timeout waiting for Keycloak (attempt ${attempts}/${retries + 1})`);
  }

  const elapsed = Date.now() - startTime;
  throw new Error(`Keycloak initialization timed out after ${elapsed}ms`);
}
