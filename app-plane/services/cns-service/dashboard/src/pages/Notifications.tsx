/**
 * Notifications Page
 *
 * Placeholder view for portal notifications context.
 */
import React from 'react';
import { Box, Card, CardContent, Typography, Link } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { PageHeader, NoDataState } from '../components/shared';

export const Notifications: React.FC = () => {
  return (
    <Box sx={{ p: 3 }}>
      <PageHeader
        title="Notifications"
        description="Portal notifications and recent activity."
      />

      <Card variant="outlined">
        <CardContent>
          <NoDataState
            title="No notifications yet"
            description="System alerts and portal notifications will appear here."
          />
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            For operational events, visit the{' '}
            <Link component={RouterLink} to="/activity-log">
              Activity Log
            </Link>.
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
};

export default Notifications;
