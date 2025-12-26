--
-- PostgreSQL database dump
--

\restrict NjMqwQCvwa3h0Afadx5oZwpYtPz7OLrzu5rKe0Pi1BPZMSTFiI7csKZbpWCzPXt

-- Dumped from database version 15.14
-- Dumped by pg_dump version 15.14

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
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- Name: acquire_redis_sync_lock(text, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.acquire_redis_sync_lock(p_worker_id text, p_lock_duration_seconds integer DEFAULT 300) RETURNS boolean
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_lock_acquired INTEGER;  -- FIXED: Changed from BOOLEAN to INTEGER to match ROW_COUNT type
BEGIN
    -- Try to insert lock
    INSERT INTO redis_sync_lock (lock_name, locked_by, expires_at)
    VALUES ('redis_sync', p_worker_id, NOW() + (p_lock_duration_seconds || ' seconds')::INTERVAL)
    ON CONFLICT (lock_name) DO NOTHING;

    GET DIAGNOSTICS v_lock_acquired = ROW_COUNT;

    IF v_lock_acquired = 0 THEN
        -- Check if existing lock is expired
        DELETE FROM redis_sync_lock
        WHERE lock_name = 'redis_sync'
          AND expires_at < NOW();

        GET DIAGNOSTICS v_lock_acquired = ROW_COUNT;

        -- If we deleted an expired lock, try to acquire again
        IF v_lock_acquired > 0 THEN
            INSERT INTO redis_sync_lock (lock_name, locked_by, expires_at)
            VALUES ('redis_sync', p_worker_id, NOW() + (p_lock_duration_seconds || ' seconds')::INTERVAL);

            RETURN TRUE;
        END IF;

        RETURN FALSE;
    END IF;

    RETURN TRUE;
END;
$$;


--
-- Name: FUNCTION acquire_redis_sync_lock(p_worker_id text, p_lock_duration_seconds integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.acquire_redis_sync_lock(p_worker_id text, p_lock_duration_seconds integer) IS 'Acquire advisory lock for Redis sync (fixed INTEGER type for v_lock_acquired)';


--
-- Name: check_organization_quota(integer, character varying); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_organization_quota(p_org_id integer, p_feature character varying) RETURNS boolean
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_enabled BOOLEAN;
BEGIN
    SELECT is_enabled INTO v_enabled FROM tenant_features 
    WHERE organization_id = p_org_id AND feature_name = p_feature;
    
    RETURN COALESCE(v_enabled, FALSE);
END;
$$;


--
-- Name: check_redis_connectivity(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_redis_connectivity() RETURNS TABLE(service_name character varying, status character varying, last_check timestamp without time zone)
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN QUERY
    SELECT
        rcc.service_name,
        rhc.connection_status,
        rhc.last_check
    FROM redis_cache_config rcc
    LEFT JOIN redis_health_check rhc ON rcc.service_name = rhc.service_name
    WHERE rcc.enabled = true
    ORDER BY rcc.service_name;
END;
$$;


--
-- Name: check_supplier_rate_limit(character varying); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_supplier_rate_limit(p_supplier_id character varying) RETURNS boolean
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_count INTEGER;
    v_limit INTEGER;
BEGIN
    SELECT request_count INTO v_count FROM supplier_rate_limits WHERE supplier_id = p_supplier_id;
    SELECT rate_limit_per_hour INTO v_limit FROM supplier_settings WHERE supplier_id = p_supplier_id;
    
    RETURN COALESCE(v_count, 0) < COALESCE(v_limit, 5000);
END;
$$;


--
-- Name: cleanup_expired_redis_snapshots(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cleanup_expired_redis_snapshots() RETURNS integer
    LANGUAGE plpgsql
    AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Delete snapshots that expired more than 7 days ago
    WITH deleted AS (
        DELETE FROM redis_component_snapshot
        WHERE sync_status = 'expired'
          AND expires_at < NOW() - INTERVAL '7 days'
        RETURNING id
    )
    SELECT COUNT(*) INTO deleted_count FROM deleted;

    RAISE NOTICE 'Cleaned up % expired Redis snapshots', deleted_count;
    RETURN deleted_count;
END;
$$;


--
-- Name: FUNCTION cleanup_expired_redis_snapshots(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.cleanup_expired_redis_snapshots() IS 'Delete expired Redis snapshots older than 7 days';


--
-- Name: cleanup_old_audit_data(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cleanup_old_audit_data(retention_days integer DEFAULT 90) RETURNS TABLE(deleted_runs integer, deleted_comparisons integer, deleted_snapshots integer)
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_deleted_runs INTEGER;
    v_deleted_comparisons INTEGER;
    v_deleted_snapshots INTEGER;
    v_cutoff_date TIMESTAMPTZ;
BEGIN
    -- Calculate cutoff date
    v_cutoff_date := NOW() - (retention_days || ' days')::INTERVAL;

    -- Delete old field comparisons (cascades from runs)
    -- This is handled by ON DELETE CASCADE, so we only need to delete runs

    -- Delete old enrichment runs
    DELETE FROM audit_enrichment_runs
    WHERE enrichment_timestamp < v_cutoff_date
      AND reviewed_at IS NULL  -- Don't delete reviewed runs
      AND needs_review = FALSE;  -- Don't delete flagged runs

    GET DIAGNOSTICS v_deleted_runs = ROW_COUNT;

    -- Field comparisons are auto-deleted via CASCADE
    v_deleted_comparisons := 0;  -- Placeholder

    -- Delete expired Redis snapshots
    DELETE FROM redis_component_snapshot
    WHERE sync_status = 'expired'
      AND expires_at < v_cutoff_date;

    GET DIAGNOSTICS v_deleted_snapshots = ROW_COUNT;

    -- Return counts
    deleted_runs := v_deleted_runs;
    deleted_comparisons := v_deleted_comparisons;
    deleted_snapshots := v_deleted_snapshots;

    RETURN NEXT;

    -- Log the cleanup
    RAISE NOTICE 'Cleaned up % runs, % snapshots older than % days',
        v_deleted_runs, v_deleted_snapshots, retention_days;
END;
$$;


--
-- Name: FUNCTION cleanup_old_audit_data(retention_days integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.cleanup_old_audit_data(retention_days integer) IS 'Delete audit data older than retention period (default 90 days). Excludes reviewed and flagged runs.';


--
-- Name: flag_enrichment_for_review(uuid, numeric, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.flag_enrichment_for_review(p_enrichment_run_id uuid, p_quality_score numeric, p_missing_fields integer) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Auto-flag if quality score < 80 OR more than 5 fields missing
    UPDATE audit_enrichment_runs
    SET needs_review = TRUE
    WHERE id = p_enrichment_run_id
      AND (p_quality_score < 80 OR p_missing_fields > 5);
END;
$$;


--
-- Name: FUNCTION flag_enrichment_for_review(p_enrichment_run_id uuid, p_quality_score numeric, p_missing_fields integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.flag_enrichment_for_review(p_enrichment_run_id uuid, p_quality_score numeric, p_missing_fields integer) IS 'Automatically flag low-quality enrichments for manual review';


--
-- Name: get_active_cns_config(character varying); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_active_cns_config(p_tenant_id character varying) RETURNS TABLE(id integer, tenant_id character varying, config_name character varying, is_active boolean, is_global boolean, enable_suppliers boolean, preferred_suppliers text[], supplier_min_confidence numeric, enable_ai boolean, ai_provider character varying, ai_operations text[], ai_min_confidence numeric, ai_cost_limit_monthly numeric, enable_web_scraping boolean, scraping_sources text[], scraping_timeout_seconds integer, quality_reject_threshold integer, quality_staging_threshold integer, quality_auto_approve_threshold integer, batch_size integer, max_retries integer, ai_cost_current_month numeric, ai_requests_current_month integer, web_scraping_requests_current_month integer, circuit_breaker_enabled boolean, circuit_breaker_failure_threshold integer, circuit_breaker_timeout_seconds integer, circuit_breaker_success_threshold integer, retry_enabled boolean, retry_max_attempts integer, retry_initial_delay_seconds numeric, retry_exponential_base numeric, retry_max_delay_seconds numeric, retry_jitter_enabled boolean, created_at timestamp without time zone, updated_at timestamp without time zone)
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Try tenant-specific config first
    IF p_tenant_id IS NOT NULL THEN
        RETURN QUERY
        SELECT c.* FROM cns_enrichment_config c
        WHERE c.tenant_id = p_tenant_id AND c.is_active = TRUE
        LIMIT 1;

        IF FOUND THEN
            RETURN;
        END IF;
    END IF;

    -- Fallback to global config
    RETURN QUERY
    SELECT c.* FROM cns_enrichment_config c
    WHERE c.is_global = TRUE AND c.is_active = TRUE
    ORDER BY c.created_at DESC
    LIMIT 1;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: component_catalog; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.component_catalog (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    manufacturer_part_number text NOT NULL,
    manufacturer text NOT NULL,
    category text,
    subcategory text,
    description text,
    datasheet_url text,
    image_url text,
    specifications jsonb DEFAULT '{}'::jsonb,
    lifecycle_status text,
    risk_level text,
    rohs_compliant boolean DEFAULT true,
    reach_compliant boolean DEFAULT true,
    aec_qualified boolean DEFAULT false,
    halogen_free boolean DEFAULT false,
    unit_price numeric(10,2),
    currency text DEFAULT 'USD'::text,
    moq integer,
    lead_time_days integer,
    stock_status text,
    stock_quantity integer,
    packaging text,
    minimum_order_quantity integer,
    eccn_code text,
    hts_code text,
    quality_score numeric(5,2),
    quality_metadata jsonb DEFAULT '{}'::jsonb,
    supplier_data jsonb DEFAULT '{}'::jsonb,
    supplier_part_number text,
    supplier_name text,
    price_breaks jsonb DEFAULT '[]'::jsonb,
    parameters jsonb DEFAULT '{}'::jsonb,
    ai_category_suggestions jsonb DEFAULT '[]'::jsonb,
    ai_classification_confidence numeric(5,2),
    ai_metadata jsonb DEFAULT '{}'::jsonb,
    enrichment_source text,
    enrichment_version text,
    last_enriched_at timestamp with time zone,
    enrichment_count integer DEFAULT 1,
    storage_location text DEFAULT 'database'::text,
    usage_count integer DEFAULT 0,
    first_seen_at timestamp with time zone DEFAULT now(),
    last_used_at timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT component_catalog_storage_location_check CHECK ((storage_location = ANY (ARRAY['database'::text, 'redis'::text])))
);


--
-- Name: TABLE component_catalog; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.component_catalog IS 'Central component catalog - single source of truth for all enriched components.
Each component (MPN + Manufacturer) is stored once and reused across all customer BOMs.
This eliminates data duplication and reduces enrichment API costs.';


--
-- Name: COLUMN component_catalog.manufacturer_part_number; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.component_catalog.manufacturer_part_number IS 'Manufacturer Part Number (MPN) - primary component identifier';


--
-- Name: COLUMN component_catalog.manufacturer; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.component_catalog.manufacturer IS 'Component manufacturer name (e.g., STMicroelectronics, Texas Instruments)';


--
-- Name: COLUMN component_catalog.quality_score; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.component_catalog.quality_score IS 'Component data quality score (0-100). Based on completeness of enrichment data.
Score >= 80: Stored in database permanently.
Score < 80: Stored in Redis temporarily (72hr TTL) for re-enrichment.';


--
-- Name: COLUMN component_catalog.supplier_data; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.component_catalog.supplier_data IS 'Raw supplier API responses (Mouser, DigiKey, Element14) in JSONB format.
Structure: {"mouser": {...}, "digikey": {...}, "element14": {...}}';


--
-- Name: COLUMN component_catalog.enrichment_count; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.component_catalog.enrichment_count IS 'Number of times this component has been re-enriched (for freshness tracking)';


--
-- Name: COLUMN component_catalog.storage_location; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.component_catalog.storage_location IS 'Storage location for this component: database (permanent) or redis (temporary)';


--
-- Name: COLUMN component_catalog.usage_count; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.component_catalog.usage_count IS 'Number of BOMs that reference this component. Used for popularity ranking.';


--
-- Name: get_component_by_mpn(text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_component_by_mpn(p_mpn text, p_manufacturer text) RETURNS public.component_catalog
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_component component_catalog;
BEGIN
    SELECT * INTO v_component
    FROM component_catalog
    WHERE manufacturer_part_number = p_mpn
      AND manufacturer = p_manufacturer
    LIMIT 1;

    RETURN v_component;
END;
$$;


--
-- Name: get_enabled_suppliers(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_enabled_suppliers() RETURNS TABLE(supplier_name character varying, display_name character varying, base_url text, rate_limit_per_minute integer, timeout_seconds integer)
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN QUERY
    SELECT
        s.supplier_name,
        s.display_name,
        s.base_url,
        s.rate_limit_per_minute,
        s.timeout_seconds
    FROM cns_supplier_settings s
    WHERE s.enabled = TRUE
      AND s.priority > 0
    ORDER BY s.priority ASC;
END;
$$;


--
-- Name: FUNCTION get_enabled_suppliers(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_enabled_suppliers() IS 'Get enabled suppliers in priority order for enrichment pipeline';


--
-- Name: get_enrichment_config(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_enrichment_config(p_config_key text) RETURNS text
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_value TEXT;
BEGIN
    SELECT config_value INTO v_value
    FROM cns_enrichment_config
    WHERE config_key = p_config_key
      AND deprecated = FALSE;

    RETURN v_value;
END;
$$;


--
-- Name: get_enrichment_config_bool(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_enrichment_config_bool(p_config_key text) RETURNS boolean
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN get_enrichment_config(p_config_key)::BOOLEAN;
END;
$$;


--
-- Name: get_enrichment_config_float(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_enrichment_config_float(p_config_key text) RETURNS numeric
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN get_enrichment_config(p_config_key)::NUMERIC;
END;
$$;


--
-- Name: get_enrichment_config_int(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_enrichment_config_int(p_config_key text) RETURNS integer
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN get_enrichment_config(p_config_key)::INTEGER;
END;
$$;


--
-- Name: get_enrichment_configs_by_category(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_enrichment_configs_by_category(p_category text) RETURNS TABLE(config_key text, config_value text, value_type text, description text, updated_at timestamp with time zone)
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN QUERY
    SELECT
        c.config_key,
        c.config_value,
        c.value_type,
        c.description,
        c.updated_at
    FROM cns_enrichment_config c
    WHERE c.category = p_category
      AND c.deprecated = FALSE
    ORDER BY c.config_key;
END;
$$;


--
-- Name: get_enrichment_rules_for_component(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_enrichment_rules_for_component(p_component_id integer) RETURNS TABLE(rule_id integer, rule_name character varying, source_name character varying, target_field character varying)
    LANGUAGE sql
    AS $$
SELECT 
    er.id,
    er.rule_name,
    es.source_name,
    er.target_field
FROM enrichment_rules er
JOIN enrichment_sources es ON er.enrichment_source_id = es.id
WHERE er.is_active = TRUE 
    AND es.is_active = TRUE
ORDER BY er.priority
$$;


--
-- Name: get_expiring_redis_components(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_expiring_redis_components(hours_threshold integer DEFAULT 24) RETURNS TABLE(id uuid, mpn text, manufacturer text, quality_score numeric, expires_at timestamp with time zone, hours_remaining numeric)
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN QUERY
    SELECT
        r.id,
        r.mpn,
        r.manufacturer,
        r.quality_score,
        r.expires_at,
        ROUND(EXTRACT(EPOCH FROM (r.expires_at - NOW())) / 3600, 2) as hours_remaining
    FROM redis_component_snapshot r
    WHERE r.sync_status = 'active'
      AND r.expires_at < NOW() + (hours_threshold || ' hours')::INTERVAL
      AND r.expires_at > NOW()
    ORDER BY r.expires_at ASC;
END;
$$;


--
-- Name: FUNCTION get_expiring_redis_components(hours_threshold integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_expiring_redis_components(hours_threshold integer) IS 'Get Redis components expiring within N hours';


--
-- Name: get_organization_context(character varying); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_organization_context(p_org_slug character varying) RETURNS TABLE(org_id integer, org_name character varying, db_type character varying, is_active boolean)
    LANGUAGE sql
    AS $$
SELECT 
    id,
    org_name,
    database_type,
    is_active
FROM organizations
WHERE org_slug = p_org_slug
LIMIT 1
$$;


--
-- Name: get_supplier_config(character varying); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_supplier_config(p_supplier_name character varying) RETURNS TABLE(supplier_name character varying, enabled boolean, base_url text, api_key text, api_secret text, rate_limit_per_minute integer, timeout_seconds integer)
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN QUERY
    SELECT
        s.supplier_name,
        s.enabled,
        s.base_url,
        s.api_key,
        s.api_secret,
        s.rate_limit_per_minute,
        s.timeout_seconds
    FROM cns_supplier_settings s
    WHERE s.supplier_name = p_supplier_name;
END;
$$;


--
-- Name: FUNCTION get_supplier_config(p_supplier_name character varying); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_supplier_config(p_supplier_name character varying) IS 'Get supplier configuration for Python enrichment service';


--
-- Name: increment_component_usage(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.increment_component_usage(component_uuid uuid) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
    UPDATE component_catalog
    SET
        usage_count = usage_count + 1,
        last_used_at = NOW()
    WHERE id = component_uuid;
END;
$$;


--
-- Name: mark_expired_redis_components(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.mark_expired_redis_components() RETURNS integer
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_count INTEGER;
BEGIN
    UPDATE redis_component_snapshot
    SET sync_status = 'expired'
    WHERE sync_status = 'active'
      AND expires_at < NOW();

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;


--
-- Name: FUNCTION mark_expired_redis_components(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.mark_expired_redis_components() IS 'Mark Redis components as expired if TTL has passed';


--
-- Name: promote_redis_component_to_vault(uuid, boolean, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.promote_redis_component_to_vault(p_redis_snapshot_id uuid, p_override_quality boolean DEFAULT false, p_admin_notes text DEFAULT NULL::text) RETURNS boolean
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_component_data JSONB;
    v_quality_score NUMERIC;
    v_mpn TEXT;
    v_manufacturer TEXT;
BEGIN
    -- Get component data from snapshot
    SELECT component_data, quality_score, mpn, manufacturer
    INTO v_component_data, v_quality_score, v_mpn, v_manufacturer
    FROM redis_component_snapshot
    WHERE id = p_redis_snapshot_id
      AND sync_status = 'active';

    IF NOT FOUND THEN
        RAISE NOTICE 'Component snapshot not found or already promoted';
        RETURN FALSE;
    END IF;

    -- Check quality threshold (unless override)
    IF NOT p_override_quality AND v_quality_score < 80 THEN
        RAISE NOTICE 'Quality score (%) below threshold. Use override flag to force promotion.', v_quality_score;
        RETURN FALSE;
    END IF;

    -- Insert into component_catalog (vault)
    INSERT INTO component_catalog (
        id,
        manufacturer_part_number,
        manufacturer,
        category,
        subcategory,
        category_path,
        product_family,
        product_series,
        description,
        package,
        lifecycle_status,
        rohs_compliant,
        reach_compliant,
        halogen_free,
        aec_qualified,
        eccn_code,
        unit_price,
        currency,
        price_breaks,
        quality_score,
        datasheet_url,
        image_url,
        enrichment_source,
        created_at
    ) VALUES (
        gen_random_uuid(),
        v_mpn,
        v_manufacturer,
        v_component_data->>'category',
        v_component_data->>'subcategory',
        v_component_data->>'category_path',
        v_component_data->>'product_family',
        v_component_data->>'product_series',
        v_component_data->>'description',
        v_component_data->>'package',
        v_component_data->>'lifecycle_status',
        (v_component_data->>'rohs_compliant')::boolean,
        (v_component_data->>'reach_compliant')::boolean,
        (v_component_data->>'halogen_free')::boolean,
        (v_component_data->>'aec_qualified')::boolean,
        v_component_data->>'eccn_code',
        (v_component_data->>'unit_price')::numeric,
        v_component_data->>'currency',
        (v_component_data->'price_breaks')::jsonb,
        v_quality_score,
        v_component_data->>'datasheet_url',
        v_component_data->>'image_url',
        'manual_promotion',
        NOW()
    )
    ON CONFLICT (manufacturer_part_number, manufacturer) DO UPDATE SET
        quality_score = EXCLUDED.quality_score,
        updated_at = NOW();

    -- Mark snapshot as promoted
    UPDATE redis_component_snapshot
    SET sync_status = 'promoted',
        promotion_notes = p_admin_notes,
        last_synced_at = NOW()
    WHERE id = p_redis_snapshot_id;

    -- TODO: Delete from Redis (call Python script or use Redis function)

    RAISE NOTICE 'Component % promoted to vault (quality: %, override: %)',
        v_mpn, v_quality_score, p_override_quality;

    RETURN TRUE;
END;
$$;


--
-- Name: FUNCTION promote_redis_component_to_vault(p_redis_snapshot_id uuid, p_override_quality boolean, p_admin_notes text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.promote_redis_component_to_vault(p_redis_snapshot_id uuid, p_override_quality boolean, p_admin_notes text) IS 'Manually promote a Redis component to permanent vault storage';


--
-- Name: refresh_supplier_quality_summary(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.refresh_supplier_quality_summary() RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_supplier_quality_summary;
END;
$$;


--
-- Name: FUNCTION refresh_supplier_quality_summary(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.refresh_supplier_quality_summary() IS 'Refresh supplier quality materialized view (call from scheduled job)';


--
-- Name: release_redis_sync_lock(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.release_redis_sync_lock(p_worker_id text) RETURNS boolean
    LANGUAGE plpgsql
    AS $$
BEGIN
    DELETE FROM redis_sync_lock
    WHERE lock_name = 'redis_sync'
      AND locked_by = p_worker_id;

    RETURN FOUND;
END;
$$;


--
-- Name: FUNCTION release_redis_sync_lock(p_worker_id text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.release_redis_sync_lock(p_worker_id text) IS 'Release advisory lock for Redis sync. Only works if worker_id matches.';


--
-- Name: track_enrichment_config_changes(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.track_enrichment_config_changes() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Insert into history table
    INSERT INTO cns_enrichment_config_history (
        config_key,
        old_value,
        new_value,
        changed_by
    ) VALUES (
        NEW.config_key,
        OLD.config_value,
        NEW.config_value,
        COALESCE(NEW.updated_by, 'system')
    );

    -- Update timestamp
    NEW.updated_at = NOW();

    RETURN NEW;
END;
$$;


--
-- Name: update_component_catalog_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_component_catalog_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


--
-- Name: update_enrichment_config(text, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_enrichment_config(p_config_key text, p_new_value text, p_updated_by text DEFAULT 'system'::text, p_change_reason text DEFAULT NULL::text) RETURNS boolean
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_updated BOOLEAN;
BEGIN
    UPDATE cns_enrichment_config
    SET config_value = p_new_value,
        updated_by = p_updated_by,
        updated_at = NOW()
    WHERE config_key = p_config_key;

    GET DIAGNOSTICS v_updated = ROW_COUNT;

    -- Log reason if provided
    IF v_updated AND p_change_reason IS NOT NULL THEN
        UPDATE cns_enrichment_config_history
        SET change_reason = p_change_reason
        WHERE config_key = p_config_key
          AND changed_at = (
              SELECT MAX(changed_at)
              FROM cns_enrichment_config_history
              WHERE config_key = p_config_key
          );
    END IF;

    RETURN v_updated;
END;
$$;


--
-- Name: update_storage_tracking_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_storage_tracking_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


--
-- Name: update_supplier_quality_metrics(character varying, integer, numeric, numeric, numeric, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_supplier_quality_metrics(p_supplier_name character varying, p_avg_response_time_ms integer, p_avg_match_confidence numeric, p_avg_quality_score numeric, p_success_rate numeric, p_total_requests integer) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
    UPDATE cns_supplier_settings
    SET
        avg_response_time_ms = p_avg_response_time_ms,
        avg_match_confidence = p_avg_match_confidence,
        avg_quality_score = p_avg_quality_score,
        success_rate = p_success_rate,
        total_requests_30d = p_total_requests,
        updated_at = NOW()
    WHERE supplier_name = p_supplier_name;
END;
$$;


--
-- Name: FUNCTION update_supplier_quality_metrics(p_supplier_name character varying, p_avg_response_time_ms integer, p_avg_match_confidence numeric, p_avg_quality_score numeric, p_success_rate numeric, p_total_requests integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.update_supplier_quality_metrics(p_supplier_name character varying, p_avg_response_time_ms integer, p_avg_match_confidence numeric, p_avg_quality_score numeric, p_success_rate numeric, p_total_requests integer) IS 'Update supplier quality metrics from audit data (last 30 days)';


--
-- Name: update_supplier_quality_stats(date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_supplier_quality_stats(p_date date) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Aggregate enrichment stats by supplier for given date
    -- Filter out NULL supplier_name to prevent NOT NULL constraint violations
    INSERT INTO audit_supplier_quality (
        supplier_name,
        date,
        total_requests,
        successful_requests,
        failed_requests,
        avg_response_time_ms,
        avg_match_confidence,
        complete_responses,
        incomplete_responses,
        avg_quality_score
    )
    SELECT
        supplier_name,
        DATE(enrichment_timestamp) as date,
        COUNT(*) as total_requests,
        COUNT(*) FILTER (WHERE successful = TRUE) as successful_requests,
        COUNT(*) FILTER (WHERE successful = FALSE) as failed_requests,
        AVG(processing_time_ms)::integer as avg_response_time_ms,
        AVG(supplier_match_confidence) as avg_match_confidence,
        COUNT(*) FILTER (WHERE quality_score >= 80) as complete_responses,
        COUNT(*) FILTER (WHERE quality_score < 80) as incomplete_responses,
        AVG(quality_score) as avg_quality_score
    FROM audit_enrichment_runs
    WHERE DATE(enrichment_timestamp) = p_date
      AND supplier_name IS NOT NULL
    GROUP BY supplier_name, DATE(enrichment_timestamp)
    ON CONFLICT (supplier_name, date) DO UPDATE SET
        total_requests = EXCLUDED.total_requests,
        successful_requests = EXCLUDED.successful_requests,
        failed_requests = EXCLUDED.failed_requests,
        avg_response_time_ms = EXCLUDED.avg_response_time_ms,
        avg_match_confidence = EXCLUDED.avg_match_confidence,
        complete_responses = EXCLUDED.complete_responses,
        incomplete_responses = EXCLUDED.incomplete_responses,
        avg_quality_score = EXCLUDED.avg_quality_score,
        updated_at = NOW();
END;
$$;


--
-- Name: FUNCTION update_supplier_quality_stats(p_date date); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.update_supplier_quality_stats(p_date date) IS 'Aggregate daily supplier quality metrics from enrichment runs';


--
-- Name: update_supplier_settings_timestamp(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_supplier_settings_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


--
-- Name: update_vendor_sync_status(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_vendor_sync_status() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    UPDATE vendor_sync_status
    SET updated_at = CURRENT_TIMESTAMP
    WHERE vendor_id = NEW.vendor_id;
    RETURN NEW;
END;
$$;


--
-- Name: validate_enrichment_config(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_enrichment_config() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Validate integer range
    IF NEW.value_type = 'integer' THEN
        IF NEW.min_value IS NOT NULL AND NEW.config_value::INTEGER < NEW.min_value THEN
            RAISE EXCEPTION 'Config value % is below minimum %', NEW.config_value, NEW.min_value;
        END IF;
        IF NEW.max_value IS NOT NULL AND NEW.config_value::INTEGER > NEW.max_value THEN
            RAISE EXCEPTION 'Config value % is above maximum %', NEW.config_value, NEW.max_value;
        END IF;
    END IF;

    -- Validate float range
    IF NEW.value_type = 'float' THEN
        IF NEW.min_value IS NOT NULL AND NEW.config_value::NUMERIC < NEW.min_value THEN
            RAISE EXCEPTION 'Config value % is below minimum %', NEW.config_value, NEW.min_value;
        END IF;
        IF NEW.max_value IS NOT NULL AND NEW.config_value::NUMERIC > NEW.max_value THEN
            RAISE EXCEPTION 'Config value % is above maximum %', NEW.config_value, NEW.max_value;
        END IF;
    END IF;

    -- Validate boolean
    IF NEW.value_type = 'boolean' THEN
        IF NEW.config_value NOT IN ('true', 'false', 't', 'f', '1', '0', 'yes', 'no') THEN
            RAISE EXCEPTION 'Config value % is not a valid boolean', NEW.config_value;
        END IF;
        -- Normalize to 'true'/'false'
        NEW.config_value = CASE
            WHEN NEW.config_value IN ('true', 't', '1', 'yes') THEN 'true'
            ELSE 'false'
        END;
    END IF;

    RETURN NEW;
END;
$$;


--
-- Name: ai_prompts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_prompts (
    id uuid NOT NULL,
    sort integer,
    date_created timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    user_created uuid,
    date_updated timestamp with time zone,
    user_updated uuid,
    name character varying(255),
    status character varying(255) DEFAULT 'draft'::character varying,
    description text,
    system_prompt text,
    messages json
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
    enrichment_timestamp timestamp with time zone DEFAULT now(),
    successful boolean NOT NULL,
    quality_score numeric(5,2),
    storage_location text,
    supplier_name text,
    supplier_match_confidence numeric(5,2),
    processing_time_ms integer,
    retry_count integer DEFAULT 0,
    error_message text,
    has_field_changes boolean DEFAULT false,
    needs_review boolean DEFAULT false,
    reviewed_by text,
    reviewed_at timestamp with time zone,
    review_notes text,
    created_at timestamp with time zone DEFAULT now(),
    name character varying(255),
    description text,
    system_prompt text,
    messages json
);


--
-- Name: TABLE audit_enrichment_runs; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.audit_enrichment_runs IS 'Master table tracking each component enrichment run with quality metrics';


--
-- Name: COLUMN audit_enrichment_runs.needs_review; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.audit_enrichment_runs.needs_review IS 'Flagged for manual review in Directus if data quality issues detected';


--
-- Name: audit_field_comparisons; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_field_comparisons (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    enrichment_run_id uuid,
    field_name text NOT NULL,
    field_category text,
    supplier_value text,
    normalized_value text,
    changed boolean NOT NULL,
    change_type text,
    change_reason text,
    confidence numeric(5,2),
    supplier_data_quality text,
    normalization_applied boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    name character varying(255),
    description text,
    system_prompt text,
    messages json
);


--
-- Name: TABLE audit_field_comparisons; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.audit_field_comparisons IS 'Field-by-field comparison of supplier data vs normalized data';


--
-- Name: COLUMN audit_field_comparisons.change_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.audit_field_comparisons.change_type IS 'Type of normalization: cleaned (whitespace), mapped (value transformation), extracted (parsed), unchanged, missing';


--
-- Name: audit_needs_review; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.audit_needs_review AS
 SELECT aer.id,
    aer.mpn,
    aer.manufacturer,
    aer.supplier_name,
    aer.quality_score,
    aer.enrichment_timestamp,
    count(afc.id) FILTER (WHERE (afc.changed = true)) AS fields_changed,
    count(afc.id) FILTER (WHERE (afc.supplier_data_quality = 'missing'::text)) AS fields_missing
   FROM (public.audit_enrichment_runs aer
     LEFT JOIN public.audit_field_comparisons afc ON ((afc.enrichment_run_id = aer.id)))
  WHERE ((aer.needs_review = true) AND (aer.reviewed_at IS NULL))
  GROUP BY aer.id, aer.mpn, aer.manufacturer, aer.supplier_name, aer.quality_score, aer.enrichment_timestamp
  ORDER BY aer.enrichment_timestamp DESC;


--
-- Name: VIEW audit_needs_review; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON VIEW public.audit_needs_review IS 'Components flagged for manual quality review in Directus';


--
-- Name: audit_supplier_quality; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_supplier_quality (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    supplier_name text NOT NULL,
    date date DEFAULT CURRENT_DATE NOT NULL,
    total_requests integer DEFAULT 0,
    successful_requests integer DEFAULT 0,
    failed_requests integer DEFAULT 0,
    avg_response_time_ms integer,
    avg_match_confidence numeric(5,2),
    complete_responses integer DEFAULT 0,
    incomplete_responses integer DEFAULT 0,
    avg_fields_returned numeric(5,2),
    avg_quality_score numeric(5,2),
    common_missing_fields text[],
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE audit_supplier_quality; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.audit_supplier_quality IS 'Daily aggregate statistics for supplier API quality and reliability';


--
-- Name: audit_supplier_comparison; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.audit_supplier_comparison AS
 SELECT audit_supplier_quality.supplier_name,
    count(*) AS total_enrichments,
    avg((((audit_supplier_quality.successful_requests)::numeric / (NULLIF(audit_supplier_quality.total_requests, 0))::numeric) * (100)::numeric)) AS success_rate,
    avg(audit_supplier_quality.avg_response_time_ms) AS avg_response_time,
    avg(audit_supplier_quality.avg_match_confidence) AS avg_confidence,
    avg(audit_supplier_quality.avg_quality_score) AS avg_quality_score,
    sum(audit_supplier_quality.complete_responses) AS complete_responses,
    sum(audit_supplier_quality.incomplete_responses) AS incomplete_responses
   FROM public.audit_supplier_quality
  WHERE (audit_supplier_quality.date >= (CURRENT_DATE - '30 days'::interval))
  GROUP BY audit_supplier_quality.supplier_name
  ORDER BY (avg(audit_supplier_quality.avg_quality_score)) DESC NULLS LAST;


--
-- Name: VIEW audit_supplier_comparison; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON VIEW public.audit_supplier_comparison IS '30-day supplier quality comparison for Directus dashboard';


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
    status character varying(50) DEFAULT 'pending'::character varying NOT NULL,
    progress integer DEFAULT 0 NOT NULL,
    items_processed integer DEFAULT 0 NOT NULL,
    items_auto_approved integer DEFAULT 0 NOT NULL,
    items_in_staging integer DEFAULT 0 NOT NULL,
    items_rejected integer DEFAULT 0 NOT NULL,
    items_failed integer DEFAULT 0 NOT NULL,
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    processing_time_ms integer,
    error_message text,
    results_data jsonb,
    organization_id integer,
    project_id integer,
    source character varying(50) DEFAULT 'customer'::character varying,
    source_metadata jsonb,
    priority integer DEFAULT 5,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
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
-- Name: bom_queue_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bom_queue_config (
    id integer NOT NULL,
    queue_name character varying(100) NOT NULL,
    redis_stream_name character varying(255),
    max_retries integer DEFAULT 3,
    timeout_seconds integer DEFAULT 300,
    enabled boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: bom_queue_config_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.bom_queue_config_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: bom_queue_config_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.bom_queue_config_id_seq OWNED BY public.bom_queue_config.id;


--
-- Name: catalog_categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.catalog_categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    slug character varying(255),
    description text,
    parent_id uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: catalog_category_mappings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.catalog_category_mappings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    vendor_name character varying(100) NOT NULL,
    vendor_category character varying(255) NOT NULL,
    normalized_category_id uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: catalog_component_manufacturers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.catalog_component_manufacturers (
    component_id uuid NOT NULL,
    manufacturer_id uuid NOT NULL
);


--
-- Name: catalog_components; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.catalog_components (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    mpn character varying(255) NOT NULL,
    manufacturer character varying(255),
    normalized_mpn character varying(255),
    normalized_manufacturer character varying(255),
    description text,
    category character varying(255),
    subcategory character varying(255),
    category_path text,
    product_family character varying(255),
    product_series character varying(255),
    datasheet_url text,
    image_url text,
    lifecycle_status character varying(50),
    package character varying(100),
    unit_price numeric,
    currency character varying(10),
    price_breaks jsonb,
    moq integer,
    lead_time_days integer,
    stock_status character varying(50),
    supplier_data jsonb,
    specifications jsonb,
    extracted_specs jsonb,
    quality_score numeric,
    quality_metadata jsonb,
    ai_metadata jsonb,
    rohs_compliant boolean,
    reach_compliant boolean,
    halogen_free boolean,
    aec_qualified boolean,
    eccn_code character varying(50),
    enrichment_source character varying(50),
    api_source character varying(50),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: catalog_manufacturers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.catalog_manufacturers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    normalized_name character varying(255),
    website text,
    supplier_codes jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.categories (
    id integer NOT NULL,
    name text NOT NULL,
    parent_id integer,
    digikey_id integer NOT NULL,
    level integer NOT NULL,
    path text NOT NULL,
    product_count integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: categories_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.categories_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: categories_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.categories_id_seq OWNED BY public.categories.id;


--
-- Name: category_snapshot_audit; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.category_snapshot_audit (
    id bigint NOT NULL,
    run_started timestamp with time zone NOT NULL,
    run_completed timestamp with time zone NOT NULL,
    source_path text NOT NULL,
    truncated boolean DEFAULT false NOT NULL,
    rows_before bigint NOT NULL,
    rows_after bigint NOT NULL,
    rows_delta bigint NOT NULL,
    rows_flattened bigint NOT NULL,
    note text
);


--
-- Name: TABLE category_snapshot_audit; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.category_snapshot_audit IS 'Audit trail for category snapshot loader runs';


--
-- Name: COLUMN category_snapshot_audit.run_started; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.category_snapshot_audit.run_started IS 'When the snapshot load started';


--
-- Name: COLUMN category_snapshot_audit.run_completed; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.category_snapshot_audit.run_completed IS 'When the snapshot load completed';


--
-- Name: COLUMN category_snapshot_audit.source_path; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.category_snapshot_audit.source_path IS 'Path to source JSON file';


--
-- Name: COLUMN category_snapshot_audit.truncated; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.category_snapshot_audit.truncated IS 'Whether the table was truncated before load';


--
-- Name: COLUMN category_snapshot_audit.rows_before; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.category_snapshot_audit.rows_before IS 'Row count before snapshot load';


--
-- Name: COLUMN category_snapshot_audit.rows_after; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.category_snapshot_audit.rows_after IS 'Row count after snapshot load';


--
-- Name: COLUMN category_snapshot_audit.rows_delta; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.category_snapshot_audit.rows_delta IS 'Change in row count (after - before)';


--
-- Name: COLUMN category_snapshot_audit.rows_flattened; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.category_snapshot_audit.rows_flattened IS 'Number of categories flattened from source';


--
-- Name: COLUMN category_snapshot_audit.note; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.category_snapshot_audit.note IS 'Optional note about this run';


--
-- Name: category_snapshot_audit_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.category_snapshot_audit_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: category_snapshot_audit_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.category_snapshot_audit_id_seq OWNED BY public.category_snapshot_audit.id;


--
-- Name: category_source_snapshot; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.category_source_snapshot (
    source_id bigint NOT NULL,
    parent_id bigint,
    name text NOT NULL,
    depth integer NOT NULL,
    path text NOT NULL,
    product_count integer,
    raw_payload jsonb NOT NULL,
    ingested_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: cns_cache_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cns_cache_config (
    id integer NOT NULL,
    cache_type character varying(100) NOT NULL,
    redis_key_pattern character varying(255),
    ttl_seconds integer DEFAULT 3600,
    max_size_mb integer DEFAULT 100,
    enabled boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: cns_cache_config_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.cns_cache_config_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: cns_cache_config_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.cns_cache_config_id_seq OWNED BY public.cns_cache_config.id;


--
-- Name: cns_enrichment_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cns_enrichment_config (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    config_key text NOT NULL,
    config_value text NOT NULL,
    value_type text NOT NULL,
    category text NOT NULL,
    description text NOT NULL,
    default_value text NOT NULL,
    min_value numeric,
    max_value numeric,
    requires_restart boolean DEFAULT false,
    deprecated boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    updated_by text,
    notes text,
    CONSTRAINT cns_enrichment_config_category_check CHECK ((category = ANY (ARRAY['enrichment'::text, 'quality'::text, 'ai'::text, 'performance'::text, 'storage'::text, 'audit'::text]))),
    CONSTRAINT cns_enrichment_config_value_type_check CHECK ((value_type = ANY (ARRAY['string'::text, 'integer'::text, 'boolean'::text, 'float'::text, 'json'::text])))
);


--
-- Name: TABLE cns_enrichment_config; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.cns_enrichment_config IS 'Runtime enrichment configuration managed via Directus UI';


--
-- Name: COLUMN cns_enrichment_config.requires_restart; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.cns_enrichment_config.requires_restart IS 'Whether changing this config requires service restart';


--
-- Name: COLUMN cns_enrichment_config.deprecated; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.cns_enrichment_config.deprecated IS 'Whether this config is deprecated (hidden in UI)';


--
-- Name: cns_enrichment_config_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cns_enrichment_config_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    config_key text NOT NULL,
    old_value text,
    new_value text NOT NULL,
    changed_by text NOT NULL,
    changed_at timestamp with time zone DEFAULT now(),
    change_reason text,
    ip_address text
);


--
-- Name: TABLE cns_enrichment_config_history; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.cns_enrichment_config_history IS 'Audit trail of enrichment configuration changes';


--
-- Name: cns_supplier_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cns_supplier_settings (
    id integer NOT NULL,
    supplier_name character varying(50) NOT NULL,
    display_name character varying(100),
    supplier_url character varying(255),
    enabled boolean DEFAULT true,
    priority integer DEFAULT 0,
    api_key text,
    api_secret text,
    base_url text NOT NULL,
    rate_limit_per_minute integer,
    timeout_seconds integer DEFAULT 10,
    supports_parametric_search boolean DEFAULT false,
    supports_lifecycle_data boolean DEFAULT true,
    supports_compliance_data boolean DEFAULT true,
    supports_pricing_breaks boolean DEFAULT true,
    avg_response_time_ms integer,
    avg_match_confidence numeric(5,2),
    avg_quality_score numeric(5,2),
    success_rate numeric(5,2),
    total_requests_30d integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    created_by text,
    notes text
);


--
-- Name: TABLE cns_supplier_settings; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.cns_supplier_settings IS 'Supplier API configuration managed via Directus UI (replaces hardcoded config.py settings)';


--
-- Name: COLUMN cns_supplier_settings.priority; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.cns_supplier_settings.priority IS 'Try suppliers in order: 1=first, 2=second, etc. (0=disabled)';


--
-- Name: COLUMN cns_supplier_settings.api_key; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.cns_supplier_settings.api_key IS 'Encrypted API key - handled by application';


--
-- Name: cns_supplier_settings_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.cns_supplier_settings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: cns_supplier_settings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.cns_supplier_settings_id_seq OWNED BY public.cns_supplier_settings.id;


--
-- Name: component_lifecycle; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.component_lifecycle (
    id integer NOT NULL,
    component_id integer,
    lifecycle_status character varying(50) NOT NULL,
    status_effective_date date NOT NULL,
    expected_discontinuation_date date,
    last_order_date date,
    suggested_replacement_component_id integer,
    supplier_notification_date date,
    internal_notification_sent boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: component_lifecycle_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.component_lifecycle_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: component_lifecycle_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.component_lifecycle_id_seq OWNED BY public.component_lifecycle.id;


--
-- Name: component_pricing_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.component_pricing_history (
    id integer NOT NULL,
    component_id integer,
    supplier_id character varying(50) NOT NULL,
    quantity_tier integer NOT NULL,
    unit_price numeric(12,4) NOT NULL,
    currency character varying(3) DEFAULT 'USD'::character varying,
    effective_date timestamp without time zone NOT NULL,
    expiration_date timestamp without time zone,
    is_current boolean DEFAULT false,
    price_change_percentage numeric(5,2),
    previous_price numeric(12,4),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: component_pricing_history_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.component_pricing_history_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: component_pricing_history_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.component_pricing_history_id_seq OWNED BY public.component_pricing_history.id;


--
-- Name: component_stock_levels; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.component_stock_levels (
    id integer NOT NULL,
    component_id integer,
    supplier_id character varying(50) NOT NULL,
    stock_quantity integer DEFAULT 0,
    warehouse_location character varying(100),
    min_stock_level integer DEFAULT 10,
    max_stock_level integer DEFAULT 1000,
    reorder_point integer DEFAULT 100,
    lead_time_days integer DEFAULT 0,
    last_updated timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    next_update_scheduled timestamp without time zone
);


--
-- Name: component_stock_levels_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.component_stock_levels_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: component_stock_levels_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.component_stock_levels_id_seq OWNED BY public.component_stock_levels.id;


--
-- Name: component_storage_tracking; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.component_storage_tracking (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    manufacturer_part_number text NOT NULL,
    manufacturer text NOT NULL,
    line_id text NOT NULL,
    storage_location text NOT NULL,
    component_catalog_id uuid,
    redis_key text,
    quality_score numeric(5,2),
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    redis_ttl_seconds integer DEFAULT 259200,
    expires_at timestamp with time zone,
    CONSTRAINT component_storage_tracking_storage_location_check CHECK ((storage_location = ANY (ARRAY['database'::text, 'redis'::text])))
);


--
-- Name: TABLE component_storage_tracking; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.component_storage_tracking IS 'Tracks storage location (database vs Redis) for each enriched component.
Used to route lookups and manage Redis TTL for low-quality components.';


--
-- Name: COLUMN component_storage_tracking.line_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.component_storage_tracking.line_id IS 'Unique identifier for the BOM line item (not the BOM line item UUID)';


--
-- Name: COLUMN component_storage_tracking.quality_score; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.component_storage_tracking.quality_score IS 'Quality score (0-100) that determined storage routing:
>= 80: database (permanent)
< 80: redis (temporary, 72hr TTL)';


--
-- Name: component_substitution_rules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.component_substitution_rules (
    id integer NOT NULL,
    primary_component_id integer,
    substitute_component_id integer,
    compatibility_score numeric(3,2) DEFAULT 1.0,
    notes text,
    is_approved boolean DEFAULT false,
    approved_by character varying(100),
    approved_date timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: component_substitution_rules_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.component_substitution_rules_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: component_substitution_rules_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.component_substitution_rules_id_seq OWNED BY public.component_substitution_rules.id;


--
-- Name: directus_access; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.directus_access (
    id uuid NOT NULL,
    role uuid,
    "user" uuid,
    policy uuid NOT NULL,
    sort integer
);


--
-- Name: directus_activity; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.directus_activity (
    id integer NOT NULL,
    action character varying(45) NOT NULL,
    "user" uuid,
    "timestamp" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    ip character varying(50),
    user_agent text,
    collection character varying(64) NOT NULL,
    item character varying(255) NOT NULL,
    origin character varying(255)
);


--
-- Name: directus_activity_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.directus_activity_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: directus_activity_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.directus_activity_id_seq OWNED BY public.directus_activity.id;


--
-- Name: directus_cache_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.directus_cache_config (
    id integer NOT NULL,
    collection_name character varying(255) NOT NULL,
    redis_namespace character varying(100),
    cache_ttl_seconds integer DEFAULT 3600,
    sync_on_update boolean DEFAULT true,
    enabled boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: directus_cache_config_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.directus_cache_config_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: directus_cache_config_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.directus_cache_config_id_seq OWNED BY public.directus_cache_config.id;


--
-- Name: directus_collections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.directus_collections (
    collection character varying(64) NOT NULL,
    icon character varying(64),
    note text,
    display_template character varying(255),
    hidden boolean DEFAULT false NOT NULL,
    singleton boolean DEFAULT false NOT NULL,
    translations json,
    archive_field character varying(64),
    archive_app_filter boolean DEFAULT true NOT NULL,
    archive_value character varying(255),
    unarchive_value character varying(255),
    sort_field character varying(64),
    accountability character varying(255) DEFAULT 'all'::character varying,
    color character varying(255),
    item_duplication_fields json,
    sort integer,
    "group" character varying(64),
    collapse character varying(255) DEFAULT 'open'::character varying NOT NULL,
    preview_url character varying(255),
    versioning boolean DEFAULT false NOT NULL
);


--
-- Name: directus_comments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.directus_comments (
    id uuid NOT NULL,
    collection character varying(64) NOT NULL,
    item character varying(255) NOT NULL,
    comment text NOT NULL,
    date_created timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    date_updated timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    user_created uuid,
    user_updated uuid
);


--
-- Name: redis_component_snapshot; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.redis_component_snapshot (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    redis_key text NOT NULL,
    line_id text NOT NULL,
    mpn text,
    manufacturer text,
    quality_score numeric(5,2),
    component_data jsonb NOT NULL,
    storage_ttl_seconds integer,
    expires_at timestamp with time zone,
    reason_for_redis text,
    can_promote boolean DEFAULT true,
    promotion_notes text,
    last_synced_at timestamp with time zone DEFAULT now(),
    sync_status text DEFAULT 'active'::text,
    created_at timestamp with time zone DEFAULT now(),
    name character varying(255),
    description text,
    system_prompt text,
    messages json
);


--
-- Name: TABLE redis_component_snapshot; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.redis_component_snapshot IS 'Snapshot of components stored in Redis (temporary, low-quality) for Directus visibility';


--
-- Name: COLUMN redis_component_snapshot.can_promote; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.redis_component_snapshot.can_promote IS 'Whether admin can manually promote this component to permanent storage';


--
-- Name: directus_redis_components; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.directus_redis_components AS
 SELECT redis_component_snapshot.id,
    redis_component_snapshot.mpn,
    redis_component_snapshot.manufacturer,
    redis_component_snapshot.quality_score,
    'redis'::text AS storage_location,
        CASE
            WHEN (redis_component_snapshot.sync_status = 'expired'::text) THEN '🔴 Expired'::text
            WHEN (redis_component_snapshot.expires_at < now()) THEN '🔴 Expired'::text
            WHEN (redis_component_snapshot.expires_at < (now() + '24:00:00'::interval)) THEN '🟡 Expiring Soon'::text
            ELSE '🟠 Temporary'::text
        END AS storage_status,
    redis_component_snapshot.expires_at,
    (EXTRACT(epoch FROM (redis_component_snapshot.expires_at - now())) / (3600)::numeric) AS ttl_hours,
    false AS is_permanent,
    redis_component_snapshot.reason_for_redis,
    redis_component_snapshot.can_promote,
    redis_component_snapshot.promotion_notes,
    redis_component_snapshot.sync_status,
    redis_component_snapshot.created_at,
    redis_component_snapshot.last_synced_at AS updated_at,
    redis_component_snapshot.component_data
   FROM public.redis_component_snapshot
  WHERE (redis_component_snapshot.sync_status = ANY (ARRAY['active'::text, 'expired'::text]));


--
-- Name: VIEW directus_redis_components; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON VIEW public.directus_redis_components IS 'Redis components view for Directus dashboard (Directus-only)';


--
-- Name: directus_component_unified; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.directus_component_unified AS
 SELECT component_catalog.id,
    component_catalog.manufacturer_part_number AS mpn,
    component_catalog.manufacturer,
    component_catalog.quality_score,
    'database'::text AS storage_location,
    '🟢 Permanent'::text AS storage_status,
    NULL::timestamp with time zone AS expires_at,
    NULL::numeric AS ttl_hours,
    true AS is_permanent,
    NULL::text AS reason_for_redis,
    true AS can_promote,
    NULL::text AS promotion_notes,
    'stored'::text AS sync_status,
    component_catalog.created_at,
    component_catalog.updated_at,
    jsonb_build_object('category', component_catalog.category, 'subcategory', component_catalog.subcategory, 'description', component_catalog.description, 'datasheet_url', component_catalog.datasheet_url, 'image_url', component_catalog.image_url, 'lifecycle_status', component_catalog.lifecycle_status, 'rohs_compliant', component_catalog.rohs_compliant, 'reach_compliant', component_catalog.reach_compliant, 'aec_qualified', component_catalog.aec_qualified, 'halogen_free', component_catalog.halogen_free, 'unit_price', component_catalog.unit_price, 'currency', component_catalog.currency, 'stock_status', component_catalog.stock_status, 'stock_quantity', component_catalog.stock_quantity, 'packaging', component_catalog.packaging, 'minimum_order_quantity', component_catalog.minimum_order_quantity, 'eccn_code', component_catalog.eccn_code, 'hts_code', component_catalog.hts_code, 'supplier_part_number', component_catalog.supplier_part_number, 'supplier_name', component_catalog.supplier_name, 'enrichment_source', component_catalog.enrichment_source, 'enrichment_version', component_catalog.enrichment_version, 'last_enriched_at', component_catalog.last_enriched_at, 'quality_metadata', component_catalog.quality_metadata, 'supplier_data', component_catalog.supplier_data, 'parameters', component_catalog.parameters) AS component_data
   FROM public.component_catalog
UNION ALL
 SELECT directus_redis_components.id,
    directus_redis_components.mpn,
    directus_redis_components.manufacturer,
    directus_redis_components.quality_score,
    directus_redis_components.storage_location,
    directus_redis_components.storage_status,
    directus_redis_components.expires_at,
    directus_redis_components.ttl_hours,
    directus_redis_components.is_permanent,
    directus_redis_components.reason_for_redis,
    directus_redis_components.can_promote,
    directus_redis_components.promotion_notes,
    directus_redis_components.sync_status,
    directus_redis_components.created_at,
    directus_redis_components.updated_at,
    directus_redis_components.component_data
   FROM public.directus_redis_components;


--
-- Name: VIEW directus_component_unified; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON VIEW public.directus_component_unified IS 'Unified Directus view showing permanent (database) and temporary (Redis) components.';


--
-- Name: directus_dashboards; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.directus_dashboards (
    id uuid NOT NULL,
    name character varying(255) NOT NULL,
    icon character varying(64) DEFAULT 'dashboard'::character varying NOT NULL,
    note text,
    date_created timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    user_created uuid,
    color character varying(255)
);


--
-- Name: directus_extensions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.directus_extensions (
    enabled boolean DEFAULT true NOT NULL,
    id uuid NOT NULL,
    folder character varying(255) NOT NULL,
    source character varying(255) NOT NULL,
    bundle uuid
);


--
-- Name: directus_fields; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.directus_fields (
    id integer NOT NULL,
    collection character varying(64) NOT NULL,
    field character varying(64) NOT NULL,
    special character varying(64),
    interface character varying(64),
    options json,
    display character varying(64),
    display_options json,
    readonly boolean DEFAULT false NOT NULL,
    hidden boolean DEFAULT false NOT NULL,
    sort integer,
    width character varying(30) DEFAULT 'full'::character varying,
    translations json,
    note text,
    conditions json,
    required boolean DEFAULT false,
    "group" character varying(64),
    validation json,
    validation_message text,
    searchable boolean DEFAULT true NOT NULL
);


--
-- Name: directus_fields_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.directus_fields_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: directus_fields_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.directus_fields_id_seq OWNED BY public.directus_fields.id;


--
-- Name: directus_files; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.directus_files (
    id uuid NOT NULL,
    storage character varying(255) NOT NULL,
    filename_disk character varying(255),
    filename_download character varying(255) NOT NULL,
    title character varying(255),
    type character varying(255),
    folder uuid,
    uploaded_by uuid,
    created_on timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    modified_by uuid,
    modified_on timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    charset character varying(50),
    filesize bigint,
    width integer,
    height integer,
    duration integer,
    embed character varying(200),
    description text,
    location text,
    tags text,
    metadata json,
    focal_point_x integer,
    focal_point_y integer,
    tus_id character varying(64),
    tus_data json,
    uploaded_on timestamp with time zone
);


--
-- Name: directus_flows; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.directus_flows (
    id uuid NOT NULL,
    name character varying(255) NOT NULL,
    icon character varying(64),
    color character varying(255),
    description text,
    status character varying(255) DEFAULT 'active'::character varying NOT NULL,
    trigger character varying(255),
    accountability character varying(255) DEFAULT 'all'::character varying,
    options json,
    operation uuid,
    date_created timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    user_created uuid
);


--
-- Name: directus_folders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.directus_folders (
    id uuid NOT NULL,
    name character varying(255) NOT NULL,
    parent uuid
);


--
-- Name: directus_migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.directus_migrations (
    version character varying(255) NOT NULL,
    name character varying(255) NOT NULL,
    "timestamp" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: directus_notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.directus_notifications (
    id integer NOT NULL,
    "timestamp" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    status character varying(255) DEFAULT 'inbox'::character varying,
    recipient uuid NOT NULL,
    sender uuid,
    subject character varying(255) NOT NULL,
    message text,
    collection character varying(64),
    item character varying(255)
);


--
-- Name: directus_notifications_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.directus_notifications_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: directus_notifications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.directus_notifications_id_seq OWNED BY public.directus_notifications.id;


--
-- Name: directus_operations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.directus_operations (
    id uuid NOT NULL,
    name character varying(255),
    key character varying(255) NOT NULL,
    type character varying(255) NOT NULL,
    position_x integer NOT NULL,
    position_y integer NOT NULL,
    options json,
    resolve uuid,
    reject uuid,
    flow uuid NOT NULL,
    date_created timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    user_created uuid
);


--
-- Name: directus_panels; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.directus_panels (
    id uuid NOT NULL,
    dashboard uuid NOT NULL,
    name character varying(255),
    icon character varying(64) DEFAULT NULL::character varying,
    color character varying(10),
    show_header boolean DEFAULT false NOT NULL,
    note text,
    type character varying(255) NOT NULL,
    position_x integer NOT NULL,
    position_y integer NOT NULL,
    width integer NOT NULL,
    height integer NOT NULL,
    options json,
    date_created timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    user_created uuid
);


--
-- Name: directus_permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.directus_permissions (
    id integer NOT NULL,
    collection character varying(64) NOT NULL,
    action character varying(10) NOT NULL,
    permissions json,
    validation json,
    presets json,
    fields text,
    policy uuid NOT NULL
);


--
-- Name: directus_permissions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.directus_permissions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: directus_permissions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.directus_permissions_id_seq OWNED BY public.directus_permissions.id;


--
-- Name: directus_policies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.directus_policies (
    id uuid NOT NULL,
    name character varying(100) NOT NULL,
    icon character varying(64) DEFAULT 'badge'::character varying NOT NULL,
    description text,
    ip_access text,
    enforce_tfa boolean DEFAULT false NOT NULL,
    admin_access boolean DEFAULT false NOT NULL,
    app_access boolean DEFAULT false NOT NULL
);


--
-- Name: directus_presets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.directus_presets (
    id integer NOT NULL,
    bookmark character varying(255),
    "user" uuid,
    role uuid,
    collection character varying(64),
    search character varying(100),
    layout character varying(100) DEFAULT 'tabular'::character varying,
    layout_query json,
    layout_options json,
    refresh_interval integer,
    filter json,
    icon character varying(64) DEFAULT 'bookmark'::character varying,
    color character varying(255)
);


--
-- Name: directus_presets_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.directus_presets_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: directus_presets_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.directus_presets_id_seq OWNED BY public.directus_presets.id;


--
-- Name: directus_redis_stats; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.directus_redis_stats AS
 SELECT redis_component_snapshot.sync_status,
        CASE
            WHEN (redis_component_snapshot.sync_status = 'expired'::text) THEN '🔴 Expired'::text
            WHEN (redis_component_snapshot.expires_at < now()) THEN '🔴 Expired'::text
            WHEN (redis_component_snapshot.expires_at < (now() + '24:00:00'::interval)) THEN '🟡 Expiring Soon'::text
            ELSE '🟠 Temporary'::text
        END AS storage_status,
    count(*) AS component_count,
    avg(redis_component_snapshot.quality_score) AS avg_quality_score,
    min(redis_component_snapshot.quality_score) AS min_quality_score,
    max(redis_component_snapshot.quality_score) AS max_quality_score,
    count(*) FILTER (WHERE (redis_component_snapshot.expires_at < (now() + '24:00:00'::interval))) AS expiring_soon_count,
    count(*) FILTER (WHERE (redis_component_snapshot.can_promote = true)) AS can_promote_count
   FROM public.redis_component_snapshot
  WHERE (redis_component_snapshot.sync_status = ANY (ARRAY['active'::text, 'expired'::text]))
  GROUP BY redis_component_snapshot.sync_status,
        CASE
            WHEN (redis_component_snapshot.sync_status = 'expired'::text) THEN '🔴 Expired'::text
            WHEN (redis_component_snapshot.expires_at < now()) THEN '🔴 Expired'::text
            WHEN (redis_component_snapshot.expires_at < (now() + '24:00:00'::interval)) THEN '🟡 Expiring Soon'::text
            ELSE '🟠 Temporary'::text
        END;


--
-- Name: VIEW directus_redis_stats; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON VIEW public.directus_redis_stats IS 'Redis storage statistics for Directus dashboard';


--
-- Name: directus_relations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.directus_relations (
    id integer NOT NULL,
    many_collection character varying(64) NOT NULL,
    many_field character varying(64) NOT NULL,
    one_collection character varying(64),
    one_field character varying(64),
    one_collection_field character varying(64),
    one_allowed_collections text,
    junction_field character varying(64),
    sort_field character varying(64),
    one_deselect_action character varying(255) DEFAULT 'nullify'::character varying NOT NULL
);


--
-- Name: directus_relations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.directus_relations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: directus_relations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.directus_relations_id_seq OWNED BY public.directus_relations.id;


--
-- Name: directus_revisions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.directus_revisions (
    id integer NOT NULL,
    activity integer NOT NULL,
    collection character varying(64) NOT NULL,
    item character varying(255) NOT NULL,
    data json,
    delta json,
    parent integer,
    version uuid
);


--
-- Name: directus_revisions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.directus_revisions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: directus_revisions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.directus_revisions_id_seq OWNED BY public.directus_revisions.id;


--
-- Name: directus_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.directus_roles (
    id uuid NOT NULL,
    name character varying(100) NOT NULL,
    icon character varying(64) DEFAULT 'supervised_user_circle'::character varying NOT NULL,
    description text,
    parent uuid
);


--
-- Name: directus_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.directus_sessions (
    token character varying(64) NOT NULL,
    "user" uuid,
    expires timestamp with time zone NOT NULL,
    ip character varying(255),
    user_agent text,
    share uuid,
    origin character varying(255),
    next_token character varying(64)
);


--
-- Name: directus_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.directus_settings (
    id integer NOT NULL,
    project_name character varying(100) DEFAULT 'Directus'::character varying NOT NULL,
    project_url character varying(255),
    project_color character varying(255) DEFAULT '#6644FF'::character varying NOT NULL,
    project_logo uuid,
    public_foreground uuid,
    public_background uuid,
    public_note text,
    auth_login_attempts integer DEFAULT 25,
    auth_password_policy character varying(100),
    storage_asset_transform character varying(7) DEFAULT 'all'::character varying,
    storage_asset_presets json,
    custom_css text,
    storage_default_folder uuid,
    basemaps json,
    mapbox_key character varying(255),
    module_bar json,
    project_descriptor character varying(100),
    default_language character varying(255) DEFAULT 'en-US'::character varying NOT NULL,
    custom_aspect_ratios json,
    public_favicon uuid,
    default_appearance character varying(255) DEFAULT 'auto'::character varying NOT NULL,
    default_theme_light character varying(255),
    theme_light_overrides json,
    default_theme_dark character varying(255),
    theme_dark_overrides json,
    report_error_url character varying(255),
    report_bug_url character varying(255),
    report_feature_url character varying(255),
    public_registration boolean DEFAULT false NOT NULL,
    public_registration_verify_email boolean DEFAULT true NOT NULL,
    public_registration_role uuid,
    public_registration_email_filter json,
    visual_editor_urls json,
    project_id uuid,
    mcp_enabled boolean DEFAULT false NOT NULL,
    mcp_allow_deletes boolean DEFAULT false NOT NULL,
    mcp_prompts_collection character varying(255) DEFAULT NULL::character varying,
    mcp_system_prompt_enabled boolean DEFAULT true NOT NULL,
    mcp_system_prompt text,
    project_owner character varying(255),
    project_usage character varying(255),
    org_name character varying(255),
    product_updates boolean,
    project_status character varying(255)
);


--
-- Name: directus_settings_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.directus_settings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: directus_settings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.directus_settings_id_seq OWNED BY public.directus_settings.id;


--
-- Name: directus_shares; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.directus_shares (
    id uuid NOT NULL,
    name character varying(255),
    collection character varying(64) NOT NULL,
    item character varying(255) NOT NULL,
    role uuid,
    password character varying(255),
    user_created uuid,
    date_created timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    date_start timestamp with time zone,
    date_end timestamp with time zone,
    times_used integer DEFAULT 0,
    max_uses integer
);


--
-- Name: directus_storage_stats; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.directus_storage_stats AS
 SELECT directus_component_unified.storage_location,
    directus_component_unified.storage_status,
    count(*) AS component_count,
    avg(directus_component_unified.quality_score) AS avg_quality_score,
    min(directus_component_unified.quality_score) AS min_quality_score,
    max(directus_component_unified.quality_score) AS max_quality_score,
    count(*) FILTER (WHERE ((directus_component_unified.expires_at IS NOT NULL) AND (directus_component_unified.expires_at < (now() + '24:00:00'::interval)))) AS expiring_soon_count
   FROM public.directus_component_unified
  GROUP BY directus_component_unified.storage_location, directus_component_unified.storage_status
  ORDER BY directus_component_unified.storage_location DESC, directus_component_unified.storage_status;


--
-- Name: VIEW directus_storage_stats; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON VIEW public.directus_storage_stats IS 'Storage statistics for Directus dashboard widgets';


--
-- Name: directus_translations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.directus_translations (
    id uuid NOT NULL,
    language character varying(255) NOT NULL,
    key character varying(255) NOT NULL,
    value text NOT NULL
);


--
-- Name: directus_users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.directus_users (
    id uuid NOT NULL,
    first_name character varying(50),
    last_name character varying(50),
    email character varying(128),
    password character varying(255),
    location character varying(255),
    title character varying(50),
    description text,
    tags json,
    avatar uuid,
    language character varying(255) DEFAULT NULL::character varying,
    tfa_secret character varying(255),
    status character varying(16) DEFAULT 'active'::character varying NOT NULL,
    role uuid,
    token character varying(255),
    last_access timestamp with time zone,
    last_page character varying(255),
    provider character varying(128) DEFAULT 'default'::character varying NOT NULL,
    external_identifier character varying(255),
    auth_data json,
    email_notifications boolean DEFAULT true,
    appearance character varying(255),
    theme_dark character varying(255),
    theme_light character varying(255),
    theme_light_overrides json,
    theme_dark_overrides json,
    text_direction character varying(255) DEFAULT 'auto'::character varying NOT NULL
);


--
-- Name: directus_versions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.directus_versions (
    id uuid NOT NULL,
    key character varying(64) NOT NULL,
    name character varying(255),
    collection character varying(64) NOT NULL,
    item character varying(255) NOT NULL,
    hash character varying(255),
    date_created timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    date_updated timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    user_created uuid,
    user_updated uuid,
    delta json
);


--
-- Name: directus_webhooks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.directus_webhooks (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    method character varying(10) DEFAULT 'POST'::character varying NOT NULL,
    url character varying(255) NOT NULL,
    status character varying(10) DEFAULT 'active'::character varying NOT NULL,
    data boolean DEFAULT true NOT NULL,
    actions character varying(100) NOT NULL,
    collections character varying(255) NOT NULL,
    headers json,
    was_active_before_deprecation boolean DEFAULT false NOT NULL,
    migrated_flow uuid
);


--
-- Name: directus_webhooks_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.directus_webhooks_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: directus_webhooks_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.directus_webhooks_id_seq OWNED BY public.directus_webhooks.id;


--
-- Name: enrichment_batch_jobs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.enrichment_batch_jobs (
    id integer NOT NULL,
    batch_id uuid DEFAULT gen_random_uuid() NOT NULL,
    job_name character varying(200),
    enrichment_source_id integer NOT NULL,
    total_components integer DEFAULT 0,
    processed_count integer DEFAULT 0,
    successful_count integer DEFAULT 0,
    failed_count integer DEFAULT 0,
    status character varying(50) DEFAULT 'pending'::character varying,
    start_time timestamp without time zone,
    end_time timestamp without time zone,
    error_message text,
    created_by character varying(100),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: enrichment_batch_jobs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.enrichment_batch_jobs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: enrichment_batch_jobs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.enrichment_batch_jobs_id_seq OWNED BY public.enrichment_batch_jobs.id;


--
-- Name: enrichment_cost_tracking; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.enrichment_cost_tracking (
    id integer NOT NULL,
    enrichment_source_id integer NOT NULL,
    month date NOT NULL,
    api_calls_count integer DEFAULT 0,
    estimated_cost numeric(12,4) DEFAULT 0,
    cost_per_call numeric(10,6) DEFAULT 0,
    budget_limit numeric(12,4) DEFAULT 1000.00,
    status character varying(50) DEFAULT 'under_budget'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: enrichment_cost_tracking_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.enrichment_cost_tracking_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: enrichment_cost_tracking_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.enrichment_cost_tracking_id_seq OWNED BY public.enrichment_cost_tracking.id;


--
-- Name: enrichment_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.enrichment_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    job_id uuid,
    line_item_id uuid,
    mpn character varying(255),
    manufacturer character varying(255),
    status character varying(50),
    quality_score numeric,
    enrichment_source character varying(50),
    storage_location character varying(50),
    message text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: enrichment_queue; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.enrichment_queue (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bom_id uuid,
    bom_upload_id uuid,
    organization_id uuid,
    project_id uuid,
    line_item_id uuid,
    line_number integer,
    mpn character varying(255),
    manufacturer character varying(255),
    quantity integer,
    reference_designator text,
    description text,
    status character varying(50) DEFAULT 'pending'::character varying,
    priority integer DEFAULT 5,
    enrichment_data jsonb,
    ai_suggestions jsonb,
    issues jsonb,
    assigned_to uuid,
    source character varying(50),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: enrichment_rules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.enrichment_rules (
    id integer NOT NULL,
    rule_name character varying(200) NOT NULL,
    enrichment_source_id integer NOT NULL,
    target_field character varying(100) NOT NULL,
    field_mapping jsonb,
    transformation_logic jsonb,
    priority integer DEFAULT 100,
    is_active boolean DEFAULT true,
    apply_to_categories text[],
    min_quality_threshold numeric(3,2) DEFAULT 0.7,
    overwrite_existing boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: enrichment_rules_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.enrichment_rules_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: enrichment_rules_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.enrichment_rules_id_seq OWNED BY public.enrichment_rules.id;


--
-- Name: enrichment_sources; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.enrichment_sources (
    id integer NOT NULL,
    source_name character varying(100) NOT NULL,
    source_type character varying(50) NOT NULL,
    priority integer DEFAULT 100,
    is_active boolean DEFAULT true,
    api_endpoint character varying(500),
    api_timeout_ms integer DEFAULT 30000,
    retry_attempts integer DEFAULT 3,
    data_format character varying(50) DEFAULT 'json'::character varying,
    authentication_type character varying(50),
    cache_ttl_seconds integer DEFAULT 86400,
    min_data_quality_score numeric(3,2) DEFAULT 0.7,
    description text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: enrichment_sources_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.enrichment_sources_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: enrichment_sources_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.enrichment_sources_id_seq OWNED BY public.enrichment_sources.id;


--
-- Name: enrichment_status_tracking; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.enrichment_status_tracking (
    id integer NOT NULL,
    component_id integer,
    enrichment_source_id integer NOT NULL,
    last_enriched_time timestamp without time zone,
    data_quality_score numeric(3,2) DEFAULT 0,
    field_count integer DEFAULT 0,
    missing_fields text[],
    requires_manual_review boolean DEFAULT false,
    manual_review_reason text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: enrichment_status_tracking_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.enrichment_status_tracking_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: enrichment_status_tracking_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.enrichment_status_tracking_id_seq OWNED BY public.enrichment_status_tracking.id;


--
-- Name: migration_metadata; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.migration_metadata (
    id integer NOT NULL,
    migration_name character varying(255),
    migration_version character varying(10),
    status character varying(50),
    started_at timestamp without time zone,
    completed_at timestamp without time zone,
    error_message text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: migration_metadata_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.migration_metadata_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: migration_metadata_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.migration_metadata_id_seq OWNED BY public.migration_metadata.id;


--
-- Name: mv_supplier_quality_summary; Type: MATERIALIZED VIEW; Schema: public; Owner: -
--

CREATE MATERIALIZED VIEW public.mv_supplier_quality_summary AS
 SELECT audit_enrichment_runs.supplier_name,
    count(*) AS total_enrichments,
    count(*) FILTER (WHERE (audit_enrichment_runs.successful = true)) AS successful_enrichments,
    count(*) FILTER (WHERE (audit_enrichment_runs.successful = false)) AS failed_enrichments,
    round((((count(*) FILTER (WHERE (audit_enrichment_runs.successful = true)))::numeric / (count(*))::numeric) * (100)::numeric), 2) AS success_rate,
    round(avg(audit_enrichment_runs.quality_score) FILTER (WHERE (audit_enrichment_runs.quality_score IS NOT NULL)), 2) AS avg_quality_score,
    round(avg(audit_enrichment_runs.supplier_match_confidence) FILTER (WHERE (audit_enrichment_runs.supplier_match_confidence IS NOT NULL)), 2) AS avg_confidence,
    round(avg(audit_enrichment_runs.processing_time_ms) FILTER (WHERE (audit_enrichment_runs.processing_time_ms IS NOT NULL)), 2) AS avg_processing_time_ms,
    count(*) FILTER (WHERE (audit_enrichment_runs.needs_review = true)) AS needs_review_count,
    count(*) FILTER (WHERE (audit_enrichment_runs.storage_location = 'database'::text)) AS database_count,
    count(*) FILTER (WHERE (audit_enrichment_runs.storage_location = 'redis'::text)) AS redis_count,
    max(audit_enrichment_runs.enrichment_timestamp) AS last_enrichment_at,
    min(audit_enrichment_runs.enrichment_timestamp) AS first_enrichment_at
   FROM public.audit_enrichment_runs
  WHERE (audit_enrichment_runs.enrichment_timestamp >= (now() - '30 days'::interval))
  GROUP BY audit_enrichment_runs.supplier_name
  WITH NO DATA;


--
-- Name: MATERIALIZED VIEW mv_supplier_quality_summary; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON MATERIALIZED VIEW public.mv_supplier_quality_summary IS 'Supplier quality metrics for Directus dashboard (refreshed periodically)';


--
-- Name: organizations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.organizations (
    id integer NOT NULL,
    org_name character varying(200) NOT NULL,
    org_slug character varying(100) NOT NULL,
    org_type character varying(50) DEFAULT 'customer'::character varying,
    database_type character varying(50) DEFAULT 'postgresql'::character varying,
    database_connection_string character varying(1000),
    is_active boolean DEFAULT true,
    subscription_tier character varying(50) DEFAULT 'free'::character varying,
    subscription_expires_at timestamp without time zone,
    api_key_encrypted character varying(500),
    api_quota_per_month integer DEFAULT 100000,
    storage_quota_gb integer DEFAULT 100,
    user_count_limit integer DEFAULT 10,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: organizations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.organizations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: organizations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.organizations_id_seq OWNED BY public.organizations.id;


--
-- Name: rate_limit_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rate_limit_config (
    id integer NOT NULL,
    service_name character varying(100) NOT NULL,
    redis_key_pattern character varying(255),
    requests_per_window integer DEFAULT 1000,
    window_seconds integer DEFAULT 3600,
    enabled boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: rate_limit_config_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.rate_limit_config_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: rate_limit_config_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.rate_limit_config_id_seq OWNED BY public.rate_limit_config.id;


--
-- Name: redis_cache_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.redis_cache_config (
    id integer NOT NULL,
    service_name character varying(100) NOT NULL,
    redis_namespace character varying(255) NOT NULL,
    ttl_seconds integer DEFAULT 3600,
    enabled boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: redis_cache_config_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.redis_cache_config_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: redis_cache_config_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.redis_cache_config_id_seq OWNED BY public.redis_cache_config.id;


--
-- Name: redis_circuit_breakers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.redis_circuit_breakers (
    id integer NOT NULL,
    service_name character varying(100) NOT NULL,
    state character varying(20) DEFAULT 'closed'::character varying NOT NULL,
    failure_count integer DEFAULT 0,
    failure_threshold integer DEFAULT 5 NOT NULL,
    last_failure_time timestamp without time zone,
    recovery_attempt_time timestamp without time zone,
    opened_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: redis_circuit_breakers_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.redis_circuit_breakers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: redis_circuit_breakers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.redis_circuit_breakers_id_seq OWNED BY public.redis_circuit_breakers.id;


--
-- Name: redis_cns_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.redis_cns_config (
    id integer NOT NULL,
    service_name character varying(50) DEFAULT 'cns-service'::character varying NOT NULL,
    cache_ttl_seconds integer DEFAULT 3600 NOT NULL,
    lookup_cache_ttl_seconds integer DEFAULT 86400 NOT NULL,
    batch_cache_ttl_seconds integer DEFAULT 1800 NOT NULL,
    compression_enabled boolean DEFAULT true NOT NULL,
    max_cache_size_mb integer DEFAULT 2048 NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: redis_cns_config_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.redis_cns_config_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: redis_cns_config_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.redis_cns_config_id_seq OWNED BY public.redis_cns_config.id;


--
-- Name: redis_component_cache_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.redis_component_cache_config (
    id integer NOT NULL,
    entity_type character varying(50) NOT NULL,
    ttl_seconds integer DEFAULT 86400 NOT NULL,
    update_on_write boolean DEFAULT true NOT NULL,
    update_on_read boolean DEFAULT false NOT NULL,
    compression_enabled boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: redis_component_cache_config_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.redis_component_cache_config_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: redis_component_cache_config_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.redis_component_cache_config_id_seq OWNED BY public.redis_component_cache_config.id;


--
-- Name: redis_connection_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.redis_connection_config (
    id integer NOT NULL,
    config_name character varying(100) NOT NULL,
    host character varying(255) DEFAULT 'redis'::character varying,
    port integer DEFAULT 6379,
    database integer DEFAULT 0,
    password_encrypted character varying(500),
    connection_pool_size integer DEFAULT 10,
    max_overflow integer DEFAULT 5,
    timeout_seconds integer DEFAULT 5,
    retry_on_timeout boolean DEFAULT true,
    ssl_enabled boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: redis_connection_config_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.redis_connection_config_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: redis_connection_config_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.redis_connection_config_id_seq OWNED BY public.redis_connection_config.id;


--
-- Name: redis_directus_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.redis_directus_config (
    id integer NOT NULL,
    collection_name character varying(100) NOT NULL,
    ttl_seconds integer DEFAULT 3600 NOT NULL,
    invalidate_on_webhook boolean DEFAULT true NOT NULL,
    batch_operations boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: redis_directus_config_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.redis_directus_config_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: redis_directus_config_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.redis_directus_config_id_seq OWNED BY public.redis_directus_config.id;


--
-- Name: redis_health_check; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.redis_health_check (
    id integer NOT NULL,
    service_name character varying(100),
    redis_db integer,
    connection_status character varying(50),
    response_time_ms integer,
    memory_used_mb numeric(10,2),
    keys_count integer,
    last_check timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: redis_health_check_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.redis_health_check_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: redis_health_check_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.redis_health_check_id_seq OWNED BY public.redis_health_check.id;


--
-- Name: redis_health_checks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.redis_health_checks (
    id integer NOT NULL,
    check_timestamp timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    service_name character varying(50) NOT NULL,
    status character varying(20) NOT NULL,
    response_time_ms integer,
    last_error text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: redis_health_checks_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.redis_health_checks_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: redis_health_checks_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.redis_health_checks_id_seq OWNED BY public.redis_health_checks.id;


--
-- Name: redis_key_expiration_policy; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.redis_key_expiration_policy (
    id integer NOT NULL,
    key_pattern character varying(255) NOT NULL,
    ttl_seconds integer NOT NULL,
    eviction_policy character varying(50) DEFAULT 'allkeys-lru'::character varying,
    description text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: redis_key_expiration_policy_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.redis_key_expiration_policy_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: redis_key_expiration_policy_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.redis_key_expiration_policy_id_seq OWNED BY public.redis_key_expiration_policy.id;


--
-- Name: redis_rate_limits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.redis_rate_limits (
    id integer NOT NULL,
    supplier_name character varying(100) NOT NULL,
    requests_per_hour integer DEFAULT 10000 NOT NULL,
    requests_per_minute integer DEFAULT 200 NOT NULL,
    burst_allowance integer DEFAULT 10 NOT NULL,
    throttle_duration_ms integer DEFAULT 1000 NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: redis_rate_limits_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.redis_rate_limits_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: redis_rate_limits_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.redis_rate_limits_id_seq OWNED BY public.redis_rate_limits.id;


--
-- Name: redis_s3_metadata_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.redis_s3_metadata_config (
    id integer NOT NULL,
    bucket_name character varying(100) NOT NULL,
    ttl_seconds integer DEFAULT 3600 NOT NULL,
    cache_headers boolean DEFAULT true NOT NULL,
    cache_tags boolean DEFAULT true NOT NULL,
    max_object_size_mb integer DEFAULT 100 NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: redis_s3_metadata_config_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.redis_s3_metadata_config_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: redis_s3_metadata_config_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.redis_s3_metadata_config_id_seq OWNED BY public.redis_s3_metadata_config.id;


--
-- Name: redis_sync_lock; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.redis_sync_lock (
    lock_name text NOT NULL,
    locked_by text NOT NULL,
    locked_at timestamp with time zone DEFAULT now(),
    expires_at timestamp with time zone NOT NULL
);


--
-- Name: TABLE redis_sync_lock; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.redis_sync_lock IS 'Advisory locks for Redis sync operations to prevent race conditions';


--
-- Name: redis_sync_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.redis_sync_log (
    id integer NOT NULL,
    service_name character varying(100),
    operation character varying(50),
    redis_key character varying(500),
    data_size_bytes integer,
    success boolean,
    error_message text,
    sync_time integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: redis_sync_log_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.redis_sync_log_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: redis_sync_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.redis_sync_log_id_seq OWNED BY public.redis_sync_log.id;


--
-- Name: redis_temporal_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.redis_temporal_config (
    id integer NOT NULL,
    service_name character varying(50) NOT NULL,
    redis_host character varying(100) DEFAULT 'localhost'::character varying NOT NULL,
    redis_port integer DEFAULT 6379 NOT NULL,
    redis_db integer DEFAULT 0 NOT NULL,
    connection_pool_size integer DEFAULT 10 NOT NULL,
    timeout_ms integer DEFAULT 5000 NOT NULL,
    retry_policy jsonb DEFAULT '{"backoff_ms": 100, "max_retries": 3, "backoff_multiplier": 2.0}'::jsonb NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: redis_temporal_config_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.redis_temporal_config_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: redis_temporal_config_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.redis_temporal_config_id_seq OWNED BY public.redis_temporal_config.id;


--
-- Name: s3_cache_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.s3_cache_config (
    id integer NOT NULL,
    bucket_name character varying(255) NOT NULL,
    redis_prefix character varying(100),
    cache_ttl_seconds integer DEFAULT 3600,
    enabled boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: s3_cache_config_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.s3_cache_config_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: s3_cache_config_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.s3_cache_config_id_seq OWNED BY public.s3_cache_config.id;


--
-- Name: service_connectivity_matrix; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.service_connectivity_matrix (
    id integer NOT NULL,
    source_service character varying(100),
    target_service character varying(100),
    integration_type character varying(50),
    redis_key_pattern character varying(255),
    connection_status character varying(50) DEFAULT 'pending'::character varying,
    last_tested timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: service_connectivity_matrix_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.service_connectivity_matrix_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: service_connectivity_matrix_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.service_connectivity_matrix_id_seq OWNED BY public.service_connectivity_matrix.id;


--
-- Name: supplier_enrichment_responses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.supplier_enrichment_responses (
    id uuid NOT NULL,
    job_id uuid,
    line_id uuid,
    mpn text,
    manufacturer text,
    vendor text,
    payload jsonb NOT NULL,
    normalized jsonb,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: supplier_performance_metrics; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.supplier_performance_metrics (
    id integer NOT NULL,
    supplier_id character varying(50) NOT NULL,
    request_count integer DEFAULT 0,
    success_count integer DEFAULT 0,
    error_count integer DEFAULT 0,
    avg_response_time_ms numeric(10,2) DEFAULT 0,
    p95_response_time_ms numeric(10,2) DEFAULT 0,
    p99_response_time_ms numeric(10,2) DEFAULT 0,
    last_error_message text,
    last_error_time timestamp without time zone,
    data_quality_score numeric(3,2) DEFAULT 1.0,
    uptime_percentage numeric(5,2) DEFAULT 100.0,
    last_successful_request timestamp without time zone,
    last_failed_request timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: supplier_performance_metrics_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.supplier_performance_metrics_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: supplier_performance_metrics_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.supplier_performance_metrics_id_seq OWNED BY public.supplier_performance_metrics.id;


--
-- Name: supplier_rate_limits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.supplier_rate_limits (
    id integer NOT NULL,
    supplier_id character varying(50) NOT NULL,
    request_count integer DEFAULT 0,
    request_window_start timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    request_window_end timestamp without time zone DEFAULT (CURRENT_TIMESTAMP + '01:00:00'::interval),
    is_rate_limited boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: supplier_rate_limits_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.supplier_rate_limits_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: supplier_rate_limits_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.supplier_rate_limits_id_seq OWNED BY public.supplier_rate_limits.id;


--
-- Name: supplier_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.supplier_settings (
    id integer NOT NULL,
    supplier_id character varying(50) NOT NULL,
    supplier_name character varying(200) NOT NULL,
    api_endpoint character varying(500),
    api_key_encrypted character varying(500),
    api_secret_encrypted character varying(500),
    webhook_url character varying(500),
    webhook_secret_encrypted character varying(500),
    rate_limit_per_hour integer DEFAULT 5000,
    rate_limit_per_day integer DEFAULT 100000,
    timeout_seconds integer DEFAULT 30,
    retry_attempts integer DEFAULT 3,
    retry_delay_ms integer DEFAULT 1000,
    enable_batch_operations boolean DEFAULT true,
    batch_size integer DEFAULT 100,
    enable_caching boolean DEFAULT true,
    cache_ttl_seconds integer DEFAULT 3600,
    enable_webhook_notifications boolean DEFAULT false,
    priority integer DEFAULT 100,
    active boolean DEFAULT true,
    last_updated timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: supplier_settings_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.supplier_settings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: supplier_settings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.supplier_settings_id_seq OWNED BY public.supplier_settings.id;


--
-- Name: supplier_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.supplier_tokens (
    supplier_name text NOT NULL,
    access_token text,
    refresh_token text,
    expires_at timestamp with time zone,
    updated_at timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: temporal_cache_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.temporal_cache_config (
    id integer NOT NULL,
    workflow_name character varying(255) NOT NULL,
    cache_prefix character varying(100),
    cache_ttl_seconds integer DEFAULT 3600,
    enabled boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: temporal_cache_config_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.temporal_cache_config_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: temporal_cache_config_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.temporal_cache_config_id_seq OWNED BY public.temporal_cache_config.id;


--
-- Name: tenant_audit_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tenant_audit_log (
    id integer NOT NULL,
    organization_id integer NOT NULL,
    user_id character varying(100),
    action character varying(100),
    resource_type character varying(100),
    resource_id character varying(100),
    changes jsonb,
    ip_address character varying(50),
    user_agent text,
    status character varying(50),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: tenant_audit_log_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tenant_audit_log_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tenant_audit_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tenant_audit_log_id_seq OWNED BY public.tenant_audit_log.id;


--
-- Name: tenant_data_isolation; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tenant_data_isolation (
    id integer NOT NULL,
    organization_id integer NOT NULL,
    isolated_schema_name character varying(100) NOT NULL,
    data_retention_days integer DEFAULT 365,
    enable_encryption boolean DEFAULT true,
    encryption_key_id character varying(100),
    enable_audit_logging boolean DEFAULT true,
    backup_frequency character varying(50) DEFAULT 'daily'::character varying,
    disaster_recovery_enabled boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: tenant_data_isolation_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tenant_data_isolation_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tenant_data_isolation_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tenant_data_isolation_id_seq OWNED BY public.tenant_data_isolation.id;


--
-- Name: tenant_features; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tenant_features (
    id integer NOT NULL,
    organization_id integer NOT NULL,
    feature_name character varying(100) NOT NULL,
    is_enabled boolean DEFAULT false,
    custom_config jsonb,
    expiration_date timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: tenant_features_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tenant_features_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tenant_features_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tenant_features_id_seq OWNED BY public.tenant_features.id;


--
-- Name: tenant_usage_tracking; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tenant_usage_tracking (
    id integer NOT NULL,
    organization_id integer NOT NULL,
    month date NOT NULL,
    api_calls_count integer DEFAULT 0,
    storage_used_gb numeric(12,2) DEFAULT 0,
    active_users integer DEFAULT 0,
    bom_uploads_count integer DEFAULT 0,
    components_indexed integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: tenant_usage_tracking_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tenant_usage_tracking_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tenant_usage_tracking_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tenant_usage_tracking_id_seq OWNED BY public.tenant_usage_tracking.id;


--
-- Name: v_enrichment_status_summary; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_enrichment_status_summary AS
 SELECT es.source_name,
    count(est.id) AS total_enriched,
    avg(est.data_quality_score) AS avg_quality_score,
    count(
        CASE
            WHEN est.requires_manual_review THEN 1
            ELSE NULL::integer
        END) AS requiring_review,
    max(est.last_enriched_time) AS last_enriched
   FROM (public.enrichment_sources es
     LEFT JOIN public.enrichment_status_tracking est ON ((es.id = est.enrichment_source_id)))
  WHERE (es.is_active = true)
  GROUP BY es.source_name
  ORDER BY (count(est.id)) DESC;


--
-- Name: v_lifecycle_alerts; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_lifecycle_alerts AS
 SELECT cl.component_id,
    cl.lifecycle_status,
    cl.expected_discontinuation_date,
    cr.substitute_component_id
   FROM (public.component_lifecycle cl
     LEFT JOIN public.component_substitution_rules cr ON ((cl.component_id = cr.primary_component_id)))
  WHERE ((cl.lifecycle_status)::text = ANY ((ARRAY['nearing_eol'::character varying, 'discontinued'::character varying])::text[]))
  ORDER BY cl.expected_discontinuation_date;


--
-- Name: v_redis_cache_summary; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_redis_cache_summary AS
 SELECT rcc.service_name,
    rcc.redis_namespace,
    rcc.ttl_seconds,
    rcc.enabled,
    rhc.connection_status,
    rhc.response_time_ms,
    rhc.memory_used_mb,
    rhc.keys_count,
    rhc.last_check
   FROM (public.redis_cache_config rcc
     LEFT JOIN public.redis_health_check rhc ON (((rcc.service_name)::text = (rhc.service_name)::text)))
  ORDER BY rcc.service_name;


--
-- Name: v_redis_service_status; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_redis_service_status AS
 SELECT scm.source_service,
    scm.target_service,
    scm.integration_type,
    scm.connection_status,
    scm.last_tested,
        CASE
            WHEN ((scm.connection_status)::text = 'pending'::text) THEN 'Not tested'::text
            WHEN ((scm.connection_status)::text = 'healthy'::text) THEN 'Connected'::text
            ELSE 'Failed'::text
        END AS status_description
   FROM public.service_connectivity_matrix scm
  ORDER BY scm.source_service, scm.target_service;


--
-- Name: v_supplier_status_summary; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_supplier_status_summary AS
 SELECT ss.supplier_id,
    ss.supplier_name,
    ss.active,
    srl.is_rate_limited,
    spm.success_count,
    spm.error_count,
    spm.avg_response_time_ms,
    spm.data_quality_score,
    spm.uptime_percentage,
    spm.last_successful_request
   FROM ((public.supplier_settings ss
     LEFT JOIN public.supplier_rate_limits srl ON (((ss.supplier_id)::text = (srl.supplier_id)::text)))
     LEFT JOIN public.supplier_performance_metrics spm ON (((ss.supplier_id)::text = (spm.supplier_id)::text)))
  ORDER BY ss.priority DESC, ss.supplier_name;


--
-- Name: v_tenant_usage_summary; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_tenant_usage_summary AS
 SELECT o.org_name,
    o.subscription_tier,
    o.user_count_limit,
    tut.api_calls_count,
    tut.storage_used_gb,
    tut.active_users,
    tut.bom_uploads_count,
    tut.components_indexed,
    tut.month
   FROM (public.organizations o
     LEFT JOIN public.tenant_usage_tracking tut ON ((o.id = tut.organization_id)))
  WHERE (o.is_active = true)
  ORDER BY o.org_name;


--
-- Name: vendor_category_mappings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vendor_category_mappings (
    id integer NOT NULL,
    vendor_id character varying(50) NOT NULL,
    vendor_category_id character varying(100) NOT NULL,
    vendor_category_name character varying(500) NOT NULL,
    component_category_id integer NOT NULL,
    mapping_confidence numeric(3,2) DEFAULT 1.0,
    last_updated timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: v_vendor_mapping_summary; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_vendor_mapping_summary AS
 SELECT c.name AS component_category,
    vcm.vendor_id,
    count(*) AS mapping_count,
    avg(vcm.mapping_confidence) AS avg_confidence,
    max(vcm.last_updated) AS last_updated
   FROM (public.vendor_category_mappings vcm
     JOIN public.categories c ON ((vcm.component_category_id = c.id)))
  WHERE (vcm.active = true)
  GROUP BY c.name, vcm.vendor_id
  ORDER BY vcm.vendor_id, (count(*)) DESC;


--
-- Name: vendor_category_mappings_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.vendor_category_mappings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: vendor_category_mappings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.vendor_category_mappings_id_seq OWNED BY public.vendor_category_mappings.id;


--
-- Name: vendor_category_mappings_stage; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vendor_category_mappings_stage (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    vendor character varying(50) NOT NULL,
    vendor_category_path text NOT NULL,
    canonical_category_id integer NOT NULL,
    confidence_score double precision DEFAULT 1.0,
    is_verified boolean DEFAULT false,
    notes text,
    match_count integer DEFAULT 1,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT valid_confidence_stage CHECK (((confidence_score >= (0.0)::double precision) AND (confidence_score <= (1.0)::double precision))),
    CONSTRAINT valid_vendor_stage CHECK (((vendor)::text = ANY ((ARRAY['digikey'::character varying, 'mouser'::character varying, 'element14'::character varying])::text[])))
);


--
-- Name: vendor_sync_status; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vendor_sync_status (
    id integer NOT NULL,
    vendor_id character varying(50) NOT NULL,
    last_sync_time timestamp without time zone,
    next_sync_time timestamp without time zone,
    total_mappings integer DEFAULT 0,
    successful_mappings integer DEFAULT 0,
    failed_mappings integer DEFAULT 0,
    sync_status character varying(20) DEFAULT 'pending'::character varying,
    error_message text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: vendor_sync_status_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.vendor_sync_status_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: vendor_sync_status_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.vendor_sync_status_id_seq OWNED BY public.vendor_sync_status.id;


--
-- Name: bom_items id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bom_items ALTER COLUMN id SET DEFAULT nextval('public.bom_items_id_seq'::regclass);


--
-- Name: bom_jobs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bom_jobs ALTER COLUMN id SET DEFAULT nextval('public.bom_jobs_id_seq'::regclass);


--
-- Name: bom_queue_config id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bom_queue_config ALTER COLUMN id SET DEFAULT nextval('public.bom_queue_config_id_seq'::regclass);


--
-- Name: categories id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories ALTER COLUMN id SET DEFAULT nextval('public.categories_id_seq'::regclass);


--
-- Name: category_snapshot_audit id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.category_snapshot_audit ALTER COLUMN id SET DEFAULT nextval('public.category_snapshot_audit_id_seq'::regclass);


--
-- Name: cns_cache_config id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cns_cache_config ALTER COLUMN id SET DEFAULT nextval('public.cns_cache_config_id_seq'::regclass);


--
-- Name: cns_supplier_settings id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cns_supplier_settings ALTER COLUMN id SET DEFAULT nextval('public.cns_supplier_settings_id_seq'::regclass);


--
-- Name: component_lifecycle id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.component_lifecycle ALTER COLUMN id SET DEFAULT nextval('public.component_lifecycle_id_seq'::regclass);


--
-- Name: component_pricing_history id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.component_pricing_history ALTER COLUMN id SET DEFAULT nextval('public.component_pricing_history_id_seq'::regclass);


--
-- Name: component_stock_levels id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.component_stock_levels ALTER COLUMN id SET DEFAULT nextval('public.component_stock_levels_id_seq'::regclass);


--
-- Name: component_substitution_rules id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.component_substitution_rules ALTER COLUMN id SET DEFAULT nextval('public.component_substitution_rules_id_seq'::regclass);


--
-- Name: directus_activity id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.directus_activity ALTER COLUMN id SET DEFAULT nextval('public.directus_activity_id_seq'::regclass);


--
-- Name: directus_cache_config id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.directus_cache_config ALTER COLUMN id SET DEFAULT nextval('public.directus_cache_config_id_seq'::regclass);


--
-- Name: directus_fields id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.directus_fields ALTER COLUMN id SET DEFAULT nextval('public.directus_fields_id_seq'::regclass);


--
-- Name: directus_notifications id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.directus_notifications ALTER COLUMN id SET DEFAULT nextval('public.directus_notifications_id_seq'::regclass);


--
-- Name: directus_permissions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.directus_permissions ALTER COLUMN id SET DEFAULT nextval('public.directus_permissions_id_seq'::regclass);


--
-- Name: directus_presets id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.directus_presets ALTER COLUMN id SET DEFAULT nextval('public.directus_presets_id_seq'::regclass);


--
-- Name: directus_relations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.directus_relations ALTER COLUMN id SET DEFAULT nextval('public.directus_relations_id_seq'::regclass);


--
-- Name: directus_revisions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.directus_revisions ALTER COLUMN id SET DEFAULT nextval('public.directus_revisions_id_seq'::regclass);


--
-- Name: directus_settings id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.directus_settings ALTER COLUMN id SET DEFAULT nextval('public.directus_settings_id_seq'::regclass);


--
-- Name: directus_webhooks id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.directus_webhooks ALTER COLUMN id SET DEFAULT nextval('public.directus_webhooks_id_seq'::regclass);


--
-- Name: enrichment_batch_jobs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.enrichment_batch_jobs ALTER COLUMN id SET DEFAULT nextval('public.enrichment_batch_jobs_id_seq'::regclass);


--
-- Name: enrichment_cost_tracking id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.enrichment_cost_tracking ALTER COLUMN id SET DEFAULT nextval('public.enrichment_cost_tracking_id_seq'::regclass);


--
-- Name: enrichment_rules id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.enrichment_rules ALTER COLUMN id SET DEFAULT nextval('public.enrichment_rules_id_seq'::regclass);


--
-- Name: enrichment_sources id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.enrichment_sources ALTER COLUMN id SET DEFAULT nextval('public.enrichment_sources_id_seq'::regclass);


--
-- Name: enrichment_status_tracking id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.enrichment_status_tracking ALTER COLUMN id SET DEFAULT nextval('public.enrichment_status_tracking_id_seq'::regclass);


--
-- Name: migration_metadata id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.migration_metadata ALTER COLUMN id SET DEFAULT nextval('public.migration_metadata_id_seq'::regclass);


--
-- Name: organizations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizations ALTER COLUMN id SET DEFAULT nextval('public.organizations_id_seq'::regclass);


--
-- Name: rate_limit_config id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rate_limit_config ALTER COLUMN id SET DEFAULT nextval('public.rate_limit_config_id_seq'::regclass);


--
-- Name: redis_cache_config id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.redis_cache_config ALTER COLUMN id SET DEFAULT nextval('public.redis_cache_config_id_seq'::regclass);


--
-- Name: redis_circuit_breakers id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.redis_circuit_breakers ALTER COLUMN id SET DEFAULT nextval('public.redis_circuit_breakers_id_seq'::regclass);


--
-- Name: redis_cns_config id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.redis_cns_config ALTER COLUMN id SET DEFAULT nextval('public.redis_cns_config_id_seq'::regclass);


--
-- Name: redis_component_cache_config id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.redis_component_cache_config ALTER COLUMN id SET DEFAULT nextval('public.redis_component_cache_config_id_seq'::regclass);


--
-- Name: redis_connection_config id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.redis_connection_config ALTER COLUMN id SET DEFAULT nextval('public.redis_connection_config_id_seq'::regclass);


--
-- Name: redis_directus_config id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.redis_directus_config ALTER COLUMN id SET DEFAULT nextval('public.redis_directus_config_id_seq'::regclass);


--
-- Name: redis_health_check id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.redis_health_check ALTER COLUMN id SET DEFAULT nextval('public.redis_health_check_id_seq'::regclass);


--
-- Name: redis_health_checks id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.redis_health_checks ALTER COLUMN id SET DEFAULT nextval('public.redis_health_checks_id_seq'::regclass);


--
-- Name: redis_key_expiration_policy id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.redis_key_expiration_policy ALTER COLUMN id SET DEFAULT nextval('public.redis_key_expiration_policy_id_seq'::regclass);


--
-- Name: redis_rate_limits id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.redis_rate_limits ALTER COLUMN id SET DEFAULT nextval('public.redis_rate_limits_id_seq'::regclass);


--
-- Name: redis_s3_metadata_config id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.redis_s3_metadata_config ALTER COLUMN id SET DEFAULT nextval('public.redis_s3_metadata_config_id_seq'::regclass);


--
-- Name: redis_sync_log id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.redis_sync_log ALTER COLUMN id SET DEFAULT nextval('public.redis_sync_log_id_seq'::regclass);


--
-- Name: redis_temporal_config id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.redis_temporal_config ALTER COLUMN id SET DEFAULT nextval('public.redis_temporal_config_id_seq'::regclass);


--
-- Name: s3_cache_config id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.s3_cache_config ALTER COLUMN id SET DEFAULT nextval('public.s3_cache_config_id_seq'::regclass);


--
-- Name: service_connectivity_matrix id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_connectivity_matrix ALTER COLUMN id SET DEFAULT nextval('public.service_connectivity_matrix_id_seq'::regclass);


--
-- Name: supplier_performance_metrics id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supplier_performance_metrics ALTER COLUMN id SET DEFAULT nextval('public.supplier_performance_metrics_id_seq'::regclass);


--
-- Name: supplier_rate_limits id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supplier_rate_limits ALTER COLUMN id SET DEFAULT nextval('public.supplier_rate_limits_id_seq'::regclass);


--
-- Name: supplier_settings id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supplier_settings ALTER COLUMN id SET DEFAULT nextval('public.supplier_settings_id_seq'::regclass);


--
-- Name: temporal_cache_config id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.temporal_cache_config ALTER COLUMN id SET DEFAULT nextval('public.temporal_cache_config_id_seq'::regclass);


--
-- Name: tenant_audit_log id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_audit_log ALTER COLUMN id SET DEFAULT nextval('public.tenant_audit_log_id_seq'::regclass);


--
-- Name: tenant_data_isolation id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_data_isolation ALTER COLUMN id SET DEFAULT nextval('public.tenant_data_isolation_id_seq'::regclass);


--
-- Name: tenant_features id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_features ALTER COLUMN id SET DEFAULT nextval('public.tenant_features_id_seq'::regclass);


--
-- Name: tenant_usage_tracking id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_usage_tracking ALTER COLUMN id SET DEFAULT nextval('public.tenant_usage_tracking_id_seq'::regclass);


--
-- Name: vendor_category_mappings id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendor_category_mappings ALTER COLUMN id SET DEFAULT nextval('public.vendor_category_mappings_id_seq'::regclass);


--
-- Name: vendor_sync_status id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendor_sync_status ALTER COLUMN id SET DEFAULT nextval('public.vendor_sync_status_id_seq'::regclass);


--
-- Name: ai_prompts ai_prompts_name_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_prompts
    ADD CONSTRAINT ai_prompts_name_unique UNIQUE (name);


--
-- Name: ai_prompts ai_prompts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_prompts
    ADD CONSTRAINT ai_prompts_pkey PRIMARY KEY (id);


--
-- Name: audit_enrichment_runs audit_enrichment_runs_name_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_enrichment_runs
    ADD CONSTRAINT audit_enrichment_runs_name_unique UNIQUE (name);


--
-- Name: audit_enrichment_runs audit_enrichment_runs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_enrichment_runs
    ADD CONSTRAINT audit_enrichment_runs_pkey PRIMARY KEY (id);


--
-- Name: audit_field_comparisons audit_field_comparisons_name_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_field_comparisons
    ADD CONSTRAINT audit_field_comparisons_name_unique UNIQUE (name);


--
-- Name: audit_field_comparisons audit_field_comparisons_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_field_comparisons
    ADD CONSTRAINT audit_field_comparisons_pkey PRIMARY KEY (id);


--
-- Name: audit_supplier_quality audit_supplier_quality_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_supplier_quality
    ADD CONSTRAINT audit_supplier_quality_pkey PRIMARY KEY (id);


--
-- Name: audit_supplier_quality audit_supplier_quality_supplier_name_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_supplier_quality
    ADD CONSTRAINT audit_supplier_quality_supplier_name_date_key UNIQUE (supplier_name, date);


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
-- Name: bom_queue_config bom_queue_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bom_queue_config
    ADD CONSTRAINT bom_queue_config_pkey PRIMARY KEY (id);


--
-- Name: bom_queue_config bom_queue_config_queue_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bom_queue_config
    ADD CONSTRAINT bom_queue_config_queue_name_key UNIQUE (queue_name);


--
-- Name: catalog_categories catalog_categories_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.catalog_categories
    ADD CONSTRAINT catalog_categories_name_key UNIQUE (name);


--
-- Name: catalog_categories catalog_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.catalog_categories
    ADD CONSTRAINT catalog_categories_pkey PRIMARY KEY (id);


--
-- Name: catalog_categories catalog_categories_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.catalog_categories
    ADD CONSTRAINT catalog_categories_slug_key UNIQUE (slug);


--
-- Name: catalog_category_mappings catalog_category_mappings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.catalog_category_mappings
    ADD CONSTRAINT catalog_category_mappings_pkey PRIMARY KEY (id);


--
-- Name: catalog_component_manufacturers catalog_component_manufacturers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.catalog_component_manufacturers
    ADD CONSTRAINT catalog_component_manufacturers_pkey PRIMARY KEY (component_id, manufacturer_id);


--
-- Name: catalog_components catalog_components_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.catalog_components
    ADD CONSTRAINT catalog_components_pkey PRIMARY KEY (id);


--
-- Name: catalog_manufacturers catalog_manufacturers_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.catalog_manufacturers
    ADD CONSTRAINT catalog_manufacturers_name_key UNIQUE (name);


--
-- Name: catalog_manufacturers catalog_manufacturers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.catalog_manufacturers
    ADD CONSTRAINT catalog_manufacturers_pkey PRIMARY KEY (id);


--
-- Name: categories categories_digikey_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_digikey_id_key UNIQUE (digikey_id);


--
-- Name: categories categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_pkey PRIMARY KEY (id);


--
-- Name: category_snapshot_audit category_snapshot_audit_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.category_snapshot_audit
    ADD CONSTRAINT category_snapshot_audit_pkey PRIMARY KEY (id);


--
-- Name: category_source_snapshot category_source_snapshot_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.category_source_snapshot
    ADD CONSTRAINT category_source_snapshot_pkey PRIMARY KEY (source_id);


--
-- Name: cns_cache_config cns_cache_config_cache_type_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cns_cache_config
    ADD CONSTRAINT cns_cache_config_cache_type_key UNIQUE (cache_type);


--
-- Name: cns_cache_config cns_cache_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cns_cache_config
    ADD CONSTRAINT cns_cache_config_pkey PRIMARY KEY (id);


--
-- Name: cns_enrichment_config cns_enrichment_config_config_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cns_enrichment_config
    ADD CONSTRAINT cns_enrichment_config_config_key_key UNIQUE (config_key);


--
-- Name: cns_enrichment_config_history cns_enrichment_config_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cns_enrichment_config_history
    ADD CONSTRAINT cns_enrichment_config_history_pkey PRIMARY KEY (id);


--
-- Name: cns_enrichment_config cns_enrichment_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cns_enrichment_config
    ADD CONSTRAINT cns_enrichment_config_pkey PRIMARY KEY (id);


--
-- Name: cns_supplier_settings cns_supplier_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cns_supplier_settings
    ADD CONSTRAINT cns_supplier_settings_pkey PRIMARY KEY (id);


--
-- Name: cns_supplier_settings cns_supplier_settings_supplier_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cns_supplier_settings
    ADD CONSTRAINT cns_supplier_settings_supplier_name_key UNIQUE (supplier_name);


--
-- Name: component_catalog component_catalog_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.component_catalog
    ADD CONSTRAINT component_catalog_pkey PRIMARY KEY (id);


--
-- Name: component_lifecycle component_lifecycle_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.component_lifecycle
    ADD CONSTRAINT component_lifecycle_pkey PRIMARY KEY (id);


--
-- Name: component_pricing_history component_pricing_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.component_pricing_history
    ADD CONSTRAINT component_pricing_history_pkey PRIMARY KEY (id);


--
-- Name: component_stock_levels component_stock_levels_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.component_stock_levels
    ADD CONSTRAINT component_stock_levels_pkey PRIMARY KEY (id);


--
-- Name: component_storage_tracking component_storage_tracking_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.component_storage_tracking
    ADD CONSTRAINT component_storage_tracking_pkey PRIMARY KEY (id);


--
-- Name: component_substitution_rules component_substitution_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.component_substitution_rules
    ADD CONSTRAINT component_substitution_rules_pkey PRIMARY KEY (id);


--
-- Name: directus_access directus_access_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.directus_access
    ADD CONSTRAINT directus_access_pkey PRIMARY KEY (id);


--
-- Name: directus_activity directus_activity_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.directus_activity
    ADD CONSTRAINT directus_activity_pkey PRIMARY KEY (id);


--
-- Name: directus_cache_config directus_cache_config_collection_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.directus_cache_config
    ADD CONSTRAINT directus_cache_config_collection_name_key UNIQUE (collection_name);


--
-- Name: directus_cache_config directus_cache_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.directus_cache_config
    ADD CONSTRAINT directus_cache_config_pkey PRIMARY KEY (id);


--
-- Name: directus_collections directus_collections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.directus_collections
    ADD CONSTRAINT directus_collections_pkey PRIMARY KEY (collection);


--
-- Name: directus_comments directus_comments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.directus_comments
    ADD CONSTRAINT directus_comments_pkey PRIMARY KEY (id);


--
-- Name: directus_dashboards directus_dashboards_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.directus_dashboards
    ADD CONSTRAINT directus_dashboards_pkey PRIMARY KEY (id);


--
-- Name: directus_extensions directus_extensions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.directus_extensions
    ADD CONSTRAINT directus_extensions_pkey PRIMARY KEY (id);


--
-- Name: directus_fields directus_fields_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.directus_fields
    ADD CONSTRAINT directus_fields_pkey PRIMARY KEY (id);


--
-- Name: directus_files directus_files_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.directus_files
    ADD CONSTRAINT directus_files_pkey PRIMARY KEY (id);


--
-- Name: directus_flows directus_flows_operation_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.directus_flows
    ADD CONSTRAINT directus_flows_operation_unique UNIQUE (operation);


--
-- Name: directus_flows directus_flows_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.directus_flows
    ADD CONSTRAINT directus_flows_pkey PRIMARY KEY (id);


--
-- Name: directus_folders directus_folders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.directus_folders
    ADD CONSTRAINT directus_folders_pkey PRIMARY KEY (id);


--
-- Name: directus_migrations directus_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.directus_migrations
    ADD CONSTRAINT directus_migrations_pkey PRIMARY KEY (version);


--
-- Name: directus_notifications directus_notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.directus_notifications
    ADD CONSTRAINT directus_notifications_pkey PRIMARY KEY (id);


--
-- Name: directus_operations directus_operations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.directus_operations
    ADD CONSTRAINT directus_operations_pkey PRIMARY KEY (id);


--
-- Name: directus_operations directus_operations_reject_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.directus_operations
    ADD CONSTRAINT directus_operations_reject_unique UNIQUE (reject);


--
-- Name: directus_operations directus_operations_resolve_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.directus_operations
    ADD CONSTRAINT directus_operations_resolve_unique UNIQUE (resolve);


--
-- Name: directus_panels directus_panels_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.directus_panels
    ADD CONSTRAINT directus_panels_pkey PRIMARY KEY (id);


--
-- Name: directus_permissions directus_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.directus_permissions
    ADD CONSTRAINT directus_permissions_pkey PRIMARY KEY (id);


--
-- Name: directus_policies directus_policies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.directus_policies
    ADD CONSTRAINT directus_policies_pkey PRIMARY KEY (id);


--
-- Name: directus_presets directus_presets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.directus_presets
    ADD CONSTRAINT directus_presets_pkey PRIMARY KEY (id);


--
-- Name: directus_relations directus_relations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.directus_relations
    ADD CONSTRAINT directus_relations_pkey PRIMARY KEY (id);


--
-- Name: directus_revisions directus_revisions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.directus_revisions
    ADD CONSTRAINT directus_revisions_pkey PRIMARY KEY (id);


--
-- Name: directus_roles directus_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.directus_roles
    ADD CONSTRAINT directus_roles_pkey PRIMARY KEY (id);


--
-- Name: directus_sessions directus_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.directus_sessions
    ADD CONSTRAINT directus_sessions_pkey PRIMARY KEY (token);


--
-- Name: directus_settings directus_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.directus_settings
    ADD CONSTRAINT directus_settings_pkey PRIMARY KEY (id);


--
-- Name: directus_shares directus_shares_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.directus_shares
    ADD CONSTRAINT directus_shares_pkey PRIMARY KEY (id);


--
-- Name: directus_translations directus_translations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.directus_translations
    ADD CONSTRAINT directus_translations_pkey PRIMARY KEY (id);


--
-- Name: directus_users directus_users_email_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.directus_users
    ADD CONSTRAINT directus_users_email_unique UNIQUE (email);


--
-- Name: directus_users directus_users_external_identifier_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.directus_users
    ADD CONSTRAINT directus_users_external_identifier_unique UNIQUE (external_identifier);


--
-- Name: directus_users directus_users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.directus_users
    ADD CONSTRAINT directus_users_pkey PRIMARY KEY (id);


--
-- Name: directus_users directus_users_token_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.directus_users
    ADD CONSTRAINT directus_users_token_unique UNIQUE (token);


--
-- Name: directus_versions directus_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.directus_versions
    ADD CONSTRAINT directus_versions_pkey PRIMARY KEY (id);


--
-- Name: directus_webhooks directus_webhooks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.directus_webhooks
    ADD CONSTRAINT directus_webhooks_pkey PRIMARY KEY (id);


--
-- Name: enrichment_batch_jobs enrichment_batch_jobs_batch_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.enrichment_batch_jobs
    ADD CONSTRAINT enrichment_batch_jobs_batch_id_key UNIQUE (batch_id);


--
-- Name: enrichment_batch_jobs enrichment_batch_jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.enrichment_batch_jobs
    ADD CONSTRAINT enrichment_batch_jobs_pkey PRIMARY KEY (id);


--
-- Name: enrichment_cost_tracking enrichment_cost_tracking_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.enrichment_cost_tracking
    ADD CONSTRAINT enrichment_cost_tracking_pkey PRIMARY KEY (id);


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
-- Name: enrichment_rules enrichment_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.enrichment_rules
    ADD CONSTRAINT enrichment_rules_pkey PRIMARY KEY (id);


--
-- Name: enrichment_rules enrichment_rules_rule_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.enrichment_rules
    ADD CONSTRAINT enrichment_rules_rule_name_key UNIQUE (rule_name);


--
-- Name: enrichment_sources enrichment_sources_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.enrichment_sources
    ADD CONSTRAINT enrichment_sources_pkey PRIMARY KEY (id);


--
-- Name: enrichment_sources enrichment_sources_source_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.enrichment_sources
    ADD CONSTRAINT enrichment_sources_source_name_key UNIQUE (source_name);


--
-- Name: enrichment_status_tracking enrichment_status_tracking_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.enrichment_status_tracking
    ADD CONSTRAINT enrichment_status_tracking_pkey PRIMARY KEY (id);


--
-- Name: migration_metadata migration_metadata_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.migration_metadata
    ADD CONSTRAINT migration_metadata_pkey PRIMARY KEY (id);


--
-- Name: organizations organizations_org_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_org_name_key UNIQUE (org_name);


--
-- Name: organizations organizations_org_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_org_slug_key UNIQUE (org_slug);


--
-- Name: organizations organizations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_pkey PRIMARY KEY (id);


--
-- Name: rate_limit_config rate_limit_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rate_limit_config
    ADD CONSTRAINT rate_limit_config_pkey PRIMARY KEY (id);


--
-- Name: rate_limit_config rate_limit_config_service_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rate_limit_config
    ADD CONSTRAINT rate_limit_config_service_name_key UNIQUE (service_name);


--
-- Name: redis_cache_config redis_cache_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.redis_cache_config
    ADD CONSTRAINT redis_cache_config_pkey PRIMARY KEY (id);


--
-- Name: redis_cache_config redis_cache_config_service_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.redis_cache_config
    ADD CONSTRAINT redis_cache_config_service_name_key UNIQUE (service_name);


--
-- Name: redis_circuit_breakers redis_circuit_breakers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.redis_circuit_breakers
    ADD CONSTRAINT redis_circuit_breakers_pkey PRIMARY KEY (id);


--
-- Name: redis_circuit_breakers redis_circuit_breakers_service_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.redis_circuit_breakers
    ADD CONSTRAINT redis_circuit_breakers_service_name_key UNIQUE (service_name);


--
-- Name: redis_cns_config redis_cns_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.redis_cns_config
    ADD CONSTRAINT redis_cns_config_pkey PRIMARY KEY (id);


--
-- Name: redis_cns_config redis_cns_config_service_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.redis_cns_config
    ADD CONSTRAINT redis_cns_config_service_name_key UNIQUE (service_name);


--
-- Name: redis_component_cache_config redis_component_cache_config_entity_type_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.redis_component_cache_config
    ADD CONSTRAINT redis_component_cache_config_entity_type_key UNIQUE (entity_type);


--
-- Name: redis_component_cache_config redis_component_cache_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.redis_component_cache_config
    ADD CONSTRAINT redis_component_cache_config_pkey PRIMARY KEY (id);


--
-- Name: redis_component_snapshot redis_component_snapshot_name_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.redis_component_snapshot
    ADD CONSTRAINT redis_component_snapshot_name_unique UNIQUE (name);


--
-- Name: redis_component_snapshot redis_component_snapshot_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.redis_component_snapshot
    ADD CONSTRAINT redis_component_snapshot_pkey PRIMARY KEY (id);


--
-- Name: redis_component_snapshot redis_component_snapshot_redis_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.redis_component_snapshot
    ADD CONSTRAINT redis_component_snapshot_redis_key_key UNIQUE (redis_key);


--
-- Name: redis_connection_config redis_connection_config_config_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.redis_connection_config
    ADD CONSTRAINT redis_connection_config_config_name_key UNIQUE (config_name);


--
-- Name: redis_connection_config redis_connection_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.redis_connection_config
    ADD CONSTRAINT redis_connection_config_pkey PRIMARY KEY (id);


--
-- Name: redis_directus_config redis_directus_config_collection_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.redis_directus_config
    ADD CONSTRAINT redis_directus_config_collection_name_key UNIQUE (collection_name);


--
-- Name: redis_directus_config redis_directus_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.redis_directus_config
    ADD CONSTRAINT redis_directus_config_pkey PRIMARY KEY (id);


--
-- Name: redis_health_check redis_health_check_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.redis_health_check
    ADD CONSTRAINT redis_health_check_pkey PRIMARY KEY (id);


--
-- Name: redis_health_checks redis_health_checks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.redis_health_checks
    ADD CONSTRAINT redis_health_checks_pkey PRIMARY KEY (id);


--
-- Name: redis_key_expiration_policy redis_key_expiration_policy_key_pattern_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.redis_key_expiration_policy
    ADD CONSTRAINT redis_key_expiration_policy_key_pattern_key UNIQUE (key_pattern);


--
-- Name: redis_key_expiration_policy redis_key_expiration_policy_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.redis_key_expiration_policy
    ADD CONSTRAINT redis_key_expiration_policy_pkey PRIMARY KEY (id);


--
-- Name: redis_rate_limits redis_rate_limits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.redis_rate_limits
    ADD CONSTRAINT redis_rate_limits_pkey PRIMARY KEY (id);


--
-- Name: redis_rate_limits redis_rate_limits_supplier_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.redis_rate_limits
    ADD CONSTRAINT redis_rate_limits_supplier_name_key UNIQUE (supplier_name);


--
-- Name: redis_s3_metadata_config redis_s3_metadata_config_bucket_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.redis_s3_metadata_config
    ADD CONSTRAINT redis_s3_metadata_config_bucket_name_key UNIQUE (bucket_name);


--
-- Name: redis_s3_metadata_config redis_s3_metadata_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.redis_s3_metadata_config
    ADD CONSTRAINT redis_s3_metadata_config_pkey PRIMARY KEY (id);


--
-- Name: redis_sync_lock redis_sync_lock_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.redis_sync_lock
    ADD CONSTRAINT redis_sync_lock_pkey PRIMARY KEY (lock_name);


--
-- Name: redis_sync_log redis_sync_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.redis_sync_log
    ADD CONSTRAINT redis_sync_log_pkey PRIMARY KEY (id);


--
-- Name: redis_temporal_config redis_temporal_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.redis_temporal_config
    ADD CONSTRAINT redis_temporal_config_pkey PRIMARY KEY (id);


--
-- Name: redis_temporal_config redis_temporal_config_service_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.redis_temporal_config
    ADD CONSTRAINT redis_temporal_config_service_name_key UNIQUE (service_name);


--
-- Name: s3_cache_config s3_cache_config_bucket_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.s3_cache_config
    ADD CONSTRAINT s3_cache_config_bucket_name_key UNIQUE (bucket_name);


--
-- Name: s3_cache_config s3_cache_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.s3_cache_config
    ADD CONSTRAINT s3_cache_config_pkey PRIMARY KEY (id);


--
-- Name: service_connectivity_matrix service_connectivity_matrix_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_connectivity_matrix
    ADD CONSTRAINT service_connectivity_matrix_pkey PRIMARY KEY (id);


--
-- Name: service_connectivity_matrix service_connectivity_matrix_source_service_target_service_i_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_connectivity_matrix
    ADD CONSTRAINT service_connectivity_matrix_source_service_target_service_i_key UNIQUE (source_service, target_service, integration_type);


--
-- Name: supplier_enrichment_responses supplier_enrichment_responses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supplier_enrichment_responses
    ADD CONSTRAINT supplier_enrichment_responses_pkey PRIMARY KEY (id);


--
-- Name: supplier_performance_metrics supplier_performance_metrics_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supplier_performance_metrics
    ADD CONSTRAINT supplier_performance_metrics_pkey PRIMARY KEY (id);


--
-- Name: supplier_rate_limits supplier_rate_limits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supplier_rate_limits
    ADD CONSTRAINT supplier_rate_limits_pkey PRIMARY KEY (id);


--
-- Name: supplier_settings supplier_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supplier_settings
    ADD CONSTRAINT supplier_settings_pkey PRIMARY KEY (id);


--
-- Name: supplier_settings supplier_settings_supplier_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supplier_settings
    ADD CONSTRAINT supplier_settings_supplier_id_key UNIQUE (supplier_id);


--
-- Name: supplier_tokens supplier_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supplier_tokens
    ADD CONSTRAINT supplier_tokens_pkey PRIMARY KEY (supplier_name);


--
-- Name: temporal_cache_config temporal_cache_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.temporal_cache_config
    ADD CONSTRAINT temporal_cache_config_pkey PRIMARY KEY (id);


--
-- Name: temporal_cache_config temporal_cache_config_workflow_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.temporal_cache_config
    ADD CONSTRAINT temporal_cache_config_workflow_name_key UNIQUE (workflow_name);


--
-- Name: tenant_audit_log tenant_audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_audit_log
    ADD CONSTRAINT tenant_audit_log_pkey PRIMARY KEY (id);


--
-- Name: tenant_data_isolation tenant_data_isolation_isolated_schema_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_data_isolation
    ADD CONSTRAINT tenant_data_isolation_isolated_schema_name_key UNIQUE (isolated_schema_name);


--
-- Name: tenant_data_isolation tenant_data_isolation_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_data_isolation
    ADD CONSTRAINT tenant_data_isolation_pkey PRIMARY KEY (id);


--
-- Name: tenant_features tenant_features_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_features
    ADD CONSTRAINT tenant_features_pkey PRIMARY KEY (id);


--
-- Name: tenant_usage_tracking tenant_usage_tracking_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_usage_tracking
    ADD CONSTRAINT tenant_usage_tracking_pkey PRIMARY KEY (id);


--
-- Name: component_lifecycle unique_component_lifecycle; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.component_lifecycle
    ADD CONSTRAINT unique_component_lifecycle UNIQUE (component_id);


--
-- Name: enrichment_status_tracking unique_component_source; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.enrichment_status_tracking
    ADD CONSTRAINT unique_component_source UNIQUE (component_id, enrichment_source_id);


--
-- Name: component_stock_levels unique_component_supplier_stock; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.component_stock_levels
    ADD CONSTRAINT unique_component_supplier_stock UNIQUE (component_id, supplier_id);


--
-- Name: tenant_features unique_org_feature; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_features
    ADD CONSTRAINT unique_org_feature UNIQUE (organization_id, feature_name);


--
-- Name: tenant_usage_tracking unique_org_month; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_usage_tracking
    ADD CONSTRAINT unique_org_month UNIQUE (organization_id, month);


--
-- Name: enrichment_cost_tracking unique_source_month; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.enrichment_cost_tracking
    ADD CONSTRAINT unique_source_month UNIQUE (enrichment_source_id, month);


--
-- Name: component_substitution_rules unique_substitution; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.component_substitution_rules
    ADD CONSTRAINT unique_substitution UNIQUE (primary_component_id, substitute_component_id);


--
-- Name: supplier_performance_metrics unique_supplier_metrics; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supplier_performance_metrics
    ADD CONSTRAINT unique_supplier_metrics UNIQUE (supplier_id);


--
-- Name: supplier_rate_limits unique_supplier_rate_limit; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supplier_rate_limits
    ADD CONSTRAINT unique_supplier_rate_limit UNIQUE (supplier_id);


--
-- Name: vendor_category_mappings unique_vendor_mapping; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendor_category_mappings
    ADD CONSTRAINT unique_vendor_mapping UNIQUE (vendor_id, vendor_category_id, component_category_id);


--
-- Name: component_catalog uq_component_catalog_mpn_mfr; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.component_catalog
    ADD CONSTRAINT uq_component_catalog_mpn_mfr UNIQUE (manufacturer_part_number, manufacturer);


--
-- Name: vendor_category_mappings vendor_category_mappings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendor_category_mappings
    ADD CONSTRAINT vendor_category_mappings_pkey PRIMARY KEY (id);


--
-- Name: vendor_category_mappings_stage vendor_category_mappings_stage_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendor_category_mappings_stage
    ADD CONSTRAINT vendor_category_mappings_stage_pkey PRIMARY KEY (id);


--
-- Name: vendor_sync_status vendor_sync_status_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendor_sync_status
    ADD CONSTRAINT vendor_sync_status_pkey PRIMARY KEY (id);


--
-- Name: vendor_sync_status vendor_sync_status_vendor_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendor_sync_status
    ADD CONSTRAINT vendor_sync_status_vendor_id_key UNIQUE (vendor_id);


--
-- Name: ai_prompts_name_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ai_prompts_name_index ON public.ai_prompts USING btree (name);


--
-- Name: audit_enrichment_runs_name_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_enrichment_runs_name_index ON public.audit_enrichment_runs USING btree (name);


--
-- Name: audit_field_comparisons_name_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_field_comparisons_name_index ON public.audit_field_comparisons USING btree (name);


--
-- Name: directus_activity_timestamp_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX directus_activity_timestamp_index ON public.directus_activity USING btree ("timestamp");


--
-- Name: directus_revisions_parent_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX directus_revisions_parent_index ON public.directus_revisions USING btree (parent);


--
-- Name: idx_audit_failed_enrichments; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_failed_enrichments ON public.audit_enrichment_runs USING btree (enrichment_timestamp DESC, error_message) WHERE (successful = false);


--
-- Name: idx_audit_fields_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_fields_category ON public.audit_field_comparisons USING btree (field_category);


--
-- Name: idx_audit_fields_changed; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_fields_changed ON public.audit_field_comparisons USING btree (changed) WHERE (changed = true);


--
-- Name: idx_audit_fields_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_fields_name ON public.audit_field_comparisons USING btree (field_name);


--
-- Name: idx_audit_fields_quality; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_fields_quality ON public.audit_field_comparisons USING btree (supplier_data_quality, changed);


--
-- Name: idx_audit_fields_run; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_fields_run ON public.audit_field_comparisons USING btree (enrichment_run_id);


--
-- Name: idx_audit_needs_review; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_needs_review ON public.audit_enrichment_runs USING btree (quality_score, enrichment_timestamp DESC) WHERE ((needs_review = true) AND (reviewed_at IS NULL));


--
-- Name: INDEX idx_audit_needs_review; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON INDEX public.idx_audit_needs_review IS 'Performance index for Directus review queue';


--
-- Name: idx_audit_runs_mpn; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_runs_mpn ON public.audit_enrichment_runs USING btree (mpn);


--
-- Name: idx_audit_runs_needs_review; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_runs_needs_review ON public.audit_enrichment_runs USING btree (needs_review) WHERE (needs_review = true);


--
-- Name: idx_audit_runs_status_timestamp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_runs_status_timestamp ON public.audit_enrichment_runs USING btree (needs_review, enrichment_timestamp DESC) WHERE (successful = true);


--
-- Name: INDEX idx_audit_runs_status_timestamp; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON INDEX public.idx_audit_runs_status_timestamp IS 'Performance index for Directus review queue';


--
-- Name: idx_audit_runs_supplier; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_runs_supplier ON public.audit_enrichment_runs USING btree (supplier_name);


--
-- Name: idx_audit_runs_supplier_quality; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_runs_supplier_quality ON public.audit_enrichment_runs USING btree (supplier_name, quality_score, enrichment_timestamp DESC);


--
-- Name: idx_audit_runs_timestamp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_runs_timestamp ON public.audit_enrichment_runs USING btree (enrichment_timestamp DESC);


--
-- Name: idx_audit_runs_upload; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_runs_upload ON public.audit_enrichment_runs USING btree (upload_id);


--
-- Name: idx_audit_supplier_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_supplier_date ON public.audit_supplier_quality USING btree (date DESC);


--
-- Name: idx_audit_supplier_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_supplier_name ON public.audit_supplier_quality USING btree (supplier_name);


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
-- Name: idx_categories_digikey_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_categories_digikey_id ON public.categories USING btree (digikey_id);


--
-- Name: idx_categories_level; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_categories_level ON public.categories USING btree (level);


--
-- Name: idx_categories_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_categories_name ON public.categories USING btree (name);


--
-- Name: idx_categories_parent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_categories_parent ON public.categories USING btree (parent_id);


--
-- Name: idx_categories_parent_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_categories_parent_id ON public.categories USING btree (parent_id);


--
-- Name: idx_categories_path; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_categories_path ON public.categories USING btree (path);


--
-- Name: idx_category_snapshot_audit_started; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_category_snapshot_audit_started ON public.category_snapshot_audit USING btree (run_started DESC);


--
-- Name: idx_category_source_snapshot_parent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_category_source_snapshot_parent ON public.category_source_snapshot USING btree (parent_id);


--
-- Name: idx_category_source_snapshot_path; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_category_source_snapshot_path ON public.category_source_snapshot USING btree (path);


--
-- Name: idx_cns_cache_config_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cns_cache_config_type ON public.cns_cache_config USING btree (cache_type);


--
-- Name: idx_component_catalog_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_component_catalog_category ON public.component_catalog USING btree (category);


--
-- Name: idx_component_catalog_last_enriched; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_component_catalog_last_enriched ON public.component_catalog USING btree (last_enriched_at);


--
-- Name: idx_component_catalog_lifecycle; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_component_catalog_lifecycle ON public.component_catalog USING btree (lifecycle_status);


--
-- Name: idx_component_catalog_manufacturer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_component_catalog_manufacturer ON public.component_catalog USING btree (manufacturer);


--
-- Name: idx_component_catalog_mpn; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_component_catalog_mpn ON public.component_catalog USING btree (manufacturer_part_number);


--
-- Name: idx_component_catalog_mpn_mfr; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_component_catalog_mpn_mfr ON public.component_catalog USING btree (manufacturer_part_number, manufacturer);


--
-- Name: idx_component_catalog_parameters; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_component_catalog_parameters ON public.component_catalog USING gin (parameters);


--
-- Name: idx_component_catalog_quality; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_component_catalog_quality ON public.component_catalog USING btree (quality_score DESC);


--
-- Name: idx_component_catalog_risk; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_component_catalog_risk ON public.component_catalog USING btree (risk_level);


--
-- Name: idx_component_catalog_specifications; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_component_catalog_specifications ON public.component_catalog USING gin (specifications);


--
-- Name: idx_component_catalog_storage; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_component_catalog_storage ON public.component_catalog USING btree (storage_location);


--
-- Name: idx_component_catalog_supplier_data; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_component_catalog_supplier_data ON public.component_catalog USING gin (supplier_data);


--
-- Name: idx_component_catalog_usage; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_component_catalog_usage ON public.component_catalog USING btree (usage_count DESC);


--
-- Name: idx_component_lifecycle_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_component_lifecycle_status ON public.component_lifecycle USING btree (lifecycle_status);


--
-- Name: idx_component_pricing_component; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_component_pricing_component ON public.component_pricing_history USING btree (component_id);


--
-- Name: idx_component_pricing_effective; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_component_pricing_effective ON public.component_pricing_history USING btree (effective_date DESC);


--
-- Name: idx_component_pricing_supplier; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_component_pricing_supplier ON public.component_pricing_history USING btree (supplier_id);


--
-- Name: idx_component_stock_component; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_component_stock_component ON public.component_stock_levels USING btree (component_id);


--
-- Name: idx_component_stock_supplier; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_component_stock_supplier ON public.component_stock_levels USING btree (supplier_id);


--
-- Name: idx_config_history_key; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_config_history_key ON public.cns_enrichment_config_history USING btree (config_key, changed_at DESC);


--
-- Name: idx_config_history_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_config_history_user ON public.cns_enrichment_config_history USING btree (changed_by, changed_at DESC);


--
-- Name: idx_directus_cache_config_collection; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_directus_cache_config_collection ON public.directus_cache_config USING btree (collection_name);


--
-- Name: idx_enrichment_batch_source; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_enrichment_batch_source ON public.enrichment_batch_jobs USING btree (enrichment_source_id);


--
-- Name: idx_enrichment_batch_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_enrichment_batch_status ON public.enrichment_batch_jobs USING btree (status);


--
-- Name: idx_enrichment_config_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_enrichment_config_active ON public.cns_enrichment_config USING btree (category, config_key) WHERE (deprecated = false);


--
-- Name: idx_enrichment_config_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_enrichment_config_category ON public.cns_enrichment_config USING btree (category);


--
-- Name: idx_enrichment_config_key; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_enrichment_config_key ON public.cns_enrichment_config USING btree (config_key);


--
-- Name: idx_enrichment_cost_month; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_enrichment_cost_month ON public.enrichment_cost_tracking USING btree (month DESC);


--
-- Name: idx_enrichment_rules_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_enrichment_rules_active ON public.enrichment_rules USING btree (is_active);


--
-- Name: idx_enrichment_rules_source; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_enrichment_rules_source ON public.enrichment_rules USING btree (enrichment_source_id);


--
-- Name: idx_enrichment_sources_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_enrichment_sources_active ON public.enrichment_sources USING btree (is_active);


--
-- Name: idx_enrichment_status_component; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_enrichment_status_component ON public.enrichment_status_tracking USING btree (component_id);


--
-- Name: idx_enrichment_status_quality; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_enrichment_status_quality ON public.enrichment_status_tracking USING btree (data_quality_score);


--
-- Name: idx_enrichment_status_source; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_enrichment_status_source ON public.enrichment_status_tracking USING btree (enrichment_source_id);


--
-- Name: idx_mv_supplier_quality_name; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_mv_supplier_quality_name ON public.mv_supplier_quality_summary USING btree (supplier_name);


--
-- Name: idx_organizations_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_organizations_active ON public.organizations USING btree (is_active);


--
-- Name: idx_organizations_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_organizations_slug ON public.organizations USING btree (org_slug);


--
-- Name: idx_rate_limit_config_service; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rate_limit_config_service ON public.rate_limit_config USING btree (service_name);


--
-- Name: idx_redis_active_components; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_redis_active_components ON public.redis_component_snapshot USING btree (expires_at, quality_score) WHERE (sync_status = 'active'::text);


--
-- Name: INDEX idx_redis_active_components; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON INDEX public.idx_redis_active_components IS 'Performance index for active Redis components dashboard';


--
-- Name: idx_redis_cache_config_namespace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_redis_cache_config_namespace ON public.redis_cache_config USING btree (redis_namespace);


--
-- Name: idx_redis_cache_config_service; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_redis_cache_config_service ON public.redis_cache_config USING btree (service_name);


--
-- Name: idx_redis_cache_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_redis_cache_status ON public.redis_cache_config USING btree (service_name);


--
-- Name: idx_redis_health_check_service; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_redis_health_check_service ON public.redis_health_check USING btree (service_name, created_at DESC);


--
-- Name: idx_redis_health_checks_service_timestamp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_redis_health_checks_service_timestamp ON public.redis_health_checks USING btree (service_name, check_timestamp DESC);


--
-- Name: idx_redis_rate_limits_supplier; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_redis_rate_limits_supplier ON public.redis_rate_limits USING btree (supplier_name);


--
-- Name: idx_redis_snapshot_expires; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_redis_snapshot_expires ON public.redis_component_snapshot USING btree (expires_at);


--
-- Name: idx_redis_snapshot_line_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_redis_snapshot_line_id ON public.redis_component_snapshot USING btree (line_id);


--
-- Name: idx_redis_snapshot_mpn; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_redis_snapshot_mpn ON public.redis_component_snapshot USING btree (mpn);


--
-- Name: idx_redis_snapshot_quality; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_redis_snapshot_quality ON public.redis_component_snapshot USING btree (quality_score);


--
-- Name: idx_redis_snapshot_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_redis_snapshot_status ON public.redis_component_snapshot USING btree (sync_status);


--
-- Name: idx_redis_snapshot_sync_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_redis_snapshot_sync_status ON public.redis_component_snapshot USING btree (sync_status, last_synced_at);


--
-- Name: INDEX idx_redis_snapshot_sync_status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON INDEX public.idx_redis_snapshot_sync_status IS 'Performance index for Redis sync operations';


--
-- Name: idx_redis_sync_log_operation; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_redis_sync_log_operation ON public.redis_sync_log USING btree (operation, created_at DESC);


--
-- Name: idx_redis_sync_log_service; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_redis_sync_log_service ON public.redis_sync_log USING btree (service_name, created_at DESC);


--
-- Name: idx_service_connectivity_matrix_source; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_service_connectivity_matrix_source ON public.service_connectivity_matrix USING btree (source_service);


--
-- Name: idx_service_connectivity_matrix_target; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_service_connectivity_matrix_target ON public.service_connectivity_matrix USING btree (target_service);


--
-- Name: idx_service_connectivity_source; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_service_connectivity_source ON public.service_connectivity_matrix USING btree (source_service);


--
-- Name: idx_service_connectivity_target; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_service_connectivity_target ON public.service_connectivity_matrix USING btree (target_service);


--
-- Name: idx_stage_canonical; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stage_canonical ON public.vendor_category_mappings_stage USING btree (canonical_category_id);


--
-- Name: idx_stage_confidence; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stage_confidence ON public.vendor_category_mappings_stage USING btree (confidence_score DESC);


--
-- Name: idx_stage_vendor_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_stage_vendor_lookup ON public.vendor_category_mappings_stage USING btree (vendor, vendor_category_path);


--
-- Name: idx_storage_tracking_expires; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_storage_tracking_expires ON public.component_storage_tracking USING btree (expires_at) WHERE (expires_at IS NOT NULL);


--
-- Name: idx_storage_tracking_line_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_storage_tracking_line_id ON public.component_storage_tracking USING btree (line_id);


--
-- Name: idx_storage_tracking_location; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_storage_tracking_location ON public.component_storage_tracking USING btree (storage_location);


--
-- Name: idx_storage_tracking_mpn_mfr; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_storage_tracking_mpn_mfr ON public.component_storage_tracking USING btree (manufacturer_part_number, manufacturer);


--
-- Name: idx_storage_tracking_quality; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_storage_tracking_quality ON public.component_storage_tracking USING btree (quality_score);


--
-- Name: idx_storage_tracking_redis_key; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_storage_tracking_redis_key ON public.component_storage_tracking USING btree (redis_key) WHERE (redis_key IS NOT NULL);


--
-- Name: idx_substitution_primary; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_substitution_primary ON public.component_substitution_rules USING btree (primary_component_id);


--
-- Name: idx_substitution_substitute; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_substitution_substitute ON public.component_substitution_rules USING btree (substitute_component_id);


--
-- Name: idx_supplier_enabled; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_supplier_enabled ON public.cns_supplier_settings USING btree (enabled) WHERE (enabled = true);


--
-- Name: idx_supplier_metrics_supplier; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_supplier_metrics_supplier ON public.supplier_performance_metrics USING btree (supplier_id);


--
-- Name: idx_supplier_priority; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_supplier_priority ON public.cns_supplier_settings USING btree (priority);


--
-- Name: idx_supplier_rate_limits_supplier; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_supplier_rate_limits_supplier ON public.supplier_rate_limits USING btree (supplier_id);


--
-- Name: idx_supplier_responses_job; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_supplier_responses_job ON public.supplier_enrichment_responses USING btree (job_id);


--
-- Name: idx_supplier_responses_line; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_supplier_responses_line ON public.supplier_enrichment_responses USING btree (line_id);


--
-- Name: idx_supplier_settings_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_supplier_settings_active ON public.supplier_settings USING btree (active);


--
-- Name: idx_supplier_settings_priority; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_supplier_settings_priority ON public.supplier_settings USING btree (priority DESC);


--
-- Name: idx_supplier_tokens_expires_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_supplier_tokens_expires_at ON public.supplier_tokens USING btree (expires_at) WHERE (expires_at IS NOT NULL);


--
-- Name: idx_tenant_audit_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tenant_audit_created ON public.tenant_audit_log USING btree (created_at DESC);


--
-- Name: idx_tenant_audit_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tenant_audit_org ON public.tenant_audit_log USING btree (organization_id);


--
-- Name: idx_tenant_audit_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tenant_audit_user ON public.tenant_audit_log USING btree (user_id);


--
-- Name: idx_tenant_features_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tenant_features_name ON public.tenant_features USING btree (feature_name);


--
-- Name: idx_tenant_features_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tenant_features_org ON public.tenant_features USING btree (organization_id);


--
-- Name: idx_tenant_isolation_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tenant_isolation_org ON public.tenant_data_isolation USING btree (organization_id);


--
-- Name: idx_tenant_usage_month; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tenant_usage_month ON public.tenant_usage_tracking USING btree (month DESC);


--
-- Name: idx_tenant_usage_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tenant_usage_org ON public.tenant_usage_tracking USING btree (organization_id);


--
-- Name: idx_vendor_mappings_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vendor_mappings_active ON public.vendor_category_mappings USING btree (active);


--
-- Name: idx_vendor_mappings_component; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vendor_mappings_component ON public.vendor_category_mappings USING btree (component_category_id);


--
-- Name: idx_vendor_mappings_confidence; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vendor_mappings_confidence ON public.vendor_category_mappings USING btree (mapping_confidence DESC);


--
-- Name: idx_vendor_mappings_vendor; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vendor_mappings_vendor ON public.vendor_category_mappings USING btree (vendor_id, vendor_category_id);


--
-- Name: redis_component_snapshot_name_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX redis_component_snapshot_name_index ON public.redis_component_snapshot USING btree (name);


--
-- Name: cns_supplier_settings supplier_settings_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER supplier_settings_updated_at BEFORE UPDATE ON public.cns_supplier_settings FOR EACH ROW EXECUTE FUNCTION public.update_supplier_settings_timestamp();


--
-- Name: component_catalog tr_component_catalog_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tr_component_catalog_updated_at BEFORE UPDATE ON public.component_catalog FOR EACH ROW EXECUTE FUNCTION public.update_component_catalog_updated_at();


--
-- Name: component_storage_tracking tr_storage_tracking_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tr_storage_tracking_updated_at BEFORE UPDATE ON public.component_storage_tracking FOR EACH ROW EXECUTE FUNCTION public.update_storage_tracking_updated_at();


--
-- Name: cns_enrichment_config trg_enrichment_config_changes; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_enrichment_config_changes BEFORE UPDATE ON public.cns_enrichment_config FOR EACH ROW WHEN ((old.config_value IS DISTINCT FROM new.config_value)) EXECUTE FUNCTION public.track_enrichment_config_changes();


--
-- Name: cns_enrichment_config trg_validate_enrichment_config; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_validate_enrichment_config BEFORE INSERT OR UPDATE ON public.cns_enrichment_config FOR EACH ROW EXECUTE FUNCTION public.validate_enrichment_config();


--
-- Name: vendor_category_mappings vendor_mapping_sync_update; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER vendor_mapping_sync_update AFTER INSERT OR UPDATE ON public.vendor_category_mappings FOR EACH ROW EXECUTE FUNCTION public.update_vendor_sync_status();


--
-- Name: ai_prompts ai_prompts_user_created_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_prompts
    ADD CONSTRAINT ai_prompts_user_created_foreign FOREIGN KEY (user_created) REFERENCES public.directus_users(id);


--
-- Name: ai_prompts ai_prompts_user_updated_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_prompts
    ADD CONSTRAINT ai_prompts_user_updated_foreign FOREIGN KEY (user_updated) REFERENCES public.directus_users(id);


--
-- Name: audit_field_comparisons audit_field_comparisons_enrichment_run_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_field_comparisons
    ADD CONSTRAINT audit_field_comparisons_enrichment_run_id_fkey FOREIGN KEY (enrichment_run_id) REFERENCES public.audit_enrichment_runs(id) ON DELETE CASCADE;


--
-- Name: catalog_category_mappings catalog_category_mappings_normalized_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.catalog_category_mappings
    ADD CONSTRAINT catalog_category_mappings_normalized_category_id_fkey FOREIGN KEY (normalized_category_id) REFERENCES public.catalog_categories(id);


--
-- Name: catalog_component_manufacturers catalog_component_manufacturers_component_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.catalog_component_manufacturers
    ADD CONSTRAINT catalog_component_manufacturers_component_id_fkey FOREIGN KEY (component_id) REFERENCES public.catalog_components(id) ON DELETE CASCADE;


--
-- Name: catalog_component_manufacturers catalog_component_manufacturers_manufacturer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.catalog_component_manufacturers
    ADD CONSTRAINT catalog_component_manufacturers_manufacturer_id_fkey FOREIGN KEY (manufacturer_id) REFERENCES public.catalog_manufacturers(id) ON DELETE CASCADE;


--
-- Name: categories categories_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.categories(id) ON DELETE CASCADE;


--
-- Name: component_storage_tracking component_storage_tracking_component_catalog_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.component_storage_tracking
    ADD CONSTRAINT component_storage_tracking_component_catalog_id_fkey FOREIGN KEY (component_catalog_id) REFERENCES public.component_catalog(id) ON DELETE SET NULL;


--
-- Name: directus_access directus_access_policy_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.directus_access
    ADD CONSTRAINT directus_access_policy_foreign FOREIGN KEY (policy) REFERENCES public.directus_policies(id) ON DELETE CASCADE;


--
-- Name: directus_access directus_access_role_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.directus_access
    ADD CONSTRAINT directus_access_role_foreign FOREIGN KEY (role) REFERENCES public.directus_roles(id) ON DELETE CASCADE;


--
-- Name: directus_access directus_access_user_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.directus_access
    ADD CONSTRAINT directus_access_user_foreign FOREIGN KEY ("user") REFERENCES public.directus_users(id) ON DELETE CASCADE;


--
-- Name: directus_collections directus_collections_group_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.directus_collections
    ADD CONSTRAINT directus_collections_group_foreign FOREIGN KEY ("group") REFERENCES public.directus_collections(collection);


--
-- Name: directus_comments directus_comments_user_created_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.directus_comments
    ADD CONSTRAINT directus_comments_user_created_foreign FOREIGN KEY (user_created) REFERENCES public.directus_users(id) ON DELETE SET NULL;


--
-- Name: directus_comments directus_comments_user_updated_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.directus_comments
    ADD CONSTRAINT directus_comments_user_updated_foreign FOREIGN KEY (user_updated) REFERENCES public.directus_users(id);


--
-- Name: directus_dashboards directus_dashboards_user_created_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.directus_dashboards
    ADD CONSTRAINT directus_dashboards_user_created_foreign FOREIGN KEY (user_created) REFERENCES public.directus_users(id) ON DELETE SET NULL;


--
-- Name: directus_files directus_files_folder_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.directus_files
    ADD CONSTRAINT directus_files_folder_foreign FOREIGN KEY (folder) REFERENCES public.directus_folders(id) ON DELETE SET NULL;


--
-- Name: directus_files directus_files_modified_by_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.directus_files
    ADD CONSTRAINT directus_files_modified_by_foreign FOREIGN KEY (modified_by) REFERENCES public.directus_users(id);


--
-- Name: directus_files directus_files_uploaded_by_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.directus_files
    ADD CONSTRAINT directus_files_uploaded_by_foreign FOREIGN KEY (uploaded_by) REFERENCES public.directus_users(id);


--
-- Name: directus_flows directus_flows_user_created_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.directus_flows
    ADD CONSTRAINT directus_flows_user_created_foreign FOREIGN KEY (user_created) REFERENCES public.directus_users(id) ON DELETE SET NULL;


--
-- Name: directus_folders directus_folders_parent_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.directus_folders
    ADD CONSTRAINT directus_folders_parent_foreign FOREIGN KEY (parent) REFERENCES public.directus_folders(id);


--
-- Name: directus_notifications directus_notifications_recipient_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.directus_notifications
    ADD CONSTRAINT directus_notifications_recipient_foreign FOREIGN KEY (recipient) REFERENCES public.directus_users(id) ON DELETE CASCADE;


--
-- Name: directus_notifications directus_notifications_sender_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.directus_notifications
    ADD CONSTRAINT directus_notifications_sender_foreign FOREIGN KEY (sender) REFERENCES public.directus_users(id);


--
-- Name: directus_operations directus_operations_flow_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.directus_operations
    ADD CONSTRAINT directus_operations_flow_foreign FOREIGN KEY (flow) REFERENCES public.directus_flows(id) ON DELETE CASCADE;


--
-- Name: directus_operations directus_operations_reject_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.directus_operations
    ADD CONSTRAINT directus_operations_reject_foreign FOREIGN KEY (reject) REFERENCES public.directus_operations(id);


--
-- Name: directus_operations directus_operations_resolve_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.directus_operations
    ADD CONSTRAINT directus_operations_resolve_foreign FOREIGN KEY (resolve) REFERENCES public.directus_operations(id);


--
-- Name: directus_operations directus_operations_user_created_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.directus_operations
    ADD CONSTRAINT directus_operations_user_created_foreign FOREIGN KEY (user_created) REFERENCES public.directus_users(id) ON DELETE SET NULL;


--
-- Name: directus_panels directus_panels_dashboard_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.directus_panels
    ADD CONSTRAINT directus_panels_dashboard_foreign FOREIGN KEY (dashboard) REFERENCES public.directus_dashboards(id) ON DELETE CASCADE;


--
-- Name: directus_panels directus_panels_user_created_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.directus_panels
    ADD CONSTRAINT directus_panels_user_created_foreign FOREIGN KEY (user_created) REFERENCES public.directus_users(id) ON DELETE SET NULL;


--
-- Name: directus_permissions directus_permissions_policy_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.directus_permissions
    ADD CONSTRAINT directus_permissions_policy_foreign FOREIGN KEY (policy) REFERENCES public.directus_policies(id) ON DELETE CASCADE;


--
-- Name: directus_presets directus_presets_role_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.directus_presets
    ADD CONSTRAINT directus_presets_role_foreign FOREIGN KEY (role) REFERENCES public.directus_roles(id) ON DELETE CASCADE;


--
-- Name: directus_presets directus_presets_user_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.directus_presets
    ADD CONSTRAINT directus_presets_user_foreign FOREIGN KEY ("user") REFERENCES public.directus_users(id) ON DELETE CASCADE;


--
-- Name: directus_revisions directus_revisions_activity_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.directus_revisions
    ADD CONSTRAINT directus_revisions_activity_foreign FOREIGN KEY (activity) REFERENCES public.directus_activity(id) ON DELETE CASCADE;


--
-- Name: directus_revisions directus_revisions_parent_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.directus_revisions
    ADD CONSTRAINT directus_revisions_parent_foreign FOREIGN KEY (parent) REFERENCES public.directus_revisions(id);


--
-- Name: directus_revisions directus_revisions_version_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.directus_revisions
    ADD CONSTRAINT directus_revisions_version_foreign FOREIGN KEY (version) REFERENCES public.directus_versions(id) ON DELETE CASCADE;


--
-- Name: directus_roles directus_roles_parent_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.directus_roles
    ADD CONSTRAINT directus_roles_parent_foreign FOREIGN KEY (parent) REFERENCES public.directus_roles(id);


--
-- Name: directus_sessions directus_sessions_share_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.directus_sessions
    ADD CONSTRAINT directus_sessions_share_foreign FOREIGN KEY (share) REFERENCES public.directus_shares(id) ON DELETE CASCADE;


--
-- Name: directus_sessions directus_sessions_user_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.directus_sessions
    ADD CONSTRAINT directus_sessions_user_foreign FOREIGN KEY ("user") REFERENCES public.directus_users(id) ON DELETE CASCADE;


--
-- Name: directus_settings directus_settings_project_logo_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.directus_settings
    ADD CONSTRAINT directus_settings_project_logo_foreign FOREIGN KEY (project_logo) REFERENCES public.directus_files(id);


--
-- Name: directus_settings directus_settings_public_background_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.directus_settings
    ADD CONSTRAINT directus_settings_public_background_foreign FOREIGN KEY (public_background) REFERENCES public.directus_files(id);


--
-- Name: directus_settings directus_settings_public_favicon_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.directus_settings
    ADD CONSTRAINT directus_settings_public_favicon_foreign FOREIGN KEY (public_favicon) REFERENCES public.directus_files(id);


--
-- Name: directus_settings directus_settings_public_foreground_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.directus_settings
    ADD CONSTRAINT directus_settings_public_foreground_foreign FOREIGN KEY (public_foreground) REFERENCES public.directus_files(id);


--
-- Name: directus_settings directus_settings_public_registration_role_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.directus_settings
    ADD CONSTRAINT directus_settings_public_registration_role_foreign FOREIGN KEY (public_registration_role) REFERENCES public.directus_roles(id) ON DELETE SET NULL;


--
-- Name: directus_settings directus_settings_storage_default_folder_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.directus_settings
    ADD CONSTRAINT directus_settings_storage_default_folder_foreign FOREIGN KEY (storage_default_folder) REFERENCES public.directus_folders(id) ON DELETE SET NULL;


--
-- Name: directus_shares directus_shares_collection_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.directus_shares
    ADD CONSTRAINT directus_shares_collection_foreign FOREIGN KEY (collection) REFERENCES public.directus_collections(collection) ON DELETE CASCADE;


--
-- Name: directus_shares directus_shares_role_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.directus_shares
    ADD CONSTRAINT directus_shares_role_foreign FOREIGN KEY (role) REFERENCES public.directus_roles(id) ON DELETE CASCADE;


--
-- Name: directus_shares directus_shares_user_created_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.directus_shares
    ADD CONSTRAINT directus_shares_user_created_foreign FOREIGN KEY (user_created) REFERENCES public.directus_users(id) ON DELETE SET NULL;


--
-- Name: directus_users directus_users_role_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.directus_users
    ADD CONSTRAINT directus_users_role_foreign FOREIGN KEY (role) REFERENCES public.directus_roles(id) ON DELETE SET NULL;


--
-- Name: directus_versions directus_versions_collection_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.directus_versions
    ADD CONSTRAINT directus_versions_collection_foreign FOREIGN KEY (collection) REFERENCES public.directus_collections(collection) ON DELETE CASCADE;


--
-- Name: directus_versions directus_versions_user_created_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.directus_versions
    ADD CONSTRAINT directus_versions_user_created_foreign FOREIGN KEY (user_created) REFERENCES public.directus_users(id) ON DELETE SET NULL;


--
-- Name: directus_versions directus_versions_user_updated_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.directus_versions
    ADD CONSTRAINT directus_versions_user_updated_foreign FOREIGN KEY (user_updated) REFERENCES public.directus_users(id);


--
-- Name: directus_webhooks directus_webhooks_migrated_flow_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.directus_webhooks
    ADD CONSTRAINT directus_webhooks_migrated_flow_foreign FOREIGN KEY (migrated_flow) REFERENCES public.directus_flows(id) ON DELETE SET NULL;


--
-- Name: enrichment_batch_jobs enrichment_batch_jobs_enrichment_source_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.enrichment_batch_jobs
    ADD CONSTRAINT enrichment_batch_jobs_enrichment_source_id_fkey FOREIGN KEY (enrichment_source_id) REFERENCES public.enrichment_sources(id) ON DELETE CASCADE;


--
-- Name: enrichment_cost_tracking enrichment_cost_tracking_enrichment_source_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.enrichment_cost_tracking
    ADD CONSTRAINT enrichment_cost_tracking_enrichment_source_id_fkey FOREIGN KEY (enrichment_source_id) REFERENCES public.enrichment_sources(id) ON DELETE CASCADE;


--
-- Name: enrichment_rules enrichment_rules_enrichment_source_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.enrichment_rules
    ADD CONSTRAINT enrichment_rules_enrichment_source_id_fkey FOREIGN KEY (enrichment_source_id) REFERENCES public.enrichment_sources(id) ON DELETE CASCADE;


--
-- Name: enrichment_status_tracking enrichment_status_tracking_enrichment_source_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.enrichment_status_tracking
    ADD CONSTRAINT enrichment_status_tracking_enrichment_source_id_fkey FOREIGN KEY (enrichment_source_id) REFERENCES public.enrichment_sources(id) ON DELETE CASCADE;


--
-- Name: supplier_performance_metrics supplier_performance_metrics_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supplier_performance_metrics
    ADD CONSTRAINT supplier_performance_metrics_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.supplier_settings(supplier_id) ON DELETE CASCADE;


--
-- Name: supplier_rate_limits supplier_rate_limits_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supplier_rate_limits
    ADD CONSTRAINT supplier_rate_limits_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.supplier_settings(supplier_id) ON DELETE CASCADE;


--
-- Name: tenant_audit_log tenant_audit_log_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_audit_log
    ADD CONSTRAINT tenant_audit_log_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: tenant_data_isolation tenant_data_isolation_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_data_isolation
    ADD CONSTRAINT tenant_data_isolation_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: tenant_features tenant_features_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_features
    ADD CONSTRAINT tenant_features_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: tenant_usage_tracking tenant_usage_tracking_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_usage_tracking
    ADD CONSTRAINT tenant_usage_tracking_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: vendor_category_mappings vendor_category_mappings_component_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendor_category_mappings
    ADD CONSTRAINT vendor_category_mappings_component_category_id_fkey FOREIGN KEY (component_category_id) REFERENCES public.categories(id) ON DELETE CASCADE;


--
-- Name: vendor_category_mappings_stage vendor_category_mappings_stage_canonical_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendor_category_mappings_stage
    ADD CONSTRAINT vendor_category_mappings_stage_canonical_category_id_fkey FOREIGN KEY (canonical_category_id) REFERENCES public.categories(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict NjMqwQCvwa3h0Afadx5oZwpYtPz7OLrzu5rKe0Pi1BPZMSTFiI7csKZbpWCzPXt

