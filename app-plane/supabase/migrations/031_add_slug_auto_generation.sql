-- ============================================================================
-- Migration: Add Automatic Slug Generation
-- ============================================================================
-- Created: 2025-11-19
-- Purpose: Auto-generate slugs from names for tenants and projects
-- Database: supabase
--
-- Changes:
-- 1. Create slugify() function to convert text to URL-safe slugs
-- 2. Add trigger to auto-generate slug for tenants_v2 when name is provided
-- 3. Add trigger to auto-generate slug for projects_v2 when name is provided
-- 4. Make slug columns nullable (will be auto-filled by trigger)
-- ============================================================================

-- ============================================================================
-- SECTION 1: Slugify Function
-- ============================================================================

CREATE OR REPLACE FUNCTION slugify(text_to_slug text)
RETURNS text AS $$
DECLARE
    slugged text;
BEGIN
    -- Convert to lowercase
    slugged := lower(text_to_slug);

    -- Replace spaces and underscores with hyphens
    slugged := regexp_replace(slugged, '[\s_]+', '-', 'g');

    -- Remove special characters (keep only alphanumeric and hyphens)
    slugged := regexp_replace(slugged, '[^a-z0-9\-]', '', 'g');

    -- Remove multiple consecutive hyphens
    slugged := regexp_replace(slugged, '-+', '-', 'g');

    -- Trim leading and trailing hyphens
    slugged := regexp_replace(slugged, '^-|-$', '', 'g');

    -- If slug is empty after cleaning, generate a UUID-based slug
    IF slugged IS NULL OR slugged = '' THEN
        slugged := 'entity-' || substring(gen_random_uuid()::text from 1 for 8);
    END IF;

    RETURN slugged;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================================
-- SECTION 2: Auto-Generate Slug for Tenants
-- ============================================================================

CREATE OR REPLACE FUNCTION auto_generate_tenant_slug()
RETURNS TRIGGER AS $$
BEGIN
    -- If slug is not provided or empty, generate from name
    IF NEW.slug IS NULL OR NEW.slug = '' THEN
        NEW.slug := slugify(NEW.name);

        -- Ensure uniqueness by appending number if needed
        DECLARE
            base_slug text := NEW.slug;
            counter integer := 1;
        BEGIN
            WHILE EXISTS (
                SELECT 1 FROM tenants_v2
                WHERE slug = NEW.slug
                  AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
            ) LOOP
                NEW.slug := base_slug || '-' || counter;
                counter := counter + 1;
            END LOOP;
        END;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_auto_generate_tenant_slug ON tenants_v2;
CREATE TRIGGER trigger_auto_generate_tenant_slug
    BEFORE INSERT OR UPDATE ON tenants_v2
    FOR EACH ROW
    EXECUTE FUNCTION auto_generate_tenant_slug();

-- ============================================================================
-- SECTION 3: Auto-Generate Slug for Projects
-- ============================================================================

CREATE OR REPLACE FUNCTION auto_generate_project_slug()
RETURNS TRIGGER AS $$
BEGIN
    -- If slug is not provided or empty, generate from name
    IF NEW.slug IS NULL OR NEW.slug = '' THEN
        NEW.slug := slugify(NEW.name);

        -- Ensure uniqueness within organization by appending number if needed
        DECLARE
            base_slug text := NEW.slug;
            counter integer := 1;
        BEGIN
            WHILE EXISTS (
                SELECT 1 FROM projects_v2
                WHERE slug = NEW.slug
                  AND organization_id = NEW.organization_id
                  AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
            ) LOOP
                NEW.slug := base_slug || '-' || counter;
                counter := counter + 1;
            END LOOP;
        END;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_auto_generate_project_slug ON projects_v2;
CREATE TRIGGER trigger_auto_generate_project_slug
    BEFORE INSERT OR UPDATE ON projects_v2
    FOR EACH ROW
    EXECUTE FUNCTION auto_generate_project_slug();

-- ============================================================================
-- SECTION 4: Make Slug Columns Nullable (Optional)
-- ============================================================================

