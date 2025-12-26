/**
 * QuickActions - Upload BOM, View Queue, Open Config
 */
import React from 'react';
import { Card, CardContent, Typography, Box, Button, Grid } from '@mui/material';
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

const defaultActions: QuickAction[] = [
  {
    label: 'Upload BOM',
    description: 'Start a new bulk upload',
    icon: <UploadFileIcon />,
    path: '/bom-wizard',
    color: '#3b82f6',
  },
  {
    label: 'Quality Queue',
    description: 'Review pending items',
    icon: <PendingActionsIcon />,
    path: '/quality-queue',
    color: '#8b5cf6',
  },
  {
    label: 'Configuration',
    description: 'Manage settings',
    icon: <SettingsIcon />,
    path: '/config',
    color: '#f59e0b',
  },
  {
    label: 'Analytics',
    description: 'View metrics',
    icon: <BarChartIcon />,
    path: '/analytics',
    color: '#22c55e',
  },
];

export const QuickActions: React.FC<QuickActionsProps> = ({
  actions = defaultActions,
}) => {
  const navigate = useNavigate();

  return (
    <Card elevation={2}>
      <CardContent>
        <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
          Quick Actions
        </Typography>
        <Grid container spacing={2} mt={1}>
          {actions.map((action, index) => (
            <Grid item xs={6} sm={3} key={index}>
              <Button
                fullWidth
                variant="outlined"
                onClick={() => navigate(action.path)}
                sx={{
                  flexDirection: 'column',
                  py: 2,
                  px: 1,
                  borderColor: '#e5e7eb',
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
