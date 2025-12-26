-- Migration: 070_add_user_id_to_alerts.sql
-- Description: Add missing user_id column to alerts table for per-user alert tracking
-- Date: 2025-11-30
-- Fixes: API expects user_id column but it was missing from alerts table

-- ============================================================================
-- 1. Add user_id column to alerts table
-- ============================================================================
DO $$
BEGIN
    -- Add user_id column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'alerts' AND column_name = 'user_id'
    ) THEN
        ALTER TABLE alerts ADD COLUMN user_id UUID;

        -- Create index for user queries
        CREATE INDEX IF NOT EXISTS idx_alerts_user_id ON alerts(user_id);

        RAISE NOTICE 'Added user_id column to alerts table';
    END IF;
END $$;

-- ============================================================================
-- 2. Add foreign key constraint to users table
-- ============================================================================
DO $$
BEGIN
    -- Check if users table exists before adding FK
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_name = 'users' AND table_schema = 'public'
    ) THEN
        -- Add FK constraint if it doesn't exist
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints
            WHERE constraint_name = 'alerts_user_id_fkey' AND table_name = 'alerts'
        ) THEN
            ALTER TABLE alerts
            ADD CONSTRAINT alerts_user_id_fkey
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

            RAISE NOTICE 'Added foreign key constraint to users table';
        END IF;
    ELSE
        RAISE NOTICE 'Users table not found, skipping FK constraint';
    END IF;
EXCEPTION WHEN others THEN
    RAISE NOTICE 'Could not add FK constraint: %', SQLERRM;
END $$;

-- ============================================================================
-- 3. Update RLS policies for user-level access
-- ============================================================================
-- Drop existing user-based policies if they exist
DROP POLICY IF EXISTS "Users see own alerts" ON alerts;
DROP POLICY IF EXISTS "Users update own alerts" ON alerts;

-- Create new policies
CREATE POLICY "Users see own alerts" ON alerts
    FOR SELECT
    TO authenticated
    USING (
        user_id = auth.uid()
        OR organization_id = current_user_organization_id()
        OR is_super_admin()
    );

CREATE POLICY "Users update own alerts" ON alerts
    FOR UPDATE
    TO authenticated
    USING (
        user_id = auth.uid()
        OR organization_id = current_user_organization_id()
        OR is_super_admin()
    );

-- ============================================================================
-- 4. Comment
-- ============================================================================
COMMENT ON COLUMN alerts.user_id IS 'User ID for per-user alert tracking and read status';

-- ============================================================================
-- Verification
-- ============================================================================
DO $$
DECLARE
    col_exists BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'alerts' AND column_name = 'user_id'
    ) INTO col_exists;

    IF col_exists THEN
        RAISE NOTICE '✅ user_id column added to alerts table successfully';
    ELSE
        RAISE WARNING '❌ Failed to add user_id column to alerts table';
    END IF;
END $$;
