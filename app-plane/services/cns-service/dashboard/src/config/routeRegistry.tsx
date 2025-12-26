/**
 * Route Registry - Maps menu paths to React components
 *
 * This file bridges menuSchema.ts (navigation data) with actual React components.
 * It provides the component mappings needed to generate routes dynamically.
 *
 * NOTE: The actual route generation happens in App.tsx. This registry just
 * provides the mapping. We keep routes in App.tsx for flexibility with
 * dynamic routes like /bom-jobs/:jobId and /components/:mpn/detail.
 *
 * @module config/routeRegistry
 */

import React from 'react';

// Analytics module
import { AnalyticsDashboard, AuditStreamView, SupplierResponsesView, FileArtifactsView } from '../analytics';

// Audit module
import { AuditTrailViewer } from '../audit';

// Config module
import { EnrichmentConfigPage, SupplierAPIsConfig } from '../config';

// Customer module
import { CustomerUploadsList, CustomerBOMs, CustomerEnrichment, CustomerCatalog } from '../customer';

// Quality module
import { QualityQueue } from '../quality';

// Enrichment module
import { EnrichmentMonitor } from '../enrichment';

// Logs module
import { ActivityLog } from '../logs';

// BOM module
import { BOMUploadWizard, BOMLineItemList, BOMLineItemShow, BOMLineItemEdit } from '../bom';

// Bulk uploads
import { BulkUploadsList } from '../bulk';

// Components
import { ComponentSearchEnhanced } from '../components/ComponentSearchEnhanced';

// Uploads
import { RedisBOMUpload } from '../uploads';

// Pages
import RateLimitingSettings from '../pages/RateLimitingSettings';
import StaffBOMWorkflow from '../pages/StaffBOMWorkflow';
import UnifiedBOMWorkflow from '../pages/UnifiedBOMWorkflow';
import UserProfile from '../pages/UserProfile';
import Notifications from '../pages/Notifications';
import Portals from '../pages/Portals';

// Config
import { CNS_STAFF_ORGANIZATION_ID } from './api';

/**
 * Route component type - either a React component or a factory function
 */
export type RouteComponent = React.ComponentType<any> | (() => React.ReactElement);

/**
 * Route definition with component and optional props
 */
export interface RouteDefinition {
  /** React component to render */
  component: RouteComponent;
  /** Optional props to pass to component */
  props?: Record<string, any>;
}

/**
 * Route registry mapping paths to components
 *
 * Keys match paths in menuSchema.ts MENU_SECTIONS
 * Values are component definitions with optional props
 */
export const ROUTE_REGISTRY: Record<string, RouteDefinition> = {
  // Customer operations
  '/customer/uploads': { component: CustomerUploadsList },
  '/customer/catalog': { component: CustomerCatalog },
  '/customer/boms': { component: CustomerBOMs },
  '/customer/enrichment': { component: CustomerEnrichment },

  // Analytics & Reports
  '/analytics': { component: AnalyticsDashboard },

  // Configuration
  '/config': { component: EnrichmentConfigPage },
  '/rate-limiting': { component: RateLimitingSettings },
  '/supplier-apis': { component: SupplierAPIsConfig },

  // Uploads
  '/bom-wizard': {
    component: BOMUploadWizard,
    props: {
      organizationId: CNS_STAFF_ORGANIZATION_ID,
      projectId: undefined,
      source: 'staff_bulk',
    },
  },
  '/bom-upload': { component: StaffBOMWorkflow },
  '/upload-unified': { component: UnifiedBOMWorkflow },
  '/upload-redis': { component: RedisBOMUpload },
  '/bulk-uploads': { component: BulkUploadsList },
  '/profile': { component: UserProfile },
  '/notifications': { component: Notifications },
  '/portals': { component: Portals },

  // Component Catalog
  '/component-search': { component: ComponentSearchEnhanced },

  // Workflows
  '/enrichment-monitor': { component: EnrichmentMonitor },
  '/audit-trail': { component: AuditTrailViewer },

  // Review
  '/quality-queue': { component: QualityQueue },

  // Activity
  '/activity-log': { component: ActivityLog },
  '/audit-stream': { component: AuditStreamView },
  '/supplier-responses': { component: SupplierResponsesView },
  '/artifacts': { component: FileArtifactsView },
};

/**
 * Resource registry for React Admin Resources
 *
 * These are items with isCustomRoute: false in menuSchema.ts
 * They use React Admin's CRUD operations
 */
export const RESOURCE_REGISTRY: Record<string, {
  list: RouteComponent;
  show?: RouteComponent;
  edit?: RouteComponent;
  create?: RouteComponent;
  icon?: React.ComponentType<any>;
}> = {
  bom_line_items: {
    list: BOMLineItemList,
    show: BOMLineItemShow,
    edit: BOMLineItemEdit,
  },
};

/**
 * Get component for a given path
 * @param path - Route path from menuSchema
 * @returns RouteDefinition or undefined if not found
 */
export function getRouteComponent(path: string): RouteDefinition | undefined {
  return ROUTE_REGISTRY[path];
}

/**
 * Get resource definition by name
 * @param name - Resource name (e.g., 'bom_line_items')
 * @returns Resource definition or undefined
 */
export function getResourceDefinition(name: string) {
  return RESOURCE_REGISTRY[name];
}

/**
 * Render a component from the registry with optional props
 * @param path - Route path
 * @returns React element or null
 */
export function renderRouteComponent(path: string): React.ReactElement | null {
  const route = ROUTE_REGISTRY[path];
  if (!route) {
    console.warn(`[routeRegistry] No component registered for path: ${path}`);
    return null;
  }

  const Component = route.component;
  return <Component {...(route.props || {})} />;
}
