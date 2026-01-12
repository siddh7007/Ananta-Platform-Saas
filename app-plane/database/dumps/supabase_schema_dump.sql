--
-- PostgreSQL database dump
--

-- Dumped from database version 15.1 (Ubuntu 15.1-1.pgdg20.04+1)
-- Dumped by pg_dump version 15.5 (Ubuntu 15.5-1.pgdg20.04+1)

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
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

-- *not* creating schema, since initdb creates it


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS '';


--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


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
    'cancelled'
);


--
-- Name: add_user_to_platform_org(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.add_user_to_platform_org(p_user_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    platform_org_id UUID := 'a0000000-0000-0000-0000-000000000001';
    user_role TEXT;
    user_is_platform_admin BOOLEAN;
BEGIN
    SELECT role, is_platform_admin INTO user_role, user_is_platform_admin
    FROM users WHERE id = p_user_id;

    IF user_role IN ('super_admin', 'admin') OR user_is_platform_admin = true THEN
        INSERT INTO organization_memberships (user_id, organization_id, role, created_at, updated_at)
        VALUES (p_user_id, platform_org_id, 'admin', NOW(), NOW())
        ON CONFLICT (user_id, organization_id) DO UPDATE SET role = 'admin', updated_at = NOW();
    END IF;
END;
$$;


--
-- Name: current_user_organization_id(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.current_user_organization_id() RETURNS uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
    SELECT COALESCE(
        (current_setting('request.jwt.claims', true)::json->>'organization_id')::UUID,
        (current_setting('request.jwt.claims', true)::json->'user_metadata'->>'organization_id')::UUID
    )
$$;


--
-- Name: ensure_single_default_template(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.ensure_single_default_template() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF NEW.is_default = TRUE THEN
        UPDATE column_mapping_templates
        SET is_default = FALSE
        WHERE organization_id = NEW.organization_id
          AND id != NEW.id
          AND is_default = TRUE;
    END IF;
    RETURN NEW;
END;
$$;


--
-- Name: generate_slug_from_name(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_slug_from_name() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF NEW.slug IS NULL OR NEW.slug = '' THEN
        NEW.slug := lower(
            regexp_replace(
                regexp_replace(
                    regexp_replace(trim(NEW.name), '[^\w\s-]', '', 'g'),
                    '\s+', '-', 'g'
                ),
                '-+', '-', 'g'
            )
        );
    END IF;
    RETURN NEW;
END;
$$;


--
-- Name: get_active_cns_config(character varying); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_active_cns_config(p_tenant_id character varying) RETURNS TABLE(id integer, tenant_id character varying, config_name character varying, is_active boolean, is_global boolean, enable_suppliers boolean, preferred_suppliers text[], supplier_min_confidence numeric, enable_ai boolean, ai_provider character varying, ai_operations text[], ai_min_confidence numeric, ai_cost_limit_monthly numeric, enable_web_scraping boolean, scraping_sources text[], scraping_timeout_seconds integer, quality_reject_threshold integer, quality_staging_threshold integer, quality_auto_approve_threshold integer, batch_size integer, max_retries integer, ai_cost_current_month numeric, ai_requests_current_month integer, web_scraping_requests_current_month integer, created_at timestamp with time zone, updated_at timestamp with time zone)
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF p_tenant_id IS NOT NULL THEN
        RETURN QUERY
        SELECT c.* FROM cns_enrichment_config c
        WHERE c.tenant_id = p_tenant_id AND c.is_active = TRUE
        LIMIT 1;

        IF FOUND THEN
            RETURN;
        END IF;
    END IF;

    RETURN QUERY
    SELECT c.* FROM cns_enrichment_config c
    WHERE c.is_global = TRUE AND c.is_active = TRUE
    ORDER BY c.created_at DESC
    LIMIT 1;
END;
$$;


--
-- Name: get_current_user_id(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_current_user_id() RETURNS uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
    SELECT COALESCE(
        nullif(current_setting('app.current_user_id', true), '')::uuid,
        (SELECT id FROM users
         WHERE keycloak_user_id = nullif(current_setting('app.keycloak_user_id', true), '')
         LIMIT 1)
    )
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
    CONSTRAINT organization_risk_profiles_supply_chain_weight_check CHECK (((supply_chain_weight >= 0) AND (supply_chain_weight <= 100))),
    CONSTRAINT risk_profile_thresholds_order CHECK (((low_threshold < medium_threshold) AND (medium_threshold < high_threshold))),
    CONSTRAINT risk_profile_weights_sum CHECK ((((((lifecycle_weight + supply_chain_weight) + compliance_weight) + obsolescence_weight) + single_source_weight) = 100))
);


--
-- Name: TABLE organization_risk_profiles; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.organization_risk_profiles IS 'Customer-specific risk scoring configuration with configurable weights and thresholds';


--
-- Name: get_or_create_risk_profile(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_or_create_risk_profile(p_org_id uuid) RETURNS public.organization_risk_profiles
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    v_profile organization_risk_profiles;
BEGIN
    -- Try to get existing profile
    SELECT * INTO v_profile FROM organization_risk_profiles WHERE organization_id = p_org_id;

    IF v_profile IS NULL THEN
        -- Create default profile for organization
        INSERT INTO organization_risk_profiles (organization_id, preset_name)
        VALUES (p_org_id, 'default')
        RETURNING * INTO v_profile;
    END IF;

    RETURN v_profile;
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
-- Name: get_user_organizations(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_user_organizations(p_user_id uuid DEFAULT NULL::uuid) RETURNS SETOF uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
    SELECT organization_id
    FROM organization_memberships
    WHERE user_id = COALESCE(p_user_id, get_current_user_id())
$$;


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
-- Name: is_org_admin(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_org_admin(p_org_id uuid, p_user_id uuid DEFAULT NULL::uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
    SELECT EXISTS (
        SELECT 1 FROM organization_memberships
        WHERE organization_id = p_org_id
        AND user_id = COALESCE(p_user_id, get_current_user_id())
        AND role IN ('owner', 'admin')
    )
$$;


--
-- Name: is_org_member(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_org_member(p_org_id uuid, p_user_id uuid DEFAULT NULL::uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
    SELECT EXISTS (
        SELECT 1 FROM organization_memberships
        WHERE organization_id = p_org_id
        AND user_id = COALESCE(p_user_id, get_current_user_id())
    )
$$;


--
-- Name: is_platform_admin(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_platform_admin() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
    SELECT COALESCE(
        (current_setting('request.jwt.claims', true)::json->>'platform_admin')::BOOLEAN,
        (current_setting('request.jwt.claims', true)::json->'user_metadata'->>'platform_admin')::BOOLEAN,
        false
    )
$$;


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
        AND organization_id = 'a0000000-0000-0000-0000-000000000001'::uuid
    )
$$;


--
-- Name: is_super_admin(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_super_admin() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
    SELECT COALESCE(
        (SELECT is_platform_admin FROM users WHERE id = get_current_user_id()),
        false
    )
$$;


--
-- Name: log_cns_event(uuid, character varying, character varying, text, uuid, character varying, character varying, jsonb, character varying, character varying, character varying); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.log_cns_event(p_organization_id uuid, p_event_type character varying, p_title character varying, p_message text DEFAULT NULL::text, p_bom_id uuid DEFAULT NULL::uuid, p_event_category character varying DEFAULT 'processing'::character varying, p_severity character varying DEFAULT 'info'::character varying, p_metadata jsonb DEFAULT '{}'::jsonb, p_workflow_id character varying DEFAULT NULL::character varying, p_actor_type character varying DEFAULT 'system'::character varying, p_actor_id character varying DEFAULT NULL::character varying) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_event_id UUID;
BEGIN
    INSERT INTO cns_processing_events (
        organization_id, bom_id, event_type, event_category, severity,
        title, message, metadata, workflow_id, actor_type, actor_id
    ) VALUES (
        p_organization_id, p_bom_id, p_event_type, p_event_category, p_severity,
        p_title, p_message, p_metadata, p_workflow_id, p_actor_type, p_actor_id
    )
    RETURNING id INTO v_event_id;

    RETURN v_event_id;
END;
$$;


--
-- Name: normalize_role(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.normalize_role(input_role text) RETURNS text
    LANGUAGE plpgsql IMMUTABLE
    AS $$
DECLARE
    normalized TEXT;
    lower_role TEXT;
BEGIN
    lower_role := LOWER(COALESCE(input_role, ''));

    IF lower_role IN ('platform:super_admin', 'platform-super-admin', 'realm-admin', 'platform_admin') THEN
        normalized := 'super_admin';
    ELSIF lower_role IN ('org-owner', 'organization-owner', 'billing_admin') THEN
        normalized := 'owner';
    ELSIF lower_role IN ('administrator', 'org_admin', 'tenant-admin', 'org-admin') THEN
        normalized := 'admin';
    ELSIF lower_role IN ('staff', 'developer', 'support', 'operator', 'platform:engineer', 'platform:staff') THEN
        normalized := 'engineer';
    ELSIF lower_role IN ('user', 'customer', 'viewer', 'member', 'read-only', '') THEN
        normalized := 'analyst';
    ELSIF lower_role IN ('super_admin', 'owner', 'admin', 'engineer', 'analyst') THEN
        normalized := lower_role;
    ELSE
        normalized := 'analyst';
    END IF;

    RETURN normalized;
END;
$$;


--
-- Name: FUNCTION normalize_role(input_role text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.normalize_role(input_role text) IS 'Normalizes legacy role names to unified 5-level hierarchy';


--
-- Name: set_bom_organization_id(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_bom_organization_id() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_organization_id UUID;
BEGIN
    SELECT w.organization_id INTO v_organization_id
    FROM projects p
    JOIN workspaces w ON w.id = p.workspace_id
    WHERE p.id = NEW.project_id;

    IF v_organization_id IS NOT NULL THEN
        NEW.organization_id := v_organization_id;
    ELSE
        RAISE EXCEPTION '[ERROR] Cannot determine organization_id for BOM "%" with project_id %. Check workspace linkage.',
            NEW.name, NEW.project_id;
    END IF;

    RETURN NEW;
END;
$$;


--
-- Name: slugify(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.slugify(text_to_slug text) RETURNS text
    LANGUAGE plpgsql IMMUTABLE
    AS $_$
DECLARE
    slugged text;
BEGIN
    slugged := lower(text_to_slug);
    slugged := regexp_replace(slugged, '[\s_]+', '-', 'g');
    slugged := regexp_replace(slugged, '[^a-z0-9\-]', '', 'g');
    slugged := regexp_replace(slugged, '-+', '-', 'g');
    slugged := regexp_replace(slugged, '^-|-$', '', 'g');
    IF slugged IS NULL OR slugged = '' THEN
        slugged := 'entity-' || substring(gen_random_uuid()::text from 1 for 8);
    END IF;
    RETURN slugged;
END;
$_$;


--
-- Name: trigger_auto_add_platform_staff_to_platform_org(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trigger_auto_add_platform_staff_to_platform_org() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
    IF (NEW.role IN ('super_admin', 'admin') OR NEW.is_platform_admin = true) AND
       (OLD IS NULL OR (OLD.role NOT IN ('super_admin', 'admin') AND OLD.is_platform_admin <> true)) THEN
        PERFORM add_user_to_platform_org(NEW.id);
    END IF;
    RETURN NEW;
END;
$$;


--
-- Name: trigger_set_timestamp(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trigger_set_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


--
-- Name: update_bom_items_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_bom_items_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


--
-- Name: update_bom_jobs_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_bom_jobs_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


--
-- Name: update_bom_processing_jobs_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_bom_processing_jobs_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


--
-- Name: update_column_mapping_templates_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_column_mapping_templates_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


--
-- Name: update_component_search_vector(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_component_search_vector() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.search_vector := to_tsvector('english',
        COALESCE(NEW.manufacturer_part_number, '') || ' ' ||
        COALESCE(NEW.manufacturer, '') || ' ' ||
        COALESCE(NEW.description, '')
    );
    RETURN NEW;
END;
$$;


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
    status text DEFAULT 'pending'::text,
    delivered_at timestamp with time zone,
    novu_transaction_id text,
    error_message text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: alert_preferences; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.alert_preferences (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    organization_id uuid NOT NULL,
    alert_type text NOT NULL,
    is_active boolean DEFAULT true,
    in_app_enabled boolean DEFAULT true,
    email_enabled boolean DEFAULT false,
    webhook_enabled boolean DEFAULT false,
    webhook_url text,
    email_address text,
    threshold_config jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT alert_preferences_alert_type_check CHECK ((alert_type = ANY (ARRAY['LIFECYCLE'::text, 'RISK'::text, 'PRICE'::text, 'AVAILABILITY'::text, 'COMPLIANCE'::text, 'PCN'::text, 'SUPPLY_CHAIN'::text])))
);


--
-- Name: alerts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.alerts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    component_id uuid,
    user_id uuid,
    severity text NOT NULL,
    alert_type text NOT NULL,
    title text NOT NULL,
    message text,
    is_read boolean DEFAULT false,
    is_dismissed boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    read_at timestamp with time zone,
    dismissed_at timestamp with time zone,
    deleted_at timestamp with time zone,
    context jsonb,
    action_url text,
    archived_at timestamp with time zone,
    snoozed_until timestamp with time zone,
    CONSTRAINT alerts_alert_type_check CHECK ((alert_type = ANY (ARRAY['LIFECYCLE'::text, 'RISK'::text, 'PRICE'::text, 'AVAILABILITY'::text, 'COMPLIANCE'::text, 'PCN'::text, 'SUPPLY_CHAIN'::text]))),
    CONSTRAINT alerts_severity_check CHECK ((severity = ANY (ARRAY['LOW'::text, 'MEDIUM'::text, 'HIGH'::text, 'CRITICAL'::text])))
);


--
-- Name: attributes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.attributes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    component_id uuid NOT NULL,
    name text NOT NULL,
    value text NOT NULL,
    unit text,
    source text,
    confidence numeric(5,2),
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: audit_enrichment_runs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_enrichment_runs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    upload_id text NOT NULL,
    line_id text NOT NULL,
    mpn text NOT NULL,
    manufacturer text,
    enrichment_timestamp timestamp with time zone DEFAULT now() NOT NULL,
    successful boolean DEFAULT false NOT NULL,
    quality_score numeric(5,2),
    storage_location text,
    supplier_name text NOT NULL,
    supplier_match_confidence numeric(5,2),
    processing_time_ms integer,
    error_message text,
    needs_review boolean DEFAULT false,
    review_notes text,
    reviewed_by text,
    reviewed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: audit_field_comparisons; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_field_comparisons (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    enrichment_run_id uuid NOT NULL,
    field_name text NOT NULL,
    field_category text,
    supplier_value text,
    normalized_value text,
    changed boolean DEFAULT false,
    change_type text,
    change_reason text,
    confidence numeric(5,2),
    supplier_data_quality text,
    normalization_applied boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    event_type text NOT NULL,
    routing_key text NOT NULL,
    organization_id uuid NOT NULL,
    user_id text,
    username text,
    email text,
    source text DEFAULT 'cns-service'::text NOT NULL,
    event_data jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: audit_supplier_quality; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_supplier_quality (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    date date NOT NULL,
    supplier_name text NOT NULL,
    total_requests integer DEFAULT 0,
    successful_requests integer DEFAULT 0,
    failed_requests integer DEFAULT 0,
    avg_quality_score numeric(5,2),
    avg_match_confidence numeric(5,2),
    avg_processing_time_ms integer,
    fields_changed_count integer DEFAULT 0,
    fields_missing_count integer DEFAULT 0,
    fields_invalid_count integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


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
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    processing_time_ms integer,
    error_message text,
    results_data jsonb,
    organization_id uuid,
    project_id uuid,
    source character varying(50) DEFAULT 'customer'::character varying,
    source_metadata jsonb,
    priority integer DEFAULT 5,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


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
    manufacturer text,
    description text,
    quantity integer DEFAULT 1,
    component_id uuid,
    match_confidence numeric(5,2),
    match_method text,
    enrichment_status text DEFAULT 'pending'::text,
    enriched_mpn text,
    enriched_manufacturer text,
    specifications jsonb,
    datasheet_url text,
    lifecycle_status text,
    compliance_status jsonb,
    pricing jsonb,
    unit_price numeric(10,4),
    extended_price numeric(12,2),
    risk_level text,
    redis_component_key text,
    component_storage text DEFAULT 'none'::text,
    enrichment_error text,
    category character varying(255),
    subcategory character varying(255),
    metadata jsonb DEFAULT '{}'::jsonb,
    enriched_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT bom_line_items_enrichment_status_check CHECK ((enrichment_status = ANY (ARRAY['pending'::text, 'matched'::text, 'enriched'::text, 'no_match'::text, 'error'::text]))),
    CONSTRAINT bom_line_items_match_method_check CHECK ((match_method = ANY (ARRAY['exact'::text, 'fuzzy'::text, 'manual'::text, 'unmatched'::text]))),
    CONSTRAINT bom_line_items_risk_level_check CHECK ((risk_level = ANY (ARRAY['GREEN'::text, 'YELLOW'::text, 'ORANGE'::text, 'RED'::text])))
);


--
-- Name: bom_processing_jobs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bom_processing_jobs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bom_id uuid NOT NULL,
    organization_id uuid NOT NULL,
    status text DEFAULT 'queued'::text,
    priority integer DEFAULT 5,
    temporal_workflow_id text,
    total_items integer,
    processed_items integer DEFAULT 0,
    enriched_items integer DEFAULT 0,
    failed_items integer DEFAULT 0,
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    error_message text,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT bom_processing_jobs_status_check CHECK ((status = ANY (ARRAY['queued'::text, 'processing'::text, 'completed'::text, 'failed'::text, 'cancelled'::text])))
);


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
    bom_id uuid,
    CONSTRAINT bom_uploads_status_check CHECK ((status = ANY (ARRAY['uploaded'::text, 'parsing'::text, 'parsed'::text, 'mapping_pending'::text, 'ready_for_enrichment'::text, 'processing'::text, 'completed'::text, 'failed'::text])))
);


--
-- Name: TABLE bom_uploads; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.bom_uploads IS 'Unified upload tracking for customer and CNS bulk uploads with S3 storage';


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
    status text DEFAULT 'draft'::text,
    component_count integer DEFAULT 0,
    total_cost numeric(12,2),
    enrichment_status text DEFAULT 'pending'::text,
    enrichment_priority integer DEFAULT 5,
    temporal_workflow_id text,
    source text,
    priority text DEFAULT 'normal'::text,
    raw_file_s3_key text,
    parsed_file_s3_key text,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT boms_enrichment_priority_check CHECK (((enrichment_priority >= 1) AND (enrichment_priority <= 10))),
    CONSTRAINT boms_enrichment_status_check CHECK ((enrichment_status = ANY (ARRAY['pending'::text, 'queued'::text, 'processing'::text, 'enriched'::text, 'failed'::text]))),
    CONSTRAINT boms_priority_check CHECK ((priority = ANY (ARRAY['high'::text, 'normal'::text]))),
    CONSTRAINT boms_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'pending'::text, 'processing'::text, 'completed'::text, 'failed'::text, 'archived'::text])))
);


--
-- Name: categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    parent_id uuid,
    level integer DEFAULT 0,
    path text,
    description text,
    image_url text,
    component_count integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


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
-- Name: cns_enrichment_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cns_enrichment_config (
    id integer NOT NULL,
    tenant_id character varying(100),
    config_name character varying(100) NOT NULL,
    is_active boolean DEFAULT true,
    is_global boolean DEFAULT false,
    enable_suppliers boolean DEFAULT true,
    preferred_suppliers text[] DEFAULT ARRAY['mouser'::text, 'digikey'::text, 'element14'::text],
    supplier_min_confidence numeric(5,2) DEFAULT 90.0,
    enable_ai boolean DEFAULT false,
    ai_provider character varying(50),
    ai_operations text[] DEFAULT ARRAY['category'::text, 'specs'::text],
    ai_min_confidence numeric(5,2) DEFAULT 70.0,
    ai_cost_limit_monthly numeric(10,2),
    enable_web_scraping boolean DEFAULT false,
    scraping_sources text[],
    scraping_timeout_seconds integer,
    quality_reject_threshold integer DEFAULT 70,
    quality_staging_threshold integer DEFAULT 94,
    quality_auto_approve_threshold integer DEFAULT 95,
    batch_size integer DEFAULT 100,
    max_retries integer DEFAULT 2,
    ai_cost_current_month numeric(10,2),
    ai_requests_current_month integer,
    web_scraping_requests_current_month integer,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT cns_enrichment_config_batch_size_check CHECK (((batch_size >= 1) AND (batch_size <= 1000))),
    CONSTRAINT cns_enrichment_config_max_retries_check CHECK (((max_retries >= 0) AND (max_retries <= 10)))
);


--
-- Name: cns_enrichment_config_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.cns_enrichment_config_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: cns_enrichment_config_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.cns_enrichment_config_id_seq OWNED BY public.cns_enrichment_config.id;


--
-- Name: cns_processing_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cns_processing_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    bom_id uuid,
    event_type character varying(100) NOT NULL,
    event_category character varying(50) DEFAULT 'processing'::character varying,
    severity character varying(20) DEFAULT 'info'::character varying,
    title text NOT NULL,
    message text,
    metadata jsonb DEFAULT '{}'::jsonb,
    workflow_id character varying(255),
    actor_type character varying(50) DEFAULT 'system'::character varying,
    actor_id character varying(255),
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: column_mapping_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.column_mapping_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    name text NOT NULL,
    description text,
    mappings jsonb NOT NULL,
    is_default boolean DEFAULT false,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: component_base_risk_scores; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.component_base_risk_scores (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    component_id uuid,
    mpn text NOT NULL,
    manufacturer text,
    lifecycle_score integer DEFAULT 0,
    supply_chain_score integer DEFAULT 0,
    compliance_score integer DEFAULT 0,
    obsolescence_score integer DEFAULT 0,
    single_source_score integer DEFAULT 0,
    composite_score integer DEFAULT 0,
    risk_level text DEFAULT 'low'::text,
    factors jsonb DEFAULT '[]'::jsonb,
    data_sources jsonb DEFAULT '[]'::jsonb,
    calculated_at timestamp with time zone DEFAULT now(),
    valid_until timestamp with time zone DEFAULT (now() + '7 days'::interval),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT component_base_risk_scores_compliance_score_check CHECK (((compliance_score >= 0) AND (compliance_score <= 100))),
    CONSTRAINT component_base_risk_scores_composite_score_check CHECK (((composite_score >= 0) AND (composite_score <= 100))),
    CONSTRAINT component_base_risk_scores_lifecycle_score_check CHECK (((lifecycle_score >= 0) AND (lifecycle_score <= 100))),
    CONSTRAINT component_base_risk_scores_obsolescence_score_check CHECK (((obsolescence_score >= 0) AND (obsolescence_score <= 100))),
    CONSTRAINT component_base_risk_scores_risk_level_check CHECK ((risk_level = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text, 'critical'::text]))),
    CONSTRAINT component_base_risk_scores_single_source_score_check CHECK (((single_source_score >= 0) AND (single_source_score <= 100))),
    CONSTRAINT component_base_risk_scores_supply_chain_score_check CHECK (((supply_chain_score >= 0) AND (supply_chain_score <= 100)))
);


--
-- Name: TABLE component_base_risk_scores; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.component_base_risk_scores IS 'Cached base risk scores for components (independent of usage context)';


--
-- Name: component_watches; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.component_watches (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    organization_id uuid NOT NULL,
    component_id uuid NOT NULL,
    watch_lifecycle boolean DEFAULT true,
    watch_price boolean DEFAULT true,
    watch_availability boolean DEFAULT true,
    watch_compliance boolean DEFAULT true,
    watch_supply_chain boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: components; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.components (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid,
    manufacturer_id uuid,
    category_id uuid,
    manufacturer_part_number text NOT NULL,
    manufacturer text,
    description text,
    datasheet_url text,
    image_url text,
    lifecycle_status text,
    lifecycle_change_date date,
    risk_level text,
    rohs_compliant text,
    reach_compliant text,
    has_alternatives boolean DEFAULT false,
    alternative_part_numbers text[],
    unit_price numeric(14,4),
    currency text DEFAULT 'USD'::text,
    stock_quantity integer,
    moq integer,
    lead_time_days integer,
    quality_score numeric(5,2),
    package_type text,
    mounting_style text,
    temp_min_c integer,
    temp_max_c integer,
    power_rating_w numeric(10,4),
    specifications jsonb DEFAULT '{}'::jsonb,
    metadata jsonb DEFAULT '{}'::jsonb,
    search_vector tsvector,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    last_enriched_at timestamp with time zone,
    CONSTRAINT components_lifecycle_status_check CHECK ((lifecycle_status = ANY (ARRAY['Active'::text, 'NRND'::text, 'EOL'::text, 'Obsolete'::text, 'Preview'::text, 'Unknown'::text]))),
    CONSTRAINT components_mounting_style_check CHECK ((mounting_style = ANY (ARRAY['SMD'::text, 'THT'::text, 'HYBRID'::text]))),
    CONSTRAINT components_reach_compliant_check CHECK ((reach_compliant = ANY (ARRAY['COMPLIANT'::text, 'NON_COMPLIANT'::text, 'UNKNOWN'::text]))),
    CONSTRAINT components_risk_level_check CHECK ((risk_level = ANY (ARRAY['GREEN'::text, 'YELLOW'::text, 'ORANGE'::text, 'RED'::text, 'CRITICAL'::text]))),
    CONSTRAINT components_rohs_compliant_check CHECK ((rohs_compliant = ANY (ARRAY['COMPLIANT'::text, 'NON_COMPLIANT'::text, 'UNKNOWN'::text])))
);


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
    tenant_id uuid NOT NULL,
    project_id uuid,
    user_id uuid,
    source character varying(20) NOT NULL,
    workflow_id character varying(255),
    state jsonb NOT NULL,
    payload jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT enrichment_events_source_check CHECK (((source)::text = ANY ((ARRAY['customer'::character varying, 'staff'::character varying])::text[])))
);


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
    created_at timestamp with time zone DEFAULT now(),
    created_by integer
);


--
-- Name: TABLE enrichment_history; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.enrichment_history IS 'Audit log of all enrichment attempts (approved, rejected, errors)';


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
-- Name: manufacturers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.manufacturers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    normalized_name text,
    aliases text[] DEFAULT '{}'::text[],
    website text,
    description text,
    logo_url text,
    is_verified boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    user_id uuid,
    type text NOT NULL,
    title text NOT NULL,
    message text,
    data jsonb,
    is_read boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    read_at timestamp with time zone
);


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
    role text DEFAULT 'analyst'::text NOT NULL,
    token text DEFAULT encode(public.gen_random_bytes(32), 'hex'::text) NOT NULL,
    invited_by uuid,
    status text DEFAULT 'pending'::text,
    expires_at timestamp with time zone DEFAULT (now() + '7 days'::interval) NOT NULL,
    accepted_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT organization_invitations_role_check CHECK ((role = ANY (ARRAY['admin'::text, 'engineer'::text, 'analyst'::text]))),
    CONSTRAINT organization_invitations_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'accepted'::text, 'expired'::text, 'cancelled'::text])))
);


--
-- Name: organization_memberships; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.organization_memberships (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    organization_id uuid NOT NULL,
    role text DEFAULT 'analyst'::text NOT NULL,
    is_default boolean DEFAULT false,
    invited_by uuid,
    joined_at timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT organization_memberships_role_check CHECK ((role = ANY (ARRAY['owner'::text, 'admin'::text, 'engineer'::text, 'analyst'::text])))
);


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
    description text,
    subscription_status text DEFAULT 'trial'::text,
    plan_tier text DEFAULT 'standard'::text,
    billing_email text,
    timezone text DEFAULT 'UTC'::text,
    region text DEFAULT 'us-east-1'::text,
    max_users integer DEFAULT 10,
    max_components integer DEFAULT 50000,
    max_storage_gb integer DEFAULT 100,
    current_users_count integer DEFAULT 0,
    current_components_count integer DEFAULT 0,
    current_storage_gb numeric(12,2) DEFAULT 0,
    trial_ends_at timestamp with time zone,
    deleted_at timestamp with time zone,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT organizations_subscription_status_check CHECK ((subscription_status = ANY (ARRAY['trial'::text, 'active'::text, 'past_due'::text, 'canceled'::text, 'suspended'::text])))
);


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
-- Name: project_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.project_members (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    user_id uuid NOT NULL,
    role text DEFAULT 'member'::text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT project_members_role_check CHECK ((role = ANY (ARRAY['owner'::text, 'admin'::text, 'member'::text, 'viewer'::text])))
);


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
    project_health_grade text DEFAULT 'A'::text,
    common_risk_factors jsonb DEFAULT '[]'::jsonb,
    calculated_at timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT project_risk_summaries_project_health_grade_check CHECK ((project_health_grade = ANY (ARRAY['A'::text, 'B'::text, 'C'::text, 'D'::text, 'F'::text])))
);


--
-- Name: TABLE project_risk_summaries; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.project_risk_summaries IS 'Aggregate project health across all BOMs';


--
-- Name: projects; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.projects (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    description text,
    status text DEFAULT 'active'::text,
    settings jsonb DEFAULT '{}'::jsonb,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    organization_id uuid NOT NULL,
    CONSTRAINT projects_status_check CHECK ((status = ANY (ARRAY['active'::text, 'archived'::text, 'deleted'::text])))
);


--
-- Name: risk_profile_presets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.risk_profile_presets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text,
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
    industry_focus text,
    is_default boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE risk_profile_presets; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.risk_profile_presets IS 'Pre-configured risk profiles for different industries';


--
-- Name: risk_score_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.risk_score_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    entity_type text NOT NULL,
    entity_id uuid NOT NULL,
    organization_id uuid NOT NULL,
    score integer NOT NULL,
    risk_level text,
    factors jsonb DEFAULT '[]'::jsonb,
    recorded_at timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT risk_score_history_entity_type_check CHECK ((entity_type = ANY (ARRAY['component'::text, 'bom'::text, 'project'::text]))),
    CONSTRAINT risk_score_history_risk_level_check CHECK ((risk_level = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text, 'critical'::text]))),
    CONSTRAINT risk_score_history_score_check CHECK (((score >= 0) AND (score <= 100)))
);


