import React, { useState, useEffect, useRef } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Grid,
  Switch,
  FormControlLabel,
  TextField,
  Button,
  Alert,
  LinearProgress,
  Divider,
  Tabs,
  Tab,
  InputAdornment,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  DialogContentText,
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import RefreshIcon from '@mui/icons-material/Refresh';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import KeyIcon from '@mui/icons-material/Key';
import CloudIcon from '@mui/icons-material/Cloud';
import { CNS_API_URL, getAuthHeaders } from './api';
import { WorkspaceLayout, Panel, GridLayout } from '../layout';
import { PageHeader, ErrorBoundary } from '../components/shared';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`supplier-tabpanel-${index}`}
      aria-labelledby={`supplier-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

interface SupplierConfig {
  enabled: boolean;
  apiKey?: string;
  clientId?: string;
  clientSecret?: string;
  baseUrl?: string;
  rateLimit?: number;
  sandbox?: boolean;
  accessToken?: boolean;
  refreshToken?: boolean;
  tokenExpiresAt?: string;
  redirectUri?: string;
}

interface SupplierConfigs {
  tier1: {
    mouser: SupplierConfig;
    digikey: SupplierConfig;
    element14: SupplierConfig;
  };
  tier2: {
    octopart: SupplierConfig;
    siliconexpert: SupplierConfig;
  };
  tier3: {
    ti: SupplierConfig;
    st: SupplierConfig;
  };
}

const DEFAULT_CONFIGS: SupplierConfigs = {
  tier1: {
    mouser: {
      enabled: true,
      apiKey: '',
      baseUrl: 'https://api.mouser.com/api/v1',
      rateLimit: 100,
    },
    digikey: {
      enabled: true,
      clientId: '',
      clientSecret: '',
      baseUrl: 'https://api.digikey.com',
      rateLimit: 1000,
      sandbox: false,
      accessToken: false,
      refreshToken: false,
      redirectUri: '',
    },
    element14: {
      enabled: true,
      apiKey: '',
      baseUrl: 'https://api.element14.com/catalog/products',
      rateLimit: 50,
    },
  },
  tier2: {
    octopart: {
      enabled: false,
      apiKey: '',
      baseUrl: 'https://octopart.com/api/v4',
    },
    siliconexpert: {
      enabled: false,
      apiKey: '',
      baseUrl: 'https://api.siliconexpert.com',
    },
  },
  tier3: {
    ti: {
      enabled: false,
      apiKey: '',
      baseUrl: 'https://www.ti.com/api',
    },
    st: {
      enabled: false,
      apiKey: '',
      baseUrl: 'https://www.st.com/api',
    },
  },
};

const DIGIKEY_MESSAGE_TYPE = 'DIGIKEY_OAUTH_RESULT';
const DIGIKEY_POPUP_FEATURES = 'width=520,height=720,noopener,noreferrer';
const DIGIKEY_CALLBACK_URL =
  import.meta.env.VITE_DIGIKEY_CALLBACK_URL || 'https://localhost:27500/cns/supplier-apis/digikey/callback';

const buildAdminHeaders = (extra?: Record<string, string>) => {
  const headersInit = getAuthHeaders();
  if (!headersInit) {
    throw new Error(
      'Authentication token missing. Please sign in to use DigiKey OAuth actions.'
    );
  }
  const headers = new Headers(headersInit);
  if (extra) {
    Object.entries(extra).forEach(([key, value]) => headers.set(key, value));
  }
  return headers;
};

export const SupplierAPIsConfig: React.FC = () => {
  const [tabValue, setTabValue] = useState(0);
  const [configs, setConfigs] = useState<SupplierConfigs>(DEFAULT_CONFIGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [showPasswords, setShowPasswords] = useState<{ [key: string]: boolean }>({});
  const [oauthDialogOpen, setOauthDialogOpen] = useState(false);
  const [oauthUrl, setOauthUrl] = useState('');
  const [oauthCode, setOauthCode] = useState('');
  const [oauthProcessing, setOauthProcessing] = useState(false);
  const [autoAuthActive, setAutoAuthActive] = useState(false);
  const oauthPopupRef = useRef<Window | null>(null);

  useEffect(() => {
    loadSupplierConfigs();
  }, []);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (!event.data || event.data.type !== DIGIKEY_MESSAGE_TYPE) return;

      const sameOrigin =
        event.origin === window.location.origin ||
        event.origin.replace('https://', 'http://') === window.location.origin ||
        event.origin.replace('http://', 'https://') === window.location.origin;
      if (!sameOrigin) {
        console.warn('[DigiKey OAuth] Ignoring message from unexpected origin:', event.origin);
        return;
      }

      if (oauthPopupRef.current && !oauthPopupRef.current.closed) {
        oauthPopupRef.current.close();
      }
      oauthPopupRef.current = null;

      setAutoAuthActive(false);
      setOauthProcessing(false);

      if (event.data.status === 'success') {
        const payload = event.data.payload ?? {};
        const expiresAt = payload.expiresAt as string | undefined;
        setConfigs(prev => ({
          ...prev,
          tier1: {
            ...prev.tier1,
            digikey: {
              ...prev.tier1.digikey,
              accessToken: true,
              refreshToken: true,
              tokenExpiresAt: expiresAt || prev.tier1.digikey.tokenExpiresAt,
            },
          },
        }));
        setSuccess(true);
        setOauthDialogOpen(false);
        setOauthCode('');
      } else {
        setError(event.data.error || 'DigiKey authorization failed. Try again or use manual code entry.');
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const loadSupplierConfigs = async () => {
    setLoading(true);
    setError(null);

    try {
      const headers = getAuthHeaders();
      const response = await fetch(`${CNS_API_URL}/suppliers/config`, {
        headers: headers ? new Headers(headers) : undefined,
      });
      if (response.ok) {
        const data = await response.json();
        setConfigs(data);
      } else {
        setError(`Failed to load configuration: ${response.status} ${response.statusText}`);
      }
    } catch (err) {
      console.error('Failed to load supplier configs:', err);
      setError(err instanceof Error ? err.message : 'Failed to load configuration');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const headers = buildAdminHeaders({ 'Content-Type': 'application/json' });
      const response = await fetch(`${CNS_API_URL}/suppliers/config`, {
        method: 'POST',
        headers,
        body: JSON.stringify(configs),
      });

      if (!response.ok) {
        throw new Error('Failed to save supplier configuration');
      }

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  const toggleShowPassword = (field: string) => {
    setShowPasswords(prev => ({ ...prev, [field]: !prev[field] }));
  };

  const handleDigikeyOAuthStart = async () => {
    try {
      const headers = buildAdminHeaders();
      const response = await fetch(`${CNS_API_URL}/suppliers/digikey/oauth/url`, { headers });
      if (!response.ok) throw new Error('Failed to get OAuth URL');

      const data = await response.json();
      setOauthUrl(data.authorization_url);
      setOauthCode('');
      setOauthDialogOpen(true);
      setAutoAuthActive(true);

      if (typeof window !== 'undefined') {
        const popup = window.open(data.authorization_url, 'digikey_oauth', DIGIKEY_POPUP_FEATURES);
        if (popup) {
          oauthPopupRef.current = popup;
          popup.focus();
        } else {
          setError('Popup was blocked. Allow popups or use the manual code entry below.');
          setAutoAuthActive(false);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start OAuth flow');
      setAutoAuthActive(false);
    }
  };

  const handleDigikeyOAuthExchange = async () => {
    if (!oauthCode.trim()) {
      setError('Please enter the authorization code');
      return;
    }

    setAutoAuthActive(false);
    setOauthProcessing(true);
    setError(null);

    try {
      const headers = buildAdminHeaders({ 'Content-Type': 'application/json' });
      const response = await fetch(`${CNS_API_URL}/suppliers/digikey/oauth/token`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ code: oauthCode }),
      });

      if (!response.ok) throw new Error('Failed to exchange OAuth code');

      const data = await response.json();

      // Update DigiKey config with token status (tokens stored server-side)
      setConfigs(prev => ({
        ...prev,
        tier1: {
          ...prev.tier1,
          digikey: {
            ...prev.tier1.digikey,
            accessToken: true,
            refreshToken: true,
            tokenExpiresAt: data.expires_at,
          },
        },
      }));

      setSuccess(true);
      setOauthDialogOpen(false);
      setOauthCode('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to exchange OAuth code');
    } finally {
      setOauthProcessing(false);
    }
  };

  const handleDigikeyRefreshToken = async () => {
    try {
      setAutoAuthActive(false);
      const headers = buildAdminHeaders();
      const response = await fetch(`${CNS_API_URL}/suppliers/digikey/oauth/refresh`, {
        method: 'POST',
        headers,
      });

      if (!response.ok) throw new Error('Failed to refresh token');

      const data = await response.json();
      setConfigs(prev => ({
        ...prev,
        tier1: {
          ...prev.tier1,
          digikey: {
            ...prev.tier1.digikey,
            accessToken: true,
            refreshToken: true,
            tokenExpiresAt: data.expires_at,
          },
        },
      }));

      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh token');
    }
  };

  const handleCloseOAuthDialog = () => {
    if (oauthProcessing) return;
    if (oauthPopupRef.current && !oauthPopupRef.current.closed) {
      oauthPopupRef.current.close();
    }
    oauthPopupRef.current = null;
    setAutoAuthActive(false);
    setOauthDialogOpen(false);
  };

  const renderSupplierField = (
    label: string,
    value: string,
    onChange: (value: string) => void,
    type: 'text' | 'password' = 'text',
    fieldKey?: string
  ) => {
    const isPassword = type === 'password';
    const showPassword = fieldKey ? showPasswords[fieldKey] : false;

    return (
      <TextField
        fullWidth
        label={label}
        type={isPassword && !showPassword ? 'password' : 'text'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        InputProps={isPassword ? {
          endAdornment: (
            <InputAdornment position="end">
              <IconButton
                onClick={() => fieldKey && toggleShowPassword(fieldKey)}
                edge="end"
              >
                {showPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
              </IconButton>
            </InputAdornment>
          ),
        } : {}}
        sx={{ mb: 2 }}
      />
    );
  };

  const isTokenValid = (expiresAt?: string) => {
    if (!expiresAt) return false;
    return new Date(expiresAt) > new Date();
  };

  const getEffectiveRedirectUri = () =>
    configs.tier1.digikey.redirectUri && configs.tier1.digikey.redirectUri.trim().length > 0
      ? configs.tier1.digikey.redirectUri
      : DIGIKEY_CALLBACK_URL;

  const header = (
    <PageHeader
      title="Supplier API Configuration"
      description="Configure API keys and credentials for all supplier tiers (Distributors, Aggregators, OEMs)"
      onRefresh={loadSupplierConfigs}
      refreshing={loading}
    />
  );

  if (loading) {
    return (
      <ErrorBoundary>
        <WorkspaceLayout header={header}>
          <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
            <LinearProgress sx={{ width: '100%' }} />
          </Box>
        </WorkspaceLayout>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <WorkspaceLayout header={header}>
        <Box>
          {error && (
            <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          {success && (
            <Alert severity="success" sx={{ mb: 2 }}>
              Configuration saved successfully!
            </Alert>
          )}

          <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
            <Tabs value={tabValue} onChange={(_e, v) => setTabValue(v)} aria-label="supplier tiers">
              <Tab label="Tier 1: Distributors" />
              <Tab label="Tier 2: Aggregators" />
              <Tab label="Tier 3: OEM Direct" />
            </Tabs>
          </Box>

          {/* Tier 1: Distributors (Mouser, DigiKey, Element14) */}
          <TabPanel value={tabValue} index={0}>
            <GridLayout columns={{ xs: 1, md: 2 }} gap={3}>
              {/* Mouser */}
              <Panel variant="outlined" padding="medium">
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                  <Typography variant="h6">Mouser</Typography>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={configs.tier1.mouser.enabled}
                        onChange={(e) => setConfigs({
                          ...configs,
                          tier1: {
                            ...configs.tier1,
                            mouser: { ...configs.tier1.mouser, enabled: e.target.checked },
                          },
                        })}
                      />
                    }
                    label={configs.tier1.mouser.enabled ? 'Enabled' : 'Disabled'}
                  />
                </Box>
                <Divider sx={{ mb: 2 }} />

                {renderSupplierField(
                  'API Key',
                  configs.tier1.mouser.apiKey || '',
                  (value) => setConfigs({
                    ...configs,
                    tier1: {
                      ...configs.tier1,
                      mouser: { ...configs.tier1.mouser, apiKey: value },
                    },
                  }),
                  'password',
                  'mouser_api_key'
                )}

                {renderSupplierField(
                  'Base URL',
                  configs.tier1.mouser.baseUrl || '',
                  (value) => setConfigs({
                    ...configs,
                    tier1: {
                      ...configs.tier1,
                      mouser: { ...configs.tier1.mouser, baseUrl: value },
                    },
                  })
                )}

                <TextField
                  fullWidth
                  label="Rate Limit (req/min)"
                  type="number"
                  value={configs.tier1.mouser.rateLimit || 100}
                  onChange={(e) => setConfigs({
                    ...configs,
                    tier1: {
                      ...configs.tier1,
                      mouser: { ...configs.tier1.mouser, rateLimit: parseInt(e.target.value) },
                    },
                  })}
                />
              </Panel>

              {/* DigiKey with OAuth */}
              <Panel variant="outlined" padding="medium">
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                  <Typography variant="h6">DigiKey (OAuth2)</Typography>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={configs.tier1.digikey.enabled}
                        onChange={(e) => setConfigs({
                          ...configs,
                          tier1: {
                            ...configs.tier1,
                            digikey: { ...configs.tier1.digikey, enabled: e.target.checked },
                          },
                        })}
                      />
                    }
                    label={configs.tier1.digikey.enabled ? 'Enabled' : 'Disabled'}
                  />
                </Box>
                <Divider sx={{ mb: 2 }} />

                {renderSupplierField(
                  'Client ID',
                  configs.tier1.digikey.clientId || '',
                  (value) => setConfigs({
                    ...configs,
                    tier1: {
                      ...configs.tier1,
                      digikey: { ...configs.tier1.digikey, clientId: value },
                    },
                  })
                )}

                {renderSupplierField(
                  'Client Secret',
                  configs.tier1.digikey.clientSecret || '',
                  (value) => setConfigs({
                    ...configs,
                    tier1: {
                      ...configs.tier1,
                      digikey: { ...configs.tier1.digikey, clientSecret: value },
                    },
                  }),
                  'password',
                  'digikey_client_secret'
                )}

                <FormControlLabel
                  control={
                    <Switch
                      checked={configs.tier1.digikey.sandbox || false}
                      onChange={(e) => setConfigs({
                        ...configs,
                        tier1: {
                          ...configs.tier1,
                          digikey: { ...configs.tier1.digikey, sandbox: e.target.checked },
                        },
                      })}
                    />
                  }
                  label="Use Sandbox (Testing)"
                  sx={{ mb: 2 }}
                />

                {/* OAuth Status */}
                <Box sx={{ mb: 2, p: 2, bgcolor: 'grey.100', borderRadius: 1 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    OAuth Status
                  </Typography>
                  {configs.tier1.digikey.accessToken ? (
                    <Box display="flex" alignItems="center" gap={1}>
                      {isTokenValid(configs.tier1.digikey.tokenExpiresAt) ? (
                        <>
                          <CheckCircleIcon color="success" />
                          <Typography variant="body2" color="success.main">
                            Token Valid
                          </Typography>
                        </>
                      ) : (
                        <>
                          <ErrorIcon color="error" />
                          <Typography variant="body2" color="error.main">
                            Token Expired
                          </Typography>
                        </>
                      )}
                    </Box>
                  ) : (
                    <Typography variant="body2" color="textSecondary">
                      Not authenticated
                    </Typography>
                  )}
                  {configs.tier1.digikey.tokenExpiresAt && (
                    <Typography variant="caption" display="block" mt={1}>
                      Expires: {new Date(configs.tier1.digikey.tokenExpiresAt).toLocaleString()}
                    </Typography>
                  )}
                </Box>

                {/* OAuth Actions */}
                <Box display="flex" gap={1} flexDirection="column">
                  <Button
                    variant="contained"
                    startIcon={<KeyIcon />}
                    onClick={handleDigikeyOAuthStart}
                    fullWidth
                  >
                    Authorize DigiKey
                  </Button>

                  {configs.tier1.digikey.refreshToken && (
                    <Button
                      variant="outlined"
                      startIcon={<RefreshIcon />}
                      onClick={handleDigikeyRefreshToken}
                      fullWidth
                    >
                      Refresh Token
                    </Button>
                  )}
                </Box>
              </Panel>

          {/* Element14 */}
              <Panel variant="outlined" padding="medium">
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                  <Typography variant="h6">Element14</Typography>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={configs.tier1.element14.enabled}
                        onChange={(e) => setConfigs({
                          ...configs,
                          tier1: {
                            ...configs.tier1,
                            element14: { ...configs.tier1.element14, enabled: e.target.checked },
                          },
                        })}
                      />
                    }
                    label={configs.tier1.element14.enabled ? 'Enabled' : 'Disabled'}
                  />
                </Box>
                <Divider sx={{ mb: 2 }} />

                {renderSupplierField(
                  'API Key',
                  configs.tier1.element14.apiKey || '',
                  (value) => setConfigs({
                    ...configs,
                    tier1: {
                      ...configs.tier1,
                      element14: { ...configs.tier1.element14, apiKey: value },
                    },
                  }),
                  'password',
                  'element14_api_key'
                )}

                {renderSupplierField(
                  'Base URL',
                  configs.tier1.element14.baseUrl || '',
                  (value) => setConfigs({
                    ...configs,
                    tier1: {
                      ...configs.tier1,
                      element14: { ...configs.tier1.element14, baseUrl: value },
                    },
                  })
                )}

                <TextField
                  fullWidth
                  label="Rate Limit (req/min)"
                  type="number"
                  value={configs.tier1.element14.rateLimit || 50}
                  onChange={(e) => setConfigs({
                    ...configs,
                    tier1: {
                      ...configs.tier1,
                      element14: { ...configs.tier1.element14, rateLimit: parseInt(e.target.value) },
                    },
                  })}
                />
              </Panel>
            </GridLayout>
          </TabPanel>

          {/* Tier 2: Aggregators (Octopart, SiliconExpert) */}
          <TabPanel value={tabValue} index={1}>
            <GridLayout columns={{ xs: 1, md: 2 }} gap={3}>
          {/* Octopart */}
              <Panel variant="outlined" padding="medium">
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                  <Typography variant="h6">Octopart</Typography>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={configs.tier2.octopart.enabled}
                        onChange={(e) => setConfigs({
                          ...configs,
                          tier2: {
                            ...configs.tier2,
                            octopart: { ...configs.tier2.octopart, enabled: e.target.checked },
                          },
                        })}
                      />
                    }
                    label={configs.tier2.octopart.enabled ? 'Enabled' : 'Disabled'}
                  />
                </Box>
                <Divider sx={{ mb: 2 }} />

                {renderSupplierField(
                  'API Key',
                  configs.tier2.octopart.apiKey || '',
                  (value) => setConfigs({
                    ...configs,
                    tier2: {
                      ...configs.tier2,
                      octopart: { ...configs.tier2.octopart, apiKey: value },
                    },
                  }),
                  'password',
                  'octopart_api_key'
                )}

                {renderSupplierField(
                  'Base URL',
                  configs.tier2.octopart.baseUrl || '',
                  (value) => setConfigs({
                    ...configs,
                    tier2: {
                      ...configs.tier2,
                      octopart: { ...configs.tier2.octopart, baseUrl: value },
                    },
                  })
                )}
              </Panel>

          {/* SiliconExpert */}
              <Panel variant="outlined" padding="medium">
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                  <Typography variant="h6">SiliconExpert</Typography>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={configs.tier2.siliconexpert.enabled}
                        onChange={(e) => setConfigs({
                          ...configs,
                          tier2: {
                            ...configs.tier2,
                            siliconexpert: { ...configs.tier2.siliconexpert, enabled: e.target.checked },
                          },
                        })}
                      />
                    }
                    label={configs.tier2.siliconexpert.enabled ? 'Enabled' : 'Disabled'}
                  />
                </Box>
                <Divider sx={{ mb: 2 }} />

                {renderSupplierField(
                  'API Key',
                  configs.tier2.siliconexpert.apiKey || '',
                  (value) => setConfigs({
                    ...configs,
                    tier2: {
                      ...configs.tier2,
                      siliconexpert: { ...configs.tier2.siliconexpert, apiKey: value },
                    },
                  }),
                  'password',
                  'siliconexpert_api_key'
                )}

                {renderSupplierField(
                  'Base URL',
                  configs.tier2.siliconexpert.baseUrl || '',
                  (value) => setConfigs({
                    ...configs,
                    tier2: {
                      ...configs.tier2,
                      siliconexpert: { ...configs.tier2.siliconexpert, baseUrl: value },
                    },
                  })
                )}
              </Panel>
            </GridLayout>
          </TabPanel>

          {/* Tier 3: OEM Direct (TI, ST) */}
          <TabPanel value={tabValue} index={2}>
            <GridLayout columns={{ xs: 1, md: 2 }} gap={3}>
          {/* Texas Instruments */}
              <Panel variant="outlined" padding="medium">
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                  <Typography variant="h6">Texas Instruments</Typography>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={configs.tier3.ti.enabled}
                        onChange={(e) => setConfigs({
                          ...configs,
                          tier3: {
                            ...configs.tier3,
                            ti: { ...configs.tier3.ti, enabled: e.target.checked },
                          },
                        })}
                      />
                    }
                    label={configs.tier3.ti.enabled ? 'Enabled' : 'Disabled'}
                  />
                </Box>
                <Divider sx={{ mb: 2 }} />

                {renderSupplierField(
                  'API Key',
                  configs.tier3.ti.apiKey || '',
                  (value) => setConfigs({
                    ...configs,
                    tier3: {
                      ...configs.tier3,
                      ti: { ...configs.tier3.ti, apiKey: value },
                    },
                  }),
                  'password',
                  'ti_api_key'
                )}

                {renderSupplierField(
                  'Base URL',
                  configs.tier3.ti.baseUrl || '',
                  (value) => setConfigs({
                    ...configs,
                    tier3: {
                      ...configs.tier3,
                      ti: { ...configs.tier3.ti, baseUrl: value },
                    },
                  })
                )}
              </Panel>

          {/* STMicroelectronics */}
              <Panel variant="outlined" padding="medium">
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                  <Typography variant="h6">STMicroelectronics</Typography>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={configs.tier3.st.enabled}
                        onChange={(e) => setConfigs({
                          ...configs,
                          tier3: {
                            ...configs.tier3,
                            st: { ...configs.tier3.st, enabled: e.target.checked },
                          },
                        })}
                      />
                    }
                    label={configs.tier3.st.enabled ? 'Enabled' : 'Disabled'}
                  />
                </Box>
                <Divider sx={{ mb: 2 }} />

                {renderSupplierField(
                  'API Key',
                  configs.tier3.st.apiKey || '',
                  (value) => setConfigs({
                    ...configs,
                    tier3: {
                      ...configs.tier3,
                      st: { ...configs.tier3.st, apiKey: value },
                    },
                  }),
                  'password',
                  'st_api_key'
                )}

                {renderSupplierField(
                  'Base URL',
                  configs.tier3.st.baseUrl || '',
                  (value) => setConfigs({
                    ...configs,
                    tier3: {
                      ...configs.tier3,
                      st: { ...configs.tier3.st, baseUrl: value },
                    },
                  })
                )}
              </Panel>
            </GridLayout>
          </TabPanel>

      {/* DigiKey OAuth Dialog */}
      <Dialog open={oauthDialogOpen} onClose={handleCloseOAuthDialog} maxWidth="md" fullWidth>
        <DialogTitle>DigiKey OAuth Authorization</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Follow these steps to authorize DigiKey API access. We automatically opened the DigiKey authorization popup—after you approve access, this dialog will update on its own. If the popup was blocked, click "Open" or copy the URL below.
          </DialogContentText>

          {autoAuthActive && (
            <Alert severity="info" sx={{ mt: 2, mb: 2 }}>
              Waiting for DigiKey to redirect back. Once authorization completes, this window will close automatically.
            </Alert>
          )}

          <Box mt={2}>
            <Typography variant="subtitle2" gutterBottom>
              Step 1: Open Authorization URL
            </Typography>
            <TextField
              fullWidth
              value={oauthUrl}
              InputProps={{
                readOnly: true,
                endAdornment: (
                  <InputAdornment position="end">
                    <Button
                      size="small"
                      onClick={() => oauthUrl && window.open(oauthUrl, 'digikey_oauth', DIGIKEY_POPUP_FEATURES)}
                      startIcon={<CloudIcon />}
                    >
                      Open
                    </Button>
                  </InputAdornment>
                ),
              }}
              sx={{ mb: 2 }}
            />

            <Typography variant="subtitle2" gutterBottom>
              Step 2: Approve Access
            </Typography>
            <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
              After approving, you'll be redirected to your configured callback URL (e.g., {getEffectiveRedirectUri()}?code=XXXXXXXXXX).
            </Typography>

            <Typography variant="subtitle2" gutterBottom>
              Step 3: (Fallback) Enter Authorization Code
            </Typography>
            <TextField
              fullWidth
              label="Authorization Code"
              value={oauthCode}
              onChange={(e) => setOauthCode(e.target.value)}
              placeholder="Paste the 'code' parameter from the redirect URL"
              disabled={oauthProcessing}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseOAuthDialog} disabled={oauthProcessing}>
            Cancel
          </Button>
          <Button
            onClick={handleDigikeyOAuthExchange}
            variant="contained"
            disabled={oauthProcessing || !oauthCode.trim()}
          >
            {oauthProcessing ? 'Processing...' : 'Complete Authorization'}
          </Button>
        </DialogActions>
      </Dialog>

          {/* Save Button */}
          <Box mt={3} display="flex" gap={2}>
            <Button
              variant="contained"
              color="primary"
              size="large"
              startIcon={<SaveIcon />}
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? 'Saving...' : 'Save All Configurations'}
            </Button>
          </Box>
        </Box>
      </WorkspaceLayout>
    </ErrorBoundary>
  );
};
