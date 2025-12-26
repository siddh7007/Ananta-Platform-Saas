import fetch from 'node-fetch';

/**
 * Search Mouser Electronics API for component data
 * @param {string} mpn - Manufacturer Part Number
 * @param {string} apiKey - Mouser API Key
 * @returns {Promise<Object>} Normalized component data
 */
export async function searchMouser(mpn, apiKey) {
  const url = `https://api.mouser.com/api/v1/search/keyword?apiKey=${apiKey}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        SearchByKeywordRequest: {
          keyword: mpn,
          records: 5,
          startingRecord: 0,
          searchOptions: 'Exact',
          searchWithYourSignUpLanguage: 'en',
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Mouser API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return normalizeMouserResponse(data, mpn);
  } catch (error) {
    console.error('Mouser API search failed:', error);
    return {
      found: false,
      source: 'mouser',
      error: error.message,
    };
  }
}

/**
 * Normalize Mouser API response to standard format
 * @param {Object} data - Raw Mouser API response
 * @param {string} mpn - Original MPN searched
 * @returns {Object} Normalized component data
 */
function normalizeMouserResponse(data, mpn) {
  const parts = data.SearchResults?.Parts || [];

  if (parts.length === 0) {
    return {
      found: false,
      source: 'mouser',
      message: `No results found for MPN: ${mpn}`,
    };
  }

  // Find exact match or use first result
  const part = parts.find(p =>
    p.ManufacturerPartNumber?.toLowerCase() === mpn.toLowerCase()
  ) || parts[0];

  // Extract pricing data
  const pricing = (part.PriceBreaks || []).map(pb => ({
    supplier: 'mouser',
    quantity_break: parseInt(pb.Quantity) || 1,
    price: parseFloat(pb.Price?.replace(/[^0-9.]/g, '')) || 0,
    currency: pb.Currency || 'USD',
    moq: parseInt(part.Min) || 1,
    lead_time_days: null,
  }));

  // Extract stock data
  const availability = part.Availability || '';
  const stockMatch = availability.match(/(\d+)/);
  const stock = stockMatch ? parseInt(stockMatch[1]) : 0;

  return {
    found: true,
    source: 'mouser',
    confidence: part.ManufacturerPartNumber?.toLowerCase() === mpn.toLowerCase() ? 100 : 85,
    data: {
      mpn: part.ManufacturerPartNumber || mpn,
      manufacturer: part.Manufacturer || null,
      datasheet_url: part.DataSheetUrl || null,
      image_url: part.ImagePath || null,
      description: part.Description || null,
      lifecycle_status: part.LifecycleStatus || null,
      package_type: part.Category || null,
      rohs_compliant: part.RohsStatus?.toLowerCase().includes('compliant') || null,
      reach_compliant: part.ReachStatus?.toLowerCase().includes('compliant') || null,
      pricing: pricing,
      stock: {
        mouser: stock,
      },
      lead_time_days: part.LeadTime || null,
      mouser_part_number: part.MouserPartNumber || null,
      category: part.Category || null,
      subcategory: part.Subcategory || null,
      min_order_qty: parseInt(part.Min) || 1,
      mult_order_qty: parseInt(part.Mult) || 1,
    },
  };
}

/**
 * Get detailed product information by Mouser Part Number
 * @param {string} mouserPartNumber - Mouser Part Number
 * @param {string} apiKey - Mouser API Key
 * @returns {Promise<Object>} Detailed product data
 */
export async function getMouserProductDetails(mouserPartNumber, apiKey) {
  const url = `https://api.mouser.com/api/v1/search/partnumber?apiKey=${apiKey}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        SearchByPartRequest: {
          mouserPartNumber: mouserPartNumber,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Mouser API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return normalizeMouserResponse(data, mouserPartNumber);
  } catch (error) {
    console.error('Mouser product details fetch failed:', error);
    return {
      found: false,
      source: 'mouser',
      error: error.message,
    };
  }
}
