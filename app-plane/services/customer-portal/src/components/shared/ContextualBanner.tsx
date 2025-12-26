/**
 * ContextualBanner Component
 *
 * Dismissible notification banners for contextual guidance, tips, and announcements.
 * Persists dismissal state via analytics service.
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  IconButton,
  Button,
  Collapse,
  Link,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import TipsAndUpdatesIcon from '@mui/icons-material/TipsAndUpdates';
import CampaignIcon from '@mui/icons-material/Campaign';
import NewReleasesIcon from '@mui/icons-material/NewReleases';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import { analytics } from '../../services/analytics';

// =====================================================
// Types
// =====================================================

export type BannerVariant = 'info' | 'tip' | 'announcement' | 'feature' | 'warning' | 'success';

export interface ContextualBannerProps {
  /** Unique identifier for persistence */
  id: string;
  /** Banner variant determines styling and icon */
  variant?: BannerVariant;
  /** Title text */
  title: string;
  /** Description text */
  description?: string;
  /** Primary action button */
  action?: {
    label: string;
    onClick: () => void;
  };
  /** Secondary link */
  link?: {
    label: string;
    href: string;
    external?: boolean;
  };
  /** Allow user to dismiss */
  dismissible?: boolean;
  /** Only show once per session */
  showOnce?: boolean;
  /** Custom icon override */
  icon?: React.ReactNode;
  /** Compact mode */
  compact?: boolean;
  /** Callback when dismissed */
  onDismiss?: () => void;
  /** Callback when action clicked */
  onActionClick?: () => void;
}

// =====================================================
// Variant Configuration
// =====================================================

interface VariantConfig {
  icon: React.ReactNode;
  bgcolor: string;
  borderColor: string;
  iconColor: string;
}

const VARIANT_CONFIG: Record<BannerVariant, VariantConfig> = {
  info: {
    icon: <InfoOutlinedIcon />,
    bgcolor: 'info.50',
    borderColor: 'info.main',
    iconColor: 'info.main',
  },
  tip: {
    icon: <TipsAndUpdatesIcon />,
    bgcolor: 'warning.50',
    borderColor: 'warning.main',
    iconColor: 'warning.main',
  },
  announcement: {
    icon: <CampaignIcon />,
    bgcolor: 'primary.50',
    borderColor: 'primary.main',
    iconColor: 'primary.main',
  },
  feature: {
    icon: <NewReleasesIcon />,
    bgcolor: 'secondary.50',
    borderColor: 'secondary.main',
    iconColor: 'secondary.main',
  },
  warning: {
    icon: <WarningAmberIcon />,
    bgcolor: 'warning.100',
    borderColor: 'warning.dark',
    iconColor: 'warning.dark',
  },
  success: {
    icon: <CheckCircleOutlineIcon />,
    bgcolor: 'success.50',
    borderColor: 'success.main',
    iconColor: 'success.main',
  },
};

// =====================================================
// Component
// =====================================================

