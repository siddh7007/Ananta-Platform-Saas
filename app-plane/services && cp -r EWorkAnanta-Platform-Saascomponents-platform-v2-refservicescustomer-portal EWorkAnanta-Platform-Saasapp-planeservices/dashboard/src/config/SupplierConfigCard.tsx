/**
 * Supplier Configuration Card Component
 *
 * Reusable card for configuring individual supplier APIs.
 * Handles API keys, OAuth, rate limits, and validation.
 */

import React, { useState } from 'react';
import {
  Card,
  CardContent,
  Box,
  Typography,
  Switch,
  FormControlLabel,
  TextField,
  Button,
  Chip,
  Stack,
  InputAdornment,
  IconButton,
  Collapse,
  Alert,
  CircularProgress,
} from '@mui/material';
import {
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  CheckCircle as ValidIcon,
  Error as InvalidIcon,
  Key as KeyIcon,
  CloudSync as OAuthIcon,
  Settings as SettingsIcon,
  ExpandMore as ExpandIcon,
  ExpandLess as CollapseIcon,
} from '@mui/icons-material';
import { getSupplierColor } from '../theme';

export interface SupplierConfig {
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

export interface SupplierConfigCardProps {
  name: string;
  tier: 'tier1' | 'tier2' | 'tier3';
  config: SupplierConfig;
  onConfigChange: (field: keyof SupplierConfig, value: any) => void;
  onTest?: () => Promise<boolean>;
  onOAuthConnect?: () => void;
  hasOAuth?: boolean;
  description?: string;
}

export const SupplierConfigCard: React.FC<SupplierConfigCardProps> = ({
  name,
  tier,
  config,
  onConfigChange,
  onTest,
  onOAuthConnect,
  hasOAuth = false,
  description,
}) => {
  const [showApiKey, setShowApiKey] = useState(false);
  const [showClientSecret, setShowClientSecret] = useState(false);
  const [expanded, setExpanded] = useState(config.enabled);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<boolean | null>(null);

  const supplierColor = getSupplierColor(name);

  const handleTest = async () => {
    if (!onTest) return;
    setTesting(true);
    setTestResult(null);
    try {
      const success = await onTest();
      setTestResult(success);
    } catch {
      setTestResult(false);
    } finally {
      setTesting(false);
    }
  };

  const getTierLabel = () => {
    switch (tier) {
      case 'tier1':
        return { label: 'Primary', color: 'success' };
      case 'tier2':
        return { label: 'Secondary', color: 'info' };
      case 'tier3':
        return { label: 'Manufacturer', color: 'default' };
    }
  };

  const tierInfo = getTierLabel();

  return (
    <Card
      sx={{
        borderLeft: 4,
        borderLeftColor: config.enabled ? supplierColor : 'grey.300',
        opacity: config.enabled ? 1 : 0.7,
        transition: 'all 0.2s ease',
      }}
    >
      <CardContent sx={{ pb: 2 }}>
        {/* Header */}
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="h6" sx={{ color: supplierColor }}>
              {name}
            </Typography>
            <Chip
              label={tierInfo.label}
              size="small"
              color={tierInfo.color as any}
              variant="outlined"
            />
            {config.enabled && testResult !== null && (
              <Chip
                icon={testResult ? <ValidIcon /> : <InvalidIcon />}
                label={testResult ? 'Valid' : 'Invalid'}
                size="small"
                color={testResult ? 'success' : 'error'}
              />
            )}
          </Stack>
          <Stack direction="row" spacing={1} alignItems="center">
            <FormControlLabel
              control={
                <Switch
                  checked={config.enabled}
                  onChange={(e) => onConfigChange('enabled', e.target.checked)}
                  color="primary"
                />
              }
              label={config.enabled ? 'Enabled' : 'Disabled'}
              labelPlacement="start"
            />
            <IconButton size="small" onClick={() => setExpanded(!expanded)}>
              {expanded ? <CollapseIcon /> : <ExpandIcon />}
            </IconButton>
          </Stack>
        </Stack>

        {description && (
          <Typography variant="body2" color="text.secondary" mb={2}>
            {description}
          </Typography>
        )}

        {/* Expandable Config */}
        <Collapse in={expanded && config.enabled}>
          <Box mt={2}>
            {/* API Key (for non-OAuth suppliers) */}
            {!hasOAuth && (
              <TextField
                fullWidth
                label="API Key"
                type={showApiKey ? 'text' : 'password'}
                value={config.apiKey || ''}
                onChange={(e) => onConfigChange('apiKey', e.target.value)}
                margin="normal"
                size="small"
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <KeyIcon fontSize="small" />
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        size="small"
                        onClick={() => setShowApiKey(!showApiKey)}
                        edge="end"
                      >
                        {showApiKey ? <VisibilityOffIcon /> : <VisibilityIcon />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
            )}

            {/* OAuth Config (for DigiKey etc.) */}
            {hasOAuth && (
              <>
                <TextField
                  fullWidth
                  label="Client ID"
                  value={config.clientId || ''}
                  onChange={(e) => onConfigChange('clientId', e.target.value)}
                  margin="normal"
                  size="small"
                />
                <TextField
                  fullWidth
                  label="Client Secret"
                  type={showClientSecret ? 'text' : 'password'}
                  value={config.clientSecret || ''}
                  onChange={(e) => onConfigChange('clientSecret', e.target.value)}
                  margin="normal"
                  size="small"
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          size="small"
                          onClick={() => setShowClientSecret(!showClientSecret)}
                          edge="end"
                        >
                          {showClientSecret ? <VisibilityOffIcon /> : <VisibilityIcon />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />

                {/* OAuth Status */}
                {config.accessToken && (
                  <Alert severity="success" sx={{ mt: 2 }}>
                    OAuth Connected
                    {config.tokenExpiresAt && (
                      <Typography variant="caption" display="block">
                        Expires: {new Date(config.tokenExpiresAt).toLocaleString()}
                      </Typography>
                    )}
                  </Alert>
                )}

                {onOAuthConnect && (
                  <Button
                    variant="outlined"
                    startIcon={<OAuthIcon />}
                    onClick={onOAuthConnect}
                    sx={{ mt: 2 }}
                    fullWidth
                  >
                    {config.accessToken ? 'Reconnect OAuth' : 'Connect OAuth'}
                  </Button>
                )}
              </>
            )}

            {/* Rate Limit */}
            <TextField
              fullWidth
              label="Rate Limit (requests/day)"
              type="number"
              value={config.rateLimit || ''}
              onChange={(e) => onConfigChange('rateLimit', parseInt(e.target.value) || 0)}
              margin="normal"
              size="small"
            />

            {/* Test Button */}
            {onTest && (
              <Button
                variant="contained"
                onClick={handleTest}
                disabled={testing}
                startIcon={testing ? <CircularProgress size={16} /> : <SettingsIcon />}
                sx={{ mt: 2 }}
              >
                {testing ? 'Testing...' : 'Test Connection'}
              </Button>
            )}
          </Box>
        </Collapse>
      </CardContent>
    </Card>
  );
};

export default SupplierConfigCard;
