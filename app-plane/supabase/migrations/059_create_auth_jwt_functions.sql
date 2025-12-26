-- Migration 059: Create auth.jwt() and auth.uid() functions for PostgREST
-- These functions access JWT claims provided by PostgREST via request.jwt.claims
-- Date: 2025-11-27

-- Create auth.jwt() function that returns the full JWT claims as JSONB
CREATE OR REPLACE FUNCTION auth.jwt()
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
    SELECT COALESCE(
        current_setting('request.jwt.claims', true)::jsonb,
        '{}'::jsonb
    );
$$;

-- Create auth.uid() function that returns the user ID from JWT sub claim
CREATE OR REPLACE FUNCTION auth.uid()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
    SELECT COALESCE(
        current_setting('request.jwt.claims', true)::jsonb ->> 'sub',
        NULL
    )::uuid;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION auth.jwt() TO anon;
GRANT EXECUTE ON FUNCTION auth.jwt() TO authenticated;
GRANT EXECUTE ON FUNCTION auth.jwt() TO service_role;

GRANT EXECUTE ON FUNCTION auth.uid() TO anon;
GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;
GRANT EXECUTE ON FUNCTION auth.uid() TO service_role;

COMMENT ON FUNCTION auth.jwt() IS 'Returns JWT claims from PostgREST request.jwt.claims setting';
COMMENT ON FUNCTION auth.uid() IS 'Returns user ID (sub claim) from JWT';
