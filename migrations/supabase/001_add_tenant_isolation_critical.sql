-- Migration: Add tenant isolation to critical tables in Supabase
-- Priority: CRITICAL
-- Estimated time: 15-30 minutes depending on data volume
--
-- IMPORTANT: Test in staging first!
-- Requires: Default organization_id for backfill (update below)

-- Set default org for backfill (UPDATE THIS BEFORE RUNNING!)
DO $$
DECLARE
    default_org_id UUID := '00000000-0000-0000-0000-000000000000'; -- CHANGE THIS!
BEGIN
    -- Verify default org exists
    IF NOT EXISTS (SELECT 1 FROM organizations WHERE id = default_org_id) THEN
        RAISE EXCEPTION 'Default organization % does not exist. Update default_org_id in script.', default_org_id;
    END IF;
END $$;

-- ============================================================================
-- 1. BOM_LINE_ITEMS - HIGHEST PRIORITY (core BOM data)
-- ============================================================================

BEGIN;

-- Add organization_id column
ALTER TABLE bom_line_items
ADD COLUMN organization_id UUID;

-- Backfill from parent bom
UPDATE bom_line_items bli
SET organization_id = b.organization_id
FROM boms b
WHERE bli.bom_id = b.id;

-- Make NOT NULL after backfill
ALTER TABLE bom_line_items
ALTER COLUMN organization_id SET NOT NULL;

-- Add FK constraint with CASCADE
ALTER TABLE bom_line_items
ADD CONSTRAINT bom_line_items_organization_id_fkey
  FOREIGN KEY (organization_id)
  REFERENCES organizations(id)
  ON DELETE CASCADE;

-- Add index for performance
CREATE INDEX idx_bom_line_items_org ON bom_line_items(organization_id);

-- Enable RLS
ALTER TABLE bom_line_items ENABLE ROW LEVEL SECURITY;

-- Add RLS policy
CREATE POLICY "org_isolation_select_bom_line_items"
ON bom_line_items FOR SELECT
USING (organization_id = current_user_organization_id() OR is_platform_admin());

COMMIT;

-- ============================================================================
-- 2. ATTRIBUTES - Component metadata
-- ============================================================================

BEGIN;

ALTER TABLE attributes
ADD COLUMN organization_id UUID;

-- Backfill from parent component
UPDATE attributes a
SET organization_id = c.organization_id
FROM components c
WHERE a.component_id = c.id;

-- Make NOT NULL after backfill
ALTER TABLE attributes
ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE attributes
ADD CONSTRAINT attributes_organization_id_fkey
  FOREIGN KEY (organization_id)
  REFERENCES organizations(id)
  ON DELETE CASCADE;

CREATE INDEX idx_attributes_org ON attributes(organization_id);

ALTER TABLE attributes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_isolation_select_attributes"
ON attributes FOR SELECT
USING (organization_id = current_user_organization_id() OR is_platform_admin());

COMMIT;

-- ============================================================================
-- 3. AUDIT_ENRICHMENT_RUNS - Audit trail
-- ============================================================================

BEGIN;

ALTER TABLE audit_enrichment_runs
ADD COLUMN organization_id UUID;

-- Backfill: If there's a relationship to track, use it
-- Otherwise, may need application-level backfill
-- For now, setting to a default (UPDATE LOGIC AS NEEDED)
UPDATE audit_enrichment_runs
SET organization_id = '00000000-0000-0000-0000-000000000000' -- UPDATE THIS!
WHERE organization_id IS NULL;

ALTER TABLE audit_enrichment_runs
ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE audit_enrichment_runs
ADD CONSTRAINT audit_enrichment_runs_organization_id_fkey
  FOREIGN KEY (organization_id)
  REFERENCES organizations(id)
  ON DELETE CASCADE;

CREATE INDEX idx_audit_enrichment_runs_org ON audit_enrichment_runs(organization_id);

ALTER TABLE audit_enrichment_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_isolation_select_audit_enrichment_runs"
ON audit_enrichment_runs FOR SELECT
USING (organization_id = current_user_organization_id() OR is_platform_admin());

COMMIT;

-- ============================================================================
-- 4. AUDIT_FIELD_COMPARISONS - Audit details
-- ============================================================================

BEGIN;

ALTER TABLE audit_field_comparisons
ADD COLUMN organization_id UUID;

