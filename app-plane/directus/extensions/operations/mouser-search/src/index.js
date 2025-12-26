import { defineOperationApi } from '@directus/extensions-sdk';
import { searchMouser, getMouserProductDetails } from './api.js';

export default defineOperationApi({
  id: 'mouser-search',
  handler: async ({ mpn, use_details_api }, { env }) => {
    const apiKey = env.MOUSER_API_KEY;

    if (!apiKey) {
      throw new Error('MOUSER_API_KEY environment variable not set');
    }

    if (!mpn) {
      throw new Error('MPN (Manufacturer Part Number) is required');
    }

    // Use details API if requested and we have a Mouser part number
    if (use_details_api && mpn.includes('-')) {
      return await getMouserProductDetails(mpn, apiKey);
    }

    // Default: Use keyword search API
    return await searchMouser(mpn, apiKey);
  },
});
