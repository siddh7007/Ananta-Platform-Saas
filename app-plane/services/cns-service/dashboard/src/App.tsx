import React from 'react';
import { Admin, Resource, CustomRoutes, AuthProvider, usePermissions } from 'react-admin';
import { Route, Navigate } from 'react-router-dom';
import { Auth0Provider } from '@auth0/auth0-react';
import { Auth0Login } from './lib/auth';
import { Auth0StateSync } from './components/Auth0StateSync';
import { ThemeContextProvider, useThemeContext } from './contexts/ThemeContext';

// Keycloak SSO - Alternative authentication
import { keycloakAuthProvider, KeycloakLogin } from './lib/keycloak';

// No-auth provider for development (VITE_AUTH_PROVIDER=none)
import { noAuthProvider } from './lib/auth/noAuthProvider';

// Icons - only used for Resource definitions
import ListAltIcon from '@mui/icons-material/ListAlt';

import { dataProvider } from './dataProvider';
import { auth0AuthProvider as authProvider } from './auth0AuthProvider';
import { Dashboard } from './Dashboard';
import { Layout as CustomLayout } from './layout';

// Analytics module
import { AnalyticsDashboard, AuditStreamView, SupplierResponsesView, FileArtifactsView } from './analytics';

// Audit module
import { AuditTrailViewer } from './audit';

// Config module
import { EnrichmentConfigPage, SupplierAPIsConfig, DigiKeyOAuthCallback } from './config';

// Customer module
import { CustomerUploadsList, CustomerBOMs, CustomerEnrichment, CustomerCatalog, CustomerPortalPage } from './customer';

// Quality module
import { QualityQueue } from './quality';

// Enrichment module
import { EnrichmentMonitor } from './enrichment';

// Logs module
import { ActivityLog } from './logs';

// BOM module
import { BOMUploadWizard, BOMJobDetail, BOMLineItemList, BOMLineItemShow, BOMLineItemEdit, AllUploads, BOMView } from './bom';
import { UnifiedBOMUpload } from './bom/unified-upload';

// Bulk uploads
import { BulkUploadsList, BulkUploadDetail } from './bulk';

// Components
import { ComponentEnrichmentDetail } from './components/enrichment-detail';
import { ComponentSearchEnhanced } from './components/ComponentSearchEnhanced';
import { ComponentDetailPage } from './components/ComponentDetailPage';

// Uploads
import { RedisBOMUpload } from './uploads';

// Pages
import RateLimitingSettings from './pages/RateLimitingSettings';
import StaffBOMWorkflow from './pages/StaffBOMWorkflow';
import UnifiedBOMWorkflow from './pages/UnifiedBOMWorkflow';
import UserProfile from './pages/UserProfile';
import Notifications from './pages/Notifications';
import Portals from './pages/Portals';

// Contexts
import { NotificationProvider } from './contexts/NotificationContext';
import { TenantProvider } from './contexts/TenantContext';

// Security
import { SessionTimeoutProvider } from './components/SessionTimeoutProvider';

// Utils

// Config
import { CNS_STAFF_ORGANIZATION_ID } from './config/api';

/**
 * CNS React Admin Dashboard
 *
 * Platform staff tool for Component Normalization Service (Platform Admins Only)
 * Port: 27810
 * Access: /admin-login route REQUIRED
 *
 * AUTH PROVIDERS (configured via VITE_AUTH_PROVIDER):
 * - auth0: Auth0 with organization enforcement
 * - keycloak: Keycloak SSO (Components Platform realm, default)
 *
 * Features:
 * - Authentication: Auth0 or Keycloak SSO
 * - Analytics dashboard with enrichment metrics
 * - BOM upload interface
 * - Catalog management
 * - Supplier usage tracking
 */

// Auth provider type from environment
const AUTH_PROVIDER = import.meta.env.VITE_AUTH_PROVIDER?.toLowerCase() || 'keycloak';