-- Backfill from enrichment_run_id
UPDATE audit_field_comparisons afc
SET organization_id = aer.organization_id
FROM audit_enrichment_runs aer
WHERE afc.enrichment_run_id = aer.id;

ALTER TABLE audit_field_comparisons
ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE audit_field_comparisons
ADD CONSTRAINT audit_field_comparisons_organization_id_fkey
  FOREIGN KEY (organization_id)
  REFERENCES organizations(id)
  ON DELETE CASCADE;

CREATE INDEX idx_audit_field_comparisons_org ON audit_field_comparisons(organization_id);

ALTER TABLE audit_field_comparisons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_isolation_select_audit_field_comparisons"
ON audit_field_comparisons FOR SELECT
USING (organization_id = current_user_organization_id() OR is_platform_admin());

COMMIT;

-- ============================================================================
-- 5. AUDIT_SUPPLIER_QUALITY - Quality metrics
-- ============================================================================

BEGIN;

ALTER TABLE audit_supplier_quality
ADD COLUMN organization_id UUID;

-- Backfill logic depends on table structure
-- Update as needed based on relationships
UPDATE audit_supplier_quality
SET organization_id = '00000000-0000-0000-0000-000000000000' -- UPDATE THIS!
WHERE organization_id IS NULL;

ALTER TABLE audit_supplier_quality
ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE audit_supplier_quality
ADD CONSTRAINT audit_supplier_quality_organization_id_fkey
  FOREIGN KEY (organization_id)
  REFERENCES organizations(id)
  ON DELETE CASCADE;

CREATE INDEX idx_audit_supplier_quality_org ON audit_supplier_quality(organization_id);

ALTER TABLE audit_supplier_quality ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_isolation_select_audit_supplier_quality"
ON audit_supplier_quality FOR SELECT
USING (organization_id = current_user_organization_id() OR is_platform_admin());

COMMIT;

-- ============================================================================
-- 6. BOM_ITEMS - BOM processing items
-- ============================================================================

BEGIN;

ALTER TABLE bom_items
ADD COLUMN organization_id UUID;

-- Backfill from job_id
UPDATE bom_items bi
SET organization_id = bj.organization_id
FROM bom_jobs bj
WHERE bi.job_id = bj.job_id;

ALTER TABLE bom_items
ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE bom_items
ADD CONSTRAINT bom_items_organization_id_fkey
  FOREIGN KEY (organization_id)
  REFERENCES organizations(id)
  ON DELETE CASCADE;

CREATE INDEX idx_bom_items_org ON bom_items(organization_id);

-- Note: bom_items already has RLS enabled with custom policy
-- Update existing policy to also check organization_id
DROP POLICY IF EXISTS bom_items_select ON bom_items;

CREATE POLICY "bom_items_select_org_isolated"
ON bom_items FOR SELECT
USING (
  organization_id = current_user_organization_id()
  OR is_platform_admin()
  OR ((job_id)::text IN (
    SELECT bom_jobs.job_id
    FROM bom_jobs
    WHERE (COALESCE((bom_jobs.source_metadata ->> 'user_email'::text), ''::text) <> ''::text)
    AND ((bom_jobs.source_metadata ->> 'user_email'::text) = current_user_email())
  ))
);

COMMIT;

-- ============================================================================
-- 7. ENRICHMENT_HISTORY - Enrichment history
-- ============================================================================

BEGIN;

ALTER TABLE enrichment_history
ADD COLUMN organization_id UUID;

-- Backfill logic - may need component relationship
UPDATE enrichment_history eh
SET organization_id = c.organization_id
FROM components c
WHERE eh.component_id = c.id;

-- For records without component, may need default
UPDATE enrichment_history
SET organization_id = '00000000-0000-0000-0000-000000000000' -- UPDATE THIS!
WHERE organization_id IS NULL;

ALTER TABLE enrichment_history
ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE enrichment_history
ADD CONSTRAINT enrichment_history_organization_id_fkey
  FOREIGN KEY (organization_id)
  REFERENCES organizations(id)
  ON DELETE CASCADE;

CREATE INDEX idx_enrichment_history_org ON enrichment_history(organization_id);

ALTER TABLE enrichment_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_isolation_select_enrichment_history"
ON enrichment_history FOR SELECT
USING (organization_id = current_user_organization_id() OR is_platform_admin());

