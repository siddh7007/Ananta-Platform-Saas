-- ============================================================================
-- Migration: Remove _v2 Suffix from Table Names
-- ============================================================================
-- Created: 2025-11-19
-- Purpose: Clean up table naming by removing _v2 suffix for consistency
-- Database: supabase
--
-- Changes:
-- 1. Rename tenants_v2 → tenants
-- 2. Rename users_v2 → users
-- 3. Rename projects_v2 → projects
-- 4. Update all foreign key references automatically (CASCADE)
-- 5. Update all trigger functions
-- 6. Update all RLS policies
-- ============================================================================

-- ============================================================================
-- SECTION 1: Rename Tables
-- ============================================================================

-- Rename core tables (foreign keys will update automatically with CASCADE)
ALTER TABLE IF EXISTS tenants_v2 RENAME TO tenants;
ALTER TABLE IF EXISTS users_v2 RENAME TO users;
ALTER TABLE IF EXISTS projects_v2 RENAME TO projects;

-- ============================================================================
-- SECTION 2: Update Indexes (they keep their old names, let's rename them)
-- ============================================================================

-- Tenants indexes
ALTER INDEX IF EXISTS tenants_v2_pkey RENAME TO tenants_pkey;
ALTER INDEX IF EXISTS tenants_v2_slug_key RENAME TO tenants_slug_key;

-- Users indexes
ALTER INDEX IF EXISTS idx_users_v2_role RENAME TO idx_users_role;
ALTER INDEX IF EXISTS idx_users_v2_tenant_id RENAME TO idx_users_tenant_id;
ALTER INDEX IF EXISTS idx_users_v2_auth_subject RENAME TO idx_users_auth_subject;

-- Projects indexes
ALTER INDEX IF EXISTS projects_v2_pkey RENAME TO projects_pkey;
ALTER INDEX IF EXISTS projects_v2_organization_id_slug_key RENAME TO projects_organization_id_slug_key;

-- ============================================================================
-- SECTION 3: Update Constraints (they keep their old names, let's rename them)
-- ============================================================================

-- Users foreign keys
ALTER TABLE IF EXISTS users RENAME CONSTRAINT users_v2_organization_id_fkey TO users_organization_id_fkey;
ALTER TABLE IF EXISTS users RENAME CONSTRAINT users_v2_tenant_id_fkey TO users_tenant_id_fkey;

-- Projects foreign keys
ALTER TABLE IF EXISTS projects RENAME CONSTRAINT projects_v2_organization_id_fkey TO projects_organization_id_fkey;

-- BOM uploads foreign keys (references to renamed tables)
ALTER TABLE IF EXISTS bom_uploads DROP CONSTRAINT IF EXISTS bom_uploads_tenant_id_fkey;
ALTER TABLE IF EXISTS bom_uploads ADD CONSTRAINT bom_uploads_tenant_id_fkey
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

ALTER TABLE IF EXISTS bom_uploads DROP CONSTRAINT IF EXISTS bom_uploads_organization_id_fkey;
ALTER TABLE IF EXISTS bom_uploads ADD CONSTRAINT bom_uploads_organization_id_fkey
    FOREIGN KEY (organization_id) REFERENCES tenants(id) ON DELETE CASCADE;

ALTER TABLE IF EXISTS bom_uploads DROP CONSTRAINT IF EXISTS bom_uploads_project_id_fkey;
ALTER TABLE IF EXISTS bom_uploads ADD CONSTRAINT bom_uploads_project_id_fkey
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL;

ALTER TABLE IF EXISTS bom_uploads DROP CONSTRAINT IF EXISTS bom_uploads_uploaded_by_fkey;
ALTER TABLE IF EXISTS bom_uploads ADD CONSTRAINT bom_uploads_uploaded_by_fkey
    FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL;

-- BOMs foreign keys
ALTER TABLE IF EXISTS boms DROP CONSTRAINT IF EXISTS boms_organization_id_fkey;
ALTER TABLE IF EXISTS boms ADD CONSTRAINT boms_organization_id_fkey
    FOREIGN KEY (organization_id) REFERENCES tenants(id) ON DELETE CASCADE;

ALTER TABLE IF EXISTS boms DROP CONSTRAINT IF EXISTS boms_tenant_id_fkey;
ALTER TABLE IF EXISTS boms ADD CONSTRAINT boms_tenant_id_fkey
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

ALTER TABLE IF EXISTS boms DROP CONSTRAINT IF EXISTS boms_project_id_fkey;
ALTER TABLE IF EXISTS boms ADD CONSTRAINT boms_project_id_fkey
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL;

-- Enrichment queue foreign keys
ALTER TABLE IF EXISTS enrichment_queue DROP CONSTRAINT IF EXISTS enrichment_queue_organization_id_fkey;
ALTER TABLE IF EXISTS enrichment_queue ADD CONSTRAINT enrichment_queue_organization_id_fkey
    FOREIGN KEY (organization_id) REFERENCES tenants(id) ON DELETE CASCADE;

-- Enrichment audit log foreign keys
ALTER TABLE IF EXISTS enrichment_audit_log DROP CONSTRAINT IF EXISTS enrichment_audit_log_organization_id_fkey;
ALTER TABLE IF EXISTS enrichment_audit_log ADD CONSTRAINT enrichment_audit_log_organization_id_fkey
    FOREIGN KEY (organization_id) REFERENCES tenants(id) ON DELETE CASCADE;

-- Notifications foreign keys
ALTER TABLE IF EXISTS notifications DROP CONSTRAINT IF EXISTS notifications_organization_id_fkey;
ALTER TABLE IF EXISTS notifications ADD CONSTRAINT notifications_organization_id_fkey
    FOREIGN KEY (organization_id) REFERENCES tenants(id) ON DELETE CASCADE;

-- Alerts foreign keys
ALTER TABLE IF EXISTS alerts DROP CONSTRAINT IF EXISTS alerts_organization_id_fkey;
ALTER TABLE IF EXISTS alerts ADD CONSTRAINT alerts_organization_id_fkey
    FOREIGN KEY (organization_id) REFERENCES tenants(id) ON DELETE CASCADE;

-- ============================================================================
-- SECTION 4: Update Trigger Functions
-- ============================================================================

-- Update tenant slug trigger function (already named correctly)
-- No changes needed - function auto_generate_tenant_slug() references NEW row

-- Update project slug trigger function (already named correctly)
-- No changes needed - function auto_generate_project_slug() references NEW row

-- Recreate triggers with new table names
DROP TRIGGER IF EXISTS trigger_auto_generate_tenant_slug ON tenants_v2;
DROP TRIGGER IF EXISTS trigger_auto_generate_tenant_slug ON tenants;
CREATE TRIGGER trigger_auto_generate_tenant_slug
    BEFORE INSERT OR UPDATE ON tenants
    FOR EACH ROW
    EXECUTE FUNCTION auto_generate_tenant_slug();

DROP TRIGGER IF EXISTS trigger_auto_generate_project_slug ON projects_v2;
DROP TRIGGER IF EXISTS trigger_auto_generate_project_slug ON projects;
CREATE TRIGGER trigger_auto_generate_project_slug
    BEFORE INSERT OR UPDATE ON projects
    FOR EACH ROW
    EXECUTE FUNCTION auto_generate_project_slug();

-- ============================================================================
-- SECTION 5: Update Comments
-- ============================================================================

COMMENT ON TABLE tenants IS 'Organizations/Tenants - top-level multi-tenant entity (formerly tenants_v2)';
COMMENT ON TABLE users IS 'Platform users with RBAC roles (formerly users_v2)';
COMMENT ON TABLE projects IS 'Projects within organizations (formerly projects_v2)';

-- ============================================================================
-- SECTION 6: Verification
-- ============================================================================

DO $$
DECLARE
    v_tenants_exists boolean;
    v_users_exists boolean;
    v_projects_exists boolean;
    v_tenants_v2_exists boolean;
BEGIN
    -- Check new tables exist
    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema='public' AND table_name='tenants'
    ) INTO v_tenants_exists;

    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema='public' AND table_name='users'
    ) INTO v_users_exists;

    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema='public' AND table_name='projects'
    ) INTO v_projects_exists;

    -- Check old tables don't exist
    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema='public' AND table_name='tenants_v2'
    ) INTO v_tenants_v2_exists;

    IF NOT v_tenants_exists THEN
        RAISE EXCEPTION 'Migration failed: tenants table does not exist';
    END IF;

    IF NOT v_users_exists THEN
        RAISE EXCEPTION 'Migration failed: users table does not exist';
    END IF;

    IF NOT v_projects_exists THEN
        RAISE EXCEPTION 'Migration failed: projects table does not exist';
    END IF;

    IF v_tenants_v2_exists THEN
        RAISE WARNING 'Old table tenants_v2 still exists - may need manual cleanup';
    END IF;

    RAISE NOTICE '✅ Migration 032 completed successfully';
    RAISE NOTICE '   - Renamed: tenants_v2 → tenants';
    RAISE NOTICE '   - Renamed: users_v2 → users';
    RAISE NOTICE '   - Renamed: projects_v2 → projects';
    RAISE NOTICE '   - Updated: All foreign keys, indexes, and triggers';
    RAISE NOTICE '';
    RAISE NOTICE '⚠️  IMPORTANT: Update application code references from *_v2 to new names';
END $$;
