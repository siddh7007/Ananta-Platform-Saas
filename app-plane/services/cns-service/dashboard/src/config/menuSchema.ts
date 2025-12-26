/**
 * CNS Dashboard Sidebar Menu Schema
 *
 * Single source of truth for sidebar menu sections and items.
 *
 * This schema drives both:
 * 1. Sidebar rendering (via layout/Sidebar.tsx component)
 * 2. Route generation (Resources vs CustomRoutes in App.tsx)
 *
 * Roles: 'customer' | 'admin' | 'super_admin'
 *
 * @example
 * ```typescript
 * // Get all custom routes for <Route> generation
 * const customRoutes = getCustomRouteItems();
 *
 * // Get all resources for <Resource> components
 * const resources = getResourceItems();
 *
 * // Find item metadata by path
 * const item = findMenuItemByPath('/analytics');
 * if (item?.isCustomRoute) {
 *   // Render as CustomRoute
 * }
 * ```
 */

export type MenuRole = 'customer' | 'admin' | 'super_admin';

/**
 * Menu item definition with routing metadata
 */
export interface MenuItem {
  /** Unique identifier for the menu item */
  id: string;
  /** Display label in sidebar */
  label: string;
  /** Route path (must start with /) */
  path: string;
  /** Icon name (mapped to MUI icons in layout/Sidebar.tsx) */
  icon?: string;
  /** Roles allowed to see this item (default: all roles) */
  roles?: MenuRole[];
  /** React Admin resource name (if different from id) */
  resourceName?: string;
  /**
   * Route type:
   * - true: Render as CustomRoute (custom pages)
   * - false: Render as Resource (CRUD with dataProvider)
   * - undefined: Treated as CustomRoute by default
   */
  isCustomRoute?: boolean;
  /** Show in sidebar navigation (default: true) */
  showInSidebar?: boolean;
  /** Optional badge content (e.g., count, "NEW") */
  badge?: string | number;
}

/**
 * Menu section grouping multiple items
 */
export interface MenuSection {
  /** Unique identifier for the section */
  id: string;
  /** Display label for the section header */
  label: string;
  /** Roles allowed to see this section (default: all roles) */
  roles?: MenuRole[];
  /** Menu items in this section */
  items: MenuItem[];
  /** Whether section can be collapsed/expanded (default: false) */
  collapsible?: boolean;
  /** Initial expanded state for collapsible sections (default: true) */
  defaultExpanded?: boolean;
}

/**
 * Menu sections and items configuration
 *
 * Reorganized into 5 functional categories:
 * 1. DASHBOARD - Entry points and analytics
 * 2. CUSTOMER PORTAL - Customer-facing search with tenant/workspace filters
 * 3. BOM MANAGEMENT - All BOM-related operations
 * 4. COMPONENTS - Catalog, enrichment, quality review
 * 5. SYSTEM - Activity logs, audit, configuration
 *
 * CustomRoute items (isCustomRoute: true or undefined):
 * - Dashboard pages with custom layouts
 * - Upload wizards and forms
 * - Configuration pages
 * - Analytics and monitoring dashboards
 *
 * Resource items (isCustomRoute: false):
 * - bom_line_items: Full CRUD with dataProvider
 */