--
-- Name: TABLE risk_score_history; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.risk_score_history IS 'Historical risk scores for trend analysis';


--
-- Name: subscription_plans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subscription_plans (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    code text NOT NULL,
    tier text NOT NULL,
    price_monthly numeric(10,2),
    price_yearly numeric(10,2),
    max_users integer,
    max_components integer,
    max_boms_per_month integer,
    max_storage_gb integer,
    features jsonb DEFAULT '[]'::jsonb,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT subscription_plans_tier_check CHECK ((tier = ANY (ARRAY['free'::text, 'starter'::text, 'professional'::text, 'enterprise'::text])))
);


--
-- Name: subscriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subscriptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    plan_id uuid,
    status text DEFAULT 'active'::text,
    billing_interval text DEFAULT 'monthly'::text,
    current_period_start timestamp with time zone,
    current_period_end timestamp with time zone,
    trial_ends_at timestamp with time zone,
    canceled_at timestamp with time zone,
    stripe_subscription_id text,
    stripe_customer_id text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT subscriptions_billing_interval_check CHECK ((billing_interval = ANY (ARRAY['monthly'::text, 'yearly'::text]))),
    CONSTRAINT subscriptions_status_check CHECK ((status = ANY (ARRAY['trialing'::text, 'active'::text, 'past_due'::text, 'canceled'::text, 'paused'::text])))
);


