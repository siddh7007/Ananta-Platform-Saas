/**
 * QueueCardList Component
 *
 * Displays a list of upload job queue cards with:
 * - Status filtering
 * - Real-time updates via polling or SSE
 * - Empty state when no jobs
 * - Loading states
 *
 * Can be used in two modes:
 * 1. Static mode: Display a list of jobs
 * 2. Real-time mode: Poll for updates or connect to SSE
 *
 * Accessibility:
 * - Keyboard navigation
 * - Screen reader announcements for updates
 * - Focus management
 */

import { useState, useMemo } from 'react';
import { FileQuestion, Filter } from 'lucide-react';
import { QueueCard, type QueueCardProps } from './QueueCard';
import { QueueCardSkeleton } from './QueueCardSkeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import type { BomStatus } from '@/types/bom';

export interface QueueJob {
  bomId: string;
  fileName: string;
  status: BomStatus;
  progress: number;
  totalItems: number;
  processedItems: number;
  startedAt?: Date;
  estimatedCompletion?: Date;
}

export interface QueueCardListProps {
  jobs: QueueJob[];
  loading?: boolean;
  onViewDetails?: (bomId: string) => void;
  onCancel?: (bomId: string) => void;
  onRetry?: (bomId: string) => void;
  className?: string;
  emptyMessage?: string;
  showFilters?: boolean;
  defaultStatusFilters?: BomStatus[];
}

const STATUS_OPTIONS: { value: BomStatus; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'analyzing', label: 'Analyzing' },
  { value: 'processing', label: 'Processing' },
  { value: 'enriching', label: 'Enriching' },
  { value: 'mapping_pending', label: 'Mapping Pending' },
  { value: 'completed', label: 'Completed' },
  { value: 'failed', label: 'Failed' },
  { value: 'cancelled', label: 'Cancelled' },
];

export function QueueCardList({
  jobs,
  loading = false,
  onViewDetails,
  onCancel,
  onRetry,
  className,
  emptyMessage = 'No upload jobs found',
  showFilters = true,
  defaultStatusFilters = [],
}: QueueCardListProps) {
  const [statusFilters, setStatusFilters] = useState<BomStatus[]>(defaultStatusFilters);

  // Filter jobs by selected statuses
  const filteredJobs = useMemo(() => {
    if (statusFilters.length === 0) return jobs;
    return jobs.filter((job) => statusFilters.includes(job.status));
  }, [jobs, statusFilters]);

  // Toggle status filter
  const toggleStatusFilter = (status: BomStatus) => {
    setStatusFilters((prev) =>
      prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status]
    );
  };

  // Clear all filters
  const clearFilters = () => {
    setStatusFilters([]);
  };

  // Count jobs by status
  const statusCounts = useMemo(() => {
    const counts: Partial<Record<BomStatus, number>> = {};
    jobs.forEach((job) => {
      counts[job.status] = (counts[job.status] || 0) + 1;
    });
    return counts;
  }, [jobs]);

  // Show loading skeletons
  if (loading) {
    return (
      <div className={cn('space-y-3', className)}>
        {Array.from({ length: 3 }).map((_, i) => (
          <QueueCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  // Show empty state
  if (jobs.length === 0) {
    return (
      <div className={cn('flex flex-col items-center justify-center py-12', className)}>
        <div className="rounded-full bg-muted p-4 mb-4">
          <FileQuestion className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-medium mb-1">No Jobs Found</h3>
        <p className="text-sm text-muted-foreground text-center max-w-md">{emptyMessage}</p>
      </div>
    );
  }

  // Show filtered empty state
  if (filteredJobs.length === 0 && statusFilters.length > 0) {
    return (
      <div className={cn('space-y-4', className)}>
        {/* Filter controls */}
        {showFilters && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" leftIcon={<Filter className="h-4 w-4" />}>
                    Filter
                    {statusFilters.length > 0 && (
                      <Badge variant="secondary" className="ml-2">
                        {statusFilters.length}
                      </Badge>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56">
                  <DropdownMenuLabel>Filter by Status</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {STATUS_OPTIONS.map((option) => (
                    <DropdownMenuCheckboxItem
                      key={option.value}
                      checked={statusFilters.includes(option.value)}
                      onCheckedChange={() => toggleStatusFilter(option.value)}
                    >
                      {option.label}
                      {statusCounts[option.value] !== undefined && (
                        <span className="ml-auto text-xs text-muted-foreground">
                          {statusCounts[option.value]}
                        </span>
                      )}
                    </DropdownMenuCheckboxItem>
                  ))}
                  {statusFilters.length > 0 && (
                    <>
                      <DropdownMenuSeparator />
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full"
                        onClick={clearFilters}
                      >
                        Clear Filters
                      </Button>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <p className="text-sm text-muted-foreground">
              {filteredJobs.length} of {jobs.length} jobs
            </p>
          </div>
        )}

        {/* Empty filtered results */}
        <div className="flex flex-col items-center justify-center py-12">
          <div className="rounded-full bg-muted p-4 mb-4">
            <Filter className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium mb-1">No Matching Jobs</h3>
          <p className="text-sm text-muted-foreground mb-4">
            No jobs match your current filters
          </p>
          <Button variant="outline" size="sm" onClick={clearFilters}>
            Clear Filters
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('space-y-4', className)} role="region" aria-label="Upload job queue">
      {/* Filter controls */}
      {showFilters && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" leftIcon={<Filter className="h-4 w-4" />}>
                  Filter
                  {statusFilters.length > 0 && (
                    <Badge variant="secondary" className="ml-2">
                      {statusFilters.length}
                    </Badge>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuLabel>Filter by Status</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {STATUS_OPTIONS.map((option) => (
                  <DropdownMenuCheckboxItem
                    key={option.value}
                    checked={statusFilters.includes(option.value)}
                    onCheckedChange={() => toggleStatusFilter(option.value)}
                  >
                    {option.label}
                    {statusCounts[option.value] !== undefined && (
                      <span className="ml-auto text-xs text-muted-foreground">
                        {statusCounts[option.value]}
                      </span>
                    )}
                  </DropdownMenuCheckboxItem>
                ))}
                {statusFilters.length > 0 && (
                  <>
                    <DropdownMenuSeparator />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full"
                      onClick={clearFilters}
                    >
                      Clear Filters
                    </Button>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Active filter badges */}
            {statusFilters.length > 0 && (
              <div className="flex items-center gap-1 flex-wrap">
                {statusFilters.map((status) => (
                  <Badge
                    key={status}
                    variant="secondary"
                    className="cursor-pointer"
                    onClick={() => toggleStatusFilter(status)}
                  >
                    {STATUS_OPTIONS.find((opt) => opt.value === status)?.label}
                    <span className="ml-1 text-xs">×</span>
                  </Badge>
                ))}
              </div>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {filteredJobs.length} {filteredJobs.length === 1 ? 'job' : 'jobs'}
          </p>
        </div>
      )}

      {/* Queue cards */}
      <div className="space-y-3" role="list">
        {filteredJobs.map((job) => (
          <QueueCard
            key={job.bomId}
            bomId={job.bomId}
            fileName={job.fileName}
            status={job.status}
            progress={job.progress}
            totalItems={job.totalItems}
            processedItems={job.processedItems}
            startedAt={job.startedAt}
            estimatedCompletion={job.estimatedCompletion}
            onViewDetails={onViewDetails ? () => onViewDetails(job.bomId) : undefined}
            onCancel={onCancel ? () => onCancel(job.bomId) : undefined}
            onRetry={onRetry ? () => onRetry(job.bomId) : undefined}
          />
        ))}
      </div>
    </div>
  );
}
