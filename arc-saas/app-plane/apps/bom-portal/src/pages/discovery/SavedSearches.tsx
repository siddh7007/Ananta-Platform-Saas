/**
 * SavedSearches Component
 *
 * Save/load search queries with filter state.
 * Stores searches in localStorage with name and description.
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
} from '@mui/material';
import BookmarkIcon from '@mui/icons-material/Bookmark';
import BookmarkBorderIcon from '@mui/icons-material/BookmarkBorder';
import DeleteIcon from '@mui/icons-material/Delete';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import SearchIcon from '@mui/icons-material/Search';
import type { ComponentFilterState } from './ComponentFilters';

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
  const [searchName, setSearchName] = useState('');
  const [searchDescription, setSearchDescription] = useState('');
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [selectedSearchId, setSelectedSearchId] = useState<string | null>(null);

  // Load saved searches from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        setSearches(JSON.parse(stored));
      } catch (e) {
        console.error('Failed to parse saved searches', e);
      }
    }
  }, []);

  // Save to localStorage when searches change
  const persistSearches = (updatedSearches: SavedSearch[]) => {
    setSearches(updatedSearches);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedSearches));
    } catch (e) {
      // Handle quota exceeded or other localStorage errors
      console.error('Failed to save searches to localStorage:', e);
    }
  };

  const handleSave = () => {
    if (!searchName.trim()) return;

    const newSearch: SavedSearch = {
      id: Date.now().toString(),
      name: searchName.trim(),
      description: searchDescription.trim() || undefined,
      query: currentQuery,
      searchType: currentSearchType,
      filters: currentFilters,
      createdAt: new Date().toISOString(),
    };

    persistSearches([newSearch, ...searches]);
    setSaveDialogOpen(false);
    setSearchName('');
    setSearchDescription('');
  };

  const handleDelete = (id: string) => {
    persistSearches(searches.filter((s) => s.id !== id));
    setMenuAnchor(null);
    setSelectedSearchId(null);
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
        <List dense disablePadding>
          {searches.map((search) => (
            <ListItem
              key={search.id}
              button
              onClick={() => onLoadSearch(search)}
              sx={{
                borderRadius: 1,
                mb: 0.5,
                '&:hover': { bgcolor: 'action.hover' },
              }}
            >
              <BookmarkIcon
                sx={{ mr: 1.5, fontSize: 18, color: 'primary.main' }}
              />
              <ListItemText
                primary={
                  <Typography variant="body2" fontWeight={600} noWrap>
                    {search.name}
                  </Typography>
                }
                secondary={
                  <Box>
                    <Typography variant="caption" color="text.secondary" noWrap>
                      "{search.query}" ({search.searchType})
                    </Typography>
                    <br />
                    <Typography variant="caption" color="text.secondary">
                      {getFilterSummary(search.filters)}
                    </Typography>
                  </Box>
                }
              />
              <ListItemSecondaryAction>
                <IconButton
                  size="small"
                  onClick={(e) => handleMenuOpen(e, search.id)}
                >
                  <MoreVertIcon fontSize="small" />
                </IconButton>
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
      >
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
      >
        <DialogTitle>Save Search</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            <TextField
              autoFocus
              label="Search Name"
              placeholder="e.g., Active MCUs under $5"
              value={searchName}
              onChange={(e) => setSearchName(e.target.value)}
              fullWidth
              sx={{ mb: 2 }}
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
            />
            <Divider sx={{ my: 2 }} />
            <Typography variant="caption" color="text.secondary" gutterBottom>
              Search Preview:
            </Typography>
            <Box sx={{ mt: 1 }}>
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
    </Box>
  );
}

export default SavedSearches;
