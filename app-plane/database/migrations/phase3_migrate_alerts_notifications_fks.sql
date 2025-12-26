-- ============================================================================
-- Phase 3: Migrate Alerts & Notifications FKs from user_profiles to users
-- ============================================================================
-- Purpose: Move user-centric FK columns from user_profiles to users
-- Author: Claude Code
-- Date: 2025-12-20
--
-- This migration handles user-centric tables:
--   - alerts.user_id
--   - notifications.user_id (currently CASCADE - preserving behavior)
--
-- Higher risk as these affect notification/alert delivery.
-- ============================================================================

BEGIN;

-- ============================================================================
-- STEP 1: Drop existing FK constraints referencing user_profiles
-- ============================================================================

ALTER TABLE alerts
    DROP CONSTRAINT IF EXISTS alerts_user_id_fkey;

ALTER TABLE notifications
    DROP CONSTRAINT IF EXISTS notifications_user_id_fkey;

-- ============================================================================
-- STEP 2: Add new FK constraints pointing to users table
-- ============================================================================

-- Alerts: SET NULL - alert is preserved even if user is deleted
ALTER TABLE alerts
    ADD CONSTRAINT alerts_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;

-- Notifications: CASCADE - delete notifications when user is deleted
-- (preserving original behavior)
ALTER TABLE notifications
    ADD CONSTRAINT notifications_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

COMMIT;

-- ============================================================================
-- Verification
-- ============================================================================
-- SELECT tc.table_name, kcu.column_name, ccu.table_name AS references_table,
--        rc.delete_rule
-- FROM information_schema.table_constraints tc
-- JOIN information_schema.key_column_usage kcu
--   ON tc.constraint_name = kcu.constraint_name
-- JOIN information_schema.constraint_column_usage ccu
--   ON ccu.constraint_name = tc.constraint_name
-- JOIN information_schema.referential_constraints rc
--   ON tc.constraint_name = rc.constraint_name
-- WHERE tc.constraint_type = 'FOREIGN KEY'
--   AND tc.table_name IN ('alerts', 'notifications');
