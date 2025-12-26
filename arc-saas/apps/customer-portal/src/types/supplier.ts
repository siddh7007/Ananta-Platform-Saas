/**
 * Supplier and Pricing Types
 * Aligned with CNS service supplier API endpoints and data structures
 *
 * CNS API endpoints:
 * - POST /api/suppliers/search - Multi-supplier component search
 * - GET /api/suppliers/details - Detailed product information
 * - GET /api/suppliers/best-match - Intelligent matching
 * - GET /api/suppliers/health - Supplier health status
 * - GET /api/suppliers/available - List available suppliers
 */

// =============================================================================
// Supplier Identification
// =============================================================================

/**
 * Supported supplier names (aligned with CNS plugins)
 */
export type SupplierName = 'digikey' | 'mouser' | 'element14' | 'octopart' | 'manual';

/**
 * Display configuration for each supplier
 */
export const SUPPLIER_CONFIG: Record<
  SupplierName,
  {
    displayName: string;
    shortName: string;
    color: string;
    bgColor: string;
    borderColor: string;
    logoUrl?: string;
  }
> = {
  digikey: {
    displayName: 'DigiKey',
    shortName: 'DK',
    color: 'text-red-700',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
  },
  mouser: {
    displayName: 'Mouser Electronics',
    shortName: 'MOU',
    color: 'text-blue-700',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
  },
  element14: {
    displayName: 'Element14 / Farnell',
    shortName: 'E14',
    color: 'text-orange-700',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-200',
  },
  octopart: {
    displayName: 'Octopart',
    shortName: 'OCT',
    color: 'text-green-700',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
  },
  manual: {
    displayName: 'Manual Entry',
    shortName: 'MAN',
    color: 'text-gray-700',
    bgColor: 'bg-gray-50',
    borderColor: 'border-gray-200',
  },
};

// =============================================================================
// Pricing Types
// =============================================================================

/**
 * Price break (quantity-based pricing tier)
 */
export interface PriceBreak {
  quantity: number;
  price: number;
  currency?: string;
}

/**
 * Extended price break with calculated fields
 */
export interface ExtendedPriceBreak extends PriceBreak {
  /** Price per unit at this break */
  unitPrice: number;
  /** Savings percentage compared to single unit price */
  savingsPercent?: number;
  /** Total cost at this quantity */
  extendedPrice: number;
}

/**
 * Stock/availability status
 */
export type StockStatus =
  | 'in_stock'
  | 'low_stock'
  | 'out_of_stock'
  | 'backordered'
  | 'discontinued'
  | 'unknown';

/**
 * Stock status display configuration
 */
export const STOCK_STATUS_CONFIG: Record<
  StockStatus,
  {
    label: string;
    color: string;
    bgColor: string;
    borderColor: string;
    icon: 'check' | 'alert' | 'x' | 'clock' | 'help';
  }
> = {
  in_stock: {
    label: 'In Stock',
    color: 'text-green-700',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    icon: 'check',
  },
  low_stock: {
    label: 'Low Stock',
    color: 'text-yellow-700',
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-200',
    icon: 'alert',
  },
  out_of_stock: {
    label: 'Out of Stock',
    color: 'text-red-700',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    icon: 'x',
  },
  backordered: {
    label: 'Backordered',
    color: 'text-orange-700',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-200',
    icon: 'clock',
  },
  discontinued: {
    label: 'Discontinued',
    color: 'text-gray-700',
    bgColor: 'bg-gray-100',
    borderColor: 'border-gray-300',
    icon: 'x',
  },
  unknown: {
    label: 'Unknown',
    color: 'text-gray-500',
    bgColor: 'bg-gray-50',
    borderColor: 'border-gray-200',
    icon: 'help',
  },
};

// =============================================================================
// Supplier Product Data
// =============================================================================

/**
 * Supplier-specific product data (from CNS SupplierProductData)
 */
export interface SupplierProductData {
  /** Manufacturer Part Number */
  mpn?: string;
  /** Manufacturer name */
  manufacturer?: string;
  /** Product description */
  description?: string;

  // Supplier identification
  /** Supplier name (digikey, mouser, etc. or custom name in tests) */
  supplier_name: string;
  /** Supplier's SKU/part number */
  supplier_sku?: string;
  /** Direct link to product page */
  supplier_url?: string;

  // Pricing
  /** Unit price (single quantity) */
  unit_price?: number;
  /** Currency code (USD, EUR, etc.) */
  currency?: string;
  /** Quantity-based price breaks */
  price_breaks?: PriceBreak[];
  /** Minimum order quantity */
  moq?: number;

  // Availability
  /** Stock quantity available */
  availability?: number;
  /** Stock status */
  stock_status?: StockStatus;
  /** Lead time in days */
  lead_time_days?: number;
  /** Expected restock date */
  restock_date?: string;

