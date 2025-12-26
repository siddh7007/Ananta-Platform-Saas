/**
 * MetricCard Component
 *
 * Reusable card for displaying metrics with optional trend indicators.
 * Used across Dashboard, RiskDashboard, AlertCenter for consistent stats display.
 *
 * Features:
 * - Semantic color support via theme tokens
 * - Optional trend indicator (up/down/neutral)
 * - Loading skeleton state
 * - Compact and standard variants
 */

import React from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Skeleton,
  useTheme,
  Theme,
} from '@mui/material';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import TrendingFlatIcon from '@mui/icons-material/TrendingFlat';
import { typographyScale, spacingScale } from '../../theme';

// Trend direction type
export type TrendDirection = 'up' | 'down' | 'neutral';

// Semantic color keys matching theme tokens
export type MetricColorKey =
  | 'primary'
  | 'secondary'
  | 'success'
  | 'warning'
  | 'error'
  | 'info'
  | 'default';

export interface MetricCardProps {
  /** Main title/label for the metric */
  title: string;
  /** The primary value to display */
  value: string | number;
  /** Optional subtitle or description */
  subtitle?: string;
  /** Semantic color from theme */
  color?: MetricColorKey;
  /** Custom color override (hex) */
  customColor?: string;
  /** Trend direction indicator */
  trend?: TrendDirection;
  /** Trend value text (e.g., "+5%", "-12") */
  trendValue?: string;
  /** Whether trend is positive (green) or negative (red) */
  trendPositive?: boolean;
  /** Loading state */
  loading?: boolean;
  /** Compact variant (smaller) */
  compact?: boolean;
  /** Optional icon to display */
  icon?: React.ReactNode;
  /** Click handler */
  onClick?: () => void;
  /** Additional CSS class */
  className?: string;
  /** Card variant */
  variant?: 'outlined' | 'elevation';
}

/**
 * Get color from theme based on color key
 */
function getColorValue(
  theme: Theme,
  colorKey: MetricColorKey,
  customColor?: string
): string {
  if (customColor) return customColor;

  switch (colorKey) {
    case 'primary':
      return theme.palette.primary.main;
    case 'secondary':
      return theme.palette.secondary.main;
    case 'success':
      return theme.palette.success.main;
    case 'warning':
      return theme.palette.warning.main;
    case 'error':
      return theme.palette.error.main;
    case 'info':
      return theme.palette.info.main;
    default:
      return theme.palette.text.primary;
  }
}

/**
 * Trend indicator component
 */
function TrendIndicator({
  direction,
  value,
  positive,
}: {
  direction: TrendDirection;
  value?: string;
  positive?: boolean;
}) {
  const color = positive ? 'success.main' : positive === false ? 'error.main' : 'text.secondary';

  const Icon =
    direction === 'up'
      ? TrendingUpIcon
      : direction === 'down'
      ? TrendingDownIcon
      : TrendingFlatIcon;

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 0.5,
        color,
      }}
    >
      <Icon sx={{ fontSize: 16 }} />
      {value && (
        <Typography variant="caption" sx={{ fontWeight: 500 }}>
          {value}
        </Typography>
      )}
    </Box>
  );
}

/**
 * MetricCard Component
 */
export function MetricCard({
  title,
  value,
  subtitle,
  color = 'default',
  customColor,
  trend,
  trendValue,
  trendPositive,
  loading = false,
  compact = false,
  icon,
  onClick,
  className,
  variant = 'outlined',
}: MetricCardProps) {
  const theme = useTheme();
  const valueColor = getColorValue(theme, color, customColor);

  // Sizes based on compact mode
  const padding = compact ? spacingScale.sm : spacingScale.lg;
  const valueSize = compact ? '1.5rem' : typographyScale.metricValue.fontSize;
  const valueFontWeight = typographyScale.metricValue.fontWeight;

  if (loading) {
    return (
      <Card variant={variant} className={className}>
        <CardContent sx={{ py: padding, textAlign: 'center' }}>
          <Skeleton width="60%" height={16} sx={{ mx: 'auto', mb: 1 }} />
          <Skeleton width="40%" height={compact ? 32 : 40} sx={{ mx: 'auto' }} />
          {subtitle && <Skeleton width="50%" height={14} sx={{ mx: 'auto', mt: 1 }} />}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      variant={variant}
      className={className}
      onClick={onClick}
      sx={{
        cursor: onClick ? 'pointer' : 'default',
        transition: 'box-shadow 0.2s, transform 0.2s',
        '&:hover': onClick
          ? {
              boxShadow: 3,
              transform: 'translateY(-2px)',
            }
          : {},
      }}
    >
      <CardContent sx={{ py: padding, textAlign: 'center' }}>
        {/* Icon */}
        {icon && (
          <Box sx={{ mb: 1, color: valueColor }}>
            {icon}
          </Box>
        )}

        {/* Value */}
        <Typography
          sx={{
            fontSize: valueSize,
            fontWeight: valueFontWeight,
            color: valueColor,
            lineHeight: 1,
          }}
        >
          {value}
        </Typography>

        {/* Title */}
        <Typography
          variant="caption"
          sx={{
            ...typographyScale.metricLabel,
            color: 'text.secondary',
            display: 'block',
            mt: 0.5,
          }}
        >
          {title}
        </Typography>

        {/* Subtitle */}
        {subtitle && (
          <Typography
            variant="caption"
            sx={{
              color: 'text.secondary',
              display: 'block',
              mt: 0.5,
            }}
          >
            {subtitle}
          </Typography>
        )}

        {/* Trend */}
        {trend && (
          <Box sx={{ mt: 1, display: 'flex', justifyContent: 'center' }}>
            <TrendIndicator
              direction={trend}
              value={trendValue}
              positive={trendPositive}
            />
          </Box>
        )}
      </CardContent>
    </Card>
  );
}

export default MetricCard;
