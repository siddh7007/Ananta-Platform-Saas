-- Migration: Add is_default column to workspaces table
-- Date: 2025-12-14
-- Purpose: Enable default workspace deletion protection
-- Issue: workspaces.py references is_default column that doesn't exist

BEGIN;

-- Step 1: Add is_default column
ALTER TABLE workspaces
ADD COLUMN IF NOT EXISTS is_default boolean DEFAULT false;

-- Step 2: Set first workspace per organization as default
-- This ensures every organization has exactly one default workspace
WITH first_workspaces AS (
    SELECT DISTINCT ON (organization_id) id
    FROM workspaces
    ORDER BY organization_id, created_at ASC
)
UPDATE workspaces
SET is_default = true
WHERE id IN (SELECT id FROM first_workspaces);

-- Step 3: Add unique constraint (only one default per org)
-- This prevents multiple default workspaces in the same organization
CREATE UNIQUE INDEX IF NOT EXISTS idx_workspaces_org_default
ON workspaces (organization_id)
WHERE is_default = true;

-- Step 4: Add comment for documentation
COMMENT ON COLUMN workspaces.is_default IS
'Default workspace for organization. Only one default workspace allowed per org. Cannot be deleted. See workspaces.py:614 for deletion protection logic.';

COMMIT;

-- Verification queries:
-- SELECT organization_id, COUNT(*) as default_count FROM workspaces WHERE is_default = true GROUP BY organization_id;
-- Should return: Each org has exactly 1 default workspace
