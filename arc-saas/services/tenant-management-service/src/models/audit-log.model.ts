import {belongsTo, model, property} from '@loopback/repository';
import {Entity} from '@loopback/repository';
import {Tenant} from './tenant.model';

/**
 * AuditLog model following ARC audit-service pattern.
 * Stores administrative actions and system events for audit trail.
 */
@model({
  name: 'audit_logs',
  settings: {
    strict: false,
  },
})
export class AuditLog extends Entity {
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
    description: 'Action identifier (e.g., tenant.created, user.login)',
  })
  action: string;

  @property({
    type: 'string',
    name: 'actor_id',
    required: true,
    postgresql: {
      dataType: 'uuid',
    },
    description: 'UUID of the user who performed the action',
  })
  actorId: string;

  @property({
    type: 'string',
    name: 'actor_name',
    jsonSchema: {
      maxLength: 200,
    },
    description: 'Name of the actor at time of action',
  })
  actorName?: string;

  @property({
    type: 'string',
    name: 'actor_email',
    jsonSchema: {
      maxLength: 255,
    },
    description: 'Email of the actor at time of action',
  })
  actorEmail?: string;

  @property({
    type: 'string',
    name: 'target_type',
    jsonSchema: {
      maxLength: 50,
    },
    description: 'Type of entity affected (tenant, user, subscription, etc.)',
  })
  targetType?: string;

  @property({
    type: 'string',
    name: 'target_id',
    postgresql: {
      dataType: 'uuid',
    },
    description: 'UUID of the affected entity',
  })
  targetId?: string;

  @property({
    type: 'string',
    name: 'target_name',
    jsonSchema: {
      maxLength: 200,
    },
    description: 'Name of the target at time of action',
  })
  targetName?: string;

  @property({
    type: 'string',
    name: 'tenant_name',
    jsonSchema: {
      maxLength: 200,
    },
    description: 'Tenant name at time of action',
  })
  tenantName?: string;

  @property({
    type: 'object',
    postgresql: {
      dataType: 'jsonb',
    },
    description: 'Additional details/context for the action',
  })
  details?: object;

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
    type: 'string',
    required: true,
    jsonSchema: {
      enum: ['success', 'failure', 'warning'],
    },
    default: 'success',
    description: 'Status of the action',
  })
  status: 'success' | 'failure' | 'warning';

  @property({
    type: 'date',
    required: true,
    default: () => new Date(),
    description: 'Timestamp when the action occurred',
  })
  timestamp: Date;

  /**
   * Tenant for multi-tenant isolation.
   */
  @belongsTo(
    () => Tenant,
    {name: 'tenant'},
    {
      name: 'tenant_id',
    },
  )
  tenantId?: string;

  // Allow additional properties for flexibility (ARC pattern)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [prop: string]: any;

  constructor(data?: Partial<AuditLog>) {
    super(data);
  }
}

export interface AuditLogRelations {
  tenant?: Tenant;
}

export type AuditLogWithRelations = AuditLog & AuditLogRelations;
