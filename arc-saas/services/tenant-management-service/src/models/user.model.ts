import {belongsTo, hasMany, model, property} from '@loopback/repository';
import {UserModifiableEntity} from '@sourceloop/core';
import {UserStatus} from '../enums';
import {numericEnumValues} from '../utils';
import {Tenant} from './tenant.model';
import {UserRole} from './user-role.model';
import {UserActivity} from './user-activity.model';

/**
 * User model representing a user account in the multi-tenant system.
 * Integrates with Keycloak for SSO authentication via auth_id field.
 */
@model({
  name: 'users',
  description:
    'User accounts with multi-tenant support and Keycloak SSO integration',
})
export class User extends UserModifiableEntity {
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
    description: 'User email address (unique per tenant)',
  })
  email: string;

  @property({
    type: 'string',
    name: 'first_name',
    required: true,
    jsonSchema: {
      maxLength: 100,
    },
    description: 'First name',
  })
  firstName: string;

  @property({
    type: 'string',
    name: 'last_name',
    required: true,
    jsonSchema: {
      maxLength: 100,
    },
    description: 'Last name',
  })
  lastName: string;

  @property({
    type: 'string',
    name: 'auth_id',
    description: 'Keycloak user UUID for SSO authentication',
    jsonSchema: {
      maxLength: 255,
    },
  })
  authId?: string;

  @property({
    type: 'number',
    required: true,
    default: UserStatus.Pending,
    jsonSchema: {
      enum: numericEnumValues(UserStatus),
    },
    description: 'User status: 0=pending, 1=active, 2=suspended, 3=deactivated',
  })
  status: UserStatus;

  @property({
    type: 'string',
    jsonSchema: {
      maxLength: 50,
    },
    description: 'Phone number',
  })
  phone?: string;

  @property({
    type: 'string',
    name: 'avatar_url',
    jsonSchema: {
      format: 'uri',
      maxLength: 500,
    },
    description: 'Profile picture URL',
  })
  avatarUrl?: string;

  @property({
    type: 'date',
    name: 'last_login',
    description: 'Last successful login timestamp',
  })
  lastLogin?: Date;

  /**
   * Tenant to which this user belongs.
   * Essential for multi-tenant data isolation.
   */
  @belongsTo(() => Tenant, {name: 'tenant'}, {
    name: 'tenant_id',
    required: true,
  })
  tenantId: string;

  /**
   * Roles assigned to this user.
   * Supports hierarchical RBAC (tenant, workspace, project scopes).
   */
  @hasMany(() => UserRole, {
    keyTo: 'userId',
  })
  roles: UserRole[];

  /**
   * Activity log entries for this user.
   * Tracks user actions for audit trail.
   */
  @hasMany(() => UserActivity, {
    keyTo: 'userId',
  })
  activities: UserActivity[];

  constructor(data?: Partial<User>) {
    super(data);
  }

  /**
   * Get the full name of the user.
   */
  get fullName(): string {
    return `${this.firstName} ${this.lastName}`;
  }
}

export interface UserRelations {
  tenant?: Tenant;
  roles?: UserRole[];
  activities?: UserActivity[];
}

export type UserWithRelations = User & UserRelations;
