import { useEffect } from 'react';
import { Admin, Resource, CustomRoutes } from 'react-admin';
import { Route } from 'react-router-dom';
import { Auth0Provider } from '@auth0/auth0-react';
import { Auth0Login } from './lib/auth';
import { Auth0StateSync } from './components/Auth0StateSync';
import { theme } from './theme';
import BarChartIcon from '@mui/icons-material/BarChart';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import StorageIcon from '@mui/icons-material/Storage';
import SettingsIcon from '@mui/icons-material/Settings';
import SpeedIcon from '@mui/icons-material/Speed';
import SearchIcon from '@mui/icons-material/Search';
import PendingActionsIcon from '@mui/icons-material/PendingActions';
import HistoryIcon from '@mui/icons-material/History';
import ApiIcon from '@mui/icons-material/Api';
import ListAltIcon from '@mui/icons-material/ListAlt';
import MonitorHeartIcon from '@mui/icons-material/MonitorHeart';
import CloudQueueIcon from '@mui/icons-material/CloudQueue';
import AssessmentIcon from '@mui/icons-material/Assessment';

import { dataProvider } from './dataProvider';
import { auth0AuthProvider as authProvider } from './auth0AuthProvider';
import { Dashboard } from './Dashboard';
import CustomLayout from './CustomLayout';

// Analytics module
import { AnalyticsDashboard, AuditStreamView, SupplierResponsesView, FileArtifactsView } from './analytics';

// Audit module
import { AuditTrailViewer } from './audit';

// Config module
import { EnrichmentConfigPage, SupplierAPIsConfig, DigiKeyOAuthCallback } from './config';

// Customer module
import { CustomerUploadsList, CustomerBOMs, CustomerEnrichment, CustomerCatalog } from './customer';

// Quality module
import { QualityQueue } from './quality';

// Enrichment module
import { EnrichmentMonitor } from './enrichment';

// Logs module
import { ActivityLog } from './logs';

// BOM module
import { BOMUploadWizard, BOMJobDetail, BOMLineItemList, BOMLineItemShow, BOMLineItemEdit } from './bom';

// Bulk uploads
import { BulkUploadsList, BulkUploadDetail } from './bulk';

// Components
import { ComponentEnrichmentDetail } from './components/enrichment-detail';
import { ComponentSearch } from './components/ComponentSearch';
import { ComponentSearchEnhanced } from './components/ComponentSearchEnhanced';

// Uploads
import { RedisBOMUpload } from './uploads';

// Pages
import RateLimitingSettings from './pages/RateLimitingSettings';
import StaffBOMWorkflow from './pages/StaffBOMWorkflow';

// Contexts
import { NotificationProvider } from './contexts/NotificationContext';
import { TenantProvider } from './contexts/TenantContext';

// Utils
import { ensureDefaultAdminToken } from './utils/adminToken';

// Config
import { CNS_STAFF_ORGANIZATION_ID } from './config/api';

/**
 * CNS React Admin Dashboard
 *
 * Platform staff tool for Component Normalization Service (Platform Admins Only)
 * Port: 27810
 * Access: /admin-login route REQUIRED
 *
 * Features:
 * - Auth0 Authentication: Organization-enforced (org_oNtVXvVrzXz1ubua)
 * - Analytics dashboard with enrichment metrics
 * - BOM upload interface
 * - Catalog management
 * - Supplier usage tracking
 */

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

