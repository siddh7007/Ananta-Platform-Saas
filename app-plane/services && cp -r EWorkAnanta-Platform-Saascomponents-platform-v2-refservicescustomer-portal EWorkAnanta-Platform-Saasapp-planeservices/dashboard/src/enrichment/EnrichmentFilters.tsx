/**
 * Enrichment Filters Component
 *
 * Filter controls for source and status.
 */

import React from 'react';
import {
  Card,
  CardContent,
  Stack,
  Box,
  Typography,
  ToggleButtonGroup,
  ToggleButton,
} from '@mui/material';

export type SourceFilter = 'all' | 'customer' | 'staff';
export type StatusFilter = 'all' | 'enriching' | 'completed' | 'failed';

export interface EnrichmentFiltersProps {
  sourceFilter: SourceFilter;
  statusFilter: StatusFilter;
  onSourceChange: (value: SourceFilter) => void;
  onStatusChange: (value: StatusFilter) => void;
}

export const EnrichmentFilters: React.FC<EnrichmentFiltersProps> = ({
  sourceFilter,
  statusFilter,
  onSourceChange,
  onStatusChange,
}) => {
  return (
    <Card>
      <CardContent>
        <Stack direction="row" spacing={3} alignItems="center" flexWrap="wrap">
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Source
            </Typography>
            <ToggleButtonGroup
              value={sourceFilter}
              exclusive
              onChange={(_, value) => value && onSourceChange(value)}
              size="small"
            >
              <ToggleButton value="all">All</ToggleButton>
              <ToggleButton value="customer">Customer</ToggleButton>
              <ToggleButton value="staff">Staff</ToggleButton>
            </ToggleButtonGroup>
          </Box>

          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Status
            </Typography>
            <ToggleButtonGroup
              value={statusFilter}
              exclusive
              onChange={(_, value) => value && onStatusChange(value)}
              size="small"
            >
              <ToggleButton value="all">All</ToggleButton>
              <ToggleButton value="enriching">Enriching</ToggleButton>
              <ToggleButton value="completed">Completed</ToggleButton>
              <ToggleButton value="failed">Failed</ToggleButton>
            </ToggleButtonGroup>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
};

export default EnrichmentFilters;
