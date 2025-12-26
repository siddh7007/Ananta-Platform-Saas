/**
 * Upload Validation Utilities
 *
 * Provides comprehensive client-side validation for BOM file uploads:
 * - File format validation (CSV, Excel only)
 * - File size limits
 * - Duplicate detection
 * - File content validation
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

export const UPLOAD_CONFIG = {
  // File format restrictions
  ALLOWED_EXTENSIONS: ['csv', 'xlsx', 'xls', 'txt'],
  ALLOWED_MIME_TYPES: [
    'text/csv',
    'text/plain',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ],

  // File size limits
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  MAX_FILE_SIZE_LABEL: '10MB',
  MIN_FILE_SIZE: 100, // 100 bytes (essentially not empty)

  // Row limits (soft warnings)
  RECOMMENDED_MAX_ROWS: 10000,
  WARN_LARGE_FILE_ROWS: 5000,
};

// ============================================================================
// VALIDATION RESULT TYPES
// ============================================================================

export interface ValidationResult {
  isValid: boolean;
  error?: string;
  warnings?: string[];
}

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  previousUpload?: {
    filename: string;
    uploadedAt: Date;
    fileSize: number;
  };
}

// ============================================================================
// FILE FORMAT VALIDATION
// ============================================================================

/**
 * Validate file extension
 */
export function validateFileExtension(file: File): ValidationResult {
  const extension = file.name.split('.').pop()?.toLowerCase();

  if (!extension) {
    return {
      isValid: false,
      error: 'File has no extension',
    };
  }

  if (!UPLOAD_CONFIG.ALLOWED_EXTENSIONS.includes(extension)) {
    return {
      isValid: false,
      error: `Unsupported file type ".${extension}". Supported formats: ${UPLOAD_CONFIG.ALLOWED_EXTENSIONS.map((e) => `.${e}`).join(', ')}`,
    };
  }

  return { isValid: true };
}

/**
 * Validate MIME type (additional security check)
 */
export function validateMimeType(file: File): ValidationResult {
  // Empty MIME type is allowed (some browsers don't set it correctly)
  if (!file.type) {
    return {
      isValid: true,
      warnings: ['File MIME type could not be determined. Proceeding with extension-based validation.'],
    };
  }

  if (!UPLOAD_CONFIG.ALLOWED_MIME_TYPES.includes(file.type)) {
    return {
      isValid: false,
      error: `Unsupported file MIME type "${file.type}". Expected CSV or Excel format.`,
    };
  }

  return { isValid: true };
}

// ============================================================================
// FILE SIZE VALIDATION
// ============================================================================

/**
 * Validate file size
 */
