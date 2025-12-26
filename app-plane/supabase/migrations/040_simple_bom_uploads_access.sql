-- Simple bom_uploads access (temporary - for development)
-- Created: 2025-11-19
-- Purpose: Allow BOM uploads to work while we fix RLS properly

-- Drop all existing policies
DROP POLICY IF EXISTS "Users can view own org uploads" ON public.bom_uploads;
DROP POLICY IF EXISTS "Users can insert own org uploads" ON public.bom_uploads;
DROP POLICY IF EXISTS "Users can update own org uploads" ON public.bom_uploads;
DROP POLICY IF EXISTS "Service role full access" ON public.bom_uploads;
DROP POLICY IF EXISTS "Anon can insert uploads" ON public.bom_uploads;
DROP POLICY IF EXISTS "Allow all access" ON public.bom_uploads;

-- Keep RLS enabled
ALTER TABLE public.bom_uploads ENABLE ROW LEVEL SECURITY;

-- Create simple policy: allow all operations for authenticated and anon users
CREATE POLICY "Allow all access"
ON public.bom_uploads FOR ALL
TO public
USING (true)
WITH CHECK (true);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bom_uploads TO anon, authenticated;

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'BOM uploads access granted to all users (temporary for development)';
END $$;
