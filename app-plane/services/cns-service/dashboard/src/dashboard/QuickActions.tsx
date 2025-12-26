/**
 * QuickActions - Upload BOM, View Queue, Open Config
 */
import React, { useMemo } from 'react';
import { Card, CardContent, Typography, Box, Button, Grid, useTheme } from '@mui/material';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import PendingActionsIcon from '@mui/icons-material/PendingActions';
import SettingsIcon from '@mui/icons-material/Settings';
import BarChartIcon from '@mui/icons-material/BarChart';
import { useNavigate } from 'react-router-dom';

export interface QuickAction {
  label: string;
  description: string;
  icon: React.ReactNode;
  path: string;
  color: string;
}

export interface QuickActionsProps {
  actions?: QuickAction[];
}

// Will use theme.palette.primary/secondary/warning/success instead of hardcoded colors
const getDefaultActions = (theme: ReturnType<typeof useTheme>): QuickAction[] => [
  {
    label: 'Upload BOM',
    description: 'Start a new bulk upload',
    icon: <UploadFileIcon />,
    path: '/bom-wizard',
    color: theme.palette.primary.main,
  },
  {
    label: 'Quality Queue',
    description: 'Review pending items',
    icon: <PendingActionsIcon />,
    path: '/quality-queue',
    color: theme.palette.secondary.main,
  },
  {
    label: 'Configuration',
    description: 'Manage settings',
    icon: <SettingsIcon />,
    path: '/config',
    color: theme.palette.warning.main,
  },
  {
    label: 'Analytics',
    description: 'View metrics',
    icon: <BarChartIcon />,
    path: '/analytics',
    color: theme.palette.success.main,
  },
];

export const QuickActions: React.FC<QuickActionsProps> = ({
  actions,
}) => {
  const theme = useTheme();
  const navigate = useNavigate();

  // Memoize default actions to prevent recreation on each render
  const defaultActions = useMemo(() => getDefaultActions(theme), [theme]);
  const finalActions = actions || defaultActions;

  return (
    <Card elevation={2}>
      <CardContent>
        <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
          Quick Actions
        </Typography>
        <Grid container spacing={2} mt={1}>
          {finalActions.map((action, index) => (
            <Grid item xs={6} sm={3} key={index}>
              <Button
                fullWidth
                variant="outlined"
                onClick={() => navigate(action.path)}
                sx={{
                  flexDirection: 'column',
                  py: 2,
                  px: 1,
                  borderColor: theme.palette.grey[200],
                  color: 'text.primary',
                  textTransform: 'none',
                  '&:hover': {
                    borderColor: action.color,
                    backgroundColor: `${action.color}08`,
                  },
                }}
              >
                <Box
                  sx={{
                    backgroundColor: `${action.color}15`,
                    borderRadius: 2,
                    p: 1,
                    mb: 1,
                    color: action.color,
                  }}
                >
                  {action.icon}
                </Box>
                <Typography variant="body2" fontWeight={600}>
                  {action.label}
                </Typography>
                <Typography variant="caption" color="textSecondary">
                  {action.description}
                </Typography>
              </Button>
            </Grid>
          ))}
        </Grid>
      </CardContent>
    </Card>
  );
};

export default QuickActions;