export function ContextualBanner({
  id,
  variant = 'info',
  title,
  description,
  action,
  link,
  dismissible = true,
  showOnce = false,
  icon,
  compact = false,
  onDismiss,
  onActionClick,
}: ContextualBannerProps) {
  const [visible, setVisible] = useState(false);
  const config = VARIANT_CONFIG[variant];

  // Check if banner was previously dismissed
  useEffect(() => {
    const wasDismissed = analytics.isBannerDismissed(id);
    if (showOnce) {
      // For showOnce banners, also check session storage
      const shownThisSession = sessionStorage.getItem(`banner_shown_${id}`);
      if (shownThisSession) {
        setVisible(false);
        return;
      }
      sessionStorage.setItem(`banner_shown_${id}`, 'true');
    }
    setVisible(!wasDismissed);
  }, [id, showOnce]);

  // Handle dismiss
  const handleDismiss = () => {
    setVisible(false);
    analytics.dismissBanner(id);
    onDismiss?.();
  };

  // Handle action click
  const handleActionClick = () => {
    analytics.track('navigation', 'banner_action_clicked', { label: id });
    action?.onClick();
    onActionClick?.();
  };

  if (!visible) return null;

  return (
    <Collapse in={visible}>
      <Paper
        elevation={0}
        sx={{
          p: compact ? 1.5 : 2,
          mb: 2,
          bgcolor: config.bgcolor,
          borderLeft: '4px solid',
          borderColor: config.borderColor,
          display: 'flex',
          alignItems: compact ? 'center' : 'flex-start',
          gap: 2,
        }}
      >
        {/* Icon */}
        <Box
          sx={{
            color: config.iconColor,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          {icon || config.icon}
        </Box>

        {/* Content */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            variant={compact ? 'body2' : 'subtitle2'}
            fontWeight={600}
            gutterBottom={!compact && !!description}
          >
            {title}
          </Typography>
          {description && !compact && (
            <Typography variant="body2" color="text.secondary">
              {description}
            </Typography>
          )}
        </Box>

        {/* Actions */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            flexShrink: 0,
          }}
        >
          {link && (
            <Link
              href={link.href}
              target={link.external ? '_blank' : undefined}
              rel={link.external ? 'noopener noreferrer' : undefined}
              sx={{ fontSize: '0.875rem' }}
            >
              {link.label}
            </Link>
          )}
          {action && (
            <Button
              size="small"
              variant="contained"
              onClick={handleActionClick}
              sx={{ whiteSpace: 'nowrap' }}
            >
              {action.label}
            </Button>
          )}
          {dismissible && (
            <IconButton
              size="small"
              onClick={handleDismiss}
              sx={{ ml: 1 }}
              aria-label="Dismiss"
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          )}
        </Box>
      </Paper>
    </Collapse>
  );
}

// =====================================================
// Pre-configured Banner Components
// =====================================================

/**
 * Feature announcement banner for new releases.
 */
export function FeatureBanner({
  featureName,
  description,
  learnMoreUrl,
  ...props
}: Omit<ContextualBannerProps, 'variant' | 'title' | 'description'> & {
  featureName: string;
  description?: string;
  learnMoreUrl?: string;
}) {
  return (
    <ContextualBanner
      {...props}
      variant="feature"
      title={`New: ${featureName}`}
      description={description}
      link={learnMoreUrl ? { label: 'Learn more', href: learnMoreUrl, external: true } : undefined}
    />
  );
}

/**
 * Tip banner for contextual guidance.
 */
export function TipBanner({
  tip,
  action,
  ...props
}: Omit<ContextualBannerProps, 'variant' | 'title'> & {
  tip: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <ContextualBanner
      {...props}
      variant="tip"
      title={tip}
      action={action}
      compact
    />
  );
}

/**
 * Warning banner for important notices.
 */
export function WarningBanner({
  message,
  details,
  action,
  ...props
}: Omit<ContextualBannerProps, 'variant' | 'title' | 'description'> & {
  message: string;
  details?: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <ContextualBanner
      {...props}
      variant="warning"
      title={message}
      description={details}
      action={action}
    />
  );
}

/**
 * Success banner for confirmations.
 */
export function SuccessBanner({
  message,
  details,
  autoDismiss = false,
  onDismiss,
  ...props
}: Omit<ContextualBannerProps, 'variant' | 'title' | 'description'> & {
  message: string;
  details?: string;
  autoDismiss?: boolean;
}) {
  const [autoDismissed, setAutoDismissed] = useState(false);

  useEffect(() => {
    if (autoDismiss) {
      const timer = setTimeout(() => {
        setAutoDismissed(true);
        onDismiss?.();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [autoDismiss, onDismiss]);

  if (autoDismissed) return null;

  return (
    <ContextualBanner
      {...props}
      variant="success"
      title={message}
      description={details}
      onDismiss={onDismiss}
    />
  );
}

// =====================================================
// Page-Specific Contextual Banners
// =====================================================

/**
 * Banner for BOM upload page with tips.
 */
export function BomUploadTipBanner() {
  return (
    <TipBanner
      id="bom_upload_tip"
      tip="Tip: Include manufacturer names in your BOM for more accurate component matching"
      showOnce
    />
  );
}

/**
 * Banner for first-time search users.
 */
export function SearchGuideBanner({ onTrySearch }: { onTrySearch: () => void }) {
  return (
    <ContextualBanner
      id="search_guide"
      variant="info"
      title="Search the Component Catalog"
      description="Find components by MPN, manufacturer, or description. Use filters to narrow down results."
      action={{ label: 'Try a Search', onClick: onTrySearch }}
    />
  );
}

/**
 * Banner for risk dashboard introduction.
 */
export function RiskDashboardIntroBanner() {
  return (
    <ContextualBanner
      id="risk_dashboard_intro"
      variant="info"
      title="Understanding Risk Scores"
      description="Risk scores are calculated based on lifecycle status, supply chain diversity, compliance, and obsolescence probability."
      link={{ label: 'Learn about risk factors', href: '/docs/risk-scoring', external: true }}
    />
  );
}

/**
 * Banner for alert configuration.
 */
export function AlertConfigBanner({ onConfigure }: { onConfigure: () => void }) {
  return (
    <ContextualBanner
      id="alert_config_nudge"
      variant="tip"
      title="Get notified about component risks"
      description="Configure alert preferences to receive notifications when components face lifecycle, compliance, or availability issues."
      action={{ label: 'Configure Alerts', onClick: onConfigure }}
    />
  );
}

/**
 * Trial expiration warning banner.
 */
export function TrialExpirationBanner({
  daysRemaining,
  onUpgrade,
}: {
  daysRemaining: number;
  onUpgrade: () => void;
}) {
  const isUrgent = daysRemaining <= 3;

  return (
    <ContextualBanner
      id={`trial_expiration_${isUrgent ? 'urgent' : 'reminder'}`}
      variant={isUrgent ? 'warning' : 'info'}
      title={
        isUrgent
          ? `Your trial expires in ${daysRemaining} day${daysRemaining === 1 ? '' : 's'}!`
          : `${daysRemaining} days left in your trial`
      }
      description={
        isUrgent
          ? 'Upgrade now to keep access to all features and your data'
          : 'Upgrade to continue using all platform features after your trial'
      }
      action={{ label: 'Upgrade Now', onClick: onUpgrade }}
      dismissible={!isUrgent}
    />
  );
}

/**
 * MFA recommendation banner.
 */
export function MfaRecommendationBanner({ onEnable }: { onEnable: () => void }) {
  return (
    <ContextualBanner
      id="mfa_recommendation"
      variant="warning"
      title="Secure your account with MFA"
      description="Multi-factor authentication adds an extra layer of security to protect your component data."
      action={{ label: 'Enable MFA', onClick: onEnable }}
    />
  );
}

export default ContextualBanner;
