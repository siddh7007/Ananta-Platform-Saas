-- Component Access Control Migration (Django Version)
-- Adds user-level permissions for component visibility
-- Created: 2025-11-11

-- ============================================================================
-- 1. Add created_by to components table
-- ============================================================================

-- Add created_by field to track component ownership
ALTER TABLE components
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id) ON DELETE SET NULL;

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_components_created_by ON components(created_by);

-- Update existing components to have a created_by (set to first user if available)
UPDATE components
SET created_by = (
  SELECT id FROM users ORDER BY created_at ASC LIMIT 1
)
WHERE created_by IS NULL;

COMMENT ON COLUMN components.created_by IS 'User who created/uploaded this component';

-- ============================================================================
-- 2. Add access control flag to users
-- ============================================================================

-- Add permission flag to control component visibility
-- If true: user can see all components in their tenant
-- If false: user can only see components they created
ALTER TABLE users
ADD COLUMN IF NOT EXISTS can_view_all_tenant_components BOOLEAN DEFAULT true;

COMMENT ON COLUMN users.can_view_all_tenant_components IS
'Permission: true = can see all tenant components, false = can only see own components';

-- Default all existing users to have full tenant visibility
UPDATE users
SET can_view_all_tenant_components = true
WHERE can_view_all_tenant_components IS NULL;

-- ============================================================================
-- 3. Create view for component access control
-- ============================================================================

-- View that filters components based on user permissions
-- Note: Django will handle filtering via Python code, but this view can be useful for queries
CREATE OR REPLACE VIEW user_accessible_components AS
SELECT
  c.*,
  u.email as created_by_email,
  u.first_name || ' ' || u.last_name as created_by_name
FROM components c
LEFT JOIN users u ON u.id = c.created_by;

COMMENT ON VIEW user_accessible_components IS
'View showing components with creator information';

-- ============================================================================
-- 4. Trigger to auto-set created_by on INSERT
-- ============================================================================

-- Function to auto-set created_by based on application context
-- Note: Django will typically set this explicitly, but this provides a fallback
CREATE OR REPLACE FUNCTION set_component_created_by()
RETURNS TRIGGER AS $$
BEGIN
  -- If created_by is not set, we can't auto-determine it in PostgreSQL
  -- Django application layer should always set this
  IF NEW.created_by IS NULL THEN
    RAISE WARNING 'Component created without created_by - application should set this field';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to call function
DROP TRIGGER IF EXISTS trigger_set_component_created_by ON components;
CREATE TRIGGER trigger_set_component_created_by
  BEFORE INSERT ON components
  FOR EACH ROW
  EXECUTE FUNCTION set_component_created_by();

-- ============================================================================
-- 5. Grant permissions
-- ============================================================================

-- Grant SELECT on view to application users
-- (Adjust role names based on your PostgreSQL user setup)
-- GRANT SELECT ON user_accessible_components TO app_user;

-- ============================================================================
-- Verification Queries
-- ============================================================================

-- Check user's permission
-- SELECT
--   id,
--   email,
--   can_view_all_tenant_components,
--   tenant_id
-- FROM users;

-- Check components with ownership
-- SELECT
--   id,
--   mpn,
--   manufacturer_name,
--   tenant_id,
--   created_by,
--   (SELECT email FROM users WHERE id = c.created_by) as created_by_email
-- FROM components c
-- LIMIT 10;

-- Test view
-- SELECT * FROM user_accessible_components LIMIT 10;
