/**
 * RecentActivity - Last 5 jobs with quick status
 */
import React from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableRow,
  Chip,
  IconButton,
  Tooltip,
  Button,
} from '@mui/material';
import VisibilityIcon from '@mui/icons-material/Visibility';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import SyncIcon from '@mui/icons-material/Sync';
import { useNavigate } from 'react-router-dom';
import { enrichmentStatusColors } from '../theme';

export interface RecentJob {
  id: string;
  filename: string;
  itemCount: number;
  status: 'completed' | 'processing' | 'failed' | 'pending';
  timeAgo: string;
}

export interface RecentActivityProps {
  jobs?: RecentJob[];
  loading?: boolean;
  onViewAll?: () => void;
}

const defaultJobs: RecentJob[] = [
  { id: '1', filename: 'sample_bom_1.csv', itemCount: 152, status: 'completed', timeAgo: '2m ago' },
  { id: '2', filename: 'customer_pcb.xlsx', itemCount: 87, status: 'processing', timeAgo: '5m ago' },
  { id: '3', filename: 'bulk_import.csv', itemCount: 2341, status: 'completed', timeAgo: '1h ago' },
  { id: '4', filename: 'prototype_v2.csv', itemCount: 45, status: 'failed', timeAgo: '2h ago' },
  { id: '5', filename: 'assembly_bom.xlsx', itemCount: 198, status: 'completed', timeAgo: '3h ago' },
];

const statusConfig: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  completed: {
    icon: <CheckCircleIcon fontSize="small" />,
    color: enrichmentStatusColors.completed,
    label: 'Completed',
  },
  processing: {
    icon: <SyncIcon fontSize="small" sx={{ animation: 'spin 1s linear infinite', '@keyframes spin': { '0%': { transform: 'rotate(0deg)' }, '100%': { transform: 'rotate(360deg)' } } }} />,
    color: enrichmentStatusColors.processing,
    label: 'Processing',
  },
  failed: {
    icon: <ErrorIcon fontSize="small" />,
    color: enrichmentStatusColors.failed,
    label: 'Failed',
  },
  pending: {
    icon: <HourglassEmptyIcon fontSize="small" />,
    color: enrichmentStatusColors.pending,
    label: 'Pending',
  },
};

export const RecentActivity: React.FC<RecentActivityProps> = ({
  jobs = defaultJobs,
  onViewAll,
}) => {
  const navigate = useNavigate();

  const handleViewJob = (jobId: string) => {
    navigate(`/bulk-uploads/${jobId}`);
  };

  return (
    <Card elevation={2}>
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            Recent Activity
          </Typography>
          {onViewAll && (
            <Button size="small" onClick={onViewAll} sx={{ textTransform: 'none' }}>
              View All
            </Button>
          )}
        </Box>
        <TableContainer>
          <Table size="small">
            <TableBody>
              {jobs.map((job) => {
                const config = statusConfig[job.status];
                return (
                  <TableRow key={job.id} hover>
                    <TableCell sx={{ py: 1.5, borderBottom: '1px solid #f3f4f6' }}>
                      <Typography variant="body2" fontWeight={500} noWrap sx={{ maxWidth: 200 }}>
                        {job.filename}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ py: 1.5, borderBottom: '1px solid #f3f4f6' }}>
                      <Typography variant="body2" color="textSecondary">
                        {job.itemCount} items
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ py: 1.5, borderBottom: '1px solid #f3f4f6' }}>
                      <Chip
                        icon={config.icon as React.ReactElement}
                        label={config.label}
                        size="small"
                        sx={{
                          backgroundColor: `${config.color}15`,
                          color: config.color,
                          fontWeight: 600,
                          fontSize: '0.7rem',
                          '& .MuiChip-icon': { color: config.color },
                        }}
                      />
                    </TableCell>
                    <TableCell sx={{ py: 1.5, borderBottom: '1px solid #f3f4f6' }}>
                      <Typography variant="caption" color="textSecondary">
                        {job.timeAgo}
                      </Typography>
                    </TableCell>
                    <TableCell align="right" sx={{ py: 1.5, borderBottom: '1px solid #f3f4f6' }}>
                      <Tooltip title="View details">
                        <IconButton size="small" onClick={() => handleViewJob(job.id)}>
                          <VisibilityIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </CardContent>
    </Card>
  );
};

export default RecentActivity;
