/**
 * Risk Alerts Widget
 * CBP-P2-008: Dashboard Analytics - Component risk alerts
 */

import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, AlertCircle, Info, ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface RiskAlert {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  type: 'obsolete' | 'eol' | 'shortage' | 'price_increase' | 'long_lead';
  title: string;
  description: string;
  affectedItems: number;
  bomNames: string[];
  timestamp: string;
}

// Mock data for development
const MOCK_ALERTS: RiskAlert[] = [
  {
    id: '1',
    severity: 'critical',
    type: 'obsolete',
    title: 'Component Obsolete',
    description: 'STM32F103C8T6 has been marked obsolete by manufacturer',
    affectedItems: 12,
    bomNames: ['Sensor-Board-v2', 'Control-Unit-v3'],
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '2',
    severity: 'high',
    type: 'shortage',
    title: 'Supply Shortage',
    description: 'GRM21BR71H104KA01L experiencing global allocation',
    affectedItems: 45,
    bomNames: ['Product-A-Rev3', 'Power-Supply-Unit'],
    timestamp: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '3',
    severity: 'medium',
    type: 'long_lead',
    title: 'Extended Lead Time',
    description: 'Multiple TI components now have 52+ week lead times',
    affectedItems: 8,
    bomNames: ['Control-Board-v1'],
    timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '4',
    severity: 'low',
    type: 'price_increase',
    title: 'Price Increase',
    description: 'Yageo resistor series pricing increased by 15%',
    affectedItems: 120,
    bomNames: ['Product-A-Rev3', 'Sensor-Board-v2', 'Power-Supply-Unit'],
    timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

const SEVERITY_CONFIG = {
  critical: {
    icon: AlertTriangle,
    color: 'text-red-500',
    bg: 'bg-red-50 dark:bg-red-900/20',
    border: 'border-red-200 dark:border-red-800',
    badge: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  },
  high: {
    icon: AlertCircle,
    color: 'text-orange-500',
    bg: 'bg-orange-50 dark:bg-orange-900/20',
    border: 'border-orange-200 dark:border-orange-800',
    badge: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  },
  medium: {
    icon: AlertCircle,
    color: 'text-amber-500',
    bg: 'bg-amber-50 dark:bg-amber-900/20',
    border: 'border-amber-200 dark:border-amber-800',
    badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  },
  low: {
    icon: Info,
    color: 'text-blue-500',
    bg: 'bg-blue-50 dark:bg-blue-900/20',
    border: 'border-blue-200 dark:border-blue-800',
    badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  },
};

export function RiskAlertsWidget() {
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard-risk-alerts'],
    queryFn: async () => {
      await new Promise((r) => setTimeout(r, 500));
      return MOCK_ALERTS;
    },
    staleTime: 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-20" />
        ))}
      </div>
    );
  }

  const alerts = data || MOCK_ALERTS;

  if (alerts.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center">
        <div className="rounded-full bg-green-100 dark:bg-green-900/30 p-3 mb-3">
          <AlertTriangle className="h-6 w-6 text-green-500" />
        </div>
        <p className="font-medium">No Risk Alerts</p>
        <p className="text-sm text-muted-foreground">
          All components are in good standing
        </p>
      </div>
    );
  }

  const criticalCount = alerts.filter((a) => a.severity === 'critical').length;
  const highCount = alerts.filter((a) => a.severity === 'high').length;

  return (
    <div className="h-full flex flex-col">
      {/* Summary */}
      <div className="flex items-center gap-2 mb-3">
        {criticalCount > 0 && (
          <Badge className={SEVERITY_CONFIG.critical.badge}>
            {criticalCount} Critical
          </Badge>
        )}
        {highCount > 0 && (
          <Badge className={SEVERITY_CONFIG.high.badge}>
            {highCount} High
          </Badge>
        )}
        <Badge variant="outline" className="ml-auto">
          {alerts.length} total
        </Badge>
      </div>

      {/* Alerts List */}
      <ScrollArea className="flex-1 -mx-2 px-2">
        <div className="space-y-2">
          {alerts.map((alert) => {
            const config = SEVERITY_CONFIG[alert.severity];
            const Icon = config.icon;

            return (
              <div
                key={alert.id}
                className={cn(
                  'p-3 rounded-lg border',
                  config.bg,
                  config.border
                )}
              >
                <div className="flex items-start gap-2">
                  <Icon className={cn('h-4 w-4 mt-0.5 flex-shrink-0', config.color)} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium truncate">{alert.title}</p>
                      <Badge variant="outline" className="text-xs flex-shrink-0">
                        {alert.affectedItems} items
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                      {alert.description}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <p className="text-xs text-muted-foreground">
                        {alert.bomNames.slice(0, 2).join(', ')}
                        {alert.bomNames.length > 2 && (
                          <span> +{alert.bomNames.length - 2} more</span>
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>

      {/* View All Link */}
      <div className="pt-2 mt-2 border-t">
        <Button variant="ghost" size="sm" className="w-full text-xs">
          View All Alerts
          <ExternalLink className="h-3 w-3 ml-1" />
        </Button>
      </div>
    </div>
  );
}

export default RiskAlertsWidget;
