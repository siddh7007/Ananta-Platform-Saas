import {belongsTo, model, property} from '@loopback/repository';
import {UserModifiableEntity} from '@sourceloop/core';
import {UserInvitationStatus} from '../enums';
import {numericEnumValues} from '../utils';
import {User} from './user.model';
import {Tenant} from './tenant.model';

/**
 * UserInvitation model for email-based user invitation workflow.
 * Manages invitation tokens, expiration, and acceptance tracking.
 */
@model({
  name: 'user_invitations',
  description:
    'User invitation tokens with role assignment and expiration tracking',
})
export class UserInvitation extends UserModifiableEntity {
  @property({
    type: 'string',
    id: true,
    generated: true,
    postgresql: {
      dataType: 'uuid',
    },
  })
  id: string;

  @property({
    type: 'string',
    required: true,
    jsonSchema: {
      format: 'email',
      maxLength: 255,
    },
    description: 'Invitee email address',
  })
  email: string;

  @property({
    type: 'string',
    required: true,
    jsonSchema: {
      maxLength: 255,
    },
    description: 'Secure random token embedded in invitation link',
  })
  token: string;

  @property({
    type: 'string',
    name: 'role_key',
    required: true,
    jsonSchema: {
      maxLength: 50,
    },
    description: 'Initial role to assign upon acceptance',
  })
  roleKey: string;

  @property({
    type: 'date',
    name: 'expires_at',
    required: true,
    description: 'Invitation expiration timestamp (typically created_on + 7 days)',
  })
  expiresAt: Date;

  @property({
    type: 'number',
    required: true,
    default: UserInvitationStatus.Pending,
    jsonSchema: {
      enum: numericEnumValues(UserInvitationStatus),
    },
    description: 'Invitation status: 0=pending, 1=accepted, 2=expired, 3=revoked',
  })
  status: UserInvitationStatus;

  @property({
    type: 'date',
    name: 'accepted_at',
    description: 'Acceptance timestamp',
  })
  acceptedAt?: Date;

  @property({
    type: 'string',
    name: 'first_name',
    jsonSchema: {
      maxLength: 100,
    },
    description: 'Optional first name',
  })
  firstName?: string;

  @property({
    type: 'string',
    name: 'last_name',
    jsonSchema: {
      maxLength: 100,
    },
    description: 'Optional last name',
  })
  lastName?: string;

  @property({
    type: 'string',
    name: 'custom_message',
    description: 'Optional personalized message from inviter',
  })
  customMessage?: string;

  @property({
    type: 'date',
    name: 'last_email_sent_at',
    description: 'Timestamp of last email sent (for cooldown enforcement)',
  })
  lastEmailSentAt?: Date;

  @property({
    type: 'number',
    name: 'resend_count',
    default: 0,
    description: 'Number of times invitation has been resent',
  })
  resendCount: number;

  /**
   * User who sent the invitation.
   * Optional to allow admin/system invitations where inviter may not have a DB user record.
   */
  @belongsTo(() => User, {name: 'invitedByUser'}, {
    name: 'invited_by',
    required: false,
  })
  invitedBy?: string;

  /**
   * Tenant for multi-tenant isolation.
   */
  @belongsTo(() => Tenant, {name: 'tenant'}, {
    name: 'tenant_id',
    required: true,
  })
  tenantId: string;

  /**
   * User ID created upon invitation acceptance.
   * Links the invitation to the resulting user account.
   */
  @belongsTo(() => User, {name: 'acceptedByUser'}, {
    name: 'accepted_by',
  })
  acceptedBy?: string;

  constructor(data?: Partial<UserInvitation>) {
    super(data);
  }

  /**
   * Check if invitation is still valid (not expired and status is pending).
   */
  get isValid(): boolean {
    return (
      this.status === UserInvitationStatus.Pending &&
      this.expiresAt > new Date()
    );
  }
}

export interface UserInvitationRelations {
  invitedByUser?: User;
  tenant?: Tenant;
  acceptedByUser?: User;
}

export type UserInvitationWithRelations = UserInvitation &
  UserInvitationRelations;
