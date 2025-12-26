-- ==========================================
-- Components-V2 Database - Master Migration (Full Schema with DigiKey Categories)
-- ==========================================
-- Generated from live database: 2025-12-09
-- Database: components_v2 (port 27010)
-- Tables: categories, cns_enrichment_config, component_pricing, components, manufacturers, suppliers, vendor_category_mappings
-- Contains: 1,200 DigiKey categories (50 L1, 644 L2, 483 L3, 23 L4)
-- Note: \restrict/\unrestrict lines are psql security markers and can be ignored
-- ==========================================

--
-- PostgreSQL database dump
--

\restrict iYd5OgOScejjnprjyJrOabwBAlAoDxLiheudbYMbgriGYlsKbu2gQL8EjlYufsi

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
-- Name: categories id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories ALTER COLUMN id SET DEFAULT nextval('public.categories_id_seq'::regclass);


--
-- Name: cns_enrichment_config id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cns_enrichment_config ALTER COLUMN id SET DEFAULT nextval('public.cns_enrichment_config_id_seq'::regclass);


--
-- Name: component_pricing id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.component_pricing ALTER COLUMN id SET DEFAULT nextval('public.component_pricing_id_seq'::regclass);


--
-- Name: manufacturers id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.manufacturers ALTER COLUMN id SET DEFAULT nextval('public.manufacturers_id_seq'::regclass);


--
-- Name: suppliers id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.suppliers ALTER COLUMN id SET DEFAULT nextval('public.suppliers_id_seq'::regclass);


--
-- Name: vendor_category_mappings id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendor_category_mappings ALTER COLUMN id SET DEFAULT nextval('public.vendor_category_mappings_id_seq'::regclass);


