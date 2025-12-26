-- Migration: Make alert_preferences.user_id nullable for Auth0 users
-- Date: 2025-11-30
-- Description:
--   Auth0 users have non-UUID user IDs (e.g., google-oauth2|...) which cannot be
--   stored in the user_id UUID column. For these users, we key preferences by
--   organization_id only.
--
-- Changes:
--   1. Make user_id nullable (allows Auth0 users without UUID user_id)
--   2. Drop old foreign key constraint
--   3. Create new unique constraint on (organization_id, alert_type)
--   4. Update unique constraint to handle NULL user_id

-- ============================================================================
-- STEP 1: Drop the old foreign key constraint on user_id
-- ============================================================================
ALTER TABLE alert_preferences
    DROP CONSTRAINT IF EXISTS alert_preferences_user_id_fkey;

-- ============================================================================
-- STEP 2: Make user_id nullable
-- ============================================================================
ALTER TABLE alert_preferences
    ALTER COLUMN user_id DROP NOT NULL;

-- ============================================================================
-- STEP 3: Drop old unique constraint and create new one
-- ============================================================================
-- The old constraint was: (user_id, organization_id, alert_type)
-- For Auth0 users, user_id will be NULL, so we need a constraint that works:
-- - For Supabase users: (user_id, organization_id, alert_type)
-- - For Auth0 users: (organization_id, alert_type) with user_id NULL

ALTER TABLE alert_preferences
    DROP CONSTRAINT IF EXISTS alert_preferences_user_id_organization_id_alert_type_key;

-- Create a partial unique index for Auth0 users (NULL user_id)
CREATE UNIQUE INDEX IF NOT EXISTS idx_alert_prefs_org_type_auth0
    ON alert_preferences (organization_id, alert_type)
    WHERE user_id IS NULL;

-- Create a partial unique index for Supabase users (non-NULL user_id)
CREATE UNIQUE INDEX IF NOT EXISTS idx_alert_prefs_user_org_type_supabase
    ON alert_preferences (user_id, organization_id, alert_type)
    WHERE user_id IS NOT NULL;

-- ============================================================================
-- STEP 4: Add comment explaining the design
-- ============================================================================
COMMENT ON COLUMN alert_preferences.user_id IS
    'User ID from Supabase auth. NULL for Auth0 users (who use organization_id only). '
    'Auth0 user_ids like google-oauth2|... are not valid UUIDs.';

-- ============================================================================
-- STEP 5: Verify changes
-- ============================================================================
DO $$
BEGIN
    -- Check user_id is now nullable
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'alert_preferences'
        AND column_name = 'user_id'
        AND is_nullable = 'YES'
    ) THEN
        RAISE NOTICE 'SUCCESS: alert_preferences.user_id is now nullable';
    ELSE
        RAISE WARNING 'FAIL: alert_preferences.user_id is still NOT NULL';
    END IF;
END $$;
