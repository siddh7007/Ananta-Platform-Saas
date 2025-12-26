import { defineOperationApi } from '@directus/extensions-sdk';
import { searchElement14, getElement14ProductBySKU } from './api.js';

export default defineOperationApi({
  id: 'element14-search',
  handler: async ({ mpn, store, use_sku_lookup }, { env }) => {
    const apiKey = env.ELEMENT14_API_KEY;
    const defaultStore = env.ELEMENT14_STORE || 'us';

    if (!apiKey) {
      throw new Error('ELEMENT14_API_KEY environment variable not set');
    }

    if (!mpn) {
      throw new Error('MPN (Manufacturer Part Number) or SKU is required');
    }

    const targetStore = store || defaultStore;

    // Use SKU lookup if requested
    if (use_sku_lookup) {
      return await getElement14ProductBySKU(mpn, apiKey, targetStore);
    }

    // Default: Use MPN search
    return await searchElement14(mpn, apiKey, targetStore);
  },
});
