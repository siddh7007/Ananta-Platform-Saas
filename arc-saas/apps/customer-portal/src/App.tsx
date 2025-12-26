import { Refine, Authenticated } from '@refinedev/core';
import { DevtoolsProvider, DevtoolsPanel } from '@refinedev/devtools';
import routerBindings, {
  DocumentTitleHandler,
  NavigateToResource,
  UnsavedChangesNotifier,
  CatchAllNavigate,
} from '@refinedev/react-router-v6';
import { Routes, Route, Outlet } from 'react-router-dom';
import { useEffect } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';

import { env } from '@/config/env';
import { Layout } from '@/components/layout/Layout';
import { ErrorBoundary } from '@/components/shared';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { OfflineIndicator } from '@/components/ui/offline-indicator';
import { PWAUpdatePrompt } from '@/components/ui/pwa-update-prompt';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { TenantProvider } from '@/contexts/TenantContext';
import { WorkspaceProvider } from '@/contexts/WorkspaceContext';
import { authProvider } from '@/providers/authProvider';
import { dataProviders } from '@/providers/dataProvider';
import { createAccessControlProvider } from '@/providers/accessControlProvider';
import type { AppRole } from '@/config/auth';
import { queryClient } from '@/lib/query-client';

// Lazy-loaded pages with code splitting
import {
  LandingPage,
  LoginPage,
  CallbackPage,
  AcceptInvitationPage,
  DashboardPage,
  BomListPage,
  BomUploadPage,
  BomDetailPage,
  RiskAnalysisPage,
  ComponentListPage,
  ComponentDetailPage,
  ComponentCompareView,
  ComponentSearchPage,
  MyComponentsPage,
  WorkspaceListPage,
  ProjectListPage,
  ProjectDetailPage,
  ProjectCreatePage,
  ProjectBomUploadPage,
  ProjectBomListPage,
  ProjectComponentsPage,
  ProjectSettingsPage,
  RiskDashboardPage,
  AlertsDashboardPage,
  WatchedComponentsPage,
  PortfolioPage,
  TeamMembersPage,
  TeamInvitationsPage,
  BillingPage,
  BillingPlansPage,
  BillingInvoicesPage,
  UsagePage,
  SettingsPage,
  OrganizationSettingsPage,
  PreferencesPage,
  AuditLogsPage,
  TeamActivityPage,
  LazyRoute,
  preloadCriticalRoutes,
} from '@/routes/lazy-routes';

/**
 * Inner app component that has access to auth context
 * Wraps Refine with accessControlProvider that uses current user role
 */
