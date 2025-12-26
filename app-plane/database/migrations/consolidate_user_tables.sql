-- ============================================================================
-- Consolidate users and user_profiles Tables
-- ============================================================================
-- Purpose: Make user_profiles a VIEW on users table to eliminate redundancy
-- Author: Claude Code
-- Date: 2025-12-20
--
-- Background:
--   - Two tables exist: `users` and `user_profiles` with overlapping columns
--   - Different FKs point to different tables (inconsistent)
--   - Keycloak is the source of truth for user data
--
-- Solution:
--   1. First sync missing users from `users` to `user_profiles` (data migration)
--   2. Update FKs to point to `users` table
--   3. Drop `user_profiles` table
--   4. Create `user_profiles` as a VIEW on `users`
--
-- IMPORTANT: Run this in a transaction. Test in dev first!
-- ============================================================================

BEGIN;

-- ============================================================================
-- STEP 1: Sync any missing users from `users` to `user_profiles`
-- (Temporary - just to ensure FK data integrity before migration)
-- ============================================================================
INSERT INTO user_profiles (
    id, email, first_name, last_name, full_name, role,
    auth_subject, organization_id, is_active, email_verified,
    created_at, updated_at
)
SELECT
    u.id,
    u.email,
    u.first_name,
    u.last_name,
    u.full_name,
    COALESCE(u.role, 'analyst'),
    COALESCE(u.keycloak_user_id, u.auth0_user_id),
    u.organization_id,
    COALESCE(u.is_active, true),
    COALESCE(u.email_verified, true),
    u.created_at,
    u.updated_at
FROM users u
LEFT JOIN user_profiles up ON u.id = up.id
WHERE up.id IS NULL;

-- ============================================================================
-- STEP 2: Drop FK constraints referencing user_profiles
-- ============================================================================
ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_created_by_id_fkey;
ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_project_owner_id_fkey;
ALTER TABLE boms DROP CONSTRAINT IF EXISTS boms_created_by_id_fkey;
ALTER TABLE bom_uploads DROP CONSTRAINT IF EXISTS bom_uploads_uploaded_by_fkey;
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_user_id_fkey;
ALTER TABLE alerts DROP CONSTRAINT IF EXISTS alerts_user_id_fkey;
ALTER TABLE component_tags DROP CONSTRAINT IF EXISTS component_tags_created_by_fkey;
ALTER TABLE vendor_category_mappings DROP CONSTRAINT IF EXISTS vendor_category_mappings_verified_by_fkey;
ALTER TABLE component_alternatives DROP CONSTRAINT IF EXISTS component_alternatives_verified_by_fkey;

-- ============================================================================
-- STEP 3: Add new FK constraints pointing to users table
-- ============================================================================
ALTER TABLE projects
    ADD CONSTRAINT projects_created_by_id_fkey
    FOREIGN KEY (created_by_id) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE projects
    ADD CONSTRAINT projects_project_owner_id_fkey
    FOREIGN KEY (project_owner_id) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE boms
    ADD CONSTRAINT boms_created_by_id_fkey
    FOREIGN KEY (created_by_id) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE bom_uploads
    ADD CONSTRAINT bom_uploads_uploaded_by_fkey
    FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL;

-- Note: These tables may not exist yet or have different column names
-- ALTER TABLE notifications
--     ADD CONSTRAINT notifications_user_id_fkey
--     FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- ALTER TABLE alerts
--     ADD CONSTRAINT alerts_user_id_fkey
--     FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- ALTER TABLE component_tags
--     ADD CONSTRAINT component_tags_created_by_fkey
--     FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;

-- ALTER TABLE vendor_category_mappings
--     ADD CONSTRAINT vendor_category_mappings_verified_by_fkey
--     FOREIGN KEY (verified_by) REFERENCES users(id) ON DELETE SET NULL;

-- ALTER TABLE component_alternatives
--     ADD CONSTRAINT component_alternatives_verified_by_fkey
--     FOREIGN KEY (verified_by) REFERENCES users(id) ON DELETE SET NULL;

-- ============================================================================
-- STEP 4: Drop the user_profiles table
-- ============================================================================
DROP TABLE IF EXISTS user_profiles;

-- ============================================================================
-- STEP 5: Create user_profiles as a VIEW (backwards compatibility)
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
-- STEP 6: Add missing columns to users table (if not exists)
-- ============================================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'users' AND column_name = 'keycloak_user_id') THEN
        ALTER TABLE users ADD COLUMN keycloak_user_id TEXT;
        CREATE INDEX IF NOT EXISTS idx_users_keycloak_user_id ON users(keycloak_user_id);
    END IF;
END $$;

COMMIT;

-- ============================================================================
-- Verification queries (run after migration)
-- ============================================================================
-- SELECT COUNT(*) FROM users;
-- SELECT COUNT(*) FROM user_profiles;  -- Should work via VIEW
-- SELECT * FROM user_profiles WHERE email = 'cnsstaff@cns.local';
