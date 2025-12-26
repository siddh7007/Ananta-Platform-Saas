/**
 * LoopBack Data Provider Module
 *
 * Provides React-Admin data provider for ARC-SaaS LoopBack backend.
 * Designed to work with Keycloak authentication where tenant isolation
 * is enforced at the LoopBack controller level.
 *
 * @example
 * ```tsx
 * import { createLoopbackDataProvider } from './lib/data/loopback';
 *
 * const dataProvider = createLoopbackDataProvider({
 *   apiUrl: 'http://localhost:14000',
 *   getToken: async () => keycloakState.getToken?.() || null,
 * });
 * ```
 */

export {
  createLoopbackDataProvider,
  type LoopbackDataProviderConfig,
} from './createLoopbackDataProvider';

export { default } from './createLoopbackDataProvider';
