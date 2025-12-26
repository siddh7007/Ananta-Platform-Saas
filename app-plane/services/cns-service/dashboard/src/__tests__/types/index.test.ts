import { describe, it, expect } from 'vitest';
import type {
  ComponentBase,
  EnrichedComponent,
  PriceBreak,
  EnrichmentStatus,
  EnrichmentSource,
  EnrichmentSummary,
  BOMLineItem,
} from '../../types';

describe('Type Definitions', () => {
  describe('ComponentBase', () => {
    it('should accept valid component base structure', () => {
      const component: ComponentBase = {
        id: 'comp-123',
        mpn: 'ABC-123',
        manufacturer: 'Test Manufacturer',
      };

      expect(component.id).toBeDefined();
      expect(component.mpn).toBeDefined();
      expect(component.manufacturer).toBeDefined();
    });

    it('should allow optional fields', () => {
      const component: ComponentBase = {
        id: 'comp-123',
        mpn: 'ABC-123',
        manufacturer: 'Test Manufacturer',
        category: 'Resistors',
        description: 'Test component',
      };

      expect(component.category).toBe('Resistors');
      expect(component.description).toBe('Test component');
    });
  });

  describe('EnrichedComponent', () => {
    it('should extend ComponentBase with enrichment data', () => {
      const component: EnrichedComponent = {
        id: 'comp-123',
        mpn: 'ABC-123',
        manufacturer: 'Test Manufacturer',
        datasheet_url: 'https://example.com/datasheet.pdf',
        quality_score: 95,
        enrichment_source: 'mouser',
      };

      expect(component.datasheet_url).toBeDefined();
      expect(component.quality_score).toBe(95);
    });

    it('should allow all optional enrichment fields', () => {
      const component: EnrichedComponent = {
        id: 'comp-123',
        mpn: 'ABC-123',
        manufacturer: 'Test Manufacturer',
        lifecycle: 'Active',
        rohs: 'Compliant',
        reach: 'Compliant',
        stock_status: 'In Stock',
        stock_quantity: 1000,
        lead_time_days: 7,
        unit_price: 1.50,
        currency: 'USD',
        moq: 100,
        aec_qualified: true,
        halogen_free: false,
      };

      expect(component.lifecycle).toBe('Active');
      expect(component.stock_quantity).toBe(1000);
    });
  });

  describe('PriceBreak', () => {
    it('should define price break structure', () => {
      const priceBreak: PriceBreak = {
        quantity: 100,
        price: 1.50,
        currency: 'USD',
      };

      expect(priceBreak.quantity).toBe(100);
      expect(priceBreak.price).toBe(1.50);
    });

    it('should allow array of price breaks', () => {
      const pricing: PriceBreak[] = [
        { quantity: 1, price: 2.00 },
        { quantity: 100, price: 1.50 },
        { quantity: 1000, price: 1.00 },
      ];

      expect(pricing).toHaveLength(3);
      expect(pricing[0].quantity).toBe(1);
    });
  });

  describe('EnrichmentStatus', () => {
    it('should accept valid status values', () => {
      const statuses: EnrichmentStatus[] = [
        'pending',
        'enriching',
        'completed',
        'failed',
        'unknown',
      ];

      statuses.forEach(status => {
        expect(['pending', 'enriching', 'completed', 'failed', 'unknown']).toContain(status);
      });
    });
  });

  describe('EnrichmentSource', () => {
    it('should accept valid source values', () => {
      const sources: EnrichmentSource[] = ['customer', 'staff', 'unknown'];

      sources.forEach(source => {
        expect(['customer', 'staff', 'unknown']).toContain(source);
      });
    });
  });

  describe('EnrichmentSummary', () => {
    it('should define complete enrichment summary structure', () => {
      const summary: EnrichmentSummary = {
        bom_id: 'bom-123',
        bom_name: 'Test BOM',
        bom_filename: 'test.csv',
        source: 'customer',
        tenant_id: 'tenant-123',
        status: 'completed',
        total_items: 100,
        enriched_items: 95,
        failed_items: 5,
        percent_complete: 95,
        started_at: '2024-01-01T00:00:00Z',
        completed_at: '2024-01-01T01:00:00Z',
      };

      expect(summary.bom_id).toBe('bom-123');
      expect(summary.total_items).toBe(100);
      expect(summary.percent_complete).toBe(95);
    });

    it('should allow optional fields', () => {
      const summary: EnrichmentSummary = {
        bom_id: 'bom-123',
        source: 'staff',
        tenant_id: 'tenant-123',
        status: 'pending',
        total_items: 50,
        enriched_items: 0,
        failed_items: 0,
        percent_complete: 0,
        started_at: '2024-01-01T00:00:00Z',
      };

      expect(summary.completed_at).toBeUndefined();
      expect(summary.workflow_id).toBeUndefined();
    });
  });

  describe('BOMLineItem', () => {
    it('should define BOM line item structure', () => {
      const lineItem: BOMLineItem = {
        id: 'line-123',
        bom_id: 'bom-123',
        line_number: 1,
        manufacturer_part_number: 'ABC-123',
        manufacturer: 'Test Mfg',
        quantity: 10,
        reference_designator: 'R1',
      };

      expect(lineItem.line_number).toBe(1);
      expect(lineItem.manufacturer_part_number).toBe('ABC-123');
      expect(lineItem.quantity).toBe(10);
    });

    it('should allow optional fields', () => {
      const lineItem: BOMLineItem = {
        id: 'line-123',
        bom_id: 'bom-123',
        line_number: 1,
        manufacturer_part_number: 'ABC-123',
        quantity: 10,
      };

      expect(lineItem.manufacturer).toBeUndefined();
      expect(lineItem.reference_designator).toBeUndefined();
    });
  });

  describe('Type compatibility', () => {
    it('should allow EnrichedComponent where ComponentBase is expected', () => {
      const enriched: EnrichedComponent = {
        id: 'comp-123',
        mpn: 'ABC-123',
        manufacturer: 'Test',
        quality_score: 90,
      };

      const base: ComponentBase = enriched;
      expect(base.id).toBe('comp-123');
    });

    it('should handle pricing arrays in enriched components', () => {
      const component: EnrichedComponent = {
        id: 'comp-123',
        mpn: 'ABC-123',
        manufacturer: 'Test',
        pricing: [
          { quantity: 1, price: 2.00 },
          { quantity: 100, price: 1.50 },
        ],
      };

      expect(component.pricing).toHaveLength(2);
      expect(component.pricing![0].price).toBe(2.00);
    });
  });
});
