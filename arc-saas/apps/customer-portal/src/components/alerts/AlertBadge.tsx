import { Badge } from '@/components/ui/badge';
import { SEVERITY_COLORS } from '@/components/bom/ProcessingQueueView';
import type { AlertSeverity, AlertType } from '@/types/alert';
import {
  AlertCircle,
  TrendingDown,
  DollarSign,
  Package,
  Shield,
  FileText,
  Truck,
} from 'lucide-react';

interface AlertBadgeProps {
  variant: 'severity' | 'type';
  value: AlertSeverity | AlertType;
  className?: string;
}

// Use centralized SEVERITY_COLORS for consistent badge styling
const severityConfig: Record<AlertSeverity, { label: string; className: string }> = {
  critical: {
    label: 'Critical',
    className: SEVERITY_COLORS.critical.badge,
  },
  high: {
    label: 'High',
    className: SEVERITY_COLORS.high.badge,
  },
  medium: {
    label: 'Medium',
    className: SEVERITY_COLORS.medium.badge,
  },
  low: {
    label: 'Low',
    className: SEVERITY_COLORS.low.badge,
  },
  info: {
    label: 'Info',
    className: SEVERITY_COLORS.info.badge,
  },
};

const typeConfig: Record<
  AlertType,
  { label: string; icon: React.ComponentType<{ className?: string }>; className: string }
> = {
  LIFECYCLE: {
    label: 'Lifecycle',
    icon: AlertCircle,
    className: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  },
  RISK: {
    label: 'Risk',
    icon: TrendingDown,
    className: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  },
  PRICE: {
    label: 'Price',
    icon: DollarSign,
    className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  },
  AVAILABILITY: {
    label: 'Availability',
    icon: Package,
    className: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  },
  COMPLIANCE: {
    label: 'Compliance',
    icon: Shield,
    className: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200',
  },
  PCN: {
    label: 'PCN',
    icon: FileText,
    className: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  },
  SUPPLY_CHAIN: {
    label: 'Supply Chain',
    icon: Truck,
    className: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200',
  },
};

export function AlertBadge({ variant, value, className = '' }: AlertBadgeProps) {
  if (variant === 'severity') {
    const config = severityConfig[value as AlertSeverity];
    return (
      <Badge className={`${config.className} ${className}`} variant="secondary">
        {config.label}
      </Badge>
    );
  }

  const config = typeConfig[value as AlertType];
  const Icon = config.icon;

  return (
    <Badge className={`${config.className} ${className} flex items-center gap-1`} variant="secondary">
      <Icon className="h-3 w-3" />
      <span>{config.label}</span>
    </Badge>
  );
}
