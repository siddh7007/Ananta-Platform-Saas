-- ============================================================================
-- Phase 1: Migrate Easy Attribution FKs from user_profiles to users
-- ============================================================================
-- Purpose: Move low-risk "who did it" FK columns from user_profiles to users
-- Author: Claude Code
-- Date: 2025-12-20
--
-- This migration handles the easiest columns first:
--   - bom_uploads.uploaded_by
--   - boms.created_by_id
--   - component_alternatives.verified_by
--   - component_tags.created_by
--   - vendor_category_mappings.verified_by
--
-- All are attribution/audit fields with SET NULL behavior.
-- ============================================================================

BEGIN;

-- ============================================================================
-- STEP 1: Drop existing FK constraints referencing user_profiles
-- ============================================================================

ALTER TABLE bom_uploads
    DROP CONSTRAINT IF EXISTS bom_uploads_uploaded_by_fkey;

ALTER TABLE boms
    DROP CONSTRAINT IF EXISTS boms_created_by_id_fkey;

ALTER TABLE component_alternatives
    DROP CONSTRAINT IF EXISTS component_alternatives_verified_by_fkey;

ALTER TABLE component_tags
    DROP CONSTRAINT IF EXISTS component_tags_created_by_fkey;

ALTER TABLE vendor_category_mappings
    DROP CONSTRAINT IF EXISTS vendor_category_mappings_verified_by_fkey;

-- ============================================================================
-- STEP 2: Add new FK constraints pointing to users table with SET NULL
-- ============================================================================

ALTER TABLE bom_uploads
    ADD CONSTRAINT bom_uploads_uploaded_by_fkey
    FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE boms
    ADD CONSTRAINT boms_created_by_id_fkey
    FOREIGN KEY (created_by_id) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE component_alternatives
    ADD CONSTRAINT component_alternatives_verified_by_fkey
    FOREIGN KEY (verified_by) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE component_tags
    ADD CONSTRAINT component_tags_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE vendor_category_mappings
    ADD CONSTRAINT vendor_category_mappings_verified_by_fkey
    FOREIGN KEY (verified_by) REFERENCES users(id) ON DELETE SET NULL;

COMMIT;

-- ============================================================================
-- Verification queries (run after migration)
-- ============================================================================
-- SELECT tc.table_name, kcu.column_name, ccu.table_name AS references_table
-- FROM information_schema.table_constraints tc
-- JOIN information_schema.key_column_usage kcu
--   ON tc.constraint_name = kcu.constraint_name
-- JOIN information_schema.constraint_column_usage ccu
--   ON ccu.constraint_name = tc.constraint_name
-- WHERE tc.constraint_type = 'FOREIGN KEY'
--   AND tc.table_name IN ('bom_uploads', 'boms', 'component_alternatives',
--                         'component_tags', 'vendor_category_mappings');
