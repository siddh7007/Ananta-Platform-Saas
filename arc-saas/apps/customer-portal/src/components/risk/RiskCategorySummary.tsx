/**
 * Risk Category Summary Component
 * Displays summary cards for each risk category (Lifecycle, Supply Chain, Compliance)
 * with High/Medium/Low counts and severity indicators
 */

import { AlertTriangle, Clock, Link2, Shield, CheckCircle, AlertCircle, Info } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export interface RiskCategoryCounts {
  high: number;
  medium: number;
  low: number;
}

export interface RiskCategorySummaryProps {
  lifecycle: RiskCategoryCounts;
  supplyChain: RiskCategoryCounts;
  compliance: RiskCategoryCounts;
  isLoading?: boolean;
}

// Severity styling configuration
const SEVERITY_CONFIG = {
  high: {
    icon: AlertTriangle,
    color: 'text-red-600 dark:text-red-400',
    bg: 'bg-red-50 dark:bg-red-900/20',
    badge: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  },
  medium: {
    icon: AlertCircle,
    color: 'text-yellow-600 dark:text-yellow-400',
    bg: 'bg-yellow-50 dark:bg-yellow-900/20',
    badge: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
  },
  low: {
    icon: Info,
    color: 'text-blue-600 dark:text-blue-400',
    bg: 'bg-blue-50 dark:bg-blue-900/20',
    badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  },
  clear: {
    icon: CheckCircle,
    color: 'text-green-600 dark:text-green-400',
    bg: 'bg-green-50 dark:bg-green-900/20',
    badge: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  },
};

// Category configuration
const CATEGORY_CONFIG = {
  lifecycle: {
    label: 'Lifecycle Risk',
    icon: Clock,
    description: 'EOL, NRND, obsolete components',
    iconColor: 'text-amber-600',
  },
  supplyChain: {
    label: 'Supply Chain',
    icon: Link2,
    description: 'Single-source, limited availability',
    iconColor: 'text-blue-600',
  },
  compliance: {
    label: 'Compliance',
    icon: Shield,
    description: 'RoHS, REACH, regulatory issues',
    iconColor: 'text-purple-600',
  },
};

interface SeverityRowProps {
  severity: 'high' | 'medium' | 'low';
  count: number;
}

function SeverityRow({ severity, count }: SeverityRowProps) {
  const config = SEVERITY_CONFIG[severity];
  const Icon = config.icon;

  if (count === 0) return null;

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Icon className={cn('h-3.5 w-3.5', config.color)} />
        <span className="text-xs capitalize">{severity}</span>
      </div>
      <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', config.badge)}>
        {count}
      </span>
    </div>
  );
}

interface CategoryCardProps {
  category: 'lifecycle' | 'supplyChain' | 'compliance';
  counts: RiskCategoryCounts;
}

function CategoryCard({ category, counts }: CategoryCardProps) {
  const config = CATEGORY_CONFIG[category];
  const Icon = config.icon;
  const totalIssues = counts.high + counts.medium + counts.low;
  const hasCritical = counts.high > 0;
  const isClear = totalIssues === 0;

  // Determine overall status styling
  const statusConfig = isClear
    ? SEVERITY_CONFIG.clear
    : hasCritical
      ? SEVERITY_CONFIG.high
      : counts.medium > 0
        ? SEVERITY_CONFIG.medium
        : SEVERITY_CONFIG.low;

  return (
    <Card className={cn(
      'p-4 border transition-colors',
      isClear ? 'border-green-200 dark:border-green-800' : 'border-border'
    )}>
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={cn('p-1.5 rounded-lg', statusConfig.bg)}>
            <Icon className={cn('h-4 w-4', config.iconColor)} />
          </div>
          <div>
            <h4 className="text-sm font-medium">{config.label}</h4>
            <p className="text-xs text-muted-foreground">{config.description}</p>
          </div>
        </div>
        {/* Status indicator */}
        {isClear ? (
          <div className={cn('flex items-center gap-1 px-2 py-0.5 rounded-full text-xs', SEVERITY_CONFIG.clear.badge)}>
            <CheckCircle className="h-3 w-3" />
            Clear
          </div>
        ) : (
          <div className={cn('px-2 py-0.5 rounded-full text-xs font-medium', statusConfig.badge)}>
            {totalIssues} issue{totalIssues !== 1 ? 's' : ''}
          </div>
        )}
      </div>

      {/* Severity breakdown */}
      {!isClear && (
        <div className="space-y-1.5 pt-2 border-t">
          <SeverityRow severity="high" count={counts.high} />
          <SeverityRow severity="medium" count={counts.medium} />
          <SeverityRow severity="low" count={counts.low} />
        </div>
      )}
    </Card>
  );
}

function LoadingSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {[1, 2, 3].map((i) => (
        <Card key={i} className="p-4">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
              <Skeleton className="h-8 w-8 rounded-lg" />
              <div>
                <Skeleton className="h-4 w-24 mb-1" />
                <Skeleton className="h-3 w-32" />
              </div>
            </div>
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
          <div className="space-y-2 pt-2 border-t">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        </Card>
      ))}
    </div>
  );
}

export function RiskCategorySummary({
  lifecycle,
  supplyChain,
  compliance,
  isLoading = false,
}: RiskCategorySummaryProps) {
  if (isLoading) {
    return <LoadingSkeleton />;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <CategoryCard category="lifecycle" counts={lifecycle} />
      <CategoryCard category="supplyChain" counts={supplyChain} />
      <CategoryCard category="compliance" counts={compliance} />
    </div>
  );
}

export default RiskCategorySummary;
