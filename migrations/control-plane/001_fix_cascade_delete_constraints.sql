-- Migration: Fix CASCADE DELETE constraints in Control Plane
-- Priority: HIGH
-- Estimated time: 5 minutes
--
-- Updates FK constraints to use CASCADE for proper tenant cleanup

-- ============================================================================
-- CONTROL PLANE: Fix NO ACTION constraints on main schema
-- ============================================================================

-- 1. user_activities.tenant_id - Should CASCADE (activity belongs to tenant)
ALTER TABLE main.user_activities
DROP CONSTRAINT IF EXISTS user_activities_tenant_id_fkey,
ADD CONSTRAINT user_activities_tenant_id_fkey
  FOREIGN KEY (tenant_id)
  REFERENCES main.tenants(id)
  ON DELETE CASCADE;

-- 2. user_invitations.tenant_id - Should CASCADE (invitation belongs to tenant)
ALTER TABLE main.user_invitations
DROP CONSTRAINT IF EXISTS user_invitations_tenant_id_fkey,
ADD CONSTRAINT user_invitations_tenant_id_fkey
  FOREIGN KEY (tenant_id)
  REFERENCES main.tenants(id)
  ON DELETE CASCADE;

-- 3. user_roles.tenant_id - Should CASCADE (role assignment belongs to tenant)
ALTER TABLE main.user_roles
DROP CONSTRAINT IF EXISTS user_roles_tenant_id_fkey,
ADD CONSTRAINT user_roles_tenant_id_fkey
  FOREIGN KEY (tenant_id)
  REFERENCES main.tenants(id)
  ON DELETE CASCADE;

-- 4. users.tenant_id - Should CASCADE or SET NULL depending on business logic
-- If users are tenant-specific, use CASCADE
-- If users can exist without tenant, use SET NULL
-- Defaulting to CASCADE (user belongs to tenant)
ALTER TABLE main.users
DROP CONSTRAINT IF EXISTS users_tenant_id_fkey,
ADD CONSTRAINT users_tenant_id_fkey
  FOREIGN KEY (tenant_id)
  REFERENCES main.tenants(id)
  ON DELETE CASCADE;

-- 5. contacts.tenant_id - Should CASCADE (contact belongs to tenant)
ALTER TABLE main.contacts
DROP CONSTRAINT IF EXISTS contacts_tenant_id_fkey,
ADD CONSTRAINT contacts_tenant_id_fkey
  FOREIGN KEY (tenant_id)
  REFERENCES main.tenants(id)
  ON DELETE CASCADE;

-- 6. user_invitations.accepted_by - Should SET NULL (preserve invitation record)
ALTER TABLE main.user_invitations
DROP CONSTRAINT IF EXISTS user_invitations_accepted_by_fkey,
ADD CONSTRAINT user_invitations_accepted_by_fkey
  FOREIGN KEY (accepted_by)
  REFERENCES main.users(id)
  ON DELETE SET NULL;

-- 7. user_invitations.invited_by - Should SET NULL (preserve invitation record)
ALTER TABLE main.user_invitations
DROP CONSTRAINT IF EXISTS user_invitations_invited_by_fkey,
ADD CONSTRAINT user_invitations_invited_by_fkey
  FOREIGN KEY (invited_by)
  REFERENCES main.users(id)
  ON DELETE SET NULL;

-- 8. audit_logs.tenant_id - May be nullable, if so SET NULL, otherwise leave as is
-- Check if column is nullable first
DO $$
BEGIN
    -- If audit_logs.tenant_id is NOT NULL, add CASCADE FK
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'main'
        AND table_name = 'audit_logs'
        AND column_name = 'tenant_id'
        AND is_nullable = 'NO'
    ) THEN
        ALTER TABLE main.audit_logs
        DROP CONSTRAINT IF EXISTS audit_logs_tenant_id_fkey;

        ALTER TABLE main.audit_logs
        ADD CONSTRAINT audit_logs_tenant_id_fkey
          FOREIGN KEY (tenant_id)
          REFERENCES main.tenants(id)
          ON DELETE CASCADE;
    ELSE
        -- If nullable, SET NULL is safer
        ALTER TABLE main.audit_logs
        DROP CONSTRAINT IF EXISTS audit_logs_tenant_id_fkey;

        ALTER TABLE main.audit_logs
        ADD CONSTRAINT audit_logs_tenant_id_fkey
          FOREIGN KEY (tenant_id)
          REFERENCES main.tenants(id)
          ON DELETE SET NULL;
    END IF;
END $$;

-- ============================================================================
-- Verification Query
-- ============================================================================

-- Check all FK constraints with their delete rules in main schema
SELECT
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table,
    ccu.column_name AS foreign_column,
    rc.delete_rule AS on_delete,
    rc.update_rule AS on_update
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu
    ON ccu.constraint_name = tc.constraint_name
JOIN information_schema.referential_constraints rc
    ON tc.constraint_name = rc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'main'
    AND (
        kcu.column_name = 'tenant_id'
        OR ccu.table_name IN ('users', 'tenants')
    )
ORDER BY tc.table_name, kcu.column_name;
