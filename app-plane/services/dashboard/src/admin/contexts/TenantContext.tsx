import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

const LOCAL_STORAGE_KEY = 'cns-dashboard:tenant-id';
const DEFAULT_TENANT_ID = process.env.NEXT_PUBLIC_DEFAULT_TENANT_ID || null;

type TenantContextValue = {
  tenantId: string | null;
  setTenantId: (tenantId: string | null) => void;
};

type TenantAccessor = () => string | null;

let tenantAccessor: TenantAccessor = () => DEFAULT_TENANT_ID;

const TenantContext = createContext<TenantContextValue | null>(null);

/**
 * Allows modules outside React to read the currently selected tenant ID
 */
export const getActiveTenantId = (): string | null => tenantAccessor();

export const TenantProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [tenantId, setTenantIdState] = useState<string | null>(() => {
    if (typeof window === 'undefined') {
      return DEFAULT_TENANT_ID;
    }

    return localStorage.getItem(LOCAL_STORAGE_KEY) || DEFAULT_TENANT_ID;
  });

  const setTenantId = useCallback((nextId: string | null) => {
    setTenantIdState(nextId);
    if (typeof window !== 'undefined') {
      if (nextId) {
        localStorage.setItem(LOCAL_STORAGE_KEY, nextId);
      } else {
        localStorage.removeItem(LOCAL_STORAGE_KEY);
      }
    }
  }, []);

  useEffect(() => {
    tenantAccessor = () => tenantId || DEFAULT_TENANT_ID;
  }, [tenantId]);

  const value = useMemo(
    () => ({
      tenantId,
      setTenantId,
    }),
    [tenantId, setTenantId],
  );

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
};

export const useTenant = (): TenantContextValue => {
  const context = useContext(TenantContext);
  if (!context) {
    throw new Error('useTenant must be used within a TenantProvider');
  }
  return context;
};
