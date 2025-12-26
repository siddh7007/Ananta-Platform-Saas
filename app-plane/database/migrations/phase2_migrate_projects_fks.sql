-- ============================================================================
-- Phase 2: Migrate Projects FKs from user_profiles to users
-- ============================================================================
-- Purpose: Move project ownership FK columns from user_profiles to users
-- Author: Claude Code
-- Date: 2025-12-20
--
-- This migration handles project ownership:
--   - projects.created_by_id
--   - projects.project_owner_id
--
-- These are slightly higher risk as they affect project ownership logic.
-- ============================================================================

BEGIN;

-- ============================================================================
-- STEP 1: Drop existing FK constraints referencing user_profiles
-- ============================================================================

ALTER TABLE projects
    DROP CONSTRAINT IF EXISTS projects_created_by_id_fkey;

ALTER TABLE projects
    DROP CONSTRAINT IF EXISTS projects_project_owner_id_fkey;

-- ============================================================================
-- STEP 2: Add new FK constraints pointing to users table with SET NULL
-- ============================================================================

ALTER TABLE projects
    ADD CONSTRAINT projects_created_by_id_fkey
    FOREIGN KEY (created_by_id) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE projects
    ADD CONSTRAINT projects_project_owner_id_fkey
    FOREIGN KEY (project_owner_id) REFERENCES users(id) ON DELETE SET NULL;

COMMIT;

-- ============================================================================
-- Verification
-- ============================================================================
-- SELECT tc.table_name, kcu.column_name, ccu.table_name AS references_table
-- FROM information_schema.table_constraints tc
-- JOIN information_schema.key_column_usage kcu
--   ON tc.constraint_name = kcu.constraint_name
-- JOIN information_schema.constraint_column_usage ccu
--   ON ccu.constraint_name = tc.constraint_name
-- WHERE tc.constraint_type = 'FOREIGN KEY'
--   AND tc.table_name = 'projects';
