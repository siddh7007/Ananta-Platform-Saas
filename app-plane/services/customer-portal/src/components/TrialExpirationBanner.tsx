/**
 * Trial Expiration Warning Banner
 *
 * Displays a warning banner when:
 * - Trial is about to expire (within 7 days)
 * - Trial has expired
 * - Account deletion is scheduled
 */

import React, { useState, useEffect } from 'react';
import { Alert, AlertTitle, Button, Box, Collapse } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import CloseIcon from '@mui/icons-material/Close';
import IconButton from '@mui/material/IconButton';
import { accountService, AccountStatus } from '../services/accountService';

interface TrialExpirationBannerProps {
  dismissible?: boolean;
}

export const TrialExpirationBanner: React.FC<TrialExpirationBannerProps> = ({
  dismissible = true,
}) => {
  const navigate = useNavigate();
  const [accountStatus, setAccountStatus] = useState<AccountStatus | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const status = await accountService.getAccountStatus();
        setAccountStatus(status);
      } catch (error) {
        console.error('[TrialBanner] Error fetching account status:', error);
      } finally {
        setLoading(false);
      }
    };

    // Check if banner was dismissed in this session
    const dismissedKey = 'trial_banner_dismissed';
    const dismissedUntil = localStorage.getItem(dismissedKey);
    if (dismissedUntil) {
      const dismissedDate = new Date(dismissedUntil);
      if (dismissedDate > new Date()) {
        setDismissed(true);
        setLoading(false);
        return;
      }
    }

    fetchStatus();
  }, []);

  const handleDismiss = () => {
    // Dismiss for 24 hours
    const dismissUntil = new Date();
    dismissUntil.setHours(dismissUntil.getHours() + 24);
    localStorage.setItem('trial_banner_dismissed', dismissUntil.toISOString());
    setDismissed(true);
  };

  const handleUpgrade = () => {
    navigate('/billing');
  };

  const handleViewDeletion = () => {
    navigate('/account-settings');
  };

  // Don't show if loading, dismissed, or no account status
  if (loading || dismissed || !accountStatus) {
    return null;
  }

  // Check for deletion scheduled
  if (accountStatus.deletion_scheduled) {
    return (
      <Collapse in={!dismissed}>
        <Alert
          severity="error"
          icon={<WarningAmberIcon />}
          action={
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button color="inherit" size="small" onClick={handleViewDeletion}>
                View Details
              </Button>
              {dismissible && (
                <IconButton size="small" color="inherit" onClick={handleDismiss}>
                  <CloseIcon fontSize="small" />
                </IconButton>
              )}
            </Box>
          }
          sx={{ mb: 2 }}
        >
          <AlertTitle>Account Deletion Scheduled</AlertTitle>
          Your account is scheduled for deletion
          {accountStatus.days_until_deletion !== null && (
            <> in {accountStatus.days_until_deletion} days</>
          )}. You can cancel this in Account Settings.
        </Alert>
      </Collapse>
    );
  }

  // Check if trial is ending soon or expired
  if (accountStatus.subscription_status === 'trialing' && accountStatus.trial_end) {
    const trialEnd = new Date(accountStatus.trial_end);
    const now = new Date();
    const daysUntilExpiry = Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    // Trial expired
    if (daysUntilExpiry <= 0) {
      return (
        <Collapse in={!dismissed}>
          <Alert
            severity="error"
            icon={<WarningAmberIcon />}
            action={
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button color="inherit" size="small" onClick={handleUpgrade}>
                  Upgrade Now
                </Button>
                {dismissible && (
                  <IconButton size="small" color="inherit" onClick={handleDismiss}>
                    <CloseIcon fontSize="small" />
                  </IconButton>
                )}
              </Box>
            }
            sx={{ mb: 2 }}
          >
            <AlertTitle>Trial Expired</AlertTitle>
            Your trial has expired. Upgrade to a paid plan to continue using all features.
          </Alert>
        </Collapse>
      );
    }

    // Trial expiring soon (within 7 days)
    if (daysUntilExpiry <= 7) {
      const severity = daysUntilExpiry <= 3 ? 'error' : 'warning';
      return (
        <Collapse in={!dismissed}>
          <Alert
            severity={severity}
            icon={<WarningAmberIcon />}
            action={
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button color="inherit" size="small" onClick={handleUpgrade}>
                  Upgrade Now
                </Button>
                {dismissible && (
                  <IconButton size="small" color="inherit" onClick={handleDismiss}>
                    <CloseIcon fontSize="small" />
                  </IconButton>
                )}
              </Box>
            }
            sx={{ mb: 2 }}
          >
            <AlertTitle>Trial Ending Soon</AlertTitle>
            Your trial expires in {daysUntilExpiry} day{daysUntilExpiry !== 1 ? 's' : ''}.
            Upgrade to keep access to all features.
          </Alert>
        </Collapse>
      );
    }
  }

  // Check for suspended account
  if (accountStatus.is_suspended) {
    return (
      <Collapse in={!dismissed}>
        <Alert
          severity="error"
          icon={<WarningAmberIcon />}
          action={
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button color="inherit" size="small" onClick={handleUpgrade}>
                Resolve
              </Button>
              {dismissible && (
                <IconButton size="small" color="inherit" onClick={handleDismiss}>
                  <CloseIcon fontSize="small" />
                </IconButton>
              )}
            </Box>
          }
          sx={{ mb: 2 }}
        >
          <AlertTitle>Account Suspended</AlertTitle>
          Your account has been suspended. Please update your billing information to restore access.
        </Alert>
      </Collapse>
    );
  }

  // Check for past_due subscription
  if (accountStatus.subscription_status === 'past_due') {
    return (
      <Collapse in={!dismissed}>
        <Alert
          severity="warning"
          icon={<WarningAmberIcon />}
          action={
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button color="inherit" size="small" onClick={handleUpgrade}>
                Update Payment
              </Button>
              {dismissible && (
                <IconButton size="small" color="inherit" onClick={handleDismiss}>
                  <CloseIcon fontSize="small" />
                </IconButton>
              )}
            </Box>
          }
          sx={{ mb: 2 }}
        >
          <AlertTitle>Payment Past Due</AlertTitle>
          Your subscription payment is past due. Please update your payment method to avoid service interruption.
        </Alert>
      </Collapse>
    );
  }

  // No banner needed
  return null;
};

export default TrialExpirationBanner;
