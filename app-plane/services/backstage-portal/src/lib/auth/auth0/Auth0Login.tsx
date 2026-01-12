import React, { useEffect } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { Box, Card, CardContent, Typography, Button, CircularProgress, Container, Alert } from '@mui/material';
import GoogleIcon from '@mui/icons-material/Google';
import MicrosoftIcon from '@mui/icons-material/Microsoft';
import EmailIcon from '@mui/icons-material/Email';

/**
 * Auth0 Login Component (Shared)
 *
 * This component handles Auth0 authentication with social providers.
 * It uses the Auth0 Universal Login for a secure, hosted login experience.
 *
 * Supported providers:
 * - Google
 * - Microsoft
 * - Email/Password
 *
 * Platform Admin Detection:
 * - Checks if URL contains '/admin-login' or '#/admin-login'
 * - Forces login with organization parameter for platform admins
 */

export interface Auth0LoginProps {
  /**
   * Organization ID for platform admins
   * @default 'org_oNtVXvVrzXz1ubua'
   */
  platformOrgId?: string;

  /**
   * Custom redirect URI (defaults to window.location.origin)
   */
  redirectUri?: string;

  /**
   * Custom title (defaults to "Components Platform")
   */
  title?: string;

  /**
   * Custom subtitle (defaults to "Sign in to access your account")
   */
  subtitle?: string;
}

export const Auth0Login: React.FC<Auth0LoginProps> = ({
  platformOrgId = 'org_oNtVXvVrzXz1ubua',
  redirectUri,
  title = 'Components Platform',
  subtitle = 'Sign in to access your account',
}) => {
  const { loginWithRedirect, isAuthenticated, isLoading, user, error, logout } = useAuth0();

  // Check if this is an admin login at component mount
  const [isAdminLogin] = React.useState(() => {
    return window.location.hash.includes('/admin-login') || window.location.pathname.includes('/admin-login');
  });

  // Loading timeout - show login form after 3 seconds even if Auth0 SDK is still loading
  const [loadingTimedOut, setLoadingTimedOut] = React.useState(false);

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (isLoading && !isAuthenticated) {
        console.log('[Auth0Login] Loading timeout - showing login form');
        setLoadingTimedOut(true);
      }
    }, 3000); // 3 second timeout

    return () => clearTimeout(timeout);
  }, [isLoading, isAuthenticated]);

  // Handle Auth0 login completion
  useEffect(() => {
    if (isAuthenticated && user) {
      console.log('[Auth0Login] User authenticated via Auth0', { email: user.email, provider: user.sub?.split('|')[0] });

      // Admin login: check org_id first
      if (isAdminLogin) {
        const namespace = import.meta.env.VITE_AUTH0_NAMESPACE || 'https://ananta.component.platform';
        const orgId = user[`${namespace}/org_id`];

        if (!orgId || orgId !== platformOrgId) {
          console.log('[Auth0Login] Admin login detected but no org_id in token - forcing re-login with organization');

          // Force logout and re-login with organization parameter
          logout({
            logoutParams: {
              returnTo: `${window.location.origin}/#/admin-login`,
            },
          });
          return; // Don't continue to login
        }
      }

      // Auth0 is authenticated - redirect to dashboard
      console.log('[Auth0Login] Redirecting to dashboard, checkAuth will handle session setup');

      if (window.location.hash !== '#/' && !window.location.hash.includes('/login')) {
        console.log('[Auth0Login] Already on valid page, React Admin will handle auth check');
      } else {
        window.location.hash = '#/';
      }
    }
  }, [isAuthenticated, user, isAdminLogin, logout, platformOrgId]);

  // Track error state for display
  const [authError, setAuthError] = React.useState<string | null>(null);

  // Handle Auth0 errors
  useEffect(() => {
    if (error) {
      console.error('[Auth0Login] Auth0 error', error);
      setAuthError(`Authentication error: ${error.message}`);
    }
  }, [error]);

  const handleLogin = () => {
    const finalRedirectUri = redirectUri || window.location.origin;

    if (isAdminLogin) {
      console.log('[Auth0Login] Initiating ADMIN login with organization:', platformOrgId);
      loginWithRedirect({
        authorizationParams: {
          redirect_uri: finalRedirectUri,
          organization: platformOrgId,
          prompt: 'login', // Force fresh login to get org_id in token
        },
      });
    } else {
      console.log('[Auth0Login] Initiating CUSTOMER login (no organization)');
      loginWithRedirect({
        authorizationParams: {
          redirect_uri: finalRedirectUri,
        },
      });
    }
  };

  // Show loading spinner
  if (isLoading && !loadingTimedOut && !isAuthenticated) {
    return (
      <Container maxWidth="sm">
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
          }}
        >
          <CircularProgress size={60} />
          <Typography sx={{ mt: 2 }}>
            Authenticating...
          </Typography>
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="sm">
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
        }}
      >
        <Card sx={{ maxWidth: 450, width: '100%', boxShadow: 3 }}>
          <CardContent sx={{ p: 4 }}>
            {/* Header */}
            <Box sx={{ textAlign: 'center', mb: 4 }}>
              <Typography variant="h4" component="h1" gutterBottom fontWeight={700}>
                {title}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {subtitle}
              </Typography>
            </Box>

            {/* Error Display */}
            {authError && (
              <Alert severity="error" sx={{ mb: 2 }} onClose={() => setAuthError(null)}>
                {authError}
              </Alert>
            )}

            {/* Login Button */}
            <Button
              variant="contained"
              fullWidth
              size="large"
              onClick={handleLogin}
              disabled={isLoading && !loadingTimedOut}
              startIcon={(isLoading && !loadingTimedOut) ? <CircularProgress size={20} color="inherit" /> : <EmailIcon />}
              sx={{
                py: 1.5,
                textTransform: 'none',
                fontSize: '16px',
                fontWeight: 600,
                background: (isLoading && !loadingTimedOut)
                  ? 'linear-gradient(135deg, #9ca3af 0%, #6b7280 100%)'
                  : 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
                '&:hover': {
                  background: (isLoading && !loadingTimedOut)
                    ? 'linear-gradient(135deg, #9ca3af 0%, #6b7280 100%)'
                    : 'linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)',
                },
              }}
            >
              {(isLoading && !loadingTimedOut) ? 'Initializing...' : 'Sign in with Auth0'}
            </Button>

            {/* Social Provider Info */}
            <Box sx={{ mt: 3, p: 2, bgcolor: 'grey.50', borderRadius: 2 }}>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                You'll be able to sign in with:
              </Typography>
              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <GoogleIcon sx={{ fontSize: 16, color: '#EA4335' }} />
                  <Typography variant="caption">Google</Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <MicrosoftIcon sx={{ fontSize: 16, color: '#00A4EF' }} />
                  <Typography variant="caption">Microsoft</Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <EmailIcon sx={{ fontSize: 16, color: '#666' }} />
                  <Typography variant="caption">Email/Password</Typography>
                </Box>
              </Box>
            </Box>

            {/* Footer */}
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 3, textAlign: 'center' }}>
              By signing in, you agree to our Terms of Service and Privacy Policy
            </Typography>
          </CardContent>
        </Card>
      </Box>
    </Container>
  );
};
