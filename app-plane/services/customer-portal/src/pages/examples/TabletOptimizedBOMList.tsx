import React, { useState } from 'react';
import { Box, Typography, Button, Stack } from '@mui/material';
import { Add as AddIcon, FilterList as FilterIcon } from '@mui/icons-material';
import { GridColDef } from '@mui/x-data-grid';
import { ResponsiveTable } from '../../components/layout';
import { BOMCard, TouchTarget } from '../../components/shared';
import { useIsTablet } from '../../hooks';

/**
 * Example: Tablet-Optimized BOM List Page
 *
 * Demonstrates:
 * - ResponsiveTable with custom card renderer
 * - Touch-friendly action buttons
 * - Swipe gestures for quick actions
 * - Adaptive layout for tablet/desktop
 */

interface BOMRow {
  id: string;
  name: string;
  totalComponents: number;
  enrichedComponents: number;
  enrichmentPercentage: number;
  riskLevel: 'low' | 'medium' | 'high';
  status: 'draft' | 'enriching' | 'completed' | 'failed';
  updatedAt: Date;
  updatedBy?: string;
}

// Mock data
const mockBOMs: BOMRow[] = [
  {
    id: '1',
    name: 'PCB-Rev-3.xlsx',
    totalComponents: 156,
    enrichedComponents: 143,
    enrichmentPercentage: 92,
    riskLevel: 'high',
    status: 'completed',
    updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
    updatedBy: 'Emily',
  },
  {
    id: '2',
    name: 'MainBoard-v2.csv',
    totalComponents: 89,
    enrichedComponents: 89,
    enrichmentPercentage: 100,
    riskLevel: 'low',
    status: 'completed',
    updatedAt: new Date(Date.now() - 5 * 60 * 60 * 1000), // 5 hours ago
    updatedBy: 'Sarah',
  },
  {
    id: '3',
    name: 'PowerSupply-Draft.xlsx',
    totalComponents: 42,
    enrichedComponents: 21,
    enrichmentPercentage: 50,
    riskLevel: 'medium',
    status: 'enriching',
    updatedAt: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
    updatedBy: 'Alex',
  },
  {
    id: '4',
    name: 'Sensor-Array-v1.csv',
    totalComponents: 67,
    enrichedComponents: 15,
    enrichmentPercentage: 22,
    riskLevel: 'high',
    status: 'draft',
    updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
    updatedBy: 'Jordan',
  },
];

// Column definitions for desktop table view
const columns: GridColDef[] = [
  {
    field: 'name',
    headerName: 'BOM Name',
    flex: 1,
    minWidth: 200,
  },
  {
    field: 'totalComponents',
    headerName: 'Components',
    width: 120,
    type: 'number',
  },
  {
    field: 'enrichmentPercentage',
    headerName: 'Enrichment',
    width: 120,
    type: 'number',
    valueFormatter: (value: number) => `${value}%`,
  },
  {
    field: 'riskLevel',
    headerName: 'Risk',
    width: 100,
    valueFormatter: (value: string) => value.toUpperCase(),
  },
  {
    field: 'status',
    headerName: 'Status',
    width: 120,
    valueFormatter: (value: string) =>
      value.charAt(0).toUpperCase() + value.slice(1),
  },
  {
    field: 'updatedAt',
    headerName: 'Last Updated',
    width: 180,
    type: 'dateTime',
    valueFormatter: (value: string) => new Date(value).toLocaleString(),
  },
];

export function TabletOptimizedBOMList() {
  const [boms, setBoms] = useState<BOMRow[]>(mockBOMs);
  const isTablet = useIsTablet();

  const handleView = (id: string) => {
    console.log('View BOM:', id);
    // Navigate to BOM detail page
  };

  const handleEnrich = (id: string) => {
    console.log('Enrich BOM:', id);
    // Start enrichment workflow
  };

  const handleExport = (id: string) => {
    console.log('Export BOM:', id);
    // Export BOM data
  };

  const handleDelete = (id: string) => {
    console.log('Delete BOM:', id);
    setBoms((prev) => prev.filter((bom) => bom.id !== id));
  };

  const handleArchive = (id: string) => {
    console.log('Archive BOM:', id);
    // Archive BOM (soft delete)
  };

  const handleAddNew = () => {
    console.log('Add new BOM');
    // Navigate to BOM upload
  };

  const handleFilter = () => {
    console.log('Show filters');
    // Show filter panel
  };

  return (
    <Box sx={{ p: 3, maxWidth: '100%' }}>
      {/* Header */}
      <Box
        sx={{
          mb: 3,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 2,
        }}
      >
        <Box>
          <Typography variant="h4" gutterBottom>
            Bill of Materials
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {boms.length} BOMs • {isTablet ? 'Tablet View' : 'Desktop View'}
          </Typography>
        </Box>

        <Stack direction="row" spacing={2}>
          <TouchTarget
            onClick={handleFilter}
            size="md"
            ariaLabel="Show filters"
          >
            <Button
              variant="outlined"
              startIcon={<FilterIcon />}
              sx={{ minHeight: '48px' }}
            >
              Filter
            </Button>
          </TouchTarget>

          <TouchTarget
            onClick={handleAddNew}
            size="md"
            ariaLabel="Add new BOM"
          >
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              sx={{ minHeight: '48px' }}
            >
              Add BOM
            </Button>
          </TouchTarget>
        </Stack>
      </Box>

      {/* Responsive Table/Card View */}
      <ResponsiveTable
        rows={boms}
        columns={columns}
        onRowClick={(row) => handleView(row.id)}
        renderCard={(row) => (
          <BOMCard
            data={row}
            onView={() => handleView(row.id)}
            onEnrich={() => handleEnrich(row.id)}
            onExport={() => handleExport(row.id)}
            onDelete={() => handleDelete(row.id)}
            onArchive={() => handleArchive(row.id)}
            showSwipeActions={isTablet} // Only enable swipe on tablet
          />
        )}
      />

      {/* Empty State */}
      {boms.length === 0 && (
        <Box
          sx={{
            textAlign: 'center',
            py: 8,
            px: 2,
          }}
        >
          <Typography variant="h6" gutterBottom>
            No BOMs yet
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Upload your first Bill of Materials to get started
          </Typography>
          <TouchTarget onClick={handleAddNew} size="lg">
            <Button variant="contained" startIcon={<AddIcon />}>
              Upload BOM
            </Button>
          </TouchTarget>
        </Box>
      )}

      {/* Tablet Usage Hint */}
      {isTablet && boms.length > 0 && (
        <Box
          sx={{
            mt: 3,
            p: 2,
            bgcolor: 'info.light',
            borderRadius: 1,
            color: 'info.contrastText',
          }}
        >
          <Typography variant="body2">
            <strong>Tip:</strong> Swipe left on any card to delete, or swipe
            right to archive. Tap to view details.
          </Typography>
        </Box>
      )}
    </Box>
  );
}

export default TabletOptimizedBOMList;
