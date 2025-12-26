import fetch from 'node-fetch';

/**
 * Search Element14/Farnell API for component data
 * @param {string} mpn - Manufacturer Part Number
 * @param {string} apiKey - Element14 API Key
 * @param {string} store - Store code (e.g., 'us', 'uk', 'de')
 * @returns {Promise<Object>} Normalized component data
 */
export async function searchElement14(mpn, apiKey, store = 'us') {
  const storeMap = {
    us: 'com',
    uk: 'co.uk',
    de: 'de',
  };
  const storeDomain = storeMap[store] || storeMap.us;

  const url = `https://api.element14.${storeDomain}/catalog/products?term=manuPartNum:${encodeURIComponent(mpn)}&storeInfo.id=${store}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        return {
          found: false,
          source: 'element14',
          message: `No results found for MPN: ${mpn}`,
        };
      }
      throw new Error(`Element14 API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return normalizeElement14Response(data, mpn);
  } catch (error) {
    console.error('Element14 API search failed:', error);
    return {
      found: false,
      source: 'element14',
      error: error.message,
    };
  }
}

/**
 * Normalize Element14 API response to standard format
 * @param {Object} data - Raw Element14 API response
 * @param {string} mpn - Original MPN searched
 * @returns {Object} Normalized component data
 */
function normalizeElement14Response(data, mpn) {
  const products = data.premierFarnellPartNumberReturn || [];

  if (products.length === 0) {
    return {
      found: false,
      source: 'element14',
      message: `No results found for MPN: ${mpn}`,
    };
  }

  // Find exact match or use first result
  const product = products.find(p =>
    p.translatedManufacturerPartNumber?.toLowerCase() === mpn.toLowerCase()
  ) || products[0];

  // Extract pricing data
  const pricing = (product.prices || []).map(price => ({
    supplier: 'element14',
    quantity_break: parseInt(price.from) || 1,
    price: parseFloat(price.cost) || 0,
    currency: price.currencyCode || 'USD',
    moq: parseInt(product.minOrderQuantity) || 1,
    lead_time_days: null,
  }));

  // Extract stock data
  const stock = parseInt(product.inv?.[0]?.value) || 0;

  // Extract attributes
  const attributes = {};
  (product.attributes || []).forEach(attr => {
    attributes[attr.attributeLabel] = attr.attributeValue;
  });

  // Extract RoHS and REACH compliance
  const rohsCompliant = product.rohsStatusCode?.toLowerCase().includes('compliant') || null;
  const reachCompliant = attributes['REACH Compliant']?.toLowerCase().includes('yes') || null;

  return {
    found: true,
    source: 'element14',
    confidence: product.translatedManufacturerPartNumber?.toLowerCase() === mpn.toLowerCase() ? 100 : 85,
    data: {
      mpn: product.translatedManufacturerPartNumber || mpn,
      manufacturer: product.brandName || null,
      datasheet_url: product.datasheets?.[0]?.url || null,
      image_url: product.productImage || null,
      description: product.displayName || null,
      lifecycle_status: product.productStatus || null,
      package_type: attributes['Package Type'] || attributes['Case Style'] || null,
      rohs_compliant: rohsCompliant,
      reach_compliant: reachCompliant,
      pricing: pricing,
      stock: {
        element14: stock,
      },
      lead_time_days: product.vendorLeadTime || null,
      element14_sku: product.sku || null,
      category: product.comingSoon || null,
      release_status: product.releaseStatusCode || null,
      min_order_qty: parseInt(product.minOrderQuantity) || 1,
      order_multiple: parseInt(product.orderMultiple) || 1,
      attributes: attributes,
    },
  };
}

/**
 * Get product details by Element14 SKU
 * @param {string} sku - Element14 SKU
 * @param {string} apiKey - Element14 API Key
 * @param {string} store - Store code (e.g., 'us', 'uk', 'de')
 * @returns {Promise<Object>} Detailed product data
 */
export async function getElement14ProductBySKU(sku, apiKey, store = 'us') {
  const storeMap = {
    us: 'com',
    uk: 'co.uk',
    de: 'de',
  };
  const storeDomain = storeMap[store] || storeMap.us;

  const url = `https://api.element14.${storeDomain}/catalog/products/${sku}?storeInfo.id=${store}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        return {
          found: false,
          source: 'element14',
          message: `No product found for SKU: ${sku}`,
        };
      }
      throw new Error(`Element14 API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return normalizeElement14Response({ premierFarnellPartNumberReturn: [data] }, data.translatedManufacturerPartNumber);
  } catch (error) {
    console.error('Element14 product details fetch failed:', error);
    return {
      found: false,
      source: 'element14',
      error: error.message,
    };
  }
}
