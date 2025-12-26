-- ============================================================================
-- Rollback Platform Super Admin Tenant Seed
-- ============================================================================
-- WARNING: This will remove the Platform Super Admin tenant.
-- Be careful - this is destructive!

-- Remove Platform Super Admin setting
DELETE FROM main.settings
WHERE config_key = 'platform.super_admin_tenant_id';

-- Remove contact
DELETE FROM main.contacts
WHERE id = 'a0000000-0000-0000-0000-000000000001';

-- NOTE: Tenant deletion is commented out for safety.
-- Uncomment only if you really need to remove the Platform Super Admin tenant.
-- DELETE FROM main.tenants
-- WHERE id = 'a0000000-0000-0000-0000-000000000000';

RAISE NOTICE 'Platform Super Admin tenant settings removed. Tenant itself preserved for safety.';
