-- Migration: Rename platform_admin to super_admin
-- Date: 2025-11-12
-- Purpose: Standardize terminology - use "super_admin" everywhere

-- ============================================================================
-- 1. Rename column
-- ============================================================================

ALTER TABLE users RENAME COLUMN platform_admin TO super_admin;

COMMENT ON COLUMN users.super_admin IS 'Super admin flag - grants full platform-wide access (can see all tenants, bypass all RLS policies)';

-- ============================================================================
-- 2. Update is_super_admin() function to use new column name
-- ============================================================================

CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM users
    WHERE email = auth.email()
    AND super_admin = true
  );
$$;

COMMENT ON FUNCTION is_super_admin IS 'Check if current user is a super admin (super_admin = true)';

-- ============================================================================
-- 3. Verify
-- ============================================================================

-- After this migration:
-- ✅ Column: users.super_admin (boolean)
-- ✅ Function: is_super_admin() checks super_admin = true
-- ✅ RLS policies: Use is_super_admin() to bypass tenant isolation
