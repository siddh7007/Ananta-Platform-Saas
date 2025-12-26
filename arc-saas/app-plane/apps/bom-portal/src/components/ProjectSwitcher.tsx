/**
 * Project Switcher Component
 *
 * Allows users to select their current working project.
 * Saves selection to localStorage for persistence across sessions.
 */

import React, { useState, useEffect } from 'react';
import {
  FormControl,
  Select,
  MenuItem,
  Box,
  Typography,
  SelectChangeEvent,
} from '@mui/material';
import FolderIcon from '@mui/icons-material/Folder';

interface Project {
  id: string;
  name: string;
}

interface ProjectSwitcherProps {
  projects: Project[];
  currentProjectId: string | null;
  onProjectChange: (projectId: string) => void;
  loading?: boolean;
}

export const ProjectSwitcher: React.FC<ProjectSwitcherProps> = ({
  projects,
  currentProjectId,
  onProjectChange,
  loading = false,
}) => {
  const handleChange = (event: SelectChangeEvent<string>) => {
    const projectId = event.target.value;
    onProjectChange(projectId);
  };

  if (loading || !projects || projects.length === 0) {
    return null;
  }

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 250 }}>
      <FolderIcon sx={{ color: 'text.secondary' }} />
      <FormControl fullWidth size="small">
        <Select
          value={currentProjectId || ''}
          onChange={handleChange}
          displayEmpty
          sx={{
            '& .MuiSelect-select': {
              py: 1,
            },
          }}
        >
          <MenuItem value="" disabled>
            <Typography variant="body2" color="text.secondary">
              Select a project
            </Typography>
          </MenuItem>
          {projects.map((project) => (
            <MenuItem key={project.id} value={project.id}>
              <Typography variant="body2" fontWeight={500}>
                {project.name}
              </Typography>
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    </Box>
  );
};
