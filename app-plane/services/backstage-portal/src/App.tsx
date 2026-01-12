import { Admin, Resource } from 'react-admin';
import { Route } from 'react-router-dom';
import { Auth0Provider } from '@auth0/auth0-react';
import { Auth0Login } from './lib/auth';

// Auth Providers
import { auth0AuthProvider } from './providers/auth0AuthProvider';
import { keycloakAuthProvider, KeycloakLogin } from './lib/keycloak';

// Auth0 State Sync - Bridges Auth0 React context to shared state module
import { Auth0StateSync } from './components/Auth0StateSync';

// Data Provider - Composite (Docker API + Supabase)
import { compositeDataProvider as dataProvider } from './providers/compositeDataProvider';

// Resources
import {
  AlertList,
  AlertShow,
} from './resources/alerts';
import {
  ContainerList,
  ContainerShow,
} from './resources/containers';
import {
  PlatformServiceList,
  PlatformServiceShow,
} from './resources/platformServices';

// Custom Dashboard
import { AdminDashboard } from './components/AdminDashboard';

// Material-UI Icons
import NotificationsIcon from '@mui/icons-material/Notifications';
import StorageIcon from '@mui/icons-material/Storage'; // Docker containers
import AppsIcon from '@mui/icons-material/Apps'; // Platform services

// Theme
import { cyberpunkTheme } from './theme';

/**
 * Backstage Admin Portal - React Admin App
 *
 * Platform management and monitoring interface for PLATFORM ADMINS ONLY:
 *
 * AUTH PROVIDERS (configured via VITE_AUTH_PROVIDER):
 * - auth0: Auth0 with organization enforcement (default)
 * - keycloak: Keycloak SSO (Components Platform realm)
 *
 * Features:
 * - Docker Container Management: Control panel with start/stop/restart/logs
 * - Platform Services: All 35+ admin UIs (Grafana, n8n, Wiki.js, etc.)
 * - System Health: Real-time monitoring and diagnostics
 * - Component Management: View and manage components
 * - BOM Operations: Create, edit, and review BOMs
 * - Alert Monitoring: Track component alerts
 * - Material-UI theming matching V1 colors
 *
 * Port: 27530 (Backstage Admin Portal)
 */

// Get auth provider from environment (default to auth0 for backward compatibility)
const AUTH_PROVIDER = import.meta.env.VITE_AUTH_PROVIDER || 'auth0';

/**
 * Admin Resources (shared between auth providers)
 */
const AdminResources = () => (
  <>
    {/* ========== PLATFORM MANAGEMENT ========== */}

    {/* Docker Container Management */}
    <Resource
      name="containers"
      list={ContainerList}
      show={ContainerShow}
      icon={StorageIcon}
      options={{ label: 'Containers' }}
    />

    {/* Platform Services - All Admin UIs */}
    <Resource
      name="platform-services"
      list={PlatformServiceList}
      show={PlatformServiceShow}
      icon={AppsIcon}
      options={{ label: 'Services' }}
    />

    {/* ========== DATA MANAGEMENT ========== */}

    {/* Alerts Resource */}
    <Resource
      name="alerts"
      list={AlertList}
      show={AlertShow}
      icon={NotificationsIcon}
      options={{ label: 'Alerts' }}
    />
  </>
);

/**
 * Auth0 App Wrapper
 */
const Auth0App = () => {
  const auth0Domain = import.meta.env.VITE_AUTH0_DOMAIN;
  const auth0ClientId = import.meta.env.VITE_AUTH0_CLIENT_ID;

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
    <Auth0Provider
      domain={auth0Domain}
      clientId={auth0ClientId}
      authorizationParams={{
        redirect_uri: window.location.origin,
        organization: 'org_oNtVXvVrzXz1ubua', // Platform admin organization
      }}
    >
      <Auth0StateSync>
        <Admin
          dataProvider={dataProvider}
          authProvider={auth0AuthProvider}
          theme={cyberpunkTheme}
          dashboard={AdminDashboard}
          loginPage={Auth0Login}
          title="Backstage Admin Portal"
          disableTelemetry
        >
          <AdminResources />
        </Admin>
      </Auth0StateSync>
    </Auth0Provider>
  );
};

/**
 * Keycloak App Wrapper
 * Uses SSO with components-platform realm for unified authentication
 */
const KeycloakApp = () => {
  // Log Keycloak config for debugging (defaults are fine)
  console.log('[KeycloakApp] Keycloak SSO enabled with config:', {
    url: import.meta.env.VITE_KEYCLOAK_URL || 'http://localhost:8180',
    realm: import.meta.env.VITE_KEYCLOAK_REALM || 'components-platform',
    clientId: import.meta.env.VITE_KEYCLOAK_CLIENT_ID || 'backstage-portal',
  });

  return (
    <Admin
      dataProvider={dataProvider}
      authProvider={keycloakAuthProvider}
      theme={cyberpunkTheme}
      dashboard={AdminDashboard}
      loginPage={KeycloakLogin}
      title="Backstage Admin Portal"
      disableTelemetry
    >
      <AdminResources />
    </Admin>
  );
};

/**
 * Main App Component
 * Selects auth provider based on VITE_AUTH_PROVIDER environment variable
 */
function App() {
  console.log(`[App] Auth provider: ${AUTH_PROVIDER}`);

  if (AUTH_PROVIDER === 'keycloak') {
    return <KeycloakApp />;
  }

  // Default to Auth0
  return <Auth0App />;
}

export default App;
