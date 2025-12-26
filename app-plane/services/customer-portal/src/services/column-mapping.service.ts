/**
 * Column Mapping Service
 * Provides AI-powered column detection and template management
 * @module services/column-mapping
 */

import type {
  ColumnAnalysisRequest,
  ColumnAnalysisResponse,
  ColumnSuggestion,
  MappingTemplate,
  CreateMappingTemplateRequest,
  UpdateMappingTemplateRequest,
  MatchReason,
  AlternativeSuggestion,
} from '../types/column-mapping';

// Re-export types for consumers
export type {
  ColumnAnalysisRequest,
  ColumnAnalysisResponse,
  ColumnSuggestion,
  MappingTemplate,
  CreateMappingTemplateRequest,
  UpdateMappingTemplateRequest,
  MatchReason,
  AlternativeSuggestion,
};

/**
 * Target field definitions with their pattern variations
 */
const EXACT_PATTERNS: Record<string, string[]> = {
  manufacturer_part_number: [
    'mpn',
    'partnumber',
    'pn',
    'partno',
    'manufacturerpartnumber',
    'mfgpn',
    'mfrpn',
    'part',
    'partnum',
  ],
  manufacturer: [
    'manufacturer',
    'mfr',
    'mfg',
    'vendor',
    'make',
    'brand',
    'supplier',
  ],
  quantity: ['qty', 'quantity', 'count', 'amount', 'units', 'qnty'],
  reference_designator: [
    'refdes',
    'referencedesignator',
    'designator',
    'ref',
    'reference',
    'des',
  ],
  description: [
    'description',
    'desc',
    'partdescription',
    'itemdescription',
    'partdesc',
    'itemdesc',
  ],
};

/**
 * Sample value patterns for data analysis
 */
const VALUE_PATTERNS: Record<string, RegExp> = {
  quantity: /^\d+$/,
  reference_designator: /^[A-Z]+\d+(,\s*[A-Z]+\d+)*$/i,
  manufacturer_part_number: /^[A-Z0-9\-_.]+$/i,
};

/**
 * Normalize header for comparison
 * Removes special characters, spaces, and converts to lowercase
 */
function normalizeHeader(header: string): string {
  return header
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Calculate Levenshtein distance between two strings
 * Used for fuzzy matching
 */
function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[str2.length][str1.length];
}

/**
 * Find exact pattern match for a header
 * Returns target field and 100% confidence if found
 */
function findExactMatch(
  normalizedHeader: string
): { target: string; confidence: number } | null {
  for (const [target, patterns] of Object.entries(EXACT_PATTERNS)) {
    if (patterns.includes(normalizedHeader)) {
      return { target, confidence: 100 };
    }
  }
  return null;
}

/**
 * Find fuzzy match using Levenshtein distance
 * Returns target field and confidence 80-95% if distance < 3
 */
function findFuzzyMatch(
  normalizedHeader: string
): { target: string; confidence: number } | null {
  let bestMatch: { target: string; distance: number } | null = null;

  for (const [target, patterns] of Object.entries(EXACT_PATTERNS)) {
    for (const pattern of patterns) {
      const distance = levenshteinDistance(normalizedHeader, pattern);
      if (distance < 3 && (!bestMatch || distance < bestMatch.distance)) {
        bestMatch = { target, distance };
      }
    }
  }

  if (bestMatch) {
    // Map distance to confidence: 0 = 100%, 1 = 95%, 2 = 85%, 3 = 80%
    const confidence = Math.max(80, 100 - bestMatch.distance * 10);
    return { target: bestMatch.target, confidence };
  }

  return null;
}

/**
 * Analyze sample values to detect column type
 * Returns target field and confidence 60-75% based on pattern match rate
 */
