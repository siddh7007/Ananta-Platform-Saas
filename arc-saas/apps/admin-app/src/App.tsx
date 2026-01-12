import { Refine, Authenticated } from "@refinedev/core";
import { RefineKbar, RefineKbarProvider } from "@refinedev/kbar";
import routerBindings, {
  DocumentTitleHandler,
  UnsavedChangesNotifier,
  CatchAllNavigate,
} from "@refinedev/react-router-v6";
import { BrowserRouter, Outlet, Route, Routes, useNavigate } from "react-router-dom";
import { AuthProvider as OidcProvider, useAuth } from "react-oidc-context";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { lazy, Suspense, useEffect, useMemo, useState } from "react";

import { authProvider, createKeycloakAuthProvider } from "./providers/auth-provider";
import { dataProvider } from "./providers/data-provider";
import { accessControlProvider, setOidcAccessToken } from "./providers/access-control-provider";
import { OnlineStatusProvider } from "./providers/online-status-provider";
import { NotificationProvider } from "./providers/notification-provider";
import { oidcConfig, isKeycloakConfigured } from "./lib/keycloak-config";
import { ErrorBoundary } from "./components/error-boundary";
import { OfflineBanner } from "./components/offline-banner";
import { Layout } from "./components/layout";
import { logger } from "./lib/logger";
import { getResourcesForRole, getAllResources } from "./config/navigation";
import { getRoleFromToken, type AppRole, DEFAULT_ROLE } from "./lib/role-parser";

// Create a stable QueryClient instance
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      refetchOnWindowFocus: false,
    },
  },
});

// Lazy load page components for code splitting
const Dashboard = lazy(() => import("./pages/dashboard").then(m => ({ default: m.Dashboard })));
const TenantList = lazy(() => import("./pages/tenants").then(m => ({ default: m.TenantList })));
const TenantShow = lazy(() => import("./pages/tenants").then(m => ({ default: m.TenantShow })));
const TenantCreate = lazy(() => import("./pages/tenants").then(m => ({ default: m.TenantCreate })));
const PlanList = lazy(() => import("./pages/plans").then(m => ({ default: m.PlanList })));
const PlanCreate = lazy(() => import("./pages/plans").then(m => ({ default: m.PlanCreate })));
const PlanEdit = lazy(() => import("./pages/plans").then(m => ({ default: m.PlanEdit })));
const SubscriptionList = lazy(() => import("./pages/subscriptions").then(m => ({ default: m.SubscriptionList })));
const SubscriptionShow = lazy(() => import("./pages/subscriptions").then(m => ({ default: m.SubscriptionShow })));
const WorkflowList = lazy(() => import("./pages/workflows").then(m => ({ default: m.WorkflowList })));
const WorkflowShow = lazy(() => import("./pages/workflows").then(m => ({ default: m.WorkflowShow })));
const UserList = lazy(() => import("./pages/users").then(m => ({ default: m.UserList })));
const UserShow = lazy(() => import("./pages/users").then(m => ({ default: m.UserShow })));
const UserCreate = lazy(() => import("./pages/users").then(m => ({ default: m.UserCreate })));
const InvitationList = lazy(() => import("./pages/invitations").then(m => ({ default: m.InvitationList })));
const BillingDashboard = lazy(() => import("./pages/billing").then(m => ({ default: m.BillingDashboard })));
const PaymentMethodsPage = lazy(() => import("./pages/billing").then(m => ({ default: m.PaymentMethodsPage })));
const InvoicesPage = lazy(() => import("./pages/billing").then(m => ({ default: m.InvoicesPage })));
const UsageDashboard = lazy(() => import("./pages/usage").then(m => ({ default: m.UsageDashboard })));
const RoleList = lazy(() => import("./pages/roles").then(m => ({ default: m.RoleList })));
const AuditLogList = lazy(() => import("./pages/audit-logs").then(m => ({ default: m.AuditLogList })));
const SettingsList = lazy(() => import("./pages/settings").then(m => ({ default: m.SettingsList })));
const SystemHealthDashboard = lazy(() => import("./pages/monitoring").then(m => ({ default: m.SystemHealthDashboard })));
const MetricsDashboard = lazy(() => import("./pages/monitoring").then(m => ({ default: m.MetricsDashboard })));
const AnalyticsDashboard = lazy(() => import("./pages/monitoring").then(m => ({ default: m.AnalyticsDashboard })));
const NotificationList = lazy(() => import("./pages/notifications").then(m => ({ default: m.NotificationList })));
const NotificationHistory = lazy(() => import("./pages/notifications").then(m => ({ default: m.NotificationHistory })));
const NotificationPreferences = lazy(() => import("./pages/notifications").then(m => ({ default: m.NotificationPreferences })));
const NotificationAnalytics = lazy(() => import("./pages/notifications").then(m => ({ default: m.NotificationAnalytics })));
const NotificationShow = lazy(() => import("./pages/notifications").then(m => ({ default: m.NotificationShow })));
const LoginPage = lazy(() => import("./pages/login").then(m => ({ default: m.LoginPage })));
const RegisterPage = lazy(() => import("./pages/register").then(m => ({ default: m.RegisterPage })));
const VerifyPage = lazy(() => import("./pages/register/verify").then(m => ({ default: m.VerifyPage })));
const OnboardPage = lazy(() => import("./pages/register/onboard").then(m => ({ default: m.OnboardPage })));
const LandingPage = lazy(() => import("./pages/landing").then(m => ({ default: m.LandingPage })));
const AlertList = lazy(() => import("./pages/alerts").then(m => ({ default: m.AlertList })));

