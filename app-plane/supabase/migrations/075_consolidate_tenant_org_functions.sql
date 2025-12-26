-- Migration 075: Consolidate current_user_tenant_id() and current_user_organization_id()
-- Purpose: Remove inconsistency by making tenant_id an alias to organization_id
-- Date: 2025-12-01
--
-- Problem: Two functions exist with different fallback strategies
--   - current_user_organization_id(): 5 fallback paths (includes auth0_user_id lookup)
--   - current_user_tenant_id(): 4 fallback paths (email-based only)
--
-- Solution:
--   1. Make current_user_tenant_id() call current_user_organization_id()
--   2. Update 4 policies to use current_user_organization_id() directly
--   3. Remove redundant "Anon super admin" policies (covered by regular super_admin policies)

-- ============================================================================
-- 1. Make current_user_tenant_id() an alias to current_user_organization_id()
-- ============================================================================

CREATE OR REPLACE FUNCTION public.current_user_tenant_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT current_user_organization_id();
$$;

COMMENT ON FUNCTION public.current_user_tenant_id() IS
'Alias for current_user_organization_id() - maintained for backward compatibility';

-- ============================================================================
-- 2. Update bom_line_items policies to use current_user_organization_id()
-- ============================================================================

-- Drop old policies
DROP POLICY IF EXISTS "Users can view own tenant line items" ON bom_line_items;
DROP POLICY IF EXISTS "Users can manage own tenant line items" ON bom_line_items;

-- Recreate with current_user_organization_id()
CREATE POLICY "Users can view own org line items" ON bom_line_items
FOR SELECT
USING (
    is_super_admin() OR
    EXISTS (
        SELECT 1 FROM boms
        WHERE boms.id = bom_line_items.bom_id
        AND boms.organization_id = current_user_organization_id()
    )
);

CREATE POLICY "Users can manage own org line items" ON bom_line_items
FOR ALL
USING (
    is_super_admin() OR
    EXISTS (
        SELECT 1 FROM boms
        WHERE boms.id = bom_line_items.bom_id
        AND boms.organization_id = current_user_organization_id()
    )
)
WITH CHECK (
    is_super_admin() OR
    EXISTS (
        SELECT 1 FROM boms
        WHERE boms.id = bom_line_items.bom_id
        AND boms.organization_id = current_user_organization_id()
    )
);

-- ============================================================================
-- 3. Update organizations policy to use current_user_organization_id()
-- ============================================================================

DROP POLICY IF EXISTS "Users can view own tenant" ON organizations;

CREATE POLICY "Users can view own organization" ON organizations
FOR SELECT
USING (
    is_super_admin() OR
    id = current_user_organization_id()
);

-- ============================================================================
-- 4. Update users policy to use current_user_organization_id()
-- ============================================================================

DROP POLICY IF EXISTS "Users can view own organization users" ON users;

CREATE POLICY "Users can view own org users" ON users
FOR SELECT
USING (
    is_super_admin() OR
    organization_id = current_user_organization_id()
);

-- ============================================================================
-- 5. Remove redundant "Anon super admin" policies (covered by super_admin policies)
-- ============================================================================

-- These are redundant because:
-- - "Super admins can manage all X" already covers super_admin access
-- - Having both creates confusion about which policy applies

DROP POLICY IF EXISTS "Anon super admin access to bom_line_items" ON bom_line_items;
DROP POLICY IF EXISTS "Anon super admin access to organizations" ON organizations;
DROP POLICY IF EXISTS "Anon super admin access to users" ON users;

-- ============================================================================
-- Summary
-- ============================================================================
--
-- Before: 2 functions with different fallback strategies
--   current_user_organization_id() - 5 fallbacks (includes auth0_user_id)
--   current_user_tenant_id() - 4 fallbacks (email only)
--
-- After: 1 canonical function, 1 alias
--   current_user_organization_id() - canonical, 5 fallbacks
--   current_user_tenant_id() - alias to above
--
-- Policies updated:
--   - bom_line_items: 2 policies now use current_user_organization_id()
--   - organizations: 1 policy now uses current_user_organization_id()
--   - users: 1 policy now uses current_user_organization_id()
--
-- Policies removed (redundant):
--   - "Anon super admin access to bom_line_items"
--   - "Anon super admin access to organizations"
--   - "Anon super admin access to users"
--
