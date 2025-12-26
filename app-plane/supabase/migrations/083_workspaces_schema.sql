-- Migration: 083_workspaces_schema.sql
-- Description: Create Workspace tables for Option B architecture
--
-- Architecture Change:
-- - Organization = billing/identity entity (company account)
-- - Workspace = project container within org (team-based access)
-- - Roles move from org level to workspace level
--
-- This is Phase 1: Non-breaking additions only

BEGIN;

-- ============================================================================
-- SECTION 1: Workspaces Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.workspaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,

    -- Identity
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    description TEXT,

    -- Settings
    is_default BOOLEAN DEFAULT false,  -- One default workspace per org
    settings JSONB DEFAULT '{}',

    -- Timestamps
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,  -- Soft delete

    -- Constraints
    CONSTRAINT unique_workspace_slug_per_org UNIQUE(organization_id, slug)
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_workspaces_org ON public.workspaces(organization_id);
CREATE INDEX IF NOT EXISTS idx_workspaces_default ON public.workspaces(organization_id) WHERE is_default = true;
CREATE INDEX IF NOT EXISTS idx_workspaces_slug ON public.workspaces(slug);

COMMENT ON TABLE public.workspaces IS
    'Workspaces are project containers within organizations. Users have roles per workspace.';

COMMENT ON COLUMN public.workspaces.is_default IS
    'The default workspace is created automatically when an organization is created.';


-- ============================================================================
-- SECTION 2: Workspace Memberships Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.workspace_memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

    -- Role within this workspace
    role TEXT NOT NULL DEFAULT 'viewer',

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Constraints
    CONSTRAINT unique_user_per_workspace UNIQUE(workspace_id, user_id),
    CONSTRAINT valid_workspace_role CHECK (role IN ('admin', 'engineer', 'analyst', 'viewer'))
);

-- Indexes for RLS and lookups
CREATE INDEX IF NOT EXISTS idx_ws_memberships_workspace ON public.workspace_memberships(workspace_id);
CREATE INDEX IF NOT EXISTS idx_ws_memberships_user ON public.workspace_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_ws_memberships_user_role ON public.workspace_memberships(user_id, role);

COMMENT ON TABLE public.workspace_memberships IS
    'Maps users to workspaces with roles. Replaces org-level roles for work/access control.';

COMMENT ON COLUMN public.workspace_memberships.role IS
    'Workspace roles: admin (full control), engineer (create/edit), analyst (read-only), viewer (list only)';


-- ============================================================================
-- SECTION 3: Workspace Invitations Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.workspace_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,

    -- Invitation details
    email TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'viewer',
    token TEXT NOT NULL UNIQUE,

    -- Tracking
    invited_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    accepted_at TIMESTAMPTZ,
    accepted_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    revoked_at TIMESTAMPTZ,

    -- Constraints
    CONSTRAINT valid_ws_invite_role CHECK (role IN ('admin', 'engineer', 'analyst', 'viewer'))
);

-- Indexes for fast lookup
CREATE INDEX IF NOT EXISTS idx_ws_invitations_workspace ON public.workspace_invitations(workspace_id);
CREATE INDEX IF NOT EXISTS idx_ws_invitations_email ON public.workspace_invitations(email);
CREATE INDEX IF NOT EXISTS idx_ws_invitations_token ON public.workspace_invitations(token);
-- Partial index for filtering pending invitations (expiration checked at query time)
CREATE INDEX IF NOT EXISTS idx_ws_invitations_pending ON public.workspace_invitations(workspace_id, expires_at)
    WHERE accepted_at IS NULL AND revoked_at IS NULL;

-- Partial unique index for ON CONFLICT in invitation upsert
-- Only one pending invitation per workspace+email combination
CREATE UNIQUE INDEX IF NOT EXISTS idx_ws_invitations_pending_unique
    ON public.workspace_invitations(workspace_id, email)
    WHERE accepted_at IS NULL AND revoked_at IS NULL;

