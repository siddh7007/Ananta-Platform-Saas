-- Create user_activities table for activity logging and audit trail
CREATE TABLE main.user_activities(
    id uuid DEFAULT (md5(((random())::text ||(clock_timestamp())::text))) ::uuid NOT NULL,
    user_id uuid NOT NULL,
    tenant_id uuid NOT NULL,
    action varchar(100) NOT NULL,  -- e.g., 'user.created', 'user.login', 'user.role_changed', 'user.suspended'
    entity_type varchar(50),  -- e.g., 'user', 'tenant', 'subscription', 'invoice'
    entity_id uuid,  -- ID of the affected entity
    metadata jsonb,  -- Additional context (e.g., changed fields, IP address, user agent)
    ip_address varchar(45),  -- IPv4 or IPv6
    user_agent text,
    occurred_at timestamptz DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT pk_user_activities_id PRIMARY KEY (id),
    CONSTRAINT fk_user_activities_users FOREIGN KEY (user_id) REFERENCES main.users(id) ON DELETE CASCADE,
    CONSTRAINT fk_user_activities_tenants FOREIGN KEY (tenant_id) REFERENCES main.tenants(id)
);

-- Create indexes for efficient activity querying and filtering
CREATE INDEX idx_user_activities_user_id ON main.user_activities(user_id, occurred_at DESC);
CREATE INDEX idx_user_activities_tenant_id ON main.user_activities(tenant_id, occurred_at DESC);
CREATE INDEX idx_user_activities_action ON main.user_activities(action, occurred_at DESC);
CREATE INDEX idx_user_activities_entity ON main.user_activities(entity_type, entity_id, occurred_at DESC);
CREATE INDEX idx_user_activities_occurred_at ON main.user_activities(occurred_at DESC);

-- Add comments for documentation
COMMENT ON TABLE main.user_activities IS 'User activity log for audit trail and user behavior tracking';
COMMENT ON COLUMN main.user_activities.action IS 'Action identifier (e.g., user.created, user.login, user.role_changed)';
COMMENT ON COLUMN main.user_activities.entity_type IS 'Type of entity affected by the action';
COMMENT ON COLUMN main.user_activities.entity_id IS 'UUID of the affected entity';
COMMENT ON COLUMN main.user_activities.metadata IS 'JSON metadata containing additional context (changed fields, IP, user agent, etc.)';
COMMENT ON COLUMN main.user_activities.occurred_at IS 'Timestamp when the activity occurred';
