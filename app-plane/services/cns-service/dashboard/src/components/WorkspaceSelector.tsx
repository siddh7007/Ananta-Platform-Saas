/**
 * Workspace Selector Component
 *
 * Dropdown selector for switching between workspaces within an organization.
 * Displays workspace name and allows selection of specific workspace or "All Workspaces".
 * Automatically clears workspace context when no organization is selected.
 */

import { useEffect } from 'react';
import { Box, FormControl, MenuItem, Select, SelectChangeEvent, Typography } from '@mui/material';
import { useTenant } from '../contexts/TenantContext';
import { useWorkspaces } from '../hooks/useWorkspaces';

export default function WorkspaceSelector() {
  const { organizationId, workspaceId, setWorkspaceId } = useTenant();
  const { workspaces, loading } = useWorkspaces(organizationId);

  // Clear workspace selection when no organization is selected
  useEffect(() => {
    if (!organizationId && workspaceId) {
      setWorkspaceId(null);
    }
  }, [organizationId, workspaceId, setWorkspaceId]);

  const handleWorkspaceChange = (event: SelectChangeEvent<string>) => {
    const newWorkspaceId = event.target.value;
    setWorkspaceId(newWorkspaceId || null);
    console.log('[WorkspaceSelector] Switched to workspace:', newWorkspaceId || 'All Workspaces');
  };

  // Get current workspace name
  const currentWorkspace = workspaces.find(w => w.id === workspaceId);
  const currentWorkspaceName = workspaceId
    ? currentWorkspace?.name || 'Loading...'
    : 'All Workspaces';

  // Don't render if no organization selected
  if (!organizationId) {
    return null;
  }

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, pr: 2 }}>
      <FormControl size="small" sx={{ minWidth: 200 }}>
        <Select
          value={workspaceId || ''}
          onChange={handleWorkspaceChange}
          disabled={loading || workspaces.length === 0}
          displayEmpty
          sx={{
            fontSize: 13,
            '& .MuiSelect-select': {
              py: 0.5,
            }
          }}
        >
          {loading ? (
            <MenuItem value={workspaceId || ''}>Loading...</MenuItem>
          ) : workspaces.length === 0 ? (
            <MenuItem value="">No workspaces available</MenuItem>
          ) : (
            [
              <MenuItem key="all-workspaces" value="">
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    All Workspaces
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: 11 }}>
                    View all data
                  </Typography>
                </Box>
              </MenuItem>,
              ...workspaces.map((workspace) => (
                <MenuItem key={workspace.id} value={workspace.id}>
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {workspace.name}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: 11 }}>
                      {workspace.is_default ? 'Default' : 'Workspace'}
                    </Typography>
                  </Box>
                </MenuItem>
              )),
            ]
          )}
        </Select>
      </FormControl>
      <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: 11 }}>
        Selected: {currentWorkspaceName}
      </Typography>
    </Box>
  );
}
