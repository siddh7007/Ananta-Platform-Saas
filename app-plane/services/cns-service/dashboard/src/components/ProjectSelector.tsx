/**
 * Project Selector Component
 *
 * Dropdown selector for switching between projects within a workspace.
 * Displays project name and allows selection of specific project or "All Projects".
 * Automatically clears project context when no workspace is selected.
 */

import { useEffect } from 'react';
import { Box, FormControl, MenuItem, Select, SelectChangeEvent, Typography } from '@mui/material';
import { useTenant } from '../contexts/TenantContext';
import { useProjects } from '../hooks/useProjects';

export default function ProjectSelector() {
  const { workspaceId, projectId, setProjectId } = useTenant();
  const { projects, loading } = useProjects(workspaceId);

  // Clear project selection when no workspace is selected
  useEffect(() => {
    if (!workspaceId && projectId) {
      setProjectId(null);
    }
  }, [workspaceId, projectId, setProjectId]);

  const handleProjectChange = (event: SelectChangeEvent<string>) => {
    const newProjectId = event.target.value;
    setProjectId(newProjectId || null);
    console.log('[ProjectSelector] Switched to project:', newProjectId || 'All Projects');
  };

  // Get current project name
  const currentProject = projects.find(p => p.id === projectId);
  const currentProjectName = projectId
    ? currentProject?.name || 'Loading...'
    : 'All Projects';

  // Don't render if no workspace selected
  if (!workspaceId) {
    return null;
  }

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, pr: 2 }}>
      <FormControl size="small" sx={{ minWidth: 200 }}>
        <Select
          value={projectId || ''}
          onChange={handleProjectChange}
          disabled={loading || projects.length === 0}
          displayEmpty
          sx={{
            fontSize: 13,
            '& .MuiSelect-select': {
              py: 0.5,
            }
          }}
        >
          {loading ? (
            <MenuItem value={projectId || ''}>Loading...</MenuItem>
          ) : projects.length === 0 ? (
            <MenuItem value="">No projects available</MenuItem>
          ) : (
            [
              <MenuItem key="all-projects" value="">
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    All Projects
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: 11 }}>
                    View all data
                  </Typography>
                </Box>
              </MenuItem>,
              ...projects.map((project) => (
                <MenuItem key={project.id} value={project.id}>
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {project.name}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: 11 }}>
                      Project
                    </Typography>
                  </Box>
                </MenuItem>
              )),
            ]
          )}
        </Select>
      </FormControl>
      <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: 11 }}>
        Selected: {currentProjectName}
      </Typography>
    </Box>
  );
}
