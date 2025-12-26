/**
 * Component type mapping tests
 * Verifies CNS API responses map correctly to TypeScript interfaces
 */

import { describe, it, expect } from 'vitest';
import type { Component, PriceBreak, LifecycleStatus } from '../types/component';
import {
  LIFECYCLE_CONFIG,
  getLifecycleColor,
  getComplianceStatus,
} from '../types/component';

describe('Component type mapping', () => {
  describe('CNS API response mapping', () => {
    it('should map a complete CNS component_catalog response', () => {
      // Simulated CNS API response (snake_case from catalog.py CatalogComponent.to_dict())
      const cnsResponse = {
        id: 'uuid-12345',
        mpn: 'LM358DR',
        manufacturer: 'Texas Instruments',
        normalized_mpn: 'LM358DR',
        normalized_manufacturer: 'Texas Instruments',
        description: 'Dual Operational Amplifier',
        category: 'Integrated Circuits',
        subcategory: 'Amplifiers',
        category_path: 'ICs/Amplifiers/Op-Amps',
        product_family: 'LM358',
        product_series: 'LM3xx',
        datasheet_url: 'https://www.ti.com/lit/ds/symlink/lm358.pdf',
        image_url: 'https://www.ti.com/images/lm358.jpg',
        lifecycle_status: 'active',
        rohs_compliant: true,
        reach_compliant: true,
        halogen_free: false,
        aec_qualified: true,
        eccn_code: 'EAR99',
        package: 'SOIC-8',
        unit_price: 0.45,
        currency: 'USD',
        price_breaks: [
          { quantity: 1, price: 0.45 },
          { quantity: 100, price: 0.35 },
          { quantity: 1000, price: 0.25 },
        ],
        moq: 1,
        lead_time_days: 7,
        stock_status: 'In Stock',
        supplier_data: { mouser: { sku: '595-LM358DR' } },
        specifications: { bandwidth: '1MHz', gain: '100dB' },
        extracted_specs: { voltage: '3-32V' },
        quality_score: 85,
        quality_metadata: { source_count: 3 },
        ai_metadata: { confidence: 0.95 },
        enrichment_source: 'api_import',
        api_source: 'mouser',
        created_at: '2024-01-15T10:30:00Z',
        updated_at: '2024-06-20T14:45:00Z',
      };

      // Type assertion - this should compile without errors
      const component: Component = cnsResponse as Component;

      // Verify all fields map correctly
      expect(component.id).toBe('uuid-12345');
      expect(component.mpn).toBe('LM358DR');
      expect(component.manufacturer).toBe('Texas Instruments');
      expect(component.lifecycle_status).toBe('active');
      expect(component.rohs_compliant).toBe(true);
      expect(component.reach_compliant).toBe(true);
      expect(component.halogen_free).toBe(false);
      expect(component.aec_qualified).toBe(true);
      expect(component.package).toBe('SOIC-8');
      expect(component.unit_price).toBe(0.45);
      expect(component.price_breaks).toHaveLength(3);
      expect(component.quality_score).toBe(85);
      expect(component.api_source).toBe('mouser');
    });

    it('should handle minimal CNS response (required fields only)', () => {
      const minimalResponse = {
        id: 'uuid-minimal',
        mpn: 'RC0603FR-0710KL',
        manufacturer: 'YAGEO',
      };

      const component: Component = minimalResponse;

      expect(component.id).toBe('uuid-minimal');
      expect(component.mpn).toBe('RC0603FR-0710KL');
      expect(component.manufacturer).toBe('YAGEO');
      expect(component.lifecycle_status).toBeUndefined();
      expect(component.rohs_compliant).toBeUndefined();
    });

    it('should handle price_breaks JSONB array', () => {
      const priceBreaks: PriceBreak[] = [
        { quantity: 1, price: 1.25 },
        { quantity: 10, price: 1.0 },
        { quantity: 100, price: 0.75, currency: 'EUR' },
      ];

      expect(priceBreaks[0].quantity).toBe(1);
      expect(priceBreaks[0].price).toBe(1.25);
      expect(priceBreaks[2].currency).toBe('EUR');
    });
  });

  describe('Lifecycle status values', () => {
    const validStatuses: LifecycleStatus[] = ['active', 'nrnd', 'obsolete', 'preview', 'unknown'];

    it('should have config for all valid lifecycle statuses', () => {
      validStatuses.forEach((status) => {
        expect(LIFECYCLE_CONFIG[status]).toBeDefined();
        expect(LIFECYCLE_CONFIG[status].label).toBeTruthy();
        expect(LIFECYCLE_CONFIG[status].color).toBeTruthy();
        expect(LIFECYCLE_CONFIG[status].description).toBeTruthy();
      });
    });

    it('should return correct colors for each status', () => {
      expect(getLifecycleColor('active')).toBe('bg-green-100 text-green-700');
      expect(getLifecycleColor('nrnd')).toBe('bg-yellow-100 text-yellow-700');
      expect(getLifecycleColor('obsolete')).toBe('bg-red-100 text-red-700');
      expect(getLifecycleColor('preview')).toBe('bg-blue-100 text-blue-700');
      expect(getLifecycleColor('unknown')).toBe('bg-gray-100 text-gray-700');
    });

    it('should handle undefined/null lifecycle status', () => {
      expect(getLifecycleColor(undefined)).toBe('bg-gray-100 text-gray-700');
    });

    it('should have correct labels from CNS schema', () => {
      expect(LIFECYCLE_CONFIG.active.label).toBe('Active');
      expect(LIFECYCLE_CONFIG.nrnd.label).toBe('NRND');
      expect(LIFECYCLE_CONFIG.obsolete.label).toBe('Obsolete');
      expect(LIFECYCLE_CONFIG.preview.label).toBe('Preview');
      expect(LIFECYCLE_CONFIG.unknown.label).toBe('Unknown');
    });
  });

  describe('Compliance status handling', () => {
    it('should handle boolean true (from DB)', () => {
      const result = getComplianceStatus(true);
      expect(result.compliant).toBe(true);
      expect(result.label).toBe('Compliant');
    });

    it('should handle boolean false (from DB)', () => {
      const result = getComplianceStatus(false);
      expect(result.compliant).toBe(false);
      expect(result.label).toBe('Non-Compliant');
    });

    it('should handle null/undefined', () => {
      expect(getComplianceStatus(null).compliant).toBeNull();
      expect(getComplianceStatus(null).label).toBe('Unknown');
      expect(getComplianceStatus(undefined).compliant).toBeNull();
      expect(getComplianceStatus(undefined).label).toBe('Unknown');
    });

    it('should handle legacy string "yes"/"no" values', () => {
      expect(getComplianceStatus('yes').compliant).toBe(true);
      expect(getComplianceStatus('Yes').compliant).toBe(true);
      expect(getComplianceStatus('no').compliant).toBe(false);
      expect(getComplianceStatus('No').compliant).toBe(false);
    });

    it('should handle legacy "compliant"/"non-compliant" strings', () => {
      expect(getComplianceStatus('Compliant').compliant).toBe(true);
      expect(getComplianceStatus('RoHS Compliant').compliant).toBe(true);
      expect(getComplianceStatus('Non-Compliant').compliant).toBe(false);
      expect(getComplianceStatus('non compliant').compliant).toBe(false);
    });

    it('should handle "true"/"false" string values', () => {
      expect(getComplianceStatus('true').compliant).toBe(true);
      expect(getComplianceStatus('false').compliant).toBe(false);
    });

    it('should return unknown for unrecognized strings', () => {
      const result = getComplianceStatus('pending review');
      expect(result.compliant).toBeNull();
      expect(result.label).toBe('pending review');
    });
  });

  describe('Component field mapping validation', () => {
    it('should correctly type compliance fields as booleans', () => {
      const component: Component = {
        id: '1',
        mpn: 'TEST',
        manufacturer: 'Test Co',
        rohs_compliant: true,
        reach_compliant: false,
        halogen_free: true,
        aec_qualified: false,
      };

      // TypeScript should enforce these as boolean | undefined
      expect(typeof component.rohs_compliant).toBe('boolean');
      expect(typeof component.reach_compliant).toBe('boolean');
      expect(typeof component.halogen_free).toBe('boolean');
      expect(typeof component.aec_qualified).toBe('boolean');
    });

    it('should correctly type pricing fields', () => {
      const component: Component = {
        id: '1',
        mpn: 'TEST',
        manufacturer: 'Test Co',
        unit_price: 1.234,
        currency: 'USD',
        moq: 100,
        lead_time_days: 14,
        stock_status: 'In Stock',
        price_breaks: [
          { quantity: 1, price: 1.5 },
          { quantity: 100, price: 1.2 },
        ],
      };

      expect(typeof component.unit_price).toBe('number');
      expect(typeof component.moq).toBe('number');
      expect(typeof component.lead_time_days).toBe('number');
      expect(Array.isArray(component.price_breaks)).toBe(true);
    });

    it('should correctly type JSONB fields as Record<string, unknown>', () => {
      const component: Component = {
        id: '1',
        mpn: 'TEST',
        manufacturer: 'Test Co',
        specifications: { resistance: '10k', tolerance: '1%' },
        supplier_data: { mouser: { sku: '123' }, digikey: { sku: '456' } },
        quality_metadata: { sources: ['api', 'manual'] },
        ai_metadata: { confidence: 0.95, model: 'gpt-4' },
      };

      expect(typeof component.specifications).toBe('object');
      expect(typeof component.supplier_data).toBe('object');
    });
  });
});
