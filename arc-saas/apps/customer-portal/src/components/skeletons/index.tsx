/**
 * Skeleton Patterns - CBP-P3-009
 *
 * Pre-built skeleton components that match actual content layouts.
 * These skeletons provide smooth loading states that visually align
 * with the final rendered content for a better user experience.
 *
 * @module components/skeletons
 */

import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { cn } from '@/lib/utils';

/**
 * BomCardSkeleton - Matches BOM card layout used in grid views
 *
 * @example
 * ```tsx
 * <div className="grid grid-cols-3 gap-4">
 *   {isLoading ? (
 *     <>
 *       <BomCardSkeleton />
 *       <BomCardSkeleton />
 *       <BomCardSkeleton />
 *     </>
 *   ) : (
 *     boms.map(bom => <BomCard key={bom.id} bom={bom} />)
 *   )}
 * </div>
 * ```
 */
export function BomCardSkeleton({ className }: { className?: string }) {
  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1 space-y-2">
            <Skeleton className="h-5 w-3/4" /> {/* BOM name */}
            <Skeleton className="h-3 w-1/2" /> {/* File name */}
          </div>
          <Skeleton variant="circular" width={24} height={24} /> {/* Status badge */}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {/* Stats row */}
          <div className="flex items-center justify-between text-sm">
            <div className="space-y-1">
              <Skeleton className="h-3 w-16" /> {/* Label */}
              <Skeleton className="h-5 w-12" /> {/* Value */}
            </div>
            <div className="space-y-1">
              <Skeleton className="h-3 w-20" /> {/* Label */}
              <Skeleton className="h-5 w-16" /> {/* Value */}
            </div>
          </div>

          {/* Progress bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Skeleton className="h-3 w-24" /> {/* Progress label */}
              <Skeleton className="h-3 w-8" /> {/* Percentage */}
            </div>
            <Skeleton className="h-2 w-full rounded-full" /> {/* Progress bar */}
          </div>

          {/* Footer actions */}
          <div className="flex items-center justify-between pt-2 border-t">
            <Skeleton className="h-3 w-20" /> {/* Date */}
            <div className="flex gap-1">
              <Skeleton variant="circular" width={32} height={32} /> {/* Action button */}
              <Skeleton variant="circular" width={32} height={32} /> {/* Action button */}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * BomTableRowSkeleton - Matches table row layout for BOM lists
 *
 * @example
 * ```tsx
 * <Table>
 *   <TableBody>
 *     {isLoading ? (
 *       <>
 *         <BomTableRowSkeleton />
 *         <BomTableRowSkeleton />
 *         <BomTableRowSkeleton />
 *       </>
 *     ) : (
 *       boms.map(bom => <BomRow key={bom.id} bom={bom} />)
 *     )}
 *   </TableBody>
 * </Table>
 * ```
 */
export function BomTableRowSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center border-b px-4 py-3', className)}>
      {/* Checkbox */}
      <div className="w-8 px-2">
        <Skeleton variant="circular" width={16} height={16} />
      </div>

      {/* Name column */}
      <div className="flex-1 px-2 space-y-1">
        <Skeleton className="h-4 w-48" /> {/* BOM name */}
        <Skeleton className="h-3 w-32" /> {/* Description */}
      </div>

      {/* Status column */}
      <div className="w-24 px-2">
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>

      {/* Lines column */}
      <div className="w-20 px-2">
        <Skeleton className="h-4 w-12" />
      </div>

      {/* Progress column */}
      <div className="w-32 px-2">
        <Skeleton className="h-2 w-full rounded-full" />
      </div>

      {/* Date column */}
      <div className="w-28 px-2">
        <Skeleton className="h-4 w-24" />
      </div>

      {/* Actions column */}
      <div className="w-16 px-2">
        <Skeleton variant="circular" width={32} height={32} />
      </div>
    </div>
  );
}

/**
 * BomDetailSkeleton - Full page skeleton for BOM detail view
 *
 * Matches the complete layout including header, stats, and line items table
 *
 * @example
 * ```tsx
 * function BomDetailPage() {
 *   const { data: bom, isLoading } = useBom(bomId);
 *
 *   if (isLoading) return <BomDetailSkeleton />;
 *
 *   return <BomDetailView bom={bom} />;
 * }
 * ```
 */
