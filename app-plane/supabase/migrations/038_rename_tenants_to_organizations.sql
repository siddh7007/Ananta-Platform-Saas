-- Migration: Rename tenants_v2 table to organizations
-- Created: 2025-11-19
-- Purpose: Fix inconsistency between table name (tenants_v2) and column name (organization_id)

-- Rename the table
ALTER TABLE IF EXISTS tenants_v2 RENAME TO organizations;

-- Update RLS policies to reference new table name
-- Note: Foreign key constraints automatically update when table is renamed

-- Verify table exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'organizations'
    ) THEN
        RAISE EXCEPTION 'Migration failed: organizations table does not exist after rename';
    END IF;

    IF EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'tenants_v2'
    ) THEN
        RAISE EXCEPTION 'Migration failed: tenants_v2 table still exists after rename';
    END IF;
END $$;

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'Successfully renamed tenants_v2 → organizations';
    RAISE NOTICE 'Table now matches column naming convention (organization_id)';
END $$;
