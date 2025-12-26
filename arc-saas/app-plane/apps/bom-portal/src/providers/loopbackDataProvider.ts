/**
 * LoopBack Data Provider for BOM Portal
 *
 * Configured instance of the LoopBack data provider for use with
 * ARC-SaaS tenant-management-service and Keycloak authentication.
 *
 * Key differences from Supabase data provider:
 * - RLS is enforced at application layer (LoopBack controllers) not database
 * - Uses standard REST API endpoints instead of PostgREST
 * - Token must be passed via Authorization header
 * - Pagination uses offset/limit pattern
 *
 * Security:
 * - Tenant isolation is enforced by LoopBack controllers
 * - JWT contains tenant_id claim from Keycloak
 * - All queries are filtered by tenant at the controller level
 */

import { DataProvider } from 'react-admin';
import { createLoopbackDataProvider } from '../lib/data/loopback';
import { getKeycloakState } from '../lib/auth';

/**
 * Resource name mapping for BOM Portal (Customer Portal)
 *
 * Maps React-Admin resource names to LoopBack endpoint paths.
 * This allows the frontend to use friendly names while the API
 * uses its own naming conventions.
 *
 * Based on tenant-management-service controllers:
 * - tenant.controller.ts          → /tenants
 * - tenant-users.controller.ts    → /tenant-users
 * - user-invitations.controller.ts → /user-invitations
 * - subscription.controller.ts    → /subscriptions
 * - plan.controller.ts            → /plans
 * - invoice.controller.ts         → /invoices
 * - workflow.controller.ts        → /workflows
 * - settings.controller.ts        → /settings
 * - roles.controller.ts           → /roles
 * - user-activity.controller.ts   → /user-activities
 * - lead.controller.ts            → /leads
 * - contact.controller.ts         → /contacts
 * - billing-analytics.controller.ts → /billing-analytics
 */
const RESOURCE_MAP: Record<string, string> = {
  // ============================================
  // USER MANAGEMENT (Customer Portal)
  // ============================================
  // Tenant users - users within the current tenant
  users: 'tenant-users',
  'tenant-users': 'tenant-users',

  // User invitations - invite new users to tenant
  invitations: 'user-invitations',
  'user-invitations': 'user-invitations',

  // User activity logs
  activities: 'user-activities',
  'user-activities': 'user-activities',

  // Roles - role definitions and assignments
  roles: 'roles',
  'user-roles': 'user-roles',

  // ============================================
  // TENANT & ORGANIZATION
  // ============================================
  // Tenant records (current tenant info)
  tenants: 'tenants',

  // Contacts associated with tenant
  contacts: 'contacts',

  // ============================================
  // SUBSCRIPTION & BILLING
  // ============================================
  // Active subscriptions
  subscriptions: 'subscriptions',

  // Available pricing plans
  plans: 'plans',

  // Invoice records
  invoices: 'invoices',

  // Billing analytics/metrics
  'billing-analytics': 'billing-analytics',
  analytics: 'billing-analytics',

  // ============================================
  // LEADS (for signup/onboarding flow)
  // ============================================
  leads: 'leads',
  'lead-tenants': 'leads', // Lead-to-tenant conversion

  // ============================================
  // WORKFLOWS & PROVISIONING
  // ============================================
  workflows: 'workflows',

  // ============================================
  // SETTINGS & CONFIGURATION
  // ============================================
  settings: 'settings',
  'tenant-configs': 'tenant-mgmt-configs',
};

/**
 * Get token from Keycloak state
 *
 * Uses the shared Keycloak state to get a fresh JWT token.
 * The token is automatically refreshed if needed.
 */
const getToken = async (): Promise<string | null> => {
  const state = getKeycloakState();

  if (!state.isAuthenticated) {
    console.warn('[LoopbackDataProvider] Not authenticated');
    return null;
  }

  if (state.getToken) {
    try {
      return await state.getToken();
    } catch (error) {
      console.error('[LoopbackDataProvider] Failed to get token:', error);
      return null;
    }
  }

  // Fallback to cached token
  return state.token;
};

/**
 * Create the LoopBack data provider instance
 *
 * This is a factory function that creates a fresh instance each time.
 * Use this if you need to recreate the provider after config changes.
 */
export const createBomPortalDataProvider = (): DataProvider => {
  const apiUrl = import.meta.env.VITE_CONTROL_PLANE_API_URL || 'http://localhost:14000';
  const enableLogging = import.meta.env.VITE_ENABLE_DATA_PROVIDER_LOGGING === 'true' ||
    import.meta.env.DEV;

  console.log('[LoopbackDataProvider] Creating data provider', {
    apiUrl,
    enableLogging,
    resourceCount: Object.keys(RESOURCE_MAP).length,
  });

  return createLoopbackDataProvider({
    apiUrl,
    getToken,
    resourceMap: RESOURCE_MAP,
    primaryKey: 'id',
    enableLogging,
    customHeaders: {
      // Add any custom headers needed for ARC-SaaS
      'X-Client': 'bom-portal',
    },
  });
};

/**
 * Default LoopBack data provider instance
 *
 * This is the main data provider to use in App.tsx.
 * It's created once at module load time.
 *
 * @example
 * ```tsx
 * import { loopbackDataProvider } from './providers/loopbackDataProvider';
 *
 * function App() {
 *   return (
 *     <Admin dataProvider={loopbackDataProvider}>
 *       ...
 *     </Admin>
 *   );
 * }
 * ```
 */
export const loopbackDataProvider = createBomPortalDataProvider();

/**
 * Export resource map for use in other parts of the app
 */
export { RESOURCE_MAP };

export default loopbackDataProvider;
