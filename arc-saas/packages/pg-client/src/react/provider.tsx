/**
 * React context provider for tenant database access
 */

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { TenantPgClient, createTenantClient } from '../client';
import { TenantPgConfig, TenantConnectionOptions } from '../types';
import { TenantDbContextValue } from './types';

const TenantDbContext = createContext<TenantDbContextValue | null>(null);

export interface TenantDbProviderProps {
  /** Database configuration */
  config: TenantPgConfig;
  /** Tenant connection options */
  options: TenantConnectionOptions;
  /** Children */
  children: ReactNode;
  /** Loading component */
  loadingComponent?: ReactNode;
  /** Error component */
  errorComponent?: (error: Error) => ReactNode;
}

/**
 * Provider component for tenant database access
 */
export function TenantDbProvider({
  config,
  options,
  children,
  loadingComponent,
  errorComponent,
}: TenantDbProviderProps) {
  const [client, setClient] = useState<TenantPgClient | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let mounted = true;
    let tenantClient: TenantPgClient | null = null;

    async function initClient() {
      try {
        tenantClient = createTenantClient(config, options);

        // Verify connection
        const healthy = await tenantClient.healthCheck();
        if (!healthy) {
          throw new Error('Database health check failed');
        }

        if (mounted) {
          setClient(tenantClient);
          setIsReady(true);
          setError(null);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err : new Error('Failed to initialize database'));
          setIsReady(false);
        }
      }
    }

    initClient();

    return () => {
      mounted = false;
      if (tenantClient) {
        tenantClient.close().catch(console.error);
      }
    };
  }, [config, options]);

  if (error) {
    if (errorComponent) {
      return <>{errorComponent(error)}</>;
    }
    return <div>Database Error: {error.message}</div>;
  }

  if (!isReady || !client) {
    if (loadingComponent) {
      return <>{loadingComponent}</>;
    }
    return <div>Connecting to database...</div>;
  }

  const value: TenantDbContextValue = {
    client,
    tenant: client.tenant,
    isReady,
  };

  return (
    <TenantDbContext.Provider value={value}>
      {children}
    </TenantDbContext.Provider>
  );
}

/**
 * Hook to access the tenant database client
 */
export function useTenantDb(): TenantDbContextValue {
  const context = useContext(TenantDbContext);

  if (!context) {
    throw new Error('useTenantDb must be used within a TenantDbProvider');
  }

  return context;
}

/**
 * Hook to get just the client
 */
export function useTenantClient(): TenantPgClient {
  const { client } = useTenantDb();
  return client;
}

/**
 * Hook to get tenant info
 */
export function useTenant() {
  const { tenant } = useTenantDb();
  return tenant;
}
