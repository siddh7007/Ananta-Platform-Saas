-- Migration: Sync user metadata to JWT (auth.users.raw_user_meta_data)
-- Description: Ensure JWT contains tenant_id and role for RLS policies
-- Date: 2025-11-17
--
-- Issue: When users are created/updated in public.users, their JWT metadata
--        (auth.users.raw_user_meta_data) is not updated, causing RLS to fail
-- Solution: Create trigger to sync tenant_id and role to JWT metadata

-- ============================================================================
-- Function to sync public.users to auth.users metadata
-- ============================================================================

CREATE OR REPLACE FUNCTION sync_user_metadata_to_jwt()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  auth_user_id UUID;
BEGIN
  -- Find corresponding auth.users record by email
  SELECT id INTO auth_user_id
  FROM auth.users
  WHERE email = NEW.email;

  -- If auth user exists, update their JWT metadata
  IF auth_user_id IS NOT NULL THEN
    UPDATE auth.users
    SET raw_user_meta_data = jsonb_build_object(
      'tenant_id', NEW.tenant_id,
      'role', NEW.role,
      'user_id', NEW.id
    )
    WHERE id = auth_user_id;

    RAISE NOTICE 'Synced metadata to JWT for user: % (tenant: %, role: %)',
      NEW.email, NEW.tenant_id, NEW.role;
  END IF;

  RETURN NEW;
END;
$$;

-- ============================================================================
-- Create trigger on public.users
-- ============================================================================

DROP TRIGGER IF EXISTS sync_user_metadata_trigger ON public.users;

CREATE TRIGGER sync_user_metadata_trigger
  AFTER INSERT OR UPDATE OF tenant_id, role
  ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION sync_user_metadata_to_jwt();

-- ============================================================================
-- Backfill existing users' JWT metadata
-- ============================================================================

-- Update all existing users' JWT metadata
UPDATE auth.users au
SET raw_user_meta_data = jsonb_build_object(
  'tenant_id', u.tenant_id,
  'role', u.role,
  'user_id', u.id
)
FROM public.users u
WHERE au.email = u.email
  AND (au.raw_user_meta_data IS NULL OR au.raw_user_meta_data = '{}'::jsonb);

-- ============================================================================
-- Add comments
-- ============================================================================

COMMENT ON FUNCTION sync_user_metadata_to_jwt() IS
'Syncs tenant_id and role from public.users to auth.users.raw_user_meta_data for JWT claims';

COMMENT ON TRIGGER sync_user_metadata_trigger ON public.users IS
'Automatically syncs user metadata to JWT when public.users is modified';
