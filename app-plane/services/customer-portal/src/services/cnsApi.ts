/**
 * CNS (Component Normalization Service) API Client
 *
 * Provides methods to interact with the CNS service for BOM processing.
 *
 * The actual base URL is provided via VITE_CNS_API_URL at build/run time
 * and defaults to the local CNS port for development.
 */

// CNS base URL helper with sensible local default.
// In compose, VITE_CNS_API_URL is wired consistently across portals
// (customer portal, backstage, CNS dashboard) so they all talk to the
// same CNS endpoint.
const DEFAULT_CNS_BASE_URL = 'http://localhost:27800';

export const CNS_BASE_URL = import.meta.env.VITE_CNS_API_URL || DEFAULT_CNS_BASE_URL;

// =====================================================
// Organization Storage Keys (shared with OrganizationContext)
// =====================================================
export const ORGANIZATION_STORAGE_KEY = 'current_organization_id';
export const LEGACY_ORGANIZATION_STORAGE_KEY = 'organization_id';

// =====================================================
// Workspace Storage Keys (shared with WorkspaceContext)
// =====================================================
export const WORKSPACE_STORAGE_KEY = 'current_workspace_id';

/**
 * Get current organization ID from localStorage.
 * This is the single source of truth for non-React code.
 * React components should use useOrganization() hook instead.
 */
export function getCurrentOrganizationId(): string | null {
  return localStorage.getItem(ORGANIZATION_STORAGE_KEY)
    || localStorage.getItem(LEGACY_ORGANIZATION_STORAGE_KEY);
}

/**
 * Get current workspace ID from localStorage.
 * This is the single source of truth for non-React code.
 * React components should use useWorkspace() hook instead.
 */
export function getCurrentWorkspaceId(): string | null {
  return localStorage.getItem(WORKSPACE_STORAGE_KEY);
}

/**
 * Set current organization ID in localStorage.
 * Updates both new and legacy keys for backwards compatibility.
 */
export function setCurrentOrganizationId(orgId: string): void {
  localStorage.setItem(ORGANIZATION_STORAGE_KEY, orgId);
  localStorage.setItem(LEGACY_ORGANIZATION_STORAGE_KEY, orgId);
}

/**
 * Clear organization ID from localStorage.
 */
export function clearOrganizationId(): void {
  localStorage.removeItem(ORGANIZATION_STORAGE_KEY);
  localStorage.removeItem(LEGACY_ORGANIZATION_STORAGE_KEY);
}

// Import supabase client to get auth token for CNS API calls
import { supabase } from '../providers/dataProvider';

interface VaultReviewRequestPayload {
  component_ids: string[];
  reviewer_id: string;
  due_date?: string | null;
  notes?: string;
  stage: string;
  priority: 'low' | 'medium' | 'high';
}

interface VaultStageUpdatePayload {
  stage: string;
  notes?: string;
}

/**
 * Get auth headers for CNS API calls.
 * Uses Auth0 token if available, then falls back to Supabase session token.
 * Also includes X-Organization-Id, X-Workspace-Id and X-User-Email headers for multi-tenant auth.
 */
export async function getAuthHeaders(): Promise<HeadersInit> {
  const headers: HeadersInit = {};

  // Add organization ID header if available (using centralized getter)
  const organizationId = getCurrentOrganizationId();
  if (organizationId) {
    headers['X-Organization-Id'] = organizationId;
  }

  // Add workspace ID header if available (using centralized getter)
  const workspaceId = getCurrentWorkspaceId();
  if (workspaceId) {
    headers['X-Workspace-Id'] = workspaceId;
  }

  // Add user email header if available (for Auth0 users whose tokens lack email claim)
  const userEmail = localStorage.getItem('user_email');
  if (userEmail) {
    headers['X-User-Email'] = userEmail;
  }

  // Check auth mode to determine which token to use
  // Option A (auth0_direct): Use Auth0 access token directly
  // Option B (supabase_jwt or undefined): Use Supabase session token
  const authMode = localStorage.getItem('auth_mode');
  const auth0Token = localStorage.getItem('auth0_access_token');

  // Priority 1: Auth0 token (ONLY in auth0_direct mode)
  if (authMode === 'auth0_direct') {
    try {
      if (auth0Token) {
        return {
          ...headers,
          'Authorization': `Bearer ${auth0Token}`,
        };
      }
    } catch (error) {
      console.warn('[CNS API] Failed to get Auth0 token:', error);
    }
  }

  // Priority 2: Supabase session token (default for Option B)
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      return {
        ...headers,
        'Authorization': `Bearer ${session.access_token}`,
      };
    }
  } catch (error) {
    console.warn('[CNS API] Failed to get Supabase session:', error);
  }
  // Fallback: Auth0 token present but auth_mode missing or mis-set
  if (auth0Token) {
    return {
      ...headers,
      'Authorization': `Bearer ${auth0Token}`,
    };
  }
  return headers;
}