--
-- Name: suppliers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.suppliers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    api_key_required boolean DEFAULT false,
    api_endpoint text,
    website text,
    priority integer DEFAULT 50,
    is_active boolean DEFAULT true,
    rate_limit_per_minute integer,
    rate_limit_per_day integer,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


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
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE usage_records; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.usage_records IS 'Metered usage tracking per organization';


--
-- Name: user_preferences; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_preferences (
    user_id uuid NOT NULL,
    last_organization_id uuid,
    theme text DEFAULT 'system'::text,
    notifications_enabled boolean DEFAULT true,
    email_notifications boolean DEFAULT true,
    language text DEFAULT 'en'::text,
    timezone text DEFAULT 'UTC'::text,
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT user_preferences_theme_check CHECK ((theme = ANY (ARRAY['light'::text, 'dark'::text, 'system'::text])))
);


--
-- Name: user_profiles; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.user_profiles AS
 SELECT user_preferences.user_id AS id,
    user_preferences.user_id,
    user_preferences.last_organization_id,
    user_preferences.theme,
    user_preferences.notifications_enabled,
    user_preferences.email_notifications,
    user_preferences.language,
    user_preferences.timezone,
    user_preferences.updated_at
   FROM public.user_preferences;


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email text NOT NULL,
    email_verified boolean DEFAULT false,
    first_name text,
    last_name text,
    full_name text,
    avatar_url text,
    auth0_user_id text,
    keycloak_user_id text,
    role text DEFAULT 'analyst'::text NOT NULL,
    is_platform_admin boolean DEFAULT false,
    is_active boolean DEFAULT true,
    last_login_at timestamp with time zone,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT users_role_check CHECK ((role = ANY (ARRAY['super_admin'::text, 'owner'::text, 'admin'::text, 'engineer'::text, 'analyst'::text])))
);


