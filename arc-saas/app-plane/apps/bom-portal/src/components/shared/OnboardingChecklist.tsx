/**
 * OnboardingChecklist Component
 *
 * Dashboard widget showing onboarding progress with actionable steps.
 * Integrates with onboardingService for real-time status tracking.
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  LinearProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  Button,
  IconButton,
  Collapse,
  Chip,
  Tooltip,
  Skeleton,
  Alert,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import CloseIcon from '@mui/icons-material/Close';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import GroupAddIcon from '@mui/icons-material/GroupAdd';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import SpeedIcon from '@mui/icons-material/Speed';
import SecurityIcon from '@mui/icons-material/Security';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import { useNavigate } from 'react-router-dom';
import { useAuthState } from 'react-admin';
import { onboardingService, type OnboardingChecklist as ChecklistType, type OnboardingStatus } from '../../services/onboardingService';
import { analytics } from '../../services/analytics';

// =====================================================
// Types
// =====================================================

export interface OnboardingChecklistProps {
  /** Allow user to dismiss the checklist */
  dismissible?: boolean;
  /** Callback when dismissed */
  onDismiss?: () => void;
  /** Compact mode for sidebar */
  compact?: boolean;
  /** Show trial banner */
  showTrialBanner?: boolean;
}

interface ChecklistStep {
  key: keyof ChecklistType;
  label: string;
  description: string;
  icon: React.ReactNode;
  action: {
    label: string;
    path: string;
  };
}

// =====================================================
// Step Configuration
// =====================================================

const CHECKLIST_STEPS: ChecklistStep[] = [
  {
    key: 'first_bom_uploaded',
    label: 'Upload your first BOM',
    description: 'Start by uploading a Bill of Materials to analyze',
    icon: <UploadFileIcon />,
    action: { label: 'Upload BOM', path: '/bom/upload' },
  },
  {
    key: 'first_enrichment_complete',
    label: 'Complete first enrichment',
    description: 'Enrich component data with supplier information',
    icon: <SpeedIcon />,
    action: { label: 'View BOMs', path: '/boms' },
  },
  {
    key: 'team_member_invited',
    label: 'Invite a team member',
    description: 'Collaborate with your team on component management',
    icon: <GroupAddIcon />,
    action: { label: 'Invite Members', path: '/organization/settings' },
  },
  {
    key: 'alert_preferences_configured',
    label: 'Configure alert preferences',
    description: 'Set up notifications for component risks and updates',
    icon: <NotificationsActiveIcon />,
    action: { label: 'Configure Alerts', path: '/alert-preferences' },
  },
  {
    key: 'risk_thresholds_set',
    label: 'Set risk thresholds',
    description: 'Define risk tolerance levels for your organization',
    icon: <SecurityIcon />,
    action: { label: 'Risk Settings', path: '/risk-profile' },
  },
];

// =====================================================
// Component
// =====================================================

