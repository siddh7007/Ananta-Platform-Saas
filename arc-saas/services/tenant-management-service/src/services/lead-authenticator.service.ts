import {BindingScope, inject, injectable, service} from '@loopback/core';
import {ILogger, LOGGER} from '@sourceloop/core';
import {Lead, LeadToken} from '../models';
import {PermissionKey} from '../permissions';
import {NotificationService} from './notifications';
import {CryptoHelperService} from './crypto-helper.service';
import {repository} from '@loopback/repository';
import {LeadTokenRepository} from '../repositories';

// In-memory token store for local development when KV connector is not available
const inMemoryTokenStore = new Map<string, {token: string; expiresAt: number}>();

/**
 * Helper service for authenticating leads.
 */
@injectable({scope: BindingScope.SINGLETON})
export class LeadAuthenticator {
  /**
   * Constructs a new instance of the LeadAuthenticatorService.
   * @param {NotificationService} notificationService - Service for sending notifications.
   * @param {CryptoHelperService} cryptoHelperService - Service for cryptographic operations.
   * @param {ILogger} logger - Logger service for logging messages.
   */
  constructor(
    @service(NotificationService)
    private notificationService: NotificationService,
    @service(CryptoHelperService)
    private cryptoHelperService: CryptoHelperService,
    @repository(LeadTokenRepository)
    private leadTokenRepository: LeadTokenRepository,
    @inject(LOGGER.LOGGER_INJECT)
    private logger: ILogger,
  ) {}

  /**
   * Set a token in the store (with fallback to in-memory Map)
   */
  private async setToken(key: string, value: LeadToken): Promise<void> {
    if (typeof this.leadTokenRepository.set === 'function') {
      await this.leadTokenRepository.set(key, value);
    } else {
      // Fallback to in-memory store when KV connector is not available
      this.logger.warn('KV connector not available, using in-memory token store');
      inMemoryTokenStore.set(key, {token: value.token, expiresAt: Date.now() + (60 * 60 * 1000)});
    }
  }

  /**
   * Set expiration on a token (with fallback to in-memory Map)
   */
  private async expireToken(key: string, ttlMs: number): Promise<void> {
    if (typeof this.leadTokenRepository.expire === 'function') {
      await this.leadTokenRepository.expire(key, ttlMs);
    } else {
      // Update expiry in in-memory store
      const existing = inMemoryTokenStore.get(key);
      if (existing) {
        existing.expiresAt = Date.now() + ttlMs;
      }
    }
  }

  /**
   * Get a token from the store (with fallback to in-memory Map)
   */
  async getToken(key: string): Promise<LeadToken | null> {
    if (typeof this.leadTokenRepository.get === 'function') {
      return this.leadTokenRepository.get(key);
    } else {
      // Fallback to in-memory store
      const entry = inMemoryTokenStore.get(key);
      if (entry && entry.expiresAt > Date.now()) {
        return new LeadToken({token: entry.token});
      }
      return null;
    }
  }

  /**
   * Remove a token from the store (invalidate after use)
   */
  async removeToken(key: string): Promise<void> {
    if (typeof this.leadTokenRepository.delete === 'function') {
      await this.leadTokenRepository.delete(key);
    } else {
      // Fallback to in-memory store
      inMemoryTokenStore.delete(key);
    }
    this.logger.info(`Token invalidated: ${key.substring(0, 8)}...`);
  }

  /**
   * The function `triggerValidationMail` sends a validation email to a lead with a
   * generated temporary token to validate his email id.
   * @param {Lead} lead - The `lead` parameter is an object that represents a lead.
   * It likely contains information about a potential customer or user, such as their
   * name, email address, and other relevant details.
   */
  async triggerValidationMail(lead: Lead) {
    const token = this._generateTempToken(lead, [
      PermissionKey.CreateTenant,
      PermissionKey.ProvisionTenant,
      PermissionKey.ViewLead,
      PermissionKey.ViewPlan,
      PermissionKey.ViewSubscription,
      PermissionKey.CreateInvoice,
      PermissionKey.CreateBillingCustomer,
      PermissionKey.CreateBillingPaymentSource,
      PermissionKey.CreateBillingInvoice,
      PermissionKey.GetBillingCustomer,
      PermissionKey.GetBillingPaymentSource,
      PermissionKey.GetBillingInvoice,
      PermissionKey.UpdateBillingCustomer,
      PermissionKey.UpdateBillingPaymentSource,
      PermissionKey.UpdateBillingInvoice,
      PermissionKey.DeleteBillingCustomer,
      PermissionKey.DeleteBillingPaymentSource,
      PermissionKey.DeleteBillingInvoice,
      PermissionKey.CreateTenantConfig,
      PermissionKey.ViewTenantConfig,
      PermissionKey.DeleteTenantConfig,
      PermissionKey.UpdateTenantConfig,
    ]);
    const randomKey = this.cryptoHelperService.generateRandomString(
      +process.env.LEAD_KEY_LENGTH!,
    );
    await this.setToken(randomKey, new LeadToken({token}));
    await this.expireToken(
      randomKey,
      +process.env.VALIDATION_TOKEN_EXPIRY!,
    );

    // Send validation email via Novu
    try {
      await this.notificationService.sendLeadValidationEmail(lead.email, {
        firstName: lead.firstName,
        companyName: lead.companyName,
        validationToken: randomKey,
      });
      this.logger.info(`Validation email sent to ${lead.email}`);
    } catch (error) {
      this.logger.error(
        `Failed to send validation email to ${lead.email}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      // Don't throw - the lead is created, they can request a resend
    }

    return randomKey;
  }

  /**
   * The function `_generateTempToken` generates a temporary token for a lead with
   * specified permissions.
   * @param {Lead} lead - The `lead` parameter is an object that represents a lead.
   * It contains properties such as `id`, `userTenantId`, and `email`. These
   * properties are used to generate a temporary token.
   * @param {string[]} permissions - The `permissions` parameter is an optional array
   * of strings that represents the permissions associated with the lead. These
   * permissions determine what actions the lead is allowed to perform within the
   * system using the generated token
   * @returns a signed token.
   */
  private _generateTempToken(lead: Lead, permissions: string[] = []) {
    return this.cryptoHelperService.generateTempTokenForLead(lead, permissions);
  }
}
