--
-- PostgreSQL database dump
--

\restrict SeRXaFluIh3fXGZrWwTxjflBzDuQRustxWoLpIcVmFhNGXwtucbalcnfLy9AhdI

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

SET default_tablespace = '';

SET default_table_access_method = heap;

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
-- Name: cns_cache_config id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cns_cache_config ALTER COLUMN id SET DEFAULT nextval('public.cns_cache_config_id_seq'::regclass);


--
-- Name: cns_supplier_settings id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cns_supplier_settings ALTER COLUMN id SET DEFAULT nextval('public.cns_supplier_settings_id_seq'::regclass);


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
-- Name: idx_cns_cache_config_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cns_cache_config_type ON public.cns_cache_config USING btree (cache_type);


--
-- Name: idx_config_history_key; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_config_history_key ON public.cns_enrichment_config_history USING btree (config_key, changed_at DESC);


--
-- Name: idx_config_history_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_config_history_user ON public.cns_enrichment_config_history USING btree (changed_by, changed_at DESC);


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
-- Name: redis_component_snapshot_name_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX redis_component_snapshot_name_index ON public.redis_component_snapshot USING btree (name);


--
-- Name: cns_supplier_settings supplier_settings_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER supplier_settings_updated_at BEFORE UPDATE ON public.cns_supplier_settings FOR EACH ROW EXECUTE FUNCTION public.update_supplier_settings_timestamp();


--
-- Name: cns_enrichment_config trg_enrichment_config_changes; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_enrichment_config_changes BEFORE UPDATE ON public.cns_enrichment_config FOR EACH ROW WHEN ((old.config_value IS DISTINCT FROM new.config_value)) EXECUTE FUNCTION public.track_enrichment_config_changes();


--
-- Name: cns_enrichment_config trg_validate_enrichment_config; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_validate_enrichment_config BEFORE INSERT OR UPDATE ON public.cns_enrichment_config FOR EACH ROW EXECUTE FUNCTION public.validate_enrichment_config();


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
-- PostgreSQL database dump complete
--

\unrestrict SeRXaFluIh3fXGZrWwTxjflBzDuQRustxWoLpIcVmFhNGXwtucbalcnfLy9AhdI