--
-- Name: workspace_invitations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workspace_invitations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    email text NOT NULL,
    role text DEFAULT 'member'::text,
    token text DEFAULT encode(public.gen_random_bytes(32), 'hex'::text) NOT NULL,
    invited_by uuid,
    expires_at timestamp with time zone DEFAULT (now() + '7 days'::interval) NOT NULL,
    accepted_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT workspace_invitations_role_check CHECK ((role = ANY (ARRAY['admin'::text, 'member'::text, 'viewer'::text])))
);


--
-- Name: workspace_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workspace_members (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    user_id uuid NOT NULL,
    role text DEFAULT 'member'::text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT workspace_members_role_check CHECK ((role = ANY (ARRAY['owner'::text, 'admin'::text, 'member'::text, 'viewer'::text])))
);


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
    CONSTRAINT workspace_memberships_role_check CHECK ((role = ANY (ARRAY['owner'::text, 'admin'::text, 'engineer'::text, 'analyst'::text, 'viewer'::text])))
);


--
-- Name: TABLE workspace_memberships; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.workspace_memberships IS 'Maps users to workspaces with roles. Replaces org-level roles for work/access control.';


--
-- Name: workspaces; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workspaces (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    description text,
    visibility text DEFAULT 'private'::text,
    settings jsonb DEFAULT '{}'::jsonb,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    is_default boolean DEFAULT false NOT NULL,
    CONSTRAINT workspaces_visibility_check CHECK ((visibility = ANY (ARRAY['private'::text, 'team'::text, 'public'::text])))
);


