-- Migration: Fix alert preferences trigger to work with supabase_auth_admin
-- Issue: When creating new users via Supabase Admin API, the trigger
--        create_default_alert_preferences() runs as supabase_auth_admin
--        which doesn't have permission to insert into alert_preferences.
-- Solution: Add SECURITY DEFINER to run the function as the owner (postgres),
--           which bypasses RLS and has full permissions.
-- Date: 2025-11-30

-- ============================================================================
-- 1. Grant permissions to supabase_auth_admin on alert_preferences
-- ============================================================================
-- Even with SECURITY DEFINER, we should grant permissions for transparency
GRANT INSERT, SELECT ON TABLE alert_preferences TO supabase_auth_admin;

-- ============================================================================
-- 2. Recreate the function with SECURITY DEFINER
-- ============================================================================
CREATE OR REPLACE FUNCTION create_default_alert_preferences()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER  -- Run as function owner (postgres), bypassing RLS
SET search_path = public
AS $$
DECLARE
  org_id UUID;
BEGIN
  -- Get user's organization ID (assuming it's in user_metadata)
  org_id := (NEW.raw_user_meta_data->>'organization_id')::UUID;

  IF org_id IS NOT NULL THEN
    -- Create default preferences for each alert type
    INSERT INTO alert_preferences (user_id, organization_id, alert_type, email_enabled, in_app_enabled)
    VALUES
      (NEW.id, org_id, 'LIFECYCLE', TRUE, TRUE),
      (NEW.id, org_id, 'RISK', TRUE, TRUE),
      (NEW.id, org_id, 'COMPLIANCE', TRUE, TRUE)
    ON CONFLICT (user_id, organization_id, alert_type) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

-- ============================================================================
-- 3. Verify the function has SECURITY DEFINER
-- ============================================================================
DO $$
DECLARE
  has_secdef BOOLEAN;
BEGIN
  SELECT prosecdef INTO has_secdef
  FROM pg_proc
  WHERE proname = 'create_default_alert_preferences';

  IF NOT has_secdef THEN
    RAISE EXCEPTION 'Function create_default_alert_preferences does not have SECURITY DEFINER';
  END IF;

  RAISE NOTICE 'create_default_alert_preferences() now has SECURITY DEFINER';
END;
$$;

COMMENT ON FUNCTION create_default_alert_preferences IS
  'Automatically create default alert preferences for new users. Uses SECURITY DEFINER to bypass RLS when called by supabase_auth_admin.';