  // Compliance
  /** RoHS compliant */
  rohs_compliant?: boolean;
  /** REACH compliant */
  reach_compliant?: boolean;
  /** Halogen free */
  halogen_free?: boolean;
  /** Automotive qualified (AEC-Q100/200) */
  aec_qualified?: boolean;

  // Metadata
  /** Match confidence score (0-100) */
  match_confidence?: number;
  /** When this data was last updated */
  last_updated?: string;
}

/**
 * Aggregated supplier data for a component (keyed by supplier name)
 * Stored in component_catalog.supplier_data JSONB field
 */
export type SupplierDataMap = Record<string, SupplierProductData>;

// =============================================================================
// API Request/Response Types
// =============================================================================

/**
 * Request to search across multiple suppliers
 */
export interface SupplierSearchRequest {
  /** MPN to search for */
  mpn: string;
  /** Manufacturer name (optional, improves matching) */
  manufacturer?: string;
  /** Preferred suppliers to query (default: all enabled) */
  preferred_suppliers?: SupplierName[];
  /** Maximum results per supplier */
  limit?: number;
}

/**
 * Individual supplier search result
 */
export interface SupplierSearchResult {
  /** Supplier name */
  supplier: SupplierName;
  /** Product data from supplier */
  product: SupplierProductData;
  /** Match confidence (0-100) */
  confidence: number;
  /** Whether this is an exact MPN match */
  exact_match: boolean;
}

/**
 * Response from supplier search API
 */
export interface SupplierSearchResponse {
  /** Search query used */
  query: {
    mpn: string;
    manufacturer?: string;
  };
  /** Results from each supplier */
  results: SupplierSearchResult[];
  /** Total results found */
  total_results: number;
  /** Suppliers that were queried */
  suppliers_queried: SupplierName[];
  /** Suppliers that failed or timed out */
  suppliers_failed?: SupplierName[];
  /** Search execution time in ms */
  search_time_ms?: number;
}

/**
 * Request for detailed product information
 */
export interface SupplierDetailsRequest {
  mpn: string;
  manufacturer?: string;
  supplier: SupplierName;
}

/**
 * Response for detailed product information
 */
export interface SupplierDetailsResponse {
  supplier: SupplierName;
  product: SupplierProductData;
  /** Raw parameters/specifications from supplier */
  parameters?: Record<string, string | number | boolean>;
  /** Datasheet URLs */
  datasheets?: string[];
  /** Product images */
  images?: string[];
}

/**
 * Best match response
 */
export interface BestMatchResponse {
  /** Best matching supplier */
  supplier: SupplierName;
  /** Product data */
  product: SupplierProductData;
  /** Match confidence */
  confidence: number;
  /** All matches considered */
  all_matches: SupplierSearchResult[];
}

// =============================================================================
// Supplier Health & Status
// =============================================================================

/**
 * Health status for a single supplier
 */
export interface SupplierHealth {
  supplier: SupplierName;
  /** Is the supplier API available */
  available: boolean;
  /** Response time in ms */
  response_time_ms?: number;
  /** Rate limit remaining */
  rate_limit_remaining?: number;
  /** Rate limit reset time */
  rate_limit_reset?: string;
  /** Last successful API call */
  last_success?: string;
  /** Error message if unavailable */
  error?: string;
}

/**
 * Circuit breaker state
 */
export type CircuitBreakerState = 'OPEN' | 'CLOSED' | 'HALF_OPEN';

/**
 * Circuit breaker status for a supplier
 */
export interface CircuitBreakerStatus {
  supplier: SupplierName;
  state: CircuitBreakerState;
  failure_count: number;
  last_failure?: string;
  last_success?: string;
}

// =============================================================================
// Comparison Types
// =============================================================================

/**
 * Supplier comparison for a single component
 */
export interface SupplierComparison {
  mpn: string;
  manufacturer: string;
  /** Data from each supplier */
  suppliers: SupplierProductData[];
  /** Recommended supplier (lowest price with stock) */
  recommended?: {
    supplier: string;
    reason: 'lowest_price' | 'best_availability' | 'fastest_delivery' | 'best_match';
  };
  /** Price range across suppliers */
  price_range?: {
    min: number;
    max: number;
    currency: string;
  };
  /** Total stock across all suppliers */
  total_availability?: number;
}

/**
 * BOM-level cost summary
 */
