import {injectable, BindingScope, inject} from '@loopback/core';
import {repository} from '@loopback/repository';
import {AuditLogRepository} from '../repositories/sequelize';
import {AuditLog} from '../models';
import {AuthenticationBindings} from 'loopback4-authentication';
import {IAuthUserWithPermissions} from '@sourceloop/core';

/**
 * Audit action types for different entity operations.
 */
export enum AuditAction {
  // Tenant actions
  TENANT_CREATED = 'TENANT_CREATED',
  TENANT_UPDATED = 'TENANT_UPDATED',
  TENANT_DELETED = 'TENANT_DELETED',
  TENANT_PROVISIONED = 'TENANT_PROVISIONED',
  TENANT_SUSPENDED = 'TENANT_SUSPENDED',
  TENANT_ACTIVATED = 'TENANT_ACTIVATED',

  // Lead actions
  LEAD_CREATED = 'LEAD_CREATED',
  LEAD_UPDATED = 'LEAD_UPDATED',
  LEAD_DELETED = 'LEAD_DELETED',
  LEAD_VERIFIED = 'LEAD_VERIFIED',
  LEAD_CONVERTED = 'LEAD_CONVERTED',

  // Subscription actions
  SUBSCRIPTION_CREATED = 'SUBSCRIPTION_CREATED',
  SUBSCRIPTION_UPDATED = 'SUBSCRIPTION_UPDATED',
  SUBSCRIPTION_CANCELLED = 'SUBSCRIPTION_CANCELLED',
  SUBSCRIPTION_RENEWED = 'SUBSCRIPTION_RENEWED',
  SUBSCRIPTION_PLAN_CHANGED = 'SUBSCRIPTION_PLAN_CHANGED',

  // Settings actions
  SETTING_CREATED = 'SETTING_CREATED',
  SETTING_UPDATED = 'SETTING_UPDATED',
  SETTING_DELETED = 'SETTING_DELETED',
  SETTINGS_BULK_UPDATED = 'SETTINGS_BULK_UPDATED',

  // Invoice actions
  INVOICE_CREATED = 'INVOICE_CREATED',
  INVOICE_UPDATED = 'INVOICE_UPDATED',
  INVOICE_DELETED = 'INVOICE_DELETED',
  INVOICE_PAID = 'INVOICE_PAID',
  INVOICE_VOIDED = 'INVOICE_VOIDED',

  // User actions (broader audit)
  USER_CREATED = 'USER_CREATED',
  USER_UPDATED = 'USER_UPDATED',
  USER_DELETED = 'USER_DELETED',
  USER_SUSPENDED = 'USER_SUSPENDED',
  USER_ACTIVATED = 'USER_ACTIVATED',
  USER_LOGIN = 'USER_LOGIN',
  USER_LOGOUT = 'USER_LOGOUT',

  // Role actions
  ROLE_ASSIGNED = 'ROLE_ASSIGNED',
  ROLE_REVOKED = 'ROLE_REVOKED',
  ROLE_UPDATED = 'ROLE_UPDATED',
}

/**
 * Target entity types for audit logging.
 */
export enum AuditTargetType {
  TENANT = 'tenant',
  LEAD = 'lead',
  SUBSCRIPTION = 'subscription',
  SETTING = 'setting',
  INVOICE = 'invoice',
  USER = 'user',
  ROLE = 'role',
  INVITATION = 'invitation',
}

/**
 * Input for creating an audit log entry.
 */
export interface AuditLogInput {
  action: AuditAction | string;
  targetType: AuditTargetType | string;
  targetId?: string;
  targetName?: string;
  tenantId?: string;
  tenantName?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  status?: 'success' | 'failure' | 'warning';
}

/**
 * Centralized service for audit logging.
 * Provides consistent audit trail across the application for compliance and security.
 */
@injectable({scope: BindingScope.TRANSIENT})
export class AuditLoggerService {
  constructor(
    @repository(AuditLogRepository)
    private readonly auditLogRepository: AuditLogRepository,
    @inject(AuthenticationBindings.CURRENT_USER, {optional: true})
    private readonly currentUser?: IAuthUserWithPermissions,
  ) {}

