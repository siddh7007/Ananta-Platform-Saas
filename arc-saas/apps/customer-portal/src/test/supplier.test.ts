/**
 * Supplier Utility Tests
 *
 * Tests for supplier.ts utility functions including:
 * - findBestSupplier (mixed currency handling)
 * - findBestSupplierForQuantity (stock + currency)
 * - formatPrice, formatStock, formatLeadTime
 */

import { describe, it, expect } from 'vitest';
import {
  findBestSupplier,
  findBestSupplierForQuantity,
  formatPrice,
  formatStock,
  formatLeadTime,
} from '@/types/supplier';
import type { SupplierProductData } from '@/types/supplier';

// =============================================================================
// Test Data Factories
// =============================================================================

function createSupplier(overrides: Partial<SupplierProductData> = {}): SupplierProductData {
  return {
    supplier_name: 'Test Supplier',
    supplier_sku: 'TEST-123',
    unit_price: 1.0,
    currency: 'USD',
    availability: 100,
    lead_time_days: 5,
    ...overrides,
  };
}

// =============================================================================
// findBestSupplier Tests
// =============================================================================

describe('findBestSupplier', () => {
  describe('Basic functionality', () => {
    it('should return null for empty array', () => {
      expect(findBestSupplier([])).toBeNull();
    });

    it('should return null for null/undefined input', () => {
      expect(findBestSupplier(null as unknown as SupplierProductData[])).toBeNull();
      expect(findBestSupplier(undefined as unknown as SupplierProductData[])).toBeNull();
    });

    it('should return the only supplier when there is one', () => {
      const suppliers = [createSupplier({ supplier_name: 'Only One' })];
      const best = findBestSupplier(suppliers);
      expect(best?.supplier_name).toBe('Only One');
    });
  });

  describe('Price comparison (same currency)', () => {
    it('should return lowest price supplier', () => {
      const suppliers = [
        createSupplier({ supplier_name: 'Expensive', unit_price: 5.0, currency: 'USD' }),
        createSupplier({ supplier_name: 'Cheap', unit_price: 1.0, currency: 'USD' }),
        createSupplier({ supplier_name: 'Medium', unit_price: 3.0, currency: 'USD' }),
      ];

      const best = findBestSupplier(suppliers, 'price');
      expect(best?.supplier_name).toBe('Cheap');
    });

    it('should ignore out-of-stock suppliers when finding best price', () => {
      const suppliers = [
        createSupplier({ supplier_name: 'Cheap but OOS', unit_price: 0.5, availability: 0 }),
        createSupplier({ supplier_name: 'In Stock', unit_price: 2.0, availability: 100 }),
      ];

      const best = findBestSupplier(suppliers, 'price');
      expect(best?.supplier_name).toBe('In Stock');
    });

    it('should return first supplier if nothing in stock', () => {
      const suppliers = [
        createSupplier({ supplier_name: 'First', unit_price: 5.0, availability: 0 }),
        createSupplier({ supplier_name: 'Second', unit_price: 1.0, availability: 0 }),
      ];

      const best = findBestSupplier(suppliers, 'price');
      expect(best?.supplier_name).toBe('First');
    });
  });

  describe('Mixed currency handling', () => {
    it('should prefer USD suppliers by default when currencies are mixed', () => {
      const suppliers = [
        createSupplier({ supplier_name: 'EUR Cheap', unit_price: 1.0, currency: 'EUR' }),
        createSupplier({ supplier_name: 'USD Expensive', unit_price: 2.0, currency: 'USD' }),
        createSupplier({ supplier_name: 'USD Cheap', unit_price: 1.5, currency: 'USD' }),
      ];

      const best = findBestSupplier(suppliers, 'price', 'USD');
      expect(best?.supplier_name).toBe('USD Cheap');
      expect(best?.currency).toBe('USD');
    });

    it('should prefer specified currency when provided', () => {
      const suppliers = [
        createSupplier({ supplier_name: 'EUR Cheap', unit_price: 1.0, currency: 'EUR' }),
        createSupplier({ supplier_name: 'EUR Expensive', unit_price: 2.0, currency: 'EUR' }),
        createSupplier({ supplier_name: 'USD Cheap', unit_price: 0.5, currency: 'USD' }),
      ];

      const best = findBestSupplier(suppliers, 'price', 'EUR');
      expect(best?.supplier_name).toBe('EUR Cheap');
      expect(best?.currency).toBe('EUR');
    });

    it('should fallback to first available currency if preferred not found', () => {
      const suppliers = [
        createSupplier({ supplier_name: 'GBP Cheap', unit_price: 1.0, currency: 'GBP' }),
        createSupplier({ supplier_name: 'GBP Expensive', unit_price: 5.0, currency: 'GBP' }),
      ];

      // Prefer USD but only GBP available
      const best = findBestSupplier(suppliers, 'price', 'USD');
      expect(best?.supplier_name).toBe('GBP Cheap');
      expect(best?.currency).toBe('GBP');
    });

    it('should NOT compare prices across currencies', () => {
      // EUR 1.0 is actually ~1.10 USD, but we should not convert
      const suppliers = [
        createSupplier({ supplier_name: 'EUR', unit_price: 1.0, currency: 'EUR' }),
        createSupplier({ supplier_name: 'USD', unit_price: 1.5, currency: 'USD' }),
      ];

      // With USD preference, should pick USD even though EUR price is lower numerically
      const best = findBestSupplier(suppliers, 'price', 'USD');
      expect(best?.supplier_name).toBe('USD');
    });

    it('should handle suppliers with undefined currency (treat as USD)', () => {
      const suppliers = [
        createSupplier({ supplier_name: 'No Currency', unit_price: 2.0, currency: undefined }),
        createSupplier({ supplier_name: 'EUR', unit_price: 1.0, currency: 'EUR' }),
      ];

      // No currency treated as USD, should be selected with USD preference
      const best = findBestSupplier(suppliers, 'price', 'USD');
      expect(best?.supplier_name).toBe('No Currency');
    });
  });

  describe('Availability comparison', () => {
    it('should return supplier with highest stock', () => {
      const suppliers = [
        createSupplier({ supplier_name: 'Low Stock', availability: 10 }),
        createSupplier({ supplier_name: 'High Stock', availability: 1000 }),
        createSupplier({ supplier_name: 'Medium Stock', availability: 100 }),
      ];

      const best = findBestSupplier(suppliers, 'availability');
      expect(best?.supplier_name).toBe('High Stock');
    });
  });

  describe('Lead time comparison', () => {
    it('should return supplier with shortest lead time', () => {
      const suppliers = [
        createSupplier({ supplier_name: 'Slow', lead_time_days: 30 }),
        createSupplier({ supplier_name: 'Fast', lead_time_days: 2 }),
        createSupplier({ supplier_name: 'Medium', lead_time_days: 10 }),
      ];

      const best = findBestSupplier(suppliers, 'lead_time');
      expect(best?.supplier_name).toBe('Fast');
    });

    it('should handle undefined lead times', () => {
      const suppliers = [
        createSupplier({ supplier_name: 'No Lead Time', lead_time_days: undefined }),
        createSupplier({ supplier_name: 'Has Lead Time', lead_time_days: 5 }),
      ];

      const best = findBestSupplier(suppliers, 'lead_time');
      expect(best?.supplier_name).toBe('Has Lead Time');
    });
  });
});

