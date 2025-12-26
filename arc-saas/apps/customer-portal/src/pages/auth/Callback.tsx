import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { userManager } from '@/contexts/AuthContext';

/**
 * OAuth callback page - handles the OIDC callback after Keycloak authentication
 */
export function CallbackPage() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const processingRef = useRef(false);

  useEffect(() => {
    const handleCallback = async () => {
      // Prevent double processing (can happen with React StrictMode or HMR)
      if (processingRef.current) {
        console.debug('[Callback] Already processing, skipping duplicate call');
        return;
      }
      processingRef.current = true;

      try {
        // Check if we already have a valid user session
        const existingUser = await userManager.getUser();
        if (existingUser && !existingUser.expired) {
          console.debug('[Callback] Already authenticated, redirecting to home');
          navigate('/', { replace: true });
          return;
        }

        // Check if URL has code parameter (required for callback)
        const urlParams = new URLSearchParams(window.location.search);
        if (!urlParams.has('code')) {
          console.warn('[Callback] No authorization code in URL, redirecting to login');
          navigate('/login', { replace: true });
          return;
        }

        // Process the OIDC callback - this extracts tokens from URL
        await userManager.signinRedirectCallback();

        // Broadcast login event to other tabs for cross-tab session sync
        if (typeof BroadcastChannel !== 'undefined') {
          const authChannel = new BroadcastChannel('cbp-auth-sync');
          authChannel.postMessage({ type: 'LOGIN' });
          authChannel.close();
        }

        // Navigate to the originally requested page or home
        const returnUrl = sessionStorage.getItem('returnUrl') || '/';
        sessionStorage.removeItem('returnUrl');
        navigate(returnUrl, { replace: true });
      } catch (err) {
        console.error('Authentication callback error:', err);
        const errorMessage = err instanceof Error ? err.message : 'Authentication failed';

        // Handle "Code not valid" or similar stale state errors
        if (errorMessage.includes('Code not valid') ||
            errorMessage.includes('state') ||
            errorMessage.includes('nonce')) {
          console.warn('[Callback] Stale auth state detected, clearing and redirecting to login');
          // Clear OIDC state and redirect to login
          try {
            await userManager.removeUser();
          } catch {
            // Ignore cleanup errors
          }
          // Clear oidc state from localStorage
          Object.keys(localStorage).forEach(key => {
            if (key.startsWith('oidc.')) {
              localStorage.removeItem(key);
            }
          });
          navigate('/login', { replace: true });
          return;
        }

        setError(errorMessage);
      }
    };

    handleCallback();
  }, [navigate]);

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background">
        <div className="w-full max-w-md rounded-lg border border-destructive/20 bg-card p-6 text-center">
          <h2 className="text-lg font-semibold text-destructive">Authentication Failed</h2>
          <p className="mt-2 text-sm text-muted-foreground">{error}</p>
          <button
            onClick={() => {
              // Clear stale OIDC state before retrying
              Object.keys(localStorage).forEach(key => {
                if (key.startsWith('oidc.')) {
                  localStorage.removeItem(key);
                }
              });
              navigate('/login', { replace: true });
            }}
            className="mt-4 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background">
      <div className="text-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="mt-4 text-sm text-muted-foreground">
          Completing sign in...
        </p>
      </div>
    </div>
  );
}