  /**
   * Get actor information from current user context.
   */
  private getActorInfo(): {
    actorId: string;
    actorName?: string;
    actorEmail?: string;
    tenantId?: string;
  } {
    if (this.currentUser) {
      return {
        actorId: this.currentUser.id?.toString() || 'system',
        actorName:
          this.currentUser.firstName && this.currentUser.lastName
            ? `${this.currentUser.firstName} ${this.currentUser.lastName}`
            : this.currentUser.username,
        actorEmail: this.currentUser.email,
        tenantId: this.currentUser.tenantId,
      };
    }
    return {
      actorId: 'system',
      actorName: 'System',
    };
  }

  /**
   * Log an audit event.
   * @param input - Audit log input data
   * @returns Created audit log record
   */
  async log(input: AuditLogInput): Promise<AuditLog> {
    const actor = this.getActorInfo();

    return this.auditLogRepository.create({
      action: input.action,
      actorId: actor.actorId,
      actorName: actor.actorName,
      actorEmail: actor.actorEmail,
      targetType: input.targetType,
      targetId: input.targetId,
      targetName: input.targetName,
      tenantId: input.tenantId || actor.tenantId,
      tenantName: input.tenantName,
      details: input.details,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
      status: input.status || 'success',
      timestamp: new Date(),
    });
  }

  // ==================== TENANT AUDIT METHODS ====================

  async logTenantCreated(
    tenantId: string,
    tenantName: string,
    details?: Record<string, unknown>,
  ): Promise<AuditLog> {
    return this.log({
      action: AuditAction.TENANT_CREATED,
      targetType: AuditTargetType.TENANT,
      targetId: tenantId,
      targetName: tenantName,
      tenantId,
      tenantName,
      details,
    });
  }

  async logTenantUpdated(
    tenantId: string,
    tenantName: string,
    changes: Record<string, unknown>,
  ): Promise<AuditLog> {
    return this.log({
      action: AuditAction.TENANT_UPDATED,
      targetType: AuditTargetType.TENANT,
      targetId: tenantId,
      targetName: tenantName,
      tenantId,
      tenantName,
      details: {changes},
    });
  }

  async logTenantDeleted(
    tenantId: string,
    tenantName: string,
  ): Promise<AuditLog> {
    return this.log({
      action: AuditAction.TENANT_DELETED,
      targetType: AuditTargetType.TENANT,
      targetId: tenantId,
      targetName: tenantName,
      tenantId,
      tenantName,
    });
  }

  async logTenantProvisioned(
    tenantId: string,
    tenantName: string,
    planId: string,
  ): Promise<AuditLog> {
    return this.log({
      action: AuditAction.TENANT_PROVISIONED,
      targetType: AuditTargetType.TENANT,
      targetId: tenantId,
      targetName: tenantName,
      tenantId,
      tenantName,
      details: {planId},
    });
  }

  // ==================== LEAD AUDIT METHODS ====================

  async logLeadCreated(
    leadId: string,
    email: string,
    details?: Record<string, unknown>,
  ): Promise<AuditLog> {
    return this.log({
      action: AuditAction.LEAD_CREATED,
      targetType: AuditTargetType.LEAD,
      targetId: leadId,
      targetName: email,
      details,
    });
  }

  async logLeadUpdated(
    leadId: string,
    email: string,
    changes: Record<string, unknown>,
  ): Promise<AuditLog> {
    return this.log({
      action: AuditAction.LEAD_UPDATED,
      targetType: AuditTargetType.LEAD,
      targetId: leadId,
      targetName: email,
      details: {changes},
    });
  }

  async logLeadDeleted(leadId: string, email: string): Promise<AuditLog> {
    return this.log({
      action: AuditAction.LEAD_DELETED,
      targetType: AuditTargetType.LEAD,
      targetId: leadId,
      targetName: email,
    });
  }

  async logLeadVerified(leadId: string, email: string): Promise<AuditLog> {
    return this.log({
      action: AuditAction.LEAD_VERIFIED,
      targetType: AuditTargetType.LEAD,
      targetId: leadId,
      targetName: email,
    });
  }

  async logLeadConverted(
    leadId: string,
    email: string,
    tenantId: string,
    tenantName: string,
  ): Promise<AuditLog> {
    return this.log({
      action: AuditAction.LEAD_CONVERTED,
      targetType: AuditTargetType.LEAD,
      targetId: leadId,
      targetName: email,
      tenantId,
      tenantName,
      details: {convertedToTenant: tenantId},
    });
  }

