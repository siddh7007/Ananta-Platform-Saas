/**
 * Admin Console - Organization Governance Dashboard
 *
 * Step 8 from PROMPT_CLAUDE.md:
 * - Usage metrics (BOM count, alert volume, API calls)
 * - Plan limits and current usage
 * - Billing alerts and subscription status
 * - Pending invites management
 * - Audit logs (recent activity)
 * - Compliance flags
 * - Risk health summary
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  LinearProgress,
  Chip,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Avatar,
  IconButton,
  Tooltip,
  Alert,
  Divider,
  Skeleton,
  Tab,
  Tabs,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';

// Icons
import DashboardIcon from '@mui/icons-material/Dashboard';
import PeopleIcon from '@mui/icons-material/People';
import ReceiptIcon from '@mui/icons-material/Receipt';
import HistoryIcon from '@mui/icons-material/History';
import SecurityIcon from '@mui/icons-material/Security';
import WarningIcon from '@mui/icons-material/Warning';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RefreshIcon from '@mui/icons-material/Refresh';
import SettingsIcon from '@mui/icons-material/Settings';
import MailIcon from '@mui/icons-material/Mail';
import CancelIcon from '@mui/icons-material/Cancel';
import BusinessIcon from '@mui/icons-material/Business';
import StorageIcon from '@mui/icons-material/Storage';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';

// Context and Services
import { useOrganization } from '../contexts/OrganizationContext';
import { organizationService, AuditLogEntry as ServiceAuditLogEntry } from '../services/organizationService';
import { organizationsApi, UsageMetrics as ApiUsageMetrics, PendingInvitation } from '../services/organizationsApi';

// =====================================================
// Types
// =====================================================

interface UsageMetrics {
  bom_count: number;
  bom_limit: number;
  project_count: number;
  project_limit: number;
  member_count: number;
  member_limit: number;
  api_calls_this_month: number;
  api_calls_limit: number;
  storage_used_mb: number;
  storage_limit_mb: number;
  alerts_this_month: number;
  pending_invitations: number;
}

interface PendingInvite {
  id: string;
  email: string;
  role: string;
  invited_at: string;
  invited_by: string;
  expires_at: string;
}

// Map API response to local UsageMetrics format
const mapApiMetrics = (api: ApiUsageMetrics): UsageMetrics => ({
  bom_count: api.bom_count,
  bom_limit: api.limits.max_boms === -1 ? 999999 : api.limits.max_boms,
  project_count: api.project_count,
  project_limit: api.limits.max_projects === -1 ? 999999 : api.limits.max_projects,
  member_count: api.member_count,
  member_limit: api.limits.max_members === -1 ? 999999 : api.limits.max_members,
  api_calls_this_month: api.api_calls_30d,
  api_calls_limit: 50000, // Default API limit
  storage_used_mb: api.storage_mb,
  storage_limit_mb: api.limits.storage_mb === -1 ? 999999 : api.limits.storage_mb,
  alerts_this_month: 0, // TODO: Get from alerts API
  pending_invitations: api.pending_invitations,
});

// Map API invitation to local format
const mapApiInvitation = (api: PendingInvitation): PendingInvite => ({
  id: api.id,
  email: api.email,
  role: api.role,
  invited_at: api.created_at,
  invited_by: api.invited_by_email || 'Unknown',
  expires_at: api.expires_at,
});

interface AuditLogEntry {
  id: string;
  action: string;
  actor_email: string;
  target_type: string;
  target_id: string;
  details: string;
  created_at: string;
}

interface ComplianceStatus {
  mfa_enforced: boolean;
  sso_enabled: boolean;
  audit_logs_enabled: boolean;
  data_retention_set: boolean;
  api_security_configured: boolean;
}

interface RiskSummary {
  high_risk_components: number;
  medium_risk_components: number;
  unresolved_alerts: number;
  risk_score_trend: 'up' | 'down' | 'stable';
}

// =====================================================
// Helpers
// =====================================================

const formatDate = (dateStr: string): string => {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatRelativeTime = (dateStr: string): string => {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
};

const getUsageColor = (used: number, limit: number): 'success' | 'warning' | 'error' => {
  const percentage = (used / limit) * 100;
  if (percentage >= 90) return 'error';
  if (percentage >= 70) return 'warning';
  return 'success';
};

// =====================================================
// Sub-Components
// =====================================================

interface MetricCardProps {
  title: string;
  value: number;
  limit: number;
  unit?: string;
  icon: React.ReactNode;
}

const MetricCard: React.FC<MetricCardProps> = ({ title, value, limit, unit = '', icon }) => {
  const percentage = Math.min(100, (value / limit) * 100);
  const color = getUsageColor(value, limit);

  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <Box sx={{ color: `${color}.main`, mr: 1 }}>{icon}</Box>
          <Typography variant="subtitle2" color="text.secondary">
            {title}
          </Typography>
        </Box>
        <Typography variant="h4" fontWeight={700}>
          {value.toLocaleString()}
          {unit && <Typography component="span" variant="body2" color="text.secondary"> {unit}</Typography>}
        </Typography>
        <Box sx={{ mt: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
            <Typography variant="caption" color="text.secondary">
              {percentage.toFixed(0)}% of {limit.toLocaleString()} {unit}
            </Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={percentage}
            color={color}
            sx={{ height: 6, borderRadius: 3 }}
          />
        </Box>
      </CardContent>
    </Card>
  );
};

interface ComplianceItemProps {
  label: string;
  enabled: boolean;
  onConfigure?: () => void;
}

const ComplianceItem: React.FC<ComplianceItemProps> = ({ label, enabled, onConfigure }) => (
  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 1 }}>
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

// =====================================================
// Main Component
// =====================================================

export function AdminConsole() {
  const navigate = useNavigate();
  const { currentOrg, permissions } = useOrganization();

  // State
  const [activeTab, setActiveTab] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Data
  const [metrics, setMetrics] = useState<UsageMetrics | null>(null);
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [compliance, setCompliance] = useState<ComplianceStatus | null>(null);
  const [riskSummary, setRiskSummary] = useState<RiskSummary | null>(null);

  // Fetch data
  useEffect(() => {
    const fetchData = async () => {
      if (!currentOrg) return;

      setIsLoading(true);
      setError(null);

      try {
        // Fetch usage metrics from backend
        const usageMetrics = await organizationsApi.getUsageMetrics(currentOrg.id);
        setMetrics(mapApiMetrics(usageMetrics));

        // Fetch pending invitations from backend
        const invitationsResponse = await organizationsApi.getPendingInvitations(currentOrg.id);
        setPendingInvites(invitationsResponse.items.map(mapApiInvitation));

        // Fetch organization settings for compliance status
        const settingsResponse = await organizationService.getSettings();

        // Fetch audit logs
        const auditResponse = await organizationService.getAuditLog(20, 0);

        // Build compliance status from settings
        const complianceStatus: ComplianceStatus = {
          mfa_enforced: settingsResponse.security?.require_mfa || false,
          sso_enabled: settingsResponse.sso?.sso_enabled || false,
          audit_logs_enabled: true,
          data_retention_set: (settingsResponse.data_retention?.data_retention_days || 0) > 0,
          api_security_configured: settingsResponse.api?.api_access_enabled || false,
        };

        // Risk summary (TODO: fetch from risk API when available)
        const riskSummaryData: RiskSummary = {
          high_risk_components: 0,
          medium_risk_components: 0,
          unresolved_alerts: 0,
          risk_score_trend: 'stable',
        };

        // Map service audit logs to our local format
        const mappedAuditLogs: AuditLogEntry[] = (auditResponse.entries || []).map((entry: ServiceAuditLogEntry) => ({
          id: entry.id,
          action: entry.setting_name || 'SETTING_CHANGED',
          actor_email: entry.changed_by || 'System',
          target_type: 'setting',
          target_id: entry.setting_name || '',
          details: entry.old_value && entry.new_value
            ? `Changed from "${entry.old_value}" to "${entry.new_value}"`
            : entry.new_value
              ? `Set to "${entry.new_value}"`
              : '',
          created_at: entry.changed_at || new Date().toISOString(),
        }));

        setAuditLogs(mappedAuditLogs);
        setCompliance(complianceStatus);
        setRiskSummary(riskSummaryData);
      } catch (err) {
        console.error('Failed to fetch admin console data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [currentOrg]);

  // Handle invite actions
  const handleResendInvite = async (inviteId: string) => {
    // Get the invite email to resend
    const invite = pendingInvites.find(i => i.id === inviteId);
    if (!invite || !currentOrg) return;

    try {
      // Resend by creating a new invitation (the backend handles upsert)
      await organizationsApi.inviteMember(currentOrg.id, {
        email: invite.email,
        role: invite.role as 'admin' | 'engineer' | 'analyst' | 'viewer',
      });
      // Refresh invites list
      const invitationsResponse = await organizationsApi.getPendingInvitations(currentOrg.id);
      setPendingInvites(invitationsResponse.items.map(mapApiInvitation));
    } catch (err) {
      console.error('Failed to resend invite:', err);
      setError(err instanceof Error ? err.message : 'Failed to resend invitation');
    }
  };

  const handleCancelInvite = async (inviteId: string) => {
    if (!currentOrg) return;

    try {
      await organizationsApi.revokeInvitation(currentOrg.id, inviteId);
      // Remove from local state
      setPendingInvites(prev => prev.filter(i => i.id !== inviteId));
    } catch (err) {
      console.error('Failed to cancel invite:', err);
      setError(err instanceof Error ? err.message : 'Failed to cancel invitation');
    }
  };

  // Permission check
  if (!permissions.canEditOrg) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="warning">
          You don't have permission to access the Admin Console.
          Please contact your organization administrator.
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <DashboardIcon color="primary" sx={{ fontSize: 32 }} />
          <Box>
            <Typography variant="h5" fontWeight={700}>
              Admin Console
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {currentOrg?.name} • Organization overview and governance
            </Typography>
          </Box>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Tooltip title="Refresh">
            <IconButton onClick={() => window.location.reload()}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          <Button
            variant="outlined"
            startIcon={<SettingsIcon />}
            onClick={() => navigate('/admin/organization-settings')}
          >
            Settings
          </Button>
        </Box>
      </Box>

      {/* Error State */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)} sx={{ mb: 3 }}>
        <Tab icon={<TrendingUpIcon />} label="Usage & Metrics" />
        <Tab icon={<PeopleIcon />} label={`Invites (${pendingInvites.length})`} />
        <Tab icon={<HistoryIcon />} label="Audit Log" />
        <Tab icon={<SecurityIcon />} label="Compliance" />
      </Tabs>

      {/* Tab: Usage & Metrics */}
      {activeTab === 0 && (
        <Box>
          {/* Metrics Grid */}
          <Grid container spacing={3} sx={{ mb: 4 }}>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <Grid item xs={12} sm={6} md={4} lg={2.4} key={i}>
                  <Card>
                    <CardContent>
                      <Skeleton variant="text" width={80} />
                      <Skeleton variant="text" width={60} height={40} />
                      <Skeleton variant="rectangular" height={6} sx={{ mt: 2 }} />
                    </CardContent>
                  </Card>
                </Grid>
              ))
            ) : metrics && (
              <>
                <Grid item xs={12} sm={6} md={4} lg={2.4}>
                  <MetricCard
                    title="BOMs"
                    value={metrics.bom_count}
                    limit={metrics.bom_limit}
                    icon={<StorageIcon />}
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={4} lg={2.4}>
                  <MetricCard
                    title="Projects"
                    value={metrics.project_count}
                    limit={metrics.project_limit}
                    icon={<BusinessIcon />}
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={4} lg={2.4}>
                  <MetricCard
                    title="Members"
                    value={metrics.member_count}
                    limit={metrics.member_limit}
                    icon={<PeopleIcon />}
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={4} lg={2.4}>
                  <MetricCard
                    title="API Calls"
                    value={metrics.api_calls_this_month}
                    limit={metrics.api_calls_limit}
                    icon={<TrendingUpIcon />}
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={4} lg={2.4}>
                  <MetricCard
                    title="Storage"
                    value={metrics.storage_used_mb}
                    limit={metrics.storage_limit_mb}
                    unit="MB"
                    icon={<StorageIcon />}
                  />
                </Grid>
              </>
            )}
          </Grid>

          {/* Risk Summary */}
          {riskSummary && (
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <SecurityIcon color="primary" />
                  <Typography variant="h6" fontWeight={600}>
                    Risk Health
                  </Typography>
                  {riskSummary.risk_score_trend === 'down' && (
                    <Chip
                      icon={<TrendingDownIcon />}
                      label="Improving"
                      color="success"
                      size="small"
                    />
                  )}
                  {riskSummary.risk_score_trend === 'up' && (
                    <Chip
                      icon={<TrendingUpIcon />}
                      label="Increasing"
                      color="error"
                      size="small"
                    />
                  )}
                </Box>
                <Grid container spacing={2}>
                  <Grid item xs={4}>
                    <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'error.50', borderRadius: 2 }}>
                      <Typography variant="h4" color="error.main" fontWeight={700}>
                        {riskSummary.high_risk_components}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        High Risk Components
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={4}>
                    <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'warning.50', borderRadius: 2 }}>
                      <Typography variant="h4" color="warning.main" fontWeight={700}>
                        {riskSummary.medium_risk_components}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Medium Risk Components
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={4}>
                    <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'info.50', borderRadius: 2 }}>
                      <Typography variant="h4" color="info.main" fontWeight={700}>
                        {riskSummary.unresolved_alerts}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Unresolved Alerts
                      </Typography>
                    </Box>
                  </Grid>
                </Grid>
                <Box sx={{ mt: 2, textAlign: 'right' }}>
                  <Button
                    variant="text"
                    onClick={() => navigate('/risk')}
                    endIcon={<SecurityIcon />}
                  >
                    View Risk Dashboard
                  </Button>
                </Box>
              </CardContent>
            </Card>
          )}
        </Box>
      )}

      {/* Tab: Pending Invites */}
      {activeTab === 1 && (
        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
              <Typography variant="h6" fontWeight={600}>
                Pending Invitations
              </Typography>
              <Button
                variant="contained"
                startIcon={<PeopleIcon />}
                onClick={() => navigate('/admin/organization-settings')}
              >
                Invite Member
              </Button>
            </Box>

            {pendingInvites.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <MailIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
                <Typography color="text.secondary">
                  No pending invitations
                </Typography>
              </Box>
            ) : (
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Email</TableCell>
                      <TableCell>Role</TableCell>
                      <TableCell>Invited By</TableCell>
                      <TableCell>Invited</TableCell>
                      <TableCell>Expires</TableCell>
                      <TableCell align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {pendingInvites.map((invite) => (
                      <TableRow key={invite.id}>
                        <TableCell>{invite.email}</TableCell>
                        <TableCell>
                          <Chip label={invite.role} size="small" />
                        </TableCell>
                        <TableCell>{invite.invited_by}</TableCell>
                        <TableCell>{formatRelativeTime(invite.invited_at)}</TableCell>
                        <TableCell>{formatDate(invite.expires_at)}</TableCell>
                        <TableCell align="right">
                          <Tooltip title="Resend Invite">
                            <IconButton
                              size="small"
                              onClick={() => handleResendInvite(invite.id)}
                            >
                              <MailIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Cancel Invite">
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => handleCancelInvite(invite.id)}
                            >
                              <CancelIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tab: Audit Log */}
      {activeTab === 2 && (
        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
              <Typography variant="h6" fontWeight={600}>
                Recent Activity
              </Typography>
              <Button variant="text" size="small">
                Export Logs
              </Button>
            </Box>

            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 1 }}>
                  <Skeleton variant="circular" width={32} height={32} />
                  <Box sx={{ flex: 1 }}>
                    <Skeleton variant="text" width="60%" />
                    <Skeleton variant="text" width="40%" />
                  </Box>
                </Box>
              ))
            ) : auditLogs.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <HistoryIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
                <Typography color="text.secondary">
                  No audit log entries yet
                </Typography>
              </Box>
            ) : (
              <Box>
                {auditLogs.map((log, index) => (
                  <Box key={log.id}>
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, py: 1.5 }}>
                      <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.100' }}>
                        <HistoryIcon sx={{ fontSize: 16, color: 'primary.main' }} />
                      </Avatar>
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="body2">
                          <strong>{log.actor_email || 'System'}</strong>{' '}
                          {log.action.toLowerCase().replace(/_/g, ' ')}{' '}
                          {log.target_type && <span>on {log.target_type}</span>}
                        </Typography>
                        {log.details && (
                          <Typography variant="caption" color="text.secondary">
                            {log.details}
                          </Typography>
                        )}
                        <Typography variant="caption" color="text.disabled" sx={{ display: 'block' }}>
                          {formatRelativeTime(log.created_at)}
                        </Typography>
                      </Box>
                    </Box>
                    {index < auditLogs.length - 1 && <Divider />}
                  </Box>
                ))}
              </Box>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tab: Compliance */}
      {activeTab === 3 && (
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
                  Security & Compliance
                </Typography>
                {compliance ? (
                  <Box>
                    <ComplianceItem
                      label="Multi-Factor Authentication (MFA)"
                      enabled={compliance.mfa_enforced}
                      onConfigure={() => navigate('/admin/organization-settings')}
                    />
                    <Divider />
                    <ComplianceItem
                      label="Single Sign-On (SSO)"
                      enabled={compliance.sso_enabled}
                      onConfigure={() => navigate('/admin/organization-settings')}
                    />
                    <Divider />
                    <ComplianceItem
                      label="Audit Logging"
                      enabled={compliance.audit_logs_enabled}
                    />
                    <Divider />
                    <ComplianceItem
                      label="Data Retention Policy"
                      enabled={compliance.data_retention_set}
                      onConfigure={() => navigate('/admin/organization-settings')}
                    />
                    <Divider />
                    <ComplianceItem
                      label="API Security"
                      enabled={compliance.api_security_configured}
                      onConfigure={() => navigate('/admin/organization-settings')}
                    />
                  </Box>
                ) : (
                  <Skeleton variant="rectangular" height={200} />
                )}
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
                  Compliance Score
                </Typography>
                {compliance && (
                  <Box sx={{ textAlign: 'center', py: 2 }}>
                    <Box
                      sx={{
                        width: 120,
                        height: 120,
                        borderRadius: '50%',
                        border: '8px solid',
                        borderColor: Object.values(compliance).filter(Boolean).length >= 4
                          ? 'success.main'
                          : 'warning.main',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        mx: 'auto',
                        mb: 2,
                      }}
                    >
                      <Typography variant="h3" fontWeight={700}>
                        {Object.values(compliance).filter(Boolean).length}/{Object.keys(compliance).length}
                      </Typography>
                    </Box>
                    <Typography variant="body2" color="text.secondary">
                      {Object.values(compliance).filter(Boolean).length >= 4
                        ? 'Your organization meets security best practices'
                        : 'Consider enabling more security features'}
                    </Typography>
                    <Button
                      variant="outlined"
                      sx={{ mt: 2 }}
                      onClick={() => navigate('/admin/organization-settings')}
                    >
                      Improve Compliance
                    </Button>
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}
    </Box>
  );
}

export default AdminConsole;
