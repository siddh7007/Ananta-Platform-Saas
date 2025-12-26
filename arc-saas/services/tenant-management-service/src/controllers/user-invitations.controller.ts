import {
  Count,
  CountSchema,
  Filter,
  FilterExcludingWhere,
  repository,
  Where,
} from '@loopback/repository';
import {
  del,
  get,
  param,
  patch,
  post,
  requestBody,
  HttpErrors,
} from '@loopback/rest';
import {
  CONTENT_TYPE,
  getModelSchemaRefSF,
  IAuthUserWithPermissions,
  OPERATION_SECURITY_SPEC,
  STATUS_CODE,
  rateLimitKeyGenPublic,
} from '@sourceloop/core';
import {authenticate, AuthenticationBindings, STRATEGY} from 'loopback4-authentication';
import {authorize} from 'loopback4-authorization';
import {inject, service} from '@loopback/core';
import {ratelimit} from 'loopback4-ratelimiter';
import {UserInvitationRepository} from '../repositories/sequelize';
import {UserInvitation} from '../models';
import {PermissionKey} from '../permissions';
import {InvitationService} from '../services/invitation.service';
import {ActivityLoggerService} from '../services/activity-logger.service';
import {AuditLoggerService} from '../services/audit-logger.service';

const basePath = '/user-invitations';

/**
 * User invitation management controller.
 * Handles email-based user invitation workflow with token validation.
 */
export class UserInvitationsController {
  constructor(
    @repository(UserInvitationRepository)
    private readonly userInvitationRepository: UserInvitationRepository,
    @service(InvitationService)
    private readonly invitationService: InvitationService,
    @service(ActivityLoggerService)
    private readonly activityLogger: ActivityLoggerService,
    @service(AuditLoggerService)
    private readonly auditLogger: AuditLoggerService,
    @inject(AuthenticationBindings.CURRENT_USER, {optional: true})
    private readonly currentUser?: IAuthUserWithPermissions,
  ) {}

  /**
   * Get the current user's tenant ID for multi-tenant isolation.
   * SECURITY FIX: Ensures all queries are scoped to authenticated user's tenant.
   */
  private getTenantId(): string {
    if (!this.currentUser?.tenantId) {
      throw new HttpErrors.Forbidden('Tenant context required');
    }
    return this.currentUser.tenantId;
  }

  /**
   * Create a new user invitation.
   * Generates a secure token and sends invitation email via Novu.
   */
  @authorize({
    permissions: [PermissionKey.CreateInvitation],
  })
  @authenticate(STRATEGY.BEARER, {
    passReqToCallback: true,
  })
  @post(basePath, {
    security: OPERATION_SECURITY_SPEC,
    responses: {
      [STATUS_CODE.OK]: {
        description: 'UserInvitation model instance',
        content: {
          [CONTENT_TYPE.JSON]: {schema: getModelSchemaRefSF(UserInvitation)},
        },
      },
    },
  })
  async create(
    @requestBody({
      content: {
        [CONTENT_TYPE.JSON]: {
          // Explicit schema to avoid @belongsTo properties being required
          schema: {
            type: 'object',
            title: 'NewUserInvitation',
            required: ['email', 'roleKey', 'tenantId'],
            properties: {
              email: {
                type: 'string',
                format: 'email',
                maxLength: 255,
                description: 'Invitee email address',
              },
              roleKey: {
                type: 'string',
                maxLength: 50,
                description: 'Initial role to assign upon acceptance',
              },
              tenantId: {
                type: 'string',
                format: 'uuid',
                description: 'Tenant ID for multi-tenant isolation',
              },
              firstName: {
                type: 'string',
                maxLength: 100,
                description: 'Optional first name',
              },
              lastName: {
                type: 'string',
                maxLength: 100,
                description: 'Optional last name',
              },
              customMessage: {
                type: 'string',
                description: 'Optional personalized message from inviter',
              },
            },
          },
        },
      },
    })
    invitation: Omit<UserInvitation, 'id'>,
  ): Promise<UserInvitation> {
    // Use service to create invitation with secure token
    const createdInvitation = await this.invitationService.createInvitation(invitation);

    // Log activity and audit (non-blocking)
    try {
      await this.activityLogger.logInvitationSent(
        invitation.invitedBy,
        invitation.tenantId,
        createdInvitation.id,
        invitation.email,
      );
      await this.auditLogger.logInvitationSent(
        createdInvitation.id,
        invitation.email,
        invitation.tenantId,
        invitation.roleKey || 'unknown',
      );
    } catch {
      // Don't fail the operation if logging fails
    }

    return createdInvitation;
  }

