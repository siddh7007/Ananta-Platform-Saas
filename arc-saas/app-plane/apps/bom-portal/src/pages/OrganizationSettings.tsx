/**
 * Organization Settings Page (Admin Only)
 *
 * Organization-wide settings that only Org Admin/Tenant Admin can edit:
 * - Organization profile (name, logo, contact info)
 * - Billing and subscription
 * - Security policies
 * - API access and webhooks
 * - Data retention policies
 * - SSO/SAML configuration
 * - Compliance settings
 *
 * Note: Regular users can VIEW but only admins can EDIT
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Title, useNotify, useGetIdentity, usePermissions } from 'react-admin';
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
  Divider,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Alert,
  Chip,
  Avatar,
  InputAdornment,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  DialogContentText,
  Skeleton,
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import BusinessIcon from '@mui/icons-material/Business';
import SecurityIcon from '@mui/icons-material/Security';
import PaymentIcon from '@mui/icons-material/Payment';
import WebhookIcon from '@mui/icons-material/Webhook';
import CloudIcon from '@mui/icons-material/Cloud';
import PolicyIcon from '@mui/icons-material/Policy';
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import RefreshIcon from '@mui/icons-material/Refresh';
import { organizationService, OrganizationSettings as OrgSettingsType } from '../services/organizationService';

export const OrganizationSettings: React.FC = () => {
  const notify = useNotify();
  const { identity } = useGetIdentity();
  const { permissions } = usePermissions();

  // Check if user is org admin/tenant admin
  // Method 1: Check role from react-admin permissions (user_role in localStorage)
  // Method 2: Check is_admin flag (set for org owners/admins AND platform admins)
  const roleIsAdmin = ['owner', 'admin', 'super_admin', 'billing_admin'].includes(permissions as string);
  const flagIsAdmin = localStorage.getItem('is_admin') === 'true';
  const isOrgAdmin = roleIsAdmin || flagIsAdmin;

  // Loading and error states
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSavingOrg, setIsSavingOrg] = useState(false);
  const [isSavingSecurity, setIsSavingSecurity] = useState(false);
  const [isSavingApi, setIsSavingApi] = useState(false);
  const [isSavingRetention, setIsSavingRetention] = useState(false);
  const [isSavingSso, setIsSavingSso] = useState(false);

  // Organization profile
  const [orgId, setOrgId] = useState<string>('');
  const [orgName, setOrgName] = useState('');
  const [orgSlug, setOrgSlug] = useState('');
  const [originalSlug, setOriginalSlug] = useState('');
  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null);
  const [slugChecking, setSlugChecking] = useState(false);
  const [slugSuggestion, setSlugSuggestion] = useState<string | null>(null);
  const [orgLogo, setOrgLogo] = useState<string | null>(null);
  const [orgEmail, setOrgEmail] = useState('');
  const [orgPhone, setOrgPhone] = useState('');
  const [orgAddress, setOrgAddress] = useState('');
  const [orgType, setOrgType] = useState('');
  const [orgEmailError, setOrgEmailError] = useState<string | null>(null);
  const [billingEmailError, setBillingEmailError] = useState<string | null>(null);

  // Confirmation dialog states
  const [showOrgConfirmDialog, setShowOrgConfirmDialog] = useState(false);
  const [showSecurityConfirmDialog, setShowSecurityConfirmDialog] = useState(false);
  const [showApiConfirmDialog, setShowApiConfirmDialog] = useState(false);
  const [showRetentionConfirmDialog, setShowRetentionConfirmDialog] = useState(false);
  const [showSsoConfirmDialog, setShowSsoConfirmDialog] = useState(false);

  // Billing & Subscription
  const [billingEmail, setBillingEmail] = useState('');

  // Security policies
  const [requireMFA, setRequireMFA] = useState(false);
  const [sessionTimeout, setSessionTimeout] = useState(30);
  const [passwordPolicy, setPasswordPolicy] = useState<'basic' | 'strong' | 'enterprise'>('strong');

  // API access
  const [apiAccessEnabled, setApiAccessEnabled] = useState(true);
  const [webhooksEnabled, setWebhooksEnabled] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState('');

  // Data retention
  const [dataRetentionDays, setDataRetentionDays] = useState(365);
  const [auditLogRetention, setAuditLogRetention] = useState(90);

  // SSO configuration
  const [ssoEnabled, setSsoEnabled] = useState(false);
  const [ssoProvider, setSsoProvider] = useState<'saml' | 'okta' | 'azure' | 'google'>('saml');

  // Fetch organization settings on mount
  const fetchSettings = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const settings: OrgSettingsType = await organizationService.getSettings();

      // Profile
      setOrgId(settings.profile.id);
      setOrgName(settings.profile.name);
      setOrgSlug(settings.profile.slug);
      setOriginalSlug(settings.profile.slug);
      setOrgEmail(settings.profile.email || '');
      setOrgPhone(settings.profile.phone || '');
      setOrgAddress(settings.profile.address || '');
      setOrgLogo(settings.profile.logo_url);
      setBillingEmail(settings.profile.billing_email || '');
      setOrgType(settings.profile.org_type);

      // Security
      setRequireMFA(settings.security.require_mfa);
      setSessionTimeout(settings.security.session_timeout_minutes);
      setPasswordPolicy(settings.security.password_policy);

      // API
      setApiAccessEnabled(settings.api.api_access_enabled);
      setWebhooksEnabled(settings.api.webhooks_enabled);
      setWebhookUrl(settings.api.webhook_url || '');

      // Data Retention
      setDataRetentionDays(settings.data_retention.data_retention_days);
      setAuditLogRetention(settings.data_retention.audit_log_retention_days);

      // SSO
      setSsoEnabled(settings.sso.sso_enabled);
      setSsoProvider(settings.sso.sso_provider);

    } catch (error) {
      console.error('[OrganizationSettings] Failed to load settings:', error);
      setLoadError(error instanceof Error ? error.message : 'Failed to load organization settings');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  // Validation helpers
  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // Email validation handlers
  const handleOrgEmailChange = (value: string) => {
    setOrgEmail(value);
    if (value.trim() && !validateEmail(value)) {
      setOrgEmailError('Please enter a valid email address');
    } else {
      setOrgEmailError(null);
    }
  };

  const handleBillingEmailChange = (value: string) => {
    setBillingEmail(value);
    if (value.trim() && !validateEmail(value)) {
      setBillingEmailError('Please enter a valid email address');
    } else {
      setBillingEmailError(null);
    }
  };

  const handleLogoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file size (max 2MB)
      const maxSize = 2 * 1024 * 1024; // 2MB in bytes
      if (file.size > maxSize) {
        notify('File is too large. Maximum size is 2MB. Please choose a smaller image.', {
          type: 'error'
        });
        return;
      }

      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
      if (!allowedTypes.includes(file.type)) {
        notify('Invalid file type. Please upload a JPEG, PNG, GIF, or WebP image.', {
          type: 'error'
        });
        return;
      }

      const reader = new FileReader();

      reader.onloadend = () => {
        setOrgLogo(reader.result as string);
        notify('Logo uploaded successfully', { type: 'success' });
      };

      reader.onerror = () => {
        notify('Failed to read file. Please try again.', { type: 'error' });
      };

      reader.readAsDataURL(file);
    }
  };

  // Helper function to normalize slug
  const normalizeSlug = (text: string): string => {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '') // Remove special characters
      .replace(/\s+/g, '-')      // Replace spaces with hyphens
      .replace(/-+/g, '-')       // Replace multiple hyphens with single
      .replace(/^-|-$/g, '');    // Remove leading/trailing hyphens
  };

  // Handle slug change with validation
  const handleSlugChange = async (value: string) => {
    const normalized = normalizeSlug(value);
    setOrgSlug(normalized);
    setSlugSuggestion(null);

    // Skip check if slug is unchanged from original
    if (normalized === originalSlug) {
      setSlugAvailable(true);
      return;
    }

    if (normalized.length >= 3) {
      setSlugChecking(true);
      try {
        const result = await organizationService.checkSlugAvailability(normalized);
        setSlugAvailable(result.available);
        if (!result.available && result.suggested) {
          setSlugSuggestion(result.suggested);
        }
      } catch (error) {
        console.error('[OrganizationSettings] Slug check failed:', error);
        setSlugAvailable(null);
      } finally {
        setSlugChecking(false);
      }
    } else {
      setSlugAvailable(null);
    }
  };

  // Auto-generate slug from org name
  const handleOrgNameChange = (value: string) => {
    setOrgName(value);
    if (value.trim() && !originalSlug) {
      const suggestedSlug = normalizeSlug(value);
      setOrgSlug(suggestedSlug);
      handleSlugChange(suggestedSlug);
    }
  };

  const handleSaveOrganization = () => {
    if (!isOrgAdmin) {
      notify('You need administrator privileges to edit organization settings. Please contact your organization admin.', {
        type: 'error'
      });
      return;
    }

    // Validate organization name
    if (!orgName.trim()) {
      notify('Organization name is required. Please enter a name for your organization.', {
        type: 'error'
      });
      return;
    }

    if (orgName.trim().length < 3) {
      notify('Organization name must be at least 3 characters long.', {
        type: 'error'
      });
      return;
    }

    // Validate organization slug
    if (!orgSlug.trim() || orgSlug.length < 3) {
      notify('Organization slug must be at least 3 characters long.', {
        type: 'error'
      });
      return;
    }

    if (slugAvailable === false) {
      notify('This organization slug is already taken. Please choose a different one.', {
        type: 'error'
      });
      return;
    }

    // Validate email
    if (orgEmail && !validateEmail(orgEmail)) {
      setOrgEmailError('Please enter a valid email address');
      notify('Organization email is invalid. Please enter a valid email address (e.g., admin@example.com).', {
        type: 'error'
      });
      return;
    }
    setOrgEmailError(null);

    // Show confirmation dialog
    setShowOrgConfirmDialog(true);
  };

  const confirmSaveOrganization = async () => {
    setShowOrgConfirmDialog(false);
    setIsSavingOrg(true);

    try {
      await organizationService.updateProfile({
        name: orgName,
        slug: orgSlug,
        email: orgEmail || undefined,
        phone: orgPhone || undefined,
        address: orgAddress || undefined,
        logo_url: orgLogo || undefined,
        billing_email: billingEmail || undefined,
      });

      // Update original slug after successful save
      setOriginalSlug(orgSlug);

      notify('Organization settings saved successfully!', {
        type: 'success'
      });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('network') || error.message.includes('fetch')) {
          notify('Unable to connect to the server. Please check your internet connection and try again.', {
            type: 'error'
          });
        } else if (error.message.includes('timeout')) {
          notify('Request timed out. The server is taking too long to respond. Please try again.', {
            type: 'error'
          });
        } else if (error.message.includes('slug')) {
          notify('This organization slug is already in use. Please choose a different one.', {
            type: 'error'
          });
        } else {
          notify(`Failed to save organization settings: ${error.message}. Please try again or contact support.`, {
            type: 'error'
          });
        }
      } else {
        notify('An unexpected error occurred while saving. Please try again or contact support if the problem persists.', {
          type: 'error'
        });
      }
    } finally {
      setIsSavingOrg(false);
    }
  };

  const handleSaveSecurity = () => {
    if (!isOrgAdmin) {
      notify('You need administrator privileges to edit security settings. Please contact your organization admin.', {
        type: 'error'
      });
      return;
    }

    // Validate security settings
    if (sessionTimeout < 5) {
      notify('Session timeout must be at least 5 minutes for security reasons.', {
        type: 'error'
      });
      return;
    }

    // Show confirmation dialog
    setShowSecurityConfirmDialog(true);
  };

  const confirmSaveSecurity = async () => {
    setShowSecurityConfirmDialog(false);
    setIsSavingSecurity(true);

    try {
      await organizationService.updateSecuritySettings({
        require_mfa: requireMFA,
        session_timeout_minutes: sessionTimeout,
        password_policy: passwordPolicy,
      });

      notify('Security settings saved successfully!', {
        type: 'success'
      });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('network') || error.message.includes('fetch')) {
          notify('Unable to connect to the server. Please check your internet connection and try again.', {
            type: 'error'
          });
        } else if (error.message.includes('timeout')) {
          notify('Request timed out. The server is taking too long to respond. Please try again.', {
            type: 'error'
          });
        } else {
          notify(`Failed to save security settings: ${error.message}. Please try again or contact support.`, {
            type: 'error'
          });
        }
      } else {
        notify('An unexpected error occurred while saving security settings. Please try again or contact support if the problem persists.', {
          type: 'error'
        });
      }
    } finally {
      setIsSavingSecurity(false);
    }
  };

  const handleSaveApi = () => {
    if (!isOrgAdmin) {
      notify('You need administrator privileges to edit API settings.', { type: 'error' });
      return;
    }
    setShowApiConfirmDialog(true);
  };

  const confirmSaveApi = async () => {
    setShowApiConfirmDialog(false);
    setIsSavingApi(true);

    try {
      await organizationService.updateApiSettings({
        api_access_enabled: apiAccessEnabled,
        webhooks_enabled: webhooksEnabled,
        webhook_url: webhookUrl || undefined,
      });

      notify('API settings saved successfully!', { type: 'success' });
    } catch (error) {
      notify(`Failed to save API settings: ${error instanceof Error ? error.message : 'Unknown error'}`, {
        type: 'error'
      });
    } finally {
      setIsSavingApi(false);
    }
  };

  const handleSaveRetention = () => {
    if (!isOrgAdmin) {
      notify('You need administrator privileges to edit data retention settings.', { type: 'error' });
      return;
    }

    if (dataRetentionDays < 30 || dataRetentionDays > 3650) {
      notify('Data retention must be between 30 and 3650 days.', { type: 'error' });
      return;
    }

    if (auditLogRetention < 30 || auditLogRetention > 365) {
      notify('Audit log retention must be between 30 and 365 days.', { type: 'error' });
      return;
    }

    setShowRetentionConfirmDialog(true);
  };

  const confirmSaveRetention = async () => {
    setShowRetentionConfirmDialog(false);
    setIsSavingRetention(true);

    try {
      await organizationService.updateDataRetention({
        data_retention_days: dataRetentionDays,
        audit_log_retention_days: auditLogRetention,
      });

      notify('Data retention settings saved successfully!', { type: 'success' });
    } catch (error) {
      notify(`Failed to save data retention settings: ${error instanceof Error ? error.message : 'Unknown error'}`, {
        type: 'error'
      });
    } finally {
      setIsSavingRetention(false);
    }
  };

  const handleSaveSso = () => {
    if (!isOrgAdmin) {
      notify('You need administrator privileges to edit SSO settings.', { type: 'error' });
      return;
    }
    setShowSsoConfirmDialog(true);
  };

  const confirmSaveSso = async () => {
    setShowSsoConfirmDialog(false);
    setIsSavingSso(true);

    try {
      await organizationService.updateSsoSettings({
        sso_enabled: ssoEnabled,
        sso_provider: ssoProvider,
      });

      notify('SSO settings saved successfully!', { type: 'success' });
    } catch (error) {
      notify(`Failed to save SSO settings: ${error instanceof Error ? error.message : 'Unknown error'}`, {
        type: 'error'
      });
    } finally {
      setIsSavingSso(false);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <>
        <Title title="Organization Settings" />
        <Box sx={{ p: 3 }}>
          <Typography variant="h4" fontWeight={600} sx={{ mb: 3 }}>
            Organization Settings
          </Typography>
          <Grid container spacing={3}>
            {[1, 2, 3, 4].map((i) => (
              <Grid item xs={12} md={6} key={i}>
                <Card>
                  <CardContent>
                    <Skeleton variant="text" width="60%" height={32} sx={{ mb: 2 }} />
                    <Skeleton variant="rectangular" height={56} sx={{ mb: 2 }} />
                    <Skeleton variant="rectangular" height={56} sx={{ mb: 2 }} />
                    <Skeleton variant="rectangular" height={56} />
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Box>
      </>
    );
  }

  // Error state
  if (loadError) {
    return (
      <>
        <Title title="Organization Settings" />
        <Box sx={{ p: 3 }}>
          <Typography variant="h4" fontWeight={600} sx={{ mb: 3 }}>
            Organization Settings
          </Typography>
          <Alert
            severity="error"
            action={
              <Button
                color="inherit"
                size="small"
                onClick={fetchSettings}
                startIcon={<RefreshIcon />}
              >
                Retry
              </Button>
            }
          >
            {loadError}
          </Alert>
        </Box>
      </>
    );
  }

  return (
    <>
      <Title title="Organization Settings" />
      <Box sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
          <Typography variant="h4" fontWeight={600}>
            Organization Settings
          </Typography>
          {!isOrgAdmin && (
            <Chip label="View Only" color="warning" size="small" />
          )}
        </Box>

        {!isOrgAdmin && (
          <Alert severity="info" sx={{ mb: 3 }}>
            You can view these settings but only Organization Admins can edit them.
          </Alert>
        )}

        <Grid container spacing={3}>
          {/* Organization Profile Card */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <BusinessIcon sx={{ mr: 1, color: 'primary.main' }} />
                  <Typography variant="h6" fontWeight={600}>
                    Organization Profile
                  </Typography>
                  {orgType && (
                    <Chip label={orgType} size="small" sx={{ ml: 'auto' }} />
                  )}
                </Box>

                {/* Logo Upload */}
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 3, mt: 2 }}>
                  <Avatar
                    src={orgLogo || undefined}
                    sx={{
                      width: 80,
                      height: 80,
                      bgcolor: 'primary.main',
                    }}
                  >
                    <BusinessIcon sx={{ fontSize: '2rem' }} />
                  </Avatar>
                  <Box sx={{ ml: 2 }}>
                    <input
                      accept="image/*"
                      style={{ display: 'none' }}
                      id="logo-upload"
                      type="file"
                      onChange={handleLogoUpload}
                      disabled={!isOrgAdmin}
                    />
                    <label htmlFor="logo-upload">
                      <Button
                        variant="outlined"
                        component="span"
                        startIcon={<PhotoCameraIcon />}
                        disabled={!isOrgAdmin}
                      >
                        Upload Logo
                      </Button>
                    </label>
                    <Typography variant="caption" display="block" sx={{ mt: 1 }} color="text.secondary">
                      Recommended: 512x512px
                    </Typography>
                  </Box>
                </Box>

                <Divider sx={{ my: 2 }} />

                <TextField
                  label="Organization Name"
                  value={orgName}
                  onChange={(e) => handleOrgNameChange(e.target.value)}
                  fullWidth
                  sx={{ mb: 2 }}
                  disabled={!isOrgAdmin}
                />

                <TextField
                  label="Organization Slug"
                  value={orgSlug}
                  onChange={(e) => handleSlugChange(e.target.value)}
                  fullWidth
                  sx={{ mb: 2 }}
                  disabled={!isOrgAdmin}
                  helperText={
                    slugSuggestion
                      ? `Suggested: ${slugSuggestion}`
                      : `Your organization URL: ${window.location.origin}/org/${orgSlug}`
                  }
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Typography variant="body2" color="text.secondary">/org/</Typography>
                      </InputAdornment>
                    ),
                    endAdornment: orgSlug.length >= 3 && (
                      <InputAdornment position="end">
                        {slugChecking ? (
                          <CircularProgress size={20} />
                        ) : slugAvailable === true ? (
                          <CheckCircleIcon color="success" />
                        ) : slugAvailable === false ? (
                          <ErrorIcon color="error" />
                        ) : null}
                      </InputAdornment>
                    ),
                  }}
                  error={slugAvailable === false}
                />

                <TextField
                  label="Email"
                  value={orgEmail}
                  onChange={(e) => handleOrgEmailChange(e.target.value)}
                  fullWidth
                  sx={{ mb: 2 }}
                  disabled={!isOrgAdmin}
                  error={!!orgEmailError}
                  helperText={orgEmailError || 'Primary contact email for your organization'}
                />

                <TextField
                  label="Phone"
                  value={orgPhone}
                  onChange={(e) => setOrgPhone(e.target.value)}
                  fullWidth
                  sx={{ mb: 2 }}
                  disabled={!isOrgAdmin}
                />

                <TextField
                  label="Address"
                  value={orgAddress}
                  onChange={(e) => setOrgAddress(e.target.value)}
                  fullWidth
                  multiline
                  rows={2}
                  sx={{ mb: 2 }}
                  disabled={!isOrgAdmin}
                />

                <Button
                  variant="contained"
                  startIcon={isSavingOrg ? <CircularProgress size={20} color="inherit" /> : <SaveIcon />}
                  onClick={handleSaveOrganization}
                  fullWidth
                  disabled={!isOrgAdmin || isSavingOrg || !!orgEmailError}
                >
                  {isSavingOrg ? 'Saving...' : 'Save Organization'}
                </Button>
              </CardContent>
            </Card>
          </Grid>

          {/* Billing & Subscription Card */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <PaymentIcon sx={{ mr: 1, color: 'primary.main' }} />
                  <Typography variant="h6" fontWeight={600}>
                    Billing & Subscription
                  </Typography>
                </Box>

                <TextField
                  label="Billing Email"
                  value={billingEmail}
                  onChange={(e) => handleBillingEmailChange(e.target.value)}
                  fullWidth
                  sx={{ mb: 2 }}
                  disabled={!isOrgAdmin}
                  error={!!billingEmailError}
                  helperText={billingEmailError || 'Email address for billing notifications and invoices'}
                />

                <Box sx={{ p: 2, bgcolor: 'background.paper', borderRadius: 1, mb: 2 }}>
                  <Typography variant="body2" fontWeight={600} gutterBottom>
                    Organization Type: {orgType || 'Standard'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Manage billing details in the Billing section
                  </Typography>
                </Box>

                <Button
                  variant="outlined"
                  fullWidth
                  disabled={!isOrgAdmin}
                  onClick={() => window.location.href = '/#/billing'}
                >
                  Manage Billing
                </Button>
              </CardContent>
            </Card>

            {/* SSO Configuration Card */}
            <Card sx={{ mt: 3 }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <CloudIcon sx={{ mr: 1, color: 'primary.main' }} />
                  <Typography variant="h6" fontWeight={600}>
                    SSO Configuration
                  </Typography>
                </Box>

                <FormControlLabel
                  control={
                    <Switch
                      checked={ssoEnabled}
                      onChange={(e) => setSsoEnabled(e.target.checked)}
                      disabled={!isOrgAdmin}
                    />
                  }
                  label="Enable SSO/SAML"
                  sx={{ mb: 2, display: 'block' }}
                />

                {ssoEnabled && (
                  <>
                    <FormControl fullWidth sx={{ mb: 2 }}>
                      <InputLabel>SSO Provider</InputLabel>
                      <Select
                        value={ssoProvider}
                        label="SSO Provider"
                        onChange={(e) => setSsoProvider(e.target.value as 'saml' | 'okta' | 'azure' | 'google')}
                        disabled={!isOrgAdmin}
                      >
                        <MenuItem value="saml">SAML 2.0</MenuItem>
                        <MenuItem value="okta">Okta</MenuItem>
                        <MenuItem value="azure">Azure AD</MenuItem>
                        <MenuItem value="google">Google Workspace</MenuItem>
                      </Select>
                    </FormControl>

                    <Alert severity="info" sx={{ fontSize: '0.875rem', mb: 2 }}>
                      Contact support to configure SSO integration
                    </Alert>
                  </>
                )}

                <Button
                  variant="contained"
                  startIcon={isSavingSso ? <CircularProgress size={20} color="inherit" /> : <SaveIcon />}
                  onClick={handleSaveSso}
                  fullWidth
                  disabled={!isOrgAdmin || isSavingSso}
                >
                  {isSavingSso ? 'Saving...' : 'Save SSO Settings'}
                </Button>
              </CardContent>
            </Card>
          </Grid>

          {/* Security Policies Card */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <SecurityIcon sx={{ mr: 1, color: 'primary.main' }} />
                  <Typography variant="h6" fontWeight={600}>
                    Security Policies
                  </Typography>
                </Box>

                <FormControlLabel
                  control={
                    <Switch
                      checked={requireMFA}
                      onChange={(e) => setRequireMFA(e.target.checked)}
                      disabled={!isOrgAdmin}
                    />
                  }
                  label="Require Multi-Factor Authentication (MFA)"
                  sx={{ mb: 2, display: 'block' }}
                />

                <FormControl fullWidth sx={{ mb: 2 }}>
                  <InputLabel>Session Timeout (minutes)</InputLabel>
                  <Select
                    value={sessionTimeout}
                    label="Session Timeout (minutes)"
                    onChange={(e) => setSessionTimeout(Number(e.target.value))}
                    disabled={!isOrgAdmin}
                  >
                    <MenuItem value={15}>15 minutes</MenuItem>
                    <MenuItem value={30}>30 minutes</MenuItem>
                    <MenuItem value={60}>1 hour</MenuItem>
                    <MenuItem value={120}>2 hours</MenuItem>
                    <MenuItem value={240}>4 hours</MenuItem>
                    <MenuItem value={480}>8 hours</MenuItem>
                  </Select>
                </FormControl>

                <FormControl fullWidth sx={{ mb: 2 }}>
                  <InputLabel>Password Policy</InputLabel>
                  <Select
                    value={passwordPolicy}
                    label="Password Policy"
                    onChange={(e) => setPasswordPolicy(e.target.value as 'basic' | 'strong' | 'enterprise')}
                    disabled={!isOrgAdmin}
                  >
                    <MenuItem value="basic">Basic (8 characters)</MenuItem>
                    <MenuItem value="strong">Strong (12 characters + special)</MenuItem>
                    <MenuItem value="enterprise">Enterprise (16 characters + rotation)</MenuItem>
                  </Select>
                </FormControl>

                <Button
                  variant="contained"
                  startIcon={isSavingSecurity ? <CircularProgress size={20} color="inherit" /> : <SaveIcon />}
                  onClick={handleSaveSecurity}
                  fullWidth
                  disabled={!isOrgAdmin || isSavingSecurity}
                >
                  {isSavingSecurity ? 'Saving...' : 'Save Security Settings'}
                </Button>
              </CardContent>
            </Card>
          </Grid>

          {/* API Access & Webhooks Card */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <WebhookIcon sx={{ mr: 1, color: 'primary.main' }} />
                  <Typography variant="h6" fontWeight={600}>
                    API Access & Webhooks
                  </Typography>
                </Box>

                <FormControlLabel
                  control={
                    <Switch
                      checked={apiAccessEnabled}
                      onChange={(e) => setApiAccessEnabled(e.target.checked)}
                      disabled={!isOrgAdmin}
                    />
                  }
                  label="Enable API Access"
                  sx={{ mb: 2, display: 'block' }}
                />

                <FormControlLabel
                  control={
                    <Switch
                      checked={webhooksEnabled}
                      onChange={(e) => setWebhooksEnabled(e.target.checked)}
                      disabled={!isOrgAdmin}
                    />
                  }
                  label="Enable Webhooks"
                  sx={{ mb: 2, display: 'block' }}
                />

                {webhooksEnabled && (
                  <TextField
                    label="Webhook URL"
                    value={webhookUrl}
                    onChange={(e) => setWebhookUrl(e.target.value)}
                    fullWidth
                    sx={{ mb: 2 }}
                    disabled={!isOrgAdmin}
                    placeholder="https://your-server.com/webhook"
                    helperText="URL to receive webhook notifications"
                  />
                )}

                <Button
                  variant="contained"
                  startIcon={isSavingApi ? <CircularProgress size={20} color="inherit" /> : <SaveIcon />}
                  onClick={handleSaveApi}
                  fullWidth
                  disabled={!isOrgAdmin || isSavingApi}
                >
                  {isSavingApi ? 'Saving...' : 'Save API Settings'}
                </Button>
              </CardContent>
            </Card>

            {/* Data Retention Card */}
            <Card sx={{ mt: 3 }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <PolicyIcon sx={{ mr: 1, color: 'primary.main' }} />
                  <Typography variant="h6" fontWeight={600}>
                    Data Retention
                  </Typography>
                </Box>

                <TextField
                  label="Data Retention (days)"
                  type="number"
                  value={dataRetentionDays}
                  onChange={(e) => setDataRetentionDays(Number(e.target.value))}
                  fullWidth
                  sx={{ mb: 2 }}
                  disabled={!isOrgAdmin}
                  helperText="How long to keep BOM and component data (30-3650 days)"
                  inputProps={{ min: 30, max: 3650 }}
                />

                <TextField
                  label="Audit Log Retention (days)"
                  type="number"
                  value={auditLogRetention}
                  onChange={(e) => setAuditLogRetention(Number(e.target.value))}
                  fullWidth
                  sx={{ mb: 2 }}
                  disabled={!isOrgAdmin}
                  helperText="How long to keep audit trail records (30-365 days)"
                  inputProps={{ min: 30, max: 365 }}
                />

                <Button
                  variant="contained"
                  startIcon={isSavingRetention ? <CircularProgress size={20} color="inherit" /> : <SaveIcon />}
                  onClick={handleSaveRetention}
                  fullWidth
                  disabled={!isOrgAdmin || isSavingRetention}
                >
                  {isSavingRetention ? 'Saving...' : 'Save Retention Settings'}
                </Button>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Box>

      {/* Organization Settings Confirmation Dialog */}
      <Dialog
        open={showOrgConfirmDialog}
        onClose={() => setShowOrgConfirmDialog(false)}
        aria-labelledby="org-confirm-dialog-title"
        aria-describedby="org-confirm-dialog-description"
      >
        <DialogTitle id="org-confirm-dialog-title">
          Confirm Organization Settings Update
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="org-confirm-dialog-description">
            You are about to update your organization settings. This will affect all members of your organization.
            <Box component="ul" sx={{ mt: 2, pl: 2 }}>
              <li>Organization Name: <strong>{orgName}</strong></li>
              <li>Organization Slug: <strong>{orgSlug}</strong></li>
              <li>Email: <strong>{orgEmail || '(not set)'}</strong></li>
            </Box>
            Are you sure you want to save these changes?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowOrgConfirmDialog(false)} color="inherit">
            Cancel
          </Button>
          <Button onClick={confirmSaveOrganization} variant="contained" color="primary" autoFocus>
            Confirm & Save
          </Button>
        </DialogActions>
      </Dialog>

      {/* Security Settings Confirmation Dialog */}
      <Dialog
        open={showSecurityConfirmDialog}
        onClose={() => setShowSecurityConfirmDialog(false)}
        aria-labelledby="security-confirm-dialog-title"
        aria-describedby="security-confirm-dialog-description"
      >
        <DialogTitle id="security-confirm-dialog-title">
          Confirm Security Settings Update
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="security-confirm-dialog-description">
            You are about to update your organization's security settings. These changes will affect all users and may impact access policies.
            <Box component="ul" sx={{ mt: 2, pl: 2 }}>
              <li>Require MFA: <strong>{requireMFA ? 'Yes' : 'No'}</strong></li>
              <li>Session Timeout: <strong>{sessionTimeout} minutes</strong></li>
              <li>Password Policy: <strong>{passwordPolicy}</strong></li>
            </Box>
            Are you sure you want to save these changes?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowSecurityConfirmDialog(false)} color="inherit">
            Cancel
          </Button>
          <Button onClick={confirmSaveSecurity} variant="contained" color="primary" autoFocus>
            Confirm & Save
          </Button>
        </DialogActions>
      </Dialog>

      {/* API Settings Confirmation Dialog */}
      <Dialog
        open={showApiConfirmDialog}
        onClose={() => setShowApiConfirmDialog(false)}
      >
        <DialogTitle>Confirm API Settings Update</DialogTitle>
        <DialogContent>
          <DialogContentText>
            You are about to update your API access settings.
            <Box component="ul" sx={{ mt: 2, pl: 2 }}>
              <li>API Access: <strong>{apiAccessEnabled ? 'Enabled' : 'Disabled'}</strong></li>
              <li>Webhooks: <strong>{webhooksEnabled ? 'Enabled' : 'Disabled'}</strong></li>
              {webhooksEnabled && webhookUrl && (
                <li>Webhook URL: <strong>{webhookUrl}</strong></li>
              )}
            </Box>
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowApiConfirmDialog(false)} color="inherit">
            Cancel
          </Button>
          <Button onClick={confirmSaveApi} variant="contained" color="primary" autoFocus>
            Confirm & Save
          </Button>
        </DialogActions>
      </Dialog>

      {/* Data Retention Confirmation Dialog */}
      <Dialog
        open={showRetentionConfirmDialog}
        onClose={() => setShowRetentionConfirmDialog(false)}
      >
        <DialogTitle>Confirm Data Retention Settings</DialogTitle>
        <DialogContent>
          <DialogContentText>
            You are about to update your data retention policies. Reducing retention periods may result in data being permanently deleted.
            <Box component="ul" sx={{ mt: 2, pl: 2 }}>
              <li>Data Retention: <strong>{dataRetentionDays} days</strong></li>
              <li>Audit Log Retention: <strong>{auditLogRetention} days</strong></li>
            </Box>
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowRetentionConfirmDialog(false)} color="inherit">
            Cancel
          </Button>
          <Button onClick={confirmSaveRetention} variant="contained" color="primary" autoFocus>
            Confirm & Save
          </Button>
        </DialogActions>
      </Dialog>

      {/* SSO Settings Confirmation Dialog */}
      <Dialog
        open={showSsoConfirmDialog}
        onClose={() => setShowSsoConfirmDialog(false)}
      >
        <DialogTitle>Confirm SSO Settings Update</DialogTitle>
        <DialogContent>
          <DialogContentText>
            You are about to update your SSO configuration. This may affect how users authenticate to your organization.
            <Box component="ul" sx={{ mt: 2, pl: 2 }}>
              <li>SSO: <strong>{ssoEnabled ? 'Enabled' : 'Disabled'}</strong></li>
              {ssoEnabled && <li>Provider: <strong>{ssoProvider.toUpperCase()}</strong></li>}
            </Box>
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowSsoConfirmDialog(false)} color="inherit">
            Cancel
          </Button>
          <Button onClick={confirmSaveSso} variant="contained" color="primary" autoFocus>
            Confirm & Save
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};
