import {injectable, BindingScope, service} from '@loopback/core';
import {repository} from '@loopback/repository';
import {HttpErrors} from '@loopback/rest';
import {UserInvitationRepository, UserRepository, UserRoleRepository, TenantRepository, TenantMgmtConfigRepository} from '../repositories/sequelize';
import {UserInvitation, User} from '../models';
import {UserInvitationStatus, UserStatus, RoleScopeType, TenantStatus} from '../enums';
import {CryptoHelperService} from './crypto-helper.service';
import {IdpUserCreationService} from './idp-user-creation.service';
import {PasswordValidatorService} from './password-validator.service';
import {NovuNotificationService} from './novu-notification.service';
import {NotificationCategory} from '../models/notification-preference.model';
import {IdPKey} from '../types';

/**
 * Service for managing user invitation workflow.
 * Handles invitation creation, token generation, and acceptance.
 */
@injectable({scope: BindingScope.TRANSIENT})
export class InvitationService {
  constructor(
    @repository(UserInvitationRepository)
    private readonly invitationRepository: UserInvitationRepository,
    @repository(UserRepository)
    private readonly userRepository: UserRepository,
    @repository(UserRoleRepository)
    private readonly userRoleRepository: UserRoleRepository,
    @repository(TenantRepository)
    private readonly tenantRepository: TenantRepository,
    @repository(TenantMgmtConfigRepository)
    private readonly tenantConfigRepository: TenantMgmtConfigRepository,
    @service(CryptoHelperService)
    private readonly cryptoHelper: CryptoHelperService,
    @service(IdpUserCreationService)
    private readonly idpUserCreation: IdpUserCreationService,
    @service(PasswordValidatorService)
    private readonly passwordValidator: PasswordValidatorService,
    @service(NovuNotificationService)
    private readonly novuService: NovuNotificationService,
  ) {}

  /**
   * Create a new user invitation with secure token.
   * @param invitation - Invitation data (without token, status, expiresAt)
   * @returns Created invitation with generated token
   */
  async createInvitation(
    invitation: Omit<UserInvitation, 'id' | 'token' | 'status' | 'expiresAt' | 'acceptedAt' | 'acceptedBy'>,
  ): Promise<UserInvitation> {
    // 1. Validate tenant exists and is active
    const tenant = await this.tenantRepository.findById(invitation.tenantId);

    if (!tenant) {
      throw new HttpErrors.NotFound(
        `Tenant ${invitation.tenantId} not found`,
      );
    }

    if (tenant.status !== TenantStatus.ACTIVE) {
      throw new HttpErrors.PreconditionFailed(
        `Cannot create invitation: Tenant is in ${TenantStatus[tenant.status]} status. Only active tenants can invite users.`,
      );
    }

    // 2. Validate tenant has IdP configuration
    const idpKey = tenant.identityProvider ?? IdPKey.KEYCLOAK;
    const idpConfig = await this.tenantConfigRepository.findOne({
      where: {tenantId: invitation.tenantId, configKey: idpKey},
    });

    if (!idpConfig || !idpConfig.configValue) {
      throw new HttpErrors.PreconditionFailed(
        `Cannot create invitation: Tenant does not have ${idpKey} configuration. Please configure the identity provider first.`,
      );
    }

    // 3. Validate IdP-specific configuration
    if (idpKey === IdPKey.KEYCLOAK && !idpConfig.configValue.realm_name) {
      throw new HttpErrors.PreconditionFailed(
        `Cannot create invitation: Keycloak realm name not configured for tenant ${tenant.key}`,
      );
    }

    if (idpKey === IdPKey.AUTH0 && !idpConfig.configValue.connection) {
      throw new HttpErrors.PreconditionFailed(
        `Cannot create invitation: Auth0 connection not configured for tenant ${tenant.key}`,
      );
    }

    // 4. Generate secure token
    const token = this.cryptoHelper.generateInvitationToken();

    // 5. Set expiration to 7 days from now
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    // 6. Create invitation with generated fields
    // GAP-006 FIX: Track email sent timestamp
    const createdInvitation = await this.invitationRepository.create({
      ...invitation,
      token,
      expiresAt,
      status: UserInvitationStatus.Pending,
      lastEmailSentAt: new Date(),
      resendCount: 0,
    });

    // 7. Send invitation email via Novu with tenant preference checking
    await this.novuService.sendWithPreferences({
      workflowId: 'user-invitation',
      tenantId: invitation.tenantId,
      category: NotificationCategory.USER,
      recipient: {
        email: invitation.email,
        firstName: invitation.firstName,
        lastName: invitation.lastName,
      },
      payload: {
        invitationToken: token,
        invitationUrl: `${process.env.CUSTOMER_PORTAL_URL || 'http://localhost:27100'}/accept-invitation?token=${token}`,
        roleKey: invitation.roleKey,
        invitedBy: invitation.invitedBy,
        expiresAt: expiresAt.toISOString(),
        tenantName: tenant.name,
      },
    });

    return createdInvitation;
  }

