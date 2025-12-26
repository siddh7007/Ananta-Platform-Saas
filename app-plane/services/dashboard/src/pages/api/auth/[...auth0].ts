/**
 * Auth0 Dynamic API Route Handler
 *
 * Handles all Auth0 routes: /api/auth/login, /api/auth/logout, /api/auth/callback, /api/auth/me
 */

import { handleAuth, handleLogin } from '@auth0/nextjs-auth0';

export default handleAuth({
  login: handleLogin({
    authorizationParams: {
      // Force organization login for platform admins
      organization: process.env.AUTH0_PLATFORM_ORG_ID || 'org_oNtVXvVrzXz1ubua',
      audience: process.env.AUTH0_AUDIENCE || 'https://components-platform.com/api',
      scope: 'openid profile email',
    },
  }),
});