export function validateFileSize(file: File): ValidationResult {
  const warnings: string[] = [];

  // Check minimum size
  if (file.size < UPLOAD_CONFIG.MIN_FILE_SIZE) {
    return {
      isValid: false,
      error: 'File is too small or empty. Please upload a valid BOM file.',
    };
  }

  // Check maximum size
  if (file.size > UPLOAD_CONFIG.MAX_FILE_SIZE) {
    return {
      isValid: false,
      error: `File size (${formatFileSize(file.size)}) exceeds maximum allowed size of ${UPLOAD_CONFIG.MAX_FILE_SIZE_LABEL}.`,
    };
  }

  // Warn about large files
  const largeSizeThreshold = 5 * 1024 * 1024; // 5MB
  if (file.size > largeSizeThreshold) {
    warnings.push(
      `Large file detected (${formatFileSize(file.size)}). Upload may take longer.`
    );
  }

  return {
    isValid: true,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ============================================================================
// DUPLICATE FILE DETECTION
// ============================================================================

const UPLOAD_HISTORY_KEY = 'bom_upload_history';
const MAX_HISTORY_ENTRIES = 50; // Keep last 50 uploads

export interface UploadHistoryEntry {
  filename: string;
  fileSize: number;
  fileHash: string; // Simple hash based on name + size
  uploadedAt: string; // ISO date string
}

/**
 * Generate simple file hash for duplicate detection
 */
function generateFileHash(file: File): string {
  return `${file.name}_${file.size}_${file.lastModified}`;
}

/**
 * Get upload history from localStorage
 */
function getUploadHistory(): UploadHistoryEntry[] {
  try {
    const history = localStorage.getItem(UPLOAD_HISTORY_KEY);
    return history ? JSON.parse(history) : [];
  } catch {
    return [];
  }
}

/**
 * Save upload history to localStorage
 */
function saveUploadHistory(history: UploadHistoryEntry[]): void {
  try {
    // Keep only the most recent entries
    const trimmed = history.slice(-MAX_HISTORY_ENTRIES);
    localStorage.setItem(UPLOAD_HISTORY_KEY, JSON.stringify(trimmed));
  } catch (error) {
    console.warn('Failed to save upload history:', error);
  }
}

/**
 * Check if file is a duplicate of a recent upload
 */
export function checkDuplicateFile(file: File): DuplicateCheckResult {
  const fileHash = generateFileHash(file);
  const history = getUploadHistory();

  // Check for duplicate in last 24 hours
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const duplicate = history.find((entry) => {
    const uploadDate = new Date(entry.uploadedAt);
    return entry.fileHash === fileHash && uploadDate > oneDayAgo;
  });

  if (duplicate) {
    return {
      isDuplicate: true,
      previousUpload: {
        filename: duplicate.filename,
        uploadedAt: new Date(duplicate.uploadedAt),
        fileSize: duplicate.fileSize,
      },
    };
  }

  return { isDuplicate: false };
}

/**
 * Record a successful file upload
 */
export function recordUpload(file: File): void {
  const history = getUploadHistory();
  const newEntry: UploadHistoryEntry = {
    filename: file.name,
    fileSize: file.size,
    fileHash: generateFileHash(file),
    uploadedAt: new Date().toISOString(),
  };

  history.push(newEntry);
  saveUploadHistory(history);
}

// ============================================================================
// COMPREHENSIVE VALIDATION
// ============================================================================

/**
 * Run all validations on a file
 */
export function validateBOMFile(file: File): ValidationResult {
  const results: ValidationResult[] = [];

  // 1. File extension validation
  results.push(validateFileExtension(file));

  // 2. MIME type validation
  results.push(validateMimeType(file));

  // 3. File size validation
  results.push(validateFileSize(file));

  // Collect all errors and warnings
  const errors = results.filter((r) => !r.isValid).map((r) => r.error!);
  const warnings = results
    .flatMap((r) => r.warnings || [])
    .filter((w) => w !== undefined);

  // Return first error if any
  if (errors.length > 0) {
    return {
      isValid: false,
      error: errors[0],
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  return {
    isValid: true,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

/**
 * Validate file with duplicate check
 */
export function validateBOMFileWithDuplicateCheck(file: File): ValidationResult & {
  duplicateInfo?: DuplicateCheckResult;
} {
  // Run standard validation
  const validation = validateBOMFile(file);

  // Check for duplicates
  const duplicateCheck = checkDuplicateFile(file);

  // Add duplicate warning if found
  if (duplicateCheck.isDuplicate && duplicateCheck.previousUpload) {
    const timeSince = new Date().getTime() - duplicateCheck.previousUpload.uploadedAt.getTime();
    const minutesAgo = Math.floor(timeSince / 60000);
    const timeLabel = minutesAgo < 60 ? `${minutesAgo} minutes ago` : `${Math.floor(minutesAgo / 60)} hours ago`;

    const warnings = validation.warnings || [];
    warnings.unshift(
      `This file "${duplicateCheck.previousUpload.filename}" was uploaded ${timeLabel}. Are you sure you want to upload it again?`
    );

    return {
      ...validation,
      warnings,
      duplicateInfo: duplicateCheck,
    };
  }

  return {
    ...validation,
    duplicateInfo: duplicateCheck,
  };
}

// ============================================================================
// COLUMN VALIDATION
// ============================================================================

/**
 * Validate that required columns are mapped
 */
export interface ColumnMapping {
  source: string;
  target: 'mpn' | 'manufacturer' | 'quantity' | 'reference' | 'description' | 'ignore';
}

export function validateRequiredColumns(mappings: ColumnMapping[]): ValidationResult {
  const hasMPN = mappings.some((m) => m.target === 'mpn');

  if (!hasMPN) {
    return {
      isValid: false,
      error: 'At least one column must be mapped to "Part Number (MPN)". This is required for component enrichment.',
    };
  }

  // Optional warnings for recommended columns
  const warnings: string[] = [];
  const hasManufacturer = mappings.some((m) => m.target === 'manufacturer');
  const hasQuantity = mappings.some((m) => m.target === 'quantity');

  if (!hasManufacturer) {
    warnings.push('No "Manufacturer" column mapped. Enrichment accuracy may be reduced.');
  }

  if (!hasQuantity) {
    warnings.push('No "Quantity" column mapped. Cost calculations will not be available.');
  }

  return {
    isValid: true,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}