export function getCnsBaseUrl(): string {
  if (!import.meta.env.VITE_CNS_API_URL && import.meta.env.DEV) {
    // Helpful log in dev when env var is not set
    console.warn(
      '[CNS] VITE_CNS_API_URL not set, falling back to',
      DEFAULT_CNS_BASE_URL
    );
  }
  return CNS_BASE_URL;
}

// Legacy upload response (from /api/bom/upload - deprecated)
interface LegacyUploadBOMResponse {
  job_id: string;
  filename: string;
  total_items: number;
  status: string;
  detected_columns: Record<string, string>;
  unmapped_columns: string[];
  file_type: string;
  encoding_used: string;
  preview_data: Array<{
    mpn: string;
    manufacturer?: string;
    quantity?: number;
    reference_designator?: string;
    description?: string;
  }>;
  message: string;
}

// New unified upload response (from /api/boms/projects/{project_id}/boms/upload)
interface UploadBOMResponse {
  bom_id: string;
  organization_id: string;
  component_count: number;
  raw_file_s3_key: string;
  parsed_file_s3_key: string;
  enrichment_started: boolean;
  workflow_id: string | null;
  status: string;
  priority: string;
}

interface ConfirmMappingResponse {
  job_id: string;
  status: string;
  workflow_id?: string;
  message: string;
}

interface JobStatusResponse {
  job_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  progress: {
    total: number;
    processed: number;
    passed: number;
    failed: number;
  };
  results: ComponentResult[];
  current_component?: string;
  error?: string;
  created_at: string;
  updated_at: string;
}

interface ComponentResult {
  mpn: string;
  manufacturer: string;
  quality_score?: number;
  routing_score?: number;
  status: 'passed' | 'failed' | 'processing' | 'pending';
  issues?: string[];
  enriched_data?: any;
}

// Component Catalog (Vault) interfaces
interface ComponentCatalogSearchResult {
  mpn: string;
  manufacturer: string;
  category: string;
  description: string;
  quality_score: number;
  enrichment_status: 'production' | 'staging' | 'rejected' | 'pending';
  data_sources: string[];
  last_updated: string;
}

interface ComponentCatalogSearchResponse {
  results: ComponentCatalogSearchResult[];
  total: number;
}

interface ComponentCatalogDetail {
  id: string;
  mpn: string;
  manufacturer: string;
  category: string;
  description: string;
  datasheet_url?: string;
  image_url?: string;
  lifecycle: string;
  rohs: string;
  reach: string;
  specifications: Record<string, any>;
  parameters?: Record<string, any>;  // Technical parameters separate from specifications
  pricing: Array<{
    quantity: number;
    price: number;
    currency?: string;
  }>;
  quality_score: number;
  enrichment_source: string;
  last_enriched_at?: string;
  created_at?: string;
  updated_at?: string;
  // Stock and pricing fields
  stock_status?: string;
  stock_quantity?: number;  // Integer quantity available
  lead_time_days?: number;
  unit_price?: number;
  currency?: string;
  moq?: number;  // Minimum Order Quantity
  // Compliance fields
  aec_qualified?: boolean;  // Automotive qualification
  halogen_free?: boolean;   // Halogen-free compliance
}

interface RetryJobResponse {
  job_id: string;
  status: string;
  message: string;
}

class CNSApiClient {
  private baseURL: string;

  constructor(baseURL: string = CNS_BASE_URL) {
    this.baseURL = baseURL;
  }

