/**
 * Layout Components
 * Centralized exports for CNS Dashboard layout
 *
 * @module layout
 */
export { default as AppBar } from './AppBar';
export { default as Sidebar } from './Sidebar';
export { default as Layout } from './Layout';
export { Breadcrumb } from './Breadcrumb';
export * from './types';
export type { CNSLayoutProps } from './Layout';

// Task-workspace layout primitives
export {
  WorkspaceLayout,
  Panel,
  GridLayout,
  SplitLayout,
  StackLayout,
} from './WorkspaceLayout';
export type {
  WorkspaceLayoutProps,
  PanelProps,
  GridLayoutProps,
  SplitLayoutProps,
  StackLayoutProps,
} from './WorkspaceLayout';
