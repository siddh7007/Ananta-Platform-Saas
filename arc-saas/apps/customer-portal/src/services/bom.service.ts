import { cnsApi, assertTenantContext, getTenantIdOrNull } from '@/lib/axios';
import type {
  BomActivityEvent,
  BomVersion,
  BomHistoryResponse,
} from '@/types/activity';

/**
 * BOM (Bill of Materials) service
 * Handles BOM-specific operations beyond CRUD
 *
 * NOTE: Field transformation (snake_case -> camelCase) is handled automatically
 * by the cnsApi axios interceptor in @/lib/axios.ts:
 * - component_count -> lineCount
 * - enriched_count -> enrichedCount
 * - filename/file_name -> fileName
 * - organization_id -> organizationId
 * - etc.
 */

export interface BomUploadRequest {
  file: File;
  name?: string;
  description?: string;
  projectId?: string;
}

export interface BomUploadResponse {
  bomId: string;
  fileName: string;
  lineCount: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
}

export interface BomEnrichmentRequest {
  bomId: string;
  options?: {
    enrichmentLevel?: 'basic' | 'standard' | 'comprehensive';
    includeAlternates?: boolean;
    includeObsolescence?: boolean;
  };
}

export interface BomEnrichmentStatus {
  bomId: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  progress: number;
  enrichedCount: number;
  totalCount: number;
  startedAt?: string;
  completedAt?: string;
  error?: string;
}

export interface BomExportRequest {
  bomId: string;
  format: 'csv' | 'xlsx' | 'json';
  includeEnrichment?: boolean;
}

