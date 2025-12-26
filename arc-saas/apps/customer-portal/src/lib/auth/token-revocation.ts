/**
 * Token Revocation Service
 * CBP-P1-005: Token Revocation on Logout
 */

export interface TokenRevocationConfig {
  keycloakUrl: string;
  realm: string;
  clientId: string;
}

/**
 * Revoke a single token on Keycloak
 * FIX M3: Added 5-second timeout
 * FIX L1: Sanitized error logging
 */
export async function revokeToken(
  config: TokenRevocationConfig,
  token: string,
  tokenType: 'access_token' | 'refresh_token' | 'id_token' = 'refresh_token'
): Promise<boolean> {
  const revokeUrl = `${config.keycloakUrl}/realms/${config.realm}/protocol/openid-connect/revoke`;

  try {
    // Create AbortController for timeout (FIX M3)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(revokeUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: config.clientId,
        token: token,
        token_type_hint: tokenType,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    return response.ok;
  } catch (error) {
    // FIX L1: Sanitized logging - don't log full error which may contain token
    if (error instanceof Error) {
      console.error('[TokenRevocation] Failed to revoke token:', error.name, error.message);
    } else {
      console.error('[TokenRevocation] Failed to revoke token: Unknown error');
    }
    return false;
  }
}

/**
 * Revoke all tokens (access, refresh, and ID token)
 * FIX C2: Added ID token revocation
 */
export async function revokeAllTokens(
  config: TokenRevocationConfig,
  accessToken: string,
  refreshToken: string,
  idToken?: string
): Promise<void> {
  const revocations = [
    revokeToken(config, refreshToken, 'refresh_token'),
    revokeToken(config, accessToken, 'access_token'),
  ];

  // FIX C2: Revoke ID token if provided
  if (idToken) {
    revocations.push(revokeToken(config, idToken, 'id_token'));
  }

  await Promise.all(revocations);
}
