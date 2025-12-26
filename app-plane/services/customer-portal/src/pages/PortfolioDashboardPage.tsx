/**
 * Portfolio Dashboard Page - Integration Wrapper
 * Integrates the new Refine/Radix Portfolio Dashboard into React Admin
 * @module pages
 */

import React from 'react';
import { useOrganization } from '../contexts/OrganizationContext';
import { DashboardErrorBoundary } from '../components/dashboard';
import { PortfolioDashboard } from './dashboard/PortfolioDashboard';
import { usePortfolioMetrics } from '../hooks/usePortfolioMetrics';
import { Box, Typography, Button, CircularProgress } from '@mui/material';
import { useNavigate } from 'react-router-dom';

/**
 * Portfolio Dashboard Page Component
 *
 * Wraps the new Portfolio Dashboard with:
 * - Organization context integration
 * - React Admin navigation
 * - Error boundary
 * - Role-based access control
 */
export const PortfolioDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { currentOrg, permissions, isLoading: orgLoading } = useOrganization();

  // Check if user has owner or admin role (canEditOrg is admin+, canDeleteOrg is owner only)
  const hasAccess = permissions.canEditOrg || permissions.canDeleteOrg;

  // Loading state
  if (orgLoading) {
    return (
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '60vh',
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  // Access denied
  if (!hasAccess) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '60vh',
          gap: 2,
        }}
      >
        <Typography variant="h5" color="error">
          Access Denied
        </Typography>
        <Typography variant="body1" color="text.secondary">
          The Portfolio Dashboard is only available to organization owners and admins.
        </Typography>
        <Button
          variant="contained"
          onClick={() => navigate('/')}
        >
          Go to Dashboard
        </Button>
      </Box>
    );
  }

  // No organization selected
  if (!currentOrg) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '60vh',
          gap: 2,
        }}
      >
        <Typography variant="h5">
          No Organization Selected
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Please select an organization to view the portfolio dashboard.
        </Typography>
      </Box>
    );
  }

  return (
    <DashboardErrorBoundary
      onError={(error, errorInfo) => {
        console.error('[PortfolioDashboardPage] Error:', error, errorInfo);
        // Could send to error tracking service here
      }}
    >
      <PortfolioDashboard
        tenantId={currentOrg.id}
        refreshInterval={300000} // 5 minutes
      />
    </DashboardErrorBoundary>
  );
};

export default PortfolioDashboardPage;
