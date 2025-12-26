-- Migration: Grant service_role permissions on enrichment_events
-- Description: Fix permission denied error when Temporal worker publishes events
-- Date: 2025-11-15
--
-- Issue: Service role has INSERT policy but missing base table GRANT
-- Error: {'code': '42501', 'message': 'permission denied for table enrichment_events'}
-- Solution: Grant INSERT and UPDATE permissions to service_role

-- ============================================================================
-- Grant INSERT and UPDATE permissions to service_role
-- ============================================================================

-- Grant INSERT permission (for publishing new events)
GRANT INSERT ON enrichment_events TO service_role;

-- Grant UPDATE permission (for potential event corrections/updates)
GRANT UPDATE ON enrichment_events TO service_role;

-- Grant SELECT permission (for debugging/verification)
GRANT SELECT ON enrichment_events TO service_role;

-- ============================================================================
-- Verify the grant worked
-- ============================================================================

-- You can verify permissions with:
-- SELECT grantee, privilege_type
-- FROM information_schema.role_table_grants
-- WHERE table_name = 'enrichment_events'
--   AND grantee = 'service_role';
--
-- Expected output:
-- grantee       | privilege_type
-- --------------+---------------
-- service_role  | INSERT
-- service_role  | UPDATE
-- service_role  | SELECT

-- ============================================================================
-- Background
-- ============================================================================

-- The enrichment_events table was created with RLS policies in migration 010:
-- - Policy "Service role can insert enrichment events" (FOR INSERT, WITH CHECK true)
-- - This policy allows service role to insert, but the base table permission was missing
--
-- RLS policies control row-level access, but GRANT controls table-level access.
-- Both are required for the service role to successfully insert events.
--
-- The Temporal worker uses the service role key to publish events to Supabase
-- during BOM enrichment workflows. This grant fixes the 42501 permission error.

-- ============================================================================
-- Add comment for documentation
-- ============================================================================

COMMENT ON TABLE enrichment_events IS 'Real-time enrichment progress events. Service role can INSERT/UPDATE for workflow event publishing. RLS policies filter SELECT by tenant_id and role.';