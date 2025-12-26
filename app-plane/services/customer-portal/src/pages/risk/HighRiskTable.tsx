/**
 * HighRiskTable Component
 *
 * Displays high-risk components using MUI DataGrid with sorting and filtering.
 * Supports inline actions and risk factor breakdown visualization.
 */

import React, { useState, useMemo } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
  Button,
  Tooltip,
  IconButton,
} from '@mui/material';
import { DataGrid, GridColDef, GridRenderCellParams, GridSortModel } from '@mui/x-data-grid';
import { Link as RouterLink } from 'react-router-dom';
import SecurityIcon from '@mui/icons-material/Security';
import AssignmentIcon from '@mui/icons-material/Assignment';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import {
  riskColors as RISK_COLORS,
  riskFactorColors as RISK_FACTOR_COLORS,
} from '../../theme';
import { RiskChip } from '../../components/shared';
import type { ComponentRiskScore } from '../../services/riskService';

interface HighRiskTableProps {
  components: ComponentRiskScore[];
  onAssignMitigation?: (componentId: string) => void;
  loading?: boolean;
}

/**
 * Risk factor breakdown chip
 */
function RiskFactorChip({
  label,
  value,
  color,
  tooltip
}: {
  label: string;
  value: number;
  color: string;
  tooltip: string;
}) {
  return (
    <Tooltip title={tooltip}>
      <Chip
        label={`${label}:${value}`}
        size="small"
        sx={{
          bgcolor: color,
          color: 'white',
          fontSize: '0.7rem',
          height: 20,
        }}
      />
    </Tooltip>
  );
}

export function HighRiskTable({
  components,
  onAssignMitigation,
  loading = false
}: HighRiskTableProps) {
  const [sortModel, setSortModel] = useState<GridSortModel>([
    { field: 'total_risk_score', sort: 'desc' }
  ]);

  // Define columns
  const columns: GridColDef[] = useMemo(() => [
    {
      field: 'mpn',
      headerName: 'MPN',
      flex: 1,
      minWidth: 150,
      renderCell: (params: GridRenderCellParams) => (
        <Typography variant="body2" fontWeight={500}>
          {params.value || 'N/A'}
        </Typography>
      ),
    },
    {
      field: 'manufacturer',
      headerName: 'Manufacturer',
      flex: 1,
      minWidth: 120,
      renderCell: (params: GridRenderCellParams) => (
        <Typography variant="body2" color="text.secondary">
          {params.value || 'Unknown'}
        </Typography>
      ),
    },
    {
      field: 'risk_level',
      headerName: 'Risk Level',
      width: 120,
      align: 'center',
      headerAlign: 'center',
      renderCell: (params: GridRenderCellParams) => (
        <RiskChip level={params.value as 'low' | 'medium' | 'high' | 'critical'} />
      ),
    },
    {
      field: 'total_risk_score',
      headerName: 'Score',
      width: 80,
      align: 'center',
      headerAlign: 'center',
      renderCell: (params: GridRenderCellParams) => {
        const level = params.row.risk_level;
        return (
          <Typography
            variant="body2"
            fontWeight={700}
            color={RISK_COLORS[level as keyof typeof RISK_COLORS] || 'text.primary'}
          >
            {params.value}
          </Typography>
        );
      },
    },
    {
      field: 'risk_breakdown',
      headerName: 'Risk Breakdown',
      flex: 2,
      minWidth: 300,
      sortable: false,
      renderCell: (params: GridRenderCellParams) => {
        const row = params.row as ComponentRiskScore;
        return (
          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
            <RiskFactorChip
              label="L"
              value={row.lifecycle_risk}
              color={RISK_FACTOR_COLORS.lifecycle}
              tooltip="Lifecycle Risk"
            />
            <RiskFactorChip
              label="S"
              value={row.supply_chain_risk}
              color={RISK_FACTOR_COLORS.supply_chain}
              tooltip="Supply Chain Risk"
            />
            <RiskFactorChip
              label="C"
              value={row.compliance_risk}
              color={RISK_FACTOR_COLORS.compliance}
              tooltip="Compliance Risk"
            />
            <RiskFactorChip
              label="O"
              value={row.obsolescence_risk}
              color={RISK_FACTOR_COLORS.obsolescence}
              tooltip="Obsolescence Risk"
            />
            <RiskFactorChip
              label="SS"
              value={row.single_source_risk}
              color={RISK_FACTOR_COLORS.single_source}
              tooltip="Single Source Risk"
            />
          </Box>
        );
      },
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 140,
      sortable: false,
      renderCell: (params: GridRenderCellParams) => (
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          {onAssignMitigation && (
            <Tooltip title="Assign Mitigation">
              <IconButton
                size="small"
                onClick={() => onAssignMitigation(params.row.component_id)}
                color="primary"
              >
                <AssignmentIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          <Tooltip title="View Details">
            <IconButton
              size="small"
              component={RouterLink}
              to={`/components/${params.row.component_id}/show`}
            >
              <OpenInNewIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      ),
    },
  ], [onAssignMitigation]);

  // Empty state
  if (components.length === 0 && !loading) {
    return (
      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">
              High Risk Components
            </Typography>
            <Button
              component={RouterLink}
              to="/components?filter=high-risk"
              variant="text"
              size="small"
            >
              View All
            </Button>
          </Box>
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <SecurityIcon sx={{ fontSize: 48, color: 'success.main', mb: 1 }} />
            <Typography variant="body1" color="text.secondary">
              No high-risk components detected
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Your portfolio is looking healthy!
            </Typography>
          </Box>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">
            High Risk Components
          </Typography>
          <Button
            component={RouterLink}
            to="/components?filter=high-risk"
            variant="text"
            size="small"
          >
            View All
          </Button>
        </Box>

        <Box sx={{ height: 400, width: '100%' }}>
          <DataGrid
            rows={components}
            columns={columns}
            loading={loading}
            sortModel={sortModel}
            onSortModelChange={setSortModel}
            getRowId={(row) => row.component_id}
            pageSizeOptions={[5, 10, 25]}
            initialState={{
              pagination: { paginationModel: { pageSize: 10 } },
            }}
            disableRowSelectionOnClick
            sx={{
              border: 'none',
              '& .MuiDataGrid-cell:focus': {
                outline: 'none',
              },
              '& .MuiDataGrid-row:hover': {
                backgroundColor: 'action.hover',
              },
            }}
          />
        </Box>
      </CardContent>
    </Card>
  );
}

export default HighRiskTable;
