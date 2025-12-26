/**
 * Component Field Metadata Configuration
 *
 * Defines how component fields should be displayed in the detail page.
 * This allows dynamic rendering based on metadata rather than hardcoding each field.
 *
 * Benefits:
 * - Easy to add/remove fields without code changes
 * - Consistent formatting across the app
 * - Null values automatically skip rendering
 * - Fields can be grouped into sections
 */

import type { Component } from '@/types/component';

/**
 * Field type determines how to format the value
 */
export type FieldType =
  | 'text'           // Plain text
  | 'number'         // Number with locale formatting
  | 'currency'       // Currency with symbol and decimals
  | 'percentage'     // Percentage display
  | 'date'           // Date formatting
  | 'boolean'        // Yes/No display
  | 'compliance'     // Compliance badge (compliant/non-compliant/unknown)
  | 'lifecycle'      // Lifecycle status badge
  | 'risk'           // Risk level badge
  | 'link'           // External link
  | 'badge'          // Simple badge display
  | 'json'           // JSON object (expandable)
  | 'days';          // Days with suffix

/**
 * Field metadata definition
 */
export interface FieldMeta {
  key: keyof Component | string;   // Field key in component object
  label: string;                   // Display label
  type: FieldType;                 // How to format/render
  section: FieldSection;           // Which section to display in
  priority?: number;               // Display order within section (lower = first)
  icon?: string;                   // Lucide icon name
  description?: string;            // Tooltip description
  currencyField?: string;          // For currency type, which field has the currency code
  decimals?: number;               // For number/currency, decimal places
  linkField?: string;              // For link type, which field has the URL
  hideIfEmpty?: boolean;           // Don't show section header if empty (default true)
}

/**
 * Section groupings for the detail page
 */
export type FieldSection =
  | 'overview'       // Hero section quick stats
  | 'basic'          // Basic information
  | 'specifications' // Technical specifications
  | 'compliance'     // Compliance & lifecycle
  | 'pricing'        // Pricing & availability
  | 'metadata';      // Source & timestamps

/**
 * Section display configuration
 */
export const SECTION_CONFIG: Record<FieldSection, { label: string; icon: string }> = {
  overview: { label: 'Quick Stats', icon: 'BarChart3' },
  basic: { label: 'Basic Information', icon: 'Tag' },
  specifications: { label: 'Specifications', icon: 'Layers' },
  compliance: { label: 'Compliance & Lifecycle', icon: 'ShieldCheck' },
  pricing: { label: 'Pricing & Availability', icon: 'DollarSign' },
  metadata: { label: 'Data Source', icon: 'Database' },
};

/**
 * Field definitions - edit this to change what's displayed
 * Fields with null/undefined values are automatically skipped
 */
export const COMPONENT_FIELDS: FieldMeta[] = [
  // === Overview (Quick Stats in Hero) ===
  { key: 'quality_score', label: 'Quality Score', type: 'percentage', section: 'overview', priority: 1 },
  { key: 'lifecycle_status', label: 'Lifecycle', type: 'lifecycle', section: 'overview', priority: 2 },
  { key: 'stock_status', label: 'Stock', type: 'badge', section: 'overview', priority: 3 },
  { key: 'lead_time_days', label: 'Lead Time', type: 'days', section: 'overview', priority: 4 },
  { key: 'unit_price', label: 'Unit Price', type: 'currency', section: 'overview', priority: 5, currencyField: 'currency', decimals: 4 },

  // === Basic Information ===
  { key: 'mpn', label: 'MPN', type: 'text', section: 'basic', priority: 1 },
  { key: 'manufacturer', label: 'Manufacturer', type: 'text', section: 'basic', priority: 2 },
  { key: 'category', label: 'Category', type: 'text', section: 'basic', priority: 3 },
  { key: 'subcategory', label: 'Subcategory', type: 'text', section: 'basic', priority: 4 },
  { key: 'package', label: 'Package', type: 'text', section: 'basic', priority: 5, icon: 'Package' },
  { key: 'product_family', label: 'Product Family', type: 'text', section: 'basic', priority: 6 },
  { key: 'product_series', label: 'Product Series', type: 'text', section: 'basic', priority: 7 },
  { key: 'description', label: 'Description', type: 'text', section: 'basic', priority: 99 },

  // === Compliance ===
  { key: 'lifecycle_status', label: 'Lifecycle Status', type: 'lifecycle', section: 'compliance', priority: 1 },
  { key: 'risk_level', label: 'Risk Level', type: 'risk', section: 'compliance', priority: 2 },
  { key: 'rohs_compliant', label: 'RoHS', type: 'compliance', section: 'compliance', priority: 3 },
  { key: 'reach_compliant', label: 'REACH', type: 'compliance', section: 'compliance', priority: 4 },
  { key: 'halogen_free', label: 'Halogen Free', type: 'compliance', section: 'compliance', priority: 5 },
  { key: 'aec_qualified', label: 'AEC-Q', type: 'compliance', section: 'compliance', priority: 6 },
  { key: 'eccn_code', label: 'ECCN Code', type: 'text', section: 'compliance', priority: 7 },

  // === Pricing ===
  { key: 'unit_price', label: 'Unit Price', type: 'currency', section: 'pricing', priority: 1, currencyField: 'currency', decimals: 4 },
  { key: 'moq', label: 'MOQ', type: 'number', section: 'pricing', priority: 2 },
  { key: 'lead_time_days', label: 'Lead Time', type: 'days', section: 'pricing', priority: 3 },
  { key: 'stock_status', label: 'Stock Status', type: 'badge', section: 'pricing', priority: 4 },
  { key: 'api_source', label: 'Price Source', type: 'text', section: 'pricing', priority: 5 },

  // === Metadata ===
  { key: 'enrichment_source', label: 'Data Source', type: 'text', section: 'metadata', priority: 1, icon: 'Building2' },
  { key: 'api_source', label: 'API Source', type: 'text', section: 'metadata', priority: 2 },
  { key: 'updated_at', label: 'Last Updated', type: 'date', section: 'metadata', priority: 3, icon: 'Clock' },
  { key: 'created_at', label: 'Created', type: 'date', section: 'metadata', priority: 4 },
];

