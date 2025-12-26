/**
 * OnboardingProgress Component
 *
 * Displays onboarding checklist progress with actionable items.
 * Used in the Account Settings Control Center tab.
 */

import React from 'react';
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
  Button,
  Chip,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import NotificationsIcon from '@mui/icons-material/Notifications';
import TuneIcon from '@mui/icons-material/Tune';
import { Link as RouterLink } from 'react-router-dom';
import type { OnboardingChecklist } from '../../services/onboardingService';

interface OnboardingItem {
  id: keyof OnboardingChecklist;
  label: string;
  description: string;
  icon: React.ReactNode;
  actionLabel: string;
  actionLink: string;
}

interface OnboardingProgressProps {
  checklist: OnboardingChecklist;
  trialDaysRemaining?: number | null;
}

// Onboarding steps configuration
const ONBOARDING_ITEMS: OnboardingItem[] = [
  {
    id: 'first_bom_uploaded',
    label: 'Upload Your First BOM',
    description: 'Import a Bill of Materials to start enrichment',
    icon: <UploadFileIcon />,
    actionLabel: 'Upload BOM',
    actionLink: '/boms/create',
  },
  {
    id: 'first_enrichment_complete',
    label: 'Complete First Enrichment',
    description: 'Run enrichment to populate component data',
    icon: <AutoFixHighIcon />,
    actionLabel: 'View BOMs',
    actionLink: '/boms',
  },
  {
    id: 'team_member_invited',
    label: 'Invite a Team Member',
    description: 'Collaborate with your team on BOMs and projects',
    icon: <PersonAddIcon />,
    actionLabel: 'Invite',
    actionLink: '/users',
  },
  {
    id: 'alert_preferences_configured',
    label: 'Configure Alert Preferences',
    description: 'Set up notifications for component changes',
    icon: <NotificationsIcon />,
    actionLabel: 'Configure',
    actionLink: '/alerts/preferences',
  },
  {
    id: 'risk_thresholds_set',
    label: 'Set Risk Thresholds',
    description: 'Define acceptable risk levels for your portfolio',
    icon: <TuneIcon />,
    actionLabel: 'Configure',
    actionLink: '/risk/settings',
  },
];

export function OnboardingProgress({
  checklist,
  trialDaysRemaining,
}: OnboardingProgressProps) {
  // Calculate progress
  const completedCount = Object.values(checklist).filter(Boolean).length;
  const totalCount = ONBOARDING_ITEMS.length;
  const progress = Math.round((completedCount / totalCount) * 100);
  const isComplete = completedCount === totalCount;

  return (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <RocketLaunchIcon sx={{ mr: 1, color: 'primary.main' }} />
            <Typography variant="h6" fontWeight={600}>
              Getting Started
            </Typography>
          </Box>
          {trialDaysRemaining !== null && trialDaysRemaining !== undefined && (
            <Chip
              label={`${trialDaysRemaining} days left in trial`}
              color={trialDaysRemaining <= 7 ? 'warning' : 'default'}
              size="small"
            />
          )}
        </Box>

        {/* Progress Bar */}
        <Box sx={{ mb: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Typography variant="body2" color="text.secondary">
              {isComplete ? 'Onboarding Complete!' : `${completedCount} of ${totalCount} steps completed`}
            </Typography>
            <Typography variant="h6" fontWeight={600} color={isComplete ? 'success.main' : 'primary.main'}>
              {progress}%
            </Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={progress}
            color={isComplete ? 'success' : 'primary'}
            sx={{ height: 8, borderRadius: 1 }}
          />
        </Box>

        {/* Checklist Items */}
        {isComplete ? (
          <Box sx={{ textAlign: 'center', py: 2 }}>
            <CheckCircleIcon sx={{ fontSize: 48, color: 'success.main', mb: 1 }} />
            <Typography variant="body1" fontWeight={500}>
              You've completed all onboarding steps!
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Explore the dashboard to get the most out of Components Platform.
            </Typography>
          </Box>
        ) : (
          <List dense disablePadding>
            {ONBOARDING_ITEMS.map((item) => {
              const isCompleted = checklist[item.id];
              return (
                <ListItem
                  key={item.id}
                  sx={{
                    px: 0,
                    py: 1,
                    borderBottom: '1px solid',
                    borderColor: 'divider',
                    '&:last-child': { borderBottom: 'none' },
                    opacity: isCompleted ? 0.7 : 1,
                  }}
                  secondaryAction={
                    !isCompleted && (
                      <Button
                        component={RouterLink}
                        to={item.actionLink}
                        size="small"
                        variant="outlined"
                      >
                        {item.actionLabel}
                      </Button>
                    )
                  }
                >
                  <ListItemIcon sx={{ minWidth: 40 }}>
                    {isCompleted ? (
                      <CheckCircleIcon color="success" />
                    ) : (
                      <RadioButtonUncheckedIcon color="action" />
                    )}
                  </ListItemIcon>
                  <ListItemText
                    primary={item.label}
                    secondary={item.description}
                    primaryTypographyProps={{
                      variant: 'body2',
                      fontWeight: 500,
                      sx: {
                        textDecoration: isCompleted ? 'line-through' : 'none',
                      },
                    }}
                    secondaryTypographyProps={{
                      variant: 'caption',
                    }}
                  />
                </ListItem>
              );
            })}
          </List>
        )}
      </CardContent>
    </Card>
  );
}

export default OnboardingProgress;