export function BomDetailSkeleton() {
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Skeleton variant="circular" width={40} height={40} /> {/* Back button */}
          <div className="space-y-2">
            <Skeleton className="h-7 w-64" /> {/* Title */}
            <Skeleton className="h-4 w-48" /> {/* Subtitle */}
          </div>
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-32" /> {/* Action button */}
          <Skeleton className="h-9 w-28" /> {/* Action button */}
          <Skeleton className="h-9 w-24" /> {/* Action button */}
        </div>
      </div>

      {/* Summary stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-3 w-24" /> {/* Label */}
              <Skeleton className="h-8 w-20 mt-2" /> {/* Value */}
            </CardHeader>
            <CardContent className="pt-0">
              <Skeleton className="h-2 w-full rounded-full" /> {/* Progress bar */}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters section */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <Skeleton className="h-6 w-24" /> {/* Title */}
            <div className="flex gap-2">
              <Skeleton className="h-10 w-64" /> {/* Search */}
              <Skeleton className="h-10 w-40" /> {/* Filter dropdown */}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {/* Line items table skeleton */}
          <LineItemTableSkeleton rows={10} />
        </CardContent>
      </Card>

      {/* Metadata card */}
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-20" /> {/* Title */}
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="space-y-1">
                <Skeleton className="h-3 w-20" /> {/* Label */}
                <Skeleton className="h-4 w-32" /> {/* Value */}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * LineItemTableSkeleton - Matches BOM line items table
 *
 * Internal component used by BomDetailSkeleton
 */
function LineItemTableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="w-full">
      {/* Table header */}
      <div className="flex border-b bg-muted/50 px-4 py-3">
        <div className="w-16 px-2"><Skeleton className="h-4 w-8" /></div>
        <div className="w-48 px-2"><Skeleton className="h-4 w-12" /></div>
        <div className="flex-1 px-2"><Skeleton className="h-4 w-24" /></div>
        <div className="w-20 px-2"><Skeleton className="h-4 w-12" /></div>
        <div className="flex-1 px-2"><Skeleton className="h-4 w-20" /></div>
        <div className="w-32 px-2"><Skeleton className="h-4 w-16" /></div>
        <div className="w-24 px-2"><Skeleton className="h-4 w-12" /></div>
        <div className="w-20 px-2"><Skeleton className="h-4 w-12" /></div>
      </div>

      {/* Table rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <LineItemRowSkeleton key={i} />
      ))}
    </div>
  );
}

/**
 * LineItemRowSkeleton - Single line item row in BOM detail table
 *
 * @example
 * ```tsx
 * <TableBody>
 *   {isLoading ? (
 *     Array.from({ length: 5 }).map((_, i) => (
 *       <LineItemRowSkeleton key={i} />
 *     ))
 *   ) : (
 *     lineItems.map(item => <LineItemRow key={item.id} item={item} />)
 *   )}
 * </TableBody>
 * ```
 */
export function LineItemRowSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center border-b px-4 py-3 last:border-b-0', className)}>
      {/* Line number */}
      <div className="w-16 px-2">
        <Skeleton className="h-4 w-8" />
      </div>

      {/* MPN */}
      <div className="w-48 px-2 space-y-1">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-20" /> {/* Datasheet link */}
      </div>

      {/* Manufacturer */}
      <div className="flex-1 px-2">
        <Skeleton className="h-4 w-28" />
      </div>

      {/* Quantity */}
      <div className="w-20 px-2 text-center">
        <Skeleton className="h-4 w-12 mx-auto" />
      </div>

      {/* Description */}
      <div className="flex-1 px-2">
        <Skeleton className="h-4 w-48" />
      </div>

      {/* Status */}
      <div className="w-32 px-2">
        <Skeleton className="h-6 w-20 rounded-full mx-auto" />
      </div>

      {/* Price */}
      <div className="w-24 px-2 text-right">
        <Skeleton className="h-4 w-16 ml-auto" />
      </div>

      {/* Stock */}
      <div className="w-20 px-2 text-right">
        <Skeleton className="h-5 w-12 rounded-full ml-auto" />
      </div>
    </div>
  );
}

/**
 * ComponentCardSkeleton - Matches component search result card
 *
 * Used in component catalog search results
 *
 * @example
 * ```tsx
 * <div className="space-y-3">
 *   {isLoading ? (
 *     Array.from({ length: 8 }).map((_, i) => (
 *       <ComponentCardSkeleton key={i} />
 *     ))
 *   ) : (
 *     components.map(c => <ComponentCard key={c.id} component={c} />)
 *   )}
 * </div>
 * ```
 */