function RefineAppInner() {
  const { user } = useAuth();

  // Preload critical routes after initial render
  useEffect(() => {
    preloadCriticalRoutes();
  }, []);

  // Create access control provider with current user role
  const accessControlProvider = createAccessControlProvider(
    () => (user?.role as AppRole) || null
  );

  return (
    <Refine
      dataProvider={dataProviders}
      authProvider={authProvider}
      accessControlProvider={accessControlProvider}
      routerProvider={routerBindings}
      resources={[
        {
          name: 'dashboard',
          list: '/',
          meta: {
            label: 'Dashboard',
            icon: 'home',
            dataProviderName: 'default',
          },
        },
        {
          name: 'boms',
          list: '/boms',
          show: '/boms/:id',
          create: '/bom/upload',
          meta: {
            label: 'BOMs',
            icon: 'file-text',
            dataProviderName: 'cns', // CNS service handles BOMs
          },
        },
        {
          name: 'components',
          list: '/components',
          show: '/components/:id',
          meta: {
            label: 'Components',
            icon: 'cpu',
            dataProviderName: 'supabase', // Component catalog
          },
        },
        {
          name: 'team',
          list: '/team',
          meta: {
            label: 'Team',
            icon: 'users',
            dataProviderName: 'platform', // Platform handles users
          },
        },
        {
          name: 'billing',
          list: '/billing',
          meta: {
            label: 'Billing',
            icon: 'credit-card',
            dataProviderName: 'platform', // Platform handles billing
          },
        },
        {
          name: 'workspaces',
          list: '/workspaces',
          show: '/workspaces/:id',
          create: '/workspaces/new',
          meta: {
            label: 'Workspaces',
            icon: 'folder-open',
            dataProviderName: 'cns', // CNS service handles workspaces
          },
        },
        {
          name: 'projects',
          list: '/projects',
          show: '/projects/:id',
          create: '/projects/create',
          meta: {
            label: 'Projects',
            icon: 'folder-kanban',
            dataProviderName: 'cns', // CNS service handles projects
          },
        },
        {
          name: 'risk',
          list: '/risk',
          meta: {
            label: 'Risk Analysis',
            icon: 'alert-triangle',
            dataProviderName: 'cns', // CNS handles risk scoring
          },
        },
        {
          name: 'alerts',
          list: '/alerts',
          meta: {
            label: 'Alerts',
            icon: 'bell',
            dataProviderName: 'cns', // CNS handles alerts
          },
        },
        {
          name: 'settings',
          list: '/settings',
          meta: {
            label: 'Settings',
            icon: 'settings',
            dataProviderName: 'platform',
          },
        },
      ]}
      options={{
        syncWithLocation: true,
        warnWhenUnsavedChanges: true,
        projectId: 'cbp-customer-portal',
      }}
    >
      <Routes>
        {/* Public routes */}
        <Route path="/landing" element={LazyRoute(LandingPage, 'Landing')} />
        <Route path="/login" element={LazyRoute(LoginPage, 'Login')} />
        <Route path="/authentication/callback" element={LazyRoute(CallbackPage, 'Callback')} />
        <Route path="/invitations/:token" element={LazyRoute(AcceptInvitationPage, 'Accept Invitation')} />

        {/* Protected routes */}
        <Route
          element={
            <Authenticated
              key="authenticated-layout"
              fallback={<CatchAllNavigate to="/landing" />}
            >
              <TenantProvider>
                <WorkspaceProvider>
                  <Layout>
                    <Outlet />
                  </Layout>
                </WorkspaceProvider>
              </TenantProvider>
            </Authenticated>
          }
        >
          <Route index element={LazyRoute(DashboardPage, 'Dashboard')} />
          <Route path="/boms" element={LazyRoute(BomListPage, 'BOMs')} />
          <Route path="/boms/:id" element={LazyRoute(BomDetailPage, 'BOM Details')} />
          <Route path="/boms/:id/risk" element={LazyRoute(RiskAnalysisPage, 'Risk Analysis')} />
          <Route path="/bom/upload" element={LazyRoute(BomUploadPage, 'BOM Upload')} />
          <Route path="/boms/create" element={LazyRoute(BomUploadPage, 'Create BOM')} />
          <Route path="/components" element={LazyRoute(MyComponentsPage, 'My Components')} />
          <Route path="/components/search" element={LazyRoute(ComponentSearchPage, 'Global Search')} />
          <Route path="/components/compare" element={LazyRoute(ComponentCompareView, 'Compare Components')} />
          <Route path="/components/:id" element={LazyRoute(ComponentDetailPage, 'Component Details')} />
          <Route path="/workspaces" element={LazyRoute(WorkspaceListPage, 'Workspaces')} />
          <Route path="/workspaces/:id" element={LazyRoute(WorkspaceListPage, 'Workspace Details')} />

          {/* Projects */}
          <Route path="/projects" element={LazyRoute(ProjectListPage, 'Projects')} />
          <Route path="/projects/create" element={LazyRoute(ProjectCreatePage, 'Create Project')} />
          <Route path="/projects/:projectId" element={LazyRoute(ProjectDetailPage, 'Project Details')} />
          <Route path="/projects/:projectId/bom/upload" element={LazyRoute(ProjectBomUploadPage, 'Upload BOM')} />
          <Route path="/projects/:projectId/boms" element={LazyRoute(ProjectBomListPage, 'Project BOMs')} />
          <Route path="/projects/:projectId/boms/:id" element={LazyRoute(BomDetailPage, 'BOM Details')} />
          <Route path="/projects/:projectId/components" element={LazyRoute(ProjectComponentsPage, 'Project Components')} />
          <Route path="/projects/:projectId/settings" element={LazyRoute(ProjectSettingsPage, 'Project Settings')} />

          {/* Risk Analysis */}
          <Route path="/risk" element={LazyRoute(RiskDashboardPage, 'Risk Dashboard')} />

          {/* Alerts */}
          <Route path="/alerts" element={LazyRoute(AlertsDashboardPage, 'Alerts')} />
          <Route path="/alerts/watched" element={LazyRoute(WatchedComponentsPage, 'Watched Components')} />

          {/* Team Management */}
          <Route path="/team" element={LazyRoute(TeamMembersPage, 'Team')} />
          <Route path="/team/invitations" element={LazyRoute(TeamInvitationsPage, 'Invitations')} />

          {/* Billing */}
          <Route path="/billing" element={LazyRoute(BillingPage, 'Billing')} />
          <Route path="/billing/plans" element={LazyRoute(BillingPlansPage, 'Plans')} />
          <Route path="/billing/invoices" element={LazyRoute(BillingInvoicesPage, 'Invoices')} />
          <Route path="/billing/usage" element={LazyRoute(UsagePage, 'Usage')} />

          {/* Settings */}
          <Route path="/settings" element={LazyRoute(SettingsPage, 'Settings')} />
          <Route path="/settings/organization" element={LazyRoute(OrganizationSettingsPage, 'Organization')} />
          <Route path="/settings/preferences" element={LazyRoute(PreferencesPage, 'Preferences')} />

          {/* Admin */}
          <Route path="/admin/audit-logs" element={LazyRoute(AuditLogsPage, 'Audit Logs')} />

          {/* Team */}
          <Route path="/team/activity" element={LazyRoute(TeamActivityPage, 'Team Activity')} />

          {/* Portfolio (owner-only) */}
          <Route path="/portfolio" element={LazyRoute(PortfolioPage, 'Portfolio')} />

          {/* Catch-all */}
          <Route path="*" element={<NavigateToResource resource="dashboard" />} />
        </Route>
      </Routes>
      <UnsavedChangesNotifier />
      <DocumentTitleHandler />
    </Refine>
  );
}

/**
 * Main App component
 * Wraps everything with providers:
 * - QueryClientProvider for React Query caching
 * - AuthProvider for authentication state
 */
function App() {
  const AppContent = (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider delayDuration={200}>
        <AuthProvider>
          <RefineAppInner />
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );

  if (env.features.devtools) {
    return (
      <DevtoolsProvider>
        <ErrorBoundary>
          {AppContent}
          <Toaster />
          <OfflineIndicator position="top" showOnlineMessage />
          <PWAUpdatePrompt position="bottom" showOfflineReady={false} />
        </ErrorBoundary>
        <DevtoolsPanel />
      </DevtoolsProvider>
    );
  }

  return (
    <ErrorBoundary>
      {AppContent}
      <Toaster />
      <OfflineIndicator position="top" showOnlineMessage />
      <PWAUpdatePrompt position="bottom" showOfflineReady={false} />
    </ErrorBoundary>
  );
}

export default App;
