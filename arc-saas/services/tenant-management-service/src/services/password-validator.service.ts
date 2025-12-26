import {injectable, BindingScope} from '@loopback/core';
import {HttpErrors} from '@loopback/rest';

/**
 * Service for validating password strength.
 * Enforces password complexity requirements for security.
 */
@injectable({scope: BindingScope.TRANSIENT})
export class PasswordValidatorService {
  /**
   * Minimum password length required
   */
  private readonly MIN_LENGTH = 8;

  /**
   * Maximum password length allowed (prevent DoS attacks)
   */
  private readonly MAX_LENGTH = 128;

  /**
   * Validate password meets security requirements.
   * @param password - Password to validate
   * @throws HttpErrors.BadRequest if password doesn't meet requirements
   */
  validatePassword(password: string): void {
    if (!password || password.length === 0) {
      throw new HttpErrors.BadRequest('Password is required');
    }

    if (password.length < this.MIN_LENGTH) {
      throw new HttpErrors.BadRequest(
        `Password must be at least ${this.MIN_LENGTH} characters long`,
      );
    }

    if (password.length > this.MAX_LENGTH) {
      throw new HttpErrors.BadRequest(
        `Password must not exceed ${this.MAX_LENGTH} characters`,
      );
    }

    // Check for uppercase letters
    if (!/[A-Z]/.test(password)) {
      throw new HttpErrors.BadRequest(
        'Password must contain at least one uppercase letter (A-Z)',
      );
    }

    // Check for lowercase letters
    if (!/[a-z]/.test(password)) {
      throw new HttpErrors.BadRequest(
        'Password must contain at least one lowercase letter (a-z)',
      );
    }

    // Check for numbers
    if (!/[0-9]/.test(password)) {
      throw new HttpErrors.BadRequest(
        'Password must contain at least one number (0-9)',
      );
    }

    // Check for special characters
    if (!/[!@#$%^&*(),.?":{}|<>_\-+=[\]\\\/`~;']/.test(password)) {
      throw new HttpErrors.BadRequest(
        'Password must contain at least one special character (!@#$%^&*(),.?":{}|<>_-+=[]\\\/`~;\' etc.)',
      );
    }

    // Check for common weak passwords
    const commonPasswords = [
      'password',
      'password123',
      '12345678',
      'qwerty123',
      'abc123456',
      'test1234',
      'admin123',
    ];

    if (commonPasswords.includes(password.toLowerCase())) {
      throw new HttpErrors.BadRequest(
        'Password is too common. Please choose a more secure password',
      );
    }
  }

  /**
   * Get password requirements for display to users.
   * @returns Object with password requirements
   */
  getRequirements(): {
    minLength: number;
    maxLength: number;
    requirements: string[];
  } {
    return {
      minLength: this.MIN_LENGTH,
      maxLength: this.MAX_LENGTH,
      requirements: [
        'At least one uppercase letter (A-Z)',
        'At least one lowercase letter (a-z)',
        'At least one number (0-9)',
        'At least one special character (!@#$%^&* etc.)',
        'No common weak passwords',
      ],
    };
  }
}
