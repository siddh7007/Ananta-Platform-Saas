-- Remove _v2 suffix from all table names (Clean, Consistent Naming)
-- Created: 2025-11-19
-- Purpose: Match what we did with organizations - remove _v2 suffix from all tables

-- Drop the views first (no longer needed)
DROP VIEW IF EXISTS public.users CASCADE;
DROP VIEW IF EXISTS public.projects CASCADE;
DROP VIEW IF EXISTS public.boms CASCADE;
DROP VIEW IF EXISTS public.alerts CASCADE;
DROP VIEW IF EXISTS public.bom_line_items CASCADE;

-- Drop all the INSTEAD OF triggers and functions
DROP TRIGGER IF EXISTS projects_insert_trigger ON public.projects;
DROP TRIGGER IF EXISTS projects_update_trigger ON public.projects;
DROP TRIGGER IF EXISTS projects_delete_trigger ON public.projects;
DROP FUNCTION IF EXISTS public.projects_insert();
DROP FUNCTION IF EXISTS public.projects_update();
DROP FUNCTION IF EXISTS public.projects_delete();

DROP TRIGGER IF EXISTS boms_insert_trigger ON public.boms;
DROP TRIGGER IF EXISTS boms_update_trigger ON public.boms;
DROP TRIGGER IF EXISTS boms_delete_trigger ON public.boms;
DROP FUNCTION IF EXISTS public.boms_insert();
DROP FUNCTION IF EXISTS public.boms_update();
DROP FUNCTION IF EXISTS public.boms_delete();

DROP TRIGGER IF EXISTS alerts_insert_trigger ON public.alerts;
DROP TRIGGER IF EXISTS alerts_update_trigger ON public.alerts;
DROP TRIGGER IF EXISTS alerts_delete_trigger ON public.alerts;
DROP FUNCTION IF EXISTS public.alerts_insert();
DROP FUNCTION IF EXISTS public.alerts_update();
DROP FUNCTION IF EXISTS public.alerts_delete();

DROP TRIGGER IF EXISTS bom_line_items_insert_trigger ON public.bom_line_items;
DROP TRIGGER IF EXISTS bom_line_items_update_trigger ON public.bom_line_items;
DROP TRIGGER IF EXISTS bom_line_items_delete_trigger ON public.bom_line_items;
DROP FUNCTION IF EXISTS public.bom_line_items_insert();
DROP FUNCTION IF EXISTS public.bom_line_items_update();
DROP FUNCTION IF EXISTS public.bom_line_items_delete();

-- Rename tables to remove _v2 suffix
ALTER TABLE IF EXISTS public.users_v2 RENAME TO users;
ALTER TABLE IF EXISTS public.projects_v2 RENAME TO projects;
ALTER TABLE IF EXISTS public.boms_v2 RENAME TO boms;
ALTER TABLE IF EXISTS public.alerts_v2 RENAME TO alerts;
ALTER TABLE IF EXISTS public.bom_line_items_v2 RENAME TO bom_line_items;
ALTER TABLE IF EXISTS public.components_v2 RENAME TO components;

-- Verify all tables were renamed
DO $$
BEGIN
    -- Check that new tables exist
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users') THEN
        RAISE EXCEPTION 'Migration failed: users table does not exist';
    END IF;
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'projects') THEN
        RAISE EXCEPTION 'Migration failed: projects table does not exist';
    END IF;
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'boms') THEN
        RAISE EXCEPTION 'Migration failed: boms table does not exist';
    END IF;
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'alerts') THEN
        RAISE EXCEPTION 'Migration failed: alerts table does not exist';
    END IF;
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'bom_line_items') THEN
        RAISE EXCEPTION 'Migration failed: bom_line_items table does not exist';
    END IF;
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'components') THEN
        RAISE EXCEPTION 'Migration failed: components table does not exist';
    END IF;

    -- Check that old _v2 tables are gone
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users_v2') THEN
        RAISE EXCEPTION 'Migration failed: users_v2 table still exists';
    END IF;
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'projects_v2') THEN
        RAISE EXCEPTION 'Migration failed: projects_v2 table still exists';
    END IF;
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'boms_v2') THEN
        RAISE EXCEPTION 'Migration failed: boms_v2 table still exists';
    END IF;
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'alerts_v2') THEN
        RAISE EXCEPTION 'Migration failed: alerts_v2 table still exists';
    END IF;
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'bom_line_items_v2') THEN
        RAISE EXCEPTION 'Migration failed: bom_line_items_v2 table still exists';
    END IF;
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'components_v2') THEN
        RAISE EXCEPTION 'Migration failed: components_v2 table still exists';
    END IF;
END $$;

-- Success message
DO $$
BEGIN
    RAISE NOTICE '✓ Removed _v2 suffix from all tables';
    RAISE NOTICE '✓ Clean, consistent naming: organizations, users, projects, boms, alerts, bom_line_items, components';
    RAISE NOTICE '✓ Deleted unnecessary views and triggers';
    RAISE NOTICE '✓ Foreign key constraints automatically updated';
END $$;
