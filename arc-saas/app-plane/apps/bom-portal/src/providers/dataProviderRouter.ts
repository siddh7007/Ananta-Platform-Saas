/**
 * Data Provider Router
 *
 * Intelligently routes to the appropriate data provider based on environment configuration.
 * This mirrors the authProvider router pattern for consistency.
 *
 * BACKEND OPTIONS:
 * - 'composite': Dual-backend mode (recommended for production)
 *                Routes to Supabase for domain data, LoopBack for Control Plane
 * - 'loopback':  ARC-SaaS LoopBack backend only
 * - 'supabase':  Supabase PostgREST only (legacy)
 *
 * This is the ONLY data provider that should be imported into App.tsx
 */

import { DataProvider } from 'react-admin';

/**
 * Get the appropriate data provider based on configuration
 *
 * Configuration priority:
 * 1. VITE_DATA_PROVIDER env var (explicit backend selection)
 * 2. VITE_AUTH_PROVIDER env var (infer backend from auth)
 * 3. Default to 'composite' for ARC-SaaS with full functionality
 */
const getDataProvider = async (): Promise<DataProvider> => {
  // Check explicit data provider setting
  const explicitDataProvider = import.meta.env.VITE_DATA_PROVIDER?.toLowerCase();

  // Check auth provider to infer data provider if not explicitly set
  const authProvider = import.meta.env.VITE_AUTH_PROVIDER?.toLowerCase() || 'keycloak';

  // Determine which data provider to use
  let dataProviderType: 'composite' | 'loopback' | 'supabase';

  if (explicitDataProvider) {
    if (explicitDataProvider === 'supabase') {
      dataProviderType = 'supabase';
    } else if (explicitDataProvider === 'loopback') {
      dataProviderType = 'loopback';
    } else {
      dataProviderType = 'composite';
    }
  } else if (authProvider === 'keycloak') {
    // Keycloak auth implies ARC-SaaS → use composite (Supabase + LoopBack)
    dataProviderType = 'composite';
  } else if (authProvider === 'supabase') {
    // Supabase auth implies Supabase-only backend
    dataProviderType = 'supabase';
  } else {
    // Default to composite for full ARC-SaaS functionality
    dataProviderType = 'composite';
  }

  console.log('[DataProviderRouter] Selecting data provider', {
    explicit: explicitDataProvider,
    authProvider,
    selected: dataProviderType,
  });

  if (dataProviderType === 'composite') {
    console.log('✅ Using Composite data provider (Supabase + LoopBack)');
    console.log('   📦 Domain data (boms, projects, alerts) → Supabase');
    console.log('   🔧 Control Plane (subscriptions, billing) → LoopBack');

    const { createCompositeDataProvider } = await import('./compositeDataProvider');
    const { dataProvider: supabaseProvider } = await import('./dataProvider');
    const { loopbackDataProvider } = await import('./loopbackDataProvider');

    return createCompositeDataProvider(supabaseProvider, loopbackDataProvider, {
      enableLogging: import.meta.env.DEV || import.meta.env.VITE_ENABLE_DATA_PROVIDER_LOGGING === 'true',
    });
  }

  if (dataProviderType === 'loopback') {
    console.log('✅ Using LoopBack data provider only (Control Plane)');
    const { loopbackDataProvider } = await import('./loopbackDataProvider');
    return loopbackDataProvider;
  }

  // Fallback to Supabase data provider
  console.log('📦 Using Supabase data provider only (legacy)');
  const { dataProvider } = await import('./dataProvider');
  return dataProvider;
};

/**
 * Data Provider Promise
 *
 * Since the data provider selection may involve async imports,
 * we export a promise that resolves to the selected provider.
 *
 * Usage in App.tsx:
 * ```tsx
 * import { dataProviderPromise } from './providers/dataProviderRouter';
 *
 * function App() {
 *   const [dataProvider, setDataProvider] = useState<DataProvider | null>(null);
 *
 *   useEffect(() => {
 *     dataProviderPromise.then(setDataProvider);
 *   }, []);
 *
 *   if (!dataProvider) return <Loading />;
 *
 *   return <Admin dataProvider={dataProvider}>...</Admin>;
 * }
 * ```
 */
export const dataProviderPromise = getDataProvider();

/**
 * Synchronous data provider getter (for simpler usage)
 *
 * This returns the composite provider by default.
 * Use dataProviderPromise for full routing capability.
 */
export const getDefaultDataProvider = (): DataProvider => {
  // Import synchronously for immediate use
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { dataProvider: supabaseProvider } = require('./dataProvider');
  const { loopbackDataProvider } = require('./loopbackDataProvider');
  const { createCompositeDataProvider } = require('./compositeDataProvider');

  return createCompositeDataProvider(supabaseProvider, loopbackDataProvider, {
    enableLogging: import.meta.env.DEV,
  });
};

/**
 * Helper to get current data provider type (for debugging)
 */
export const getDataProviderType = (): string => {
  const explicit = import.meta.env.VITE_DATA_PROVIDER?.toLowerCase();
  const authProvider = import.meta.env.VITE_AUTH_PROVIDER?.toLowerCase();

  if (explicit === 'supabase') {
    return 'Supabase (explicit)';
  }
  if (explicit === 'loopback') {
    return 'LoopBack (explicit)';
  }
  if (explicit === 'composite') {
    return 'Composite (explicit)';
  }
  if (authProvider === 'keycloak') {
    return 'Composite (inferred from Keycloak auth)';
  }
  if (authProvider === 'supabase') {
    return 'Supabase (inferred from Supabase auth)';
  }
  return 'Composite (default)';
};

/**
 * Resource routing information for debugging
 */
export const getResourceRouting = (): { supabase: string[]; loopback: string[] } => {
  return {
    supabase: [
      'organizations',
      'users',
      'projects',
      'boms',
      'bom_line_items',
      'bom_uploads',
      'bom_jobs',
      'alerts',
    ],
    loopback: [
      'subscriptions',
      'plans',
      'invoices',
      'billing-analytics',
      'tenant-users',
      'user-invitations',
      'user-activities',
      'roles',
      'settings',
      'workflows',
      'leads',
      'contacts',
    ],
  };
};

// Log data provider selection at load time
console.log(`\n📊 Data Provider: ${getDataProviderType()}\n`);

export default dataProviderPromise;
