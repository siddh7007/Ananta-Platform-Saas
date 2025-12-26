import fetch from 'node-fetch';

/**
 * Search DigiKey API for component data
 * @param {string} mpn - Manufacturer Part Number
 * @param {string} clientId - DigiKey Client ID
 * @param {string} accessToken - DigiKey Access Token
 * @returns {Promise<Object>} Normalized component data
 */
export async function searchDigiKey(mpn, clientId, accessToken) {
  const url = `https://api.digikey.com/products/v4/search/${encodeURIComponent(mpn)}/productdetails`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'X-DIGIKEY-Client-Id': clientId,
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        return {
          found: false,
          source: 'digikey',
          message: `No results found for MPN: ${mpn}`,
        };
      }
      throw new Error(`DigiKey API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return normalizeDigiKeyResponse(data, mpn);
  } catch (error) {
    console.error('DigiKey API search failed:', error);
    return {
      found: false,
      source: 'digikey',
      error: error.message,
    };
  }
}

/**
 * Normalize DigiKey API response to standard format
 * @param {Object} data - Raw DigiKey API response
 * @param {string} mpn - Original MPN searched
 * @returns {Object} Normalized component data
 */
function normalizeDigiKeyResponse(data, mpn) {
  if (!data.Product) {
    return {
      found: false,
      source: 'digikey',
      message: `No product data for MPN: ${mpn}`,
    };
  }

  const product = data.Product;

  // Extract pricing data
  const pricing = (product.StandardPricing || []).map(price => ({
    supplier: 'digikey',
    quantity_break: parseInt(price.BreakQuantity) || 1,
    price: parseFloat(price.UnitPrice) || 0,
    currency: price.Currency || 'USD',
    moq: parseInt(product.MinimumOrderQuantity) || 1,
    lead_time_days: null,
  }));

  // Extract parameters
  const params = {};
  (product.Parameters || []).forEach(param => {
    params[param.Parameter] = param.Value;
  });

  // Extract lifecycle status
  const lifecycleStatus = product.ProductStatus || null;

  // Extract RoHS and REACH compliance
  const rohsCompliant = product.RoHS?.RoHSStatus?.toLowerCase().includes('compliant') || null;
  const reachCompliant = params['REACH Status']?.toLowerCase().includes('compliant') || null;

  return {
    found: true,
    source: 'digikey',
    confidence: product.ManufacturerPartNumber?.toLowerCase() === mpn.toLowerCase() ? 100 : 85,
    data: {
      mpn: product.ManufacturerPartNumber || mpn,
      manufacturer: product.Manufacturer?.Name || null,
      datasheet_url: product.DatasheetUrl || product.PrimaryDatasheet || null,
      image_url: product.PrimaryPhoto || null,
      description: product.ProductDescription || product.DetailedDescription || null,
      lifecycle_status: lifecycleStatus,
      package_type: params['Package / Case'] || params['Mounting Type'] || null,
      rohs_compliant: rohsCompliant,
      reach_compliant: reachCompliant,
      pricing: pricing,
      stock: {
        digikey: parseInt(product.QuantityAvailable) || 0,
      },
      lead_time_days: product.LeadStatus || null,
      digikey_part_number: product.DigiKeyPartNumber || null,
      category: product.Category?.Name || null,
      family: product.Family?.Name || null,
      series: product.Series?.Name || null,
      min_order_qty: parseInt(product.MinimumOrderQuantity) || 1,
      packaging: product.Packaging?.Name || null,
      parameters: params,
    },
  };
}

/**
 * Refresh DigiKey OAuth2 access token
 * @param {string} clientId - DigiKey Client ID
 * @param {string} clientSecret - DigiKey Client Secret
 * @param {string} refreshToken - DigiKey Refresh Token
 * @returns {Promise<Object>} New access token data
 */
export async function refreshDigiKeyToken(clientId, clientSecret, refreshToken) {
  const url = 'https://api.digikey.com/v1/oauth2/token';

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
      }),
    });

    if (!response.ok) {
      throw new Error(`DigiKey token refresh error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_in: data.expires_in,
    };
  } catch (error) {
    console.error('DigiKey token refresh failed:', error);
    throw error;
  }
}
