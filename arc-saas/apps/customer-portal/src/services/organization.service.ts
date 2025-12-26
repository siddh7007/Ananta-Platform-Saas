import { platformApi } from '@/lib/axios';
import type {
  Organization,
  OrganizationUpdatePayload,
  OrganizationSettings,
} from '@/types/organization';

// Re-export types for convenience
export type { Organization, OrganizationUpdatePayload, OrganizationSettings } from '@/types/organization';

/**
 * Organization Service
 * Handles organization/tenant settings and management
 * Requires X-Tenant-Id header (set by axios interceptor)
 */

// ============================================
// Organization CRUD (tenant-scoped)
// ============================================

/**
 * Get current organization details
 * All authenticated users can read
 */
export async function getOrganization(): Promise<Organization> {
  const response = await platformApi.get('/tenants/current');
  return response.data;
}

/**
 * Update organization details
 * Requires admin+ role (backend enforces via X-Tenant-Id + role check)
 */
export async function updateOrganization(
  payload: OrganizationUpdatePayload
): Promise<Organization> {
  const response = await platformApi.patch('/tenants/current', payload);
  return response.data;
}

/**
 * Get organization by ID (for multi-tenant users)
 */
export async function getOrganizationById(id: string): Promise<Organization> {
  const response = await platformApi.get(`/tenants/${id}`);
  return response.data;
}

// ============================================
// Organization Settings
// ============================================

/**
 * Get organization settings/preferences
 */
export async function getOrganizationSettings(): Promise<OrganizationSettings> {
  const response = await platformApi.get('/tenants/current/settings');
  return response.data;
}

/**
 * Update organization settings
 * Requires admin+ role
 */
export async function updateOrganizationSettings(
  settings: Partial<OrganizationSettings>
): Promise<OrganizationSettings> {
  const response = await platformApi.patch('/tenants/current/settings', settings);
  return response.data;
}

// ============================================
// Domain Management
// ============================================

/**
 * Get organization domains
 */
export async function getOrganizationDomains(): Promise<string[]> {
  const response = await platformApi.get('/tenants/current/domains');
  return response.data.domains ?? response.data;
}

/**
 * Add a domain to organization
 * Requires admin+ role
 */
export async function addDomain(domain: string): Promise<{ success: boolean; domain: string }> {
  const response = await platformApi.post('/tenants/current/domains', { domain });
  return response.data;
}

/**
 * Remove a domain from organization
 * Requires admin+ role
 */
export async function removeDomain(domain: string): Promise<{ success: boolean }> {
  const response = await platformApi.delete(`/tenants/current/domains/${encodeURIComponent(domain)}`);
  return response.data;
}

/**
 * Verify a domain (trigger DNS verification)
 * Requires admin+ role
 */
export async function verifyDomain(domain: string): Promise<{
  verified: boolean;
  status: 'pending' | 'verified' | 'failed';
  dnsRecords?: { type: string; name: string; value: string }[];
}> {
  const response = await platformApi.post(`/tenants/current/domains/${encodeURIComponent(domain)}/verify`);
  return response.data;
}

// ============================================
// Organization Danger Zone (owner only)
// ============================================

/**
 * Delete organization
 * Requires owner role
 * Backend enforces confirmation and cleanup
 */
export async function deleteOrganization(
  confirmation: string
): Promise<{ success: boolean; message: string }> {
  const response = await platformApi.delete('/tenants/current', {
    data: { confirmation },
  });
  return response.data;
}

/**
 * Export organization data (GDPR compliance)
 * Requires owner role
 */
export async function exportOrganizationData(): Promise<{
  jobId: string;
  status: 'queued' | 'processing' | 'completed';
  downloadUrl?: string;
}> {
  const response = await platformApi.post('/tenants/current/export');
  return response.data;
}

/**
 * Check export job status
 */
export async function getExportStatus(jobId: string): Promise<{
  jobId: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  downloadUrl?: string;
  expiresAt?: string;
  error?: string;
}> {
  const response = await platformApi.get(`/tenants/current/export/${jobId}`);
  return response.data;
}

// ============================================
// Organization Logo
// ============================================

/**
 * Upload organization logo
 * Requires admin+ role
 */
export async function uploadLogo(file: File): Promise<{ logoUrl: string }> {
  const formData = new FormData();
  formData.append('logo', file);

  const response = await platformApi.post('/tenants/current/logo', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
}

/**
 * Remove organization logo
 * Requires admin+ role
 */
export async function removeLogo(): Promise<{ success: boolean }> {
  const response = await platformApi.delete('/tenants/current/logo');
  return response.data;
}

export default {
  getOrganization,
  updateOrganization,
  getOrganizationById,
  getOrganizationSettings,
  updateOrganizationSettings,
  getOrganizationDomains,
  addDomain,
  removeDomain,
  verifyDomain,
  deleteOrganization,
  exportOrganizationData,
  getExportStatus,
  uploadLogo,
  removeLogo,
};
