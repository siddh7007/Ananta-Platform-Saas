-- Migration: Fix workspace_members role constraint
-- Date: 2025-12-14
-- Purpose: Align database constraint with code expectations
-- Issue: Code expects 'engineer'/'analyst', DB only allows 'owner'/'admin'/'member'/'viewer'

BEGIN;

-- Step 1: Drop existing constraint
ALTER TABLE workspace_members
DROP CONSTRAINT IF EXISTS workspace_members_role_check;

-- Step 2: Add new constraint matching code expectations
-- Aligns with CBP role hierarchy: admin > engineer > analyst > viewer
ALTER TABLE workspace_members
ADD CONSTRAINT workspace_members_role_check
CHECK (role = ANY (ARRAY['admin'::text, 'engineer'::text, 'analyst'::text, 'viewer'::text]));

-- Step 3: Migrate existing data
-- Update 'owner' to 'admin' (equivalent in workspace context)
UPDATE workspace_members
SET role = 'admin'
WHERE role = 'owner';

-- Update 'member' to 'engineer' (closest equivalent)
-- Change to 'viewer' if read-only access is more appropriate
UPDATE workspace_members
SET role = 'engineer'
WHERE role = 'member';

-- Step 4: Add comment for documentation
COMMENT ON COLUMN workspace_members.role IS
'Workspace role: admin (full access), engineer (can manage BOMs), analyst (read-only), viewer (basic read). See workspaces.py:97 for validation pattern.';

COMMIT;

-- Verification queries:
-- SELECT role, COUNT(*) FROM workspace_members GROUP BY role;
-- Should only show: admin, engineer, analyst, viewer

-- SELECT * FROM workspace_members WHERE role NOT IN ('admin', 'engineer', 'analyst', 'viewer');
-- Should return: 0 rows
