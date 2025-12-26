/**
 * BOM Upload Draft Persistence
 * Saves upload wizard state to localStorage for recovery after page refresh
 *
 * Security: Drafts are tenant-scoped and expire after 24 hours
 * Storage: Only metadata is stored, no File/Blob objects
 */

import type { ColumnMapping } from '@/utils/bomParser';

// Tenant-scoped key prefix
const DRAFT_KEY_PREFIX = 'bom_upload_draft_';
const DRAFT_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours
const STORAGE_QUOTA_ERROR = 'QuotaExceededError';

/**
 * Get the storage key for a specific tenant
 */
function getDraftKey(tenantId: string): string {
  return `${DRAFT_KEY_PREFIX}${tenantId}`;
}

export interface UploadDraft {
  /** Current step in the wizard (0-6) */
  currentStep: number;
  /** BOM name entered by user */
  bomName: string;
  /** BOM description */
  bomDescription: string;
  /** Parsed file metadata (NOT the raw file data) */
  parsedData: {
    columns: string[];
    detected_mappings: ColumnMapping[];
    unmapped_columns: string[];
    total_rows: number;
    detected_delimiter?: string;
  } | null;
  /** User-confirmed column mappings */
  confirmedMappings: Record<string, string>;
  /** Original filename (for display only) */
  fileName: string;
  /** File size in bytes (for validation) */
  fileSize?: number;
  /** Timestamp when draft was saved */
  savedAt: number;
  /** Tenant ID for validation */
  tenantId: string;
  /** Schema version for future migrations */
  schemaVersion: number;
}

const CURRENT_SCHEMA_VERSION = 1;

/**
 * Validate draft data structure
 */
function isValidDraft(data: unknown): data is UploadDraft {
  if (!data || typeof data !== 'object') return false;

  const draft = data as Record<string, unknown>;

  return (
    typeof draft.currentStep === 'number' &&
    typeof draft.bomName === 'string' &&
    typeof draft.bomDescription === 'string' &&
    typeof draft.fileName === 'string' &&
    typeof draft.savedAt === 'number' &&
    typeof draft.tenantId === 'string' &&
    typeof draft.confirmedMappings === 'object'
  );
}

/**
 * Save upload wizard draft to localStorage
 * Returns true if saved successfully, false if storage failed
 */
export function saveUploadDraft(
  draft: Omit<UploadDraft, 'savedAt' | 'schemaVersion'>
): boolean {
  try {
    const draftWithTimestamp: UploadDraft = {
      ...draft,
      savedAt: Date.now(),
      schemaVersion: CURRENT_SCHEMA_VERSION,
    };

    const key = getDraftKey(draft.tenantId);
    const serialized = JSON.stringify(draftWithTimestamp);

    // Check approximate size before saving (rough estimate)
    const sizeInBytes = new Blob([serialized]).size;
    if (sizeInBytes > 5 * 1024 * 1024) {
      // 5MB limit
      console.warn('Upload draft too large, not saving');
      return false;
    }

    localStorage.setItem(key, serialized);
    return true;
  } catch (error) {
    // Handle quota exceeded
    if (error instanceof Error && error.name === STORAGE_QUOTA_ERROR) {
      console.warn('localStorage quota exceeded, clearing old drafts');
      clearAllDrafts();
      // Try once more after clearing
      try {
        const key = getDraftKey(draft.tenantId);
        localStorage.setItem(
          key,
          JSON.stringify({
            ...draft,
            savedAt: Date.now(),
            schemaVersion: CURRENT_SCHEMA_VERSION,
          })
        );
        return true;
      } catch {
        return false;
      }
    }
    console.error('Failed to save upload draft:', error);
    return false;
  }
}

/**
 * Get upload wizard draft from localStorage
 * Returns null if no draft, draft is stale, corrupt, or belongs to different tenant
 */
