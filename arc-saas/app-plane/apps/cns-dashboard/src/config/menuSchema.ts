/**
 * CNS Dashboard Sidebar Menu Schema
 *
 * Single source of truth for sections and items.
 * Roles: 'customer' | 'admin' (default to 'admin' for this internal dashboard)
 */

export type MenuRole = 'customer' | 'admin';

export interface MenuItem {
  id: string;
  label: string;
  path: string;
  icon?: string; // logical icon name; mapped in CustomMenu
  roles?: MenuRole[];
}

export interface MenuSection {
  id: string;
  label: string;
  roles?: MenuRole[];
  items: MenuItem[];
}

export const MENU_SECTIONS: MenuSection[] = [
  {
    id: 'overview',
    label: 'Overview',
    roles: ['customer', 'admin'],
    items: [
      { id: 'dashboard', label: 'Dashboard', path: '/', icon: 'dashboard' },
    ],
  },
  {
    id: 'my-work',
    label: 'My Work',
    roles: ['customer', 'admin'],
    items: [
      { id: 'customer-uploads', label: 'Customer Uploads', path: '/customer/uploads', icon: 'upload' },
    ],
  },
  {
    id: 'tenant',
    label: 'Tenant',
    roles: ['admin'],
    items: [
      { id: 'customer-catalog', label: 'Customer Catalog', path: '/customer/catalog', icon: 'storage' },
      { id: 'customer-boms', label: 'Customer BOMs', path: '/customer/boms', icon: 'work' },
      { id: 'customer-enrichment', label: 'Customer Enrichment', path: '/customer/enrichment', icon: 'monitor' },
    ],
  },
  {
    id: 'catalog',
    label: 'Catalog',
    roles: ['customer', 'admin'],
    items: [
      { id: 'catalog', label: 'Component Catalog', path: '/component-search', icon: 'storage' },
    ],
  },
  {
    id: 'activity',
    label: 'Activity',
    roles: ['customer', 'admin'],
    items: [
      { id: 'activity-log', label: 'Activity Log', path: '/activity-log', icon: 'history' },
      { id: 'audit-stream', label: 'BOM Event Stream', path: '/audit-stream', icon: 'monitor' },
      { id: 'supplier-responses', label: 'Supplier Responses', path: '/supplier-responses', icon: 'compare' },
      { id: 'file-artifacts', label: 'File Artifacts', path: '/artifacts', icon: 'folder' },
    ],
  },
  {
    id: 'uploads',
    label: 'Uploads',
    roles: ['admin'],
    items: [
      { id: 'bom-wizard', label: 'Bulk BOM Upload', path: '/bom-wizard', icon: 'upload' },
      { id: 'unified-upload', label: 'BOM Upload (Unified/Database)', path: '/upload-unified', icon: 'upload' },
      { id: 'redis-upload', label: 'BOM Upload (Redis/Temporary)', path: '/upload-redis', icon: 'cloud' },
      { id: 'all-uploads', label: 'View All Uploads', path: '/bulk-uploads', icon: 'list' },
    ],
  },
  {
    id: 'workflows',
    label: 'Workflows',
    roles: ['admin'],
    items: [
      { id: 'enrichment-monitor-admin', label: 'Enrichment Monitor', path: '/enrichment-monitor', icon: 'monitor' },
      { id: 'audit-trail', label: 'Audit Trail Viewer', path: '/audit-trail', icon: 'assessment' },
    ],
  },
  {
    id: 'review',
    label: 'Review',
    roles: ['admin'],
    items: [
      { id: 'quality-queue', label: 'Quality Review', path: '/quality-queue', icon: 'pending' },
      { id: 'bom-line-items', label: 'BOM Line Items', path: '/bom_line_items', icon: 'list' },
    ],
  },
  {
    id: 'reports',
    label: 'Reports',
    roles: ['admin'],
    items: [
      { id: 'analytics', label: 'Analytics Dashboard', path: '/analytics', icon: 'bar' },
    ],
  },
  {
    id: 'settings',
    label: 'Settings',
    roles: ['admin'],
    items: [
      { id: 'config', label: 'Configuration', path: '/config', icon: 'settings' },
      { id: 'rate-limiting', label: 'Rate Limiting', path: '/rate-limiting', icon: 'speed' },
      { id: 'supplier-apis', label: 'Supplier API Keys', path: '/supplier-apis', icon: 'api' },
    ],
  },
];
