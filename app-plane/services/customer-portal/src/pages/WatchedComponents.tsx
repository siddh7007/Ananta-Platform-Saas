/**
 * Watched Components Page
 *
 * Displays all components being watched by the current user.
 * Allows bulk management and editing of watch preferences.
 */

import React, { useState, useMemo } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Checkbox,
  IconButton,
  Chip,
  Stack,
  TextField,
  MenuItem,
  Tooltip,
  Alert,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import {
  Delete as DeleteIcon,
  Edit as EditIcon,
  ArrowBack as ArrowBackIcon,
  Visibility as WatchIcon,
  FilterList as FilterIcon,
  DeleteOutline as DeleteOutlineIcon,
  History as LifecycleIcon,
  TrendingUp as RiskIcon,
  AttachMoney as PriceIcon,
  Inventory as AvailabilityIcon,
  Gavel as ComplianceIcon,
  Article as PcnIcon,
  LocalShipping as SupplyChainIcon,
} from '@mui/icons-material';
import { useNotify } from 'react-admin';
import { WatchTypeSelector } from '../components/WatchTypeSelector';
import {
  useComponentWatches,
  useRemoveWatch,
  useUpdateWatchTypes,
  getEnabledWatchTypes,
  WatchType,
} from '../hooks';
import { ComponentWatch } from '../services/alertService';

const WATCH_TYPE_ICONS: Record<WatchType, React.ReactNode> = {
  lifecycle: <LifecycleIcon sx={{ fontSize: 16 }} />,
  risk: <RiskIcon sx={{ fontSize: 16 }} />,
  price: <PriceIcon sx={{ fontSize: 16 }} />,
  availability: <AvailabilityIcon sx={{ fontSize: 16 }} />,
  compliance: <ComplianceIcon sx={{ fontSize: 16 }} />,
  pcn: <PcnIcon sx={{ fontSize: 16 }} />,
  supply_chain: <SupplyChainIcon sx={{ fontSize: 16 }} />,
};

const WATCH_TYPE_LABELS: Record<WatchType, string> = {
  lifecycle: 'Lifecycle',
  risk: 'Risk',
  price: 'Price',
  availability: 'Stock',
  compliance: 'Compliance',
  pcn: 'PCN',
  supply_chain: 'Supply',
};

