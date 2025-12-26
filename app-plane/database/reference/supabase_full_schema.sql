--
-- PostgreSQL database dump
--

-- Dumped from database version 15.1 (Ubuntu 15.1-1.pgdg20.04+1)
-- Dumped by pg_dump version 15.4 (Ubuntu 15.4-1.pgdg20.04+1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: auth; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA auth;


--
-- Name: extensions; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA extensions;


--
-- Name: SCHEMA extensions; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA extensions IS 'Schema for PostgreSQL extensions (pgcrypto, pg_trgm, etc.)';


--
-- Name: realtime; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA realtime;


--
-- Name: storage; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA storage;


--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- Name: aal_level; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.aal_level AS ENUM (
    'aal1',
    'aal2',
    'aal3'
);


--
-- Name: code_challenge_method; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.code_challenge_method AS ENUM (
    's256',
    'plain'
);


--
-- Name: factor_status; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.factor_status AS ENUM (
    'unverified',
    'verified'
);


--
-- Name: factor_type; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.factor_type AS ENUM (
    'totp',
    'webauthn'
);


--
-- Name: aal_level; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.aal_level AS ENUM (
    'aal1',
    'aal2',
    'aal3'
);


--
-- Name: code_challenge_method; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.code_challenge_method AS ENUM (
    's256',
    'plain'
);


--
-- Name: factor_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.factor_status AS ENUM (
    'unverified',
    'verified'
);


--
-- Name: factor_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.factor_type AS ENUM (
    'totp',
    'webauthn'
);


--
-- Name: invoice_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.invoice_status AS ENUM (
    'draft',
    'open',
    'paid',
    'void',
    'uncollectible'
);


--
-- Name: payment_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.payment_status AS ENUM (
    'pending',
    'processing',
    'succeeded',
    'failed',
    'refunded',
    'partially_refunded',
    'disputed',
    'canceled'
);


--
-- Name: subscription_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.subscription_status AS ENUM (
    'trialing',
    'active',
    'past_due',
    'canceled',
    'expired',
    'paused'
);


--
-- Name: subscription_tier; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.subscription_tier AS ENUM (
    'free',
    'starter',
    'professional',
    'enterprise'
);


--
-- Name: email(); Type: FUNCTION; Schema: auth; Owner: -
--

CREATE FUNCTION auth.email() RETURNS text
    LANGUAGE sql STABLE
    AS $$
  select 
  coalesce(
    nullif(current_setting('request.jwt.claim.email', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email')
  )::text
$$;


--
-- Name: FUNCTION email(); Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON FUNCTION auth.email() IS 'Deprecated. Use auth.jwt() -> ''email'' instead.';


--
-- Name: jwt(); Type: FUNCTION; Schema: auth; Owner: -
--

CREATE FUNCTION auth.jwt() RETURNS jsonb
    LANGUAGE sql STABLE
    AS $$
    SELECT COALESCE(
        current_setting('request.jwt.claims', true)::jsonb,
        '{}'::jsonb
    );
$$;


--
-- Name: FUNCTION jwt(); Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON FUNCTION auth.jwt() IS 'Returns JWT claims from PostgREST request.jwt.claims setting';


--
-- Name: role(); Type: FUNCTION; Schema: auth; Owner: -
--

CREATE FUNCTION auth.role() RETURNS text
    LANGUAGE sql STABLE
    AS $$
  select 
  coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role')
  )::text
$$;


--
-- Name: FUNCTION role(); Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON FUNCTION auth.role() IS 'Deprecated. Use auth.jwt() -> ''role'' instead.';


--
-- Name: uid(); Type: FUNCTION; Schema: auth; Owner: -
--

CREATE FUNCTION auth.uid() RETURNS uuid
    LANGUAGE sql STABLE
    AS $_$
  SELECT 
    CASE 
      -- Auth0 subs start with 'auth0|' or similar - return NULL
      WHEN (current_setting('request.jwt.claims', true)::jsonb ->> 'sub') LIKE '%|%' THEN NULL
      -- Valid UUID format - cast it
      WHEN (current_setting('request.jwt.claims', true)::jsonb ->> 'sub') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' 
        THEN (current_setting('request.jwt.claims', true)::jsonb ->> 'sub')::uuid
      ELSE NULL
    END;
$_$;


--
-- Name: FUNCTION uid(); Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON FUNCTION auth.uid() IS 'Returns user UUID from JWT sub claim (NULL for Auth0 users)';


--
-- Name: user_id(); Type: FUNCTION; Schema: auth; Owner: -
--

CREATE FUNCTION auth.user_id() RETURNS uuid
    LANGUAGE sql STABLE
    AS $$
  SELECT auth.uid();
$$;


--
-- Name: accept_workspace_invitation(text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.accept_workspace_invitation(p_token text, p_user_id uuid) RETURNS TABLE(workspace_id uuid, workspace_name text, organization_id uuid, role text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    v_invitation RECORD;
    v_workspace RECORD;
BEGIN
    -- Find valid invitation
    SELECT * INTO v_invitation
    FROM workspace_invitations wi
    WHERE wi.token = p_token
    AND wi.accepted_at IS NULL
    AND wi.revoked_at IS NULL
    AND wi.expires_at > NOW();

    IF v_invitation IS NULL THEN
        RAISE EXCEPTION 'Invalid or expired invitation';
    END IF;

    -- Get workspace info
    SELECT * INTO v_workspace
    FROM workspaces w
    WHERE w.id = v_invitation.workspace_id;

    -- Check user email matches invitation
    IF NOT EXISTS (
        SELECT 1 FROM users u
        WHERE u.id = p_user_id
        AND LOWER(u.email) = LOWER(v_invitation.email)
    ) THEN
        RAISE EXCEPTION 'Invitation email does not match user';
    END IF;

    -- Add to org if not already a member
    INSERT INTO organization_memberships (organization_id, user_id, role)
    VALUES (v_workspace.organization_id, p_user_id, 'member')
    ON CONFLICT (organization_id, user_id) DO NOTHING;

    -- Add to workspace
    INSERT INTO workspace_memberships (workspace_id, user_id, role)
    VALUES (v_invitation.workspace_id, p_user_id, v_invitation.role)
    ON CONFLICT (workspace_id, user_id)
    DO UPDATE SET role = v_invitation.role, updated_at = NOW();

    -- Mark invitation as accepted
    UPDATE workspace_invitations
    SET accepted_at = NOW(), accepted_by = p_user_id
    WHERE id = v_invitation.id;

    -- Update user's last workspace
    INSERT INTO user_preferences (user_id, last_workspace_id)
    VALUES (p_user_id, v_invitation.workspace_id)
    ON CONFLICT (user_id)
    DO UPDATE SET last_workspace_id = v_invitation.workspace_id, updated_at = NOW();

    RETURN QUERY SELECT
        v_workspace.id,
        v_workspace.name,
        v_workspace.organization_id,
        v_invitation.role;
END;
$$;


--
-- Name: FUNCTION accept_workspace_invitation(p_token text, p_user_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.accept_workspace_invitation(p_token text, p_user_id uuid) IS 'Accepts a workspace invitation. Adds user to org (as member) and workspace (with invited role).';


--
-- Name: add_user_to_platform_org(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.add_user_to_platform_org(p_user_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  platform_org_id uuid := 'a0000000-0000-0000-0000-000000000000';
  user_role text;
  user_is_platform_admin boolean;
BEGIN
  -- Check if user is super admin or platform admin
  SELECT role, is_platform_admin INTO user_role, user_is_platform_admin
  FROM users
  WHERE id = p_user_id;

  -- Only add super admins and platform admins to platform org
  IF user_role IN ('super_admin', 'platform_admin') OR user_is_platform_admin = true THEN
    -- Add user to platform org as admin (not owner - platform org has no single owner)
    INSERT INTO organization_memberships (user_id, organization_id, role, created_at, updated_at)
    VALUES (p_user_id, platform_org_id, 'admin', NOW(), NOW())
    ON CONFLICT (user_id, organization_id) DO UPDATE SET
      role = 'admin',
      updated_at = NOW();

    RAISE NOTICE 'User % added to Platform Super Admin org', p_user_id;
  END IF;
END;
$$;


--
-- Name: FUNCTION add_user_to_platform_org(p_user_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.add_user_to_platform_org(p_user_id uuid) IS 'Adds a super admin or platform admin user to the Platform Super Admin organization with admin role.';


--
-- Name: archive_bom_upload(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.archive_bom_upload(p_upload_id uuid, p_archive_s3_key text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
BEGIN
  UPDATE bom_uploads
  SET
    archived = true,
    archived_at = NOW(),
    archive_s3_key = p_archive_s3_key,
    updated_at = NOW()
  WHERE id = p_upload_id;
END;
$$;


--
-- Name: auto_generate_project_slug(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.auto_generate_project_slug() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
BEGIN
    -- If slug is not provided or empty, generate from name
    IF NEW.slug IS NULL OR NEW.slug = '' THEN
        NEW.slug := regexp_replace(lower(trim(NEW.name)), '[^a-z0-9]+', '-', 'g');
        NEW.slug := trim(both '-' from NEW.slug);

        -- Ensure uniqueness within organization by appending number if needed
        DECLARE
            base_slug text := NEW.slug;
            counter integer := 1;
        BEGIN
            WHILE EXISTS (
                SELECT 1 FROM public.projects
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
$$;


--
-- Name: FUNCTION auto_generate_project_slug(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.auto_generate_project_slug() IS 'Auto-generate unique slug from project name if not provided.
Ensures uniqueness within organization by appending number if needed.';


--
-- Name: auto_generate_tenant_slug(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.auto_generate_tenant_slug() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
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
$$;


--
-- Name: FUNCTION auto_generate_tenant_slug(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.auto_generate_tenant_slug() IS 'Auto-generates slug for organizations with schema-qualified function calls';


--
-- Name: auto_generate_workspace_slug(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.auto_generate_workspace_slug() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
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
$$;


--
-- Name: FUNCTION auto_generate_workspace_slug(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.auto_generate_workspace_slug() IS 'Auto-generates slug for workspaces with schema-qualified function calls';


--
-- Name: calculate_bom_health_grade(numeric, numeric); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.calculate_bom_health_grade(p_critical_pct numeric, p_high_pct numeric) RETURNS text
    LANGUAGE plpgsql IMMUTABLE
    SET search_path TO ''
    AS $$
DECLARE
    v_combined_pct DECIMAL;
BEGIN
    v_combined_pct := COALESCE(p_critical_pct, 0) + COALESCE(p_high_pct, 0);

    -- Grade based on percentage of critical/high risk components
    IF v_combined_pct < 5 THEN
        RETURN 'A';  -- Excellent: Less than 5% high/critical
    ELSIF v_combined_pct < 15 THEN
        RETURN 'B';  -- Good: 5-15% high/critical
    ELSIF v_combined_pct < 30 THEN
        RETURN 'C';  -- Acceptable: 15-30% high/critical
    ELSIF v_combined_pct < 50 THEN
        RETURN 'D';  -- At Risk: 30-50% high/critical
    ELSE
        RETURN 'F';  -- Critical: More than 50% high/critical
    END IF;
END;
$$;


--
-- Name: FUNCTION calculate_bom_health_grade(p_critical_pct numeric, p_high_pct numeric); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.calculate_bom_health_grade(p_critical_pct numeric, p_high_pct numeric) IS 'Calculate BOM health grade (A-F) based on risk distribution';


--
-- Name: calculate_weighted_risk_score(integer, integer, integer, integer, integer, integer, integer, integer, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.calculate_weighted_risk_score(p_lifecycle integer, p_supply_chain integer, p_compliance integer, p_obsolescence integer, p_single_source integer, p_lifecycle_weight integer DEFAULT 30, p_supply_chain_weight integer DEFAULT 25, p_compliance_weight integer DEFAULT 20, p_obsolescence_weight integer DEFAULT 15, p_single_source_weight integer DEFAULT 10) RETURNS integer
    LANGUAGE plpgsql IMMUTABLE
    SET search_path TO ''
    AS $$
DECLARE
    v_score DECIMAL;
BEGIN
    -- Calculate weighted average
    v_score := (
        COALESCE(p_lifecycle, 0) * (p_lifecycle_weight / 100.0) +
        COALESCE(p_supply_chain, 0) * (p_supply_chain_weight / 100.0) +
        COALESCE(p_compliance, 0) * (p_compliance_weight / 100.0) +
        COALESCE(p_obsolescence, 0) * (p_obsolescence_weight / 100.0) +
        COALESCE(p_single_source, 0) * (p_single_source_weight / 100.0)
    );

    -- Clamp to 0-100 range
    RETURN GREATEST(0, LEAST(100, ROUND(v_score)::INTEGER));
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[Risk] Error in calculate_weighted_risk_score: %', SQLERRM;
    RETURN 0;
END;
$$;


--
-- Name: FUNCTION calculate_weighted_risk_score(p_lifecycle integer, p_supply_chain integer, p_compliance integer, p_obsolescence integer, p_single_source integer, p_lifecycle_weight integer, p_supply_chain_weight integer, p_compliance_weight integer, p_obsolescence_weight integer, p_single_source_weight integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.calculate_weighted_risk_score(p_lifecycle integer, p_supply_chain integer, p_compliance integer, p_obsolescence integer, p_single_source integer, p_lifecycle_weight integer, p_supply_chain_weight integer, p_compliance_weight integer, p_obsolescence_weight integer, p_single_source_weight integer) IS 'Calculate weighted risk score from individual factors';


--
-- Name: cancel_organization_deletion(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cancel_organization_deletion(p_org_id uuid, p_cancelled_by uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE
    v_org RECORD;
BEGIN
    -- Validate organization exists and has pending deletion
    SELECT * INTO v_org
    FROM organizations
    WHERE id = p_org_id
    AND deleted_at IS NULL
    AND deletion_scheduled_at IS NOT NULL;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Organization not found or no pending deletion';
    END IF;

    -- Cancel deletion
    UPDATE organizations SET
        deletion_scheduled_at = NULL,
        deletion_requested_by = NULL,
        deletion_reason = NULL,
        deletion_feedback = NULL,
        updated_at = NOW()
    WHERE id = p_org_id;

    -- Log the event
    INSERT INTO account_deletion_audit (
        organization_id, user_id, event_type, event_data, performed_by
    ) VALUES (
        p_org_id,
        p_cancelled_by,
        'deletion_cancelled',
        jsonb_build_object(
            'original_scheduled_date', v_org.deletion_scheduled_at::TEXT,
            'cancelled_at', NOW()::TEXT
        ),
        p_cancelled_by
    );

    RETURN jsonb_build_object(
        'success', true,
        'organization_id', p_org_id,
        'message', 'Account deletion has been cancelled. Your account is now active.'
    );
END;
$$;


--
-- Name: FUNCTION cancel_organization_deletion(p_org_id uuid, p_cancelled_by uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.cancel_organization_deletion(p_org_id uuid, p_cancelled_by uuid) IS 'Cancel a pending organization deletion (owner only)';


--
-- Name: check_organization_limit(uuid, text, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_organization_limit(org_id uuid, limit_name text, current_usage integer) RETURNS boolean
    LANGUAGE plpgsql STABLE
    AS $$
DECLARE
    limit_value INTEGER;
BEGIN
    limit_value := get_organization_limit(org_id, limit_name);

    -- -1 means unlimited
    IF limit_value = -1 THEN
        RETURN TRUE;
    END IF;

    RETURN current_usage < limit_value;
END;
$$;


--
-- Name: check_slug_availability(text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_slug_availability(p_slug text, p_exclude_org_id uuid DEFAULT NULL::uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE
    v_exists BOOLEAN;
BEGIN
    IF p_exclude_org_id IS NOT NULL THEN
        SELECT EXISTS(
            SELECT 1 FROM organizations
            WHERE slug = p_slug
            AND id != p_exclude_org_id
            AND deleted_at IS NULL
        ) INTO v_exists;
    ELSE
        SELECT EXISTS(
            SELECT 1 FROM organizations
            WHERE slug = p_slug
            AND deleted_at IS NULL
        ) INTO v_exists;
    END IF;

    RETURN NOT v_exists;
END;
$$;


--
-- Name: classify_risk_level_custom(integer, integer, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.classify_risk_level_custom(p_score integer, p_low_threshold integer DEFAULT 30, p_medium_threshold integer DEFAULT 60, p_high_threshold integer DEFAULT 85) RETURNS text
    LANGUAGE plpgsql IMMUTABLE
    SET search_path TO ''
    AS $$
BEGIN
    IF p_score IS NULL THEN
        RETURN 'low';
    END IF;

    IF p_score <= p_low_threshold THEN
        RETURN 'low';
    ELSIF p_score <= p_medium_threshold THEN
        RETURN 'medium';
    ELSIF p_score <= p_high_threshold THEN
        RETURN 'high';
    ELSE
        RETURN 'critical';
    END IF;
END;
$$;


--
-- Name: FUNCTION classify_risk_level_custom(p_score integer, p_low_threshold integer, p_medium_threshold integer, p_high_threshold integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.classify_risk_level_custom(p_score integer, p_low_threshold integer, p_medium_threshold integer, p_high_threshold integer) IS 'Classify risk level using custom thresholds';


--
-- Name: create_default_alert_preferences(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_default_alert_preferences() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
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
$$;


--
-- Name: FUNCTION create_default_alert_preferences(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.create_default_alert_preferences() IS 'Creates default alert preferences for new auth.users with schema-qualified table references';


--
-- Name: create_lifecycle_change_alert(uuid, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_lifecycle_change_alert(component_id_param uuid, old_status text, new_status text) RETURNS uuid
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
DECLARE
  alert_id UUID;
  component_record RECORD;
  watch_record RECORD;
  severity_val TEXT;
BEGIN
  -- Determine severity based on new status
  severity_val := CASE new_status
    WHEN 'OBSOLETE' THEN 'CRITICAL'
    WHEN 'EOL' THEN 'HIGH'
    WHEN 'NRND' THEN 'MEDIUM'
    ELSE 'LOW'
  END;

  -- Get component details
  SELECT * INTO component_record FROM components WHERE id = component_id_param;

  -- Create alert for each user watching this component
  FOR watch_record IN
    SELECT * FROM component_watches
    WHERE component_id = component_id_param
      AND watch_lifecycle = TRUE
  LOOP
    INSERT INTO alerts (
      organization_id,
      user_id,
      component_id,
      severity,
      alert_type,
      title,
      message,
      context,
      action_url
    ) VALUES (
      component_record.organization_id,
      watch_record.user_id,
      component_id_param,
      severity_val,
      'LIFECYCLE',
      format('Lifecycle Status Changed: %s → %s', old_status, new_status),
      format('Component %s (MPN: %s) lifecycle status changed from %s to %s',
        component_record.manufacturer,
        component_record.manufacturer_part_number,
        old_status,
        new_status
      ),
      jsonb_build_object(
        'old_status', old_status,
        'new_status', new_status
      ),
      format('/components/%s', component_id_param)
    )
    RETURNING id INTO alert_id;

    -- Queue delivery
    PERFORM queue_alert_delivery(alert_id, watch_record.user_id);
  END LOOP;

  RETURN alert_id;
END;
$$;


--
-- Name: FUNCTION create_lifecycle_change_alert(component_id_param uuid, old_status text, new_status text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.create_lifecycle_change_alert(component_id_param uuid, old_status text, new_status text) IS 'Create alert when component lifecycle status changes';


--
-- Name: create_organization_invitation(uuid, text, text, uuid, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_organization_invitation(p_organization_id uuid, p_email text, p_role text DEFAULT 'member'::text, p_invited_by uuid DEFAULT NULL::uuid, p_expires_days integer DEFAULT 7) RETURNS TABLE(id uuid, token text, expires_at timestamp with time zone)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    v_token TEXT;
    v_expires TIMESTAMPTZ;
    v_id UUID;
    v_max_users INTEGER;
    v_current_users INTEGER;
BEGIN
    SELECT max_users INTO v_max_users
    FROM organizations WHERE id = p_organization_id;

    IF v_max_users IS NOT NULL THEN
        SELECT COUNT(*) INTO v_current_users
        FROM organization_memberships WHERE organization_id = p_organization_id;

        v_current_users := v_current_users + (
            SELECT COUNT(*) FROM organization_invitations
            WHERE organization_id = p_organization_id
            AND accepted_at IS NULL
            AND revoked_at IS NULL
            AND expires_at > NOW()
        );

        IF v_current_users >= v_max_users THEN
            RAISE EXCEPTION 'Organization has reached its member limit (% members)', v_max_users;
        END IF;
    END IF;

    v_token := encode(gen_random_bytes(32), 'hex');
    v_expires := NOW() + (p_expires_days || ' days')::INTERVAL;

    INSERT INTO organization_invitations (
        organization_id, email, role, token, invited_by, expires_at
    ) VALUES (
        p_organization_id, LOWER(p_email), p_role, v_token, p_invited_by, v_expires
    )
    RETURNING organization_invitations.id INTO v_id;

    RETURN QUERY SELECT v_id, v_token, v_expires;
END;
$$;


--
-- Name: create_organization_with_owner(text, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_organization_with_owner(p_name text, p_user_id uuid, p_slug text DEFAULT NULL::text) RETURNS TABLE(organization_id uuid, organization_slug text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_org_id UUID;
  v_slug TEXT;
BEGIN
  v_slug := COALESCE(
    p_slug,
    LOWER(REGEXP_REPLACE(p_name, '[^a-zA-Z0-9]', '-', 'g')) || '-' || SUBSTRING(gen_random_uuid()::text, 1, 8)
  );

  INSERT INTO organizations (name, slug, created_by)
  VALUES (p_name, v_slug, p_user_id)
  RETURNING id INTO v_org_id;

  INSERT INTO organization_memberships (organization_id, user_id, role)
  VALUES (v_org_id, p_user_id, 'owner');

  INSERT INTO user_preferences (user_id, last_organization_id)
  VALUES (p_user_id, v_org_id)
  ON CONFLICT (user_id)
  DO UPDATE SET last_organization_id = v_org_id, updated_at = NOW();

  RETURN QUERY SELECT v_org_id, v_slug;
END;
$$;


--
-- Name: FUNCTION create_organization_with_owner(p_name text, p_user_id uuid, p_slug text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.create_organization_with_owner(p_name text, p_user_id uuid, p_slug text) IS 'Creates an organization and adds the specified user as owner.';


--
-- Name: create_risk_threshold_alert(uuid, text, text, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_risk_threshold_alert(component_id_param uuid, old_risk_level text, new_risk_level text, new_risk_score integer) RETURNS uuid
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
DECLARE
  alert_id UUID;
  component_record RECORD;
  watch_record RECORD;
BEGIN
  -- Only create alert for high/critical risk
  IF new_risk_level NOT IN ('high', 'critical') THEN
    RETURN NULL;
  END IF;

  -- Get component details
  SELECT * INTO component_record FROM components WHERE id = component_id_param;

  -- Create alert for each user watching this component
  FOR watch_record IN
    SELECT * FROM component_watches
    WHERE component_id = component_id_param
      AND watch_risk = TRUE
  LOOP
    INSERT INTO alerts (
      organization_id,
      user_id,
      component_id,
      severity,
      alert_type,
      title,
      message,
      context,
      action_url
    ) VALUES (
      component_record.organization_id,
      watch_record.user_id,
      component_id_param,
      CASE
        WHEN new_risk_level = 'critical' THEN 'CRITICAL'
        WHEN new_risk_level = 'high' THEN 'HIGH'
        ELSE 'MEDIUM'
      END,
      'RISK',
      format('Risk Level Changed: %s → %s', old_risk_level, new_risk_level),
      format('Component %s (MPN: %s) risk score changed to %s/100 (%s risk)',
        component_record.manufacturer,
        component_record.manufacturer_part_number,
        new_risk_score,
        new_risk_level
      ),
      jsonb_build_object(
        'old_risk_level', old_risk_level,
        'new_risk_level', new_risk_level,
        'risk_score', new_risk_score
      ),
      format('/components/%s', component_id_param)
    )
    RETURNING id INTO alert_id;

    -- Queue delivery
    PERFORM queue_alert_delivery(alert_id, watch_record.user_id);
  END LOOP;

  RETURN alert_id;
END;
$$;


--
-- Name: FUNCTION create_risk_threshold_alert(component_id_param uuid, old_risk_level text, new_risk_level text, new_risk_score integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.create_risk_threshold_alert(component_id_param uuid, old_risk_level text, new_risk_level text, new_risk_score integer) IS 'Create alert when component risk exceeds threshold';


--
-- Name: create_workspace_with_admin(uuid, text, uuid, text, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_workspace_with_admin(p_organization_id uuid, p_name text, p_user_id uuid, p_slug text DEFAULT NULL::text, p_is_default boolean DEFAULT false) RETURNS TABLE(workspace_id uuid, workspace_slug text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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


--
-- Name: FUNCTION create_workspace_with_admin(p_organization_id uuid, p_name text, p_user_id uuid, p_slug text, p_is_default boolean); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.create_workspace_with_admin(p_organization_id uuid, p_name text, p_user_id uuid, p_slug text, p_is_default boolean) IS 'Creates a workspace and adds the specified user as admin. Used during org creation.';


--
-- Name: current_user_organization_id(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.current_user_organization_id() RETURNS uuid
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    AS $$
DECLARE
  v_org_id UUID;
  v_header_org TEXT;
BEGIN
  v_header_org := current_setting('request.headers', true)::json ->> 'x-organization-id';

  IF v_header_org IS NOT NULL THEN
    v_org_id := v_header_org::UUID;
    IF is_member_of(v_org_id) OR is_super_admin() THEN
      RETURN v_org_id;
    END IF;
  END IF;

  SELECT last_organization_id INTO v_org_id
  FROM user_preferences
  WHERE user_id = get_current_user_id();

  IF v_org_id IS NOT NULL AND (is_member_of(v_org_id) OR is_super_admin()) THEN
    RETURN v_org_id;
  END IF;

  SELECT organization_id INTO v_org_id
  FROM organization_memberships
  WHERE user_id = get_current_user_id()
  ORDER BY created_at
  LIMIT 1;

  RETURN v_org_id;
END;
$$;


--
-- Name: FUNCTION current_user_organization_id(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.current_user_organization_id() IS 'Backwards-compatible function. Gets org from header, user prefs, or first membership.';


--
-- Name: current_user_role(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.current_user_role() RETURNS text
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
  SELECT get_role_in_org(current_user_organization_id())
$$;


--
-- Name: FUNCTION current_user_role(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.current_user_role() IS 'Returns user role from Auth0 JWT roles array. Strips "platform:" prefix (e.g., "platform:admin" → "admin").';


--
-- Name: current_user_tenant_id(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.current_user_tenant_id() RETURNS uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
    SELECT current_user_organization_id();
$$;


--
-- Name: FUNCTION current_user_tenant_id(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.current_user_tenant_id() IS 'Alias for current_user_organization_id() - maintained for backward compatibility';


--
-- Name: current_workspace_id(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.current_workspace_id() RETURNS uuid
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
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


--
-- Name: FUNCTION current_workspace_id(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.current_workspace_id() IS 'Gets current workspace from header, user prefs, or first membership. Used for context resolution.';


--
-- Name: debug_jwt_claims(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.debug_jwt_claims() RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE
    claims jsonb;
BEGIN
    claims := current_setting('request.jwt.claims', true)::jsonb;
    RAISE NOTICE 'JWT Claims: %', claims;
    RETURN claims;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Error getting claims: %', SQLERRM;
    RETURN '{}'::jsonb;
END;
$$;


--
-- Name: debug_request_context(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.debug_request_context() RETURNS TABLE(key text, value text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
BEGIN
  RETURN QUERY SELECT 'current_role'::text, current_setting('role', true);
  RETURN QUERY SELECT 'jwt.claims'::text, current_setting('request.jwt.claims', true);
  RETURN QUERY SELECT 'is_super_admin'::text, is_super_admin()::text;
  RETURN QUERY SELECT 'org_id'::text, COALESCE(current_user_organization_id()::text, 'NULL');
END;
$$;


--
-- Name: enforce_max_members_limit(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.enforce_max_members_limit() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
DECLARE
    max_members INTEGER;
    current_count INTEGER;
BEGIN
    -- Get max_members limit for this organization
    SELECT (p.limits->>'max_members')::INTEGER INTO max_members
    FROM public.subscriptions s
    JOIN public.subscription_plans p ON s.plan_id = p.id
    WHERE s.organization_id = NEW.organization_id
    AND s.status IN ('active', 'trialing')
    LIMIT 1;

    -- Default to 1 if no subscription (free tier behavior)
    max_members := COALESCE(max_members, 1);

    -- -1 means unlimited
    IF max_members = -1 THEN
        RETURN NEW;
    END IF;

    -- Count existing members (table is organization_memberships, not memberships)
    SELECT COUNT(*) INTO current_count
    FROM public.organization_memberships
    WHERE organization_id = NEW.organization_id;

    IF current_count >= max_members THEN
        RAISE EXCEPTION 'Organization has reached maximum member limit (%). Upgrade to add more members.', max_members;
    END IF;

    RETURN NEW;
END;
$$;


--
-- Name: generate_invoice_number(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_invoice_number() RETURNS text
    LANGUAGE plpgsql
    AS $$
DECLARE
    year_month TEXT;
    seq_num INTEGER;
BEGIN
    year_month := TO_CHAR(NOW(), 'YYYYMM');

    SELECT COALESCE(MAX(
        SUBSTRING(invoice_number FROM 'INV-' || year_month || '-(\d+)')::INTEGER
    ), 0) + 1
    INTO seq_num
    FROM invoices
    WHERE invoice_number LIKE 'INV-' || year_month || '-%';

    RETURN 'INV-' || year_month || '-' || LPAD(seq_num::TEXT, 4, '0');
END;
$$;


--
-- Name: generate_s3_key(uuid, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_s3_key(p_tenant_id uuid, p_upload_id uuid, p_filename text) RETURNS text
    LANGUAGE plpgsql IMMUTABLE
    SET search_path TO ''
    AS $$
BEGIN
  RETURN format('uploads/%s/%s/%s', p_tenant_id, p_upload_id, p_filename);
END;
$$;


--
-- Name: get_current_user_id(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_current_user_id() RETURNS uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT id FROM users
  WHERE auth0_user_id = auth.jwt() ->> 'sub'
  LIMIT 1
$$;


--
-- Name: FUNCTION get_current_user_id(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_current_user_id() IS 'Returns the Supabase user UUID by looking up auth0_user_id from JWT sub claim.';


--
-- Name: get_deletion_grace_days_remaining(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_deletion_grace_days_remaining(org_id uuid) RETURNS integer
    LANGUAGE plpgsql STABLE
    SET search_path TO ''
    AS $$
DECLARE
    scheduled_date TIMESTAMPTZ;
BEGIN
    SELECT deletion_scheduled_at INTO scheduled_date
    FROM organizations
    WHERE id = org_id;

    IF scheduled_date IS NULL THEN
        RETURN NULL;
    END IF;

    RETURN GREATEST(0, EXTRACT(DAY FROM (scheduled_date - NOW()))::INTEGER);
END;
$$;


--
-- Name: FUNCTION get_deletion_grace_days_remaining(org_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_deletion_grace_days_remaining(org_id uuid) IS 'Get number of days remaining before account is permanently deleted';


--
-- Name: get_enrichment_summary(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_enrichment_summary(p_bom_id uuid) RETURNS TABLE(total_events bigint, first_event timestamp with time zone, last_event timestamp with time zone, current_state jsonb, event_types jsonb)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(*)::BIGINT as total_events,
        MIN(created_at) as first_event,
        MAX(created_at) as last_event,
        (
            SELECT state
            FROM enrichment_events e2
            WHERE e2.bom_id = p_bom_id
            ORDER BY created_at DESC
            LIMIT 1
        ) as current_state,
        jsonb_object_agg(event_type, event_count) as event_types
    FROM (
        SELECT
            event_type,
            COUNT(*)::BIGINT as event_count
        FROM enrichment_events
        WHERE bom_id = p_bom_id
        GROUP BY event_type
    ) event_counts;
END;
$$;


--
-- Name: get_latest_enrichment_state(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_latest_enrichment_state(p_bom_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE
    v_state JSONB;
BEGIN
    SELECT state
    INTO v_state
    FROM enrichment_events
    WHERE bom_id = p_bom_id
    ORDER BY created_at DESC
    LIMIT 1;

    RETURN v_state;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: organization_risk_profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.organization_risk_profiles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    lifecycle_weight integer DEFAULT 30,
    supply_chain_weight integer DEFAULT 25,
    compliance_weight integer DEFAULT 20,
    obsolescence_weight integer DEFAULT 15,
    single_source_weight integer DEFAULT 10,
    low_threshold integer DEFAULT 30,
    medium_threshold integer DEFAULT 60,
    high_threshold integer DEFAULT 85,
    quantity_weight numeric(4,3) DEFAULT 0.150,
    lead_time_weight numeric(4,3) DEFAULT 0.100,
    criticality_weight numeric(4,3) DEFAULT 0.200,
    preset_name text,
    custom_factors jsonb DEFAULT '[]'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    created_by uuid,
    updated_by uuid,
    CONSTRAINT organization_risk_profiles_check CHECK (((low_threshold < medium_threshold) AND (medium_threshold < high_threshold))),
    CONSTRAINT organization_risk_profiles_check1 CHECK ((((((lifecycle_weight + supply_chain_weight) + compliance_weight) + obsolescence_weight) + single_source_weight) = 100)),
    CONSTRAINT organization_risk_profiles_compliance_weight_check CHECK (((compliance_weight >= 0) AND (compliance_weight <= 100))),
    CONSTRAINT organization_risk_profiles_criticality_weight_check CHECK (((criticality_weight >= (0)::numeric) AND (criticality_weight <= (1)::numeric))),
    CONSTRAINT organization_risk_profiles_high_threshold_check CHECK (((high_threshold >= 1) AND (high_threshold <= 99))),
    CONSTRAINT organization_risk_profiles_lead_time_weight_check CHECK (((lead_time_weight >= (0)::numeric) AND (lead_time_weight <= (1)::numeric))),
    CONSTRAINT organization_risk_profiles_lifecycle_weight_check CHECK (((lifecycle_weight >= 0) AND (lifecycle_weight <= 100))),
    CONSTRAINT organization_risk_profiles_low_threshold_check CHECK (((low_threshold >= 1) AND (low_threshold <= 99))),
    CONSTRAINT organization_risk_profiles_medium_threshold_check CHECK (((medium_threshold >= 1) AND (medium_threshold <= 99))),
    CONSTRAINT organization_risk_profiles_obsolescence_weight_check CHECK (((obsolescence_weight >= 0) AND (obsolescence_weight <= 100))),
    CONSTRAINT organization_risk_profiles_preset_name_check CHECK ((preset_name = ANY (ARRAY['default'::text, 'automotive'::text, 'medical'::text, 'aerospace'::text, 'consumer'::text, 'industrial'::text, 'custom'::text]))),
    CONSTRAINT organization_risk_profiles_quantity_weight_check CHECK (((quantity_weight >= (0)::numeric) AND (quantity_weight <= (1)::numeric))),
    CONSTRAINT organization_risk_profiles_single_source_weight_check CHECK (((single_source_weight >= 0) AND (single_source_weight <= 100))),
    CONSTRAINT organization_risk_profiles_supply_chain_weight_check CHECK (((supply_chain_weight >= 0) AND (supply_chain_weight <= 100)))
);


--
-- Name: TABLE organization_risk_profiles; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.organization_risk_profiles IS 'Customer-specific risk scoring configuration with configurable weights and thresholds';


--
-- Name: COLUMN organization_risk_profiles.custom_factors; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.organization_risk_profiles.custom_factors IS 'Industry-specific custom risk factors as JSONB array';


--
-- Name: get_or_create_risk_profile(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_or_create_risk_profile(p_org_id uuid) RETURNS public.organization_risk_profiles
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE
    v_profile organization_risk_profiles;
BEGIN
    -- Try to get existing profile
    SELECT * INTO v_profile
    FROM organization_risk_profiles
    WHERE organization_id = p_org_id;

    -- Create default profile if not exists
    IF v_profile IS NULL THEN
        INSERT INTO organization_risk_profiles (organization_id, preset_name)
        VALUES (p_org_id, 'default')
        RETURNING * INTO v_profile;

        RAISE NOTICE '[Risk] Created default risk profile for org=%', p_org_id;
    END IF;

    RETURN v_profile;
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[Risk] Error in get_or_create_risk_profile: %', SQLERRM;
    RETURN NULL;
END;
$$;


--
-- Name: FUNCTION get_or_create_risk_profile(p_org_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_or_create_risk_profile(p_org_id uuid) IS 'Get existing or create default risk profile for organization';


--
-- Name: get_organization_by_auth0_id(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_organization_by_auth0_id(p_auth0_org_id text) RETURNS TABLE(id uuid, name text, org_type text, auth0_org_id text, enterprise_name text, max_users integer)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    RETURN QUERY
    SELECT
        o.id,
        o.name,
        o.org_type,
        o.auth0_org_id,
        o.enterprise_name,
        o.max_users
    FROM organizations o
    WHERE o.auth0_org_id = p_auth0_org_id
    LIMIT 1;
END;
$$;


--
-- Name: get_organization_limit(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_organization_limit(org_id uuid, limit_name text) RETURNS integer
    LANGUAGE plpgsql STABLE
    AS $$
DECLARE
    limit_value INTEGER;
BEGIN
    SELECT (p.limits->>limit_name)::INTEGER INTO limit_value
    FROM subscriptions s
    JOIN subscription_plans p ON s.plan_id = p.id
    WHERE s.organization_id = org_id
    AND s.status IN ('active', 'trialing')
    LIMIT 1;

    -- Default limits for free tier if no subscription
    IF limit_value IS NULL THEN
        CASE limit_name
            WHEN 'max_members' THEN RETURN 1;
            WHEN 'max_projects' THEN RETURN 2;
            WHEN 'max_bom_uploads_per_month' THEN RETURN 5;
            WHEN 'max_components_per_bom' THEN RETURN 100;
            WHEN 'max_api_calls_per_month' THEN RETURN 100;
            ELSE RETURN 0;
        END CASE;
    END IF;

    -- -1 means unlimited
    RETURN limit_value;
END;
$$;


--
-- Name: get_organization_tier(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_organization_tier(org_id uuid) RETURNS public.subscription_tier
    LANGUAGE plpgsql STABLE
    AS $$
DECLARE
    tier_result subscription_tier;
BEGIN
    SELECT p.tier INTO tier_result
    FROM subscriptions s
    JOIN subscription_plans p ON s.plan_id = p.id
    WHERE s.organization_id = org_id
    AND s.status IN ('active', 'trialing')
    LIMIT 1;

    -- Default to free if no subscription
    RETURN COALESCE(tier_result, 'free');
END;
$$;


--
-- Name: get_organization_type(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_organization_type(org_id uuid) RETURNS text
    LANGUAGE plpgsql STABLE
    SET search_path TO ''
    AS $$
DECLARE
    org_type_result TEXT;
BEGIN
    -- First check organization's direct org_type column
    SELECT o.org_type INTO org_type_result
    FROM organizations o
    WHERE o.id = org_id;

    IF org_type_result IS NOT NULL THEN
        RETURN org_type_result;
    END IF;

    -- Fall back to subscription plan limits
    SELECT (p.limits->>'org_type') INTO org_type_result
    FROM subscriptions s
    JOIN subscription_plans p ON s.plan_id = p.id
    WHERE s.organization_id = org_id
    AND s.status IN ('active', 'trialing')
    LIMIT 1;

    RETURN COALESCE(org_type_result, 'individual');
END;
$$;


--
-- Name: FUNCTION get_organization_type(org_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_organization_type(org_id uuid) IS 'Get organization type (individual, enterprise, platform)';


--
-- Name: get_role_in_org(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_role_in_org(p_org_id uuid) RETURNS text
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT role FROM organization_memberships
  WHERE user_id = get_current_user_id()
  AND organization_id = p_org_id
  LIMIT 1
$$;


--
-- Name: get_role_in_workspace(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_role_in_workspace(p_workspace_id uuid) RETURNS text
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
    SELECT role FROM workspace_memberships
    WHERE user_id = get_current_user_id()
    AND workspace_id = p_workspace_id
    LIMIT 1
$$;


--
-- Name: FUNCTION get_role_in_workspace(p_workspace_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_role_in_workspace(p_workspace_id uuid) IS 'Returns the user role in the specified workspace (admin, engineer, analyst, viewer).';


--
-- Name: get_user_novu_channels(uuid, character varying); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_user_novu_channels(p_user_id uuid, p_alert_type character varying) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE
    v_channels JSONB;
BEGIN
    SELECT novu_channels INTO v_channels
    FROM alert_preferences
    WHERE user_id = p_user_id
      AND alert_type = p_alert_type
      AND is_enabled = TRUE;

    -- Default to in_app if no preference set
    IF v_channels IS NULL THEN
        v_channels := '["in_app"]'::jsonb;
    END IF;

    RETURN v_channels;
END;
$$;


--
-- Name: get_user_organization_ids(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_user_organization_ids() RETURNS SETOF uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT organization_id
  FROM organization_memberships
  WHERE user_id = get_current_user_id()
$$;


--
-- Name: FUNCTION get_user_organization_ids(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_user_organization_ids() IS 'Returns all organization UUIDs the current user is a member of.';


--
-- Name: get_user_workspace_ids(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_user_workspace_ids() RETURNS SETOF uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
    SELECT workspace_id
    FROM workspace_memberships
    WHERE user_id = get_current_user_id()
$$;


--
-- Name: FUNCTION get_user_workspace_ids(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_user_workspace_ids() IS 'Returns all workspace UUIDs the current user is a member of. Used in RLS policies.';


--
-- Name: has_org_features(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_org_features(org_id uuid) RETURNS boolean
    LANGUAGE plpgsql STABLE
    SET search_path TO ''
    AS $$
DECLARE
    has_features BOOLEAN;
BEGIN
    SELECT (p.limits->>'org_features')::BOOLEAN INTO has_features
    FROM subscriptions s
    JOIN subscription_plans p ON s.plan_id = p.id
    WHERE s.organization_id = org_id
    AND s.status IN ('active', 'trialing')
    LIMIT 1;

    RETURN COALESCE(has_features, FALSE);
END;
$$;


--
-- Name: FUNCTION has_org_features(org_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.has_org_features(org_id uuid) IS 'Check if organization has org-level features (invite members, role management, etc.)';


--
-- Name: is_admin_of(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_admin_of(p_org_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM organization_memberships
    WHERE user_id = get_current_user_id()
    AND organization_id = p_org_id
    AND role IN ('owner', 'admin')
  )
$$;


--
-- Name: is_deletion_pending(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_deletion_pending(org_id uuid) RETURNS boolean
    LANGUAGE plpgsql STABLE
    SET search_path TO ''
    AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM organizations
        WHERE id = org_id
        AND deletion_scheduled_at IS NOT NULL
        AND deleted_at IS NULL
    );
END;
$$;


--
-- Name: FUNCTION is_deletion_pending(org_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.is_deletion_pending(org_id uuid) IS 'Check if organization has a pending deletion (in grace period)';


--
-- Name: is_member_of(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_member_of(p_org_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM organization_memberships
    WHERE user_id = get_current_user_id()
    AND organization_id = p_org_id
  )
$$;


--
-- Name: is_org_admin(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_org_admin() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
  SELECT current_user_role() IN ('admin', 'owner', 'super_admin')
$$;


--
-- Name: FUNCTION is_org_admin(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.is_org_admin() IS 'Returns true if user role is admin, owner, or super_admin.';


--
-- Name: is_org_admin_or_owner(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_org_admin_or_owner() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
  SELECT current_user_role() IN ('admin', 'owner', 'super_admin')
$$;


--
-- Name: FUNCTION is_org_admin_or_owner(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.is_org_admin_or_owner() IS 'Returns true if user role allows admin operations. Used for membership writes.';


--
-- Name: is_organization_active(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_organization_active(org_id uuid) RETURNS boolean
    LANGUAGE plpgsql STABLE
    SET search_path TO ''
    AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM organizations
        WHERE id = org_id
        AND deleted_at IS NULL
        AND is_suspended = FALSE
    );
END;
$$;


--
-- Name: FUNCTION is_organization_active(org_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.is_organization_active(org_id uuid) IS 'Check if organization is active (not deleted, not suspended)';


--
-- Name: is_platform_staff(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_platform_staff() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM organization_memberships
    WHERE user_id = get_current_user_id()
    AND organization_id = 'a0000000-0000-0000-0000-000000000000'::uuid
  )
$$;


--
-- Name: FUNCTION is_platform_staff(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.is_platform_staff() IS 'Returns true if current user is a member of the Platform Super Admin organization.';


--
-- Name: is_super_admin(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_super_admin() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM jsonb_array_elements_text(
      COALESCE(auth.jwt() -> 'https://ananta.component.platform/roles', '[]'::jsonb)
    ) AS role
    WHERE role = 'platform:super_admin'
  )
  OR EXISTS (
    SELECT 1 FROM users
    WHERE auth0_user_id = auth.jwt() ->> 'sub'
    AND is_platform_admin = true
  )
$$;


--
-- Name: FUNCTION is_super_admin(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.is_super_admin() IS 'Returns true if user has platform:super_admin role in JWT or is_platform_admin in users table.';


--
-- Name: is_workspace_admin(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_workspace_admin(p_workspace_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
    SELECT EXISTS (
        SELECT 1 FROM workspace_memberships
        WHERE user_id = get_current_user_id()
        AND workspace_id = p_workspace_id
        AND role = 'admin'
    )
$$;


--
-- Name: FUNCTION is_workspace_admin(p_workspace_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.is_workspace_admin(p_workspace_id uuid) IS 'Returns true if current user is admin of the specified workspace.';


--
-- Name: is_workspace_member(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_workspace_member(p_workspace_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
    SELECT EXISTS (
        SELECT 1 FROM workspace_memberships
        WHERE user_id = get_current_user_id()
        AND workspace_id = p_workspace_id
    )
$$;


--
-- Name: FUNCTION is_workspace_member(p_workspace_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.is_workspace_member(p_workspace_id uuid) IS 'Returns true if current user is a member of the specified workspace.';


--
-- Name: mark_bom_upload_event_published(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.mark_bom_upload_event_published(p_upload_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
BEGIN
  UPDATE public.bom_uploads
  SET
    rabbitmq_event_published = true,
    rabbitmq_event_published_at = NOW(),
    updated_at = NOW()
  WHERE id = p_upload_id;
END;
$$;


--
-- Name: bom_uploads; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bom_uploads (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    filename text NOT NULL,
    file_size bigint NOT NULL,
    file_type text NOT NULL,
    raw_file_url text,
    organization_id uuid NOT NULL,
    project_id uuid,
    uploaded_by uuid,
    status text DEFAULT 'uploaded'::text NOT NULL,
    detected_columns jsonb,
    unmapped_columns text[],
    column_mappings jsonb,
    mapping_confirmed boolean DEFAULT false,
    mapping_confirmed_at timestamp with time zone,
    total_rows integer DEFAULT 0,
    preview_data jsonb,
    parse_stats jsonb,
    processing_settings jsonb,
    rabbitmq_event_published boolean DEFAULT false,
    rabbitmq_event_published_at timestamp with time zone,
    temporal_workflow_id text,
    temporal_workflow_status text,
    enrichment_job_id text,
    error_message text,
    error_details jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    upload_source text DEFAULT 'customer'::text NOT NULL,
    s3_bucket text DEFAULT 'bulk-uploads'::text,
    s3_key text,
    storage_backend text DEFAULT 'minio'::text,
    original_filename text,
    cns_job_id text,
    cns_job_status text,
    enrichment_summary jsonb,
    archived boolean DEFAULT false,
    archived_at timestamp with time zone,
    archive_s3_key text,
    results_s3_key text,
    failed_items_s3_key text,
    bom_id uuid
);


--
-- Name: TABLE bom_uploads; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.bom_uploads IS 'Unified upload tracking for customer and CNS bulk uploads with S3 storage';


--
-- Name: COLUMN bom_uploads.status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.bom_uploads.status IS 'Upload lifecycle: uploaded → parsing → parsed → mapping_pending → ready_for_enrichment → processing → completed/failed';


--
-- Name: COLUMN bom_uploads.detected_columns; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.bom_uploads.detected_columns IS 'Auto-detected column mappings from parser';


--
-- Name: COLUMN bom_uploads.column_mappings; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.bom_uploads.column_mappings IS 'User-confirmed final column mappings';


--
-- Name: COLUMN bom_uploads.rabbitmq_event_published; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.bom_uploads.rabbitmq_event_published IS 'True when customer.bom.uploaded event has been published to RabbitMQ';


--
-- Name: COLUMN bom_uploads.temporal_workflow_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.bom_uploads.temporal_workflow_id IS 'Temporal workflow execution ID for tracking async processing';


--
-- Name: COLUMN bom_uploads.upload_source; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.bom_uploads.upload_source IS 'Upload source: customer (portal upload), cns_bulk (admin bulk), staff (internal), api (programmatic)';


--
-- Name: COLUMN bom_uploads.s3_key; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.bom_uploads.s3_key IS 'Full S3 key/path: uploads/{tenant_id}/{upload_id}/{filename}';


--
-- Name: COLUMN bom_uploads.bom_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.bom_uploads.bom_id IS 'BOM ID created from this upload (boms.id). Enables correct enrichment targeting.';


--
-- Name: mark_bom_upload_ready_for_enrichment(uuid, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.mark_bom_upload_ready_for_enrichment(p_upload_id uuid, p_column_mappings jsonb) RETURNS public.bom_uploads
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE
  v_upload public.bom_uploads;
BEGIN
  UPDATE public.bom_uploads
  SET
    status = 'ready_for_enrichment',
    column_mappings = p_column_mappings,
    mapping_confirmed = true,
    mapping_confirmed_at = NOW(),
    updated_at = NOW()
  WHERE id = p_upload_id
  RETURNING * INTO v_upload;

  RETURN v_upload;
END;
$$;


--
-- Name: organization_has_feature(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.organization_has_feature(org_id uuid, feature_name text) RETURNS boolean
    LANGUAGE plpgsql STABLE
    AS $$
DECLARE
    has_feature BOOLEAN;
BEGIN
    SELECT (p.limits->'features') ? feature_name INTO has_feature
    FROM subscriptions s
    JOIN subscription_plans p ON s.plan_id = p.id
    WHERE s.organization_id = org_id
    AND s.status IN ('active', 'trialing')
    LIMIT 1;

    RETURN COALESCE(has_feature, FALSE);
END;
$$;


--
-- Name: provision_user(text, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.provision_user(p_auth0_user_id text, p_email text, p_name text DEFAULT NULL::text, p_avatar_url text DEFAULT NULL::text) RETURNS TABLE(user_id uuid, is_new boolean)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_user_id UUID;
  v_is_new BOOLEAN := false;
BEGIN
  SELECT id INTO v_user_id
  FROM users
  WHERE auth0_user_id = p_auth0_user_id;

  IF v_user_id IS NULL THEN
    INSERT INTO users (auth0_user_id, email, full_name)
    VALUES (p_auth0_user_id, p_email, COALESCE(p_name, split_part(p_email, '@', 1)))
    RETURNING id INTO v_user_id;

    v_is_new := true;
  ELSE
    UPDATE users
    SET
      email = COALESCE(p_email, email),
      full_name = COALESCE(p_name, full_name),
      updated_at = NOW()
    WHERE id = v_user_id;
  END IF;

  RETURN QUERY SELECT v_user_id, v_is_new;
END;
$$;


--
-- Name: FUNCTION provision_user(p_auth0_user_id text, p_email text, p_name text, p_avatar_url text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.provision_user(p_auth0_user_id text, p_email text, p_name text, p_avatar_url text) IS 'Lazily provisions a user on first API call. Creates user if not exists, updates if exists.';


--
-- Name: queue_alert_delivery(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.queue_alert_delivery(alert_id_param uuid, user_id_param uuid) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
DECLARE
  pref_record RECORD;
  alert_record RECORD;
BEGIN
  -- Get alert details
  SELECT * INTO alert_record FROM alerts WHERE id = alert_id_param;

  -- Get user preferences for this alert type
  SELECT * INTO pref_record
  FROM alert_preferences
  WHERE user_id = user_id_param
    AND organization_id = alert_record.organization_id
    AND alert_type = alert_record.alert_type
    AND is_active = TRUE;

  -- If no preferences found, use defaults
  IF NOT FOUND THEN
    -- Default: in-app only
    INSERT INTO alert_deliveries (alert_id, delivery_method, recipient, status)
    VALUES (alert_id_param, 'in_app', user_id_param::TEXT, 'delivered');
    RETURN;
  END IF;

  -- Queue email delivery if enabled
  IF pref_record.email_enabled AND NOT pref_record.batch_enabled THEN
    INSERT INTO alert_deliveries (
      alert_id,
      delivery_method,
      recipient,
      status
    ) VALUES (
      alert_id_param,
      'email',
      COALESCE(pref_record.email_address, (SELECT email FROM auth.users WHERE id = user_id_param)),
      'pending'
    );
  END IF;

  -- Queue webhook delivery if enabled
  IF pref_record.webhook_enabled AND pref_record.webhook_url IS NOT NULL THEN
    INSERT INTO alert_deliveries (
      alert_id,
      delivery_method,
      recipient,
      status
    ) VALUES (
      alert_id_param,
      'webhook',
      pref_record.webhook_url,
      'pending'
    );
  END IF;

  -- In-app delivery is always instant
  IF pref_record.in_app_enabled THEN
    INSERT INTO alert_deliveries (alert_id, delivery_method, recipient, status, delivered_at)
    VALUES (alert_id_param, 'in_app', user_id_param::TEXT, 'delivered', NOW());
  END IF;
END;
$$;


--
-- Name: FUNCTION queue_alert_delivery(alert_id_param uuid, user_id_param uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.queue_alert_delivery(alert_id_param uuid, user_id_param uuid) IS 'Queue alert for delivery via configured channels';


--
-- Name: revoke_organization_invitation(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.revoke_organization_invitation(p_invitation_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
    UPDATE organization_invitations
    SET revoked_at = NOW()
    WHERE id = p_invitation_id
    AND accepted_at IS NULL
    AND revoked_at IS NULL;
    RETURN FOUND;
END;
$$;


--
-- Name: schedule_organization_deletion(uuid, uuid, text, text, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.schedule_organization_deletion(p_org_id uuid, p_requested_by uuid, p_reason text DEFAULT NULL::text, p_feedback text DEFAULT NULL::text, p_grace_days integer DEFAULT 30) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE
    v_org RECORD;
    v_result JSONB;
BEGIN
    -- Validate organization exists and is not already deleted
    SELECT * INTO v_org
    FROM organizations
    WHERE id = p_org_id
    AND deleted_at IS NULL;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Organization not found or already deleted';
    END IF;

    -- Check if already scheduled for deletion
    IF v_org.deletion_scheduled_at IS NOT NULL THEN
        RAISE EXCEPTION 'Organization is already scheduled for deletion on %',
            v_org.deletion_scheduled_at::DATE;
    END IF;

    -- Schedule deletion
    UPDATE organizations SET
        deletion_scheduled_at = NOW() + (p_grace_days || ' days')::INTERVAL,
        deletion_requested_by = p_requested_by,
        deletion_reason = p_reason,
        deletion_feedback = p_feedback,
        updated_at = NOW()
    WHERE id = p_org_id;

    -- Log the event
    INSERT INTO account_deletion_audit (
        organization_id, user_id, event_type, event_data, performed_by
    ) VALUES (
        p_org_id,
        p_requested_by,
        'deletion_requested',
        jsonb_build_object(
            'grace_days', p_grace_days,
            'scheduled_date', (NOW() + (p_grace_days || ' days')::INTERVAL)::TEXT,
            'reason', p_reason
        ),
        p_requested_by
    );

    v_result := jsonb_build_object(
        'success', true,
        'organization_id', p_org_id,
        'deletion_scheduled_at', (NOW() + (p_grace_days || ' days')::INTERVAL)::TEXT,
        'grace_days', p_grace_days,
        'message', 'Account scheduled for deletion. You can cancel within ' || p_grace_days || ' days.'
    );

    RETURN v_result;
END;
$$;


--
-- Name: FUNCTION schedule_organization_deletion(p_org_id uuid, p_requested_by uuid, p_reason text, p_feedback text, p_grace_days integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.schedule_organization_deletion(p_org_id uuid, p_requested_by uuid, p_reason text, p_feedback text, p_grace_days integer) IS 'Schedule organization for deletion with grace period (owner only)';


--
-- Name: set_authenticated_role(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_authenticated_role() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE
    jwt_claims jsonb;
BEGIN
    -- Get current JWT claims
    jwt_claims := current_setting('request.jwt.claims', true)::jsonb;
    
    -- If JWT has a 'sub' claim, it's a valid Auth0 JWT
    -- Switch to authenticated role for RLS
    IF jwt_claims IS NOT NULL AND jwt_claims ->> 'sub' IS NOT NULL THEN
        PERFORM set_config('role', 'authenticated', true);
    END IF;
EXCEPTION WHEN OTHERS THEN
    -- Keep current role if any error
    NULL;
END;
$$;


--
-- Name: slugify(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.slugify(text_to_slug text) RETURNS text
    LANGUAGE plpgsql IMMUTABLE
    SET search_path TO ''
    AS $_$
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
$_$;


--
-- Name: FUNCTION slugify(text_to_slug text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.slugify(text_to_slug text) IS 'Convert text to URL-safe slug: lowercase, hyphens, alphanumeric only.
Example: "Tesla Motors Inc." → "tesla-motors-inc"';


--
-- Name: trigger_auto_add_platform_staff_to_platform_org(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trigger_auto_add_platform_staff_to_platform_org() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  -- When role becomes super_admin/platform_admin OR is_platform_admin becomes true, add to platform org
  IF (NEW.role IN ('super_admin', 'platform_admin') OR NEW.is_platform_admin = true) AND 
     (OLD IS NULL OR (OLD.role NOT IN ('super_admin', 'platform_admin') AND OLD.is_platform_admin <> true)) THEN
    PERFORM add_user_to_platform_org(NEW.id);
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: trigger_lifecycle_alert(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trigger_lifecycle_alert() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
BEGIN
  IF OLD.lifecycle_status IS DISTINCT FROM NEW.lifecycle_status THEN
    PERFORM create_lifecycle_change_alert(
      NEW.id,
      OLD.lifecycle_status,
      NEW.lifecycle_status
    );
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: trigger_risk_level_alert(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trigger_risk_level_alert() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
BEGIN
  -- Only create alert if risk level changed and is high/critical
  IF OLD.risk_level IS DISTINCT FROM NEW.risk_level
     AND NEW.risk_level IN ('high', 'critical') THEN
    PERFORM create_risk_threshold_alert(
      NEW.component_id,
      OLD.risk_level,
      NEW.risk_level,
      NEW.total_risk_score
    );
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: trigger_set_invoice_number(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trigger_set_invoice_number() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF NEW.invoice_number IS NULL THEN
        NEW.invoice_number := generate_invoice_number();
    END IF;
    RETURN NEW;
END;
$$;


--
-- Name: trigger_update_billing_timestamp(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trigger_update_billing_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


--
-- Name: update_bom_enrichment_from_queue(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_bom_enrichment_from_queue() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
BEGIN
  UPDATE boms
  SET
    enrichment_status = CASE NEW.status
      WHEN 'queued' THEN 'queued'
      WHEN 'processing' THEN 'processing'
      WHEN 'completed' THEN 'enriched'
      WHEN 'failed' THEN 'failed'
      WHEN 'cancelled' THEN 'pending'
      ELSE enrichment_status
    END,
    enrichment_quality_score = NEW.quality_score,
    enrichment_started_at = NEW.started_at,
    enrichment_completed_at = NEW.completed_at,
    enrichment_failed_at = NEW.failed_at,
    enrichment_error = NEW.error_message,
    temporal_workflow_id = NEW.temporal_workflow_id,
    temporal_run_id = NEW.temporal_run_id,
    enrichment_match_rate = NEW.match_rate,
    enrichment_avg_confidence = NEW.avg_confidence
  WHERE id = NEW.bom_id;

  RETURN NEW;
END;
$$;


--
-- Name: update_bom_items_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_bom_items_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END; $$;


--
-- Name: update_bom_risk_summary_timestamp(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_bom_risk_summary_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
BEGIN
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$;


--
-- Name: update_bom_upload_workflow_status(uuid, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_bom_upload_workflow_status(p_upload_id uuid, p_workflow_id text, p_status text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
BEGIN
  UPDATE public.bom_uploads
  SET
    temporal_workflow_id = p_workflow_id,
    temporal_workflow_status = p_status,
    updated_at = NOW()
  WHERE id = p_upload_id;
END;
$$;


--
-- Name: update_bom_uploads_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_bom_uploads_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


--
-- Name: update_cns_bulk_uploads_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_cns_bulk_uploads_updated_at() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: update_cns_job_status(uuid, text, text, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_cns_job_status(p_upload_id uuid, p_cns_job_id text, p_job_status text, p_enrichment_summary jsonb DEFAULT NULL::jsonb) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
BEGIN
  UPDATE bom_uploads
  SET
    cns_job_id = p_cns_job_id,
    cns_job_status = p_job_status,
    enrichment_summary = COALESCE(p_enrichment_summary, enrichment_summary),
    updated_at = NOW()
  WHERE id = p_upload_id;
END;
$$;


--
-- Name: update_onboarding_checklist(uuid, text, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_onboarding_checklist(p_org_id uuid, p_step text, p_completed boolean DEFAULT true) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_checklist JSONB;
    v_all_complete BOOLEAN;
BEGIN
    -- Update the specific step
    UPDATE organizations
    SET onboarding_checklist = jsonb_set(
        COALESCE(onboarding_checklist, '{}'::jsonb),
        ARRAY[p_step],
        to_jsonb(p_completed)
    )
    WHERE id = p_org_id
    RETURNING onboarding_checklist INTO v_checklist;

    -- Check if all steps are complete
    SELECT (
        COALESCE((v_checklist->>'first_bom_uploaded')::boolean, false)
        AND COALESCE((v_checklist->>'first_enrichment_complete')::boolean, false)
        AND COALESCE((v_checklist->>'team_member_invited')::boolean, false)
        AND COALESCE((v_checklist->>'alert_preferences_configured')::boolean, false)
        AND COALESCE((v_checklist->>'risk_thresholds_set')::boolean, false)
    ) INTO v_all_complete;

    -- If all complete and not already marked, set completion timestamp
    IF v_all_complete THEN
        UPDATE organizations
        SET onboarding_completed_at = COALESCE(onboarding_completed_at, NOW())
        WHERE id = p_org_id;
    END IF;

    RETURN v_all_complete;
END;
$$;


--
-- Name: FUNCTION update_onboarding_checklist(p_org_id uuid, p_step text, p_completed boolean); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.update_onboarding_checklist(p_org_id uuid, p_step text, p_completed boolean) IS 'Updates onboarding checklist and marks completion if all steps done';


--
-- Name: update_organization_settings(uuid, uuid, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_organization_settings(p_org_id uuid, p_user_id uuid, p_settings jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $_$
DECLARE
    v_current RECORD;
    v_key TEXT;
    v_value TEXT;
    v_old_value TEXT;
BEGIN
    -- Get current organization
    SELECT * INTO v_current FROM organizations WHERE id = p_org_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Organization not found');
    END IF;

    -- Update each setting and log changes
    FOR v_key, v_value IN SELECT * FROM jsonb_each_text(p_settings)
    LOOP
        -- Get old value
        EXECUTE format('SELECT %I::TEXT FROM organizations WHERE id = $1', v_key)
            INTO v_old_value USING p_org_id;

        -- Skip if value hasn't changed
        IF v_old_value IS DISTINCT FROM v_value THEN
            -- Update the column
            EXECUTE format('UPDATE organizations SET %I = $1 WHERE id = $2', v_key)
                USING v_value, p_org_id;

            -- Log the change
            INSERT INTO organization_settings_audit (
                organization_id, changed_by, setting_name, old_value, new_value
            ) VALUES (
                p_org_id, p_user_id, v_key, v_old_value, v_value
            );
        END IF;
    END LOOP;

    RETURN jsonb_build_object('success', true);
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$_$;


--
-- Name: update_risk_profile_timestamp(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_risk_profile_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
BEGIN
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$;


--
-- Name: update_search_vector(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_search_vector() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
BEGIN
    NEW.search_vector := to_tsvector('english',
        COALESCE(NEW.mpn, '') || ' ' ||
        COALESCE(NEW.description, '')
    );
    RETURN NEW;
END;
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


--
-- Name: update_user_preferences_timestamp(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_user_preferences_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: update_workspaces_timestamp(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_workspaces_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


--
-- Name: audit_log_entries; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.audit_log_entries (
    instance_id uuid,
    id uuid NOT NULL,
    payload json,
    created_at timestamp with time zone,
    ip_address character varying(64) DEFAULT ''::character varying NOT NULL
);


--
-- Name: TABLE audit_log_entries; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.audit_log_entries IS 'Auth: Audit trail for user actions.';


--
-- Name: flow_state; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.flow_state (
    id uuid NOT NULL,
    user_id uuid,
    auth_code text NOT NULL,
    code_challenge_method public.code_challenge_method NOT NULL,
    code_challenge text NOT NULL,
    provider_type text NOT NULL,
    provider_access_token text,
    provider_refresh_token text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    authentication_method text NOT NULL
);


--
-- Name: TABLE flow_state; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.flow_state IS 'stores metadata for pkce logins';


--
-- Name: identities; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.identities (
    provider_id text NOT NULL,
    user_id uuid NOT NULL,
    identity_data jsonb NOT NULL,
    provider text NOT NULL,
    last_sign_in_at timestamp with time zone,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    email text GENERATED ALWAYS AS (lower((identity_data ->> 'email'::text))) STORED,
    id uuid DEFAULT gen_random_uuid() NOT NULL
);


--
-- Name: TABLE identities; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.identities IS 'Auth: Stores identities associated to a user.';


--
-- Name: COLUMN identities.email; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.identities.email IS 'Auth: Email is a generated column that references the optional email property in the identity_data';


--
-- Name: instances; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.instances (
    id uuid NOT NULL,
    uuid uuid,
    raw_base_config text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);


--
-- Name: TABLE instances; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.instances IS 'Auth: Manages users across multiple sites.';


--
-- Name: mfa_amr_claims; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.mfa_amr_claims (
    session_id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    authentication_method text NOT NULL,
    id uuid NOT NULL
);


--
-- Name: TABLE mfa_amr_claims; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.mfa_amr_claims IS 'auth: stores authenticator method reference claims for multi factor authentication';


--
-- Name: mfa_challenges; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.mfa_challenges (
    id uuid NOT NULL,
    factor_id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL,
    verified_at timestamp with time zone,
    ip_address inet NOT NULL
);


--
-- Name: TABLE mfa_challenges; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.mfa_challenges IS 'auth: stores metadata about challenge requests made';


--
-- Name: mfa_factors; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.mfa_factors (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    friendly_name text,
    factor_type public.factor_type NOT NULL,
    status public.factor_status NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    secret text
);


--
-- Name: TABLE mfa_factors; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.mfa_factors IS 'auth: stores metadata about factors';


--
-- Name: refresh_tokens; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.refresh_tokens (
    instance_id uuid,
    id bigint NOT NULL,
    token character varying(255),
    user_id character varying(255),
    revoked boolean,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    parent character varying(255),
    session_id uuid
);


--
-- Name: TABLE refresh_tokens; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.refresh_tokens IS 'Auth: Store of tokens used to refresh JWT tokens once they expire.';


--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE; Schema: auth; Owner: -
--

CREATE SEQUENCE auth.refresh_tokens_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE OWNED BY; Schema: auth; Owner: -
--

ALTER SEQUENCE auth.refresh_tokens_id_seq OWNED BY auth.refresh_tokens.id;


--
-- Name: saml_providers; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.saml_providers (
    id uuid NOT NULL,
    sso_provider_id uuid NOT NULL,
    entity_id text NOT NULL,
    metadata_xml text NOT NULL,
    metadata_url text,
    attribute_mapping jsonb,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    CONSTRAINT "entity_id not empty" CHECK ((char_length(entity_id) > 0)),
    CONSTRAINT "metadata_url not empty" CHECK (((metadata_url = NULL::text) OR (char_length(metadata_url) > 0))),
    CONSTRAINT "metadata_xml not empty" CHECK ((char_length(metadata_xml) > 0))
);


--
-- Name: TABLE saml_providers; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.saml_providers IS 'Auth: Manages SAML Identity Provider connections.';


--
-- Name: saml_relay_states; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.saml_relay_states (
    id uuid NOT NULL,
    sso_provider_id uuid NOT NULL,
    request_id text NOT NULL,
    for_email text,
    redirect_to text,
    from_ip_address inet,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    flow_state_id uuid,
    CONSTRAINT "request_id not empty" CHECK ((char_length(request_id) > 0))
);


--
-- Name: TABLE saml_relay_states; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.saml_relay_states IS 'Auth: Contains SAML Relay State information for each Service Provider initiated login.';


--
-- Name: schema_migrations; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.schema_migrations (
    version character varying(255) NOT NULL
);


--
-- Name: TABLE schema_migrations; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.schema_migrations IS 'Auth: Manages updates to the auth system.';


--
-- Name: sessions; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.sessions (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    factor_id uuid,
    aal public.aal_level,
    not_after timestamp with time zone,
    refreshed_at timestamp without time zone,
    user_agent text,
    ip inet,
    tag text
);


--
-- Name: TABLE sessions; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.sessions IS 'Auth: Stores session data associated to a user.';


--
-- Name: COLUMN sessions.not_after; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.sessions.not_after IS 'Auth: Not after is a nullable column that contains a timestamp after which the session should be regarded as expired.';


--
-- Name: sso_domains; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.sso_domains (
    id uuid NOT NULL,
    sso_provider_id uuid NOT NULL,
    domain text NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    CONSTRAINT "domain not empty" CHECK ((char_length(domain) > 0))
);


--
-- Name: TABLE sso_domains; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.sso_domains IS 'Auth: Manages SSO email address domain mapping to an SSO Identity Provider.';


--
-- Name: sso_providers; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.sso_providers (
    id uuid NOT NULL,
    resource_id text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    CONSTRAINT "resource_id not empty" CHECK (((resource_id = NULL::text) OR (char_length(resource_id) > 0)))
);


--
-- Name: TABLE sso_providers; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.sso_providers IS 'Auth: Manages SSO identity provider information; see saml_providers for SAML.';


--
-- Name: COLUMN sso_providers.resource_id; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.sso_providers.resource_id IS 'Auth: Uniquely identifies a SSO provider according to a user-chosen resource ID (case insensitive), useful in infrastructure as code.';


--
-- Name: users; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.users (
    instance_id uuid,
    id uuid NOT NULL,
    aud character varying(255),
    role character varying(255),
    email character varying(255),
    encrypted_password character varying(255),
    email_confirmed_at timestamp with time zone,
    invited_at timestamp with time zone,
    confirmation_token character varying(255),
    confirmation_sent_at timestamp with time zone,
    recovery_token character varying(255),
    recovery_sent_at timestamp with time zone,
    email_change_token_new character varying(255),
    email_change character varying(255),
    email_change_sent_at timestamp with time zone,
    last_sign_in_at timestamp with time zone,
    raw_app_meta_data jsonb,
    raw_user_meta_data jsonb,
    is_super_admin boolean,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    phone text DEFAULT NULL::character varying,
    phone_confirmed_at timestamp with time zone,
    phone_change text DEFAULT ''::character varying,
    phone_change_token character varying(255) DEFAULT ''::character varying,
    phone_change_sent_at timestamp with time zone,
    confirmed_at timestamp with time zone GENERATED ALWAYS AS (LEAST(email_confirmed_at, phone_confirmed_at)) STORED,
    email_change_token_current character varying(255) DEFAULT ''::character varying,
    email_change_confirm_status smallint DEFAULT 0,
    banned_until timestamp with time zone,
    reauthentication_token character varying(255) DEFAULT ''::character varying,
    reauthentication_sent_at timestamp with time zone,
    is_sso_user boolean DEFAULT false NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT users_email_change_confirm_status_check CHECK (((email_change_confirm_status >= 0) AND (email_change_confirm_status <= 2)))
);


--
-- Name: TABLE users; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.users IS 'Auth: Stores user login data within a secure schema.';


--
-- Name: COLUMN users.is_sso_user; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.users.is_sso_user IS 'Auth: Set this column to true when the account comes from SSO. These accounts can have duplicate emails.';


--
-- Name: account_deletion_audit; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.account_deletion_audit (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    user_id uuid,
    event_type text NOT NULL,
    event_data jsonb DEFAULT '{}'::jsonb,
    performed_by uuid,
    ip_address inet,
    user_agent text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE account_deletion_audit; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.account_deletion_audit IS 'Audit log for account deletion events (GDPR compliance)';


--
-- Name: alert_deliveries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.alert_deliveries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    alert_id uuid NOT NULL,
    delivery_method text NOT NULL,
    recipient text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    attempt_count integer DEFAULT 0,
    max_attempts integer DEFAULT 5,
    next_retry_at timestamp with time zone,
    delivered_at timestamp with time zone,
    error_message text,
    response_code integer,
    response_data jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    novu_transaction_id character varying(255),
    novu_message_id character varying(255),
    CONSTRAINT alert_deliveries_delivery_method_check CHECK ((delivery_method = ANY (ARRAY['email'::text, 'webhook'::text, 'sms'::text, 'in_app'::text]))),
    CONSTRAINT alert_deliveries_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'processing'::text, 'delivered'::text, 'failed'::text, 'retrying'::text])))
);


--
-- Name: TABLE alert_deliveries; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.alert_deliveries IS 'Track alert delivery attempts and results';


--
-- Name: COLUMN alert_deliveries.novu_transaction_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.alert_deliveries.novu_transaction_id IS 'Novu event transaction ID for tracking';


--
-- Name: COLUMN alert_deliveries.novu_message_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.alert_deliveries.novu_message_id IS 'Novu message ID for specific delivery';


--
-- Name: alert_preferences; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.alert_preferences (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    organization_id uuid NOT NULL,
    alert_type text NOT NULL,
    email_enabled boolean DEFAULT true,
    webhook_enabled boolean DEFAULT false,
    in_app_enabled boolean DEFAULT true,
    email_address text,
    webhook_url text,
    component_filter jsonb DEFAULT '{}'::jsonb,
    threshold_config jsonb DEFAULT '{}'::jsonb,
    batch_enabled boolean DEFAULT false,
    batch_time time without time zone,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    novu_channels jsonb DEFAULT '["in_app"]'::jsonb,
    novu_preference_synced boolean DEFAULT false,
    CONSTRAINT alert_preferences_alert_type_check CHECK ((alert_type = ANY (ARRAY['LIFECYCLE'::text, 'RISK'::text, 'PRICE'::text, 'AVAILABILITY'::text, 'COMPLIANCE'::text, 'PCN'::text, 'SUPPLY_CHAIN'::text])))
);


--
-- Name: TABLE alert_preferences; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.alert_preferences IS 'User preferences for alert delivery and filtering';


--
-- Name: COLUMN alert_preferences.user_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.alert_preferences.user_id IS 'User ID from Supabase auth. NULL for Auth0 users (who use organization_id only). Auth0 user_ids like google-oauth2|... are not valid UUIDs.';


--
-- Name: COLUMN alert_preferences.component_filter; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.alert_preferences.component_filter IS 'JSON filter for components (e.g., {"category": "Capacitors"})';


--
-- Name: COLUMN alert_preferences.threshold_config; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.alert_preferences.threshold_config IS 'JSON thresholds (e.g., {"risk_min": 60, "price_change_pct": 10})';


--
-- Name: COLUMN alert_preferences.novu_channels; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.alert_preferences.novu_channels IS 'Novu delivery channels for this alert type (in_app, email, webhook, sms, push)';


--
-- Name: COLUMN alert_preferences.novu_preference_synced; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.alert_preferences.novu_preference_synced IS 'Whether preference has been synced to Novu subscriber preferences';


--
-- Name: alerts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.alerts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    component_id uuid,
    severity text NOT NULL,
    alert_type text NOT NULL,
    title text NOT NULL,
    message text,
    is_read boolean DEFAULT false,
    is_dismissed boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    read_at timestamp with time zone,
    dismissed_at timestamp with time zone,
    user_id uuid,
    context jsonb DEFAULT '{}'::jsonb,
    action_url text,
    delivered_at timestamp with time zone,
    archived_at timestamp with time zone,
    snoozed_until timestamp with time zone,
    deleted_at timestamp with time zone,
    CONSTRAINT alerts_alert_type_check CHECK ((alert_type = ANY (ARRAY['LIFECYCLE'::text, 'RISK'::text, 'PRICE'::text, 'AVAILABILITY'::text, 'COMPLIANCE'::text, 'PCN'::text, 'SUPPLY_CHAIN'::text]))),
    CONSTRAINT alerts_severity_check CHECK ((severity = ANY (ARRAY['LOW'::text, 'MEDIUM'::text, 'HIGH'::text, 'CRITICAL'::text])))
);


--
-- Name: TABLE alerts; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.alerts IS 'Component lifecycle, risk, and compliance alerts';


--
-- Name: COLUMN alerts.user_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.alerts.user_id IS 'User who should receive this alert';


--
-- Name: COLUMN alerts.context; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.alerts.context IS 'Additional context data for the alert (JSONB)';


--
-- Name: COLUMN alerts.action_url; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.alerts.action_url IS 'URL for alert action button';


--
-- Name: COLUMN alerts.snoozed_until; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.alerts.snoozed_until IS 'Alert is hidden until this timestamp';


--
-- Name: COLUMN alerts.deleted_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.alerts.deleted_at IS 'Soft delete timestamp';


--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    event_type character varying(100) NOT NULL,
    routing_key character varying(100) NOT NULL,
    "timestamp" timestamp with time zone DEFAULT now() NOT NULL,
    user_id character varying(255),
    username character varying(255),
    email character varying(255),
    ip_address character varying(50),
    user_agent text,
    source character varying(50),
    event_data jsonb,
    session_id character varying(255),
    organization_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE audit_logs; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.audit_logs IS 'Comprehensive audit trail for all platform events';


--
-- Name: COLUMN audit_logs.organization_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.audit_logs.organization_id IS 'Organization ID (renamed from tenant_id for consistency)';


--
-- Name: billing_customers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.billing_customers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    billing_email text NOT NULL,
    billing_name text,
    billing_address jsonb DEFAULT '{}'::jsonb,
    tax_id text,
    tax_exempt boolean DEFAULT false,
    provider_customer_ids jsonb DEFAULT '{}'::jsonb,
    default_payment_method_id uuid,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE billing_customers; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.billing_customers IS 'Billing profiles linked to organizations';


--
-- Name: billing_webhook_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.billing_webhook_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    provider text NOT NULL,
    provider_event_id text NOT NULL,
    event_type text NOT NULL,
    payload jsonb NOT NULL,
    processed boolean DEFAULT false,
    processed_at timestamp with time zone,
    processing_error text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE billing_webhook_events; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.billing_webhook_events IS 'Webhook events from payment providers for idempotency';


--
-- Name: bom_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bom_items (
    id integer NOT NULL,
    job_id character varying(100) NOT NULL,
    line_number integer NOT NULL,
    mpn character varying(255),
    manufacturer character varying(255),
    quantity integer,
    reference_designator text,
    description text,
    component_id integer,
    enriched_mpn character varying(255),
    enriched_manufacturer character varying(255),
    specifications jsonb,
    datasheet_url text,
    lifecycle_status character varying(50),
    estimated_lifetime date,
    compliance_status jsonb,
    pricing jsonb,
    match_confidence numeric(5,2),
    quality_score integer,
    routing_destination character varying(50) DEFAULT 'staging'::character varying,
    enrichment_status character varying(50) DEFAULT 'pending'::character varying,
    error_message text,
    retry_count integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: bom_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.bom_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: bom_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.bom_items_id_seq OWNED BY public.bom_items.id;


--
-- Name: bom_jobs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bom_jobs (
    id integer NOT NULL,
    job_id character varying(100) NOT NULL,
    customer_id integer,
    customer_name character varying(255),
    filename character varying(255),
    file_size integer,
    total_items integer,
    status character varying(50) DEFAULT 'pending'::character varying,
    progress integer DEFAULT 0,
    items_processed integer DEFAULT 0,
    items_auto_approved integer DEFAULT 0,
    items_in_staging integer DEFAULT 0,
    items_rejected integer DEFAULT 0,
    items_failed integer DEFAULT 0,
    started_at timestamp without time zone,
    completed_at timestamp without time zone,
    processing_time_ms integer,
    error_message text,
    results_data jsonb,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    organization_id integer,
    project_id integer,
    source character varying(50) DEFAULT 'customer'::character varying,
    source_metadata jsonb,
    priority integer DEFAULT 5
);


--
-- Name: TABLE bom_jobs; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.bom_jobs IS 'Tracks BOM upload and enrichment jobs from customers';


--
-- Name: COLUMN bom_jobs.job_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.bom_jobs.job_id IS 'UUID for tracking job status via WebSocket';


--
-- Name: bom_jobs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.bom_jobs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: bom_jobs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.bom_jobs_id_seq OWNED BY public.bom_jobs.id;


--
-- Name: bom_line_item_risk_scores; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bom_line_item_risk_scores (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bom_line_item_id uuid NOT NULL,
    organization_id uuid NOT NULL,
    base_risk_id uuid,
    base_risk_score integer DEFAULT 0 NOT NULL,
    quantity_modifier integer DEFAULT 0,
    lead_time_modifier integer DEFAULT 0,
    criticality_modifier integer DEFAULT 0,
    user_criticality_level integer DEFAULT 5,
    contextual_risk_score integer DEFAULT 0 NOT NULL,
    risk_level text DEFAULT 'low'::text,
    alternates_available integer DEFAULT 0,
    alternate_risk_reduction integer DEFAULT 0,
    calculated_at timestamp with time zone DEFAULT now(),
    profile_version_used uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT bom_line_item_risk_scores_alternate_risk_reduction_check CHECK (((alternate_risk_reduction >= 0) AND (alternate_risk_reduction <= 100))),
    CONSTRAINT bom_line_item_risk_scores_base_risk_score_check CHECK (((base_risk_score >= 0) AND (base_risk_score <= 100))),
    CONSTRAINT bom_line_item_risk_scores_contextual_risk_score_check CHECK (((contextual_risk_score >= 0) AND (contextual_risk_score <= 100))),
    CONSTRAINT bom_line_item_risk_scores_criticality_modifier_check CHECK (((criticality_modifier >= 0) AND (criticality_modifier <= 100))),
    CONSTRAINT bom_line_item_risk_scores_lead_time_modifier_check CHECK (((lead_time_modifier >= 0) AND (lead_time_modifier <= 100))),
    CONSTRAINT bom_line_item_risk_scores_quantity_modifier_check CHECK (((quantity_modifier >= 0) AND (quantity_modifier <= 100))),
    CONSTRAINT bom_line_item_risk_scores_risk_level_check CHECK ((risk_level = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text, 'critical'::text]))),
    CONSTRAINT bom_line_item_risk_scores_user_criticality_level_check CHECK (((user_criticality_level >= 1) AND (user_criticality_level <= 10)))
);


--
-- Name: TABLE bom_line_item_risk_scores; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.bom_line_item_risk_scores IS 'Contextual risk scores per BOM line item with usage-context modifiers';


--
-- Name: bom_line_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bom_line_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bom_id uuid NOT NULL,
    line_number integer,
    reference_designator text,
    manufacturer_part_number text,
    mpn_raw text,
    manufacturer text,
    manufacturer_raw text,
    description text,
    description_raw text,
    quantity integer DEFAULT 1,
    matched_component_id uuid,
    component_id uuid,
    match_confidence numeric(5,2),
    match_method text,
    match_status text,
    enrichment_status text DEFAULT 'pending'::text,
    enriched_mpn text,
    enriched_manufacturer text,
    enrichment_error text,
    specifications jsonb,
    datasheet_url text,
    lifecycle_status text,
    estimated_lifetime timestamp with time zone,
    compliance_status jsonb,
    pricing jsonb,
    enriched_at timestamp with time zone,
    component_storage text DEFAULT 'database'::text,
    redis_component_key text,
    unit_price numeric(10,4),
    extended_price numeric(12,2),
    risk_level text,
    metadata jsonb DEFAULT '{}'::jsonb,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT bom_line_items_component_storage_check CHECK ((component_storage = ANY (ARRAY['database'::text, 'redis'::text]))),
    CONSTRAINT bom_line_items_enrichment_status_check CHECK ((enrichment_status = ANY (ARRAY['pending'::text, 'matched'::text, 'enriched'::text, 'no_match'::text, 'error'::text]))),
    CONSTRAINT bom_line_items_match_method_check CHECK ((match_method = ANY (ARRAY['exact'::text, 'fuzzy'::text, 'manual'::text, 'unmatched'::text]))),
    CONSTRAINT bom_line_items_risk_level_check CHECK ((risk_level = ANY (ARRAY['GREEN'::text, 'YELLOW'::text, 'ORANGE'::text, 'RED'::text])))
);


--
-- Name: TABLE bom_line_items; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.bom_line_items IS 'Individual component line items with enrichment status and storage tracking';


--
-- Name: COLUMN bom_line_items.component_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.bom_line_items.component_id IS 'Links to central component catalog in Components V2 database. NULL means enrichment pending or failed.';


--
-- Name: COLUMN bom_line_items.component_storage; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.bom_line_items.component_storage IS 'Storage location for component data: database (Components V2) or redis (temporary)';


--
-- Name: bom_risk_summaries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bom_risk_summaries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bom_id uuid NOT NULL,
    organization_id uuid NOT NULL,
    low_risk_count integer DEFAULT 0,
    medium_risk_count integer DEFAULT 0,
    high_risk_count integer DEFAULT 0,
    critical_risk_count integer DEFAULT 0,
    total_line_items integer DEFAULT 0,
    average_risk_score numeric(5,2) DEFAULT 0,
    weighted_risk_score numeric(5,2) DEFAULT 0,
    max_risk_score integer DEFAULT 0,
    min_risk_score integer DEFAULT 0,
    health_grade text DEFAULT 'A'::text,
    top_risk_factors jsonb DEFAULT '[]'::jsonb,
    top_risk_components jsonb DEFAULT '[]'::jsonb,
    previous_average_score numeric(5,2),
    score_trend text DEFAULT 'stable'::text,
    calculated_at timestamp with time zone DEFAULT now(),
    profile_version_used uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT bom_risk_summaries_average_risk_score_check CHECK (((average_risk_score >= (0)::numeric) AND (average_risk_score <= (100)::numeric))),
    CONSTRAINT bom_risk_summaries_critical_risk_count_check CHECK ((critical_risk_count >= 0)),
    CONSTRAINT bom_risk_summaries_health_grade_check CHECK ((health_grade = ANY (ARRAY['A'::text, 'B'::text, 'C'::text, 'D'::text, 'F'::text]))),
    CONSTRAINT bom_risk_summaries_high_risk_count_check CHECK ((high_risk_count >= 0)),
    CONSTRAINT bom_risk_summaries_low_risk_count_check CHECK ((low_risk_count >= 0)),
    CONSTRAINT bom_risk_summaries_max_risk_score_check CHECK (((max_risk_score >= 0) AND (max_risk_score <= 100))),
    CONSTRAINT bom_risk_summaries_medium_risk_count_check CHECK ((medium_risk_count >= 0)),
    CONSTRAINT bom_risk_summaries_min_risk_score_check CHECK (((min_risk_score >= 0) AND (min_risk_score <= 100))),
    CONSTRAINT bom_risk_summaries_score_trend_check CHECK ((score_trend = ANY (ARRAY['improving'::text, 'stable'::text, 'worsening'::text]))),
    CONSTRAINT bom_risk_summaries_total_line_items_check CHECK ((total_line_items >= 0)),
    CONSTRAINT bom_risk_summaries_weighted_risk_score_check CHECK (((weighted_risk_score >= (0)::numeric) AND (weighted_risk_score <= (100)::numeric)))
);


--
-- Name: TABLE bom_risk_summaries; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.bom_risk_summaries IS 'Aggregate BOM health scores with distribution and grade';


--
-- Name: boms; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.boms (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    project_id uuid,
    name text NOT NULL,
    version text,
    description text,
    metadata jsonb DEFAULT '{}'::jsonb,
    grade text,
    status text DEFAULT 'pending'::text,
    component_count integer DEFAULT 0,
    total_cost numeric(12,2),
    high_risk_count integer DEFAULT 0,
    medium_risk_count integer DEFAULT 0,
    low_risk_count integer DEFAULT 0,
    enrichment_status text DEFAULT 'pending'::text,
    enrichment_priority integer DEFAULT 5,
    enrichment_quality_score integer,
    enrichment_queued_at timestamp with time zone,
    enrichment_started_at timestamp with time zone,
    enrichment_completed_at timestamp with time zone,
    enrichment_failed_at timestamp with time zone,
    enrichment_error text,
    temporal_workflow_id text,
    temporal_run_id text,
    enrichment_match_rate numeric(5,2),
    enrichment_avg_confidence numeric(5,2),
    enrichment_progress jsonb DEFAULT '{"total_items": 0, "failed_items": 0, "last_updated": null, "pending_items": 0, "enriched_items": 0}'::jsonb,
    analyzed_at timestamp with time zone,
    analysis_version text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    source text,
    raw_file_s3_key text,
    parsed_file_s3_key text,
    priority text DEFAULT 'normal'::text,
    risk_score integer DEFAULT 0,
    risk_grade text DEFAULT 'N/A'::text,
    risk_factors jsonb DEFAULT '{}'::jsonb,
    CONSTRAINT boms_enrichment_priority_check CHECK (((enrichment_priority >= 1) AND (enrichment_priority <= 10))),
    CONSTRAINT boms_enrichment_quality_score_check CHECK (((enrichment_quality_score >= 0) AND (enrichment_quality_score <= 100))),
    CONSTRAINT boms_enrichment_status_check CHECK ((enrichment_status = ANY (ARRAY['pending'::text, 'queued'::text, 'processing'::text, 'enriched'::text, 'failed'::text, 'requires_approval'::text]))),
    CONSTRAINT boms_grade_check CHECK ((grade = ANY (ARRAY['A'::text, 'B'::text, 'C'::text, 'D'::text, 'E'::text, 'F'::text, 'N/A'::text]))),
    CONSTRAINT boms_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'analyzing'::text, 'completed'::text, 'failed'::text, 'processing'::text, 'cancelled'::text, 'enriching'::text, 'mapping_pending'::text])))
);


--
-- Name: TABLE boms; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.boms IS 'Bill of Materials with enrichment tracking and central catalog integration';


--
-- Name: COLUMN boms.risk_score; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.boms.risk_score IS 'Overall risk score 0-100 (higher = more risky)';


--
-- Name: COLUMN boms.risk_grade; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.boms.risk_grade IS 'Letter grade A-F based on risk score';


--
-- Name: COLUMN boms.risk_factors; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.boms.risk_factors IS 'Breakdown of risk by category (lifecycle, supply_chain, compliance, obsolescence, single_source)';


--
-- Name: boms_with_risk; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.boms_with_risk AS
 SELECT b.id,
    b.organization_id,
    b.project_id,
    b.name,
    b.version,
    b.description,
    b.metadata,
    b.grade,
    b.status,
    b.component_count,
    b.total_cost,
    b.high_risk_count,
    b.medium_risk_count,
    b.low_risk_count,
    b.enrichment_status,
    b.enrichment_priority,
    b.enrichment_quality_score,
    b.enrichment_queued_at,
    b.enrichment_started_at,
    b.enrichment_completed_at,
    b.enrichment_failed_at,
    b.enrichment_error,
    b.temporal_workflow_id,
    b.temporal_run_id,
    b.enrichment_match_rate,
    b.enrichment_avg_confidence,
    b.enrichment_progress,
    b.analyzed_at,
    b.analysis_version,
    b.created_at,
    b.updated_at,
    b.source,
    b.raw_file_s3_key,
    b.parsed_file_s3_key,
    b.priority,
    brs.average_risk_score,
    brs.weighted_risk_score,
    brs.health_grade,
    brs.low_risk_count AS risk_low_count,
    brs.medium_risk_count AS risk_medium_count,
    brs.high_risk_count AS risk_high_count,
    brs.critical_risk_count AS risk_critical_count,
    brs.score_trend,
    brs.top_risk_factors,
    brs.calculated_at AS risk_calculated_at
   FROM (public.boms b
     LEFT JOIN public.bom_risk_summaries brs ON ((b.id = brs.bom_id)));


--
-- Name: VIEW boms_with_risk; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON VIEW public.boms_with_risk IS 'BOMs joined with their risk summaries for easy querying';


--
-- Name: cns_bulk_uploads; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cns_bulk_uploads (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    filename text NOT NULL,
    file_size bigint NOT NULL,
    file_type text NOT NULL,
    original_name text NOT NULL,
    s3_bucket text DEFAULT 'bulk-uploads'::text NOT NULL,
    s3_key text NOT NULL,
    s3_url text,
    storage_backend text DEFAULT 'minio'::text NOT NULL,
    tenant_id uuid NOT NULL,
    organization_id uuid NOT NULL,
    project_id uuid,
    uploaded_by uuid,
    status text DEFAULT 'uploaded'::text NOT NULL,
    validation_status text,
    validation_errors jsonb,
    total_rows integer DEFAULT 0,
    valid_rows integer DEFAULT 0,
    invalid_rows integer DEFAULT 0,
    preview_data jsonb,
    detected_columns jsonb,
    column_mappings jsonb,
    unmapped_columns text[],
    mapping_confirmed boolean DEFAULT false,
    mapping_confirmed_at timestamp with time zone,
    parse_stats jsonb,
    processing_settings jsonb,
    cns_job_id text,
    cns_job_status text,
    rabbitmq_event_published boolean DEFAULT false,
    rabbitmq_event_published_at timestamp with time zone,
    temporal_workflow_id text,
    temporal_workflow_status text,
    enrichment_summary jsonb,
    results_s3_key text,
    failed_items_s3_key text,
    error_message text,
    error_details jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    archived boolean DEFAULT false,
    archived_at timestamp with time zone,
    archive_s3_key text
);


--
-- Name: TABLE cns_bulk_uploads; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.cns_bulk_uploads IS 'Tracks CNS bulk upload files stored in MinIO/S3. Similar to bom_uploads but for CNS admin bulk operations.';


--
-- Name: component_base_risk_scores; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.component_base_risk_scores (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    mpn text NOT NULL,
    manufacturer text NOT NULL,
    lifecycle_risk integer DEFAULT 0,
    supply_chain_risk integer DEFAULT 0,
    compliance_risk integer DEFAULT 0,
    obsolescence_risk integer DEFAULT 0,
    single_source_risk integer DEFAULT 0,
    default_total_score integer DEFAULT 0,
    default_risk_level text DEFAULT 'low'::text,
    risk_factors jsonb DEFAULT '{}'::jsonb,
    calculation_date timestamp with time zone DEFAULT now(),
    calculation_method text DEFAULT 'weighted_average_v1'::text,
    data_sources text[] DEFAULT ARRAY[]::text[],
    lead_time_days integer,
    stock_quantity integer,
    supplier_count integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT component_base_risk_scores_compliance_risk_check CHECK (((compliance_risk >= 0) AND (compliance_risk <= 100))),
    CONSTRAINT component_base_risk_scores_default_risk_level_check CHECK ((default_risk_level = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text, 'critical'::text]))),
    CONSTRAINT component_base_risk_scores_default_total_score_check CHECK (((default_total_score >= 0) AND (default_total_score <= 100))),
    CONSTRAINT component_base_risk_scores_lifecycle_risk_check CHECK (((lifecycle_risk >= 0) AND (lifecycle_risk <= 100))),
    CONSTRAINT component_base_risk_scores_obsolescence_risk_check CHECK (((obsolescence_risk >= 0) AND (obsolescence_risk <= 100))),
    CONSTRAINT component_base_risk_scores_single_source_risk_check CHECK (((single_source_risk >= 0) AND (single_source_risk <= 100))),
    CONSTRAINT component_base_risk_scores_supply_chain_risk_check CHECK (((supply_chain_risk >= 0) AND (supply_chain_risk <= 100)))
);


--
-- Name: TABLE component_base_risk_scores; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.component_base_risk_scores IS 'Base risk scores for components calculated from enrichment data';


--
-- Name: component_watches; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.component_watches (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    component_id uuid NOT NULL,
    watch_pcn boolean DEFAULT true,
    watch_lifecycle boolean DEFAULT true,
    watch_risk boolean DEFAULT true,
    watch_price boolean DEFAULT false,
    watch_stock boolean DEFAULT false,
    watch_compliance boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    watch_supply_chain boolean DEFAULT true
);


--
-- Name: TABLE component_watches; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.component_watches IS 'Track which components users are watching for alerts';


--
-- Name: COLUMN component_watches.watch_supply_chain; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.component_watches.watch_supply_chain IS 'Watch for supply chain alerts (scarcity, single-source)';


--
-- Name: enrichment_audit_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.enrichment_audit_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bom_id uuid NOT NULL,
    organization_id uuid NOT NULL,
    event_type text NOT NULL,
    event_data jsonb,
    temporal_workflow_id text,
    temporal_activity_id text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT enrichment_audit_log_event_type_check CHECK ((event_type = ANY (ARRAY['queued'::text, 'quality_check_passed'::text, 'quality_check_failed'::text, 'started'::text, 'matching_batch_complete'::text, 'enrichment_complete'::text, 'admin_approval_requested'::text, 'admin_approved'::text, 'admin_rejected'::text, 'completed'::text, 'failed'::text, 'cancelled'::text])))
);


--
-- Name: TABLE enrichment_audit_log; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.enrichment_audit_log IS 'Audit trail for all enrichment workflow events';


--
-- Name: enrichment_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.enrichment_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    event_id character varying(255) NOT NULL,
    event_type character varying(100) NOT NULL,
    routing_key character varying(255),
    bom_id uuid NOT NULL,
    organization_id uuid NOT NULL,
    project_id uuid,
    user_id uuid,
    source character varying(20) NOT NULL,
    workflow_id character varying(255),
    workflow_run_id character varying(255),
    state jsonb NOT NULL,
    payload jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT enrichment_events_source_check CHECK (((source)::text = ANY ((ARRAY['customer'::character varying, 'staff'::character varying])::text[])))
);


--
-- Name: TABLE enrichment_events; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.enrichment_events IS 'Real-time enrichment progress events with embedded state snapshots';


--
-- Name: COLUMN enrichment_events.state; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.enrichment_events.state IS 'Full enrichment state snapshot at time of event (enables UI updates without DB polling)';


--
-- Name: enrichment_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.enrichment_history (
    id integer NOT NULL,
    mpn character varying(255) NOT NULL,
    enrichment_data jsonb,
    quality_score numeric(5,2),
    status character varying(50) NOT NULL,
    rejection_reason text,
    error_message text,
    issues jsonb DEFAULT '[]'::jsonb,
    enrichment_source character varying(50),
    customer_id integer,
    bom_job_id character varying(100),
    api_calls jsonb DEFAULT '[]'::jsonb,
    processing_time_ms integer,
    tier_reached integer,
    created_at timestamp without time zone DEFAULT now(),
    created_by integer
);


--
-- Name: TABLE enrichment_history; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.enrichment_history IS 'Audit log of all enrichment attempts (approved, rejected, errors)';


--
-- Name: COLUMN enrichment_history.api_calls; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.enrichment_history.api_calls IS 'Log of all supplier API calls made during enrichment';


--
-- Name: COLUMN enrichment_history.tier_reached; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.enrichment_history.tier_reached IS 'Highest tier of supplier fallback used (1=Tier1, 4=Web scraping)';


--
-- Name: enrichment_history_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.enrichment_history_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: enrichment_history_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.enrichment_history_id_seq OWNED BY public.enrichment_history.id;


--
-- Name: enrichment_queue; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.enrichment_queue (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bom_id uuid NOT NULL,
    organization_id uuid NOT NULL,
    priority integer DEFAULT 5 NOT NULL,
    status text DEFAULT 'queued'::text NOT NULL,
    temporal_workflow_id text,
    temporal_run_id text,
    quality_score integer,
    quality_issues jsonb,
    requires_admin_approval boolean DEFAULT false,
    admin_approved_at timestamp with time zone,
    queued_at timestamp with time zone DEFAULT now(),
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    failed_at timestamp with time zone,
    error_message text,
    retry_count integer DEFAULT 0,
    total_items integer,
    matched_items integer,
    enriched_items integer,
    match_rate numeric(5,2),
    avg_confidence numeric(5,2),
    CONSTRAINT enrichment_queue_priority_check CHECK (((priority >= 1) AND (priority <= 10))),
    CONSTRAINT enrichment_queue_quality_score_check CHECK (((quality_score >= 0) AND (quality_score <= 100))),
    CONSTRAINT enrichment_queue_status_check CHECK ((status = ANY (ARRAY['queued'::text, 'processing'::text, 'completed'::text, 'failed'::text, 'cancelled'::text])))
);


--
-- Name: TABLE enrichment_queue; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.enrichment_queue IS 'Staging queue for components needing manual review (quality 70-94%)';


--
-- Name: enrichment_stats; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.enrichment_stats AS
 SELECT date(enrichment_history.created_at) AS date,
    enrichment_history.status,
    count(*) AS count,
    avg(enrichment_history.quality_score) AS avg_quality,
    avg(enrichment_history.processing_time_ms) AS avg_processing_ms
   FROM public.enrichment_history
  GROUP BY (date(enrichment_history.created_at)), enrichment_history.status
  ORDER BY (date(enrichment_history.created_at)) DESC, enrichment_history.status;


--
-- Name: VIEW enrichment_stats; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON VIEW public.enrichment_stats IS 'Daily enrichment statistics (approved, rejected, errors)';


--
-- Name: invoice_line_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.invoice_line_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    invoice_id uuid NOT NULL,
    description text NOT NULL,
    quantity integer DEFAULT 1 NOT NULL,
    unit_amount integer NOT NULL,
    amount integer NOT NULL,
    currency text DEFAULT 'USD'::text NOT NULL,
    period_start timestamp with time zone,
    period_end timestamp with time zone,
    type text DEFAULT 'subscription'::text,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: invoices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.invoices (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    invoice_number text NOT NULL,
    billing_customer_id uuid NOT NULL,
    subscription_id uuid,
    organization_id uuid NOT NULL,
    status public.invoice_status DEFAULT 'draft'::public.invoice_status NOT NULL,
    subtotal integer DEFAULT 0 NOT NULL,
    tax integer DEFAULT 0 NOT NULL,
    total integer DEFAULT 0 NOT NULL,
    amount_paid integer DEFAULT 0 NOT NULL,
    amount_due integer DEFAULT 0 NOT NULL,
    currency text DEFAULT 'USD'::text NOT NULL,
    invoice_date timestamp with time zone DEFAULT now() NOT NULL,
    due_date timestamp with time zone,
    paid_at timestamp with time zone,
    period_start timestamp with time zone,
    period_end timestamp with time zone,
    provider text,
    provider_invoice_id text,
    provider_data jsonb DEFAULT '{}'::jsonb,
    invoice_pdf_url text,
    hosted_invoice_url text,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE invoices; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.invoices IS 'Generated invoices for billing';


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    type text NOT NULL,
    title text NOT NULL,
    message text,
    data jsonb,
    is_read boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    read_at timestamp with time zone
);


--
-- Name: TABLE notifications; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.notifications IS 'User notifications for enrichment events and alerts';


--
-- Name: onboarding_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.onboarding_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    user_id uuid NOT NULL,
    event_type text NOT NULL,
    event_data jsonb,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE onboarding_events; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.onboarding_events IS 'Audit trail for onboarding-related events';


--
-- Name: organization_invitations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.organization_invitations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    email text NOT NULL,
    role text DEFAULT 'viewer'::text NOT NULL,
    token text NOT NULL,
    invited_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    expires_at timestamp with time zone NOT NULL,
    accepted_at timestamp with time zone,
    accepted_by uuid,
    revoked_at timestamp with time zone,
    CONSTRAINT valid_role CHECK ((role = ANY (ARRAY['admin'::text, 'engineer'::text, 'analyst'::text, 'viewer'::text])))
);


--
-- Name: TABLE organization_invitations; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.organization_invitations IS 'Tracks member invitations to organizations. Used by Professional/Enterprise plans.';


--
-- Name: organization_memberships; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.organization_memberships (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    user_id uuid NOT NULL,
    role text DEFAULT 'member'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    welcome_sent_at timestamp with time zone,
    first_login_at timestamp with time zone,
    CONSTRAINT valid_org_membership_role CHECK ((role = ANY (ARRAY['owner'::text, 'billing_admin'::text, 'admin'::text, 'engineer'::text, 'analyst'::text, 'member'::text, 'viewer'::text, 'super_admin'::text])))
);


--
-- Name: COLUMN organization_memberships.welcome_sent_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.organization_memberships.welcome_sent_at IS 'When welcome notification was sent to this member';


--
-- Name: COLUMN organization_memberships.first_login_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.organization_memberships.first_login_at IS 'When this member first logged in';


--
-- Name: organization_settings_audit; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.organization_settings_audit (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    changed_by uuid NOT NULL,
    changed_at timestamp with time zone DEFAULT now(),
    setting_name text NOT NULL,
    old_value text,
    new_value text,
    change_reason text
);


--
-- Name: TABLE organization_settings_audit; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.organization_settings_audit IS 'Audit trail for organization settings changes';


--
-- Name: organizations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.organizations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    slug text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    org_type text DEFAULT 'individual'::text,
    is_suspended boolean DEFAULT false,
    suspended_reason text,
    suspended_at timestamp with time zone,
    deleted_at timestamp with time zone,
    deletion_scheduled_at timestamp with time zone,
    deletion_requested_by uuid,
    deletion_reason text,
    deletion_feedback text,
    email text,
    phone text,
    address text,
    logo_url text,
    billing_email text,
    require_mfa boolean DEFAULT false,
    session_timeout_minutes integer DEFAULT 30,
    password_policy text DEFAULT 'strong'::text,
    api_access_enabled boolean DEFAULT true,
    webhooks_enabled boolean DEFAULT false,
    webhook_url text,
    data_retention_days integer DEFAULT 365,
    audit_log_retention_days integer DEFAULT 90,
    sso_enabled boolean DEFAULT false,
    sso_provider text DEFAULT 'saml'::text,
    onboarding_completed_at timestamp with time zone,
    onboarding_checklist jsonb DEFAULT '{"first_bom_uploaded": false, "risk_thresholds_set": false, "team_member_invited": false, "first_enrichment_complete": false, "alert_preferences_configured": false}'::jsonb,
    auth0_org_id text,
    enterprise_name text,
    enterprise_domain text,
    enterprise_settings jsonb DEFAULT '{}'::jsonb,
    max_users integer,
    trial_ends_at timestamp with time zone,
    created_by uuid,
    CONSTRAINT chk_audit_retention CHECK (((audit_log_retention_days >= 30) AND (audit_log_retention_days <= 365))),
    CONSTRAINT chk_data_retention CHECK (((data_retention_days >= 30) AND (data_retention_days <= 3650))),
    CONSTRAINT chk_password_policy CHECK ((password_policy = ANY (ARRAY['basic'::text, 'strong'::text, 'enterprise'::text]))),
    CONSTRAINT chk_session_timeout CHECK (((session_timeout_minutes >= 5) AND (session_timeout_minutes <= 480))),
    CONSTRAINT chk_sso_provider CHECK ((sso_provider = ANY (ARRAY['saml'::text, 'okta'::text, 'azure'::text, 'google'::text])))
);


--
-- Name: TABLE organizations; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.organizations IS 'Organizations/Tenants - top-level multi-tenant entity (formerly tenants_v2)';


--
-- Name: COLUMN organizations.org_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.organizations.org_type IS 'Organization type: individual (single user), enterprise (multi-user), platform (admin)';


--
-- Name: COLUMN organizations.is_suspended; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.organizations.is_suspended IS 'Whether the organization is suspended';


--
-- Name: COLUMN organizations.suspended_reason; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.organizations.suspended_reason IS 'Reason for suspension (if suspended)';


--
-- Name: COLUMN organizations.suspended_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.organizations.suspended_at IS 'When the organization was suspended';


--
-- Name: COLUMN organizations.deleted_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.organizations.deleted_at IS 'Timestamp when org was hard-deleted (NULL = active)';


--
-- Name: COLUMN organizations.deletion_scheduled_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.organizations.deletion_scheduled_at IS 'When deletion is scheduled (30-day grace period)';


--
-- Name: COLUMN organizations.deletion_requested_by; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.organizations.deletion_requested_by IS 'User ID who requested the deletion';


--
-- Name: COLUMN organizations.deletion_reason; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.organizations.deletion_reason IS 'Reason code for deletion';


--
-- Name: COLUMN organizations.deletion_feedback; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.organizations.deletion_feedback IS 'Optional user feedback on why they are leaving';


--
-- Name: COLUMN organizations.require_mfa; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.organizations.require_mfa IS 'Whether MFA is required for all users';


--
-- Name: COLUMN organizations.session_timeout_minutes; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.organizations.session_timeout_minutes IS 'Session timeout in minutes (5-480)';


--
-- Name: COLUMN organizations.password_policy; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.organizations.password_policy IS 'Password policy: basic, strong, enterprise';


--
-- Name: COLUMN organizations.api_access_enabled; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.organizations.api_access_enabled IS 'Whether API access is enabled for this org';


--
-- Name: COLUMN organizations.webhooks_enabled; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.organizations.webhooks_enabled IS 'Whether webhooks are enabled';


--
-- Name: COLUMN organizations.data_retention_days; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.organizations.data_retention_days IS 'Days to retain BOM and component data';


--
-- Name: COLUMN organizations.audit_log_retention_days; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.organizations.audit_log_retention_days IS 'Days to retain audit logs';


--
-- Name: COLUMN organizations.sso_enabled; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.organizations.sso_enabled IS 'Whether SSO is enabled for this organization (enterprise feature).';


--
-- Name: COLUMN organizations.sso_provider; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.organizations.sso_provider IS 'SSO provider: saml, okta, azure, google';


--
-- Name: COLUMN organizations.onboarding_completed_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.organizations.onboarding_completed_at IS 'When organization completed all onboarding steps';


--
-- Name: COLUMN organizations.onboarding_checklist; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.organizations.onboarding_checklist IS 'Tracks completion of onboarding checklist items';


--
-- Name: COLUMN organizations.auth0_org_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.organizations.auth0_org_id IS 'Auth0 organization ID (e.g., org_abc123). Used to map Auth0 orgs to Supabase orgs. NULL for individual/self-signup customers. Set when creating enterprise organizations.';


--
-- Name: COLUMN organizations.enterprise_name; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.organizations.enterprise_name IS 'Full enterprise name (e.g., "Acme Corporation"). NULL for individual orgs.';


--
-- Name: COLUMN organizations.enterprise_domain; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.organizations.enterprise_domain IS 'Enterprise email domain for SSO (e.g., "acme.com"). NULL for individual orgs.';


--
-- Name: COLUMN organizations.enterprise_settings; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.organizations.enterprise_settings IS 'JSONB settings for enterprise-specific configuration (SSO config, branding, etc.)';


--
-- Name: COLUMN organizations.max_users; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.organizations.max_users IS 'Maximum users allowed in organization. NULL = unlimited (individual plans use plan limits).';


--
-- Name: payment_methods; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payment_methods (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    billing_customer_id uuid NOT NULL,
    type text NOT NULL,
    display_name text,
    brand text,
    last_four text,
    exp_month integer,
    exp_year integer,
    provider text NOT NULL,
    provider_payment_method_id text NOT NULL,
    is_default boolean DEFAULT false,
    is_valid boolean DEFAULT true,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE payment_methods; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.payment_methods IS 'Stored payment methods (cards, bank accounts, etc.)';


--
-- Name: payments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    billing_customer_id uuid NOT NULL,
    invoice_id uuid,
    subscription_id uuid,
    payment_method_id uuid,
    amount integer NOT NULL,
    currency text DEFAULT 'USD'::text NOT NULL,
    status public.payment_status DEFAULT 'pending'::public.payment_status NOT NULL,
    provider text NOT NULL,
    provider_payment_id text NOT NULL,
    provider_data jsonb DEFAULT '{}'::jsonb,
    failure_code text,
    failure_message text,
    refunded_amount integer DEFAULT 0,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE payments; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.payments IS 'Payment transactions and their status';


--
-- Name: project_risk_summaries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.project_risk_summaries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    organization_id uuid NOT NULL,
    total_boms integer DEFAULT 0,
    healthy_boms integer DEFAULT 0,
    at_risk_boms integer DEFAULT 0,
    critical_boms integer DEFAULT 0,
    total_components integer DEFAULT 0,
    unique_components integer DEFAULT 0,
    average_bom_health_score numeric(5,2) DEFAULT 0,
    weighted_project_score numeric(5,2) DEFAULT 0,
    low_risk_total integer DEFAULT 0,
    medium_risk_total integer DEFAULT 0,
    high_risk_total integer DEFAULT 0,
    critical_risk_total integer DEFAULT 0,
    top_risk_factors jsonb DEFAULT '[]'::jsonb,
    calculated_at timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT project_risk_summaries_at_risk_boms_check CHECK ((at_risk_boms >= 0)),
    CONSTRAINT project_risk_summaries_average_bom_health_score_check CHECK (((average_bom_health_score >= (0)::numeric) AND (average_bom_health_score <= (100)::numeric))),
    CONSTRAINT project_risk_summaries_critical_boms_check CHECK ((critical_boms >= 0)),
    CONSTRAINT project_risk_summaries_critical_risk_total_check CHECK ((critical_risk_total >= 0)),
    CONSTRAINT project_risk_summaries_healthy_boms_check CHECK ((healthy_boms >= 0)),
    CONSTRAINT project_risk_summaries_high_risk_total_check CHECK ((high_risk_total >= 0)),
    CONSTRAINT project_risk_summaries_low_risk_total_check CHECK ((low_risk_total >= 0)),
    CONSTRAINT project_risk_summaries_medium_risk_total_check CHECK ((medium_risk_total >= 0)),
    CONSTRAINT project_risk_summaries_total_boms_check CHECK ((total_boms >= 0)),
    CONSTRAINT project_risk_summaries_total_components_check CHECK ((total_components >= 0)),
    CONSTRAINT project_risk_summaries_unique_components_check CHECK ((unique_components >= 0)),
    CONSTRAINT project_risk_summaries_weighted_project_score_check CHECK (((weighted_project_score >= (0)::numeric) AND (weighted_project_score <= (100)::numeric)))
);


--
-- Name: TABLE project_risk_summaries; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.project_risk_summaries IS 'Project-level risk aggregation across all BOMs';


--
-- Name: projects; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.projects (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    slug text,
    organization_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    description text,
    is_active boolean DEFAULT true,
    created_by uuid,
    project_code character varying(100),
    project_owner_id uuid,
    visibility text DEFAULT 'private'::text,
    start_date date DEFAULT CURRENT_DATE,
    workspace_id uuid
);


--
-- Name: TABLE projects; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.projects IS 'Projects within organizations (formerly projects_v2)';


--
-- Name: COLUMN projects.workspace_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.projects.workspace_id IS 'Workspace this project belongs to. Will be required after migration.';


--
-- Name: risk_profile_presets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.risk_profile_presets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    display_name text NOT NULL,
    description text,
    lifecycle_weight integer NOT NULL,
    supply_chain_weight integer NOT NULL,
    compliance_weight integer NOT NULL,
    obsolescence_weight integer NOT NULL,
    single_source_weight integer NOT NULL,
    low_threshold integer NOT NULL,
    medium_threshold integer NOT NULL,
    high_threshold integer NOT NULL,
    quantity_weight numeric(4,3) NOT NULL,
    lead_time_weight numeric(4,3) NOT NULL,
    criticality_weight numeric(4,3) NOT NULL,
    custom_factors jsonb DEFAULT '[]'::jsonb,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE risk_profile_presets; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.risk_profile_presets IS 'Industry-standard risk profile presets';


--
-- Name: risk_score_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.risk_score_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    entity_type text NOT NULL,
    entity_id uuid NOT NULL,
    organization_id uuid NOT NULL,
    total_risk_score integer NOT NULL,
    risk_level text NOT NULL,
    score_change integer DEFAULT 0,
    lifecycle_risk integer,
    supply_chain_risk integer,
    compliance_risk integer,
    obsolescence_risk integer,
    single_source_risk integer,
    health_grade text,
    recorded_date timestamp with time zone DEFAULT now(),
    calculation_method text,
    CONSTRAINT risk_score_history_compliance_risk_check CHECK (((compliance_risk >= 0) AND (compliance_risk <= 100))),
    CONSTRAINT risk_score_history_entity_type_check CHECK ((entity_type = ANY (ARRAY['bom'::text, 'component'::text, 'project'::text]))),
    CONSTRAINT risk_score_history_health_grade_check CHECK ((health_grade = ANY (ARRAY['A'::text, 'B'::text, 'C'::text, 'D'::text, 'F'::text]))),
    CONSTRAINT risk_score_history_lifecycle_risk_check CHECK (((lifecycle_risk >= 0) AND (lifecycle_risk <= 100))),
    CONSTRAINT risk_score_history_obsolescence_risk_check CHECK (((obsolescence_risk >= 0) AND (obsolescence_risk <= 100))),
    CONSTRAINT risk_score_history_risk_level_check CHECK ((risk_level = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text, 'critical'::text]))),
    CONSTRAINT risk_score_history_single_source_risk_check CHECK (((single_source_risk >= 0) AND (single_source_risk <= 100))),
    CONSTRAINT risk_score_history_supply_chain_risk_check CHECK (((supply_chain_risk >= 0) AND (supply_chain_risk <= 100))),
    CONSTRAINT risk_score_history_total_risk_score_check CHECK (((total_risk_score >= 0) AND (total_risk_score <= 100)))
);


--
-- Name: schema_migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.schema_migrations (
    version character varying(14) NOT NULL
);


--
-- Name: subscription_plans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subscription_plans (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    tier public.subscription_tier NOT NULL,
    slug text NOT NULL,
    price_monthly integer DEFAULT 0 NOT NULL,
    price_yearly integer,
    currency text DEFAULT 'USD'::text NOT NULL,
    billing_interval text DEFAULT 'month'::text NOT NULL,
    trial_days integer DEFAULT 0,
    limits jsonb DEFAULT '{}'::jsonb NOT NULL,
    description text,
    features text[],
    is_popular boolean DEFAULT false,
    display_order integer DEFAULT 0,
    is_active boolean DEFAULT true,
    provider_plan_ids jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE subscription_plans; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.subscription_plans IS 'Defines available subscription tiers and their limits';


--
-- Name: subscriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subscriptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    billing_customer_id uuid NOT NULL,
    plan_id uuid NOT NULL,
    organization_id uuid NOT NULL,
    status public.subscription_status DEFAULT 'active'::public.subscription_status NOT NULL,
    current_period_start timestamp with time zone NOT NULL,
    current_period_end timestamp with time zone NOT NULL,
    trial_start timestamp with time zone,
    trial_end timestamp with time zone,
    cancel_at_period_end boolean DEFAULT false,
    canceled_at timestamp with time zone,
    cancellation_reason text,
    provider text,
    provider_subscription_id text,
    provider_data jsonb DEFAULT '{}'::jsonb,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE subscriptions; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.subscriptions IS 'Active subscriptions linking orgs to plans';


--
-- Name: usage_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.usage_records (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    subscription_id uuid,
    usage_type text NOT NULL,
    period_start timestamp with time zone NOT NULL,
    period_end timestamp with time zone NOT NULL,
    quantity integer DEFAULT 0 NOT NULL,
    reported_to_provider boolean DEFAULT false,
    provider_usage_record_id text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE usage_records; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.usage_records IS 'Metered usage tracking per organization';


--
-- Name: user_alert_stats; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.user_alert_stats AS
 SELECT alerts.user_id,
    alerts.organization_id,
    count(*) AS total_alerts,
    count(*) FILTER (WHERE (alerts.is_read = false)) AS unread_count,
    count(*) FILTER (WHERE (alerts.severity = 'CRITICAL'::text)) AS critical_count,
    max(alerts.created_at) AS latest_alert_at
   FROM public.alerts
  WHERE (alerts.deleted_at IS NULL)
  GROUP BY alerts.user_id, alerts.organization_id;


--
-- Name: VIEW user_alert_stats; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON VIEW public.user_alert_stats IS 'Per-user alert statistics';


--
-- Name: user_alerts_with_status; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.user_alerts_with_status AS
SELECT
    NULL::uuid AS id,
    NULL::uuid AS organization_id,
    NULL::uuid AS component_id,
    NULL::text AS severity,
    NULL::text AS alert_type,
    NULL::text AS title,
    NULL::text AS message,
    NULL::boolean AS is_read,
    NULL::boolean AS is_dismissed,
    NULL::timestamp with time zone AS created_at,
    NULL::timestamp with time zone AS read_at,
    NULL::timestamp with time zone AS dismissed_at,
    NULL::uuid AS user_id,
    NULL::jsonb AS context,
    NULL::text AS action_url,
    NULL::timestamp with time zone AS delivered_at,
    NULL::timestamp with time zone AS archived_at,
    NULL::timestamp with time zone AS snoozed_until,
    NULL::timestamp with time zone AS deleted_at,
    NULL::bigint AS delivery_attempts,
    NULL::timestamp with time zone AS last_delivered_at,
    NULL::boolean AS has_failed_delivery;


--
-- Name: VIEW user_alerts_with_status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON VIEW public.user_alerts_with_status IS 'Alerts with delivery status aggregates';


--
-- Name: user_preferences; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_preferences (
    user_id uuid NOT NULL,
    last_organization_id uuid,
    theme text DEFAULT 'system'::text,
    notifications_enabled boolean DEFAULT true,
    updated_at timestamp with time zone DEFAULT now(),
    last_workspace_id uuid
);


--
-- Name: TABLE user_preferences; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.user_preferences IS 'User-specific preferences including last active organization.';


--
-- Name: COLUMN user_preferences.last_workspace_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.user_preferences.last_workspace_id IS 'Last active workspace for quick context restoration.';


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email text NOT NULL,
    full_name text,
    organization_id uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    role text DEFAULT 'user'::text NOT NULL,
    auth_subject uuid,
    auth0_user_id text,
    is_active boolean DEFAULT true,
    deleted_at timestamp with time zone,
    deletion_requested_by uuid,
    deletion_reason text,
    novu_subscriber_id character varying(255),
    novu_synced_at timestamp with time zone,
    novu_sync_status character varying(50) DEFAULT 'pending'::character varying,
    is_platform_admin boolean DEFAULT false,
    CONSTRAINT users_v2_role_check CHECK ((role = ANY (ARRAY['super_admin'::text, 'platform_admin'::text, 'platform_user'::text, 'org_owner'::text, 'org_admin'::text, 'engineer'::text, 'analyst'::text, 'user'::text])))
);


--
-- Name: TABLE users; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.users IS 'Platform users with RBAC roles (formerly users_v2)';


--
-- Name: COLUMN users.role; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.users.role IS 'User role: super_admin (full platform access), platform_admin, platform_user, org_admin (tenant admin), user (regular user)';


--
-- Name: COLUMN users.auth_subject; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.users.auth_subject IS 'Links to auth.users.id for Supabase authentication';


--
-- Name: COLUMN users.is_active; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.users.is_active IS 'Whether the user account is active';


--
-- Name: COLUMN users.deleted_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.users.deleted_at IS 'Timestamp when user was soft-deleted (NULL = active)';


--
-- Name: COLUMN users.deletion_requested_by; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.users.deletion_requested_by IS 'User ID who requested the deletion';


--
-- Name: COLUMN users.deletion_reason; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.users.deletion_reason IS 'Reason for account deletion (optional feedback)';


--
-- Name: COLUMN users.novu_subscriber_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.users.novu_subscriber_id IS 'Novu subscriber ID (typically user UUID)';


--
-- Name: COLUMN users.novu_synced_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.users.novu_synced_at IS 'Last time user was synced to Novu';


--
-- Name: COLUMN users.novu_sync_status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.users.novu_sync_status IS 'Sync status: pending, synced, failed';


--
-- Name: workspace_invitations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workspace_invitations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    email text NOT NULL,
    role text DEFAULT 'viewer'::text NOT NULL,
    token text NOT NULL,
    invited_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    expires_at timestamp with time zone NOT NULL,
    accepted_at timestamp with time zone,
    accepted_by uuid,
    revoked_at timestamp with time zone,
    CONSTRAINT valid_ws_invite_role CHECK ((role = ANY (ARRAY['admin'::text, 'engineer'::text, 'analyst'::text, 'viewer'::text])))
);


--
-- Name: TABLE workspace_invitations; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.workspace_invitations IS 'Pending workspace invitations. Users accept to join a workspace with the specified role.';


--
-- Name: workspace_memberships; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workspace_memberships (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    user_id uuid NOT NULL,
    role text DEFAULT 'viewer'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT valid_workspace_role CHECK ((role = ANY (ARRAY['admin'::text, 'engineer'::text, 'analyst'::text, 'viewer'::text])))
);


--
-- Name: TABLE workspace_memberships; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.workspace_memberships IS 'Maps users to workspaces with roles. Replaces org-level roles for work/access control.';


--
-- Name: COLUMN workspace_memberships.role; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.workspace_memberships.role IS 'Workspace roles: admin (full control), engineer (create/edit), analyst (read-only), viewer (list only)';


--
-- Name: workspaces; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workspaces (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    description text,
    is_default boolean DEFAULT false,
    settings jsonb DEFAULT '{}'::jsonb,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    deleted_at timestamp with time zone
);


--
-- Name: TABLE workspaces; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.workspaces IS 'Workspaces are project containers within organizations. Users have roles per workspace.';


--
-- Name: COLUMN workspaces.is_default; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.workspaces.is_default IS 'The default workspace is created automatically when an organization is created.';


--
-- Name: migrations; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.migrations (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    hash character varying(40) NOT NULL,
    executed_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: refresh_tokens id; Type: DEFAULT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.refresh_tokens ALTER COLUMN id SET DEFAULT nextval('auth.refresh_tokens_id_seq'::regclass);


--
-- Name: bom_items id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bom_items ALTER COLUMN id SET DEFAULT nextval('public.bom_items_id_seq'::regclass);


--
-- Name: bom_jobs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bom_jobs ALTER COLUMN id SET DEFAULT nextval('public.bom_jobs_id_seq'::regclass);


--
-- Name: enrichment_history id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.enrichment_history ALTER COLUMN id SET DEFAULT nextval('public.enrichment_history_id_seq'::regclass);


--
-- Name: mfa_amr_claims amr_id_pk; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_amr_claims
    ADD CONSTRAINT amr_id_pk PRIMARY KEY (id);


--
-- Name: audit_log_entries audit_log_entries_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.audit_log_entries
    ADD CONSTRAINT audit_log_entries_pkey PRIMARY KEY (id);


--
-- Name: flow_state flow_state_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.flow_state
    ADD CONSTRAINT flow_state_pkey PRIMARY KEY (id);


--
-- Name: identities identities_provider_id_provider_unique; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.identities
    ADD CONSTRAINT identities_provider_id_provider_unique UNIQUE (provider_id, provider);


--
-- Name: instances instances_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.instances
    ADD CONSTRAINT instances_pkey PRIMARY KEY (id);


--
-- Name: mfa_amr_claims mfa_amr_claims_session_id_authentication_method_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_amr_claims
    ADD CONSTRAINT mfa_amr_claims_session_id_authentication_method_pkey UNIQUE (session_id, authentication_method);


--
-- Name: mfa_challenges mfa_challenges_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_challenges
    ADD CONSTRAINT mfa_challenges_pkey PRIMARY KEY (id);


--
-- Name: mfa_factors mfa_factors_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_factors
    ADD CONSTRAINT mfa_factors_pkey PRIMARY KEY (id);


--
-- Name: refresh_tokens refresh_tokens_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.refresh_tokens
    ADD CONSTRAINT refresh_tokens_pkey PRIMARY KEY (id);


--
-- Name: refresh_tokens refresh_tokens_token_unique; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.refresh_tokens
    ADD CONSTRAINT refresh_tokens_token_unique UNIQUE (token);


--
-- Name: saml_providers saml_providers_entity_id_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_providers
    ADD CONSTRAINT saml_providers_entity_id_key UNIQUE (entity_id);


--
-- Name: saml_providers saml_providers_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_providers
    ADD CONSTRAINT saml_providers_pkey PRIMARY KEY (id);


--
-- Name: saml_relay_states saml_relay_states_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_relay_states
    ADD CONSTRAINT saml_relay_states_pkey PRIMARY KEY (id);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);


--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);


--
-- Name: sso_domains sso_domains_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sso_domains
    ADD CONSTRAINT sso_domains_pkey PRIMARY KEY (id);


--
-- Name: sso_providers sso_providers_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sso_providers
    ADD CONSTRAINT sso_providers_pkey PRIMARY KEY (id);


--
-- Name: users users_phone_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.users
    ADD CONSTRAINT users_phone_key UNIQUE (phone);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: account_deletion_audit account_deletion_audit_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_deletion_audit
    ADD CONSTRAINT account_deletion_audit_pkey PRIMARY KEY (id);


--
-- Name: alert_deliveries alert_deliveries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alert_deliveries
    ADD CONSTRAINT alert_deliveries_pkey PRIMARY KEY (id);


--
-- Name: alert_preferences alert_preferences_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alert_preferences
    ADD CONSTRAINT alert_preferences_pkey PRIMARY KEY (id);


--
-- Name: alerts alerts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alerts
    ADD CONSTRAINT alerts_pkey PRIMARY KEY (id);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: billing_customers billing_customers_organization_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.billing_customers
    ADD CONSTRAINT billing_customers_organization_id_key UNIQUE (organization_id);


--
-- Name: billing_customers billing_customers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.billing_customers
    ADD CONSTRAINT billing_customers_pkey PRIMARY KEY (id);


--
-- Name: billing_webhook_events billing_webhook_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.billing_webhook_events
    ADD CONSTRAINT billing_webhook_events_pkey PRIMARY KEY (id);


--
-- Name: billing_webhook_events billing_webhook_events_provider_provider_event_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.billing_webhook_events
    ADD CONSTRAINT billing_webhook_events_provider_provider_event_id_key UNIQUE (provider, provider_event_id);


--
-- Name: bom_items bom_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bom_items
    ADD CONSTRAINT bom_items_pkey PRIMARY KEY (id);


--
-- Name: bom_jobs bom_jobs_job_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bom_jobs
    ADD CONSTRAINT bom_jobs_job_id_key UNIQUE (job_id);


--
-- Name: bom_jobs bom_jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bom_jobs
    ADD CONSTRAINT bom_jobs_pkey PRIMARY KEY (id);


--
-- Name: bom_line_item_risk_scores bom_line_item_risk_scores_bom_line_item_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bom_line_item_risk_scores
    ADD CONSTRAINT bom_line_item_risk_scores_bom_line_item_id_key UNIQUE (bom_line_item_id);


--
-- Name: bom_line_item_risk_scores bom_line_item_risk_scores_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bom_line_item_risk_scores
    ADD CONSTRAINT bom_line_item_risk_scores_pkey PRIMARY KEY (id);


--
-- Name: bom_line_items bom_line_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bom_line_items
    ADD CONSTRAINT bom_line_items_pkey PRIMARY KEY (id);


--
-- Name: bom_risk_summaries bom_risk_summaries_bom_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bom_risk_summaries
    ADD CONSTRAINT bom_risk_summaries_bom_id_key UNIQUE (bom_id);


--
-- Name: bom_risk_summaries bom_risk_summaries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bom_risk_summaries
    ADD CONSTRAINT bom_risk_summaries_pkey PRIMARY KEY (id);


--
-- Name: bom_uploads bom_uploads_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bom_uploads
    ADD CONSTRAINT bom_uploads_pkey PRIMARY KEY (id);


--
-- Name: boms boms_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.boms
    ADD CONSTRAINT boms_pkey PRIMARY KEY (id);


--
-- Name: cns_bulk_uploads cns_bulk_uploads_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cns_bulk_uploads
    ADD CONSTRAINT cns_bulk_uploads_pkey PRIMARY KEY (id);


--
-- Name: component_base_risk_scores component_base_risk_scores_mpn_manufacturer_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.component_base_risk_scores
    ADD CONSTRAINT component_base_risk_scores_mpn_manufacturer_key UNIQUE (mpn, manufacturer);


--
-- Name: component_base_risk_scores component_base_risk_scores_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.component_base_risk_scores
    ADD CONSTRAINT component_base_risk_scores_pkey PRIMARY KEY (id);


--
-- Name: component_watches component_watches_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.component_watches
    ADD CONSTRAINT component_watches_pkey PRIMARY KEY (id);


--
-- Name: component_watches component_watches_user_id_component_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.component_watches
    ADD CONSTRAINT component_watches_user_id_component_id_key UNIQUE (user_id, component_id);


--
-- Name: enrichment_audit_log enrichment_audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.enrichment_audit_log
    ADD CONSTRAINT enrichment_audit_log_pkey PRIMARY KEY (id);


--
-- Name: enrichment_events enrichment_events_event_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.enrichment_events
    ADD CONSTRAINT enrichment_events_event_id_key UNIQUE (event_id);


--
-- Name: enrichment_events enrichment_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.enrichment_events
    ADD CONSTRAINT enrichment_events_pkey PRIMARY KEY (id);


--
-- Name: enrichment_history enrichment_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.enrichment_history
    ADD CONSTRAINT enrichment_history_pkey PRIMARY KEY (id);


--
-- Name: enrichment_queue enrichment_queue_bom_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.enrichment_queue
    ADD CONSTRAINT enrichment_queue_bom_id_key UNIQUE (bom_id);


--
-- Name: enrichment_queue enrichment_queue_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.enrichment_queue
    ADD CONSTRAINT enrichment_queue_pkey PRIMARY KEY (id);


--
-- Name: invoice_line_items invoice_line_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_line_items
    ADD CONSTRAINT invoice_line_items_pkey PRIMARY KEY (id);


--
-- Name: invoices invoices_invoice_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_invoice_number_key UNIQUE (invoice_number);


--
-- Name: invoices invoices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: onboarding_events onboarding_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.onboarding_events
    ADD CONSTRAINT onboarding_events_pkey PRIMARY KEY (id);


--
-- Name: organization_invitations organization_invitations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_invitations
    ADD CONSTRAINT organization_invitations_pkey PRIMARY KEY (id);


--
-- Name: organization_invitations organization_invitations_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_invitations
    ADD CONSTRAINT organization_invitations_token_key UNIQUE (token);


--
-- Name: organization_memberships organization_memberships_organization_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_memberships
    ADD CONSTRAINT organization_memberships_organization_id_user_id_key UNIQUE (organization_id, user_id);


--
-- Name: organization_memberships organization_memberships_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_memberships
    ADD CONSTRAINT organization_memberships_pkey PRIMARY KEY (id);


--
-- Name: organization_risk_profiles organization_risk_profiles_organization_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_risk_profiles
    ADD CONSTRAINT organization_risk_profiles_organization_id_key UNIQUE (organization_id);


--
-- Name: organization_risk_profiles organization_risk_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_risk_profiles
    ADD CONSTRAINT organization_risk_profiles_pkey PRIMARY KEY (id);


--
-- Name: organization_settings_audit organization_settings_audit_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_settings_audit
    ADD CONSTRAINT organization_settings_audit_pkey PRIMARY KEY (id);


--
-- Name: payment_methods payment_methods_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_methods
    ADD CONSTRAINT payment_methods_pkey PRIMARY KEY (id);


--
-- Name: payments payments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_pkey PRIMARY KEY (id);


--
-- Name: project_risk_summaries project_risk_summaries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_risk_summaries
    ADD CONSTRAINT project_risk_summaries_pkey PRIMARY KEY (id);


--
-- Name: project_risk_summaries project_risk_summaries_project_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_risk_summaries
    ADD CONSTRAINT project_risk_summaries_project_id_key UNIQUE (project_id);


--
-- Name: projects projects_organization_id_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_organization_id_slug_key UNIQUE (organization_id, slug);


--
-- Name: projects projects_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_pkey PRIMARY KEY (id);


--
-- Name: risk_profile_presets risk_profile_presets_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.risk_profile_presets
    ADD CONSTRAINT risk_profile_presets_name_key UNIQUE (name);


--
-- Name: risk_profile_presets risk_profile_presets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.risk_profile_presets
    ADD CONSTRAINT risk_profile_presets_pkey PRIMARY KEY (id);


--
-- Name: risk_score_history risk_score_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.risk_score_history
    ADD CONSTRAINT risk_score_history_pkey PRIMARY KEY (id);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);


--
-- Name: subscription_plans subscription_plans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_plans
    ADD CONSTRAINT subscription_plans_pkey PRIMARY KEY (id);


--
-- Name: subscription_plans subscription_plans_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_plans
    ADD CONSTRAINT subscription_plans_slug_key UNIQUE (slug);


--
-- Name: subscriptions subscriptions_organization_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_organization_id_key UNIQUE (organization_id);


--
-- Name: subscriptions subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_pkey PRIMARY KEY (id);


--
-- Name: organizations tenants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT tenants_pkey PRIMARY KEY (id);


--
-- Name: organizations tenants_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT tenants_slug_key UNIQUE (slug);


--
-- Name: organization_invitations unique_org_email_invitation; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_invitations
    ADD CONSTRAINT unique_org_email_invitation UNIQUE (organization_id, email);


--
-- Name: workspace_memberships unique_user_per_workspace; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_memberships
    ADD CONSTRAINT unique_user_per_workspace UNIQUE (workspace_id, user_id);


--
-- Name: organization_memberships unique_user_single_org_membership; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_memberships
    ADD CONSTRAINT unique_user_single_org_membership UNIQUE (user_id);


--
-- Name: CONSTRAINT unique_user_single_org_membership ON organization_memberships; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON CONSTRAINT unique_user_single_org_membership ON public.organization_memberships IS 'A user can only belong to one organization at a time';


--
-- Name: workspaces unique_workspace_slug_per_org; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspaces
    ADD CONSTRAINT unique_workspace_slug_per_org UNIQUE (organization_id, slug);


--
-- Name: usage_records usage_records_organization_id_usage_type_period_start_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usage_records
    ADD CONSTRAINT usage_records_organization_id_usage_type_period_start_key UNIQUE (organization_id, usage_type, period_start);


--
-- Name: usage_records usage_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usage_records
    ADD CONSTRAINT usage_records_pkey PRIMARY KEY (id);


--
-- Name: user_preferences user_preferences_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_preferences
    ADD CONSTRAINT user_preferences_pkey PRIMARY KEY (user_id);


--
-- Name: users users_v2_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_v2_email_key UNIQUE (email);


--
-- Name: users users_v2_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_v2_pkey PRIMARY KEY (id);


--
-- Name: workspace_invitations workspace_invitations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_invitations
    ADD CONSTRAINT workspace_invitations_pkey PRIMARY KEY (id);


--
-- Name: workspace_invitations workspace_invitations_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_invitations
    ADD CONSTRAINT workspace_invitations_token_key UNIQUE (token);


--
-- Name: workspace_memberships workspace_memberships_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_memberships
    ADD CONSTRAINT workspace_memberships_pkey PRIMARY KEY (id);


--
-- Name: workspaces workspaces_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspaces
    ADD CONSTRAINT workspaces_pkey PRIMARY KEY (id);


--
-- Name: migrations migrations_name_key; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.migrations
    ADD CONSTRAINT migrations_name_key UNIQUE (name);


--
-- Name: migrations migrations_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.migrations
    ADD CONSTRAINT migrations_pkey PRIMARY KEY (id);


--
-- Name: audit_logs_instance_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX audit_logs_instance_id_idx ON auth.audit_log_entries USING btree (instance_id);


--
-- Name: confirmation_token_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX confirmation_token_idx ON auth.users USING btree (confirmation_token) WHERE ((confirmation_token)::text !~ '^[0-9 ]*$'::text);


--
-- Name: email_change_token_current_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX email_change_token_current_idx ON auth.users USING btree (email_change_token_current) WHERE ((email_change_token_current)::text !~ '^[0-9 ]*$'::text);


--
-- Name: email_change_token_new_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX email_change_token_new_idx ON auth.users USING btree (email_change_token_new) WHERE ((email_change_token_new)::text !~ '^[0-9 ]*$'::text);


--
-- Name: factor_id_created_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX factor_id_created_at_idx ON auth.mfa_factors USING btree (user_id, created_at);


--
-- Name: flow_state_created_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX flow_state_created_at_idx ON auth.flow_state USING btree (created_at DESC);


--
-- Name: identities_email_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX identities_email_idx ON auth.identities USING btree (email text_pattern_ops);


--
-- Name: INDEX identities_email_idx; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON INDEX auth.identities_email_idx IS 'Auth: Ensures indexed queries on the email column';


--
-- Name: identities_user_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX identities_user_id_idx ON auth.identities USING btree (user_id);


--
-- Name: idx_auth_code; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX idx_auth_code ON auth.flow_state USING btree (auth_code);


--
-- Name: idx_user_id_auth_method; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX idx_user_id_auth_method ON auth.flow_state USING btree (user_id, authentication_method);


--
-- Name: mfa_challenge_created_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX mfa_challenge_created_at_idx ON auth.mfa_challenges USING btree (created_at DESC);


--
-- Name: mfa_factors_user_friendly_name_unique; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX mfa_factors_user_friendly_name_unique ON auth.mfa_factors USING btree (friendly_name, user_id) WHERE (TRIM(BOTH FROM friendly_name) <> ''::text);


--
-- Name: mfa_factors_user_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX mfa_factors_user_id_idx ON auth.mfa_factors USING btree (user_id);


--
-- Name: reauthentication_token_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX reauthentication_token_idx ON auth.users USING btree (reauthentication_token) WHERE ((reauthentication_token)::text !~ '^[0-9 ]*$'::text);


--
-- Name: recovery_token_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX recovery_token_idx ON auth.users USING btree (recovery_token) WHERE ((recovery_token)::text !~ '^[0-9 ]*$'::text);


--
-- Name: refresh_tokens_instance_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX refresh_tokens_instance_id_idx ON auth.refresh_tokens USING btree (instance_id);


--
-- Name: refresh_tokens_instance_id_user_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX refresh_tokens_instance_id_user_id_idx ON auth.refresh_tokens USING btree (instance_id, user_id);


--
-- Name: refresh_tokens_parent_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX refresh_tokens_parent_idx ON auth.refresh_tokens USING btree (parent);


--
-- Name: refresh_tokens_session_id_revoked_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX refresh_tokens_session_id_revoked_idx ON auth.refresh_tokens USING btree (session_id, revoked);


--
-- Name: refresh_tokens_updated_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX refresh_tokens_updated_at_idx ON auth.refresh_tokens USING btree (updated_at DESC);


--
-- Name: saml_providers_sso_provider_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX saml_providers_sso_provider_id_idx ON auth.saml_providers USING btree (sso_provider_id);


--
-- Name: saml_relay_states_created_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX saml_relay_states_created_at_idx ON auth.saml_relay_states USING btree (created_at DESC);


--
-- Name: saml_relay_states_for_email_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX saml_relay_states_for_email_idx ON auth.saml_relay_states USING btree (for_email);


--
-- Name: saml_relay_states_sso_provider_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX saml_relay_states_sso_provider_id_idx ON auth.saml_relay_states USING btree (sso_provider_id);


--
-- Name: sessions_not_after_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX sessions_not_after_idx ON auth.sessions USING btree (not_after DESC);


--
-- Name: sessions_user_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX sessions_user_id_idx ON auth.sessions USING btree (user_id);


--
-- Name: sso_domains_domain_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX sso_domains_domain_idx ON auth.sso_domains USING btree (lower(domain));


--
-- Name: sso_domains_sso_provider_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX sso_domains_sso_provider_id_idx ON auth.sso_domains USING btree (sso_provider_id);


--
-- Name: sso_providers_resource_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX sso_providers_resource_id_idx ON auth.sso_providers USING btree (lower(resource_id));


--
-- Name: user_id_created_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX user_id_created_at_idx ON auth.sessions USING btree (user_id, created_at);


--
-- Name: users_email_partial_key; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX users_email_partial_key ON auth.users USING btree (email) WHERE (is_sso_user = false);


--
-- Name: INDEX users_email_partial_key; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON INDEX auth.users_email_partial_key IS 'Auth: A partial unique index that applies only when is_sso_user is false';


--
-- Name: users_instance_id_email_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX users_instance_id_email_idx ON auth.users USING btree (instance_id, lower((email)::text));


--
-- Name: users_instance_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX users_instance_id_idx ON auth.users USING btree (instance_id);


--
-- Name: idx_alert_deliveries_novu_transaction; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_alert_deliveries_novu_transaction ON public.alert_deliveries USING btree (novu_transaction_id) WHERE (novu_transaction_id IS NOT NULL);


--
-- Name: idx_alert_preferences_novu_sync; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_alert_preferences_novu_sync ON public.alert_preferences USING btree (novu_preference_synced) WHERE (novu_preference_synced = false);


--
-- Name: idx_alert_prefs_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_alert_prefs_active ON public.alert_preferences USING btree (is_active) WHERE (is_active = true);


--
-- Name: idx_alert_prefs_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_alert_prefs_org ON public.alert_preferences USING btree (organization_id);


--
-- Name: idx_alert_prefs_org_type_auth0; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_alert_prefs_org_type_auth0 ON public.alert_preferences USING btree (organization_id, alert_type) WHERE (user_id IS NULL);


--
-- Name: idx_alert_prefs_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_alert_prefs_type ON public.alert_preferences USING btree (alert_type);


--
-- Name: idx_alert_prefs_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_alert_prefs_user ON public.alert_preferences USING btree (user_id);


--
-- Name: idx_alert_prefs_user_org_type_supabase; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_alert_prefs_user_org_type_supabase ON public.alert_preferences USING btree (user_id, organization_id, alert_type) WHERE (user_id IS NOT NULL);


--
-- Name: idx_alerts_archived; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_alerts_archived ON public.alerts USING btree (archived_at) WHERE (archived_at IS NOT NULL);


--
-- Name: idx_alerts_component; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_alerts_component ON public.alerts USING btree (component_id);


--
-- Name: idx_alerts_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_alerts_created ON public.alerts USING btree (created_at DESC);


--
-- Name: idx_alerts_is_read; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_alerts_is_read ON public.alerts USING btree (is_read);


--
-- Name: idx_alerts_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_alerts_org ON public.alerts USING btree (organization_id);


--
-- Name: idx_alerts_read; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_alerts_read ON public.alerts USING btree (is_read);


--
-- Name: idx_alerts_severity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_alerts_severity ON public.alerts USING btree (severity);


--
-- Name: idx_alerts_snoozed; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_alerts_snoozed ON public.alerts USING btree (snoozed_until) WHERE (snoozed_until IS NOT NULL);


--
-- Name: idx_alerts_supply_chain; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_alerts_supply_chain ON public.alerts USING btree (alert_type) WHERE (alert_type = 'SUPPLY_CHAIN'::text);


--
-- Name: idx_alerts_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_alerts_type ON public.alerts USING btree (alert_type);


--
-- Name: idx_alerts_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_alerts_user ON public.alerts USING btree (user_id);


--
-- Name: idx_audit_logs_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_email ON public.audit_logs USING btree (email);


--
-- Name: idx_audit_logs_event_data; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_event_data ON public.audit_logs USING gin (event_data);


--
-- Name: idx_audit_logs_event_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_event_type ON public.audit_logs USING btree (event_type);


--
-- Name: idx_audit_logs_organization_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_organization_id ON public.audit_logs USING btree (organization_id) WHERE (organization_id IS NOT NULL);


--
-- Name: idx_audit_logs_routing_key; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_routing_key ON public.audit_logs USING btree (routing_key);


--
-- Name: idx_audit_logs_timestamp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_timestamp ON public.audit_logs USING btree ("timestamp" DESC);


--
-- Name: idx_audit_logs_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_user_id ON public.audit_logs USING btree (user_id);


--
-- Name: idx_audit_logs_user_timestamp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_user_timestamp ON public.audit_logs USING btree (user_id, "timestamp" DESC);


--
-- Name: idx_billing_customers_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_billing_customers_org ON public.billing_customers USING btree (organization_id);


--
-- Name: idx_bli_risk_bom_line_item; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bli_risk_bom_line_item ON public.bom_line_item_risk_scores USING btree (bom_line_item_id);


--
-- Name: idx_bli_risk_level; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bli_risk_level ON public.bom_line_item_risk_scores USING btree (risk_level);


--
-- Name: idx_bli_risk_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bli_risk_org ON public.bom_line_item_risk_scores USING btree (organization_id);


--
-- Name: idx_bli_risk_org_level; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bli_risk_org_level ON public.bom_line_item_risk_scores USING btree (organization_id, risk_level);


--
-- Name: idx_bli_risk_score; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bli_risk_score ON public.bom_line_item_risk_scores USING btree (contextual_risk_score DESC);


--
-- Name: idx_bom_items_component_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bom_items_component_id ON public.bom_items USING btree (component_id);


--
-- Name: idx_bom_items_enrichment_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bom_items_enrichment_status ON public.bom_items USING btree (enrichment_status);


--
-- Name: idx_bom_items_job_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bom_items_job_id ON public.bom_items USING btree (job_id);


--
-- Name: idx_bom_items_manufacturer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bom_items_manufacturer ON public.bom_items USING btree (manufacturer);


--
-- Name: idx_bom_items_mpn; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bom_items_mpn ON public.bom_items USING btree (mpn);


--
-- Name: idx_bom_items_routing_destination; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bom_items_routing_destination ON public.bom_items USING btree (routing_destination);


--
-- Name: idx_bom_jobs_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bom_jobs_created_at ON public.bom_jobs USING btree (created_at);


--
-- Name: idx_bom_jobs_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bom_jobs_customer ON public.bom_jobs USING btree (customer_id);


--
-- Name: idx_bom_jobs_job_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bom_jobs_job_id ON public.bom_jobs USING btree (job_id);


--
-- Name: idx_bom_jobs_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bom_jobs_org ON public.bom_jobs USING btree (organization_id);


--
-- Name: idx_bom_jobs_project; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bom_jobs_project ON public.bom_jobs USING btree (project_id);


--
-- Name: idx_bom_jobs_source; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bom_jobs_source ON public.bom_jobs USING btree (source);


--
-- Name: idx_bom_jobs_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bom_jobs_status ON public.bom_jobs USING btree (status);


--
-- Name: idx_bom_line_items_bom_component; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bom_line_items_bom_component ON public.bom_line_items USING btree (bom_id, component_id);


--
-- Name: idx_bom_line_items_bom_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bom_line_items_bom_id ON public.bom_line_items USING btree (bom_id);


--
-- Name: idx_bom_line_items_component; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bom_line_items_component ON public.bom_line_items USING btree (matched_component_id);


--
-- Name: idx_bom_line_items_component_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bom_line_items_component_id ON public.bom_line_items USING btree (component_id);


--
-- Name: idx_bom_line_items_enrichment_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bom_line_items_enrichment_status ON public.bom_line_items USING btree (enrichment_status);


--
-- Name: idx_bom_line_items_mpn; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bom_line_items_mpn ON public.bom_line_items USING btree (manufacturer_part_number);


--
-- Name: idx_bom_line_items_redis_key; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bom_line_items_redis_key ON public.bom_line_items USING btree (redis_component_key) WHERE (redis_component_key IS NOT NULL);


--
-- Name: idx_bom_line_items_storage_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bom_line_items_storage_type ON public.bom_line_items USING btree (component_storage);


--
-- Name: idx_bom_risk_summary_avg_score; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bom_risk_summary_avg_score ON public.bom_risk_summaries USING btree (average_risk_score DESC);


--
-- Name: idx_bom_risk_summary_bom; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bom_risk_summary_bom ON public.bom_risk_summaries USING btree (bom_id);


--
-- Name: idx_bom_risk_summary_grade; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bom_risk_summary_grade ON public.bom_risk_summaries USING btree (health_grade);


--
-- Name: idx_bom_risk_summary_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bom_risk_summary_org ON public.bom_risk_summaries USING btree (organization_id);


--
-- Name: idx_bom_risk_summary_org_grade; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bom_risk_summary_org_grade ON public.bom_risk_summaries USING btree (organization_id, health_grade);


--
-- Name: idx_bom_uploads_archived; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bom_uploads_archived ON public.bom_uploads USING btree (archived) WHERE (archived = false);


--
-- Name: idx_bom_uploads_bom_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bom_uploads_bom_id ON public.bom_uploads USING btree (bom_id);


--
-- Name: idx_bom_uploads_cns_job_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bom_uploads_cns_job_id ON public.bom_uploads USING btree (cns_job_id) WHERE (cns_job_id IS NOT NULL);


--
-- Name: idx_bom_uploads_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bom_uploads_created_at ON public.bom_uploads USING btree (created_at DESC);


--
-- Name: idx_bom_uploads_organization_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bom_uploads_organization_id ON public.bom_uploads USING btree (organization_id);


--
-- Name: idx_bom_uploads_project_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bom_uploads_project_id ON public.bom_uploads USING btree (project_id);


--
-- Name: idx_bom_uploads_rabbitmq_published; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bom_uploads_rabbitmq_published ON public.bom_uploads USING btree (rabbitmq_event_published) WHERE (rabbitmq_event_published = false);


--
-- Name: idx_bom_uploads_s3_key; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bom_uploads_s3_key ON public.bom_uploads USING btree (s3_key) WHERE (s3_key IS NOT NULL);


--
-- Name: idx_bom_uploads_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bom_uploads_status ON public.bom_uploads USING btree (status);


--
-- Name: idx_bom_uploads_upload_source; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bom_uploads_upload_source ON public.bom_uploads USING btree (upload_source);


--
-- Name: idx_bom_uploads_uploaded_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bom_uploads_uploaded_by ON public.bom_uploads USING btree (uploaded_by);


--
-- Name: idx_bom_uploads_workflow_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bom_uploads_workflow_id ON public.bom_uploads USING btree (temporal_workflow_id);


--
-- Name: idx_boms_enrichment_priority; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_boms_enrichment_priority ON public.boms USING btree (enrichment_priority DESC);


--
-- Name: idx_boms_enrichment_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_boms_enrichment_status ON public.boms USING btree (enrichment_status);


--
-- Name: idx_boms_grade; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_boms_grade ON public.boms USING btree (grade);


--
-- Name: idx_boms_organization_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_boms_organization_id ON public.boms USING btree (organization_id);


--
-- Name: idx_boms_project_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_boms_project_id ON public.boms USING btree (project_id);


--
-- Name: idx_boms_risk_grade; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_boms_risk_grade ON public.boms USING btree (risk_grade);


--
-- Name: idx_boms_risk_score; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_boms_risk_score ON public.boms USING btree (risk_score DESC);


--
-- Name: idx_boms_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_boms_status ON public.boms USING btree (status);


--
-- Name: idx_boms_temporal_workflow; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_boms_temporal_workflow ON public.boms USING btree (temporal_workflow_id);


--
-- Name: idx_cns_bulk_uploads_archived; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cns_bulk_uploads_archived ON public.cns_bulk_uploads USING btree (archived) WHERE (archived = false);


--
-- Name: idx_cns_bulk_uploads_cns_job_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cns_bulk_uploads_cns_job_id ON public.cns_bulk_uploads USING btree (cns_job_id);


--
-- Name: idx_cns_bulk_uploads_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cns_bulk_uploads_created_at ON public.cns_bulk_uploads USING btree (created_at DESC);


--
-- Name: idx_cns_bulk_uploads_organization_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cns_bulk_uploads_organization_id ON public.cns_bulk_uploads USING btree (organization_id);


--
-- Name: idx_cns_bulk_uploads_project_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cns_bulk_uploads_project_id ON public.cns_bulk_uploads USING btree (project_id);


--
-- Name: idx_cns_bulk_uploads_s3_key; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cns_bulk_uploads_s3_key ON public.cns_bulk_uploads USING btree (s3_key);


--
-- Name: idx_cns_bulk_uploads_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cns_bulk_uploads_status ON public.cns_bulk_uploads USING btree (status);


--
-- Name: idx_cns_bulk_uploads_tenant_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cns_bulk_uploads_tenant_id ON public.cns_bulk_uploads USING btree (tenant_id);


--
-- Name: idx_cns_bulk_uploads_uploaded_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cns_bulk_uploads_uploaded_by ON public.cns_bulk_uploads USING btree (uploaded_by);


--
-- Name: idx_cns_bulk_uploads_workflow_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cns_bulk_uploads_workflow_id ON public.cns_bulk_uploads USING btree (temporal_workflow_id);


--
-- Name: idx_component_base_risk_calc_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_component_base_risk_calc_date ON public.component_base_risk_scores USING btree (calculation_date DESC);


--
-- Name: idx_component_base_risk_level; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_component_base_risk_level ON public.component_base_risk_scores USING btree (default_risk_level);


--
-- Name: idx_component_base_risk_mfr; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_component_base_risk_mfr ON public.component_base_risk_scores USING btree (manufacturer);


--
-- Name: idx_component_base_risk_mpn; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_component_base_risk_mpn ON public.component_base_risk_scores USING btree (mpn);


--
-- Name: idx_component_base_risk_mpn_mfr; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_component_base_risk_mpn_mfr ON public.component_base_risk_scores USING btree (mpn, manufacturer);


--
-- Name: idx_component_base_risk_score; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_component_base_risk_score ON public.component_base_risk_scores USING btree (default_total_score DESC);


--
-- Name: idx_deletion_audit_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_deletion_audit_created ON public.account_deletion_audit USING btree (created_at DESC);


--
-- Name: idx_deletion_audit_event_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_deletion_audit_event_type ON public.account_deletion_audit USING btree (event_type);


--
-- Name: idx_deletion_audit_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_deletion_audit_org ON public.account_deletion_audit USING btree (organization_id);


--
-- Name: idx_deliveries_alert; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_deliveries_alert ON public.alert_deliveries USING btree (alert_id);


--
-- Name: idx_deliveries_method; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_deliveries_method ON public.alert_deliveries USING btree (delivery_method);


--
-- Name: idx_deliveries_next_retry; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_deliveries_next_retry ON public.alert_deliveries USING btree (next_retry_at) WHERE (status = 'retrying'::text);


--
-- Name: idx_deliveries_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_deliveries_status ON public.alert_deliveries USING btree (status);


--
-- Name: idx_enrichment_audit_bom; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_enrichment_audit_bom ON public.enrichment_audit_log USING btree (bom_id, created_at DESC);


--
-- Name: idx_enrichment_audit_event_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_enrichment_audit_event_type ON public.enrichment_audit_log USING btree (event_type);


--
-- Name: idx_enrichment_audit_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_enrichment_audit_org ON public.enrichment_audit_log USING btree (organization_id, created_at DESC);


--
-- Name: idx_enrichment_audit_workflow; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_enrichment_audit_workflow ON public.enrichment_audit_log USING btree (temporal_workflow_id);


--
-- Name: idx_enrichment_events_bom_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_enrichment_events_bom_created ON public.enrichment_events USING btree (bom_id, created_at DESC);


--
-- Name: idx_enrichment_events_payload; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_enrichment_events_payload ON public.enrichment_events USING gin (payload);


--
-- Name: idx_enrichment_events_source_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_enrichment_events_source_created ON public.enrichment_events USING btree (source, created_at DESC);


--
-- Name: idx_enrichment_events_state; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_enrichment_events_state ON public.enrichment_events USING gin (state);


--
-- Name: idx_enrichment_events_tenant_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_enrichment_events_tenant_created ON public.enrichment_events USING btree (organization_id, created_at DESC);


--
-- Name: idx_enrichment_events_type_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_enrichment_events_type_created ON public.enrichment_events USING btree (event_type, created_at DESC);


--
-- Name: idx_enrichment_events_workflow; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_enrichment_events_workflow ON public.enrichment_events USING btree (workflow_id);


--
-- Name: idx_enrichment_history_api_calls; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_enrichment_history_api_calls ON public.enrichment_history USING gin (api_calls);


--
-- Name: idx_enrichment_history_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_enrichment_history_created_at ON public.enrichment_history USING btree (created_at);


--
-- Name: idx_enrichment_history_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_enrichment_history_customer ON public.enrichment_history USING btree (customer_id) WHERE (customer_id IS NOT NULL);


--
-- Name: idx_enrichment_history_data; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_enrichment_history_data ON public.enrichment_history USING gin (enrichment_data);


--
-- Name: idx_enrichment_history_mpn; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_enrichment_history_mpn ON public.enrichment_history USING btree (mpn);


--
-- Name: idx_enrichment_history_quality; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_enrichment_history_quality ON public.enrichment_history USING btree (quality_score);


--
-- Name: idx_enrichment_history_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_enrichment_history_status ON public.enrichment_history USING btree (status);


--
-- Name: idx_enrichment_queue_approval; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_enrichment_queue_approval ON public.enrichment_queue USING btree (requires_admin_approval) WHERE (requires_admin_approval = true);


--
-- Name: idx_enrichment_queue_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_enrichment_queue_org ON public.enrichment_queue USING btree (organization_id);


--
-- Name: idx_enrichment_queue_priority; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_enrichment_queue_priority ON public.enrichment_queue USING btree (priority DESC, queued_at);


--
-- Name: idx_enrichment_queue_quality; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_enrichment_queue_quality ON public.enrichment_queue USING btree (quality_score);


--
-- Name: idx_enrichment_queue_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_enrichment_queue_status ON public.enrichment_queue USING btree (status);


--
-- Name: idx_enrichment_queue_workflow; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_enrichment_queue_workflow ON public.enrichment_queue USING btree (temporal_workflow_id);


--
-- Name: idx_invoices_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_invoices_customer ON public.invoices USING btree (billing_customer_id);


--
-- Name: idx_invoices_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_invoices_date ON public.invoices USING btree (invoice_date);


--
-- Name: idx_invoices_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_invoices_org ON public.invoices USING btree (organization_id);


--
-- Name: idx_invoices_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_invoices_status ON public.invoices USING btree (status);


--
-- Name: idx_notifications_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_created ON public.notifications USING btree (created_at DESC);


--
-- Name: idx_notifications_is_read; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_is_read ON public.notifications USING btree (is_read);


--
-- Name: idx_notifications_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_org ON public.notifications USING btree (organization_id);


--
-- Name: idx_onboarding_events_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_onboarding_events_org ON public.onboarding_events USING btree (organization_id, created_at DESC);


--
-- Name: idx_onboarding_events_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_onboarding_events_user ON public.onboarding_events USING btree (user_id, created_at DESC);


--
-- Name: idx_org_invitations_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_org_invitations_email ON public.organization_invitations USING btree (email);


--
-- Name: idx_org_invitations_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_org_invitations_org ON public.organization_invitations USING btree (organization_id);


--
-- Name: idx_org_invitations_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_org_invitations_token ON public.organization_invitations USING btree (token);


--
-- Name: idx_org_memberships_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_org_memberships_org ON public.organization_memberships USING btree (organization_id);


--
-- Name: idx_org_memberships_org_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_org_memberships_org_user ON public.organization_memberships USING btree (organization_id, user_id);


--
-- Name: idx_org_memberships_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_org_memberships_user ON public.organization_memberships USING btree (user_id);


--
-- Name: idx_org_memberships_user_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_org_memberships_user_org ON public.organization_memberships USING btree (user_id, organization_id);


--
-- Name: idx_org_memberships_user_role; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_org_memberships_user_role ON public.organization_memberships USING btree (user_id, role);


--
-- Name: idx_org_risk_profiles_org_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_org_risk_profiles_org_id ON public.organization_risk_profiles USING btree (organization_id);


--
-- Name: idx_org_risk_profiles_preset; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_org_risk_profiles_preset ON public.organization_risk_profiles USING btree (preset_name);


--
-- Name: idx_org_settings_audit_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_org_settings_audit_org ON public.organization_settings_audit USING btree (organization_id, changed_at DESC);


--
-- Name: idx_organizations_auth0_org_id; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_organizations_auth0_org_id ON public.organizations USING btree (auth0_org_id) WHERE (auth0_org_id IS NOT NULL);


--
-- Name: idx_organizations_org_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_organizations_org_type ON public.organizations USING btree (org_type);


--
-- Name: idx_organizations_pending_deletion; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_organizations_pending_deletion ON public.organizations USING btree (deletion_scheduled_at) WHERE ((deleted_at IS NULL) AND (deletion_scheduled_at IS NOT NULL));


--
-- Name: idx_organizations_suspended; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_organizations_suspended ON public.organizations USING btree (is_suspended) WHERE (is_suspended = true);


--
-- Name: idx_payment_methods_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payment_methods_customer ON public.payment_methods USING btree (billing_customer_id);


--
-- Name: idx_payment_methods_default; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payment_methods_default ON public.payment_methods USING btree (billing_customer_id, is_default) WHERE (is_default = true);


--
-- Name: idx_payments_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payments_customer ON public.payments USING btree (billing_customer_id);


--
-- Name: idx_payments_invoice; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payments_invoice ON public.payments USING btree (invoice_id);


--
-- Name: idx_payments_provider; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payments_provider ON public.payments USING btree (provider, provider_payment_id);


--
-- Name: idx_payments_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payments_status ON public.payments USING btree (status);


--
-- Name: idx_project_risk_summary_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_project_risk_summary_org ON public.project_risk_summaries USING btree (organization_id);


--
-- Name: idx_project_risk_summary_project; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_project_risk_summary_project ON public.project_risk_summaries USING btree (project_id);


--
-- Name: idx_project_risk_summary_score; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_project_risk_summary_score ON public.project_risk_summaries USING btree (average_bom_health_score DESC);


--
-- Name: idx_projects_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_projects_workspace ON public.projects USING btree (workspace_id);


--
-- Name: idx_risk_history_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_risk_history_date ON public.risk_score_history USING btree (recorded_date DESC);


--
-- Name: idx_risk_history_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_risk_history_entity ON public.risk_score_history USING btree (entity_type, entity_id);


--
-- Name: idx_risk_history_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_risk_history_org ON public.risk_score_history USING btree (organization_id);


--
-- Name: idx_subscription_plans_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscription_plans_active ON public.subscription_plans USING btree (is_active) WHERE (is_active = true);


--
-- Name: idx_subscription_plans_tier; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscription_plans_tier ON public.subscription_plans USING btree (tier);


--
-- Name: idx_subscriptions_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscriptions_customer ON public.subscriptions USING btree (billing_customer_id);


--
-- Name: idx_subscriptions_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscriptions_org ON public.subscriptions USING btree (organization_id);


--
-- Name: idx_subscriptions_period_end; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscriptions_period_end ON public.subscriptions USING btree (current_period_end);


--
-- Name: idx_subscriptions_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscriptions_status ON public.subscriptions USING btree (status);


--
-- Name: idx_usage_records_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_usage_records_org ON public.usage_records USING btree (organization_id);


--
-- Name: idx_usage_records_period; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_usage_records_period ON public.usage_records USING btree (period_start, period_end);


--
-- Name: idx_usage_records_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_usage_records_type ON public.usage_records USING btree (usage_type);


--
-- Name: idx_users_auth0_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_auth0_user_id ON public.users USING btree (auth0_user_id);


--
-- Name: idx_users_auth_subject; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_auth_subject ON public.users USING btree (auth_subject);


--
-- Name: idx_users_deleted; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_deleted ON public.users USING btree (deleted_at) WHERE (deleted_at IS NOT NULL);


--
-- Name: idx_users_is_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_is_active ON public.users USING btree (is_active);


--
-- Name: idx_users_novu_subscriber; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_novu_subscriber ON public.users USING btree (novu_subscriber_id) WHERE (novu_subscriber_id IS NOT NULL);


--
-- Name: idx_users_novu_sync_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_novu_sync_status ON public.users USING btree (novu_sync_status) WHERE ((novu_sync_status)::text = ANY ((ARRAY['pending'::character varying, 'failed'::character varying])::text[]));


--
-- Name: idx_users_role; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_role ON public.users USING btree (role);


--
-- Name: idx_watches_component; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_watches_component ON public.component_watches USING btree (component_id);


--
-- Name: idx_watches_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_watches_user ON public.component_watches USING btree (user_id);


--
-- Name: idx_webhook_events_provider; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_webhook_events_provider ON public.billing_webhook_events USING btree (provider, event_type);


--
-- Name: idx_webhook_events_unprocessed; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_webhook_events_unprocessed ON public.billing_webhook_events USING btree (processed) WHERE (processed = false);


--
-- Name: idx_workspaces_default; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workspaces_default ON public.workspaces USING btree (organization_id) WHERE (is_default = true);


--
-- Name: idx_workspaces_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workspaces_org ON public.workspaces USING btree (organization_id);


--
-- Name: idx_workspaces_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workspaces_slug ON public.workspaces USING btree (slug);


--
-- Name: idx_ws_invitations_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ws_invitations_email ON public.workspace_invitations USING btree (email);


--
-- Name: idx_ws_invitations_pending; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ws_invitations_pending ON public.workspace_invitations USING btree (workspace_id, expires_at) WHERE ((accepted_at IS NULL) AND (revoked_at IS NULL));


--
-- Name: idx_ws_invitations_pending_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_ws_invitations_pending_unique ON public.workspace_invitations USING btree (workspace_id, email) WHERE ((accepted_at IS NULL) AND (revoked_at IS NULL));


--
-- Name: idx_ws_invitations_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ws_invitations_token ON public.workspace_invitations USING btree (token);


--
-- Name: idx_ws_invitations_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ws_invitations_workspace ON public.workspace_invitations USING btree (workspace_id);


--
-- Name: idx_ws_memberships_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ws_memberships_user ON public.workspace_memberships USING btree (user_id);


--
-- Name: idx_ws_memberships_user_role; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ws_memberships_user_role ON public.workspace_memberships USING btree (user_id, role);


--
-- Name: idx_ws_memberships_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ws_memberships_workspace ON public.workspace_memberships USING btree (workspace_id);


--
-- Name: schema_migrations_version_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX schema_migrations_version_idx ON public.schema_migrations USING btree (version);


--
-- Name: user_alerts_with_status _RETURN; Type: RULE; Schema: public; Owner: -
--

CREATE OR REPLACE VIEW public.user_alerts_with_status AS
 SELECT a.id,
    a.organization_id,
    a.component_id,
    a.severity,
    a.alert_type,
    a.title,
    a.message,
    a.is_read,
    a.is_dismissed,
    a.created_at,
    a.read_at,
    a.dismissed_at,
    a.user_id,
    a.context,
    a.action_url,
    a.delivered_at,
    a.archived_at,
    a.snoozed_until,
    a.deleted_at,
    count(ad.id) AS delivery_attempts,
    max(ad.delivered_at) AS last_delivered_at,
    bool_or((ad.status = 'failed'::text)) AS has_failed_delivery
   FROM (public.alerts a
     LEFT JOIN public.alert_deliveries ad ON ((a.id = ad.alert_id)))
  WHERE ((a.deleted_at IS NULL) AND ((a.snoozed_until IS NULL) OR (a.snoozed_until < now())))
  GROUP BY a.id;


--
-- Name: users trigger_create_default_alert_prefs; Type: TRIGGER; Schema: auth; Owner: -
--

CREATE TRIGGER trigger_create_default_alert_prefs AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.create_default_alert_preferences();


--
-- Name: users auto_add_platform_staff_to_platform_org; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER auto_add_platform_staff_to_platform_org AFTER INSERT OR UPDATE OF role, is_platform_admin ON public.users FOR EACH ROW EXECUTE FUNCTION public.trigger_auto_add_platform_staff_to_platform_org();


--
-- Name: TRIGGER auto_add_platform_staff_to_platform_org ON users; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TRIGGER auto_add_platform_staff_to_platform_org ON public.users IS 'Automatically adds users with role=super_admin/platform_admin or is_platform_admin=true to the Platform Super Admin organization.';


--
-- Name: bom_items bom_items_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER bom_items_updated_at BEFORE UPDATE ON public.bom_items FOR EACH ROW EXECUTE FUNCTION public.update_bom_items_updated_at();


--
-- Name: invoices set_invoice_number; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_invoice_number BEFORE INSERT ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.trigger_set_invoice_number();


--
-- Name: user_preferences set_user_preferences_timestamp; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_user_preferences_timestamp BEFORE UPDATE ON public.user_preferences FOR EACH ROW EXECUTE FUNCTION public.update_user_preferences_timestamp();


--
-- Name: workspaces set_workspaces_timestamp; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_workspaces_timestamp BEFORE UPDATE ON public.workspaces FOR EACH ROW EXECUTE FUNCTION public.update_workspaces_timestamp();


--
-- Name: workspace_memberships set_ws_memberships_timestamp; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_ws_memberships_timestamp BEFORE UPDATE ON public.workspace_memberships FOR EACH ROW EXECUTE FUNCTION public.update_workspaces_timestamp();


--
-- Name: projects trigger_auto_generate_project_slug; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_auto_generate_project_slug BEFORE INSERT OR UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.auto_generate_project_slug();


--
-- Name: organizations trigger_auto_generate_tenant_slug; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_auto_generate_tenant_slug BEFORE INSERT OR UPDATE ON public.organizations FOR EACH ROW EXECUTE FUNCTION public.auto_generate_tenant_slug();


--
-- Name: bom_risk_summaries trigger_bom_risk_summary_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_bom_risk_summary_updated_at BEFORE UPDATE ON public.bom_risk_summaries FOR EACH ROW EXECUTE FUNCTION public.update_bom_risk_summary_timestamp();


--
-- Name: organization_risk_profiles trigger_risk_profile_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_risk_profile_updated_at BEFORE UPDATE ON public.organization_risk_profiles FOR EACH ROW EXECUTE FUNCTION public.update_risk_profile_timestamp();


--
-- Name: enrichment_queue trigger_update_bom_from_queue; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_bom_from_queue AFTER UPDATE ON public.enrichment_queue FOR EACH ROW EXECUTE FUNCTION public.update_bom_enrichment_from_queue();


--
-- Name: bom_uploads trigger_update_bom_uploads_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_bom_uploads_updated_at BEFORE UPDATE ON public.bom_uploads FOR EACH ROW EXECUTE FUNCTION public.update_bom_uploads_updated_at();


--
-- Name: cns_bulk_uploads trigger_update_cns_bulk_uploads_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_cns_bulk_uploads_updated_at BEFORE UPDATE ON public.cns_bulk_uploads FOR EACH ROW EXECUTE FUNCTION public.update_cns_bulk_uploads_updated_at();


--
-- Name: billing_customers update_billing_customers_timestamp; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_billing_customers_timestamp BEFORE UPDATE ON public.billing_customers FOR EACH ROW EXECUTE FUNCTION public.trigger_update_billing_timestamp();


--
-- Name: bom_jobs update_bom_jobs_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_bom_jobs_updated_at BEFORE UPDATE ON public.bom_jobs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: enrichment_queue update_enrichment_queue_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_enrichment_queue_updated_at BEFORE UPDATE ON public.enrichment_queue FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: invoices update_invoices_timestamp; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_invoices_timestamp BEFORE UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.trigger_update_billing_timestamp();


--
-- Name: payments update_payments_timestamp; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_payments_timestamp BEFORE UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION public.trigger_update_billing_timestamp();


--
-- Name: subscription_plans update_subscription_plans_timestamp; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_subscription_plans_timestamp BEFORE UPDATE ON public.subscription_plans FOR EACH ROW EXECUTE FUNCTION public.trigger_update_billing_timestamp();


--
-- Name: subscriptions update_subscriptions_timestamp; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_subscriptions_timestamp BEFORE UPDATE ON public.subscriptions FOR EACH ROW EXECUTE FUNCTION public.trigger_update_billing_timestamp();


--
-- Name: identities identities_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.identities
    ADD CONSTRAINT identities_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: mfa_amr_claims mfa_amr_claims_session_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_amr_claims
    ADD CONSTRAINT mfa_amr_claims_session_id_fkey FOREIGN KEY (session_id) REFERENCES auth.sessions(id) ON DELETE CASCADE;


--
-- Name: mfa_challenges mfa_challenges_auth_factor_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_challenges
    ADD CONSTRAINT mfa_challenges_auth_factor_id_fkey FOREIGN KEY (factor_id) REFERENCES auth.mfa_factors(id) ON DELETE CASCADE;


--
-- Name: mfa_factors mfa_factors_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_factors
    ADD CONSTRAINT mfa_factors_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: refresh_tokens refresh_tokens_session_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.refresh_tokens
    ADD CONSTRAINT refresh_tokens_session_id_fkey FOREIGN KEY (session_id) REFERENCES auth.sessions(id) ON DELETE CASCADE;


--
-- Name: saml_providers saml_providers_sso_provider_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_providers
    ADD CONSTRAINT saml_providers_sso_provider_id_fkey FOREIGN KEY (sso_provider_id) REFERENCES auth.sso_providers(id) ON DELETE CASCADE;


--
-- Name: saml_relay_states saml_relay_states_flow_state_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_relay_states
    ADD CONSTRAINT saml_relay_states_flow_state_id_fkey FOREIGN KEY (flow_state_id) REFERENCES auth.flow_state(id) ON DELETE CASCADE;


--
-- Name: saml_relay_states saml_relay_states_sso_provider_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_relay_states
    ADD CONSTRAINT saml_relay_states_sso_provider_id_fkey FOREIGN KEY (sso_provider_id) REFERENCES auth.sso_providers(id) ON DELETE CASCADE;


--
-- Name: sessions sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sessions
    ADD CONSTRAINT sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: sso_domains sso_domains_sso_provider_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sso_domains
    ADD CONSTRAINT sso_domains_sso_provider_id_fkey FOREIGN KEY (sso_provider_id) REFERENCES auth.sso_providers(id) ON DELETE CASCADE;


--
-- Name: alert_deliveries alert_deliveries_alert_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alert_deliveries
    ADD CONSTRAINT alert_deliveries_alert_id_fkey FOREIGN KEY (alert_id) REFERENCES public.alerts(id) ON DELETE CASCADE;


--
-- Name: alert_preferences alert_preferences_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alert_preferences
    ADD CONSTRAINT alert_preferences_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: alerts alerts_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alerts
    ADD CONSTRAINT alerts_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: alerts alerts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alerts
    ADD CONSTRAINT alerts_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: billing_customers billing_customers_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.billing_customers
    ADD CONSTRAINT billing_customers_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: bom_line_item_risk_scores bom_line_item_risk_scores_base_risk_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bom_line_item_risk_scores
    ADD CONSTRAINT bom_line_item_risk_scores_base_risk_id_fkey FOREIGN KEY (base_risk_id) REFERENCES public.component_base_risk_scores(id) ON DELETE SET NULL;


--
-- Name: bom_line_item_risk_scores bom_line_item_risk_scores_bom_line_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bom_line_item_risk_scores
    ADD CONSTRAINT bom_line_item_risk_scores_bom_line_item_id_fkey FOREIGN KEY (bom_line_item_id) REFERENCES public.bom_line_items(id) ON DELETE CASCADE;


--
-- Name: bom_line_item_risk_scores bom_line_item_risk_scores_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bom_line_item_risk_scores
    ADD CONSTRAINT bom_line_item_risk_scores_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: bom_line_items bom_line_items_bom_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bom_line_items
    ADD CONSTRAINT bom_line_items_bom_id_fkey FOREIGN KEY (bom_id) REFERENCES public.boms(id) ON DELETE CASCADE;


--
-- Name: bom_risk_summaries bom_risk_summaries_bom_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bom_risk_summaries
    ADD CONSTRAINT bom_risk_summaries_bom_id_fkey FOREIGN KEY (bom_id) REFERENCES public.boms(id) ON DELETE CASCADE;


--
-- Name: bom_risk_summaries bom_risk_summaries_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bom_risk_summaries
    ADD CONSTRAINT bom_risk_summaries_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: bom_uploads bom_uploads_bom_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bom_uploads
    ADD CONSTRAINT bom_uploads_bom_id_fkey FOREIGN KEY (bom_id) REFERENCES public.boms(id) ON DELETE SET NULL;


--
-- Name: bom_uploads bom_uploads_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bom_uploads
    ADD CONSTRAINT bom_uploads_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: bom_uploads bom_uploads_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bom_uploads
    ADD CONSTRAINT bom_uploads_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE SET NULL;


--
-- Name: bom_uploads bom_uploads_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bom_uploads
    ADD CONSTRAINT bom_uploads_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: boms boms_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.boms
    ADD CONSTRAINT boms_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: boms boms_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.boms
    ADD CONSTRAINT boms_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE SET NULL;


--
-- Name: cns_bulk_uploads cns_bulk_uploads_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cns_bulk_uploads
    ADD CONSTRAINT cns_bulk_uploads_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: cns_bulk_uploads cns_bulk_uploads_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cns_bulk_uploads
    ADD CONSTRAINT cns_bulk_uploads_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: component_watches component_watches_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.component_watches
    ADD CONSTRAINT component_watches_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: enrichment_audit_log enrichment_audit_log_bom_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.enrichment_audit_log
    ADD CONSTRAINT enrichment_audit_log_bom_id_fkey FOREIGN KEY (bom_id) REFERENCES public.boms(id) ON DELETE CASCADE;


--
-- Name: enrichment_audit_log enrichment_audit_log_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.enrichment_audit_log
    ADD CONSTRAINT enrichment_audit_log_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: enrichment_events enrichment_events_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.enrichment_events
    ADD CONSTRAINT enrichment_events_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: enrichment_queue enrichment_queue_bom_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.enrichment_queue
    ADD CONSTRAINT enrichment_queue_bom_id_fkey FOREIGN KEY (bom_id) REFERENCES public.boms(id) ON DELETE CASCADE;


--
-- Name: enrichment_queue enrichment_queue_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.enrichment_queue
    ADD CONSTRAINT enrichment_queue_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: bom_items fk_bom_job; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bom_items
    ADD CONSTRAINT fk_bom_job FOREIGN KEY (job_id) REFERENCES public.bom_jobs(job_id) ON DELETE CASCADE;


--
-- Name: invoice_line_items invoice_line_items_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_line_items
    ADD CONSTRAINT invoice_line_items_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoices(id) ON DELETE CASCADE;


--
-- Name: invoices invoices_billing_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_billing_customer_id_fkey FOREIGN KEY (billing_customer_id) REFERENCES public.billing_customers(id);


--
-- Name: invoices invoices_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: invoices invoices_subscription_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_subscription_id_fkey FOREIGN KEY (subscription_id) REFERENCES public.subscriptions(id);


--
-- Name: notifications notifications_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: onboarding_events onboarding_events_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.onboarding_events
    ADD CONSTRAINT onboarding_events_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: organization_invitations organization_invitations_accepted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_invitations
    ADD CONSTRAINT organization_invitations_accepted_by_fkey FOREIGN KEY (accepted_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: organization_invitations organization_invitations_invited_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_invitations
    ADD CONSTRAINT organization_invitations_invited_by_fkey FOREIGN KEY (invited_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: organization_invitations organization_invitations_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_invitations
    ADD CONSTRAINT organization_invitations_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: organization_memberships organization_memberships_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_memberships
    ADD CONSTRAINT organization_memberships_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: organization_memberships organization_memberships_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_memberships
    ADD CONSTRAINT organization_memberships_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: organization_risk_profiles organization_risk_profiles_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_risk_profiles
    ADD CONSTRAINT organization_risk_profiles_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: organization_settings_audit organization_settings_audit_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_settings_audit
    ADD CONSTRAINT organization_settings_audit_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: organizations organizations_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: payment_methods payment_methods_billing_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_methods
    ADD CONSTRAINT payment_methods_billing_customer_id_fkey FOREIGN KEY (billing_customer_id) REFERENCES public.billing_customers(id) ON DELETE CASCADE;


--
-- Name: payments payments_billing_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_billing_customer_id_fkey FOREIGN KEY (billing_customer_id) REFERENCES public.billing_customers(id);


--
-- Name: payments payments_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoices(id);


--
-- Name: payments payments_payment_method_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_payment_method_id_fkey FOREIGN KEY (payment_method_id) REFERENCES public.payment_methods(id);


--
-- Name: payments payments_subscription_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_subscription_id_fkey FOREIGN KEY (subscription_id) REFERENCES public.subscriptions(id);


--
-- Name: project_risk_summaries project_risk_summaries_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_risk_summaries
    ADD CONSTRAINT project_risk_summaries_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: project_risk_summaries project_risk_summaries_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_risk_summaries
    ADD CONSTRAINT project_risk_summaries_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: projects projects_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: projects projects_project_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_project_owner_id_fkey FOREIGN KEY (project_owner_id) REFERENCES public.users(id);


--
-- Name: projects projects_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE SET NULL;


--
-- Name: risk_score_history risk_score_history_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.risk_score_history
    ADD CONSTRAINT risk_score_history_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: subscriptions subscriptions_billing_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_billing_customer_id_fkey FOREIGN KEY (billing_customer_id) REFERENCES public.billing_customers(id) ON DELETE CASCADE;


--
-- Name: subscriptions subscriptions_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: subscriptions subscriptions_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.subscription_plans(id);


--
-- Name: usage_records usage_records_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usage_records
    ADD CONSTRAINT usage_records_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: usage_records usage_records_subscription_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usage_records
    ADD CONSTRAINT usage_records_subscription_id_fkey FOREIGN KEY (subscription_id) REFERENCES public.subscriptions(id);


--
-- Name: user_preferences user_preferences_last_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_preferences
    ADD CONSTRAINT user_preferences_last_organization_id_fkey FOREIGN KEY (last_organization_id) REFERENCES public.organizations(id) ON DELETE SET NULL;


--
-- Name: user_preferences user_preferences_last_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_preferences
    ADD CONSTRAINT user_preferences_last_workspace_id_fkey FOREIGN KEY (last_workspace_id) REFERENCES public.workspaces(id) ON DELETE SET NULL;


--
-- Name: user_preferences user_preferences_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_preferences
    ADD CONSTRAINT user_preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: users users_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE SET NULL;


--
-- Name: workspace_invitations workspace_invitations_accepted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_invitations
    ADD CONSTRAINT workspace_invitations_accepted_by_fkey FOREIGN KEY (accepted_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: workspace_invitations workspace_invitations_invited_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_invitations
    ADD CONSTRAINT workspace_invitations_invited_by_fkey FOREIGN KEY (invited_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: workspace_invitations workspace_invitations_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_invitations
    ADD CONSTRAINT workspace_invitations_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: workspace_memberships workspace_memberships_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_memberships
    ADD CONSTRAINT workspace_memberships_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: workspace_memberships workspace_memberships_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_memberships
    ADD CONSTRAINT workspace_memberships_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: workspaces workspaces_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspaces
    ADD CONSTRAINT workspaces_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: workspaces workspaces_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspaces
    ADD CONSTRAINT workspaces_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: account_deletion_audit; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.account_deletion_audit ENABLE ROW LEVEL SECURITY;

--
-- Name: account_deletion_audit account_deletion_audit_owner_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY account_deletion_audit_owner_select ON public.account_deletion_audit FOR SELECT USING ((EXISTS ( SELECT 1
   FROM (public.users u
     JOIN public.organization_memberships om ON ((u.id = om.user_id)))
  WHERE ((u.auth0_user_id = (auth.uid())::text) AND (om.organization_id = account_deletion_audit.organization_id) AND (om.role = 'owner'::text)))));


--
-- Name: account_deletion_audit account_deletion_audit_super_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY account_deletion_audit_super_admin ON public.account_deletion_audit USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());


--
-- Name: alert_deliveries; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.alert_deliveries ENABLE ROW LEVEL SECURITY;

--
-- Name: alert_deliveries alert_deliveries_user_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY alert_deliveries_user_access ON public.alert_deliveries USING ((public.is_super_admin() OR (alert_id IN ( SELECT alerts.id
   FROM public.alerts
  WHERE (alerts.user_id = auth.uid()))))) WITH CHECK ((public.is_super_admin() OR (alert_id IN ( SELECT alerts.id
   FROM public.alerts
  WHERE (alerts.user_id = auth.uid())))));


--
-- Name: alert_preferences; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.alert_preferences ENABLE ROW LEVEL SECURITY;

--
-- Name: alert_preferences alert_preferences_user_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY alert_preferences_user_access ON public.alert_preferences USING (((user_id = auth.uid()) OR public.is_super_admin())) WITH CHECK (((user_id = auth.uid()) OR public.is_super_admin()));


--
-- Name: alerts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;

--
-- Name: alerts alerts_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY alerts_delete ON public.alerts FOR DELETE USING ((public.is_super_admin() OR (user_id = public.get_current_user_id()) OR public.is_admin_of(organization_id)));


--
-- Name: alerts alerts_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY alerts_insert ON public.alerts FOR INSERT WITH CHECK ((public.is_super_admin() OR (organization_id IN ( SELECT public.get_user_organization_ids() AS get_user_organization_ids))));


--
-- Name: alerts alerts_org_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY alerts_org_access ON public.alerts USING (((organization_id = public.current_user_organization_id()) OR public.is_super_admin())) WITH CHECK (((organization_id = public.current_user_organization_id()) OR public.is_super_admin()));


--
-- Name: alerts alerts_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY alerts_select ON public.alerts FOR SELECT USING ((public.is_super_admin() OR (organization_id IN ( SELECT public.get_user_organization_ids() AS get_user_organization_ids))));


--
-- Name: alerts alerts_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY alerts_update ON public.alerts FOR UPDATE USING ((public.is_super_admin() OR (user_id = public.get_current_user_id()) OR public.is_admin_of(organization_id))) WITH CHECK ((public.is_super_admin() OR (user_id = public.get_current_user_id()) OR public.is_admin_of(organization_id)));


--
-- Name: audit_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: audit_logs audit_logs_org_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY audit_logs_org_select ON public.audit_logs FOR SELECT USING ((public.is_super_admin() OR (organization_id IN ( SELECT users.organization_id
   FROM public.users
  WHERE (users.id = auth.uid())))));


--
-- Name: billing_customers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.billing_customers ENABLE ROW LEVEL SECURITY;

--
-- Name: bom_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.bom_items ENABLE ROW LEVEL SECURITY;

--
-- Name: bom_items bom_items_org_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY bom_items_org_access ON public.bom_items USING ((public.is_super_admin() OR (EXISTS ( SELECT 1
   FROM public.bom_jobs j
  WHERE ((j.id = (bom_items.job_id)::integer) AND ((j.organization_id)::text = (public.current_user_organization_id())::text)))))) WITH CHECK ((public.is_super_admin() OR (EXISTS ( SELECT 1
   FROM public.bom_jobs j
  WHERE ((j.id = (bom_items.job_id)::integer) AND ((j.organization_id)::text = (public.current_user_organization_id())::text))))));


--
-- Name: bom_line_item_risk_scores; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.bom_line_item_risk_scores ENABLE ROW LEVEL SECURITY;

--
-- Name: bom_line_item_risk_scores bom_line_item_risk_scores_org_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY bom_line_item_risk_scores_org_access ON public.bom_line_item_risk_scores USING (((organization_id = public.current_user_organization_id()) OR public.is_super_admin())) WITH CHECK (((organization_id = public.current_user_organization_id()) OR public.is_super_admin()));


--
-- Name: bom_line_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.bom_line_items ENABLE ROW LEVEL SECURITY;

--
-- Name: bom_line_items bom_line_items_org_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY bom_line_items_org_access ON public.bom_line_items USING ((public.is_super_admin() OR (EXISTS ( SELECT 1
   FROM public.boms
  WHERE ((boms.id = bom_line_items.bom_id) AND (boms.organization_id = public.current_user_organization_id())))))) WITH CHECK ((public.is_super_admin() OR (EXISTS ( SELECT 1
   FROM public.boms
  WHERE ((boms.id = bom_line_items.bom_id) AND (boms.organization_id = public.current_user_organization_id()))))));


--
-- Name: bom_risk_summaries; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.bom_risk_summaries ENABLE ROW LEVEL SECURITY;

--
-- Name: bom_risk_summaries bom_risk_summaries_org_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY bom_risk_summaries_org_access ON public.bom_risk_summaries USING (((organization_id = public.current_user_organization_id()) OR public.is_super_admin())) WITH CHECK (((organization_id = public.current_user_organization_id()) OR public.is_super_admin()));


--
-- Name: bom_uploads; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.bom_uploads ENABLE ROW LEVEL SECURITY;

--
-- Name: bom_uploads bom_uploads_org_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY bom_uploads_org_access ON public.bom_uploads USING (((organization_id = public.current_user_organization_id()) OR public.is_super_admin())) WITH CHECK (((organization_id = public.current_user_organization_id()) OR public.is_super_admin()));


--
-- Name: boms; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.boms ENABLE ROW LEVEL SECURITY;

--
-- Name: boms boms_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY boms_delete ON public.boms FOR DELETE USING ((public.is_super_admin() OR public.is_admin_of(organization_id) OR (EXISTS ( SELECT 1
   FROM public.projects p
  WHERE ((p.id = boms.project_id) AND public.is_workspace_admin(p.workspace_id))))));


--
-- Name: boms boms_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY boms_insert ON public.boms FOR INSERT WITH CHECK ((public.is_super_admin() OR ((organization_id IN ( SELECT public.get_user_organization_ids() AS get_user_organization_ids)) AND ((public.get_role_in_org(organization_id) = ANY (ARRAY['owner'::text, 'admin'::text, 'engineer'::text])) OR (EXISTS ( SELECT 1
   FROM public.projects p
  WHERE ((p.id = boms.project_id) AND (p.workspace_id IN ( SELECT public.get_user_workspace_ids() AS get_user_workspace_ids)) AND (public.get_role_in_workspace(p.workspace_id) = ANY (ARRAY['admin'::text, 'engineer'::text])))))))));


--
-- Name: boms boms_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY boms_select ON public.boms FOR SELECT USING ((public.is_super_admin() OR (organization_id IN ( SELECT public.get_user_organization_ids() AS get_user_organization_ids)) OR (EXISTS ( SELECT 1
   FROM public.projects p
  WHERE ((p.id = boms.project_id) AND (p.workspace_id IN ( SELECT public.get_user_workspace_ids() AS get_user_workspace_ids)))))));


--
-- Name: boms boms_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY boms_update ON public.boms FOR UPDATE USING ((public.is_super_admin() OR (organization_id IN ( SELECT public.get_user_organization_ids() AS get_user_organization_ids)))) WITH CHECK ((public.is_super_admin() OR ((public.get_role_in_org(organization_id) = ANY (ARRAY['owner'::text, 'admin'::text, 'engineer'::text])) OR (EXISTS ( SELECT 1
   FROM public.projects p
  WHERE ((p.id = boms.project_id) AND (public.get_role_in_workspace(p.workspace_id) = ANY (ARRAY['admin'::text, 'engineer'::text]))))))));


--
-- Name: component_base_risk_scores; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.component_base_risk_scores ENABLE ROW LEVEL SECURITY;

--
-- Name: component_watches; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.component_watches ENABLE ROW LEVEL SECURITY;

--
-- Name: component_watches component_watches_user_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY component_watches_user_access ON public.component_watches USING (((user_id = auth.uid()) OR public.is_super_admin())) WITH CHECK (((user_id = auth.uid()) OR public.is_super_admin()));


--
-- Name: enrichment_audit_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.enrichment_audit_log ENABLE ROW LEVEL SECURITY;

--
-- Name: enrichment_audit_log enrichment_audit_log_org_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY enrichment_audit_log_org_access ON public.enrichment_audit_log USING (((organization_id = public.current_user_organization_id()) OR public.is_super_admin())) WITH CHECK (((organization_id = public.current_user_organization_id()) OR public.is_super_admin()));


--
-- Name: enrichment_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.enrichment_events ENABLE ROW LEVEL SECURITY;

--
-- Name: enrichment_events enrichment_events_org_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY enrichment_events_org_access ON public.enrichment_events USING (((organization_id = public.current_user_organization_id()) OR public.is_super_admin())) WITH CHECK (((organization_id = public.current_user_organization_id()) OR public.is_super_admin()));


--
-- Name: enrichment_queue; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.enrichment_queue ENABLE ROW LEVEL SECURITY;

--
-- Name: enrichment_queue enrichment_queue_org_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY enrichment_queue_org_access ON public.enrichment_queue USING (((organization_id = public.current_user_organization_id()) OR public.is_super_admin())) WITH CHECK (((organization_id = public.current_user_organization_id()) OR public.is_super_admin()));


--
-- Name: invoice_line_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.invoice_line_items ENABLE ROW LEVEL SECURITY;

--
-- Name: invoices; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

--
-- Name: notifications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

--
-- Name: notifications notifications_org_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY notifications_org_access ON public.notifications USING (((organization_id = public.current_user_organization_id()) OR public.is_super_admin())) WITH CHECK (((organization_id = public.current_user_organization_id()) OR public.is_super_admin()));


--
-- Name: onboarding_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.onboarding_events ENABLE ROW LEVEL SECURITY;

--
-- Name: onboarding_events onboarding_events_system_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY onboarding_events_system_insert ON public.onboarding_events FOR INSERT WITH CHECK (true);


--
-- Name: organization_invitations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.organization_invitations ENABLE ROW LEVEL SECURITY;

--
-- Name: organization_invitations organization_invitations_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY organization_invitations_delete ON public.organization_invitations FOR DELETE USING ((public.is_super_admin() OR public.is_admin_of(organization_id)));


--
-- Name: organization_invitations organization_invitations_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY organization_invitations_insert ON public.organization_invitations FOR INSERT WITH CHECK ((public.is_super_admin() OR public.is_admin_of(organization_id)));


--
-- Name: organization_invitations organization_invitations_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY organization_invitations_select ON public.organization_invitations FOR SELECT USING ((public.is_super_admin() OR public.is_admin_of(organization_id) OR (email = ( SELECT users.email
   FROM public.users
  WHERE (users.auth0_user_id = (auth.jwt() ->> 'sub'::text))))));


--
-- Name: organization_invitations organization_invitations_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY organization_invitations_update ON public.organization_invitations FOR UPDATE USING ((public.is_super_admin() OR public.is_admin_of(organization_id))) WITH CHECK ((public.is_super_admin() OR public.is_admin_of(organization_id)));


--
-- Name: organization_memberships; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.organization_memberships ENABLE ROW LEVEL SECURITY;

--
-- Name: organization_memberships organization_memberships_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY organization_memberships_delete ON public.organization_memberships FOR DELETE USING ((public.is_super_admin() OR (public.is_admin_of(organization_id) AND (user_id <> public.get_current_user_id()) AND (role <> 'owner'::text)) OR ((user_id = public.get_current_user_id()) AND (role <> 'owner'::text))));


--
-- Name: organization_memberships organization_memberships_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY organization_memberships_insert ON public.organization_memberships FOR INSERT WITH CHECK ((public.is_super_admin() OR (public.is_admin_of(organization_id) AND (role <> 'owner'::text)) OR ((user_id = public.get_current_user_id()) AND (role = 'owner'::text))));


--
-- Name: organization_memberships organization_memberships_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY organization_memberships_select ON public.organization_memberships FOR SELECT USING ((public.is_super_admin() OR (organization_id IN ( SELECT public.get_user_organization_ids() AS get_user_organization_ids))));


--
-- Name: organization_memberships organization_memberships_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY organization_memberships_update ON public.organization_memberships FOR UPDATE USING ((public.is_super_admin() OR (public.is_admin_of(organization_id) AND (user_id <> public.get_current_user_id())))) WITH CHECK ((public.is_super_admin() OR (public.is_admin_of(organization_id) AND (role <> 'owner'::text))));


--
-- Name: organization_risk_profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.organization_risk_profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: organization_risk_profiles organization_risk_profiles_org_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY organization_risk_profiles_org_access ON public.organization_risk_profiles USING (((organization_id = public.current_user_organization_id()) OR public.is_super_admin())) WITH CHECK (((organization_id = public.current_user_organization_id()) OR public.is_super_admin()));


--
-- Name: organization_settings_audit; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.organization_settings_audit ENABLE ROW LEVEL SECURITY;

--
-- Name: organization_settings_audit organization_settings_audit_system_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY organization_settings_audit_system_insert ON public.organization_settings_audit FOR INSERT WITH CHECK (true);


--
-- Name: organizations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

--
-- Name: organizations organizations_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY organizations_access ON public.organizations USING (((id = public.current_user_organization_id()) OR public.is_super_admin())) WITH CHECK (public.is_super_admin());


--
-- Name: organizations organizations_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY organizations_delete ON public.organizations FOR DELETE USING ((public.is_super_admin() OR (public.is_admin_of(id) AND (public.get_role_in_org(id) = 'owner'::text))));


--
-- Name: organizations organizations_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY organizations_insert ON public.organizations FOR INSERT WITH CHECK ((public.is_super_admin() OR (public.get_current_user_id() IS NOT NULL)));


--
-- Name: organizations organizations_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY organizations_select ON public.organizations FOR SELECT USING ((((deleted_at IS NULL) OR public.is_super_admin()) AND (public.is_super_admin() OR (id IN ( SELECT public.get_user_organization_ids() AS get_user_organization_ids)))));


--
-- Name: organizations organizations_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY organizations_update ON public.organizations FOR UPDATE USING ((public.is_super_admin() OR public.is_admin_of(id))) WITH CHECK ((public.is_super_admin() OR public.is_admin_of(id)));


--
-- Name: payment_methods; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;

--
-- Name: payments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

--
-- Name: project_risk_summaries; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.project_risk_summaries ENABLE ROW LEVEL SECURITY;

--
-- Name: project_risk_summaries project_risk_summaries_org_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY project_risk_summaries_org_access ON public.project_risk_summaries USING (((organization_id = public.current_user_organization_id()) OR public.is_super_admin())) WITH CHECK (((organization_id = public.current_user_organization_id()) OR public.is_super_admin()));


--
-- Name: projects; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

--
-- Name: projects projects_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY projects_delete ON public.projects FOR DELETE USING ((public.is_super_admin() OR ((workspace_id IS NOT NULL) AND public.is_workspace_admin(workspace_id)) OR ((workspace_id IS NULL) AND public.is_admin_of(organization_id))));


--
-- Name: projects projects_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY projects_insert ON public.projects FOR INSERT WITH CHECK ((public.is_super_admin() OR ((workspace_id IS NOT NULL) AND (workspace_id IN ( SELECT public.get_user_workspace_ids() AS get_user_workspace_ids)) AND (public.get_role_in_workspace(workspace_id) = ANY (ARRAY['admin'::text, 'engineer'::text]))) OR ((workspace_id IS NULL) AND (organization_id IN ( SELECT public.get_user_organization_ids() AS get_user_organization_ids)) AND (public.get_role_in_org(organization_id) = ANY (ARRAY['owner'::text, 'admin'::text, 'engineer'::text])))));


--
-- Name: projects projects_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY projects_select ON public.projects FOR SELECT USING ((public.is_super_admin() OR (workspace_id IN ( SELECT public.get_user_workspace_ids() AS get_user_workspace_ids)) OR ((workspace_id IS NULL) AND (organization_id IN ( SELECT public.get_user_organization_ids() AS get_user_organization_ids)))));


--
-- Name: projects projects_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY projects_update ON public.projects FOR UPDATE USING ((public.is_super_admin() OR ((workspace_id IS NOT NULL) AND (public.get_role_in_workspace(workspace_id) = ANY (ARRAY['admin'::text, 'engineer'::text]))) OR ((workspace_id IS NULL) AND (organization_id IN ( SELECT public.get_user_organization_ids() AS get_user_organization_ids))))) WITH CHECK ((public.is_super_admin() OR ((workspace_id IS NOT NULL) AND (public.get_role_in_workspace(workspace_id) = ANY (ARRAY['admin'::text, 'engineer'::text]))) OR ((workspace_id IS NULL) AND (public.get_role_in_org(organization_id) = ANY (ARRAY['owner'::text, 'admin'::text, 'engineer'::text])))));


--
-- Name: risk_score_history; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.risk_score_history ENABLE ROW LEVEL SECURITY;

--
-- Name: risk_score_history risk_score_history_org_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY risk_score_history_org_access ON public.risk_score_history USING (((organization_id = public.current_user_organization_id()) OR public.is_super_admin())) WITH CHECK (((organization_id = public.current_user_organization_id()) OR public.is_super_admin()));


--
-- Name: subscription_plans; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;

--
-- Name: subscription_plans subscription_plans_public_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY subscription_plans_public_read ON public.subscription_plans FOR SELECT USING ((is_active = true));


--
-- Name: subscriptions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

--
-- Name: usage_records; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.usage_records ENABLE ROW LEVEL SECURITY;

--
-- Name: user_preferences; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

--
-- Name: user_preferences user_preferences_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_preferences_own ON public.user_preferences USING ((user_id = public.get_current_user_id())) WITH CHECK ((user_id = public.get_current_user_id()));


--
-- Name: users; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

--
-- Name: users users_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY users_insert ON public.users FOR INSERT WITH CHECK (false);


--
-- Name: users users_org_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY users_org_select ON public.users FOR SELECT USING (((organization_id = public.current_user_organization_id()) OR public.is_super_admin()));


--
-- Name: users users_own_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY users_own_update ON public.users FOR UPDATE USING (((id = auth.uid()) OR public.is_super_admin())) WITH CHECK (((id = auth.uid()) OR public.is_super_admin()));


--
-- Name: users users_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY users_select ON public.users FOR SELECT USING ((public.is_super_admin() OR (auth0_user_id = (auth.jwt() ->> 'sub'::text)) OR (id IN ( SELECT om2.user_id
   FROM (public.organization_memberships om1
     JOIN public.organization_memberships om2 ON ((om1.organization_id = om2.organization_id)))
  WHERE (om1.user_id = public.get_current_user_id())))));


--
-- Name: users users_super_admin_manage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY users_super_admin_manage ON public.users USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());


--
-- Name: users users_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY users_update ON public.users FOR UPDATE USING ((public.is_super_admin() OR (auth0_user_id = (auth.jwt() ->> 'sub'::text)))) WITH CHECK ((public.is_super_admin() OR (auth0_user_id = (auth.jwt() ->> 'sub'::text))));


--
-- Name: workspace_invitations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.workspace_invitations ENABLE ROW LEVEL SECURITY;

--
-- Name: workspace_invitations workspace_invitations_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY workspace_invitations_delete ON public.workspace_invitations FOR DELETE USING ((public.is_super_admin() OR public.is_workspace_admin(workspace_id)));


--
-- Name: workspace_invitations workspace_invitations_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY workspace_invitations_insert ON public.workspace_invitations FOR INSERT WITH CHECK ((public.is_super_admin() OR public.is_workspace_admin(workspace_id)));


--
-- Name: workspace_invitations workspace_invitations_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY workspace_invitations_select ON public.workspace_invitations FOR SELECT USING ((public.is_super_admin() OR public.is_workspace_admin(workspace_id) OR (email = ( SELECT users.email
   FROM public.users
  WHERE (users.id = public.get_current_user_id())))));


--
-- Name: workspace_invitations workspace_invitations_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY workspace_invitations_update ON public.workspace_invitations FOR UPDATE USING ((public.is_super_admin() OR public.is_workspace_admin(workspace_id))) WITH CHECK ((public.is_super_admin() OR public.is_workspace_admin(workspace_id)));


--
-- Name: workspace_memberships; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.workspace_memberships ENABLE ROW LEVEL SECURITY;

--
-- Name: workspace_memberships workspace_memberships_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY workspace_memberships_delete ON public.workspace_memberships FOR DELETE USING ((public.is_super_admin() OR (public.is_workspace_admin(workspace_id) AND (user_id <> public.get_current_user_id())) OR ((user_id = public.get_current_user_id()) AND (role <> 'admin'::text))));


--
-- Name: workspace_memberships workspace_memberships_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY workspace_memberships_insert ON public.workspace_memberships FOR INSERT WITH CHECK ((public.is_super_admin() OR public.is_workspace_admin(workspace_id) OR (EXISTS ( SELECT 1
   FROM public.workspaces w
  WHERE ((w.id = workspace_memberships.workspace_id) AND (w.organization_id IN ( SELECT public.get_user_organization_ids() AS get_user_organization_ids)) AND (public.get_role_in_org(w.organization_id) = ANY (ARRAY['owner'::text, 'billing_admin'::text, 'admin'::text])))))));


--
-- Name: workspace_memberships workspace_memberships_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY workspace_memberships_select ON public.workspace_memberships FOR SELECT USING ((public.is_super_admin() OR (workspace_id IN ( SELECT public.get_user_workspace_ids() AS get_user_workspace_ids)) OR (EXISTS ( SELECT 1
   FROM public.workspaces w
  WHERE ((w.id = workspace_memberships.workspace_id) AND (w.organization_id IN ( SELECT public.get_user_organization_ids() AS get_user_organization_ids)))))));


--
-- Name: workspace_memberships workspace_memberships_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY workspace_memberships_update ON public.workspace_memberships FOR UPDATE USING ((public.is_super_admin() OR (public.is_workspace_admin(workspace_id) AND (user_id <> public.get_current_user_id())))) WITH CHECK ((public.is_super_admin() OR (public.is_workspace_admin(workspace_id) AND (user_id <> public.get_current_user_id()))));


--
-- Name: workspaces; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;

--
-- Name: workspaces workspaces_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY workspaces_delete ON public.workspaces FOR DELETE USING ((public.is_super_admin() OR (public.get_role_in_org(organization_id) = 'owner'::text)));


--
-- Name: workspaces workspaces_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY workspaces_insert ON public.workspaces FOR INSERT WITH CHECK ((public.is_super_admin() OR ((organization_id IN ( SELECT public.get_user_organization_ids() AS get_user_organization_ids)) AND (public.get_role_in_org(organization_id) = ANY (ARRAY['owner'::text, 'billing_admin'::text, 'admin'::text])))));


--
-- Name: workspaces workspaces_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY workspaces_select ON public.workspaces FOR SELECT USING (((deleted_at IS NULL) AND (public.is_super_admin() OR (organization_id IN ( SELECT public.get_user_organization_ids() AS get_user_organization_ids)))));


--
-- Name: workspaces workspaces_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY workspaces_update ON public.workspaces FOR UPDATE USING ((public.is_super_admin() OR public.is_workspace_admin(id) OR (public.get_role_in_org(organization_id) = ANY (ARRAY['owner'::text, 'billing_admin'::text])))) WITH CHECK ((public.is_super_admin() OR public.is_workspace_admin(id) OR (public.get_role_in_org(organization_id) = ANY (ARRAY['owner'::text, 'billing_admin'::text]))));


--
-- PostgreSQL database dump complete
--

