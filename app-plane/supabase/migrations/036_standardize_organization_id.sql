-- Standardize Column Naming: organization_id (Remove tenant_id Redundancy)
-- Removes duplicate tenant_id columns, keeps organization_id as the standard
-- Created: 2025-11-19

-- ============================================================================
-- Pre-Migration Data Sync
-- ============================================================================

-- Ensure organization_id has all data from tenant_id before dropping
UPDATE users
SET organization_id = tenant_id
WHERE organization_id IS NULL AND tenant_id IS NOT NULL;

UPDATE boms
SET organization_id = tenant_id
WHERE organization_id IS NULL AND tenant_id IS NOT NULL;

UPDATE bom_uploads
SET organization_id = tenant_id
WHERE organization_id IS NULL AND tenant_id IS NOT NULL;

-- ============================================================================
-- 1. Drop Redundant tenant_id Columns
-- ============================================================================

-- Drop foreign key constraints first
ALTER TABLE IF EXISTS users
  DROP CONSTRAINT IF EXISTS users_tenant_id_fkey;

ALTER TABLE IF EXISTS boms
  DROP CONSTRAINT IF EXISTS boms_tenant_id_fkey;

ALTER TABLE IF EXISTS bom_uploads
  DROP CONSTRAINT IF EXISTS bom_uploads_tenant_id_fkey;

-- Drop indexes on tenant_id
DROP INDEX IF EXISTS idx_users_tenant_id;
DROP INDEX IF EXISTS idx_boms_tenant_id;
DROP INDEX IF EXISTS idx_bom_uploads_tenant_id;

-- Drop the columns
ALTER TABLE users DROP COLUMN IF EXISTS tenant_id;
ALTER TABLE boms DROP COLUMN IF EXISTS tenant_id;
ALTER TABLE bom_uploads DROP COLUMN IF EXISTS tenant_id;

-- ============================================================================
-- 2. Rename enrichment_events.tenant_id to organization_id
-- ============================================================================

-- Check if enrichment_events table exists and has tenant_id
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'enrichment_events'
      AND column_name = 'tenant_id'
  ) THEN
    -- Rename column
    ALTER TABLE enrichment_events RENAME COLUMN tenant_id TO organization_id;

    -- Rename index if it exists
    IF EXISTS (
      SELECT 1 FROM pg_indexes
      WHERE schemaname = 'public'
        AND tablename = 'enrichment_events'
        AND indexname = 'idx_enrichment_events_tenant_id'
    ) THEN
      ALTER INDEX idx_enrichment_events_tenant_id
        RENAME TO idx_enrichment_events_organization_id;
    END IF;

    -- Add foreign key constraint if tenants table exists
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'tenants') THEN
      ALTER TABLE enrichment_events
        ADD CONSTRAINT enrichment_events_organization_id_fkey
        FOREIGN KEY (organization_id) REFERENCES tenants(id) ON DELETE CASCADE;
    END IF;
  END IF;
END $$;

-- ============================================================================
-- 3. Ensure organization_id Constraints Are Correct
-- ============================================================================

-- Users: organization_id should reference tenants
ALTER TABLE IF EXISTS users
  DROP CONSTRAINT IF EXISTS users_organization_id_fkey;

ALTER TABLE IF EXISTS users
  ADD CONSTRAINT users_organization_id_fkey
  FOREIGN KEY (organization_id) REFERENCES tenants(id) ON DELETE SET NULL;

-- Boms: organization_id should reference tenants
ALTER TABLE IF EXISTS boms
  DROP CONSTRAINT IF EXISTS boms_organization_id_fkey;

ALTER TABLE IF EXISTS boms
  ADD CONSTRAINT boms_organization_id_fkey
  FOREIGN KEY (organization_id) REFERENCES tenants(id) ON DELETE CASCADE;

-- Bom_uploads: organization_id should reference tenants
ALTER TABLE IF EXISTS bom_uploads
  DROP CONSTRAINT IF EXISTS bom_uploads_organization_id_fkey;

ALTER TABLE IF EXISTS bom_uploads
  ADD CONSTRAINT bom_uploads_organization_id_fkey
  FOREIGN KEY (organization_id) REFERENCES tenants(id) ON DELETE CASCADE;

-- Projects: already correct, verify
ALTER TABLE IF EXISTS projects
  DROP CONSTRAINT IF EXISTS projects_organization_id_fkey;

ALTER TABLE IF EXISTS projects
  ADD CONSTRAINT projects_organization_id_fkey
  FOREIGN KEY (organization_id) REFERENCES tenants(id) ON DELETE CASCADE;

-- Alerts: already correct, verify
ALTER TABLE IF EXISTS alerts
  DROP CONSTRAINT IF EXISTS alerts_organization_id_fkey;

ALTER TABLE IF EXISTS alerts
  ADD CONSTRAINT alerts_organization_id_fkey
  FOREIGN KEY (organization_id) REFERENCES tenants(id) ON DELETE CASCADE;

-- Enrichment_queue: already correct, verify
ALTER TABLE IF EXISTS enrichment_queue
  DROP CONSTRAINT IF EXISTS enrichment_queue_organization_id_fkey;

ALTER TABLE IF EXISTS enrichment_queue
  ADD CONSTRAINT enrichment_queue_organization_id_fkey
  FOREIGN KEY (organization_id) REFERENCES tenants(id) ON DELETE CASCADE;

-- Notifications: already correct, verify
ALTER TABLE IF EXISTS notifications
  DROP CONSTRAINT IF EXISTS notifications_organization_id_fkey;

ALTER TABLE IF EXISTS notifications
  ADD CONSTRAINT notifications_organization_id_fkey
  FOREIGN KEY (organization_id) REFERENCES tenants(id) ON DELETE CASCADE;

-- Enrichment_audit_log: already correct, verify
ALTER TABLE IF EXISTS enrichment_audit_log
  DROP CONSTRAINT IF EXISTS enrichment_audit_log_organization_id_fkey;

ALTER TABLE IF EXISTS enrichment_audit_log
  ADD CONSTRAINT enrichment_audit_log_organization_id_fkey
  FOREIGN KEY (organization_id) REFERENCES tenants(id) ON DELETE CASCADE;

-- ============================================================================
-- 4. Update RLS Helper Functions (if they reference tenant_id)
-- ============================================================================

-- current_user_tenant_id function should now return organization_id
CREATE OR REPLACE FUNCTION public.current_user_tenant_id()
RETURNS UUID AS $$
  SELECT organization_id
  FROM public.users
  WHERE id = auth.uid()
  LIMIT 1;
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

COMMENT ON FUNCTION public.current_user_tenant_id IS 'Returns current user organization_id (formerly tenant_id, kept function name for compatibility)';

-- ============================================================================
-- 5. Update RLS Policies to Use organization_id
-- ============================================================================

-- Users table policies
DROP POLICY IF EXISTS "Users can view own tenant users" ON users;
CREATE POLICY "Users can view own organization users"
ON users FOR SELECT
TO authenticated
USING (
  organization_id = public.current_user_tenant_id()
  OR public.is_super_admin()
);

-- ============================================================================
-- 6. Verification Queries
-- ============================================================================

-- List all organization_id columns
SELECT
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND column_name IN ('organization_id', 'tenant_id')
ORDER BY
  CASE WHEN column_name = 'organization_id' THEN 1 ELSE 2 END,
  table_name;

-- Count foreign keys to tenants
SELECT
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
  AND ccu.table_name = 'tenants'
ORDER BY tc.table_name;

-- Summary
SELECT
  '✅ Column naming standardized' as status,
  'organization_id is now the single source of truth' as detail;