export function getUploadDraft(currentTenantId: string): UploadDraft | null {
  try {
    const key = getDraftKey(currentTenantId);
    const stored = localStorage.getItem(key);
    if (!stored) return null;

    let draft: unknown;
    try {
      draft = JSON.parse(stored);
    } catch {
      // Corrupt JSON - clear it
      console.warn('Corrupt upload draft JSON, clearing');
      localStorage.removeItem(key);
      return null;
    }

    // Validate structure
    if (!isValidDraft(draft)) {
      console.warn('Invalid upload draft structure, clearing');
      localStorage.removeItem(key);
      return null;
    }

    // Check tenant match (defense in depth)
    if (draft.tenantId !== currentTenantId) {
      console.warn('Upload draft belongs to different tenant, clearing');
      localStorage.removeItem(key);
      return null;
    }

    // Check if draft is stale (with 5 minute buffer for clock skew)
    const age = Date.now() - draft.savedAt;
    const maxAgeWithBuffer = DRAFT_MAX_AGE_MS + 5 * 60 * 1000;
    if (age > maxAgeWithBuffer || age < 0) {
      // Negative age means future timestamp (clock skew)
      console.warn('Upload draft is stale or has invalid timestamp, clearing');
      localStorage.removeItem(key);
      return null;
    }

    return draft;
  } catch (error) {
    console.error('Failed to read upload draft:', error);
    return null;
  }
}

/**
 * Clear upload wizard draft for a specific tenant
 */
export function clearUploadDraft(tenantId: string): void {
  try {
    const key = getDraftKey(tenantId);
    localStorage.removeItem(key);
  } catch (error) {
    console.error('Failed to clear upload draft:', error);
  }
}

/**
 * Clear all upload drafts (used for quota recovery)
 */
function clearAllDrafts(): void {
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(DRAFT_KEY_PREFIX)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((key) => localStorage.removeItem(key));
  } catch (error) {
    console.error('Failed to clear all drafts:', error);
  }
}

/**
 * Check if an upload draft exists (without loading full data)
 */
export function hasUploadDraft(currentTenantId: string): boolean {
  try {
    const key = getDraftKey(currentTenantId);
    const stored = localStorage.getItem(key);
    if (!stored) return false;

    // Quick validation without full parse
    const draft = JSON.parse(stored) as { tenantId?: string; savedAt?: number };

    // Validate tenant and age
    if (draft.tenantId !== currentTenantId) return false;
    if (!draft.savedAt) return false;

    const age = Date.now() - draft.savedAt;
    if (age > DRAFT_MAX_AGE_MS || age < 0) return false;

    return true;
  } catch {
    return false;
  }
}

/**
 * Get draft age in human-readable format
 */
export function getDraftAge(draft: UploadDraft): string {
  const ageMs = Date.now() - draft.savedAt;

  // Handle negative age (clock skew)
  if (ageMs < 0) return 'just now';

  const ageMinutes = Math.floor(ageMs / 60000);
  const ageHours = Math.floor(ageMinutes / 60);

  if (ageMinutes < 1) return 'just now';
  if (ageMinutes < 60)
    return `${ageMinutes} minute${ageMinutes === 1 ? '' : 's'} ago`;
  return `${ageHours} hour${ageHours === 1 ? '' : 's'} ago`;
}

/**
 * Get time remaining until draft expires
 */
export function getDraftTimeRemaining(draft: UploadDraft): string {
  const expiresAt = draft.savedAt + DRAFT_MAX_AGE_MS;
  const remainingMs = expiresAt - Date.now();

  if (remainingMs <= 0) return 'expired';

  const remainingHours = Math.floor(remainingMs / (60 * 60 * 1000));
  const remainingMinutes = Math.floor(
    (remainingMs % (60 * 60 * 1000)) / 60000
  );

  if (remainingHours > 0) {
    return `${remainingHours}h ${remainingMinutes}m remaining`;
  }
  return `${remainingMinutes}m remaining`;
}

/**
 * Hook-friendly draft state management
 */
export function createDraftManager(tenantId: string) {
  return {
    save: (draft: Omit<UploadDraft, 'savedAt' | 'tenantId' | 'schemaVersion'>) =>
      saveUploadDraft({ ...draft, tenantId }),
    load: () => getUploadDraft(tenantId),
    clear: () => clearUploadDraft(tenantId),
    hasDraft: () => hasUploadDraft(tenantId),
  };
}