  @authorize({
    permissions: [PermissionKey.ViewInvitation],
  })
  @authenticate(STRATEGY.BEARER, {
    passReqToCallback: true,
  })
  /**
   * Count user invitations for current tenant.
   * SECURITY FIX: Added tenant filtering to prevent cross-tenant data exposure.
   */
  @get(`${basePath}/count`, {
    security: OPERATION_SECURITY_SPEC,
    responses: {
      [STATUS_CODE.OK]: {
        description: 'UserInvitation model count',
        content: {[CONTENT_TYPE.JSON]: {schema: CountSchema}},
      },
    },
  })
  async count(
    @param.where(UserInvitation) where?: Where<UserInvitation>,
  ): Promise<Count> {
    // SECURITY FIX: Enforce tenant isolation
    const tenantId = this.getTenantId();
    return this.userInvitationRepository.count({
      ...where,
      tenantId,
    });
  }

  @authorize({
    permissions: [PermissionKey.ViewInvitation],
  })
  @authenticate(STRATEGY.BEARER, {
    passReqToCallback: true,
  })
  /**
   * List user invitations for current tenant.
   * SECURITY FIX: Added tenant filtering to prevent cross-tenant data exposure.
   */
  @get(basePath, {
    security: OPERATION_SECURITY_SPEC,
    responses: {
      [STATUS_CODE.OK]: {
        description: 'Array of UserInvitation model instances',
        content: {
          [CONTENT_TYPE.JSON]: {
            schema: {
              type: 'array',
              items: getModelSchemaRefSF(UserInvitation, {
                includeRelations: true,
              }),
            },
          },
        },
      },
    },
  })
  async find(
    @param.filter(UserInvitation) filter?: Filter<UserInvitation>,
  ): Promise<UserInvitation[]> {
    // SECURITY FIX: Enforce tenant isolation
    const tenantId = this.getTenantId();
    return this.userInvitationRepository.find({
      ...filter,
      where: {
        ...filter?.where,
        tenantId,
      },
    });
  }

  @authorize({
    permissions: [PermissionKey.ViewInvitation],
  })
  @authenticate(STRATEGY.BEARER, {
    passReqToCallback: true,
  })
  /**
   * Get invitation by ID for current tenant.
   * SECURITY FIX: Added tenant ownership validation to prevent unauthorized access.
   */
  @get(`${basePath}/{id}`, {
    security: OPERATION_SECURITY_SPEC,
    responses: {
      [STATUS_CODE.OK]: {
        description: 'UserInvitation model instance',
        content: {
          [CONTENT_TYPE.JSON]: {
            schema: getModelSchemaRefSF(UserInvitation, {
              includeRelations: true,
            }),
          },
        },
      },
    },
  })
  async findById(
    @param.path.string('id') id: string,
    @param.filter(UserInvitation, {exclude: 'where'})
    filter?: FilterExcludingWhere<UserInvitation>,
  ): Promise<UserInvitation> {
    // SECURITY FIX: Verify invitation belongs to current tenant
    const tenantId = this.getTenantId();
    const invitation = await this.userInvitationRepository.findById(id, filter);

    if (invitation.tenantId !== tenantId) {
      throw new HttpErrors.Forbidden('Cannot access invitation from another tenant');
    }

    return invitation;
  }

