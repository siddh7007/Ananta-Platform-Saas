/**
 * Cryptographic Utilities
 *
 * Secure implementations for password generation and other crypto operations.
 */

import * as crypto from 'crypto';

/**
 * Generate a cryptographically secure random password
 *
 * @param length - Password length (default: 24)
 * @param options - Password options
 * @returns Secure random password
 */
export function generateSecurePassword(
  length = 24,
  options: {
    includeUppercase?: boolean;
    includeLowercase?: boolean;
    includeNumbers?: boolean;
    includeSymbols?: boolean;
  } = {}
): string {
  const {
    includeUppercase = true,
    includeLowercase = true,
    includeNumbers = true,
    includeSymbols = true,
  } = options;

  let charset = '';
  if (includeLowercase) charset += 'abcdefghijklmnopqrstuvwxyz';
  if (includeUppercase) charset += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  if (includeNumbers) charset += '0123456789';
  if (includeSymbols) charset += '!@#$%^&*';

  if (charset.length === 0) {
    throw new Error('At least one character set must be enabled');
  }

  const randomBytes = crypto.randomBytes(length);
  let password = '';

  for (let i = 0; i < length; i++) {
    password += charset[randomBytes[i] % charset.length];
  }

  // Ensure at least one character from each enabled set
  const ensureCharFromSet = (set: string): void => {
    if (set.length === 0) return;

    const hasChar = [...password].some((c) => set.includes(c));
    if (!hasChar) {
      const pos = crypto.randomInt(0, length);
      const char = set[crypto.randomInt(0, set.length)];
      password = password.substring(0, pos) + char + password.substring(pos + 1);
    }
  };

  if (includeLowercase) ensureCharFromSet('abcdefghijklmnopqrstuvwxyz');
  if (includeUppercase) ensureCharFromSet('ABCDEFGHIJKLMNOPQRSTUVWXYZ');
  if (includeNumbers) ensureCharFromSet('0123456789');
  if (includeSymbols) ensureCharFromSet('!@#$%^&*');

  return password;
}

/**
 * Generate a random string (for IDs, tokens, etc.)
 *
 * @param length - String length
 * @param charset - Character set to use
 * @returns Random string
 */
export function generateRandomString(
  length: number,
  charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
): string {
  const randomBytes = crypto.randomBytes(length);
  let result = '';

  for (let i = 0; i < length; i++) {
    result += charset[randomBytes[i] % charset.length];
  }

  return result;
}

/**
 * Generate a UUID v4
 *
 * @returns UUID string
 */
export function generateUUID(): string {
  return crypto.randomUUID();
}

/**
 * Hash a string using SHA-256
 *
 * @param data - Data to hash
 * @returns Hex-encoded hash
 */
export function sha256(data: string): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Generate HMAC signature
 *
 * @param data - Data to sign
 * @param secret - Secret key
 * @returns Hex-encoded HMAC
 */
export function hmacSha256(data: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(data).digest('hex');
}