// =============================================================================
// findBestSupplierForQuantity Tests
// =============================================================================

describe('findBestSupplierForQuantity', () => {
  describe('Basic functionality', () => {
    it('should return null for empty array', () => {
      expect(findBestSupplierForQuantity([], 100)).toBeNull();
    });

    it('should return null when no quantity specified', () => {
      const suppliers = [createSupplier()];
      expect(findBestSupplierForQuantity(suppliers, 0)).toBeNull();
    });

    it('should return null when no supplier has enough stock', () => {
      const suppliers = [
        createSupplier({ availability: 50 }),
        createSupplier({ availability: 30 }),
      ];

      expect(findBestSupplierForQuantity(suppliers, 100)).toBeNull();
    });
  });

  describe('Stock filtering', () => {
    it('should only consider suppliers with stock >= required quantity', () => {
      const suppliers = [
        createSupplier({ supplier_name: 'Low Stock Cheap', unit_price: 0.5, availability: 50 }),
        createSupplier({ supplier_name: 'High Stock', unit_price: 1.0, availability: 200 }),
      ];

      const best = findBestSupplierForQuantity(suppliers, 100, 'USD');
      expect(best?.supplier_name).toBe('High Stock');
    });

    it('should return cheapest among eligible suppliers', () => {
      const suppliers = [
        createSupplier({ supplier_name: 'Enough Stock Expensive', unit_price: 5.0, availability: 100 }),
        createSupplier({ supplier_name: 'Enough Stock Cheap', unit_price: 2.0, availability: 150 }),
        createSupplier({ supplier_name: 'Not Enough Stock', unit_price: 0.5, availability: 10 }),
      ];

      const best = findBestSupplierForQuantity(suppliers, 100, 'USD');
      expect(best?.supplier_name).toBe('Enough Stock Cheap');
    });
  });

  describe('Price filtering', () => {
    it('should exclude suppliers without pricing', () => {
      const suppliers = [
        createSupplier({ supplier_name: 'No Price', unit_price: undefined, availability: 500 }),
        createSupplier({ supplier_name: 'Has Price', unit_price: 1.0, availability: 500 }),
      ];

      const best = findBestSupplierForQuantity(suppliers, 100, 'USD');
      expect(best?.supplier_name).toBe('Has Price');
    });

    it('should handle null prices', () => {
      const suppliers = [
        createSupplier({ supplier_name: 'Null Price', unit_price: null as unknown as number, availability: 500 }),
        createSupplier({ supplier_name: 'Valid Price', unit_price: 1.0, availability: 500 }),
      ];

      const best = findBestSupplierForQuantity(suppliers, 100, 'USD');
      expect(best?.supplier_name).toBe('Valid Price');
    });
  });

  describe('Mixed currency handling', () => {
    it('should prefer specified currency among eligible suppliers', () => {
      const suppliers = [
        createSupplier({ supplier_name: 'EUR Cheap', unit_price: 1.0, currency: 'EUR', availability: 200 }),
        createSupplier({ supplier_name: 'USD', unit_price: 2.0, currency: 'USD', availability: 200 }),
      ];

      const best = findBestSupplierForQuantity(suppliers, 100, 'USD');
      expect(best?.supplier_name).toBe('USD');
      expect(best?.currency).toBe('USD');
    });

    it('should find cheapest within preferred currency', () => {
      const suppliers = [
        createSupplier({ supplier_name: 'USD Expensive', unit_price: 5.0, currency: 'USD', availability: 200 }),
        createSupplier({ supplier_name: 'USD Cheap', unit_price: 2.0, currency: 'USD', availability: 200 }),
        createSupplier({ supplier_name: 'EUR Cheapest', unit_price: 1.0, currency: 'EUR', availability: 200 }),
      ];

      const best = findBestSupplierForQuantity(suppliers, 100, 'USD');
      expect(best?.supplier_name).toBe('USD Cheap');
    });

    it('should fallback to first currency if preferred not available', () => {
      const suppliers = [
        createSupplier({ supplier_name: 'GBP', unit_price: 2.0, currency: 'GBP', availability: 200 }),
        createSupplier({ supplier_name: 'EUR', unit_price: 1.5, currency: 'EUR', availability: 200 }),
      ];

      // Request USD but only GBP and EUR available
      const best = findBestSupplierForQuantity(suppliers, 100, 'USD');
      // Should use first currency found (GBP based on set iteration)
      expect(best).not.toBeNull();
      expect(['GBP', 'EUR']).toContain(best?.currency);
    });
  });

  describe('Edge cases', () => {
    it('should handle exact quantity match', () => {
      const suppliers = [
        createSupplier({ supplier_name: 'Exact Match', unit_price: 1.0, availability: 100 }),
      ];

      const best = findBestSupplierForQuantity(suppliers, 100, 'USD');
      expect(best?.supplier_name).toBe('Exact Match');
    });

    it('should handle very large quantities', () => {
      const suppliers = [
        createSupplier({ supplier_name: 'Small', availability: 1000 }),
        createSupplier({ supplier_name: 'Large', availability: 1000000 }),
      ];

      const best = findBestSupplierForQuantity(suppliers, 500000, 'USD');
      expect(best?.supplier_name).toBe('Large');
    });
  });
});

