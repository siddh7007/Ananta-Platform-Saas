/**
 * StatCard - Dashboard metric card with icon and trend indicator
 */
import React from 'react';
import { Card, CardContent, Typography, Box, Skeleton } from '@mui/material';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import TrendingFlatIcon from '@mui/icons-material/TrendingFlat';
import { withAlpha } from '../../theme';

export interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  color?: string;
  trend?: 'up' | 'down' | 'flat';
  trendValue?: string;
  trendPositive?: boolean;
  loading?: boolean;
  compact?: boolean;
  onClick?: () => void;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  color = '#3b82f6',
  trend,
  trendValue,
  trendPositive,
  loading = false,
  compact = false,
  onClick,
}) => {
  const getTrendIcon = () => {
    switch (trend) {
      case 'up':
        return <TrendingUpIcon fontSize="small" />;
      case 'down':
        return <TrendingDownIcon fontSize="small" />;
      case 'flat':
        return <TrendingFlatIcon fontSize="small" />;
      default:
        return null;
    }
  };

  const getTrendColor = () => {
    if (trendPositive === true) return '#22c55e';
    if (trendPositive === false) return '#ef4444';
    if (trend === 'up') return '#22c55e';
    if (trend === 'down') return '#ef4444';
    return '#6b7280';
  };

  if (loading) {
    return (
      <Card elevation={2} sx={{ height: '100%' }}>
        <CardContent sx={{ p: compact ? 2 : 3 }}>
          <Skeleton variant="text" width="60%" height={20} />
          <Skeleton variant="text" width="40%" height={compact ? 32 : 48} sx={{ mt: 1 }} />
          <Skeleton variant="text" width="80%" height={16} sx={{ mt: 1 }} />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      elevation={2}
      sx={{
        height: '100%',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'transform 0.2s, box-shadow 0.2s',
        '&:hover': onClick
          ? {
              transform: 'translateY(-2px)',
              boxShadow: '0 4px 20px 0 rgba(0,0,0,0.12)',
            }
          : undefined,
      }}
      onClick={onClick}
    >
      <CardContent sx={{ p: compact ? 2 : 3 }}>
        <Box display="flex" justifyContent="space-between" alignItems="flex-start">
          <Box flex={1}>
            <Typography
              color="textSecondary"
              variant="overline"
              sx={{ fontSize: '0.7rem', letterSpacing: '0.05em' }}
              gutterBottom
            >
              {title}
            </Typography>
            <Typography
              variant={compact ? 'h5' : 'h4'}
              component="div"
              sx={{ fontWeight: 700, lineHeight: 1.2 }}
              gutterBottom
            >
              {value}
            </Typography>
            {subtitle && (
              <Typography color="textSecondary" variant="body2" sx={{ fontSize: '0.75rem' }}>
                {subtitle}
              </Typography>
            )}
            {trend && trendValue && (
              <Box
                display="flex"
                alignItems="center"
                gap={0.5}
                mt={1}
                sx={{ color: getTrendColor() }}
              >
                {getTrendIcon()}
                <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.75rem' }}>
                  {trendValue}
                </Typography>
              </Box>
            )}
          </Box>
          {icon && (
            <Box
              sx={{
                backgroundColor: withAlpha(color, 0.1),
                borderRadius: 2,
                p: compact ? 1 : 1.5,
                color: color,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {icon}
            </Box>
          )}
        </Box>
      </CardContent>
    </Card>
  );
};

export default StatCard;
