/**
 * AI-Assisted Column Mapping
 * CBP-P1-007: AI-Assisted Column Mapping
 */

export interface ColumnSuggestion {
  sourceColumn: string;
  targetField: string;
  confidence: number;
  reason: string;
}

export interface BOMField {
  key: string;
  label: string;
  required: boolean;
  aliases: string[];
  description?: string;
}

// Standard BOM fields with aliases for matching
export const BOM_FIELDS: BOMField[] = [
  {
    key: 'mpn',
    label: 'Manufacturer Part Number',
    required: true,
    aliases: ['part number', 'part no', 'part#', 'pn', 'mfr part', 'mfg pn', 'manufacturer pn'],
  },
  {
    key: 'manufacturer',
    label: 'Manufacturer',
    required: true,
    aliases: ['mfr', 'mfg', 'vendor', 'brand', 'make'],
  },
  {
    key: 'quantity',
    label: 'Quantity',
    required: true,
    aliases: ['qty', 'count', 'amount', 'units', 'pcs', 'pieces'],
  },
  {
    key: 'description',
    label: 'Description',
    required: false,
    aliases: ['desc', 'part desc', 'component', 'item', 'name'],
  },
  {
    key: 'reference',
    label: 'Reference Designator',
    required: false,
    aliases: ['ref des', 'ref', 'designator', 'refdes', 'references'],
  },
  {
    key: 'value',
    label: 'Value',
    required: false,
    aliases: ['val', 'rating', 'spec'],
  },
  {
    key: 'package',
    label: 'Package/Footprint',
    required: false,
    aliases: ['footprint', 'pkg', 'case', 'size', 'form factor'],
  },
  {
    key: 'dnp',
    label: 'Do Not Populate',
    required: false,
    aliases: ['do not place', 'no pop', 'skip', 'excluded'],
  },
];

// Normalize string for comparison
function normalize(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]/g, '');
}

// Calculate similarity between two strings
function similarity(a: string, b: string): number {
  const normA = normalize(a);
  const normB = normalize(b);

  if (normA === normB) return 1;
  if (normA.includes(normB) || normB.includes(normA)) return 0.8;

  // Levenshtein distance based similarity
  const maxLen = Math.max(normA.length, normB.length);
  if (maxLen === 0) return 1;

  const distance = levenshtein(normA, normB);
  return 1 - distance / maxLen;
}

// Levenshtein distance with max length protection
function levenshtein(a: string, b: string): number {
  // Prevent performance issues with very long strings
  const MAX_LENGTH = 1000;
  const trimmedA = a.slice(0, MAX_LENGTH);
  const trimmedB = b.slice(0, MAX_LENGTH);

  const matrix: number[][] = [];

  for (let i = 0; i <= trimmedB.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= trimmedA.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= trimmedB.length; i++) {
    for (let j = 1; j <= trimmedA.length; j++) {
      if (trimmedB.charAt(i - 1) === trimmedA.charAt(j - 1)) {
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

  return matrix[trimmedB.length][trimmedA.length];
}

// Configuration for mapping algorithm
export const MAPPING_CONFIG = {
  MIN_CONFIDENCE_THRESHOLD: 0.5,
  EXACT_MATCH_BOOST: 0.1,
  REQUIRED_FIELD_PRIORITY_BOOST: 0.05,
} as const;

// Suggest mappings for columns
export function suggestColumnMappings(
  sourceColumns: string[],
  minConfidence: number = MAPPING_CONFIG.MIN_CONFIDENCE_THRESHOLD
): ColumnSuggestion[] {
  const suggestions: ColumnSuggestion[] = [];
  const usedFields = new Set<string>();

  for (const sourceCol of sourceColumns) {
    let bestMatch: ColumnSuggestion | null = null;
    let bestScore = 0;

    for (const field of BOM_FIELDS) {
      if (usedFields.has(field.key)) continue;

      // Check direct match with field label
      let score = similarity(sourceCol, field.label);
      let reason = 'Matched field label';

      // Check aliases
      for (const alias of field.aliases) {
        const aliasScore = similarity(sourceCol, alias);
        if (aliasScore > score) {
          score = aliasScore;
          reason = `Matched alias "${alias}"`;
        }
      }

      // Check exact normalized match
      if (normalize(sourceCol) === normalize(field.key)) {
        score = 1;
        reason = 'Exact key match';
      }

      // Boost score for required fields (helps prioritize important mappings)
      if (field.required && score > 0.3) {
        score = Math.min(1, score + MAPPING_CONFIG.REQUIRED_FIELD_PRIORITY_BOOST);
      }

      if (score > bestScore && score >= minConfidence) {
        bestScore = score;
        bestMatch = {
          sourceColumn: sourceCol,
          targetField: field.key,
          confidence: score,
          reason,
        };
      }
    }

    if (bestMatch) {
      suggestions.push(bestMatch);
      usedFields.add(bestMatch.targetField);
    }
  }

  return suggestions;
}

// Get unmapped required fields
export function getUnmappedRequiredFields(mappings: ColumnSuggestion[]): BOMField[] {
  const mappedFields = new Set(mappings.map((m) => m.targetField));
  return BOM_FIELDS.filter((f) => f.required && !mappedFields.has(f.key));
}

// Validate mapping completeness
export function validateMappings(mappings: ColumnSuggestion[]): {
  isValid: boolean;
  missingRequired: string[];
  warnings: string[];
} {
  const mappedFields = new Set(mappings.map((m) => m.targetField));
  const missingRequired = BOM_FIELDS
    .filter((f) => f.required && !mappedFields.has(f.key))
    .map((f) => f.label);

  const warnings: string[] = [];

  // Check for low confidence mappings
  const lowConfidence = mappings.filter((m) => m.confidence < 0.7);
  if (lowConfidence.length > 0) {
    warnings.push(`${lowConfidence.length} column(s) have low confidence mappings. Please verify.`);
  }

  return {
    isValid: missingRequired.length === 0,
    missingRequired,
    warnings,
  };
}
