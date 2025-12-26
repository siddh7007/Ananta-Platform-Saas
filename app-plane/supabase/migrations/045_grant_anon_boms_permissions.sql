-- Migration: Grant anon role permissions on boms table
-- Date: 2025-11-19
-- Issue: Customer Portal could not insert BOMs due to missing permissions on 'source' column

-- Grant table-level permissions to anon and authenticated roles
GRANT SELECT, INSERT, UPDATE ON public.boms TO anon;
GRANT SELECT, INSERT, UPDATE ON public.boms TO authenticated;

-- Verify RLS policies are in place (should already exist from previous migrations)
-- RLS policies control which rows users can see/modify
-- Table-level grants control which operations are allowed

-- Note: This migration fixes the "Column 'source' of relation 'boms' does not exist" error
-- The error occurred because anon role had no table-level permissions, even though
-- the column existed and RLS policies were in place.