const App = () => {
  const auth0Domain = import.meta.env.VITE_AUTH0_DOMAIN;
  const auth0ClientId = import.meta.env.VITE_AUTH0_CLIENT_ID;
  // CRITICAL: Audience must match AUTH0_AUDIENCE in CNS API for JWT validation
  const auth0Audience = import.meta.env.VITE_AUTH0_AUDIENCE || 'https://api.components-platform.com';

  useEffect(() => {
    void ensureDefaultAdminToken();
  }, []);

  if (!auth0Domain || !auth0ClientId) {
    return (
      <div style={{ padding: '20px', color: 'red' }}>
        <h1>Configuration Error</h1>
        <p>Missing Auth0 configuration. Please set VITE_AUTH0_DOMAIN and VITE_AUTH0_CLIENT_ID.</p>
      </div>
    );
  }

  return (
    <Auth0Provider
      domain={auth0Domain}
      clientId={auth0ClientId}
      authorizationParams={{
        redirect_uri: window.location.origin,
        organization: 'org_oNtVXvVrzXz1ubua', // Platform admin organization
        audience: auth0Audience, // Required for JWT access token (not opaque)
      }}
    >
      <Auth0StateSync>
        <TenantProvider>
          <NotificationProvider>
            <Admin
            dataProvider={dataProvider}
            authProvider={authProvider}
            theme={theme}
            dashboard={Dashboard}
            title="CNS Dashboard"
            loginPage={PlatformAdminLoginPage}
            disableTelemetry
            layout={CustomLayout}
          >
          {/* Custom Routes */}
          <CustomRoutes>
            {/* Customer operations */}
            <Route path="/customer/uploads" element={<CustomerUploadsList />} />
            <Route path="/customer/catalog" element={<CustomerCatalog />} />
            <Route path="/customer/boms" element={<CustomerBOMs />} />
            <Route path="/customer/enrichment" element={<CustomerEnrichment />} />
            <Route path="/analytics" element={<AnalyticsDashboard />} />
            <Route path="/config" element={<EnrichmentConfigPage />} />
            <Route path="/rate-limiting" element={<RateLimitingSettings />} />
            <Route path="/supplier-apis" element={<SupplierAPIsConfig />} />
            <Route path="/supplier-apis/digikey/callback" element={<DigiKeyOAuthCallback />} />
            <Route path="/bom-wizard" element={<BOMUploadWizard organizationId={CNS_STAFF_ORGANIZATION_ID} projectId={undefined} source="staff_bulk" />} />
            <Route path="/bom-upload" element={<StaffBOMWorkflow />} />
            {/* New upload endpoints for testing */}
            <Route path="/upload-unified" element={<StaffBOMWorkflow />} />
            <Route path="/upload-redis" element={<RedisBOMUpload />} />
            <Route path="/component-search" element={<ComponentSearchEnhanced />} />
            <Route path="/quality-queue" element={<QualityQueue />} />
            <Route path="/enrichment-monitor" element={<EnrichmentMonitor />} />
            <Route path="/activity-log" element={<ActivityLog />} />
            <Route path="/supplier-responses" element={<SupplierResponsesView />} />
            <Route path="/artifacts" element={<FileArtifactsView />} />
            <Route path="/bom-jobs/:jobId" element={<BOMJobDetail />} />
            <Route path="/components/:mpn/detail" element={<ComponentEnrichmentDetail />} />
            <Route path="/bulk-uploads" element={<BulkUploadsList />} />
            <Route path="/bulk-uploads/:uploadId" element={<BulkUploadDetail />} />
            <Route path="/audit-trail" element={<AuditTrailViewer />} />
            <Route path="/audit-stream" element={<AuditStreamView />} />
          </CustomRoutes>

          {/* Sidebar Menu Resources - These appear in the navigation */}
          <Resource
            name="analytics"
            list={AnalyticsDashboard}
            options={{ label: 'Analytics Dashboard' }}
            icon={BarChartIcon}
          />
          <Resource
            name="bom-upload"
            list={StaffBOMWorkflow}
            options={{ label: 'BOM Upload' }}
            icon={UploadFileIcon}
          />
          {/* Legacy wizard without inline enrichment - kept for testing */}
          <Resource
            name="bom-wizard"
            list={BOMUploadWizardPage}
            options={{ label: 'BOM Upload (Legacy)' }}
          />
          {/* Bulk Uploads (Redis) - legacy/job-centric view, keep available for now */}
          <Resource
            name="bulk-uploads"
            list={BulkUploadsList}
            options={{ label: 'Bulk Uploads (Redis)' }}
            icon={CloudQueueIcon}
          />
          <Resource
            name="audit-trail"
            list={AuditTrailViewer}
            options={{ label: 'Audit Trail Viewer' }}
            icon={AssessmentIcon}
          />
          <Resource
            name="audit-stream"
            list={AuditStreamView}
            options={{ label: 'BOM Event Stream' }}
            icon={MonitorHeartIcon}
          />
          {/* BOM Jobs - legacy job-centric menu, hidden for unified BOM flow */}
          {/**
          <Resource
            name="bom-jobs"
            options={{ label: 'BOM Jobs' }}
            icon={WorkIcon}
            list={BOMJobList}
          />
          */}
          <Resource
            name="enrichment-monitor"
            options={{ label: 'Enrichment Monitor' }}
            icon={MonitorHeartIcon}
            list={EnrichmentMonitor}
          />
          <Resource
            name="bom_line_items"
            list={BOMLineItemList}
            show={BOMLineItemShow}
            edit={BOMLineItemEdit}
            options={{ label: 'BOM Line Items' }}
            icon={ListAltIcon}
          />
          <Resource
            name="component-search"
            list={ComponentSearch}
            options={{ label: 'Component Search' }}
            icon={SearchIcon}
          />
          <Resource
            name="quality-queue"
            list={QualityQueue}
            options={{ label: 'Quality Review' }}
            icon={PendingActionsIcon}
          />
          <Resource
            name="catalog"
            list={CatalogView}
            options={{ label: 'Component Catalog' }}
            icon={StorageIcon}
          />
          <Resource
            name="activity-log"
            list={ActivityLog}
            options={{ label: 'Activity Log' }}
            icon={HistoryIcon}
          />
          <Resource
            name="config"
            list={EnrichmentConfigPage}
            options={{ label: 'Configuration' }}
            icon={SettingsIcon}
          />
          <Resource
            name="rate-limiting"
            list={RateLimitingSettings}
            options={{ label: 'Rate Limiting' }}
            icon={SpeedIcon}
          />
          <Resource
            name="supplier-apis"
            list={SupplierAPIsConfig}
            options={{ label: 'Supplier API Keys' }}
            icon={ApiIcon}
          />
            </Admin>
          </NotificationProvider>
        </TenantProvider>
      </Auth0StateSync>
    </Auth0Provider>
  );
};

export default App;