// Wrapper for staff bulk uploads (no organization/project context needed)
const BOMUploadWizardPage = () => (
  <BOMUploadWizard organizationId={CNS_STAFF_ORGANIZATION_ID} projectId={undefined} source="staff_bulk" />
);

// CNS dashboard is platform-only, always force platform org login
const PlatformAdminLoginPage = () => (
  <Auth0Login
    title="CNS Platform Login"
    subtitle="Sign in with your platform admin account"
    forcePlatformOrgLogin
  />
);

// Use enhanced component search for catalog menu entry with V1-style features
const CatalogView = () => <ComponentSearchEnhanced />;

// Redirect /customer/boms/:bomId to appropriate view based on hash
// - No hash or #boms → /boms/:bomId (unified BOM detail view)
// - #components or #risks → /customer/portal with that hash (stay in portal tabs)
const CustomerBOMRedirect = () => {
  const { bomId } = React.useMemo(() => {
    const path = window.location.pathname;
    const match = path.match(/\/customer\/boms\/([^/]+)/);
    return { bomId: match ? match[1] : '' };
  }, []);

  React.useEffect(() => {
    if (bomId) {
      const hash = window.location.hash;
      // If hash is #components or #risks, stay in customer portal
      if (hash === '#components' || hash === '#risks') {
        window.location.href = `/customer/portal${hash}`;
      } else {
        // Default: go to unified BOM view (which shows the BOM details)
        window.location.href = `/boms/${bomId}`;
      }
    }
  }, [bomId]);

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px' }}>
      <span>Redirecting...</span>
    </div>
  );
};

/**
 * Admin Resources (shared between auth providers)
 * Theme is passed directly to Admin component (no ThemeProvider wrapper needed)
 */
interface AdminContentProps {
  authProvider: AuthProvider;
  loginPage: React.ComponentType;
}

const SUPER_ADMIN_ROLE_ALIASES = new Set([
  'super_admin',
  'super-admin',
  'platform:super_admin',
  'platform-super-admin',
]);

const normalizePermissions = (permissions: unknown): string[] => {
  if (!permissions || permissions === 'pending') {
    return [];
  }

  if (Array.isArray(permissions)) {
    return permissions.filter((perm): perm is string => typeof perm === 'string');
  }

  if (typeof permissions === 'string') {
    return [permissions];
  }

  return [];
};

const isSuperAdminPermission = (permissions: unknown): boolean => {
  return normalizePermissions(permissions).some((role) => SUPER_ADMIN_ROLE_ALIASES.has(role));
};

const RequireSuperAdmin = ({ children }: { children: React.ReactElement }) => {
  const { permissions, isLoading } = usePermissions();

  if (isLoading || permissions === 'pending') {
    return (
      <div style={{ padding: '24px', color: '#666' }}>
        Checking access...
      </div>
    );
  }

  if (!isSuperAdminPermission(permissions)) {
    return (
      <div style={{ padding: '24px', color: '#b91c1c' }}>
        Access denied. Super admin access required.
      </div>
    );
  }

  return children;
};

