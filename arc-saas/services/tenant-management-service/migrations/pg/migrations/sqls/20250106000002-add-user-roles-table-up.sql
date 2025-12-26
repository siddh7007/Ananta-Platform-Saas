-- Create user_roles table for role-based access control (RBAC)
CREATE TABLE main.user_roles(
    id uuid DEFAULT (md5(((random())::text ||(clock_timestamp())::text))) ::uuid NOT NULL,
    user_id uuid NOT NULL,
    role_key varchar(50) NOT NULL,  -- e.g., 'admin', 'member', 'billing_manager', 'viewer'
    permissions text[],  -- Array of permission codes (e.g., ['CreateUser', 'ViewUser', 'UpdateUser'])
    scope_type varchar(50) DEFAULT 'tenant' NOT NULL,  -- 'tenant', 'workspace', 'project'
    scope_id uuid,  -- NULL for tenant-level roles, otherwise workspace/project ID
    tenant_id uuid NOT NULL,  -- Always required for multi-tenant isolation
    -- Audit fields
    created_on timestamptz DEFAULT CURRENT_TIMESTAMP NOT NULL,
    modified_on timestamptz DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by uuid,
    modified_by uuid,
    deleted boolean DEFAULT FALSE NOT NULL,
    deleted_on timestamptz,
    deleted_by uuid,
    CONSTRAINT pk_user_roles_id PRIMARY KEY (id),
    CONSTRAINT fk_user_roles_users FOREIGN KEY (user_id) REFERENCES main.users(id) ON DELETE CASCADE,
    CONSTRAINT fk_user_roles_tenants FOREIGN KEY (tenant_id) REFERENCES main.tenants(id),
    -- Ensure a user can't have duplicate roles in the same scope
    CONSTRAINT uk_user_roles_unique UNIQUE (user_id, role_key, scope_type, scope_id)
);

-- Create indexes for efficient permission checking
CREATE INDEX idx_user_roles_user_id ON main.user_roles(user_id) WHERE deleted = FALSE;
CREATE INDEX idx_user_roles_tenant_id ON main.user_roles(tenant_id) WHERE deleted = FALSE;
CREATE INDEX idx_user_roles_role_key ON main.user_roles(role_key) WHERE deleted = FALSE;
CREATE INDEX idx_user_roles_scope ON main.user_roles(scope_type, scope_id) WHERE deleted = FALSE;

-- Add comments for documentation
COMMENT ON TABLE main.user_roles IS 'User role assignments with support for tenant, workspace, and project level permissions';
COMMENT ON COLUMN main.user_roles.role_key IS 'Role identifier (admin, member, billing_manager, viewer, etc.)';
COMMENT ON COLUMN main.user_roles.permissions IS 'Array of permission codes granted by this role';
COMMENT ON COLUMN main.user_roles.scope_type IS 'Scope of the role: tenant (org-wide), workspace, or project';
COMMENT ON COLUMN main.user_roles.scope_id IS 'NULL for tenant-level roles, otherwise references workspace or project';