--
-- Name: bom_items id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bom_items ALTER COLUMN id SET DEFAULT nextval('public.bom_items_id_seq'::regclass);


--
-- Name: bom_jobs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bom_jobs ALTER COLUMN id SET DEFAULT nextval('public.bom_jobs_id_seq'::regclass);


--
-- Name: cns_enrichment_config id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cns_enrichment_config ALTER COLUMN id SET DEFAULT nextval('public.cns_enrichment_config_id_seq'::regclass);


--
-- Name: enrichment_history id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.enrichment_history ALTER COLUMN id SET DEFAULT nextval('public.enrichment_history_id_seq'::regclass);


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
-- Name: alert_preferences alert_preferences_user_id_organization_id_alert_type_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alert_preferences
    ADD CONSTRAINT alert_preferences_user_id_organization_id_alert_type_key UNIQUE (user_id, organization_id, alert_type);


--
-- Name: alerts alerts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alerts
    ADD CONSTRAINT alerts_pkey PRIMARY KEY (id);


--
-- Name: attributes attributes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attributes
    ADD CONSTRAINT attributes_pkey PRIMARY KEY (id);


--
-- Name: audit_enrichment_runs audit_enrichment_runs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_enrichment_runs
    ADD CONSTRAINT audit_enrichment_runs_pkey PRIMARY KEY (id);


--
-- Name: audit_field_comparisons audit_field_comparisons_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_field_comparisons
    ADD CONSTRAINT audit_field_comparisons_pkey PRIMARY KEY (id);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: audit_supplier_quality audit_supplier_quality_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_supplier_quality
    ADD CONSTRAINT audit_supplier_quality_pkey PRIMARY KEY (id);


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
-- Name: bom_processing_jobs bom_processing_jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bom_processing_jobs
    ADD CONSTRAINT bom_processing_jobs_pkey PRIMARY KEY (id);


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
-- Name: categories categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_pkey PRIMARY KEY (id);


--
-- Name: categories categories_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_slug_key UNIQUE (slug);


--
-- Name: cns_bulk_uploads cns_bulk_uploads_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cns_bulk_uploads
    ADD CONSTRAINT cns_bulk_uploads_pkey PRIMARY KEY (id);


--
-- Name: cns_enrichment_config cns_enrichment_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cns_enrichment_config
    ADD CONSTRAINT cns_enrichment_config_pkey PRIMARY KEY (id);


--
-- Name: cns_processing_events cns_processing_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cns_processing_events
    ADD CONSTRAINT cns_processing_events_pkey PRIMARY KEY (id);


--
-- Name: column_mapping_templates column_mapping_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.column_mapping_templates
    ADD CONSTRAINT column_mapping_templates_pkey PRIMARY KEY (id);


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
-- Name: components components_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.components
    ADD CONSTRAINT components_pkey PRIMARY KEY (id);


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
-- Name: manufacturers manufacturers_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.manufacturers
    ADD CONSTRAINT manufacturers_name_key UNIQUE (name);


--
-- Name: manufacturers manufacturers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.manufacturers
    ADD CONSTRAINT manufacturers_pkey PRIMARY KEY (id);


--
-- Name: manufacturers manufacturers_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.manufacturers
    ADD CONSTRAINT manufacturers_slug_key UNIQUE (slug);


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
-- Name: organization_memberships organization_memberships_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_memberships
    ADD CONSTRAINT organization_memberships_pkey PRIMARY KEY (id);


--
-- Name: organization_memberships organization_memberships_user_id_organization_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_memberships
    ADD CONSTRAINT organization_memberships_user_id_organization_id_key UNIQUE (user_id, organization_id);


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
-- Name: organizations organizations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_pkey PRIMARY KEY (id);


--
-- Name: organizations organizations_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_slug_key UNIQUE (slug);


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
-- Name: project_members project_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_members
    ADD CONSTRAINT project_members_pkey PRIMARY KEY (id);


--
-- Name: project_members project_members_project_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_members
    ADD CONSTRAINT project_members_project_id_user_id_key UNIQUE (project_id, user_id);


--
-- Name: project_risk_summaries project_risk_summaries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_risk_summaries
    ADD CONSTRAINT project_risk_summaries_pkey PRIMARY KEY (id);


--
-- Name: projects projects_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_pkey PRIMARY KEY (id);


--
-- Name: projects projects_workspace_id_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_workspace_id_slug_key UNIQUE (workspace_id, slug);


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
-- Name: subscription_plans subscription_plans_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_plans
    ADD CONSTRAINT subscription_plans_code_key UNIQUE (code);


--
-- Name: subscription_plans subscription_plans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_plans
    ADD CONSTRAINT subscription_plans_pkey PRIMARY KEY (id);


--
-- Name: subscriptions subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_pkey PRIMARY KEY (id);


--
-- Name: suppliers suppliers_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.suppliers
    ADD CONSTRAINT suppliers_name_key UNIQUE (name);


--
-- Name: suppliers suppliers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.suppliers
    ADD CONSTRAINT suppliers_pkey PRIMARY KEY (id);


--
-- Name: suppliers suppliers_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.suppliers
    ADD CONSTRAINT suppliers_slug_key UNIQUE (slug);


--
-- Name: organization_invitations unique_org_email_invitation; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_invitations
    ADD CONSTRAINT unique_org_email_invitation UNIQUE (organization_id, email);


--
-- Name: workspace_memberships unique_workspace_membership; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_memberships
    ADD CONSTRAINT unique_workspace_membership UNIQUE (workspace_id, user_id);


