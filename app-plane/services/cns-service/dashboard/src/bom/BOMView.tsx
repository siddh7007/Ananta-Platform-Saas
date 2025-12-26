/**
 * BOMView - Clean URL for viewing a BOM in All Uploads
 *
 * Route: /boms/:bomId
 *
 * This component provides a direct URL to open a specific BOM
 * in the All Uploads page with the BOM expanded to show line items.
 *
 * Usage:
 * - http://localhost:27250/#/boms/ff979625-8078-425a-ac26-7eebc416d912
 *
 * This is the preferred URL pattern for unified workflow BOMs.
 * Legacy /bom-jobs/:jobId is for the old job-based workflow.
 */

import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Box, CircularProgress, Typography } from '@mui/material';

export const BOMView = () => {
  const { bomId } = useParams<{ bomId: string }>();
  const navigate = useNavigate();

  useEffect(() => {
    if (bomId) {
      // Redirect to All Uploads with bomId in state
      // The page can use this to auto-expand the BOM row
      navigate('/all-uploads', {
        replace: true,
        state: { bomId, autoExpand: true },
      });
    }
  }, [bomId, navigate]);

  // Show loading while redirecting
  return (
    <Box
      display="flex"
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      minHeight="50vh"
      gap={2}
    >
      <CircularProgress />
      <Typography variant="body1" color="text.secondary">
        Opening BOM {bomId}...
      </Typography>
    </Box>
  );
};

export default BOMView;
