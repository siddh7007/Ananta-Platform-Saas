/**
 * User Profile Page
 *
 * Displays the current user's identity and roles.
 */
import React from 'react';
import { Box, Card, CardContent, Chip, Grid, Typography } from '@mui/material';
import { useGetIdentity } from 'react-admin';
import { PageHeader } from '../components/shared';

export const UserProfile: React.FC = () => {
  const { data: identity, isLoading } = useGetIdentity();

  const roles = (identity as { roles?: string[] } | undefined)?.roles ?? [];

  return (
    <Box sx={{ p: 3 }}>
      <PageHeader
        title="Profile"
        description="Your account details and assigned roles."
      />

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Account
              </Typography>
              <Typography variant="h6" fontWeight={600}>
                {isLoading ? 'Loading...' : (identity?.fullName || identity?.username || 'Unknown User')}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {identity?.email || 'No email available'}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Roles
              </Typography>
              {roles.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  No roles assigned.
                </Typography>
              ) : (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {roles.map((role) => (
                    <Chip key={role} label={role} size="small" />
                  ))}
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default UserProfile;
