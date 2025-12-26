-- Create users table for user management
CREATE TABLE main.users(
    id uuid DEFAULT (md5(((random())::text ||(clock_timestamp())::text))) ::uuid NOT NULL,
    email varchar(255) NOT NULL,
    first_name varchar(100) NOT NULL,
    last_name varchar(100) NOT NULL,
    auth_id varchar(255),  -- Keycloak user ID for SSO integration
    status smallint DEFAULT 0 NOT NULL,  -- 0=pending, 1=active, 2=suspended, 3=deactivated
    tenant_id uuid NOT NULL,
    phone varchar(50),
    avatar_url varchar(500),
    last_login timestamptz,
    -- Audit fields (following UserModifiableEntity pattern)
    created_on timestamptz DEFAULT CURRENT_TIMESTAMP NOT NULL,
    modified_on timestamptz DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by uuid,
    modified_by uuid,
    deleted boolean DEFAULT FALSE NOT NULL,
    deleted_on timestamptz,
    deleted_by uuid,
    CONSTRAINT pk_users_id PRIMARY KEY (id),
    CONSTRAINT fk_users_tenants FOREIGN KEY (tenant_id) REFERENCES main.tenants(id),
    CONSTRAINT uk_users_email_tenant UNIQUE (email, tenant_id)
);

-- Create indexes for efficient querying
CREATE INDEX idx_users_tenant_id ON main.users(tenant_id) WHERE deleted = FALSE;
CREATE INDEX idx_users_email ON main.users(email) WHERE deleted = FALSE;
CREATE INDEX idx_users_status ON main.users(status) WHERE deleted = FALSE;

-- Create unique index for auth_id (allows multiple NULLs, but ensures uniqueness for non-NULL values)
CREATE UNIQUE INDEX uk_users_auth_id ON main.users(auth_id) WHERE auth_id IS NOT NULL;

-- Add comment for documentation
COMMENT ON TABLE main.users IS 'User accounts with multi-tenant support and Keycloak SSO integration';
COMMENT ON COLUMN main.users.auth_id IS 'Keycloak user UUID for SSO authentication';
COMMENT ON COLUMN main.users.status IS '0=pending, 1=active, 2=suspended, 3=deactivated';
