import { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { LucideIcon, ArrowUpRight, ArrowDownRight, ArrowRight, TrendingUp } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

type TrendDirection = 'up' | 'down' | 'neutral';
type StatCardVariant = 'default' | 'primary' | 'success' | 'warning' | 'error';
type StatCardSize = 'sm' | 'md' | 'lg';

export interface StatCardProps {
  /** Card title/label */
  title: string;
  /** Main value to display */
  value: string | number;
  /** Optional icon */
  icon?: LucideIcon;
  /** Description or subtitle */
  description?: string;
  /** Trend indicator */
  trend?: {
    value: string | number;
    direction: TrendDirection;
    label?: string;
  };
  /** Visual variant */
  variant?: StatCardVariant;
  /** Size variant */
  size?: StatCardSize;
  /** Loading state */
  loading?: boolean;
  /** Click handler - makes card interactive */
  onClick?: () => void;
  /** Link - makes card a navigation target */
  href?: string;
  /** Additional content in footer */
  footer?: ReactNode;
  className?: string;
}

/**
 * Format number with appropriate separators
 */
function formatValue(value: string | number): string {
  if (typeof value === 'number') {
    return value.toLocaleString();
  }
  return value;
}

/**
 * Get trend arrow icon based on direction
 */
function getTrendIcon(direction: TrendDirection): LucideIcon {
  switch (direction) {
    case 'up':
      return ArrowUpRight;
    case 'down':
      return ArrowDownRight;
    case 'neutral':
    default:
      return ArrowRight;
  }
}

/**
 * Get trend color classes based on direction
 */
function getTrendColorClass(direction: TrendDirection): string {
  switch (direction) {
    case 'up':
      return 'text-green-600 dark:text-green-400';
    case 'down':
      return 'text-red-600 dark:text-red-400';
    case 'neutral':
    default:
      return 'text-muted-foreground';
  }
}

/**
 * Get variant color classes
 */
function getVariantClasses(variant: StatCardVariant): {
  iconBg: string;
  iconColor: string;
  watermark: string;
} {
  switch (variant) {
    case 'primary':
      return {
        iconBg: 'bg-primary/10',
        iconColor: 'text-primary',
        watermark: 'text-primary/5',
      };
    case 'success':
      return {
        iconBg: 'bg-green-100 dark:bg-green-950/30',
        iconColor: 'text-green-600 dark:text-green-400',
        watermark: 'text-green-600/5 dark:text-green-400/5',
      };
    case 'warning':
      return {
        iconBg: 'bg-yellow-100 dark:bg-yellow-950/30',
        iconColor: 'text-yellow-600 dark:text-yellow-400',
        watermark: 'text-yellow-600/5 dark:text-yellow-400/5',
      };
    case 'error':
      return {
        iconBg: 'bg-red-100 dark:bg-red-950/30',
        iconColor: 'text-red-600 dark:text-red-400',
        watermark: 'text-red-600/5 dark:text-red-400/5',
      };
    case 'default':
    default:
      return {
        iconBg: 'bg-muted',
        iconColor: 'text-muted-foreground',
        watermark: 'text-muted-foreground/5',
      };
  }
}

/**
 * Get size-specific classes
 */
function getSizeClasses(size: StatCardSize): {
  icon: string;
  iconSize: number;
  value: string;
  title: string;
  padding: string;
  watermarkSize: number;
} {
  switch (size) {
    case 'sm':
      return {
        icon: 'p-2',
        iconSize: 16,
        value: 'text-xl font-semibold',
        title: 'text-xs font-medium',
        padding: 'p-4',
        watermarkSize: 48,
      };
    case 'lg':
      return {
        icon: 'p-3',
        iconSize: 24,
        value: 'text-4xl font-bold',
        title: 'text-base font-medium',
        padding: 'p-8',
        watermarkSize: 96,
      };
    case 'md':
    default:
      return {
        icon: 'p-2.5',
        iconSize: 20,
        value: 'text-2xl font-semibold',
        title: 'text-sm font-medium',
        padding: 'p-6',
        watermarkSize: 72,
      };
  }
}

/**
 * StatCard - Display metrics and KPIs
 *
 * @example
 * ```tsx
 * // Basic stat card
 * <StatCard
 *   title="Total BOMs"
 *   value={42}
 *   icon={FileText}
 * />
 *
 * // With trend indicator
 * <StatCard
 *   title="Active Components"
 *   value="1,234"
 *   icon={Cpu}
 *   trend={{ value: "+12%", direction: "up", label: "from last month" }}
 *   variant="success"
 * />
 *
 * // Clickable with footer
 * <StatCard
 *   title="Pending Reviews"
 *   value={8}
 *   icon={AlertCircle}
 *   variant="warning"
 *   onClick={() => navigate('/reviews')}
 *   footer={<Button variant="ghost" size="sm">View All</Button>}
 * />
 *
 * // Loading state
 * <StatCard title="Revenue" value={0} loading />
 * ```
 */
export function StatCard({
  title,
  value,
  icon: Icon,
  description,
  trend,
  variant = 'default',
  size = 'md',
  loading = false,
  onClick,
  href,
  footer,
  className,
}: StatCardProps) {
  const variantClasses = getVariantClasses(variant);
  const sizeClasses = getSizeClasses(size);
  const isInteractive = !!(onClick || href);

  const TrendIcon = trend ? getTrendIcon(trend.direction) : null;
  const trendColorClass = trend ? getTrendColorClass(trend.direction) : '';

  // Loading skeleton
  if (loading) {
    return (
      <Card
        elevation="raised"
        className={cn(sizeClasses.padding, className)}
      >
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-24" />
            {Icon && <Skeleton variant="circular" width={sizeClasses.iconSize + 16} height={sizeClasses.iconSize + 16} />}
          </div>
          <Skeleton className={cn('w-32', size === 'lg' ? 'h-10' : size === 'sm' ? 'h-6' : 'h-8')} />
          {description && <Skeleton className="h-3 w-full" />}
          {trend && <Skeleton className="h-3 w-20" />}
        </div>
      </Card>
    );
  }

  const content = (
    <>
      {/* Header with title and icon */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 space-y-1">
          <p className={cn('text-muted-foreground', sizeClasses.title)}>
            {title}
          </p>
        </div>
        {Icon && (
          <div className={cn(
            'rounded-lg transition-all',
            sizeClasses.icon,
            variantClasses.iconBg,
            variantClasses.iconColor,
            isInteractive && 'group-hover:scale-110'
          )}>
            <Icon size={sizeClasses.iconSize} strokeWidth={2} />
          </div>
        )}
      </div>

      {/* Main value */}
      <div className="mt-3">
        <p className={cn('tabular-nums tracking-tight', sizeClasses.value)}>
          {formatValue(value)}
        </p>
      </div>

      {/* Description */}
      {description && (
        <p className="mt-1 text-xs text-muted-foreground">
          {description}
        </p>
      )}

      {/* Trend indicator */}
      {trend && TrendIcon && (
        <div className={cn('mt-3 flex items-center gap-1 text-xs font-medium', trendColorClass)}>
          <TrendIcon size={14} strokeWidth={2} />
          <span>{formatValue(trend.value)}</span>
          {trend.label && (
            <span className="text-muted-foreground">
              {trend.label}
            </span>
          )}
        </div>
      )}

      {/* Footer content */}
      {footer && (
        <div className="mt-4 border-t pt-4">
          {footer}
        </div>
      )}

      {/* Background watermark icon */}
      {Icon && (
        <div className="pointer-events-none absolute bottom-0 right-0 -mb-4 -mr-4 opacity-100">
          <Icon
            size={sizeClasses.watermarkSize}
            strokeWidth={1}
            className={variantClasses.watermark}
          />
        </div>
      )}
    </>
  );

  if (href) {
    return (
      <a href={href} className="block">
        <Card
          elevation="raised"
          hover="lift"
          clickable
          className={cn('relative overflow-hidden', className)}
        >
          <div className={sizeClasses.padding}>
            {content}
          </div>
        </Card>
      </a>
    );
  }

  return (
    <Card
      elevation="raised"
      hover={isInteractive ? 'lift' : 'none'}
      clickable={isInteractive}
      onClick={onClick}
      className={cn('relative overflow-hidden', className)}
    >
      <div className={sizeClasses.padding}>
        {content}
      </div>
    </Card>
  );
}

/**
 * StatCardGrid - Responsive grid container for stat cards
 *
 * @example
 * ```tsx
 * <StatCardGrid columns={3}>
 *   <StatCard title="Users" value={100} />
 *   <StatCard title="Revenue" value="$50K" />
 *   <StatCard title="Growth" value="+23%" />
 * </StatCardGrid>
 * ```
 */
export interface StatCardGridProps {
  children: ReactNode;
  /** Number of columns on desktop */
  columns?: 2 | 3 | 4;
  className?: string;
}

export function StatCardGrid({ children, columns = 4, className }: StatCardGridProps) {
  const gridCols = {
    2: 'md:grid-cols-2',
    3: 'md:grid-cols-2 lg:grid-cols-3',
    4: 'sm:grid-cols-2 lg:grid-cols-4',
  };

  return (
    <div className={cn(
      'grid grid-cols-1 gap-4',
      gridCols[columns],
      className
    )}>
      {children}
    </div>
  );
}

// --- Convenience Components ---

/**
 * Pre-configured stat card for BOM count
 */
export interface BOMCountStatProps {
  count: number;
  trend?: number;
  loading?: boolean;
  onClick?: () => void;
}

export function BOMCountStat({ count, trend, loading, onClick }: BOMCountStatProps) {
  return (
    <StatCard
      title="Total BOMs"
      value={count}
      icon={TrendingUp}
      variant="primary"
      trend={trend !== undefined ? {
        value: trend > 0 ? `+${trend}` : trend,
        direction: trend > 0 ? 'up' : trend < 0 ? 'down' : 'neutral',
        label: 'this month',
      } : undefined}
      loading={loading}
      onClick={onClick}
    />
  );
}

/**
 * Pre-configured stat card for component count
 */
export interface ComponentCountStatProps {
  count: number;
  loading?: boolean;
  onClick?: () => void;
}

export function ComponentCountStat({ count, loading, onClick }: ComponentCountStatProps) {
  return (
    <StatCard
      title="Components"
      value={count}
      variant="default"
      loading={loading}
      onClick={onClick}
    />
  );
}

/**
 * Pre-configured stat card for risk score
 */
export interface RiskScoreStatProps {
  score: number;
  level: 'low' | 'medium' | 'high';
  loading?: boolean;
  onClick?: () => void;
}

export function RiskScoreStat({ score, level, loading, onClick }: RiskScoreStatProps) {
  const variant = level === 'high' ? 'error' : level === 'medium' ? 'warning' : 'success';

  return (
    <StatCard
      title="Risk Score"
      value={score}
      description={`${level.charAt(0).toUpperCase() + level.slice(1)} Risk`}
      variant={variant}
      loading={loading}
      onClick={onClick}
    />
  );
}

/**
 * Pre-configured stat card for cost metrics
 */
export interface CostStatProps {
  value: number;
  currency?: string;
  trend?: number;
  loading?: boolean;
  onClick?: () => void;
}

export function CostStat({ value, currency = 'USD', trend, loading, onClick }: CostStatProps) {
  const formattedValue = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);

  return (
    <StatCard
      title="Total Cost"
      value={formattedValue}
      variant="success"
      trend={trend !== undefined ? {
        value: `${trend > 0 ? '+' : ''}${trend}%`,
        direction: trend > 0 ? 'up' : trend < 0 ? 'down' : 'neutral',
        label: 'vs last period',
      } : undefined}
      loading={loading}
      onClick={onClick}
    />
  );
}
