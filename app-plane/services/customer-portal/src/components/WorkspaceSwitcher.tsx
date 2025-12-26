/**
 * Workspace Switcher
 *
 * Searchable modal for switching between workspaces within an organization.
 *
 * Features:
 * - Search/filter workspaces by name
 * - Shows role and default indicator per workspace
 * - Current workspace indicator (star)
 * - Create new workspace option (admin only)
 * - Keyboard navigation (arrows + enter)
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  TextField,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  InputAdornment,
  Box,
  Chip,
  Typography,
  Divider,
  Button,
  CircularProgress,
  Alert,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import SearchIcon from '@mui/icons-material/Search';
import FolderIcon from '@mui/icons-material/Folder';
import StarIcon from '@mui/icons-material/Star';
import AddIcon from '@mui/icons-material/Add';
import HomeIcon from '@mui/icons-material/Home';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { useOrganization } from '../contexts/OrganizationContext';
import { Workspace, WorkspaceRole } from '../services/workspaceService';

// =====================================================
// Types
// =====================================================

interface WorkspaceSwitcherProps {
  open: boolean;
  onClose: () => void;
  onSwitch?: (workspace: Workspace) => void;
  onCreateNew?: () => void;
}

// =====================================================
// Helpers
// =====================================================

const ROLE_COLORS: Record<WorkspaceRole, 'primary' | 'secondary' | 'default' | 'info'> = {
  admin: 'primary',
  engineer: 'secondary',
  analyst: 'info',
  viewer: 'default',
};

const ROLE_LABELS: Record<WorkspaceRole, string> = {
  admin: 'Admin',
  engineer: 'Engineer',
  analyst: 'Analyst',
  viewer: 'Viewer',
};

// =====================================================
// Component
// =====================================================

export function WorkspaceSwitcher({
  open,
  onClose,
  onSwitch,
  onCreateNew,
}: WorkspaceSwitcherProps) {
  const {
    currentWorkspace,
    workspaces,
    isLoading,
    error,
    switchWorkspace,
    refreshWorkspaces,
    permissions,
  } = useWorkspace();

  const { currentOrg } = useOrganization();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isSwitching, setIsSwitching] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Filter workspaces by search query
  const filteredWorkspaces = useMemo(() => {
    if (!searchQuery.trim()) {
      return workspaces;
    }
    const query = searchQuery.toLowerCase();
    return workspaces.filter(
      (ws) =>
        ws.name.toLowerCase().includes(query) ||
        ws.slug?.toLowerCase().includes(query) ||
        ws.description?.toLowerCase().includes(query)
    );
  }, [workspaces, searchQuery]);

  // Stable key for filtered workspaces (detects content changes, not just length)
  const filteredWorkspacesKey = useMemo(
    () => filteredWorkspaces.map((ws) => ws.id).join(','),
    [filteredWorkspaces]
  );

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setSearchQuery('');
      setSelectedIndex(0);
      // Focus search input after modal opens
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }
  }, [open]);

  // Reset selected index when filtered list changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [filteredWorkspacesKey]);

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < filteredWorkspaces.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : prev));
        break;
      case 'Enter':
        e.preventDefault();
        if (filteredWorkspaces[selectedIndex]) {
          handleSelectWorkspace(filteredWorkspaces[selectedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        onClose();
        break;
    }
  };

  // Handle workspace selection
  const handleSelectWorkspace = async (workspace: Workspace) => {
    // Don't switch if already selected
    if (workspace.id === currentWorkspace?.id) {
      onClose();
      return;
    }

    setIsSwitching(true);
    try {
      await switchWorkspace(workspace.id);
      onSwitch?.(workspace);
      onClose();
    } catch (err) {
      console.error('Failed to switch workspace:', err);
    } finally {
      setIsSwitching(false);
    }
  };

  // Handle create new workspace
  const handleCreateNew = () => {
    onCreateNew?.();
    onClose();
  };

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current && filteredWorkspaces.length > 0) {
      const selectedItem = listRef.current.children[selectedIndex] as HTMLElement;
      selectedItem?.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex, filteredWorkspaces.length, filteredWorkspacesKey]);

  // Can create new workspace if org admin/owner or has workspace management permission
  const canCreateWorkspace = permissions.canManageWorkspace;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: { maxHeight: '80vh' },
      }}
    >
      <DialogTitle sx={{ pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <FolderIcon color="primary" />
          <Typography variant="h6" component="span">
            Switch Workspace
          </Typography>
          {currentOrg && (
            <Chip
              label={currentOrg.name}
              size="small"
              variant="outlined"
              sx={{ ml: 'auto' }}
            />
          )}
        </Box>
      </DialogTitle>

      <DialogContent sx={{ pt: 1 }}>
        {/* Search Input */}
        <TextField
          inputRef={searchInputRef}
          fullWidth
          placeholder="Search workspaces..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          size="small"
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon color="action" />
              </InputAdornment>
            ),
          }}
          sx={{ mb: 2 }}
        />

        {/* Error State */}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
            <Button size="small" onClick={refreshWorkspaces} sx={{ ml: 1 }}>
              Retry
            </Button>
          </Alert>
        )}

        {/* Loading State */}
        {isLoading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        )}

        {/* Empty State */}
        {!isLoading && workspaces.length === 0 && (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography color="text.secondary" gutterBottom>
              No workspaces found in this organization.
            </Typography>
            {canCreateWorkspace && (
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={handleCreateNew}
                sx={{ mt: 2 }}
              >
                Create Your First Workspace
              </Button>
            )}
          </Box>
        )}

        {/* No Search Results */}
        {!isLoading && workspaces.length > 0 && filteredWorkspaces.length === 0 && (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography color="text.secondary">
              No workspaces match "{searchQuery}"
            </Typography>
          </Box>
        )}

        {/* Workspaces List */}
        {!isLoading && filteredWorkspaces.length > 0 && (
          <List ref={listRef} sx={{ mx: -2 }}>
            {filteredWorkspaces.map((workspace, index) => {
              const isSelected = index === selectedIndex;
              const isCurrent = workspace.id === currentWorkspace?.id;
              const role = workspace.role || 'viewer';

              return (
                <ListItemButton
                  key={workspace.id}
                  selected={isSelected}
                  onClick={() => handleSelectWorkspace(workspace)}
                  disabled={isSwitching}
                  sx={(theme) => ({
                    borderRadius: 1,
                    mx: 1,
                    mb: 0.5,
                    bgcolor: isCurrent ? alpha(theme.palette.primary.main, 0.08) : undefined,
                    '&.Mui-selected': {
                      bgcolor: isCurrent ? alpha(theme.palette.primary.main, 0.12) : 'action.selected',
                    },
                  })}
                >
                  <ListItemIcon sx={{ minWidth: 40 }}>
                    {isCurrent ? (
                      <StarIcon color="primary" />
                    ) : workspace.is_default ? (
                      <HomeIcon color="action" />
                    ) : (
                      <FolderIcon color="action" />
                    )}
                  </ListItemIcon>

                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography
                          variant="body1"
                          fontWeight={isCurrent ? 600 : 400}
                        >
                          {workspace.name}
                        </Typography>
                        {workspace.is_default && (
                          <Chip
                            label="Default"
                            size="small"
                            variant="outlined"
                            sx={{ height: 20, fontSize: 11 }}
                          />
                        )}
                        <Chip
                          label={ROLE_LABELS[role]}
                          size="small"
                          color={ROLE_COLORS[role]}
                          sx={{ height: 20, fontSize: 11 }}
                        />
                      </Box>
                    }
                    secondary={
                      <Box
                        component="span"
                        sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}
                      >
                        {workspace.description && (
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              maxWidth: 250,
                            }}
                          >
                            {workspace.description}
                          </Typography>
                        )}
                        {workspace.slug && (
                          <>
                            {workspace.description && (
                              <Typography variant="caption" color="text.disabled">
                                •
                              </Typography>
                            )}
                            <Typography variant="caption" color="text.disabled">
                              {workspace.slug}
                            </Typography>
                          </>
                        )}
                      </Box>
                    }
                  />

                  {isSwitching && isSelected && (
                    <CircularProgress size={20} sx={{ ml: 1 }} />
                  )}
                </ListItemButton>
              );
            })}
          </List>
        )}

        {/* Create New Workspace */}
        {!isLoading && workspaces.length > 0 && canCreateWorkspace && (
          <>
            <Divider sx={{ my: 2 }} />
            <Button
              fullWidth
              variant="outlined"
              startIcon={<AddIcon />}
              onClick={handleCreateNew}
              disabled={isSwitching}
            >
              Create New Workspace
            </Button>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

// =====================================================
// Create Workspace Dialog
// =====================================================

interface CreateWorkspaceDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated?: (workspace: Workspace) => void;
}

export function CreateWorkspaceDialog({
  open,
  onClose,
  onCreated,
}: CreateWorkspaceDialogProps) {
  const { createWorkspace } = useWorkspace();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setName('');
      setDescription('');
      setError(null);
    }
  }, [open]);

  const handleCreate = async () => {
    if (!name.trim()) {
      setError('Workspace name is required');
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      const newWorkspace = await createWorkspace(name.trim(), description.trim() || undefined, true);
      onCreated?.(newWorkspace);
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create workspace';
      setError(message);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Create New Workspace</DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <TextField
          autoFocus
          fullWidth
          label="Workspace Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={isCreating}
          sx={{ mb: 2, mt: 1 }}
          helperText="e.g., Hardware Team, Product Development"
        />

        <TextField
          fullWidth
          label="Description (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          disabled={isCreating}
          multiline
          rows={2}
          helperText="Brief description of this workspace's purpose"
        />

        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 3 }}>
          <Button onClick={onClose} disabled={isCreating}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleCreate}
            disabled={isCreating || !name.trim()}
            startIcon={isCreating ? <CircularProgress size={16} /> : <AddIcon />}
          >
            {isCreating ? 'Creating...' : 'Create Workspace'}
          </Button>
        </Box>
      </DialogContent>
    </Dialog>
  );
}

export default WorkspaceSwitcher;