export interface BomCostSummary {
  bom_id: string;
  /** Total line items */
  total_lines: number;
  /** Lines with pricing data */
  priced_lines: number;
  /** Lines with no pricing */
  unpriced_lines: number;
  /** Total cost at quantity 1 */
  total_cost_qty1: number;
  /** Total cost at BOM quantities */
  total_cost_at_qty: number;
  /** Currency */
  currency: string;
  /** Cost breakdown by supplier */
  by_supplier: Record<
    string,
    {
      line_count: number;
      total_cost: number;
    }
  >;
  /** Lines with stock issues */
  stock_issues: number;
  /** Lines with long lead times (>14 days) */
  long_lead_time: number;
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Get supplier display configuration
 */
export function getSupplierConfig(supplier: string): (typeof SUPPLIER_CONFIG)[SupplierName] {
  const normalized = supplier.toLowerCase() as SupplierName;
  return SUPPLIER_CONFIG[normalized] ?? SUPPLIER_CONFIG.manual;
}

/**
 * Get stock status configuration
 */
export function getStockStatusConfig(
  status?: string | null
): (typeof STOCK_STATUS_CONFIG)[StockStatus] {
  if (!status) return STOCK_STATUS_CONFIG.unknown;
  const normalized = status.toLowerCase().replace(/\s+/g, '_') as StockStatus;
  return STOCK_STATUS_CONFIG[normalized] ?? STOCK_STATUS_CONFIG.unknown;
}

/**
 * Determine stock status from quantity
 */
export function getStockStatusFromQuantity(
  available?: number,
  required?: number
): StockStatus {
  if (available === undefined || available === null) return 'unknown';
  if (available === 0) return 'out_of_stock';
  if (required && available < required) return 'low_stock';
  if (available < 100) return 'low_stock';
  return 'in_stock';
}

/**
 * Calculate extended price breaks with savings
 */
export function calculateExtendedPriceBreaks(
  priceBreaks: PriceBreak[],
  basePrice?: number
): ExtendedPriceBreak[] {
  if (!priceBreaks || priceBreaks.length === 0) return [];

  // Sort by quantity ascending
  const sorted = [...priceBreaks].sort((a, b) => a.quantity - b.quantity);
  const singleUnitPrice = basePrice ?? sorted[0]?.price ?? 0;

  return sorted.map((pb) => ({
    ...pb,
    unitPrice: pb.price,
    extendedPrice: pb.quantity * pb.price,
    savingsPercent:
      singleUnitPrice > 0
        ? Math.round(((singleUnitPrice - pb.price) / singleUnitPrice) * 100)
        : 0,
  }));
}

/**
 * Find best price break for a given quantity
 */
export function findBestPriceBreak(
  priceBreaks: PriceBreak[],
  quantity: number
): PriceBreak | null {
  if (!priceBreaks || priceBreaks.length === 0) return null;

  // Sort descending by quantity
  const sorted = [...priceBreaks].sort((a, b) => b.quantity - a.quantity);

  // Find the highest quantity break that is <= requested quantity
  for (const pb of sorted) {
    if (pb.quantity <= quantity) {
      return pb;
    }
  }

  // If no break found, return the lowest quantity break
  return sorted[sorted.length - 1] ?? null;
}

/**
 * Calculate total cost for a quantity
 */
export function calculateTotalCost(
  priceBreaks: PriceBreak[],
  quantity: number,
  fallbackPrice?: number
): { unitPrice: number; totalCost: number; currency: string } {
  const bestBreak = findBestPriceBreak(priceBreaks, quantity);
  const unitPrice = bestBreak?.price ?? fallbackPrice ?? 0;
  const currency = bestBreak?.currency ?? 'USD';

  return {
    unitPrice,
    totalCost: unitPrice * quantity,
    currency,
  };
}

/**
 * Format price with currency
 */
export function formatPrice(
  price: number | undefined | null,
  currency = 'USD',
  decimals = 2
): string {
  if (price === undefined || price === null) return '-';

  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  return formatter.format(price);
}

/**
 * Format lead time display
 */
export function formatLeadTime(days: number | undefined | null): string {
  if (days === undefined || days === null) return 'Unknown';
  if (days === 0) return 'In Stock';
  if (days === 1) return '1 day';
  if (days <= 7) return `${days} days`;
  if (days <= 14) return `${Math.ceil(days / 7)} weeks`;
  return `${Math.ceil(days / 7)} weeks`;
}

/**
 * Format stock quantity
 */
export function formatStock(quantity: number | undefined | null): string {
  if (quantity === undefined || quantity === null) return '-';
  if (quantity === 0) return 'Out of Stock';
  if (quantity >= 1000000) return `${(quantity / 1000000).toFixed(1)}M`;
  if (quantity >= 1000) return `${(quantity / 1000).toFixed(1)}K`;
  return quantity.toLocaleString();
}

/**
 * Compare suppliers and find best option
 * When comparing prices with mixed currencies, only compares within same currency
 * @param suppliers - Array of supplier data to compare
 * @param criteria - Comparison criteria (price, availability, lead_time)
 * @param preferredCurrency - When comparing prices with mixed currencies, prefer this currency (default: USD)
 */
export function findBestSupplier(
  suppliers: SupplierProductData[],
  criteria: 'price' | 'availability' | 'lead_time' = 'price',
  preferredCurrency = 'USD'
): SupplierProductData | null {
  if (!suppliers || suppliers.length === 0) return null;

  // Filter to only suppliers with stock
  const inStock = suppliers.filter(
    (s) => s.availability && s.availability > 0
  );

  if (inStock.length === 0) {
    // If nothing in stock, return by best criteria anyway
    return suppliers[0] ?? null;
  }

  switch (criteria) {
    case 'price': {
      // When comparing prices, only compare within same currency to avoid incorrect comparisons
      const pricedSuppliers = inStock.filter((s) => s.unit_price !== undefined && s.unit_price !== null);
      if (pricedSuppliers.length === 0) return inStock[0] ?? null;

      // Check if all priced suppliers have the same currency
      const currencies = [...new Set(pricedSuppliers.map((s) => s.currency ?? 'USD'))];

      if (currencies.length === 1) {
        // All same currency - simple comparison
        return pricedSuppliers.reduce((best, curr) =>
          (curr.unit_price ?? Infinity) < (best.unit_price ?? Infinity) ? curr : best
        );
      }

      // Mixed currencies - prefer the specified currency, then compare within that currency
      const preferredSuppliers = pricedSuppliers.filter((s) => (s.currency ?? 'USD') === preferredCurrency);

      if (preferredSuppliers.length > 0) {
        // Find best within preferred currency
        return preferredSuppliers.reduce((best, curr) =>
          (curr.unit_price ?? Infinity) < (best.unit_price ?? Infinity) ? curr : best
        );
      }

      // Fallback: use the first available currency and compare within that
      const firstCurrency = currencies[0];
      const sameCurrencySuppliers = pricedSuppliers.filter((s) => (s.currency ?? 'USD') === firstCurrency);
      return sameCurrencySuppliers.reduce((best, curr) =>
        (curr.unit_price ?? Infinity) < (best.unit_price ?? Infinity) ? curr : best
      );
    }
    case 'availability':
      return inStock.reduce((best, curr) =>
        (curr.availability ?? 0) > (best.availability ?? 0) ? curr : best
      );
    case 'lead_time':
      return inStock.reduce((best, curr) =>
        (curr.lead_time_days ?? Infinity) < (best.lead_time_days ?? Infinity)
          ? curr
          : best
      );
    default:
      return inStock[0] ?? null;
  }
}

/**
 * Find best supplier for a specific quantity considering stock and currency
 * @param suppliers - Array of supplier data
 * @param requiredQuantity - Required quantity to fulfill
 * @param preferredCurrency - Currency to prioritize when mixed currencies present
 */
export function findBestSupplierForQuantity(
  suppliers: SupplierProductData[],
  requiredQuantity: number,
  preferredCurrency = 'USD'
): SupplierProductData | null {
  if (!suppliers || suppliers.length === 0 || !requiredQuantity) return null;

  // Filter suppliers that have:
  // 1. Stock >= required quantity
  // 2. Valid pricing
  const eligibleSuppliers = suppliers.filter(
    (s) =>
      s.unit_price !== undefined &&
      s.unit_price !== null &&
      s.availability !== undefined &&
      s.availability >= requiredQuantity
  );

  if (eligibleSuppliers.length === 0) return null;

  // Check for mixed currencies
  const currencies = [...new Set(eligibleSuppliers.map((s) => s.currency ?? 'USD'))];

  if (currencies.length === 1) {
    // All same currency - find lowest price
    return eligibleSuppliers.reduce((best, curr) =>
      (curr.unit_price ?? Infinity) < (best.unit_price ?? Infinity) ? curr : best
    );
  }

  // Mixed currencies - prefer the specified currency
  const preferredSuppliers = eligibleSuppliers.filter((s) => (s.currency ?? 'USD') === preferredCurrency);

  if (preferredSuppliers.length > 0) {
    // Find best within preferred currency
    return preferredSuppliers.reduce((best, curr) =>
      (curr.unit_price ?? Infinity) < (best.unit_price ?? Infinity) ? curr : best
    );
  }

  // Fallback: use the first available currency and compare within that
  const firstCurrency = currencies[0];
  const sameCurrencySuppliers = eligibleSuppliers.filter((s) => (s.currency ?? 'USD') === firstCurrency);
  return sameCurrencySuppliers.reduce((best, curr) =>
    (curr.unit_price ?? Infinity) < (best.unit_price ?? Infinity) ? curr : best
  );
}
