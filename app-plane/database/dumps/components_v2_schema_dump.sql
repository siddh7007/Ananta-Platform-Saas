--
-- PostgreSQL database dump
--

\restrict RNHiPewQ1lDAaT2TiJyNS2p0kyRpchqSU6Ph4gf4hTPjDfgkzWR10ey8YhoOCA5

-- Dumped from database version 15.15
-- Dumped by pg_dump version 15.15

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
-- Name: update_modified_timestamp(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_modified_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


--
-- Name: update_search_vector(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_search_vector() RETURNS trigger
    LANGUAGE plpgsql
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
-- Name: update_supplier_quality_stats(date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_supplier_quality_stats(target_date date DEFAULT CURRENT_DATE) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
    INSERT INTO audit_supplier_quality (
        date, supplier_name,
        total_requests, successful_requests, failed_requests,
        avg_quality_score, avg_match_confidence, avg_processing_time_ms,
        fields_changed_count, fields_missing_count, fields_invalid_count
    )
    SELECT
        target_date,
        r.supplier_name,
        COUNT(*) as total_requests,
        COUNT(*) FILTER (WHERE r.successful = TRUE) as successful_requests,
        COUNT(*) FILTER (WHERE r.successful = FALSE) as failed_requests,
        AVG(r.quality_score) as avg_quality_score,
        AVG(r.supplier_match_confidence) as avg_match_confidence,
        AVG(r.processing_time_ms)::INTEGER as avg_processing_time_ms,
        COUNT(fc.id) FILTER (WHERE fc.changed = TRUE) as fields_changed_count,
        COUNT(fc.id) FILTER (WHERE fc.supplier_data_quality = 'missing') as fields_missing_count,
        COUNT(fc.id) FILTER (WHERE fc.supplier_data_quality = 'invalid') as fields_invalid_count
    FROM audit_enrichment_runs r
    LEFT JOIN audit_field_comparisons fc ON fc.enrichment_run_id = r.id
    WHERE DATE(r.enrichment_timestamp) = target_date
    GROUP BY r.supplier_name
    ON CONFLICT (date, supplier_name) DO UPDATE SET
        total_requests = EXCLUDED.total_requests,
        successful_requests = EXCLUDED.successful_requests,
        failed_requests = EXCLUDED.failed_requests,
        avg_quality_score = EXCLUDED.avg_quality_score,
        avg_match_confidence = EXCLUDED.avg_match_confidence,
        avg_processing_time_ms = EXCLUDED.avg_processing_time_ms,
        fields_changed_count = EXCLUDED.fields_changed_count,
        fields_missing_count = EXCLUDED.fields_missing_count,
        fields_invalid_count = EXCLUDED.fields_invalid_count,
        updated_at = NOW();
END;
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: ai_prompts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_prompts (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    system_prompt text,
    messages json,
    model character varying(100) DEFAULT 'gpt-4'::character varying,
    temperature numeric(3,2) DEFAULT 0.7,
    max_tokens integer DEFAULT 2000,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: ai_prompts_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ai_prompts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ai_prompts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ai_prompts_id_seq OWNED BY public.ai_prompts.id;


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
-- Name: TABLE audit_enrichment_runs; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.audit_enrichment_runs IS 'Master record for each enrichment operation';


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
-- Name: TABLE audit_field_comparisons; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.audit_field_comparisons IS 'Field-level comparison records for enrichment audit';


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
-- Name: TABLE audit_supplier_quality; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.audit_supplier_quality IS 'Daily supplier quality aggregates';


--
-- Name: bom_queue_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bom_queue_config (
    id integer NOT NULL,
    queue_name character varying(100) NOT NULL,
    max_concurrent_jobs integer DEFAULT 5,
    retry_attempts integer DEFAULT 3,
    retry_delay_seconds integer DEFAULT 60,
    priority_boost_threshold integer DEFAULT 80,
    enabled boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
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
-- Name: component_catalog; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.component_catalog (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    manufacturer_part_number character varying(255) NOT NULL,
    manufacturer character varying(255) NOT NULL,
    category character varying(255),
    subcategory character varying(255),
    category_path text,
    product_family character varying(255),
    product_series character varying(255),
    description text,
    datasheet_url text,
    image_url text,
    model_3d_url text,
    package character varying(100),
    lifecycle_status character varying(50) DEFAULT 'Active'::character varying,
    risk_level character varying(50),
    rohs_compliant boolean,
    reach_compliant boolean,
    halogen_free boolean,
    aec_qualified boolean,
    eccn_code character varying(50),
    unit_price numeric(12,4),
    currency character varying(3) DEFAULT 'USD'::character varying,
    price_breaks jsonb DEFAULT '[]'::jsonb,
    moq integer,
    lead_time_days integer,
    stock_status character varying(50),
    stock_quantity integer,
    specifications jsonb DEFAULT '{}'::jsonb,
    quality_score numeric(5,2),
    quality_metadata jsonb DEFAULT '{}'::jsonb,
    supplier_data jsonb DEFAULT '{}'::jsonb,
    ai_metadata jsonb DEFAULT '{}'::jsonb,
    enrichment_source character varying(50),
    last_enriched_at timestamp with time zone,
    enrichment_count integer DEFAULT 0,
    usage_count integer DEFAULT 0,
    last_used_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE component_catalog; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.component_catalog IS 'Central component catalog - master data for electronic components used by CNS enrichment';


--
-- Name: COLUMN component_catalog.manufacturer_part_number; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.component_catalog.manufacturer_part_number IS 'Manufacturer Part Number (MPN) - primary identifier';


--
-- Name: COLUMN component_catalog.manufacturer; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.component_catalog.manufacturer IS 'Component manufacturer name';


--
-- Name: COLUMN component_catalog.price_breaks; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.component_catalog.price_breaks IS 'JSON array of price breaks: [{"quantity": 1, "price": 0.50}, ...]';


--
-- Name: COLUMN component_catalog.quality_score; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.component_catalog.quality_score IS 'Data completeness score (0-100). Components >= 95 are auto-approved.';


--
-- Name: COLUMN component_catalog.supplier_data; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.component_catalog.supplier_data IS 'JSON object with supplier-specific data keyed by supplier name';


--
-- Name: COLUMN component_catalog.enrichment_source; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.component_catalog.enrichment_source IS 'Source of enrichment data: mouser, digikey, element14, ai, manual, fallback';


--
-- Name: COLUMN component_catalog.usage_count; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.component_catalog.usage_count IS 'Number of times this component was looked up (for popularity ranking)';


--
-- Name: catalog_components; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.catalog_components AS
 SELECT component_catalog.id,
    component_catalog.manufacturer_part_number AS mpn,
    component_catalog.manufacturer,
    NULL::character varying(255) AS normalized_mpn,
    NULL::character varying(255) AS normalized_manufacturer,
    component_catalog.category,
    component_catalog.subcategory,
    component_catalog.category_path,
    component_catalog.product_family,
    component_catalog.product_series,
    component_catalog.description,
    component_catalog.datasheet_url,
    component_catalog.image_url,
    component_catalog.lifecycle_status,
    component_catalog.package,
    component_catalog.unit_price,
    component_catalog.currency,
    component_catalog.price_breaks,
    component_catalog.moq,
    component_catalog.lead_time_days,
    component_catalog.stock_status,
    component_catalog.supplier_data,
    component_catalog.specifications,
    NULL::jsonb AS extracted_specs,
    component_catalog.rohs_compliant,
    component_catalog.reach_compliant,
    component_catalog.halogen_free,
    component_catalog.aec_qualified,
    component_catalog.eccn_code,
    component_catalog.quality_score,
    component_catalog.quality_metadata,
    component_catalog.ai_metadata,
    component_catalog.enrichment_source,
    component_catalog.enrichment_source AS api_source,
    component_catalog.created_at,
    component_catalog.updated_at
   FROM public.component_catalog;


--
-- Name: VIEW catalog_components; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON VIEW public.catalog_components IS 'ORM compatibility view mapping to component_catalog table. Used by SQLAlchemy CatalogComponent model.';


--
-- Name: catalog_components_table; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.catalog_components_table (
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
    supplier_codes jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.categories (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    parent_id integer,
    digikey_id integer,
    level integer DEFAULT 1,
    path character varying(1024),
    product_count integer DEFAULT 0,
    description text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: TABLE categories; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.categories IS 'Hierarchical component taxonomy (DigiKey structure)';


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
-- Name: COLUMN category_snapshot_audit.rows_flattened; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.category_snapshot_audit.rows_flattened IS 'Number of categories flattened from source';


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
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
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
    id integer NOT NULL,
    config_key character varying(100) NOT NULL,
    config_value text NOT NULL,
    value_type character varying(20) DEFAULT 'string'::character varying,
    category character varying(50) DEFAULT 'general'::character varying,
    description text,
    default_value text,
    min_value numeric(20,4),
    max_value numeric(20,4),
    requires_restart boolean DEFAULT false,
    deprecated boolean DEFAULT false,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_by character varying(100),
    CONSTRAINT cns_enrichment_config_value_type_check CHECK (((value_type)::text = ANY ((ARRAY['string'::character varying, 'integer'::character varying, 'float'::character varying, 'boolean'::character varying, 'json'::character varying])::text[])))
);


--
-- Name: TABLE cns_enrichment_config; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.cns_enrichment_config IS 'Runtime configuration for CNS enrichment service';


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
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
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
-- Name: column_mapping_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.column_mapping_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    mappings jsonb NOT NULL,
    is_default boolean DEFAULT false,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE column_mapping_templates; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.column_mapping_templates IS 'Organization-scoped column mapping templates for BOM uploads';


--
-- Name: COLUMN column_mapping_templates.mappings; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.column_mapping_templates.mappings IS 'JSON mapping of internal fields to Excel column names';


--
-- Name: COLUMN column_mapping_templates.is_default; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.column_mapping_templates.is_default IS 'Whether this is the default template for the organization';


--
-- Name: component_lifecycle; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.component_lifecycle (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    component_id uuid,
    mpn text NOT NULL,
    manufacturer text,
    lifecycle_status character varying(50) DEFAULT 'active'::character varying,
    introduction_date date,
    end_of_life_date date,
    last_buy_date date,
    replacement_mpn text,
    notes text,
    data_source character varying(100),
    confidence_score numeric(5,2),
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: component_pricing; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.component_pricing (
    id integer NOT NULL,
    component_id uuid NOT NULL,
    supplier_id integer,
    supplier_part_number character varying(255),
    price numeric(12,4),
    quantity_break integer DEFAULT 1,
    currency character varying(3) DEFAULT 'USD'::character varying,
    stock_quantity integer DEFAULT 0,
    lead_time_days integer,
    minimum_order_qty integer DEFAULT 1,
    price_updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: TABLE component_pricing; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.component_pricing IS 'Component pricing from various suppliers';


--
-- Name: component_pricing_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.component_pricing_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: component_pricing_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.component_pricing_id_seq OWNED BY public.component_pricing.id;


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

COMMENT ON TABLE public.component_storage_tracking IS 'Tracks storage location (database vs Redis) for each enriched component. Used to route lookups and manage Redis TTL for low-quality components.';


--
-- Name: COLUMN component_storage_tracking.line_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.component_storage_tracking.line_id IS 'Unique identifier for the BOM line item (not the BOM line item UUID)';


--
-- Name: COLUMN component_storage_tracking.quality_score; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.component_storage_tracking.quality_score IS 'Quality score (0-100) that determined storage routing: >= 80: database (permanent), < 80: redis (temporary, 72hr TTL)';


--
-- Name: components; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.components (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    mpn character varying(255) NOT NULL,
    manufacturer_id integer,
    category_id integer,
    description text,
    datasheet_url character varying(1024),
    image_url character varying(1024),
    lifecycle_status character varying(50) DEFAULT 'active'::character varying,
    specifications jsonb DEFAULT '{}'::jsonb,
    category_mouser character varying(512),
    category_digikey character varying(512),
    category_element14 character varying(512),
    rohs_status character varying(50) DEFAULT 'unknown'::character varying,
    rohs_version character varying(20),
    reach_status character varying(50) DEFAULT 'unknown'::character varying,
    reach_svhc_count integer DEFAULT 0,
    conflict_mineral_status character varying(50) DEFAULT 'unknown'::character varying,
    china_rohs_compliant boolean,
    halogen_free boolean,
    eccn_code character varying(50),
    hts_code character varying(50),
    country_of_origin character varying(2),
    package_type character varying(100),
    package_variant character varying(100),
    mounting_type character varying(50),
    pin_count integer,
    length_mm numeric(10,4),
    width_mm numeric(10,4),
    height_mm numeric(10,4),
    pitch_mm numeric(10,4),
    jedec_designation character varying(50),
    msl_level character varying(10),
    msl_peak_temp_c integer,
    lead_free boolean,
    termination_finish character varying(50),
    max_reflow_temp_c integer,
    storage_temp_max_c integer,
    confidence_score integer DEFAULT 0,
    quality_score integer DEFAULT 0,
    data_sources jsonb DEFAULT '[]'::jsonb,
    last_enriched_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT components_confidence_score_check CHECK (((confidence_score >= 0) AND (confidence_score <= 100))),
    CONSTRAINT components_lifecycle_status_check CHECK (((lifecycle_status)::text = ANY ((ARRAY['active'::character varying, 'nrnd'::character varying, 'eol'::character varying, 'obsolete'::character varying, 'preview'::character varying, 'discontinued'::character varying])::text[]))),
    CONSTRAINT components_mounting_type_check CHECK (((mounting_type)::text = ANY ((ARRAY['smd'::character varying, 'through_hole'::character varying, 'chassis'::character varying, 'panel'::character varying, 'wire_lead'::character varying])::text[]))),
    CONSTRAINT components_quality_score_check CHECK (((quality_score >= 0) AND (quality_score <= 100))),
    CONSTRAINT components_reach_status_check CHECK (((reach_status)::text = ANY ((ARRAY['compliant'::character varying, 'contains_svhc'::character varying, 'non_compliant'::character varying, 'unknown'::character varying])::text[]))),
    CONSTRAINT components_rohs_status_check CHECK (((rohs_status)::text = ANY ((ARRAY['compliant'::character varying, 'non_compliant'::character varying, 'exempt'::character varying, 'unknown'::character varying])::text[])))
);


--
-- Name: TABLE components; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.components IS 'Central component catalog - Single Source of Truth (SSOT)';


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
    created_at timestamp with time zone DEFAULT now()
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
            WHEN (redis_component_snapshot.sync_status = 'expired'::text) THEN 'Expired'::text
            WHEN (redis_component_snapshot.expires_at < now()) THEN 'Expired'::text
            WHEN (redis_component_snapshot.expires_at < (now() + '24:00:00'::interval)) THEN 'Expiring Soon'::text
            ELSE 'Temporary'::text
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
-- Name: enrichment_batch_jobs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.enrichment_batch_jobs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid,
    bom_id uuid,
    status character varying(50) DEFAULT 'pending'::character varying NOT NULL,
    total_items integer DEFAULT 0,
    processed_items integer DEFAULT 0,
    successful_items integer DEFAULT 0,
    failed_items integer DEFAULT 0,
    start_time timestamp with time zone,
    end_time timestamp with time zone,
    error_message text,
    temporal_workflow_id text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: enrichment_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.enrichment_config (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid,
    enable_enrichment_audit boolean DEFAULT true,
    tier1_enabled boolean DEFAULT true,
    tier2_enabled boolean DEFAULT true,
    tier3_enabled boolean DEFAULT false,
    tier4_enabled boolean DEFAULT false,
    quality_threshold_redis numeric(5,2) DEFAULT 80.0,
    quality_threshold_catalog numeric(5,2) DEFAULT 95.0,
    supplier_priority jsonb DEFAULT '["mouser", "digikey", "element14"]'::jsonb,
    circuit_breaker_enabled boolean DEFAULT false,
    circuit_breaker_failure_threshold integer DEFAULT 5,
    circuit_breaker_timeout_seconds integer DEFAULT 60,
    circuit_breaker_success_threshold integer DEFAULT 2,
    retry_enabled boolean DEFAULT false,
    retry_max_attempts integer DEFAULT 3,
    retry_initial_delay_seconds numeric(5,2) DEFAULT 1.0,
    retry_exponential_base numeric(5,2) DEFAULT 2.0,
    retry_max_delay_seconds numeric(5,2) DEFAULT 30.0,
    retry_jitter_enabled boolean DEFAULT true,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE enrichment_config; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.enrichment_config IS 'Per-organization enrichment configuration';


--
-- Name: enrichment_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.enrichment_history (
    id integer NOT NULL,
    mpn character varying(255) NOT NULL,
    manufacturer character varying(255),
    enrichment_data jsonb,
    quality_score numeric(5,2),
    status character varying(50) NOT NULL,
    rejection_reason text,
    error_message text,
    issues jsonb DEFAULT '[]'::jsonb,
    enrichment_source character varying(50),
    bom_job_id character varying(100),
    api_calls jsonb DEFAULT '[]'::jsonb,
    processing_time_ms integer,
    tier_reached integer,
    created_at timestamp with time zone DEFAULT now(),
    created_by uuid
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
    mpn text NOT NULL,
    manufacturer text,
    priority integer DEFAULT 5,
    status character varying(50) DEFAULT 'pending'::character varying NOT NULL,
    source character varying(50) DEFAULT 'manual'::character varying,
    organization_id uuid,
    bom_id uuid,
    batch_job_id uuid,
    attempts integer DEFAULT 0,
    last_attempt_at timestamp with time zone,
    error_message text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT enrichment_queue_priority_check CHECK (((priority >= 1) AND (priority <= 10)))
);


--
-- Name: manufacturers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.manufacturers (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    website character varying(512),
    aliases jsonb DEFAULT '[]'::jsonb,
    logo_url character varying(1024),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: TABLE manufacturers; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.manufacturers IS 'Component manufacturers master list';


--
-- Name: manufacturers_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.manufacturers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: manufacturers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.manufacturers_id_seq OWNED BY public.manufacturers.id;


--
-- Name: rate_limit_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rate_limit_config (
    id integer NOT NULL,
    service_name character varying(100) NOT NULL,
    endpoint_pattern character varying(255),
    max_requests_per_minute integer DEFAULT 60,
    max_requests_per_hour integer DEFAULT 1000,
    burst_size integer DEFAULT 10,
    enabled boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
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
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
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
    last_failure_time timestamp with time zone,
    recovery_attempt_time timestamp with time zone,
    opened_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
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
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
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
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
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
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
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
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
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
    last_check timestamp with time zone,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
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
    check_timestamp timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    service_name character varying(50) NOT NULL,
    status character varying(20) NOT NULL,
    response_time_ms integer,
    last_error text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
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
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
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
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
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
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
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
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
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
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
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
    bucket_name character varying(100) NOT NULL,
    cache_path character varying(255),
    ttl_seconds integer DEFAULT 86400 NOT NULL,
    max_file_size_mb integer DEFAULT 100,
    compression_enabled boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
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
    source_service character varying(100) NOT NULL,
    target_service character varying(100) NOT NULL,
    connection_type character varying(50) DEFAULT 'http'::character varying,
    is_required boolean DEFAULT true,
    health_endpoint character varying(255),
    last_check_status character varying(50),
    last_check_time timestamp with time zone,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
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
    id uuid DEFAULT gen_random_uuid() NOT NULL,
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
-- Name: TABLE supplier_enrichment_responses; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.supplier_enrichment_responses IS 'Raw supplier API responses for enrichment jobs';


--
-- Name: supplier_performance_metrics; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.supplier_performance_metrics (
    id integer NOT NULL,
    supplier_id integer,
    supplier_name character varying(100) NOT NULL,
    date date NOT NULL,
    total_requests integer DEFAULT 0,
    successful_requests integer DEFAULT 0,
    failed_requests integer DEFAULT 0,
    avg_response_time_ms integer,
    avg_quality_score numeric(5,2),
    uptime_percentage numeric(5,2),
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
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
    supplier_name character varying(50) NOT NULL,
    requests_per_second integer DEFAULT 10,
    requests_per_minute integer DEFAULT 60,
    requests_per_hour integer DEFAULT 1000,
    concurrent_requests integer DEFAULT 5,
    burst_limit integer DEFAULT 20,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
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
    supplier_id integer,
    supplier_name character varying(100) NOT NULL,
    enabled boolean DEFAULT true,
    priority integer DEFAULT 5,
    timeout_ms integer DEFAULT 30000,
    retry_count integer DEFAULT 3,
    rate_limit_per_minute integer DEFAULT 60,
    custom_settings jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
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
-- Name: TABLE supplier_tokens; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.supplier_tokens IS 'OAuth tokens for supplier APIs (DigiKey, Mouser, etc.)';


--
-- Name: suppliers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.suppliers (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    website character varying(512),
    api_enabled boolean DEFAULT false,
    api_key_env_var character varying(100),
    rate_limit_per_minute integer DEFAULT 60,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: TABLE suppliers; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.suppliers IS 'Component suppliers/distributors';


--
-- Name: suppliers_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.suppliers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: suppliers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.suppliers_id_seq OWNED BY public.suppliers.id;


--
-- Name: vendor_category_mappings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vendor_category_mappings (
    id integer NOT NULL,
    vendor character varying(50) NOT NULL,
    vendor_category_path character varying(1024) NOT NULL,
    canonical_category_id integer,
    confidence_score numeric(5,4) DEFAULT 0.0,
    is_verified boolean DEFAULT false,
    match_count integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: TABLE vendor_category_mappings; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.vendor_category_mappings IS 'Maps vendor categories to canonical taxonomy';


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
-- Name: ai_prompts id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_prompts ALTER COLUMN id SET DEFAULT nextval('public.ai_prompts_id_seq'::regclass);


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
-- Name: cns_enrichment_config id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cns_enrichment_config ALTER COLUMN id SET DEFAULT nextval('public.cns_enrichment_config_id_seq'::regclass);


--
-- Name: cns_supplier_settings id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cns_supplier_settings ALTER COLUMN id SET DEFAULT nextval('public.cns_supplier_settings_id_seq'::regclass);


--
-- Name: component_pricing id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.component_pricing ALTER COLUMN id SET DEFAULT nextval('public.component_pricing_id_seq'::regclass);


--
-- Name: enrichment_history id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.enrichment_history ALTER COLUMN id SET DEFAULT nextval('public.enrichment_history_id_seq'::regclass);


--
-- Name: manufacturers id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.manufacturers ALTER COLUMN id SET DEFAULT nextval('public.manufacturers_id_seq'::regclass);


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
-- Name: suppliers id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.suppliers ALTER COLUMN id SET DEFAULT nextval('public.suppliers_id_seq'::regclass);


--
-- Name: vendor_category_mappings id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendor_category_mappings ALTER COLUMN id SET DEFAULT nextval('public.vendor_category_mappings_id_seq'::regclass);


--
-- Name: ai_prompts ai_prompts_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_prompts
    ADD CONSTRAINT ai_prompts_name_key UNIQUE (name);


--
-- Name: ai_prompts ai_prompts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_prompts
    ADD CONSTRAINT ai_prompts_pkey PRIMARY KEY (id);


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
-- Name: audit_supplier_quality audit_supplier_quality_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_supplier_quality
    ADD CONSTRAINT audit_supplier_quality_pkey PRIMARY KEY (id);


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
-- Name: catalog_categories catalog_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.catalog_categories
    ADD CONSTRAINT catalog_categories_pkey PRIMARY KEY (id);


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
-- Name: catalog_components_table catalog_components_table_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.catalog_components_table
    ADD CONSTRAINT catalog_components_table_pkey PRIMARY KEY (id);


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
-- Name: column_mapping_templates column_mapping_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.column_mapping_templates
    ADD CONSTRAINT column_mapping_templates_pkey PRIMARY KEY (id);


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
-- Name: component_pricing component_pricing_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.component_pricing
    ADD CONSTRAINT component_pricing_pkey PRIMARY KEY (id);


--
-- Name: component_storage_tracking component_storage_tracking_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.component_storage_tracking
    ADD CONSTRAINT component_storage_tracking_pkey PRIMARY KEY (id);


--
-- Name: components components_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.components
    ADD CONSTRAINT components_pkey PRIMARY KEY (id);


--
-- Name: enrichment_batch_jobs enrichment_batch_jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.enrichment_batch_jobs
    ADD CONSTRAINT enrichment_batch_jobs_pkey PRIMARY KEY (id);


--
-- Name: enrichment_config enrichment_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.enrichment_config
    ADD CONSTRAINT enrichment_config_pkey PRIMARY KEY (id);


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
-- Name: redis_circuit_breakers redis_circuit_breakers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.redis_circuit_breakers
    ADD CONSTRAINT redis_circuit_breakers_pkey PRIMARY KEY (id);


--
-- Name: redis_cns_config redis_cns_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.redis_cns_config
    ADD CONSTRAINT redis_cns_config_pkey PRIMARY KEY (id);


--
-- Name: redis_component_cache_config redis_component_cache_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.redis_component_cache_config
    ADD CONSTRAINT redis_component_cache_config_pkey PRIMARY KEY (id);


--
-- Name: redis_component_snapshot redis_component_snapshot_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.redis_component_snapshot
    ADD CONSTRAINT redis_component_snapshot_pkey PRIMARY KEY (id);


--
-- Name: redis_connection_config redis_connection_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.redis_connection_config
    ADD CONSTRAINT redis_connection_config_pkey PRIMARY KEY (id);


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
-- Name: service_connectivity_matrix service_connectivity_matrix_source_service_target_service_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_connectivity_matrix
    ADD CONSTRAINT service_connectivity_matrix_source_service_target_service_key UNIQUE (source_service, target_service);


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
-- Name: supplier_performance_metrics supplier_performance_metrics_supplier_name_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supplier_performance_metrics
    ADD CONSTRAINT supplier_performance_metrics_supplier_name_date_key UNIQUE (supplier_name, date);


--
-- Name: supplier_rate_limits supplier_rate_limits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supplier_rate_limits
    ADD CONSTRAINT supplier_rate_limits_pkey PRIMARY KEY (id);


--
-- Name: supplier_rate_limits supplier_rate_limits_supplier_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supplier_rate_limits
    ADD CONSTRAINT supplier_rate_limits_supplier_name_key UNIQUE (supplier_name);


--
-- Name: supplier_settings supplier_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supplier_settings
    ADD CONSTRAINT supplier_settings_pkey PRIMARY KEY (id);


--
-- Name: supplier_settings supplier_settings_supplier_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supplier_settings
    ADD CONSTRAINT supplier_settings_supplier_name_key UNIQUE (supplier_name);


--
-- Name: supplier_tokens supplier_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supplier_tokens
    ADD CONSTRAINT supplier_tokens_pkey PRIMARY KEY (supplier_name);


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
-- Name: components unique_mpn_manufacturer; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.components
    ADD CONSTRAINT unique_mpn_manufacturer UNIQUE (mpn, manufacturer_id);


--
-- Name: vendor_category_mappings unique_vendor_category; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendor_category_mappings
    ADD CONSTRAINT unique_vendor_category UNIQUE (vendor, vendor_category_path);


--
-- Name: audit_supplier_quality uq_audit_supplier_quality_date_supplier; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_supplier_quality
    ADD CONSTRAINT uq_audit_supplier_quality_date_supplier UNIQUE (date, supplier_name);


--
-- Name: component_catalog uq_component_catalog_mpn_mfr; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.component_catalog
    ADD CONSTRAINT uq_component_catalog_mpn_mfr UNIQUE (manufacturer_part_number, manufacturer);


--
-- Name: column_mapping_templates uq_org_template_name; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.column_mapping_templates
    ADD CONSTRAINT uq_org_template_name UNIQUE (organization_id, name);


--
-- Name: vendor_category_mappings vendor_category_mappings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendor_category_mappings
    ADD CONSTRAINT vendor_category_mappings_pkey PRIMARY KEY (id);


--
-- Name: idx_audit_enrichment_runs_line_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_enrichment_runs_line_id ON public.audit_enrichment_runs USING btree (line_id);


--
-- Name: idx_audit_enrichment_runs_mpn; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_enrichment_runs_mpn ON public.audit_enrichment_runs USING btree (mpn);


--
-- Name: idx_audit_enrichment_runs_needs_review; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_enrichment_runs_needs_review ON public.audit_enrichment_runs USING btree (needs_review) WHERE (needs_review = true);


--
-- Name: idx_audit_enrichment_runs_quality; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_enrichment_runs_quality ON public.audit_enrichment_runs USING btree (quality_score);


--
-- Name: idx_audit_enrichment_runs_supplier; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_enrichment_runs_supplier ON public.audit_enrichment_runs USING btree (supplier_name);


--
-- Name: idx_audit_enrichment_runs_timestamp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_enrichment_runs_timestamp ON public.audit_enrichment_runs USING btree (enrichment_timestamp);


--
-- Name: idx_audit_enrichment_runs_upload_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_enrichment_runs_upload_id ON public.audit_enrichment_runs USING btree (upload_id);


--
-- Name: idx_audit_field_comparisons_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_field_comparisons_category ON public.audit_field_comparisons USING btree (field_category);


--
-- Name: idx_audit_field_comparisons_changed; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_field_comparisons_changed ON public.audit_field_comparisons USING btree (changed);


--
-- Name: idx_audit_field_comparisons_field; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_field_comparisons_field ON public.audit_field_comparisons USING btree (field_name);


--
-- Name: idx_audit_field_comparisons_run; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_field_comparisons_run ON public.audit_field_comparisons USING btree (enrichment_run_id);


--
-- Name: idx_audit_supplier_quality_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_supplier_quality_date ON public.audit_supplier_quality USING btree (date);


--
-- Name: idx_audit_supplier_quality_supplier; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_supplier_quality_supplier ON public.audit_supplier_quality USING btree (supplier_name);


--
-- Name: idx_catalog_categories_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_catalog_categories_name ON public.catalog_categories USING btree (name);


--
-- Name: idx_catalog_categories_parent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_catalog_categories_parent ON public.catalog_categories USING btree (parent_id);


--
-- Name: idx_catalog_category_mappings_vendor; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_catalog_category_mappings_vendor ON public.catalog_category_mappings USING btree (vendor_name, vendor_category);


--
-- Name: idx_catalog_components_table_manufacturer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_catalog_components_table_manufacturer ON public.catalog_components_table USING btree (manufacturer);


--
-- Name: idx_catalog_components_table_mpn; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_catalog_components_table_mpn ON public.catalog_components_table USING btree (mpn);


--
-- Name: idx_catalog_manufacturers_name; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_catalog_manufacturers_name ON public.catalog_manufacturers USING btree (name);


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
-- Name: idx_categories_path; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_categories_path ON public.categories USING btree (path);


--
-- Name: idx_cns_config_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cns_config_category ON public.cns_enrichment_config USING btree (category);


--
-- Name: idx_cns_config_key; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cns_config_key ON public.cns_enrichment_config USING btree (config_key);


--
-- Name: idx_column_mapping_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_column_mapping_created ON public.column_mapping_templates USING btree (created_at);


--
-- Name: idx_column_mapping_default; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_column_mapping_default ON public.column_mapping_templates USING btree (organization_id, is_default) WHERE (is_default = true);


--
-- Name: idx_column_mapping_mappings; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_column_mapping_mappings ON public.column_mapping_templates USING gin (mappings);


--
-- Name: idx_column_mapping_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_column_mapping_org ON public.column_mapping_templates USING btree (organization_id);


--
-- Name: idx_component_catalog_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_component_catalog_category ON public.component_catalog USING btree (category);


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
-- Name: idx_component_catalog_quality; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_component_catalog_quality ON public.component_catalog USING btree (quality_score);


--
-- Name: idx_component_catalog_specs; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_component_catalog_specs ON public.component_catalog USING gin (specifications);


--
-- Name: idx_component_catalog_supplier_data; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_component_catalog_supplier_data ON public.component_catalog USING gin (supplier_data);


--
-- Name: idx_component_catalog_usage; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_component_catalog_usage ON public.component_catalog USING btree (usage_count DESC);


--
-- Name: idx_component_lifecycle_mpn; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_component_lifecycle_mpn ON public.component_lifecycle USING btree (mpn);


--
-- Name: idx_component_lifecycle_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_component_lifecycle_status ON public.component_lifecycle USING btree (lifecycle_status);


--
-- Name: idx_component_storage_tracking_location; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_component_storage_tracking_location ON public.component_storage_tracking USING btree (storage_location);


--
-- Name: idx_component_storage_tracking_mpn; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_component_storage_tracking_mpn ON public.component_storage_tracking USING btree (manufacturer_part_number);


--
-- Name: idx_components_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_components_category ON public.components USING btree (category_id);


--
-- Name: idx_components_confidence; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_components_confidence ON public.components USING btree (confidence_score);


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

CREATE INDEX idx_components_mpn ON public.components USING btree (mpn);


--
-- Name: idx_components_quality; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_components_quality ON public.components USING btree (quality_score);


--
-- Name: idx_components_specs; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_components_specs ON public.components USING gin (specifications);


--
-- Name: idx_enrichment_batch_jobs_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_enrichment_batch_jobs_org ON public.enrichment_batch_jobs USING btree (organization_id);


--
-- Name: idx_enrichment_batch_jobs_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_enrichment_batch_jobs_status ON public.enrichment_batch_jobs USING btree (status);


--
-- Name: idx_enrichment_history_mpn; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_enrichment_history_mpn ON public.enrichment_history USING btree (mpn);


--
-- Name: idx_enrichment_history_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_enrichment_history_status ON public.enrichment_history USING btree (status);


--
-- Name: idx_enrichment_queue_priority; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_enrichment_queue_priority ON public.enrichment_queue USING btree (priority DESC);


--
-- Name: idx_enrichment_queue_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_enrichment_queue_status ON public.enrichment_queue USING btree (status);


--
-- Name: idx_manufacturers_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_manufacturers_name ON public.manufacturers USING btree (name);


--
-- Name: idx_pricing_component; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pricing_component ON public.component_pricing USING btree (component_id);


--
-- Name: idx_pricing_supplier; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pricing_supplier ON public.component_pricing USING btree (supplier_id);


--
-- Name: idx_redis_component_snapshot_mpn; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_redis_component_snapshot_mpn ON public.redis_component_snapshot USING btree (mpn);


--
-- Name: idx_redis_component_snapshot_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_redis_component_snapshot_status ON public.redis_component_snapshot USING btree (sync_status);


--
-- Name: idx_supplier_performance_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_supplier_performance_date ON public.supplier_performance_metrics USING btree (date);


--
-- Name: idx_supplier_responses_job; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_supplier_responses_job ON public.supplier_enrichment_responses USING btree (job_id);


--
-- Name: idx_supplier_responses_line; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_supplier_responses_line ON public.supplier_enrichment_responses USING btree (line_id);


--
-- Name: idx_supplier_tokens_expires_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_supplier_tokens_expires_at ON public.supplier_tokens USING btree (expires_at) WHERE (expires_at IS NOT NULL);


--
-- Name: idx_suppliers_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_suppliers_name ON public.suppliers USING btree (name);


--
-- Name: idx_vcm_canonical; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vcm_canonical ON public.vendor_category_mappings USING btree (canonical_category_id);


--
-- Name: idx_vcm_vendor; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vcm_vendor ON public.vendor_category_mappings USING btree (vendor);


--
-- Name: audit_enrichment_runs audit_enrichment_runs_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_enrichment_runs_updated_at BEFORE UPDATE ON public.audit_enrichment_runs FOR EACH ROW EXECUTE FUNCTION public.update_modified_timestamp();


--
-- Name: audit_supplier_quality audit_supplier_quality_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_supplier_quality_updated_at BEFORE UPDATE ON public.audit_supplier_quality FOR EACH ROW EXECUTE FUNCTION public.update_modified_timestamp();


--
-- Name: column_mapping_templates trg_column_mapping_templates_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_column_mapping_templates_updated_at BEFORE UPDATE ON public.column_mapping_templates FOR EACH ROW EXECUTE FUNCTION public.update_column_mapping_templates_updated_at();


--
-- Name: component_catalog trg_component_catalog_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_component_catalog_updated_at BEFORE UPDATE ON public.component_catalog FOR EACH ROW EXECUTE FUNCTION public.update_component_catalog_updated_at();


--
-- Name: column_mapping_templates trg_ensure_single_default_template; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_ensure_single_default_template BEFORE INSERT OR UPDATE ON public.column_mapping_templates FOR EACH ROW EXECUTE FUNCTION public.ensure_single_default_template();


--
-- Name: categories update_categories_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_categories_updated_at BEFORE UPDATE ON public.categories FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: component_pricing update_component_pricing_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_component_pricing_updated_at BEFORE UPDATE ON public.component_pricing FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: components update_components_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_components_updated_at BEFORE UPDATE ON public.components FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: manufacturers update_manufacturers_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_manufacturers_updated_at BEFORE UPDATE ON public.manufacturers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: suppliers update_suppliers_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_suppliers_updated_at BEFORE UPDATE ON public.suppliers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: audit_field_comparisons audit_field_comparisons_enrichment_run_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_field_comparisons
    ADD CONSTRAINT audit_field_comparisons_enrichment_run_id_fkey FOREIGN KEY (enrichment_run_id) REFERENCES public.audit_enrichment_runs(id) ON DELETE CASCADE;


--
-- Name: catalog_categories catalog_categories_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.catalog_categories
    ADD CONSTRAINT catalog_categories_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.catalog_categories(id);


--
-- Name: catalog_category_mappings catalog_category_mappings_normalized_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.catalog_category_mappings
    ADD CONSTRAINT catalog_category_mappings_normalized_category_id_fkey FOREIGN KEY (normalized_category_id) REFERENCES public.catalog_categories(id);


--
-- Name: categories categories_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.categories(id) ON DELETE CASCADE;


--
-- Name: component_lifecycle component_lifecycle_component_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.component_lifecycle
    ADD CONSTRAINT component_lifecycle_component_id_fkey FOREIGN KEY (component_id) REFERENCES public.components(id) ON DELETE CASCADE;


--
-- Name: component_pricing component_pricing_component_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.component_pricing
    ADD CONSTRAINT component_pricing_component_id_fkey FOREIGN KEY (component_id) REFERENCES public.components(id) ON DELETE CASCADE;


--
-- Name: component_pricing component_pricing_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.component_pricing
    ADD CONSTRAINT component_pricing_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id) ON DELETE CASCADE;


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
-- Name: enrichment_queue enrichment_queue_batch_job_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.enrichment_queue
    ADD CONSTRAINT enrichment_queue_batch_job_id_fkey FOREIGN KEY (batch_job_id) REFERENCES public.enrichment_batch_jobs(id);


--
-- Name: supplier_performance_metrics supplier_performance_metrics_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supplier_performance_metrics
    ADD CONSTRAINT supplier_performance_metrics_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id);


--
-- Name: supplier_settings supplier_settings_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supplier_settings
    ADD CONSTRAINT supplier_settings_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id);


--
-- Name: vendor_category_mappings vendor_category_mappings_canonical_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendor_category_mappings
    ADD CONSTRAINT vendor_category_mappings_canonical_category_id_fkey FOREIGN KEY (canonical_category_id) REFERENCES public.categories(id) ON DELETE SET NULL;


--
-- PostgreSQL database dump complete
--

\unrestrict RNHiPewQ1lDAaT2TiJyNS2p0kyRpchqSU6Ph4gf4hTPjDfgkzWR10ey8YhoOCA5

