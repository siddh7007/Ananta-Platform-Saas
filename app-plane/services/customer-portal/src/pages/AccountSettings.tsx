/**
 * Account Settings Page - Consolidated
 *
 * User account settings:
 * - Profile management (via Auth0 Management API)
 * - Theme & notification preferences (via Auth0 user_metadata)
 * - Password change (via Auth0)
 * - Two-Factor Authentication (via Auth0 MFA)
 * - Linked accounts (via Auth0 identities)
 * - Login history (via Auth0 logs)
 * - API Keys management
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Title, useNotify } from 'react-admin';
import { getAuthHeaders } from '../services/cnsApi';
import {
  accountService,
  AccountStatus,
  DeletionReason,
  DeletionStatus,
} from '../services/accountService';
import {
  Card,
  CardContent,
  Grid,
  Typography,
  Box,
  TextField,
  Button,
  Switch,
  FormControlLabel,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Chip,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tooltip,
  Avatar,
  Divider,
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import SecurityIcon from '@mui/icons-material/Security';
import VpnKeyIcon from '@mui/icons-material/VpnKey';
import DeleteIcon from '@mui/icons-material/Delete';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import AddIcon from '@mui/icons-material/Add';
import PersonIcon from '@mui/icons-material/Person';
import LinkIcon from '@mui/icons-material/Link';
import LinkOffIcon from '@mui/icons-material/LinkOff';
import HistoryIcon from '@mui/icons-material/History';
import PaletteIcon from '@mui/icons-material/Palette';
import NotificationsIcon from '@mui/icons-material/Notifications';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import LightModeIcon from '@mui/icons-material/LightMode';
import GoogleIcon from '@mui/icons-material/Google';
import CircularProgress from '@mui/material/CircularProgress';
import RefreshIcon from '@mui/icons-material/Refresh';
import EmailIcon from '@mui/icons-material/Email';
import PhoneAndroidIcon from '@mui/icons-material/PhoneAndroid';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import CancelIcon from '@mui/icons-material/Cancel';
import DashboardIcon from '@mui/icons-material/Dashboard';
import { SecurityCompleteness, OnboardingProgress } from './account';
import { onboardingService, OnboardingChecklist } from '../services/onboardingService';
import { useThemeMode, ThemeMode } from '../contexts/ThemeModeContext';

// Get middleware API URL from environment
const getMiddlewareApiUrl = (): string => {
  return import.meta.env.VITE_MIDDLEWARE_API_URL || 'http://localhost:27700';
};

// Get Auth0 domain for MFA enrollment URL
const getAuth0Domain = (): string => {
  return import.meta.env.VITE_AUTH0_DOMAIN || '';
};

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel({ children, value, index }: TabPanelProps) {
  return (
    <div hidden={value !== index} style={{ paddingTop: 16 }}>
      {value === index && children}
    </div>
  );
}

export const AccountSettings: React.FC = () => {
  const notify = useNotify();
  const middlewareApiUrl = getMiddlewareApiUrl();
  const auth0Domain = getAuth0Domain();
  const [activeTab, setActiveTab] = useState(0);

  // Theme mode from context (provides app-wide theme switching)
  const { mode: theme, setMode: setTheme } = useThemeMode();

  // Profile state
  const [profile, setProfile] = useState<{
    name: string;
    nickname: string;
    email: string;
    picture: string;
    user_metadata: any;
  } | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileSaving, setProfileSaving] = useState(false);
  const [editName, setEditName] = useState('');
  const [editNickname, setEditNickname] = useState('');

  // Preferences state (stored in Auth0 user_metadata)
  // Theme is now managed by ThemeModeContext (see above)
  const [notifyBOMComplete, setNotifyBOMComplete] = useState(true);
  const [notifyAlerts, setNotifyAlerts] = useState(true);
  const [emailDigest, setEmailDigest] = useState(true);
  const [preferencesSaving, setPreferencesSaving] = useState(false);

  // Password state
  const [passwordLoading, setPasswordLoading] = useState(false);

  // MFA state
  const [mfaEnrollments, setMfaEnrollments] = useState<any[]>([]);
  const [mfaLoading, setMfaLoading] = useState(true);

  // Linked accounts state
  const [identities, setIdentities] = useState<any[]>([]);
  const [identitiesLoading, setIdentitiesLoading] = useState(true);

  // Login history state
  const [loginLogs, setLoginLogs] = useState<any[]>([]);
  const [logsLoading, setLogsLoading] = useState(true);

  // API Keys state (placeholder)
  const [apiKeys, setApiKeys] = useState([
    { id: '1', name: 'Production API Key', key: 'sk_prod_***************', created: '2024-11-01', lastUsed: '2024-11-17' },
  ]);
  const [showNewKeyDialog, setShowNewKeyDialog] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');

  // Account deletion state
  const [accountStatus, setAccountStatus] = useState<AccountStatus | null>(null);
  const [deletionReasons, setDeletionReasons] = useState<DeletionReason[]>([]);
  const [deletionStatus, setDeletionStatus] = useState<DeletionStatus | null>(null);
  const [deletionLoading, setDeletionLoading] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteReason, setDeleteReason] = useState('');
  const [deleteFeedback, setDeleteFeedback] = useState('');
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deletionActionLoading, setDeletionActionLoading] = useState(false);
  const isOwner = localStorage.getItem('user_role') === 'owner' || localStorage.getItem('is_admin') === 'true';

  // Onboarding state (for Control Center)
  const [onboardingChecklist, setOnboardingChecklist] = useState<OnboardingChecklist>({
    first_bom_uploaded: false,
    first_enrichment_complete: false,
    team_member_invited: false,
    alert_preferences_configured: false,
    risk_thresholds_set: false,
  });
  const [trialDaysRemaining, setTrialDaysRemaining] = useState<number | null>(null);

  // Fetch profile on mount
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const authHeaders = await getAuthHeaders();
        const response = await fetch(`${middlewareApiUrl}/api/auth0/user/profile`, {
          headers: authHeaders,
        });

        if (!response.ok) {
          throw new Error('Failed to fetch profile');
        }

        const data = await response.json();
        setProfile({
          name: data.name || '',
          nickname: data.nickname || '',
          email: data.email || '',
          picture: data.picture || '',
          user_metadata: data.user_metadata || {},
        });
        setEditName(data.name || '');
        setEditNickname(data.nickname || '');

        // Load preferences from user_metadata
        // Note: Theme is synced to context for immediate effect
        const metadata = data.user_metadata || {};
        const savedTheme = metadata.theme || localStorage.getItem('app_theme') || 'light';
        if (['light', 'light-dim', 'dark-soft', 'dark'].includes(savedTheme)) {
          setTheme(savedTheme as ThemeMode);
        }
        setNotifyBOMComplete(metadata.notifications?.bom_complete ?? true);
        setNotifyAlerts(metadata.notifications?.alerts ?? true);
        setEmailDigest(metadata.notifications?.email_digest ?? true);
      } catch (error) {
        console.error('[AccountSettings] Error fetching profile:', error);
        // Fallback to localStorage
        setProfile({
          name: localStorage.getItem('user_name') || '',
          nickname: '',
          email: localStorage.getItem('user_email') || '',
          picture: localStorage.getItem('user_avatar') || '',
          user_metadata: {},
        });
        setEditName(localStorage.getItem('user_name') || '');
      } finally {
        setProfileLoading(false);
      }
    };

    fetchProfile();
  }, [middlewareApiUrl]);

  // Fetch MFA enrollments
  useEffect(() => {
    const fetchMFA = async () => {
      try {
        const authHeaders = await getAuthHeaders();
        const response = await fetch(`${middlewareApiUrl}/api/auth0/user/mfa`, {
          headers: authHeaders,
        });

        if (response.ok) {
          const data = await response.json();
          setMfaEnrollments(data.enrollments || []);
        }
      } catch (error) {
        console.error('[AccountSettings] Error fetching MFA:', error);
      } finally {
        setMfaLoading(false);
      }
    };

    fetchMFA();
  }, [middlewareApiUrl]);

  // Fetch linked accounts
  useEffect(() => {
    const fetchIdentities = async () => {
      try {
        const authHeaders = await getAuthHeaders();
        console.log('[AccountSettings] Fetching identities from:', `${middlewareApiUrl}/api/auth0/user/identities`);
        const response = await fetch(`${middlewareApiUrl}/api/auth0/user/identities`, {
          headers: authHeaders,
        });

        console.log('[AccountSettings] Identities response status:', response.status);

        if (response.ok) {
          const data = await response.json();
          console.log('[AccountSettings] Identities data:', data);
          setIdentities(data.identities || []);
        } else {
          const errorText = await response.text();
          console.error('[AccountSettings] Identities API error:', response.status, errorText);
        }
      } catch (error) {
        console.error('[AccountSettings] Error fetching identities:', error);
      } finally {
        setIdentitiesLoading(false);
      }
    };

    fetchIdentities();
  }, [middlewareApiUrl]);

  // Fetch login history
  const fetchLoginHistory = async () => {
    setLogsLoading(true);
    try {
      const authHeaders = await getAuthHeaders();
      console.log('[AccountSettings] Fetching login history...');
      const response = await fetch(`${middlewareApiUrl}/api/auth0/user/logs?per_page=20`, {
        headers: authHeaders,
      });

      console.log('[AccountSettings] Logs response status:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('[AccountSettings] Logs data:', data);
        setLoginLogs(data.logs || []);
      } else if (response.status === 403) {
        // M2M app missing read:logs scope
        const errorData = await response.json();
        console.warn('[AccountSettings] Logs API 403:', errorData);
        setLoginLogs([]);
      } else {
        const errorText = await response.text();
        console.error('[AccountSettings] Logs API error:', response.status, errorText);
        setLoginLogs([]);
      }
    } catch (error) {
      console.error('[AccountSettings] Error fetching logs:', error);
    } finally {
      setLogsLoading(false);
    }
  };

  useEffect(() => {
    fetchLoginHistory();
  }, [middlewareApiUrl]);

  // Fetch account deletion data
  const fetchAccountDeletionData = useCallback(async () => {
    setDeletionLoading(true);
    try {
      const [statusData, reasonsData] = await Promise.all([
        accountService.getAccountStatus().catch(() => null),
        accountService.getDeletionReasons().catch(() => []),
      ]);

      if (statusData) {
        setAccountStatus(statusData);
        if (statusData.deletion_scheduled) {
          const deletionStatusData = await accountService.getDeletionStatus().catch(() => null);
          setDeletionStatus(deletionStatusData);
        }
      }
      setDeletionReasons(reasonsData);
    } catch (error) {
      console.error('[AccountSettings] Error fetching account deletion data:', error);
    } finally {
      setDeletionLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAccountDeletionData();
  }, [fetchAccountDeletionData]);

  // Fetch onboarding status
  useEffect(() => {
    const fetchOnboarding = async () => {
      try {
        const status = await onboardingService.getStatus();
        setOnboardingChecklist(status.checklist);
        setTrialDaysRemaining(status.trial_days_remaining);
      } catch (error) {
        console.error('[AccountSettings] Error fetching onboarding status:', error);
      }
    };
    fetchOnboarding();
  }, []);

  // Handle account deletion
  const handleScheduleDeletion = async () => {
    if (!deleteReason || deleteConfirmText !== 'DELETE') {
      notify('Please select a reason and type DELETE to confirm', { type: 'error' });
      return;
    }

    setDeletionActionLoading(true);
    try {
      const result = await accountService.scheduleAccountDeletion({
        reason: deleteReason,
        feedback: deleteFeedback || undefined,
        confirm_text: deleteConfirmText,
      });

      notify(result.message || 'Account deletion scheduled', { type: 'success' });
      setShowDeleteDialog(false);
      setDeleteReason('');
      setDeleteFeedback('');
      setDeleteConfirmText('');
      fetchAccountDeletionData();
    } catch (error: any) {
      notify(error.message || 'Failed to schedule deletion', { type: 'error' });
    } finally {
      setDeletionActionLoading(false);
    }
  };

  // Handle cancel deletion
  const handleCancelDeletion = async () => {
    setDeletionActionLoading(true);
    try {
      const result = await accountService.cancelAccountDeletion();
      notify(result.message || 'Deletion cancelled', { type: 'success' });
      fetchAccountDeletionData();
    } catch (error: any) {
      notify(error.message || 'Failed to cancel deletion', { type: 'error' });
    } finally {
      setDeletionActionLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    setProfileSaving(true);
    try {
      const authHeaders = await getAuthHeaders();
      const response = await fetch(`${middlewareApiUrl}/api/auth0/user/profile`, {
        method: 'PATCH',
        headers: {
          ...authHeaders,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: editName,
          nickname: editNickname,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || errorData.error || 'Failed to update profile');
      }

      const data = await response.json();
      setProfile((prev) => ({
        ...prev!,
        name: data.name || '',
        nickname: data.nickname || '',
      }));

      localStorage.setItem('user_name', data.name || '');
      notify('Profile updated successfully', { type: 'success' });
    } catch (error: any) {
      console.error('[AccountSettings] Error updating profile:', error);
      notify(`Failed to update profile: ${error.message}`, { type: 'error' });
    } finally {
      setProfileSaving(false);
    }
  };

  const handleSavePreferences = async () => {
    setPreferencesSaving(true);
    try {
      // Theme is already applied and saved to localStorage via ThemeModeContext
      // Try to persist to Auth0 user_metadata for cross-device sync
      let backendSaveSuccess = false;
      try {
        const authHeaders = await getAuthHeaders();
        const response = await fetch(`${middlewareApiUrl}/api/auth0/user/metadata`, {
          method: 'PATCH',
          headers: {
            ...authHeaders,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            theme,
            notifications: {
              bom_complete: notifyBOMComplete,
              alerts: notifyAlerts,
              email_digest: emailDigest,
            },
          }),
        });
        backendSaveSuccess = response.ok;
        if (!response.ok) {
          console.warn('[AccountSettings] Backend save failed, but local theme is saved');
        }
      } catch (backendError) {
        console.warn('[AccountSettings] Could not sync to backend:', backendError);
      }

      // Theme is always saved locally via context, so we show success
      if (backendSaveSuccess) {
        notify('Preferences saved successfully', { type: 'success' });
      } else {
        notify('Theme saved locally. Backend sync unavailable.', { type: 'info' });
      }
    } catch (error: any) {
      console.error('[AccountSettings] Error saving preferences:', error);
      notify(`Failed to save preferences: ${error.message}`, { type: 'error' });
    } finally {
      setPreferencesSaving(false);
    }
  };

  // Note: Theme application is now handled by ThemeModeContext
  // No need for local applyTheme function or mount effect

  const handleChangePassword = async () => {
    setPasswordLoading(true);
    try {
      const authHeaders = await getAuthHeaders();
      const response = await fetch(`${middlewareApiUrl}/api/auth0/user/password`, {
        method: 'POST',
        headers: authHeaders,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to send password reset email');
      }

      notify('Password reset email sent! Check your inbox.', { type: 'success' });
    } catch (error: any) {
      console.error('[AccountSettings] Error requesting password change:', error);
      notify(`Failed to send password reset: ${error.message}`, { type: 'error' });
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleRemoveMFA = async (enrollmentId: string) => {
    try {
      const authHeaders = await getAuthHeaders();
      const response = await fetch(`${middlewareApiUrl}/api/auth0/user/mfa/${enrollmentId}`, {
        method: 'DELETE',
        headers: authHeaders,
      });

      if (!response.ok) {
        throw new Error('Failed to remove MFA device');
      }

      setMfaEnrollments((prev) => prev.filter((e) => e.id !== enrollmentId));
      notify('MFA device removed successfully', { type: 'success' });
    } catch (error: any) {
      notify(`Failed to remove MFA device: ${error.message}`, { type: 'error' });
    }
  };

  const handleUnlinkAccount = async (provider: string, userId: string) => {
    try {
      const authHeaders = await getAuthHeaders();
      const response = await fetch(
        `${middlewareApiUrl}/api/auth0/user/identities/${provider}/${encodeURIComponent(userId)}`,
        {
          method: 'DELETE',
          headers: authHeaders,
        }
      );

      if (!response.ok) {
        throw new Error('Failed to unlink account');
      }

      setIdentities((prev) => prev.filter((i) => !(i.provider === provider && i.user_id === userId)));
      notify('Account unlinked successfully', { type: 'success' });
    } catch (error: any) {
      notify(`Failed to unlink account: ${error.message}`, { type: 'error' });
    }
  };

  const getProviderIcon = (provider: string) => {
    switch (provider) {
      case 'google-oauth2':
        return <GoogleIcon sx={{ color: '#4285F4' }} />;
      case 'windowslive':
        return <Box component="span" sx={{ fontWeight: 'bold', color: '#00A4EF', fontSize: 20 }}>M</Box>;
      case 'auth0':
        return <EmailIcon sx={{ color: '#EB5424' }} />;
      default:
        return <LinkIcon />;
    }
  };

  const getProviderName = (provider: string) => {
    switch (provider) {
      case 'google-oauth2':
        return 'Google';
      case 'windowslive':
        return 'Microsoft';
      case 'github':
        return 'GitHub';
      case 'auth0':
        return 'Email/Password';
      default:
        return provider;
    }
  };

  const getMfaIcon = (type: string) => {
    switch (type) {
      case 'totp':
        return <PhoneAndroidIcon />;
      case 'sms':
        return <PhoneAndroidIcon />;
      default:
        return <SecurityIcon />;
    }
  };

  const getMfaTypeName = (type: string) => {
    switch (type) {
      case 'totp':
        return 'Authenticator App';
      case 'sms':
        return 'SMS';
      case 'webauthn-roaming':
        return 'Security Key';
      case 'webauthn-platform':
        return 'Device Biometrics';
      default:
        return type;
    }
  };

  const handleCreateAPIKey = () => {
    const newKey = {
      id: String(apiKeys.length + 1),
      name: newKeyName,
      key: `sk_${Math.random().toString(36).substring(2)}`,
      created: new Date().toISOString().split('T')[0],
      lastUsed: 'Never',
    };
    setApiKeys([...apiKeys, newKey]);
    setShowNewKeyDialog(false);
    setNewKeyName('');
    notify('API key created successfully', { type: 'success' });
  };

  const handleDeleteAPIKey = (id: string) => {
    setApiKeys(apiKeys.filter((key) => key.id !== id));
    notify('API key deleted', { type: 'success' });
  };

  const handleCopyAPIKey = (key: string) => {
    navigator.clipboard.writeText(key);
    notify('API key copied to clipboard', { type: 'success' });
  };

  // Get initials for avatar fallback
  const getInitials = () => {
    if (profile?.name) {
      return profile.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }
    if (profile?.email) {
      return profile.email[0].toUpperCase();
    }
    return 'U';
  };

  return (
    <>
      <Title title="Account Settings" />
      <Box sx={{ p: 3 }}>
        <Typography variant="h4" gutterBottom fontWeight={600}>
          Account Settings
        </Typography>

        <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)} sx={{ mb: 2 }}>
          <Tab icon={<DashboardIcon />} label="Control Center" />
          <Tab icon={<PersonIcon />} label="Profile" />
          <Tab icon={<SecurityIcon />} label="Security" />
          <Tab icon={<PaletteIcon />} label="Preferences" />
          <Tab icon={<HistoryIcon />} label="Activity" />
          <Tab icon={<WarningAmberIcon />} label="Danger Zone" sx={{ color: 'error.main' }} />
        </Tabs>

        {/* Control Center Tab */}
        <TabPanel value={activeTab} index={0}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <SecurityCompleteness
                mfaEnabled={mfaEnrollments.length > 0}
                passwordStrong={true}
                emailVerified={true}
                linkedAccounts={identities.length}
                recentLoginReviewed={loginLogs.length > 0}
                onEnableMFA={() => setActiveTab(2)}
                onChangePassword={handleChangePassword}
                onReviewLogins={() => setActiveTab(4)}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <OnboardingProgress
                checklist={onboardingChecklist}
                trialDaysRemaining={trialDaysRemaining}
              />
            </Grid>
          </Grid>
        </TabPanel>

        {/* Profile Tab */}
        <TabPanel value={activeTab} index={1}>
          <Grid container spacing={3}>
            {/* Profile Card */}
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <PersonIcon sx={{ mr: 1, color: 'primary.main' }} />
                    <Typography variant="h6" fontWeight={600}>
                      Profile Information
                    </Typography>
                  </Box>

                  {profileLoading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                      <CircularProgress />
                    </Box>
                  ) : (
                    <>
                      <Box sx={{ display: 'flex', justifyContent: 'center', mb: 3 }}>
                        <Avatar
                          src={profile?.picture}
                          alt={profile?.name || 'Profile'}
                          sx={{
                            width: 100,
                            height: 100,
                            fontSize: 36,
                            bgcolor: 'primary.main',
                            border: '3px solid',
                            borderColor: 'primary.light',
                          }}
                        >
                          {getInitials()}
                        </Avatar>
                      </Box>

                      <TextField
                        label="Email"
                        value={profile?.email || ''}
                        fullWidth
                        sx={{ mb: 2 }}
                        disabled
                        InputProps={{
                          startAdornment: <EmailIcon sx={{ mr: 1, color: 'text.secondary' }} />,
                        }}
                        helperText="Email is managed by your identity provider and cannot be changed here"
                      />

                      <TextField
                        label="Full Name"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        fullWidth
                        sx={{ mb: 2 }}
                      />

                      <TextField
                        label="Nickname"
                        value={editNickname}
                        onChange={(e) => setEditNickname(e.target.value)}
                        fullWidth
                        sx={{ mb: 2 }}
                        helperText="Optional display name"
                      />

                      <Button
                        variant="contained"
                        startIcon={profileSaving ? <CircularProgress size={20} color="inherit" /> : <SaveIcon />}
                        onClick={handleSaveProfile}
                        fullWidth
                        disabled={profileSaving}
                      >
                        {profileSaving ? 'Saving...' : 'Save Profile'}
                      </Button>
                    </>
                  )}
                </CardContent>
              </Card>
            </Grid>

            {/* Linked Accounts Card */}
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <LinkIcon sx={{ mr: 1, color: 'primary.main' }} />
                    <Typography variant="h6" fontWeight={600}>
                      Linked Accounts
                    </Typography>
                  </Box>

                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Social accounts connected to your profile
                  </Typography>

                  {identitiesLoading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                      <CircularProgress size={24} />
                    </Box>
                  ) : identities.length === 0 ? (
                    <Box>
                      <Alert severity="info" sx={{ mb: 2 }}>
                        Unable to fetch linked accounts. This may require the <code>read:users</code> scope.
                      </Alert>
                      {/* Show primary login method from profile email */}
                      {profile?.email && (
                        <ListItem
                          sx={{
                            border: '1px solid',
                            borderColor: 'divider',
                            borderRadius: 1,
                          }}
                        >
                          <Box sx={{ mr: 2, display: 'flex', alignItems: 'center' }}>
                            <EmailIcon sx={{ color: '#EB5424' }} />
                          </Box>
                          <ListItemText
                            primary="Primary Login"
                            secondary={profile.email}
                          />
                          <Chip label="Primary" size="small" color="primary" />
                        </ListItem>
                      )}
                    </Box>
                  ) : (
                    <List dense>
                      {identities.map((identity, idx) => (
                        <ListItem
                          key={idx}
                          sx={{
                            border: '1px solid',
                            borderColor: 'divider',
                            borderRadius: 1,
                            mb: 1,
                          }}
                        >
                          <Box sx={{ mr: 2, display: 'flex', alignItems: 'center' }}>
                            {getProviderIcon(identity.provider)}
                          </Box>
                          <ListItemText
                            primary={getProviderName(identity.provider)}
                            secondary={identity.connection || identity.provider}
                          />
                          {idx === 0 && <Chip label="Primary" size="small" color="primary" sx={{ mr: 1 }} />}
                          {identities.length > 1 && idx > 0 && (
                            <ListItemSecondaryAction>
                              <Tooltip title="Unlink account">
                                <IconButton
                                  edge="end"
                                  color="error"
                                  onClick={() => handleUnlinkAccount(identity.provider, identity.user_id)}
                                >
                                  <LinkOffIcon />
                                </IconButton>
                              </Tooltip>
                            </ListItemSecondaryAction>
                          )}
                        </ListItem>
                      ))}
                    </List>
                  )}
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </TabPanel>

        {/* Security Tab */}
        <TabPanel value={activeTab} index={2}>
          <Grid container spacing={3}>
            {/* Password Card */}
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <VpnKeyIcon sx={{ mr: 1, color: 'primary.main' }} />
                    <Typography variant="h6" fontWeight={600}>
                      Change Password
                    </Typography>
                  </Box>

                  <Alert severity="info" sx={{ mb: 2 }}>
                    Password changes are handled securely via email.
                  </Alert>

                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    We'll send a password reset link to:{' '}
                    <strong>{profile?.email || 'your email'}</strong>
                  </Typography>

                  <Button
                    variant="contained"
                    startIcon={passwordLoading ? <CircularProgress size={20} color="inherit" /> : <VpnKeyIcon />}
                    onClick={handleChangePassword}
                    fullWidth
                    disabled={passwordLoading}
                  >
                    {passwordLoading ? 'Sending...' : 'Send Password Reset Email'}
                  </Button>
                </CardContent>
              </Card>
            </Grid>

            {/* MFA Card */}
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <SecurityIcon sx={{ mr: 1, color: 'primary.main' }} />
                    <Typography variant="h6" fontWeight={600}>
                      Two-Factor Authentication
                    </Typography>
                  </Box>

                  <Alert severity={mfaEnrollments.length > 0 ? 'success' : 'warning'} sx={{ mb: 2 }}>
                    {mfaEnrollments.length > 0
                      ? `MFA is enabled (${mfaEnrollments.length} device${mfaEnrollments.length > 1 ? 's' : ''})`
                      : 'MFA is not enabled. Enable it for better security.'}
                  </Alert>

                  {mfaLoading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                      <CircularProgress size={24} />
                    </Box>
                  ) : mfaEnrollments.length > 0 ? (
                    <List dense>
                      {mfaEnrollments.map((enrollment) => (
                        <ListItem
                          key={enrollment.id}
                          sx={{
                            border: '1px solid',
                            borderColor: 'divider',
                            borderRadius: 1,
                            mb: 1,
                          }}
                        >
                          <Box sx={{ mr: 2 }}>{getMfaIcon(enrollment.type)}</Box>
                          <ListItemText
                            primary={enrollment.name || getMfaTypeName(enrollment.type)}
                            secondary={`Type: ${getMfaTypeName(enrollment.type)}${enrollment.phone_number ? ` (${enrollment.phone_number})` : ''}`}
                          />
                          <ListItemSecondaryAction>
                            <IconButton
                              edge="end"
                              color="error"
                              onClick={() => handleRemoveMFA(enrollment.id)}
                            >
                              <DeleteIcon />
                            </IconButton>
                          </ListItemSecondaryAction>
                        </ListItem>
                      ))}
                    </List>
                  ) : null}

                  <Divider sx={{ my: 2 }} />

                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    {mfaEnrollments.length > 0
                      ? 'Add another authentication method or manage existing ones:'
                      : 'Set up two-factor authentication to secure your account:'}
                  </Typography>

                  {auth0Domain && (
                    <Button
                      variant="outlined"
                      startIcon={<OpenInNewIcon />}
                      fullWidth
                      onClick={() => {
                        // Open Auth0 MFA enrollment in new tab
                        window.open(`https://${auth0Domain}/mfa/`, '_blank');
                      }}
                    >
                      {mfaEnrollments.length > 0 ? 'Manage MFA in Auth0' : 'Enable MFA'}
                    </Button>
                  )}
                </CardContent>
              </Card>
            </Grid>

            {/* API Keys Card */}
            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <VpnKeyIcon sx={{ mr: 1, color: 'primary.main' }} />
                      <Typography variant="h6" fontWeight={600}>
                        API Keys
                      </Typography>
                    </Box>
                    <Button
                      variant="contained"
                      size="small"
                      startIcon={<AddIcon />}
                      onClick={() => setShowNewKeyDialog(true)}
                    >
                      Create New Key
                    </Button>
                  </Box>

                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    API keys allow you to authenticate API requests. Keep them secure.
                  </Typography>

                  <List>
                    {apiKeys.map((apiKey) => (
                      <ListItem
                        key={apiKey.id}
                        sx={{
                          border: '1px solid',
                          borderColor: 'divider',
                          borderRadius: 1,
                          mb: 1,
                        }}
                      >
                        <ListItemText
                          primary={apiKey.name}
                          secondary={
                            <>
                              <Typography component="span" variant="body2" sx={{ fontFamily: 'monospace' }}>
                                {apiKey.key}
                              </Typography>
                              <br />
                              <Typography component="span" variant="caption" color="text.secondary">
                                Created: {apiKey.created} | Last used: {apiKey.lastUsed}
                              </Typography>
                            </>
                          }
                        />
                        <ListItemSecondaryAction>
                          <IconButton onClick={() => handleCopyAPIKey(apiKey.key)} sx={{ mr: 1 }}>
                            <ContentCopyIcon />
                          </IconButton>
                          <IconButton onClick={() => handleDeleteAPIKey(apiKey.id)} color="error">
                            <DeleteIcon />
                          </IconButton>
                        </ListItemSecondaryAction>
                      </ListItem>
                    ))}
                  </List>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </TabPanel>

        {/* Preferences Tab */}
        <TabPanel value={activeTab} index={3}>
          <Grid container spacing={3}>
            {/* Theme Card */}
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <PaletteIcon sx={{ mr: 1, color: 'primary.main' }} />
                    <Typography variant="h6" fontWeight={600}>
                      Theme Preferences
                    </Typography>
                  </Box>

                  <FormControl fullWidth sx={{ mb: 2 }}>
                    <InputLabel>Theme</InputLabel>
                    <Select
                      value={theme}
                      label="Theme"
                      onChange={(e) => {
                        // setTheme from context applies immediately and persists to localStorage
                        setTheme(e.target.value as ThemeMode);
                      }}
                    >
                      <MenuItem value="light">
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <LightModeIcon sx={{ mr: 1, color: '#fbbf24' }} fontSize="small" />
                          Light
                        </Box>
                      </MenuItem>
                      <MenuItem value="light-dim">
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <LightModeIcon sx={{ mr: 1, color: '#d4a574' }} fontSize="small" />
                          Light Dim
                        </Box>
                      </MenuItem>
                      <MenuItem value="dark-soft">
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <DarkModeIcon sx={{ mr: 1, color: '#718096' }} fontSize="small" />
                          Dark Soft
                        </Box>
                      </MenuItem>
                      <MenuItem value="dark">
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <DarkModeIcon sx={{ mr: 1, color: '#1a202c' }} fontSize="small" />
                          Dark
                        </Box>
                      </MenuItem>
                    </Select>
                  </FormControl>

                  <Typography variant="caption" color="text.secondary">
                    Choose your preferred theme appearance.
                  </Typography>

                  <Box sx={{ mt: 2, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
                    <Box
                      onClick={() => setTheme('light')}
                      sx={{
                        p: 1, borderRadius: 1, bgcolor: '#ffffff', textAlign: 'center', cursor: 'pointer',
                        border: theme === 'light' ? '2px solid #3b82f6' : '1px solid #e2e8f0',
                        '&:hover': { opacity: 0.8 },
                      }}
                    >
                      <Typography variant="caption" sx={{ color: '#1a202c' }}>Light</Typography>
                    </Box>
                    <Box
                      onClick={() => setTheme('light-dim')}
                      sx={{
                        p: 1, borderRadius: 1, bgcolor: '#f0ede6', textAlign: 'center', cursor: 'pointer',
                        border: theme === 'light-dim' ? '2px solid #3b82f6' : '1px solid #d4a574',
                        '&:hover': { opacity: 0.8 },
                      }}
                    >
                      <Typography variant="caption" sx={{ color: '#2d3748' }}>Light Dim</Typography>
                    </Box>
                    <Box
                      onClick={() => setTheme('dark-soft')}
                      sx={{
                        p: 1, borderRadius: 1, bgcolor: '#2d3748', textAlign: 'center', cursor: 'pointer',
                        border: theme === 'dark-soft' ? '2px solid #3b82f6' : '1px solid #4a5568',
                        '&:hover': { opacity: 0.8 },
                      }}
                    >
                      <Typography variant="caption" sx={{ color: '#e2e8f0' }}>Dark Soft</Typography>
                    </Box>
                    <Box
                      onClick={() => setTheme('dark')}
                      sx={{
                        p: 1, borderRadius: 1, bgcolor: '#121212', textAlign: 'center', cursor: 'pointer',
                        border: theme === 'dark' ? '2px solid #3b82f6' : '1px solid #333',
                        '&:hover': { opacity: 0.8 },
                      }}
                    >
                      <Typography variant="caption" sx={{ color: '#ffffff' }}>Dark</Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            {/* Notifications Card */}
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <NotificationsIcon sx={{ mr: 1, color: 'primary.main' }} />
                    <Typography variant="h6" fontWeight={600}>
                      Notification Preferences
                    </Typography>
                  </Box>

                  <FormControlLabel
                    control={
                      <Switch
                        checked={notifyBOMComplete}
                        onChange={(e) => setNotifyBOMComplete(e.target.checked)}
                      />
                    }
                    label="BOM enrichment completed"
                    sx={{ display: 'block', mb: 1 }}
                  />

                  <FormControlLabel
                    control={
                      <Switch checked={notifyAlerts} onChange={(e) => setNotifyAlerts(e.target.checked)} />
                    }
                    label="Component alerts"
                    sx={{ display: 'block', mb: 1 }}
                  />

                  <FormControlLabel
                    control={
                      <Switch checked={emailDigest} onChange={(e) => setEmailDigest(e.target.checked)} />
                    }
                    label="Daily email digest"
                    sx={{ display: 'block' }}
                  />
                </CardContent>
              </Card>
            </Grid>

            {/* Save Preferences Button */}
            <Grid item xs={12}>
              <Button
                variant="contained"
                size="large"
                startIcon={preferencesSaving ? <CircularProgress size={20} color="inherit" /> : <SaveIcon />}
                onClick={handleSavePreferences}
                disabled={preferencesSaving}
                sx={{ minWidth: 200 }}
              >
                {preferencesSaving ? 'Saving...' : 'Save All Preferences'}
              </Button>
            </Grid>
          </Grid>
        </TabPanel>

        {/* Activity Tab */}
        <TabPanel value={activeTab} index={4}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <HistoryIcon sx={{ mr: 1, color: 'primary.main' }} />
                  <Typography variant="h6" fontWeight={600}>
                    Login History
                  </Typography>
                </Box>
                <Button
                  size="small"
                  startIcon={logsLoading ? <CircularProgress size={16} /> : <RefreshIcon />}
                  onClick={fetchLoginHistory}
                  disabled={logsLoading}
                >
                  Refresh
                </Button>
              </Box>

              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Recent login activity for your account
              </Typography>

              {logsLoading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                  <CircularProgress />
                </Box>
              ) : loginLogs.length === 0 ? (
                <Alert severity="info">
                  <Typography variant="body2" gutterBottom>
                    No login history available.
                  </Typography>
                  <Typography variant="body2" sx={{ mt: 1 }}>
                    <strong>To enable login history:</strong>
                  </Typography>
                  <ol style={{ margin: '8px 0', paddingLeft: 20 }}>
                    <li>Go to Auth0 Dashboard → Applications → APIs</li>
                    <li>Select "Auth0 Management API"</li>
                    <li>Click on "Machine to Machine Applications"</li>
                    <li>Find your M2M app and add the <code>read:logs</code> scope</li>
                    <li>Restart the middleware-api service</li>
                  </ol>
                </Alert>
              ) : (
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Event</TableCell>
                      <TableCell>Date</TableCell>
                      <TableCell>IP Address</TableCell>
                      <TableCell>Location</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {loginLogs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell>
                          <Chip
                            label={log.type_description}
                            size="small"
                            color={log.type === 's' || log.type === 'ss' ? 'success' : log.type?.startsWith('f') ? 'error' : 'default'}
                          />
                        </TableCell>
                        <TableCell>
                          {new Date(log.date).toLocaleString()}
                        </TableCell>
                        <TableCell sx={{ fontFamily: 'monospace' }}>{log.ip}</TableCell>
                        <TableCell>
                          {log.location?.city && log.location?.country
                            ? `${log.location.city}, ${log.location.country}`
                            : '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabPanel>

        {/* Danger Zone Tab */}
        <TabPanel value={activeTab} index={5}>
          <Card sx={{ border: '1px solid', borderColor: 'error.main' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <WarningAmberIcon sx={{ mr: 1, color: 'error.main' }} />
                <Typography variant="h6" fontWeight={600} color="error.main">
                  Danger Zone
                </Typography>
              </Box>

              {deletionLoading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                  <CircularProgress />
                </Box>
              ) : (
                <>
                  {/* Account Status */}
                  {accountStatus && (
                    <Box sx={{ mb: 3, p: 2, bgcolor: 'background.paper', borderRadius: 1 }}>
                      <Typography variant="subtitle2" gutterBottom>
                        Account Status
                      </Typography>
                      <Grid container spacing={2}>
                        <Grid item xs={6} md={3}>
                          <Typography variant="caption" color="text.secondary">Organization</Typography>
                          <Typography variant="body2">{accountStatus.organization_name}</Typography>
                        </Grid>
                        <Grid item xs={6} md={3}>
                          <Typography variant="caption" color="text.secondary">Plan</Typography>
                          <Typography variant="body2">{accountStatus.plan_tier}</Typography>
                        </Grid>
                        <Grid item xs={6} md={3}>
                          <Typography variant="caption" color="text.secondary">Status</Typography>
                          <Chip
                            label={accountStatus.subscription_status}
                            size="small"
                            color={accountStatus.is_suspended ? 'error' : 'success'}
                          />
                        </Grid>
                        <Grid item xs={6} md={3}>
                          <Typography variant="caption" color="text.secondary">Type</Typography>
                          <Typography variant="body2">{accountStatus.org_type}</Typography>
                        </Grid>
                      </Grid>
                    </Box>
                  )}

                  {/* Deletion Scheduled Alert */}
                  {deletionStatus?.deletion_scheduled && (
                    <Alert severity="error" sx={{ mb: 3 }}>
                      <Typography variant="subtitle2" gutterBottom>
                        Account Deletion Scheduled
                      </Typography>
                      <Typography variant="body2">
                        Your account is scheduled for deletion on{' '}
                        <strong>{new Date(deletionStatus.deletion_scheduled_at!).toLocaleDateString()}</strong>.
                        You have <strong>{deletionStatus.days_remaining} days</strong> to cancel.
                      </Typography>
                      {deletionStatus.reason && (
                        <Typography variant="body2" sx={{ mt: 1 }}>
                          Reason: {deletionStatus.reason}
                        </Typography>
                      )}
                      {deletionStatus.can_cancel && (
                        <Button
                          variant="contained"
                          color="primary"
                          size="small"
                          onClick={handleCancelDeletion}
                          disabled={deletionActionLoading}
                          startIcon={deletionActionLoading ? <CircularProgress size={16} /> : <CancelIcon />}
                          sx={{ mt: 2 }}
                        >
                          Cancel Deletion
                        </Button>
                      )}
                    </Alert>
                  )}

                  {/* Delete Account Section */}
                  {!deletionStatus?.deletion_scheduled && (
                    <>
                      <Divider sx={{ my: 2 }} />

                      <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                        Delete Organization Account
                      </Typography>

                      <Alert severity="warning" sx={{ mb: 2 }}>
                        <Typography variant="body2">
                          Deleting your organization account is permanent and cannot be undone.
                          All data, including BOMs, components, and projects will be permanently removed
                          after a 30-day grace period (GDPR compliant).
                        </Typography>
                      </Alert>

                      {/* Show delete button if user is owner OR if backend says they can delete (single-person org) */}
                      {!isOwner && !accountStatus?.can_be_deleted ? (
                        <Alert severity="info">
                          Only organization owners can delete the organization account.
                          Contact your organization owner to request deletion.
                        </Alert>
                      ) : (
                        <Button
                          variant="contained"
                          color="error"
                          startIcon={<DeleteIcon />}
                          onClick={() => setShowDeleteDialog(true)}
                          disabled={!accountStatus?.can_be_deleted}
                        >
                          Delete Organization Account
                        </Button>
                      )}

                      {accountStatus && !accountStatus.can_be_deleted && (
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                          Account cannot be deleted at this time. Please contact support.
                        </Typography>
                      )}
                    </>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabPanel>
      </Box>

      {/* New API Key Dialog */}
      <Dialog open={showNewKeyDialog} onClose={() => setShowNewKeyDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create New API Key</DialogTitle>
        <DialogContent>
          <TextField
            label="Key Name"
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
            fullWidth
            sx={{ mt: 2 }}
            placeholder="e.g., Production API Key"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowNewKeyDialog(false)}>Cancel</Button>
          <Button onClick={handleCreateAPIKey} variant="contained" disabled={!newKeyName}>
            Create
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Account Dialog */}
      <Dialog
        open={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ color: 'error.main' }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <WarningAmberIcon sx={{ mr: 1 }} />
            Delete Organization Account
          </Box>
        </DialogTitle>
        <DialogContent>
          <Alert severity="error" sx={{ mb: 3 }}>
            This action cannot be undone. After a 30-day grace period, all data will be permanently deleted.
          </Alert>

          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Why are you leaving?</InputLabel>
            <Select
              value={deleteReason}
              label="Why are you leaving?"
              onChange={(e) => setDeleteReason(e.target.value)}
            >
              {deletionReasons.map((reason) => (
                <MenuItem key={reason.id} value={reason.id}>
                  {reason.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField
            label="Additional feedback (optional)"
            value={deleteFeedback}
            onChange={(e) => setDeleteFeedback(e.target.value)}
            fullWidth
            multiline
            rows={3}
            sx={{ mb: 3 }}
            placeholder="Help us improve by sharing why you're leaving..."
          />

          <Divider sx={{ my: 2 }} />

          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            To confirm deletion, type <strong>DELETE</strong> below:
          </Typography>

          <TextField
            label="Type DELETE to confirm"
            value={deleteConfirmText}
            onChange={(e) => setDeleteConfirmText(e.target.value.toUpperCase())}
            fullWidth
            error={deleteConfirmText.length > 0 && deleteConfirmText !== 'DELETE'}
            helperText={
              deleteConfirmText.length > 0 && deleteConfirmText !== 'DELETE'
                ? 'Please type DELETE exactly'
                : ''
            }
          />
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setShowDeleteDialog(false);
              setDeleteReason('');
              setDeleteFeedback('');
              setDeleteConfirmText('');
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleScheduleDeletion}
            variant="contained"
            color="error"
            disabled={
              deletionActionLoading ||
              !deleteReason ||
              deleteConfirmText !== 'DELETE'
            }
            startIcon={deletionActionLoading ? <CircularProgress size={16} /> : <DeleteIcon />}
          >
            {deletionActionLoading ? 'Scheduling...' : 'Schedule Deletion'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};
