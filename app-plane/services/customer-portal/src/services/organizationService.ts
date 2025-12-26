/**
 * Organization Settings Service
 *
 * Handles API calls for organization profile and settings management:
 * - GET /api/organization/settings - Get organization settings
 * - PATCH /api/organization/settings - Update organization settings
 * - GET /api/organization/slug/check - Check slug availability
 * - GET /api/organization/settings/audit - Get settings change audit log
 */

import { getAuthHeaders } from './cnsApi';

// Get CNS API URL from environment
const getCnsApiUrl = (): string => {
  return import.meta.env.VITE_CNS_API_URL || 'http://localhost:27800';
};

// =====================================================
// Types
// =====================================================

export interface OrganizationProfile {
  id: string;
  name: string;
  slug: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  logo_url: string | null;
  billing_email: string | null;
  org_type: string;
  created_at: string | null;
}

export interface SecuritySettings {
  require_mfa: boolean;
  session_timeout_minutes: number;
  password_policy: 'basic' | 'strong' | 'enterprise';
}

export interface ApiSettings {
  api_access_enabled: boolean;
  webhooks_enabled: boolean;
  webhook_url: string | null;
}

export interface DataRetentionSettings {
  data_retention_days: number;
  audit_log_retention_days: number;
}

export interface SsoSettings {
  sso_enabled: boolean;
  sso_provider: 'saml' | 'okta' | 'azure' | 'google';
}

export interface OrganizationSettings {
  profile: OrganizationProfile;
  security: SecuritySettings;
  api: ApiSettings;
  data_retention: DataRetentionSettings;
  sso: SsoSettings;
}

export interface UpdateOrganizationProfileRequest {
  name?: string;
  slug?: string;
  email?: string;
  phone?: string;
  address?: string;
  logo_url?: string;
  billing_email?: string;
}

export interface UpdateSecuritySettingsRequest {
  require_mfa?: boolean;
  session_timeout_minutes?: number;
  password_policy?: 'basic' | 'strong' | 'enterprise';
}

export interface UpdateApiSettingsRequest {
  api_access_enabled?: boolean;
  webhooks_enabled?: boolean;
  webhook_url?: string;
}

export interface UpdateDataRetentionRequest {
  data_retention_days?: number;
  audit_log_retention_days?: number;
}

export interface UpdateSsoSettingsRequest {
  sso_enabled?: boolean;
  sso_provider?: 'saml' | 'okta' | 'azure' | 'google';
}

export interface UpdateOrganizationSettingsRequest {
  profile?: UpdateOrganizationProfileRequest;
  security?: UpdateSecuritySettingsRequest;
  api?: UpdateApiSettingsRequest;
  data_retention?: UpdateDataRetentionRequest;
  sso?: UpdateSsoSettingsRequest;
}

export interface UpdateSettingsResponse {
  success: boolean;
  message: string;
  updated_fields?: string[];
}

export interface SlugCheckResponse {
  slug: string;
  available: boolean;
  suggested: string | null;
}

export interface AuditLogEntry {
  id: string;
  changed_by: string;
  changed_at: string;
  setting_name: string;
  old_value: string | null;
  new_value: string | null;
}

export interface AuditLogResponse {
  entries: AuditLogEntry[];
  total: number;
}

// =====================================================
// Organization Service Class
// =====================================================

class OrganizationService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = getCnsApiUrl();
  }

  /**
   * Get organization settings
   */
  async getSettings(): Promise<OrganizationSettings> {
    console.log('[OrganizationService] getSettings calling:', `${this.baseUrl}/api/organization/settings`);
    const authHeaders = await getAuthHeaders();
    const response = await fetch(`${this.baseUrl}/api/organization/settings`, {
      method: 'GET',
      headers: authHeaders,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to get organization settings' }));
      throw new Error(error.detail || error.message || 'Failed to get organization settings');
    }

    return response.json();
  }

  /**
   * Update organization settings
   */
  async updateSettings(request: UpdateOrganizationSettingsRequest): Promise<UpdateSettingsResponse> {
    console.log('[OrganizationService] updateSettings calling:', `${this.baseUrl}/api/organization/settings`);
    const authHeaders = await getAuthHeaders();
    const response = await fetch(`${this.baseUrl}/api/organization/settings`, {
      method: 'PATCH',
      headers: {
        ...authHeaders,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to update organization settings' }));
      throw new Error(error.detail || error.message || 'Failed to update organization settings');
    }

    return response.json();
  }

  /**
   * Update organization profile only
   */
  async updateProfile(profile: UpdateOrganizationProfileRequest): Promise<UpdateSettingsResponse> {
    return this.updateSettings({ profile });
  }

  /**
   * Update security settings only
   */
  async updateSecuritySettings(security: UpdateSecuritySettingsRequest): Promise<UpdateSettingsResponse> {
    return this.updateSettings({ security });
  }

  /**
   * Update API settings only
   */
  async updateApiSettings(api: UpdateApiSettingsRequest): Promise<UpdateSettingsResponse> {
    return this.updateSettings({ api });
  }

  /**
   * Update data retention settings only
   */
  async updateDataRetention(data_retention: UpdateDataRetentionRequest): Promise<UpdateSettingsResponse> {
    return this.updateSettings({ data_retention });
  }

  /**
   * Update SSO settings only
   */
  async updateSsoSettings(sso: UpdateSsoSettingsRequest): Promise<UpdateSettingsResponse> {
    return this.updateSettings({ sso });
  }

  /**
   * Check slug availability
   */
  async checkSlugAvailability(slug: string): Promise<SlugCheckResponse> {
    console.log('[OrganizationService] checkSlugAvailability calling:', `${this.baseUrl}/api/organization/slug/check`);
    const authHeaders = await getAuthHeaders();
    const response = await fetch(
      `${this.baseUrl}/api/organization/slug/check?slug=${encodeURIComponent(slug)}`,
      {
        method: 'GET',
        headers: authHeaders,
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to check slug availability' }));
      throw new Error(error.detail || error.message || 'Failed to check slug availability');
    }

    return response.json();
  }

  /**
   * Get settings audit log
   */
  async getAuditLog(limit: number = 50, offset: number = 0): Promise<AuditLogResponse> {
    console.log('[OrganizationService] getAuditLog calling:', `${this.baseUrl}/api/organization/settings/audit`);
    const authHeaders = await getAuthHeaders();
    const response = await fetch(
      `${this.baseUrl}/api/organization/settings/audit?limit=${limit}&offset=${offset}`,
      {
        method: 'GET',
        headers: authHeaders,
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to get audit log' }));
      throw new Error(error.detail || error.message || 'Failed to get audit log');
    }

    return response.json();
  }
}

// Export singleton instance
export const organizationService = new OrganizationService();
export default organizationService;