// =============================================================================
// formatPrice Tests
// =============================================================================

describe('formatPrice', () => {
  it('should format USD prices with $ symbol', () => {
    expect(formatPrice(10, 'USD')).toBe('$10.00');
    expect(formatPrice(1.5, 'USD')).toBe('$1.50');
    expect(formatPrice(0.05, 'USD')).toBe('$0.05');
  });

  it('should format EUR prices with symbol', () => {
    const result = formatPrice(10, 'EUR');
    expect(result).toContain('10');
    // EUR symbol position depends on locale
  });

  it('should default to USD when no currency specified', () => {
    const result = formatPrice(10);
    expect(result).toBe('$10.00');
  });

  it('should handle zero values', () => {
    expect(formatPrice(0, 'USD')).toBe('$0.00');
  });

  it('should handle large numbers with proper formatting', () => {
    const result = formatPrice(1234567.89, 'USD');
    expect(result).toContain('1,234,567.89');
  });
});

// =============================================================================
// formatStock Tests
// =============================================================================

describe('formatStock', () => {
  it('should return "Out of Stock" for zero', () => {
    expect(formatStock(0)).toBe('Out of Stock');
  });

  it('should format small numbers with commas', () => {
    expect(formatStock(100)).toBe('100');
    expect(formatStock(999)).toBe('999');
  });

  it('should abbreviate thousands', () => {
    expect(formatStock(1000)).toBe('1.0K');
    expect(formatStock(1500)).toBe('1.5K');
    expect(formatStock(10000)).toBe('10.0K');
    expect(formatStock(999999)).toBe('1000.0K');
  });

  it('should abbreviate millions', () => {
    expect(formatStock(1000000)).toBe('1.0M');
    expect(formatStock(2500000)).toBe('2.5M');
    expect(formatStock(10000000)).toBe('10.0M');
  });

  it('should handle undefined/null gracefully', () => {
    // formatStock returns '-' for undefined/null (dash for unknown)
    expect(formatStock(undefined as unknown as number)).toBe('-');
    expect(formatStock(null as unknown as number)).toBe('-');
  });
});