-- Allow NULL slugs since triggers will fill them
-- Note: This is safe because triggers run BEFORE insert/update
-- Users can still provide custom slugs if desired

ALTER TABLE tenants_v2
ALTER COLUMN slug DROP NOT NULL;

ALTER TABLE projects_v2
ALTER COLUMN slug DROP NOT NULL;

-- ============================================================================
-- SECTION 5: Comments (Documentation)
-- ============================================================================

COMMENT ON FUNCTION slugify(text) IS
'Convert text to URL-safe slug: lowercase, hyphens, alphanumeric only.
Example: "Tesla Motors Inc." → "tesla-motors-inc"';

COMMENT ON FUNCTION auto_generate_tenant_slug() IS
'Auto-generate unique slug from tenant name if not provided.
Appends number if slug already exists.';

COMMENT ON FUNCTION auto_generate_project_slug() IS
'Auto-generate unique slug from project name if not provided.
Ensures uniqueness within organization by appending number if needed.';

-- ============================================================================
-- SECTION 6: Test & Verification
-- ============================================================================

-- Test slugify function
DO $$
DECLARE
    test_slug text;
BEGIN
    -- Test 1: Normal text
    test_slug := slugify('Tesla Motors Inc.');
    IF test_slug != 'tesla-motors-inc' THEN
        RAISE EXCEPTION 'Slugify test 1 failed: got %, expected tesla-motors-inc', test_slug;
    END IF;

    -- Test 2: Special characters
    test_slug := slugify('Project #1 (2025) - Version 2.0');
    IF test_slug != 'project-1-2025-version-20' THEN
        RAISE EXCEPTION 'Slugify test 2 failed: got %, expected project-1-2025-version-20', test_slug;
    END IF;

    -- Test 3: Multiple spaces and hyphens
    test_slug := slugify('My    Project---Name   Here');
    IF test_slug != 'my-project-name-here' THEN
        RAISE EXCEPTION 'Slugify test 3 failed: got %, expected my-project-name-here', test_slug;
    END IF;

    RAISE NOTICE '✅ All slugify() tests passed!';
END $$;

-- Verification
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_proc WHERE proname = 'slugify'
    ) THEN
        RAISE EXCEPTION 'Migration failed: slugify() function not created';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_proc WHERE proname = 'auto_generate_tenant_slug'
    ) THEN
        RAISE EXCEPTION 'Migration failed: auto_generate_tenant_slug() function not created';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_proc WHERE proname = 'auto_generate_project_slug'
    ) THEN
        RAISE EXCEPTION 'Migration failed: auto_generate_project_slug() function not created';
    END IF;

    RAISE NOTICE '✅ Migration 031 completed successfully';
    RAISE NOTICE '   - Created: slugify() function';
    RAISE NOTICE '   - Created: auto_generate_tenant_slug() trigger';
    RAISE NOTICE '   - Created: auto_generate_project_slug() trigger';
    RAISE NOTICE '   - Slugs now auto-generated from names if not provided';
END $$;

-- ============================================================================
-- USAGE EXAMPLES
-- ============================================================================

-- Example 1: Create tenant without slug (auto-generated)
-- INSERT INTO tenants_v2 (name) VALUES ('SpaceX Corporation');
-- Result: slug will be 'spacex-corporation'

-- Example 2: Create tenant with custom slug
-- INSERT INTO tenants_v2 (name, slug) VALUES ('SpaceX Corporation', 'spacex');
-- Result: slug will be 'spacex' (custom value respected)

-- Example 3: Create project without slug (auto-generated)
-- INSERT INTO projects_v2 (name, organization_id)
-- VALUES ('Starship Development', 'tenant-uuid-here');
-- Result: slug will be 'starship-development'

-- Example 4: Duplicate names get unique slugs
-- INSERT INTO tenants_v2 (name) VALUES ('ACME Corporation');
-- INSERT INTO tenants_v2 (name) VALUES ('ACME Corporation');
-- Result: First gets 'acme-corporation', second gets 'acme-corporation-1'
