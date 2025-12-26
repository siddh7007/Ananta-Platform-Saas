/**
 * CNS Dashboard Context Providers
 *
 * Barrel export for all context providers and hooks
 */

// Tenant Context
export { TenantProvider, useTenant } from './TenantContext';
export type { default as TenantContextType } from './TenantContext';

// Role Context (RBAC)
export {
  RoleProvider,
  useRole,
  useUserRole,
  useHasMinimumRole,
  useIsSuperAdmin,
  useIsAdmin,
  useIsEngineer,
} from './RoleContext';
export type { default as RoleContextType } from './RoleContext';

// Notification Context
export { NotificationProvider, useNotification } from './NotificationContext';

// Theme Context
export { ThemeContextProvider, useThemeContext } from './ThemeContext';
