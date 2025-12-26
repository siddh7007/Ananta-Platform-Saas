'use strict';

var dbm;
var type;
var seed;

/**
 * Platform Super Admin Tenant Seed Migration
 *
 * Seeds the Platform Super Admin tenant in the Control Plane.
 * This tenant corresponds to the Platform Super Admin organization
 * in the App Plane (a0000000-0000-0000-0000-000000000000).
 *
 * PURPOSE:
 * - Provides a system-level tenant for platform administration
 * - Enables staff to test features without affecting customer data
 * - Matches the Platform Super Admin org in App Plane Supabase
 */
exports.setup = function (options, seedLink) {
  dbm = options.dbmigrate;
  type = dbm.dataType;
  seed = seedLink;
};

exports.up = function (db) {
  return db.runSql(`
    -- ============================================================================
    -- Seed Platform Super Admin Tenant
    -- ============================================================================
    -- ID matches App Plane Platform Super Admin org: a0000000-0000-0000-0000-000000000000
    -- Key: 'platform' (short, clear purpose)

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
      key = EXCLUDED.key,
      status = 0,
      modified_on = NOW();

    -- Also ensure unique key constraint doesn't conflict
    -- (in case 'platform' key exists with different ID)
    UPDATE main.tenants
    SET key = 'platform-old-' || EXTRACT(EPOCH FROM NOW())::TEXT
    WHERE key = 'platform'
      AND id != 'a0000000-0000-0000-0000-000000000000';

    -- Re-run insert in case first one failed due to key conflict
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
      0,
      ARRAY['platform.local'],
      NOW(),
      NOW()
    )
    ON CONFLICT (id) DO NOTHING;

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
  `);
};

exports.down = function (db) {
  return db.runSql(`
    -- Remove Platform Super Admin setting
    DELETE FROM main.settings
    WHERE config_key = 'platform.super_admin_tenant_id';

    -- Remove contact
    DELETE FROM main.contacts
    WHERE id = 'a0000000-0000-0000-0000-000000000001';

    -- Remove tenant (be careful - this is destructive!)
    -- Commented out for safety - only uncomment if you really need to remove it
    -- DELETE FROM main.tenants
    -- WHERE id = 'a0000000-0000-0000-0000-000000000000';
  `);
};

exports._meta = {
  version: 1,
};
