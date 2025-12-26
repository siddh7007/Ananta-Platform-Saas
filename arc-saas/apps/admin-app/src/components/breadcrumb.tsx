import { Link, useLocation } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';
import { useMemo } from 'react';

interface BreadcrumbItem {
  label: string;
  path: string;
  isLast: boolean;
}

// Route label mapping
const routeLabels: Record<string, string> = {
  tenants: 'Tenants',
  plans: 'Plans',
  subscriptions: 'Subscriptions',
  workflows: 'Workflows',
  create: 'Create',
  edit: 'Edit',
  settings: 'Settings',
  users: 'Users',
};

/**
 * Get a human-readable label for a path segment
 */
function getLabel(segment: string): string {
  // Check if it's a known route
  if (routeLabels[segment]) {
    return routeLabels[segment];
  }

  // Check if it's a UUID (resource ID)
  if (/^[0-9a-f-]{36}$/i.test(segment)) {
    return 'Details';
  }

  // Convert to title case
  return segment
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Breadcrumb navigation component.
 * Automatically generates breadcrumbs from the current URL path.
 */
export function Breadcrumb() {
  const location = useLocation();

  const breadcrumbs = useMemo(() => {
    const pathSegments = location.pathname.split('/').filter(Boolean);

    const items: BreadcrumbItem[] = [];

    pathSegments.forEach((segment, index) => {
      const path = '/' + pathSegments.slice(0, index + 1).join('/');
      const isLast = index === pathSegments.length - 1;

      items.push({
        label: getLabel(segment),
        path,
        isLast,
      });
    });

    return items;
  }, [location.pathname]);

  // Don't show breadcrumb on dashboard
  if (breadcrumbs.length === 0) {
    return null;
  }

  return (
    <nav className="flex items-center text-sm text-gray-500 dark:text-gray-400 mb-4">
      {/* Home link */}
      <Link
        to="/"
        className="flex items-center hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
      >
        <Home className="w-4 h-4" />
      </Link>

      {breadcrumbs.map((item, index) => (
        <span key={item.path} className="flex items-center">
          <ChevronRight className="w-4 h-4 mx-2 text-gray-400" />
          {item.isLast ? (
            <span className="font-medium text-gray-900 dark:text-gray-100">
              {item.label}
            </span>
          ) : (
            <Link
              to={item.path}
              className="hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
            >
              {item.label}
            </Link>
          )}
        </span>
      ))}
    </nav>
  );
}

export default Breadcrumb;
