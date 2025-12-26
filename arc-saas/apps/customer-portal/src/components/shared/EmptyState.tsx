import { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  LucideIcon,
  Package,
  Search,
  AlertCircle,
  Lock,
  Upload,
  Search as SearchIcon,
  XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Visual variant for empty state with preset icons and colors
 */
export type EmptyStateVariant = 'default' | 'search' | 'error' | 'no-permission';

/**
 * Size variant controlling icon and text sizes
 */
export type EmptyStateSize = 'sm' | 'md' | 'lg';

/**
 * Action button configuration
 */
export interface EmptyStateAction {
  /** Button label text */
  label: string;
  /** Click handler for inline actions */
  onClick?: () => void;
  /** Navigation link (alternative to onClick) */
  href?: string;
  /** Visual style variant */
  variant?: 'default' | 'outline' | 'secondary' | 'ghost';
}

/**
 * Props for EmptyState component
 */
export interface EmptyStateProps {
  /** Icon to display (overrides variant default) */
  icon?: LucideIcon;
  /** Main heading */
  title: string;
  /** Descriptive text below title */
  description?: string;
  /** Visual variant with preset icons/colors */
  variant?: EmptyStateVariant;
  /** Size variant */
  size?: EmptyStateSize;
  /** Primary action button */
  action?: EmptyStateAction;
  /** Secondary action button */
  secondaryAction?: EmptyStateAction;
  /** Additional content below description */
  children?: ReactNode;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Get default icon for each variant
 */
function getDefaultIcon(variant: EmptyStateVariant): LucideIcon {
  switch (variant) {
    case 'search':
      return Search;
    case 'error':
      return AlertCircle;
    case 'no-permission':
      return Lock;
    case 'default':
    default:
      return Package;
  }
}

/**
 * Get size-specific class names
 */
function getSizeClasses(size: EmptyStateSize) {
  switch (size) {
    case 'sm':
      return {
        container: 'py-8 px-4',
        icon: 'h-8 w-8',
        title: 'text-base',
        description: 'text-sm',
        spacing: 'space-y-2',
      };
    case 'lg':
      return {
        container: 'py-16 px-6',
        icon: 'h-16 w-16',
        title: 'text-2xl',
        description: 'text-base',
        spacing: 'space-y-6',
      };
    case 'md':
    default:
      return {
        container: 'py-12 px-4',
        icon: 'h-12 w-12',
        title: 'text-xl',
        description: 'text-sm',
        spacing: 'space-y-4',
      };
  }
}

/**
 * Get variant-specific styling
 */
function getVariantClasses(variant: EmptyStateVariant) {
  switch (variant) {
    case 'error':
      return 'text-destructive';
    case 'no-permission':
      return 'text-amber-600 dark:text-amber-500';
    default:
      return 'text-muted-foreground';
  }
}

/**
 * Render an action button
 */
function ActionButton({ action }: { action: EmptyStateAction }) {
  const buttonContent = (
    <Button
      variant={action.variant || 'default'}
      onClick={action.onClick}
      className="min-w-[120px]"
    >
      {action.label}
    </Button>
  );

  if (action.href && !action.onClick) {
    return (
      <Link to={action.href} className="inline-block">
        {buttonContent}
      </Link>
    );
  }

  return buttonContent;
}

/**
 * EmptyState Component
 *
 * A flexible empty state component for displaying when there's no data,
 * no search results, errors, or permission issues.
 *
 * @example
 * ```tsx
 * <EmptyState
 *   variant="search"
 *   title="No results found"
 *   description="Try adjusting your search terms"
 *   action={{ label: "Clear filters", onClick: handleClear }}
 * />
 * ```
 *
 * @example With custom icon
 * ```tsx
 * <EmptyState
 *   icon={Inbox}
 *   title="No messages"
 *   description="You're all caught up!"
 *   size="lg"
 * />
 * ```
 */
export function EmptyState({
  icon,
  title,
  description,
  variant = 'default',
  size = 'md',
  action,
  secondaryAction,
  children,
  className,
}: EmptyStateProps) {
  const Icon = icon || getDefaultIcon(variant);
  const sizeClasses = getSizeClasses(size);
  const variantClasses = getVariantClasses(variant);

  // Generate unique ID for aria-labelledby
  const titleId = `empty-state-title-${Math.random().toString(36).substr(2, 9)}`;

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center',
        sizeClasses.container,
        size === 'lg' && 'rounded-lg bg-muted/50',
        className
      )}
      role="status"
      aria-labelledby={titleId}
    >
      <div className={cn(sizeClasses.spacing, 'flex flex-col items-center max-w-md')}>
        {/* Icon */}
        <div className={cn('flex items-center justify-center', variantClasses)}>
          <Icon className={sizeClasses.icon} aria-hidden="true" />
        </div>

        {/* Title */}
        <h3
          id={titleId}
          className={cn('font-semibold text-foreground', sizeClasses.title)}
        >
          {title}
        </h3>

        {/* Description */}
        {description && (
          <p className={cn('text-muted-foreground', sizeClasses.description)}>
            {description}
          </p>
        )}

        {/* Custom content */}
        {children && <div className="w-full">{children}</div>}

        {/* Action buttons */}
        {(action || secondaryAction) && (
          <div className="flex flex-col sm:flex-row gap-3 mt-2">
            {action && <ActionButton action={action} />}
            {secondaryAction && <ActionButton action={secondaryAction} />}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Pre-configured empty state for no search results
 *
 * @example
 * ```tsx
 * <NoResultsState
 *   query="electronics"
 *   onClear={() => setSearch('')}
 * />
 * ```
 */
export function NoResultsState({
  query,
  onClear,
}: {
  query?: string;
  onClear?: () => void;
}) {
  return (
    <EmptyState
      variant="search"
      title="No results found"
      description={
        query
          ? `No results found for "${query}". Try adjusting your search terms.`
          : 'Try adjusting your search terms or filters.'
      }
      action={onClear ? { label: 'Clear search', onClick: onClear, variant: 'outline' } : undefined}
    />
  );
}

/**
 * Pre-configured empty state for errors
 *
 * @example
 * ```tsx
 * <ErrorState
 *   error="Failed to load data"
 *   onRetry={() => refetch()}
 * />
 * ```
 */
export function ErrorState({
  error,
  onRetry,
}: {
  error?: string;
  onRetry?: () => void;
}) {
  return (
    <EmptyState
      variant="error"
      title="Something went wrong"
      description={error || 'An error occurred while loading the data. Please try again.'}
      action={onRetry ? { label: 'Try again', onClick: onRetry } : undefined}
    />
  );
}

/**
 * Pre-configured empty state for permission denied
 *
 * @example
 * ```tsx
 * <NoPermissionState resource="billing information" />
 * ```
 */
export function NoPermissionState({ resource }: { resource?: string }) {
  return (
    <EmptyState
      variant="no-permission"
      title="Access denied"
      description={
        resource
          ? `You don't have permission to view ${resource}.`
          : "You don't have permission to view this content."
      }
    />
  );
}

/**
 * Pre-configured empty state for no BOMs
 *
 * @example
 * ```tsx
 * <NoBOMsState onUpload={() => openUploadDialog()} />
 * ```
 */
export function NoBOMsState({ onUpload }: { onUpload?: () => void }) {
  return (
    <EmptyState
      icon={Upload}
      title="No BOMs yet"
      description="Get started by uploading your first Bill of Materials"
      size="lg"
      action={
        onUpload
          ? { label: 'Upload BOM', onClick: onUpload, variant: 'default' }
          : undefined
      }
    >
      <div className="mt-4 text-xs text-muted-foreground">
        <p>Supported formats: CSV, Excel (.xlsx, .xls)</p>
      </div>
    </EmptyState>
  );
}

/**
 * Pre-configured empty state for no components
 *
 * @example
 * ```tsx
 * <NoComponentsState onSearch={() => focusSearch()} />
 * ```
 */
export function NoComponentsState({ onSearch }: { onSearch?: () => void }) {
  return (
    <EmptyState
      icon={SearchIcon}
      title="No components found"
      description="Search for components to add to your BOM"
      action={
        onSearch
          ? { label: 'Search components', onClick: onSearch, variant: 'default' }
          : undefined
      }
    />
  );
}

/**
 * Pre-configured empty state for filtered results with no matches
 *
 * @example
 * ```tsx
 * <NoFilteredResultsState onClearFilters={() => resetFilters()} />
 * ```
 */
export function NoFilteredResultsState({
  onClearFilters,
}: {
  onClearFilters?: () => void;
}) {
  return (
    <EmptyState
      icon={XCircle}
      title="No matches found"
      description="No items match the current filters. Try adjusting or clearing them."
      action={
        onClearFilters
          ? { label: 'Clear filters', onClick: onClearFilters, variant: 'outline' }
          : undefined
      }
    />
  );
}