--
-- Name: usage_records usage_records_org_type_period_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usage_records
    ADD CONSTRAINT usage_records_org_type_period_unique UNIQUE (organization_id, usage_type, period_start);


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
-- Name: users users_auth0_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_auth0_user_id_key UNIQUE (auth0_user_id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


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
-- Name: workspace_members workspace_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_members
    ADD CONSTRAINT workspace_members_pkey PRIMARY KEY (id);


--
-- Name: workspace_members workspace_members_workspace_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_members
    ADD CONSTRAINT workspace_members_workspace_id_user_id_key UNIQUE (workspace_id, user_id);


--
-- Name: workspace_memberships workspace_memberships_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_memberships
    ADD CONSTRAINT workspace_memberships_pkey PRIMARY KEY (id);


--
-- Name: workspaces workspaces_organization_id_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspaces
    ADD CONSTRAINT workspaces_organization_id_slug_key UNIQUE (organization_id, slug);


--
-- Name: workspaces workspaces_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspaces
    ADD CONSTRAINT workspaces_pkey PRIMARY KEY (id);


--
-- Name: idx_account_deletion_audit_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_account_deletion_audit_org ON public.account_deletion_audit USING btree (organization_id);


--
-- Name: idx_alert_deliveries_alert; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_alert_deliveries_alert ON public.alert_deliveries USING btree (alert_id);


--
-- Name: idx_alert_preferences_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_alert_preferences_org ON public.alert_preferences USING btree (organization_id);


--
-- Name: idx_alert_preferences_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_alert_preferences_user ON public.alert_preferences USING btree (user_id);


--
-- Name: idx_alerts_component; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_alerts_component ON public.alerts USING btree (component_id);


--
-- Name: idx_alerts_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_alerts_org ON public.alerts USING btree (organization_id);


--
-- Name: idx_alerts_severity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_alerts_severity ON public.alerts USING btree (severity);


--
-- Name: idx_alerts_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_alerts_type ON public.alerts USING btree (alert_type);


--
-- Name: idx_alerts_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_alerts_user ON public.alerts USING btree (user_id);


--
-- Name: idx_attributes_component; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_attributes_component ON public.attributes USING btree (component_id);


--
-- Name: idx_attributes_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_attributes_name ON public.attributes USING btree (name);


--
-- Name: idx_audit_enrichment_upload; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_enrichment_upload ON public.audit_enrichment_runs USING btree (upload_id);


--
-- Name: idx_audit_field_comparisons_run; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_field_comparisons_run ON public.audit_field_comparisons USING btree (enrichment_run_id);


--
-- Name: idx_audit_logs_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_org ON public.audit_logs USING btree (organization_id);


--
-- Name: idx_audit_logs_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_type ON public.audit_logs USING btree (event_type);


--
-- Name: idx_audit_supplier_quality_date; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_audit_supplier_quality_date ON public.audit_supplier_quality USING btree (date, supplier_name);


--
-- Name: idx_billing_customers_org; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_billing_customers_org ON public.billing_customers USING btree (organization_id);


--
-- Name: idx_billing_webhook_provider_event; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_billing_webhook_provider_event ON public.billing_webhook_events USING btree (provider, provider_event_id);


--
-- Name: idx_bom_items_job_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bom_items_job_id ON public.bom_items USING btree (job_id);


--
-- Name: idx_bom_jobs_job_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bom_jobs_job_id ON public.bom_jobs USING btree (job_id);


--
-- Name: idx_bom_jobs_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bom_jobs_org ON public.bom_jobs USING btree (organization_id);


--
-- Name: idx_bom_line_items_bom; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bom_line_items_bom ON public.bom_line_items USING btree (bom_id);


--
-- Name: idx_bom_line_items_component; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bom_line_items_component ON public.bom_line_items USING btree (component_id);


--
-- Name: idx_bom_line_items_mpn; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bom_line_items_mpn ON public.bom_line_items USING btree (manufacturer_part_number);


--
-- Name: idx_bom_line_items_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bom_line_items_status ON public.bom_line_items USING btree (enrichment_status);


--
-- Name: idx_bom_line_risk_line_item; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bom_line_risk_line_item ON public.bom_line_item_risk_scores USING btree (bom_line_item_id);


--
-- Name: idx_bom_line_risk_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bom_line_risk_org ON public.bom_line_item_risk_scores USING btree (organization_id);


--
-- Name: idx_bom_processing_jobs_bom; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bom_processing_jobs_bom ON public.bom_processing_jobs USING btree (bom_id);


--
-- Name: idx_bom_processing_jobs_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bom_processing_jobs_status ON public.bom_processing_jobs USING btree (status);


--
-- Name: idx_bom_risk_summaries_bom; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bom_risk_summaries_bom ON public.bom_risk_summaries USING btree (bom_id);


--
-- Name: idx_bom_risk_summaries_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bom_risk_summaries_org ON public.bom_risk_summaries USING btree (organization_id);


--
-- Name: idx_bom_uploads_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bom_uploads_org ON public.bom_uploads USING btree (organization_id);


--
-- Name: idx_bom_uploads_project; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bom_uploads_project ON public.bom_uploads USING btree (project_id);


--
-- Name: idx_bom_uploads_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bom_uploads_status ON public.bom_uploads USING btree (status);


--
-- Name: idx_boms_enrichment_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_boms_enrichment_status ON public.boms USING btree (enrichment_status);


--
-- Name: idx_boms_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_boms_org ON public.boms USING btree (organization_id);


--
-- Name: idx_boms_project; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_boms_project ON public.boms USING btree (project_id);


--
-- Name: idx_boms_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_boms_status ON public.boms USING btree (status);


--
-- Name: idx_categories_parent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_categories_parent ON public.categories USING btree (parent_id);


--
-- Name: idx_categories_path; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_categories_path ON public.categories USING btree (path);


--
-- Name: idx_categories_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_categories_slug ON public.categories USING btree (slug);


--
-- Name: idx_cns_bulk_uploads_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cns_bulk_uploads_org ON public.cns_bulk_uploads USING btree (organization_id);


--
-- Name: idx_cns_bulk_uploads_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cns_bulk_uploads_status ON public.cns_bulk_uploads USING btree (status);


--
-- Name: idx_cns_config_global; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cns_config_global ON public.cns_enrichment_config USING btree (is_global) WHERE (is_global = true);


--
-- Name: idx_cns_config_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cns_config_tenant ON public.cns_enrichment_config USING btree (tenant_id);


--
-- Name: idx_cns_events_bom; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cns_events_bom ON public.cns_processing_events USING btree (bom_id);


--
-- Name: idx_cns_events_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cns_events_org ON public.cns_processing_events USING btree (organization_id);


--
-- Name: idx_cns_events_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cns_events_type ON public.cns_processing_events USING btree (event_type);


--
-- Name: idx_column_mapping_templates_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_column_mapping_templates_org ON public.column_mapping_templates USING btree (organization_id);


--
-- Name: idx_component_base_risk_component; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_component_base_risk_component ON public.component_base_risk_scores USING btree (component_id);


--
-- Name: idx_component_base_risk_mpn; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_component_base_risk_mpn ON public.component_base_risk_scores USING btree (mpn);


--
-- Name: idx_component_watches_component; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_component_watches_component ON public.component_watches USING btree (component_id);


--
-- Name: idx_component_watches_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_component_watches_user ON public.component_watches USING btree (user_id);


--
-- Name: idx_components_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_components_category ON public.components USING btree (category_id);


--
-- Name: idx_components_lifecycle; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_components_lifecycle ON public.components USING btree (lifecycle_status);


--
-- Name: idx_components_manufacturer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_components_manufacturer ON public.components USING btree (manufacturer_id);


--
-- Name: idx_components_mpn; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_components_mpn ON public.components USING btree (manufacturer_part_number);


--
-- Name: idx_components_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_components_org ON public.components USING btree (organization_id);


--
-- Name: idx_components_risk; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_components_risk ON public.components USING btree (risk_level);


--
-- Name: idx_components_search; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_components_search ON public.components USING gin (search_vector);


--
-- Name: idx_enrichment_audit_log_bom; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_enrichment_audit_log_bom ON public.enrichment_audit_log USING btree (bom_id);


--
-- Name: idx_enrichment_audit_log_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_enrichment_audit_log_org ON public.enrichment_audit_log USING btree (organization_id);


--
-- Name: idx_enrichment_events_bom; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_enrichment_events_bom ON public.enrichment_events USING btree (bom_id);


--
-- Name: idx_enrichment_events_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_enrichment_events_tenant ON public.enrichment_events USING btree (tenant_id);


--
-- Name: idx_enrichment_history_mpn; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_enrichment_history_mpn ON public.enrichment_history USING btree (mpn);


--
-- Name: idx_enrichment_history_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_enrichment_history_status ON public.enrichment_history USING btree (status);


--
-- Name: idx_enrichment_queue_bom; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_enrichment_queue_bom ON public.enrichment_queue USING btree (bom_id);


--
-- Name: idx_enrichment_queue_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_enrichment_queue_org ON public.enrichment_queue USING btree (organization_id);


--
-- Name: idx_enrichment_queue_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_enrichment_queue_status ON public.enrichment_queue USING btree (status);


--
-- Name: idx_invoice_line_items_invoice; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_invoice_line_items_invoice ON public.invoice_line_items USING btree (invoice_id);


--
-- Name: idx_invoices_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_invoices_customer ON public.invoices USING btree (billing_customer_id);


--
-- Name: idx_invoices_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_invoices_org ON public.invoices USING btree (organization_id);


--
-- Name: idx_invoices_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_invoices_status ON public.invoices USING btree (status);


--
-- Name: idx_manufacturers_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_manufacturers_name ON public.manufacturers USING btree (name);


--
-- Name: idx_manufacturers_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_manufacturers_slug ON public.manufacturers USING btree (slug);


--
-- Name: idx_notifications_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_org ON public.notifications USING btree (organization_id);


--
-- Name: idx_notifications_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_user ON public.notifications USING btree (user_id);


--
-- Name: idx_onboarding_events_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_onboarding_events_org ON public.onboarding_events USING btree (organization_id);


--
-- Name: idx_onboarding_events_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_onboarding_events_user ON public.onboarding_events USING btree (user_id);


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
-- Name: idx_org_memberships_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_org_memberships_user ON public.organization_memberships USING btree (user_id);


--
-- Name: idx_org_memberships_user_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_org_memberships_user_org ON public.organization_memberships USING btree (user_id, organization_id);


--
-- Name: idx_org_risk_profiles_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_org_risk_profiles_org ON public.organization_risk_profiles USING btree (organization_id);


--
-- Name: idx_org_settings_audit_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_org_settings_audit_org ON public.organization_settings_audit USING btree (organization_id);


--
-- Name: idx_organizations_deleted; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_organizations_deleted ON public.organizations USING btree (deleted_at) WHERE (deleted_at IS NULL);


--
-- Name: idx_organizations_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_organizations_slug ON public.organizations USING btree (slug);


--
-- Name: idx_organizations_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_organizations_status ON public.organizations USING btree (subscription_status);


--
-- Name: idx_payment_methods_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payment_methods_customer ON public.payment_methods USING btree (billing_customer_id);


--
-- Name: idx_payments_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payments_customer ON public.payments USING btree (billing_customer_id);


--
-- Name: idx_payments_invoice; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payments_invoice ON public.payments USING btree (invoice_id);


--
-- Name: idx_payments_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payments_status ON public.payments USING btree (status);


--
-- Name: idx_project_members_project; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_project_members_project ON public.project_members USING btree (project_id);


--
-- Name: idx_project_members_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_project_members_user ON public.project_members USING btree (user_id);


--
-- Name: idx_project_risk_summaries_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_project_risk_summaries_org ON public.project_risk_summaries USING btree (organization_id);


--
-- Name: idx_project_risk_summaries_project; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_project_risk_summaries_project ON public.project_risk_summaries USING btree (project_id);


--
-- Name: idx_projects_organization; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_projects_organization ON public.projects USING btree (organization_id);


--
-- Name: idx_projects_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_projects_slug ON public.projects USING btree (slug);


--
-- Name: idx_projects_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_projects_status ON public.projects USING btree (status);


--
-- Name: idx_projects_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_projects_workspace ON public.projects USING btree (workspace_id);


--
-- Name: idx_risk_score_history_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_risk_score_history_entity ON public.risk_score_history USING btree (entity_type, entity_id);


--
-- Name: idx_risk_score_history_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_risk_score_history_org ON public.risk_score_history USING btree (organization_id);


--
-- Name: idx_risk_score_history_recorded; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_risk_score_history_recorded ON public.risk_score_history USING btree (recorded_at);


--
-- Name: idx_subscriptions_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscriptions_org ON public.subscriptions USING btree (organization_id);


--
-- Name: idx_subscriptions_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscriptions_status ON public.subscriptions USING btree (status);


--
-- Name: idx_suppliers_priority; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_suppliers_priority ON public.suppliers USING btree (priority);


--
-- Name: idx_suppliers_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_suppliers_slug ON public.suppliers USING btree (slug);


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
-- Name: idx_users_auth0_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_auth0_id ON public.users USING btree (auth0_user_id) WHERE (auth0_user_id IS NOT NULL);


--
-- Name: idx_users_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_email ON public.users USING btree (email);


--
-- Name: idx_users_is_platform_admin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_is_platform_admin ON public.users USING btree (is_platform_admin) WHERE (is_platform_admin = true);


--
-- Name: idx_users_keycloak_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_keycloak_id ON public.users USING btree (keycloak_user_id) WHERE (keycloak_user_id IS NOT NULL);


--
-- Name: idx_workspace_invitations_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workspace_invitations_token ON public.workspace_invitations USING btree (token);


--
-- Name: idx_workspace_invitations_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workspace_invitations_workspace ON public.workspace_invitations USING btree (workspace_id);


--
-- Name: idx_workspace_members_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workspace_members_user ON public.workspace_members USING btree (user_id);


--
-- Name: idx_workspace_members_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workspace_members_workspace ON public.workspace_members USING btree (workspace_id);


--
-- Name: idx_workspace_memberships_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workspace_memberships_user ON public.workspace_memberships USING btree (user_id);


--
-- Name: idx_workspace_memberships_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workspace_memberships_workspace ON public.workspace_memberships USING btree (workspace_id);


--
-- Name: idx_workspaces_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workspaces_org ON public.workspaces USING btree (organization_id);


--
-- Name: idx_workspaces_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workspaces_slug ON public.workspaces USING btree (slug);


--
-- Name: users auto_add_platform_staff_to_platform_org; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER auto_add_platform_staff_to_platform_org AFTER INSERT OR UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.trigger_auto_add_platform_staff_to_platform_org();


--
-- Name: column_mapping_templates ensure_single_default_template; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER ensure_single_default_template BEFORE INSERT OR UPDATE ON public.column_mapping_templates FOR EACH ROW EXECUTE FUNCTION public.ensure_single_default_template();


--
-- Name: billing_customers update_billing_customers_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_billing_customers_updated_at BEFORE UPDATE ON public.billing_customers FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamp();


--
-- Name: bom_items update_bom_items_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_bom_items_updated_at BEFORE UPDATE ON public.bom_items FOR EACH ROW EXECUTE FUNCTION public.update_bom_items_updated_at();


--
-- Name: bom_jobs update_bom_jobs_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_bom_jobs_updated_at BEFORE UPDATE ON public.bom_jobs FOR EACH ROW EXECUTE FUNCTION public.update_bom_jobs_updated_at();


--
-- Name: bom_line_items update_bom_line_items_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_bom_line_items_updated_at BEFORE UPDATE ON public.bom_line_items FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamp();


--
-- Name: bom_processing_jobs update_bom_processing_jobs_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_bom_processing_jobs_updated_at BEFORE UPDATE ON public.bom_processing_jobs FOR EACH ROW EXECUTE FUNCTION public.update_bom_processing_jobs_updated_at();


--
-- Name: bom_risk_summaries update_bom_risk_summaries_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_bom_risk_summaries_updated_at BEFORE UPDATE ON public.bom_risk_summaries FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamp();


--
-- Name: bom_uploads update_bom_uploads_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_bom_uploads_updated_at BEFORE UPDATE ON public.bom_uploads FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamp();


--
-- Name: boms update_boms_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_boms_updated_at BEFORE UPDATE ON public.boms FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamp();


--
-- Name: cns_bulk_uploads update_cns_bulk_uploads_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_cns_bulk_uploads_updated_at BEFORE UPDATE ON public.cns_bulk_uploads FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamp();


--
-- Name: column_mapping_templates update_column_mapping_templates_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_column_mapping_templates_updated_at BEFORE UPDATE ON public.column_mapping_templates FOR EACH ROW EXECUTE FUNCTION public.update_column_mapping_templates_updated_at();


--
-- Name: components update_component_search; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_component_search BEFORE INSERT OR UPDATE ON public.components FOR EACH ROW EXECUTE FUNCTION public.update_component_search_vector();


--
-- Name: components update_components_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_components_updated_at BEFORE UPDATE ON public.components FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamp();


--
-- Name: invoices update_invoices_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamp();


--
-- Name: organization_invitations update_org_invitations_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_org_invitations_updated_at BEFORE UPDATE ON public.organization_invitations FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamp();


--
-- Name: organization_memberships update_org_memberships_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_org_memberships_updated_at BEFORE UPDATE ON public.organization_memberships FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamp();


--
-- Name: organization_risk_profiles update_org_risk_profiles_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_org_risk_profiles_updated_at BEFORE UPDATE ON public.organization_risk_profiles FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamp();


--
-- Name: organizations update_organizations_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON public.organizations FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamp();


--
-- Name: payment_methods update_payment_methods_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_payment_methods_updated_at BEFORE UPDATE ON public.payment_methods FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamp();


--
-- Name: payments update_payments_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamp();


--
-- Name: project_risk_summaries update_project_risk_summaries_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_project_risk_summaries_updated_at BEFORE UPDATE ON public.project_risk_summaries FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamp();


--
-- Name: projects update_projects_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamp();


--
-- Name: subscriptions update_subscriptions_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON public.subscriptions FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamp();


--
-- Name: usage_records update_usage_records_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_usage_records_updated_at BEFORE UPDATE ON public.usage_records FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamp();


--
-- Name: users update_users_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamp();


--
-- Name: workspace_memberships update_workspace_memberships_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_workspace_memberships_updated_at BEFORE UPDATE ON public.workspace_memberships FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamp();


--
-- Name: workspaces update_workspaces_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_workspaces_updated_at BEFORE UPDATE ON public.workspaces FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamp();


--
-- Name: account_deletion_audit account_deletion_audit_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_deletion_audit
    ADD CONSTRAINT account_deletion_audit_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


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
-- Name: alert_preferences alert_preferences_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alert_preferences
    ADD CONSTRAINT alert_preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: alerts alerts_component_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alerts
    ADD CONSTRAINT alerts_component_id_fkey FOREIGN KEY (component_id) REFERENCES public.components(id) ON DELETE SET NULL;


--
-- Name: alerts alerts_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alerts
    ADD CONSTRAINT alerts_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: alerts alerts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alerts
    ADD CONSTRAINT alerts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: attributes attributes_component_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attributes
    ADD CONSTRAINT attributes_component_id_fkey FOREIGN KEY (component_id) REFERENCES public.components(id) ON DELETE CASCADE;


--
-- Name: audit_field_comparisons audit_field_comparisons_enrichment_run_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_field_comparisons
    ADD CONSTRAINT audit_field_comparisons_enrichment_run_id_fkey FOREIGN KEY (enrichment_run_id) REFERENCES public.audit_enrichment_runs(id) ON DELETE CASCADE;


--
-- Name: audit_logs audit_logs_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: billing_customers billing_customers_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.billing_customers
    ADD CONSTRAINT billing_customers_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


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
-- Name: bom_processing_jobs bom_processing_jobs_bom_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bom_processing_jobs
    ADD CONSTRAINT bom_processing_jobs_bom_id_fkey FOREIGN KEY (bom_id) REFERENCES public.boms(id) ON DELETE CASCADE;


--
-- Name: bom_processing_jobs bom_processing_jobs_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bom_processing_jobs
    ADD CONSTRAINT bom_processing_jobs_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


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
    ADD CONSTRAINT bom_uploads_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.users(id);


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
-- Name: categories categories_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.categories(id) ON DELETE CASCADE;


--
-- Name: cns_bulk_uploads cns_bulk_uploads_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cns_bulk_uploads
    ADD CONSTRAINT cns_bulk_uploads_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: cns_bulk_uploads cns_bulk_uploads_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cns_bulk_uploads
    ADD CONSTRAINT cns_bulk_uploads_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id);


