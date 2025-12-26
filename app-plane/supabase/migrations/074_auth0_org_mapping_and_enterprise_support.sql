-- Migration: Auth0 Organization Mapping for Enterprise Customers
-- Date: 2025-11-30
-- Description:
--   Adds auth0_org_id column to organizations table to map Auth0 organizations
--   to Supabase organizations. This enables Enterprise Customer support where
--   users are invited to an Auth0 organization and automatically assigned to
--   the corresponding Supabase organization.
--
-- Use Cases:
--   1. Enterprise Customer: User logs in with Auth0 org_id → lookup org by auth0_org_id
--   2. Platform Admin: Uses PLATFORM_ORG_ID (unchanged)
--   3. Individual Customer: No org_id, creates own organization (unchanged)

-- ============================================================================
-- STEP 1: Add auth0_org_id column to organizations
-- ============================================================================
ALTER TABLE organizations
    ADD COLUMN IF NOT EXISTS auth0_org_id TEXT;

-- ============================================================================
-- STEP 2: Create unique index on auth0_org_id (for fast lookups)
-- ============================================================================
-- Note: Partial index excludes NULLs (individual orgs won't have auth0_org_id)
CREATE UNIQUE INDEX IF NOT EXISTS idx_organizations_auth0_org_id
    ON organizations (auth0_org_id)
    WHERE auth0_org_id IS NOT NULL;

-- ============================================================================
-- STEP 3: Add enterprise-specific columns
-- ============================================================================
-- Track enterprise organization details
ALTER TABLE organizations
    ADD COLUMN IF NOT EXISTS enterprise_name TEXT,
    ADD COLUMN IF NOT EXISTS enterprise_domain TEXT,
    ADD COLUMN IF NOT EXISTS enterprise_settings JSONB DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS max_users INTEGER DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS sso_enabled BOOLEAN DEFAULT FALSE;

-- ============================================================================
-- STEP 4: Add comments explaining the columns
-- ============================================================================
COMMENT ON COLUMN organizations.auth0_org_id IS
    'Auth0 organization ID (e.g., org_abc123). Used to map Auth0 orgs to Supabase orgs. '
    'NULL for individual/self-signup customers. Set when creating enterprise organizations.';

COMMENT ON COLUMN organizations.enterprise_name IS
    'Full enterprise name (e.g., "Acme Corporation"). NULL for individual orgs.';

COMMENT ON COLUMN organizations.enterprise_domain IS
    'Enterprise email domain for SSO (e.g., "acme.com"). NULL for individual orgs.';

COMMENT ON COLUMN organizations.enterprise_settings IS
    'JSONB settings for enterprise-specific configuration (SSO config, branding, etc.)';

COMMENT ON COLUMN organizations.max_users IS
    'Maximum users allowed in organization. NULL = unlimited (individual plans use plan limits).';

COMMENT ON COLUMN organizations.sso_enabled IS
    'Whether SSO is enabled for this organization (enterprise feature).';

-- ============================================================================
-- STEP 5: Create helper function for enterprise org lookup
-- ============================================================================
CREATE OR REPLACE FUNCTION get_organization_by_auth0_id(p_auth0_org_id TEXT)
RETURNS TABLE (
    id UUID,
    name TEXT,
    org_type TEXT,
    auth0_org_id TEXT,
    enterprise_name TEXT,
    max_users INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        o.id,
        o.name,
        o.org_type,
        o.auth0_org_id,
        o.enterprise_name,
        o.max_users
    FROM organizations o
    WHERE o.auth0_org_id = p_auth0_org_id
    LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- STEP 6: Update org_type enum to include 'enterprise'
-- ============================================================================
-- First check what org_type values exist
DO $$
BEGIN
    -- If org_type is a proper enum, alter it
    -- If it's TEXT, we can add check constraint
    -- For now, just ensure 'enterprise' is a valid value

    -- Add check constraint if not exists (allows: individual, team, enterprise, platform, or NULL)
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'organizations_org_type_check'
    ) THEN
        -- org_type is likely TEXT, add constraint
        -- Note: IN with NULL doesn't work (returns UNKNOWN), so use explicit IS NULL OR IN
        ALTER TABLE organizations
            ADD CONSTRAINT organizations_org_type_check
            CHECK (org_type IS NULL OR org_type IN ('individual', 'team', 'enterprise', 'platform'));
    END IF;
EXCEPTION
    WHEN others THEN
        RAISE NOTICE 'org_type constraint already exists or org_type is not TEXT: %', SQLERRM;
END $$;

-- ============================================================================
-- STEP 7: Verify changes
-- ============================================================================
DO $$
BEGIN
    -- Check auth0_org_id column exists
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'organizations'
        AND column_name = 'auth0_org_id'
    ) THEN
        RAISE NOTICE 'SUCCESS: organizations.auth0_org_id column added';
    ELSE
        RAISE WARNING 'FAIL: organizations.auth0_org_id column not found';
    END IF;

    -- Check index exists
    IF EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE indexname = 'idx_organizations_auth0_org_id'
    ) THEN
        RAISE NOTICE 'SUCCESS: idx_organizations_auth0_org_id index created';
    ELSE
        RAISE WARNING 'FAIL: idx_organizations_auth0_org_id index not found';
    END IF;
END $$;
