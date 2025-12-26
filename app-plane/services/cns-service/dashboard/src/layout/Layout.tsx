/**
 * CNS Dashboard Layout
 * Combines AppBar + Sidebar with React Admin Layout
 *
 * Features:
 * - Schema-driven sidebar navigation (layout/Sidebar.tsx)
 * - Theme toggle in AppBar (layout/AppBar.tsx)
 * - Optional breadcrumb support
 *
 * @module layout/Layout
 */
import { Layout as RALayout, LayoutProps } from 'react-admin';
import AppBar from './AppBar';
import Sidebar from './Sidebar';

/**
 * Extended layout props with breadcrumb support
 */
export interface CNSLayoutProps extends LayoutProps {
  /** Show breadcrumbs in AppBar (default: false) */
  showBreadcrumb?: boolean;
}

/**
 * Create AppBar component with breadcrumb prop forwarded
 */
const createAppBarWithBreadcrumb = (showBreadcrumb: boolean) => {
  return function AppBarWithBreadcrumb(props: any) {
    return <AppBar {...props} showBreadcrumb={showBreadcrumb} />;
  };
};

export default function Layout({ showBreadcrumb = false, ...props }: CNSLayoutProps) {
  // Create AppBar with breadcrumb support
  const AppBarComponent = showBreadcrumb ? createAppBarWithBreadcrumb(true) : AppBar;

  return <RALayout {...props} menu={Sidebar} appBar={AppBarComponent} />;
}
