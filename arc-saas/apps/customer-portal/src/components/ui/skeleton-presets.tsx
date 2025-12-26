/**
 * Skeleton Presets - General-Purpose Loading Placeholders
 *
 * Pre-built skeleton layouts for common UI patterns across the application.
 * These components provide consistent loading states with proper animations
 * and accessibility features.
 *
 * Features:
 * - Theme-aware shimmer/wave animation
 * - Respects prefers-reduced-motion
 * - Accessible with ARIA labels
 * - Multiple size variants
 *
 * @module components/ui/skeleton-presets
 */

import React from 'react';
import { Skeleton, SkeletonProps } from './skeleton';
import { Card, CardContent, CardFooter, CardHeader } from './card';
import { cn } from '@/lib/utils';

/**
 * TextSkeleton - Multiple lines of text placeholder
 *
 * Use for loading paragraphs, descriptions, or multi-line content.
 *
 * @example
 * ```tsx
 * // Loading article content
 * {isLoading ? (
 *   <TextSkeleton lines={5} className="space-y-3" />
 * ) : (
 *   <p>{article.content}</p>
 * )}
 *
 * // With custom animation
 * <TextSkeleton lines={3} animation="wave" />
 * ```
 */
export function TextSkeleton({
  lines = 3,
  className,
  animation = 'pulse',
  lastLineWidth = '75%',
}: {
  /** Number of text lines to display */
  lines?: number;
  /** Additional CSS classes */
  className?: string;
  /** Animation type */
  animation?: SkeletonProps['animation'];
  /** Width of the last line (CSS value or percentage) */
  lastLineWidth?: string;
}) {
  return (
    <div className={cn('space-y-2', className)} role="status" aria-label="Loading text content">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className="h-4"
          animation={animation}
          style={{
            width: i === lines - 1 ? lastLineWidth : '100%',
          }}
        />
      ))}
    </div>
  );
}

/**
 * AvatarSkeleton - Circular avatar placeholder
 *
 * Use for loading user profile pictures, icons, or circular images.
 *
 * @example
 * ```tsx
 * // User profile header
 * <div className="flex items-center gap-3">
 *   {isLoading ? (
 *     <AvatarSkeleton size="lg" />
 *   ) : (
 *     <Avatar src={user.avatar} />
 *   )}
 *   <div>...</div>
 * </div>
 * ```
 */
export function AvatarSkeleton({
  size = 'md',
  className,
  animation = 'pulse',
}: {
  /** Predefined size or custom dimensions */
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** Additional CSS classes */
  className?: string;
  /** Animation type */
  animation?: SkeletonProps['animation'];
}) {
  const sizeMap = {
    sm: 32,
    md: 40,
    lg: 48,
    xl: 64,
  };

  const dimension = sizeMap[size];

  return (
    <Skeleton
      variant="circular"
      width={dimension}
      height={dimension}
      animation={animation}
      className={className}
      aria-label="Loading avatar"
    />
  );
}

/**
 * CardSkeleton - Standard card layout placeholder
 *
 * Use for loading card-based content with header, body, and optional footer.
 *
 * @example
 * ```tsx
 * // Loading product cards
 * <div className="grid grid-cols-3 gap-4">
 *   {isLoading ? (
 *     Array.from({ length: 6 }).map((_, i) => (
 *       <CardSkeleton key={i} />
 *     ))
 *   ) : (
 *     products.map(p => <ProductCard key={p.id} product={p} />)
 *   )}
 * </div>
 * ```
 */
export function CardSkeleton({
  className,
  hasFooter = false,
  animation = 'pulse',
}: {
  /** Additional CSS classes */
  className?: string;
  /** Include footer section */
  hasFooter?: boolean;
  /** Animation type */
  animation?: SkeletonProps['animation'];
}) {
  return (
    <Card className={className} role="status" aria-label="Loading card">
      <CardHeader className="space-y-2">
        <Skeleton className="h-5 w-3/4" animation={animation} />
        <Skeleton className="h-4 w-1/2" animation={animation} />
      </CardHeader>
      <CardContent className="space-y-3">
        <Skeleton className="h-4 w-full" animation={animation} />
        <Skeleton className="h-4 w-full" animation={animation} />
        <Skeleton className="h-4 w-4/5" animation={animation} />
      </CardContent>
      {hasFooter && (
        <CardFooter className="justify-between">
          <Skeleton className="h-4 w-24" animation={animation} />
          <Skeleton className="h-9 w-20" animation={animation} />
        </CardFooter>
      )}
    </Card>
  );
}