  /**
   * Get invitation by token.
   * Used for accepting invitations via email link.
   * No authentication required for public invitation acceptance.
   * GAP-002 FIX: Rate limited to prevent token enumeration attacks.
   */
  @ratelimit(true, {
    max: Number.parseInt(process.env.PUBLIC_API_MAX_ATTEMPTS ?? '10'),
    keyGenerator: rateLimitKeyGenPublic,
  })
  @authorize({permissions: ['*']})
  @get(`${basePath}/by-token/{token}`, {
    responses: {
      [STATUS_CODE.OK]: {
        description: 'UserInvitation model instance',
        content: {
          [CONTENT_TYPE.JSON]: {
            schema: getModelSchemaRefSF(UserInvitation, {
              includeRelations: true,
            }),
          },
        },
      },
    },
  })
  async findByToken(
    @param.path.string('token') token: string,
  ): Promise<UserInvitation> {
    const invitation = await this.userInvitationRepository.findOne({
      where: {token, deleted: false},
      include: ['tenant'],
    });

    if (!invitation) {
      throw new HttpErrors.NotFound('Invalid or expired invitation token');
    }

    return invitation;
  }

  /**
   * Accept an invitation.
   * Creates user account and marks invitation as accepted.
   * No authentication required for public invitation acceptance.
   * GAP-002 FIX: Stricter rate limiting (5 attempts) to prevent brute force.
   */
  @ratelimit(true, {
    max: 5, // Stricter limit for account creation
    keyGenerator: rateLimitKeyGenPublic,
  })
  @authorize({permissions: ['*']})
  @post(`${basePath}/{token}/accept`, {
    responses: {
      [STATUS_CODE.OK]: {
        description: 'Invitation accepted, user account created',
        content: {
          [CONTENT_TYPE.JSON]: {
            schema: {
              type: 'object',
              properties: {
                userId: {type: 'string'},
                message: {type: 'string'},
              },
            },
          },
        },
      },
    },
  })
  async acceptInvitation(
    @param.path.string('token') token: string,
    @requestBody({
      content: {
        [CONTENT_TYPE.JSON]: {
          schema: {
            type: 'object',
            required: ['password'],
            properties: {
              password: {
                type: 'string',
                minLength: 8,
                pattern: '^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]{8,}$',
                description: 'Minimum 8 characters, at least one uppercase, one lowercase, one number, one special character (@$!%*?&)',
              },
              firstName: {type: 'string'},
              lastName: {type: 'string'},
            },
          },
        },
      },
    })
    acceptData: {
      password: string;
      firstName?: string;
      lastName?: string;
    },
  ): Promise<{userId: string; message: string}> {
    // Use service to handle invitation acceptance workflow
    const user = await this.invitationService.acceptInvitation(token, acceptData);

    // Log activity and audit (non-blocking)
    const invitation = await this.userInvitationRepository.findOne({
      where: {token},
    });

    if (invitation) {
      try {
        await this.activityLogger.logInvitationAccepted(
          user.id,
          user.tenantId,
          invitation.id,
        );
        await this.auditLogger.logInvitationAccepted(
          invitation.id,
          invitation.email,
          user.id,
          user.tenantId,
        );
      } catch {
        // Don't fail the operation if logging fails
      }
    }

    return {
      userId: user.id,
      message: 'Invitation accepted successfully. User account created.',
    };
  }

