/**
 * Skeleton Loading Examples - CBP-P3-009
 *
 * This file demonstrates usage patterns for all skeleton components.
 * Reference these examples when implementing loading states in your components.
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  BomCardSkeleton,
  BomTableRowSkeleton,
  BomDetailSkeleton,
  ComponentCardSkeleton,
  DashboardWidgetSkeleton,
  LineItemRowSkeleton,
  SkeletonGroup,
} from './index';

/**
 * Example 1: Basic Skeleton Variants
 */
export function BasicSkeletonExample() {
  return (
    <div className="space-y-4 p-6">
      <h3 className="text-lg font-semibold">Basic Skeleton Variants</h3>

      {/* Text skeleton */}
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">Text variant:</p>
        <Skeleton variant="text" className="h-4 w-64" />
      </div>

      {/* Circular skeleton (avatar) */}
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">Circular variant (avatar):</p>
        <Skeleton variant="circular" width={48} height={48} />
      </div>

      {/* Rectangular skeleton */}
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">Rectangular variant:</p>
        <Skeleton variant="rectangular" className="h-32 w-full" />
      </div>
    </div>
  );
}

/**
 * Example 2: Animation Types
 */
export function AnimationExample() {
  return (
    <div className="space-y-6 p-6">
      <h3 className="text-lg font-semibold">Animation Types</h3>

      {/* Pulse animation (default) */}
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">Pulse animation (default):</p>
        <Skeleton animation="pulse" className="h-12 w-full" />
      </div>

      {/* Wave/Shimmer animation */}
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">Wave/Shimmer animation:</p>
        <Skeleton animation="wave" className="h-12 w-full" />
      </div>

      {/* No animation */}
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">No animation:</p>
        <Skeleton animation="none" className="h-12 w-full" />
      </div>
    </div>
  );
}

/**
 * Example 3: BOM Card Grid with Loading State
 */
