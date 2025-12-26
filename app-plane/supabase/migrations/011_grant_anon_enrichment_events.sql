-- Migration: Grant anon role access to enrichment_events for Realtime
-- Description: Allow anonymous role to SELECT from enrichment_events (RLS will still filter)
-- Date: 2025-11-10
--
-- Issue: Frontend Realtime subscriptions use anon key but table only granted to authenticated
-- Solution: Grant SELECT to anon role, RLS policies will still enforce security

-- ============================================================================
-- Grant SELECT to anon role for enrichment_events
-- ============================================================================

-- Grant SELECT permission to anon role
-- Note: RLS policies will still filter what data is visible based on JWT claims
GRANT SELECT ON enrichment_events TO anon;

-- Grant SELECT on the view as well
GRANT SELECT ON recent_enrichment_activity TO anon;

-- Grant EXECUTE on helper functions to anon
GRANT EXECUTE ON FUNCTION get_latest_enrichment_state(UUID) TO anon;
GRANT EXECUTE ON FUNCTION get_enrichment_summary(UUID) TO anon;

-- ============================================================================
-- Update RLS policies to work with anon role
-- ============================================================================

-- Note: The existing RLS policies check JWT claims via auth.jwt()
-- This works for both authenticated and anon roles as long as the JWT is present

-- The anon role will still be subject to RLS filtering:
-- 1. Customer users can only see their tenant's events (tenant_id match)
-- 2. Staff users can see all events (role = 'staff')
-- 3. Unauthenticated anon requests (no JWT) will see nothing (RLS will filter all)

-- ============================================================================
-- Add comment for documentation
-- ============================================================================

COMMENT ON TABLE enrichment_events IS 'Real-time enrichment progress events. Accessible via anon role for Realtime subscriptions, but RLS policies filter data by tenant_id and role.';