COMMENT ON TABLE public.workspace_invitations IS
    'Pending workspace invitations. Users accept to join a workspace with the specified role.';


-- ============================================================================
-- SECTION 4: Add workspace_id to projects (nullable for now)
-- ============================================================================

ALTER TABLE public.projects
    ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_projects_workspace ON public.projects(workspace_id);

COMMENT ON COLUMN public.projects.workspace_id IS
    'Workspace this project belongs to. Will be required after migration.';


-- ============================================================================
-- SECTION 5: Add last_workspace_id to user_preferences
-- ============================================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'user_preferences'
        AND column_name = 'last_workspace_id'
    ) THEN
        ALTER TABLE public.user_preferences
            ADD COLUMN last_workspace_id UUID REFERENCES public.workspaces(id) ON DELETE SET NULL;
    END IF;
END $$;

COMMENT ON COLUMN public.user_preferences.last_workspace_id IS
    'Last active workspace for quick context restoration.';


-- ============================================================================
-- SECTION 6: Helper Functions
-- ============================================================================

-- Get all workspace IDs user is member of
CREATE OR REPLACE FUNCTION get_user_workspace_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT workspace_id
    FROM workspace_memberships
    WHERE user_id = get_current_user_id()
$$;

COMMENT ON FUNCTION get_user_workspace_ids() IS
    'Returns all workspace UUIDs the current user is a member of. Used in RLS policies.';


