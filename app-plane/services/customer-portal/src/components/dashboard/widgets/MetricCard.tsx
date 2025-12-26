/**
 * MetricCard Component
 * Displays a key metric with trend indicator and comparison
 * @module components/dashboard/widgets
 */

import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { TrendData } from '../../../types/dashboard';

export interface MetricCardProps {
  /** Main metric value to display */
  value: number | string;
  /** Metric label/title */
  label: string;
  /** Trend data (optional) */
  trend?: TrendData;
  /** Comparison text (optional) */
  comparison?: string;
  /** Value formatter function */
  formatValue?: (value: number | string) => string;
  /** CSS class name for customization */
  className?: string;
  /** ARIA label for accessibility */
  ariaLabel?: string;
}

/**
 * MetricCard displays portfolio metrics with visual trend indicators
 * Optimized for tablet touch targets (48px minimum)
 */
export const MetricCard: React.FC<MetricCardProps> = ({
  value,
  label,
  trend,
  comparison,
  formatValue = (v) => v.toString(),
  className = '',
  ariaLabel,
}) => {
  const getTrendIcon = () => {
    if (!trend) return null;

    const iconClass = 'metric-trend-icon';
    const iconProps = {
      size: 20,
      'aria-hidden': true,
    };

    switch (trend.direction) {
      case 'up':
        return <TrendingUp className={`${iconClass} up`} {...iconProps} />;
      case 'down':
        return <TrendingDown className={`${iconClass} down`} {...iconProps} />;
      case 'flat':
        return <Minus className={`${iconClass} flat`} {...iconProps} />;
      default:
        return null;
    }
  };

  const getTrendText = () => {
    if (!trend) return null;

    const prefix = trend.direction === 'up' ? '+' : '';
    return `${prefix}${trend.value} ${trend.period}`;
  };

  const formattedValue = formatValue(value);

  return (
    <div
      className={`metric-card fade-in ${className}`}
      role="article"
      aria-label={ariaLabel || `${label}: ${formattedValue}`}
    >
      <div className="dashboard-widget-body">
        {/* Main Metric Value */}
        <div className="metric-value" aria-live="polite">
          {formattedValue}
        </div>

        {/* Metric Label */}
        <div className="metric-label">{label}</div>

        {/* Trend Indicator */}
        {trend && (
          <div className="metric-trend" role="status" aria-live="polite">
            {getTrendIcon()}
            <span className="metric-trend-text">{getTrendText()}</span>
          </div>
        )}

        {/* Comparison Text */}
        {comparison && (
          <div className="metric-comparison" aria-label={`Compared to ${comparison}`}>
            {comparison}
          </div>
        )}
      </div>
    </div>
  );
};

MetricCard.displayName = 'MetricCard';

export default MetricCard;
