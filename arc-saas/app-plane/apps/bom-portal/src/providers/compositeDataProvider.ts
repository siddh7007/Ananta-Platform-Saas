/**
 * Composite Data Provider for BOM Portal
 *
 * Routes requests to the appropriate backend:
 * - Supabase: Domain data (BOMs, projects, alerts, etc.) - App Plane
 * - LoopBack: Control Plane data (subscriptions, billing, tenant settings) - Control Plane
 *
 * Architecture:
 * ```
 * BOM Portal (Customer Portal)
 *   ├── Supabase DataProvider → App-Plane PostgreSQL
 *   │   └── boms, projects, alerts, users, organizations, bom_uploads, bom_line_items
 *   │
 *   └── LoopBack DataProvider → Control-Plane API (tenant-management-service)
 *       └── subscriptions, invoices, plans, tenant-users, settings, billing-analytics
 * ```
 *
 * This allows the customer portal to:
 * 1. Manage domain data (BOMs, projects) via Supabase
 * 2. View subscription/billing info via Control Plane APIs
 * 3. Manage tenant settings via Control Plane APIs
 */

import { DataProvider, Identifier, RaRecord } from 'react-admin';

/**
 * Resources that should be routed to LoopBack (Control Plane)
 *
 * These are tenant-management-service endpoints that provide:
 * - Subscription management
 * - Billing and invoices
 * - Tenant configuration
 * - User management (Control Plane level)
 */
const CONTROL_PLANE_RESOURCES = new Set([
  // Subscription & Billing
  'subscriptions',
  'plans',
  'invoices',
  'billing-analytics',
  'analytics',

  // Tenant Management
  'tenant-configs',
  'tenant-mgmt-configs',
  'tenant-settings',
  'settings',

  // Control Plane User Management
  'tenant-users',
  'cp-users', // Control Plane users (distinct from Supabase users)
  'user-invitations',
  'invitations',
  'user-activities',
  'activities',
  'roles',
  'user-roles',

  // Leads & Workflows (Control Plane operations)
  'leads',
  'lead-tenants',
  'workflows',
  'contacts',

  // Tenant info from Control Plane
  'cp-tenants', // Alias for Control Plane tenant data
]);

/**
 * Resource name aliases for Control Plane
 * Maps friendly names to Control Plane resource names
 */
const CONTROL_PLANE_ALIASES: Record<string, string> = {
  // Billing
  'billing-analytics': 'billing-analytics',
  'analytics': 'billing-analytics',

  // Invitations
  'invitations': 'user-invitations',

  // Activities
  'activities': 'user-activities',

  // Settings
  'settings': 'settings',
  'tenant-settings': 'settings',

  // Control Plane tenant data
  'cp-tenants': 'tenants',
  'cp-users': 'tenant-users',
};

/**
 * Check if a resource should be routed to Control Plane (LoopBack)
 */
const isControlPlaneResource = (resource: string): boolean => {
  return CONTROL_PLANE_RESOURCES.has(resource) ||
    CONTROL_PLANE_RESOURCES.has(resource.toLowerCase());
};

/**
 * Normalize resource name for Control Plane routing
 */
const normalizeControlPlaneResource = (resource: string): string => {
  return CONTROL_PLANE_ALIASES[resource] || resource;
};

/**
 * Create a composite data provider that routes to Supabase or LoopBack
 *
 * @param supabaseProvider - The Supabase data provider for domain data
 * @param loopbackProvider - The LoopBack data provider for Control Plane data
 * @param options - Configuration options
 */
export const createCompositeDataProvider = (
  supabaseProvider: DataProvider,
  loopbackProvider: DataProvider,
  options: {
    enableLogging?: boolean;
    /** Additional resources to route to Control Plane */
    additionalControlPlaneResources?: string[];
  } = {}
): DataProvider => {
  const { enableLogging = import.meta.env.DEV, additionalControlPlaneResources = [] } = options;

  // Add any additional Control Plane resources
  additionalControlPlaneResources.forEach((r) => CONTROL_PLANE_RESOURCES.add(r));

  /**
   * Get the appropriate provider for a resource
   */
  const getProvider = (resource: string): { provider: DataProvider; normalizedResource: string; backend: string } => {
    const isControlPlane = isControlPlaneResource(resource);
    const normalizedResource = isControlPlane
      ? normalizeControlPlaneResource(resource)
      : resource;

    if (enableLogging) {
      console.log(`[CompositeDataProvider] Routing "${resource}" → ${isControlPlane ? 'LoopBack (Control Plane)' : 'Supabase (App Plane)'}${resource !== normalizedResource ? ` (as "${normalizedResource}")` : ''}`);
    }

    return {
      provider: isControlPlane ? loopbackProvider : supabaseProvider,
      normalizedResource,
      backend: isControlPlane ? 'LoopBack' : 'Supabase',
    };
  };

  /**
   * Wrap provider method with logging and routing
   */
  const wrapMethod = <T extends keyof DataProvider>(
    methodName: T
  ) => {
    return async (resource: string, params: any): Promise<any> => {
      const { provider, normalizedResource, backend } = getProvider(resource);

      if (enableLogging) {
        console.log(`[CompositeDataProvider.${methodName}] ${backend} → ${normalizedResource}`, params);
      }

      try {
        const method = provider[methodName] as Function;
        const result = await method(normalizedResource, params);

        if (enableLogging) {
          console.log(`[CompositeDataProvider.${methodName}] ✅ Success from ${backend}`);
        }

        return result;
      } catch (error) {
        if (enableLogging) {
          console.error(`[CompositeDataProvider.${methodName}] ❌ Error from ${backend}:`, error);
        }
        throw error;
      }
    };
  };

  return {
    getList: wrapMethod('getList'),
    getOne: wrapMethod('getOne'),
    getMany: wrapMethod('getMany'),
    getManyReference: wrapMethod('getManyReference'),
    create: wrapMethod('create'),
    update: wrapMethod('update'),
    updateMany: wrapMethod('updateMany'),
    delete: wrapMethod('delete'),
    deleteMany: wrapMethod('deleteMany'),
  };
};

/**
 * Resource routing documentation
 *
 * ## Supabase (App Plane) Resources:
 * - `organizations` - Customer organizations
 * - `users` - Domain users (Supabase auth users)
 * - `projects` - BOM projects
 * - `boms` - Bill of Materials
 * - `bom_line_items` - BOM line items
 * - `bom_uploads` - BOM file uploads
 * - `bom_jobs` - BOM processing jobs
 * - `alerts` - System alerts
 *
 * ## LoopBack (Control Plane) Resources:
 * - `subscriptions` - Active subscriptions
 * - `plans` - Available pricing plans
 * - `invoices` - Invoice records
 * - `billing-analytics` - Billing metrics
 * - `tenant-users` - Control Plane user management
 * - `user-invitations` - User invitations
 * - `user-activities` - Activity logs
 * - `roles` - Role definitions
 * - `settings` - Tenant configuration
 * - `workflows` - Provisioning workflows
 * - `leads` - Lead management
 * - `contacts` - Tenant contacts
 *
 * ## Usage in Components:
 * ```tsx
 * // Domain data - goes to Supabase
 * const { data: boms } = useGetList('boms');
 * const { data: projects } = useGetList('projects');
 *
 * // Control Plane data - goes to LoopBack
 * const { data: subscription } = useGetOne('subscriptions', { id: tenantId });
 * const { data: invoices } = useGetList('invoices');
 * const { data: plan } = useGetOne('plans', { id: planId });
 * ```
 */

export default createCompositeDataProvider;
