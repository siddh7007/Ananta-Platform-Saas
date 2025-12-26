/**
 * Query Key Factories
 * CBP-P3-006: Client-Side Caching Strategy
 *
 * Centralized query key management for consistent caching.
 * Query keys are hierarchical - you can invalidate all keys under a namespace.
 *
 * Structure:
 * ['resource'] - all queries for that resource
 * ['resource', 'list'] - all list queries
 * ['resource', 'list', filters] - specific list query
 * ['resource', 'detail', id] - specific detail query
 *
 * This structure allows granular or broad invalidation:
 * - invalidate(['boms']) - invalidates ALL bom queries
 * - invalidate(['boms', 'list']) - invalidates ALL bom lists
 * - invalidate(['boms', 'detail', id]) - invalidates ONLY that bom detail
 */

/**
 * Filters for BOM list queries
 */
export interface BomListFilters {
  status?: string[];
  search?: string;
  projectId?: string;
  dateRange?: {
    from: Date;
    to: Date;
  };
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * Filters for component search queries
 */
export interface ComponentSearchFilters {
  categories?: string[];
  manufacturers?: string[];
  packages?: string[];
  inStockOnly?: boolean;
  excludeObsolete?: boolean;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  // Parametric filters
  capacitanceRange?: [number, number];
  resistanceRange?: [number, number];
  voltageRange?: [number, number];
}

/**
 * BOM query keys factory
 *
 * Structure:
 * - ['boms'] - all bom queries
 * - ['boms', 'lists'] - all bom list queries
 * - ['boms', 'list', filters] - specific bom list
 * - ['boms', 'details'] - all bom detail queries
 * - ['boms', 'detail', id] - specific bom detail
 */
export const bomKeys = {
  /**
   * Base key - invalidates ALL bom queries
   */
  all: ['boms'] as const,

  /**
   * All list queries
   */
  lists: () => [...bomKeys.all, 'lists'] as const,

  /**
   * Specific list query with filters
   */
  list: (filters?: BomListFilters) => [...bomKeys.lists(), filters ?? {}] as const,

  /**
   * All detail queries
   */
  details: () => [...bomKeys.all, 'details'] as const,

  /**
   * Specific detail query by ID
   */
  detail: (id: string) => [...bomKeys.details(), id] as const,

  /**
   * BOM line items for a specific BOM
   */
  lineItems: (bomId: string) => [...bomKeys.detail(bomId), 'line-items'] as const,

  /**
   * BOM enrichment progress
   */
  enrichmentProgress: (bomId: string) => [...bomKeys.detail(bomId), 'enrichment'] as const,

  /**
   * BOM risk analysis
   */
  riskAnalysis: (bomId: string) => [...bomKeys.detail(bomId), 'risk'] as const,
};

/**
 * Component query keys factory
 *
 * Structure:
 * - ['components'] - all component queries
 * - ['components', 'search'] - all search queries
 * - ['components', 'search', query, filters] - specific search
 * - ['components', 'details'] - all detail queries
 * - ['components', 'detail', id] - specific detail
 */
export const componentKeys = {
  /**
   * Base key - invalidates ALL component queries
   */
  all: ['components'] as const,

  /**
   * All search queries
   */
  searches: () => [...componentKeys.all, 'search'] as const,

  /**
   * Specific search query
   */
  search: (query: string, filters?: ComponentSearchFilters) =>
    [...componentKeys.searches(), query, filters ?? {}] as const,

  /**
   * All detail queries
   */
  details: () => [...componentKeys.all, 'details'] as const,

  /**
   * Specific component detail
   */
  detail: (id: string) => [...componentKeys.details(), id] as const,

  /**
   * Component alternatives/cross-references
   */
  alternatives: (id: string) => [...componentKeys.detail(id), 'alternatives'] as const,

  /**
   * Component pricing data
   */
  pricing: (id: string) => [...componentKeys.detail(id), 'pricing'] as const,

  /**
   * Component availability across suppliers
   */
  availability: (id: string) => [...componentKeys.detail(id), 'availability'] as const,
};

/**
 * User query keys factory
 *
 * Structure:
 * - ['user'] - all user queries
 * - ['user', 'current'] - current authenticated user
 * - ['user', 'profile'] - user profile
 */
export const userKeys = {
  /**
   * Base key - invalidates ALL user queries
   */
  all: ['user'] as const,

  /**
   * Current authenticated user
   */
  current: () => [...userKeys.all, 'current'] as const,

  /**
   * User profile
   */
  profile: () => [...userKeys.all, 'profile'] as const,

  /**
   * User preferences
   */
  preferences: () => [...userKeys.all, 'preferences'] as const,

  /**
   * User notifications
   */
  notifications: () => [...userKeys.all, 'notifications'] as const,
};

/**
 * Project query keys factory
 */
export const projectKeys = {
  all: ['projects'] as const,
  lists: () => [...projectKeys.all, 'lists'] as const,
  list: (filters?: Record<string, unknown>) => [...projectKeys.lists(), filters ?? {}] as const,
  details: () => [...projectKeys.all, 'details'] as const,
  detail: (id: string) => [...projectKeys.details(), id] as const,
};

/**
 * Workspace query keys factory
 */
export const workspaceKeys = {
  all: ['workspaces'] as const,
  lists: () => [...workspaceKeys.all, 'lists'] as const,
  list: (filters?: Record<string, unknown>) => [...workspaceKeys.lists(), filters ?? {}] as const,
  details: () => [...workspaceKeys.all, 'details'] as const,
  detail: (id: string) => [...workspaceKeys.details(), id] as const,
};

/**
 * Team query keys factory
 */
export const teamKeys = {
  all: ['team'] as const,
  members: () => [...teamKeys.all, 'members'] as const,
  invitations: () => [...teamKeys.all, 'invitations'] as const,
};

/**
 * Billing query keys factory
 */
export const billingKeys = {
  all: ['billing'] as const,
  subscription: () => [...billingKeys.all, 'subscription'] as const,
  invoices: () => [...billingKeys.all, 'invoices'] as const,
  usage: () => [...billingKeys.all, 'usage'] as const,
};

/**
 * Settings query keys factory
 */
export const settingsKeys = {
  all: ['settings'] as const,
  organization: () => [...settingsKeys.all, 'organization'] as const,
  preferences: () => [...settingsKeys.all, 'preferences'] as const,
  enrichment: () => [...settingsKeys.all, 'enrichment'] as const,
};

/**
 * Risk analysis query keys factory
 */
export const riskKeys = {
  all: ['risk'] as const,
  dashboard: () => [...riskKeys.all, 'dashboard'] as const,
  bomRisk: (bomId: string) => [...riskKeys.all, 'bom', bomId] as const,
  componentRisk: (componentId: string) => [...riskKeys.all, 'component', componentId] as const,
};

/**
 * Alerts query keys factory
 */
export const alertKeys = {
  all: ['alerts'] as const,
  lists: () => [...alertKeys.all, 'lists'] as const,
  list: (filters?: Record<string, unknown>) => [...alertKeys.lists(), filters ?? {}] as const,
  unreadCount: () => [...alertKeys.all, 'unread-count'] as const,
};

/**
 * Helper to create pagination-aware query keys
 */
export function withPagination<T extends readonly unknown[]>(
  baseKey: T,
  page: number,
  pageSize: number
): readonly [...T, { page: number; pageSize: number }] {
  return [...baseKey, { page, pageSize }] as const;
}

/**
 * Helper to create query key with search query
 */
export function withSearch<T extends readonly unknown[]>(
  baseKey: T,
  searchQuery: string
): readonly [...T, { search: string }] {
  return [...baseKey, { search: searchQuery }] as const;
}

/**
 * Helper to create query key with sorting
 */
export function withSorting<T extends readonly unknown[]>(
  baseKey: T,
  sortBy: string,
  sortOrder: 'asc' | 'desc'
): readonly [...T, { sortBy: string; sortOrder: 'asc' | 'desc' }] {
  return [...baseKey, { sortBy, sortOrder }] as const;
}

/**
 * Export all key factories
 */
export const queryKeys = {
  boms: bomKeys,
  components: componentKeys,
  user: userKeys,
  projects: projectKeys,
  workspaces: workspaceKeys,
  team: teamKeys,
  billing: billingKeys,
  settings: settingsKeys,
  risk: riskKeys,
  alerts: alertKeys,
};

export default queryKeys;
