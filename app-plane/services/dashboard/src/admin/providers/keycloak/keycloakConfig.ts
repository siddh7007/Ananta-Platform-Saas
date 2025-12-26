/**
 * Keycloak Configuration - Dashboard (Next.js)
 */

import Keycloak from 'keycloak-js';

export const keycloakConfig = {
  url: process.env.NEXT_PUBLIC_KEYCLOAK_URL || 'http://localhost:8180',
  realm: process.env.NEXT_PUBLIC_KEYCLOAK_REALM || 'components-platform',
  clientId: process.env.NEXT_PUBLIC_KEYCLOAK_CLIENT_ID || 'dashboard',
};

let keycloakInstance: Keycloak | null = null;

export const getKeycloak = (): Keycloak => {
  if (!keycloakInstance) {
    keycloakInstance = new Keycloak(keycloakConfig);
  }
  return keycloakInstance;
};

export const initKeycloak = async (): Promise<boolean> => {
  const keycloak = getKeycloak();

  try {
    const authenticated = await keycloak.init({
      onLoad: 'check-sso',
      silentCheckSsoRedirectUri: window.location.origin + '/silent-check-sso.html',
      pkceMethod: 'S256',
      checkLoginIframe: false,
    });

    console.log('[Keycloak] Initialized, authenticated:', authenticated);

    if (authenticated) {
      setInterval(async () => {
        if (keycloak.token && keycloak.isTokenExpired(60)) {
          try {
            await keycloak.updateToken(60);
          } catch (error) {
            keycloak.login();
          }
        }
      }, 30000);
    }

    return authenticated;
  } catch (error) {
    console.error('[Keycloak] Init error:', error);
    return false;
  }
};

export const getUserRoles = (): string[] => {
  const keycloak = getKeycloak();
  const token = keycloak.tokenParsed;
  if (!token) return [];
  const realmRoles = token.realm_access?.roles || [];
  const clientRoles = token.resource_access?.[keycloakConfig.clientId]?.roles || [];
  return [...realmRoles, ...clientRoles];
};

export const hasRole = (role: string): boolean => getUserRoles().includes(role);
export const isAdmin = (): boolean => {
  const roles = getUserRoles();
  return roles.includes('admin') || roles.includes('super-admin');
};
export const isSuperAdmin = (): boolean => hasRole('super-admin');

export const getUserInfo = () => {
  const keycloak = getKeycloak();
  const token = keycloak.tokenParsed;
  if (!token) return null;
  const given = token.given_name || '';
  const family = token.family_name || '';
  return {
    id: token.sub,
    username: token.preferred_username,
    email: token.email,
    firstName: given,
    lastName: family,
    fullName: token.name || (given + ' ' + family).trim(),
    roles: getUserRoles(),
  };
};

export const getAccessToken = (): string | undefined => getKeycloak().token;

export const login = (redirectUri?: string) => {
  getKeycloak().login({ redirectUri: redirectUri || window.location.origin });
};

export const logout = (redirectUri?: string) => {
  getKeycloak().logout({ redirectUri: redirectUri || window.location.origin });
};

export { keycloakInstance };
