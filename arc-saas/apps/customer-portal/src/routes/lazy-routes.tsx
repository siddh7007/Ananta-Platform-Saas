/**
 * Lazy Routes Configuration
 * CBP-P3-005: Code Splitting & Lazy Loading
 *
 * Implements code splitting for all page components to reduce initial bundle size.
 * Target: Initial JS bundle < 200KB (gzipped)
 *
 * Features:
 * - React.lazy() for all page components
 * - Suspense boundaries with loading states
 * - Error boundaries for chunk loading failures
 * - Critical route preloading after initial render
 */

import { lazy, Suspense, ComponentType } from 'react';
import { RouteErrorBoundary } from '@/components/shared';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';

/**
 * Loading fallback component for Suspense boundaries
 */
function RouteLoadingFallback({ routeName }: { routeName?: string }) {
  return (
    <div className="flex min-h-[400px] items-center justify-center">
      <LoadingSpinner
        size="lg"
        label={routeName ? `Loading ${routeName}...` : 'Loading...'}
        ariaLabel={routeName ? `Loading ${routeName} page` : 'Loading page'}
        centered
      />
    </div>
  );
}

/**
 * Higher-order component that wraps lazy-loaded routes with Suspense and ErrorBoundary
 */
export function LazyRoute(
  Component: ComponentType,
  routeName: string
): JSX.Element {
  return (
    <RouteErrorBoundary routeName={routeName}>
      <Suspense fallback={<RouteLoadingFallback routeName={routeName} />}>
        <Component />
      </Suspense>
    </RouteErrorBoundary>
  );
}

/**
 * Lazy-loaded page components
 * Organized by feature area to enable tree-shaking
 */

// Public pages (not behind auth)
export const LandingPage = lazy(() =>
  import('@/pages/Landing').then((m) => ({ default: m.LandingPage }))
);
export const LoginPage = lazy(() =>
  import('@/pages/auth/Login').then((m) => ({ default: m.LoginPage }))
);
export const CallbackPage = lazy(() =>
  import('@/pages/auth/Callback').then((m) => ({ default: m.CallbackPage }))
);
export const AcceptInvitationPage = lazy(() =>
  import('@/pages/auth/AcceptInvitation').then((m) => ({
    default: m.AcceptInvitationPage,
  }))
);

// Dashboard (critical route - preloaded)
export const DashboardPage = lazy(() =>
  import('@/pages/Dashboard').then((m) => ({ default: m.DashboardPage }))
);

// BOM pages (high priority)
export const BomListPage = lazy(() =>
  import('@/pages/boms').then((m) => ({ default: m.BomListPage }))
);
export const BomUploadPage = lazy(() =>
  import('@/pages/boms').then((m) => ({ default: m.BomUploadPage }))
);
export const BomDetailPage = lazy(() =>
  import('@/pages/boms').then((m) => ({ default: m.BomDetailPage }))
);
export const RiskAnalysisPage = lazy(() =>
  import('@/pages/boms').then((m) => ({ default: m.RiskAnalysisPage }))
);

// Component pages (high priority)
export const ComponentListPage = lazy(() =>
  import('@/pages/components').then((m) => ({ default: m.ComponentListPage }))
);
export const ComponentDetailPage = lazy(() =>
  import('@/pages/components').then((m) => ({ default: m.ComponentDetailPage }))
);
export const ComponentCompareView = lazy(() =>
  import('@/pages/components').then((m) => ({
    default: m.ComponentCompareView,
  }))
);
export const ComponentSearchPage = lazy(() =>
  import('@/pages/components').then((m) => ({
    default: m.ComponentSearchPage,
  }))
);
export const MyComponentsPage = lazy(() =>
  import('@/pages/components').then((m) => ({
    default: m.MyComponentsPage,
  }))
);

// Workspace pages
export const WorkspaceListPage = lazy(() =>
  import('@/pages/workspaces').then((m) => ({ default: m.WorkspaceListPage }))
);

