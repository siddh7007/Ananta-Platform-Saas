/**
 * Onboarding Service
 *
 * Handles API calls for user onboarding and welcome notifications:
 * - POST /api/onboarding/welcome - Trigger welcome notification
 * - GET /api/onboarding/status - Get onboarding status
 * - POST /api/onboarding/checklist/{step} - Update checklist step
 */

import { getAuthHeaders } from './cnsApi';

// Get CNS API URL from environment
const getCnsApiUrl = (): string => {
  return import.meta.env.VITE_CNS_API_URL || 'http://localhost:27800';
};

// =====================================================
// Types
// =====================================================

export interface OnboardingChecklist {
  first_bom_uploaded: boolean;
  first_enrichment_complete: boolean;
  team_member_invited: boolean;
  alert_preferences_configured: boolean;
  risk_thresholds_set: boolean;
}

export interface OnboardingStatus {
  organization_id: string;
  organization_name: string;
  checklist: OnboardingChecklist;
  onboarding_completed_at: string | null;
  user_welcome_sent: boolean;
  user_first_login_at: string | null;
  trial_days_remaining: number | null;
}

export interface WelcomeResponse {
  success: boolean;
  message: string;
  already_sent: boolean;
}

export interface ChecklistUpdateResponse {
  success: boolean;
  step: string;
  completed: boolean;
  all_complete: boolean;
}

// =====================================================
// Local Storage Keys
// =====================================================
const WELCOME_TRIGGERED_KEY = 'onboarding_welcome_triggered';

// =====================================================
// Onboarding Service Class
// =====================================================

class OnboardingService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = getCnsApiUrl();
  }

  /**
   * Trigger welcome notification for current user.
   * This is idempotent - won't send if already sent.
   */
  async triggerWelcome(): Promise<WelcomeResponse> {
    console.log('[OnboardingService] Triggering welcome notification');

    // Check if we've already tried to trigger welcome in this session
    const alreadyTriggered = localStorage.getItem(WELCOME_TRIGGERED_KEY);
    if (alreadyTriggered === 'true') {
      console.log('[OnboardingService] Welcome already triggered in this session');
      return {
        success: true,
        message: 'Welcome already triggered',
        already_sent: true,
      };
    }

    try {
      const authHeaders = await getAuthHeaders();
      const response = await fetch(`${this.baseUrl}/api/onboarding/welcome`, {
        method: 'POST',
        headers: authHeaders,
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to trigger welcome' }));
        throw new Error(error.detail || error.message || 'Failed to trigger welcome');
      }

      const result = await response.json();

      // Mark as triggered to avoid repeated calls
      localStorage.setItem(WELCOME_TRIGGERED_KEY, 'true');

      return result;
    } catch (error) {
      console.error('[OnboardingService] Failed to trigger welcome:', error);
      throw error;
    }
  }

  /**
   * Get onboarding status for current user's organization.
   */
  async getStatus(): Promise<OnboardingStatus> {
    console.log('[OnboardingService] Getting onboarding status');

    const authHeaders = await getAuthHeaders();
    const response = await fetch(`${this.baseUrl}/api/onboarding/status`, {
      method: 'GET',
      headers: authHeaders,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to get onboarding status' }));
      throw new Error(error.detail || error.message || 'Failed to get onboarding status');
    }

    return response.json();
  }

  /**
   * Update an onboarding checklist step.
   */
  async updateChecklistStep(step: keyof OnboardingChecklist, completed: boolean = true): Promise<ChecklistUpdateResponse> {
    console.log('[OnboardingService] Updating checklist step:', step, completed);

    const authHeaders = await getAuthHeaders();
    const response = await fetch(`${this.baseUrl}/api/onboarding/checklist/${step}?completed=${completed}`, {
      method: 'POST',
      headers: authHeaders,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to update checklist' }));
      throw new Error(error.detail || error.message || 'Failed to update checklist');
    }

    return response.json();
  }

  /**
   * Mark first BOM uploaded.
   */
  async markBomUploaded(): Promise<ChecklistUpdateResponse> {
    return this.updateChecklistStep('first_bom_uploaded', true);
  }

  /**
   * Mark first enrichment complete.
   */
  async markEnrichmentComplete(): Promise<ChecklistUpdateResponse> {
    return this.updateChecklistStep('first_enrichment_complete', true);
  }

  /**
   * Mark team member invited.
   */
  async markMemberInvited(): Promise<ChecklistUpdateResponse> {
    return this.updateChecklistStep('team_member_invited', true);
  }

  /**
   * Mark alert preferences configured.
   */
  async markAlertsConfigured(): Promise<ChecklistUpdateResponse> {
    return this.updateChecklistStep('alert_preferences_configured', true);
  }

  /**
   * Mark risk thresholds set.
   */
  async markRiskThresholdsSet(): Promise<ChecklistUpdateResponse> {
    return this.updateChecklistStep('risk_thresholds_set', true);
  }

  /**
   * Check if welcome was already sent for this user.
   */
  async isWelcomeSent(): Promise<boolean> {
    try {
      const status = await this.getStatus();
      return status.user_welcome_sent;
    } catch {
      return false;
    }
  }

  /**
   * Clear the welcome triggered flag (for testing).
   */
  clearWelcomeTriggered(): void {
    localStorage.removeItem(WELCOME_TRIGGERED_KEY);
  }
}

// Export singleton instance
export const onboardingService = new OnboardingService();
export default onboardingService;
