-- Migration 060: Fix is_super_admin() to read from JWT instead of session variables
-- Issue: Function still reads from app.user_role session variable which isn't set
-- Solution: Read from JWT user_metadata.role
-- Date: 2025-11-27

-- Update is_super_admin() to read role from JWT
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS boolean
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    user_role text;
BEGIN
    -- Try to get role from JWT user_metadata (set by middleware)
    BEGIN
        user_role := auth.jwt() -> 'user_metadata' ->> 'role';
        IF user_role IS NOT NULL AND user_role = 'super_admin' THEN
            RETURN true;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        -- Continue to fallback
        NULL;
    END;

    -- Fallback: Check users table by JWT sub
    BEGIN
        SELECT u.role INTO user_role
        FROM users u
        WHERE u.id = (auth.uid())::uuid
        LIMIT 1;

        IF user_role = 'super_admin' THEN
            RETURN true;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        -- Continue to fallback
        NULL;
    END;

    -- Fallback 2: Check by email
    BEGIN
        SELECT u.role INTO user_role
        FROM users u
        WHERE u.email = auth.jwt() ->> 'email'
        LIMIT 1;

        IF user_role = 'super_admin' THEN
            RETURN true;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        NULL;
    END;

    RETURN false;
END;
$$;

COMMENT ON FUNCTION is_super_admin() IS 'Returns true if current user role is super_admin based on JWT user_metadata or database lookup';
