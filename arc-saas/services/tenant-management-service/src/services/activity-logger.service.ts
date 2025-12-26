import {injectable, BindingScope} from '@loopback/core';
import {repository} from '@loopback/repository';
import {UserActivityRepository} from '../repositories/sequelize';
import {UserActivity} from '../models';

/**
 * Centralized service for logging user activities.
 * Provides consistent activity tracking across the application.
 */
@injectable({scope: BindingScope.SINGLETON})
export class ActivityLoggerService {
  constructor(
    @repository(UserActivityRepository)
    private readonly activityRepository: UserActivityRepository,
  ) {}

  /**
   * Log a user activity.
   * @param activity - Activity data to log
   * @returns Created activity record
   */
  async logActivity(
    activity: Partial<UserActivity>,
  ): Promise<UserActivity> {
    return this.activityRepository.create({
      ...activity,
      occurredAt: new Date(),
    });
  }

  /**
   * Log user creation activity.
   * @param userId - ID of created user
   * @param tenantId - Tenant ID
   * @param createdBy - ID of user who created the account
   * @param metadata - Additional context (e.g., invitation source)
   */
  async logUserCreated(
    userId: string,
    tenantId: string,
    createdBy?: string,
    metadata?: object,
  ): Promise<UserActivity> {
    return this.logActivity({
      userId,
      tenantId,
      action: 'user.created',
      entityType: 'user',
      entityId: userId,
      metadata: {
        ...metadata,
        createdBy,
      },
    });
  }

  /**
   * Log user login activity.
   * @param userId - ID of logged in user
   * @param tenantId - Tenant ID
   * @param ipAddress - Client IP address
   * @param userAgent - Client user agent
   */
  async logUserLogin(
    userId: string,
    tenantId: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<UserActivity> {
    return this.logActivity({
      userId,
      tenantId,
      action: 'user.login',
      entityType: 'user',
      entityId: userId,
      ipAddress,
      userAgent,
    });
  }

  /**
   * Log user status change activity.
   * @param userId - ID of user
   * @param tenantId - Tenant ID
   * @param fromStatus - Previous status
   * @param toStatus - New status
   * @param changedBy - ID of user who made the change
   */
  async logUserStatusChange(
    userId: string,
    tenantId: string,
    fromStatus: number,
    toStatus: number,
    changedBy?: string,
  ): Promise<UserActivity> {
    const action =
      toStatus === 2
        ? 'user.suspended'
        : toStatus === 1
        ? 'user.activated'
        : toStatus === 3
        ? 'user.deactivated'
        : 'user.status_changed';

    return this.logActivity({
      userId,
      tenantId,
      action,
      entityType: 'user',
      entityId: userId,
      metadata: {
        fromStatus,
        toStatus,
        changedBy,
      },
    });
  }

  /**
   * Log role assignment activity.
   * @param userId - ID of user
   * @param tenantId - Tenant ID
   * @param roleKey - Role identifier
   * @param assignedBy - ID of user who assigned the role
   */
  async logRoleAssigned(
    userId: string,
    tenantId: string,
    roleKey: string,
    assignedBy?: string,
  ): Promise<UserActivity> {
    return this.logActivity({
      userId,
      tenantId,
      action: 'user.role_assigned',
      entityType: 'user_role',
      metadata: {
        roleKey,
        assignedBy,
      },
    });
  }

  /**
   * Log role revocation activity.
   * @param userId - ID of user
   * @param tenantId - Tenant ID
   * @param roleKey - Role identifier
   * @param revokedBy - ID of user who revoked the role
   */
  async logRoleRevoked(
    userId: string,
    tenantId: string,
    roleKey: string,
    revokedBy?: string,
  ): Promise<UserActivity> {
    return this.logActivity({
      userId,
      tenantId,
      action: 'user.role_revoked',
      entityType: 'user_role',
      metadata: {
        roleKey,
        revokedBy,
      },
    });
  }

  /**
   * Log invitation sent activity.
   * @param invitedBy - ID of user who sent invitation
   * @param tenantId - Tenant ID
   * @param invitationId - ID of created invitation
   * @param email - Email of invitee
   */
  async logInvitationSent(
    invitedBy: string | undefined,
    tenantId: string,
    invitationId: string,
    email: string,
  ): Promise<UserActivity> {
    return this.logActivity({
      userId: invitedBy ?? 'system', // Admin/system invitations don't have DB user
      tenantId,
      action: 'invitation.sent',
      entityType: 'user_invitation',
      entityId: invitationId,
      metadata: {
        email,
        systemInvitation: !invitedBy,
      },
    });
  }

  /**
   * Log invitation accepted activity.
   * @param userId - ID of newly created user
   * @param tenantId - Tenant ID
   * @param invitationId - ID of accepted invitation
   */
  async logInvitationAccepted(
    userId: string,
    tenantId: string,
    invitationId: string,
  ): Promise<UserActivity> {
    return this.logActivity({
      userId,
      tenantId,
      action: 'invitation.accepted',
      entityType: 'user_invitation',
      entityId: invitationId,
    });
  }

  /**
   * Log invitation revoked activity.
   * @param revokedBy - ID of user who revoked invitation
   * @param tenantId - Tenant ID
   * @param invitationId - ID of revoked invitation
   */
  async logInvitationRevoked(
    revokedBy: string | undefined,
    tenantId: string,
    invitationId: string,
  ): Promise<UserActivity> {
    return this.logActivity({
      userId: revokedBy ?? 'system', // Admin/system revocations may not have DB user
      tenantId,
      action: 'invitation.revoked',
      entityType: 'user_invitation',
      entityId: invitationId,
    });
  }
}
