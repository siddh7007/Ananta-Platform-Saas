-- Create user_invitations table for email-based user invitation workflow
CREATE TABLE main.user_invitations(
    id uuid DEFAULT (md5(((random())::text ||(clock_timestamp())::text))) ::uuid NOT NULL,
    email varchar(255) NOT NULL,
    token varchar(255) NOT NULL,  -- Secure random token for invitation link
    role_key varchar(50) NOT NULL,  -- Initial role to assign upon acceptance
    invited_by uuid NOT NULL,  -- User who sent the invitation
    tenant_id uuid NOT NULL,
    expires_at timestamptz NOT NULL,  -- Invitation expiration (typically 7 days)
    status smallint DEFAULT 0 NOT NULL,  -- 0=pending, 1=accepted, 2=expired, 3=revoked
    accepted_at timestamptz,
    accepted_by uuid,  -- User ID created upon acceptance
    -- Additional invitation metadata
    first_name varchar(100),
    last_name varchar(100),
    custom_message text,
    -- Audit fields
    created_on timestamptz DEFAULT CURRENT_TIMESTAMP NOT NULL,
    modified_on timestamptz DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by uuid,
    modified_by uuid,
    deleted boolean DEFAULT FALSE NOT NULL,
    deleted_on timestamptz,
    deleted_by uuid,
    CONSTRAINT pk_user_invitations_id PRIMARY KEY (id),
    CONSTRAINT fk_user_invitations_invited_by FOREIGN KEY (invited_by) REFERENCES main.users(id),
    CONSTRAINT fk_user_invitations_tenants FOREIGN KEY (tenant_id) REFERENCES main.tenants(id),
    CONSTRAINT fk_user_invitations_accepted_by FOREIGN KEY (accepted_by) REFERENCES main.users(id),
    CONSTRAINT uk_user_invitations_token UNIQUE (token),
    -- Security: Ensure token is sufficiently long (minimum 32 characters)
    CONSTRAINT ck_user_invitations_token_length CHECK (length(token) >= 32),
    -- Business logic: Ensure expiration is in the future relative to creation
    CONSTRAINT ck_user_invitations_expires_future CHECK (expires_at > created_on)
);

-- Create indexes for efficient querying
CREATE INDEX idx_user_invitations_email ON main.user_invitations(email) WHERE deleted = FALSE;
CREATE INDEX idx_user_invitations_tenant_id ON main.user_invitations(tenant_id) WHERE deleted = FALSE;
CREATE INDEX idx_user_invitations_token ON main.user_invitations(token) WHERE deleted = FALSE AND status = 0;
CREATE INDEX idx_user_invitations_status ON main.user_invitations(status, expires_at) WHERE deleted = FALSE;

-- Add comments for documentation
COMMENT ON TABLE main.user_invitations IS 'User invitation tokens with role assignment and expiration tracking';
COMMENT ON COLUMN main.user_invitations.token IS 'Secure random token embedded in invitation link';
COMMENT ON COLUMN main.user_invitations.status IS '0=pending, 1=accepted, 2=expired, 3=revoked';
COMMENT ON COLUMN main.user_invitations.expires_at IS 'Invitation expiration timestamp (typically created_on + 7 days)';
COMMENT ON COLUMN main.user_invitations.custom_message IS 'Optional personalized message from inviter';
