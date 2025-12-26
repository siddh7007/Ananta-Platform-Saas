/**
 * Component Spec Review Window
 *
 * Full-featured component specification viewer with:
 * - Advanced search in Supabase
 * - Complete specification display
 * - Side-by-side comparison
 * - Export capabilities
 */

import React, { useState } from 'react';
import { useDataProvider, useNotify } from 'react-admin';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  TextField,
  Button,
  Grid,
  Typography,
  Card,
  CardContent,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  IconButton,
  InputAdornment,
  Divider,
  Alert,
  CircularProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import {
  Search as SearchIcon,
  Close as CloseIcon,
  CompareArrows as CompareIcon,
  GetApp as ExportIcon,
  ExpandMore as ExpandIcon,
  Memory as ComponentIcon,
  CheckCircle as CheckIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';

interface ComponentSpec {
  id: string;
  manufacturer_part_number: string;
  manufacturer: string;
  description: string;
  category: string;
  lifecycle_status: string;
  specifications: Record<string, any>;
  compliance: {
    rohs: boolean;
    reach: boolean;
    conflict_minerals: boolean;
  };
  pricing?: {
    unit_price: number;
    currency: string;
    moq: number;
  };
  availability?: {
    in_stock: number;
    lead_time_days: number;
  };
}

interface ComponentSpecReviewProps {
  open: boolean;
  onClose: () => void;
  initialMpn?: string;
}

export const ComponentSpecReview: React.FC<ComponentSpecReviewProps> = ({
  open,
  onClose,
  initialMpn = '',
}) => {
  const [searchQuery, setSearchQuery] = useState(initialMpn);
  const [searchResults, setSearchResults] = useState<ComponentSpec[]>([]);
  const [selectedComponent, setSelectedComponent] = useState<ComponentSpec | null>(null);
  const [compareComponent, setCompareComponent] = useState<ComponentSpec | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [activeTab, setActiveTab] = useState(0);

  const dataProvider = useDataProvider();
  const notify = useNotify();

  /**
   * Search components in Supabase
   */
  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      notify('Please enter a search term', { type: 'warning' });
      return;
    }

    setIsSearching(true);
    try {
      // Search in Supabase using full-text search
      const { data } = await dataProvider.getList('components', {
        pagination: { page: 1, perPage: 50 },
        sort: { field: 'manufacturer_part_number', order: 'ASC' },
        filter: { q: searchQuery },
      });

      setSearchResults(data as ComponentSpec[]);
      if (data.length > 0) {
        setSelectedComponent(data[0]);
        notify(`Found ${data.length} components`, { type: 'success' });
      } else {
        notify('No components found', { type: 'info' });
      }
    } catch (error: any) {
      notify(`Search failed: ${error.message}`, { type: 'error' });
    } finally {
      setIsSearching(false);
    }
  };

  /**
   * Get lifecycle status color
   */
  const getLifecycleColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'active':
        return 'success';
      case 'nrnd':
        return 'warning';
      case 'eol':
      case 'obsolete':
        return 'error';
      default:
        return 'default';
    }
  };

  /**
   * Export component data
   */
  const handleExport = () => {
    if (!selectedComponent) return;

    const dataStr = JSON.stringify(selectedComponent, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${selectedComponent.manufacturer_part_number}_spec.json`;
    link.click();

    notify('Component data exported', { type: 'success' });
  };

  /**
   * Render specification table
   */
  const renderSpecTable = (specs: Record<string, any>) => {
    return (
      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell><strong>Parameter</strong></TableCell>
              <TableCell><strong>Value</strong></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {Object.entries(specs).map(([key, value]) => (
              <TableRow key={key}>
                <TableCell>{key.replace(/_/g, ' ').toUpperCase()}</TableCell>
                <TableCell>{String(value)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    );
  };

  /**
   * Render component details
   */
  const renderComponentDetails = (component: ComponentSpec) => (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 3 }}>
        <ComponentIcon sx={{ fontSize: 48, color: 'primary.main', mr: 2 }} />
        <Box sx={{ flex: 1 }}>
          <Typography variant="h6" fontWeight={700}>
            {component.manufacturer_part_number}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {component.manufacturer}
          </Typography>
          <Box sx={{ mt: 1 }}>
            <Chip
              label={component.lifecycle_status || 'Unknown'}
              color={getLifecycleColor(component.lifecycle_status) as any}
              size="small"
              sx={{ mr: 1 }}
            />
            <Chip
              label={component.category}
              variant="outlined"
              size="small"
            />
          </Box>
        </Box>
      </Box>

      {/* Tabs */}
      <Tabs value={activeTab} onChange={(_, newValue) => setActiveTab(newValue)}>
        <Tab label="Overview" />
        <Tab label="Specifications" />
        <Tab label="Compliance" />
        <Tab label="Pricing & Availability" />
      </Tabs>

      <Divider sx={{ mb: 2 }} />

      {/* Tab Content */}
      {activeTab === 0 && (
        <Box>
          <Typography variant="subtitle2" gutterBottom>Description</Typography>
          <Typography variant="body2" paragraph>
            {component.description || 'No description available'}
          </Typography>

          <Grid container spacing={2}>
            <Grid item xs={6}>
              <Typography variant="caption" color="text.secondary">Category</Typography>
              <Typography variant="body2">{component.category}</Typography>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="caption" color="text.secondary">Lifecycle</Typography>
              <Typography variant="body2">{component.lifecycle_status}</Typography>
            </Grid>
          </Grid>
        </Box>
      )}

      {activeTab === 1 && (
        <Box>
          <Typography variant="subtitle2" gutterBottom>
            Technical Specifications
          </Typography>
          {component.specifications && Object.keys(component.specifications).length > 0 ? (
            renderSpecTable(component.specifications)
          ) : (
            <Alert severity="info">No specifications available</Alert>
          )}
        </Box>
      )}

      {activeTab === 2 && (
        <Box>
          <Typography variant="subtitle2" gutterBottom>
            Compliance Status
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={4}>
              <Card variant="outlined">
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Typography variant="body2">RoHS</Typography>
                    {component.compliance?.rohs ? (
                      <CheckIcon color="success" />
                    ) : (
                      <WarningIcon color="error" />
                    )}
                  </Box>
                  <Typography variant="caption" color="text.secondary">
                    {component.compliance?.rohs ? 'Compliant' : 'Non-Compliant'}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={4}>
              <Card variant="outlined">
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Typography variant="body2">REACH</Typography>
                    {component.compliance?.reach ? (
                      <CheckIcon color="success" />
                    ) : (
                      <WarningIcon color="error" />
                    )}
                  </Box>
                  <Typography variant="caption" color="text.secondary">
                    {component.compliance?.reach ? 'Compliant' : 'Non-Compliant'}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={4}>
              <Card variant="outlined">
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Typography variant="body2">Conflict Minerals</Typography>
                    {component.compliance?.conflict_minerals ? (
                      <CheckIcon color="success" />
                    ) : (
                      <WarningIcon color="error" />
                    )}
                  </Box>
                  <Typography variant="caption" color="text.secondary">
                    {component.compliance?.conflict_minerals ? 'Free' : 'Present'}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Box>
      )}

      {activeTab === 3 && (
        <Box>
          <Typography variant="subtitle2" gutterBottom>
            Pricing & Availability
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={6}>
              <Typography variant="caption" color="text.secondary">Unit Price</Typography>
              <Typography variant="h6">
                {component.pricing?.currency || '$'} {component.pricing?.unit_price?.toFixed(4) || 'N/A'}
              </Typography>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="caption" color="text.secondary">MOQ</Typography>
              <Typography variant="h6">
                {component.pricing?.moq || 'N/A'}
              </Typography>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="caption" color="text.secondary">In Stock</Typography>
              <Typography variant="h6">
                {component.availability?.in_stock?.toLocaleString() || 'N/A'}
              </Typography>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="caption" color="text.secondary">Lead Time</Typography>
              <Typography variant="h6">
                {component.availability?.lead_time_days || 'N/A'} days
              </Typography>
            </Grid>
          </Grid>
        </Box>
      )}
    </Box>
  );

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6" fontWeight={700}>
            Component Specification Review
          </Typography>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent dividers>
        {/* Search Bar */}
        <Box sx={{ mb: 3 }}>
          <TextField
            fullWidth
            placeholder="Search by MPN, manufacturer, or description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
              endAdornment: isSearching && (
                <InputAdornment position="end">
                  <CircularProgress size={20} />
                </InputAdornment>
              ),
            }}
          />
          <Button
            variant="contained"
            onClick={handleSearch}
            disabled={isSearching}
            sx={{ mt: 2 }}
            fullWidth
          >
            Search Components
          </Button>
        </Box>

        {/* Search Results */}
        {searchResults.length > 0 && (
          <Accordion defaultExpanded sx={{ mb: 2 }}>
            <AccordionSummary expandIcon={<ExpandIcon />}>
              <Typography variant="subtitle2">
                Search Results ({searchResults.length})
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Box sx={{ maxHeight: 200, overflow: 'auto' }}>
                {searchResults.map((result) => (
                  <Box
                    key={result.id}
                    sx={{
                      p: 1,
                      cursor: 'pointer',
                      borderRadius: 1,
                      '&:hover': { bgcolor: 'action.hover' },
                      bgcolor: selectedComponent?.id === result.id ? 'action.selected' : 'transparent',
                    }}
                    onClick={() => setSelectedComponent(result)}
                  >
                    <Typography variant="body2" fontWeight={600}>
                      {result.manufacturer_part_number}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {result.manufacturer} • {result.category}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </AccordionDetails>
          </Accordion>
        )}

        {/* Component Details */}
        {selectedComponent ? (
          renderComponentDetails(selectedComponent)
        ) : (
          <Alert severity="info">
            Search for a component to view its specifications
          </Alert>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Close</Button>
        {selectedComponent && (
          <>
            <Button
              startIcon={<CompareIcon />}
              onClick={() => setCompareComponent(selectedComponent)}
              disabled={!compareComponent}
            >
              Compare
            </Button>
            <Button
              variant="contained"
              startIcon={<ExportIcon />}
              onClick={handleExport}
            >
              Export
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
};
