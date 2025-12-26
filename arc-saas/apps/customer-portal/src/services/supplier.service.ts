/**
 * Supplier Pricing Service
 * Handles supplier API integration via CNS Service
 *
 * CNS API endpoints:
 * - POST /api/suppliers/search - Multi-supplier component search
 * - GET /api/suppliers/details - Detailed product information
 * - GET /api/suppliers/best-match - Intelligent matching
 * - GET /api/suppliers/health - Supplier health status
 * - GET /api/suppliers/available - List available suppliers
 * - GET /api/suppliers/circuit-breaker/status - Circuit breaker states
 */

import { cnsApi } from '@/lib/axios';
import type {
  SupplierName,
  SupplierProductData,
  SupplierSearchRequest,
  SupplierSearchResponse,
  SupplierDetailsRequest,
  SupplierDetailsResponse,
  BestMatchResponse,
  SupplierHealth,
  CircuitBreakerStatus,
  SupplierComparison,
  PriceBreak,
} from '@/types/supplier';

// =============================================================================
// Supplier Search & Details
// =============================================================================

/**
 * Search for a component across multiple suppliers
 */
export async function searchSuppliers(
  request: SupplierSearchRequest
): Promise<SupplierSearchResponse> {
  const response = await cnsApi.post<SupplierSearchResponse>(
    '/suppliers/search',
    {
      mpn: request.mpn,
      manufacturer: request.manufacturer,
      preferred_suppliers: request.preferred_suppliers,
      limit: request.limit ?? 5,
    }
  );
  return response.data;
}

/**
 * Get detailed product information from a specific supplier
 */
export async function getSupplierDetails(
  request: SupplierDetailsRequest
): Promise<SupplierDetailsResponse> {
  const params = new URLSearchParams({
    mpn: request.mpn,
    supplier: request.supplier,
  });
  if (request.manufacturer) {
    params.set('manufacturer', request.manufacturer);
  }

  const response = await cnsApi.get<SupplierDetailsResponse>(
    `/suppliers/details?${params.toString()}`
  );
  return response.data;
}

/**
 * Get the best matching product across all suppliers
 */
export async function getBestMatch(
  mpn: string,
  manufacturer?: string,
  minConfidence = 80
): Promise<BestMatchResponse> {
  const params = new URLSearchParams({ mpn });
  if (manufacturer) params.set('manufacturer', manufacturer);
  params.set('min_confidence', minConfidence.toString());

  const response = await cnsApi.get<BestMatchResponse>(
    `/suppliers/best-match?${params.toString()}`
  );
  return response.data;
}

/**
 * Get real-time pricing for a component from all available suppliers
 * Returns a comparison view with pricing from each supplier
 */
export async function getComponentPricing(
  mpn: string,
  manufacturer?: string
): Promise<SupplierComparison> {
  const searchResponse = await searchSuppliers({ mpn, manufacturer });

  // Transform results into comparison format
  const suppliers = searchResponse.results.map((r) => r.product);

  // Calculate price range
  const prices = suppliers
    .filter((s) => s.unit_price !== undefined && s.unit_price !== null)
    .map((s) => s.unit_price as number);

  const priceRange =
    prices.length > 0
      ? {
          min: Math.min(...prices),
          max: Math.max(...prices),
          currency: suppliers[0]?.currency ?? 'USD',
        }
      : undefined;

  // Calculate total availability
  const totalAvailability = suppliers.reduce(
    (sum, s) => sum + (s.availability ?? 0),
    0
  );

  // Find recommended supplier (lowest price with stock)
  const inStockSuppliers = suppliers.filter(
    (s) => s.availability && s.availability > 0 && s.unit_price
  );

  let recommended: SupplierComparison['recommended'];
  if (inStockSuppliers.length > 0) {
    const lowestPrice = inStockSuppliers.reduce((best, curr) =>
      (curr.unit_price ?? Infinity) < (best.unit_price ?? Infinity) ? curr : best
    );
    recommended = {
      supplier: lowestPrice.supplier_name,
      reason: 'lowest_price',
    };
  }

  return {
    mpn,
    manufacturer: manufacturer ?? searchResponse.results[0]?.product.manufacturer ?? '',
    suppliers,
    recommended,
    price_range: priceRange,
    total_availability: totalAvailability,
  };
}

