-- Migration 086: Fix slugify function schema resolution
-- Issue: auto_generate_tenant_slug() has SET search_path TO '' but calls slugify()
-- without schema prefix, causing "function slugify(text) does not exist" error
-- Fix: Qualify all function/table calls with public. prefix
-- Created: 2025-12-02

-- Fix auto_generate_tenant_slug to use schema-qualified references
CREATE OR REPLACE FUNCTION public.auto_generate_tenant_slug()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $function$
BEGIN
    IF NEW.slug IS NULL OR NEW.slug = '' THEN
        NEW.slug := public.slugify(NEW.name);
        DECLARE
            base_slug text := NEW.slug;
            counter integer := 1;
        BEGIN
            WHILE EXISTS (
                SELECT 1 FROM public.organizations
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
$function$;

-- Also fix auto_generate_workspace_slug if it has the same issue
CREATE OR REPLACE FUNCTION public.auto_generate_workspace_slug()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $function$
BEGIN
    IF NEW.slug IS NULL OR NEW.slug = '' THEN
        NEW.slug := public.slugify(NEW.name);
        DECLARE
            base_slug text := NEW.slug;
            counter integer := 1;
        BEGIN
            WHILE EXISTS (
                SELECT 1 FROM public.workspaces
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
$function$;

COMMENT ON FUNCTION public.auto_generate_tenant_slug() IS 'Auto-generates slug for organizations with schema-qualified function calls';
COMMENT ON FUNCTION public.auto_generate_workspace_slug() IS 'Auto-generates slug for workspaces with schema-qualified function calls';

-- Fix create_default_alert_preferences to use schema-qualified table reference
-- Note: Uses NOT EXISTS instead of ON CONFLICT because alert_preferences has a partial unique index
-- (WHERE user_id IS NOT NULL) which doesn't work with ON CONFLICT
CREATE OR REPLACE FUNCTION public.create_default_alert_preferences()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  org_id UUID;
BEGIN
  -- Get user's organization ID (assuming it's in user_metadata)
  org_id := (NEW.raw_user_meta_data->>'organization_id')::UUID;

  IF org_id IS NOT NULL THEN
    -- Create default preferences for each alert type (use schema-qualified table name)
    -- Use NOT EXISTS instead of ON CONFLICT because partial unique index doesn't support ON CONFLICT
    INSERT INTO public.alert_preferences (user_id, organization_id, alert_type, email_enabled, in_app_enabled)
    SELECT NEW.id, org_id, alert_type, TRUE, TRUE
    FROM unnest(ARRAY['LIFECYCLE', 'RISK', 'COMPLIANCE']) AS alert_type
    WHERE NOT EXISTS (
      SELECT 1 FROM public.alert_preferences ap
      WHERE ap.user_id = NEW.id
        AND ap.organization_id = org_id
        AND ap.alert_type = alert_type
    );
  END IF;

  RETURN NEW;
END;
$function$;

COMMENT ON FUNCTION public.create_default_alert_preferences() IS 'Creates default alert preferences for new auth.users with schema-qualified table references';
