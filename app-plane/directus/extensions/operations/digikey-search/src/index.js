import { defineOperationApi } from '@directus/extensions-sdk';
import { searchDigiKey, refreshDigiKeyToken } from './api.js';

export default defineOperationApi({
  id: 'digikey-search',
  handler: async ({ mpn, refresh_token_if_needed }, { env }) => {
    const clientId = env.DIGIKEY_CLIENT_ID;
    const accessToken = env.DIGIKEY_ACCESS_TOKEN;
    const clientSecret = env.DIGIKEY_CLIENT_SECRET;
    const refreshToken = env.DIGIKEY_REFRESH_TOKEN;

    if (!clientId || !accessToken) {
      throw new Error('DIGIKEY_CLIENT_ID and DIGIKEY_ACCESS_TOKEN environment variables are required');
    }

    if (!mpn) {
      throw new Error('MPN (Manufacturer Part Number) is required');
    }

    try {
      // Attempt search with current access token
      return await searchDigiKey(mpn, clientId, accessToken);
    } catch (error) {
      // If 401 Unauthorized and we have refresh token capability, try refreshing
      if (refresh_token_if_needed && error.message.includes('401') && clientSecret && refreshToken) {
        console.log('DigiKey access token expired, attempting refresh...');

        try {
          const newTokens = await refreshDigiKeyToken(clientId, clientSecret, refreshToken);

          // Note: In production, you'd want to update the env variables in Directus Settings
          console.log('DigiKey token refreshed successfully. Update DIGIKEY_ACCESS_TOKEN in Directus Settings.');

          // Retry search with new token
          return await searchDigiKey(mpn, clientId, newTokens.access_token);
        } catch (refreshError) {
          throw new Error(`DigiKey token refresh failed: ${refreshError.message}`);
        }
      }

      // Re-throw original error
      throw error;
    }
  },
});