/**
 * Get pricing for multiple components (batch request)
 */
export async function getBatchPricing(
  components: Array<{ mpn: string; manufacturer?: string }>
): Promise<SupplierComparison[]> {
  // Execute searches in parallel with concurrency limit
  const BATCH_SIZE = 5;
  const results: SupplierComparison[] = [];

  for (let i = 0; i < components.length; i += BATCH_SIZE) {
    const batch = components.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map((c) =>
        getComponentPricing(c.mpn, c.manufacturer).catch(() => ({
          mpn: c.mpn,
          manufacturer: c.manufacturer ?? '',
          suppliers: [],
        }))
      )
    );
    results.push(...batchResults);
  }

  return results;
}

// =============================================================================
// Supplier Health & Status
// =============================================================================

/**
 * Get health status for all configured suppliers
 */
export async function getSupplierHealth(): Promise<SupplierHealth[]> {
  const response = await cnsApi.get<{ suppliers: SupplierHealth[] }>(
    '/suppliers/health'
  );
  return response.data.suppliers;
}

/**
 * Get list of available (enabled) suppliers
 */
export async function getAvailableSuppliers(): Promise<SupplierName[]> {
  const response = await cnsApi.get<{ suppliers: SupplierName[] }>(
    '/suppliers/available'
  );
  return response.data.suppliers;
}

/**
 * Get circuit breaker status for all suppliers
 */
export async function getCircuitBreakerStatus(): Promise<CircuitBreakerStatus[]> {
  const response = await cnsApi.get<{ statuses: CircuitBreakerStatus[] }>(
    '/suppliers/circuit-breaker/status'
  );
  return response.data.statuses;
}

/**
 * Reset circuit breaker for a specific supplier
 */
export async function resetCircuitBreaker(
  supplier: SupplierName
): Promise<{ success: boolean; message: string }> {
  const response = await cnsApi.post<{ success: boolean; message: string }>(
    `/suppliers/circuit-breaker/reset?supplier_name=${supplier}`
  );
  return response.data;
}

// =============================================================================
// Price Calculation Helpers
// =============================================================================

/**
 * Calculate the best price for a given quantity across all suppliers
 */
export function calculateBestPrice(
  suppliers: SupplierProductData[],
  quantity: number
): {
  supplier: string;
  unitPrice: number;
  totalPrice: number;
  currency: string;
  priceBreak: PriceBreak | null;
} | null {
  if (!suppliers || suppliers.length === 0) return null;

  let bestResult: ReturnType<typeof calculateBestPrice> = null;

  for (const supplier of suppliers) {
    // Skip suppliers with no stock
    if (!supplier.availability || supplier.availability < quantity) continue;

    // Find best price break for this quantity
    const priceBreaks = supplier.price_breaks ?? [];
    let unitPrice = supplier.unit_price ?? Infinity;
    let usedBreak: PriceBreak | null = null;

    // Sort price breaks by quantity descending
    const sortedBreaks = [...priceBreaks].sort((a, b) => b.quantity - a.quantity);

    for (const pb of sortedBreaks) {
      if (pb.quantity <= quantity && pb.price < unitPrice) {
        unitPrice = pb.price;
        usedBreak = pb;
      }
    }

    const totalPrice = unitPrice * quantity;

    if (!bestResult || totalPrice < bestResult.totalPrice) {
      bestResult = {
        supplier: supplier.supplier_name,
        unitPrice,
        totalPrice,
        currency: supplier.currency ?? 'USD',
        priceBreak: usedBreak,
      };
    }
  }

  return bestResult;
}

/**
 * Calculate cost breakdown for a BOM line item
 */