  /**
   * Validate invitation token and check expiration.
   * @param token - Invitation token from email link
   * @returns Valid invitation with tenant data
   * @throws HttpErrors.NotFound if token is invalid
   * @throws HttpErrors.Gone if token is expired
   * @throws HttpErrors.BadRequest if invitation is not pending
   */
  async validateInvitationToken(token: string): Promise<UserInvitation> {
    const invitation = await this.invitationRepository.findOne({
      where: {token, deleted: false},
      include: ['tenant'],
    });

    if (!invitation) {
      throw new HttpErrors.NotFound('Invalid or expired invitation token');
    }

    // Check validity using model getter
    if (!invitation.isValid) {
      if (invitation.expiresAt <= new Date()) {
        throw new HttpErrors.Gone('Invitation has expired');
      }

      const statusMessage =
        invitation.status === UserInvitationStatus.Accepted
          ? 'already accepted'
          : invitation.status === UserInvitationStatus.Revoked
          ? 'revoked'
          : 'not valid';

      throw new HttpErrors.BadRequest(`Invitation is ${statusMessage}`);
    }

    return invitation;
  }

  /**
   * Accept invitation and create user account.
   * @param token - Invitation token
   * @param acceptData - User data (password, firstName, lastName)
   * @returns Created user with assigned role
   */
  async acceptInvitation(
    token: string,
    acceptData: {
      password: string;
      firstName?: string;
      lastName?: string;
    },
  ): Promise<User> {
    // 1. Validate password strength
    this.passwordValidator.validatePassword(acceptData.password);

    // 2. Validate invitation
    const invitation = await this.validateInvitationToken(token);

    // 3. Check if user already exists with this email in this tenant
    const existingUser = await this.userRepository.findOne({
      where: {
        email: invitation.email,
        tenantId: invitation.tenantId,
        deleted: false,
      },
    });

    if (existingUser) {
      throw new HttpErrors.Conflict('User with this email already exists');
    }

    // 4. Create user account
    const newUser = await this.userRepository.create({
      email: invitation.email,
      firstName: acceptData.firstName ?? invitation.firstName ?? 'User',
      lastName: acceptData.lastName ?? invitation.lastName ?? '',
      tenantId: invitation.tenantId,
      status: UserStatus.Pending, // Will be activated after IdP creation
    });

    try {
      // 5. Create user in IdP (Keycloak or Auth0) with password
      const idpResponse = await this.idpUserCreation.createUser({
        tenantId: invitation.tenantId,
        email: invitation.email,
        password: acceptData.password,
        firstName: acceptData.firstName ?? invitation.firstName ?? 'User',
        lastName: acceptData.lastName ?? invitation.lastName ?? '',
      });

      // 6. Update user with authId from IdP and activate
      await this.userRepository.updateById(newUser.id, {
        authId: idpResponse.authId,
        status: UserStatus.Active,
      });

      // 7. Assign initial role from invitation
      await this.userRoleRepository.create({
        userId: newUser.id,
        roleKey: invitation.roleKey,
        tenantId: invitation.tenantId,
        scopeType: RoleScopeType.Tenant,
      });

      // 8. Mark invitation as accepted
      await this.invitationRepository.updateById(invitation.id, {
        status: UserInvitationStatus.Accepted,
        acceptedAt: new Date(),
        acceptedBy: newUser.id,
      });

      // 9. Send welcome email via Novu with tenant preference checking
      await this.novuService.sendWithPreferences({
        workflowId: 'user-welcome',
        tenantId: invitation.tenantId,
        category: NotificationCategory.USER,
        recipient: {
          email: newUser.email,
          firstName: newUser.firstName,
          lastName: newUser.lastName,
        },
        payload: {
          userName: `${newUser.firstName} ${newUser.lastName}`,
          loginUrl: `${process.env.CUSTOMER_PORTAL_URL || 'http://localhost:27100'}/login`,
        },
      });

      return newUser;
    } catch (error) {
      // Rollback: Delete user if IdP creation fails
      await this.userRepository.deleteById(newUser.id);
      throw new HttpErrors.InternalServerError(
        `Failed to create user in identity provider: ${error.message}`,
      );
    }
  }

