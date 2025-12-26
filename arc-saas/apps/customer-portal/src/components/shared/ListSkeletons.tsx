/**
 * Skeleton loaders for list pages
 * Provides consistent loading states across BOM, Components, Team lists
 */

import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

interface TableSkeletonProps {
  /** Number of rows to show */
  rows?: number;
  /** Number of columns */
  columns?: number;
  /** Show header row */
  showHeader?: boolean;
}

/**
 * Table skeleton for list pages (BOM list, Team members, etc.)
 */
export function TableSkeleton({
  rows = 5,
  columns = 5,
  showHeader = true,
}: TableSkeletonProps) {
  return (
    <div className="w-full overflow-hidden rounded-md border">
      {/* Header */}
      {showHeader && (
        <div className="flex border-b bg-muted/50 px-4 py-3">
          {Array.from({ length: columns }).map((_, i) => (
            <div key={i} className="flex-1 px-2">
              <Skeleton className="h-4 w-20" />
            </div>
          ))}
        </div>
      )}

      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div
          key={rowIndex}
          className="flex items-center border-b px-4 py-3 last:border-b-0"
        >
          {Array.from({ length: columns }).map((_, colIndex) => (
            <div key={colIndex} className="flex-1 px-2">
              <Skeleton
                className={`h-4 ${
                  colIndex === 0 ? 'w-32' : colIndex === columns - 1 ? 'w-16' : 'w-24'
                }`}
              />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

interface CardGridSkeletonProps {
  /** Number of cards to show */
  cards?: number;
  /** Grid columns (responsive) */
  columns?: 1 | 2 | 3 | 4;
}

/**
 * Card grid skeleton for card-based lists (team members, components)
 */
export function CardGridSkeleton({ cards = 6, columns = 3 }: CardGridSkeletonProps) {
  const gridClass = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
  }[columns];

  return (
    <div className={`grid gap-4 ${gridClass}`}>
      {Array.from({ length: cards }).map((_, i) => (
        <Card key={i}>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-3/4" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

interface BomListSkeletonProps {
  rows?: number;
}

/**
 * BOM list specific skeleton
 */
export function BomListSkeleton({ rows = 5 }: BomListSkeletonProps) {
  return (
    <div className="space-y-4">
      {/* Header with search and filters */}
      <div className="flex items-center justify-between gap-4">
        <Skeleton className="h-10 w-64" /> {/* Search */}
        <div className="flex gap-2">
          <Skeleton className="h-10 w-32" /> {/* Status filter */}
          <Skeleton className="h-10 w-24" /> {/* Create button */}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        {/* Header */}
        <div className="flex border-b bg-muted/50 px-4 py-3">
          <div className="w-8 px-2">
            <Skeleton className="h-4 w-4" />
          </div>
          <div className="flex-1 px-2">
            <Skeleton className="h-4 w-16" /> {/* Name */}
          </div>
          <div className="w-24 px-2">
            <Skeleton className="h-4 w-14" /> {/* Status */}
          </div>
          <div className="w-20 px-2">
            <Skeleton className="h-4 w-12" /> {/* Lines */}
          </div>
          <div className="w-32 px-2">
            <Skeleton className="h-4 w-20" /> {/* Progress */}
          </div>
          <div className="w-28 px-2">
            <Skeleton className="h-4 w-16" /> {/* Created */}
          </div>
          <div className="w-16 px-2" />
        </div>

        {/* Rows */}
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center border-b px-4 py-3 last:border-b-0">
            <div className="w-8 px-2">
              <Skeleton className="h-4 w-4" />
            </div>
            <div className="flex-1 px-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="mt-1 h-3 w-24" />
            </div>
            <div className="w-24 px-2">
              <Skeleton className="h-6 w-16 rounded-full" />
            </div>
            <div className="w-20 px-2">
              <Skeleton className="h-4 w-8" />
            </div>
            <div className="w-32 px-2">
              <Skeleton className="h-2 w-full rounded-full" />
            </div>
            <div className="w-28 px-2">
              <Skeleton className="h-4 w-20" />
            </div>
            <div className="w-16 px-2">
              <Skeleton className="h-8 w-8 rounded" />
            </div>
          </div>
        ))}
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-32" />
        <div className="flex gap-1">
          <Skeleton className="h-8 w-8" />
          <Skeleton className="h-8 w-8" />
          <Skeleton className="h-8 w-8" />
        </div>
      </div>
    </div>
  );
}

/**
 * Component catalog list skeleton
 */
export function ComponentListSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="space-y-4">
      {/* Search and filters */}
      <div className="flex flex-wrap items-center gap-4">
        <Skeleton className="h-10 w-72" /> {/* Search */}
        <Skeleton className="h-10 w-40" /> {/* Category filter */}
        <Skeleton className="h-10 w-36" /> {/* Manufacturer filter */}
        <Skeleton className="h-10 w-32" /> {/* Lifecycle filter */}
      </div>

      {/* Results grid */}
      <div className="grid gap-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 rounded-lg border p-4"
          >
            <Skeleton className="h-12 w-12 rounded" /> {/* Image */}
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <Skeleton className="h-5 w-32" /> {/* MPN */}
                <Skeleton className="h-5 w-16 rounded-full" /> {/* Status badge */}
              </div>
              <Skeleton className="h-4 w-24" /> {/* Manufacturer */}
              <Skeleton className="h-3 w-64" /> {/* Description */}
            </div>
            <div className="text-right space-y-1">
              <Skeleton className="ml-auto h-5 w-16" /> {/* Price */}
              <Skeleton className="ml-auto h-3 w-12" /> {/* MOQ */}
            </div>
            <Skeleton className="h-8 w-20" /> {/* Action button */}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Team members list skeleton
 */
export function TeamListSkeleton({ members = 6 }: { members?: number }) {
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <Skeleton className="h-10 w-48" /> {/* Search */}
          <Skeleton className="h-10 w-32" /> {/* Role filter */}
        </div>
        <Skeleton className="h-10 w-32" /> {/* Invite button */}
      </div>

      {/* Member cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: members }).map((_, i) => (
          <Card key={i}>
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <Skeleton className="h-12 w-12 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-5 w-32" /> {/* Name */}
                  <Skeleton className="h-4 w-40" /> {/* Email */}
                  <div className="flex items-center gap-2 pt-1">
                    <Skeleton className="h-5 w-16 rounded-full" /> {/* Role badge */}
                    <Skeleton className="h-4 w-20" /> {/* Status */}
                  </div>
                </div>
                <Skeleton className="h-8 w-8 rounded" /> {/* Menu */}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

/**
 * Invoice list skeleton
 */
export function InvoiceListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-4">
        <Skeleton className="h-10 w-32" /> {/* Status filter */}
        <Skeleton className="h-10 w-40" /> {/* Date range */}
      </div>

      {/* Table */}
      <TableSkeleton rows={rows} columns={6} />
    </div>
  );
}

/**
 * Generic page loading skeleton with title
 */
export function PageSkeleton({
  title = true,
  description = true,
  children,
}: {
  title?: boolean;
  description?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-6">
      {(title || description) && (
        <div className="space-y-2">
          {title && <Skeleton className="h-8 w-48" />}
          {description && <Skeleton className="h-4 w-96" />}
        </div>
      )}
      {children}
    </div>
  );
}

/**
 * Settings page skeleton
 */
export function SettingsSkeleton({ sections = 3 }: { sections?: number }) {
  return (
    <div className="space-y-6 p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="space-y-2">
        <Skeleton className="h-9 w-32" />
        <Skeleton className="h-4 w-80" />
      </div>

      {/* Tabs */}
      <div className="space-y-6">
        <Skeleton className="h-10 w-full max-w-md" />

        {/* Section cards */}
        <div className="space-y-4">
          {Array.from({ length: sections }).map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-40" />
                <Skeleton className="h-4 w-64 mt-2" />
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-10 w-full" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-10 w-full" />
                </div>
                <Skeleton className="h-10 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