export const MENU_SECTIONS: MenuSection[] = [
  // ============================================================
  // DASHBOARD - Entry points (not collapsible)
  // ============================================================
  {
    id: 'dashboard',
    label: 'Dashboard',
    roles: ['customer', 'admin', 'super_admin'],
    items: [
      {
        id: 'home',
        label: 'Home',
        path: '/',
        icon: 'dashboard',
        isCustomRoute: true,
      },
      {
        id: 'analytics',
        label: 'Analytics',
        path: '/analytics',
        icon: 'bar',
        roles: ['admin', 'super_admin'],
        isCustomRoute: true,
      },
    ],
  },

  // ============================================================
  // BOM MANAGEMENT - Upload, bulk operations, admin tools (collapsible)
  // ============================================================
  {
    id: 'bom-management',
    label: 'BOM Management',
    roles: ['customer', 'admin', 'super_admin'],
    collapsible: true,
    defaultExpanded: true,
    items: [
      {
        id: 'upload-bom',
        label: 'Upload BOM',
        path: '/upload-persisted',
        icon: 'upload',
        roles: ['admin', 'super_admin'],
        isCustomRoute: true,
      },
      {
        id: 'all-uploads',
        label: 'All BOMs',
        path: '/all-uploads',
        icon: 'list',
        roles: ['admin', 'super_admin'],
        isCustomRoute: true, // Combined view: Redis active + Database BOMs
      },
      {
        id: 'bulk-uploads',
        label: 'Bulk Uploads (Legacy)',
        path: '/bulk-uploads',
        icon: 'cloud',
        roles: ['admin', 'super_admin'],
        isCustomRoute: true,
      },
      // Legacy routes - hidden from sidebar but still accessible via URL
      {
        id: 'bom-upload-legacy',
        label: 'Upload BOM (Legacy)',
        path: '/bom-upload',
        icon: 'upload',
        isCustomRoute: true,
        showInSidebar: false,
      },
      {
        id: 'bom-wizard',
        label: 'BOM Wizard (Legacy)',
        path: '/bom-wizard',
        icon: 'upload',
        roles: ['admin', 'super_admin'],
        isCustomRoute: true,
        showInSidebar: false,
      },
      {
        id: 'unified-upload',
        label: 'Upload Unified (Legacy)',
        path: '/upload-unified',
        icon: 'upload',
        roles: ['admin', 'super_admin'],
        isCustomRoute: true,
        showInSidebar: false,
      },
      {
        id: 'redis-upload',
        label: 'Upload Redis (Legacy)',
        path: '/upload-redis',
        icon: 'cloud',
        roles: ['admin', 'super_admin'],
        isCustomRoute: true,
        showInSidebar: false,
      },
      {
        id: 'customer-uploads',
        label: 'Customer Uploads (Legacy)',
        path: '/customer/uploads',
        icon: 'upload',
        roles: ['super_admin'],
        isCustomRoute: true,
        showInSidebar: false,
      },
    ],
  },

  // ============================================================
  // COMPONENTS - Admin catalog tools, enrichment, quality (collapsible)
  // ============================================================
  {
    id: 'components',
    label: 'Components',
    roles: ['admin', 'super_admin'],
    collapsible: true,
    defaultExpanded: true,
    items: [
      {
        id: 'catalog',
        label: 'Global Catalog',
        path: '/component-search',
        icon: 'storage',
        isCustomRoute: true,
      },
      {
        id: 'enrichment-monitor',
        label: 'Enrichment Monitor',
        path: '/enrichment-monitor',
        icon: 'monitor',
        isCustomRoute: true,
      },
      {
        id: 'quality-queue',
        label: 'Quality Review',
        path: '/quality-queue',
        icon: 'pending',
        isCustomRoute: true,
      },
    ],
  },

  // ============================================================
  // CUSTOMER PORTAL - Unified portal with tenant/workspace filters
  // 3 child menu items linking to tabs: BOM Uploads | Components | Risk & Alerts
  // ============================================================
  {
    id: 'customer-portal',
    label: 'Customer Portal',
    roles: ['super_admin'],
    collapsible: true,
    defaultExpanded: true,
    items: [
      {
        id: 'customer-portal-boms',
        label: 'BOM Uploads',
        path: '/customer/portal?tab=boms',
        icon: 'upload',
        roles: ['super_admin'],
        isCustomRoute: true,
      },
      {
        id: 'customer-portal-components',
        label: 'Components',
        path: '/customer/portal?tab=components',
        icon: 'storage',
        roles: ['super_admin'],
        isCustomRoute: true,
      },
      {
        id: 'customer-portal-risks',
        label: 'Risk & Alerts',
        path: '/customer/portal?tab=risks',
        icon: 'warning',
        roles: ['super_admin'],
        isCustomRoute: true,
      },
      // Main portal page (hidden, accessible via child items)
      {
        id: 'customer-portal-unified',
        label: 'Customer Portal',
        path: '/customer/portal',
        icon: 'business',
        roles: ['super_admin'],
        isCustomRoute: true,
        showInSidebar: false,
      },
      // Legacy routes - hidden from sidebar but still accessible (redirect to unified)
      {
        id: 'customer-bom-search-legacy',
        label: 'BOM Search (Legacy)',
        path: '/customer/boms',
        icon: 'search',
        roles: ['super_admin'],
        isCustomRoute: true,
        showInSidebar: false,
      },
      {
        id: 'customer-component-search-legacy',
        label: 'Component Search (Legacy)',
        path: '/customer/catalog',
        icon: 'storage',
        roles: ['super_admin'],
        isCustomRoute: true,
        showInSidebar: false,
      },
      {
        id: 'customer-enrichment-status-legacy',
        label: 'Enrichment Status (Legacy)',
        path: '/customer/enrichment',
        icon: 'autorenew',
        roles: ['super_admin'],
        isCustomRoute: true,
        showInSidebar: false,
      },
    ],
  },

  // ============================================================
  // SYSTEM - Activity, audit, config (collapsible, collapsed by default)
  // ============================================================
  {
    id: 'system',
    label: 'System',
    roles: ['customer', 'admin', 'super_admin'],
    collapsible: true,
    defaultExpanded: false,
    items: [
      {
        id: 'activity-log',
        label: 'Activity Log',
        path: '/activity-log',
        icon: 'history',
        isCustomRoute: true,
      },
      {
        id: 'audit-trail',
        label: 'Audit Trail',
        path: '/audit-trail',
        icon: 'assessment',
        roles: ['admin', 'super_admin'],
        isCustomRoute: true,
      },
      {
        id: 'audit-stream',
        label: 'Event Stream',
        path: '/audit-stream',
        icon: 'monitor',
        roles: ['admin', 'super_admin'],
        isCustomRoute: true,
      },
      {
        id: 'supplier-responses',
        label: 'Supplier Responses',
        path: '/supplier-responses',
        icon: 'compare',
        roles: ['admin', 'super_admin'],
        isCustomRoute: true,
      },
      {
        id: 'file-artifacts',
        label: 'File Artifacts',
        path: '/artifacts',
        icon: 'folder',
        roles: ['admin', 'super_admin'],
        isCustomRoute: true,
      },
      {
        id: 'config',
        label: 'Configuration',
        path: '/config',
        icon: 'settings',
        roles: ['admin', 'super_admin'],
        isCustomRoute: true,
      },
      {
        id: 'rate-limiting',
        label: 'Rate Limiting',
        path: '/rate-limiting',
        icon: 'speed',
        roles: ['admin', 'super_admin'],
        isCustomRoute: true,
      },
      {
        id: 'supplier-apis',
        label: 'Supplier APIs',
        path: '/supplier-apis',
        icon: 'api',
        roles: ['admin', 'super_admin'],
        isCustomRoute: true,
      },
    ],
  },
  {
    id: 'account',
    label: 'Account',
    roles: ['admin', 'super_admin'],
    collapsible: true,
    defaultExpanded: false,
    items: [
      {
        id: 'portals',
        label: 'Portals',
        path: '/portals',
        icon: 'settings',
        roles: ['admin', 'super_admin'],
        isCustomRoute: true,
        showInSidebar: false,
      },
      {
        id: 'profile',
        label: 'Profile',
        path: '/profile',
        icon: 'settings',
        roles: ['admin', 'super_admin'],
        isCustomRoute: true,
        showInSidebar: false,
      },
      {
        id: 'notifications',
        label: 'Notifications',
        path: '/notifications',
        icon: 'settings',
        roles: ['admin', 'super_admin'],
        isCustomRoute: true,
        showInSidebar: false,
      },
    ],
  },
];

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get all menu items as a flat array
 *
 * @returns All menu items from all sections
 *
 * @example
 * ```typescript
 * const allItems = getAllMenuItems();
 * console.log(allItems.length); // Total number of menu items
 * ```
 */
