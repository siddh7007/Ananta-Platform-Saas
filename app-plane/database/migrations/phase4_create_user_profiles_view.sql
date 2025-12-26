-- ============================================================================
-- Phase 4: Replace user_profiles Table with View
-- ============================================================================
-- Purpose: Drop user_profiles table and create it as a VIEW on users
-- Author: Claude Code
-- Date: 2025-12-20
--
-- PREREQUISITES:
--   - Phase 1, 2, 3 migrations must be applied first
--   - All FK constraints should now point to users table
--   - No codepaths should be writing to user_profiles
--
-- This creates backwards compatibility for any code still reading user_profiles.
-- ============================================================================

BEGIN;

-- ============================================================================
-- STEP 1: Verify no FKs point to user_profiles anymore
-- ============================================================================
DO $$
DECLARE
    fk_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO fk_count
    FROM information_schema.table_constraints tc
    JOIN information_schema.constraint_column_usage ccu
      ON ccu.constraint_name = tc.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND ccu.table_name = 'user_profiles';

    IF fk_count > 0 THEN
        RAISE EXCEPTION 'Cannot proceed: % FK constraints still reference user_profiles. Run Phase 1-3 migrations first.', fk_count;
    END IF;
END $$;

-- ============================================================================
-- STEP 2: Drop the user_profiles table
-- ============================================================================
DROP TABLE IF EXISTS user_profiles;

-- ============================================================================
-- STEP 3: Create user_profiles as a VIEW on users (backwards compatibility)
-- ============================================================================
CREATE OR REPLACE VIEW user_profiles AS
SELECT
    id,
    organization_id,
    email,
    first_name,
    last_name,
    full_name,
    COALESCE(role, 'analyst') as role,
    NULL::text as job_title,
    COALESCE(is_active, true) as is_active,
    is_platform_admin as is_staff,
    is_platform_admin as platform_admin,
    COALESCE(email_verified, true) as email_verified,
    CASE
        WHEN keycloak_user_id IS NOT NULL THEN 'keycloak'
        WHEN auth0_user_id IS NOT NULL THEN 'auth0'
        ELSE 'local'
    END as auth_provider,
    COALESCE(keycloak_user_id, auth0_user_id) as auth_subject,
    last_login_at,
    metadata,
    created_at,
    updated_at
FROM users;

-- ============================================================================
-- STEP 4: Create an INSTEAD OF INSERT trigger for the view
-- (Allows legacy INSERT statements to work via the view)
-- ============================================================================
CREATE OR REPLACE FUNCTION user_profiles_insert_trigger()
RETURNS TRIGGER AS $$
BEGIN
    -- Insert into users table instead
    INSERT INTO users (
        id, email, first_name, last_name, role,
        organization_id, is_active, email_verified,
        keycloak_user_id, auth0_user_id
    )
    VALUES (
        COALESCE(NEW.id, gen_random_uuid()),
        NEW.email,
        NEW.first_name,
        NEW.last_name,
        NEW.role,
        NEW.organization_id,
        COALESCE(NEW.is_active, true),
        COALESCE(NEW.email_verified, true),
        CASE WHEN NEW.auth_provider = 'keycloak' THEN NEW.auth_subject ELSE NULL END,
        CASE WHEN NEW.auth_provider = 'auth0' THEN NEW.auth_subject ELSE NULL END
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        first_name = EXCLUDED.first_name,
        last_name = EXCLUDED.last_name,
        role = EXCLUDED.role,
        organization_id = EXCLUDED.organization_id,
        is_active = EXCLUDED.is_active,
        email_verified = EXCLUDED.email_verified,
        updated_at = NOW();

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_profiles_insert
    INSTEAD OF INSERT ON user_profiles
    FOR EACH ROW EXECUTE FUNCTION user_profiles_insert_trigger();

-- ============================================================================
-- STEP 5: Create an INSTEAD OF UPDATE trigger for the view
-- ============================================================================
CREATE OR REPLACE FUNCTION user_profiles_update_trigger()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE users SET
        email = COALESCE(NEW.email, OLD.email),
        first_name = COALESCE(NEW.first_name, OLD.first_name),
        last_name = COALESCE(NEW.last_name, OLD.last_name),
        role = COALESCE(NEW.role, OLD.role),
        organization_id = COALESCE(NEW.organization_id, OLD.organization_id),
        is_active = COALESCE(NEW.is_active, OLD.is_active),
        email_verified = COALESCE(NEW.email_verified, OLD.email_verified),
        updated_at = NOW()
    WHERE id = OLD.id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_profiles_update
    INSTEAD OF UPDATE ON user_profiles
    FOR EACH ROW EXECUTE FUNCTION user_profiles_update_trigger();

COMMIT;

-- ============================================================================
-- Verification queries
-- ============================================================================
-- \dv user_profiles  -- Should show as a view
-- SELECT * FROM user_profiles LIMIT 5;  -- Should return data from users
-- SELECT COUNT(*) FROM users;
-- SELECT COUNT(*) FROM user_profiles;  -- Should match users count