--
-- Data for Name: categories; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.categories VALUES (1, 'Anti-Static, ESD, Clean Room Products', NULL, 28, 1, 'Anti-Static, ESD, Clean Room Products', 8247, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (2, 'Audio Products', NULL, 10, 1, 'Audio Products', 11915, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (3, 'Battery Products', NULL, 6, 1, 'Battery Products', 8766, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (4, 'Boxes, Enclosures, Racks', NULL, 27, 1, 'Boxes, Enclosures, Racks', 91243, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (5, 'Cable Assemblies', NULL, 21, 1, 'Cable Assemblies', 1031917, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (6, 'Cables, Wires', NULL, 22, 1, 'Cables, Wires', 94721, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (7, 'Cables, Wires - Management', NULL, 23, 1, 'Cables, Wires - Management', 113355, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (8, 'Capacitors', NULL, 3, 1, 'Capacitors', 1319711, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (9, 'Circuit Protection', NULL, 9, 1, 'Circuit Protection', 299391, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (10, 'Computer Equipment', NULL, 38, 1, 'Computer Equipment', 12766, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (11, 'Connectors, Interconnects', NULL, 20, 1, 'Connectors, Interconnects', 5379166, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (12, 'Crystals, Oscillators, Resonators', NULL, 12, 1, 'Crystals, Oscillators, Resonators', 740455, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (13, 'Development Boards, Kits, Programmers', NULL, 33, 1, 'Development Boards, Kits, Programmers', 68708, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (14, 'Discrete Semiconductor Products', NULL, 19, 1, 'Discrete Semiconductor Products', 255073, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (15, 'Embedded Computers', NULL, 45, 1, 'Embedded Computers', 8525, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (16, 'Fans, Blowers, Thermal Management', NULL, 16, 1, 'Fans, Blowers, Thermal Management', 175434, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (17, 'Filters', NULL, 36, 1, 'Filters', 47652, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (18, 'Hardware, Fasteners, Accessories', NULL, 26, 1, 'Hardware, Fasteners, Accessories', 145703, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (19, 'Inductors, Coils, Chokes', NULL, 4, 1, 'Inductors, Coils, Chokes', 157717, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (20, 'Industrial Automation and Controls', NULL, 34, 1, 'Industrial Automation and Controls', 281448, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (21, 'Industrial Supplies', NULL, 49, 1, 'Industrial Supplies', 14482, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (22, 'Integrated Circuits (ICs)', NULL, 32, 1, 'Integrated Circuits (ICs)', 641883, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (23, 'Isolators', NULL, 39, 1, 'Isolators', 26780, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (24, 'Kits', NULL, 31, 1, 'Kits', 19658, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (25, 'Labels, Signs, Barriers, Identification', NULL, 980, 1, 'Labels, Signs, Barriers, Identification', 42944, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (26, 'Line Protection, Distribution, Backups', NULL, 35, 1, 'Line Protection, Distribution, Backups', 13882, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (27, 'Magnetics - Transformer, Inductor Components', NULL, 46, 1, 'Magnetics - Transformer, Inductor Components', 14008, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (28, 'Maker/DIY, Educational', NULL, 47, 1, 'Maker/DIY, Educational', 2946, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (29, 'Memory - Modules, Cards', NULL, 24, 1, 'Memory - Modules, Cards', 15697, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (30, 'Motors, Actuators, Solenoids and Drivers', NULL, 13, 1, 'Motors, Actuators, Solenoids and Drivers', 44772, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (31, 'Networking Solutions', NULL, 44, 1, 'Networking Solutions', 26835, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (32, 'Optical Inspection Equipment', NULL, 42, 1, 'Optical Inspection Equipment', 4156, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (33, 'Optics', NULL, 41, 1, 'Optics', 2064, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (34, 'Optoelectronics', NULL, 7, 1, 'Optoelectronics', 242244, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (35, 'Potentiometers, Variable Resistors', NULL, 5, 1, 'Potentiometers, Variable Resistors', 715354, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (36, 'Power Supplies - Board Mount', NULL, 43, 1, 'Power Supplies - Board Mount', 113040, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (37, 'Power Supplies - External/Internal (Off-Board)', NULL, 8, 1, 'Power Supplies - External/Internal (Off-Board)', 118834, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (38, 'Prototyping, Fabrication Products', NULL, 30, 1, 'Prototyping, Fabrication Products', 7001, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (39, 'Relays', NULL, 14, 1, 'Relays', 84331, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (40, 'Resistors', NULL, 2, 1, 'Resistors', 1771516, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (41, 'RF and Wireless', NULL, 37, 1, 'RF and Wireless', 104974, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (42, 'Safety Products', NULL, 2116, 1, 'Safety Products', 29372, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (43, 'Sensors, Transducers', NULL, 25, 1, 'Sensors, Transducers', 170335, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (44, 'Soldering, Desoldering, Rework Products', NULL, 18, 1, 'Soldering, Desoldering, Rework Products', 13785, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (45, 'Switches', NULL, 15, 1, 'Switches', 294709, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (46, 'Tapes, Adhesives, Materials', NULL, 40, 1, 'Tapes, Adhesives, Materials', 46392, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (47, 'Test and Measurement', NULL, 29, 1, 'Test and Measurement', 39528, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (48, 'Tools', NULL, 17, 1, 'Tools', 190072, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (49, 'Transformers', NULL, 11, 1, 'Transformers', 19758, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (50, 'Uncategorized', NULL, 1, 1, 'Uncategorized', 222339, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (51, 'Anti-Static, ESD Bags, Materials', 1, 605, 2, 'Anti-Static, ESD, Clean Room Products > Anti-Static, ESD Bags, Materials', 1267, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (52, 'Anti-Static, ESD Clothing', 1, 610, 2, 'Anti-Static, ESD, Clean Room Products > Anti-Static, ESD Clothing', 1044, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (53, 'Anti-Static, ESD Device Containers', 1, 607, 2, 'Anti-Static, ESD, Clean Room Products > Anti-Static, ESD Device Containers', 1198, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (54, 'Anti-Static, ESD Grounding Mats', 1, 606, 2, 'Anti-Static, ESD, Clean Room Products > Anti-Static, ESD Grounding Mats', 1179, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (55, 'Anti-Static, ESD Straps, Grounding Cords', 1, 604, 2, 'Anti-Static, ESD, Clean Room Products > Anti-Static, ESD Straps, Grounding Cords', 694, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (56, 'Anti-Static, ESD, Clean Room Accessories', 1, 603, 2, 'Anti-Static, ESD, Clean Room Products > Anti-Static, ESD, Clean Room Accessories', 1202, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (57, 'Clean Room Swabs and Brushes', 1, 611, 2, 'Anti-Static, ESD, Clean Room Products > Clean Room Swabs and Brushes', 320, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (58, 'Clean Room Treatments, Cleaners, Wipes', 1, 608, 2, 'Anti-Static, ESD, Clean Room Products > Clean Room Treatments, Cleaners, Wipes', 413, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (59, 'Ionizer Equipment', 1, 609, 2, 'Anti-Static, ESD, Clean Room Products > Ionizer Equipment', 228, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (60, 'Modular ESD Desks, Workstations', 1, 1016, 2, 'Anti-Static, ESD, Clean Room Products > Modular ESD Desks, Workstations', 333, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (61, 'Monitors, Testers', 1, 612, 2, 'Anti-Static, ESD, Clean Room Products > Monitors, Testers', 369, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (62, 'Accessories', 2, 159, 2, 'Audio Products > Accessories', 612, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (63, 'Alarms, Buzzers, and Sirens', 2, 157, 2, 'Audio Products > Alarms, Buzzers, and Sirens', 6433, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (64, 'Amplifiers', 2, 998, 2, 'Audio Products > Amplifiers', 31, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (65, 'Buzzer Elements, Piezo Benders', 2, 160, 2, 'Audio Products > Buzzer Elements, Piezo Benders', 272, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (66, 'Guitar Parts, Accessories', 2, 1001, 2, 'Audio Products > Guitar Parts, Accessories', 1, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (67, 'Microphones', 2, 158, 2, 'Audio Products > Microphones', 1508, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (68, 'Speakers', 2, 156, 2, 'Audio Products > Speakers', 3058, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (69, 'Batteries Non-Rechargeable (Primary)', 3, 90, 2, 'Battery Products > Batteries Non-Rechargeable (Primary)', 1789, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (70, 'Batteries Rechargeable (Secondary)', 3, 91, 2, 'Battery Products > Batteries Rechargeable (Secondary)', 1887, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (71, 'Battery Chargers', 3, 85, 2, 'Battery Products > Battery Chargers', 799, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (72, 'Battery Holders, Clips, Contacts', 3, 86, 2, 'Battery Products > Battery Holders, Clips, Contacts', 1860, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (73, 'Battery Packs', 3, 89, 2, 'Battery Products > Battery Packs', 1720, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (74, 'Battery Product Accessories', 3, 87, 2, 'Battery Products > Battery Product Accessories', 631, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (75, 'Cigarette Lighter Assemblies', 3, 88, 2, 'Battery Products > Cigarette Lighter Assemblies', 80, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (76, 'Backplanes', 4, 589, 2, 'Boxes, Enclosures, Racks > Backplanes', 129, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (77, 'Box Accessories', 4, 595, 2, 'Boxes, Enclosures, Racks > Box Accessories', 10796, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (78, 'Box Components', 4, 596, 2, 'Boxes, Enclosures, Racks > Box Components', 5765, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (79, 'Boxes', 4, 594, 2, 'Boxes, Enclosures, Racks > Boxes', 28513, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (80, 'Cams', 4, 960, 2, 'Boxes, Enclosures, Racks > Cams', 66, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (81, 'Card Guide Accessories', 4, 600, 2, 'Boxes, Enclosures, Racks > Card Guide Accessories', 612, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (82, 'Card Guides', 4, 591, 2, 'Boxes, Enclosures, Racks > Card Guides', 726, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (83, 'Card Rack Accessories', 4, 601, 2, 'Boxes, Enclosures, Racks > Card Rack Accessories', 403, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (84, 'Card Racks', 4, 588, 2, 'Boxes, Enclosures, Racks > Card Racks', 275, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (85, 'Evaluation, Development Board Enclosures', 4, 975, 2, 'Boxes, Enclosures, Racks > Evaluation, Development Board Enclosures', 786, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (86, 'Handles', 4, 590, 2, 'Boxes, Enclosures, Racks > Handles', 9824, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (87, 'Latches, Locks', 4, 973, 2, 'Boxes, Enclosures, Racks > Latches, Locks', 1194, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (88, 'Patchbay, Jack Panel Accessories', 4, 593, 2, 'Boxes, Enclosures, Racks > Patchbay, Jack Panel Accessories', 569, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (89, 'Patchbay, Jack Panels', 4, 592, 2, 'Boxes, Enclosures, Racks > Patchbay, Jack Panels', 2386, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (90, 'Rack Accessories', 4, 598, 2, 'Boxes, Enclosures, Racks > Rack Accessories', 13925, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (91, 'Rack Components', 4, 599, 2, 'Boxes, Enclosures, Racks > Rack Components', 6518, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (92, 'Rack Thermal Management', 4, 602, 2, 'Boxes, Enclosures, Racks > Rack Thermal Management', 3817, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (93, 'Racks', 4, 597, 2, 'Boxes, Enclosures, Racks > Racks', 4139, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (94, 'Storage', 4, 1097, 2, 'Boxes, Enclosures, Racks > Storage', 749, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (95, 'Storage Accessories', 4, 1098, 2, 'Boxes, Enclosures, Racks > Storage Accessories', 51, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (96, 'Barrel Connector Cables', 5, 2038, 2, 'Cable Assemblies > Barrel Connector Cables', 2127, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (97, 'Between Series Adapter Cables', 5, 459, 2, 'Cable Assemblies > Between Series Adapter Cables', 6078, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (98, 'Circular Cable Assemblies', 5, 448, 2, 'Cable Assemblies > Circular Cable Assemblies', 108026, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (99, 'Coaxial Cables (RF)', 5, 456, 2, 'Cable Assemblies > Coaxial Cables (RF)', 550496, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (100, 'D-Shaped, Centronics Cables', 5, 466, 2, 'Cable Assemblies > D-Shaped, Centronics Cables', 481, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (101, 'D-Sub Cables', 5, 461, 2, 'Cable Assemblies > D-Sub Cables', 14306, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (102, 'Fiber Optic Cables', 5, 449, 2, 'Cable Assemblies > Fiber Optic Cables', 52424, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (103, 'Firewire Cables (IEEE 1394)', 5, 454, 2, 'Cable Assemblies > Firewire Cables (IEEE 1394)', 162, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (104, 'Flat Flex Jumpers, Cables (FFC, FPC)', 5, 458, 2, 'Cable Assemblies > Flat Flex Jumpers, Cables (FFC, FPC)', 2078, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (105, 'Flat Flex Ribbon Jumpers, Cables', 5, 457, 2, 'Cable Assemblies > Flat Flex Ribbon Jumpers, Cables', 26521, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (106, 'Jumper Wires, Pre-Crimped Leads', 5, 453, 2, 'Cable Assemblies > Jumper Wires, Pre-Crimped Leads', 23130, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (107, 'LGH Cables', 5, 465, 2, 'Cable Assemblies > LGH Cables', 412, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (108, 'Modular/Ethernet Cables (RJ45, RJ11)', 5, 451, 2, 'Cable Assemblies > Modular/Ethernet Cables (RJ45, RJ11)', 57849, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (109, 'Pluggable Cables', 5, 460, 2, 'Cable Assemblies > Pluggable Cables', 21996, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (110, 'Power, Line Cables and Extension Cords', 5, 452, 2, 'Cable Assemblies > Power, Line Cables and Extension Cords', 6804, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (111, 'Rectangular Cable Assemblies', 5, 450, 2, 'Cable Assemblies > Rectangular Cable Assemblies', 145923, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (112, 'Smart Cables', 5, 468, 2, 'Cable Assemblies > Smart Cables', 118, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (113, 'Solid State Lighting Cables', 5, 469, 2, 'Cable Assemblies > Solid State Lighting Cables', 315, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (114, 'Specialized Cable Assemblies', 5, 467, 2, 'Cable Assemblies > Specialized Cable Assemblies', 3040, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (115, 'USB Cables', 5, 455, 2, 'Cable Assemblies > USB Cables', 6688, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (116, 'Video Cables (DVI, HDMI)', 5, 462, 2, 'Cable Assemblies > Video Cables (DVI, HDMI)', 2943, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (117, 'Coaxial Cables (RF)', 6, 475, 2, 'Cables, Wires > Coaxial Cables (RF)', 4406, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (118, 'Fiber Optic Cables', 6, 471, 2, 'Cables, Wires > Fiber Optic Cables', 4760, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (119, 'Flat Flex Cables (FFC, FPC)', 6, 476, 2, 'Cables, Wires > Flat Flex Cables (FFC, FPC)', 169, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (120, 'Flat Ribbon Cables', 6, 472, 2, 'Cables, Wires > Flat Ribbon Cables', 6696, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (121, 'Modular - Flat Cable', 6, 477, 2, 'Cables, Wires > Modular - Flat Cable', 319, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (122, 'Multiple Conductor Cables', 6, 473, 2, 'Cables, Wires > Multiple Conductor Cables', 49527, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (123, 'Single Conductor Cables (Hook-Up Wire)', 6, 474, 2, 'Cables, Wires > Single Conductor Cables (Hook-Up Wire)', 28737, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (124, 'Wire Wrap', 6, 470, 2, 'Cables, Wires > Wire Wrap', 107, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (125, 'Accessories', 7, 479, 2, 'Cables, Wires - Management > Accessories', 11835, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (126, 'Bushings, Grommets', 7, 491, 2, 'Cables, Wires - Management > Bushings, Grommets', 4413, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (127, 'Cable and Cord Grips', 7, 492, 2, 'Cables, Wires - Management > Cable and Cord Grips', 19114, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (128, 'Cable Supports and Fasteners', 7, 490, 2, 'Cables, Wires - Management > Cable Supports and Fasteners', 6301, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (129, 'Cable Ties - Holders and Mountings', 7, 488, 2, 'Cables, Wires - Management > Cable Ties - Holders and Mountings', 1377, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (130, 'Cable Ties and Zip Ties', 7, 482, 2, 'Cables, Wires - Management > Cable Ties and Zip Ties', 6216, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (131, 'Cold Shrink Tape, Tubing', 7, 485, 2, 'Cables, Wires - Management > Cold Shrink Tape, Tubing', 129, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (132, 'Fiber Optic Cables', 7, 481, 2, 'Cables, Wires - Management > Fiber Optic Cables', 159, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (133, 'Grounding Braid, Straps', 7, 494, 2, 'Cables, Wires - Management > Grounding Braid, Straps', 756, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (134, 'Heat Shrink Boots, Caps', 7, 499, 2, 'Cables, Wires - Management > Heat Shrink Boots, Caps', 5914, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (135, 'Heat Shrink Fabric', 7, 489, 2, 'Cables, Wires - Management > Heat Shrink Fabric', 273, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (136, 'Heat Shrink Tubing', 7, 483, 2, 'Cables, Wires - Management > Heat Shrink Tubing', 14133, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (137, 'Heat Shrink Wrap', 7, 497, 2, 'Cables, Wires - Management > Heat Shrink Wrap', 12, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (138, 'Labels, Labeling', 7, 484, 2, 'Cables, Wires - Management > Labels, Labeling', 9134, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (139, 'Markers', 7, 493, 2, 'Cables, Wires - Management > Markers', 13709, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (140, 'Protective Hoses, Solid Tubing, Sleeving', 7, 480, 2, 'Cables, Wires - Management > Protective Hoses, Solid Tubing, Sleeving', 4969, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (141, 'Pulling, Support Grips', 7, 498, 2, 'Cables, Wires - Management > Pulling, Support Grips', 735, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (142, 'Solder Sleeve', 7, 478, 2, 'Cables, Wires - Management > Solder Sleeve', 2176, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (143, 'Spiral Wrap, Expandable Sleeving', 7, 495, 2, 'Cables, Wires - Management > Spiral Wrap, Expandable Sleeving', 3334, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (144, 'Splice Enclosures, Protection', 7, 496, 2, 'Cables, Wires - Management > Splice Enclosures, Protection', 320, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (145, 'Wire Ducts, Raceways', 7, 2039, 2, 'Cables, Wires - Management > Wire Ducts, Raceways', 8346, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (146, 'Accessories', 8, 63, 2, 'Capacitors > Accessories', 235, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (147, 'Aluminum - Polymer Capacitors', 8, 69, 2, 'Capacitors > Aluminum - Polymer Capacitors', 10490, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (148, 'Aluminum Electrolytic Capacitors', 8, 58, 2, 'Capacitors > Aluminum Electrolytic Capacitors', 112873, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (149, 'Capacitor Networks, Arrays', 8, 57, 2, 'Capacitors > Capacitor Networks, Arrays', 1406, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (150, 'Ceramic Capacitors', 8, 60, 2, 'Capacitors > Ceramic Capacitors', 881765, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (151, 'Electric Double Layer Capacitors (EDLC), Supercapacitors', 8, 61, 2, 'Capacitors > Electric Double Layer Capacitors (EDLC), Supercapacitors', 3040, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (152, 'Film Capacitors', 8, 62, 2, 'Capacitors > Film Capacitors', 167937, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (153, 'Mica and PTFE Capacitors', 8, 64, 2, 'Capacitors > Mica and PTFE Capacitors', 9009, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (154, 'Motor Start, Motor Run Capacitors (AC)', 8, 2112, 2, 'Capacitors > Motor Start, Motor Run Capacitors (AC)', 3258, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (155, 'Niobium Oxide Capacitors', 8, 67, 2, 'Capacitors > Niobium Oxide Capacitors', 217, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (156, 'Silicon Capacitors', 8, 68, 2, 'Capacitors > Silicon Capacitors', 376, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (157, 'Tantalum - Polymer Capacitors', 8, 70, 2, 'Capacitors > Tantalum - Polymer Capacitors', 13052, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (158, 'Tantalum Capacitors', 8, 59, 2, 'Capacitors > Tantalum Capacitors', 110697, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (159, 'Thin Film Capacitors', 8, 66, 2, 'Capacitors > Thin Film Capacitors', 3733, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (160, 'Trimmers, Variable Capacitors', 8, 65, 2, 'Capacitors > Trimmers, Variable Capacitors', 1623, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (161, 'Circuit Breakers', 9, 143, 2, 'Circuit Protection > Circuit Breakers', 75709, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (162, 'Circuit Protection Accessories', 9, 145, 2, 'Circuit Protection > Circuit Protection Accessories', 9855, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (163, 'Electrical, Specialty Fuses', 9, 155, 2, 'Circuit Protection > Electrical, Specialty Fuses', 27577, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (164, 'Fuseholders', 9, 140, 2, 'Circuit Protection > Fuseholders', 7000, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (165, 'Fuses', 9, 139, 2, 'Circuit Protection > Fuses', 25090, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (166, 'Gas Discharge Tube Arresters (GDT)', 9, 142, 2, 'Circuit Protection > Gas Discharge Tube Arresters (GDT)', 4715, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (167, 'Ground Fault Circuit Interrupter (GFCI)', 9, 148, 2, 'Circuit Protection > Ground Fault Circuit Interrupter (GFCI)', 832, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (168, 'Inrush Current Limiters (ICL)', 9, 151, 2, 'Circuit Protection > Inrush Current Limiters (ICL)', 2235, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (169, 'Lighting Protection', 9, 154, 2, 'Circuit Protection > Lighting Protection', 78, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (170, 'PTC Resettable Fuses', 9, 150, 2, 'Circuit Protection > PTC Resettable Fuses', 5135, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (171, 'Surge Suppression ICs', 9, 152, 2, 'Circuit Protection > Surge Suppression ICs', 581, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (172, 'Thermal Cutoffs (Thermal Fuses)', 9, 146, 2, 'Circuit Protection > Thermal Cutoffs (Thermal Fuses)', 403, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (173, 'Transient Voltage Suppressors (TVS)', 9, 2040, 2, 'Circuit Protection > Transient Voltage Suppressors (TVS)', 115649, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (174, 'Varistors, MOVs', 9, 141, 2, 'Circuit Protection > Varistors, MOVs', 24532, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (175, 'Accessories', 10, 881, 2, 'Computer Equipment > Accessories', 5817, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (176, 'Adapter Cards', 10, 888, 2, 'Computer Equipment > Adapter Cards', 1483, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (177, 'Adapters, Converters', 10, 882, 2, 'Computer Equipment > Adapters, Converters', 1405, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (178, 'Brackets', 10, 889, 2, 'Computer Equipment > Brackets', 43, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (179, 'Cameras, Projectors', 10, 898, 2, 'Computer Equipment > Cameras, Projectors', 395, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (180, 'Computer Mouse, Trackballs', 10, 893, 2, 'Computer Equipment > Computer Mouse, Trackballs', 212, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (181, 'Desktop Joysticks, Simulation Products', 10, 899, 2, 'Computer Equipment > Desktop Joysticks, Simulation Products', 47, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (182, 'Keyboards', 10, 885, 2, 'Computer Equipment > Keyboards', 560, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (183, 'KVM Switches (Keyboard Video Mouse)', 10, 890, 2, 'Computer Equipment > KVM Switches (Keyboard Video Mouse)', 384, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (184, 'KVM Switches (Keyboard Video Mouse) - Cables', 10, 896, 2, 'Computer Equipment > KVM Switches (Keyboard Video Mouse) - Cables', 151, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (185, 'Magnetic Strip, Smart Card Readers', 10, 891, 2, 'Computer Equipment > Magnetic Strip, Smart Card Readers', 52, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (186, 'Memory Card Readers', 10, 895, 2, 'Computer Equipment > Memory Card Readers', 35, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (187, 'Monitors', 10, 900, 2, 'Computer Equipment > Monitors', 604, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (188, 'Printers, Label Makers', 10, 887, 2, 'Computer Equipment > Printers, Label Makers', 459, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (189, 'Privacy Filters, Screen Protectors', 10, 883, 2, 'Computer Equipment > Privacy Filters, Screen Protectors', 637, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (190, 'Server Acceleration Cards', 10, 986, 2, 'Computer Equipment > Server Acceleration Cards', 54, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (191, 'USB Hubs', 10, 1015, 2, 'Computer Equipment > USB Hubs', 428, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (192, 'AC Power Connectors', 11, 2026, 2, 'Connectors, Interconnects > AC Power Connectors', 14454, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (193, 'Backplane Connectors', 11, 2000, 2, 'Connectors, Interconnects > Backplane Connectors', 62372, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (194, 'Banana and Tip Connectors', 11, 2001, 2, 'Connectors, Interconnects > Banana and Tip Connectors', 2152, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (195, 'Barrel Connectors', 11, 2002, 2, 'Connectors, Interconnects > Barrel Connectors', 4013, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (196, 'Between Series Adapters', 11, 373, 2, 'Connectors, Interconnects > Between Series Adapters', 843, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (197, 'Blade Type Power Connectors', 11, 2003, 2, 'Connectors, Interconnects > Blade Type Power Connectors', 3709, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (198, 'Card Edge Connectors', 11, 2004, 2, 'Connectors, Interconnects > Card Edge Connectors', 620201, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (199, 'Circular Connectors', 11, 2005, 2, 'Connectors, Interconnects > Circular Connectors', 2991968, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (200, 'Coaxial Connectors (RF)', 11, 2007, 2, 'Connectors, Interconnects > Coaxial Connectors (RF)', 43753, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (201, 'Contacts', 11, 2008, 2, 'Connectors, Interconnects > Contacts', 4268, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (202, 'D-Sub, D-Shaped Connectors', 11, 2011, 2, 'Connectors, Interconnects > D-Sub, D-Shaped Connectors', 257935, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (203, 'FFC, FPC (Flat Flexible) Connectors', 11, 2013, 2, 'Connectors, Interconnects > FFC, FPC (Flat Flexible) Connectors', 17568, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (204, 'Fiber Optic Connectors', 11, 2014, 2, 'Connectors, Interconnects > Fiber Optic Connectors', 6144, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (205, 'Heavy Duty Connectors', 11, 2015, 2, 'Connectors, Interconnects > Heavy Duty Connectors', 24524, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (206, 'Keystone Connectors', 11, 2017, 2, 'Connectors, Interconnects > Keystone Connectors', 3657, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (207, 'LGH Connectors', 11, 441, 2, 'Connectors, Interconnects > LGH Connectors', 342, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (208, 'Memory Connectors', 11, 2021, 2, 'Connectors, Interconnects > Memory Connectors', 4600, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (209, 'Modular/Ethernet Connectors', 11, 2022, 2, 'Connectors, Interconnects > Modular/Ethernet Connectors', 21072, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (210, 'Photovoltaic (Solar Panel) Connectors', 11, 2023, 2, 'Connectors, Interconnects > Photovoltaic (Solar Panel) Connectors', 572, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (211, 'Pluggable Connectors', 11, 2024, 2, 'Connectors, Interconnects > Pluggable Connectors', 6382, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (212, 'Rectangular Connectors', 11, 2027, 2, 'Connectors, Interconnects > Rectangular Connectors', 986655, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (213, 'Shunts, Jumpers', 11, 304, 2, 'Connectors, Interconnects > Shunts, Jumpers', 1469, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (214, 'Sockets for ICs, Transistors', 11, 2028, 2, 'Connectors, Interconnects > Sockets for ICs, Transistors', 20205, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (215, 'Solid State Lighting Connectors', 11, 2029, 2, 'Connectors, Interconnects > Solid State Lighting Connectors', 1845, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (216, 'Terminal Blocks', 11, 2030, 2, 'Connectors, Interconnects > Terminal Blocks', 227040, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (217, 'Terminal Junction Systems', 11, 422, 2, 'Connectors, Interconnects > Terminal Junction Systems', 3257, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (218, 'Terminal Strips and Turret Boards', 11, 306, 2, 'Connectors, Interconnects > Terminal Strips and Turret Boards', 475, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (219, 'Terminals', 11, 2031, 2, 'Connectors, Interconnects > Terminals', 41405, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (220, 'USB, DVI, HDMI Connectors', 11, 2032, 2, 'Connectors, Interconnects > USB, DVI, HDMI Connectors', 6286, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (221, 'Crystal, Oscillator, Resonator Accessories', 12, 175, 2, 'Crystals, Oscillators, Resonators > Crystal, Oscillator, Resonator Accessories', 167, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (222, 'Crystals', 12, 171, 2, 'Crystals, Oscillators, Resonators > Crystals', 119359, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (223, 'Oscillators', 12, 172, 2, 'Crystals, Oscillators, Resonators > Oscillators', 603386, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (224, 'Pin Configurable/Selectable Oscillators', 12, 176, 2, 'Crystals, Oscillators, Resonators > Pin Configurable/Selectable Oscillators', 5074, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (225, 'Programmable Oscillators', 12, 169, 2, 'Crystals, Oscillators, Resonators > Programmable Oscillators', 9820, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (226, 'Resonators', 12, 174, 2, 'Crystals, Oscillators, Resonators > Resonators', 1883, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (227, 'Stand Alone Programmers', 12, 170, 2, 'Crystals, Oscillators, Resonators > Stand Alone Programmers', 28, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (228, 'VCOs (Voltage Controlled Oscillators)', 12, 173, 2, 'Crystals, Oscillators, Resonators > VCOs (Voltage Controlled Oscillators)', 738, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (286, 'Fixed Inductors', 19, 71, 2, 'Inductors, Coils, Chokes > Fixed Inductors', 155795, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (229, 'Accessories', 13, 783, 2, 'Development Boards, Kits, Programmers > Accessories', 2824, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (230, 'Evaluation Boards', 13, 2041, 2, 'Development Boards, Kits, Programmers > Evaluation Boards', 58632, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (231, 'Programmers, Emulators, and Debuggers', 13, 799, 2, 'Development Boards, Kits, Programmers > Programmers, Emulators, and Debuggers', 1182, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (232, 'Programming Adapters, Sockets', 13, 798, 2, 'Development Boards, Kits, Programmers > Programming Adapters, Sockets', 1995, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (233, 'Software, Services', 13, 784, 2, 'Development Boards, Kits, Programmers > Software, Services', 4075, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (234, 'Current Regulation - Diodes, Transistors', 14, 1164, 2, 'Discrete Semiconductor Products > Current Regulation - Diodes, Transistors', 1154, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (235, 'Diodes', 14, 2042, 2, 'Discrete Semiconductor Products > Diodes', 146984, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (236, 'Power Driver Modules', 14, 296, 2, 'Discrete Semiconductor Products > Power Driver Modules', 1284, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (237, 'Thyristors', 14, 2043, 2, 'Discrete Semiconductor Products > Thyristors', 10485, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (238, 'Transistors', 14, 2045, 2, 'Discrete Semiconductor Products > Transistors', 95166, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (239, 'Embedded Computer Accessories', 15, 931, 2, 'Embedded Computers > Embedded Computer Accessories', 1357, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (240, 'Embedded Computer Interface Boards', 15, 932, 2, 'Embedded Computers > Embedded Computer Interface Boards', 647, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (241, 'Single Board Computers (SBCs)', 15, 933, 2, 'Embedded Computers > Single Board Computers (SBCs)', 6521, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (242, 'Fans', 16, 2046, 2, 'Fans, Blowers, Thermal Management > Fans', 31551, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (243, 'Heat Tape, Heat Blankets and Heaters', 16, 1005, 2, 'Fans, Blowers, Thermal Management > Heat Tape, Heat Blankets and Heaters', 1651, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (244, 'Thermal', 16, 2047, 2, 'Fans, Blowers, Thermal Management > Thermal', 142232, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (245, 'Cable Ferrites', 17, 840, 2, 'Filters > Cable Ferrites', 1997, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (246, 'Ceramic Filters', 17, 846, 2, 'Filters > Ceramic Filters', 1392, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (247, 'Common Mode Chokes', 17, 839, 2, 'Filters > Common Mode Chokes', 9263, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (248, 'DSL Filters', 17, 842, 2, 'Filters > DSL Filters', 24, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (249, 'EMI/RFI Filters (LC, RC Networks)', 17, 835, 2, 'Filters > EMI/RFI Filters (LC, RC Networks)', 2102, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (250, 'Feed Through Capacitors', 17, 845, 2, 'Filters > Feed Through Capacitors', 3750, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (251, 'Ferrite Beads and Chips', 17, 841, 2, 'Filters > Ferrite Beads and Chips', 8525, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (252, 'Ferrite Disks and Plates', 17, 843, 2, 'Filters > Ferrite Disks and Plates', 128, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (253, 'Filter Accessories', 17, 834, 2, 'Filters > Filter Accessories', 69, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (254, 'Helical Filters', 17, 837, 2, 'Filters > Helical Filters', 6, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (255, 'Monolithic Crystals', 17, 847, 2, 'Filters > Monolithic Crystals', 94, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (256, 'Power Line Filter Modules', 17, 838, 2, 'Filters > Power Line Filter Modules', 13806, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (257, 'RF Filters', 17, 844, 2, 'Filters > RF Filters', 4133, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (258, 'SAW Filters', 17, 836, 2, 'Filters > SAW Filters', 2363, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (259, 'Accessories', 18, 569, 2, 'Hardware, Fasteners, Accessories > Accessories', 2019, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (260, 'Bearings', 18, 979, 2, 'Hardware, Fasteners, Accessories > Bearings', 271, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (261, 'Board Spacers, Standoffs', 18, 582, 2, 'Hardware, Fasteners, Accessories > Board Spacers, Standoffs', 22658, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (262, 'Board Supports', 18, 578, 2, 'Hardware, Fasteners, Accessories > Board Supports', 4556, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (263, 'Bumpers, Feet, Pads, Grips', 18, 570, 2, 'Hardware, Fasteners, Accessories > Bumpers, Feet, Pads, Grips', 6975, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (264, 'Clips, Hangers, Hooks', 18, 954, 2, 'Hardware, Fasteners, Accessories > Clips, Hangers, Hooks', 414, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (265, 'Component Insulators, Mounts, Spacers', 18, 585, 2, 'Hardware, Fasteners, Accessories > Component Insulators, Mounts, Spacers', 783, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (266, 'DIN Rail Channel', 18, 580, 2, 'Hardware, Fasteners, Accessories > DIN Rail Channel', 1967, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (267, 'Foam', 18, 587, 2, 'Hardware, Fasteners, Accessories > Foam', 508, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (268, 'Hinges', 18, 976, 2, 'Hardware, Fasteners, Accessories > Hinges', 756, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (269, 'Hole Plugs - Tapered Caps', 18, 581, 2, 'Hardware, Fasteners, Accessories > Hole Plugs - Tapered Caps', 3344, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (270, 'Knobs', 18, 568, 2, 'Hardware, Fasteners, Accessories > Knobs', 10010, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (271, 'Miscellaneous', 18, 579, 2, 'Hardware, Fasteners, Accessories > Miscellaneous', 4492, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (272, 'Mounting Brackets', 18, 574, 2, 'Hardware, Fasteners, Accessories > Mounting Brackets', 163, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (273, 'Nuts', 18, 573, 2, 'Hardware, Fasteners, Accessories > Nuts', 1306, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (274, 'Reclosable Fasteners', 18, 967, 2, 'Hardware, Fasteners, Accessories > Reclosable Fasteners', 1683, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (275, 'Rivets', 18, 576, 2, 'Hardware, Fasteners, Accessories > Rivets', 2965, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (276, 'Screw Grommets', 18, 584, 2, 'Hardware, Fasteners, Accessories > Screw Grommets', 371, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (277, 'Screws, Bolts', 18, 572, 2, 'Hardware, Fasteners, Accessories > Screws, Bolts', 27600, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (278, 'Seals - Cord Stock', 18, 1172, 2, 'Hardware, Fasteners, Accessories > Seals - Cord Stock', 986, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (279, 'Seals - O-Rings', 18, 1171, 2, 'Hardware, Fasteners, Accessories > Seals - O-Rings', 6988, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (280, 'Springs', 18, 3004, 2, 'Hardware, Fasteners, Accessories > Springs', 15237, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (281, 'Structural, Motion Hardware', 18, 586, 2, 'Hardware, Fasteners, Accessories > Structural, Motion Hardware', 23971, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (282, 'Washers', 18, 2048, 2, 'Hardware, Fasteners, Accessories > Washers', 5680, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (283, 'Adjustable Inductors', 19, 72, 2, 'Inductors, Coils, Chokes > Adjustable Inductors', 276, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (284, 'Arrays, Signal Transformers', 19, 73, 2, 'Inductors, Coils, Chokes > Arrays, Signal Transformers', 1322, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (285, 'Delay Lines', 19, 74, 2, 'Inductors, Coils, Chokes > Delay Lines', 50, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (287, 'Wireless Charging Coils', 19, 75, 2, 'Inductors, Coils, Chokes > Wireless Charging Coils', 274, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (288, 'Cable and Hose Carriers, Drag Chains', 20, 1014, 2, 'Industrial Automation and Controls > Cable and Hose Carriers, Drag Chains', 4178, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (289, 'Cam Positioners', 20, 808, 2, 'Industrial Automation and Controls > Cam Positioners', 16, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (290, 'Controllers', 20, 2049, 2, 'Industrial Automation and Controls > Controllers', 17901, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (291, 'Graphical/Numeric Displays', 20, 2115, 2, 'Industrial Automation and Controls > Graphical/Numeric Displays', 21, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (292, 'Greases and Lubricants', 20, 1013, 2, 'Industrial Automation and Controls > Greases and Lubricants', 137, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (293, 'Human Machine Interface (HMI)', 20, 2050, 2, 'Industrial Automation and Controls > Human Machine Interface (HMI)', 2392, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (294, 'Industrial Automation Accessories', 20, 800, 2, 'Industrial Automation and Controls > Industrial Automation Accessories', 11592, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (295, 'Industrial Equipment', 20, 815, 2, 'Industrial Automation and Controls > Industrial Equipment', 4499, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (296, 'Industrial Lighting', 20, 2051, 2, 'Industrial Automation and Controls > Industrial Lighting', 3455, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (297, 'Industrial Lighting Control', 20, 2052, 2, 'Industrial Automation and Controls > Industrial Lighting Control', 299, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (298, 'Industrial PCs', 20, 1062, 2, 'Industrial Automation and Controls > Industrial PCs', 5744, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (299, 'Industrial Sensors', 20, 2114, 2, 'Industrial Automation and Controls > Industrial Sensors', 119252, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (300, 'Industrial Specialized', 20, 804, 2, 'Industrial Automation and Controls > Industrial Specialized', 1135, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (301, 'Liquid Filtration', 20, 978, 2, 'Industrial Automation and Controls > Liquid Filtration', 534, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (302, 'Machine Vision', 20, 2053, 2, 'Industrial Automation and Controls > Machine Vision', 5174, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (303, 'Monitors', 20, 2054, 2, 'Industrial Automation and Controls > Monitors', 2317, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (304, 'Panel Meters', 20, 2055, 2, 'Industrial Automation and Controls > Panel Meters', 4686, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (305, 'Pneumatics, Hydraulics', 20, 2056, 2, 'Industrial Automation and Controls > Pneumatics, Hydraulics', 78501, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (306, 'Protection Relays & Systems', 20, 810, 2, 'Industrial Automation and Controls > Protection Relays & Systems', 1279, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (307, 'Robotics', 20, 2057, 2, 'Industrial Automation and Controls > Robotics', 4051, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (308, 'Signal Conditioners and Isolators', 20, 1020, 2, 'Industrial Automation and Controls > Signal Conditioners and Isolators', 977, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (309, 'Stackable Tower Lighting, Beacons, and Components', 20, 953, 2, 'Industrial Automation and Controls > Stackable Tower Lighting, Beacons, and Components', 8061, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (310, 'Time Delay Relays', 20, 952, 2, 'Industrial Automation and Controls > Time Delay Relays', 5247, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (311, 'Carts and Trucks', 21, 1076, 2, 'Industrial Supplies > Carts and Trucks', 1002, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (312, 'Dock and Warehouse', 21, 2092, 2, 'Industrial Supplies > Dock and Warehouse', 218, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (313, 'Electrical', 21, 2093, 2, 'Industrial Supplies > Electrical', 302, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (314, 'Fans', 21, 2094, 2, 'Industrial Supplies > Fans', 251, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (315, 'HVAC', 21, 2095, 2, 'Industrial Supplies > HVAC', 1016, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (316, 'Janitorial and Maintenance Products', 21, 1110, 2, 'Industrial Supplies > Janitorial and Maintenance Products', 3322, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (317, 'Maintenance', 21, 2096, 2, 'Industrial Supplies > Maintenance', 501, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (318, 'Office Equipment', 21, 2097, 2, 'Industrial Supplies > Office Equipment', 713, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (319, 'Office Furniture', 21, 2098, 2, 'Industrial Supplies > Office Furniture', 570, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (320, 'Outdoor Products', 21, 2099, 2, 'Industrial Supplies > Outdoor Products', 1137, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (321, 'Product, Material Handling and Storage', 21, 2100, 2, 'Industrial Supplies > Product, Material Handling and Storage', 4106, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (322, 'Safety', 21, 2101, 2, 'Industrial Supplies > Safety', 77, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (323, 'Shipping and Packaging Products', 21, 1151, 2, 'Industrial Supplies > Shipping and Packaging Products', 334, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (324, 'Storage Containers & Bins', 21, 2103, 2, 'Industrial Supplies > Storage Containers & Bins', 3, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (325, 'Vehicle Maintenance and Customization Products', 21, 1153, 2, 'Industrial Supplies > Vehicle Maintenance and Customization Products', 82, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (326, 'Workstation, Office Furniture and Equipment', 21, 2104, 2, 'Industrial Supplies > Workstation, Office Furniture and Equipment', 848, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (327, 'Audio Special Purpose', 22, 741, 2, 'Integrated Circuits (ICs) > Audio Special Purpose', 1432, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (328, 'Clock/Timing', 22, 2006, 2, 'Integrated Circuits (ICs) > Clock/Timing', 27122, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (329, 'Data Acquisition', 22, 2009, 2, 'Integrated Circuits (ICs) > Data Acquisition', 33853, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (330, 'Embedded', 22, 2012, 2, 'Integrated Circuits (ICs) > Embedded', 133495, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (331, 'Interface', 22, 2016, 2, 'Integrated Circuits (ICs) > Interface', 50995, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (332, 'Linear', 22, 2018, 2, 'Integrated Circuits (ICs) > Linear', 45304, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (333, 'Logic', 22, 2019, 2, 'Integrated Circuits (ICs) > Logic', 59437, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (334, 'Memory', 22, 2020, 2, 'Integrated Circuits (ICs) > Memory', 59201, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (335, 'Power Management (PMIC)', 22, 2025, 2, 'Integrated Circuits (ICs) > Power Management (PMIC)', 228376, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (336, 'Specialized ICs', 22, 686, 2, 'Integrated Circuits (ICs) > Specialized ICs', 2668, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (337, 'Digital Isolators', 23, 901, 2, 'Isolators > Digital Isolators', 5710, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (338, 'Isolators - Gate Drivers', 23, 906, 2, 'Isolators > Isolators - Gate Drivers', 4156, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (339, 'Optocouplers, Optoisolators', 23, 2058, 2, 'Isolators > Optocouplers, Optoisolators', 16802, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (340, 'Special Purpose Isolators', 23, 905, 2, 'Isolators > Special Purpose Isolators', 112, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (341, 'Audio Kits', 24, 669, 2, 'Kits > Audio Kits', 45, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (342, 'Cable Assembly Kits', 24, 663, 2, 'Kits > Cable Assembly Kits', 39, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (343, 'Cables, Wires - Single Conductors', 24, 665, 2, 'Kits > Cables, Wires - Single Conductors', 14477, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (344, 'Capacitor Kits', 24, 651, 2, 'Kits > Capacitor Kits', 767, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (345, 'Circuit Protection - Assortment Kits', 24, 666, 2, 'Kits > Circuit Protection - Assortment Kits', 103, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (346, 'Circuit Protection Kits - Fuse', 24, 667, 2, 'Kits > Circuit Protection Kits - Fuse', 233, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (347, 'Circuit Protection Kits - TVS Diodes', 24, 668, 2, 'Kits > Circuit Protection Kits - TVS Diodes', 31, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (348, 'Connector Adapter Kits', 24, 660, 2, 'Kits > Connector Adapter Kits', 52, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (349, 'Connector Kits', 24, 656, 2, 'Kits > Connector Kits', 872, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (350, 'Crystal Kits', 24, 671, 2, 'Kits > Crystal Kits', 6, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (351, 'Discrete Assortment Kits', 24, 659, 2, 'Kits > Discrete Assortment Kits', 44, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (352, 'EMI, Filter Kits', 24, 646, 2, 'Kits > EMI, Filter Kits', 223, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (353, 'Fiber Optic Kits', 24, 674, 2, 'Kits > Fiber Optic Kits', 87, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (354, 'Hardware Kits', 24, 645, 2, 'Kits > Hardware Kits', 104, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (355, 'Heat Shrink Tubing Kits', 24, 675, 2, 'Kits > Heat Shrink Tubing Kits', 212, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (356, 'Inductor Kits', 24, 655, 2, 'Kits > Inductor Kits', 397, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (357, 'Integrated Circuits (ICs) Kits', 24, 658, 2, 'Kits > Integrated Circuits (ICs) Kits', 69, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (358, 'Kit Accessories', 24, 649, 2, 'Kits > Kit Accessories', 30, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (359, 'LED Kits', 24, 647, 2, 'Kits > LED Kits', 57, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (360, 'Miscellaneous', 24, 657, 2, 'Kits > Miscellaneous', 233, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (361, 'Optics - Light Pipe Kits', 24, 676, 2, 'Kits > Optics - Light Pipe Kits', 8, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (362, 'Potentiometer Kits', 24, 652, 2, 'Kits > Potentiometer Kits', 33, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (363, 'Prototyping Boards, Fabrication Kits', 24, 672, 2, 'Kits > Prototyping Boards, Fabrication Kits', 32, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (364, 'Resistor Kits', 24, 653, 2, 'Kits > Resistor Kits', 555, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (365, 'RF Shield Kits', 24, 677, 2, 'Kits > RF Shield Kits', 30, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (366, 'Sensor Kits', 24, 662, 2, 'Kits > Sensor Kits', 380, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (367, 'Static Control Kit', 24, 650, 2, 'Kits > Static Control Kit', 341, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (368, 'Switch Kits', 24, 678, 2, 'Kits > Switch Kits', 54, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (369, 'Tape Kits', 24, 673, 2, 'Kits > Tape Kits', 32, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (370, 'Thermistor Kits', 24, 664, 2, 'Kits > Thermistor Kits', 21, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (371, 'Transformer Kits', 24, 654, 2, 'Kits > Transformer Kits', 40, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (372, 'Wire and Cable Tie Kits', 24, 661, 2, 'Kits > Wire and Cable Tie Kits', 51, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (373, 'Barriers, Barricades, Floor Markings, Tapes', 25, 983, 2, 'Labels, Signs, Barriers, Identification > Barriers, Barricades, Floor Markings, Tapes', 1065, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (374, 'Label, Sign, Barrier Accessories', 25, 987, 2, 'Labels, Signs, Barriers, Identification > Label, Sign, Barrier Accessories', 862, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (375, 'Labels, Stickers, Decals - Blank', 25, 981, 2, 'Labels, Signs, Barriers, Identification > Labels, Stickers, Decals - Blank', 12530, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (376, 'Labels, Stickers, Decals - Preprinted', 25, 982, 2, 'Labels, Signs, Barriers, Identification > Labels, Stickers, Decals - Preprinted', 9787, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (377, 'Lockouts, Padlocks', 25, 577, 2, 'Labels, Signs, Barriers, Identification > Lockouts, Padlocks', 2117, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (378, 'Signs, Nameplates, Posters', 25, 985, 2, 'Labels, Signs, Barriers, Identification > Signs, Nameplates, Posters', 13010, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (379, 'Tags', 25, 984, 2, 'Labels, Signs, Barriers, Identification > Tags', 3573, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (380, 'DC to AC (Power) Inverters', 26, 833, 2, 'Line Protection, Distribution, Backups > DC to AC (Power) Inverters', 636, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (381, 'Line Conditioners', 26, 830, 2, 'Line Protection, Distribution, Backups > Line Conditioners', 72, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (382, 'Line Protection, Distribution Accessories', 26, 831, 2, 'Line Protection, Distribution, Backups > Line Protection, Distribution Accessories', 5058, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (383, 'Power Distribution, Surge Protectors', 26, 832, 2, 'Line Protection, Distribution, Backups > Power Distribution, Surge Protectors', 5987, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (384, 'Uninterruptible Power Supply (UPS) Systems', 26, 829, 2, 'Line Protection, Distribution, Backups > Uninterruptible Power Supply (UPS) Systems', 2129, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (385, 'Bobbins (Coil Formers), Mounts, Hardware', 27, 935, 2, 'Magnetics - Transformer, Inductor Components > Bobbins (Coil Formers), Mounts, Hardware', 1173, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (386, 'Ferrite Cores', 27, 936, 2, 'Magnetics - Transformer, Inductor Components > Ferrite Cores', 12128, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (387, 'Magnet Wire', 27, 934, 2, 'Magnetics - Transformer, Inductor Components > Magnet Wire', 707, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (388, 'Books, Media', 28, 937, 2, 'Maker/DIY, Educational > Books, Media', 302, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (389, 'Educational Kits', 28, 939, 2, 'Maker/DIY, Educational > Educational Kits', 1535, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (390, 'Gadgets, Gizmos', 28, 941, 2, 'Maker/DIY, Educational > Gadgets, Gizmos', 141, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (391, 'Prototyping, Fabrication', 28, 938, 2, 'Maker/DIY, Educational > Prototyping, Fabrication', 106, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (392, 'Robotics Kits', 28, 942, 2, 'Maker/DIY, Educational > Robotics Kits', 546, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (393, 'Wearables', 28, 940, 2, 'Maker/DIY, Educational > Wearables', 316, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (394, 'Memory - Modules', 29, 505, 2, 'Memory - Modules, Cards > Memory - Modules', 2909, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (395, 'Memory Card, Module Accessories', 29, 500, 2, 'Memory - Modules, Cards > Memory Card, Module Accessories', 93, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (396, 'Memory Cards', 29, 501, 2, 'Memory - Modules, Cards > Memory Cards', 3300, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (397, 'Solid State Drives (SSDs), Hard Disk Drives (HDDs)', 29, 503, 2, 'Memory - Modules, Cards > Solid State Drives (SSDs), Hard Disk Drives (HDDs)', 8778, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (398, 'Specialized', 29, 502, 2, 'Memory - Modules, Cards > Specialized', 65, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (399, 'USB Flash Drives', 29, 504, 2, 'Memory - Modules, Cards > USB Flash Drives', 552, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (400, 'Accessories', 30, 177, 2, 'Motors, Actuators, Solenoids and Drivers > Accessories', 10447, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (401, 'Electric Actuators/Cylinders', 30, 1157, 2, 'Motors, Actuators, Solenoids and Drivers > Electric Actuators/Cylinders', 1939, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (402, 'Motor Driver Boards, Modules', 30, 181, 2, 'Motors, Actuators, Solenoids and Drivers > Motor Driver Boards, Modules', 16191, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (403, 'Motors - AC, DC', 30, 178, 2, 'Motors, Actuators, Solenoids and Drivers > Motors - AC, DC', 9627, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (404, 'Solenoids', 30, 180, 2, 'Motors, Actuators, Solenoids and Drivers > Solenoids', 466, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (405, 'Stepper Motors', 30, 179, 2, 'Motors, Actuators, Solenoids and Drivers > Stepper Motors', 1226, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (406, 'Variable Frequency Drives (VFDs)', 30, 2113, 2, 'Motors, Actuators, Solenoids and Drivers > Variable Frequency Drives (VFDs)', 4876, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (407, 'Accessories', 31, 925, 2, 'Networking Solutions > Accessories', 3543, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (408, 'Gateways, Routers', 31, 928, 2, 'Networking Solutions > Gateways, Routers', 7550, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (409, 'Media Converters', 31, 929, 2, 'Networking Solutions > Media Converters', 3836, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (410, 'Miscellaneous', 31, 926, 2, 'Networking Solutions > Miscellaneous', 2791, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (411, 'Serial Device Servers', 31, 930, 2, 'Networking Solutions > Serial Device Servers', 1361, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (412, 'Switches, Hubs', 31, 927, 2, 'Networking Solutions > Switches, Hubs', 7754, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (413, 'Arms, Mounts, Stands', 32, 915, 2, 'Optical Inspection Equipment > Arms, Mounts, Stands', 138, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (414, 'Cameras', 32, 913, 2, 'Optical Inspection Equipment > Cameras', 51, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (415, 'Eyepieces, Lenses', 32, 916, 2, 'Optical Inspection Equipment > Eyepieces, Lenses', 141, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (416, 'Illumination Sources', 32, 920, 2, 'Optical Inspection Equipment > Illumination Sources', 96, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (417, 'Lamps - Magnifying, Task', 32, 917, 2, 'Optical Inspection Equipment > Lamps - Magnifying, Task', 889, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (418, 'Loupes, Magnifiers', 32, 918, 2, 'Optical Inspection Equipment > Loupes, Magnifiers', 89, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (419, 'Machine Vision - Accessories', 32, 1121, 2, 'Optical Inspection Equipment > Machine Vision - Accessories', 856, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (420, 'Machine Vision - Lenses', 32, 1077, 2, 'Optical Inspection Equipment > Machine Vision - Lenses', 592, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (421, 'Microscopes', 32, 914, 2, 'Optical Inspection Equipment > Microscopes', 536, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (422, 'Optical Inspection Accessories', 32, 912, 2, 'Optical Inspection Equipment > Optical Inspection Accessories', 617, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (423, 'Video Inspection Systems', 32, 919, 2, 'Optical Inspection Equipment > Video Inspection Systems', 151, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (424, 'Beamsplitters', 33, 1156, 2, 'Optics > Beamsplitters', 39, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (425, 'Filters', 33, 1044, 2, 'Optics > Filters', 59, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (426, 'Laser Optics', 33, 2060, 2, 'Optics > Laser Optics', 274, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (427, 'Lenses', 33, 1045, 2, 'Optics > Lenses', 1478, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (428, 'Mirrors', 33, 1158, 2, 'Optics > Mirrors', 132, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (429, 'Polarizers', 33, 1046, 2, 'Optics > Polarizers', 63, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (430, 'Prisms', 33, 1122, 2, 'Optics > Prisms', 19, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (431, 'Ballasts, Inverters', 34, 97, 2, 'Optoelectronics > Ballasts, Inverters', 283, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (432, 'Circuit Board Indicators, Arrays, Light Bars, Bar Graphs', 34, 106, 2, 'Optoelectronics > Circuit Board Indicators, Arrays, Light Bars, Bar Graphs', 7516, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (433, 'Cold Cathode Fluorescent (CCFL) & UV Lamps', 34, 104, 2, 'Optoelectronics > Cold Cathode Fluorescent (CCFL) & UV Lamps', 181, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (434, 'Display Backlights', 34, 1168, 2, 'Optoelectronics > Display Backlights', 100, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (435, 'Display Bezels, Lenses', 34, 93, 2, 'Optoelectronics > Display Bezels, Lenses', 88, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (436, 'Display, Monitor - LCD Driver/Controller', 34, 114, 2, 'Optoelectronics > Display, Monitor - LCD Driver/Controller', 99, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (437, 'Electroluminescent', 34, 127, 2, 'Optoelectronics > Electroluminescent', 86, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (438, 'Fiber Optic Attenuators', 34, 119, 2, 'Optoelectronics > Fiber Optic Attenuators', 296, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (439, 'Fiber Optic Receivers', 34, 117, 2, 'Optoelectronics > Fiber Optic Receivers', 379, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (440, 'Fiber Optic Switches, Multiplexers, Demultiplexers', 34, 120, 2, 'Optoelectronics > Fiber Optic Switches, Multiplexers, Demultiplexers', 887, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (441, 'Fiber Optic Transceiver Modules', 34, 118, 2, 'Optoelectronics > Fiber Optic Transceiver Modules', 25010, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (442, 'Fiber Optic Transmitters - Discrete', 34, 116, 2, 'Optoelectronics > Fiber Optic Transmitters - Discrete', 228, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (443, 'Fiber Optic Transmitters - Drive Circuitry Integrated', 34, 115, 2, 'Optoelectronics > Fiber Optic Transmitters - Drive Circuitry Integrated', 106, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (444, 'HeNe Laser Heads', 34, 1119, 2, 'Optoelectronics > HeNe Laser Heads', 25, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (445, 'HeNe Laser System Accessories', 34, 1009, 2, 'Optoelectronics > HeNe Laser System Accessories', 11, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (446, 'HeNe Laser Systems', 34, 1008, 2, 'Optoelectronics > HeNe Laser Systems', 33, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (447, 'Incandescent, Neon Lamps', 34, 101, 2, 'Optoelectronics > Incandescent, Neon Lamps', 2490, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (448, 'Lamp Replacements', 34, 109, 2, 'Optoelectronics > Lamp Replacements', 1406, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (449, 'Laser Diode, Module Accessories', 34, 966, 2, 'Optoelectronics > Laser Diode, Module Accessories', 93, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (450, 'Laser Diodes, Laser Modules - Laser Delivery, Laser Fibers', 34, 1055, 2, 'Optoelectronics > Laser Diodes, Laser Modules - Laser Delivery, Laser Fibers', 345, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (451, 'Laser Diodes, Modules', 34, 95, 2, 'Optoelectronics > Laser Diodes, Modules', 1085, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (452, 'LCD, OLED Character and Numeric', 34, 99, 2, 'Optoelectronics > LCD, OLED Character and Numeric', 2178, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (453, 'LCD, OLED, Graphic', 34, 107, 2, 'Optoelectronics > LCD, OLED, Graphic', 4987, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (454, 'LED Addressable, Specialty', 34, 126, 2, 'Optoelectronics > LED Addressable, Specialty', 598, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (455, 'LED Character and Numeric', 34, 92, 2, 'Optoelectronics > LED Character and Numeric', 5959, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (456, 'LED COBs, Engines, Modules, Strips', 34, 111, 2, 'Optoelectronics > LED COBs, Engines, Modules, Strips', 32392, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (457, 'LED Color Lighting', 34, 125, 2, 'Optoelectronics > LED Color Lighting', 5376, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (458, 'LED Dot Matrix and Cluster', 34, 96, 2, 'Optoelectronics > LED Dot Matrix and Cluster', 693, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (459, 'LED Emitters - Infrared, UV, Visible', 34, 94, 2, 'Optoelectronics > LED Emitters - Infrared, UV, Visible', 4198, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (460, 'LED Indication - Discrete', 34, 105, 2, 'Optoelectronics > LED Indication - Discrete', 25414, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (461, 'LED Lighting Kits', 34, 129, 2, 'Optoelectronics > LED Lighting Kits', 65, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (462, 'LED Thermal Products', 34, 121, 2, 'Optoelectronics > LED Thermal Products', 369, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (463, 'LED White Lighting', 34, 124, 2, 'Optoelectronics > LED White Lighting', 43953, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (464, 'Lenses', 34, 112, 2, 'Optoelectronics > Lenses', 3420, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (465, 'Light Pipes', 34, 102, 2, 'Optoelectronics > Light Pipes', 35797, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (466, 'Lighting Fixtures', 34, 1161, 2, 'Optoelectronics > Lighting Fixtures', 216, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (467, 'Optoelectronics Accessories', 34, 98, 2, 'Optoelectronics > Optoelectronics Accessories', 7002, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (468, 'Optomechanical', 34, 1047, 2, 'Optoelectronics > Optomechanical', 477, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (469, 'Panel Indicators, Pilot Lights', 34, 108, 2, 'Optoelectronics > Panel Indicators, Pilot Lights', 23238, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (470, 'Reflectors', 34, 122, 2, 'Optoelectronics > Reflectors', 476, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (471, 'Remote Phosphor Light Source', 34, 123, 2, 'Optoelectronics > Remote Phosphor Light Source', 269, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (472, 'Spacers, Standoffs', 34, 100, 2, 'Optoelectronics > Spacers, Standoffs', 3772, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (473, 'Touch Screen Overlays', 34, 110, 2, 'Optoelectronics > Touch Screen Overlays', 261, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (474, 'Vacuum Fluorescent (VFD)', 34, 103, 2, 'Optoelectronics > Vacuum Fluorescent (VFD)', 223, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (475, 'Xenon Lighting', 34, 128, 2, 'Optoelectronics > Xenon Lighting', 164, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (476, 'Accessories', 35, 76, 2, 'Potentiometers, Variable Resistors > Accessories', 183, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (477, 'Adjustable Power Resistor', 35, 83, 2, 'Potentiometers, Variable Resistors > Adjustable Power Resistor', 1167, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (478, 'Joystick Potentiometers', 35, 82, 2, 'Potentiometers, Variable Resistors > Joystick Potentiometers', 15, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (479, 'Rotary Potentiometers, Rheostats', 35, 84, 2, 'Potentiometers, Variable Resistors > Rotary Potentiometers, Rheostats', 681146, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (480, 'Scale Dials', 35, 79, 2, 'Potentiometers, Variable Resistors > Scale Dials', 108, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (481, 'Slide Potentiometers', 35, 78, 2, 'Potentiometers, Variable Resistors > Slide Potentiometers', 14004, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (482, 'Thumbwheel Potentiometers', 35, 77, 2, 'Potentiometers, Variable Resistors > Thumbwheel Potentiometers', 386, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (483, 'Trimmer Potentiometers', 35, 80, 2, 'Potentiometers, Variable Resistors > Trimmer Potentiometers', 18317, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (484, 'Value Display Potentiometers', 35, 81, 2, 'Potentiometers, Variable Resistors > Value Display Potentiometers', 28, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (485, 'AC DC Converters', 36, 923, 2, 'Power Supplies - Board Mount > AC DC Converters', 7267, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (486, 'Board Mount Power Supply Accessories', 36, 921, 2, 'Power Supplies - Board Mount > Board Mount Power Supply Accessories', 894, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (487, 'DC DC Converters', 36, 922, 2, 'Power Supplies - Board Mount > DC DC Converters', 104551, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (488, 'LED Drivers', 36, 924, 2, 'Power Supplies - Board Mount > LED Drivers', 328, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (489, 'AC AC Wall Power Adapters', 37, 135, 2, 'Power Supplies - External/Internal (Off-Board) > AC AC Wall Power Adapters', 213, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (490, 'AC DC Configurable Power Supplies (Factory Assembled)', 37, 955, 2, 'Power Supplies - External/Internal (Off-Board) > AC DC Configurable Power Supplies (Factory Assembled)', 423, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (491, 'AC DC Configurable Power Supply Chassis', 37, 134, 2, 'Power Supplies - External/Internal (Off-Board) > AC DC Configurable Power Supply Chassis', 1435, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (492, 'AC DC Configurable Power Supply Modules', 37, 136, 2, 'Power Supplies - External/Internal (Off-Board) > AC DC Configurable Power Supply Modules', 169, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (493, 'AC DC Converters', 37, 133, 2, 'Power Supplies - External/Internal (Off-Board) > AC DC Converters', 79911, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (494, 'AC DC Desktop, Wall Power Adapters', 37, 130, 2, 'Power Supplies - External/Internal (Off-Board) > AC DC Desktop, Wall Power Adapters', 14746, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (495, 'DC DC Converters', 37, 132, 2, 'Power Supplies - External/Internal (Off-Board) > DC DC Converters', 8230, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (496, 'External/Internal Power Supply Accessories', 37, 131, 2, 'Power Supplies - External/Internal (Off-Board) > External/Internal Power Supply Accessories', 2017, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (497, 'Industrial, DIN Rail Power Supplies', 37, 1064, 2, 'Power Supplies - External/Internal (Off-Board) > Industrial, DIN Rail Power Supplies', 5029, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (498, 'LED Drivers', 37, 137, 2, 'Power Supplies - External/Internal (Off-Board) > LED Drivers', 5633, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (499, 'Power over Ethernet (PoE)', 37, 138, 2, 'Power Supplies - External/Internal (Off-Board) > Power over Ethernet (PoE)', 1028, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (500, '3D Printers', 38, 943, 2, 'Prototyping, Fabrication Products > 3D Printers', 107, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (501, '3D Printing Accessories', 38, 956, 2, 'Prototyping, Fabrication Products > 3D Printing Accessories', 350, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (502, '3D Printing Materials', 38, 944, 2, 'Prototyping, Fabrication Products > 3D Printing Materials', 1911, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (503, 'Accessories', 38, 635, 2, 'Prototyping, Fabrication Products > Accessories', 377, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (504, 'Adapter, Breakout Boards', 38, 643, 2, 'Prototyping, Fabrication Products > Adapter, Breakout Boards', 1737, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (505, 'Card Extenders', 38, 641, 2, 'Prototyping, Fabrication Products > Card Extenders', 68, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (506, 'Coating, Grease, Repair', 38, 642, 2, 'Prototyping, Fabrication Products > Coating, Grease, Repair', 371, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (507, 'Custom Configurable PCB''s', 38, 1159, 2, 'Prototyping, Fabrication Products > Custom Configurable PCB''s', 12, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (508, 'Drill Bits, End Mills', 38, 644, 2, 'Prototyping, Fabrication Products > Drill Bits, End Mills', 477, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (509, 'Etching and Fabrication Equipment', 38, 639, 2, 'Prototyping, Fabrication Products > Etching and Fabrication Equipment', 52, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (510, 'Jumper Wire', 38, 640, 2, 'Prototyping, Fabrication Products > Jumper Wire', 642, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (511, 'PCB Routers, Milling Machines', 38, 972, 2, 'Prototyping, Fabrication Products > PCB Routers, Milling Machines', 34, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (512, 'Prototype Boards Perforated', 38, 636, 2, 'Prototyping, Fabrication Products > Prototype Boards Perforated', 562, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (513, 'Prototype Boards Unperforated', 38, 637, 2, 'Prototyping, Fabrication Products > Prototype Boards Unperforated', 70, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (514, 'Solderless Breadboards', 38, 638, 2, 'Prototyping, Fabrication Products > Solderless Breadboards', 231, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (515, 'Accessories', 39, 182, 2, 'Relays > Accessories', 5852, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (516, 'Automotive Relays', 39, 962, 2, 'Relays > Automotive Relays', 2027, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (517, 'Contactors (Electromechanical)', 39, 969, 2, 'Relays > Contactors (Electromechanical)', 15551, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (518, 'Contactors (Solid State)', 39, 970, 2, 'Relays > Contactors (Solid State)', 1094, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (519, 'High Frequency (RF) Relays', 39, 963, 2, 'Relays > High Frequency (RF) Relays', 1006, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (520, 'I/O Relay Module Racks', 39, 190, 2, 'Relays > I/O Relay Module Racks', 234, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (521, 'I/O Relay Modules', 39, 186, 2, 'Relays > I/O Relay Modules', 719, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (522, 'Power Relays, Over 2 Amps', 39, 188, 2, 'Relays > Power Relays, Over 2 Amps', 35987, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (523, 'Reed Relays', 39, 964, 2, 'Relays > Reed Relays', 1592, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (524, 'Relay Sockets', 39, 184, 2, 'Relays > Relay Sockets', 2008, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (525, 'Signal Relays, Up to 2 Amps', 39, 189, 2, 'Relays > Signal Relays, Up to 2 Amps', 8200, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (526, 'Solid State Relays (SSR)', 39, 183, 2, 'Relays > Solid State Relays (SSR)', 10061, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (527, 'Accessories', 40, 51, 2, 'Resistors > Accessories', 228, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (528, 'Chassis Mount Resistors', 40, 54, 2, 'Resistors > Chassis Mount Resistors', 28294, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (529, 'Chip Resistor - Surface Mount', 40, 52, 2, 'Resistors > Chip Resistor - Surface Mount', 1183690, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (530, 'Resistor Networks, Arrays', 40, 50, 2, 'Resistors > Resistor Networks, Arrays', 36350, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (531, 'Specialized Resistors', 40, 55, 2, 'Resistors > Specialized Resistors', 1108, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (532, 'Through Hole Resistors', 40, 53, 2, 'Resistors > Through Hole Resistors', 521846, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (533, 'Attenuators', 41, 852, 2, 'RF and Wireless > Attenuators', 7783, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (534, 'Balun', 41, 849, 2, 'RF and Wireless > Balun', 1210, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (535, 'RF Accessories', 41, 866, 2, 'RF and Wireless > RF Accessories', 5479, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (536, 'RF Amplifiers', 41, 860, 2, 'RF and Wireless > RF Amplifiers', 7397, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (537, 'RF Antennas', 41, 875, 2, 'RF and Wireless > RF Antennas', 15926, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (538, 'RF Circulators and Isolators', 41, 1010, 2, 'RF and Wireless > RF Circulators and Isolators', 2331, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (539, 'RF Demodulators', 41, 878, 2, 'RF and Wireless > RF Demodulators', 228, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (540, 'RF Detectors', 41, 862, 2, 'RF and Wireless > RF Detectors', 523, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (541, 'RF Directional Coupler', 41, 850, 2, 'RF and Wireless > RF Directional Coupler', 3114, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (542, 'RF Front End (LNA + PA)', 41, 876, 2, 'RF and Wireless > RF Front End (LNA + PA)', 639, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (543, 'RF Misc ICs and Modules', 41, 863, 2, 'RF and Wireless > RF Misc ICs and Modules', 3220, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (544, 'RF Mixers', 41, 861, 2, 'RF and Wireless > RF Mixers', 1619, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (545, 'RF Modulators', 41, 877, 2, 'RF and Wireless > RF Modulators', 222, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (546, 'RF Multiplexers', 41, 868, 2, 'RF and Wireless > RF Multiplexers', 1189, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (547, 'RF Power Controller ICs', 41, 864, 2, 'RF and Wireless > RF Power Controller ICs', 52, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (548, 'RF Power Dividers/Splitters', 41, 851, 2, 'RF and Wireless > RF Power Dividers/Splitters', 1574, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (549, 'RF Receiver, Transmitter, and Transceiver Finished Units', 41, 873, 2, 'RF and Wireless > RF Receiver, Transmitter, and Transceiver Finished Units', 2411, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (550, 'RF Receivers', 41, 870, 2, 'RF and Wireless > RF Receivers', 1725, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (551, 'RF Shields', 41, 867, 2, 'RF and Wireless > RF Shields', 16360, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (552, 'RF Switches', 41, 865, 2, 'RF and Wireless > RF Switches', 6510, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (553, 'RF Transceiver ICs', 41, 879, 2, 'RF and Wireless > RF Transceiver ICs', 4931, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (554, 'RF Transceiver Modules and Modems', 41, 872, 2, 'RF and Wireless > RF Transceiver Modules and Modems', 7322, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (555, 'RF Transmitters', 41, 871, 2, 'RF and Wireless > RF Transmitters', 595, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (556, 'RFI and EMI - Contacts, Fingerstock and Gaskets', 41, 945, 2, 'RF and Wireless > RFI and EMI - Contacts, Fingerstock and Gaskets', 4452, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (557, 'RFI and EMI - Shielding and Absorbing Materials', 41, 869, 2, 'RF and Wireless > RFI and EMI - Shielding and Absorbing Materials', 4249, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (558, 'RFID Accessories', 41, 857, 2, 'RF and Wireless > RFID Accessories', 289, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (559, 'RFID Antennas', 41, 855, 2, 'RF and Wireless > RFID Antennas', 532, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (560, 'RFID Reader Modules', 41, 854, 2, 'RF and Wireless > RFID Reader Modules', 629, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (561, 'RFID Transponders, Tags', 41, 853, 2, 'RF and Wireless > RFID Transponders, Tags', 901, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (562, 'RFID, RF Access, Monitoring ICs', 41, 880, 2, 'RF and Wireless > RFID, RF Access, Monitoring ICs', 1488, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (563, 'Subscriber Identification Module (SIM) Cards', 41, 1163, 2, 'RF and Wireless > Subscriber Identification Module (SIM) Cards', 74, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (564, 'Direct Human Safety', 42, 2117, 2, 'Safety Products > Direct Human Safety', 3638, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (565, 'Machine Safety', 42, 2091, 2, 'Safety Products > Machine Safety', 21838, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (566, 'User Controlled Safety', 42, 2118, 2, 'Safety Products > User Controlled Safety', 3896, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (567, 'Color Sensors', 43, 539, 2, 'Sensors, Transducers > Color Sensors', 123, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (568, 'Current Sensors', 43, 525, 2, 'Sensors, Transducers > Current Sensors', 6009, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (569, 'Encoders', 43, 507, 2, 'Sensors, Transducers > Encoders', 15307, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (570, 'Float, Level Sensors', 43, 521, 2, 'Sensors, Transducers > Float, Level Sensors', 4273, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (571, 'Flow Sensors', 43, 520, 2, 'Sensors, Transducers > Flow Sensors', 915, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (572, 'Force Sensors, Load Cells', 43, 531, 2, 'Sensors, Transducers > Force Sensors, Load Cells', 1243, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (573, 'Gas Sensors', 43, 530, 2, 'Sensors, Transducers > Gas Sensors', 1426, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (574, 'Humidity, Moisture Sensors', 43, 529, 2, 'Sensors, Transducers > Humidity, Moisture Sensors', 933, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (575, 'IrDA Transceiver Modules', 43, 538, 2, 'Sensors, Transducers > IrDA Transceiver Modules', 140, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (576, 'LVDT Transducers (Linear Variable Differential Transformer)', 43, 522, 2, 'Sensors, Transducers > LVDT Transducers (Linear Variable Differential Transformer)', 567, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (577, 'Magnetic Sensors', 43, 2068, 2, 'Sensors, Transducers > Magnetic Sensors', 8823, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (578, 'Magnets', 43, 2069, 2, 'Sensors, Transducers > Magnets', 2225, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (579, 'Motion Sensors', 43, 2070, 2, 'Sensors, Transducers > Motion Sensors', 4745, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (580, 'Multifunction', 43, 551, 2, 'Sensors, Transducers > Multifunction', 613, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (581, 'Optical Sensors', 43, 2071, 2, 'Sensors, Transducers > Optical Sensors', 13048, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (582, 'Particle, Dust Sensors', 43, 509, 2, 'Sensors, Transducers > Particle, Dust Sensors', 58, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (583, 'Position Sensors', 43, 2072, 2, 'Sensors, Transducers > Position Sensors', 18490, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (584, 'Pressure Sensors, Transducers', 43, 512, 2, 'Sensors, Transducers > Pressure Sensors, Transducers', 31438, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (585, 'Proximity Sensors', 43, 524, 2, 'Sensors, Transducers > Proximity Sensors', 5278, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (586, 'Proximity/Occupancy Sensors Finished Units', 43, 563, 2, 'Sensors, Transducers > Proximity/Occupancy Sensors Finished Units', 634, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (587, 'Sensor Cable Accessories', 43, 949, 2, 'Sensors, Transducers > Sensor Cable Accessories', 1369, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (588, 'Sensor Cable Assemblies', 43, 950, 2, 'Sensors, Transducers > Sensor Cable Assemblies', 2837, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (589, 'Sensor Interface Junction Blocks', 43, 951, 2, 'Sensors, Transducers > Sensor Interface Junction Blocks', 3377, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (590, 'Sensor, Transducer Accessories', 43, 510, 2, 'Sensors, Transducers > Sensor, Transducer Accessories', 12913, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (591, 'Sensor, Transducer Amplifiers', 43, 557, 2, 'Sensors, Transducers > Sensor, Transducer Amplifiers', 1135, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (592, 'Shock Sensors', 43, 528, 2, 'Sensors, Transducers > Shock Sensors', 72, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (593, 'Solar Cells', 43, 514, 2, 'Sensors, Transducers > Solar Cells', 545, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (594, 'Specialized Sensors', 43, 561, 2, 'Sensors, Transducers > Specialized Sensors', 2751, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (595, 'Strain Gauges', 43, 559, 2, 'Sensors, Transducers > Strain Gauges', 1099, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (596, 'Temperature Sensors', 43, 2075, 2, 'Sensors, Transducers > Temperature Sensors', 25800, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (597, 'Touch Sensors', 43, 971, 2, 'Sensors, Transducers > Touch Sensors', 106, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (598, 'Ultrasonic Receivers, Transmitters', 43, 527, 2, 'Sensors, Transducers > Ultrasonic Receivers, Transmitters', 2043, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (599, 'Desoldering Braid, Wick, Pumps', 44, 265, 2, 'Soldering, Desoldering, Rework Products > Desoldering Braid, Wick, Pumps', 447, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (600, 'Flux, Flux Remover', 44, 266, 2, 'Soldering, Desoldering, Rework Products > Flux, Flux Remover', 462, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (601, 'Fume, Smoke Extraction', 44, 269, 2, 'Soldering, Desoldering, Rework Products > Fume, Smoke Extraction', 151, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (602, 'Holders, Stands', 44, 267, 2, 'Soldering, Desoldering, Rework Products > Holders, Stands', 161, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (603, 'Solder', 44, 262, 2, 'Soldering, Desoldering, Rework Products > Solder', 1771, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (604, 'Solder Sponges, Tip Cleaners', 44, 263, 2, 'Soldering, Desoldering, Rework Products > Solder Sponges, Tip Cleaners', 145, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (605, 'Solder Stencils, Templates', 44, 272, 2, 'Soldering, Desoldering, Rework Products > Solder Stencils, Templates', 646, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (606, 'Soldering Irons, Tweezers, Handles', 44, 268, 2, 'Soldering, Desoldering, Rework Products > Soldering Irons, Tweezers, Handles', 471, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (607, 'Soldering, Desoldering, Rework Accessories', 44, 261, 2, 'Soldering, Desoldering, Rework Products > Soldering, Desoldering, Rework Accessories', 3934, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (608, 'Soldering, Desoldering, Rework Stations', 44, 264, 2, 'Soldering, Desoldering, Rework Products > Soldering, Desoldering, Rework Stations', 469, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (609, 'Soldering, Desoldering, Rework Tips, Nozzles', 44, 270, 2, 'Soldering, Desoldering, Rework Products > Soldering, Desoldering, Rework Tips, Nozzles', 5128, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (610, 'Accessories', 45, 192, 2, 'Switches > Accessories', 15453, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (611, 'Accessories - Boots, Seals', 45, 215, 2, 'Switches > Accessories - Boots, Seals', 716, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (612, 'Accessories - Caps', 45, 210, 2, 'Switches > Accessories - Caps', 5462, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (613, 'Configurable Switch Components', 45, 2076, 2, 'Switches > Configurable Switch Components', 24794, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (614, 'DIP Switches', 45, 194, 2, 'Switches > DIP Switches', 8547, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (615, 'Disconnect Switch Components', 45, 153, 2, 'Switches > Disconnect Switch Components', 3545, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (616, 'Keylock Switches', 45, 196, 2, 'Switches > Keylock Switches', 19127, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (617, 'Keypad Switches', 45, 202, 2, 'Switches > Keypad Switches', 501, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (618, 'Limit Switches', 45, 198, 2, 'Switches > Limit Switches', 25307, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (619, 'Magnetic, Reed Switches', 45, 193, 2, 'Switches > Magnetic, Reed Switches', 1013, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (620, 'Navigation Switches, Joystick', 45, 204, 2, 'Switches > Navigation Switches, Joystick', 2200, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (621, 'Programmable Display Switches', 45, 212, 2, 'Switches > Programmable Display Switches', 39, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (622, 'Pushbutton Switches', 45, 199, 2, 'Switches > Pushbutton Switches', 88604, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (623, 'Pushbutton Switches - Hall Effect', 45, 211, 2, 'Switches > Pushbutton Switches - Hall Effect', 89, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (624, 'Rocker Switches', 45, 195, 2, 'Switches > Rocker Switches', 26011, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (625, 'Rotary Switches', 45, 200, 2, 'Switches > Rotary Switches', 8520, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (626, 'Selector Switches', 45, 203, 2, 'Switches > Selector Switches', 24056, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (627, 'Slide Switches', 45, 213, 2, 'Switches > Slide Switches', 3720, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (628, 'Tactile Switches', 45, 197, 2, 'Switches > Tactile Switches', 14054, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (629, 'Thumbwheel Switches', 45, 214, 2, 'Switches > Thumbwheel Switches', 693, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (630, 'Toggle Switches', 45, 201, 2, 'Switches > Toggle Switches', 22258, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (631, '2D Materials', 46, 961, 2, 'Tapes, Adhesives, Materials > 2D Materials', 85, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (632, 'Accessories', 46, 907, 2, 'Tapes, Adhesives, Materials > Accessories', 136, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (633, 'Films', 46, 965, 2, 'Tapes, Adhesives, Materials > Films', 564, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (634, 'Glue, Adhesives, Applicators', 46, 909, 2, 'Tapes, Adhesives, Materials > Glue, Adhesives, Applicators', 4243, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (635, 'Raw Materials - Composites', 46, 2107, 2, 'Tapes, Adhesives, Materials > Raw Materials - Composites', 617, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (636, 'Raw Materials - Felt', 46, 2106, 2, 'Tapes, Adhesives, Materials > Raw Materials - Felt', 38, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (637, 'Raw Materials - Foam', 46, 2105, 2, 'Tapes, Adhesives, Materials > Raw Materials - Foam', 1638, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (638, 'Raw Materials - Graphite', 46, 2108, 2, 'Tapes, Adhesives, Materials > Raw Materials - Graphite', 38, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (639, 'Raw Materials - Plastics', 46, 2110, 2, 'Tapes, Adhesives, Materials > Raw Materials - Plastics', 5915, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (640, 'Raw Materials - Rubber', 46, 2109, 2, 'Tapes, Adhesives, Materials > Raw Materials - Rubber', 4163, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (641, 'Tape', 46, 908, 2, 'Tapes, Adhesives, Materials > Tape', 28828, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (642, 'Tape Dispensers', 46, 910, 2, 'Tapes, Adhesives, Materials > Tape Dispensers', 127, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (643, 'Data Acquisition (DAQ)', 47, 1017, 2, 'Test and Measurement > Data Acquisition (DAQ)', 2019, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (644, 'GPIB & Communications', 47, 1018, 2, 'Test and Measurement > GPIB & Communications', 130, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (645, 'Test and Measurement Accessories', 47, 613, 2, 'Test and Measurement > Test and Measurement Accessories', 8215, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (646, 'Test Equipment', 47, 2078, 2, 'Test and Measurement > Test Equipment', 14225, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (647, 'Test Leads', 47, 2079, 2, 'Test and Measurement > Test Leads', 13193, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (648, 'Test Points', 47, 616, 2, 'Test and Measurement > Test Points', 394, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (649, 'Test Probe Tips', 47, 622, 2, 'Test and Measurement > Test Probe Tips', 669, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (650, 'Thermometers', 47, 617, 2, 'Test and Measurement > Thermometers', 683, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (651, 'Abrasives and Surface Conditioning Products', 48, 948, 2, 'Tools > Abrasives and Surface Conditioning Products', 18092, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (652, 'Accessories', 48, 227, 2, 'Tools > Accessories', 16424, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (653, 'Assorted Tool Kits', 48, 245, 2, 'Tools > Assorted Tool Kits', 1373, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (654, 'Brushes', 48, 1023, 2, 'Tools > Brushes', 17, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (655, 'Chemicals, Cleaners', 48, 260, 2, 'Tools > Chemicals, Cleaners', 693, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (656, 'Crimpers, Applicators, Presses', 48, 2111, 2, 'Tools > Crimpers, Applicators, Presses', 84381, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (657, 'Dispensing Equipment', 48, 2080, 2, 'Tools > Dispensing Equipment', 2540, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (658, 'Excavators, Hooks, Picks, Probes, Tuning Tools', 48, 241, 2, 'Tools > Excavators, Hooks, Picks, Probes, Tuning Tools', 207, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (659, 'Fiber Optics and Accessories', 48, 256, 2, 'Tools > Fiber Optics and Accessories', 707, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (660, 'Flashlights', 48, 237, 2, 'Tools > Flashlights', 296, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (661, 'Hammers', 48, 246, 2, 'Tools > Hammers', 653, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (662, 'Heat Guns, Torches, Accessories', 48, 255, 2, 'Tools > Heat Guns, Torches, Accessories', 1286, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (663, 'Hex, Torx Keys', 48, 257, 2, 'Tools > Hex, Torx Keys', 1230, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (664, 'Insertion, Extraction', 48, 229, 2, 'Tools > Insertion, Extraction', 3857, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (665, 'Knives, Scissors, Cutting Tools', 48, 242, 2, 'Tools > Knives, Scissors, Cutting Tools', 1750, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (666, 'Paint Supplies', 48, 1111, 2, 'Tools > Paint Supplies', 78, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (667, 'Pliers', 48, 243, 2, 'Tools > Pliers', 2563, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (668, 'Pressure Washers', 48, 1112, 2, 'Tools > Pressure Washers', 6, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (669, 'Punchdown, Blades', 48, 244, 2, 'Tools > Punchdown, Blades', 176, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (670, 'Punches', 48, 248, 2, 'Tools > Punches', 371, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (671, 'Screwdrivers, Nut Drivers and Sets', 48, 2081, 2, 'Tools > Screwdrivers, Nut Drivers and Sets', 9709, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (672, 'Socket and Socket Handles', 48, 2082, 2, 'Tools > Socket and Socket Handles', 8228, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (673, 'Specialized Tools', 48, 233, 2, 'Tools > Specialized Tools', 21658, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (674, 'Spiral Wrap, Expandable Sleeving', 48, 238, 2, 'Tools > Spiral Wrap, Expandable Sleeving', 57, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (675, 'Staking Tools', 48, 252, 2, 'Tools > Staking Tools', 66, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (676, 'Tool Bags, Boxes and Cabinets', 48, 1113, 2, 'Tools > Tool Bags, Boxes and Cabinets', 419, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (677, 'Tweezers', 48, 240, 2, 'Tools > Tweezers', 2448, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (678, 'Vacuums', 48, 235, 2, 'Tools > Vacuums', 134, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (679, 'Vises', 48, 253, 2, 'Tools > Vises', 111, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (680, 'Wire Cutters', 48, 234, 2, 'Tools > Wire Cutters', 2227, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (681, 'Wire Strippers and Accessories', 48, 230, 2, 'Tools > Wire Strippers and Accessories', 1590, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (682, 'Wire Tie Guns and Accessories', 48, 254, 2, 'Tools > Wire Tie Guns and Accessories', 237, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (683, 'Wire Wrap', 48, 231, 2, 'Tools > Wire Wrap', 62, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (684, 'Workbenches, Stations and Accessories', 48, 2083, 2, 'Tools > Workbenches, Stations and Accessories', 1001, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (685, 'Wrenches', 48, 258, 2, 'Tools > Wrenches', 5425, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (686, 'Accessories', 49, 161, 2, 'Transformers > Accessories', 211, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (687, 'Audio Transformers', 49, 162, 2, 'Transformers > Audio Transformers', 1005, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (688, 'Current Sense Transformers', 49, 163, 2, 'Transformers > Current Sense Transformers', 2992, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (689, 'Isolation Transformers and Autotransformers, Step Up, Step Down', 49, 167, 2, 'Transformers > Isolation Transformers and Autotransformers, Step Up, Step Down', 610, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (690, 'Power Transformers', 49, 164, 2, 'Transformers > Power Transformers', 7352, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (691, 'Pulse Transformers', 49, 166, 2, 'Transformers > Pulse Transformers', 5278, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (692, 'Specialty Transformers', 49, 165, 2, 'Transformers > Specialty Transformers', 272, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (693, 'Switching Converter, SMPS Transformers', 49, 168, 2, 'Transformers > Switching Converter, SMPS Transformers', 2038, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (694, 'Unclassified', 50, 48, 2, 'Uncategorized > Unclassified', 222339, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (695, 'Barrel Audio Cables', 96, 463, 3, 'Cable Assemblies > Barrel Connector Cables > Barrel Audio Cables', 1217, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (696, 'Barrel Power Cables', 96, 464, 3, 'Cable Assemblies > Barrel Connector Cables > Barrel Power Cables', 910, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (697, 'Wire Duct, Raceway Accessories', 145, 487, 3, 'Cables, Wires - Management > Wire Ducts, Raceways > Wire Duct, Raceway Accessories', 3281, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (698, 'Wire Duct, Raceway Covers', 145, 957, 3, 'Cables, Wires - Management > Wire Ducts, Raceways > Wire Duct, Raceway Covers', 786, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (699, 'Wire Ducts, Raceways', 145, 486, 3, 'Cables, Wires - Management > Wire Ducts, Raceways > Wire Ducts, Raceways', 4279, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (700, 'Mixed Technology', 173, 149, 3, 'Circuit Protection > Transient Voltage Suppressors (TVS) > Mixed Technology', 1184, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (701, 'Surge Protection Devices (SPDs)', 173, 992, 3, 'Circuit Protection > Transient Voltage Suppressors (TVS) > Surge Protection Devices (SPDs)', 11883, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (702, 'Thyristors', 173, 147, 3, 'Circuit Protection > Transient Voltage Suppressors (TVS) > Thyristors', 2522, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (703, 'TVS Diodes', 173, 144, 3, 'Circuit Protection > Transient Voltage Suppressors (TVS) > TVS Diodes', 100060, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (704, 'Plugs and Receptacles', 192, 1170, 3, 'Connectors, Interconnects > AC Power Connectors > Plugs and Receptacles', 5150, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (705, 'Power Entry Connector Accessories', 192, 341, 3, 'Connectors, Interconnects > AC Power Connectors > Power Entry Connector Accessories', 1125, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (706, 'Power Entry Modules (PEM)', 192, 301, 3, 'Connectors, Interconnects > AC Power Connectors > Power Entry Modules (PEM)', 8179, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (707, 'ARINC', 193, 386, 3, 'Connectors, Interconnects > Backplane Connectors > ARINC', 912, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (708, 'ARINC Inserts', 193, 430, 3, 'Connectors, Interconnects > Backplane Connectors > ARINC Inserts', 2259, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (709, 'Backplane Connector Accessories', 193, 343, 3, 'Connectors, Interconnects > Backplane Connectors > Backplane Connector Accessories', 2409, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (710, 'Backplane Connector Contacts', 193, 335, 3, 'Connectors, Interconnects > Backplane Connectors > Backplane Connector Contacts', 2535, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (711, 'Backplane Connector Housings', 193, 372, 3, 'Connectors, Interconnects > Backplane Connectors > Backplane Connector Housings', 9359, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (712, 'DIN 41612', 193, 307, 3, 'Connectors, Interconnects > Backplane Connectors > DIN 41612', 5129, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (713, 'Hard Metric, Standard', 193, 406, 3, 'Connectors, Interconnects > Backplane Connectors > Hard Metric, Standard', 4471, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (714, 'Specialized', 193, 407, 3, 'Connectors, Interconnects > Backplane Connectors > Specialized', 35298, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (715, 'Banana and Tip Connector Accessories', 194, 351, 3, 'Connectors, Interconnects > Banana and Tip Connectors > Banana and Tip Connector Accessories', 61, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (716, 'Banana and Tip Connector Adapters', 194, 381, 3, 'Connectors, Interconnects > Banana and Tip Connectors > Banana and Tip Connector Adapters', 75, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (717, 'Binding Posts', 194, 310, 3, 'Connectors, Interconnects > Banana and Tip Connectors > Binding Posts', 256, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (718, 'Jacks, Plugs', 194, 302, 3, 'Connectors, Interconnects > Banana and Tip Connectors > Jacks, Plugs', 1760, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (719, 'Audio Connectors', 195, 434, 3, 'Connectors, Interconnects > Barrel Connectors > Audio Connectors', 2560, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (720, 'Barrel Connector Accessories', 195, 348, 3, 'Connectors, Interconnects > Barrel Connectors > Barrel Connector Accessories', 108, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (721, 'Barrel Connector Adapters', 195, 376, 3, 'Connectors, Interconnects > Barrel Connectors > Barrel Connector Adapters', 218, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (722, 'Power Connectors', 195, 435, 3, 'Connectors, Interconnects > Barrel Connectors > Power Connectors', 1127, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (723, 'Blade Type Power Connector Accessories', 197, 360, 3, 'Connectors, Interconnects > Blade Type Power Connectors > Blade Type Power Connector Accessories', 470, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (724, 'Blade Type Power Connector Assemblies', 197, 357, 3, 'Connectors, Interconnects > Blade Type Power Connectors > Blade Type Power Connector Assemblies', 2124, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (725, 'Blade Type Power Connector Contacts', 197, 420, 3, 'Connectors, Interconnects > Blade Type Power Connectors > Blade Type Power Connector Contacts', 370, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (726, 'Blade Type Power Connector Housings', 197, 419, 3, 'Connectors, Interconnects > Blade Type Power Connectors > Blade Type Power Connector Housings', 745, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (727, 'Card Edge Connector Accessories', 198, 349, 3, 'Connectors, Interconnects > Card Edge Connectors > Card Edge Connector Accessories', 180, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (728, 'Card Edge Connector Adapters', 198, 429, 3, 'Connectors, Interconnects > Card Edge Connectors > Card Edge Connector Adapters', 70, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (729, 'Card Edge Connector Contacts', 198, 345, 3, 'Connectors, Interconnects > Card Edge Connectors > Card Edge Connector Contacts', 160, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (730, 'Card Edge Connector Housings', 198, 354, 3, 'Connectors, Interconnects > Card Edge Connectors > Card Edge Connector Housings', 249, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (731, 'Edgeboard Connectors', 198, 303, 3, 'Connectors, Interconnects > Card Edge Connectors > Edgeboard Connectors', 619542, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (732, 'Backshells and Cable Clamps', 199, 313, 3, 'Connectors, Interconnects > Circular Connectors > Backshells and Cable Clamps', 64024, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (733, 'Circular Connector Accessories', 199, 329, 3, 'Connectors, Interconnects > Circular Connectors > Circular Connector Accessories', 68553, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (734, 'Circular Connector Adapters', 199, 378, 3, 'Connectors, Interconnects > Circular Connectors > Circular Connector Adapters', 47623, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (735, 'Circular Connector Assemblies', 199, 436, 3, 'Connectors, Interconnects > Circular Connectors > Circular Connector Assemblies', 2232196, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (736, 'Circular Connector Contacts', 199, 330, 3, 'Connectors, Interconnects > Circular Connectors > Circular Connector Contacts', 6694, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (737, 'Circular Connector Housings', 199, 320, 3, 'Connectors, Interconnects > Circular Connectors > Circular Connector Housings', 572878, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (738, 'Coaxial Connector (RF) Accessories', 200, 342, 3, 'Connectors, Interconnects > Coaxial Connectors (RF) > Coaxial Connector (RF) Accessories', 2472, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (739, 'Coaxial Connector (RF) Adapters', 200, 374, 3, 'Connectors, Interconnects > Coaxial Connectors (RF) > Coaxial Connector (RF) Adapters', 9121, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (740, 'Coaxial Connector (RF) Assemblies', 200, 437, 3, 'Connectors, Interconnects > Coaxial Connectors (RF) > Coaxial Connector (RF) Assemblies', 30056, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (741, 'Coaxial Connector (RF) Contacts', 200, 388, 3, 'Connectors, Interconnects > Coaxial Connectors (RF) > Coaxial Connector (RF) Contacts', 353, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (742, 'Coaxial Connector (RF) Terminators', 200, 382, 3, 'Connectors, Interconnects > Coaxial Connectors (RF) > Coaxial Connector (RF) Terminators', 1751, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (743, 'Contacts, Spring Loaded (Pogo Pins), and Pressure', 201, 311, 3, 'Connectors, Interconnects > Contacts > Contacts, Spring Loaded (Pogo Pins), and Pressure', 725, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (744, 'Leadframe', 201, 416, 3, 'Connectors, Interconnects > Contacts > Leadframe', 59, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (745, 'Multi Purpose', 201, 336, 3, 'Connectors, Interconnects > Contacts > Multi Purpose', 3484, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (746, 'Centronics Connectors', 202, 438, 3, 'Connectors, Interconnects > D-Sub, D-Shaped Connectors > Centronics Connectors', 2684, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (747, 'D-Sub Connector Assemblies', 202, 439, 3, 'Connectors, Interconnects > D-Sub, D-Shaped Connectors > D-Sub Connector Assemblies', 212759, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (748, 'D-Sub, D-Shaped Connector Accessories', 202, 339, 3, 'Connectors, Interconnects > D-Sub, D-Shaped Connectors > D-Sub, D-Shaped Connector Accessories', 3026, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (749, 'D-Sub, D-Shaped Connector Adapters', 202, 375, 3, 'Connectors, Interconnects > D-Sub, D-Shaped Connectors > D-Sub, D-Shaped Connector Adapters', 1634, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (750, 'D-Sub, D-Shaped Connector Backshells, Hoods', 202, 355, 3, 'Connectors, Interconnects > D-Sub, D-Shaped Connectors > D-Sub, D-Shaped Connector Backshells, Hoods', 7957, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (751, 'D-Sub, D-Shaped Connector Contacts', 202, 332, 3, 'Connectors, Interconnects > D-Sub, D-Shaped Connectors > D-Sub, D-Shaped Connector Contacts', 2146, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (752, 'D-Sub, D-Shaped Connector Housings', 202, 321, 3, 'Connectors, Interconnects > D-Sub, D-Shaped Connectors > D-Sub, D-Shaped Connector Housings', 25984, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (753, 'D-Sub, D-Shaped Connector Jackscrews', 202, 447, 3, 'Connectors, Interconnects > D-Sub, D-Shaped Connectors > D-Sub, D-Shaped Connector Jackscrews', 1714, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (754, 'D-Sub, D-Shaped Connector Terminators', 202, 383, 3, 'Connectors, Interconnects > D-Sub, D-Shaped Connectors > D-Sub, D-Shaped Connector Terminators', 31, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (755, 'FFC, FPC (Flat Flexible) Connector Accessories', 203, 350, 3, 'Connectors, Interconnects > FFC, FPC (Flat Flexible) Connectors > FFC, FPC (Flat Flexible) Connector Accessories', 58, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (756, 'FFC, FPC (Flat Flexible) Connector Assemblies', 203, 399, 3, 'Connectors, Interconnects > FFC, FPC (Flat Flexible) Connectors > FFC, FPC (Flat Flexible) Connector Assemblies', 17050, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (757, 'FFC, FPC (Flat Flexible) Connector Contacts', 203, 344, 3, 'Connectors, Interconnects > FFC, FPC (Flat Flexible) Connectors > FFC, FPC (Flat Flexible) Connector Contacts', 121, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (758, 'FFC, FPC (Flat Flexible) Connector Housings', 203, 390, 3, 'Connectors, Interconnects > FFC, FPC (Flat Flexible) Connectors > FFC, FPC (Flat Flexible) Connector Housings', 339, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (759, 'Fiber Optic Connector Accessories', 204, 389, 3, 'Connectors, Interconnects > Fiber Optic Connectors > Fiber Optic Connector Accessories', 647, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (760, 'Fiber Optic Connector Adapters', 204, 387, 3, 'Connectors, Interconnects > Fiber Optic Connectors > Fiber Optic Connector Adapters', 3202, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (761, 'Fiber Optic Connector Assemblies', 204, 440, 3, 'Connectors, Interconnects > Fiber Optic Connectors > Fiber Optic Connector Assemblies', 1964, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (762, 'Fiber Optic Connector Housings', 204, 445, 3, 'Connectors, Interconnects > Fiber Optic Connectors > Fiber Optic Connector Housings', 331, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (763, 'Heavy Duty Connector Accessories', 205, 358, 3, 'Connectors, Interconnects > Heavy Duty Connectors > Heavy Duty Connector Accessories', 3595, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (764, 'Heavy Duty Connector Assemblies', 205, 327, 3, 'Connectors, Interconnects > Heavy Duty Connectors > Heavy Duty Connector Assemblies', 620, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (765, 'Heavy Duty Connector Contacts', 205, 337, 3, 'Connectors, Interconnects > Heavy Duty Connectors > Heavy Duty Connector Contacts', 1859, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (766, 'Heavy Duty Connector Frames', 205, 362, 3, 'Connectors, Interconnects > Heavy Duty Connectors > Heavy Duty Connector Frames', 520, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (767, 'Heavy Duty Connector Housings, Hoods, Bases', 205, 363, 3, 'Connectors, Interconnects > Heavy Duty Connectors > Heavy Duty Connector Housings, Hoods, Bases', 13959, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (768, 'Heavy Duty Connector Inserts, Modules', 205, 361, 3, 'Connectors, Interconnects > Heavy Duty Connectors > Heavy Duty Connector Inserts, Modules', 3971, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (769, 'Keystone Connector Accessories', 206, 426, 3, 'Connectors, Interconnects > Keystone Connectors > Keystone Connector Accessories', 371, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (770, 'Keystone Faceplates, Frames', 206, 427, 3, 'Connectors, Interconnects > Keystone Connectors > Keystone Faceplates, Frames', 1504, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (771, 'Keystone Inserts', 206, 428, 3, 'Connectors, Interconnects > Keystone Connectors > Keystone Inserts', 1782, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (772, 'Inline Module Sockets', 208, 413, 3, 'Connectors, Interconnects > Memory Connectors > Inline Module Sockets', 2484, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (773, 'Memory Connector Accessories', 208, 352, 3, 'Connectors, Interconnects > Memory Connectors > Memory Connector Accessories', 140, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (774, 'PC Card Sockets', 208, 414, 3, 'Connectors, Interconnects > Memory Connectors > PC Card Sockets', 1957, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (775, 'PC Cards - Adapters', 208, 421, 3, 'Connectors, Interconnects > Memory Connectors > PC Cards - Adapters', 19, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (776, 'Modular/Ethernet Connector (RJ45, RJ11) Jacks', 209, 366, 3, 'Connectors, Interconnects > Modular/Ethernet Connectors > Modular/Ethernet Connector (RJ45, RJ11) Jacks', 10437, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (777, 'Modular/Ethernet Connector (RJ45, RJ11) Plugs', 209, 367, 3, 'Connectors, Interconnects > Modular/Ethernet Connectors > Modular/Ethernet Connector (RJ45, RJ11) Plugs', 1683, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (778, 'Modular/Ethernet Connector (RJ45) Jacks With Magnetics', 209, 365, 3, 'Connectors, Interconnects > Modular/Ethernet Connectors > Modular/Ethernet Connector (RJ45) Jacks With Magnetics', 6389, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (779, 'Modular/Ethernet Connector Accessories', 209, 442, 3, 'Connectors, Interconnects > Modular/Ethernet Connectors > Modular/Ethernet Connector Accessories', 1039, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (780, 'Modular/Ethernet Connector Adapters', 209, 379, 3, 'Connectors, Interconnects > Modular/Ethernet Connectors > Modular/Ethernet Connector Adapters', 1256, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (781, 'Modular/Ethernet Connector Plug Housings', 209, 403, 3, 'Connectors, Interconnects > Modular/Ethernet Connectors > Modular/Ethernet Connector Plug Housings', 169, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (782, 'Modular/Ethernet Connector Wiring Blocks', 209, 418, 3, 'Connectors, Interconnects > Modular/Ethernet Connectors > Modular/Ethernet Connector Wiring Blocks', 69, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (783, 'Modular/Ethernet Connector Wiring Blocks Accessories', 209, 417, 3, 'Connectors, Interconnects > Modular/Ethernet Connectors > Modular/Ethernet Connector Wiring Blocks Accessories', 30, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (784, 'Photovoltaic (Solar Panel) Connector Accessories', 210, 424, 3, 'Connectors, Interconnects > Photovoltaic (Solar Panel) Connectors > Photovoltaic (Solar Panel) Connector Accessories', 90, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (785, 'Photovoltaic (Solar Panel) Connector Assemblies', 210, 326, 3, 'Connectors, Interconnects > Photovoltaic (Solar Panel) Connectors > Photovoltaic (Solar Panel) Connector Assemblies', 417, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (786, 'Photovoltaic (Solar Panel) Connector Contacts', 210, 423, 3, 'Connectors, Interconnects > Photovoltaic (Solar Panel) Connectors > Photovoltaic (Solar Panel) Connector Contacts', 65, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (787, 'Pluggable Connector Accessories', 211, 346, 3, 'Connectors, Interconnects > Pluggable Connectors > Pluggable Connector Accessories', 554, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (788, 'Pluggable Connector Assemblies', 211, 443, 3, 'Connectors, Interconnects > Pluggable Connectors > Pluggable Connector Assemblies', 5828, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (789, 'Arrays, Edge Type, Mezzanine (Board to Board)', 212, 308, 3, 'Connectors, Interconnects > Rectangular Connectors > Arrays, Edge Type, Mezzanine (Board to Board)', 30276, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (790, 'Board In, Direct Wire to Board', 212, 317, 3, 'Connectors, Interconnects > Rectangular Connectors > Board In, Direct Wire to Board', 2042, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (791, 'Board Spacers, Stackers (Board to Board)', 212, 400, 3, 'Connectors, Interconnects > Rectangular Connectors > Board Spacers, Stackers (Board to Board)', 339039, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (792, 'Free Hanging, Panel Mount', 212, 316, 3, 'Connectors, Interconnects > Rectangular Connectors > Free Hanging, Panel Mount', 22107, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (793, 'Headers, Male Pins', 212, 314, 3, 'Connectors, Interconnects > Rectangular Connectors > Headers, Male Pins', 342372, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (794, 'Headers, Receptacles, Female Sockets', 212, 315, 3, 'Connectors, Interconnects > Rectangular Connectors > Headers, Receptacles, Female Sockets', 180577, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (795, 'Headers, Specialty Pin', 212, 318, 3, 'Connectors, Interconnects > Rectangular Connectors > Headers, Specialty Pin', 8665, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (796, 'Rectangular Connector Accessories', 212, 340, 3, 'Connectors, Interconnects > Rectangular Connectors > Rectangular Connector Accessories', 7632, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (797, 'Rectangular Connector Adapters', 212, 380, 3, 'Connectors, Interconnects > Rectangular Connectors > Rectangular Connector Adapters', 407, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (798, 'Rectangular Connector Contacts', 212, 331, 3, 'Connectors, Interconnects > Rectangular Connectors > Rectangular Connector Contacts', 8355, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (799, 'Rectangular Connector Housings', 212, 319, 3, 'Connectors, Interconnects > Rectangular Connectors > Rectangular Connector Housings', 34027, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (800, 'Spring Loaded', 212, 408, 3, 'Connectors, Interconnects > Rectangular Connectors > Spring Loaded', 11156, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (801, 'IC Sockets', 214, 409, 3, 'Connectors, Interconnects > Sockets for ICs, Transistors > IC Sockets', 19781, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (802, 'Socket Accessories', 214, 410, 3, 'Connectors, Interconnects > Sockets for ICs, Transistors > Socket Accessories', 159, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (803, 'Socket Adapters', 214, 411, 3, 'Connectors, Interconnects > Sockets for ICs, Transistors > Socket Adapters', 265, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (804, 'Solid State Lighting Connector Accessories', 215, 432, 3, 'Connectors, Interconnects > Solid State Lighting Connectors > Solid State Lighting Connector Accessories', 272, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (805, 'Solid State Lighting Connector Assemblies', 215, 444, 3, 'Connectors, Interconnects > Solid State Lighting Connectors > Solid State Lighting Connector Assemblies', 1338, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (806, 'Solid State Lighting Connector Contacts', 215, 446, 3, 'Connectors, Interconnects > Solid State Lighting Connectors > Solid State Lighting Connector Contacts', 235, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (807, 'Barrier Blocks', 216, 368, 3, 'Connectors, Interconnects > Terminal Blocks > Barrier Blocks', 40639, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (808, 'Din Rail, Channel', 216, 369, 3, 'Connectors, Interconnects > Terminal Blocks > Din Rail, Channel', 11090, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (809, 'Headers, Plugs and Sockets', 216, 370, 3, 'Connectors, Interconnects > Terminal Blocks > Headers, Plugs and Sockets', 87339, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (810, 'Interface Modules', 216, 431, 3, 'Connectors, Interconnects > Terminal Blocks > Interface Modules', 1649, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (811, 'Panel Mount', 216, 425, 3, 'Connectors, Interconnects > Terminal Blocks > Panel Mount', 1366, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (812, 'Power Distribution', 216, 412, 3, 'Connectors, Interconnects > Terminal Blocks > Power Distribution', 1603, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (813, 'Specialized', 216, 433, 3, 'Connectors, Interconnects > Terminal Blocks > Specialized', 3934, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (814, 'Terminal Block Accessories', 216, 2033, 3, 'Connectors, Interconnects > Terminal Blocks > Terminal Block Accessories', 23083, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (815, 'Terminal Block Adapters', 216, 322, 3, 'Connectors, Interconnects > Terminal Blocks > Terminal Block Adapters', 646, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (816, 'Terminal Block Contacts', 216, 338, 3, 'Connectors, Interconnects > Terminal Blocks > Terminal Block Contacts', 71, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (817, 'Wire to Board', 216, 371, 3, 'Connectors, Interconnects > Terminal Blocks > Wire to Board', 55620, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (818, 'Barrel, Bullet Connectors', 219, 393, 3, 'Connectors, Interconnects > Terminals > Barrel, Bullet Connectors', 453, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (819, 'Foil Connectors', 219, 402, 3, 'Connectors, Interconnects > Terminals > Foil Connectors', 33, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (820, 'Housings, Boots', 219, 325, 3, 'Connectors, Interconnects > Terminals > Housings, Boots', 1720, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (821, 'Knife Connectors', 219, 404, 3, 'Connectors, Interconnects > Terminals > Knife Connectors', 61, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (822, 'Lugs', 219, 395, 3, 'Connectors, Interconnects > Terminals > Lugs', 3876, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (823, 'Magnetic Wire Connectors', 219, 353, 3, 'Connectors, Interconnects > Terminals > Magnetic Wire Connectors', 827, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (824, 'PC Pin Receptacles, Socket Connectors', 219, 324, 3, 'Connectors, Interconnects > Terminals > PC Pin Receptacles, Socket Connectors', 5669, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (825, 'PC Pin, Single Post Connectors', 219, 323, 3, 'Connectors, Interconnects > Terminals > PC Pin, Single Post Connectors', 3212, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (826, 'Quick Connects, Quick Disconnect Connectors', 219, 392, 3, 'Connectors, Interconnects > Terminals > Quick Connects, Quick Disconnect Connectors', 5503, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (827, 'Ring Connectors', 219, 394, 3, 'Connectors, Interconnects > Terminals > Ring Connectors', 7995, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (828, 'Screw Connectors', 219, 396, 3, 'Connectors, Interconnects > Terminals > Screw Connectors', 780, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (829, 'Solder Lug Connectors', 219, 401, 3, 'Connectors, Interconnects > Terminals > Solder Lug Connectors', 47, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (830, 'Spade Connectors', 219, 391, 3, 'Connectors, Interconnects > Terminals > Spade Connectors', 2794, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (831, 'Specialized Connectors', 219, 356, 3, 'Connectors, Interconnects > Terminals > Specialized Connectors', 3166, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (832, 'Terminal Accessories', 219, 415, 3, 'Connectors, Interconnects > Terminals > Terminal Accessories', 327, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (833, 'Terminal Adapters', 219, 405, 3, 'Connectors, Interconnects > Terminals > Terminal Adapters', 84, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (834, 'Turret Connectors', 219, 328, 3, 'Connectors, Interconnects > Terminals > Turret Connectors', 1132, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (835, 'Wire Pin Connectors', 219, 397, 3, 'Connectors, Interconnects > Terminals > Wire Pin Connectors', 278, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (836, 'Wire Splice Connectors', 219, 305, 3, 'Connectors, Interconnects > Terminals > Wire Splice Connectors', 3301, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (837, 'Wire to Board Connectors', 219, 398, 3, 'Connectors, Interconnects > Terminals > Wire to Board Connectors', 147, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (838, 'USB, DVI, HDMI Connector Accessories', 220, 347, 3, 'Connectors, Interconnects > USB, DVI, HDMI Connectors > USB, DVI, HDMI Connector Accessories', 349, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (839, 'USB, DVI, HDMI Connector Adapters', 220, 377, 3, 'Connectors, Interconnects > USB, DVI, HDMI Connectors > USB, DVI, HDMI Connector Adapters', 1009, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (840, 'USB, DVI, HDMI Connector Assemblies', 220, 312, 3, 'Connectors, Interconnects > USB, DVI, HDMI Connectors > USB, DVI, HDMI Connector Assemblies', 4928, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (841, 'Analog to Digital Converters (ADCs) Evaluation Boards', 230, 791, 3, 'Development Boards, Kits, Programmers > Evaluation Boards > Analog to Digital Converters (ADCs) Evaluation Boards', 1902, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (842, 'Audio Amplifier Evaluation Boards', 230, 789, 3, 'Development Boards, Kits, Programmers > Evaluation Boards > Audio Amplifier Evaluation Boards', 749, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (843, 'DC/DC & AC/DC (Off-Line) SMPS Evaluation Boards', 230, 792, 3, 'Development Boards, Kits, Programmers > Evaluation Boards > DC/DC & AC/DC (Off-Line) SMPS Evaluation Boards', 7412, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (844, 'Digital to Analog Converters (DACs) Evaluation Boards', 230, 793, 3, 'Development Boards, Kits, Programmers > Evaluation Boards > Digital to Analog Converters (DACs) Evaluation Boards', 734, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (845, 'Embedded Complex Logic (FPGA, CPLD) Evaluation Boards', 230, 796, 3, 'Development Boards, Kits, Programmers > Evaluation Boards > Embedded Complex Logic (FPGA, CPLD) Evaluation Boards', 1076, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (846, 'Embedded MCU, DSP Evaluation Boards', 230, 786, 3, 'Development Boards, Kits, Programmers > Evaluation Boards > Embedded MCU, DSP Evaluation Boards', 5132, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (847, 'Evaluation and Demonstration Boards and Kits', 230, 787, 3, 'Development Boards, Kits, Programmers > Evaluation Boards > Evaluation and Demonstration Boards and Kits', 15407, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (848, 'Expansion Boards, Daughter Cards', 230, 797, 3, 'Development Boards, Kits, Programmers > Evaluation Boards > Expansion Boards, Daughter Cards', 7781, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (849, 'LED Driver Evaluation Boards', 230, 794, 3, 'Development Boards, Kits, Programmers > Evaluation Boards > LED Driver Evaluation Boards', 1533, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (850, 'Linear Voltage Regulator Evaluation Boards', 230, 790, 3, 'Development Boards, Kits, Programmers > Evaluation Boards > Linear Voltage Regulator Evaluation Boards', 945, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (851, 'Op Amp Evaluation Boards', 230, 788, 3, 'Development Boards, Kits, Programmers > Evaluation Boards > Op Amp Evaluation Boards', 1071, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (852, 'RF, RFID, Wireless Evaluation Boards', 230, 1165, 3, 'Development Boards, Kits, Programmers > Evaluation Boards > RF, RFID, Wireless Evaluation Boards', 10554, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (853, 'Sensor Evaluation Boards', 230, 795, 3, 'Development Boards, Kits, Programmers > Evaluation Boards > Sensor Evaluation Boards', 4336, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (854, 'Bridge Rectifiers', 235, 299, 3, 'Discrete Semiconductor Products > Diodes > Bridge Rectifiers', 7357, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (855, 'Rectifiers', 235, 2085, 3, 'Discrete Semiconductor Products > Diodes > Rectifiers', 65729, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (856, 'RF Diodes', 235, 284, 3, 'Discrete Semiconductor Products > Diodes > RF Diodes', 2307, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (857, 'Variable Capacitance (Varicaps, Varactors)', 235, 282, 3, 'Discrete Semiconductor Products > Diodes > Variable Capacitance (Varicaps, Varactors)', 957, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (858, 'Zener', 235, 2086, 3, 'Discrete Semiconductor Products > Diodes > Zener', 70634, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (859, 'DIACs, SIDACs', 237, 274, 3, 'Discrete Semiconductor Products > Thyristors > DIACs, SIDACs', 302, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (860, 'SCRs', 237, 281, 3, 'Discrete Semiconductor Products > Thyristors > SCRs', 4059, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (861, 'SCRs - Modules', 237, 298, 3, 'Discrete Semiconductor Products > Thyristors > SCRs - Modules', 2500, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (862, 'TRIACs', 237, 300, 3, 'Discrete Semiconductor Products > Thyristors > TRIACs', 3624, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (863, 'Bipolar (BJT)', 238, 2087, 3, 'Discrete Semiconductor Products > Transistors > Bipolar (BJT)', 31406, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (864, 'FETs, MOSFETs', 238, 2088, 3, 'Discrete Semiconductor Products > Transistors > FETs, MOSFETs', 54967, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (865, 'IGBTs', 238, 2089, 3, 'Discrete Semiconductor Products > Transistors > IGBTs', 7467, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (866, 'JFETs', 238, 288, 3, 'Discrete Semiconductor Products > Transistors > JFETs', 1109, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (867, 'Programmable Unijunction', 238, 290, 3, 'Discrete Semiconductor Products > Transistors > Programmable Unijunction', 43, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (868, 'Special Purpose', 238, 294, 3, 'Discrete Semiconductor Products > Transistors > Special Purpose', 174, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (869, 'AC Fans', 242, 216, 3, 'Fans, Blowers, Thermal Management > Fans > AC Fans', 4109, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (870, 'DC Brushless Fans (BLDC)', 242, 217, 3, 'Fans, Blowers, Thermal Management > Fans > DC Brushless Fans (BLDC)', 25438, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (871, 'Fan Accessories', 242, 223, 3, 'Fans, Blowers, Thermal Management > Fans > Fan Accessories', 653, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (872, 'Fan Cords', 242, 974, 3, 'Fans, Blowers, Thermal Management > Fans > Fan Cords', 297, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (873, 'Finger Guards, Filters & Sleeves', 242, 221, 3, 'Fans, Blowers, Thermal Management > Fans > Finger Guards, Filters & Sleeves', 1054, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (874, 'Adhesives, Epoxies, Greases, Pastes', 244, 220, 3, 'Fans, Blowers, Thermal Management > Thermal > Adhesives, Epoxies, Greases, Pastes', 926, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (875, 'Heat Pipes, Vapor Chambers', 244, 977, 3, 'Fans, Blowers, Thermal Management > Thermal > Heat Pipes, Vapor Chambers', 1349, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (876, 'Heat Sinks', 244, 219, 3, 'Fans, Blowers, Thermal Management > Thermal > Heat Sinks', 124149, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (877, 'Liquid Cooling, Heating', 244, 226, 3, 'Fans, Blowers, Thermal Management > Thermal > Liquid Cooling, Heating', 403, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (878, 'Pads, Sheets, Bridges', 244, 218, 3, 'Fans, Blowers, Thermal Management > Thermal > Pads, Sheets, Bridges', 12590, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (879, 'Thermal Accessories', 244, 224, 3, 'Fans, Blowers, Thermal Management > Thermal > Thermal Accessories', 988, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (880, 'Thermoelectric, Peltier Assemblies', 244, 225, 3, 'Fans, Blowers, Thermal Management > Thermal > Thermoelectric, Peltier Assemblies', 236, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (881, 'Thermoelectric, Peltier Modules', 244, 222, 3, 'Fans, Blowers, Thermal Management > Thermal > Thermoelectric, Peltier Modules', 1591, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (882, 'Compression, Tapered Springs', 280, 1002, 3, 'Hardware, Fasteners, Accessories > Springs > Compression, Tapered Springs', 11869, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (883, 'Extension, Drawbar Springs', 280, 1006, 3, 'Hardware, Fasteners, Accessories > Springs > Extension, Drawbar Springs', 2737, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (884, 'Torsion Springs', 280, 1007, 3, 'Hardware, Fasteners, Accessories > Springs > Torsion Springs', 631, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (885, 'Bushing, Shoulder Washers', 282, 583, 3, 'Hardware, Fasteners, Accessories > Washers > Bushing, Shoulder Washers', 2457, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (886, 'Standard Washers', 282, 571, 3, 'Hardware, Fasteners, Accessories > Washers > Standard Washers', 3223, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (887, 'Cable Assemblies', 290, 823, 3, 'Industrial Automation and Controls > Controllers > Cable Assemblies', 4440, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (888, 'Controller Accessories', 290, 816, 3, 'Industrial Automation and Controls > Controllers > Controller Accessories', 1985, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (889, 'Liquid, Level', 290, 806, 3, 'Industrial Automation and Controls > Controllers > Liquid, Level', 557, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (890, 'PLC Modules', 290, 821, 3, 'Industrial Automation and Controls > Controllers > PLC Modules', 4327, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (891, 'Process, Temperature', 290, 801, 3, 'Industrial Automation and Controls > Controllers > Process, Temperature', 4779, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (892, 'Programmable (PLC, PAC)', 290, 814, 3, 'Industrial Automation and Controls > Controllers > Programmable (PLC, PAC)', 1813, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (893, 'Human Machine Interface (HMI) Accessories', 293, 947, 3, 'Industrial Automation and Controls > Human Machine Interface (HMI) > Human Machine Interface (HMI) Accessories', 817, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (894, 'Machine Interface', 293, 946, 3, 'Industrial Automation and Controls > Human Machine Interface (HMI) > Machine Interface', 1575, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (895, 'Pick to Light', 296, 1063, 3, 'Industrial Automation and Controls > Industrial Lighting > Pick to Light', 355, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (896, 'Task Lighting', 296, 1061, 3, 'Industrial Automation and Controls > Industrial Lighting > Task Lighting', 3100, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (897, 'Lighting Control', 297, 819, 3, 'Industrial Automation and Controls > Industrial Lighting Control > Lighting Control', 186, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (898, 'Lighting Control Accessories', 297, 820, 3, 'Industrial Automation and Controls > Industrial Lighting Control > Lighting Control Accessories', 113, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (899, 'Color Sensors - Industrial', 299, 1070, 3, 'Industrial Automation and Controls > Industrial Sensors > Color Sensors - Industrial', 71, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (900, 'Encoders - Industrial', 299, 1075, 3, 'Industrial Automation and Controls > Industrial Sensors > Encoders - Industrial', 12336, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (901, 'Float, Level Sensors - Industrial', 299, 1068, 3, 'Industrial Automation and Controls > Industrial Sensors > Float, Level Sensors - Industrial', 2594, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (902, 'Flow Sensors - Industrial', 299, 1067, 3, 'Industrial Automation and Controls > Industrial Sensors > Flow Sensors - Industrial', 1578, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (903, 'Force Sensors, Load Cells - Industrial', 299, 1066, 3, 'Industrial Automation and Controls > Industrial Sensors > Force Sensors, Load Cells - Industrial', 2148, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (904, 'Photoelectric, Industrial', 299, 562, 3, 'Industrial Automation and Controls > Industrial Sensors > Photoelectric, Industrial', 19989, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (905, 'Position, Proximity, Speed (Modules) - Industrial', 299, 1065, 3, 'Industrial Automation and Controls > Industrial Sensors > Position, Proximity, Speed (Modules) - Industrial', 379, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (906, 'Pressure Sensors, Transducers - Industrial', 299, 1069, 3, 'Industrial Automation and Controls > Industrial Sensors > Pressure Sensors, Transducers - Industrial', 62389, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (907, 'Proximity Sensors - Industrial', 299, 1074, 3, 'Industrial Automation and Controls > Industrial Sensors > Proximity Sensors - Industrial', 14791, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (908, 'Temperature Sensors - Analog and Digital Output - Industrial', 299, 1073, 3, 'Industrial Automation and Controls > Industrial Sensors > Temperature Sensors - Analog and Digital Output - Industrial', 595, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (909, 'Thermostats - Mechanical - Industrial', 299, 1072, 3, 'Industrial Automation and Controls > Industrial Sensors > Thermostats - Mechanical - Industrial', 2175, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (910, 'Ultrasonic Receivers, Transmitters - Industrial', 299, 1071, 3, 'Industrial Automation and Controls > Industrial Sensors > Ultrasonic Receivers, Transmitters - Industrial', 207, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (911, 'Bar Code Readers', 302, 1059, 3, 'Industrial Automation and Controls > Machine Vision > Bar Code Readers', 1967, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (912, 'Camera/Sensors', 302, 828, 3, 'Industrial Automation and Controls > Machine Vision > Camera/Sensors', 1895, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (913, 'Control/Processing', 302, 827, 3, 'Industrial Automation and Controls > Machine Vision > Control/Processing', 160, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (914, 'Machine Vision Lighting', 302, 826, 3, 'Industrial Automation and Controls > Machine Vision > Machine Vision Lighting', 1152, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (915, 'Current/Voltage Transducer Monitors', 303, 807, 3, 'Industrial Automation and Controls > Monitors > Current/Voltage Transducer Monitors', 1065, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (916, 'Relay Output Monitors', 303, 811, 3, 'Industrial Automation and Controls > Monitors > Relay Output Monitors', 1252, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (917, 'Counters, Hour Meters', 304, 802, 3, 'Industrial Automation and Controls > Panel Meters > Counters, Hour Meters', 1465, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (918, 'Meters', 304, 805, 3, 'Industrial Automation and Controls > Panel Meters > Meters', 2626, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (919, 'Panel Meter Accessories', 304, 818, 3, 'Industrial Automation and Controls > Panel Meters > Panel Meter Accessories', 595, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (920, 'Actuators/Cylinders', 305, 1054, 3, 'Industrial Automation and Controls > Pneumatics, Hydraulics > Actuators/Cylinders', 9863, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (921, 'Fittings, Couplings, and Distributors', 305, 1052, 3, 'Industrial Automation and Controls > Pneumatics, Hydraulics > Fittings, Couplings, and Distributors', 9782, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (922, 'Pneumatics Accessories', 305, 1053, 3, 'Industrial Automation and Controls > Pneumatics, Hydraulics > Pneumatics Accessories', 36932, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (923, 'Preparation/Treatment', 305, 1051, 3, 'Industrial Automation and Controls > Pneumatics, Hydraulics > Preparation/Treatment', 2905, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (924, 'Shock Absorbers, Dampers', 305, 1022, 3, 'Industrial Automation and Controls > Pneumatics, Hydraulics > Shock Absorbers, Dampers', 1929, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (925, 'Tubing, Hose, Piping', 305, 1021, 3, 'Industrial Automation and Controls > Pneumatics, Hydraulics > Tubing, Hose, Piping', 3404, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (926, 'Valves and Control', 305, 809, 3, 'Industrial Automation and Controls > Pneumatics, Hydraulics > Valves and Control', 13686, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (927, 'End Effectors', 307, 994, 3, 'Industrial Automation and Controls > Robotics > End Effectors', 1974, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (928, 'Robotics Accessories', 307, 995, 3, 'Industrial Automation and Controls > Robotics > Robotics Accessories', 1972, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (929, 'Robots', 307, 993, 3, 'Industrial Automation and Controls > Robotics > Robots', 105, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (930, 'Air Curtain Doors', 312, 1099, 3, 'Industrial Supplies > Dock and Warehouse > Air Curtain Doors', 95, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (931, 'Dock Equipment', 312, 1096, 3, 'Industrial Supplies > Dock and Warehouse > Dock Equipment', 84, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (932, 'Ladders, Steps, and Platforms', 312, 1078, 3, 'Industrial Supplies > Dock and Warehouse > Ladders, Steps, and Platforms', 25, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (933, 'Mirrors', 312, 1155, 3, 'Industrial Supplies > Dock and Warehouse > Mirrors', 14, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (934, 'Cords, Wires and Accessories', 313, 1079, 3, 'Industrial Supplies > Electrical > Cords, Wires and Accessories', 14, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (935, 'Generators', 313, 1080, 3, 'Industrial Supplies > Electrical > Generators', 24, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (936, 'Lighting', 313, 1081, 3, 'Industrial Supplies > Electrical > Lighting', 251, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (937, 'Lighting Accessories', 313, 1082, 3, 'Industrial Supplies > Electrical > Lighting Accessories', 13, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (938, 'Agricultural, Dock and Exhaust', 314, 1100, 3, 'Industrial Supplies > Fans > Agricultural, Dock and Exhaust', 23, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (939, 'Blowers and Floor Dryers', 314, 1101, 3, 'Industrial Supplies > Fans > Blowers and Floor Dryers', 32, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (940, 'Components - Motors', 314, 1102, 3, 'Industrial Supplies > Fans > Components - Motors', 65, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (941, 'Components and Accessories', 314, 1103, 3, 'Industrial Supplies > Fans > Components and Accessories', 33, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (942, 'Household, Office and Pedestal Fans', 314, 1104, 3, 'Industrial Supplies > Fans > Household, Office and Pedestal Fans', 98, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (943, 'Air Conditioners', 315, 1105, 3, 'Industrial Supplies > HVAC > Air Conditioners', 206, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (944, 'Air Filters', 315, 1106, 3, 'Industrial Supplies > HVAC > Air Filters', 310, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (945, 'Air Purifiers, Dehumidifiers and Humidifiers', 315, 1108, 3, 'Industrial Supplies > HVAC > Air Purifiers, Dehumidifiers and Humidifiers', 19, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (946, 'Heaters', 315, 1109, 3, 'Industrial Supplies > HVAC > Heaters', 358, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (947, 'HVAC Parts and Accessories', 315, 1124, 3, 'Industrial Supplies > HVAC > HVAC Parts and Accessories', 123, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (948, 'Air Compressor Tools and Accessories', 317, 1083, 3, 'Industrial Supplies > Maintenance > Air Compressor Tools and Accessories', 378, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (949, 'Air Compressors', 317, 1084, 3, 'Industrial Supplies > Maintenance > Air Compressors', 2, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (950, 'Magnets', 317, 1085, 3, 'Industrial Supplies > Maintenance > Magnets', 5, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (951, 'Mats', 317, 1086, 3, 'Industrial Supplies > Maintenance > Mats', 116, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (952, 'File Cabinets, Bookcases', 318, 1126, 3, 'Industrial Supplies > Office Equipment > File Cabinets, Bookcases', 78, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (953, 'Food Storage and Preparation', 318, 1127, 3, 'Industrial Supplies > Office Equipment > Food Storage and Preparation', 46, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (954, 'Office Supplies', 318, 1128, 3, 'Industrial Supplies > Office Equipment > Office Supplies', 488, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (955, 'Water Fountains and Refilling Stations', 318, 1129, 3, 'Industrial Supplies > Office Equipment > Water Fountains and Refilling Stations', 101, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (956, 'Partitions and Accessories', 319, 1131, 3, 'Industrial Supplies > Office Furniture > Partitions and Accessories', 488, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (957, 'Safes, Secure Storage', 319, 1132, 3, 'Industrial Supplies > Office Furniture > Safes, Secure Storage', 52, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (958, 'Tables', 319, 1133, 3, 'Industrial Supplies > Office Furniture > Tables', 30, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (959, 'Bikes, Racks and Locks', 320, 1134, 3, 'Industrial Supplies > Outdoor Products > Bikes, Racks and Locks', 45, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (960, 'Canopies, Shelters and Sheds', 320, 1135, 3, 'Industrial Supplies > Outdoor Products > Canopies, Shelters and Sheds', 13, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (961, 'Cans, Trash Cans and Covers', 320, 1144, 3, 'Industrial Supplies > Outdoor Products > Cans, Trash Cans and Covers', 133, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (962, 'Cold Weather Products, Clothing', 320, 1136, 3, 'Industrial Supplies > Outdoor Products > Cold Weather Products, Clothing', 179, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (963, 'Lawn Tools', 320, 1138, 3, 'Industrial Supplies > Outdoor Products > Lawn Tools', 27, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (964, 'Miscellaneous', 320, 1139, 3, 'Industrial Supplies > Outdoor Products > Miscellaneous', 86, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (965, 'Mowers, Vacuums, Blowers and Cutters', 320, 1140, 3, 'Industrial Supplies > Outdoor Products > Mowers, Vacuums, Blowers and Cutters', 8, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (966, 'Outdoor Furniture', 320, 1141, 3, 'Industrial Supplies > Outdoor Products > Outdoor Furniture', 149, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (967, 'Parking Lot and Safety', 320, 1142, 3, 'Industrial Supplies > Outdoor Products > Parking Lot and Safety', 491, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (968, 'Snow and Ice Removal', 320, 1143, 3, 'Industrial Supplies > Outdoor Products > Snow and Ice Removal', 6, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (969, 'Building/Construction Products', 321, 1145, 3, 'Industrial Supplies > Product, Material Handling and Storage > Building/Construction Products', 135, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (970, 'Dollies', 321, 1089, 3, 'Industrial Supplies > Product, Material Handling and Storage > Dollies', 7, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (971, 'Drum Accessories', 321, 1090, 3, 'Industrial Supplies > Product, Material Handling and Storage > Drum Accessories', 84, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (972, 'Drum Cradles, Lifts, Trucks', 321, 1091, 3, 'Industrial Supplies > Product, Material Handling and Storage > Drum Cradles, Lifts, Trucks', 81, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (973, 'Drum Pumps', 321, 1092, 3, 'Industrial Supplies > Product, Material Handling and Storage > Drum Pumps', 34, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (974, 'Drums, Pails', 321, 1093, 3, 'Industrial Supplies > Product, Material Handling and Storage > Drums, Pails', 6, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (975, 'Pallets', 321, 1146, 3, 'Industrial Supplies > Product, Material Handling and Storage > Pallets', 1, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (976, 'Rack, Shelving, Stand Accessories', 321, 1148, 3, 'Industrial Supplies > Product, Material Handling and Storage > Rack, Shelving, Stand Accessories', 537, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (977, 'Racks, Shelving, Stands', 321, 1147, 3, 'Industrial Supplies > Product, Material Handling and Storage > Racks, Shelving, Stands', 2771, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (978, 'Storage Containers and Bins', 321, 1149, 3, 'Industrial Supplies > Product, Material Handling and Storage > Storage Containers and Bins', 450, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (979, 'Absorbents, Trays and Cleaners', 322, 1094, 3, 'Industrial Supplies > Safety > Absorbents, Trays and Cleaners', 32, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (980, 'Exit Signs and Emergency Lights', 322, 1095, 3, 'Industrial Supplies > Safety > Exit Signs and Emergency Lights', 20, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (981, 'Fuel, Oil and General Purpose Cans', 322, 1150, 3, 'Industrial Supplies > Safety > Fuel, Oil and General Purpose Cans', 25, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (982, 'Garage Storage and Organization', 324, 1152, 3, 'Industrial Supplies > Storage Containers & Bins > Garage Storage and Organization', 3, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (983, 'Carts and Stands', 326, 1116, 3, 'Industrial Supplies > Workstation, Office Furniture and Equipment > Carts and Stands', 35, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (984, 'Chairs and Stools', 326, 1117, 3, 'Industrial Supplies > Workstation, Office Furniture and Equipment > Chairs and Stools', 290, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (985, 'Computer Workstations', 326, 1118, 3, 'Industrial Supplies > Workstation, Office Furniture and Equipment > Computer Workstations', 220, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (986, 'Hazardous Material, Safety Cabinets', 326, 1154, 3, 'Industrial Supplies > Workstation, Office Furniture and Equipment > Hazardous Material, Safety Cabinets', 17, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (987, 'Lockers, Storage Cabinets and Accessories', 326, 1087, 3, 'Industrial Supplies > Workstation, Office Furniture and Equipment > Lockers, Storage Cabinets and Accessories', 285, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (988, 'Turntables', 326, 1088, 3, 'Industrial Supplies > Workstation, Office Furniture and Equipment > Turntables', 1, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (989, 'Application Specific Clock/Timing', 328, 763, 3, 'Integrated Circuits (ICs) > Clock/Timing > Application Specific Clock/Timing', 3716, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (990, 'Clock Buffers, Drivers', 328, 764, 3, 'Integrated Circuits (ICs) > Clock/Timing > Clock Buffers, Drivers', 3826, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (991, 'Clock Generators, PLLs, Frequency Synthesizers', 328, 728, 3, 'Integrated Circuits (ICs) > Clock/Timing > Clock Generators, PLLs, Frequency Synthesizers', 14828, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (992, 'Delay Lines', 328, 688, 3, 'Integrated Circuits (ICs) > Clock/Timing > Delay Lines', 661, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (993, 'IC Batteries', 328, 762, 3, 'Integrated Circuits (ICs) > Clock/Timing > IC Batteries', 4, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (994, 'Programmable Timers and Oscillators', 328, 689, 3, 'Integrated Circuits (ICs) > Clock/Timing > Programmable Timers and Oscillators', 1720, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (995, 'Real Time Clocks', 328, 690, 3, 'Integrated Circuits (ICs) > Clock/Timing > Real Time Clocks', 2367, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (996, 'ADCs/DACs - Special Purpose', 329, 768, 3, 'Integrated Circuits (ICs) > Data Acquisition > ADCs/DACs - Special Purpose', 2814, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (997, 'Analog Front End (AFE)', 329, 724, 3, 'Integrated Circuits (ICs) > Data Acquisition > Analog Front End (AFE)', 749, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (998, 'Analog to Digital Converters (ADC)', 329, 700, 3, 'Integrated Circuits (ICs) > Data Acquisition > Analog to Digital Converters (ADC)', 14086, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (999, 'Digital Potentiometers', 329, 717, 3, 'Integrated Circuits (ICs) > Data Acquisition > Digital Potentiometers', 4377, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1000, 'Digital to Analog Converters (DAC)', 329, 701, 3, 'Integrated Circuits (ICs) > Data Acquisition > Digital to Analog Converters (DAC)', 11116, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1001, 'Touch Screen Controllers', 329, 775, 3, 'Integrated Circuits (ICs) > Data Acquisition > Touch Screen Controllers', 711, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1002, 'Application Specific Microcontrollers', 330, 769, 3, 'Integrated Circuits (ICs) > Embedded > Application Specific Microcontrollers', 2155, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1003, 'CPLDs (Complex Programmable Logic Devices)', 330, 695, 3, 'Integrated Circuits (ICs) > Embedded > CPLDs (Complex Programmable Logic Devices)', 4124, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1004, 'DSP (Digital Signal Processors)', 330, 698, 3, 'Integrated Circuits (ICs) > Embedded > DSP (Digital Signal Processors)', 3335, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1005, 'FPGAs (Field Programmable Gate Array)', 330, 696, 3, 'Integrated Circuits (ICs) > Embedded > FPGAs (Field Programmable Gate Array)', 24076, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1006, 'FPGAs (Field Programmable Gate Array) with Microcontrollers', 330, 767, 3, 'Integrated Circuits (ICs) > Embedded > FPGAs (Field Programmable Gate Array) with Microcontrollers', 67, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1007, 'Microcontrollers', 330, 685, 3, 'Integrated Circuits (ICs) > Embedded > Microcontrollers', 83634, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1008, 'Microcontrollers, Microprocessor, FPGA Modules', 330, 721, 3, 'Integrated Circuits (ICs) > Embedded > Microcontrollers, Microprocessor, FPGA Modules', 1648, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1009, 'Microprocessors', 330, 694, 3, 'Integrated Circuits (ICs) > Embedded > Microprocessors', 7389, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1010, 'PLDs (Programmable Logic Device)', 330, 719, 3, 'Integrated Circuits (ICs) > Embedded > PLDs (Programmable Logic Device)', 1119, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1011, 'System On Chip (SoC)', 330, 777, 3, 'Integrated Circuits (ICs) > Embedded > System On Chip (SoC)', 5948, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1012, 'Analog Switches - Special Purpose', 331, 780, 3, 'Integrated Circuits (ICs) > Interface > Analog Switches - Special Purpose', 2114, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1013, 'Analog Switches, Multiplexers, Demultiplexers', 331, 747, 3, 'Integrated Circuits (ICs) > Interface > Analog Switches, Multiplexers, Demultiplexers', 10078, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1014, 'CODECS', 331, 716, 3, 'Integrated Circuits (ICs) > Interface > CODECS', 1422, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1015, 'Controllers', 331, 753, 3, 'Integrated Circuits (ICs) > Interface > Controllers', 3414, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1016, 'Direct Digital Synthesis (DDS)', 331, 723, 3, 'Integrated Circuits (ICs) > Interface > Direct Digital Synthesis (DDS)', 105, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1017, 'Drivers, Receivers, Transceivers', 331, 710, 3, 'Integrated Circuits (ICs) > Interface > Drivers, Receivers, Transceivers', 17325, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1018, 'Encoders, Decoders, Converters', 331, 709, 3, 'Integrated Circuits (ICs) > Interface > Encoders, Decoders, Converters', 507, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1019, 'Filters - Active', 331, 735, 3, 'Integrated Circuits (ICs) > Interface > Filters - Active', 961, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1020, 'I/O Expanders', 331, 749, 3, 'Integrated Circuits (ICs) > Interface > I/O Expanders', 1132, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1021, 'Modems - ICs and Modules', 331, 722, 3, 'Integrated Circuits (ICs) > Interface > Modems - ICs and Modules', 301, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1022, 'Modules', 331, 778, 3, 'Integrated Circuits (ICs) > Interface > Modules', 143, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1023, 'Sensor and Detector Interfaces', 331, 752, 3, 'Integrated Circuits (ICs) > Interface > Sensor and Detector Interfaces', 1255, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1024, 'Sensor, Capacitive Touch', 331, 560, 3, 'Integrated Circuits (ICs) > Interface > Sensor, Capacitive Touch', 600, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1025, 'Serializers, Deserializers', 331, 755, 3, 'Integrated Circuits (ICs) > Interface > Serializers, Deserializers', 1189, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1026, 'Signal Buffers, Repeaters, Splitters', 331, 756, 3, 'Integrated Circuits (ICs) > Interface > Signal Buffers, Repeaters, Splitters', 1394, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1027, 'Signal Terminators', 331, 683, 3, 'Integrated Circuits (ICs) > Interface > Signal Terminators', 236, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1028, 'Specialized', 331, 754, 3, 'Integrated Circuits (ICs) > Interface > Specialized', 4392, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1029, 'Telecom', 331, 702, 3, 'Integrated Circuits (ICs) > Interface > Telecom', 3096, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1030, 'UARTs (Universal Asynchronous Receiver Transmitter)', 331, 714, 3, 'Integrated Circuits (ICs) > Interface > UARTs (Universal Asynchronous Receiver Transmitter)', 935, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1031, 'Voice Record and Playback', 331, 733, 3, 'Integrated Circuits (ICs) > Interface > Voice Record and Playback', 396, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1032, 'Amplifiers', 332, 2034, 3, 'Integrated Circuits (ICs) > Linear > Amplifiers', 38011, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1033, 'Analog Multipliers, Dividers', 332, 772, 3, 'Integrated Circuits (ICs) > Linear > Analog Multipliers, Dividers', 155, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1034, 'Comparators', 332, 692, 3, 'Integrated Circuits (ICs) > Linear > Comparators', 4973, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1035, 'Video Processing', 332, 684, 3, 'Integrated Circuits (ICs) > Linear > Video Processing', 2165, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1036, 'Buffers, Drivers, Receivers, Transceivers', 333, 704, 3, 'Integrated Circuits (ICs) > Logic > Buffers, Drivers, Receivers, Transceivers', 14155, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1037, 'Comparators', 333, 773, 3, 'Integrated Circuits (ICs) > Logic > Comparators', 407, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1038, 'Counters, Dividers', 333, 731, 3, 'Integrated Circuits (ICs) > Logic > Counters, Dividers', 2693, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1039, 'FIFOs Memory', 333, 707, 3, 'Integrated Circuits (ICs) > Logic > FIFOs Memory', 2921, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1040, 'Flip Flops', 333, 706, 3, 'Integrated Circuits (ICs) > Logic > Flip Flops', 6468, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1041, 'Gates and Inverters', 333, 705, 3, 'Integrated Circuits (ICs) > Logic > Gates and Inverters', 13542, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1042, 'Gates and Inverters - Multi-Function, Configurable', 333, 770, 3, 'Integrated Circuits (ICs) > Logic > Gates and Inverters - Multi-Function, Configurable', 1294, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1043, 'Latches', 333, 708, 3, 'Integrated Circuits (ICs) > Logic > Latches', 2992, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1044, 'Multivibrators', 333, 711, 3, 'Integrated Circuits (ICs) > Logic > Multivibrators', 689, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1045, 'Parity Generators and Checkers', 333, 720, 3, 'Integrated Circuits (ICs) > Logic > Parity Generators and Checkers', 194, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1046, 'Shift Registers', 333, 712, 3, 'Integrated Circuits (ICs) > Logic > Shift Registers', 2168, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1047, 'Signal Switches, Multiplexers, Decoders', 333, 743, 3, 'Integrated Circuits (ICs) > Logic > Signal Switches, Multiplexers, Decoders', 7489, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1048, 'Specialty Logic', 333, 703, 3, 'Integrated Circuits (ICs) > Logic > Specialty Logic', 1245, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1049, 'Translators, Level Shifters', 333, 732, 3, 'Integrated Circuits (ICs) > Logic > Translators, Level Shifters', 2703, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1050, 'Universal Bus Functions', 333, 725, 3, 'Integrated Circuits (ICs) > Logic > Universal Bus Functions', 477, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1051, 'Batteries', 334, 766, 3, 'Integrated Circuits (ICs) > Memory > Batteries', 13, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1052, 'Configuration PROMs for FPGAs', 334, 697, 3, 'Integrated Circuits (ICs) > Memory > Configuration PROMs for FPGAs', 584, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1053, 'Controllers', 334, 736, 3, 'Integrated Circuits (ICs) > Memory > Controllers', 304, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1054, 'Memory', 334, 774, 3, 'Integrated Circuits (ICs) > Memory > Memory', 58300, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1055, 'AC DC Converters, Offline Switchers', 335, 748, 3, 'Integrated Circuits (ICs) > Power Management (PMIC) > AC DC Converters, Offline Switchers', 4625, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1056, 'Battery Chargers', 335, 781, 3, 'Integrated Circuits (ICs) > Power Management (PMIC) > Battery Chargers', 3442, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1057, 'Battery Management', 335, 713, 3, 'Integrated Circuits (ICs) > Power Management (PMIC) > Battery Management', 4898, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1058, 'Current Regulation/Management', 335, 734, 3, 'Integrated Circuits (ICs) > Power Management (PMIC) > Current Regulation/Management', 1421, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1059, 'DC DC Switching Controllers', 335, 715, 3, 'Integrated Circuits (ICs) > Power Management (PMIC) > DC DC Switching Controllers', 10543, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1060, 'Display Drivers', 335, 729, 3, 'Integrated Circuits (ICs) > Power Management (PMIC) > Display Drivers', 1165, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1061, 'Energy Metering', 335, 765, 3, 'Integrated Circuits (ICs) > Power Management (PMIC) > Energy Metering', 488, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1062, 'Full, Half-Bridge (H Bridge) Drivers', 335, 746, 3, 'Integrated Circuits (ICs) > Power Management (PMIC) > Full, Half-Bridge (H Bridge) Drivers', 1389, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1063, 'Gate Drivers', 335, 730, 3, 'Integrated Circuits (ICs) > Power Management (PMIC) > Gate Drivers', 6447, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1064, 'Hot Swap Controllers', 335, 718, 3, 'Integrated Circuits (ICs) > Power Management (PMIC) > Hot Swap Controllers', 2022, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1065, 'Laser Drivers', 335, 681, 3, 'Integrated Circuits (ICs) > Power Management (PMIC) > Laser Drivers', 420, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1066, 'LED Drivers', 335, 745, 3, 'Integrated Circuits (ICs) > Power Management (PMIC) > LED Drivers', 7133, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1067, 'Lighting, Ballast Controllers', 335, 751, 3, 'Integrated Circuits (ICs) > Power Management (PMIC) > Lighting, Ballast Controllers', 452, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1068, 'Motor Drivers, Controllers', 335, 744, 3, 'Integrated Circuits (ICs) > Power Management (PMIC) > Motor Drivers, Controllers', 5060, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1069, 'OR Controllers, Ideal Diodes', 335, 758, 3, 'Integrated Circuits (ICs) > Power Management (PMIC) > OR Controllers, Ideal Diodes', 646, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1070, 'PFC (Power Factor Correction)', 335, 759, 3, 'Integrated Circuits (ICs) > Power Management (PMIC) > PFC (Power Factor Correction)', 1076, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1071, 'Power Distribution Switches, Load Drivers', 335, 726, 3, 'Integrated Circuits (ICs) > Power Management (PMIC) > Power Distribution Switches, Load Drivers', 7383, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1072, 'Power Management - Specialized', 335, 761, 3, 'Integrated Circuits (ICs) > Power Management (PMIC) > Power Management - Specialized', 7241, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1073, 'Power Over Ethernet (PoE) Controllers', 335, 779, 3, 'Integrated Circuits (ICs) > Power Management (PMIC) > Power Over Ethernet (PoE) Controllers', 833, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1074, 'Power Supply Controllers, Monitors', 335, 760, 3, 'Integrated Circuits (ICs) > Power Management (PMIC) > Power Supply Controllers, Monitors', 2255, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1075, 'RMS to DC Converters', 335, 740, 3, 'Integrated Circuits (ICs) > Power Management (PMIC) > RMS to DC Converters', 132, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1076, 'Special Purpose Regulators', 335, 750, 3, 'Integrated Circuits (ICs) > Power Management (PMIC) > Special Purpose Regulators', 4835, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1077, 'Supervisors', 335, 691, 3, 'Integrated Circuits (ICs) > Power Management (PMIC) > Supervisors', 38791, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1078, 'Thermal Management', 335, 738, 3, 'Integrated Circuits (ICs) > Power Management (PMIC) > Thermal Management', 473, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1079, 'V/F and F/V Converters', 335, 727, 3, 'Integrated Circuits (ICs) > Power Management (PMIC) > V/F and F/V Converters', 135, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1080, 'Voltage Reference', 335, 693, 3, 'Integrated Circuits (ICs) > Power Management (PMIC) > Voltage Reference', 8458, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1081, 'Voltage Regulators - DC DC Switching Regulators', 335, 739, 3, 'Integrated Circuits (ICs) > Power Management (PMIC) > Voltage Regulators - DC DC Switching Regulators', 37178, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1082, 'Voltage Regulators - Linear + Switching', 335, 776, 3, 'Integrated Circuits (ICs) > Power Management (PMIC) > Voltage Regulators - Linear + Switching', 1503, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1083, 'Voltage Regulators - Linear Regulator Controllers', 335, 757, 3, 'Integrated Circuits (ICs) > Power Management (PMIC) > Voltage Regulators - Linear Regulator Controllers', 360, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1084, 'Voltage Regulators - Linear, Low Drop Out (LDO) Regulators', 335, 699, 3, 'Integrated Circuits (ICs) > Power Management (PMIC) > Voltage Regulators - Linear, Low Drop Out (LDO) Regulators', 67572, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1085, 'Logic Output Optoisolators', 339, 902, 3, 'Isolators > Optocouplers, Optoisolators > Logic Output Optoisolators', 2471, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1086, 'Transistor, Photovoltaic Output Optoisolators', 339, 903, 3, 'Isolators > Optocouplers, Optoisolators > Transistor, Photovoltaic Output Optoisolators', 12483, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1087, 'Triac, SCR Output Optoisolators', 339, 904, 3, 'Isolators > Optocouplers, Optoisolators > Triac, SCR Output Optoisolators', 1848, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1088, 'Beam Expanders', 426, 1042, 3, 'Optics > Laser Optics > Beam Expanders', 20, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1089, 'F-Theta Lenses', 426, 1041, 3, 'Optics > Laser Optics > F-Theta Lenses', 46, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1090, 'Faraday Isolators', 426, 1048, 3, 'Optics > Laser Optics > Faraday Isolators', 54, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1091, 'Focus Lenses', 426, 1043, 3, 'Optics > Laser Optics > Focus Lenses', 4, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1092, 'Laser Modulators', 426, 1050, 3, 'Optics > Laser Optics > Laser Modulators', 93, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1093, 'Laser Optics Accessories', 426, 1120, 3, 'Optics > Laser Optics > Laser Optics Accessories', 23, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1094, 'Pockels Cells', 426, 1049, 3, 'Optics > Laser Optics > Pockels Cells', 34, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1095, 'Personal Protective Equipment (PPE)', 564, 259, 3, 'Safety Products > Direct Human Safety > Personal Protective Equipment (PPE)', 3638, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1096, 'Bumpers and Edges', 565, 1058, 3, 'Safety Products > Machine Safety > Bumpers and Edges', 109, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1097, 'Controllers', 565, 822, 3, 'Safety Products > Machine Safety > Controllers', 377, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1098, 'Interlock Switches', 565, 1060, 3, 'Safety Products > Machine Safety > Interlock Switches', 3719, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1099, 'Laser Scanners', 565, 988, 3, 'Safety Products > Machine Safety > Laser Scanners', 389, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1100, 'Light Curtains, Light Grids', 565, 959, 3, 'Safety Products > Machine Safety > Light Curtains, Light Grids', 14320, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1101, 'Machine Safety Accessories', 565, 1123, 3, 'Safety Products > Machine Safety > Machine Safety Accessories', 1241, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1102, 'Mats', 565, 1057, 3, 'Safety Products > Machine Safety > Mats', 138, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1103, 'Safety Relays', 565, 989, 3, 'Safety Products > Machine Safety > Safety Relays', 1545, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1104, 'Cable Pull Switches', 566, 968, 3, 'Safety Products > User Controlled Safety > Cable Pull Switches', 619, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1105, 'Emergency Stop (E-Stop) Switches', 566, 1056, 3, 'Safety Products > User Controlled Safety > Emergency Stop (E-Stop) Switches', 3277, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1106, 'Compass, Magnetic Field (Modules)', 577, 553, 3, 'Sensors, Transducers > Magnetic Sensors > Compass, Magnetic Field (Modules)', 43, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1107, 'Linear, Compass (ICs)', 577, 554, 3, 'Sensors, Transducers > Magnetic Sensors > Linear, Compass (ICs)', 1408, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1108, 'Position, Proximity, Speed (Modules)', 577, 552, 3, 'Sensors, Transducers > Magnetic Sensors > Position, Proximity, Speed (Modules)', 3304, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1109, 'Switches (Solid State)', 577, 565, 3, 'Sensors, Transducers > Magnetic Sensors > Switches (Solid State)', 4068, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1110, 'Multi Purpose Magnets', 578, 511, 3, 'Sensors, Transducers > Magnets > Multi Purpose Magnets', 2091, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1111, 'Sensor Matched Magnets', 578, 566, 3, 'Sensors, Transducers > Magnets > Sensor Matched Magnets', 134, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1112, 'Accelerometers', 579, 515, 3, 'Sensors, Transducers > Motion Sensors > Accelerometers', 2327, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1113, 'Gyroscopes', 579, 555, 3, 'Sensors, Transducers > Motion Sensors > Gyroscopes', 176, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1114, 'IMUs (Inertial Measurement Units)', 579, 567, 3, 'Sensors, Transducers > Motion Sensors > IMUs (Inertial Measurement Units)', 522, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1115, 'Inclinometers', 579, 533, 3, 'Sensors, Transducers > Motion Sensors > Inclinometers', 404, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1116, 'Optical Motion Sensors', 579, 534, 3, 'Sensors, Transducers > Motion Sensors > Optical Motion Sensors', 749, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1117, 'Tilt Switches', 579, 523, 3, 'Sensors, Transducers > Motion Sensors > Tilt Switches', 77, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1118, 'Vibration Sensors', 579, 519, 3, 'Sensors, Transducers > Motion Sensors > Vibration Sensors', 490, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1119, 'Ambient Light, IR, UV Sensors', 581, 536, 3, 'Sensors, Transducers > Optical Sensors > Ambient Light, IR, UV Sensors', 1018, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1120, 'Camera Modules', 581, 1003, 3, 'Sensors, Transducers > Optical Sensors > Camera Modules', 1387, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1121, 'Distance Measuring', 581, 542, 3, 'Sensors, Transducers > Optical Sensors > Distance Measuring', 1073, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1122, 'Image Sensors, Camera', 581, 532, 3, 'Sensors, Transducers > Optical Sensors > Image Sensors, Camera', 2413, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1123, 'Photo Detectors - CdS Cells', 581, 540, 3, 'Sensors, Transducers > Optical Sensors > Photo Detectors - CdS Cells', 89, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1124, 'Photo Detectors - Logic Output', 581, 545, 3, 'Sensors, Transducers > Optical Sensors > Photo Detectors - Logic Output', 143, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1125, 'Photo Detectors - Remote Receiver', 581, 541, 3, 'Sensors, Transducers > Optical Sensors > Photo Detectors - Remote Receiver', 1292, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1126, 'Photodiodes', 581, 543, 3, 'Sensors, Transducers > Optical Sensors > Photodiodes', 1304, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1127, 'Photointerrupters - Slot Type - Logic Output', 581, 547, 3, 'Sensors, Transducers > Optical Sensors > Photointerrupters - Slot Type - Logic Output', 951, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1128, 'Photointerrupters - Slot Type - Transistor Output', 581, 548, 3, 'Sensors, Transducers > Optical Sensors > Photointerrupters - Slot Type - Transistor Output', 1253, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1129, 'Photonics - Counters, Detectors, SPCM (Single Photon Counting Module)', 581, 1011, 3, 'Sensors, Transducers > Optical Sensors > Photonics - Counters, Detectors, SPCM (Single Photon Counting Module)', 751, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1130, 'Phototransistors', 581, 544, 3, 'Sensors, Transducers > Optical Sensors > Phototransistors', 828, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1131, 'Reflective - Analog Output', 581, 546, 3, 'Sensors, Transducers > Optical Sensors > Reflective - Analog Output', 349, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1132, 'Reflective - Logic Output', 581, 556, 3, 'Sensors, Transducers > Optical Sensors > Reflective - Logic Output', 197, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1133, 'Angle, Linear Position Measuring', 583, 549, 3, 'Sensors, Transducers > Position Sensors > Angle, Linear Position Measuring', 18490, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1134, 'Analog and Digital Output', 596, 518, 3, 'Sensors, Transducers > Temperature Sensors > Analog and Digital Output', 2932, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1135, 'NTC Thermistors', 596, 508, 3, 'Sensors, Transducers > Temperature Sensors > NTC Thermistors', 10762, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1136, 'PTC Thermistors', 596, 550, 3, 'Sensors, Transducers > Temperature Sensors > PTC Thermistors', 1051, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1137, 'RTD (Resistance Temperature Detector)', 596, 535, 3, 'Sensors, Transducers > Temperature Sensors > RTD (Resistance Temperature Detector)', 2032, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1138, 'Thermocouples, Temperature Probes', 596, 513, 3, 'Sensors, Transducers > Temperature Sensors > Thermocouples, Temperature Probes', 6828, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1139, 'Thermostats - Mechanical', 596, 516, 3, 'Sensors, Transducers > Temperature Sensors > Thermostats - Mechanical', 1356, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1140, 'Thermostats - Solid State', 596, 564, 3, 'Sensors, Transducers > Temperature Sensors > Thermostats - Solid State', 839, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1141, 'Configurable Switch Bodies', 613, 206, 3, 'Switches > Configurable Switch Components > Configurable Switch Bodies', 20034, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1142, 'Configurable Switch Contact Blocks', 613, 207, 3, 'Switches > Configurable Switch Components > Configurable Switch Contact Blocks', 1606, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1143, 'Configurable Switch Illumination Sources', 613, 208, 3, 'Switches > Configurable Switch Components > Configurable Switch Illumination Sources', 1312, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1144, 'Configurable Switch Lens', 613, 209, 3, 'Switches > Configurable Switch Components > Configurable Switch Lens', 1842, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1145, 'Combination Sets', 646, 958, 3, 'Test and Measurement > Test Equipment > Combination Sets', 113, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1146, 'Electrical Testers, Current Probes', 646, 634, 3, 'Test and Measurement > Test Equipment > Electrical Testers, Current Probes', 1296, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1147, 'Environmental Testers', 646, 632, 3, 'Test and Measurement > Test Equipment > Environmental Testers', 3146, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1148, 'Force/Torque Gauges', 646, 1019, 3, 'Test and Measurement > Test Equipment > Force/Torque Gauges', 218, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1149, 'Function Generators', 646, 630, 3, 'Test and Measurement > Test Equipment > Function Generators', 238, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1150, 'Multimeters', 646, 615, 3, 'Test and Measurement > Test Equipment > Multimeters', 805, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1151, 'Oscilloscopes', 646, 614, 3, 'Test and Measurement > Test Equipment > Oscilloscopes', 654, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1152, 'Power Supplies (Test, Bench)', 646, 633, 3, 'Test and Measurement > Test Equipment > Power Supplies (Test, Bench)', 2094, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1153, 'RF Analyzers', 646, 631, 3, 'Test and Measurement > Test Equipment > RF Analyzers', 150, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1154, 'Specialty Equipment', 646, 618, 3, 'Test and Measurement > Test Equipment > Specialty Equipment', 4517, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1155, 'Variable Transformers', 646, 619, 3, 'Test and Measurement > Test Equipment > Variable Transformers', 994, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1156, 'Alligator, Crocodile, Heavy Duty Clips', 647, 623, 3, 'Test and Measurement > Test Leads > Alligator, Crocodile, Heavy Duty Clips', 761, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1157, 'Banana, Meter Interface', 647, 627, 3, 'Test and Measurement > Test Leads > Banana, Meter Interface', 2782, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1158, 'BNC Interface', 647, 625, 3, 'Test and Measurement > Test Leads > BNC Interface', 342, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1159, 'Grabbers, Hooks', 647, 620, 3, 'Test and Measurement > Test Leads > Grabbers, Hooks', 475, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1160, 'IC Clips', 647, 624, 3, 'Test and Measurement > Test Leads > IC Clips', 170, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1161, 'Jumper, Specialty', 647, 626, 3, 'Test and Measurement > Test Leads > Jumper, Specialty', 6112, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1162, 'Kits, Assortments', 647, 628, 3, 'Test and Measurement > Test Leads > Kits, Assortments', 245, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1163, 'Oscilloscope Probes', 647, 629, 3, 'Test and Measurement > Test Leads > Oscilloscope Probes', 485, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1164, 'Thermocouples, Temperature Probes', 647, 621, 3, 'Test and Measurement > Test Leads > Thermocouples, Temperature Probes', 1821, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1165, 'Crimp Heads, Die Sets', 656, 232, 3, 'Tools > Crimpers, Applicators, Presses > Crimp Heads, Die Sets', 5576, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1166, 'Crimper, Applicator, Press Accessories', 656, 250, 3, 'Tools > Crimpers, Applicators, Presses > Crimper, Applicator, Press Accessories', 59497, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1167, 'Crimpers, Applicators, Presses', 656, 228, 3, 'Tools > Crimpers, Applicators, Presses > Crimpers, Applicators, Presses', 19308, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1168, 'Applicators, Dispensers', 657, 990, 3, 'Tools > Dispensing Equipment > Applicators, Dispensers', 155, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1169, 'Bottles, Syringes', 657, 991, 3, 'Tools > Dispensing Equipment > Bottles, Syringes', 681, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1170, 'Tips, Nozzles', 657, 271, 3, 'Tools > Dispensing Equipment > Tips, Nozzles', 1704, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1171, 'Screw and Nut Driver Bits, Blades and Handles', 671, 236, 3, 'Tools > Screwdrivers, Nut Drivers and Sets > Screw and Nut Driver Bits, Blades and Handles', 3896, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1172, 'Screw and Nut Driver Sets', 671, 249, 3, 'Tools > Screwdrivers, Nut Drivers and Sets > Screw and Nut Driver Sets', 1833, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1173, 'Screw and Nut Drivers', 671, 239, 3, 'Tools > Screwdrivers, Nut Drivers and Sets > Screw and Nut Drivers', 3980, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1174, 'Socket Sets', 672, 247, 3, 'Tools > Socket and Socket Handles > Socket Sets', 882, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1175, 'Sockets, Handles', 672, 251, 3, 'Tools > Socket and Socket Handles > Sockets, Handles', 7346, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1176, 'Workbench and Station Accessories', 684, 1115, 3, 'Tools > Workbenches, Stations and Accessories > Workbench and Station Accessories', 252, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1177, 'Workbenches and Stations', 684, 1114, 3, 'Tools > Workbenches, Stations and Accessories > Workbenches and Stations', 749, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1178, 'Accessories', 814, 309, 4, 'Connectors, Interconnects > Terminal Blocks > Terminal Block Accessories > Accessories', 8032, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1179, 'Terminal Block Jumpers', 814, 385, 4, 'Connectors, Interconnects > Terminal Blocks > Terminal Block Accessories > Terminal Block Jumpers', 3759, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1180, 'Terminal Block Marker Strips', 814, 384, 4, 'Connectors, Interconnects > Terminal Blocks > Terminal Block Accessories > Terminal Block Marker Strips', 8416, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1181, 'Terminal Block Wire Ferrules', 814, 364, 4, 'Connectors, Interconnects > Terminal Blocks > Terminal Block Accessories > Terminal Block Wire Ferrules', 2876, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1182, 'Diode Arrays', 855, 286, 4, 'Discrete Semiconductor Products > Diodes > Rectifiers > Diode Arrays', 16122, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1183, 'Single Diodes', 855, 280, 4, 'Discrete Semiconductor Products > Diodes > Rectifiers > Single Diodes', 49607, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1184, 'Single Zener Diodes', 858, 287, 4, 'Discrete Semiconductor Products > Diodes > Zener > Single Zener Diodes', 68344, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1185, 'Zener Diode Arrays', 858, 295, 4, 'Discrete Semiconductor Products > Diodes > Zener > Zener Diode Arrays', 2290, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1186, 'Bipolar RF Transistors', 863, 283, 4, 'Discrete Semiconductor Products > Transistors > Bipolar (BJT) > Bipolar RF Transistors', 1685, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1187, 'Bipolar Transistor Arrays', 863, 277, 4, 'Discrete Semiconductor Products > Transistors > Bipolar (BJT) > Bipolar Transistor Arrays', 2194, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1188, 'Bipolar Transistor Arrays, Pre-Biased', 863, 293, 4, 'Discrete Semiconductor Products > Transistors > Bipolar (BJT) > Bipolar Transistor Arrays, Pre-Biased', 2070, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1189, 'Single Bipolar Transistors', 863, 276, 4, 'Discrete Semiconductor Products > Transistors > Bipolar (BJT) > Single Bipolar Transistors', 21254, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1190, 'Single, Pre-Biased Bipolar Transistors', 863, 292, 4, 'Discrete Semiconductor Products > Transistors > Bipolar (BJT) > Single, Pre-Biased Bipolar Transistors', 4203, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1191, 'FET, MOSFET Arrays', 864, 289, 4, 'Discrete Semiconductor Products > Transistors > FETs, MOSFETs > FET, MOSFET Arrays', 6187, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1192, 'RF FETs, MOSFETs', 864, 285, 4, 'Discrete Semiconductor Products > Transistors > FETs, MOSFETs > RF FETs, MOSFETs', 3400, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1193, 'Single FETs, MOSFETs', 864, 278, 4, 'Discrete Semiconductor Products > Transistors > FETs, MOSFETs > Single FETs, MOSFETs', 45380, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1194, 'IGBT Arrays', 865, 291, 4, 'Discrete Semiconductor Products > Transistors > IGBTs > IGBT Arrays', 20, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1195, 'IGBT Modules', 865, 297, 4, 'Discrete Semiconductor Products > Transistors > IGBTs > IGBT Modules', 3039, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1196, 'Single IGBTs', 865, 279, 4, 'Discrete Semiconductor Products > Transistors > IGBTs > Single IGBTs', 4408, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1197, 'Audio Amplifiers', 1032, 742, 4, 'Integrated Circuits (ICs) > Linear > Amplifiers > Audio Amplifiers', 4320, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1198, 'Instrumentation, Op Amps, Buffer Amps', 1032, 687, 4, 'Integrated Circuits (ICs) > Linear > Amplifiers > Instrumentation, Op Amps, Buffer Amps', 30743, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1199, 'Special Purpose Amplifiers', 1032, 771, 4, 'Integrated Circuits (ICs) > Linear > Amplifiers > Special Purpose Amplifiers', 1531, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');
INSERT INTO public.categories VALUES (1200, 'Video Amps and Modules', 1032, 737, 4, 'Integrated Circuits (ICs) > Linear > Amplifiers > Video Amps and Modules', 1417, NULL, '2025-12-09 20:31:00.191949', '2025-12-09 20:31:00.191949');


--
-- Data for Name: cns_enrichment_config; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.cns_enrichment_config VALUES (1, 'enrichment_batch_size', '10', 'integer', 'performance', 'Number of components to process per batch', '10', NULL, NULL, false, false, '2025-12-09 20:18:59.602193', NULL);
INSERT INTO public.cns_enrichment_config VALUES (2, 'enrichment_delay_per_component_ms', '500', 'integer', 'performance', 'Delay between processing each component (ms)', '500', NULL, NULL, false, false, '2025-12-09 20:18:59.602193', NULL);
INSERT INTO public.cns_enrichment_config VALUES (3, 'enrichment_delay_per_batch_ms', '2000', 'integer', 'performance', 'Delay between batches (ms)', '2000', NULL, NULL, false, false, '2025-12-09 20:18:59.602193', NULL);
INSERT INTO public.cns_enrichment_config VALUES (4, 'quality_threshold', '80', 'integer', 'quality', 'Minimum quality score to store in database', '80', NULL, NULL, false, false, '2025-12-09 20:18:59.602193', NULL);
INSERT INTO public.cns_enrichment_config VALUES (5, 'enable_ai_normalization', 'true', 'boolean', 'ai', 'Enable AI-assisted category normalization', 'true', NULL, NULL, false, false, '2025-12-09 20:18:59.602193', NULL);
INSERT INTO public.cns_enrichment_config VALUES (6, 'ai_model_name', 'claude-sonnet-4', 'string', 'ai', 'AI model for normalization', 'claude-sonnet-4', NULL, NULL, false, false, '2025-12-09 20:18:59.602193', NULL);
INSERT INTO public.cns_enrichment_config VALUES (7, 'ai_temperature', '0.2', 'float', 'ai', 'AI model temperature setting', '0.2', NULL, NULL, false, false, '2025-12-09 20:18:59.602193', NULL);
INSERT INTO public.cns_enrichment_config VALUES (8, 'max_concurrent_enrichments', '5', 'integer', 'performance', 'Maximum concurrent enrichment jobs', '5', NULL, NULL, false, false, '2025-12-09 20:18:59.602193', NULL);
INSERT INTO public.cns_enrichment_config VALUES (9, 'cache_ttl_seconds', '3600', 'integer', 'storage', 'Redis cache TTL in seconds', '3600', NULL, NULL, false, false, '2025-12-09 20:18:59.602193', NULL);
INSERT INTO public.cns_enrichment_config VALUES (10, 'audit_retention_days', '90', 'integer', 'audit', 'Days to retain audit logs', '90', NULL, NULL, false, false, '2025-12-09 20:18:59.602193', NULL);


--
-- Data for Name: component_pricing; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: components; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: manufacturers; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.manufacturers VALUES (1, 'Texas Instruments', 'https://www.ti.com', '["TI", "Texas Inst"]', NULL, '2025-12-09 20:18:59.564271', '2025-12-09 20:18:59.564271');
INSERT INTO public.manufacturers VALUES (2, 'Analog Devices', 'https://www.analog.com', '["ADI", "Analog"]', NULL, '2025-12-09 20:18:59.564271', '2025-12-09 20:18:59.564271');
INSERT INTO public.manufacturers VALUES (3, 'STMicroelectronics', 'https://www.st.com', '["ST", "STMicro"]', NULL, '2025-12-09 20:18:59.564271', '2025-12-09 20:18:59.564271');
INSERT INTO public.manufacturers VALUES (4, 'NXP Semiconductors', 'https://www.nxp.com', '["NXP", "Freescale"]', NULL, '2025-12-09 20:18:59.564271', '2025-12-09 20:18:59.564271');
INSERT INTO public.manufacturers VALUES (5, 'Microchip Technology', 'https://www.microchip.com', '["Microchip", "MCHP", "Atmel"]', NULL, '2025-12-09 20:18:59.564271', '2025-12-09 20:18:59.564271');
INSERT INTO public.manufacturers VALUES (6, 'Infineon Technologies', 'https://www.infineon.com', '["Infineon", "IFX"]', NULL, '2025-12-09 20:18:59.564271', '2025-12-09 20:18:59.564271');
INSERT INTO public.manufacturers VALUES (7, 'ON Semiconductor', 'https://www.onsemi.com', '["ON Semi", "onsemi", "Fairchild"]', NULL, '2025-12-09 20:18:59.564271', '2025-12-09 20:18:59.564271');
INSERT INTO public.manufacturers VALUES (8, 'Maxim Integrated', 'https://www.maximintegrated.com', '["Maxim", "MAX"]', NULL, '2025-12-09 20:18:59.564271', '2025-12-09 20:18:59.564271');
INSERT INTO public.manufacturers VALUES (9, 'Renesas Electronics', 'https://www.renesas.com', '["Renesas", "IDT"]', NULL, '2025-12-09 20:18:59.564271', '2025-12-09 20:18:59.564271');
INSERT INTO public.manufacturers VALUES (10, 'Nordic Semiconductor', 'https://www.nordicsemi.com', '["Nordic", "nRF"]', NULL, '2025-12-09 20:18:59.564271', '2025-12-09 20:18:59.564271');
INSERT INTO public.manufacturers VALUES (11, 'Espressif Systems', 'https://www.espressif.com', '["Espressif", "ESP"]', NULL, '2025-12-09 20:18:59.564271', '2025-12-09 20:18:59.564271');
INSERT INTO public.manufacturers VALUES (12, 'Vishay', 'https://www.vishay.com', '["Vishay Intertechnology"]', NULL, '2025-12-09 20:18:59.564271', '2025-12-09 20:18:59.564271');
INSERT INTO public.manufacturers VALUES (13, 'Murata', 'https://www.murata.com', '["Murata Manufacturing"]', NULL, '2025-12-09 20:18:59.564271', '2025-12-09 20:18:59.564271');
INSERT INTO public.manufacturers VALUES (14, 'TDK Corporation', 'https://www.tdk.com', '["TDK", "EPCOS"]', NULL, '2025-12-09 20:18:59.564271', '2025-12-09 20:18:59.564271');
INSERT INTO public.manufacturers VALUES (15, 'Samsung Electro-Mechanics', 'https://www.samsungsem.com', '["Samsung EM", "SEMCO"]', NULL, '2025-12-09 20:18:59.564271', '2025-12-09 20:18:59.564271');
INSERT INTO public.manufacturers VALUES (16, 'Yageo', 'https://www.yageo.com', '["Yageo Corporation"]', NULL, '2025-12-09 20:18:59.564271', '2025-12-09 20:18:59.564271');
INSERT INTO public.manufacturers VALUES (17, 'KEMET', 'https://www.kemet.com', '["KEMET Electronics"]', NULL, '2025-12-09 20:18:59.564271', '2025-12-09 20:18:59.564271');
INSERT INTO public.manufacturers VALUES (18, 'AVX Corporation', 'https://www.avx.com', '["AVX", "Kyocera AVX"]', NULL, '2025-12-09 20:18:59.564271', '2025-12-09 20:18:59.564271');
INSERT INTO public.manufacturers VALUES (19, 'Panasonic', 'https://www.panasonic.com', '["Panasonic Electronic"]', NULL, '2025-12-09 20:18:59.564271', '2025-12-09 20:18:59.564271');
INSERT INTO public.manufacturers VALUES (20, 'TE Connectivity', 'https://www.te.com', '["TE", "Tyco Electronics"]', NULL, '2025-12-09 20:18:59.564271', '2025-12-09 20:18:59.564271');
INSERT INTO public.manufacturers VALUES (21, 'Amphenol', 'https://www.amphenol.com', '["Amphenol Corporation"]', NULL, '2025-12-09 20:18:59.564271', '2025-12-09 20:18:59.564271');
INSERT INTO public.manufacturers VALUES (22, 'Molex', 'https://www.molex.com', '["Molex LLC"]', NULL, '2025-12-09 20:18:59.564271', '2025-12-09 20:18:59.564271');
INSERT INTO public.manufacturers VALUES (23, 'JAE Electronics', 'https://www.jae.com', '["JAE"]', NULL, '2025-12-09 20:18:59.564271', '2025-12-09 20:18:59.564271');
INSERT INTO public.manufacturers VALUES (24, 'Hirose Electric', 'https://www.hirose.com', '["Hirose", "HRS"]', NULL, '2025-12-09 20:18:59.564271', '2025-12-09 20:18:59.564271');
INSERT INTO public.manufacturers VALUES (25, 'Wurth Elektronik', 'https://www.we-online.com', '["Wurth", "WE"]', NULL, '2025-12-09 20:18:59.564271', '2025-12-09 20:18:59.564271');
INSERT INTO public.manufacturers VALUES (26, 'Littelfuse', 'https://www.littelfuse.com', '["Littelfuse Inc"]', NULL, '2025-12-09 20:18:59.564271', '2025-12-09 20:18:59.564271');
INSERT INTO public.manufacturers VALUES (27, 'Bourns', 'https://www.bourns.com', '["Bourns Inc"]', NULL, '2025-12-09 20:18:59.564271', '2025-12-09 20:18:59.564271');
INSERT INTO public.manufacturers VALUES (28, 'Rohm Semiconductor', 'https://www.rohm.com', '["Rohm", "ROHM"]', NULL, '2025-12-09 20:18:59.564271', '2025-12-09 20:18:59.564271');
INSERT INTO public.manufacturers VALUES (29, 'Toshiba', 'https://www.toshiba.com', '["Toshiba Electronic"]', NULL, '2025-12-09 20:18:59.564271', '2025-12-09 20:18:59.564271');
INSERT INTO public.manufacturers VALUES (30, 'Nexperia', 'https://www.nexperia.com', '["Nexperia B.V."]', NULL, '2025-12-09 20:18:59.564271', '2025-12-09 20:18:59.564271');


--
-- Data for Name: suppliers; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.suppliers VALUES (1, 'DigiKey', 'https://www.digikey.com', true, 'DIGIKEY_API_KEY', 60, '2025-12-09 20:18:59.560371', '2025-12-09 20:18:59.560371');
INSERT INTO public.suppliers VALUES (2, 'Mouser', 'https://www.mouser.com', true, 'MOUSER_API_KEY', 30, '2025-12-09 20:18:59.560371', '2025-12-09 20:18:59.560371');
INSERT INTO public.suppliers VALUES (3, 'Arrow', 'https://www.arrow.com', true, 'ARROW_API_KEY', 60, '2025-12-09 20:18:59.560371', '2025-12-09 20:18:59.560371');
INSERT INTO public.suppliers VALUES (4, 'Avnet', 'https://www.avnet.com', true, 'AVNET_API_KEY', 60, '2025-12-09 20:18:59.560371', '2025-12-09 20:18:59.560371');
INSERT INTO public.suppliers VALUES (5, 'Newark/Element14', 'https://www.newark.com', true, 'ELEMENT14_API_KEY', 30, '2025-12-09 20:18:59.560371', '2025-12-09 20:18:59.560371');
INSERT INTO public.suppliers VALUES (6, 'RS Components', 'https://www.rs-online.com', false, NULL, 30, '2025-12-09 20:18:59.560371', '2025-12-09 20:18:59.560371');
INSERT INTO public.suppliers VALUES (7, 'Future Electronics', 'https://www.futureelectronics.com', false, NULL, 30, '2025-12-09 20:18:59.560371', '2025-12-09 20:18:59.560371');
INSERT INTO public.suppliers VALUES (8, 'TTI', 'https://www.tti.com', false, NULL, 30, '2025-12-09 20:18:59.560371', '2025-12-09 20:18:59.560371');


--
-- Data for Name: vendor_category_mappings; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Name: categories_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.categories_id_seq', 1200, true);


--
-- Name: cns_enrichment_config_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.cns_enrichment_config_id_seq', 10, true);


--
-- Name: component_pricing_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.component_pricing_id_seq', 1, false);


--
-- Name: manufacturers_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.manufacturers_id_seq', 30, true);


--
-- Name: suppliers_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.suppliers_id_seq', 8, true);


--
-- Name: vendor_category_mappings_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.vendor_category_mappings_id_seq', 1, false);


--
-- Name: categories categories_digikey_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_digikey_id_unique UNIQUE (digikey_id);


--
-- Name: categories categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_pkey PRIMARY KEY (id);


--
-- Name: cns_enrichment_config cns_enrichment_config_config_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cns_enrichment_config
    ADD CONSTRAINT cns_enrichment_config_config_key_key UNIQUE (config_key);


--
-- Name: cns_enrichment_config cns_enrichment_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cns_enrichment_config
    ADD CONSTRAINT cns_enrichment_config_pkey PRIMARY KEY (id);


--
-- Name: component_pricing component_pricing_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.component_pricing
    ADD CONSTRAINT component_pricing_pkey PRIMARY KEY (id);


--
-- Name: components components_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.components
    ADD CONSTRAINT components_pkey PRIMARY KEY (id);


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
-- Name: vendor_category_mappings vendor_category_mappings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendor_category_mappings
    ADD CONSTRAINT vendor_category_mappings_pkey PRIMARY KEY (id);


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
-- Name: categories categories_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.categories(id) ON DELETE CASCADE;


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
-- Name: vendor_category_mappings vendor_category_mappings_canonical_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendor_category_mappings
    ADD CONSTRAINT vendor_category_mappings_canonical_category_id_fkey FOREIGN KEY (canonical_category_id) REFERENCES public.categories(id) ON DELETE SET NULL;


--
-- PostgreSQL database dump complete
--

\unrestrict iYd5OgOScejjnprjyJrOabwBAlAoDxLiheudbYMbgriGYlsKbu2gQL8EjlYufsi

