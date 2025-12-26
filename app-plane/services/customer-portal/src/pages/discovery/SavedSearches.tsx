/**
 * SavedSearches Component
 *
 * Save/load search queries with filter state.
 * Stores searches in localStorage with name and description.
 *
 * P1-3: Enhanced with accessibility, edit, and timestamp features.
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
  Divider,
  Snackbar,
  Alert,
} from '@mui/material';
import BookmarkIcon from '@mui/icons-material/Bookmark';
import BookmarkBorderIcon from '@mui/icons-material/BookmarkBorder';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import SearchIcon from '@mui/icons-material/Search';
import type { ComponentFilterState } from './ComponentFilters';

/** Maximum length for search name */
const MAX_NAME_LENGTH = 50;

/** Maximum number of saved searches to prevent localStorage bloat */
const MAX_SAVED_SEARCHES = 50;

/**
 * Validates a SavedSearch object has required fields with correct types.
 * Protects against localStorage injection attacks.
 */
function isValidSavedSearch(obj: unknown): obj is SavedSearch {
  if (!obj || typeof obj !== 'object') return false;
  const s = obj as Record<string, unknown>;
  return (
    typeof s.id === 'string' &&
    typeof s.name === 'string' &&
    typeof s.query === 'string' &&
    typeof s.searchType === 'string' &&
    typeof s.createdAt === 'string' &&
    s.filters !== null &&
    typeof s.filters === 'object' &&
    Array.isArray((s.filters as Record<string, unknown>).suppliers) &&
    Array.isArray((s.filters as Record<string, unknown>).lifecycleStatuses) &&
    Array.isArray((s.filters as Record<string, unknown>).complianceFlags) &&
    Array.isArray((s.filters as Record<string, unknown>).priceRange) &&
    Array.isArray((s.filters as Record<string, unknown>).riskLevels)
  );
}

/**
 * Sanitize string for safe display - removes potential XSS vectors
 */