/**
 * Loading fallback component for lazy-loaded pages
 */
function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
        <p className="mt-4 text-muted-foreground">Loading...</p>
      </div>
    </div>
  );
}

// Initialize logger
logger.info("Admin App initialized", { version: "1.0.0" });

/**
 * Callback handler for OIDC redirect
 */
function CallbackPage() {
  const auth = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!auth.isLoading && auth.isAuthenticated) {
      // Redirect to dashboard after successful authentication
      navigate("/", { replace: true });
    }
  }, [auth.isLoading, auth.isAuthenticated, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
        <p className="mt-4 text-muted-foreground">Completing login...</p>
      </div>
    </div>
  );
}

/**
 * Inner app component that uses OIDC hooks
 */
function AppContent() {
  const auth = useAuth();

  // SYNCHRONOUSLY set the OIDC token before any access control checks
  // This runs during the render phase, ensuring the token is available
  // before Refine's accessControlProvider.can() is called
  if (auth.isAuthenticated && auth.user?.access_token) {
    setOidcAccessToken(auth.user.access_token);
  }

  // Also use useEffect for cleanup and logging
  useEffect(() => {
    if (auth.isAuthenticated && auth.user?.access_token) {
      logger.info("OIDC token synced to access control provider", {
        userId: auth.user.profile?.sub,
        role: getRoleFromToken(auth.user.access_token),
      });
    } else if (!auth.isAuthenticated && !auth.isLoading) {
      // Clear the token when logged out
      setOidcAccessToken(null);
    }
  }, [auth.isAuthenticated, auth.user?.access_token, auth.isLoading]);

  // Create auth provider based on Keycloak state
  const currentAuthProvider = isKeycloakConfigured()
    ? createKeycloakAuthProvider({
        isAuthenticated: auth.isAuthenticated,
        user: auth.user,
        signinRedirect: auth.signinRedirect,
        signoutRedirect: auth.signoutRedirect,
        removeUser: auth.removeUser,
      })
    : authProvider;

  // Get user role from OIDC token or localStorage
  const userRole: AppRole = useMemo(() => {
    // Try OIDC token first
    if (auth.isAuthenticated && auth.user?.access_token) {
      const role = getRoleFromToken(auth.user.access_token);
      logger.debug("Role from OIDC token", { role });
      return role;
    }
    // Fall back to localStorage
    const storedToken = localStorage.getItem("arc_admin_token");
    if (storedToken) {
      const role = getRoleFromToken(storedToken);
      logger.debug("Role from stored token", { role });
      return role;
    }
    return DEFAULT_ROLE;
  }, [auth.isAuthenticated, auth.user?.access_token]);

  // Get resources filtered by user role
  // Note: Plan-based filtering is deferred until after Refine loads
  const resources = useMemo(() => {
    if (auth.isAuthenticated || localStorage.getItem("arc_admin_token")) {
      const filtered = getResourcesForRole(userRole, undefined);
      logger.debug("Resources for role", { role: userRole, count: filtered.length });
      return filtered;
    }
    // Return all resources when not authenticated (routes will still be protected)
    return getAllResources(undefined);
  }, [auth.isAuthenticated, userRole]);

  // Show loading state while OIDC is initializing
  if (auth.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Handle OIDC errors
  if (auth.error) {
    logger.error("OIDC Error", { error: auth.error.message });
  }

  return (
    <RefineKbarProvider>
      <Refine
        dataProvider={dataProvider}
        authProvider={currentAuthProvider}
        accessControlProvider={accessControlProvider}
        routerProvider={routerBindings}
        resources={resources}
        options={{
          syncWithLocation: true,
          warnWhenUnsavedChanges: true,
          projectId: "arc-saas-admin",
        }}
      >
        <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* Public Routes */}
            <Route
              path="/login"
              element={
                <Authenticated key="login" fallback={<LoginPage />}>
                  <CatchAllNavigate to="/" />
                </Authenticated>
              }
            />

            {/* OIDC Callback Route */}
            <Route path="/callback" element={<CallbackPage />} />

            {/* Public Landing Page */}
            <Route path="/landing" element={<LandingPage />} />

            {/* Public Registration Routes (Tenant Onboarding Flow) */}
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/register/verify" element={<VerifyPage />} />
            <Route path="/register/onboard" element={<OnboardPage />} />

            {/* Protected Routes */}
            <Route
              element={
                <Authenticated key="authenticated" fallback={<CatchAllNavigate to="/login" />}>
                  <Layout>
                    <ErrorBoundary>
                      <Suspense fallback={<PageLoader />}>
                        <Outlet />
                      </Suspense>
                    </ErrorBoundary>
                  </Layout>
                </Authenticated>
              }
            >
              <Route index element={<Dashboard />} />

              {/* Tenants */}
              <Route path="/tenants">
                <Route index element={<TenantList />} />
                <Route path="create" element={<TenantCreate />} />
                <Route path=":id" element={<TenantShow />} />
              </Route>

              {/* Plans */}
              <Route path="/plans">
                <Route index element={<PlanList />} />
                <Route path="create" element={<PlanCreate />} />
                <Route path=":id/edit" element={<PlanEdit />} />
              </Route>

              {/* Subscriptions */}
              <Route path="/subscriptions">
                <Route index element={<SubscriptionList />} />
                <Route path=":id" element={<SubscriptionShow />} />
              </Route>

              {/* Workflows */}
              <Route path="/workflows">
                <Route index element={<WorkflowList />} />
                <Route path=":id" element={<WorkflowShow />} />
              </Route>

              {/* Users */}
              <Route path="/users">
                <Route index element={<UserList />} />
                <Route path="create" element={<UserCreate />} />
                <Route path=":id" element={<UserShow />} />
              </Route>

              {/* Invitations */}
              <Route path="/invitations" element={<InvitationList />} />

              {/* Billing */}
              <Route path="/billing">
                <Route index element={<BillingDashboard />} />
                <Route path="payment-methods" element={<PaymentMethodsPage />} />
                <Route path="invoices" element={<InvoicesPage />} />
                <Route path="usage" element={<UsageDashboard />} />
              </Route>

              {/* Usage - also accessible at /usage */}
              <Route path="/usage" element={<UsageDashboard />} />

              {/* Roles */}
              <Route path="/roles" element={<RoleList />} />

              {/* Alerts */}
              <Route path="/alerts" element={<AlertList />} />

              {/* Audit Logs */}
              <Route path="/audit-logs" element={<AuditLogList />} />

              {/* Settings */}
              <Route path="/settings" element={<SettingsList />} />

              {/* Monitoring */}
              <Route path="/monitoring">
                <Route index element={<SystemHealthDashboard />} />
                <Route path="health" element={<SystemHealthDashboard />} />
                <Route path="metrics" element={<MetricsDashboard />} />
                <Route path="analytics" element={<AnalyticsDashboard />} />
              </Route>

              {/* Notifications */}
              <Route path="/notifications">
                <Route index element={<NotificationList />} />
                <Route path="templates" element={<NotificationList />} />
                <Route path="templates/:id" element={<NotificationShow />} />
                <Route path="history" element={<NotificationHistory />} />
                <Route path="preferences" element={<NotificationPreferences />} />
                <Route path="analytics" element={<NotificationAnalytics />} />
              </Route>

              {/* Catch all - 404 */}
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
        </Suspense>

        <RefineKbar />
        <UnsavedChangesNotifier />
        <DocumentTitleHandler />
      </Refine>
    </RefineKbarProvider>
  );
}

function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
      <h1 className="text-6xl font-bold text-muted-foreground">404</h1>
      <h2 className="mt-4 text-2xl font-semibold">Page Not Found</h2>
      <p className="mt-2 text-muted-foreground">
        The page you're looking for doesn't exist.
      </p>
    </div>
  );
}

/**
 * Main App component with OIDC Provider wrapper
 */
function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <OnlineStatusProvider>
          <NotificationProvider>
            <BrowserRouter>
              <OfflineBanner />
              {isKeycloakConfigured() ? (
                <OidcProvider {...oidcConfig}>
                  <AppContent />
                </OidcProvider>
              ) : (
                <AppContent />
              )}
            </BrowserRouter>
          </NotificationProvider>
        </OnlineStatusProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