  /**
   * Upload BOM to a specific project (NEW scoped endpoint)
   * Server derives organization_id from project FK chain - NO client-side organization_id needed
   *
   * @param projectId - Project ID (required) - used for automatic FK validation
   * @param file - BOM file to upload
   * @param options - Upload options (bom_name, priority, source, uploaded_by, start_enrichment)
   * @returns BOM upload response with bom_id, component_count, etc.
   */
  async uploadBOMToProject(
    projectId: string,
    file: File,
    options: {
      bomName?: string;
      priority?: 'low' | 'normal' | 'high';
      source?: 'customer' | 'staff_bulk';
      uploadedBy?: string;
      startEnrichment?: boolean;
      columnMappings?: Record<string, string>;
    } = {}
  ): Promise<UploadBOMResponse> {
    const formData = new FormData();
    formData.append('file', file);

    // Add optional metadata (NO organization_id - server derives it)
    if (options.bomName) formData.append('bom_name', options.bomName);
    formData.append('priority', options.priority || 'normal');
    formData.append('source', options.source || 'customer');
    formData.append('start_enrichment', String(options.startEnrichment ?? true));

    if (options.uploadedBy) formData.append('uploaded_by', options.uploadedBy);
    if (options.columnMappings) {
      formData.append('column_mappings', JSON.stringify(options.columnMappings));
    }

    const authHeaders = await getAuthHeaders();
    const response = await fetch(
      `${this.baseURL}/api/boms/projects/${projectId}/boms/upload`,
      {
        method: 'POST',
        headers: authHeaders, // Only auth headers, no Content-Type for FormData
        body: formData,
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: response.statusText }));

      // Handle specific error cases
      if (response.status === 403) {
        throw new Error('Project access denied. You do not have permission to upload to this project.');
      }
      if (response.status === 404) {
        throw new Error('Project not found or does not exist.');
      }