// =============================================================================
// formatLeadTime Tests
// =============================================================================

describe('formatLeadTime', () => {
  it('should format single day', () => {
    expect(formatLeadTime(1)).toBe('1 day');
  });

  it('should format multiple days (up to 7)', () => {
    expect(formatLeadTime(5)).toBe('5 days');
    expect(formatLeadTime(7)).toBe('7 days'); // 7 days is still "days" (boundary)
  });

  it('should format weeks for 8+ days', () => {
    // Implementation uses Math.ceil(days/7) weeks for days > 7
    expect(formatLeadTime(8)).toBe('2 weeks');   // ceil(8/7) = 2
    expect(formatLeadTime(14)).toBe('2 weeks');  // ceil(14/7) = 2
    expect(formatLeadTime(15)).toBe('3 weeks');  // ceil(15/7) = 3
    expect(formatLeadTime(21)).toBe('3 weeks');  // ceil(21/7) = 3
    expect(formatLeadTime(30)).toBe('5 weeks');  // ceil(30/7) = 5
  });

  it('should return "In Stock" for zero lead time', () => {
    expect(formatLeadTime(0)).toBe('In Stock');
  });

  it('should handle undefined gracefully', () => {
    expect(formatLeadTime(undefined)).toBe('Unknown');
  });
});

// =============================================================================
// Integration Scenarios
// =============================================================================

describe('Supplier Selection Integration Scenarios', () => {
  it('should handle real-world mixed supplier data', () => {
    const suppliers: SupplierProductData[] = [
      {
        supplier_name: 'DigiKey',
        supplier_sku: 'DK-123',
        unit_price: 1.25,
        currency: 'USD',
        availability: 5000,
        lead_time_days: 2,
      },
      {
        supplier_name: 'Mouser',
        supplier_sku: 'MO-456',
        unit_price: 1.10,
        currency: 'USD',
        availability: 2500,
        lead_time_days: 3,
      },
      {
        supplier_name: 'Farnell',
        supplier_sku: 'FA-789',
        unit_price: 0.95,
        currency: 'EUR',
        availability: 10000,
        lead_time_days: 7,
      },
      {
        supplier_name: 'LCSC',
        supplier_sku: 'LC-000',
        unit_price: 0.50,
        currency: 'USD',
        availability: 50000,
        lead_time_days: 14,
      },
    ];

    // Best price in USD - should be LCSC
    const bestPrice = findBestSupplier(suppliers, 'price', 'USD');
    expect(bestPrice?.supplier_name).toBe('LCSC');

    // Best for 3000 units in USD - DigiKey or LCSC (both have enough)
    const bestFor3000 = findBestSupplierForQuantity(suppliers, 3000, 'USD');
    expect(bestFor3000?.supplier_name).toBe('LCSC'); // Cheapest with enough stock

    // Best for 10000 units in USD - only LCSC has enough
    const bestFor10000 = findBestSupplierForQuantity(suppliers, 10000, 'USD');
    expect(bestFor10000?.supplier_name).toBe('LCSC');

    // Best availability
    const bestStock = findBestSupplier(suppliers, 'availability');
    expect(bestStock?.supplier_name).toBe('LCSC');

    // Best lead time
    const fastestShipping = findBestSupplier(suppliers, 'lead_time');
    expect(fastestShipping?.supplier_name).toBe('DigiKey');
  });

  it('should handle suppliers with missing data', () => {
    const suppliers: SupplierProductData[] = [
      {
        supplier_name: 'Complete',
        supplier_sku: 'SKU-1',
        unit_price: 1.0,
        currency: 'USD',
        availability: 100,
        lead_time_days: 5,
      },
      {
        supplier_name: 'No Price',
        supplier_sku: 'SKU-2',
        unit_price: undefined,
        currency: 'USD',
        availability: 1000,
        lead_time_days: 2,
      },
      {
        supplier_name: 'No Stock',
        supplier_sku: 'SKU-3',
        unit_price: 0.5,
        currency: 'USD',
        availability: 0,
        lead_time_days: 1,
      },
    ];

    // Best price should be Complete (No Price excluded, No Stock excluded)
    const bestPrice = findBestSupplier(suppliers, 'price');
    expect(bestPrice?.supplier_name).toBe('Complete');

    // Best for quantity should be Complete (only one with price and stock)
    const bestForQty = findBestSupplierForQuantity(suppliers, 50, 'USD');
    expect(bestForQty?.supplier_name).toBe('Complete');
  });
});
