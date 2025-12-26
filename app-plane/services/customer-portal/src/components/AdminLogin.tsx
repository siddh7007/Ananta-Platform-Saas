import { useEffect, useState } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { Box, CircularProgress, Typography } from '@mui/material';

const PLATFORM_ORG_ID = 'org_oNtVXvVrzXz1ubua';
// Configurable via VITE_AUTH0_NAMESPACE environment variable
const CUSTOM_NAMESPACE = import.meta.env.VITE_AUTH0_NAMESPACE || 'https://ananta.component.platform';

/**
 * Admin Login Component
 *
 * This component handles login for platform administrators.
 * It forces login through the Platform Organization so that
 * Auth0 includes org_id in the JWT token.
 *
 * If user is already logged in but doesn't have org_id,
 * it forces a logout and fresh login through the organization.
 */
export const AdminLogin = () => {
  const { loginWithRedirect, logout, isAuthenticated, isLoading, user } = useAuth0();
  const [hasCheckedOrgId, setHasCheckedOrgId] = useState(false);

  useEffect(() => {
    if (isLoading) return;

    // Case 1: Not authenticated → Login with organization
    if (!isAuthenticated) {
      loginWithRedirect({
        authorizationParams: {
          organization: PLATFORM_ORG_ID,
          prompt: 'login', // Force fresh login
        },
      });
      return;
    }

    // Case 2: Authenticated → Check if they have org_id
    if (!hasCheckedOrgId) {
      const auth0OrgId = user?.[`${CUSTOM_NAMESPACE}/org_id`];

      console.log('[AdminLogin] Checking auth0OrgId:', auth0OrgId);

      if (!auth0OrgId || auth0OrgId !== PLATFORM_ORG_ID) {
        // User doesn't have platform org_id → Force fresh login
        console.log('[AdminLogin] No org_id found, forcing logout and re-login with organization');

        logout({
          logoutParams: {
            returnTo: `${window.location.origin}/admin-login`,
          },
        });
        return;
      }

      // User has correct org_id → Redirect to dashboard
      console.log('[AdminLogin] ✅ Platform org_id verified, redirecting to dashboard');
      setHasCheckedOrgId(true);
      window.location.href = '/';
    }
  }, [isLoading, isAuthenticated, loginWithRedirect, logout, user, hasCheckedOrgId]);

  if (isAuthenticated && hasCheckedOrgId) {
    // Redirect to dashboard
    window.location.href = '/';
    return null;
  }

  return (
    <Box
      display="flex"
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      minHeight="100vh"
      gap={2}
    >
      <CircularProgress />
      <Typography variant="h6" color="text.secondary">
        Redirecting to Admin Login...
      </Typography>
    </Box>
  );
};