      throw new Error(errorData.detail || errorData.message || `Upload failed: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Upload BOM file(s) to CNS for processing
   * Returns job_id and column mapping suggestions
   *
   * @deprecated Use uploadBOMToProject() instead for better security and automatic FK validation
   */
  async uploadBOM(
    files: File[],
    tenantId: string,
    organizationId?: string,
    projectId?: string
  ): Promise<LegacyUploadBOMResponse> {
    const formData = new FormData();

    // Add all files to form data
    files.forEach((file, index) => {
      formData.append('file', file);
    });

    // Add metadata
    formData.append('organization_id', tenantId);
    if (organizationId) {
      formData.append('organization_id', organizationId);
    }
    if (projectId) {
      formData.append('project_id', projectId);
    }

    const authHeaders = await getAuthHeaders();
    const response = await fetch(`${this.baseURL}/api/bom/upload`, {
      method: 'POST',
      headers: authHeaders,
      body: formData,
      // Let browser set Content-Type with boundary for multipart/form-data
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(errorData.message || `Upload failed: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Confirm column mappings and start Temporal workflow
   */
  async confirmMapping(
    jobId: string,
    columnMappings: { [key: string]: string }
  ): Promise<ConfirmMappingResponse> {
    const authHeaders = await getAuthHeaders();
    const response = await fetch(`${this.baseURL}/api/bom/jobs/${jobId}/confirm`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
      body: JSON.stringify({
        column_mappings: columnMappings,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(errorData.message || `Confirm mapping failed: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get current job status and progress
   * Used for polling during workflow execution
   */
  async getJobStatus(jobId: string): Promise<JobStatusResponse> {
    const authHeaders = await getAuthHeaders();
    const response = await fetch(`${this.baseURL}/api/bom/jobs/${jobId}/status`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(errorData.message || `Failed to fetch job status: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get detailed job results (after completion)
   */
  async getJobResults(jobId: string): Promise<ComponentResult[]> {
    const authHeaders = await getAuthHeaders();
    const response = await fetch(`${this.baseURL}/api/bom/jobs/${jobId}/results`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(errorData.message || `Failed to fetch job results: ${response.statusText}`);
    }

    const data = await response.json();
    return data.results || [];
  }

  /**
   * Cancel a running job
   */
  async cancelJob(jobId: string): Promise<{ message: string }> {
    const authHeaders = await getAuthHeaders();
    const response = await fetch(`${this.baseURL}/api/bom/jobs/${jobId}/cancel`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(errorData.message || `Failed to cancel job: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Retry entire job with same or new column mappings
   */
  async retryJob(
    jobId: string,
    columnMappings?: { [key: string]: string }
  ): Promise<RetryJobResponse> {
    const authHeaders = await getAuthHeaders();
    const response = await fetch(`${this.baseURL}/api/bom/jobs/${jobId}/retry`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
      body: JSON.stringify({
        column_mappings: columnMappings,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(errorData.message || `Failed to retry job: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Retry only failed items from a job
   * Creates new job with only failed components
   */
  async retryFailedItems(jobId: string): Promise<RetryJobResponse> {
    const authHeaders = await getAuthHeaders();
    const response = await fetch(`${this.baseURL}/api/bom/jobs/${jobId}/retry-failed`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(errorData.message || `Failed to retry failed items: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * List all jobs for a tenant (with optional filtering)
   */
  async listJobs(
    tenantId: string,
    filters?: {
      status?: string;
      organization_id?: string;
      project_id?: string;
      limit?: number;
      offset?: number;
    }
  ): Promise<{ jobs: JobStatusResponse[]; total: number }> {
    const params = new URLSearchParams({
      organization_id: tenantId,
      ...filters,
    } as any);

    const authHeaders = await getAuthHeaders();
    const response = await fetch(`${this.baseURL}/api/bom/jobs?${params}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(errorData.message || `Failed to list jobs: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Delete a job and its associated data
   */
  async deleteJob(jobId: string): Promise<{ message: string }> {
    const authHeaders = await getAuthHeaders();
    const response = await fetch(`${this.baseURL}/api/bom/jobs/${jobId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(errorData.message || `Failed to delete job: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Merge multiple BOM files into a single BOM
   * Supports all file formats: CSV, XLSX, XLS, TXT, TSV
   */
  async mergeBOM(
    files: File[],
    mergeStrategy: 'sum_quantity' | 'max_quantity' | 'first_only',
    tenantId: string,
    organizationId?: string,
    projectId?: string,
    name?: string,
    description?: string
  ): Promise<UploadBOMResponse> {
    const formData = new FormData();

    // Add all files to form data
    files.forEach((file) => {
      formData.append('files', file);
    });

    // Add merge strategy
    formData.append('merge_strategy', mergeStrategy);

    // Add metadata
    formData.append('organization_id', tenantId);
    if (organizationId) {
      formData.append('organization_id', organizationId);
    }
    if (projectId) {
      formData.append('project_id', projectId);
    }
    if (name) {
      formData.append('name', name);
    }
    if (description) {
      formData.append('description', description);
    }

    const authHeaders = await getAuthHeaders();
    const response = await fetch(`${this.baseURL}/api/bom/merge`, {
      method: 'POST',
      headers: authHeaders,
      body: formData,
      // Let browser set Content-Type with boundary for multipart/form-data
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(errorData.message || `Merge failed: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Bulk upload multiple BOM files with central catalog integration
   * Merges files and saves enriched components to central component catalog
   */
  async bulkUpload(
    files: File[],
    mergeStrategy: 'sum_quantity' | 'max_quantity' | 'first_only',
    tenantId: string,
    organizationId?: string,
    projectId?: string,
    name?: string,
    description?: string,
    saveToCentralCatalog: boolean = true
  ): Promise<UploadBOMResponse> {
    const formData = new FormData();

    // Add all files to form data
    files.forEach((file) => {
      formData.append('files', file);
    });

    // Add merge strategy
    formData.append('merge_strategy', mergeStrategy);

    // Add metadata
    formData.append('organization_id', tenantId);
    if (organizationId) {
      formData.append('organization_id', organizationId);
    }
    if (projectId) {
      formData.append('project_id', projectId);
    }
    if (name) {
      formData.append('name', name);
    }
    if (description) {
      formData.append('description', description);
    }
    formData.append('save_to_central_catalog', saveToCentralCatalog.toString());

    const authHeaders = await getAuthHeaders();
    const response = await fetch(`${this.baseURL}/api/bom/bulk-upload`, {
      method: 'POST',
      headers: authHeaders,
      body: formData,
      // Let browser set Content-Type with boundary for multipart/form-data
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(errorData.message || `Bulk upload failed: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Search Component Vault by MPN, manufacturer, category, or description
   */
  async searchComponentCatalog(params: {
    query: string;
    search_type?: 'all' | 'mpn' | 'manufacturer' | 'category' | 'description';
    limit?: number;
  }): Promise<ComponentCatalogSearchResponse> {
    const searchParams = new URLSearchParams({
      query: params.query,
      search_type: params.search_type || 'all',
      limit: (params.limit || 50).toString(),
    });

    const authHeaders = await getAuthHeaders();
    const response = await fetch(`${this.baseURL}/api/catalog/search?${searchParams}`, {
      headers: authHeaders,
    });

    if (!response.ok) {
      throw new Error(`Component catalog search failed: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get component details from Component Vault by component_id
   */
  async getComponentById(componentId: string): Promise<ComponentCatalogDetail> {
    console.log(`[CNS API] 🔍 Fetching component by ID: ${componentId}`);
    const startTime = performance.now();

    try {
      const authHeaders = await getAuthHeaders();
      const response = await fetch(`${this.baseURL}/api/catalog/component/id/${componentId}`, {
        headers: authHeaders,
      });
      const duration = (performance.now() - startTime).toFixed(2);

      if (!response.ok) {
        console.error(`[CNS API] ❌ Failed to fetch component ${componentId} (${response.status} ${response.statusText}) - ${duration}ms`);
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Failed to fetch component ${componentId}: ${response.statusText} - ${errorData.detail || ''}`);
      }

      const data = await response.json();
      console.log(`[CNS API] ✅ Fetched component ${componentId}: ${data.mpn} (${data.manufacturer}) - Quality: ${data.quality_score} - ${duration}ms`);
      console.debug(`[CNS API] 📋 Component ${componentId} fields:`, {
        has_stock_quantity: data.stock_quantity !== null && data.stock_quantity !== undefined,
        has_parameters: Object.keys(data.parameters || {}).length,
        has_specifications: Object.keys(data.specifications || {}).length,
        has_pricing: data.pricing?.length || 0,
        aec_qualified: data.aec_qualified,
        halogen_free: data.halogen_free
      });

      return data;
    } catch (error) {
      const duration = (performance.now() - startTime).toFixed(2);
      console.error(`[CNS API] ❌ Error fetching component ${componentId} after ${duration}ms:`, error);
      throw error;
    }
  }

  /**
   * Get multiple components by their IDs (batch fetch)
   */
  async getComponentsByIds(componentIds: string[]): Promise<ComponentCatalogDetail[]> {
    console.log(`[CNS API] 📦 Batch fetching ${componentIds.length} components`);
    const startTime = performance.now();

    // Fetch components in parallel
    const promises = componentIds.map(id => this.getComponentById(id).catch((error) => {
      console.warn(`[CNS API] ⚠️ Failed to fetch component ${id}:`, error.message);
      return null;
    }));
    const results = await Promise.all(promises);

    // Filter out failed fetches
    const validResults = results.filter((c): c is ComponentCatalogDetail => c !== null);
    const duration = (performance.now() - startTime).toFixed(2);

    console.log(`[CNS API] ✅ Batch fetch complete: ${validResults.length}/${componentIds.length} successful - ${duration}ms`);

    if (validResults.length < componentIds.length) {
      const failedCount = componentIds.length - validResults.length;
      console.warn(`[CNS API] ⚠️ ${failedCount} component(s) failed to fetch`);
    }

    return validResults;
  }

  /**
   * Submit components for vault review
   */
  async submitVaultRequest(payload: VaultReviewRequestPayload): Promise<{ request_id: string }> {
    const authHeaders = await getAuthHeaders();
    const response = await fetch(`${this.baseURL}/api/catalog/vault/requests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: response.statusText }));
      throw new Error(errorData.detail || 'Failed to submit vault request');
    }

    return response.json();
  }

  /**
   * Update component stage within the vault workflow
   */
  async updateVaultComponentStage(componentId: string, stage: VaultStageUpdatePayload['stage'], notes?: string): Promise<void> {
    const authHeaders = await getAuthHeaders();
    const response = await fetch(`${this.baseURL}/api/catalog/components/${componentId}/stage`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
      body: JSON.stringify({ stage, notes }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: response.statusText }));
      throw new Error(errorData.detail || 'Failed to update vault stage');
    }
  }
}

// Export singleton instance
export const cnsApi = new CNSApiClient();

// Export class for testing
export { CNSApiClient };

// Export types
export type {
  UploadBOMResponse,
  LegacyUploadBOMResponse,
  ConfirmMappingResponse,
  JobStatusResponse,
  ComponentResult,
  RetryJobResponse,
};