const AdminContent = ({ authProvider: selectedAuthProvider, loginPage }: AdminContentProps) => {
  const { currentTheme } = useThemeContext();

  return (
    <TenantProvider>
      <NotificationProvider>
        <SessionTimeoutProvider>
          <Admin
            dataProvider={dataProvider}
            authProvider={selectedAuthProvider}
            dashboard={Dashboard}
            title="CNS Dashboard"
            loginPage={loginPage}
            disableTelemetry
            layout={CustomLayout}
            theme={currentTheme}
          >
          {/* Custom Routes */}
          <CustomRoutes>
            {/* NEW: Unified Customer Portal */}
            <Route
              path="/customer/portal"
              element={<RequireSuperAdmin><CustomerPortalPage /></RequireSuperAdmin>}
            />
            {/* Customer BOM detail view - redirect to unified BOM view with bomId */}
            <Route
              path="/customer/boms/:bomId"
              element={<CustomerBOMRedirect />}
            />
            {/* Legacy customer routes - redirect to unified portal with appropriate tab */}
            <Route
              path="/customer/boms"
              element={<Navigate to="/customer/portal?tab=boms" replace />}
            />
            <Route
              path="/customer/catalog"
              element={<Navigate to="/customer/portal?tab=components" replace />}
            />
            <Route
              path="/customer/enrichment"
              element={<Navigate to="/customer/portal?tab=risks" replace />}
            />
            {/* Shortcut routes for direct tab access: /#/boms, /#/components, /#/risks */}
            <Route
              path="/boms"
              element={<Navigate to="/customer/portal?tab=boms" replace />}
            />
            <Route
              path="/components"
              element={<Navigate to="/customer/portal?tab=components" replace />}
            />
            <Route
              path="/risks"
              element={<Navigate to="/customer/portal?tab=risks" replace />}
            />
            {/* Customer uploads - keep separate for now (legacy bulk upload view) */}
            <Route
              path="/customer/uploads"
              element={<RequireSuperAdmin><CustomerUploadsList /></RequireSuperAdmin>}
            />
            <Route path="/analytics" element={<AnalyticsDashboard />} />
            <Route path="/config" element={<EnrichmentConfigPage />} />
            <Route path="/rate-limiting" element={<RateLimitingSettings />} />
            <Route path="/supplier-apis" element={<SupplierAPIsConfig />} />
            <Route path="/supplier-apis/digikey/callback" element={<DigiKeyOAuthCallback />} />
            <Route path="/bom-wizard" element={<BOMUploadWizard organizationId={CNS_STAFF_ORGANIZATION_ID} projectId={undefined} source="staff_bulk" />} />
            <Route path="/bom-upload" element={<StaffBOMWorkflow />} />
            {/* New upload endpoints for testing */}
            <Route path="/upload-unified" element={<UnifiedBOMWorkflow />} />
            <Route path="/upload-persisted" element={<UnifiedBOMUpload />} />
            <Route path="/upload-redis" element={<RedisBOMUpload />} />
            <Route path="/component-search" element={<ComponentSearchEnhanced />} />
            <Route path="/quality-queue" element={<QualityQueue />} />
            <Route path="/enrichment-monitor" element={<EnrichmentMonitor />} />
            <Route path="/activity-log" element={<ActivityLog />} />
            <Route path="/supplier-responses" element={<SupplierResponsesView />} />
            <Route path="/artifacts" element={<FileArtifactsView />} />
            <Route path="/bom-jobs/:jobId" element={<BOMJobDetail />} />
            <Route path="/boms/:bomId" element={<BOMView />} />
            <Route path="/components/:mpn/detail" element={<ComponentEnrichmentDetail />} />
            <Route path="/component/:id" element={<ComponentDetailPage />} />
            <Route path="/bulk-uploads" element={<BulkUploadsList />} />
            <Route path="/bulk-uploads/:uploadId" element={<BulkUploadDetail />} />
            <Route path="/all-uploads" element={<AllUploads />} />
            <Route path="/audit-trail" element={<AuditTrailViewer />} />
            <Route path="/audit-stream" element={<AuditStreamView />} />
            <Route path="/profile" element={<UserProfile />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/portals" element={<Portals />} />
          </CustomRoutes>

          {/*
           * Resources - Only for React Admin dataProvider integration (CRUD operations)
           *
           * NOTE: CustomRoutes above handle all page routing. Resources are only needed for:
           * - Pages that use React Admin's list/show/edit/create pattern
           * - Integration with dataProvider for API calls
           *
           * Sidebar navigation is driven by menuSchema.ts, NOT by Resource definitions.
           */}
          <Resource
            name="bom_line_items"
            list={BOMLineItemList}
            show={BOMLineItemShow}
            edit={BOMLineItemEdit}
            options={{ label: 'BOM Line Items' }}
            icon={ListAltIcon}
          />
        </Admin>
      </SessionTimeoutProvider>
    </NotificationProvider>
  </TenantProvider>
  );
};

/**
 * Auth0 App Wrapper
 */
const Auth0App = () => {
  const auth0Domain = import.meta.env.VITE_AUTH0_DOMAIN;
  const auth0ClientId = import.meta.env.VITE_AUTH0_CLIENT_ID;
  // CRITICAL: Audience must match AUTH0_AUDIENCE in CNS API for JWT validation
  const auth0Audience = import.meta.env.VITE_AUTH0_AUDIENCE || 'https://api.components-platform.com';

  if (!auth0Domain || !auth0ClientId) {
    return (
      <div style={{ padding: '20px', color: 'red' }}>
        <h1>Configuration Error</h1>
        <p>Missing Auth0 configuration. Please set VITE_AUTH0_DOMAIN and VITE_AUTH0_CLIENT_ID.</p>
        <p>Or switch to Keycloak by setting VITE_AUTH_PROVIDER=keycloak</p>
      </div>
    );
  }

  return (
    <ThemeContextProvider>
      <Auth0Provider
        domain={auth0Domain}
        clientId={auth0ClientId}
        authorizationParams={{
          redirect_uri: window.location.origin,
          organization: import.meta.env.VITE_DEFAULT_ORG_ID || 'org_oNtVXvVrzXz1ubua', // Platform admin organization
          audience: auth0Audience, // Required for JWT access token (not opaque)
        }}
      >
        <Auth0StateSync>
          <AdminContent authProvider={authProvider} loginPage={PlatformAdminLoginPage} />
        </Auth0StateSync>
      </Auth0Provider>
    </ThemeContextProvider>
  );
};

/**
 * Keycloak App Wrapper
 * Uses SSO with components-platform realm for unified authentication
 */
const KeycloakApp = () => {
  console.log('[KeycloakApp] Keycloak SSO enabled with config:', {
    url: import.meta.env.VITE_KEYCLOAK_URL || 'http://localhost:8180',
    realm: import.meta.env.VITE_KEYCLOAK_REALM || 'components-platform',
    clientId: import.meta.env.VITE_KEYCLOAK_CLIENT_ID || 'cns-dashboard',
  });

  return (
    <ThemeContextProvider>
      <AdminContent authProvider={keycloakAuthProvider} loginPage={KeycloakLogin} />
    </ThemeContextProvider>
  );
};

/**
 * No-Auth App Wrapper for Development
 * Bypasses all authentication - use VITE_AUTH_PROVIDER=none
 * WARNING: Never use in production!
 */
const NoAuthApp = () => {
  console.log('[NoAuthApp] Running in NO-AUTH mode - authentication disabled');

  // Simple "login" page that just shows a dev mode warning
  const NoAuthLoginPage = () => (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '100vh',
      backgroundColor: '#1a1a2e',
      color: '#fff',
    }}>
      <h1 style={{ color: '#ff6b6b' }}>Development Mode</h1>
      <p>Authentication is disabled (VITE_AUTH_PROVIDER=none)</p>
      <p style={{ color: '#ffd93d' }}>This should never be used in production!</p>
    </div>
  );

  return (
    <ThemeContextProvider>
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        backgroundColor: '#ff6b6b',
        color: '#fff',
        padding: '4px 16px',
        textAlign: 'center',
        fontSize: '12px',
        fontWeight: 'bold',
        zIndex: 9999,
      }}>
        DEV MODE - Authentication Disabled
      </div>
      <div style={{ marginTop: '28px' }}>
        <AdminContent authProvider={noAuthProvider} loginPage={NoAuthLoginPage} />
      </div>
    </ThemeContextProvider>
  );
};

/**
 * Main App Component
 * Selects auth provider based on VITE_AUTH_PROVIDER environment variable
 */
const App = () => {
  console.log(`[App] Auth provider: ${AUTH_PROVIDER}`);

  if (AUTH_PROVIDER === 'none') {
    return <NoAuthApp />;
  }

  if (AUTH_PROVIDER === 'keycloak') {
    return <KeycloakApp />;
  }

  // Fallback to Auth0
  return <Auth0App />;
};

export default App;