// Project pages
export const ProjectListPage = lazy(() =>
  import('@/pages/projects').then((m) => ({ default: m.ProjectListPage }))
);
export const ProjectDetailPage = lazy(() =>
  import('@/pages/projects').then((m) => ({ default: m.ProjectDetailPage }))
);
export const ProjectCreatePage = lazy(() =>
  import('@/pages/projects').then((m) => ({ default: m.ProjectCreatePage }))
);
export const ProjectBomUploadPage = lazy(() =>
  import('@/pages/projects').then((m) => ({ default: m.ProjectBomUploadPage }))
);
export const ProjectBomListPage = lazy(() =>
  import('@/pages/projects').then((m) => ({ default: m.ProjectBomListPage }))
);
export const ProjectComponentsPage = lazy(() =>
  import('@/pages/projects').then((m) => ({ default: m.ProjectComponentsPage }))
);
export const ProjectSettingsPage = lazy(() =>
  import('@/pages/projects').then((m) => ({ default: m.ProjectSettingsPage }))
);

// Risk & Alerts pages
export const RiskDashboardPage = lazy(() =>
  import('@/pages/risk').then((m) => ({ default: m.RiskDashboardPage }))
);
export const AlertsDashboardPage = lazy(() =>
  import('@/pages/alerts').then((m) => ({ default: m.AlertsDashboardPage }))
);
export const WatchedComponentsPage = lazy(() =>
  import('@/pages/alerts/WatchedComponents').then((m) => ({ default: m.default }))
);

// Team management pages
export const TeamMembersPage = lazy(() =>
  import('@/pages/team/index').then((m) => ({ default: m.default }))
);
export const TeamInvitationsPage = lazy(() =>
  import('@/pages/team/invitations').then((m) => ({ default: m.default }))
);

// Billing pages
export const BillingPage = lazy(() =>
  import('@/pages/billing/index').then((m) => ({ default: m.default }))
);
export const BillingPlansPage = lazy(() =>
  import('@/pages/billing/plans').then((m) => ({ default: m.default }))
);
export const BillingInvoicesPage = lazy(() =>
  import('@/pages/billing/invoices').then((m) => ({ default: m.default }))
);
export const UsagePage = lazy(() =>
  import('@/pages/billing/usage').then((m) => ({ default: m.default }))
);

// Settings pages
export const SettingsPage = lazy(() =>
  import('@/pages/settings').then((m) => ({ default: m.default }))
);
export const OrganizationSettingsPage = lazy(() =>
  import('@/pages/settings/organization').then((m) => ({ default: m.default }))
);
export const PreferencesPage = lazy(() =>
  import('@/pages/settings/preferences').then((m) => ({ default: m.default }))
);

// Admin pages
export const AuditLogsPage = lazy(() =>
  import('@/pages/admin/audit-logs').then((m) => ({ default: m.default }))
);

// Team pages
export const TeamActivityPage = lazy(() =>
  import('@/pages/team/activity').then((m) => ({ default: m.default }))
);

// Portfolio page (owner-only)
export const PortfolioPage = lazy(() =>
  import('@/pages/portfolio/index').then((m) => ({ default: m.PortfolioPage }))
);

/**
 * Critical routes to preload after initial render
 * These are routes users are likely to navigate to immediately
 */
const CRITICAL_ROUTES = [
  () => import('@/pages/Dashboard'),
  () => import('@/pages/boms'),
  () => import('@/pages/components'),
];

/**
 * Preload critical routes using requestIdleCallback
 * This runs when the browser is idle to avoid blocking the main thread
 */
export function preloadCriticalRoutes(): void {
  // Check if browser supports requestIdleCallback
  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(
      () => {
        CRITICAL_ROUTES.forEach((importFn) => {
          importFn().catch((error) => {
            // Silently fail - route will load on demand if preload fails
            console.debug('Route preload failed:', error);
          });
        });
      },
      { timeout: 2000 } // Force execution within 2 seconds
    );
  } else {
    // Fallback for browsers without requestIdleCallback (e.g., Safari)
    setTimeout(() => {
      CRITICAL_ROUTES.forEach((importFn) => {
        importFn().catch((error) => {
          console.debug('Route preload failed:', error);
        });
      });
    }, 1000);
  }
}

/**
 * Route configuration object for easy reference
 * Maps route paths to their lazy-loaded components
 */
