-- ============================================================================
-- Seed Platform Super Admin Tenant
-- ============================================================================
-- ID matches App Plane Platform Super Admin org: a0000000-0000-0000-0000-000000000000
-- Key: 'platform' (short, clear purpose)
--
-- PURPOSE:
-- - Provides a system-level tenant for platform administration
-- - Enables staff to test features without affecting customer data
-- - Matches the Platform Super Admin org in App Plane Supabase

-- First, handle potential key conflicts
UPDATE main.tenants
SET key = 'platform-old-' || EXTRACT(EPOCH FROM NOW())::TEXT
WHERE key = 'platform'
  AND id != 'a0000000-0000-0000-0000-000000000000';

-- Insert/Update Platform Super Admin tenant
INSERT INTO main.tenants (
  id,
  name,
  key,
  status,
  domains,
  created_on,
  modified_on
) VALUES (
  'a0000000-0000-0000-0000-000000000000',
  'Platform Super Admin',
  'platform',
  0,  -- 0 = active
  ARRAY['platform.local'],
  NOW(),
  NOW()
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  key = 'platform',
  status = 0,
  modified_on = NOW();

-- Add a contact for the platform tenant
INSERT INTO main.contacts (
  id,
  first_name,
  last_name,
  email,
  is_primary,
  tenant_id,
  created_on
) VALUES (
  'a0000000-0000-0000-0000-000000000001',
  'Platform',
  'Administrator',
  'platform-admin@example.com',
  TRUE,
  'a0000000-0000-0000-0000-000000000000',
  NOW()
)
ON CONFLICT (id) DO NOTHING;

-- Seed a Platform Super Admin setting to document this
INSERT INTO main.settings (
  config_key,
  config_value,
  value_type,
  description,
  category,
  is_public
) VALUES (
  'platform.super_admin_tenant_id',
  'a0000000-0000-0000-0000-000000000000',
  'string',
  'The tenant ID for the Platform Super Admin organization. This is a system tenant for platform administration.',
  'platform',
  FALSE
)
ON CONFLICT (config_key) DO UPDATE SET
  config_value = EXCLUDED.config_value,
  description = EXCLUDED.description;

-- Verification
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM main.tenants WHERE id = 'a0000000-0000-0000-0000-000000000000') THEN
    RAISE EXCEPTION 'Platform Super Admin tenant was not created!';
  END IF;
  RAISE NOTICE 'Platform Super Admin tenant seeded successfully.';
END $$;