export function getAllMenuItems(): MenuItem[] {
  return MENU_SECTIONS.flatMap(section => section.items);
}

/**
 * Get menu items that should be rendered as CustomRoutes
 *
 * CustomRoutes are used for:
 * - Dashboard pages with custom layouts
 * - Upload wizards and multi-step forms
 * - Configuration and settings pages
 * - Analytics and monitoring dashboards
 *
 * @returns Items where isCustomRoute is true or undefined
 *
 * @example
 * ```typescript
 * const customRoutes = getCustomRouteItems();
 * // In App.tsx:
 * customRoutes.map(item => (
 *   <Route key={item.path} path={item.path} element={<CustomPage />} />
 * ))
 * ```
 */
export function getCustomRouteItems(): MenuItem[] {
  return getAllMenuItems().filter(item => item.isCustomRoute !== false);
}

/**
 * Get menu items that should be rendered as React Admin Resources
 *
 * Resources provide full CRUD operations with:
 * - List view with pagination/filtering
 * - Show view for details
 * - Edit view for updates
 * - Create view for new records
 * - Integration with dataProvider
 *
 * @returns Items where isCustomRoute is explicitly false
 *
 * @example
 * ```typescript
 * const resources = getResourceItems();
 * // In App.tsx:
 * resources.map(item => (
 *   <Resource
 *     key={item.resourceName || item.id}
 *     name={item.resourceName || item.id}
 *     list={ListComponent}
 *     show={ShowComponent}
 *     edit={EditComponent}
 *   />
 * ))
 * ```
 */
