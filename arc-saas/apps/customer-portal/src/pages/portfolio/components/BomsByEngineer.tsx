/**
 * BOMs by Engineer Component
 * CBP-P2-001: Engineer-level BOM metrics table
 */

import { useState } from 'react';
import { useList, useNavigation } from '@refinedev/core';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { type DateRange } from './DateRangePicker';

interface EngineerData {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  bomCount: number;
  estimatedSpend: number;
  enrichmentRate: number;
  atRiskCount: number;
}

interface BomsByEngineerProps {
  dateRange: DateRange;
}

type SortField = 'boms' | 'spend' | 'risk' | 'enrichment';

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

// Mock data for development - remove when API is ready
const MOCK_ENGINEERS: EngineerData[] = [
  {
    id: '1',
    name: 'Alice Johnson',
    email: 'alice@company.com',
    bomCount: 24,
    estimatedSpend: 45000,
    enrichmentRate: 92,
    atRiskCount: 3,
  },
  {
    id: '2',
    name: 'Bob Smith',
    email: 'bob@company.com',
    bomCount: 18,
    estimatedSpend: 38000,
    enrichmentRate: 87,
    atRiskCount: 5,
  },
  {
    id: '3',
    name: 'Carol Davis',
    email: 'carol@company.com',
    bomCount: 31,
    estimatedSpend: 62000,
    enrichmentRate: 95,
    atRiskCount: 2,
  },
  {
    id: '4',
    name: 'David Lee',
    email: 'david@company.com',
    bomCount: 15,
    estimatedSpend: 28000,
    enrichmentRate: 78,
    atRiskCount: 8,
  },
  {
    id: '5',
    name: 'Emma Wilson',
    email: 'emma@company.com',
    bomCount: 22,
    estimatedSpend: 41000,
    enrichmentRate: 89,
    atRiskCount: 4,
  },
];

export function BomsByEngineer({ dateRange }: BomsByEngineerProps) {
  const [sortBy, setSortBy] = useState<SortField>('boms');
  const { push } = useNavigation();

  // API integration - uncomment when ready
  // const { data, isLoading } = useList<EngineerData>({
  //   resource: 'portfolio/engineers',
  //   filters: [
  //     { field: 'dateFrom', operator: 'gte', value: dateRange.from.toISOString() },
  //     { field: 'dateTo', operator: 'lte', value: dateRange.to.toISOString() },
  //   ],
  //   sorters: [{ field: getSortField(sortBy), order: 'desc' }],
  // });

  // Mock data for development
  const isLoading = false;
  const sortedEngineers = [...MOCK_ENGINEERS].sort((a, b) => {
    switch (sortBy) {
      case 'boms':
        return b.bomCount - a.bomCount;
      case 'spend':
        return b.estimatedSpend - a.estimatedSpend;
      case 'risk':
        return b.atRiskCount - a.atRiskCount;
      case 'enrichment':
        return b.enrichmentRate - a.enrichmentRate;
      default:
        return 0;
    }
  });

  const handleEngineerClick = (engineerId: string) => {
    push(`/portfolio/engineer/${engineerId}`);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>BOMs by Engineer</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle>BOMs by Engineer</CardTitle>
        <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortField)}>
          <SelectTrigger className="w-[160px]" aria-label="Sort engineers by">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="boms">Sort by BOMs</SelectItem>
            <SelectItem value="spend">Sort by Spend</SelectItem>
            <SelectItem value="risk">Sort by Risk</SelectItem>
            <SelectItem value="enrichment">Sort by Enrichment</SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Engineer</TableHead>
              <TableHead className="text-right">BOMs</TableHead>
              <TableHead className="text-right">Est. Spend</TableHead>
              <TableHead>Enrichment</TableHead>
              <TableHead className="text-right">At Risk</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedEngineers.map((engineer) => (
              <TableRow
                key={engineer.id}
                className="cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => handleEngineerClick(engineer.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleEngineerClick(engineer.id);
                  }
                }}
                tabIndex={0}
                role="button"
                aria-label={`View details for ${engineer.name}`}
              >
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={engineer.avatar} alt="" />
                      <AvatarFallback>{getInitials(engineer.name)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">{engineer.name}</p>
                      <p className="text-xs text-muted-foreground">{engineer.email}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-right font-medium tabular-nums">
                  {engineer.bomCount}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatCurrency(engineer.estimatedSpend)}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Progress
                      value={engineer.enrichmentRate}
                      className={cn(
                        'w-20 h-2',
                        engineer.enrichmentRate >= 90
                          ? '[&>div]:bg-green-500'
                          : engineer.enrichmentRate >= 70
                          ? '[&>div]:bg-amber-500'
                          : '[&>div]:bg-red-500'
                      )}
                      aria-label={`Enrichment rate: ${engineer.enrichmentRate}%`}
                    />
                    <span className="text-sm text-muted-foreground tabular-nums">
                      {engineer.enrichmentRate}%
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  {engineer.atRiskCount > 0 ? (
                    <Badge variant="destructive" className="tabular-nums">
                      {engineer.atRiskCount}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="tabular-nums">
                      0
                    </Badge>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export default BomsByEngineer;
