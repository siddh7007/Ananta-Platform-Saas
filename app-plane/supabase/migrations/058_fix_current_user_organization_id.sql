-- Migration 058: Fix current_user_organization_id() to read from JWT user_metadata
-- Issue: Function tried to read from session variables which aren't set by Supabase client
-- Solution: Read organization_id directly from JWT user_metadata (set by middleware)
-- Date: 2025-11-27
-- Fix: Middleware now adds organization_id to JWT user_metadata

-- Create or replace function that reads from JWT user_metadata
CREATE OR REPLACE FUNCTION current_user_organization_id()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
    org_id uuid;
BEGIN
    -- Try to get organization_id from JWT user_metadata (set by middleware)
    BEGIN
        org_id := (auth.jwt() -> 'user_metadata' ->> 'organization_id')::uuid;
        IF org_id IS NOT NULL THEN
            RETURN org_id;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        -- Continue to fallback
        NULL;
    END;

    -- Fallback 1: Get from users table by JWT sub (Supabase auth user ID)
    BEGIN
        SELECT u.organization_id INTO org_id
        FROM users u
        WHERE u.id = (auth.uid())::uuid
        LIMIT 1;

        IF org_id IS NOT NULL THEN
            RETURN org_id;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        -- Continue to fallback
        NULL;
    END;

    -- Fallback 2: Get from users table by email
    BEGIN
        SELECT u.organization_id INTO org_id
        FROM users u
        WHERE u.email = auth.jwt() ->> 'email'
        LIMIT 1;
    EXCEPTION WHEN OTHERS THEN
        -- Return NULL if all methods fail
        NULL;
    END;

    RETURN org_id;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION current_user_organization_id() TO anon;
GRANT EXECUTE ON FUNCTION current_user_organization_id() TO authenticated;
