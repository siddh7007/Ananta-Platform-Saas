/**
 * Layout Type Definitions
 * Shared types for layout components
 */
import { ComponentType } from 'react';

export type NavRole = 'customer' | 'admin' | 'super_admin';

export interface NavItem {
  id: string;
  label: string;
  path: string;
  icon: string;  // Icon key for iconMap
  component?: ComponentType;
  roles?: NavRole[];
  resourceName?: string;
  isCustomRoute?: boolean;
  showInSidebar?: boolean;
  parent?: string;  // For breadcrumb hierarchy
}

export interface NavSection {
  id: string;
  label: string;
  roles?: NavRole[];
  items: NavItem[];
  collapsed?: boolean;
}

export interface BreadcrumbItem {
  /** Display label */
  label: string;
  /** Route path (empty string = non-clickable) */
  path: string;
  /** Whether this is the active/current page */
  isActive: boolean;
}

export interface LayoutContextType {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  currentSection?: string;
  breadcrumbs: BreadcrumbItem[];
}
