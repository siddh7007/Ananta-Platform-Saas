/**
 * Tenant Error Screen Component
 *
 * Displays a full-screen error when the user has no tenant access
 * or when there's a critical tenant-related error.
 *
 * Features:
 * - Different messages based on error code
 * - Logout button to allow signing in with different account
 * - Retry button for transient errors
 * - Contact support information
 */

import { useAuth } from '@/contexts/AuthContext';
import { TenantError, TenantErrorCode } from '@/contexts/TenantContext';
import { AlertTriangle, LogOut, RefreshCw, Mail, Building2 } from 'lucide-react';

interface TenantErrorScreenProps {
  error: TenantError;
  onRetry?: () => void;
}

const ERROR_CONFIG: Record<TenantErrorCode, {
  icon: typeof AlertTriangle;
  title: string;
  showRetry: boolean;
  showLogout: boolean;
}> = {
  NO_TENANT_ACCESS: {
    icon: Building2,
    title: 'No Workspace Access',
    showRetry: false,
    showLogout: true,
  },
  TENANT_FETCH_FAILED: {
    icon: AlertTriangle,
    title: 'Unable to Load Workspace',
    showRetry: true,
    showLogout: true,
  },
  NO_TOKEN: {
    icon: AlertTriangle,
    title: 'Session Expired',
    showRetry: false,
    showLogout: true,
  },
  NETWORK_ERROR: {
    icon: RefreshCw,
    title: 'Connection Problem',
    showRetry: true,
    showLogout: false,
  },
  INVALID_AUDIENCE: {
    icon: AlertTriangle,
    title: 'Authentication Error',
    showRetry: false,
    showLogout: true,
  },
};

export function TenantErrorScreen({ error, onRetry }: TenantErrorScreenProps) {
  const { logout, user } = useAuth();
  const config = ERROR_CONFIG[error.code];
  const Icon = config.icon;

  const handleLogout = async () => {
    try {
      await logout();
    } catch (err) {
      console.error('Logout failed:', err);
      // Force clear and redirect
      window.location.href = '/login';
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6 rounded-lg border bg-card p-8 shadow-lg">
        {/* Icon */}
        <div className="flex justify-center">
          <div className="rounded-full bg-destructive/10 p-4">
            <Icon className="h-12 w-12 text-destructive" />
          </div>
        </div>

        {/* Title and Message */}
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-bold text-foreground">{config.title}</h1>
          <p className="text-muted-foreground">{error.message}</p>
        </div>

        {/* Details */}
        {error.details && (
          <div className="rounded-md bg-muted/50 p-4 text-sm text-muted-foreground">
            {error.details}
          </div>
        )}

        {/* User Info (for debugging/support) */}
        {user && (
          <div className="text-center text-xs text-muted-foreground">
            Signed in as: <span className="font-medium">{user.email || user.name || user.id}</span>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col gap-3">
          {config.showRetry && onRetry && (
            <button
              onClick={onRetry}
              className="flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-3 font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <RefreshCw className="h-4 w-4" />
              Try Again
            </button>
          )}

          {config.showLogout && (
            <button
              onClick={handleLogout}
              className="flex w-full items-center justify-center gap-2 rounded-md border border-input bg-background px-4 py-3 font-medium text-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </button>
          )}
        </div>

        {/* Help Section */}
        <div className="border-t pt-4">
          <p className="text-center text-sm text-muted-foreground">
            Need help?{' '}
            <a
              href="mailto:support@ananta.io"
              className="inline-flex items-center gap-1 text-primary hover:underline"
            >
              <Mail className="h-3 w-3" />
              Contact Support
            </a>
          </p>
        </div>

        {/* Error Code (for support reference) */}
        <div className="text-center text-xs text-muted-foreground/50">
          Error code: {error.code}
        </div>
      </div>
    </div>
  );
}

export default TenantErrorScreen;
