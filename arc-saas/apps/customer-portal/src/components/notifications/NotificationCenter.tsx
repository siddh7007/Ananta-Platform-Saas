import { Inbox } from '@novu/react';
import { useAuth } from '@/contexts/AuthContext';
import { Bell } from 'lucide-react';
import { useState, useEffect, Component, ReactNode } from 'react';

interface NotificationCenterProps {
  appIdentifier: string;
  apiUrl?: string;
  socketUrl?: string;
}

/**
 * Error boundary to catch Novu component errors
 */
class NovuErrorBoundary extends Component<
  { children: ReactNode; onError: () => void },
  { hasError: boolean }
> {
  constructor(props: { children: ReactNode; onError: () => void }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.warn('[NotificationCenter] Novu component error:', error.message);
    this.props.onError();
  }

  render() {
    if (this.state.hasError) {
      return null; // Let parent handle fallback
    }
    return this.props.children;
  }
}

/**
 * Fallback bell button when Novu is unavailable
 * Provides accessible alternative when notification service is down
 */
function FallbackBell() {
  return (
    <button
      className="relative inline-flex items-center justify-center rounded-md p-2 transition-colors hover:bg-muted focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
      aria-label="Notifications (unavailable)"
      title="Notifications are temporarily unavailable"
    >
      <Bell className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
    </button>
  );
}

/**
 * Novu notification center wrapper component using the new @novu/react SDK
 * Displays a bell icon that opens a popover with notifications
 *
 * Note: The Novu Inbox component requires HMAC authentication for security.
 * If HMAC is not configured, notifications will gracefully degrade to a static bell.
 *
 * Accessibility: The wrapper adds aria-label to the Novu bell button via CSS
 * since the third-party component may not include it.
 */
export function NotificationCenter({ appIdentifier, apiUrl }: NotificationCenterProps) {
  const { user } = useAuth();
  const [hasError, setHasError] = useState(false);

  // Reset error state when user changes
  useEffect(() => {
    setHasError(false);
  }, [user?.id]);

  // Add aria-label to Novu's bell button for accessibility
  useEffect(() => {
    // Wait for Novu to render its button
    const timeout = setTimeout(() => {
      // Find Novu's bell button and add aria-label if missing
      const novuButtons = document.querySelectorAll('[data-novu-notification-bell], .nv-bell-button, [class*="novu"] button:not([aria-label])');
      novuButtons.forEach((button) => {
        if (!button.getAttribute('aria-label')) {
          button.setAttribute('aria-label', 'Open notifications');
        }
      });
    }, 500);

    return () => clearTimeout(timeout);
  }, [hasError]);

  // Don't render if user is not authenticated
  if (!user?.id) {
    return null;
  }

  // Use user ID as subscriber ID
  const subscriberId = user.id;

  // If Novu fails (e.g., HMAC not configured), show a static bell
  if (hasError) {
    return <FallbackBell />;
  }

  return (
    <NovuErrorBoundary onError={() => setHasError(true)}>
      <div
        // Additional wrapper for accessibility - adds aria-label via DOM if Novu doesn't
        data-notification-center
      >
        <Inbox
          applicationIdentifier={appIdentifier}
          subscriberId={subscriberId}
          backendUrl={apiUrl}
          appearance={{
            variables: {
              colorPrimary: 'hsl(var(--primary))',
              colorBackground: 'hsl(var(--background))',
              colorForeground: 'hsl(var(--foreground))',
              colorSecondary: 'hsl(var(--muted))',
              borderRadius: '8px',
            },
          }}
        />
      </div>
    </NovuErrorBoundary>
  );
}

/**
 * Environment-configured NotificationCenter
 * Reads configuration from VITE_ environment variables
 */
export function ConfiguredNotificationCenter() {
  const appIdentifier = import.meta.env.VITE_NOVU_APP_IDENTIFIER || '6931905380e6f7e26e0ddaad';
  const apiUrl = import.meta.env.VITE_NOVU_API_URL || 'http://localhost:13100';

  return (
    <NotificationCenter
      appIdentifier={appIdentifier}
      apiUrl={apiUrl}
    />
  );
}
