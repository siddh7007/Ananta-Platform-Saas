-- Migration: Allow anon role to read enrichment_events
-- Description: Permit anon role to SELECT from enrichment_events for Customer Portal
-- Date: 2025-11-17
--
-- Issue: Customer Portal uses anon key but RLS blocks queries without JWT tenant_id
-- Solution: Add permissive policy for anon role (development/testing)

-- ============================================================================
-- Add RLS policy for anon role
-- ============================================================================

-- Allow anon role to read all enrichment events
-- Note: This is permissive for development. In production, you may want to
-- restrict this by adding WHERE clauses or using authenticated users.
CREATE POLICY IF NOT EXISTS "Allow anon to read enrichment events"
    ON enrichment_events
    FOR SELECT
    TO anon
    USING (true);

-- ============================================================================
-- Add comment for documentation
-- ============================================================================

COMMENT ON POLICY "Allow anon to read enrichment events" ON enrichment_events IS
'Development policy: Allows anon role to read enrichment events. Restrict in production.';