  // ==================== SUBSCRIPTION AUDIT METHODS ====================

  async logSubscriptionCreated(
    subscriptionId: string,
    tenantId: string,
    tenantName: string,
    planId: string,
    planName: string,
  ): Promise<AuditLog> {
    return this.log({
      action: AuditAction.SUBSCRIPTION_CREATED,
      targetType: AuditTargetType.SUBSCRIPTION,
      targetId: subscriptionId,
      targetName: planName,
      tenantId,
      tenantName,
      details: {planId, planName},
    });
  }

  async logSubscriptionUpdated(
    subscriptionId: string,
    tenantId: string,
    tenantName: string,
    changes: Record<string, unknown>,
  ): Promise<AuditLog> {
    return this.log({
      action: AuditAction.SUBSCRIPTION_UPDATED,
      targetType: AuditTargetType.SUBSCRIPTION,
      targetId: subscriptionId,
      tenantId,
      tenantName,
      details: {changes},
    });
  }

  async logSubscriptionCancelled(
    subscriptionId: string,
    tenantId: string,
    tenantName: string,
    reason?: string,
  ): Promise<AuditLog> {
    return this.log({
      action: AuditAction.SUBSCRIPTION_CANCELLED,
      targetType: AuditTargetType.SUBSCRIPTION,
      targetId: subscriptionId,
      tenantId,
      tenantName,
      details: {reason},
    });
  }

  async logSubscriptionPlanChanged(
    subscriptionId: string,
    tenantId: string,
    tenantName: string,
    oldPlan: string,
    newPlan: string,
  ): Promise<AuditLog> {
    return this.log({
      action: AuditAction.SUBSCRIPTION_PLAN_CHANGED,
      targetType: AuditTargetType.SUBSCRIPTION,
      targetId: subscriptionId,
      tenantId,
      tenantName,
      details: {oldPlan, newPlan},
    });
  }

  // ==================== SETTINGS AUDIT METHODS ====================

  async logSettingCreated(
    settingId: string,
    settingKey: string,
    tenantId?: string,
  ): Promise<AuditLog> {
    return this.log({
      action: AuditAction.SETTING_CREATED,
      targetType: AuditTargetType.SETTING,
      targetId: settingId,
      targetName: settingKey,
      tenantId,
    });
  }

  async logSettingUpdated(
    settingId: string,
    settingKey: string,
    oldValue: unknown,
    newValue: unknown,
    tenantId?: string,
  ): Promise<AuditLog> {
    return this.log({
      action: AuditAction.SETTING_UPDATED,
      targetType: AuditTargetType.SETTING,
      targetId: settingId,
      targetName: settingKey,
      tenantId,
      details: {oldValue, newValue},
    });
  }

  async logSettingDeleted(
    settingId: string,
    settingKey: string,
    tenantId?: string,
  ): Promise<AuditLog> {
    return this.log({
      action: AuditAction.SETTING_DELETED,
      targetType: AuditTargetType.SETTING,
      targetId: settingId,
      targetName: settingKey,
      tenantId,
    });
  }

  async logSettingsBulkUpdated(
    updatedCount: number,
    createdCount: number,
    tenantId?: string,
  ): Promise<AuditLog> {
    return this.log({
      action: AuditAction.SETTINGS_BULK_UPDATED,
      targetType: AuditTargetType.SETTING,
      targetName: 'bulk-settings',
      tenantId,
      details: {updatedCount, createdCount},
    });
  }

  // ==================== INVOICE AUDIT METHODS ====================

  async logInvoiceCreated(
    invoiceId: string,
    invoiceNumber: string,
    tenantId: string,
    tenantName?: string,
    amount?: number,
  ): Promise<AuditLog> {
    return this.log({
      action: AuditAction.INVOICE_CREATED,
      targetType: AuditTargetType.INVOICE,
      targetId: invoiceId,
      targetName: invoiceNumber,
      tenantId,
      tenantName,
      details: {amount},
    });
  }

