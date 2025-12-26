/**
 * Unit tests for Column Mapping Service
 * @module test/column-mapping
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  analyzeColumns,
  getMappingTemplates,
  createMappingTemplate,
  applyTemplate,
  type ColumnAnalysisRequest,
  type CreateMappingTemplateRequest,
} from '../services/column-mapping.service';

describe('Column Mapping Service', () => {
  describe('analyzeColumns', () => {
    it('should detect "Part Number" as MPN with 100% confidence', async () => {
      const request: ColumnAnalysisRequest = {
        headers: ['Part Number'],
        sampleRows: [{ 'Part Number': 'ABC123' }],
        tenantId: 'tenant-1',
      };

      const response = await analyzeColumns(request);

      expect(response.suggestions).toHaveLength(1);
      expect(response.suggestions[0]).toMatchObject({
        sourceColumn: 'Part Number',
        suggestedTarget: 'manufacturer_part_number',
        confidence: 100,
        matchReason: 'exact_match',
      });
    });

    it('should detect "Qty" as quantity with 100% confidence', async () => {
      const request: ColumnAnalysisRequest = {
        headers: ['Qty'],
        sampleRows: [{ Qty: '10' }],
        tenantId: 'tenant-1',
      };

      const response = await analyzeColumns(request);

      expect(response.suggestions).toHaveLength(1);
      expect(response.suggestions[0]).toMatchObject({
        sourceColumn: 'Qty',
        suggestedTarget: 'quantity',
        confidence: 100,
        matchReason: 'exact_match',
      });
    });

    it('should fuzzy match "Mfr Part No" as MPN with 90%+ confidence', async () => {
      const request: ColumnAnalysisRequest = {
        headers: ['Mfr Part No'],
        sampleRows: [{ 'Mfr Part No': 'XYZ789' }],
        tenantId: 'tenant-1',
      };

      const response = await analyzeColumns(request);

      expect(response.suggestions).toHaveLength(1);
      expect(response.suggestions[0]).toMatchObject({
        sourceColumn: 'Mfr Part No',
        suggestedTarget: 'manufacturer_part_number',
        matchReason: 'fuzzy_match',
      });
      expect(response.suggestions[0].confidence).toBeGreaterThanOrEqual(80);
    });

    it('should analyze sample values for pattern match', async () => {
      const request: ColumnAnalysisRequest = {
        headers: ['Column A'],
        sampleRows: [
          { 'Column A': 'R1' },
          { 'Column A': 'R2' },
          { 'Column A': 'C1' },
          { 'Column A': 'C2' },
        ],
        tenantId: 'tenant-1',
      };

      const response = await analyzeColumns(request);

      expect(response.suggestions).toHaveLength(1);
      expect(response.suggestions[0]).toMatchObject({
        sourceColumn: 'Column A',
        suggestedTarget: 'reference_designator',
        matchReason: 'sample_analysis',
      });
      expect(response.suggestions[0].confidence).toBeGreaterThanOrEqual(60);
    });

    it('should suggest "ignore" for unknown columns', async () => {
      const request: ColumnAnalysisRequest = {
        headers: ['Random Column XYZ'],
        sampleRows: [{ 'Random Column XYZ': 'some value' }],
        tenantId: 'tenant-1',
      };

      const response = await analyzeColumns(request);

      expect(response.suggestions).toHaveLength(1);
      expect(response.suggestions[0].suggestedTarget).toBe('ignore');
    });

    it('should handle case-insensitive matching', async () => {
      const request: ColumnAnalysisRequest = {
        headers: ['PART NUMBER', 'manufacturer', 'QTY'],
        sampleRows: [
          {
            'PART NUMBER': 'ABC123',
            manufacturer: 'Acme Corp',
            QTY: '5',
          },
        ],
        tenantId: 'tenant-1',
      };

      const response = await analyzeColumns(request);

      expect(response.suggestions).toHaveLength(3);
      expect(response.suggestions[0].suggestedTarget).toBe('manufacturer_part_number');
      expect(response.suggestions[1].suggestedTarget).toBe('manufacturer');
      expect(response.suggestions[2].suggestedTarget).toBe('quantity');
    });

    it('should handle special characters in headers', async () => {
      const request: ColumnAnalysisRequest = {
        headers: ['Part-Number', 'Ref.Des.', 'Qty (Units)'],
        sampleRows: [
          {
            'Part-Number': 'ABC123',
            'Ref.Des.': 'R1',
            'Qty (Units)': '10',
          },
        ],
        tenantId: 'tenant-1',
      };

      const response = await analyzeColumns(request);

      expect(response.suggestions).toHaveLength(3);
      expect(response.suggestions[0].suggestedTarget).toBe('manufacturer_part_number');
      expect(response.suggestions[1].suggestedTarget).toBe('reference_designator');
      expect(response.suggestions[2].suggestedTarget).toBe('quantity');
    });

    it('should provide alternative suggestions', async () => {
      const request: ColumnAnalysisRequest = {
        headers: ['Part'],
        sampleRows: [{ Part: 'ABC123' }],
        tenantId: 'tenant-1',
      };

      const response = await analyzeColumns(request);

      expect(response.suggestions).toHaveLength(1);
      expect(response.suggestions[0].alternatives).toBeDefined();
      expect(Array.isArray(response.suggestions[0].alternatives)).toBe(true);
    });
  });

  describe('getMappingTemplates', () => {
    it('should return templates for tenant', async () => {
      const templates = await getMappingTemplates('tenant-1');

      expect(Array.isArray(templates)).toBe(true);
    });
  });

  describe('createMappingTemplate', () => {
    it('should create a new template', async () => {
      const request: CreateMappingTemplateRequest = {
        name: 'Test Template',
        description: 'Test description',
        tenantId: 'tenant-1',
        createdBy: 'user-1',
        isShared: false,
        mappings: [
          { pattern: 'partnumber', target: 'manufacturer_part_number' },
          { pattern: 'qty', target: 'quantity' },
        ],
      };

      const template = await createMappingTemplate(request);

      expect(template).toBeDefined();
      expect(template.id).toBeDefined();
      expect(template.name).toBe('Test Template');
      expect(template.mappings).toHaveLength(2);
    });
  });

  describe('applyTemplate', () => {
    it('should apply template mappings correctly', async () => {
      // First create a template
      const createRequest: CreateMappingTemplateRequest = {
        name: 'Standard Template',
        tenantId: 'tenant-1',
        createdBy: 'user-1',
        isShared: false,
        mappings: [
          { pattern: 'partnumber', target: 'manufacturer_part_number' },
          { pattern: 'manufacturer', target: 'manufacturer' },
          { pattern: 'qty', target: 'quantity' },
        ],
      };

      const template = await createMappingTemplate(createRequest);

      // Apply template
      const headers = ['Part Number', 'Manufacturer', 'Qty'];
      const suggestions = await applyTemplate(template.id, headers);

      expect(suggestions).toHaveLength(3);
      expect(suggestions[0].suggestedTarget).toBe('manufacturer_part_number');
      expect(suggestions[1].suggestedTarget).toBe('manufacturer');
      expect(suggestions[2].suggestedTarget).toBe('quantity');
    });

    it('should suggest "ignore" for unmapped columns', async () => {
      const createRequest: CreateMappingTemplateRequest = {
        name: 'Partial Template',
        tenantId: 'tenant-1',
        createdBy: 'user-1',
        isShared: false,
        mappings: [{ pattern: 'partnumber', target: 'manufacturer_part_number' }],
      };

      const template = await createMappingTemplate(createRequest);

      const headers = ['Part Number', 'Unknown Column'];
      const suggestions = await applyTemplate(template.id, headers);

      expect(suggestions).toHaveLength(2);
      expect(suggestions[0].suggestedTarget).toBe('manufacturer_part_number');
      expect(suggestions[1].suggestedTarget).toBe('ignore');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty headers array', async () => {
      const request: ColumnAnalysisRequest = {
        headers: [],
        sampleRows: [],
        tenantId: 'tenant-1',
      };

      const response = await analyzeColumns(request);

      expect(response.suggestions).toHaveLength(0);
    });

    it('should handle missing sample data', async () => {
      const request: ColumnAnalysisRequest = {
        headers: ['Part Number'],
        sampleRows: [],
        tenantId: 'tenant-1',
      };

      const response = await analyzeColumns(request);

      expect(response.suggestions).toHaveLength(1);
      expect(response.suggestions[0].suggestedTarget).toBe('manufacturer_part_number');
    });

    it('should handle null/empty sample values', async () => {
      const request: ColumnAnalysisRequest = {
        headers: ['Column A'],
        sampleRows: [
          { 'Column A': null },
          { 'Column A': '' },
          { 'Column A': undefined },
        ],
        tenantId: 'tenant-1',
      };

      const response = await analyzeColumns(request);

      expect(response.suggestions).toHaveLength(1);
      // Should not crash, should suggest ignore
      expect(response.suggestions[0].suggestedTarget).toBe('ignore');
    });
  });
});