export function getResourceItems(): MenuItem[] {
  return getAllMenuItems().filter(item => item.isCustomRoute === false);
}

/**
 * Find a menu item by its path
 *
 * @param path - Route path to search for (e.g., '/analytics')
 * @returns Menu item if found, undefined otherwise
 *
 * @example
 * ```typescript
 * const item = findMenuItemByPath('/bom_line_items');
 * if (item?.isCustomRoute === false) {
 *   console.log('This is a Resource:', item.resourceName);
 * }
 * ```
 */
export function findMenuItemByPath(path: string): MenuItem | undefined {
  return getAllMenuItems().find(item => item.path === path);
}

/**
 * Find the section containing a menu item by path
 *
 * Useful for breadcrumb generation or determining section context.
 *
 * @param path - Route path to search for
 * @returns Menu section if found, undefined otherwise
 *
 * @example
 * ```typescript
 * const section = findSectionByItemPath('/quality-queue');
 * console.log(section?.label); // "Review"
 * ```
 */
export function findSectionByItemPath(path: string): MenuSection | undefined {
  return MENU_SECTIONS.find(section =>
    section.items.some(item => item.path === path)
  );
}

/**
 * Get menu items filtered by role
 *
 * @param role - User role to filter by
 * @returns Items accessible to the given role
 *
 * @example
 * ```typescript
 * const customerItems = getMenuItemsByRole('customer');
 * // Only returns items where roles includes 'customer'
 * ```
 */
export function getMenuItemsByRole(role: MenuRole): MenuItem[] {
  return getAllMenuItems().filter(
    item => !item.roles || item.roles.includes(role)
  );
}

/**
 * Get menu sections filtered by role
 *
 * Returns sections that contain at least one item accessible to the role.
 *
 * @param role - User role to filter by
 * @returns Sections with items accessible to the given role
 *
 * @example
 * ```typescript
 * const adminSections = getMenuSectionsByRole('admin');
 * // Returns sections where section role or item roles include 'admin'
 * ```
 */
export function getMenuSectionsByRole(role: MenuRole): MenuSection[] {
  return MENU_SECTIONS.map(section => ({
    ...section,
    items: section.items.filter(
      item => !item.roles || item.roles.includes(role)
    ),
  })).filter(
    section =>
      section.items.length > 0 &&
      (!section.roles || section.roles.includes(role))
  );
}

/**
 * Get the resource name for a menu item
 *
 * Returns the explicit resourceName if defined, otherwise falls back to id.
 * Useful for generating React Admin Resource components.
 *
 * @param item - Menu item
 * @returns Resource name for React Admin
 *
 * @example
 * ```typescript
 * const item = findMenuItemByPath('/bom_line_items');
 * const resourceName = getResourceName(item); // "bom_line_items"
 * ```
 */
export function getResourceName(item: MenuItem): string {
  return item.resourceName || item.id;
}
