/**
 * VaultSavedSearches Component
 *
 * Simplified saved searches for OrganizationComponentVault and ProjectComponentCatalog.
 * Stores search text and filter selections (project, BOM, category).
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Chip,
  Tooltip,
  Menu,
  MenuItem,
  Snackbar,
  Alert,
} from '@mui/material';
import BookmarkIcon from '@mui/icons-material/Bookmark';
import BookmarkBorderIcon from '@mui/icons-material/BookmarkBorder';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import SearchIcon from '@mui/icons-material/Search';

const MAX_NAME_LENGTH = 50;
const MAX_SAVED_SEARCHES = 50;

export interface VaultSearchFilters {
  searchText: string;
  projectId: string;
  bomId: string;
  category: string;
}

export interface VaultSavedSearch {
  id: string;
  name: string;
  description?: string;
  filters: VaultSearchFilters;
  createdAt: string;
}

interface VaultSavedSearchesProps {
  currentFilters: VaultSearchFilters;
  onLoadSearch: (search: VaultSavedSearch) => void;
  storageKey: string; // Different storage key for each page
}

function isValidVaultSearch(obj: unknown): obj is VaultSavedSearch {
  if (!obj || typeof obj !== 'object') return false;
  const s = obj as Record<string, unknown>;
  return (
    typeof s.id === 'string' &&
    typeof s.name === 'string' &&
    typeof s.createdAt === 'string' &&
    s.filters !== null &&
    typeof s.filters === 'object' &&
    typeof (s.filters as Record<string, unknown>).searchText === 'string' &&
    typeof (s.filters as Record<string, unknown>).projectId === 'string' &&
    typeof (s.filters as Record<string, unknown>).bomId === 'string' &&
    typeof (s.filters as Record<string, unknown>).category === 'string'
  );
}

function sanitizeString(str: string): string {
  return str
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function VaultSavedSearches({
  currentFilters,
  onLoadSearch,
  storageKey,
}: VaultSavedSearchesProps) {
  const [searches, setSearches] = useState<VaultSavedSearch[]>([]);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingSearch, setEditingSearch] = useState<VaultSavedSearch | null>(null);
  const [searchName, setSearchName] = useState('');
  const [searchDescription, setSearchDescription] = useState('');
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [selectedSearchId, setSelectedSearchId] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  });

  // Load saved searches from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (!Array.isArray(parsed)) {
          throw new Error('Saved searches must be an array');
        }
        const validSearches = parsed.filter(isValidVaultSearch);
        if (validSearches.length !== parsed.length) {
          console.warn(`Filtered out ${parsed.length - validSearches.length} invalid saved searches`);
        }
        setSearches(validSearches);
      } catch (e) {
        console.error('Failed to parse saved searches', e);
        localStorage.removeItem(storageKey);
        setSnackbar({ open: true, message: 'Saved searches were corrupted and have been cleared', severity: 'error' });
      }
    }
  }, [storageKey]);

  const persistSearches = (updatedSearches: VaultSavedSearch[], successMessage?: string): boolean => {
    setSearches(updatedSearches);
    try {
      localStorage.setItem(storageKey, JSON.stringify(updatedSearches));
      if (successMessage) {
        setSnackbar({ open: true, message: successMessage, severity: 'success' });
      }
      return true;
    } catch (e) {
      console.error('Failed to save searches', e);
      setSnackbar({ open: true, message: 'Failed to save search', severity: 'error' });
      return false;
    }
  };

  const handleSave = () => {
    if (!searchName.trim()) return;

    if (searches.length >= MAX_SAVED_SEARCHES) {
      setSnackbar({ open: true, message: `Maximum ${MAX_SAVED_SEARCHES} saved searches reached`, severity: 'error' });
      return;
    }

    const newSearch: VaultSavedSearch = {
      id: `vault-search-${Date.now()}`,
      name: searchName.trim(),
      description: searchDescription.trim() || undefined,
      filters: currentFilters,
      createdAt: new Date().toISOString(),
    };

    const updated = [...searches, newSearch];
    if (persistSearches(updated, 'Search saved successfully')) {
      setSaveDialogOpen(false);
      setSearchName('');
      setSearchDescription('');
    }
  };

  const handleEdit = (search: VaultSavedSearch) => {
    setEditingSearch(search);
    setSearchName(search.name);
    setSearchDescription(search.description || '');
    setEditDialogOpen(true);
    handleMenuClose();
  };

  const handleEditSave = () => {
    if (!editingSearch || !searchName.trim()) return;

    const updated = searches.map((s) =>
      s.id === editingSearch.id
        ? { ...s, name: searchName.trim(), description: searchDescription.trim() || undefined }
        : s
    );

    if (persistSearches(updated, 'Search updated successfully')) {
      setEditDialogOpen(false);
      setEditingSearch(null);
      setSearchName('');
      setSearchDescription('');
    }
  };

  const handleDelete = (id: string) => {
    const updated = searches.filter((s) => s.id !== id);
    persistSearches(updated, 'Search deleted successfully');
    handleMenuClose();
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, id: string) => {
    event.stopPropagation();
    setMenuAnchor(event.currentTarget);
    setSelectedSearchId(id);
  };

  const handleMenuClose = () => {
    setMenuAnchor(null);
    setSelectedSearchId(null);
  };

  const formatRelativeTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;

    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getFilterSummary = (filters: VaultSearchFilters) => {
    const parts: string[] = [];
    if (filters.searchText) parts.push(`"${filters.searchText}"`);
    if (filters.projectId && filters.projectId !== 'all') parts.push('Project filtered');
    if (filters.bomId && filters.bomId !== 'all') parts.push('BOM filtered');
    if (filters.category && filters.category !== 'all') parts.push('Category filtered');
    return parts.length ? parts.join(', ') : 'No filters';
  };

  const canSave = currentFilters.searchText.trim().length > 0 ||
    (currentFilters.projectId && currentFilters.projectId !== 'all') ||
    (currentFilters.bomId && currentFilters.bomId !== 'all') ||
    (currentFilters.category && currentFilters.category !== 'all');

  return (
    <Box>
      {/* Save Current Search Button */}
      <Box sx={{ mb: 2 }}>
        <Button
          variant="outlined"
          startIcon={<BookmarkBorderIcon />}
          onClick={() => setSaveDialogOpen(true)}
          disabled={!canSave}
          fullWidth
          size="small"
        >
          Save Current Search
        </Button>
      </Box>

      {/* Saved Searches List */}
      {searches.length > 0 ? (
        <List dense disablePadding aria-label="Saved vault searches">
          {searches.map((search) => (
            <ListItem
              key={search.id}
              button
              onClick={() => onLoadSearch(search)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  e.stopPropagation();
                  onLoadSearch(search);
                }
              }}
              sx={{
                borderRadius: 1,
                mb: 0.5,
                '&:hover': { bgcolor: 'action.hover' },
              }}
              aria-label={`Load search: ${search.name}`}
            >
              <BookmarkIcon
                sx={{ mr: 1.5, fontSize: 18, color: 'primary.main' }}
                aria-hidden="true"
              />
              <ListItemText
                primary={
                  <Typography variant="body2" fontWeight={600} noWrap>
                    {search.name}
                  </Typography>
                }
                secondary={
                  <React.Fragment>
                    {search.description && (
                      <Typography variant="caption" color="text.secondary" component="span" sx={{ display: 'block' }} noWrap>
                        {sanitizeString(search.description)}
                      </Typography>
                    )}
                    <Typography variant="caption" color="text.secondary" component="span" sx={{ display: 'block' }} noWrap>
                      {getFilterSummary(search.filters)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" component="span" sx={{ display: 'block' }}>
                      {formatRelativeTime(search.createdAt)}
                    </Typography>
                  </React.Fragment>
                }
                secondaryTypographyProps={{ component: 'div' }}
              />
              <ListItemSecondaryAction>
                <Tooltip title={`Actions for ${search.name}`}>
                  <IconButton
                    size="small"
                    onClick={(e) => handleMenuOpen(e, search.id)}
                    aria-label={`Actions for ${search.name}`}
                    aria-haspopup="true"
                  >
                    <MoreVertIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </ListItemSecondaryAction>
            </ListItem>
          ))}
        </List>
      ) : (
        <Box sx={{ textAlign: 'center', py: 3 }}>
          <SearchIcon sx={{ fontSize: 32, color: 'text.disabled', mb: 1 }} />
          <Typography variant="body2" color="text.secondary">
            No saved searches yet
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Apply filters, then save for quick access
          </Typography>
        </Box>
      )}

      {/* Context Menu */}
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={handleMenuClose}
        aria-label="Search actions"
      >
        <MenuItem
          onClick={() => {
            const search = searches.find((s) => s.id === selectedSearchId);
            if (search) handleEdit(search);
          }}
        >
          <EditIcon fontSize="small" sx={{ mr: 1 }} />
          Edit
        </MenuItem>
        <MenuItem
          onClick={() => selectedSearchId && handleDelete(selectedSearchId)}
        >
          <DeleteIcon fontSize="small" sx={{ mr: 1 }} />
          Delete
        </MenuItem>
      </Menu>

      {/* Save Dialog */}
      <Dialog
        open={saveDialogOpen}
        onClose={() => setSaveDialogOpen(false)}
        maxWidth="xs"
        fullWidth
        aria-labelledby="save-search-dialog-title"
      >
        <DialogTitle id="save-search-dialog-title">Save Vault Search</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            <TextField
              autoFocus
              label="Search Name"
              placeholder="e.g., Active STM32 parts"
              value={searchName}
              onChange={(e) => setSearchName(e.target.value.slice(0, MAX_NAME_LENGTH))}
              fullWidth
              sx={{ mb: 2 }}
              error={searchName.length >= MAX_NAME_LENGTH}
              helperText={`${searchName.length}/${MAX_NAME_LENGTH} characters`}
              inputProps={{ 'aria-label': 'Search name', maxLength: MAX_NAME_LENGTH }}
            />
            <TextField
              label="Description (optional)"
              placeholder="Brief description of this search"
              value={searchDescription}
              onChange={(e) => setSearchDescription(e.target.value)}
              fullWidth
              multiline
              rows={2}
              sx={{ mb: 2 }}
              inputProps={{ 'aria-label': 'Search description' }}
            />
            <Typography variant="caption" color="text.secondary" gutterBottom>
              Filter Summary:
            </Typography>
            <Box sx={{ mt: 1 }}>
              <Chip
                label={getFilterSummary(currentFilters)}
                size="small"
                variant="outlined"
              />
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSaveDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={!searchName.trim()}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog
        open={editDialogOpen}
        onClose={() => {
          setEditDialogOpen(false);
          setEditingSearch(null);
          setSearchName('');
          setSearchDescription('');
        }}
        maxWidth="xs"
        fullWidth
        aria-labelledby="edit-search-dialog-title"
      >
        <DialogTitle id="edit-search-dialog-title">Edit Search</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            <TextField
              autoFocus
              label="Search Name"
              value={searchName}
              onChange={(e) => setSearchName(e.target.value.slice(0, MAX_NAME_LENGTH))}
              fullWidth
              sx={{ mb: 2 }}
              error={searchName.length >= MAX_NAME_LENGTH}
              helperText={`${searchName.length}/${MAX_NAME_LENGTH} characters`}
              inputProps={{ 'aria-label': 'Search name', maxLength: MAX_NAME_LENGTH }}
            />
            <TextField
              label="Description (optional)"
              value={searchDescription}
              onChange={(e) => setSearchDescription(e.target.value)}
              fullWidth
              multiline
              rows={2}
              inputProps={{ 'aria-label': 'Search description' }}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setEditDialogOpen(false);
              setEditingSearch(null);
              setSearchName('');
              setSearchDescription('');
            }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleEditSave}
            disabled={!searchName.trim()}
          >
            Update
          </Button>
        </DialogActions>
      </Dialog>

      {/* Feedback Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
          role="status"
          aria-live="polite"
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

export default VaultSavedSearches;
