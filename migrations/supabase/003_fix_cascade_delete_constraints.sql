-- Migration: Fix CASCADE DELETE constraints for proper tenant cleanup
-- Priority: HIGH
-- Estimated time: 5 minutes
--
-- Updates FK constraints to use CASCADE or SET NULL to prevent orphaned records

-- ============================================================================
-- SUPABASE: Fix NO ACTION constraints
-- ============================================================================

-- 1. users.organization_id - Should CASCADE (user belongs to org)
ALTER TABLE users
DROP CONSTRAINT IF EXISTS users_organization_id_fkey,
ADD CONSTRAINT users_organization_id_fkey
  FOREIGN KEY (organization_id)
  REFERENCES organizations(id)
  ON DELETE CASCADE;

-- 2. boms.created_by_id - Should SET NULL (preserve BOM if user deleted)
ALTER TABLE boms
DROP CONSTRAINT IF EXISTS boms_created_by_id_fkey,
ADD CONSTRAINT boms_created_by_id_fkey
  FOREIGN KEY (created_by_id)
  REFERENCES user_profiles(id)
  ON DELETE SET NULL;

-- 3. alerts.user_id - Should SET NULL (preserve alert if user deleted)
ALTER TABLE alerts
DROP CONSTRAINT IF EXISTS alerts_user_id_fkey,
ADD CONSTRAINT alerts_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES user_profiles(id)
  ON DELETE SET NULL;

-- 4. component_alternatives.verified_by - Should SET NULL
ALTER TABLE component_alternatives
DROP CONSTRAINT IF EXISTS component_alternatives_verified_by_fkey,
ADD CONSTRAINT component_alternatives_verified_by_fkey
  FOREIGN KEY (verified_by)
  REFERENCES user_profiles(id)
  ON DELETE SET NULL;

-- 5. component_tags.created_by - Should SET NULL
ALTER TABLE component_tags
DROP CONSTRAINT IF EXISTS component_tags_created_by_fkey,
ADD CONSTRAINT component_tags_created_by_fkey
  FOREIGN KEY (created_by)
  REFERENCES user_profiles(id)
  ON DELETE SET NULL;

-- 6. vendor_category_mappings.verified_by - Should SET NULL
ALTER TABLE vendor_category_mappings
DROP CONSTRAINT IF EXISTS vendor_category_mappings_verified_by_fkey,
ADD CONSTRAINT vendor_category_mappings_verified_by_fkey
  FOREIGN KEY (verified_by)
  REFERENCES user_profiles(id)
  ON DELETE SET NULL;

-- 7. workspaces.created_by - Should SET NULL
ALTER TABLE workspaces
DROP CONSTRAINT IF EXISTS workspaces_created_by_fkey,
ADD CONSTRAINT workspaces_created_by_fkey
  FOREIGN KEY (created_by)
  REFERENCES users(id)
  ON DELETE SET NULL;

-- 8. projects.created_by_id - Already NO ACTION, should SET NULL
ALTER TABLE projects
DROP CONSTRAINT IF EXISTS projects_created_by_id_fkey,
ADD CONSTRAINT projects_created_by_id_fkey
  FOREIGN KEY (created_by_id)
  REFERENCES user_profiles(id)
  ON DELETE SET NULL;

-- 9. projects.project_owner_id - Should SET NULL
ALTER TABLE projects
DROP CONSTRAINT IF EXISTS projects_project_owner_id_fkey,
ADD CONSTRAINT projects_project_owner_id_fkey
  FOREIGN KEY (project_owner_id)
  REFERENCES user_profiles(id)
  ON DELETE SET NULL;

-- ============================================================================
-- Verification Query
-- ============================================================================

-- Check all FK constraints with their delete rules
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
    AND tc.table_schema = 'public'
    AND (
        kcu.column_name = 'organization_id'
        OR ccu.table_name IN ('users', 'user_profiles')
    )
ORDER BY tc.table_name, kcu.column_name;
