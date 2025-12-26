/**
 * AdminCompliancePanel
 *
 * Security and compliance status display with score.
 */

import React from 'react';
import {
  Card,
  CardContent,
  Box,
  Typography,
  Button,
  Divider,
  Grid,
  Skeleton,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningIcon from '@mui/icons-material/Warning';

export interface ComplianceStatus {
  mfa_enforced: boolean;
  sso_enabled: boolean;
  audit_logs_enabled: boolean;
  data_retention_set: boolean;
  api_security_configured: boolean;
}

interface AdminCompliancePanelProps {
  status: ComplianceStatus | null;
  onConfigure?: () => void;
}

interface ComplianceItemProps {
  label: string;
  enabled: boolean;
  onConfigure?: () => void;
}

function ComplianceItem({ label, enabled, onConfigure }: ComplianceItemProps) {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        py: 1,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        {enabled ? (
          <CheckCircleIcon color="success" fontSize="small" />
        ) : (
          <WarningIcon color="warning" fontSize="small" />
        )}
        <Typography variant="body2">{label}</Typography>
      </Box>
      {!enabled && onConfigure && (
        <Button size="small" onClick={onConfigure}>
          Configure
        </Button>
      )}
    </Box>
  );
}

export function AdminCompliancePanel({
  status,
  onConfigure,
}: AdminCompliancePanelProps) {
  if (!status) {
    return (
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Skeleton variant="rectangular" height={200} />
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Skeleton variant="circular" width={120} height={120} sx={{ mx: 'auto' }} />
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    );
  }

  const enabledCount = Object.values(status).filter(Boolean).length;
  const totalCount = Object.keys(status).length;
  const scorePercent = (enabledCount / totalCount) * 100;

  return (
    <Grid container spacing={3}>
      <Grid item xs={12} md={6}>
        <Card>
          <CardContent>
            <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
              Security & Compliance
            </Typography>
            <Box>
              <ComplianceItem
                label="Multi-Factor Authentication (MFA)"
                enabled={status.mfa_enforced}
                onConfigure={onConfigure}
              />
              <Divider />
              <ComplianceItem
                label="Single Sign-On (SSO)"
                enabled={status.sso_enabled}
                onConfigure={onConfigure}
              />
              <Divider />
              <ComplianceItem
                label="Audit Logging"
                enabled={status.audit_logs_enabled}
              />
              <Divider />
              <ComplianceItem
                label="Data Retention Policy"
                enabled={status.data_retention_set}
                onConfigure={onConfigure}
              />
              <Divider />
              <ComplianceItem
                label="API Security"
                enabled={status.api_security_configured}
                onConfigure={onConfigure}
              />
            </Box>
          </CardContent>
        </Card>
      </Grid>

      <Grid item xs={12} md={6}>
        <Card>
          <CardContent>
            <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
              Compliance Score
            </Typography>
            <Box sx={{ textAlign: 'center', py: 2 }}>
              <Box
                sx={{
                  width: 120,
                  height: 120,
                  borderRadius: '50%',
                  border: '8px solid',
                  borderColor: scorePercent >= 80 ? 'success.main' : 'warning.main',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  mx: 'auto',
                  mb: 2,
                }}
              >
                <Typography variant="h3" fontWeight={700}>
                  {enabledCount}/{totalCount}
                </Typography>
              </Box>
              <Typography variant="body2" color="text.secondary">
                {scorePercent >= 80
                  ? 'Your organization meets security best practices'
                  : 'Consider enabling more security features'}
              </Typography>
              {onConfigure && scorePercent < 100 && (
                <Button variant="outlined" sx={{ mt: 2 }} onClick={onConfigure}>
                  Improve Compliance
                </Button>
              )}
            </Box>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );
}

export default AdminCompliancePanel;