export function OnboardingChecklist({
  dismissible = true,
  onDismiss,
  compact = false,
  showTrialBanner = true,
}: OnboardingChecklistProps) {
  const navigate = useNavigate();
  const { authenticated, isLoading: authLoading } = useAuthState();
  const [status, setStatus] = useState<OnboardingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(true);
  const [dismissed, setDismissed] = useState(false);

  // Check if already dismissed via analytics
  useEffect(() => {
    const wasDismissed = analytics.isBannerDismissed('onboarding_checklist');
    setDismissed(wasDismissed);
  }, []);

  // Load onboarding status (only after auth is ready)
  useEffect(() => {
    if (dismissed) return;
    if (authLoading) return; // Wait for auth to initialize
    if (!authenticated) {
      setLoading(false);
      return; // Don't load if not authenticated
    }

    const loadStatus = async () => {
      try {
        setLoading(true);
        const data = await onboardingService.getStatus();
        setStatus(data);
        setError(null);
      } catch (err: any) {
        console.error('[OnboardingChecklist] Failed to load status:', err);
        setError(err.message || 'Failed to load onboarding status');
      } finally {
        setLoading(false);
      }
    };

    loadStatus();
  }, [dismissed, authenticated, authLoading]);

  // Calculate progress
  const completedCount = status?.checklist
    ? Object.values(status.checklist).filter(Boolean).length
    : 0;
  const totalSteps = CHECKLIST_STEPS.length;
  const progressPercent = (completedCount / totalSteps) * 100;
  const isComplete = completedCount === totalSteps;

  // Handle dismiss
  const handleDismiss = () => {
    setDismissed(true);
    analytics.dismissBanner('onboarding_checklist');
    analytics.trackOnboardingSkipped();
    onDismiss?.();
  };

  // Handle step action
  const handleStepAction = (step: ChecklistStep) => {
    analytics.trackFeatureDiscovery(`onboarding_${step.key}`);
    navigate(step.action.path);
  };

  // Handle completion celebration
  useEffect(() => {
    if (isComplete && status?.onboarding_completed_at === null) {
      analytics.trackOnboardingComplete();
    }
  }, [isComplete, status?.onboarding_completed_at]);

  // Don't render if dismissed or complete
  if (dismissed) return null;
  if (isComplete && status?.onboarding_completed_at) return null;

  // Loading state
  if (loading) {
    return (
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
            <Skeleton variant="circular" width={40} height={40} />
            <Box sx={{ flex: 1 }}>
              <Skeleton variant="text" width="60%" />
              <Skeleton variant="text" width="40%" />
            </Box>
          </Box>
          <Skeleton variant="rectangular" height={8} sx={{ borderRadius: 1 }} />
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (error) {
    return (
      <Alert severity="warning" sx={{ mb: 3 }} onClose={handleDismiss}>
        Unable to load onboarding status
      </Alert>
    );
  }

  // Compact mode - just show progress
  if (compact) {
    return (
      <Card sx={{ mb: 2 }}>
        <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <RocketLaunchIcon sx={{ fontSize: 20, color: 'primary.main' }} />
            <Typography variant="body2" fontWeight={600}>
              Getting Started
            </Typography>
            <Chip
              label={`${completedCount}/${totalSteps}`}
              size="small"
              color={isComplete ? 'success' : 'default'}
              sx={{ ml: 'auto' }}
            />
          </Box>
          <LinearProgress
            variant="determinate"
            value={progressPercent}
            sx={{ height: 6, borderRadius: 3 }}
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      sx={{
        mb: 3,
        border: '1px solid',
        borderColor: isComplete ? 'success.main' : 'primary.main',
        bgcolor: isComplete ? 'success.50' : 'primary.50',
      }}
    >
      <CardContent>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
          <Box
            sx={{
              width: 48,
              height: 48,
              borderRadius: 2,
              bgcolor: isComplete ? 'success.main' : 'primary.main',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <RocketLaunchIcon sx={{ color: 'white', fontSize: 28 }} />
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography variant="h6" fontWeight={600}>
              {isComplete ? 'Setup Complete!' : 'Get Started'}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {isComplete
                ? 'You have completed all onboarding steps'
                : `Complete ${totalSteps - completedCount} more steps to unlock all features`}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Chip
              label={`${completedCount}/${totalSteps}`}
              color={isComplete ? 'success' : 'primary'}
              size="small"
            />
            <IconButton size="small" onClick={() => setExpanded(!expanded)}>
              {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </IconButton>
            {dismissible && (
              <Tooltip title="Dismiss checklist">
                <IconButton size="small" onClick={handleDismiss}>
                  <CloseIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
          </Box>
        </Box>

        {/* Progress Bar */}
        <Box sx={{ mt: 2 }}>
          <LinearProgress
            variant="determinate"
            value={progressPercent}
            sx={{
              height: 8,
              borderRadius: 4,
              bgcolor: 'rgba(0,0,0,0.1)',
              '& .MuiLinearProgress-bar': {
                bgcolor: isComplete ? 'success.main' : 'primary.main',
                borderRadius: 4,
              },
            }}
          />
        </Box>

        {/* Trial Banner */}
        {showTrialBanner && status?.trial_days_remaining !== null && status?.trial_days_remaining !== undefined && (
          <Alert
            severity={status.trial_days_remaining <= 3 ? 'warning' : 'info'}
            sx={{ mt: 2 }}
          >
            <Typography variant="body2">
              <strong>{status.trial_days_remaining} days</strong> remaining in your trial.{' '}
              <Button
                size="small"
                color="inherit"
                onClick={() => navigate('/organization/billing')}
              >
                Upgrade Now
              </Button>
            </Typography>
          </Alert>
        )}

        {/* Checklist Steps */}
        <Collapse in={expanded}>
          <List sx={{ mt: 1 }}>
            {CHECKLIST_STEPS.map((step, index) => {
              const isStepComplete = status?.checklist?.[step.key] ?? false;

              return (
                <ListItem
                  key={step.key}
                  sx={{
                    borderRadius: 1,
                    mb: 0.5,
                    bgcolor: isStepComplete ? 'transparent' : 'background.paper',
                    opacity: isStepComplete ? 0.7 : 1,
                    '&:hover': {
                      bgcolor: isStepComplete ? 'transparent' : 'action.hover',
                    },
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 40 }}>
                    {isStepComplete ? (
                      <CheckCircleIcon color="success" />
                    ) : (
                      <Box
                        sx={{
                          width: 24,
                          height: 24,
                          borderRadius: '50%',
                          border: '2px solid',
                          borderColor: 'divider',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Typography variant="caption" fontWeight={600}>
                          {index + 1}
                        </Typography>
                      </Box>
                    )}
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Typography
                        variant="body2"
                        fontWeight={isStepComplete ? 400 : 600}
                        sx={{
                          textDecoration: isStepComplete ? 'line-through' : 'none',
                        }}
                      >
                        {step.label}
                      </Typography>
                    }
                    secondary={!isStepComplete && step.description}
                  />
                  <ListItemSecondaryAction>
                    {!isStepComplete && (
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => handleStepAction(step)}
                        startIcon={step.icon}
                      >
                        {step.action.label}
                      </Button>
                    )}
                  </ListItemSecondaryAction>
                </ListItem>
              );
            })}
          </List>
        </Collapse>
      </CardContent>
    </Card>
  );
}

export default OnboardingChecklist;
