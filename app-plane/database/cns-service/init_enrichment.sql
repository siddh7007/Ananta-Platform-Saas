--
-- PostgreSQL database dump
--

\restrict buXFgnFQchFFgMlSxNnhlSgW0X1pizCJjr2H2f6bzqppy2Pqoqpr3kor6vU4IO6

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
-- Name: enrichment_status_tracking unique_component_source; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.enrichment_status_tracking
    ADD CONSTRAINT unique_component_source UNIQUE (component_id, enrichment_source_id);


--
-- Name: enrichment_cost_tracking unique_source_month; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.enrichment_cost_tracking
    ADD CONSTRAINT unique_source_month UNIQUE (enrichment_source_id, month);


--
-- Name: audit_enrichment_runs_name_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_enrichment_runs_name_index ON public.audit_enrichment_runs USING btree (name);


--
-- Name: audit_field_comparisons_name_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_field_comparisons_name_index ON public.audit_field_comparisons USING btree (name);


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
-- Name: idx_enrichment_batch_source; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_enrichment_batch_source ON public.enrichment_batch_jobs USING btree (enrichment_source_id);


--
-- Name: idx_enrichment_batch_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_enrichment_batch_status ON public.enrichment_batch_jobs USING btree (status);


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
-- Name: audit_field_comparisons audit_field_comparisons_enrichment_run_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_field_comparisons
    ADD CONSTRAINT audit_field_comparisons_enrichment_run_id_fkey FOREIGN KEY (enrichment_run_id) REFERENCES public.audit_enrichment_runs(id) ON DELETE CASCADE;


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
-- PostgreSQL database dump complete
--

\unrestrict buXFgnFQchFFgMlSxNnhlSgW0X1pizCJjr2H2f6bzqppy2Pqoqpr3kor6vU4IO6

