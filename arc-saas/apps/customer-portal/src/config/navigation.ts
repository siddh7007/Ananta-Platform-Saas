import {
  Home,
  FileText,
  Cpu,
  Users,
  CreditCard,
  UserPlus,
  BarChart3,
  Shield,
  Receipt,
  FolderOpen,
  AlertTriangle,
  Bell,
  FolderKanban,
  Search,
  Package,
  type LucideIcon,
} from 'lucide-react';
import { AppRole, hasMinimumRole } from '@/config/auth';

/**
 * Navigation item configuration
 */
export interface NavItem {
  /** Unique identifier (matches Refine resource name) */
  name: string;
  /** Display label */
  label: string;
  /** Route path */
  href: string;
  /** Lucide icon component */
  icon: LucideIcon;
  /** Minimum role required to view this item */
  minRole: AppRole;
  /** Feature flag key (if any) */
  featureFlag?: string;
  /** Whether to hide from nav but keep route accessible */
  hidden?: boolean;
  /** Children nav items */
  children?: NavItem[];
  /** Badge text (e.g., "New", count) */
  badge?: string | number;
  /** Data provider name for this resource */
  dataProviderName?: 'platform' | 'cns' | 'supabase';
}

/**
 * Navigation manifest - config-driven navigation for CBP
 * Items are filtered by user role at runtime
 */
export const navigationManifest: NavItem[] = [
  {
    name: 'dashboard',
    label: 'Dashboard',
    href: '/',
    icon: Home,
    minRole: 'analyst', // All authenticated users can see dashboard
    dataProviderName: 'platform',
  },
  {
    name: 'workspaces',
    label: 'Workspaces',
    href: '/workspaces',
    icon: FolderOpen,
    minRole: 'analyst', // All users can view their workspace
    dataProviderName: 'platform',
  },
  {
    name: 'projects',
    label: 'Projects',
    href: '/projects',
    icon: FolderKanban,
    minRole: 'analyst', // All users can view projects
    dataProviderName: 'platform',
    children: [
      {
        name: 'projects-list',
        label: 'All Projects',
        href: '/projects',
        icon: FolderKanban,
        minRole: 'analyst',
      },
      {
        name: 'projects-create',
        label: 'New Project',
        href: '/projects/create',
        icon: FolderKanban,
        minRole: 'engineer', // Only engineers+ can create projects
      },
    ],
  },
  // BOM Management hidden - accessed through Projects for now
  // {
  //   name: 'boms',
  //   label: 'BOM Management',
  //   href: '/boms',
  //   icon: FileText,
  //   minRole: 'analyst',
  //   dataProviderName: 'cns',
  //   children: [
  //     { name: 'boms-list', label: 'All BOMs', href: '/boms', icon: FileText, minRole: 'analyst' },
  //     { name: 'boms-upload', label: 'Upload BOM', href: '/boms/upload', icon: FileText, minRole: 'engineer' },
  //     { name: 'boms-risk', label: 'Risk Analysis', href: '/risk', icon: AlertTriangle, minRole: 'analyst' },
  //   ],
  // },
  {
    name: 'components',
    label: 'Components',
    href: '/components',
    icon: Cpu,
    minRole: 'analyst', // Read-only component catalog
    dataProviderName: 'cns',
    children: [
      {
        name: 'components-list',
        label: 'My Components',
        href: '/components',
        icon: Package,
        minRole: 'analyst',
      },
      {
        name: 'components-search',
        label: 'Global Search',
        href: '/components/search',
        icon: Search,
        minRole: 'analyst',
      },
    ],
  },
  {
    name: 'risk-analysis',
    label: 'Risk Analysis',
    href: '/risk',
    icon: AlertTriangle,
    minRole: 'analyst', // All users can view risk analysis
    dataProviderName: 'cns',
  },
  {
    name: 'alerts',
    label: 'Alerts',
    href: '/alerts',
    icon: Bell,
    minRole: 'analyst', // All users can view alerts
    dataProviderName: 'cns',
  },
  {
    name: 'team',
    label: 'Team',
    href: '/team',
    icon: Users,
    minRole: 'analyst', // All users can view team directory
    dataProviderName: 'platform',
    children: [
      {
        name: 'team-members',
        label: 'Members',
        href: '/team',
        icon: Users,
        minRole: 'analyst',
      },
      {
        name: 'team-invitations',
        label: 'Invitations',
        href: '/team/invitations',
        icon: UserPlus,
        minRole: 'admin',
      },
      {
        name: 'team-activity',
        label: 'Activity',
        href: '/team/activity',
        icon: FileText,
        minRole: 'analyst',
      },
    ],
  },
  {
    name: 'billing',
    label: 'Billing',
    href: '/billing',
    icon: CreditCard,
    minRole: 'analyst', // All users can view billing overview
    dataProviderName: 'platform',
    children: [
      {
        name: 'billing-overview',
        label: 'Overview',
        href: '/billing',
        icon: CreditCard,
        minRole: 'analyst',
      },
      {
        name: 'billing-usage',
        label: 'Usage',
        href: '/billing/usage',
        icon: BarChart3,
        minRole: 'analyst',
      },
      {
        name: 'billing-invoices',
        label: 'Invoices',
        href: '/billing/invoices',
        icon: Receipt,
        minRole: 'analyst',
      },
    ],
  },
  // NOTE: Settings is accessed via bottom sidebar section (Layout.tsx lines 183-197)
  // Removed from main navigation to prevent redundancy with the Settings link there
];

