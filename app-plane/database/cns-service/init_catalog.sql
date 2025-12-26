--
-- PostgreSQL database dump
--

\restrict ZJhkJ9Hu5ApdvGsdRX4xojMmDgcP1kCZPbty49dkADRrN7NplQ6wipXnqaz1Zt5

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
-- Name: categories id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories ALTER COLUMN id SET DEFAULT nextval('public.categories_id_seq'::regclass);


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
-- Name: component_lifecycle unique_component_lifecycle; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.component_lifecycle
    ADD CONSTRAINT unique_component_lifecycle UNIQUE (component_id);


--
-- Name: component_stock_levels unique_component_supplier_stock; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.component_stock_levels
    ADD CONSTRAINT unique_component_supplier_stock UNIQUE (component_id, supplier_id);


--
-- Name: component_substitution_rules unique_substitution; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.component_substitution_rules
    ADD CONSTRAINT unique_substitution UNIQUE (primary_component_id, substitute_component_id);


--
-- Name: component_catalog uq_component_catalog_mpn_mfr; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.component_catalog
    ADD CONSTRAINT uq_component_catalog_mpn_mfr UNIQUE (manufacturer_part_number, manufacturer);


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
-- Name: component_catalog tr_component_catalog_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tr_component_catalog_updated_at BEFORE UPDATE ON public.component_catalog FOR EACH ROW EXECUTE FUNCTION public.update_component_catalog_updated_at();


--
-- Name: component_storage_tracking tr_storage_tracking_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tr_storage_tracking_updated_at BEFORE UPDATE ON public.component_storage_tracking FOR EACH ROW EXECUTE FUNCTION public.update_storage_tracking_updated_at();


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
-- PostgreSQL database dump complete
--

\unrestrict ZJhkJ9Hu5ApdvGsdRX4xojMmDgcP1kCZPbty49dkADRrN7NplQ6wipXnqaz1Zt5

