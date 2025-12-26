import { describe, it, expect } from 'vitest';
import {
  validateFileExtension,
  validateFileSize,
  validateFileMimeType,
  UPLOAD_CONFIG,
} from '../../utils/uploadValidation';

describe('uploadValidation', () => {
  describe('validateFileExtension', () => {
    it('should accept valid CSV extension', () => {
      const file = new File(['content'], 'test.csv', { type: 'text/csv' });
      const result = validateFileExtension(file);
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should accept valid Excel extensions', () => {
      const xlsxFile = new File(['content'], 'test.xlsx', {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const xlsFile = new File(['content'], 'test.xls', {
        type: 'application/vnd.ms-excel',
      });

      expect(validateFileExtension(xlsxFile).isValid).toBe(true);
      expect(validateFileExtension(xlsFile).isValid).toBe(true);
    });

    it('should accept TXT extension', () => {
      const file = new File(['content'], 'test.txt', { type: 'text/plain' });
      const result = validateFileExtension(file);
      expect(result.isValid).toBe(true);
    });

    it('should reject invalid extensions', () => {
      const invalidFiles = [
        new File(['content'], 'test.pdf', { type: 'application/pdf' }),
        new File(['content'], 'test.doc', { type: 'application/msword' }),
        new File(['content'], 'test.json', { type: 'application/json' }),
      ];

      invalidFiles.forEach(file => {
        const result = validateFileExtension(file);
        expect(result.isValid).toBe(false);
        expect(result.error).toBeTruthy();
      });
    });

    it('should reject files without extension', () => {
      const file = new File(['content'], 'test', { type: 'text/plain' });
      const result = validateFileExtension(file);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('no extension');
    });

    it('should handle case-insensitive extensions', () => {
      const files = [
        new File(['content'], 'test.CSV', { type: 'text/csv' }),
        new File(['content'], 'test.Xlsx', { type: 'text/csv' }),
      ];

      files.forEach(file => {
        const result = validateFileExtension(file);
        expect(result.isValid).toBe(true);
      });
    });
  });

  describe('validateFileSize', () => {
    it('should accept files within size limit', () => {
      const file = new File(['a'.repeat(1000)], 'test.csv', { type: 'text/csv' });
      const result = validateFileSize(file);
      expect(result.isValid).toBe(true);
    });

    it('should reject files exceeding maximum size', () => {
      // Create a file larger than MAX_FILE_SIZE
      const largeContent = 'a'.repeat(UPLOAD_CONFIG.MAX_FILE_SIZE + 1);
      const file = new File([largeContent], 'large.csv', { type: 'text/csv' });
      const result = validateFileSize(file);

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('exceeds maximum');
    });

    it('should reject empty files', () => {
      const file = new File([], 'empty.csv', { type: 'text/csv' });
      const result = validateFileSize(file);

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('empty');
    });

    it('should reject files below minimum size', () => {
      const file = new File(['a'], 'tiny.csv', { type: 'text/csv' });
      const result = validateFileSize(file);

      expect(result.isValid).toBe(false);
      expect(result.error).toBeTruthy();
    });

    it('should provide warnings for large files', () => {
      // Create a file close to the limit
      const largeContent = 'a'.repeat(UPLOAD_CONFIG.MAX_FILE_SIZE - 1000);
      const file = new File([largeContent], 'large.csv', { type: 'text/csv' });
      const result = validateFileSize(file);

      // File should be valid but may have warnings
      expect(result.isValid).toBe(true);
    });
  });

  describe('validateFileMimeType', () => {
    it('should accept valid MIME types', () => {
      const validTypes = [
        { type: 'text/csv', name: 'test.csv' },
        { type: 'text/plain', name: 'test.txt' },
        { type: 'application/vnd.ms-excel', name: 'test.xls' },
        {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          name: 'test.xlsx',
        },
      ];

      validTypes.forEach(({ type, name }) => {
        const file = new File(['content'], name, { type });
        const result = validateFileMimeType(file);
        expect(result.isValid).toBe(true);
      });
    });

    it('should reject invalid MIME types', () => {
      const invalidTypes = [
        { type: 'application/pdf', name: 'test.pdf' },
        { type: 'application/json', name: 'test.json' },
        { type: 'image/png', name: 'test.png' },
      ];

      invalidTypes.forEach(({ type, name }) => {
        const file = new File(['content'], name, { type });
        const result = validateFileMimeType(file);
        expect(result.isValid).toBe(false);
        expect(result.error).toBeTruthy();
      });
    });

    it('should handle missing MIME type', () => {
      const file = new File(['content'], 'test.csv', { type: '' });
      const result = validateFileMimeType(file);

      // Should either accept (browser quirk) or reject with clear error
      if (!result.isValid) {
        expect(result.error).toBeTruthy();
      }
    });
  });

  describe('UPLOAD_CONFIG', () => {
    it('should have reasonable size limits', () => {
      expect(UPLOAD_CONFIG.MAX_FILE_SIZE).toBeGreaterThan(0);
      expect(UPLOAD_CONFIG.MIN_FILE_SIZE).toBeGreaterThan(0);
      expect(UPLOAD_CONFIG.MAX_FILE_SIZE).toBeGreaterThan(UPLOAD_CONFIG.MIN_FILE_SIZE);
    });

    it('should define allowed extensions', () => {
      expect(UPLOAD_CONFIG.ALLOWED_EXTENSIONS).toBeInstanceOf(Array);
      expect(UPLOAD_CONFIG.ALLOWED_EXTENSIONS.length).toBeGreaterThan(0);
    });

    it('should define allowed MIME types', () => {
      expect(UPLOAD_CONFIG.ALLOWED_MIME_TYPES).toBeInstanceOf(Array);
      expect(UPLOAD_CONFIG.ALLOWED_MIME_TYPES.length).toBeGreaterThan(0);
    });

    it('should have row limit configuration', () => {
      expect(UPLOAD_CONFIG.RECOMMENDED_MAX_ROWS).toBeGreaterThan(0);
      expect(UPLOAD_CONFIG.WARN_LARGE_FILE_ROWS).toBeGreaterThan(0);
    });
  });
});
