-- Migration: Remove _v2 suffix from all tables
-- Purpose: Clean up naming convention, remove confusion between v1 and v2
-- Date: 2025-11-11

-- Drop the compatibility view we just created
DROP VIEW IF EXISTS public.bom_line_items CASCADE;
DROP TRIGGER IF EXISTS bom_line_items_insert ON public.bom_line_items CASCADE;
DROP FUNCTION IF EXISTS bom_line_items_insert_trigger() CASCADE;

-- Rename all _v2 tables to remove suffix
ALTER TABLE IF EXISTS public.alerts_v2 RENAME TO alerts;
ALTER TABLE IF EXISTS public.bom_line_items_v2 RENAME TO bom_line_items;
ALTER TABLE IF EXISTS public.boms_v2 RENAME TO boms;
ALTER TABLE IF EXISTS public.components_v2 RENAME TO components;
ALTER TABLE IF EXISTS public.projects_v2 RENAME TO projects;
ALTER TABLE IF EXISTS public.tenants_v2 RENAME TO tenants;
ALTER TABLE IF EXISTS public.users_v2 RENAME TO users;

-- Update sequences (if any are named with _v2)
-- PostgreSQL auto-renames sequences with tables, but check for any custom ones

-- Rename primary key constraints to match new table names
ALTER INDEX IF EXISTS alerts_v2_pkey RENAME TO alerts_pkey;
ALTER INDEX IF EXISTS bom_line_items_v2_pkey RENAME TO bom_line_items_pkey;
ALTER INDEX IF EXISTS boms_v2_pkey RENAME TO boms_pkey;
ALTER INDEX IF EXISTS components_v2_pkey RENAME TO components_pkey;
ALTER INDEX IF EXISTS projects_v2_pkey RENAME TO projects_pkey;
ALTER INDEX IF EXISTS tenants_v2_pkey RENAME TO tenants_pkey;
ALTER INDEX IF EXISTS users_v2_pkey RENAME TO users_pkey;

-- Rename foreign key indexes (common pattern: tablename_v2_columnname_idx)
ALTER INDEX IF EXISTS bom_line_items_v2_bom_idx RENAME TO bom_line_items_bom_idx;

-- Rename RLS policies (format: tablename_v2_action_policy)
-- DROP old policies and recreate with new names (ALTER POLICY doesn't support RENAME)

-- Note: Foreign key constraints are automatically updated when tables are renamed
-- Note: RLS policies are automatically updated when tables are renamed
-- Note: Triggers are automatically updated when tables are renamed

COMMENT ON TABLE public.alerts IS 'System alerts and notifications';
COMMENT ON TABLE public.bom_line_items IS 'Individual line items (parts) within BOMs';
COMMENT ON TABLE public.boms IS 'Bill of Materials uploads and metadata';
COMMENT ON TABLE public.components IS 'Component catalog';
COMMENT ON TABLE public.projects IS 'Customer projects';
COMMENT ON TABLE public.tenants IS 'Multi-tenant organizations';
COMMENT ON TABLE public.users IS 'User accounts';
