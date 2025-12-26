/**
 * Account Service - Handles account management API calls
 *
 * Endpoints:
 * - GET /api/account/status - Get account status
 * - GET /api/account/deletion-reasons - Get deletion reason options
 * - GET /api/account/delete/status - Get deletion status
 * - POST /api/account/delete - Schedule account deletion
 * - POST /api/account/delete/cancel - Cancel scheduled deletion
 */

import { getAuthHeaders } from './cnsApi';

// Get CNS API URL from environment
const getCnsApiUrl = (): string => {
  return import.meta.env.VITE_CNS_API_URL || 'http://localhost:27800';
};

// Types
export interface AccountStatus {
  organization_id: string;
  organization_name: string;
  org_type: string;
  subscription_status: string;
  plan_tier: string;
  is_suspended: boolean;
  deletion_scheduled: boolean;
  deletion_scheduled_at: string | null;
  days_until_deletion: number | null;
  can_be_deleted: boolean;
  created_at: string;
  trial_end: string | null;
}

export interface DeletionReason {
  id: string;
  label: string;
  description: string;
}

export interface DeletionStatus {
  deletion_scheduled: boolean;
  deletion_scheduled_at: string | null;
  grace_period_days: number;
  days_remaining: number | null;
  can_cancel: boolean;
  reason: string | null;
  scheduled_by: string | null;
}

export interface DeleteAccountRequest {
  reason: string;
  feedback?: string;
  confirm_text: string;
}

export interface DeleteAccountResponse {
  success: boolean;
  message: string;
  deletion_scheduled_at: string;
  grace_period_days: number;
}

export interface CancelDeletionResponse {
  success: boolean;
  message: string;
}

class AccountService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = getCnsApiUrl();
  }

  /**
   * Get current account status
   */
  async getAccountStatus(): Promise<AccountStatus> {
    console.log('[AccountService] getAccountStatus calling:', `${this.baseUrl}/api/account/status`);
    const authHeaders = await getAuthHeaders();
    const response = await fetch(`${this.baseUrl}/api/account/status`, {
      method: 'GET',
      headers: authHeaders,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to get account status' }));
      throw new Error(error.detail || error.message || 'Failed to get account status');
    }

    return response.json();
  }

  /**
   * Get available deletion reasons
   */
  async getDeletionReasons(): Promise<DeletionReason[]> {
    console.log('[AccountService] getDeletionReasons calling:', `${this.baseUrl}/api/account/deletion-reasons`);
    const authHeaders = await getAuthHeaders();
    const response = await fetch(`${this.baseUrl}/api/account/deletion-reasons`, {
      method: 'GET',
      headers: authHeaders,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to get deletion reasons' }));
      throw new Error(error.detail || error.message || 'Failed to get deletion reasons');
    }

    return response.json();
  }

  /**
   * Get deletion status (if deletion is scheduled)
   */
  async getDeletionStatus(): Promise<DeletionStatus> {
    console.log('[AccountService] getDeletionStatus calling:', `${this.baseUrl}/api/account/delete/status`);
    const authHeaders = await getAuthHeaders();
    const response = await fetch(`${this.baseUrl}/api/account/delete/status`, {
      method: 'GET',
      headers: authHeaders,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to get deletion status' }));
      throw new Error(error.detail || error.message || 'Failed to get deletion status');
    }

    return response.json();
  }

  /**
   * Schedule account deletion (GDPR-compliant 30-day grace period)
   */
  async scheduleAccountDeletion(request: DeleteAccountRequest): Promise<DeleteAccountResponse> {
    console.log('[AccountService] scheduleAccountDeletion calling:', `${this.baseUrl}/api/account/delete`);
    const authHeaders = await getAuthHeaders();
    const response = await fetch(`${this.baseUrl}/api/account/delete`, {
      method: 'POST',
      headers: {
        ...authHeaders,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to schedule deletion' }));
      throw new Error(error.detail || error.message || 'Failed to schedule account deletion');
    }

    return response.json();
  }

  /**
   * Cancel scheduled account deletion
   */
  async cancelAccountDeletion(): Promise<CancelDeletionResponse> {
    console.log('[AccountService] cancelAccountDeletion calling:', `${this.baseUrl}/api/account/delete/cancel`);
    const authHeaders = await getAuthHeaders();
    const response = await fetch(`${this.baseUrl}/api/account/delete/cancel`, {
      method: 'POST',
      headers: authHeaders,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to cancel deletion' }));
      throw new Error(error.detail || error.message || 'Failed to cancel account deletion');
    }

    return response.json();
  }
}

// Export singleton instance
export const accountService = new AccountService();
export default accountService;