export interface BomSummary {
  id: string;
  name: string;
  fileName: string;
  lineCount: number;
  enrichedCount: number;
  status: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Upload a BOM file
 * Requires organization_id for multi-tenant isolation
 */
export async function uploadBom(request: BomUploadRequest): Promise<BomUploadResponse> {
  // Get organization ID (same as tenant ID in our architecture)
  const organizationId = getTenantIdOrNull();
  console.log('[bom.service] uploadBom called, organizationId:', organizationId, 'type:', typeof organizationId);
  console.log('[bom.service] localStorage cbp_selected_tenant:', localStorage.getItem('cbp_selected_tenant'));

  if (!organizationId) {
    console.error('[bom.service] No organization ID found - throwing error');
    throw new Error('No tenant/organization selected. Please select a tenant before uploading.');
  }

  const formData = new FormData();
  formData.append('file', request.file);
  formData.append('organization_id', organizationId);
  console.log('[bom.service] FormData organization_id appended:', organizationId);
  if (request.name) formData.append('name', request.name);
  if (request.description) formData.append('description', request.description);
  if (request.projectId) {
    formData.append('project_id', request.projectId);
    console.log('[bom.service] FormData project_id appended:', request.projectId);
  } else {
    console.warn('[bom.service] No project_id provided - BOM will use default project assignment');
  }

  // Don't set Content-Type header manually - let axios detect FormData and set it
  // with the proper multipart/form-data boundary. Setting it manually without
  // the boundary causes the server to fail to parse the form fields.
  const response = await cnsApi.post('/boms/upload', formData, {
    timeout: 60000, // 60 second timeout for file uploads
  });

  // Transform API response fields to match frontend types
  // API returns: component_count, enriched_count
  // Frontend expects: lineCount, enrichedCount
  const data = response.data;
  return {
    bomId: data.bomId || data.bom_id || data.id,
    fileName: data.fileName || data.file_name || data.name,
    lineCount: data.lineCount ?? data.line_count ?? data.component_count ?? 0,
    status: data.status || 'pending',
  };
}

/**
 * Start enrichment for a BOM
 */
export async function startEnrichment(request: BomEnrichmentRequest): Promise<BomEnrichmentStatus> {
  const response = await cnsApi.post(`/boms/${request.bomId}/enrich`, {
    options: request.options,
  });

  return response.data;
}

/**
 * Get enrichment status for a BOM
 */
export async function getEnrichmentStatus(bomId: string): Promise<BomEnrichmentStatus> {
  const response = await cnsApi.get(`/boms/${bomId}/enrichment-status`);
  return response.data;
}

/**
 * Export a BOM to specified format
 */
export async function exportBom(request: BomExportRequest): Promise<Blob> {
  const response = await cnsApi.get(`/boms/${request.bomId}/export`, {
    params: {
      format: request.format,
      includeEnrichment: request.includeEnrichment,
    },
    responseType: 'blob',
  });

  return response.data;
}

/**
 * Get BOM summary statistics
 */
export async function getBomSummary(bomId: string): Promise<BomSummary> {
  const response = await cnsApi.get(`/boms/${bomId}/summary`);
  // Field transformation handled by axios interceptor
  return response.data;
}

/**
 * Get all BOMs for current tenant (paginated)
 */
export async function listBoms(params?: {
  page?: number;
  limit?: number;
  status?: string;
  search?: string;
}): Promise<{ data: BomSummary[]; total: number }> {
  const response = await cnsApi.get('/boms', {
    params: {
      page: params?.page ?? 1,
      limit: params?.limit ?? 20,
      status: params?.status,
      search: params?.search,
    },
  });

  // Field transformation handled by axios interceptor
  const data = response.data.data ?? response.data.items ?? response.data;

  return {
    data: Array.isArray(data) ? data : [],
    total: response.data.total ?? (Array.isArray(data) ? data.length : 0),
  };
}

/**
 * Delete a BOM
 */
export async function deleteBom(bomId: string): Promise<void> {
  await cnsApi.delete(`/boms/${bomId}`);
}

/**
 * Duplicate a BOM
 */
export async function duplicateBom(bomId: string, newName?: string): Promise<BomSummary> {
  const response = await cnsApi.post(`/boms/${bomId}/duplicate`, {
    name: newName,
  });

  return response.data;
}

/**
 * Link a component to a BOM line item
 * This updates the BOM line with the matched component ID
 */
export interface LinkComponentRequest {
  bomId: string;
  lineItemId: string;
  componentId: string;
  matchType?: 'manual' | 'exact' | 'functional' | 'form_fit';
}

export interface LinkComponentResponse {
  success: boolean;
  lineItemId: string;
  componentId: string;
  previousComponentId?: string;
}

export async function linkComponentToLine(request: LinkComponentRequest): Promise<LinkComponentResponse> {
  const response = await cnsApi.patch(
    `/boms/${request.bomId}/line_items/${request.lineItemId}/link`,
    {
      componentId: request.componentId,
      matchType: request.matchType ?? 'manual',
    }
  );

  return response.data;
}

/**
 * Unlink a component from a BOM line item
 */
export async function unlinkComponentFromLine(
  bomId: string,
  lineItemId: string
): Promise<{ success: boolean }> {
  const response = await cnsApi.patch(
    `/boms/${bomId}/line_items/${lineItemId}/unlink`
  );

  return response.data;
}

/**
 * Get BOM line items with their linked components
 */
export interface BomLineItemsResponse {
  data: BomLineItemWithComponent[];
  total: number;
  page: number;
  limit: number;
}

export interface BomLineItemWithComponent {
  id: string;
  bomId: string;
  lineNumber: number;
  mpn: string;
  manufacturer?: string;
  description?: string;
  quantity: number;
  designator?: string;
  enrichmentStatus: string;
  matchedComponentId?: string;
  matchConfidence?: number;
  matchType?: string;
  linkedAt?: string;
  linkedBy?: string;
  component?: {
    id: string;
    mpn: string;
    manufacturer: string;
    description?: string;
    lifecycleStatus?: string;
    datasheetUrl?: string;
  };
}

export async function getBomLineItems(
  bomId: string,
  params?: {
    page?: number;
    limit?: number;
    status?: string;
    search?: string;
  }
): Promise<BomLineItemsResponse> {
  const response = await cnsApi.get(`/boms/${bomId}/line_items`, {
    params: {
      page: params?.page ?? 1,
      limit: params?.limit ?? 50,
      status: params?.status,
      search: params?.search,
    },
  });

  return {
    data: response.data.data ?? response.data,
    total: response.data.total ?? response.data.length,
    page: params?.page ?? 1,
    limit: params?.limit ?? 50,
  };
}

/**
 * Get BOM history (activity log and versions)
 * Requires tenant context for multi-tenant isolation
 */
export interface GetBomHistoryParams {
  page?: number;
  limit?: number;
  eventTypes?: string[];
}

export async function getBomHistory(
  bomId: string,
  params?: GetBomHistoryParams
): Promise<BomHistoryResponse> {
  // Ensure tenant is selected before fetching history
  assertTenantContext();

  const response = await cnsApi.get(`/boms/${bomId}/history`, {
    params: {
      page: params?.page ?? 1,
      limit: params?.limit ?? 50,
      eventTypes: params?.eventTypes?.join(','),
    },
  });

  return response.data;
}

/**
 * Get BOM activity events only
 * Requires tenant context for multi-tenant isolation
 */
export async function getBomActivities(
  bomId: string,
  params?: { page?: number; limit?: number }
): Promise<{ data: BomActivityEvent[]; total: number }> {
  // Ensure tenant is selected before fetching activities
  assertTenantContext();

  const response = await cnsApi.get(`/boms/${bomId}/activities`, {
    params: {
      page: params?.page ?? 1,
      limit: params?.limit ?? 50,
    },
  });

  return {
    data: response.data.data ?? response.data,
    total: response.data.total ?? response.data.length,
  };
}

/**
 * Get BOM versions
 * Requires tenant context for multi-tenant isolation
 */
export async function getBomVersions(
  bomId: string
): Promise<{ data: BomVersion[]; total: number }> {
  // Ensure tenant is selected before fetching versions
  assertTenantContext();

  const response = await cnsApi.get(`/boms/${bomId}/versions`);

  return {
    data: response.data.data ?? response.data,
    total: response.data.total ?? response.data.length,
  };
}

/**
 * Restore a BOM to a previous version
 * Requires tenant context for multi-tenant isolation
 */
export interface RestoreVersionRequest {
  bomId: string;
  versionId: string;
  comment?: string;
}

export interface RestoreVersionResponse {
  success: boolean;
  newVersionId: string;
  newVersionNumber: number;
}

export async function restoreBomVersion(
  request: RestoreVersionRequest
): Promise<RestoreVersionResponse> {
  // Ensure tenant is selected before restoring version
  assertTenantContext();

  const response = await cnsApi.post(
    `/boms/${request.bomId}/versions/${request.versionId}/restore`,
    { comment: request.comment }
  );

  return response.data;
}

/**
 * Create a manual version/snapshot of the current BOM state
 * Requires tenant context for multi-tenant isolation
 */
export interface CreateVersionRequest {
  bomId: string;
  comment?: string;
}

export async function createBomVersion(
  request: CreateVersionRequest
): Promise<BomVersion> {
  // Ensure tenant is selected before creating version
  assertTenantContext();

  const response = await cnsApi.post(`/boms/${request.bomId}/versions`, {
    comment: request.comment,
  });

  return response.data;
}

/**
 * Get workflow status for a BOM
 */
export interface WorkflowStatusResponse {
  jobId: string;
  workflowId: string;
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
  progress?: {
    totalItems: number;
    enrichedItems: number;
    failedItems: number;
    pendingItems: number;
    percentComplete: number;
  };
}

export async function getWorkflowStatus(bomId: string): Promise<WorkflowStatusResponse> {
  const response = await cnsApi.get(`/bom/workflow/${bomId}/status`);
  return response.data;
}

/**
 * Get detailed processing status for a BOM (for Queue Cards UI)
 */
export interface ProcessingStageInfo {
  stage: string;
  status: string;
  progress: number;
  message?: string;
  details?: string;
  startedAt?: string;
  completedAt?: string;
  itemsProcessed?: number;
  totalItems?: number;
  errorMessage?: string;
}

export interface ProcessingStatusResponse {
  bomId: string;
  organizationId: string;
  workflowId: string;
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
  currentStage: string;
  stages: Record<string, ProcessingStageInfo>;
  totalItems: number;
  enrichedItems: number;
  failedItems: number;
  riskScoredItems: number;
  healthGrade?: string;
  averageRiskScore?: number;
  errorMessage?: string;
  startedAt?: string;
  completedAt?: string;
  pausedAt?: string;
}

export async function getProcessingStatus(bomId: string): Promise<ProcessingStatusResponse> {
  assertTenantContext();
  const response = await cnsApi.get(`/bom/workflow/${bomId}/processing-status`);
  return response.data;
}

/**
 * Pause a BOM processing workflow
 */
export async function pauseWorkflow(bomId: string): Promise<{ bomId: string; workflowId: string; status: string; message: string }> {
  assertTenantContext();
  const response = await cnsApi.post(`/bom/workflow/${bomId}/pause`);
  return response.data;
}

/**
 * Resume a paused BOM processing workflow
 */
export async function resumeWorkflow(bomId: string): Promise<{ bomId: string; workflowId: string; status: string; message: string }> {
  assertTenantContext();
  const response = await cnsApi.post(`/bom/workflow/${bomId}/resume`);
  return response.data;
}

/**
 * Cancel a running BOM processing workflow
 */
export async function cancelWorkflow(bomId: string): Promise<{ bomId: string; workflowId: string; status: string }> {
  assertTenantContext();
  const response = await cnsApi.post(`/bom/workflow/${bomId}/cancel`);
  return response.data;
}

/**
 * Restart a BOM processing workflow from the beginning
 */
export async function restartWorkflow(bomId: string): Promise<{ bomId: string; workflowId: string; status: string; message: string }> {
  assertTenantContext();
  const response = await cnsApi.post(`/bom/workflow/${bomId}/restart`);
  return response.data;
}

/**
 * List all processing jobs for the current organization
 */
export interface ProcessingJobListItem {
  bomId: string;
  bomName?: string;
  workflowId: string;
  status: string;
  currentStage: string;
  overallProgress: number;
  totalItems: number;
  enrichedItems: number;
  failedItems: number;
  healthGrade?: string;
  startedAt?: string;
  updatedAt?: string;
  canPause: boolean;
  canResume: boolean;
  canCancel: boolean;
}

export interface ProcessingJobListResponse {
  jobs: ProcessingJobListItem[];
  total: number;
}

export async function listProcessingJobs(statusFilter?: string): Promise<ProcessingJobListResponse> {
  assertTenantContext();
  const params: Record<string, string> = {};
  if (statusFilter) {
    params.status_filter = statusFilter;
  }
  const response = await cnsApi.get('/bom/workflow/jobs', { params });
  return response.data;
}

/**
 * Get a presigned URL to download the original raw BOM file
 *
 * @param bomId - The BOM ID
 * @returns Download URL response with URL, filename, and expiration
 */
export interface RawFileDownloadResponse {
  downloadUrl: string;
  filename: string;
  expiresInSeconds: number;
}

export async function getRawFileDownloadUrl(bomId: string): Promise<RawFileDownloadResponse> {
  assertTenantContext();
  const response = await cnsApi.get(`/bom/workflow/${bomId}/download-raw`);
  return response.data;
}

/**
 * Download the raw BOM file - opens in a new tab
 *
 * @param bomId - The BOM ID
 */
export async function downloadRawFile(bomId: string): Promise<void> {
  try {
    const { downloadUrl } = await getRawFileDownloadUrl(bomId);
    // Open the presigned URL in a new tab
    window.open(downloadUrl, '_blank');
  } catch (error) {
    console.error('[bom.service] Failed to download raw file:', error);
    throw error;
  }
}

export default {
  uploadBom,
  startEnrichment,
  getEnrichmentStatus,
  exportBom,
  getBomSummary,
  listBoms,
  deleteBom,
  duplicateBom,
  linkComponentToLine,
  unlinkComponentFromLine,
  getBomLineItems,
  getBomHistory,
  getBomActivities,
  getBomVersions,
  restoreBomVersion,
  createBomVersion,
  // Workflow control
  getWorkflowStatus,
  getProcessingStatus,
  pauseWorkflow,
  resumeWorkflow,
  cancelWorkflow,
  restartWorkflow,
  listProcessingJobs,
  // File download
  getRawFileDownloadUrl,
  downloadRawFile,
};
