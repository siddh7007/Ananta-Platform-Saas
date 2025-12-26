/**
 * Billing & Subscription Page
 *
 * Allows users to:
 * - View current subscription status and plan
 * - Upgrade/downgrade subscription plans
 * - Access Stripe billing portal for payment management
 * - View payment history and invoices
 *
 * Admin-only features:
 * - Change subscription plan
 * - Update billing information
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Title, useNotify, useGetIdentity } from 'react-admin';
import {
  Card,
  CardContent,
  CardHeader,
  CardActions,
  Grid,
  Typography,
  Box,
  Button,
  Chip,
  CircularProgress,
  Alert,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Skeleton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  IconButton,
} from '@mui/material';
import {
  CreditCard,
  CheckCircle,
  Warning,
  Cancel,
  Upgrade,
  Receipt,
  OpenInNew,
  Download,
  Star,
  Business,
  Speed,
  Support,
  Security,
  Api,
  Analytics,
  Groups,
  Folder,
  Refresh,
} from '@mui/icons-material';

import {
  stripeApiService,
  isStripeConfigured,
  BillingInfo,
  PlanFeatures,
  InvoiceInfo,
  PlanTier,
  SubscriptionStatus,
  formatCurrency,
  formatDate,
  getPlanDisplayName,
  getStatusColor,
  getStatusDisplayText,
  canUpgrade,
} from '../services/stripeService';

// Plan card component
interface PlanCardProps {
  plan: PlanFeatures;
  isCurrentPlan: boolean;
  currentTier: PlanTier;
  onSelect: (tier: PlanTier) => void;
  loading: boolean;
  isAdmin: boolean;
}

const PlanCard: React.FC<PlanCardProps> = ({
  plan,
  isCurrentPlan,
  currentTier,
  onSelect,
  loading,
  isAdmin,
}) => {
  const isUpgrade = canUpgrade(currentTier, plan.plan_tier);
  const isEnterprise = plan.plan_tier === 'enterprise';
  const isFree = plan.plan_tier === 'free';

  const getFeatureIcon = (enabled: boolean) =>
    enabled ? (
      <CheckCircle fontSize="small" color="success" />
    ) : (
      <Cancel fontSize="small" color="disabled" />
    );

  const formatLimit = (limit: number) => (limit === -1 ? 'Unlimited' : limit.toLocaleString());

  return (
    <Card
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        border: isCurrentPlan ? '2px solid' : '1px solid',
        borderColor: isCurrentPlan ? 'primary.main' : 'divider',
        position: 'relative',
      }}
    >
      {isCurrentPlan && (
        <Chip
          label="Current Plan"
          color="primary"
          size="small"
          sx={{
            position: 'absolute',
            top: 8,
            right: 8,
          }}
        />
      )}

      <CardHeader
        title={
          <Box display="flex" alignItems="center" gap={1}>
            {plan.plan_tier === 'enterprise' && <Star color="warning" />}
            {getPlanDisplayName(plan.plan_tier)}
          </Box>
        }
        subheader={
          <Typography variant="h4" component="span" color="text.primary">
            {formatCurrency(plan.display_price_cents)}
            {plan.display_price_cents !== null && (
              <Typography variant="body2" component="span" color="text.secondary">
                /{plan.display_price_interval}
              </Typography>
            )}
          </Typography>
        }
      />

      <CardContent sx={{ flexGrow: 1 }}>
        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
          Usage Limits
        </Typography>
        <List dense>
          <ListItem disablePadding>
            <ListItemIcon sx={{ minWidth: 36 }}>
              <Folder fontSize="small" />
            </ListItemIcon>
            <ListItemText primary={`${formatLimit(plan.monthly_bom_uploads)} BOM uploads/mo`} />
          </ListItem>
          <ListItem disablePadding>
            <ListItemIcon sx={{ minWidth: 36 }}>
              <Speed fontSize="small" />
            </ListItemIcon>
            <ListItemText primary={`${formatLimit(plan.monthly_enrichments)} enrichments/mo`} />
          </ListItem>
          <ListItem disablePadding>
            <ListItemIcon sx={{ minWidth: 36 }}>
              <Api fontSize="small" />
            </ListItemIcon>
            <ListItemText primary={`${formatLimit(plan.monthly_api_calls)} API calls/mo`} />
          </ListItem>
          <ListItem disablePadding>
            <ListItemIcon sx={{ minWidth: 36 }}>
              <Groups fontSize="small" />
            </ListItemIcon>
            <ListItemText primary={`${formatLimit(plan.max_team_members)} team members`} />
          </ListItem>
        </List>

        <Divider sx={{ my: 1 }} />

        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
          Features
        </Typography>
        <List dense>
          <ListItem disablePadding>
            <ListItemIcon sx={{ minWidth: 36 }}>{getFeatureIcon(plan.api_access)}</ListItemIcon>
            <ListItemText primary="API Access" />
          </ListItem>
          <ListItem disablePadding>
            <ListItemIcon sx={{ minWidth: 36 }}>
              {getFeatureIcon(plan.priority_support)}
            </ListItemIcon>
            <ListItemText primary="Priority Support" />
          </ListItem>
          <ListItem disablePadding>
            <ListItemIcon sx={{ minWidth: 36 }}>{getFeatureIcon(plan.audit_logs)}</ListItemIcon>
            <ListItemText primary="Audit Logs" />
          </ListItem>
          <ListItem disablePadding>
            <ListItemIcon sx={{ minWidth: 36 }}>
              {getFeatureIcon(plan.advanced_analytics)}
            </ListItemIcon>
            <ListItemText primary="Advanced Analytics" />
          </ListItem>
          <ListItem disablePadding>
            <ListItemIcon sx={{ minWidth: 36 }}>{getFeatureIcon(plan.sso_enabled)}</ListItemIcon>
            <ListItemText primary="SSO/SAML" />
          </ListItem>
        </List>
      </CardContent>

      <CardActions sx={{ p: 2, pt: 0 }}>
        {isCurrentPlan ? (
          <Button variant="outlined" fullWidth disabled>
            Current Plan
          </Button>
        ) : isEnterprise ? (
          <Button
            variant="outlined"
            fullWidth
            href="mailto:sales@componentsplatform.com"
            startIcon={<Business />}
          >
            Contact Sales
          </Button>
        ) : isFree && currentTier !== 'free' ? (
          <Button variant="outlined" fullWidth disabled>
            Downgrade to Free
          </Button>
        ) : (
          <Button
            variant={isUpgrade ? 'contained' : 'outlined'}
            fullWidth
            onClick={() => onSelect(plan.plan_tier)}
            disabled={loading || !isAdmin}
            startIcon={loading ? <CircularProgress size={16} /> : <Upgrade />}
          >
            {isUpgrade ? 'Upgrade' : 'Switch Plan'}
          </Button>
        )}
      </CardActions>
    </Card>
  );
};

// Main Billing Page Component
export const BillingPage: React.FC = () => {
  console.log('[Billing] ========== Component rendering ==========');

  const notify = useNotify();
  const { identity, isLoading: identityLoading } = useGetIdentity();
  console.log('[Billing] Hooks initialized successfully');
  console.log('[Billing] identity:', identity, 'identityLoading:', identityLoading);

  // State
  const [billingInfo, setBillingInfo] = useState<BillingInfo | null>(null);
  const [plans, setPlans] = useState<PlanFeatures[]>([]);
  const [invoices, setInvoices] = useState<InvoiceInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [upgradeDialogOpen, setUpgradeDialogOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<PlanTier | null>(null);

  // Get organization ID from localStorage (Auth0 provider stores it there)
  // Note: The identity object doesn't include organizationId, but it's stored in localStorage
  const organizationId = localStorage.getItem('organization_id') ||
    (identity as { organizationId?: string })?.organizationId;

  // Check if user has billing permissions (owner, admin, or platform admin)
  const userRole = localStorage.getItem('user_role') || '';
  const isOrgAdmin = ['owner', 'admin', 'org_admin'].includes(userRole.toLowerCase());
  const isPlatformAdmin = localStorage.getItem('is_admin') === 'true';
  const isAdmin = isOrgAdmin || isPlatformAdmin;

  console.log('[Billing] organizationId:', organizationId, 'userRole:', userRole, 'isOrgAdmin:', isOrgAdmin, 'isPlatformAdmin:', isPlatformAdmin, 'isAdmin:', isAdmin);

  // Load billing data
  const loadBillingData = useCallback(async () => {
    console.log('[Billing] loadBillingData called, organizationId:', organizationId);
    if (!organizationId) {
      console.log('[Billing] No organizationId, skipping load');
      setLoading(false);
      setError('Organization not found. Please log in again.');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      console.log('[Billing] Fetching billing info and plans...');
      const [billingData, plansData] = await Promise.all([
        stripeApiService.getBillingInfo(organizationId),
        stripeApiService.getAvailablePlans(),
      ]);

      console.log('[Billing] billingData:', billingData);
      console.log('[Billing] plansData:', plansData);

      setBillingInfo(billingData);
      setPlans(plansData);

      // Load invoices if we have a customer
      if (billingData.stripe_customer_id) {
        try {
          console.log('[Billing] Fetching invoices for customer:', billingData.stripe_customer_id);
          const invoicesData = await stripeApiService.getInvoices(billingData.stripe_customer_id);
          console.log('[Billing] invoicesData:', invoicesData);
          setInvoices(invoicesData);
        } catch (invoiceErr) {
          // Invoices are optional, don't fail the whole page
          console.warn('[Billing] Could not load invoices:', invoiceErr);
        }
      }
    } catch (err) {
      console.error('[Billing] Error loading billing data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load billing information');
      notify('Failed to load billing information', { type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [organizationId, notify]);

  useEffect(() => {
    if (!identityLoading && organizationId) {
      loadBillingData();
    }
  }, [identityLoading, organizationId, loadBillingData]);

  // Handle plan selection
  const handlePlanSelect = (tier: PlanTier) => {
    setSelectedPlan(tier);
    setUpgradeDialogOpen(true);
  };

  // Handle subscription upgrade/change
  const handleConfirmPlanChange = async () => {
    if (!selectedPlan || !organizationId) return;

    try {
      setActionLoading(true);

      // If no existing subscription, create checkout session
      // Note: Stripe customer is created during checkout if it doesn't exist
      if (!billingInfo?.stripe_subscription_id) {
        const result = await stripeApiService.createCheckoutSession(
          organizationId,
          billingInfo?.stripe_customer_id || '',
          selectedPlan
        );

        if (result.success && result.url) {
          window.location.href = result.url;
          return;
        } else {
          throw new Error(result.message || 'Failed to create checkout session');
        }
      }

      // Update existing subscription
      const result = await stripeApiService.updateSubscription(
        organizationId,
        billingInfo.stripe_subscription_id,
        selectedPlan
      );

      if (result.success) {
        notify(`Successfully updated to ${getPlanDisplayName(selectedPlan)} plan`, {
          type: 'success',
        });
        setUpgradeDialogOpen(false);
        loadBillingData();
      } else {
        throw new Error(result.message || 'Failed to update subscription');
      }
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to change plan', { type: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  // Handle billing portal access
  const handleOpenBillingPortal = async () => {
    if (!organizationId || !billingInfo?.stripe_customer_id) return;

    try {
      setActionLoading(true);
      const result = await stripeApiService.createBillingPortalSession(
        organizationId,
        billingInfo.stripe_customer_id
      );

      if (result.success && result.url) {
        window.location.href = result.url;
      } else {
        throw new Error(result.message || 'Failed to open billing portal');
      }
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to open billing portal', {
        type: 'error',
      });
    } finally {
      setActionLoading(false);
    }
  };

  // Note: We no longer require Stripe publishable key to show the billing page
  // The backend handles provider configuration and will return appropriate responses

  // Loading state
  console.log('[Billing] Checking loading state - loading:', loading, 'identityLoading:', identityLoading);
  if (loading || identityLoading) {
    console.log('[Billing] Showing loading skeleton');
    return (
      <Box p={3}>
        <Title title="Billing & Subscription" />
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Skeleton variant="rectangular" height={200} />
          </Grid>
          <Grid item xs={12} md={4}>
            <Skeleton variant="rectangular" height={400} />
          </Grid>
          <Grid item xs={12} md={4}>
            <Skeleton variant="rectangular" height={400} />
          </Grid>
          <Grid item xs={12} md={4}>
            <Skeleton variant="rectangular" height={400} />
          </Grid>
        </Grid>
      </Box>
    );
  }

  // Error state
  if (error) {
    return (
      <Box p={3}>
        <Title title="Billing & Subscription" />
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={loadBillingData}>
              Retry
            </Button>
          }
        >
          {error}
        </Alert>
      </Box>
    );
  }

  return (
    <Box p={3}>
      <Title title="Billing & Subscription" />

      {/* Current Plan Summary */}
      <Card sx={{ mb: 3 }}>
        <CardHeader
          avatar={<CreditCard color="primary" />}
          title="Current Subscription"
          action={
            <Box display="flex" gap={1}>
              <Tooltip title="Refresh">
                <IconButton onClick={loadBillingData} disabled={loading}>
                  <Refresh />
                </IconButton>
              </Tooltip>
              {billingInfo?.stripe_customer_id && (
                <Button
                  variant="outlined"
                  size="small"
                  onClick={handleOpenBillingPortal}
                  disabled={actionLoading}
                  startIcon={actionLoading ? <CircularProgress size={16} /> : <CreditCard />}
                >
                  Manage Billing
                </Button>
              )}
            </Box>
          }
        />
        <CardContent>
          <Grid container spacing={3}>
            <Grid item xs={12} sm={6} md={3}>
              <Typography variant="subtitle2" color="text.secondary">
                Plan
              </Typography>
              <Typography variant="h5">
                {getPlanDisplayName(billingInfo?.plan_tier || 'free')}
              </Typography>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Typography variant="subtitle2" color="text.secondary">
                Status
              </Typography>
              <Chip
                label={getStatusDisplayText(billingInfo?.subscription_status || 'trialing')}
                color={getStatusColor(billingInfo?.subscription_status || 'trialing')}
                size="small"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Typography variant="subtitle2" color="text.secondary">
                {billingInfo?.cancel_at_period_end ? 'Cancels On' : 'Renews On'}
              </Typography>
              <Typography variant="body1">
                {formatDate(billingInfo?.current_period_end || null)}
              </Typography>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Typography variant="subtitle2" color="text.secondary">
                Trial Ends
              </Typography>
              <Typography variant="body1">
                {billingInfo?.trial_end ? formatDate(billingInfo.trial_end) : 'N/A'}
              </Typography>
            </Grid>
          </Grid>

          {billingInfo?.cancel_at_period_end && (
            <Alert severity="warning" sx={{ mt: 2 }}>
              Your subscription is scheduled to cancel at the end of the billing period.
            </Alert>
          )}

          {billingInfo?.subscription_status === 'past_due' && (
            <Alert severity="error" sx={{ mt: 2 }}>
              Your payment is past due. Please update your payment method to avoid service
              interruption.
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Available Plans */}
      <Typography variant="h5" gutterBottom sx={{ mt: 4, mb: 2 }}>
        Available Plans
      </Typography>

      {!isAdmin && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Only organization owners and administrators can change the subscription plan.
        </Alert>
      )}

      <Grid container spacing={3}>
        {plans
          .filter((p) => p.plan_tier !== 'free' || billingInfo?.plan_tier === 'free')
          .map((plan) => (
            <Grid item xs={12} sm={6} md={3} key={plan.plan_tier}>
              <PlanCard
                plan={plan}
                isCurrentPlan={billingInfo?.plan_tier === plan.plan_tier}
                currentTier={billingInfo?.plan_tier || 'free'}
                onSelect={handlePlanSelect}
                loading={actionLoading}
                isAdmin={isAdmin}
              />
            </Grid>
          ))}
      </Grid>

      {/* Invoice History */}
      {invoices.length > 0 && (
        <>
          <Typography variant="h5" gutterBottom sx={{ mt: 4, mb: 2 }}>
            Invoice History
          </Typography>

          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Invoice</TableCell>
                  <TableCell>Date</TableCell>
                  <TableCell>Amount</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {invoices.map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell>{invoice.number || invoice.id}</TableCell>
                    <TableCell>{formatDate(invoice.created)}</TableCell>
                    <TableCell>{formatCurrency(invoice.amount_paid, invoice.currency)}</TableCell>
                    <TableCell>
                      <Chip
                        label={invoice.status}
                        color={invoice.status === 'paid' ? 'success' : 'default'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell align="right">
                      {invoice.hosted_invoice_url && (
                        <Tooltip title="View Invoice">
                          <IconButton
                            size="small"
                            href={invoice.hosted_invoice_url}
                            target="_blank"
                          >
                            <OpenInNew fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                      {invoice.invoice_pdf && (
                        <Tooltip title="Download PDF">
                          <IconButton size="small" href={invoice.invoice_pdf} target="_blank">
                            <Download fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </>
      )}

      {/* Plan Change Confirmation Dialog */}
      <Dialog open={upgradeDialogOpen} onClose={() => setUpgradeDialogOpen(false)}>
        <DialogTitle>Confirm Plan Change</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {selectedPlan && (
              <>
                You are about to switch to the <strong>{getPlanDisplayName(selectedPlan)}</strong>{' '}
                plan.
                {billingInfo?.stripe_subscription_id ? (
                  <> Your billing will be prorated based on the remaining time in your current billing period.</>
                ) : (
                  <> You will be redirected to our secure checkout page to complete the subscription.</>
                )}
              </>
            )}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUpgradeDialogOpen(false)} disabled={actionLoading}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirmPlanChange}
            variant="contained"
            color="primary"
            disabled={actionLoading}
            startIcon={actionLoading ? <CircularProgress size={16} /> : <CheckCircle />}
          >
            {billingInfo?.stripe_subscription_id ? 'Confirm Change' : 'Continue to Checkout'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default BillingPage;
