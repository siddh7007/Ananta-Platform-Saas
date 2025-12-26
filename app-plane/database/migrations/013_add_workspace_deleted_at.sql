-- Migration: Add deleted_at column for soft delete
-- Date: 2025-12-14
-- Purpose: Enable soft delete functionality for workspaces
-- Issue: Code references deleted_at in WHERE clauses but column doesn't exist

BEGIN;

-- Step 1: Add deleted_at column
ALTER TABLE workspaces
ADD COLUMN IF NOT EXISTS deleted_at timestamp with time zone DEFAULT NULL;

-- Step 2: Add index for active workspaces (most common query)
-- Partial index only on NULL values for better performance
CREATE INDEX IF NOT EXISTS idx_workspaces_deleted_at
ON workspaces (deleted_at)
WHERE deleted_at IS NULL;

-- Step 3: Add index for deleted workspaces (for cleanup queries)
CREATE INDEX IF NOT EXISTS idx_workspaces_deleted_at_not_null
ON workspaces (deleted_at)
WHERE deleted_at IS NOT NULL;

-- Step 4: Add comment for documentation
COMMENT ON COLUMN workspaces.deleted_at IS
'Soft delete timestamp. NULL = active workspace, NOT NULL = deleted. See workspaces.py:621 for soft delete implementation.';

COMMIT;

-- Verification queries:
-- SELECT COUNT(*) FROM workspaces WHERE deleted_at IS NULL; -- Active workspaces
-- SELECT COUNT(*) FROM workspaces WHERE deleted_at IS NOT NULL; -- Deleted workspaces (should be 0 after migration)
