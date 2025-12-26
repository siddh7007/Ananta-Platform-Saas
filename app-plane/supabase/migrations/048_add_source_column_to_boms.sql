-- Add source column to boms table (if it doesn't exist)
-- Created: 2025-11-19
-- Purpose: Officially add the 'source' column that was added manually

DO $$
BEGIN
  -- Add source column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'boms'
    AND column_name = 'source'
  ) THEN
    ALTER TABLE public.boms ADD COLUMN source TEXT;
    RAISE NOTICE 'Added source column to boms table';
  ELSE
    RAISE NOTICE 'Source column already exists in boms table';
  END IF;
END $$;

-- Grant permissions on source column to all roles
GRANT SELECT, INSERT, UPDATE ON public.boms TO anon, authenticated, service_role;

-- Force PostgREST schema reload
NOTIFY pgrst, 'reload schema';

-- Verification
DO $$
DECLARE
  source_exists BOOLEAN;
  anon_has_permission BOOLEAN;
BEGIN
  -- Check if column exists
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'boms'
    AND column_name = 'source'
  ) INTO source_exists;

  -- Check if anon has permissions
  SELECT EXISTS (
    SELECT 1 FROM information_schema.column_privileges
    WHERE table_schema = 'public'
    AND table_name = 'boms'
    AND column_name = 'source'
    AND grantee = 'anon'
    AND privilege_type = 'SELECT'
  ) INTO anon_has_permission;

  IF source_exists AND anon_has_permission THEN
    RAISE NOTICE '✅ Migration 048 Complete: source column exists with proper permissions';
  ELSE
    RAISE WARNING '⚠️ Migration 048: source_exists=%, anon_has_permission=%', source_exists, anon_has_permission;
  END IF;
END $$;