/**
 * TableRowSkeleton - Generic table row placeholder
 *
 * Use for loading table data with configurable number of columns.
 *
 * @example
 * ```tsx
 * // Loading data table
 * <Table>
 *   <TableBody>
 *     {isLoading ? (
 *       Array.from({ length: 10 }).map((_, i) => (
 *         <TableRowSkeleton key={i} columns={5} />
 *       ))
 *     ) : (
 *       data.map(row => <TableRow key={row.id} {...row} />)
 *     )}
 *   </TableBody>
 * </Table>
 * ```
 */
export function TableRowSkeleton({
  columns = 4,
  className,
  animation = 'pulse',
}: {
  /** Number of columns to display */
  columns?: number;
  /** Additional CSS classes */
  className?: string;
  /** Animation type */
  animation?: SkeletonProps['animation'];
}) {
  return (
    <div
      className={cn('flex items-center gap-4 border-b px-4 py-3', className)}
      role="status"
      aria-label="Loading table row"
    >
      {Array.from({ length: columns }).map((_, i) => (
        <div key={i} className="flex-1">
          <Skeleton
            className="h-4"
            animation={animation}
            style={{
              width: i === 0 ? '80%' : i === columns - 1 ? '60%' : '90%',
            }}
          />
        </div>
      ))}
    </div>
  );
}

/**
 * ListItemSkeleton - List item with optional avatar and action
 *
 * Use for loading lists with avatar/icon and action button.
 *
 * @example
 * ```tsx
 * // Loading user list
 * <div className="space-y-2">
 *   {isLoading ? (
 *     Array.from({ length: 5 }).map((_, i) => (
 *       <ListItemSkeleton key={i} hasAvatar hasAction />
 *     ))
 *   ) : (
 *     users.map(user => <UserListItem key={user.id} user={user} />)
 *   )}
 * </div>
 * ```
 */
export function ListItemSkeleton({
  hasAvatar = true,
  hasAction = true,
  className,
  animation = 'pulse',
}: {
  /** Show avatar/icon placeholder */
  hasAvatar?: boolean;
  /** Show action button placeholder */
  hasAction?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Animation type */
  animation?: SkeletonProps['animation'];
}) {
  return (
    <div
      className={cn('flex items-center gap-3 rounded-lg border p-3', className)}
      role="status"
      aria-label="Loading list item"
    >
      {hasAvatar && (
        <Skeleton variant="circular" width={40} height={40} animation={animation} />
      )}
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-48" animation={animation} />
        <Skeleton className="h-3 w-32" animation={animation} />
      </div>
      {hasAction && (
        <Skeleton className="h-9 w-20 rounded-md" animation={animation} />
      )}
    </div>
  );
}

/**
 * StatSkeleton - Statistic/metric card placeholder
 *
 * Use for loading dashboard statistics, KPIs, or metric cards.
 *
 * @example
 * ```tsx
 * // Loading dashboard stats
 * <div className="grid grid-cols-4 gap-4">
 *   {isLoading ? (
 *     <>
 *       <StatSkeleton />
 *       <StatSkeleton />
 *       <StatSkeleton />
 *       <StatSkeleton />
 *     </>
 *   ) : (
 *     stats.map(stat => <StatCard key={stat.id} {...stat} />)
 *   )}
 * </div>
 * ```
 */