  async logInvoiceUpdated(
    invoiceId: string,
    invoiceNumber: string,
    tenantId: string,
    changes: Record<string, unknown>,
  ): Promise<AuditLog> {
    return this.log({
      action: AuditAction.INVOICE_UPDATED,
      targetType: AuditTargetType.INVOICE,
      targetId: invoiceId,
      targetName: invoiceNumber,
      tenantId,
      details: {changes},
    });
  }

  async logInvoiceDeleted(
    invoiceId: string,
    invoiceNumber: string,
    tenantId: string,
  ): Promise<AuditLog> {
    return this.log({
      action: AuditAction.INVOICE_DELETED,
      targetType: AuditTargetType.INVOICE,
      targetId: invoiceId,
      targetName: invoiceNumber,
      tenantId,
    });
  }

  // ==================== USER AUDIT METHODS ====================

  async logUserCreated(
    userId: string,
    email: string,
    tenantId: string,
    tenantName?: string,
  ): Promise<AuditLog> {
    return this.log({
      action: AuditAction.USER_CREATED,
      targetType: AuditTargetType.USER,
      targetId: userId,
      targetName: email,
      tenantId,
      tenantName,
    });
  }

  async logUserUpdated(
    userId: string,
    email: string,
    changes: Record<string, unknown>,
    tenantId: string,
  ): Promise<AuditLog> {
    return this.log({
      action: AuditAction.USER_UPDATED,
      targetType: AuditTargetType.USER,
      targetId: userId,
      targetName: email,
      tenantId,
      details: {changes},
    });
  }

  async logUserDeleted(
    userId: string,
    email: string,
    tenantId: string,
  ): Promise<AuditLog> {
    return this.log({
      action: AuditAction.USER_DELETED,
      targetType: AuditTargetType.USER,
      targetId: userId,
      targetName: email,
      tenantId,
    });
  }

  async logUserSuspended(
    userId: string,
    email: string,
    tenantId: string,
  ): Promise<AuditLog> {
    return this.log({
      action: AuditAction.USER_SUSPENDED,
      targetType: AuditTargetType.USER,
      targetId: userId,
      targetName: email,
      tenantId,
    });
  }

  async logUserActivated(
    userId: string,
    email: string,
    tenantId: string,
  ): Promise<AuditLog> {
    return this.log({
      action: AuditAction.USER_ACTIVATED,
      targetType: AuditTargetType.USER,
      targetId: userId,
      targetName: email,
      tenantId,
    });
  }

  // ==================== ROLE AUDIT METHODS ====================

  async logRoleAssigned(
    userId: string,
    userEmail: string,
    roleKey: string,
    tenantId: string,
  ): Promise<AuditLog> {
    return this.log({
      action: AuditAction.ROLE_ASSIGNED,
      targetType: AuditTargetType.ROLE,
      targetId: userId,
      targetName: roleKey,
      tenantId,
      details: {userId, userEmail, roleKey},
    });
  }

  async logRoleRevoked(
    userId: string,
    userEmail: string,
    roleKey: string,
    tenantId: string,
  ): Promise<AuditLog> {
    return this.log({
      action: AuditAction.ROLE_REVOKED,
      targetType: AuditTargetType.ROLE,
      targetId: userId,
      targetName: roleKey,
      tenantId,
      details: {userId, userEmail, roleKey},
    });
  }

  // ==================== INVITATION AUDIT METHODS ====================

  async logInvitationSent(
    invitationId: string,
    email: string,
    tenantId: string,
    roleKey: string,
  ): Promise<AuditLog> {
    return this.log({
      action: 'INVITATION_SENT',
      targetType: AuditTargetType.INVITATION,
      targetId: invitationId,
      targetName: email,
      tenantId,
      details: {email, roleKey},
    });
  }

  async logInvitationAccepted(
    invitationId: string,
    email: string,
    userId: string,
    tenantId: string,
  ): Promise<AuditLog> {
    return this.log({
      action: 'INVITATION_ACCEPTED',
      targetType: AuditTargetType.INVITATION,
      targetId: invitationId,
      targetName: email,
      tenantId,
      details: {email, userId},
    });
  }

  async logInvitationRevoked(
    invitationId: string,
    email: string,
    tenantId: string,
  ): Promise<AuditLog> {
    return this.log({
      action: 'INVITATION_REVOKED',
      targetType: AuditTargetType.INVITATION,
      targetId: invitationId,
      targetName: email,
      tenantId,
    });
  }