function sanitizeString(str: string): string {
  return str
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export interface SavedSearch {
  id: string;
  name: string;
  description?: string;
  query: string;
  searchType: string;
  filters: ComponentFilterState;
  createdAt: string;
}

interface SavedSearchesProps {
  currentQuery: string;
  currentSearchType: string;
  currentFilters: ComponentFilterState;
  onLoadSearch: (search: SavedSearch) => void;
}

const STORAGE_KEY = 'component_saved_searches';

export function SavedSearches({
  currentQuery,
  currentSearchType,
  currentFilters,
  onLoadSearch,
}: SavedSearchesProps) {
  const [searches, setSearches] = useState<SavedSearch[]>([]);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingSearch, setEditingSearch] = useState<SavedSearch | null>(null);
  const [searchName, setSearchName] = useState('');
  const [searchDescription, setSearchDescription] = useState('');
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [selectedSearchId, setSelectedSearchId] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  });

  // Load saved searches from localStorage with validation
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (!Array.isArray(parsed)) {
          throw new Error('Saved searches must be an array');
        }
        // Validate each search object to prevent injection attacks
        const validSearches = parsed.filter(isValidSavedSearch);
        if (validSearches.length !== parsed.length) {
          console.warn(`Filtered out ${parsed.length - validSearches.length} invalid saved searches`);
        }
        setSearches(validSearches);
      } catch (e) {
        console.error('Failed to parse saved searches', e);
        // Clear corrupted data
        localStorage.removeItem(STORAGE_KEY);
        setSnackbar({ open: true, message: 'Saved searches were corrupted and have been cleared', severity: 'error' });
      }
    }
  }, []);

  // Save to localStorage when searches change
  const persistSearches = (updatedSearches: SavedSearch[], successMessage?: string): boolean => {
    setSearches(updatedSearches);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedSearches));
      if (successMessage) {
        setSnackbar({ open: true, message: successMessage, severity: 'success' });
      }
      return true;
    } catch (e) {
      // Handle quota exceeded or other localStorage errors
      console.error('Failed to save searches to localStorage:', e);
      setSnackbar({ open: true, message: 'Failed to save - storage quota exceeded', severity: 'error' });
      return false;
    }
  };

  const handleSave = () => {
    if (!searchName.trim() || searchName.length > MAX_NAME_LENGTH) return;

    // Check max saved searches limit
    if (searches.length >= MAX_SAVED_SEARCHES) {
      setSnackbar({
        open: true,
        message: `Maximum ${MAX_SAVED_SEARCHES} saved searches reached. Delete some to add more.`,
        severity: 'error',
      });
      return;
    }

    const newSearch: SavedSearch = {
      id: crypto.randomUUID(),
      name: searchName.trim(),
      description: searchDescription.trim() || undefined,
      query: currentQuery,
      searchType: currentSearchType,
      filters: currentFilters,
      createdAt: new Date().toISOString(),
    };

    const success = persistSearches([newSearch, ...searches], `Search "${searchName.trim()}" saved`);
    if (success) {
      setSaveDialogOpen(false);
      setSearchName('');
      setSearchDescription('');
    }
  };

  const handleEdit = (search: SavedSearch) => {
    setEditingSearch(search);
    setSearchName(search.name);
    setSearchDescription(search.description || '');
    setEditDialogOpen(true);
    handleMenuClose();
  };

  const handleEditSave = () => {
    if (!editingSearch || !searchName.trim() || searchName.length > MAX_NAME_LENGTH) return;

    const updatedSearches = searches.map((s) =>
      s.id === editingSearch.id
        ? { ...s, name: searchName.trim(), description: searchDescription.trim() || undefined }
        : s
    );

    persistSearches(updatedSearches, `Search "${searchName.trim()}" updated`);
    setEditDialogOpen(false);
    setEditingSearch(null);
    setSearchName('');
    setSearchDescription('');
  };

  const handleDelete = (id: string) => {
    const search = searches.find((s) => s.id === id);
    persistSearches(searches.filter((s) => s.id !== id), search ? `Search "${search.name}" deleted` : 'Search deleted');
    setMenuAnchor(null);
    setSelectedSearchId(null);
  };

  // Format relative timestamp with validation
  const formatRelativeTime = (dateString: string): string => {
    const date = new Date(dateString);

    // Validate date is valid
    if (isNaN(date.getTime())) {
      return 'Unknown';
    }

    const now = new Date();
    const diff = now.getTime() - date.getTime();

    // Handle negative diff (future dates from clock skew)
    if (diff < 0) return 'Just now';

    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;

    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
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

  const getFilterSummary = (filters: ComponentFilterState) => {
    const parts: string[] = [];
    if (filters.suppliers.length) parts.push(`${filters.suppliers.length} suppliers`);
    if (filters.lifecycleStatuses.length) parts.push(`${filters.lifecycleStatuses.length} lifecycle`);
    if (filters.complianceFlags.length) parts.push(`${filters.complianceFlags.length} compliance`);
    if (filters.riskLevels.length) parts.push(`${filters.riskLevels.length} risk`);
    return parts.length ? parts.join(', ') : 'No filters';
  };

  const canSave = currentQuery.trim().length > 0;

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
        >
          Save Current Search
        </Button>
      </Box>

      {/* Saved Searches List */}
      {searches.length > 0 ? (
        <List dense disablePadding aria-label="Saved searches">
          {searches.map((search) => (
            <ListItem
              key={search.id}
              button
              onClick={() => onLoadSearch(search)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  e.stopPropagation(); // Prevent space from scrolling page
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
                      "{sanitizeString(search.query)}" ({search.searchType})
                    </Typography>
                    <Typography variant="caption" color="text.secondary" component="span" sx={{ display: 'block' }}>
                      {getFilterSummary(search.filters)} • {formatRelativeTime(search.createdAt)}
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
            Search for components, then save your search for quick access
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
        <DialogTitle id="save-search-dialog-title">Save Search</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            <TextField
              autoFocus
              label="Search Name"
              placeholder="e.g., Active MCUs under $5"
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
            <Divider sx={{ my: 2 }} />
            <Typography variant="caption" color="text.secondary" gutterBottom>
              Search Preview:
            </Typography>
            <Box sx={{ mt: 1, maxHeight: 100, overflow: 'auto' }}>
              <Chip
                label={`Query: "${currentQuery}"`}
                size="small"
                sx={{ mr: 0.5, mb: 0.5 }}
              />
              <Chip
                label={`Type: ${currentSearchType}`}
                size="small"
                sx={{ mr: 0.5, mb: 0.5 }}
              />
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

export default SavedSearches;
