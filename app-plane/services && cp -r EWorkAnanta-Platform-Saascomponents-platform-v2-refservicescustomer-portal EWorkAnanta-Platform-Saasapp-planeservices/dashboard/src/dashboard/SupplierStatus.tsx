/**
 * SupplierStatus - API health, rate limits remaining
 */
import React from 'react';
import { Card, CardContent, Typography, Box, LinearProgress, Chip, Tooltip } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningIcon from '@mui/icons-material/Warning';
import ErrorIcon from '@mui/icons-material/Error';
import { getSupplierColor } from '../theme';

export interface SupplierHealth {
  name: string;
  status: 'healthy' | 'rate-limited' | 'error';
  requestsUsed: number;
  requestsLimit: number;
  resetTime?: string;
}

export interface SupplierStatusProps {
  suppliers?: SupplierHealth[];
  loading?: boolean;
}

const defaultSuppliers: SupplierHealth[] = [
  { name: 'Mouser', status: 'healthy', requestsUsed: 847, requestsLimit: 1000 },
  { name: 'DigiKey', status: 'healthy', requestsUsed: 234, requestsLimit: 1000 },
  { name: 'Element14', status: 'rate-limited', requestsUsed: 48, requestsLimit: 50, resetTime: '2h' },
];

const statusConfig: Record<string, { icon: React.ReactNode; label: string }> = {
  healthy: { icon: <CheckCircleIcon fontSize="small" sx={{ color: '#22c55e' }} />, label: 'Healthy' },
  'rate-limited': { icon: <WarningIcon fontSize="small" sx={{ color: '#facc15' }} />, label: 'Rate Limited' },
  error: { icon: <ErrorIcon fontSize="small" sx={{ color: '#ef4444' }} />, label: 'Error' },
};

export const SupplierStatus: React.FC<SupplierStatusProps> = ({
  suppliers = defaultSuppliers,
}) => {
  return (
    <Card elevation={2} sx={{ height: '100%' }}>
      <CardContent>
        <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
          Supplier API Status
        </Typography>
        <Box display="flex" flexDirection="column" gap={2} mt={2}>
          {suppliers.map((supplier, index) => {
            const config = statusConfig[supplier.status];
            const percentage = (supplier.requestsUsed / supplier.requestsLimit) * 100;
            const color = getSupplierColor(supplier.name);
            const isLow = percentage > 90;

            return (
              <Box key={index}>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={0.5}>
                  <Box display="flex" alignItems="center" gap={1}>
                    <Typography variant="body2" fontWeight={600}>
                      {supplier.name}
                    </Typography>
                    {config.icon}
                  </Box>
                  <Tooltip title={`${supplier.requestsUsed}/${supplier.requestsLimit} requests used`}>
                    <Chip
                      label={`${supplier.requestsUsed}/${supplier.requestsLimit}`}
                      size="small"
                      sx={{
                        backgroundColor: isLow ? '#fef3c7' : '#f3f4f6',
                        color: isLow ? '#92400e' : '#374151',
                        fontWeight: 600,
                        fontSize: '0.7rem',
                      }}
                    />
                  </Tooltip>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={percentage}
                  sx={{
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: `${color}20`,
                    '& .MuiLinearProgress-bar': {
                      backgroundColor: isLow ? '#ef4444' : color,
                      borderRadius: 3,
                    },
                  }}
                />
                {supplier.resetTime && supplier.status === 'rate-limited' && (
                  <Typography variant="caption" color="warning.main" sx={{ mt: 0.5, display: 'block' }}>
                    Resets in {supplier.resetTime}
                  </Typography>
                )}
              </Box>
            );
          })}
        </Box>
      </CardContent>
    </Card>
  );
};

export default SupplierStatus;
