import {belongsTo, model, property} from '@loopback/repository';
import {Entity} from '@loopback/repository';
import {User} from './user.model';
import {Tenant} from './tenant.model';

/**
 * UserActivity model for activity logging and audit trail.
 * Captures user actions across the platform for security and compliance.
 */
@model({
  name: 'user_activities',
  description:
    'User activity log for audit trail and user behavior tracking',
})
export class UserActivity extends Entity {
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
      maxLength: 100,
    },
    description:
      'Action identifier (e.g., user.created, user.login, user.role_changed)',
  })
  action: string;

  @property({
    type: 'string',
    name: 'entity_type',
    jsonSchema: {
      maxLength: 50,
    },
    description: 'Type of entity affected by the action (user, tenant, subscription, etc.)',
  })
  entityType?: string;

  @property({
    type: 'string',
    name: 'entity_id',
    postgresql: {
      dataType: 'uuid',
    },
    description: 'UUID of the affected entity',
  })
  entityId?: string;

  @property({
    type: 'object',
    postgresql: {
      dataType: 'jsonb',
    },
    description:
      'JSON metadata containing additional context (changed fields, IP, user agent, etc.)',
  })
  metadata?: object;

  @property({
    type: 'string',
    name: 'ip_address',
    jsonSchema: {
      maxLength: 45,
    },
    description: 'IPv4 or IPv6 address',
  })
  ipAddress?: string;

  @property({
    type: 'string',
    name: 'user_agent',
    description: 'Browser/client user agent string',
  })
  userAgent?: string;

  @property({
    type: 'date',
    name: 'occurred_at',
    required: true,
    default: () => new Date(),
    description: 'Timestamp when the activity occurred',
  })
  occurredAt: Date;

  /**
   * User who performed the action.
   */
  @belongsTo(() => User, {name: 'user'}, {
    name: 'user_id',
    required: true,
  })
  userId: string;

  /**
   * Tenant for multi-tenant isolation and analytics.
   */
  @belongsTo(() => Tenant, {name: 'tenant'}, {
    name: 'tenant_id',
    required: true,
  })
  tenantId: string;

  constructor(data?: Partial<UserActivity>) {
    super(data);
  }
}

export interface UserActivityRelations {
  user?: User;
  tenant?: Tenant;
}

export type UserActivityWithRelations = UserActivity & UserActivityRelations;