/**
 * Get fields for a specific section, sorted by priority
 */
export function getFieldsForSection(section: FieldSection): FieldMeta[] {
  return COMPONENT_FIELDS
    .filter(f => f.section === section)
    .sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99));
}

/**
 * Get field value from component, handling nested paths
 */
export function getFieldValue(component: Component, key: string): unknown {
  if (key.includes('.')) {
    const parts = key.split('.');
    let value: unknown = component;
    for (const part of parts) {
      if (value && typeof value === 'object') {
        value = (value as Record<string, unknown>)[part];
      } else {
        return undefined;
      }
    }
    return value;
  }
  // Use unknown intermediate cast to safely access dynamic keys
  return (component as unknown as Record<string, unknown>)[key];
}

/**
 * Check if a field has a displayable value
 */
export function hasValue(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (value === '') return false;
  if (Array.isArray(value) && value.length === 0) return false;
  return true;
}

/**
 * Format a field value based on its type
 */
export function formatFieldValue(
  value: unknown,
  meta: FieldMeta,
  component?: Component
): string {
  if (!hasValue(value)) return '—';

  try {
    switch (meta.type) {
      case 'text':
        return String(value);

      case 'number':
        return Number(value).toLocaleString();

      case 'currency': {
        const currency = meta.currencyField && component
          ? (getFieldValue(component, meta.currencyField) as string) || '$'
          : '$';
        const decimals = meta.decimals ?? 2;
        return `${currency}${Number(value).toFixed(decimals)}`;
      }

      case 'percentage':
        return `${Number(value).toFixed(0)}`;

      case 'date':
        try {
          return new Date(String(value)).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          });
        } catch {
          return String(value);
        }

      case 'days':
        return `${Number(value)} days`;

      case 'boolean':
        return value ? 'Yes' : 'No';

      case 'json':
        return typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value);

      // Badge types return the value as-is for special rendering
      case 'compliance':
      case 'lifecycle':
      case 'risk':
      case 'badge':
      case 'link':
        return String(value);

      default:
        return String(value);
    }
  } catch (error) {
    console.warn(`[formatFieldValue] Error formatting ${meta.key}:`, error);
    return '—';
  }
}

/**
 * Get all displayable fields from a component (fields that have non-null values)
 */
export function getDisplayableFields(component: Component, section?: FieldSection): Array<{
  meta: FieldMeta;
  value: unknown;
  formatted: string;
}> {
  const fields = section ? getFieldsForSection(section) : COMPONENT_FIELDS;

  return fields
    .map(meta => {
      const value = getFieldValue(component, meta.key);
      return {
        meta,
        value,
        formatted: formatFieldValue(value, meta, component),
      };
    })
    .filter(f => hasValue(f.value));
}

/**
 * Get all extra fields from component that aren't in the standard field list
 * Useful for showing unexpected/new fields from API
 */
export function getExtraFields(component: Component): Array<{ key: string; value: unknown }> {
  const knownKeys = new Set(COMPONENT_FIELDS.map(f => f.key));
  const skipKeys = new Set(['id', 'alternates', 'price_breaks', 'specifications', 'extracted_specs', 'supplier_data', 'quality_metadata', 'ai_metadata']);

  return Object.entries(component)
    .filter(([key, value]) => !knownKeys.has(key) && !skipKeys.has(key) && hasValue(value))
    .map(([key, value]) => ({ key, value }));
}

/**
 * Format a snake_case key to Title Case for display
 */
export function formatKeyLabel(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase());
}
