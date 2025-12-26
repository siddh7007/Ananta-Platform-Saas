/**
 * Top Risks Table
 * Displays the highest-risk components in a table format
 */

import { AlertTriangle, ExternalLink } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { ComponentRiskScore } from '@/services/risk.service';

export interface TopRisksTableProps {
  risks: ComponentRiskScore[];
  isLoading?: boolean;
  onViewComponent?: (componentId: string) => void;
  limit?: number;
}

const RISK_LEVEL_CONFIG = {
  critical: {
    label: 'Critical',
    variant: 'destructive' as const,
    color: 'text-red-700',
    bg: 'bg-red-50',
  },
  high: {
    label: 'High',
    variant: 'default' as const,
    color: 'text-orange-700',
    bg: 'bg-orange-50',
  },
  medium: {
    label: 'Medium',
    variant: 'warning' as const,
    color: 'text-yellow-700',
    bg: 'bg-yellow-50',
  },
  low: {
    label: 'Low',
    variant: 'success' as const,
    color: 'text-green-700',
    bg: 'bg-green-50',
  },
};

export function TopRisksTable({
  risks,
  isLoading = false,
  onViewComponent,
  limit = 10,
}: TopRisksTableProps) {
  if (isLoading) {
    return (
      <Card>
        <div className="p-6">
          <Skeleton className="h-6 w-48 mb-4" />
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </div>
      </Card>
    );
  }

  const displayRisks = risks.slice(0, limit);

  if (displayRisks.length === 0) {
    return (
      <Card>
        <div className="p-12 text-center">
          <div className="rounded-full bg-green-100 dark:bg-green-900/30 p-3 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
            <AlertTriangle className="h-8 w-8 text-green-500" />
          </div>
          <h3 className="font-semibold mb-2">No High-Risk Components</h3>
          <p className="text-sm text-muted-foreground">
            All components are within acceptable risk thresholds
          </p>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Top {limit} High-Risk Components</h3>
          <Badge variant="outline">{risks.length} total high-risk</Badge>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>MPN</TableHead>
                <TableHead>Manufacturer</TableHead>
                <TableHead className="text-center">Risk Score</TableHead>
                <TableHead className="text-center">Level</TableHead>
                <TableHead>Primary Risk</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayRisks.map((risk) => {
                const config = RISK_LEVEL_CONFIG[risk.risk_level] || RISK_LEVEL_CONFIG.low;

                // Extract primary risk factor
                const primaryRisk = risk.lifecycle_risk > 50
                  ? 'Lifecycle'
                  : risk.supply_chain_risk > 50
                  ? 'Supply Chain'
                  : risk.compliance_risk > 50
                  ? 'Compliance'
                  : risk.obsolescence_risk > 50
                  ? 'Obsolescence'
                  : 'Single Source';

                return (
                  <TableRow key={risk.component_id}>
                    <TableCell className="font-medium">
                      <div className="max-w-[200px] truncate" title={risk.mpn}>
                        {risk.mpn || 'N/A'}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="max-w-[150px] truncate" title={risk.manufacturer}>
                        {risk.manufacturer || 'Unknown'}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className={cn('inline-flex items-center justify-center px-2 py-1 rounded', config.bg)}>
                        <span className={cn('text-sm font-semibold', config.color)}>
                          {risk.total_risk_score.toFixed(0)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={config.variant} className="capitalize">
                        {config.label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {primaryRisk}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onViewComponent?.(risk.component_id)}
                      >
                        View
                        <ExternalLink className="h-3 w-3 ml-1" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    </Card>
  );
}

export default TopRisksTable;