  /**
   * Send invitation email for an existing invitation.
   * Called by Temporal activities to send the email via Novu.
   * No authentication required since this is called from within the system.
   * GAP-002 FIX: Rate limited to prevent email spam abuse.
   */
  @ratelimit(true, {
    max: 20, // Higher limit for internal system calls
    keyGenerator: rateLimitKeyGenPublic,
  })
  @authorize({permissions: ['*']})
  @post(`${basePath}/{id}/send-email`, {
    responses: {
      [STATUS_CODE.OK]: {
        description: 'Email send result',
        content: {
          [CONTENT_TYPE.JSON]: {
            schema: {
              type: 'object',
              properties: {
                success: {type: 'boolean'},
                transactionId: {type: 'string'},
                error: {type: 'string'},
              },
            },
          },
        },
      },
    },
  })
  async sendEmail(
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        [CONTENT_TYPE.JSON]: {
          schema: {
            type: 'object',
            required: ['token', 'expiresAt'],
            properties: {
              token: {type: 'string'},
              expiresAt: {type: 'string'},
            },
          },
        },
      },
    })
    emailData: {
      token: string;
      expiresAt: string;
    },
  ): Promise<{success: boolean; transactionId?: string; error?: string}> {
    return this.invitationService.sendInvitationEmail(
      id,
      emailData.token,
      emailData.expiresAt,
    );
  }

  /**
   * Resend an invitation email.
   * Generates new token and sends email again.
   */
  @authorize({
    permissions: [PermissionKey.ResendInvitation],
  })
  @authenticate(STRATEGY.BEARER, {
    passReqToCallback: true,
  })
  @post(`${basePath}/{id}/resend`, {
    security: OPERATION_SECURITY_SPEC,
    responses: {
      [STATUS_CODE.NO_CONTENT]: {
        description: 'Invitation email resent',
      },
    },
  })
  async resend(@param.path.string('id') id: string): Promise<void> {
    // Get invitation before resending for audit log
    const invitation = await this.userInvitationRepository.findById(id);

    // Use service to resend invitation with new token
    await this.invitationService.resendInvitation(id);

    // Log audit (non-blocking)
    try {
      await this.auditLogger.logInvitationResent(
        id,
        invitation.email,
        invitation.tenantId,
      );
    } catch {
      // Don't fail the operation if logging fails
    }
  }

  /**
   * Revoke a pending invitation.
   * Sets invitation status to revoked.
   */
  @authorize({
    permissions: [PermissionKey.RevokeInvitation],
  })
  @authenticate(STRATEGY.BEARER, {
    passReqToCallback: true,
  })
  @post(`${basePath}/{id}/revoke`, {
    security: OPERATION_SECURITY_SPEC,
    responses: {
      [STATUS_CODE.NO_CONTENT]: {
        description: 'Invitation revoked',
      },
    },
  })
  async revoke(@param.path.string('id') id: string): Promise<void> {
    // Get invitation before revoking for audit log
    const invitation = await this.userInvitationRepository.findById(id);

    // Use service to revoke invitation
    await this.invitationService.revokeInvitation(id);

    // Log activity and audit (non-blocking)
    try {
      await this.activityLogger.logInvitationRevoked(
        invitation.invitedBy,
        invitation.tenantId,
        id,
      );
      await this.auditLogger.logInvitationRevoked(
        id,
        invitation.email,
        invitation.tenantId,
      );
    } catch {
      // Don't fail the operation if logging fails
    }
  }

  /**
   * Delete an invitation.
   * Soft delete for audit trail.
   */
  @authorize({
    permissions: [PermissionKey.RevokeInvitation],
  })
  @authenticate(STRATEGY.BEARER, {
    passReqToCallback: true,
  })
  @del(`${basePath}/{id}`, {
    security: OPERATION_SECURITY_SPEC,
    responses: {
      [STATUS_CODE.NO_CONTENT]: {
        description: 'UserInvitation DELETE success',
      },
    },
  })
  async deleteById(@param.path.string('id') id: string): Promise<void> {
    await this.userInvitationRepository.deleteById(id);
  }

  /**
   * GAP-001 FIX: Clean up expired invitations.
   * Marks all pending invitations past their expiry as expired.
   * Should be called by a scheduled job or admin action.
   */
  @authorize({
    permissions: [PermissionKey.RevokeInvitation],
  })
  @authenticate(STRATEGY.BEARER, {
    passReqToCallback: true,
  })
  @post(`${basePath}/cleanup-expired`, {
    security: OPERATION_SECURITY_SPEC,
    responses: {
      [STATUS_CODE.OK]: {
        description: 'Cleanup result',
        content: {
          [CONTENT_TYPE.JSON]: {
            schema: {
              type: 'object',
              properties: {
                expiredCount: {type: 'number'},
                message: {type: 'string'},
              },
            },
          },
        },
      },
    },
  })
  async cleanupExpired(): Promise<{expiredCount: number; message: string}> {
    const result = await this.invitationService.cleanupExpiredInvitations();
    return {
      ...result,
      message: `Marked ${result.expiredCount} expired invitations`,
    };
  }
}
