import React from 'react';
import { Admin, Resource, CustomRoutes, Layout } from 'react-admin';
import { Route } from 'react-router-dom';
import { dataProvider } from './providers/dataProvider';
import { authProvider } from './providers/authProvider';
import { KeycloakLogin } from './providers/keycloak';
import { TenantProvider } from './contexts/TenantContext';

// Resources
import {
  ComponentList,
  ComponentShow,
  ComponentEdit,
  ComponentCreate,
} from './resources/components';
import {
  BOMList,
  BOMShow,
  BOMEdit,
  BOMCreate,
} from './resources/boms';
import {
  AlertList,
  AlertShow,
} from './resources/alerts';
import { AnalyticsDashboard } from './resources/analytics';
import WorkflowMonitor from './resources/workflow_monitor';

// Material-UI Icons
import MemoryIcon from '@mui/icons-material/Memory';
import ListAltIcon from '@mui/icons-material/ListAlt';
import NotificationsIcon from '@mui/icons-material/Notifications';

// Theme
import { createTheme } from '@mui/material/styles';
import { AppBar, Toolbar, Typography, Box } from '@mui/material';
import { TenantSelector } from './components/TenantSelector';

/**
 * React Admin App
 *
 * Staff-focused dashboard for CNS operations:
 * - Components management
 * - BOM management
 * - Alerts & workflow monitoring
 *
 * Features:
 * - Keycloak authentication
 * - Platform API integration with tenant scoping
 * - Material-UI theming + role-based access control
 */

// Custom theme matching V1 color scheme
const theme = createTheme({
  palette: {
    primary: {
      main: '#3b82f6', // blue-500
    },
    secondary: {
      main: '#8b5cf6', // purple-500
    },
    success: {
      main: '#22c55e', // green-500
    },
    warning: {
      main: '#facc15', // yellow-400
    },
    error: {
      main: '#ef4444', // red-500
    },
    info: {
      main: '#3b82f6', // blue-500
    },
  },
  typography: {
    fontFamily: [
      '-apple-system',
      'BlinkMacSystemFont',
      '"Segoe UI"',
      'Roboto',
      '"Helvetica Neue"',
      'Arial',
      'sans-serif',
    ].join(','),
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          textTransform: 'none',
          fontWeight: 600,
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
        },
      },
    },
  },
});

/**
 * Custom Dashboard Component
 */
const Dashboard: React.FC = () => (
  <div style={{ padding: '20px' }}>
    <h1>Components Platform - Customer Portal</h1>
    <p>Welcome to your component management dashboard.</p>

    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', marginTop: '20px' }}>
      <div style={{
        padding: '20px',
        backgroundColor: '#ffffff',
        borderRadius: '12px',
        boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.1)',
      }}>
        <h3>Components</h3>
        <p>Manage your component catalog, track lifecycle, and assess risk.</p>
      </div>

      <div style={{
        padding: '20px',
        backgroundColor: '#ffffff',
        borderRadius: '12px',
        boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.1)',
      }}>
        <h3>BOMs</h3>
        <p>Create and analyze Bills of Materials with automated grading.</p>
      </div>

      <div style={{
        padding: '20px',
        backgroundColor: '#ffffff',
        borderRadius: '12px',
        boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.1)',
      }}>
        <h3>Alerts</h3>
        <p>Stay informed about component lifecycle changes and compliance issues.</p>
      </div>

      <a href="#/analytics" style={{ textDecoration: 'none' }}>
        <div style={{
          padding: '20px',
          backgroundColor: '#3b82f6',
          color: '#ffffff',
          borderRadius: '12px',
          boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.1)',
          cursor: 'pointer',
          transition: 'transform 0.2s',
        }}
        onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
        onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
        >
          <h3>📊 CNS Analytics</h3>
          <p>View enrichment metrics, supplier usage, and BOM processing statistics.</p>
        </div>
      </a>
    </div>
  </div>
);

/**
 * Main React Admin App
 */
const CustomAppBar: React.FC = (props) => (
  <AppBar {...props}>
    <Toolbar>
      <Typography variant="h6" sx={{ flexGrow: 1 }}>
        Components Platform
      </Typography>
      <TenantSelector />
    </Toolbar>
  </AppBar>
);

const CustomLayout: React.FC = (props) => <Layout {...props} appBar={CustomAppBar} />;

const App: React.FC = () => (
  <TenantProvider>
    <Admin
      dataProvider={dataProvider}
      authProvider={authProvider}
      loginPage={KeycloakLogin}
      theme={theme}
      dashboard={Dashboard}
      title="Components Platform"
      layout={CustomLayout}
      disableTelemetry
    >
      {/* Components Resource */}
      <Resource
        name="components"
        list={ComponentList}
        show={ComponentShow}
        edit={ComponentEdit}
        create={ComponentCreate}
        icon={MemoryIcon}
        options={{ label: 'Components' }}
      />

      {/* BOMs Resource */}
      <Resource
        name="boms"
        list={BOMList}
        show={BOMShow}
        edit={BOMEdit}
        create={BOMCreate}
        icon={ListAltIcon}
        options={{ label: 'BOMs' }}
      />

      {/* Alerts Resource */}
      <Resource
        name="alerts"
        list={AlertList}
        show={AlertShow}
        icon={NotificationsIcon}
        options={{ label: 'Alerts' }}
      />

      {/* Workflow Monitor Resource (Custom Page) */}
      <Resource
        name="workflows"
        list={WorkflowMonitor}
        options={{ label: 'Workflow Monitor' }}
      />

      {/* BOM Line Items (hidden - accessed via BOMs) */}
      <Resource name="bom_line_items" />

      {/* Custom Routes */}
      <CustomRoutes>
        <Route path="/analytics" element={<AnalyticsDashboard />} />
        <Route path="/workflows" element={<WorkflowMonitor />} />
      </CustomRoutes>
    </Admin>
  </TenantProvider>
);

export default App;
