-- Add identity_provider column to tenants table
-- This field determines which IdP (Keycloak, Auth0, Cognito) to use for user authentication

ALTER TABLE main.tenants
ADD COLUMN identity_provider VARCHAR(50) DEFAULT 'keycloak' NOT NULL;

-- Add check constraint to ensure only valid IdP values
ALTER TABLE main.tenants
ADD CONSTRAINT tenants_identity_provider_check
CHECK (identity_provider IN ('keycloak', 'auth0', 'cognito'));

-- Create index for performance
CREATE INDEX idx_tenants_identity_provider ON main.tenants(identity_provider);

-- Add comment for documentation
COMMENT ON COLUMN main.tenants.identity_provider IS 'Identity provider type: keycloak, auth0, or cognito';