function analyzeSampleValues(
  sampleValues: unknown[]
): { target: string; confidence: number } | null {
  const validValues = sampleValues.filter(
    (val) => val !== null && val !== undefined && val !== ''
  );

  if (validValues.length === 0) {
    return null;
  }

  const stringValues = validValues.map((val) => String(val));

  // Test each pattern
  for (const [target, pattern] of Object.entries(VALUE_PATTERNS)) {
    const matches = stringValues.filter((val) => pattern.test(val)).length;
    const matchRate = matches / stringValues.length;

    if (matchRate >= 0.7) {
      // 70%+ of values match the pattern
      const confidence = Math.min(75, Math.round(60 + matchRate * 20));
      return { target, confidence };
    }
  }

  return null;
}

/**
 * Generate alternative suggestions for a column
 * Returns top 3 alternatives sorted by confidence
 */
function generateAlternatives(
  normalizedHeader: string,
  sampleValues: unknown[],
  primaryTarget: string
): AlternativeSuggestion[] {
  const alternatives: AlternativeSuggestion[] = [];

  // Try fuzzy matches
  for (const [target, patterns] of Object.entries(EXACT_PATTERNS)) {
    if (target === primaryTarget) continue;

    for (const pattern of patterns) {
      const distance = levenshteinDistance(normalizedHeader, pattern);
      if (distance < 4) {
        const confidence = Math.max(60, 90 - distance * 10);
        alternatives.push({ target, confidence });
        break; // Only add once per target
      }
    }
  }

  // Try sample analysis
  const sampleMatch = analyzeSampleValues(sampleValues);
  if (sampleMatch && sampleMatch.target !== primaryTarget) {
    const existing = alternatives.find((alt) => alt.target === sampleMatch.target);
    if (existing) {
      existing.confidence = Math.max(existing.confidence, sampleMatch.confidence);
    } else {
      alternatives.push({
        target: sampleMatch.target,
        confidence: sampleMatch.confidence,
      });
    }
  }

  // Sort by confidence and take top 3
  return alternatives.sort((a, b) => b.confidence - a.confidence).slice(0, 3);
}

/**
 * Analyze columns and generate AI suggestions
 */
export async function analyzeColumns(
  request: ColumnAnalysisRequest
): Promise<ColumnAnalysisResponse> {
  const { headers, sampleRows, tenantId } = request;

  // Try to find matching template first
  const templates = await getMappingTemplates(tenantId);
  const matchedTemplate = findBestMatchingTemplate(headers, templates);

  const suggestions: ColumnSuggestion[] = headers.map((header) => {
    const normalizedHeader = normalizeHeader(header);

    // Extract sample values for this column
    const sampleValues = sampleRows.map((row) => row[header]);

    let target = 'ignore';
    let confidence = 0;
    let matchReason: MatchReason = 'exact_match';

    // 1. Try exact match (100% confidence)
    const exactMatch = findExactMatch(normalizedHeader);
    if (exactMatch) {
      target = exactMatch.target;
      confidence = exactMatch.confidence;
      matchReason = 'exact_match';
    }
    // 2. Try fuzzy match (80-95% confidence)
    else {
      const fuzzyMatch = findFuzzyMatch(normalizedHeader);
      if (fuzzyMatch) {
        target = fuzzyMatch.target;
        confidence = fuzzyMatch.confidence;
        matchReason = 'fuzzy_match';
      }
      // 3. Try sample analysis (60-75% confidence)
      else {
        const sampleMatch = analyzeSampleValues(sampleValues);
        if (sampleMatch) {
          target = sampleMatch.target;
          confidence = sampleMatch.confidence;
          matchReason = 'sample_analysis';
        }
      }
    }

    // Generate alternatives
    const alternatives = generateAlternatives(
      normalizedHeader,
      sampleValues,
      target
    );

    return {
      sourceColumn: header,
      suggestedTarget: target,
      confidence,
      matchReason,
      alternatives,
    };
  });

  return {
    suggestions,
    matchedTemplate,
  };
}

/**
 * Find best matching template based on header similarity
 */
