import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, TrendingDown, Bell, Package } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SEVERITY_COLORS } from '@/components/bom/ProcessingQueueView';
import type { AlertStats } from '@/types/alert';

interface AlertStatsCardsProps {
  stats: AlertStats | undefined;
  isLoading: boolean;
}

export function AlertStatsCards({ stats, isLoading }: AlertStatsCardsProps) {
  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="p-4">
            <Skeleton className="h-16 w-full" />
          </Card>
        ))}
      </div>
    );
  }

  if (!stats || !stats.bySeverity) {
    return null;
  }

  // Use centralized SEVERITY_COLORS for consistent styling across the app
  const cards = [
    {
      label: 'Critical',
      severity: 'critical' as const,
      value: stats.bySeverity.critical ?? 0,
      icon: AlertCircle,
    },
    {
      label: 'High',
      severity: 'high' as const,
      value: stats.bySeverity.high ?? 0,
      icon: TrendingDown,
    },
    {
      label: 'Medium',
      severity: 'medium' as const,
      value: stats.bySeverity.medium ?? 0,
      icon: Bell,
    },
    {
      label: 'Low',
      severity: 'low' as const,
      value: stats.bySeverity.low ?? 0,
      icon: Package,
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-4">
      {cards.map((card) => {
        const Icon = card.icon;
        const colors = SEVERITY_COLORS[card.severity];
        return (
          <Card key={card.label} className={cn("p-4", colors.bg)}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{card.label}</p>
                <p className={cn("text-2xl font-bold", colors.text)}>{card.value}</p>
              </div>
              <Icon className={cn("h-8 w-8", colors.text)} />
            </div>
          </Card>
        );
      })}
    </div>
  );
}