--
-- Name: cns_processing_events cns_processing_events_bom_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cns_processing_events
    ADD CONSTRAINT cns_processing_events_bom_id_fkey FOREIGN KEY (bom_id) REFERENCES public.boms(id) ON DELETE CASCADE;


--
-- Name: cns_processing_events cns_processing_events_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cns_processing_events
    ADD CONSTRAINT cns_processing_events_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: column_mapping_templates column_mapping_templates_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.column_mapping_templates
    ADD CONSTRAINT column_mapping_templates_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: column_mapping_templates column_mapping_templates_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.column_mapping_templates
    ADD CONSTRAINT column_mapping_templates_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: component_base_risk_scores component_base_risk_scores_component_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.component_base_risk_scores
    ADD CONSTRAINT component_base_risk_scores_component_id_fkey FOREIGN KEY (component_id) REFERENCES public.components(id) ON DELETE CASCADE;


--
-- Name: component_watches component_watches_component_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.component_watches
    ADD CONSTRAINT component_watches_component_id_fkey FOREIGN KEY (component_id) REFERENCES public.components(id) ON DELETE CASCADE;


--
-- Name: component_watches component_watches_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.component_watches
    ADD CONSTRAINT component_watches_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: component_watches component_watches_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.component_watches
    ADD CONSTRAINT component_watches_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: components components_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.components
    ADD CONSTRAINT components_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE SET NULL;