export const LAZY_ROUTES = {
  // Public routes
  landing: { path: '/landing', Component: LandingPage, name: 'Landing' },
  login: { path: '/login', Component: LoginPage, name: 'Login' },
  callback: {
    path: '/authentication/callback',
    Component: CallbackPage,
    name: 'Callback',
  },
  acceptInvitation: {
    path: '/invitations/:token',
    Component: AcceptInvitationPage,
    name: 'Accept Invitation',
  },

  // Protected routes
  dashboard: { path: '/', Component: DashboardPage, name: 'Dashboard' },

  // BOMs
  bomList: { path: '/boms', Component: BomListPage, name: 'BOMs' },
  bomDetail: {
    path: '/boms/:id',
    Component: BomDetailPage,
    name: 'BOM Details',
  },
  bomRisk: {
    path: '/boms/:id/risk',
    Component: RiskAnalysisPage,
    name: 'Risk Analysis',
  },
  bomUpload: {
    path: '/bom/upload',
    Component: BomUploadPage,
    name: 'Upload BOM',
  },
  bomCreate: {
    path: '/boms/create',
    Component: BomUploadPage,
    name: 'Create BOM',
  },

  // Components
  componentList: {
    path: '/components',
    Component: MyComponentsPage,
    name: 'My Components',
  },
  componentSearch: {
    path: '/components/search',
    Component: ComponentSearchPage,
    name: 'Global Search',
  },
  componentCompare: {
    path: '/components/compare',
    Component: ComponentCompareView,
    name: 'Compare Components',
  },
  componentDetail: {
    path: '/components/:id',
    Component: ComponentDetailPage,
    name: 'Component Details',
  },

  // Workspaces
  workspaceList: {
    path: '/workspaces',
    Component: WorkspaceListPage,
    name: 'Workspaces',
  },
  workspaceDetail: {
    path: '/workspaces/:id',
    Component: WorkspaceListPage,
    name: 'Workspace Details',
  },

  // Projects
  projectList: {
    path: '/projects',
    Component: ProjectListPage,
    name: 'Projects',
  },
  projectDetail: {
    path: '/projects/:projectId',
    Component: ProjectDetailPage,
    name: 'Project Details',
  },
  projectCreate: {
    path: '/projects/create',
    Component: ProjectCreatePage,
    name: 'Create Project',
  },
  projectBomUpload: {
    path: '/projects/:projectId/bom/upload',
    Component: ProjectBomUploadPage,
    name: 'Upload BOM',
  },
  projectBoms: {
    path: '/projects/:projectId/boms',
    Component: ProjectBomListPage,
    name: 'Project BOMs',
  },
  projectBomDetail: {
    path: '/projects/:projectId/boms/:bomId',
    Component: BomDetailPage,
    name: 'BOM Details',
  },
  projectComponents: {
    path: '/projects/:projectId/components',
    Component: ProjectComponentsPage,
    name: 'Project Components',
  },
  projectSettings: {
    path: '/projects/:projectId/settings',
    Component: ProjectSettingsPage,
    name: 'Project Settings',
  },

  // Risk & Alerts
  riskDashboard: {
    path: '/risk',
    Component: RiskDashboardPage,
    name: 'Risk Dashboard',
  },
  alertsDashboard: {
    path: '/alerts',
    Component: AlertsDashboardPage,
    name: 'Alerts',
  },
  watchedComponents: {
    path: '/alerts/watched',
    Component: WatchedComponentsPage,
    name: 'Watched Components',
  },

  // Team
  teamMembers: { path: '/team', Component: TeamMembersPage, name: 'Team' },
  teamInvitations: {
    path: '/team/invitations',
    Component: TeamInvitationsPage,
    name: 'Invitations',
  },

  // Billing
  billing: { path: '/billing', Component: BillingPage, name: 'Billing' },
  billingPlans: {
    path: '/billing/plans',
    Component: BillingPlansPage,
    name: 'Plans',
  },
  billingInvoices: {
    path: '/billing/invoices',
    Component: BillingInvoicesPage,
    name: 'Invoices',
  },
  billingUsage: {
    path: '/billing/usage',
    Component: UsagePage,
    name: 'Usage',
  },

  // Settings
  settings: { path: '/settings', Component: SettingsPage, name: 'Settings' },
  organizationSettings: {
    path: '/settings/organization',
    Component: OrganizationSettingsPage,
    name: 'Organization',
  },
  preferences: {
    path: '/settings/preferences',
    Component: PreferencesPage,
    name: 'Preferences',
  },

  // Admin
  auditLogs: {
    path: '/admin/audit-logs',
    Component: AuditLogsPage,
    name: 'Audit Logs',
  },

  // Team
  teamActivity: {
    path: '/team/activity',
    Component: TeamActivityPage,
    name: 'Team Activity',
  },

  // Portfolio (owner-only)
  portfolio: {
    path: '/portfolio',
    Component: PortfolioPage,
    name: 'Portfolio',
  },
} as const;