export function ComponentCardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-4 rounded-lg border p-4', className)}>
      {/* Component image/icon */}
      <Skeleton variant="circular" width={48} height={48} />

      {/* Component details */}
      <div className="flex-1 space-y-2">
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-40" /> {/* MPN */}
          <Skeleton variant="circular" width={20} height={20} /> {/* Status badge */}
        </div>
        <Skeleton className="h-4 w-32" /> {/* Manufacturer */}
        <Skeleton className="h-3 w-64" /> {/* Description */}
      </div>

      {/* Pricing info */}
      <div className="text-right space-y-1">
        <Skeleton className="h-5 w-16 ml-auto" /> {/* Price */}
        <Skeleton className="h-3 w-12 ml-auto" /> {/* MOQ */}
      </div>

      {/* Action button */}
      <Skeleton className="h-8 w-20 rounded-md" />
    </div>
  );
}

/**
 * DashboardWidgetSkeleton - Matches dashboard widget/card layout
 *
 * Used for dashboard analytics widgets
 *
 * @example
 * ```tsx
 * function DashboardPage() {
 *   const { data: stats, isLoading } = useDashboardStats();
 *
 *   return (
 *     <div className="grid grid-cols-3 gap-4">
 *       {isLoading ? (
 *         <>
 *           <DashboardWidgetSkeleton />
 *           <DashboardWidgetSkeleton />
 *           <DashboardWidgetSkeleton />
 *         </>
 *       ) : (
 *         <>
 *           <BomSummaryWidget data={stats.boms} />
 *           <EnrichmentWidget data={stats.enrichment} />
 *           <RiskWidget data={stats.risks} />
 *         </>
 *       )}
 *     </div>
 *   );
 * }
 * ```
 */
export function DashboardWidgetSkeleton({
  className,
  variant = 'default'
}: {
  className?: string;
  variant?: 'default' | 'compact' | 'detailed';
}) {
  if (variant === 'compact') {
    return (
      <Card className={className}>
        <CardContent className="pt-6">
          <div className="space-y-2">
            <Skeleton className="h-8 w-16" /> {/* Value */}
            <Skeleton className="h-3 w-24" /> {/* Label */}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (variant === 'detailed') {
    return (
      <Card className={className}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <Skeleton className="h-6 w-32" /> {/* Title */}
            <Skeleton variant="circular" width={32} height={32} /> {/* Icon */}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Main stat */}
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Skeleton className="h-8 w-20" /> {/* Value */}
              <Skeleton className="h-3 w-24" /> {/* Label */}
            </div>
            <Skeleton className="h-4 w-16" /> {/* Trend */}
          </div>

          {/* Progress bar */}
          <Skeleton className="h-3 w-full rounded-full" />

          {/* Breakdown stats */}
          <div className="grid grid-cols-2 gap-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                <Skeleton variant="circular" width={12} height={12} />
                <div className="flex-1 space-y-1">
                  <Skeleton className="h-4 w-8" /> {/* Value */}
                  <Skeleton className="h-3 w-16" /> {/* Label */}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Default variant
  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <Skeleton className="h-5 w-32" /> {/* Title */}
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-20" /> {/* Value */}
          <Skeleton className="h-4 w-16" /> {/* Trend */}
        </div>
        <Skeleton className="h-2 w-full rounded-full" /> {/* Progress */}
      </CardContent>
    </Card>
  );
}

/**
 * SkeletonGroup - Utility component to render multiple skeletons with wave animation
 *
 * Applies staggered wave animation for list-like skeletons
 *
 * @example
 * ```tsx
 * <SkeletonGroup count={5} animation="wave">
 *   <BomCardSkeleton />
 * </SkeletonGroup>
 * ```
 */
export function SkeletonGroup({
  count,
  children,
  animation = 'pulse',
  className,
}: {
  count: number;
  children: React.ReactElement;
  animation?: 'pulse' | 'wave' | 'none';
  className?: string;
}) {
  return (
    <div className={className}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={animation === 'wave' ? 'animate-shimmer' : ''}
          style={
            animation === 'wave'
              ? { animationDelay: `${i * 100}ms` }
              : undefined
          }
        >
          {children}
        </div>
      ))}
    </div>
  );
}