--
-- Name: components components_manufacturer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.components
    ADD CONSTRAINT components_manufacturer_id_fkey FOREIGN KEY (manufacturer_id) REFERENCES public.manufacturers(id) ON DELETE SET NULL;


--
-- Name: components components_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.components
    ADD CONSTRAINT components_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


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
-- Name: invoice_line_items invoice_line_items_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_line_items
    ADD CONSTRAINT invoice_line_items_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoices(id) ON DELETE CASCADE;


--
-- Name: invoices invoices_billing_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_billing_customer_id_fkey FOREIGN KEY (billing_customer_id) REFERENCES public.billing_customers(id) ON DELETE RESTRICT;


--
-- Name: invoices invoices_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


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
-- Name: notifications notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: onboarding_events onboarding_events_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.onboarding_events
    ADD CONSTRAINT onboarding_events_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: onboarding_events onboarding_events_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.onboarding_events
    ADD CONSTRAINT onboarding_events_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


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
-- Name: organization_memberships organization_memberships_invited_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_memberships
    ADD CONSTRAINT organization_memberships_invited_by_fkey FOREIGN KEY (invited_by) REFERENCES public.users(id);


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
-- Name: organization_risk_profiles organization_risk_profiles_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_risk_profiles
    ADD CONSTRAINT organization_risk_profiles_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: organization_risk_profiles organization_risk_profiles_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_risk_profiles
    ADD CONSTRAINT organization_risk_profiles_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: organization_risk_profiles organization_risk_profiles_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_risk_profiles
    ADD CONSTRAINT organization_risk_profiles_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id);


--
-- Name: organization_settings_audit organization_settings_audit_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_settings_audit
    ADD CONSTRAINT organization_settings_audit_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: payment_methods payment_methods_billing_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_methods
    ADD CONSTRAINT payment_methods_billing_customer_id_fkey FOREIGN KEY (billing_customer_id) REFERENCES public.billing_customers(id) ON DELETE CASCADE;


--
-- Name: payments payments_billing_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_billing_customer_id_fkey FOREIGN KEY (billing_customer_id) REFERENCES public.billing_customers(id) ON DELETE RESTRICT;


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
-- Name: project_members project_members_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_members
    ADD CONSTRAINT project_members_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: project_members project_members_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_members
    ADD CONSTRAINT project_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


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
-- Name: projects projects_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: projects projects_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: projects projects_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: risk_score_history risk_score_history_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.risk_score_history
    ADD CONSTRAINT risk_score_history_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


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
-- Name: user_preferences user_preferences_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_preferences
    ADD CONSTRAINT user_preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: workspace_invitations workspace_invitations_invited_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_invitations
    ADD CONSTRAINT workspace_invitations_invited_by_fkey FOREIGN KEY (invited_by) REFERENCES public.users(id);


--
-- Name: workspace_invitations workspace_invitations_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_invitations
    ADD CONSTRAINT workspace_invitations_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: workspace_members workspace_members_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_members
    ADD CONSTRAINT workspace_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: workspace_members workspace_members_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_members
    ADD CONSTRAINT workspace_members_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


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
    ADD CONSTRAINT workspaces_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: workspaces workspaces_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspaces
    ADD CONSTRAINT workspaces_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

