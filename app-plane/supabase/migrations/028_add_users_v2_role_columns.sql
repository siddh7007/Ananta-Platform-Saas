-- ============================================================================
-- Add Missing Columns to users_v2 for RBAC
-- ============================================================================
-- Purpose: Add role, tenant_id, and auth_subject columns required by RBAC system
-- ============================================================================

-- Add role column with constraint
ALTER TABLE public.users_v2
ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user'
CHECK (role IN ('super_admin', 'platform_admin', 'platform_user', 'org_admin', 'user'));

-- Add tenant_id (duplicate of organization_id for RBAC compatibility)
ALTER TABLE public.users_v2
ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants_v2(id) ON DELETE SET NULL;

-- Add auth_subject to link with auth.users
ALTER TABLE public.users_v2
ADD COLUMN IF NOT EXISTS auth_subject UUID;

-- Update existing users to have tenant_id match organization_id
UPDATE public.users_v2
SET tenant_id = organization_id
WHERE tenant_id IS NULL AND organization_id IS NOT NULL;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_v2_role ON public.users_v2(role);
CREATE INDEX IF NOT EXISTS idx_users_v2_tenant_id ON public.users_v2(tenant_id);
CREATE INDEX IF NOT EXISTS idx_users_v2_auth_subject ON public.users_v2(auth_subject);

COMMENT ON COLUMN public.users_v2.role IS 'User role: super_admin (full platform access), platform_admin, platform_user, org_admin (tenant admin), user (regular user)';
COMMENT ON COLUMN public.users_v2.tenant_id IS 'Tenant/organization ID - duplicate of organization_id for RBAC compatibility';
COMMENT ON COLUMN public.users_v2.auth_subject IS 'Links to auth.users.id for Supabase authentication';
