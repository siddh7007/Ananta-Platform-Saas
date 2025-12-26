import {belongsTo, model, property} from '@loopback/repository';
import {UserModifiableEntity} from '@sourceloop/core';
import {RoleScopeType} from '../enums';
import {User} from './user.model';
import {Tenant} from './tenant.model';

/**
 * UserRole model for role-based access control (RBAC).
 * Supports hierarchical permissions at tenant, workspace, and project levels.
 */
@model({
  name: 'user_roles',
  description:
    'User role assignments with support for tenant, workspace, and project level permissions',
})
export class UserRole extends UserModifiableEntity {
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
    name: 'role_key',
    required: true,
    jsonSchema: {
      maxLength: 50,
    },
    description: 'Role identifier (admin, member, billing_manager, viewer, etc.)',
  })
  roleKey: string;

  @property({
    type: 'array',
    itemType: 'string',
    required: false,
    postgresql: {
      dataType: 'text[]',
    },
    description: 'Array of permission codes granted by this role',
  })
  permissions?: string[];

  @property({
    type: 'string',
    name: 'scope_type',
    required: true,
    default: RoleScopeType.Tenant,
    jsonSchema: {
      enum: Object.values(RoleScopeType),
    },
    description: 'Scope of the role: tenant (org-wide), workspace, or project',
  })
  scopeType: RoleScopeType;

  @property({
    type: 'string',
    name: 'scope_id',
    postgresql: {
      dataType: 'uuid',
    },
    description: 'NULL for tenant-level roles, otherwise references workspace or project',
  })
  scopeId?: string;

  /**
   * User to whom this role is assigned.
   */
  @belongsTo(() => User, {name: 'user'}, {
    name: 'user_id',
    required: true,
  })
  userId: string;

  /**
   * Tenant for multi-tenant isolation.
   * Always required even for workspace/project scopes.
   */
  @belongsTo(() => Tenant, {name: 'tenant'}, {
    name: 'tenant_id',
    required: true,
  })
  tenantId: string;

  constructor(data?: Partial<UserRole>) {
    super(data);
  }
}

export interface UserRoleRelations {
  user?: User;
  tenant?: Tenant;
}

export type UserRoleWithRelations = UserRole & UserRoleRelations;
