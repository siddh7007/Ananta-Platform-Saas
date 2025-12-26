-- ============================================================================
-- Minimal Schema for BOM Uploads (Emergency Bootstrap)
-- ============================================================================
-- Purpose: Create minimal required tables for bom_uploads system to function
-- This is a temporary bootstrap until full migrations are properly applied
-- ============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- Core Tables (Minimal)
-- ============================================================================

-- Tenants (Organizations)
CREATE TABLE IF NOT EXISTS public.tenants_v2 (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Projects
CREATE TABLE IF NOT EXISTS public.projects_v2 (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    organization_id UUID NOT NULL REFERENCES public.tenants_v2(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(organization_id, slug)
);

-- Users (standalone - no auth.users dependency for now)
CREATE TABLE IF NOT EXISTS public.users_v2 (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    organization_id UUID REFERENCES public.tenants_v2(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Default test tenant and project
INSERT INTO public.tenants_v2 (id, name, slug)
VALUES ('a1111111-1111-1111-1111-111111111111'::uuid, 'Default Organization', 'default-org')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.projects_v2 (id, name, slug, organization_id)
VALUES ('b1111111-1111-1111-1111-111111111111'::uuid, 'Default Project', 'default-project', 'a1111111-1111-1111-1111-111111111111'::uuid)
ON CONFLICT (id) DO NOTHING;

-- Add RLS policies (simple version - disable for now until Supabase auth is properly set up)
-- ALTER TABLE public.tenants_v2 ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.projects_v2 ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.users_v2 ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.tenants_v2 IS 'Minimal bootstrap version - will be replaced by full RBAC migration';
COMMENT ON TABLE public.projects_v2 IS 'Minimal bootstrap version - will be replaced by full RBAC migration';
COMMENT ON TABLE public.users_v2 IS 'Minimal bootstrap version - will be replaced by full RBAC migration';