export const WatchedComponentsPage: React.FC = () => {
  const notify = useNotify();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [filterType, setFilterType] = useState<WatchType | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingWatch, setEditingWatch] = useState<ComponentWatch | null>(null);
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);

  // Hooks
  const { watches, loading, error, refetch } = useComponentWatches();
  const { removeWatch, removing } = useRemoveWatch({
    onSuccess: () => {
      notify('Watch removed successfully', { type: 'success' });
      refetch();
    },
    onError: (error) => {
      notify(error.message, { type: 'error' });
    },
  });
  const { updateWatchTypes, updating } = useUpdateWatchTypes({
    onSuccess: () => {
      notify('Watch preferences updated', { type: 'success' });
      setEditingWatch(null);
      refetch();
    },
    onError: (error) => {
      notify(error.message, { type: 'error' });
    },
  });

  // Filter and search watches
  const filteredWatches = useMemo(() => {
    return watches.filter(watch => {
      // Filter by watch type
      if (filterType !== 'all') {
        const enabledTypes = getEnabledWatchTypes(watch);
        if (!enabledTypes.includes(filterType)) {
          return false;
        }
      }

      // Filter by search query
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const mpn = watch.mpn?.toLowerCase() || '';
        const manufacturer = watch.manufacturer?.toLowerCase() || '';
        if (!mpn.includes(query) && !manufacturer.includes(query)) {
          return false;
        }
      }

      return true;
    });
  }, [watches, filterType, searchQuery]);

  const handleSelectAll = () => {
    if (selectedIds.size === filteredWatches.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredWatches.map(w => w.id)));
    }
  };

  const handleToggleSelection = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleRemoveWatch = async (watchId: string) => {
    await removeWatch(watchId);
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.delete(watchId);
      return next;
    });
  };

  const handleBulkDelete = async () => {
    try {
      const promises = Array.from(selectedIds).map(id => removeWatch(id));
      await Promise.all(promises);
      setSelectedIds(new Set());
      setBulkDeleteDialogOpen(false);
      notify(`Removed ${selectedIds.size} watches`, { type: 'success' });
    } catch (err) {
      notify('Failed to remove some watches', { type: 'error' });
    }
  };

  const handleEditWatch = (watch: ComponentWatch) => {
    setEditingWatch(watch);
  };

  const handleSaveWatchTypes = async (watchTypes: WatchType[]) => {
    if (editingWatch) {
      await updateWatchTypes(editingWatch.id, editingWatch.component_id, watchTypes);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Button
            component={RouterLink}
            to="/alerts"
            startIcon={<ArrowBackIcon />}
            variant="text"
          >
            Back to Alerts
          </Button>
          <Box>
            <Typography variant="h4" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <WatchIcon /> Watched Components
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Manage components you are watching for alerts
            </Typography>
          </Box>
        </Box>
        {selectedIds.size > 0 && (
          <Button
            variant="outlined"
            color="error"
            startIcon={<DeleteOutlineIcon />}
            onClick={() => setBulkDeleteDialogOpen(true)}
          >
            Remove {selectedIds.size} Selected
          </Button>
        )}
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
            <TextField
              placeholder="Search by MPN or manufacturer..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              size="small"
              sx={{ flex: 1 }}
            />
            <TextField
              select
              label="Filter by Type"
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as WatchType | 'all')}
              size="small"
              sx={{ minWidth: 200 }}
              InputProps={{
                startAdornment: <FilterIcon sx={{ mr: 1, color: 'text.secondary' }} />,
              }}
            >
              <MenuItem value="all">All Types</MenuItem>
              <MenuItem value="lifecycle">Lifecycle</MenuItem>
              <MenuItem value="risk">Risk Score</MenuItem>
              <MenuItem value="price">Price Changes</MenuItem>
              <MenuItem value="availability">Availability</MenuItem>
              <MenuItem value="compliance">Compliance</MenuItem>
              <MenuItem value="pcn">PCN/PDN</MenuItem>
              <MenuItem value="supply_chain">Supply Chain</MenuItem>
            </TextField>
          </Stack>
        </CardContent>
      </Card>

      {/* Watches Table */}
      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">
              {filteredWatches.length} Component{filteredWatches.length !== 1 ? 's' : ''}
            </Typography>
            {filteredWatches.length > 0 && (
              <Chip
                label={`${selectedIds.size} selected`}
                color={selectedIds.size > 0 ? 'primary' : 'default'}
                variant="outlined"
              />
            )}
          </Box>

          {filteredWatches.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 6 }}>
              <WatchIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
              <Typography variant="h6" color="text.secondary">
                {watches.length === 0 ? 'No watched components' : 'No components match filters'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {watches.length === 0
                  ? 'Start watching components to receive alerts about changes'
                  : 'Try adjusting your search or filter criteria'}
              </Typography>
            </Box>
          ) : (
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell padding="checkbox">
                      <Checkbox
                        checked={selectedIds.size === filteredWatches.length && filteredWatches.length > 0}
                        indeterminate={selectedIds.size > 0 && selectedIds.size < filteredWatches.length}
                        onChange={handleSelectAll}
                      />
                    </TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>MPN</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Manufacturer</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Watch Types</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Added</TableCell>
                    <TableCell sx={{ fontWeight: 700 }} align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredWatches.map((watch) => {
                    const isSelected = selectedIds.has(watch.id);
                    const enabledTypes = getEnabledWatchTypes(watch);
                    const addedDate = new Date(watch.created_at).toLocaleDateString();

                    return (
                      <TableRow
                        key={watch.id}
                        hover
                        selected={isSelected}
                      >
                        <TableCell padding="checkbox">
                          <Checkbox
                            checked={isSelected}
                            onChange={() => handleToggleSelection(watch.id)}
                          />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" fontWeight={600}>
                            {watch.mpn || '-'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {watch.manufacturer || '-'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Stack direction="row" spacing={0.5} flexWrap="wrap">
                            {enabledTypes.map((type) => (
                              <Tooltip key={type} title={WATCH_TYPE_LABELS[type]}>
                                <Chip
                                  icon={WATCH_TYPE_ICONS[type] as any}
                                  label={WATCH_TYPE_LABELS[type]}
                                  size="small"
                                  variant="outlined"
                                  sx={{ mb: 0.5 }}
                                />
                              </Tooltip>
                            ))}
                          </Stack>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" color="text.secondary">
                            {addedDate}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                            <Tooltip title="Edit watch types">
                              <IconButton
                                size="small"
                                onClick={() => handleEditWatch(watch)}
                                disabled={updating}
                              >
                                <EditIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Remove watch">
                              <IconButton
                                size="small"
                                onClick={() => handleRemoveWatch(watch.id)}
                                disabled={removing}
                                color="error"
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </Stack>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      {/* Edit Watch Dialog */}
      <Dialog
        open={editingWatch !== null}
        onClose={() => setEditingWatch(null)}
        maxWidth="sm"
        fullWidth
      >
        {editingWatch && (
          <WatchTypeSelector
            componentId={editingWatch.component_id}
            mpn={editingWatch.mpn}
            manufacturer={editingWatch.manufacturer}
            initialWatchTypes={getEnabledWatchTypes(editingWatch)}
            onSave={handleSaveWatchTypes}
            onRemove={() => {
              handleRemoveWatch(editingWatch.id);
              setEditingWatch(null);
            }}
            onCancel={() => setEditingWatch(null)}
          />
        )}
      </Dialog>

      {/* Bulk Delete Confirmation */}
      <Dialog
        open={bulkDeleteDialogOpen}
        onClose={() => setBulkDeleteDialogOpen(false)}
      >
        <DialogTitle>Confirm Bulk Delete</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to remove {selectedIds.size} watched component{selectedIds.size !== 1 ? 's' : ''}?
            You will no longer receive alerts for these components.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBulkDeleteDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleBulkDelete}
            color="error"
            variant="contained"
            disabled={removing}
          >
            {removing ? 'Removing...' : 'Remove All'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default WatchedComponentsPage;