-- Get user role in specific workspace
CREATE OR REPLACE FUNCTION get_role_in_workspace(p_workspace_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT role FROM workspace_memberships
    WHERE user_id = get_current_user_id()
    AND workspace_id = p_workspace_id
    LIMIT 1
$$;

COMMENT ON FUNCTION get_role_in_workspace(uuid) IS
    'Returns the user role in the specified workspace (admin, engineer, analyst, viewer).';


-- Check if user is workspace admin
CREATE OR REPLACE FUNCTION is_workspace_admin(p_workspace_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM workspace_memberships
        WHERE user_id = get_current_user_id()
        AND workspace_id = p_workspace_id
        AND role = 'admin'
    )
$$;

COMMENT ON FUNCTION is_workspace_admin(uuid) IS
    'Returns true if current user is admin of the specified workspace.';


-- Check if user is member of workspace
CREATE OR REPLACE FUNCTION is_workspace_member(p_workspace_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM workspace_memberships
        WHERE user_id = get_current_user_id()
        AND workspace_id = p_workspace_id
    )
$$;

COMMENT ON FUNCTION is_workspace_member(uuid) IS
    'Returns true if current user is a member of the specified workspace.';


-- Get current workspace ID from header or preferences
CREATE OR REPLACE FUNCTION current_workspace_id()
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_ws_id UUID;
    v_header_ws TEXT;
BEGIN
    -- Try to get workspace from request header (X-Workspace-ID)
    BEGIN
        v_header_ws := current_setting('request.headers', true)::json ->> 'x-workspace-id';
        IF v_header_ws IS NOT NULL AND v_header_ws != '' THEN
            v_ws_id := v_header_ws::UUID;
            -- Verify user is member
            IF is_workspace_member(v_ws_id) OR is_super_admin() THEN
                RETURN v_ws_id;
            END IF;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        NULL;  -- Ignore header parsing errors
    END;

    -- Fall back to user's last active workspace
    SELECT last_workspace_id INTO v_ws_id
    FROM user_preferences
    WHERE user_id = get_current_user_id();

    -- Verify membership
    IF v_ws_id IS NOT NULL AND (is_workspace_member(v_ws_id) OR is_super_admin()) THEN
        RETURN v_ws_id;
    END IF;

    -- Last resort: return first workspace user is member of
    SELECT workspace_id INTO v_ws_id
    FROM workspace_memberships
    WHERE user_id = get_current_user_id()
    ORDER BY created_at
    LIMIT 1;

    RETURN v_ws_id;
END;
$$;

COMMENT ON FUNCTION current_workspace_id() IS
    'Gets current workspace from header, user prefs, or first membership. Used for context resolution.';


-- ============================================================================
-- SECTION 7: Trigger for updated_at
-- ============================================================================

-- Workspaces updated_at trigger
CREATE OR REPLACE FUNCTION update_workspaces_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_workspaces_timestamp ON workspaces;
CREATE TRIGGER set_workspaces_timestamp
    BEFORE UPDATE ON workspaces
    FOR EACH ROW
    EXECUTE FUNCTION update_workspaces_timestamp();

-- Workspace memberships updated_at trigger
DROP TRIGGER IF EXISTS set_ws_memberships_timestamp ON workspace_memberships;
CREATE TRIGGER set_ws_memberships_timestamp
    BEFORE UPDATE ON workspace_memberships
    FOR EACH ROW
    EXECUTE FUNCTION update_workspaces_timestamp();


-- ============================================================================
-- SECTION 8: Function to Create Workspace with Admin
-- ============================================================================

CREATE OR REPLACE FUNCTION create_workspace_with_admin(
    p_organization_id UUID,
    p_name TEXT,
    p_user_id UUID,
    p_slug TEXT DEFAULT NULL,
    p_is_default BOOLEAN DEFAULT false
)
RETURNS TABLE (
    workspace_id UUID,
    workspace_slug TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_ws_id UUID;
    v_slug TEXT;
BEGIN
    -- Generate slug if not provided
    v_slug := COALESCE(
        p_slug,
        LOWER(REGEXP_REPLACE(p_name, '[^a-zA-Z0-9]', '-', 'g')) || '-' || SUBSTRING(gen_random_uuid()::text, 1, 8)
    );

    -- Create workspace
    INSERT INTO workspaces (organization_id, name, slug, is_default, created_by)
    VALUES (p_organization_id, p_name, v_slug, p_is_default, p_user_id)
    RETURNING id INTO v_ws_id;

    -- Add user as admin
    INSERT INTO workspace_memberships (workspace_id, user_id, role)
    VALUES (v_ws_id, p_user_id, 'admin');

    -- Set as user's last workspace if this is default
    IF p_is_default THEN
        INSERT INTO user_preferences (user_id, last_workspace_id)
        VALUES (p_user_id, v_ws_id)
        ON CONFLICT (user_id)
        DO UPDATE SET last_workspace_id = v_ws_id, updated_at = NOW();
    END IF;

    RETURN QUERY SELECT v_ws_id, v_slug;
END;
$$;

COMMENT ON FUNCTION create_workspace_with_admin IS
    'Creates a workspace and adds the specified user as admin. Used during org creation.';


-- ============================================================================
-- SECTION 9: Grants
-- ============================================================================

-- Grant execute on functions
GRANT EXECUTE ON FUNCTION get_user_workspace_ids() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_role_in_workspace(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION is_workspace_admin(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION is_workspace_member(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION current_workspace_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION create_workspace_with_admin(uuid, text, uuid, text, boolean) TO service_role;

-- Grant table access
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspaces TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspace_memberships TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspace_invitations TO authenticated;

GRANT ALL ON public.workspaces TO service_role;
GRANT ALL ON public.workspace_memberships TO service_role;
GRANT ALL ON public.workspace_invitations TO service_role;


COMMIT;

-- ============================================================================
-- POST-MIGRATION NOTES
-- ============================================================================
--
-- This migration creates the workspace schema WITHOUT breaking existing code.
--
-- Next steps (Migration 084):
-- 1. Create default workspace for each existing organization
-- 2. Migrate org members to their default workspace
-- 3. Update existing projects to belong to default workspace
--
-- After data migration (Migration 085):
-- 1. Add RLS policies for workspace tables
-- 2. Update project RLS to use workspace memberships
--
-- Then update API:
-- 1. auth_provisioning.py - create workspace on signup
-- 2. Add workspace CRUD endpoints
-- 3. Add X-Workspace-ID header handling
