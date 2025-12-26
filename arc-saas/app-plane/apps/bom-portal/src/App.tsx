import React from 'react';
import { Admin, Resource, CustomRoutes, Layout, AppBar, UserMenu, Menu, useSidebarState, useGetList } from 'react-admin';
import { useAuth0 } from '@auth0/auth0-react';
import {
  Box,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Collapse,
  Chip,
  Badge,
  FormControl,
  Select,
  MenuItem,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { Route } from 'react-router-dom';

// Auth Provider - Production-safe router with dev bypass support
import { authProvider } from './providers/authProvider';

// Data Provider - Supabase with service key for dev mode
import { dataProvider, supabase } from './providers/dataProvider';  // Supabase (with service key)

// Resources
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
import {
  OrganizationList,
  OrganizationShow,
  OrganizationEdit,
  OrganizationCreate,
} from './resources/organizations';
import {
  UserList,
  UserShow,
  UserEdit,
  UserCreate,
} from './resources/users';
import {
  ProjectList,
  ProjectShow,
  ProjectEdit,
  ProjectCreate,
} from './resources/projects';
import { BOMJobList, BOMJobShow } from './resources/bom_jobs';
import { BOMUploadList, BOMUploadShow, BOMUploadEdit } from './resources/bom_uploads';
import { BOMLineItemList, BOMLineItemShow, BOMLineItemEdit } from './resources/bom_line_items';

// Dev Mode Login
import { DevModeLogin } from './components/DevModeLogin';

// Auth0 Login - Using local auth library
import { Auth0Login } from './lib/auth';
import { AdminLogin } from './components/AdminLogin';

// Keyboard Shortcuts
import { KeyboardShortcuts } from './components/KeyboardShortcuts';

// Custom UserMenu
import { CustomUserMenu } from './components/CustomUserMenu';

// Novu Notification Bell
import { NovuNotificationBell, useNovuConfig } from './components/NovuNotificationBell';

// Onboarding Service - Welcome notifications
import { onboardingService } from './services/onboardingService';

// BOM Upload Workflow
import { BOMUploadWorkflow } from './bom/BOMUploadWorkflow';

// BOM Enrichment Page
import { BOMEnrichmentPage } from './pages/BOMEnrichment';
import { BOMAuditStream } from './pages/BOMAuditStream';

// CNS Job Status Page
import { CNSJobStatusPage } from './pages/CNSJobStatusPage';
import { Dashboard } from './pages/Dashboard';

// Account Settings (Profile is now consolidated into AccountSettings)
// Profile route redirects to /account/settings
import { AccountSettings } from './pages/AccountSettings';
import { OrganizationSettings } from './pages/OrganizationSettings';
import { AdminConsole } from './pages/AdminConsole';

// Project Component Catalog
import { ProjectComponentCatalog } from './pages/ProjectComponentCatalog';
import { ComponentSearch } from './pages/ComponentSearch';

// Organization Component Vault
import { OrganizationComponentVault } from './pages/OrganizationComponentVault';
import { BillingPage as Billing } from './pages/Billing';

// Risk Analysis & Alerts
import { RiskDashboard } from './pages/RiskDashboard';
import { RiskProfileSettings } from './pages/RiskProfileSettings';
import { AlertCenter } from './pages/AlertCenter';
import { AlertPreferencesPage } from './pages/AlertPreferences';

// Trial Expiration Banner
import { TrialExpirationBanner } from './components/TrialExpirationBanner';

// Multi-Organization Support
import { OrganizationProvider, useOrganization } from './contexts/OrganizationContext';
import { OrganizationSwitcher, CreateOrganizationDialog } from './components/OrganizationSwitcher';

// Workspace Support (within Organizations)
import { WorkspaceProvider, useWorkspace } from './contexts/WorkspaceContext';
import { WorkspaceSwitcher, CreateWorkspaceDialog } from './components/WorkspaceSwitcher';

// Material-UI Icons
import DashboardIcon from '@mui/icons-material/Dashboard';
import MemoryIcon from '@mui/icons-material/Memory';
import ViewInArIcon from '@mui/icons-material/ViewInAr';
import ListAltIcon from '@mui/icons-material/ListAlt';
import NotificationsIcon from '@mui/icons-material/Notifications';
import BusinessIcon from '@mui/icons-material/Business';
import PeopleIcon from '@mui/icons-material/People';
import FolderIcon from '@mui/icons-material/Folder';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import HistoryIcon from '@mui/icons-material/History';
import ExpandLess from '@mui/icons-material/ExpandLess';
import ExpandMore from '@mui/icons-material/ExpandMore';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PauseCircleIcon from '@mui/icons-material/PauseCircle';
import ArchiveIcon from '@mui/icons-material/Archive';
import KeyboardIcon from '@mui/icons-material/Keyboard';
import SettingsIcon from '@mui/icons-material/Settings';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import SearchIcon from '@mui/icons-material/Search';
import PaymentIcon from '@mui/icons-material/Payment';
import SecurityIcon from '@mui/icons-material/Security';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import WorkspacesIcon from '@mui/icons-material/Workspaces';

// Theme - Centralized design tokens
import { projectTypeColors, projectStatusColors } from './theme';
import { ThemeModeProvider, useThemeMode } from './contexts/ThemeModeContext';

/**
 * Customer Portal - React Admin App
 *
 * Customer-facing interface for component and BOM management:
 * - Auth0/Supabase: Centralized authentication
 * - Component Management: View and manage components
 * - BOM Operations: Create, edit, and review BOMs
 * - Alert Monitoring: Track component alerts
 * - Material-UI theming with semantic design tokens
 *
 * Port: 27510 (Customer Portal)
 */

/**
 * Custom AppBar with UserMenu and Novu Notification Bell
 */
import { AdminModeToggle } from './components/AdminModeToggle';

/**
 * Novu Bell Wrapper - Gets current user ID from Supabase or Auth0
 */
const NovuBellWrapper: React.FC = () => {
  const [userId, setUserId] = React.useState<string | null>(null);
  const { isConfigured } = useNovuConfig();
  const { user: auth0User, isAuthenticated: auth0Authenticated } = useAuth0();

  React.useEffect(() => {
    const getCurrentUser = async () => {
      // IMPORTANT: Prefer Auth0 sub for SSO users (matches BOMUploadWorkflow logic)
      // This ensures notifications are sent AND received using the same user ID
      if (auth0Authenticated && auth0User?.sub) {
        console.debug('[NovuBell] Using Auth0 user ID:', auth0User.sub);
        setUserId(auth0User.sub);
        return;
      }

      // Fall back to Supabase for direct signups
      try {
        const { data: authData } = await supabase.auth.getUser();
        if (authData?.user?.id) {
          console.debug('[NovuBell] Using Supabase user ID:', authData.user.id);
          setUserId(authData.user.id);
          return;
        }
      } catch (error) {
        console.debug('[NovuBell] No user found:', error);
      }
    };
    getCurrentUser();
  }, [auth0Authenticated, auth0User]);

  // Don't render if Novu is not configured or no user
  if (!isConfigured || !userId) {
    return null;
  }

  return (
    <NovuNotificationBell
      userId={userId}
      colorScheme="dark"
      containerStyle={{ marginRight: 16 }}
    />
  );
};

/**
 * WelcomeTrigger - Triggers welcome notification on first login
 *
 * This component runs once per session and triggers the welcome notification
 * for new users. The backend ensures idempotency (won't send duplicate welcomes).
 */
const WelcomeTrigger: React.FC = () => {
  const [triggered, setTriggered] = React.useState(false);

  React.useEffect(() => {
    // Only trigger once per session
    if (triggered) return;

    // Check if already triggered this session
    const sessionKey = 'welcome_triggered_session';
    if (sessionStorage.getItem(sessionKey)) {
      setTriggered(true);
      return;
    }

    const triggerWelcome = async () => {
      try {
        const { data: authData } = await supabase.auth.getUser();
        if (!authData?.user?.id) {
          return; // Not logged in
        }

        console.log('[WelcomeTrigger] Triggering welcome notification for user');

        // Call the onboarding service - it handles idempotency
        const result = await onboardingService.triggerWelcome();

        if (result.success && !result.already_sent) {
          console.log('[WelcomeTrigger] Welcome notification sent successfully');
        } else if (result.already_sent) {
          console.log('[WelcomeTrigger] Welcome already sent previously');
        }

        // Mark as triggered for this session
        sessionStorage.setItem(sessionKey, 'true');
        setTriggered(true);
      } catch (error) {
        console.error('[WelcomeTrigger] Error triggering welcome:', error);
        // Don't block on errors - just log and continue
        setTriggered(true);
      }
    };

    // Small delay to ensure auth is fully initialized
    const timer = setTimeout(triggerWelcome, 1000);
    return () => clearTimeout(timer);
  }, [triggered]);

  // This component doesn't render anything
  return null;
};

const CustomAppBar = () => (
  <AppBar userMenu={<CustomUserMenu />}>
    <Box sx={{ flex: 1 }} />
    <Chip
      icon={<KeyboardIcon />}
      label="Press ? for shortcuts"
      size="small"
      variant="outlined"
      sx={{
        mr: 2,
        color: 'white',
        borderColor: 'rgba(255,255,255,0.3)',
        '& .MuiChip-icon': { color: 'white' },
        '&:hover': {
          borderColor: 'rgba(255,255,255,0.5)',
          bgcolor: 'rgba(255,255,255,0.1)',
        },
      }}
    />
    <NovuBellWrapper />
    <AdminModeToggle />
  </AppBar>
);

/**
 * Custom Layout with UserMenu and Badge Counts
 */
const SectionLabel = ({ label }: { label: string }) => (
  <Box sx={{ px: 2, py: 1, mt: 1, fontSize: 11, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: 700 }}>
    {label}
  </Box>
);

const MenuItemWithBadge = ({ to, primaryText, leftIcon, badgeCount, badgeColor = 'error', highlighted = false }: any) => {
  const Badge = badgeCount > 0 ? (
    <Box
      component="span"
      sx={{
        ml: 'auto',
        bgcolor: `${badgeColor}.main`,
        color: 'white',
        borderRadius: '12px',
        px: 1,
        py: 0.25,
        fontSize: 11,
        fontWeight: 700,
        minWidth: 20,
        textAlign: 'center',
      }}
    >
      {badgeCount > 99 ? '99+' : badgeCount}
    </Box>
  ) : null;

  return (
    <Menu.Item
      to={to}
      primaryText={
        <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
          <span>{primaryText}</span>
          {Badge}
        </Box>
      }
      leftIcon={leftIcon}
      sx={{
        fontWeight: highlighted ? 600 : 400,
        color: highlighted ? 'primary.main' : undefined,
        '& .MuiListItemIcon-root': { color: highlighted ? 'primary.main' : undefined },
      }}
    />
  );
};

/**
 * Project Status Icons - Uses colors from theme tokens
 */
const PROJECT_STATUS_ICONS: Record<string, React.ReactNode> = {
  active: <CheckCircleIcon sx={{ fontSize: 16, color: projectStatusColors.active }} />,
  on_hold: <PauseCircleIcon sx={{ fontSize: 16, color: projectStatusColors.on_hold }} />,
  archived: <ArchiveIcon sx={{ fontSize: 16, color: projectStatusColors.archived }} />,
  completed: <CheckCircleIcon sx={{ fontSize: 16, color: projectStatusColors.completed }} />,
  in_progress: <FiberManualRecordIcon sx={{ fontSize: 16, color: projectStatusColors.in_progress }} />,
};

/**
 * Nested Projects Menu Component
 */
interface NestedProjectsMenuProps {
  projects: any[];
  currentProjectId: string | null;
  onProjectSelect: (projectId: string) => void;
  pendingCount: number;
  processingCount: number;
}

const NestedProjectsMenu: React.FC<NestedProjectsMenuProps> = ({
  projects,
  currentProjectId,
  onProjectSelect,
  pendingCount,
  processingCount,
}) => {
  const [expandedProjects, setExpandedProjects] = React.useState<Set<string>>(
    new Set(currentProjectId ? [currentProjectId] : [])
  );

  const handleProjectClick = (projectId: string) => {
    // Auto-collapse: only keep the clicked project expanded
    setExpandedProjects(new Set([projectId]));

    // Update selected project
    onProjectSelect(projectId);
    localStorage.setItem('current_project_id', projectId);
    localStorage.setItem('project_id', projectId);
  };

  const handleExpandToggle = (e: React.MouseEvent, projectId: string) => {
    e.stopPropagation();
    const newExpanded = new Set(expandedProjects);
    if (newExpanded.has(projectId)) {
      newExpanded.delete(projectId);
    } else {
      newExpanded.add(projectId);
    }
    setExpandedProjects(newExpanded);
  };

  if (!projects || projects.length === 0) {
    return null;
  }

  return (
    <List component="div" disablePadding>
      {projects.map((project) => {
        const isExpanded = expandedProjects.has(project.id);
        const isSelected = currentProjectId === project.id;
        const projectType = project.type || 'other';
        const projectStatus = project.status || 'active';
        const typeColor = projectTypeColors[projectType as keyof typeof projectTypeColors] || projectTypeColors.other;

        return (
          <React.Fragment key={project.id}>
            {/* Project Item */}
            <ListItemButton
              onClick={() => handleProjectClick(project.id)}
              sx={(theme) => ({
                pl: 4,
                borderLeft: `4px solid ${typeColor}`,
                bgcolor: isSelected ? alpha(theme.palette.primary.main, 0.08) : 'transparent',
                '&:hover': {
                  bgcolor: isSelected ? alpha(theme.palette.primary.main, 0.12) : 'action.hover',
                },
              })}
            >
              <ListItemIcon sx={{ minWidth: 36 }}>
                {PROJECT_STATUS_ICONS[projectStatus] || PROJECT_STATUS_ICONS.active}
              </ListItemIcon>
              <ListItemText
                primary={project.name}
                secondary={`${projectType} • ${projectStatus.replace('_', ' ')}`}
                primaryTypographyProps={{
                  fontWeight: isSelected ? 700 : 400,
                  fontSize: 14,
                  color: isSelected ? typeColor : undefined,
                }}
                secondaryTypographyProps={{
                  fontSize: 11,
                  textTransform: 'capitalize',
                }}
              />
              <ListItemIcon
                onClick={(e) => handleExpandToggle(e, project.id)}
                sx={{ minWidth: 'auto', cursor: 'pointer' }}
              >
                {isExpanded ? <ExpandLess /> : <ExpandMore />}
              </ListItemIcon>
            </ListItemButton>

            {/* Nested Menu Items */}
            <Collapse in={isExpanded} timeout="auto" unmountOnExit>
              <List component="div" disablePadding>
                {/* Upload BOM */}
                <ListItemButton sx={{ pl: 8 }} onClick={() => window.location.hash = '/bom/upload'}>
                  <ListItemIcon sx={{ minWidth: 36 }}>
                    <UploadFileIcon sx={{ fontSize: 20 }} />
                  </ListItemIcon>
                  <ListItemText
                    primary="Upload BOM"
                    primaryTypographyProps={{ fontSize: 13 }}
                  />
                </ListItemButton>

                {/* Recent Uploads */}
                <ListItemButton sx={{ pl: 8 }} onClick={() => window.location.hash = '/bom_uploads'}>
                  <ListItemIcon sx={{ minWidth: 36 }}>
                    <HistoryIcon sx={{ fontSize: 20 }} />
                  </ListItemIcon>
                  <ListItemText
                    primary="Recent Uploads"
                    primaryTypographyProps={{ fontSize: 13 }}
                  />
                  {pendingCount > 0 && (
                    <Chip
                      label={pendingCount}
                      size="small"
                      color="warning"
                      sx={{ height: 20, fontSize: 11 }}
                    />
                  )}
                </ListItemButton>

                {/* Enrichment Queue */}
                <ListItemButton sx={{ pl: 8 }} onClick={() => window.location.hash = '/bom/enrichment'}>
                  <ListItemIcon sx={{ minWidth: 36 }}>
                    <AutoFixHighIcon sx={{ fontSize: 20 }} />
                  </ListItemIcon>
                  <ListItemText
                    primary="Enrichment Queue"
                    primaryTypographyProps={{ fontSize: 13 }}
                  />
                  {processingCount > 0 && (
                    <Chip
                      label={processingCount}
                      size="small"
                      color="primary"
                      sx={{ height: 20, fontSize: 11 }}
                    />
                  )}
                </ListItemButton>

                {/* Components */}
                <ListItemButton sx={{ pl: 8 }} onClick={() => window.location.hash = '/project/components'}>
                  <ListItemIcon sx={{ minWidth: 36 }}>
                    <MemoryIcon sx={{ fontSize: 20 }} />
                  </ListItemIcon>
                  <ListItemText
                    primary="Components"
                    primaryTypographyProps={{ fontSize: 13 }}
                  />
                </ListItemButton>
              </List>
            </Collapse>
          </React.Fragment>
        );
      })}
    </List>
  );
};

const AppMenu = () => {
  // Multi-org context (provides current org, all user's orgs, permissions)
  const {
    currentOrg,
    organizations: userOrganizations,
    permissions,
    isLoading: orgLoading,
  } = useOrganization();

  // Workspace context (within current organization)
  const {
    currentWorkspace,
    workspaces,
    permissions: workspacePermissions,
    isLoading: wsLoading,
  } = useWorkspace();

  // Organization switcher modal state
  const [orgSwitcherOpen, setOrgSwitcherOpen] = React.useState(false);
  const [createOrgDialogOpen, setCreateOrgDialogOpen] = React.useState(false);

  // Workspace switcher modal state
  const [wsSwitcherOpen, setWsSwitcherOpen] = React.useState(false);
  const [createWsDialogOpen, setCreateWsDialogOpen] = React.useState(false);

  const { total: pendingCount = 0 } = useGetList('bom_uploads', {
    pagination: { page: 1, perPage: 1 },
    filter: { status: 'mapping_pending' },
  });

  const { total: processingCount = 0 } = useGetList('bom_uploads', {
    pagination: { page: 1, perPage: 1 },
    filter: { status: 'processing' },
  });

  const { total: alertCount = 0 } = useGetList('alerts', {
    pagination: { page: 1, perPage: 1 },
    filter: { is_read: false },
  });

  // Get current project from localStorage
  const [currentProjectId, setCurrentProjectId] = React.useState<string | null>(
    localStorage.getItem('current_project_id')
  );

  // Projects section collapse state (default expanded)
  const [projectsExpanded, setProjectsExpanded] = React.useState<boolean>(() => {
    const saved = localStorage.getItem('projects_sidebar_expanded');
    return saved !== null ? saved === 'true' : true;
  });

  // Derive admin status from organization context permissions
  const isAdmin = permissions.canEditOrg;
  const isSuperAdmin = permissions.canDeleteOrg; // Only owners can delete

  const handleProjectsToggle = () => {
    const newState = !projectsExpanded;
    setProjectsExpanded(newState);
    localStorage.setItem('projects_sidebar_expanded', String(newState));
  };

  // Fetch projects - filtered by current organization from context
  const { data: projects = [], refetch: refetchProjects } = useGetList('projects', {
    pagination: { page: 1, perPage: 100 },
    sort: { field: 'created_at', order: 'DESC' },
    filter: currentOrg ? { organization_id: currentOrg.id } : {},
  });

  // Refetch projects when org changes
  React.useEffect(() => {
    if (currentOrg) {
      refetchProjects();
    }
  }, [currentOrg?.id, refetchProjects]);

  const handleProjectSelect = (projectId: string) => {
    setCurrentProjectId(projectId);
  };

  React.useEffect(() => {
    if (!currentOrg) {
      return;
    }
    const persistedOrg = localStorage.getItem('current_project_org_id');
    if (persistedOrg !== currentOrg.id) {
      setCurrentProjectId(null);
      localStorage.removeItem('current_project_id');
      localStorage.removeItem('project_id');
      localStorage.setItem('current_project_org_id', currentOrg.id);
    }
  }, [currentOrg?.id]);

  return (
    <Menu>
      {/* Context Switcher - Organization & Workspace at top */}
      {currentOrg && (
        <Box sx={{ px: 1.5, pt: 1, pb: 1.5 }}>
          <Box
            sx={(theme) => ({
              borderRadius: 2,
              bgcolor: 'background.paper',
              border: '1px solid',
              borderColor: 'divider',
              overflow: 'hidden',
            })}
          >
            {/* Organization Row */}
            <ListItemButton
              onClick={() => setOrgSwitcherOpen(true)}
              sx={(theme) => ({
                py: 1,
                px: 1.5,
                borderBottom: currentWorkspace ? '1px solid' : 'none',
                borderColor: 'divider',
                '&:hover': { bgcolor: 'action.hover' },
              })}
            >
              <ListItemIcon sx={{ minWidth: 28 }}>
                <BusinessIcon sx={{ fontSize: 18 }} color="primary" />
              </ListItemIcon>
              <ListItemText
                primary={currentOrg.name}
                primaryTypographyProps={{ fontWeight: 600, fontSize: 12, noWrap: true }}
              />
              {userOrganizations.length > 1 && (
                <SwapHorizIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
              )}
            </ListItemButton>

            {/* Workspace Row - Nested appearance */}
            {currentWorkspace && (
              <ListItemButton
                onClick={() => setWsSwitcherOpen(true)}
                sx={(theme) => ({
                  py: 0.75,
                  px: 1.5,
                  pl: 3,
                  bgcolor: alpha(theme.palette.action.hover, 0.3),
                  '&:hover': { bgcolor: 'action.hover' },
                })}
              >
                <ListItemIcon sx={{ minWidth: 24 }}>
                  <WorkspacesIcon sx={{ fontSize: 16 }} color="secondary" />
                </ListItemIcon>
                <ListItemText
                  primary={currentWorkspace.name}
                  primaryTypographyProps={{ fontSize: 11, noWrap: true, color: 'text.secondary' }}
                />
                {workspaces.length > 1 && (
                  <SwapHorizIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
                )}
              </ListItemButton>
            )}
          </Box>
        </Box>
      )}

      {/* Modals */}
      <OrganizationSwitcher
        open={orgSwitcherOpen}
        onClose={() => setOrgSwitcherOpen(false)}
        onCreateNew={() => setCreateOrgDialogOpen(true)}
      />
      <CreateOrganizationDialog
        open={createOrgDialogOpen}
        onClose={() => setCreateOrgDialogOpen(false)}
      />
      <WorkspaceSwitcher
        open={wsSwitcherOpen}
        onClose={() => setWsSwitcherOpen(false)}
        onCreateNew={() => setCreateWsDialogOpen(true)}
      />
      <CreateWorkspaceDialog
        open={createWsDialogOpen}
        onClose={() => setCreateWsDialogOpen(false)}
      />

      <Menu.DashboardItem />

      {/* Projects Header - Collapsible */}
      <ListItemButton
        onClick={handleProjectsToggle}
        sx={(theme) => ({
          fontWeight: 700,
          color: 'primary.main',
          bgcolor: alpha(theme.palette.primary.main, 0.08),
          borderLeft: '4px solid',
          borderColor: 'primary.main',
          mb: 0.5,
          '&:hover': {
            bgcolor: alpha(theme.palette.primary.main, 0.12),
          },
        })}
      >
        <ListItemIcon sx={{ minWidth: 40, color: 'primary.main' }}>
          <FolderIcon />
        </ListItemIcon>
        <ListItemText
          primary={`Projects (${projects.length})`}
          primaryTypographyProps={{ fontWeight: 700, fontSize: 14 }}
        />
        {projectsExpanded ? <ExpandLess /> : <ExpandMore />}
      </ListItemButton>

      {/* Nested Projects Menu - Collapsible */}
      <Collapse in={projectsExpanded} timeout="auto" unmountOnExit>
        <NestedProjectsMenu
          projects={projects}
          currentProjectId={currentProjectId}
          onProjectSelect={handleProjectSelect}
          pendingCount={pendingCount}
          processingCount={processingCount}
        />
      </Collapse>

      {/* COMPONENTS */}
      <SectionLabel label="🔍 Components" />
      <Menu.Item
        to="/components/search"
        primaryText="Search Components"
        leftIcon={<SearchIcon />}
      />
      <Menu.Item
        to="/components/vault"
        primaryText="My Components"
        leftIcon={<ViewInArIcon />}
      />

      {/* MONITORING */}
      <SectionLabel label="🛡️ Monitoring" />
      <Menu.Item
        to="/risk"
        primaryText="Risk Dashboard"
        leftIcon={<SecurityIcon />}
      />
      <MenuItemWithBadge
        to="/alerts"
        primaryText="Alerts"
        leftIcon={<NotificationsIcon />}
        badgeCount={alertCount}
        badgeColor="error"
      />

      {/* SETTINGS - Visible to all users */}
      <SectionLabel label="⚙️ Settings" />
      <Menu.Item
        to="/organizations"
        primaryText="Organization"
        leftIcon={<BusinessIcon />}
      />
      <Menu.Item
        to="/billing"
        primaryText="Billing"
        leftIcon={<PaymentIcon />}
      />

      {/* ADMIN SECTION - Only show if admin */}
      {isAdmin && (
        <>
          <Box sx={{ mt: 1, pt: 1, borderTop: '1px solid', borderColor: 'divider' }} />
          <Menu.Item
            to="/admin/console"
            primaryText="Admin Console"
            leftIcon={<DashboardIcon />}
            sx={{
              fontWeight: 600,
              '& .MuiListItemIcon-root': { color: 'primary.main' },
            }}
          />
          <Menu.Item to="/boms" primaryText="All BOMs" leftIcon={<ListAltIcon />} />
          <Menu.Item to="/users" primaryText="System Users" leftIcon={<PeopleIcon />} />
          <Menu.Item
            to="/admin/organization-settings"
            primaryText="Organization Settings"
            leftIcon={<AdminPanelSettingsIcon />}
            sx={{
              '& .MuiListItemIcon-root': { color: 'warning.main' },
            }}
          />
        </>
      )}
    </Menu>
  );
};

const ForceSidebarOpen = () => {
  const [open, setOpen] = useSidebarState();
  React.useEffect(() => {
    if (!open) setOpen(true);
  }, [open, setOpen]);
  return null;
};

// Layout content wrapper with trial banner
const LayoutContentWrapper = ({ children }: { children: React.ReactNode }) => (
  <Box sx={{ pt: 1 }}>
    <TrialExpirationBanner />
    {children}
  </Box>
);

const CustomLayout = (props: any) => (
  <>
    <ForceSidebarOpen />
    <KeyboardShortcuts />
    <WelcomeTrigger />
    <Layout {...props} appBar={CustomAppBar} menu={AppMenu}>
      <LayoutContentWrapper>
        {props.children}
      </LayoutContentWrapper>
    </Layout>
  </>
);

/**
 * Main App Component
 */
const BOMUploadWorkflowPage = () => <BOMUploadWorkflow />;

// Get the login page based on auth provider
const getLoginPage = () => {
  const authProviderType = import.meta.env.VITE_AUTH_PROVIDER?.toLowerCase() || 'supabase';
  return authProviderType === 'auth0' ? Auth0Login : DevModeLogin;
};

/**
 * Themed Admin - Uses dynamic theme from ThemeModeContext
 */
function ThemedAdmin() {
  // Get the current theme from ThemeModeContext
  // Pass it to react-admin's Admin component to apply the theme
  const { theme, mode } = useThemeMode();

  return (
    <OrganizationProvider>
      <WorkspaceProvider>
        <Admin
          key={`admin-theme-${mode}`}  // Force re-render when theme mode changes
          dataProvider={dataProvider}
          authProvider={authProvider}
          loginPage={getLoginPage()}
          layout={CustomLayout}
          dashboard={Dashboard}
          title="Customer Portal"
          theme={theme}
          disableTelemetry
        >
      {/* Custom Routes */}
      <CustomRoutes>
        <Route path="/admin-login" element={<AdminLogin />} />
        <Route path="/bom/upload" element={<BOMUploadWorkflow />} />
        <Route path="/bom/enrichment" element={<BOMEnrichmentPage />} />
        <Route path="/bom/audit" element={<BOMAuditStream />} />
        <Route path="/cns-jobs/:jobId" element={<CNSJobStatusPage />} />
        <Route path="/profile" element={<AccountSettings />} /> {/* Redirects old profile URL */}
        <Route path="/account/settings" element={<AccountSettings />} />
        <Route path="/admin/organization-settings" element={<OrganizationSettings />} />
        <Route path="/admin/console" element={<AdminConsole />} />
        <Route path="/project/components" element={<ProjectComponentCatalog />} />
        <Route path="/components/search" element={<ComponentSearch />} />
        <Route path="/components/vault" element={<OrganizationComponentVault />} />
        <Route path="/billing" element={<Billing />} />
        {/* Risk Analysis & Alert System */}
        <Route path="/risk" element={<RiskDashboard />} />
        <Route path="/risk/settings" element={<RiskProfileSettings />} />
        <Route path="/alerts" element={<AlertCenter />} />
        <Route path="/alerts/preferences" element={<AlertPreferencesPage />} />
        <Route path="/notifications" element={<AlertCenter />} /> {/* Alias for /alerts */}
        <Route path="/theme" element={<AccountSettings />} /> {/* Theme settings in account */}
      </CustomRoutes>

      {/* ========== MULTI-TENANCY MANAGEMENT ========== */}

      {/* Organizations */}
      <Resource
        name="organizations"
        list={OrganizationList}
        show={OrganizationShow}
        edit={OrganizationEdit}
        create={OrganizationCreate}
        icon={BusinessIcon}
        options={{ label: 'Organizations' }}
      />

      {/* Users */}
      <Resource
        name="users"
        list={UserList}
        show={UserShow}
        edit={UserEdit}
        create={UserCreate}
        icon={PeopleIcon}
        options={{ label: 'Users' }}
      />

      {/* Projects */}
      <Resource
        name="projects"
        list={ProjectList}
        show={ProjectShow}
        edit={ProjectEdit}
        create={ProjectCreate}
        icon={FolderIcon}
        options={{ label: 'Projects' }}
      />

      {/* ========== CUSTOMER DATA MANAGEMENT ========== */}

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

      {/* BOM Uploads Resource - Raw uploads before enrichment */}
      <Resource
        name="bom_uploads"
        list={BOMUploadList}
        show={BOMUploadShow}
        edit={BOMUploadEdit}
        icon={UploadFileIcon}
        options={{ label: 'BOM Uploads' }}
      />

      {/* Alerts Resource */}
      <Resource
        name="alerts"
        list={AlertList}
        show={AlertShow}
        icon={NotificationsIcon}
        options={{ label: 'Alerts' }}
      />

      {/* CNS Jobs (from Supabase) - legacy view, hidden for unified BOM flow */}
      {/**
      <Resource
        name="bom_jobs"
        list={BOMJobList}
        show={BOMJobShow}
        options={{ label: 'BOM Jobs' }}
      />
      */}

      {/* ========== WORKFLOWS ========== */}

      {/* BOM Upload Workflow */}
      <Resource
        name="bom-upload"
        list={BOMUploadWorkflowPage}
        icon={UploadFileIcon}
        options={{ label: 'BOM Upload' }}
      />

      {/* BOM Line Items - Individual line items from uploads */}
      <Resource
        name="bom_line_items"
        list={BOMLineItemList}
        show={BOMLineItemShow}
        edit={BOMLineItemEdit}
        options={{ label: 'BOM Line Items' }}
      />
        </Admin>
      </WorkspaceProvider>
    </OrganizationProvider>
  );
}

/**
 * App - Main entry point wrapped with ThemeModeProvider
 */
function App() {
  return (
    <ThemeModeProvider>
      <ThemedAdmin />
    </ThemeModeProvider>
  );
}

export default App;
