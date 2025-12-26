/**
 * Component Catalog types for the customer portal
 * Aligned with CNS service catalog.py and component_catalog table
 *
 * Field mapping from CNS API:
 * - component_catalog table uses snake_case
 * - CatalogComponent.to_dict() returns snake_case keys
 */

export interface Component {
  id: string;
  mpn: string; // Maps to 'mpn' from API
  manufacturer: string;
  normalized_mpn?: string;
  normalized_manufacturer?: string;
  description?: string;
  category?: string;
  subcategory?: string;
  category_path?: string;
  product_family?: string;
  product_series?: string;
  datasheet_url?: string;
  image_url?: string;
  lifecycle_status?: LifecycleStatus;
  risk_level?: 'low' | 'medium' | 'high' | 'critical';

  // Compliance - boolean in DB
  rohs_compliant?: boolean;
  reach_compliant?: boolean;
  halogen_free?: boolean;
  aec_qualified?: boolean;
  eccn_code?: string;

  // Package info
  package?: string; // Package type (0603, SOIC-8, etc.)

  // Pricing
  unit_price?: number;
  currency?: string;
  price_breaks?: PriceBreak[];
  moq?: number; // Minimum Order Quantity
  lead_time_days?: number;
  stock_status?: string;

  // Supplier data (JSONB)
  supplier_data?: Record<string, unknown>;

  // Specifications (JSONB)
  specifications?: Record<string, unknown>;
  extracted_specs?: Record<string, unknown>;

  // Quality & Enrichment
  quality_score?: number;
  quality_metadata?: Record<string, unknown>;
  ai_metadata?: Record<string, unknown>;
  enrichment_source?: string; // 'customer_bom', 'staff_expansion', 'api_import'
  api_source?: string; // 'mouser', 'digikey', 'element14'

  // Timestamps
  created_at?: string;
  updated_at?: string;

  // Computed/UI fields (not from API)
  alternates?: AlternateComponent[];
}

/**
 * Price break from supplier
 */
export interface PriceBreak {
  quantity: number;
  price: number;
  currency?: string;
}

export type LifecycleStatus = 'active' | 'nrnd' | 'obsolete' | 'preview' | 'unknown';

export interface SupplierInfo {
  supplier: string;
  sku: string;
  price?: number;
  currency?: string;
  stock?: number;
  leadTime?: string;
  moq?: number;
  url?: string;
}

export interface AlternateComponent {
  id?: string;
  mpn: string;
  manufacturer: string;
  matchScore: number;
  matchType: 'exact' | 'functional' | 'form_fit' | 'suggested';
  componentId?: string;
}

export interface ComponentSearchParams {
  query?: string;
  mpn?: string;
  manufacturer?: string;
  category?: string;
  lifecycleStatus?: LifecycleStatus;
  page?: number;
  limit?: number;
}

export interface ComponentSearchResult {
  data: Component[];
  total: number;
  page: number;
  limit: number;
}

export interface Category {
  id: string;
  name: string;
  parent_id?: string;
  component_count?: number;
}

export interface Manufacturer {
  id: string;
  name: string;
  aliases?: string[];
  component_count?: number;
}

/**
 * Lifecycle status display configuration
 * Values from CNS catalog.py: 'active', 'nrnd', 'obsolete', 'preview'
 */
export const LIFECYCLE_CONFIG: Record<
  LifecycleStatus,
  { label: string; color: string; description: string }
> = {
  active: {
    label: 'Active',
    color: 'green',
    description: 'Component is in active production',
  },
  nrnd: {
    label: 'NRND',
    color: 'yellow',
    description: 'Not Recommended for New Designs',
  },
  obsolete: {
    label: 'Obsolete',
    color: 'red',
    description: 'Component is no longer manufactured',
  },
  preview: {
    label: 'Preview',
    color: 'blue',
    description: 'New product - limited availability',
  },
  unknown: {
    label: 'Unknown',
    color: 'gray',
    description: 'Lifecycle status not determined',
  },
};

/**
 * Get lifecycle status color class
 */
export function getLifecycleColor(status?: LifecycleStatus): string {
  if (!status) return 'bg-gray-100 text-gray-700';
  const config = LIFECYCLE_CONFIG[status];
  switch (config?.color) {
    case 'green':
      return 'bg-green-100 text-green-700';
    case 'yellow':
      return 'bg-yellow-100 text-yellow-700';
    case 'red':
      return 'bg-red-100 text-red-700';
    case 'blue':
      return 'bg-blue-100 text-blue-700';
    default:
      return 'bg-gray-100 text-gray-700';
  }
}

/**
 * Get compliance status display
 * Handles both boolean (from DB) and string (legacy) values
 */
export function getComplianceStatus(value?: boolean | string | null): {
  compliant: boolean | null;
  label: string;
} {
  if (value === undefined || value === null) return { compliant: null, label: 'Unknown' };

  // Handle boolean directly
  if (typeof value === 'boolean') {
    return { compliant: value, label: value ? 'Compliant' : 'Non-Compliant' };
  }

  // Handle string values for backwards compatibility
  const lower = String(value).toLowerCase();
  // Check for negative patterns first (non-compliant must be checked before compliant)
  if (lower.includes('non-compliant') || lower.includes('non compliant') || lower === 'no' || lower === 'false') {
    return { compliant: false, label: 'Non-Compliant' };
  }
  // Then check for positive patterns
  if (lower.includes('yes') || lower.includes('compliant') || lower === 'true') {
    return { compliant: true, label: 'Compliant' };
  }
  return { compliant: null, label: String(value) };
}