export function StatSkeleton({
  className,
  showTrend = false,
  animation = 'pulse',
}: {
  /** Additional CSS classes */
  className?: string;
  /** Show trend indicator */
  showTrend?: boolean;
  /** Animation type */
  animation?: SkeletonProps['animation'];
}) {
  return (
    <Card className={className} role="status" aria-label="Loading statistic">
      <CardContent className="pt-6">
        <div className="space-y-2">
          <Skeleton className="h-3 w-20" animation={animation} />
          <div className="flex items-center justify-between">
            <Skeleton className="h-8 w-24" animation={animation} />
            {showTrend && (
              <Skeleton className="h-5 w-12 rounded-full" animation={animation} />
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * FormFieldSkeleton - Form input field placeholder
 *
 * Use for loading form fields with optional label.
 *
 * @example
 * ```tsx
 * // Loading form
 * <form>
 *   {isLoading ? (
 *     <>
 *       <FormFieldSkeleton hasLabel />
 *       <FormFieldSkeleton hasLabel />
 *       <FormFieldSkeleton hasLabel={false} />
 *     </>
 *   ) : (
 *     <FormFields data={formData} />
 *   )}
 * </form>
 * ```
 */
export function FormFieldSkeleton({
  hasLabel = true,
  className,
  animation = 'pulse',
  fieldType = 'input',
}: {
  /** Show label placeholder */
  hasLabel?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Animation type */
  animation?: SkeletonProps['animation'];
  /** Type of form field */
  fieldType?: 'input' | 'textarea' | 'select';
}) {
  const heightMap = {
    input: 'h-10',
    textarea: 'h-24',
    select: 'h-10',
  };

  return (
    <div className={cn('space-y-2', className)} role="status" aria-label="Loading form field">
      {hasLabel && <Skeleton className="h-4 w-24" animation={animation} />}
      <Skeleton className={cn('w-full rounded-md', heightMap[fieldType])} animation={animation} />
    </div>
  );
}

/**
 * ButtonSkeleton - Button placeholder
 *
 * Use for loading action buttons or CTAs.
 *
 * @example
 * ```tsx
 * <div className="flex gap-2">
 *   {isLoading ? (
 *     <>
 *       <ButtonSkeleton size="default" />
 *       <ButtonSkeleton size="sm" />
 *     </>
 *   ) : (
 *     <>
 *       <Button>Submit</Button>
 *       <Button size="sm">Cancel</Button>
 *     </>
 *   )}
 * </div>
 * ```
 */
export function ButtonSkeleton({
  size = 'default',
  className,
  animation = 'pulse',
}: {
  /** Button size variant */
  size?: 'sm' | 'default' | 'lg';
  /** Additional CSS classes */
  className?: string;
  /** Animation type */
  animation?: SkeletonProps['animation'];
}) {
  const sizeMap = {
    sm: 'h-8 w-20',
    default: 'h-10 w-24',
    lg: 'h-12 w-32',
  };

  return (
    <Skeleton
      className={cn('rounded-md', sizeMap[size], className)}
      animation={animation}
      aria-label="Loading button"
    />
  );
}

/**
 * ImageSkeleton - Image placeholder
 *
 * Use for loading images, thumbnails, or media content.
 *
 * @example
 * ```tsx
 * // Product image
 * {isLoading ? (
 *   <ImageSkeleton aspectRatio="1/1" className="w-full" />
 * ) : (
 *   <img src={product.image} alt={product.name} />
 * )}
 *
 * // Banner image
 * <ImageSkeleton aspectRatio="16/9" className="w-full" />
 * ```
 */
export function ImageSkeleton({
  aspectRatio = '16/9',
  className,
  animation = 'pulse',
}: {
  /** Aspect ratio (CSS aspect-ratio value) */
  aspectRatio?: '1/1' | '16/9' | '4/3' | '21/9' | string;
  /** Additional CSS classes */
  className?: string;
  /** Animation type */
  animation?: SkeletonProps['animation'];
}) {
  return (
    <Skeleton
      className={cn('w-full rounded-md', className)}
      animation={animation}
      style={{ aspectRatio }}
      aria-label="Loading image"
    />
  );
}

/**
 * BadgeSkeleton - Badge/tag placeholder
 *
 * Use for loading status badges, tags, or labels.
 *
 * @example
 * ```tsx
 * <div className="flex gap-2">
 *   {isLoading ? (
 *     <>
 *       <BadgeSkeleton />
 *       <BadgeSkeleton />
 *     </>
 *   ) : (
 *     tags.map(tag => <Badge key={tag}>{tag}</Badge>)
 *   )}
 * </div>
 * ```
 */
export function BadgeSkeleton({
  className,
  animation = 'pulse',
}: {
  /** Additional CSS classes */
  className?: string;
  /** Animation type */
  animation?: SkeletonProps['animation'];
}) {
  return (
    <Skeleton
      className={cn('h-6 w-16 rounded-full', className)}
      animation={animation}
      aria-label="Loading badge"
    />
  );
}

/**
 * ChartSkeleton - Chart/graph placeholder
 *
 * Use for loading charts, graphs, or data visualizations.
 *
 * @example
 * ```tsx
 * {isLoading ? (
 *   <ChartSkeleton variant="bar" />
 * ) : (
 *   <BarChart data={chartData} />
 * )}
 * ```
 */
export function ChartSkeleton({
  variant = 'bar',
  className,
  animation = 'pulse',
}: {
  /** Chart visualization type */
  variant?: 'bar' | 'line' | 'pie' | 'area';
  /** Additional CSS classes */
  className?: string;
  /** Animation type */
  animation?: SkeletonProps['animation'];
}) {
  if (variant === 'pie') {
    return (
      <div
        className={cn('flex items-center justify-center p-8', className)}
        role="status"
        aria-label="Loading chart"
      >
        <Skeleton variant="circular" width={200} height={200} animation={animation} />
      </div>
    );
  }

  return (
    <div
      className={cn('space-y-4 p-4', className)}
      role="status"
      aria-label="Loading chart"
    >
      {/* Chart bars/lines */}
      <div className="flex items-end justify-around h-48 gap-2">
        {Array.from({ length: variant === 'bar' ? 8 : 12 }).map((_, i) => (
          <Skeleton
            key={i}
            className="flex-1 rounded-t-sm"
            animation={animation}
            style={{
              height: `${Math.random() * 60 + 40}%`,
            }}
          />
        ))}
      </div>
      {/* X-axis labels */}
      <div className="flex justify-around">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-3 w-8" animation={animation} />
        ))}
      </div>
    </div>
  );
}

/**
 * SkeletonGroup - Container for rendering multiple skeletons with staggered animation
 *
 * Applies staggered wave animation and optional intersection observer
 * for pausing animations when out of viewport.
 *
 * @example
 * ```tsx
 * <SkeletonGroup stagger={100} pauseOutOfView>
 *   <CardSkeleton />
 *   <CardSkeleton />
 *   <CardSkeleton />
 * </SkeletonGroup>
 * ```
 */
export function SkeletonGroup({
  children,
  stagger = 0,
  pauseOutOfView = false,
  className,
}: {
  /** Child skeleton components to render */
  children: React.ReactNode;
  /** Delay in milliseconds between each child's animation start */
  stagger?: number;
  /** Pause animations when component is out of viewport (performance optimization) */
  pauseOutOfView?: boolean;
  /** Additional CSS classes */
  className?: string;
}) {
  const childArray = Array.from(React.Children.toArray(children));

  if (pauseOutOfView) {
    // Would require intersection observer implementation for production
    // For now, just render children with stagger
    console.warn('pauseOutOfView feature requires IntersectionObserver implementation');
  }

  return (
    <div className={className} role="group" aria-label="Loading content group">
      {childArray.map((child, index) => (
        <div
          key={index}
          style={
            stagger > 0
              ? {
                  animationDelay: `${index * stagger}ms`,
                }
              : undefined
          }
        >
          {child}
        </div>
      ))}
    </div>
  );
}

/**
 * NavbarSkeleton - Navigation bar placeholder
 *
 * Use for loading top navigation or header.
 *
 * @example
 * ```tsx
 * {isLoading ? <NavbarSkeleton /> : <Navbar items={navItems} />}
 * ```
 */
export function NavbarSkeleton({
  className,
  animation = 'pulse',
}: {
  /** Additional CSS classes */
  className?: string;
  /** Animation type */
  animation?: SkeletonProps['animation'];
}) {
  return (
    <div
      className={cn('flex items-center justify-between border-b p-4', className)}
      role="status"
      aria-label="Loading navigation"
    >
      {/* Logo */}
      <Skeleton className="h-8 w-32" animation={animation} />

      {/* Nav items */}
      <div className="flex items-center gap-6">
        <Skeleton className="h-4 w-16" animation={animation} />
        <Skeleton className="h-4 w-20" animation={animation} />
        <Skeleton className="h-4 w-16" animation={animation} />
      </div>

      {/* User menu */}
      <Skeleton variant="circular" width={36} height={36} animation={animation} />
    </div>
  );
}

/**
 * ProfileHeaderSkeleton - User profile header placeholder
 *
 * Use for loading user profile pages with avatar, name, and bio.
 *
 * @example
 * ```tsx
 * {isLoading ? <ProfileHeaderSkeleton /> : <ProfileHeader user={user} />}
 * ```
 */
export function ProfileHeaderSkeleton({
  className,
  animation = 'pulse',
}: {
  /** Additional CSS classes */
  className?: string;
  /** Animation type */
  animation?: SkeletonProps['animation'];
}) {
  return (
    <div
      className={cn('flex items-start gap-4 p-6', className)}
      role="status"
      aria-label="Loading profile"
    >
      {/* Avatar */}
      <Skeleton variant="circular" width={80} height={80} animation={animation} />

      {/* Profile info */}
      <div className="flex-1 space-y-3">
        <Skeleton className="h-7 w-48" animation={animation} />
        <Skeleton className="h-4 w-32" animation={animation} />
        <div className="space-y-2">
          <Skeleton className="h-3 w-full" animation={animation} />
          <Skeleton className="h-3 w-4/5" animation={animation} />
        </div>
        <div className="flex gap-2">
          <ButtonSkeleton size="default" animation={animation} />
          <ButtonSkeleton size="default" animation={animation} />
        </div>
      </div>
    </div>
  );
}
