/**
 * BOMProjectBanner Component
 *
 * Shows the current project context for BOM uploads.
 * Allows users to change the target project.
 */

import React from 'react';
import { Box, Typography, Button, Alert } from '@mui/material';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';

interface BOMProjectBannerProps {
  projectName: string;
  onChangeProject: () => void;
}

export function BOMProjectBanner({ projectName, onChangeProject }: BOMProjectBannerProps) {
  return (
    <Alert severity="info" icon={<FolderOpenIcon />} sx={{ mb: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
        <Box>
          <Typography variant="body1" fontWeight={600}>
            Uploading to: {projectName}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Files will be associated with this project automatically
          </Typography>
        </Box>
        <Button variant="outlined" size="small" onClick={onChangeProject}>
          Change Project
        </Button>
      </Box>
    </Alert>
  );
}

export default BOMProjectBanner;
