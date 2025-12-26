-- Component Access Control Migration
-- Adds user-level permissions for component visibility
-- Created: 2025-11-11

-- ============================================================================
-- 1. Add created_by to components table
-- ============================================================================

-- Add created_by field to track component ownership
ALTER TABLE components
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_components_created_by ON components(created_by);

-- Update existing components to have a created_by (set to first admin user if available)
UPDATE components
SET created_by = (
  SELECT id FROM auth.users LIMIT 1
)
WHERE created_by IS NULL;

COMMENT ON COLUMN components.created_by IS 'User who created/uploaded this component';

-- ============================================================================
-- 2. Add access control flag to users
-- ============================================================================

-- Add permission flag to control component visibility
-- If true: user can see all components in their tenant
-- If false: user can only see components they created
ALTER TABLE auth.users
ADD COLUMN IF NOT EXISTS can_view_all_tenant_components BOOLEAN DEFAULT true;

COMMENT ON COLUMN auth.users.can_view_all_tenant_components IS
'Permission: true = can see all tenant components, false = can only see own components';

-- Default all existing users to have full tenant visibility
UPDATE auth.users
SET can_view_all_tenant_components = true
WHERE can_view_all_tenant_components IS NULL;

-- ============================================================================
-- 3. Create view for component access control
-- ============================================================================

-- View that automatically filters components based on user permissions
CREATE OR REPLACE VIEW user_accessible_components AS
SELECT
  c.*,
  u.email as created_by_email,
  CASE
    WHEN u.can_view_all_tenant_components THEN true
    WHEN c.created_by = auth.uid() THEN true
    ELSE false
  END as user_can_view
FROM components c
LEFT JOIN auth.users u ON u.id = c.created_by
WHERE
  -- User's organization matches component's organization
  c.organization_id = (
    SELECT user_metadata->>'tenant_id'
    FROM auth.users
    WHERE id = auth.uid()
  )::uuid
  AND (
    -- User can see all tenant components
    (SELECT can_view_all_tenant_components FROM auth.users WHERE id = auth.uid()) = true
    OR
    -- User can only see their own components
    c.created_by = auth.uid()
  );

COMMENT ON VIEW user_accessible_components IS
'View that automatically filters components based on user permissions and tenant';

-- ============================================================================
-- 4. Add RLS policies for components table
-- ============================================================================

-- Enable RLS on components table
ALTER TABLE components ENABLE ROW LEVEL SECURITY;

-- Policy 1: Users can SELECT components in their tenant based on permissions
DROP POLICY IF EXISTS "Users can view accessible components" ON components;
CREATE POLICY "Users can view accessible components" ON components
  FOR SELECT
  USING (
    -- Component belongs to user's tenant
    organization_id = (
      SELECT (user_metadata->>'tenant_id')::uuid
      FROM auth.users
      WHERE id = auth.uid()
    )
    AND (
      -- User has permission to see all tenant components
      (SELECT can_view_all_tenant_components FROM auth.users WHERE id = auth.uid()) = true
      OR
      -- User created this component
      created_by = auth.uid()
    )
  );

-- Policy 2: Users can INSERT components to their tenant
DROP POLICY IF EXISTS "Users can insert components to their tenant" ON components;
CREATE POLICY "Users can insert components to their tenant" ON components
  FOR INSERT
  WITH CHECK (
    -- Component must belong to user's tenant
    organization_id = (
      SELECT (user_metadata->>'tenant_id')::uuid
      FROM auth.users
      WHERE id = auth.uid()
    )
    -- created_by is automatically set by trigger (below)
  );

-- Policy 3: Users can UPDATE their own components
DROP POLICY IF EXISTS "Users can update own components" ON components;
CREATE POLICY "Users can update own components" ON components
  FOR UPDATE
  USING (
    -- User created this component
    created_by = auth.uid()
  );

-- Policy 4: Admins can UPDATE all tenant components
DROP POLICY IF EXISTS "Admins can update all tenant components" ON components;
CREATE POLICY "Admins can update all tenant components" ON components
  FOR UPDATE
  USING (
    -- Component belongs to user's tenant
    organization_id = (
      SELECT (user_metadata->>'tenant_id')::uuid
      FROM auth.users
      WHERE id = auth.uid()
    )
    AND (
      -- User is admin
      (SELECT is_admin FROM auth.users WHERE id = auth.uid()) = true
      OR
      -- User has full tenant access
      (SELECT can_view_all_tenant_components FROM auth.users WHERE id = auth.uid()) = true
    )
  );

-- Policy 5: Only admins can DELETE components
DROP POLICY IF EXISTS "Admins can delete tenant components" ON components;
CREATE POLICY "Admins can delete tenant components" ON components
  FOR DELETE
  USING (
    -- Component belongs to user's tenant
    organization_id = (
      SELECT (user_metadata->>'tenant_id')::uuid
      FROM auth.users
      WHERE id = auth.uid()
    )
    AND (
      -- User is admin
      (SELECT is_admin FROM auth.users WHERE id = auth.uid()) = true
    )
  );

-- ============================================================================
-- 5. Trigger to auto-set created_by on INSERT
-- ============================================================================

-- Function to auto-set created_by
CREATE OR REPLACE FUNCTION set_component_created_by()
RETURNS TRIGGER AS $$
BEGIN
  -- Auto-set created_by to current user if not provided
  IF NEW.created_by IS NULL THEN
    NEW.created_by = auth.uid();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to call function
DROP TRIGGER IF EXISTS trigger_set_component_created_by ON components;
CREATE TRIGGER trigger_set_component_created_by
  BEFORE INSERT ON components
  FOR EACH ROW
  EXECUTE FUNCTION set_component_created_by();

-- ============================================================================
-- 6. Helper function to check user's component access permission
-- ============================================================================

CREATE OR REPLACE FUNCTION user_can_view_all_tenant_components()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN COALESCE(
    (SELECT can_view_all_tenant_components FROM auth.users WHERE id = auth.uid()),
    false
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION user_can_view_all_tenant_components() IS
'Returns true if current user can see all tenant components, false if only own components';

-- ============================================================================
-- 7. Grant permissions
-- ============================================================================

-- Grant SELECT on view
GRANT SELECT ON user_accessible_components TO authenticated;
GRANT SELECT ON user_accessible_components TO anon;

-- Grant access to helper function
GRANT EXECUTE ON FUNCTION user_can_view_all_tenant_components() TO authenticated;
GRANT EXECUTE ON FUNCTION user_can_view_all_tenant_components() TO anon;

-- ============================================================================
-- Test Data (Optional - for development)
-- ============================================================================

-- Example: Set specific user to only see own components
-- UPDATE auth.users
-- SET can_view_all_tenant_components = false
-- WHERE email = 'limited-user@example.com';

-- ============================================================================
-- Verification Queries
-- ============================================================================

-- Check user's permission
-- SELECT
--   id,
--   email,
--   can_view_all_tenant_components,
--   user_metadata->>'tenant_id' as tenant_id
-- FROM auth.users;

-- Check components with ownership
-- SELECT
--   id,
--   manufacturer_part_number,
--   organization_id,
--   created_by,
--   (SELECT email FROM auth.users WHERE id = c.created_by) as created_by_email
-- FROM components c
-- LIMIT 10;

-- Test view filtering
-- SELECT * FROM user_accessible_components LIMIT 10;