/**
 * Super admin only navigation items
 */
export const superAdminNavItems: NavItem[] = [
  {
    name: 'admin-panel',
    label: 'Admin Panel',
    href: '/admin',
    icon: Shield,
    minRole: 'super_admin',
    dataProviderName: 'platform',
    children: [
      {
        name: 'admin-tenants',
        label: 'All Tenants',
        href: '/admin/tenants',
        icon: Users,
        minRole: 'super_admin',
      },
      {
        name: 'admin-users',
        label: 'All Users',
        href: '/admin/users',
        icon: Users,
        minRole: 'super_admin',
      },
    ],
  },
];

/**
 * Filter navigation items by user role
 */
export function filterNavByRole(items: NavItem[], userRole: AppRole): NavItem[] {
  return items
    .filter((item) => {
      // Check if user has minimum role
      if (!hasMinimumRole(userRole, item.minRole)) {
        return false;
      }
      // Skip hidden items
      if (item.hidden) {
        return false;
      }
      return true;
    })
    .map((item) => ({
      ...item,
      // Recursively filter children
      children: item.children ? filterNavByRole(item.children, userRole) : undefined,
    }));
}

/**
 * Get all navigation items for a user (includes super_admin items if applicable)
 */
export function getNavigationForRole(userRole: AppRole): NavItem[] {
  const baseNav = filterNavByRole(navigationManifest, userRole);

  // Add super admin items if user is super_admin
  if (userRole === 'super_admin') {
    const adminNav = filterNavByRole(superAdminNavItems, userRole);
    return [...baseNav, ...adminNav];
  }

  return baseNav;
}

/**
 * Check if user can access a specific route
 */
export function canAccessRoute(userRole: AppRole, routePath: string): boolean {
  const allItems = [...navigationManifest, ...superAdminNavItems];

  // Find matching nav item (including children)
  const findItem = (items: NavItem[]): NavItem | undefined => {
    for (const item of items) {
      if (item.href === routePath) {
        return item;
      }
      if (item.children) {
        const child = findItem(item.children);
        if (child) return child;
      }
    }
    return undefined;
  };

  const navItem = findItem(allItems);

  // If no nav item found, allow access (might be a detail page)
  if (!navItem) {
    // Check if it's a child route of an allowed parent
    // Build a parent path finder that looks for matching parent items
    const segments = routePath.split('/').filter(Boolean);
    for (let i = segments.length - 1; i > 0; i--) {
      const candidatePath = '/' + segments.slice(0, i).join('/');
      const parentItem = allItems.find((item) => item.href === candidatePath);
      if (parentItem) {
        return hasMinimumRole(userRole, parentItem.minRole);
      }
    }
    return true;
  }

  return hasMinimumRole(userRole, navItem.minRole);
}

/**
 * Get breadcrumb trail for a route
 */
export function getBreadcrumbs(routePath: string): { label: string; href: string }[] {
  const allItems = [...navigationManifest, ...superAdminNavItems];
  const breadcrumbs: { label: string; href: string }[] = [];

  // Start with home
  breadcrumbs.push({ label: 'Home', href: '/' });

  // Find matching items along the path
  const segments = routePath.split('/').filter(Boolean);
  let currentPath = '';

  for (const segment of segments) {
    currentPath += `/${segment}`;

    const findItem = (items: NavItem[]): NavItem | undefined => {
      for (const item of items) {
        if (item.href === currentPath) {
          return item;
        }
        if (item.children) {
          const child = findItem(item.children);
          if (child) return child;
        }
      }
      return undefined;
    };

    const navItem = findItem(allItems);
    if (navItem && currentPath !== '/') {
      breadcrumbs.push({ label: navItem.label, href: navItem.href });
    }
  }

  return breadcrumbs;
}

/**
 * Convert navigation manifest to Refine resources array
 */
export function getRefineResources(userRole: AppRole) {
  const nav = getNavigationForRole(userRole);

  return nav.map((item) => ({
    name: item.name,
    list: item.href,
    ...(item.children?.find((c) => c.name.includes('create'))
      ? { create: item.children.find((c) => c.name.includes('create'))?.href }
      : {}),
    meta: {
      label: item.label,
      icon: item.icon.displayName || item.icon.name,
      dataProviderName: item.dataProviderName || 'default',
      minRole: item.minRole,
    },
  }));
}

export default navigationManifest;
