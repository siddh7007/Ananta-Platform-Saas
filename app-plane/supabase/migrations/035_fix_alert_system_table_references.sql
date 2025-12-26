-- Fix Alert System Table References
-- Migration 016 referenced 'organizations' table which is now 'tenants'
-- Created: 2025-11-19

-- ============================================================================
-- Fix alert_preferences foreign key
-- ============================================================================

-- Drop old constraint if it exists
ALTER TABLE IF EXISTS alert_preferences
  DROP CONSTRAINT IF EXISTS alert_preferences_organization_id_fkey;

-- Add correct constraint referencing tenants table
ALTER TABLE IF EXISTS alert_preferences
  ADD CONSTRAINT alert_preferences_organization_id_fkey
  FOREIGN KEY (organization_id) REFERENCES tenants(id) ON DELETE CASCADE;

-- ============================================================================
-- Verification
-- ============================================================================

-- Check constraint
SELECT
  conname AS constraint_name,
  conrelid::regclass AS table_name,
  confrelid::regclass AS referenced_table
FROM pg_constraint
WHERE conname = 'alert_preferences_organization_id_fkey';

-- Summary
SELECT
  'Alert system foreign keys fixed' as status,
  'alert_preferences now correctly references tenants table' as detail;
