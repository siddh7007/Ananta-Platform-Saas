/**
 * SecurityCompleteness Component
 *
 * Displays a security score gauge and checklist of security items.
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
  Chip,
  Button,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import SecurityIcon from '@mui/icons-material/Security';
import VpnKeyIcon from '@mui/icons-material/VpnKey';
import PhonelinkLockIcon from '@mui/icons-material/PhonelinkLock';
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser';
import LinkIcon from '@mui/icons-material/Link';
import HistoryIcon from '@mui/icons-material/History';

interface SecurityItem {
  id: string;
  label: string;
  description: string;
  completed: boolean;
  icon: React.ReactNode;
  actionLabel?: string;
  onAction?: () => void;
}

interface SecurityCompletenessProps {
  mfaEnabled: boolean;
  passwordStrong: boolean;
  emailVerified: boolean;
  linkedAccounts: number;
  recentLoginReviewed: boolean;
  onEnableMFA?: () => void;
  onChangePassword?: () => void;
  onReviewLogins?: () => void;
}

export function SecurityCompleteness({
  mfaEnabled,
  passwordStrong,
  emailVerified,
  linkedAccounts,
  recentLoginReviewed,
  onEnableMFA,
  onChangePassword,
  onReviewLogins,
}: SecurityCompletenessProps) {
  // Build security items
  const securityItems: SecurityItem[] = [
    {
      id: 'mfa',
      label: 'Two-Factor Authentication',
      description: mfaEnabled ? 'MFA is enabled for your account' : 'Add an extra layer of security',
      completed: mfaEnabled,
      icon: <PhonelinkLockIcon />,
      actionLabel: mfaEnabled ? undefined : 'Enable MFA',
      onAction: onEnableMFA,
    },
    {
      id: 'password',
      label: 'Strong Password',
      description: passwordStrong ? 'Your password meets security standards' : 'Update to a stronger password',
      completed: passwordStrong,
      icon: <VpnKeyIcon />,
      actionLabel: passwordStrong ? undefined : 'Change Password',
      onAction: onChangePassword,
    },
    {
      id: 'email',
      label: 'Email Verified',
      description: emailVerified ? 'Your email has been verified' : 'Verify your email address',
      completed: emailVerified,
      icon: <VerifiedUserIcon />,
    },
    {
      id: 'linked',
      label: 'Linked Accounts',
      description: linkedAccounts > 0 ? `${linkedAccounts} account(s) linked for backup access` : 'Link social accounts for backup',
      completed: linkedAccounts > 0,
      icon: <LinkIcon />,
    },
    {
      id: 'logins',
      label: 'Login History Reviewed',
      description: recentLoginReviewed ? 'You have reviewed recent login activity' : 'Check for suspicious activity',
      completed: recentLoginReviewed,
      icon: <HistoryIcon />,
      actionLabel: recentLoginReviewed ? undefined : 'Review Activity',
      onAction: onReviewLogins,
    },
  ];

  // Calculate score
  const completedCount = securityItems.filter(item => item.completed).length;
  const totalCount = securityItems.length;
  const score = Math.round((completedCount / totalCount) * 100);

  // Get score color
  const getScoreColor = (s: number) => {
    if (s >= 80) return 'success';
    if (s >= 60) return 'warning';
    return 'error';
  };

  // Get score label
  const getScoreLabel = (s: number) => {
    if (s >= 80) return 'Excellent';
    if (s >= 60) return 'Good';
    if (s >= 40) return 'Fair';
    return 'Needs Attention';
  };

  return (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <SecurityIcon sx={{ mr: 1, color: 'primary.main' }} />
          <Typography variant="h6" fontWeight={600}>
            Security Score
          </Typography>
        </Box>

        {/* Score Gauge */}
        <Box sx={{ mb: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Typography variant="h3" fontWeight={700} color={`${getScoreColor(score)}.main`}>
              {score}%
            </Typography>
            <Chip
              label={getScoreLabel(score)}
              color={getScoreColor(score)}
              size="small"
            />
          </Box>
          <LinearProgress
            variant="determinate"
            value={score}
            color={getScoreColor(score)}
            sx={{ height: 8, borderRadius: 1 }}
          />
          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
            {completedCount} of {totalCount} security items completed
          </Typography>
        </Box>

        {/* Security Items */}
        <List dense disablePadding>
          {securityItems.map((item) => (
            <ListItem
              key={item.id}
              sx={{
                px: 0,
                borderBottom: '1px solid',
                borderColor: 'divider',
                '&:last-child': { borderBottom: 'none' },
              }}
              secondaryAction={
                item.actionLabel && item.onAction && (
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={item.onAction}
                  >
                    {item.actionLabel}
                  </Button>
                )
              }
            >
              <ListItemIcon sx={{ minWidth: 40 }}>
                {item.completed ? (
                  <CheckCircleIcon color="success" />
                ) : (
                  <CancelIcon color="error" />
                )}
              </ListItemIcon>
              <ListItemText
                primary={item.label}
                secondary={item.description}
                primaryTypographyProps={{
                  variant: 'body2',
                  fontWeight: 500,
                  color: item.completed ? 'text.primary' : 'error.main',
                }}
                secondaryTypographyProps={{
                  variant: 'caption',
                }}
              />
            </ListItem>
          ))}
        </List>
      </CardContent>
    </Card>
  );
}

export default SecurityCompleteness;