export function BomCardGridExample() {
  const [isLoading, setIsLoading] = useState(true);

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">BOM Card Grid</h3>
        <Button onClick={() => setIsLoading(!isLoading)} variant="outline" size="sm">
          Toggle Loading
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? (
          <>
            <BomCardSkeleton />
            <BomCardSkeleton />
            <BomCardSkeleton />
            <BomCardSkeleton />
            <BomCardSkeleton />
            <BomCardSkeleton />
          </>
        ) : (
          <div className="col-span-full text-center p-8 text-muted-foreground">
            Actual BOM cards would appear here
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Example 4: BOM Table with Row Skeletons
 */
export function BomTableExample() {
  const [isLoading, setIsLoading] = useState(true);

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">BOM Table</h3>
        <Button onClick={() => setIsLoading(!isLoading)} variant="outline" size="sm">
          Toggle Loading
        </Button>
      </div>

      <div className="rounded-lg border">
        {isLoading ? (
          <>
            <BomTableRowSkeleton />
            <BomTableRowSkeleton />
            <BomTableRowSkeleton />
            <BomTableRowSkeleton />
            <BomTableRowSkeleton />
          </>
        ) : (
          <div className="p-8 text-center text-muted-foreground">
            Actual BOM rows would appear here
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Example 5: Line Item Rows with Wave Animation
 */
export function LineItemExample() {
  const [isLoading, setIsLoading] = useState(true);

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Line Items (with Wave Animation)</h3>
        <Button onClick={() => setIsLoading(!isLoading)} variant="outline" size="sm">
          Toggle Loading
        </Button>
      </div>

      <div className="rounded-lg border">
        {isLoading ? (
          <SkeletonGroup count={8} animation="wave">
            <LineItemRowSkeleton />
          </SkeletonGroup>
        ) : (
          <div className="p-8 text-center text-muted-foreground">
            Actual line item rows would appear here
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Example 6: Component Search Results
 */
export function ComponentSearchExample() {
  const [isLoading, setIsLoading] = useState(true);

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Component Search Results</h3>
        <Button onClick={() => setIsLoading(!isLoading)} variant="outline" size="sm">
          Toggle Loading
        </Button>
      </div>

      <div className="space-y-3">
        {isLoading ? (
          <>
            <ComponentCardSkeleton />
            <ComponentCardSkeleton />
            <ComponentCardSkeleton />
            <ComponentCardSkeleton />
            <ComponentCardSkeleton />
          </>
        ) : (
          <div className="p-8 text-center text-muted-foreground">
            Actual component cards would appear here
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Example 7: Dashboard Widgets
 */
export function DashboardWidgetExample() {
  const [isLoading, setIsLoading] = useState(true);

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Dashboard Widgets</h3>
        <Button onClick={() => setIsLoading(!isLoading)} variant="outline" size="sm">
          Toggle Loading
        </Button>
      </div>

      {/* Compact widgets */}
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">Compact variant:</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {isLoading ? (
            <>
              <DashboardWidgetSkeleton variant="compact" />
              <DashboardWidgetSkeleton variant="compact" />
              <DashboardWidgetSkeleton variant="compact" />
              <DashboardWidgetSkeleton variant="compact" />
            </>
          ) : (
            <div className="col-span-full text-center p-4 text-muted-foreground">
              Actual widgets would appear here
            </div>
          )}
        </div>
      </div>

      {/* Default widgets */}
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">Default variant:</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {isLoading ? (
            <>
              <DashboardWidgetSkeleton variant="default" />
              <DashboardWidgetSkeleton variant="default" />
              <DashboardWidgetSkeleton variant="default" />
            </>
          ) : (
            <div className="col-span-full text-center p-4 text-muted-foreground">
              Actual widgets would appear here
            </div>
          )}
        </div>
      </div>

      {/* Detailed widgets */}
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">Detailed variant:</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {isLoading ? (
            <>
              <DashboardWidgetSkeleton variant="detailed" />
              <DashboardWidgetSkeleton variant="detailed" />
            </>
          ) : (
            <div className="col-span-full text-center p-4 text-muted-foreground">
              Actual widgets would appear here
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Example 8: Full Page Skeleton (BOM Detail)
 */
export function BomDetailExample() {
  const [isLoading, setIsLoading] = useState(true);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between p-6 border-b">
        <h3 className="text-lg font-semibold">Full Page Skeleton (BOM Detail)</h3>
        <Button onClick={() => setIsLoading(!isLoading)} variant="outline" size="sm">
          Toggle Loading
        </Button>
      </div>

      {isLoading ? (
        <BomDetailSkeleton />
      ) : (
        <div className="p-12 text-center text-muted-foreground">
          Actual BOM detail page content would appear here
        </div>
      )}
    </div>
  );
}

/**
 * Example 9: Custom Skeleton Pattern
 *
 * Shows how to create a custom skeleton matching your component layout
 */
export function CustomSkeletonExample() {
  return (
    <div className="space-y-4 p-6">
      <h3 className="text-lg font-semibold">Custom Skeleton Pattern</h3>
      <p className="text-sm text-muted-foreground">
        Example: User profile card skeleton
      </p>

      <div className="rounded-lg border p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Skeleton variant="circular" width={64} height={64} />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-6 w-48" /> {/* Name */}
            <Skeleton className="h-4 w-32" /> {/* Email */}
            <Skeleton className="h-4 w-24" /> {/* Role */}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 pt-4 border-t">
          <div className="space-y-1">
            <Skeleton className="h-4 w-16 mx-auto" /> {/* Label */}
            <Skeleton className="h-6 w-12 mx-auto" /> {/* Value */}
          </div>
          <div className="space-y-1">
            <Skeleton className="h-4 w-16 mx-auto" />
            <Skeleton className="h-6 w-12 mx-auto" />
          </div>
          <div className="space-y-1">
            <Skeleton className="h-4 w-16 mx-auto" />
            <Skeleton className="h-6 w-12 mx-auto" />
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-4 border-t">
          <Skeleton className="h-9 flex-1" /> {/* Button */}
          <Skeleton className="h-9 flex-1" /> {/* Button */}
        </div>
      </div>
    </div>
  );
}

/**
 * All Examples Page - For Storybook or documentation
 */
export function AllSkeletonExamples() {
  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <div className="space-y-2 p-6 border-b">
        <h1 className="text-3xl font-bold">Skeleton Loading States</h1>
        <p className="text-muted-foreground">
          CBP-P3-009: Comprehensive skeleton patterns for the customer portal
        </p>
      </div>

      <BasicSkeletonExample />
      <div className="border-t" />
      <AnimationExample />
      <div className="border-t" />
      <BomCardGridExample />
      <div className="border-t" />
      <BomTableExample />
      <div className="border-t" />
      <LineItemExample />
      <div className="border-t" />
      <ComponentSearchExample />
      <div className="border-t" />
      <DashboardWidgetExample />
      <div className="border-t" />
      <BomDetailExample />
      <div className="border-t" />
      <CustomSkeletonExample />
    </div>
  );
}

export default AllSkeletonExamples;
