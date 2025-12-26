import { useMemo } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { getBreadcrumbs as getStaticBreadcrumbs } from '@/config/navigation';
import { createLogger } from '@/lib/utils';

const log = createLogger('useBreadcrumbs');

/**
 * Breadcrumb item interface
 */
export interface BreadcrumbItem {
  /** Display label */
  label: string;
  /** Link href (undefined for current page) */
  href?: string;
  /** Whether this is the current page */
  isCurrentPage?: boolean;
  /** Whether this is a collapsed indicator (...) */
  isCollapsed?: boolean;
}

/**
 * Hook to generate breadcrumbs from current route
 *
 * Features:
 * - Auto-generates from route path using navigation manifest
 * - Handles dynamic segments (e.g., /boms/:id -> /boms/BOM Name)
 * - Marks current page (no href)
 * - Responsive: returns collapsed view on mobile
 *
 * @param options - Configuration options
 * @returns Array of breadcrumb items
 */
export function useBreadcrumbs(options?: {
  /** Custom label for the current page */
  currentPageLabel?: string;
  /** Additional breadcrumbs to append */
  additionalCrumbs?: BreadcrumbItem[];
}) {
  const location = useLocation();
  const params = useParams();

  const breadcrumbs = useMemo(() => {
    const pathname = location.pathname;
    log.debug('Generating breadcrumbs', { pathname, params });

    // If we're on the home page, return just home
    if (pathname === '/') {
      return [{ label: 'Dashboard', href: undefined, isCurrentPage: true }];
    }

    // Get static breadcrumbs from navigation manifest
    const staticItems = getStaticBreadcrumbs(pathname);

    // Convert to BreadcrumbItem format
    let items: BreadcrumbItem[] = staticItems.map(item => ({
      label: item.label,
      href: item.href,
      isCurrentPage: false,
    }));

    // Handle dynamic segments
    // Check if the last breadcrumb is a static route or needs dynamic resolution
    const lastItem = items[items.length - 1];
    const isDynamicRoute = pathname.includes('/') && pathname.split('/').some(seg =>
      Object.keys(params).some(paramKey => params[paramKey] === seg.replace(':', ''))
    );

    // If custom label is provided for current page, update last item
    if (options?.currentPageLabel && lastItem) {
      items[items.length - 1] = {
        ...lastItem,
        label: options.currentPageLabel,
      };
    }

    // Add any additional breadcrumbs
    if (options?.additionalCrumbs) {
      items = [...items, ...options.additionalCrumbs];
    }

    // Mark all items except the last as clickable
    const result: BreadcrumbItem[] = items.map((item, index) => ({
      ...item,
      href: index < items.length - 1 ? item.href : undefined,
      isCurrentPage: index === items.length - 1,
    }));

    log.debug('Breadcrumbs generated', { count: result.length, result });
    return result;
  }, [location.pathname, params, options?.currentPageLabel, options?.additionalCrumbs]);

  return breadcrumbs;
}

/**
 * Hook variant that returns collapsed breadcrumbs for mobile
 * Shows: Home > ... > Current Page
 */
export function useCollapsedBreadcrumbs(options?: {
  currentPageLabel?: string;
}) {
  const fullBreadcrumbs = useBreadcrumbs(options);

  return useMemo(() => {
    if (fullBreadcrumbs.length <= 3) {
      return fullBreadcrumbs;
    }

    // Show first, collapse middle, show last
    return [
      fullBreadcrumbs[0], // Home
      { label: '...', href: undefined, isCollapsed: true }, // Collapsed indicator
      fullBreadcrumbs[fullBreadcrumbs.length - 1], // Current page
    ];
  }, [fullBreadcrumbs]);
}
