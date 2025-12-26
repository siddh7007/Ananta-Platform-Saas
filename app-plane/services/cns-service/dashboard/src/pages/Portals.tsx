/**
 * Portals Page
 *
 * Quick access to related platform portals.
 */
import React from 'react';
import { Box, Button, Card, CardActions, CardContent, Grid, Typography } from '@mui/material';
import { PageHeader } from '../components/shared';

const PORTALS = [
  {
    id: 'app-plane',
    name: 'App Plane Portal',
    description: 'Unified platform dashboard and service health.',
    url: import.meta.env.VITE_APP_PLANE_PORTAL_URL || 'http://localhost:27250',
  },
  {
    id: 'customer-portal',
    name: 'Customer Portal',
    description: 'Customer-facing BOM workflows and projects.',
    url: import.meta.env.VITE_CUSTOMER_PORTAL_URL || 'http://localhost:27510',
  },
  {
    id: 'cns-dashboard',
    name: 'CNS Dashboard',
    description: 'Staff tooling for enrichment monitoring.',
    url: import.meta.env.VITE_CNS_DASHBOARD_URL || 'http://localhost:27810',
  },
];

export const Portals: React.FC = () => {
  return (
    <Box sx={{ p: 3 }}>
      <PageHeader
        title="Portals"
        description="Jump to related platform portals and tools."
      />

      <Grid container spacing={3}>
        {PORTALS.map((portal) => (
          <Grid key={portal.id} item xs={12} md={4}>
            <Card variant="outlined" sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              <CardContent sx={{ flex: 1 }}>
                <Typography variant="h6" fontWeight={600} gutterBottom>
                  {portal.name}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {portal.description}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                  {portal.url}
                </Typography>
              </CardContent>
              <CardActions sx={{ px: 2, pb: 2 }}>
                <Button
                  variant="contained"
                  size="small"
                  href={portal.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open
                </Button>
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
};

export default Portals;
