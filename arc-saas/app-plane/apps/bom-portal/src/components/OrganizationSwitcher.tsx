/**
 * Organization Switcher
 *
 * Searchable modal for switching between organizations.
 * Implements Step 8 requirement: "searchable modal showing metrics per org"
 *
 * Features:
 * - Search/filter organizations by name
 * - Shows plan type, role, member count per org
 * - Current org indicator (star)
 * - Create new organization option
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
import BusinessIcon from '@mui/icons-material/Business';
import StarIcon from '@mui/icons-material/Star';
import AddIcon from '@mui/icons-material/Add';
import GroupIcon from '@mui/icons-material/Group';
import { useOrganization } from '../contexts/OrganizationContext';
import { Organization, OrgRole, PlanType } from '../services/organizationsApi';

// =====================================================
// Types
// =====================================================

interface OrganizationSwitcherProps {
  open: boolean;
  onClose: () => void;
  onSwitch?: (org: Organization) => void;
  onCreateNew?: () => void;
}

// =====================================================
// Helpers
// =====================================================

const PLAN_COLORS: Record<PlanType, 'default' | 'primary' | 'secondary'> = {
  free: 'default',
  professional: 'primary',
  enterprise: 'secondary',
};

const PLAN_LABELS: Record<PlanType, string> = {
  free: 'Free',
  professional: 'Pro',
  enterprise: 'Enterprise',
};

const ROLE_LABELS: Record<OrgRole, string> = {
  owner: 'Owner',
  super_admin: 'Super Admin',
  billing_admin: 'Billing Admin',
  admin: 'Admin',
  member: 'Member',
  engineer: 'Engineer',
  analyst: 'Analyst',
  viewer: 'Viewer',
};

// =====================================================
// Component
// =====================================================

export function OrganizationSwitcher({
  open,
  onClose,
  onSwitch,
  onCreateNew,
}: OrganizationSwitcherProps) {
  const {
    currentOrg,
    organizations,
    isLoading,
    error,
    switchOrganization,
    refreshOrganizations,
  } = useOrganization();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isSwitching, setIsSwitching] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Filter organizations by search query
  const filteredOrgs = useMemo(() => {
    if (!searchQuery.trim()) {
      return organizations;
    }
    const query = searchQuery.toLowerCase();
    return organizations.filter(
      (org) =>
        org.name.toLowerCase().includes(query) ||
        org.slug?.toLowerCase().includes(query)
    );
  }, [organizations, searchQuery]);

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
  }, [filteredOrgs.length]);

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < filteredOrgs.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : prev));
        break;
      case 'Enter':
        e.preventDefault();
        if (filteredOrgs[selectedIndex]) {
          handleSelectOrg(filteredOrgs[selectedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        onClose();
        break;
    }
  };

  // Handle org selection
  const handleSelectOrg = async (org: Organization) => {
    // Don't switch if already selected
    if (org.id === currentOrg?.id) {
      onClose();
      return;
    }

    setIsSwitching(true);
    try {
      await switchOrganization(org.id);
      onSwitch?.(org);
      onClose();
    } catch (err) {
      console.error('Failed to switch organization:', err);
    } finally {
      setIsSwitching(false);
    }
  };

  // Handle create new org
  const handleCreateNew = () => {
    onCreateNew?.();
    onClose();
  };

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current && filteredOrgs.length > 0) {
      const selectedItem = listRef.current.children[selectedIndex] as HTMLElement;
      selectedItem?.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex, filteredOrgs.length]);

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
          <BusinessIcon color="primary" />
          <Typography variant="h6" component="span">
            Switch Organization
          </Typography>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ pt: 1 }}>
        {/* Search Input */}
        <TextField
          inputRef={searchInputRef}
          fullWidth
          placeholder="Search organizations..."
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
            <Button size="small" onClick={refreshOrganizations} sx={{ ml: 1 }}>
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
        {!isLoading && organizations.length === 0 && (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography color="text.secondary" gutterBottom>
              You don't belong to any organizations yet.
            </Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleCreateNew}
              sx={{ mt: 2 }}
            >
              Create Your First Organization
            </Button>
          </Box>
        )}

        {/* No Search Results */}
        {!isLoading && organizations.length > 0 && filteredOrgs.length === 0 && (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography color="text.secondary">
              No organizations match "{searchQuery}"
            </Typography>
          </Box>
        )}

        {/* Organizations List */}
        {!isLoading && filteredOrgs.length > 0 && (
          <List ref={listRef} sx={{ mx: -2 }}>
            {filteredOrgs.map((org, index) => {
              const isSelected = index === selectedIndex;
              const isCurrent = org.id === currentOrg?.id;

              return (
                <ListItemButton
                  key={org.id}
                  selected={isSelected}
                  onClick={() => handleSelectOrg(org)}
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
                    ) : (
                      <BusinessIcon color="action" />
                    )}
                  </ListItemIcon>

                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography
                          variant="body1"
                          fontWeight={isCurrent ? 600 : 400}
                        >
                          {org.name}
                        </Typography>
                        <Chip
                          label={PLAN_LABELS[org.plan_type]}
                          size="small"
                          color={PLAN_COLORS[org.plan_type]}
                          sx={{ height: 20, fontSize: 11 }}
                        />
                      </Box>
                    }
                    secondary={
                      <Box
                        component="span"
                        sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}
                      >
                        <Typography variant="caption" color="text.secondary">
                          {ROLE_LABELS[org.role]}
                        </Typography>
                        {org.slug && (
                          <>
                            <Typography variant="caption" color="text.disabled">
                              •
                            </Typography>
                            <Typography variant="caption" color="text.disabled">
                              {org.slug}
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

        {/* Create New Organization */}
        {!isLoading && organizations.length > 0 && (
          <>
            <Divider sx={{ my: 2 }} />
            <Button
              fullWidth
              variant="outlined"
              startIcon={<AddIcon />}
              onClick={handleCreateNew}
              disabled={isSwitching}
            >
              Create New Organization
            </Button>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

// =====================================================
// Create Organization Dialog
// =====================================================

interface CreateOrganizationDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated?: (org: Organization) => void;
}

export function CreateOrganizationDialog({
  open,
  onClose,
  onCreated,
}: CreateOrganizationDialogProps) {
  const { createOrganization } = useOrganization();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setName('');
      setSlug('');
      setError(null);
    }
  }, [open]);

  // Auto-generate slug from name
  useEffect(() => {
    if (name && !slug) {
      const autoSlug = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .substring(0, 30);
      setSlug(autoSlug);
    }
  }, [name, slug]);

  const handleCreate = async () => {
    if (!name.trim()) {
      setError('Organization name is required');
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      const newOrg = await createOrganization(name.trim(), slug.trim() || undefined, true);
      onCreated?.(newOrg);
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create organization';
      setError(message);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Create New Organization</DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <TextField
          autoFocus
          fullWidth
          label="Organization Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={isCreating}
          sx={{ mb: 2, mt: 1 }}
          helperText="e.g., Acme Corporation"
        />

        <TextField
          fullWidth
          label="Slug (optional)"
          value={slug}
          onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
          disabled={isCreating}
          helperText="URL-friendly identifier. Auto-generated if left blank."
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
            {isCreating ? 'Creating...' : 'Create Organization'}
          </Button>
        </Box>
      </DialogContent>
    </Dialog>
  );
}

export default OrganizationSwitcher;
