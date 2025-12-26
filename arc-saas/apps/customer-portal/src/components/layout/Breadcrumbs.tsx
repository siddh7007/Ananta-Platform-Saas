import React from 'react';
import { Link } from 'react-router-dom';
import { Home, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useBreadcrumbs, useCollapsedBreadcrumbs, BreadcrumbItem } from '@/hooks/useBreadcrumbs';

interface BreadcrumbsProps {
  /** Custom label for the current page */
  currentPageLabel?: string;
  /** Additional breadcrumbs to append */
  additionalCrumbs?: Array<{ label: string; href?: string }>;
  /** CSS class name */
  className?: string;
}

/**
 * Breadcrumb Navigation Component
 *
 * Features:
 * - Auto-generates from current route using navigation manifest
 * - Clickable path segments (except current page)
 * - Home icon for root
 * - Chevron separators
 * - Responsive: collapses middle items on mobile
 * - Accessible with proper ARIA attributes
 *
 * Usage:
 * ```tsx
 * // Auto-generated from route
 * <Breadcrumbs />
 *
 * // Custom current page label
 * <Breadcrumbs currentPageLabel="Electronic Component ABC123" />
 *
 * // Additional breadcrumbs
 * <Breadcrumbs additionalCrumbs={[{ label: 'Edit', href: '/edit' }]} />
 * ```
 */
export function Breadcrumbs({
  currentPageLabel,
  additionalCrumbs,
  className
}: BreadcrumbsProps) {
  // Use full breadcrumbs on desktop, collapsed on mobile
  const fullBreadcrumbs = useBreadcrumbs({ currentPageLabel, additionalCrumbs });
  const collapsedBreadcrumbs = useCollapsedBreadcrumbs({ currentPageLabel });

  return (
    <>
      {/* Desktop breadcrumbs (full) */}
      <nav
        aria-label="Breadcrumb"
        className={cn('hidden md:flex items-center gap-2 text-sm', className)}
      >
        <BreadcrumbList items={fullBreadcrumbs} />
      </nav>

      {/* Mobile breadcrumbs (collapsed) */}
      <nav
        aria-label="Breadcrumb"
        className={cn('flex md:hidden items-center gap-2 text-sm', className)}
      >
        <BreadcrumbList items={collapsedBreadcrumbs} />
      </nav>
    </>
  );
}

/**
 * Internal component to render breadcrumb list
 */
function BreadcrumbList({ items }: { items: BreadcrumbItem[] }) {
  return (
    <ol className="flex items-center gap-2">
      {items.map((item, index) => {
        const isFirst = index === 0;
        const isLast = index === items.length - 1;
        const isCollapsed = item.isCollapsed || false;

        return (
          <React.Fragment key={`${item.label}-${index}`}>
            {/* Separator (except before first item) */}
            {!isFirst && (
              <li aria-hidden="true">
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </li>
            )}

            {/* Breadcrumb item */}
            <li>
              {isCollapsed ? (
                // Collapsed indicator (non-clickable)
                <span
                  className="text-muted-foreground"
                  aria-label="More breadcrumbs"
                >
                  {item.label}
                </span>
              ) : item.href && !isLast ? (
                // Clickable breadcrumb
                <Link
                  to={item.href}
                  className="inline-flex items-center gap-1.5 text-muted-foreground transition-colors hover:text-foreground"
                  aria-current={isLast ? 'page' : undefined}
                  aria-label={isFirst ? 'Home' : undefined}
                >
                  {isFirst && <Home className="h-4 w-4" aria-hidden="true" />}
                  {!isFirst && <span>{item.label}</span>}
                </Link>
              ) : (
                // Current page (non-clickable)
                <span
                  className={cn(
                    'inline-flex items-center gap-1.5 font-medium',
                    isLast ? 'text-foreground' : 'text-muted-foreground'
                  )}
                  aria-current={isLast ? 'page' : undefined}
                  aria-label={isFirst ? 'Home' : undefined}
                >
                  {isFirst && <Home className="h-4 w-4" aria-hidden="true" />}
                  {!(isFirst && item.label === 'Home') && <span>{item.label}</span>}
                </span>
              )}
            </li>
          </React.Fragment>
        );
      })}
    </ol>
  );
}