export function calculateLineItemCost(
  suppliers: SupplierProductData[],
  quantity: number
): {
  bySupplier: Array<{
    supplier: string;
    unitPrice: number | null;
    totalCost: number | null;
    available: number;
    leadTime: number | null;
    meetsQuantity: boolean;
    hasPricing: boolean;
  }>;
  bestOption: {
    supplier: string;
    totalCost: number;
    currency: string;
  } | null;
  anyInStock: boolean;
  totalAvailable: number;
} {
  const bySupplier = suppliers.map((s) => {
    const sortedBreaks = [...(s.price_breaks ?? [])].sort(
      (a, b) => b.quantity - a.quantity
    );

    // Check if we have valid pricing data
    const hasPricing = s.unit_price !== undefined && s.unit_price !== null;
    let unitPrice: number | null = hasPricing ? s.unit_price! : null;

    // Apply price breaks if available
    if (hasPricing) {
      for (const pb of sortedBreaks) {
        if (pb.quantity <= quantity) {
          unitPrice = pb.price;
          break;
        }
      }
    }

    return {
      supplier: s.supplier_name,
      unitPrice,
      totalCost: unitPrice !== null ? unitPrice * quantity : null,
      available: s.availability ?? 0,
      leadTime: s.lead_time_days ?? null,
      meetsQuantity: (s.availability ?? 0) >= quantity,
      hasPricing,
      currency: s.currency ?? 'USD',
    };
  });

  // Find best option: lowest cost that meets quantity AND has valid pricing
  const validOptions = bySupplier.filter(
    (o) => o.meetsQuantity && o.hasPricing && o.totalCost !== null
  );

  const bestOption =
    validOptions.length > 0
      ? validOptions.reduce((best, curr) =>
          (curr.totalCost as number) < (best.totalCost as number) ? curr : best
        )
      : null;

  return {
    bySupplier: bySupplier.map(({ currency: _currency, ...rest }) => rest),
    bestOption: bestOption
      ? {
          supplier: bestOption.supplier,
          totalCost: bestOption.totalCost as number,
          currency: bestOption.currency,
        }
      : null,
    anyInStock: bySupplier.some((o) => o.available > 0),
    totalAvailable: bySupplier.reduce((sum, o) => sum + o.available, 0),
  };
}

// =============================================================================
// Refresh & Sync
// =============================================================================

/**
 * Refresh pricing data for a component (force re-fetch from suppliers)
 */
export async function refreshComponentPricing(
  mpn: string,
  manufacturer?: string
): Promise<SupplierSearchResponse> {
  // The search endpoint always fetches fresh data from suppliers
  return searchSuppliers({
    mpn,
    manufacturer,
    limit: 10,
  });
}

/**
 * Refresh pricing for multiple components
 */
export async function refreshBatchPricing(
  components: Array<{ mpn: string; manufacturer?: string }>
): Promise<{
  success: number;
  failed: number;
  results: SupplierSearchResponse[];
}> {
  const results: SupplierSearchResponse[] = [];
  let success = 0;
  let failed = 0;

  // Process in batches to avoid overwhelming the API
  const BATCH_SIZE = 3;

  for (let i = 0; i < components.length; i += BATCH_SIZE) {
    const batch = components.slice(i, i + BATCH_SIZE);
    const batchPromises = batch.map((c) =>
      refreshComponentPricing(c.mpn, c.manufacturer)
        .then((r) => {
          success++;
          return r;
        })
        .catch(() => {
          failed++;
          return null;
        })
    );

    const batchResults = await Promise.all(batchPromises);
    results.push(
      ...(batchResults.filter((r) => r !== null) as SupplierSearchResponse[])
    );

    // Small delay between batches to respect rate limits
    if (i + BATCH_SIZE < components.length) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  return { success, failed, results };
}

// =============================================================================
// Export default service object
// =============================================================================

export default {
  // Search & Details
  searchSuppliers,
  getSupplierDetails,
  getBestMatch,
  getComponentPricing,
  getBatchPricing,

  // Health & Status
  getSupplierHealth,
  getAvailableSuppliers,
  getCircuitBreakerStatus,
  resetCircuitBreaker,

  // Price Calculation
  calculateBestPrice,
  calculateLineItemCost,

  // Refresh
  refreshComponentPricing,
  refreshBatchPricing,
};
