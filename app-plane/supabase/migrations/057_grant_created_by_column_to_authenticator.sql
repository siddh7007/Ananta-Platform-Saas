-- Migration 057: Grant Column-Level Permissions to Authenticator Role
-- Fixes: PostgREST cannot see created_by column because authenticator role lacks column grants
-- Date: 2025-11-27

-- ========================================
-- GRANT COLUMN-LEVEL PERMISSIONS
-- ========================================

-- Grant ALL columns to authenticator role (not just table-level)
-- Actual columns in projects table: id, name, slug, organization_id, created_at, updated_at, description, is_active, created_by, project_code
GRANT SELECT (id, name, slug, organization_id, created_at, updated_at, description, is_active, created_by, project_code)
  ON projects TO authenticator;

GRANT INSERT (id, name, slug, organization_id, created_at, updated_at, description, is_active, created_by, project_code)
  ON projects TO authenticator;

GRANT UPDATE (name, slug, organization_id, updated_at, description, is_active, project_code)
  ON projects TO authenticator;

-- ========================================
-- VERIFICATION
-- ========================================

-- Verify authenticator can now see the column
DO $$
DECLARE
    col_visible BOOLEAN;
BEGIN
    -- Check if authenticator can see created_by in information_schema
    SELECT EXISTS (
        SELECT 1
        FROM information_schema.role_column_grants
        WHERE grantee = 'authenticator'
          AND table_name = 'projects'
          AND column_name = 'created_by'
    ) INTO col_visible;

    IF col_visible THEN
        RAISE NOTICE 'SUCCESS: authenticator role can now see created_by column';
    ELSE
        RAISE WARNING 'FAILED: authenticator role still cannot see created_by column';
    END IF;
END $$;
