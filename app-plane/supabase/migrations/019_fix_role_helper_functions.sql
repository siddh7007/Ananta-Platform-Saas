-- Migration: Fix Role Helper Functions
-- Date: 2025-11-12
-- Purpose: Fix is_admin() and is_engineer() to use actual users table instead of non-existent current_user_info()

-- ============================================================================
-- 1. Fix is_admin() function
-- ============================================================================

CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM users
    WHERE email = auth.email()
    AND (role IN ('admin') OR super_admin = true)
  );
$$;

COMMENT ON FUNCTION is_admin IS 'Check if current user is an admin (role = admin OR super_admin = true)';

-- ============================================================================
-- 2. Fix is_engineer() function
-- ============================================================================

CREATE OR REPLACE FUNCTION is_engineer()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM users
    WHERE email = auth.email()
    AND (role IN ('admin', 'engineer') OR super_admin = true)
  );
$$;

COMMENT ON FUNCTION is_engineer IS 'Check if current user has engineer-level access or higher (role = engineer/admin OR super_admin = true)';

-- ============================================================================
-- 3. Add is_member() helper (base access level)
-- ============================================================================

CREATE OR REPLACE FUNCTION is_member()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM users
    WHERE email = auth.email()
  );
$$;

COMMENT ON FUNCTION is_member IS 'Check if current user exists (any authenticated user)';

-- ============================================================================
-- 4. Role Hierarchy Summary
-- ============================================================================

-- Role hierarchy (from highest to lowest):
-- 1. super_admin (super_admin = true) - Platform-wide access, bypasses tenant isolation
-- 2. admin (role = 'admin') - Full access within their tenant
-- 3. engineer (role = 'engineer') - Create/manage own projects and BOMs
-- 4. member (any authenticated user) - Basic read access

-- Helper functions:
-- - is_super_admin() → super_admin = true
-- - is_admin() → role = 'admin' OR super_admin = true
-- - is_engineer() → role = 'engineer' OR role = 'admin' OR super_admin = true
-- - is_member() → any authenticated user