function findBestMatchingTemplate(
  headers: string[],
  templates: MappingTemplate[]
): { id: string; name: string; matchScore: number } | undefined {
  const normalizedHeaders = headers.map(normalizeHeader);

  let bestMatch: { id: string; name: string; matchScore: number } | undefined;

  for (const template of templates) {
    const templatePatterns = template.mappings.map((m) => m.pattern.toLowerCase());
    const matchCount = normalizedHeaders.filter((h) =>
      templatePatterns.includes(h)
    ).length;

    const matchScore = Math.round((matchCount / headers.length) * 100);

    if (matchScore >= 70 && (!bestMatch || matchScore > bestMatch.matchScore)) {
      bestMatch = {
        id: template.id,
        name: template.name,
        matchScore,
      };
    }
  }

  return bestMatch;
}

/**
 * Get all mapping templates for a tenant
 * Returns both personal and org-wide shared templates
 */
export async function getMappingTemplates(
  tenantId: string
): Promise<MappingTemplate[]> {
  // TODO: Replace with actual API call
  // For now, return mock data
  const mockTemplates: MappingTemplate[] = [
    {
      id: 'template-1',
      name: 'Standard BOM Format',
      description: 'Common column mapping for standard BOMs',
      tenantId,
      mappings: [
        { pattern: 'partnumber', target: 'manufacturer_part_number' },
        { pattern: 'manufacturer', target: 'manufacturer' },
        { pattern: 'qty', target: 'quantity' },
        { pattern: 'refdes', target: 'reference_designator' },
        { pattern: 'description', target: 'description' },
      ],
      usageCount: 15,
      lastUsed: new Date('2025-12-10'),
      createdBy: 'user-123',
      createdAt: new Date('2025-11-01'),
      isShared: true,
    },
  ];

  return Promise.resolve(mockTemplates);
}

/**
 * Create a new mapping template
 */
export async function createMappingTemplate(
  template: CreateMappingTemplateRequest
): Promise<MappingTemplate> {
  // TODO: Replace with actual API call
  const newTemplate: MappingTemplate = {
    ...template,
    id: `template-${Date.now()}`,
    createdAt: new Date(),
    usageCount: 0,
    lastUsed: new Date(),
  };

  return Promise.resolve(newTemplate);
}

/**
 * Update an existing mapping template
 */
export async function updateMappingTemplate(
  id: string,
  updates: UpdateMappingTemplateRequest
): Promise<MappingTemplate> {
  // TODO: Replace with actual API call
  const templates = await getMappingTemplates('tenant-1');
  const existing = templates.find((t) => t.id === id);

  if (!existing) {
    throw new Error(`Template ${id} not found`);
  }

  const updated: MappingTemplate = {
    ...existing,
    ...updates,
  };

  return Promise.resolve(updated);
}

/**
 * Delete a mapping template
 */
export async function deleteMappingTemplate(id: string): Promise<void> {
  // TODO: Replace with actual API call
  console.log(`Deleting template ${id}`);
  return Promise.resolve();
}

/**
 * Apply a saved template to new headers
 * Returns suggestions based on template mappings
 */
export async function applyTemplate(
  templateId: string,
  headers: string[]
): Promise<ColumnSuggestion[]> {
  // TODO: Replace with actual API call
  const templates = await getMappingTemplates('tenant-1');
  const template = templates.find((t) => t.id === templateId);

  if (!template) {
    throw new Error(`Template ${templateId} not found`);
  }

  const normalizedHeaders = headers.map(normalizeHeader);
  const templateMap = new Map(
    template.mappings.map((m) => [m.pattern.toLowerCase(), m.target])
  );

  const suggestions: ColumnSuggestion[] = headers.map((header, index) => {
    const normalized = normalizedHeaders[index];
    const target = templateMap.get(normalized) || 'ignore';
    const confidence = target !== 'ignore' ? 100 : 0;

    return {
      sourceColumn: header,
      suggestedTarget: target,
      confidence,
      matchReason: 'exact_match',
      alternatives: [],
    };
  });

  return suggestions;
}