  async logInvitationResent(
    invitationId: string,
    email: string,
    tenantId: string,
  ): Promise<AuditLog> {
    return this.log({
      action: 'INVITATION_RESENT',
      targetType: AuditTargetType.INVITATION,
      targetId: invitationId,
      targetName: email,
      tenantId,
    });
  }

  // ==================== PROVISIONING AUDIT METHODS ====================

  async logProvisioningStarted(
    tenantId: string,
    tenantName: string,
    planId: string,
    workflowId: string,
  ): Promise<AuditLog> {
    return this.log({
      action: 'PROVISIONING_STARTED',
      targetType: AuditTargetType.TENANT,
      targetId: tenantId,
      targetName: tenantName,
      tenantId,
      details: {planId, workflowId},
    });
  }

  async logProvisioningCompleted(
    tenantId: string,
    tenantName: string,
    planId: string,
    duration?: number,
  ): Promise<AuditLog> {
    return this.log({
      action: 'PROVISIONING_COMPLETED',
      targetType: AuditTargetType.TENANT,
      targetId: tenantId,
      targetName: tenantName,
      tenantId,
      details: {planId, durationMs: duration},
    });
  }

  async logProvisioningFailed(
    tenantId: string,
    tenantName: string,
    planId: string,
    error: string,
  ): Promise<AuditLog> {
    return this.log({
      action: 'PROVISIONING_FAILED',
      targetType: AuditTargetType.TENANT,
      targetId: tenantId,
      targetName: tenantName,
      tenantId,
      details: {planId, error},
      status: 'failure',
    });
  }

  // ==================== AUTHENTICATION AUDIT METHODS ====================

  async logLoginSuccess(
    userId: string,
    email: string,
    tenantId: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<AuditLog> {
    return this.log({
      action: AuditAction.USER_LOGIN,
      targetType: AuditTargetType.USER,
      targetId: userId,
      targetName: email,
      tenantId,
      ipAddress,
      userAgent,
    });
  }

  async logLoginFailure(
    email: string,
    reason: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<AuditLog> {
    return this.log({
      action: 'LOGIN_FAILED',
      targetType: AuditTargetType.USER,
      targetName: email,
      details: {reason},
      status: 'failure',
      ipAddress,
      userAgent,
    });
  }

  async logLogout(
    userId: string,
    email: string,
    tenantId: string,
  ): Promise<AuditLog> {
    return this.log({
      action: AuditAction.USER_LOGOUT,
      targetType: AuditTargetType.USER,
      targetId: userId,
      targetName: email,
      tenantId,
    });
  }

  // ==================== API KEY AUDIT METHODS ====================

  async logApiKeyGenerated(
    keyId: string,
    keyName: string,
    tenantId: string,
    scopes?: string[],
  ): Promise<AuditLog> {
    return this.log({
      action: 'API_KEY_GENERATED',
      targetType: 'api_key',
      targetId: keyId,
      targetName: keyName,
      tenantId,
      details: {scopes},
    });
  }

  async logApiKeyRevoked(
    keyId: string,
    keyName: string,
    tenantId: string,
    reason?: string,
  ): Promise<AuditLog> {
    return this.log({
      action: 'API_KEY_REVOKED',
      targetType: 'api_key',
      targetId: keyId,
      targetName: keyName,
      tenantId,
      details: {reason},
    });
  }

  async logApiKeyUsed(
    keyId: string,
    endpoint: string,
    tenantId: string,
    statusCode: number,
  ): Promise<AuditLog> {
    return this.log({
      action: 'API_KEY_USED',
      targetType: 'api_key',
      targetId: keyId,
      tenantId,
      details: {endpoint, statusCode},
      status: statusCode >= 200 && statusCode < 300 ? 'success' : 'failure',
    });
  }

  // ==================== HELPER METHOD FOR NON-BLOCKING AUDIT ====================

  /**
   * Non-blocking audit log wrapper.
   * Logs the action but catches and silently ignores failures to prevent
   * main operation failure.
   *
   * @param logFn - Async function that performs the audit logging
   */
  async logSafely(logFn: () => Promise<AuditLog>): Promise<void> {
    try {
      await logFn();
    } catch (error) {
      // Log to console but don't throw
      console.error('[AuditLogger] Failed to write audit log:', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}