  /**
   * Resend invitation email with new token.
   * GAP-006 FIX: Enforce cooldown period and max resend limit.
   * @param invitationId - Invitation ID to resend
   * @returns Updated invitation with new token
   */
  async resendInvitation(invitationId: string): Promise<UserInvitation> {
    const RESEND_COOLDOWN_MINUTES = 5;
    const MAX_RESEND_COUNT = 5;

    const invitation = await this.invitationRepository.findById(invitationId);

    if (invitation.status !== UserInvitationStatus.Pending) {
      throw new HttpErrors.BadRequest('Can only resend pending invitations');
    }

    // GAP-006 FIX: Check max resend limit
    if (invitation.resendCount >= MAX_RESEND_COUNT) {
      throw new HttpErrors.TooManyRequests(
        `Maximum resend limit (${MAX_RESEND_COUNT}) reached. Please create a new invitation.`,
      );
    }

    // GAP-006 FIX: Check cooldown period
    if (invitation.lastEmailSentAt) {
      const timeSinceLastEmail = Date.now() - new Date(invitation.lastEmailSentAt).getTime();
      const cooldownMs = RESEND_COOLDOWN_MINUTES * 60 * 1000;

      if (timeSinceLastEmail < cooldownMs) {
        const remainingSeconds = Math.ceil((cooldownMs - timeSinceLastEmail) / 1000);
        throw new HttpErrors.TooManyRequests(
          `Please wait ${remainingSeconds} seconds before resending the invitation.`,
        );
      }
    }

    // Generate new token and extend expiration
    const newToken = this.cryptoHelper.generateInvitationToken();
    const newExpiresAt = new Date();
    newExpiresAt.setDate(newExpiresAt.getDate() + 7);

    await this.invitationRepository.updateById(invitationId, {
      token: newToken,
      expiresAt: newExpiresAt,
      lastEmailSentAt: new Date(),
      resendCount: (invitation.resendCount || 0) + 1,
    });

    const updatedInvitation = await this.invitationRepository.findById(invitationId);

    // Get tenant for email
    const tenant = await this.tenantRepository.findById(invitation.tenantId);

    // Send new invitation email via Novu with tenant preference checking
    await this.novuService.sendWithPreferences({
      workflowId: 'user-invitation',
      tenantId: invitation.tenantId,
      category: NotificationCategory.USER,
      recipient: {
        email: updatedInvitation.email,
        firstName: updatedInvitation.firstName,
        lastName: updatedInvitation.lastName,
      },
      payload: {
        invitationToken: newToken,
        invitationUrl: `${process.env.CUSTOMER_PORTAL_URL || 'http://localhost:27100'}/accept-invitation?token=${newToken}`,
        roleKey: updatedInvitation.roleKey,
        invitedBy: updatedInvitation.invitedBy,
        expiresAt: newExpiresAt.toISOString(),
        tenantName: tenant.name,
        isResend: true,
      },
    });

    return updatedInvitation;
  }

  /**
   * Revoke a pending invitation.
   * @param invitationId - Invitation ID to revoke
   */
  async revokeInvitation(invitationId: string): Promise<void> {
    const invitation = await this.invitationRepository.findById(invitationId);

    if (invitation.status !== UserInvitationStatus.Pending) {
      throw new HttpErrors.BadRequest('Can only revoke pending invitations');
    }

    await this.invitationRepository.updateById(invitationId, {
      status: UserInvitationStatus.Revoked,
    });
  }

  /**
   * GAP-001 FIX: Clean up expired invitations.
   * Marks all pending invitations past their expiry as expired.
   * Can be called by an admin endpoint or scheduled job.
   * @returns Number of invitations marked as expired
   */
  async cleanupExpiredInvitations(): Promise<{expiredCount: number}> {
    const now = new Date();

    // Find all pending invitations that have expired
    const expiredInvitations = await this.invitationRepository.find({
      where: {
        status: UserInvitationStatus.Pending,
        expiresAt: {lt: now},
        deleted: false,
      },
    });

    // Update all expired invitations
    for (const invitation of expiredInvitations) {
      await this.invitationRepository.updateById(invitation.id, {
        status: UserInvitationStatus.Expired,
      });
    }

    return {expiredCount: expiredInvitations.length};
  }

  /**
   * Send invitation email for an existing invitation.
   * Called by Temporal activities to send the email via Novu.
   * @param invitationId - Invitation ID
   * @param token - Invitation token
   * @param expiresAt - Expiration date
   * @returns Email send result with transaction ID
   */
  async sendInvitationEmail(
    invitationId: string,
    token: string,
    expiresAt: string,
  ): Promise<{success: boolean; transactionId?: string; error?: string}> {
    try {
      const invitation = await this.invitationRepository.findById(invitationId);

      if (!invitation) {
        throw new HttpErrors.NotFound(
          `Invitation ${invitationId} not found`,
        );
      }

      // Get tenant for email
      const tenant = await this.tenantRepository.findById(invitation.tenantId);

      if (!tenant) {
        throw new HttpErrors.NotFound(
          `Tenant ${invitation.tenantId} not found`,
        );
      }

      // Send invitation email via Novu with tenant preference checking
      const result = await this.novuService.sendWithPreferences({
        workflowId: 'user-invitation',
        tenantId: invitation.tenantId,
        category: NotificationCategory.USER,
        recipient: {
          email: invitation.email,
          firstName: invitation.firstName,
          lastName: invitation.lastName,
        },
        payload: {
          invitationToken: token,
          invitationUrl: `${process.env.CUSTOMER_PORTAL_URL || 'http://localhost:27100'}/accept-invitation?token=${token}`,
          roleKey: invitation.roleKey,
          invitedBy: invitation.invitedBy,
          expiresAt,
          tenantName: tenant.name,
        },
      });

      return {
        success: true,
        transactionId: result?.transactionId,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        error: errorMessage,
      };
    }
  }
}