COMMIT;

-- ============================================================================
-- 8. ENRICHMENT_QUEUE - Queue entries
-- ============================================================================

BEGIN;

-- Note: enrichment_queue already has RLS enabled
-- Check if it has component_id or other FK to derive org

ALTER TABLE enrichment_queue
ADD COLUMN organization_id UUID;

-- Backfill from component_id if exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'enrichment_queue' AND column_name = 'component_id'
    ) THEN
        EXECUTE '
            UPDATE enrichment_queue eq
            SET organization_id = c.organization_id
            FROM components c
            WHERE eq.component_id = c.id
        ';
    END IF;
END $$;

-- For records without relationship, set default
UPDATE enrichment_queue
SET organization_id = '00000000-0000-0000-0000-000000000000' -- UPDATE THIS!
WHERE organization_id IS NULL;

ALTER TABLE enrichment_queue
ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE enrichment_queue
ADD CONSTRAINT enrichment_queue_organization_id_fkey
  FOREIGN KEY (organization_id)
  REFERENCES organizations(id)
  ON DELETE CASCADE;

CREATE INDEX idx_enrichment_queue_org ON enrichment_queue(organization_id);

-- Add RLS policy
CREATE POLICY "org_isolation_select_enrichment_queue"
ON enrichment_queue FOR SELECT
USING (organization_id = current_user_organization_id() OR is_platform_admin());

COMMIT;

-- ============================================================================
-- 9. WORKSPACE_MEMBERS - Membership records
-- ============================================================================

BEGIN;

ALTER TABLE workspace_members
ADD COLUMN organization_id UUID;

-- Backfill from workspace
UPDATE workspace_members wm
SET organization_id = w.organization_id
FROM workspaces w
WHERE wm.workspace_id = w.id;

ALTER TABLE workspace_members
ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE workspace_members
ADD CONSTRAINT workspace_members_organization_id_fkey
  FOREIGN KEY (organization_id)
  REFERENCES organizations(id)
  ON DELETE CASCADE;

CREATE INDEX idx_workspace_members_org ON workspace_members(organization_id);

-- workspace_members already has RLS enabled
-- Add RLS policy
CREATE POLICY "org_isolation_select_workspace_members"
ON workspace_members FOR SELECT
USING (organization_id = current_user_organization_id() OR is_platform_admin());

COMMIT;

-- ============================================================================
-- Verification Queries
-- ============================================================================

-- Check all tables now have organization_id
SELECT
    table_name,
    COUNT(*) as total_rows,
    COUNT(organization_id) as rows_with_org_id,
    COUNT(*) - COUNT(organization_id) as missing_org_id
FROM (
    SELECT 'bom_line_items' as table_name, organization_id FROM bom_line_items
    UNION ALL
    SELECT 'attributes', organization_id FROM attributes
    UNION ALL
    SELECT 'audit_enrichment_runs', organization_id FROM audit_enrichment_runs
    UNION ALL
    SELECT 'audit_field_comparisons', organization_id FROM audit_field_comparisons
    UNION ALL
    SELECT 'audit_supplier_quality', organization_id FROM audit_supplier_quality
    UNION ALL
    SELECT 'bom_items', organization_id FROM bom_items
    UNION ALL
    SELECT 'enrichment_history', organization_id FROM enrichment_history
    UNION ALL
    SELECT 'enrichment_queue', organization_id FROM enrichment_queue
    UNION ALL
    SELECT 'workspace_members', organization_id FROM workspace_members
) AS all_tables
GROUP BY table_name
ORDER BY table_name;

-- Check RLS is enabled
SELECT
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
    AND tablename IN (
        'bom_line_items', 'attributes', 'audit_enrichment_runs',
        'audit_field_comparisons', 'audit_supplier_quality', 'bom_items',
        'enrichment_history', 'enrichment_queue', 'workspace_members'
    )
ORDER BY tablename;

-- Check policies exist
SELECT
    tablename,
    policyname,
    cmd
FROM pg_policies
WHERE schemaname = 'public'
    AND tablename IN (
        'bom_line_items', 'attributes', 'audit_enrichment_runs',
        'audit_field_comparisons', 'audit_supplier_quality', 'bom_items',
        'enrichment_history', 'enrichment_queue', 'workspace_members'
    )
ORDER BY tablename, policyname;
