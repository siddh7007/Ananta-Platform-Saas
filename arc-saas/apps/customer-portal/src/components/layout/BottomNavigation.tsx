import { Link, useLocation } from 'react-router-dom';
import { Home, FileText, Search, User, MoreHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIsTabletPortrait } from '@/hooks/useMediaQuery';

/**
 * Navigation item configuration for bottom navigation
 */
interface BottomNavItem {
  /** Display label */
  label: string;
  /** Route path */
  href: string;
  /** Icon component */
  icon: React.ComponentType<{ className?: string }>;
  /** ARIA label for accessibility */
  ariaLabel: string;
}

/**
 * Primary navigation items for tablet portrait mode
 * Limited to 5 most important actions for optimal thumb reach
 */
const bottomNavItems: BottomNavItem[] = [
  {
    label: 'Home',
    href: '/',
    icon: Home,
    ariaLabel: 'Navigate to home dashboard',
  },
  {
    label: 'BOMs',
    href: '/boms',
    icon: FileText,
    ariaLabel: 'Navigate to BOMs list',
  },
  {
    label: 'Search',
    href: '/components',
    icon: Search,
    ariaLabel: 'Search components',
  },
  {
    label: 'Profile',
    href: '/settings/preferences',
    icon: User,
    ariaLabel: 'View profile and preferences',
  },
  {
    label: 'More',
    href: '/settings',
    icon: MoreHorizontal,
    ariaLabel: 'More options and settings',
  },
];

/**
 * BottomNavigation Component (CBP-P3-002)
 *
 * Provides persistent bottom navigation for tablet portrait mode (640px-1024px).
 * - Only visible on tablets in portrait orientation
 * - Fixed at bottom with safe area padding for notched devices
 * - Shows 5 primary navigation items with icons and labels
 * - Active state indication based on current route
 * - Fully accessible with ARIA labels and keyboard navigation
 *
 * @example
 * ```tsx
 * <Layout>
 *   {children}
 *   <BottomNavigation />
 * </Layout>
 * ```
 */
export function BottomNavigation() {
  const location = useLocation();
  const isTabletPortrait = useIsTabletPortrait();

  // Only render on tablet portrait mode
  if (!isTabletPortrait) {
    return null;
  }

  /**
   * Check if nav item is active based on current route
   */
  const isActive = (href: string): boolean => {
    if (href === '/') {
      // Exact match for home
      return location.pathname === '/';
    }
    // Starts with for other routes
    return location.pathname.startsWith(href);
  };

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 bg-card border-t shadow-lg"
      style={{
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
      role="navigation"
      aria-label="Bottom navigation"
    >
      <div className="flex items-center justify-around px-2 pt-2">
        {bottomNavItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);

          return (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                'flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-lg transition-all duration-200 min-w-[64px]',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
                active
                  ? 'text-primary bg-primary/10'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              )}
              aria-label={item.ariaLabel}
              aria-current={active ? 'page' : undefined}
            >
              <Icon
                className={cn(
                  'h-5 w-5 transition-transform',
                  active && 'scale-110'
                )}
              />
              <span
                className={cn(
                  'text-xs font-medium transition-all',
                  active && 'font-semibold'
                )}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
