-- Migration: 089_platform_staff_organization.sql
-- Description: Creates Platform Staff organization and auto-membership for platform staff
--
-- PURPOSE:
-- All CNS Dashboard uploads use a single "Platform Super Admin" organization.
-- This ensures staff uploads are isolated from customer data and provides
-- a consistent home for platform administration work.
--
-- FEATURES:
-- 1. Creates Platform Super Admin org if not exists (id: a0000000-0000-0000-0000-000000000000)
-- 2. Auto-adds users with role='super_admin' or is_platform_admin=true to this org
-- 3. Trigger to auto-add new super admins when they're created/updated

BEGIN;

-- ============================================================================
-- SECTION 1: Create Platform Super Admin Organization
-- ============================================================================

-- The Platform Super Admin org ID (matches CNS_STAFF_ORGANIZATION_ID in frontend)
DO $$
DECLARE
  platform_org_id uuid := 'a0000000-0000-0000-0000-000000000000';
BEGIN
  -- Insert Platform Super Admin org if it doesn't exist
  INSERT INTO organizations (id, name, slug, org_type, enterprise_settings, created_at, updated_at)
  VALUES (
    platform_org_id,
    'Platform Super Admin',
    'platform-super-admin',
    'platform',
    jsonb_build_object(
      'is_platform_org', true,
      'description', 'Platform administration organization for CNS staff'
    ),
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    org_type = 'platform',
    enterprise_settings = COALESCE(organizations.enterprise_settings, '{}'::jsonb) || EXCLUDED.enterprise_settings,
    updated_at = NOW();

  RAISE NOTICE 'Platform Super Admin organization ensured: %', platform_org_id;
END $$;

-- ============================================================================
-- SECTION 2: Function to Add User to Platform Org
-- ============================================================================

CREATE OR REPLACE FUNCTION add_user_to_platform_org(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  platform_org_id uuid := 'a0000000-0000-0000-0000-000000000000';
  user_role text;
  user_is_platform_admin boolean;
BEGIN
  -- Check if user is super admin or platform admin
  SELECT role, is_platform_admin INTO user_role, user_is_platform_admin
  FROM users
  WHERE id = p_user_id;

  -- Only add super admins and platform admins to platform org
  IF user_role IN ('super_admin', 'platform_admin') OR user_is_platform_admin = true THEN
    -- Add user to platform org as admin (not owner - platform org has no single owner)
    INSERT INTO organization_memberships (user_id, organization_id, role, created_at, updated_at)
    VALUES (p_user_id, platform_org_id, 'admin', NOW(), NOW())
    ON CONFLICT (user_id, organization_id) DO UPDATE SET
      role = 'admin',
      updated_at = NOW();

    RAISE NOTICE 'User % added to Platform Super Admin org', p_user_id;
  END IF;
END;
$$;

COMMENT ON FUNCTION add_user_to_platform_org(uuid) IS
'Adds a super admin or platform admin user to the Platform Super Admin organization with admin role.';

-- ============================================================================
-- SECTION 3: Trigger to Auto-Add Super Admins
-- ============================================================================

-- Trigger function that fires when a user becomes super admin or platform admin
CREATE OR REPLACE FUNCTION trigger_auto_add_platform_staff_to_platform_org()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- When role becomes super_admin/platform_admin OR is_platform_admin becomes true, add to platform org
  IF (NEW.role IN ('super_admin', 'platform_admin') OR NEW.is_platform_admin = true) AND 
     (OLD IS NULL OR (OLD.role NOT IN ('super_admin', 'platform_admin') AND OLD.is_platform_admin <> true)) THEN
    PERFORM add_user_to_platform_org(NEW.id);
  END IF;

  RETURN NEW;
END;
$$;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS auto_add_platform_staff_to_platform_org ON users;

-- Create trigger on users table
CREATE TRIGGER auto_add_platform_staff_to_platform_org
  AFTER INSERT OR UPDATE OF role, is_platform_admin ON users
  FOR EACH ROW
  EXECUTE FUNCTION trigger_auto_add_platform_staff_to_platform_org();

COMMENT ON TRIGGER auto_add_platform_staff_to_platform_org ON users IS
'Automatically adds users with role=super_admin/platform_admin or is_platform_admin=true to the Platform Super Admin organization.';

-- ============================================================================
-- SECTION 4: Backfill Existing Platform Staff
-- ============================================================================

-- Add all existing super admins and platform admins to the platform org
DO $$
DECLARE
  staff_record RECORD;
  added_count integer := 0;
BEGIN
  FOR staff_record IN
    SELECT id, email FROM users 
    WHERE role IN ('super_admin', 'platform_admin') OR is_platform_admin = true
  LOOP
    PERFORM add_user_to_platform_org(staff_record.id);
    added_count := added_count + 1;
  END LOOP;

  RAISE NOTICE 'Backfilled % platform staff members to Platform Super Admin org', added_count;
END $$;

-- ============================================================================
-- SECTION 5: RLS Policy for Platform Org Access
-- ============================================================================

-- Super admins can access platform org data
-- This supplements existing RLS policies

-- Function to check if user is in platform org
CREATE OR REPLACE FUNCTION is_platform_staff()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM organization_memberships
    WHERE user_id = get_current_user_id()
    AND organization_id = 'a0000000-0000-0000-0000-000000000000'::uuid
  )
$$;

COMMENT ON FUNCTION is_platform_staff() IS
'Returns true if current user is a member of the Platform Super Admin organization.';

COMMIT;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Verify platform org exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM organizations WHERE id = 'a0000000-0000-0000-0000-000000000000') THEN
    RAISE EXCEPTION 'Platform Super Admin organization was not created!';
  END IF;
  RAISE NOTICE 'Migration 089 completed successfully.';
END $$;
