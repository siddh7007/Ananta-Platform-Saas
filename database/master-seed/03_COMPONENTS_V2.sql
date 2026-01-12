-- =============================================================================
-- MASTER SEED: Components V2 Database
-- =============================================================================
-- Version: 1.0.0
-- Last Updated: 2025-01-09
-- Database: components_v2 (PostgreSQL - port 27010)
--
-- This is the SINGLE SOURCE OF TRUTH for Components database seed data.
-- DO NOT create duplicate seed files elsewhere.
--
-- This file contains:
--   - Suppliers (major component distributors)
--   - Manufacturers (common electronic component makers)
--   - Categories (component taxonomy)
--   - CNS Enrichment configuration
-- =============================================================================

BEGIN;

-- =============================================================================
-- SUPPLIERS - Major Component Distributors
-- =============================================================================

INSERT INTO suppliers (name, website, api_enabled, api_key_env_var, rate_limit_per_minute)
VALUES
    ('DigiKey', 'https://www.digikey.com', TRUE, 'DIGIKEY_API_KEY', 60),
    ('Mouser', 'https://www.mouser.com', TRUE, 'MOUSER_API_KEY', 30),
    ('Arrow', 'https://www.arrow.com', TRUE, 'ARROW_API_KEY', 60),
    ('Avnet', 'https://www.avnet.com', TRUE, 'AVNET_API_KEY', 60),
    ('Newark/Element14', 'https://www.newark.com', TRUE, 'ELEMENT14_API_KEY', 30),
    ('RS Components', 'https://www.rs-online.com', FALSE, NULL, 30),
    ('Future Electronics', 'https://www.futureelectronics.com', FALSE, NULL, 30),
    ('TTI', 'https://www.tti.com', FALSE, NULL, 30)
ON CONFLICT (name) DO UPDATE SET
    website = EXCLUDED.website,
    api_enabled = EXCLUDED.api_enabled,
    rate_limit_per_minute = EXCLUDED.rate_limit_per_minute;

-- =============================================================================
-- MANUFACTURERS - Common Electronic Component Manufacturers
-- =============================================================================

INSERT INTO manufacturers (name, website, aliases)
VALUES
    ('Texas Instruments', 'https://www.ti.com', '["TI", "Texas Inst"]'),
    ('Analog Devices', 'https://www.analog.com', '["ADI", "Analog"]'),
    ('STMicroelectronics', 'https://www.st.com', '["ST", "STMicro"]'),
    ('NXP Semiconductors', 'https://www.nxp.com', '["NXP", "Freescale"]'),
    ('Microchip Technology', 'https://www.microchip.com', '["Microchip", "MCHP", "Atmel"]'),
    ('Infineon Technologies', 'https://www.infineon.com', '["Infineon", "IFX"]'),
    ('ON Semiconductor', 'https://www.onsemi.com', '["ON Semi", "onsemi", "Fairchild"]'),
    ('Maxim Integrated', 'https://www.maximintegrated.com', '["Maxim", "MAX"]'),
    ('Renesas Electronics', 'https://www.renesas.com', '["Renesas", "IDT"]'),
    ('Nordic Semiconductor', 'https://www.nordicsemi.com', '["Nordic", "nRF"]'),
    ('Espressif Systems', 'https://www.espressif.com', '["Espressif", "ESP"]'),
    ('Vishay', 'https://www.vishay.com', '["Vishay Intertechnology"]'),
    ('Murata', 'https://www.murata.com', '["Murata Manufacturing"]'),
    ('TDK Corporation', 'https://www.tdk.com', '["TDK", "EPCOS"]'),
    ('Samsung Electro-Mechanics', 'https://www.samsungsem.com', '["Samsung EM", "SEMCO"]'),
    ('Yageo', 'https://www.yageo.com', '["Yageo Corporation"]'),
    ('KEMET', 'https://www.kemet.com', '["KEMET Electronics"]'),
    ('AVX Corporation', 'https://www.avx.com', '["AVX", "Kyocera AVX"]'),
    ('Panasonic', 'https://www.panasonic.com', '["Panasonic Electronic"]'),
    ('TE Connectivity', 'https://www.te.com', '["TE", "Tyco Electronics"]'),
    ('Amphenol', 'https://www.amphenol.com', '["Amphenol Corporation"]'),
    ('Molex', 'https://www.molex.com', '["Molex LLC"]'),
    ('JAE Electronics', 'https://www.jae.com', '["JAE"]'),
    ('Hirose Electric', 'https://www.hirose.com', '["Hirose", "HRS"]'),
    ('Wurth Elektronik', 'https://www.we-online.com', '["Wurth", "WE"]'),
    ('Littelfuse', 'https://www.littelfuse.com', '["Littelfuse Inc"]'),
    ('Bourns', 'https://www.bourns.com', '["Bourns Inc"]'),
    ('Rohm Semiconductor', 'https://www.rohm.com', '["Rohm", "ROHM"]'),
    ('Toshiba', 'https://www.toshiba.com', '["Toshiba Electronic"]'),
    ('Nexperia', 'https://www.nexperia.com', '["Nexperia B.V."]'),
    ('Diodes Incorporated', 'https://www.diodes.com', '["Diodes Inc"]'),
    ('Sensirion', 'https://www.sensirion.com', '["Sensirion AG"]')
ON CONFLICT (name) DO UPDATE SET
    website = EXCLUDED.website,
    aliases = EXCLUDED.aliases;

-- =============================================================================
-- CATEGORIES - Level 1 (Root)
-- =============================================================================

INSERT INTO categories (name, level, path, description)
VALUES
    ('Integrated Circuits', 1, 'Integrated Circuits', 'ICs including microcontrollers, processors, memory, and analog'),
    ('Discrete Semiconductors', 1, 'Discrete Semiconductors', 'Transistors, diodes, MOSFETs, IGBTs, and thyristors'),
    ('Passive Components', 1, 'Passive Components', 'Resistors, capacitors, inductors, and filters'),
    ('Connectors', 1, 'Connectors', 'All connector types including USB, HDMI, headers, and terminals'),
    ('Electromechanical', 1, 'Electromechanical', 'Relays, switches, fuses, and circuit breakers'),
    ('Power Management', 1, 'Power Management', 'Power supplies, converters, regulators, and battery management'),
    ('Sensors', 1, 'Sensors', 'Temperature, pressure, motion, proximity, and environmental sensors'),
    ('RF and Wireless', 1, 'RF and Wireless', 'RF modules, antennas, wireless ICs, and RF components'),
    ('Optoelectronics', 1, 'Optoelectronics', 'LEDs, displays, optocouplers, laser diodes, and photodetectors'),
    ('Cable and Wire', 1, 'Cable and Wire', 'Cables, wires, cable assemblies, and wire management')
ON CONFLICT DO NOTHING;

-- =============================================================================
-- CATEGORIES - Level 2 (Integrated Circuits subcategories)
-- =============================================================================

INSERT INTO categories (name, parent_id, level, path, description)
SELECT
    sub.name,
    (SELECT id FROM categories WHERE name = 'Integrated Circuits' AND level = 1),
    2,
    'Integrated Circuits > ' || sub.name,
    sub.description
FROM (VALUES
    ('Microcontrollers', 'MCUs - 8-bit, 16-bit, 32-bit ARM, AVR, PIC'),
    ('Microprocessors', 'CPUs and MPUs for computing applications'),
    ('Memory ICs', 'Flash, DRAM, SRAM, EEPROM, and NVRAM'),
    ('Amplifiers', 'Op-amps, instrumentation, audio, and RF amplifiers'),
    ('Data Converters', 'ADCs, DACs, and analog front-ends'),
    ('Interface ICs', 'USB, UART, SPI, I2C, Ethernet, and CAN controllers'),
    ('Logic ICs', 'Gates, flip-flops, counters, buffers, and FPGAs'),
    ('Power Management ICs', 'LDOs, DC-DC controllers, PMICs, and supervisors'),
    ('Clock and Timing', 'Oscillators, PLLs, clock generators, and RTC'),
    ('DSPs', 'Digital Signal Processors'),
    ('FPGAs and CPLDs', 'Field Programmable Gate Arrays and Complex PLDs'),
    ('Motor Drivers', 'Motor control ICs and drivers')
) AS sub(name, description)
ON CONFLICT DO NOTHING;

-- =============================================================================
-- CATEGORIES - Level 2 (Passive Components subcategories)
-- =============================================================================

INSERT INTO categories (name, parent_id, level, path, description)
SELECT
    sub.name,
    (SELECT id FROM categories WHERE name = 'Passive Components' AND level = 1),
    2,
    'Passive Components > ' || sub.name,
    sub.description
FROM (VALUES
    ('Resistors', 'Chip, through-hole, and specialty resistors'),
    ('Capacitors', 'Ceramic, electrolytic, film, and tantalum'),
    ('Inductors', 'Chip, power, RF, and common mode chokes'),
    ('Filters', 'EMI/RFI filters, LC filters, and SAW filters'),
    ('Crystals and Oscillators', 'Quartz crystals and crystal oscillators'),
    ('Ferrite Beads', 'EMI suppression ferrite beads'),
    ('Transformers', 'Signal and power transformers'),
    ('Thermistors', 'NTC and PTC thermistors'),
    ('Varistors', 'MOVs and voltage suppression varistors')
) AS sub(name, description)
ON CONFLICT DO NOTHING;

-- =============================================================================
-- CATEGORIES - Level 2 (Discrete Semiconductors subcategories)
-- =============================================================================

INSERT INTO categories (name, parent_id, level, path, description)
SELECT
    sub.name,
    (SELECT id FROM categories WHERE name = 'Discrete Semiconductors' AND level = 1),
    2,
    'Discrete Semiconductors > ' || sub.name,
    sub.description
FROM (VALUES
    ('Diodes', 'Rectifier, Schottky, Zener, TVS, and signal diodes'),
    ('Transistors', 'BJT, JFET, and general purpose transistors'),
    ('MOSFETs', 'N-Channel and P-Channel power MOSFETs'),
    ('IGBTs', 'Insulated Gate Bipolar Transistors for high power'),
    ('Rectifiers', 'Bridge rectifiers and rectifier modules'),
    ('Thyristors', 'SCRs, TRIACs, and DIACs')
) AS sub(name, description)
ON CONFLICT DO NOTHING;

-- =============================================================================
-- CATEGORIES - Level 2 (Sensors subcategories)
-- =============================================================================

INSERT INTO categories (name, parent_id, level, path, description)
SELECT
    sub.name,
    (SELECT id FROM categories WHERE name = 'Sensors' AND level = 1),
    2,
    'Sensors > ' || sub.name,
    sub.description
FROM (VALUES
    ('Temperature Sensors', 'Thermocouples, RTDs, and digital temperature sensors'),
    ('Pressure Sensors', 'Barometric, differential, and absolute pressure sensors'),
    ('Motion Sensors', 'Accelerometers, gyroscopes, and IMUs'),
    ('Proximity Sensors', 'Infrared, ultrasonic, and capacitive proximity sensors'),
    ('Humidity Sensors', 'Relative humidity and dew point sensors'),
    ('Current Sensors', 'Hall effect and shunt-based current sensors'),
    ('Image Sensors', 'CMOS and CCD image sensors')
) AS sub(name, description)
ON CONFLICT DO NOTHING;

-- =============================================================================
-- CNS ENRICHMENT CONFIGURATION
-- =============================================================================
-- Actual schema: id (integer auto), config_key, config_value, value_type,
--                category, description, default_value, min_value, max_value,
--                requires_restart, deprecated, updated_at, updated_by

-- Valid value_types: string, integer, float, boolean, json
INSERT INTO cns_enrichment_config (config_key, config_value, value_type, category, description, default_value)
VALUES
    ('default_enrichment_sources', '["digikey", "mouser", "octopart"]', 'json', 'enrichment', 'Default supplier APIs to query for enrichment', '["digikey"]'),
    ('enrichment_timeout_seconds', '30', 'integer', 'enrichment', 'Timeout for enrichment API calls', '30'),
    ('max_concurrent_enrichments', '10', 'integer', 'enrichment', 'Maximum parallel enrichment requests', '5'),
    ('cache_ttl_hours', '24', 'integer', 'cache', 'Hours to cache enrichment results', '24'),
    ('quality_score_threshold', '0.7', 'float', 'enrichment', 'Minimum quality score for auto-approval', '0.5'),
    ('enable_lifecycle_tracking', 'true', 'boolean', 'enrichment', 'Track component lifecycle status', 'true'),
    ('digikey_enabled', 'true', 'boolean', 'suppliers', 'Enable DigiKey API integration', 'false'),
    ('mouser_enabled', 'true', 'boolean', 'suppliers', 'Enable Mouser API integration', 'false'),
    ('octopart_enabled', 'true', 'boolean', 'suppliers', 'Enable Octopart API integration', 'false'),
    ('batch_size', '100', 'integer', 'enrichment', 'Batch size for bulk enrichment operations', '50')
ON CONFLICT (config_key) DO UPDATE SET
    config_value = EXCLUDED.config_value,
    description = EXCLUDED.description,
    updated_at = NOW();

-- =============================================================================
-- SAMPLE COMPONENTS (for testing)
-- =============================================================================
-- Actual component_catalog schema has 39 columns:
-- id, manufacturer_part_number, manufacturer, category, subcategory, category_path,
-- product_family, product_series, description, datasheet_url, image_url, model_3d_url,
-- package, lifecycle_status, risk_level, rohs_compliant, reach_compliant, halogen_free,
-- aec_qualified, eccn_code, unit_price, currency, price_breaks, moq, lead_time_days,
-- stock_status, stock_quantity, specifications, quality_score, quality_metadata,
-- supplier_data, ai_metadata, enrichment_source, last_enriched_at, enrichment_count,
-- usage_count, last_used_at, created_at, updated_at

INSERT INTO component_catalog (
    id, manufacturer_part_number, manufacturer, category, subcategory, category_path,
    description, datasheet_url, package, lifecycle_status, rohs_compliant,
    specifications, quality_score, enrichment_source, enrichment_count, usage_count,
    created_at, updated_at
)
VALUES
    -- MCU - STM32
    (gen_random_uuid(),
     'STM32F401RET6',
     'STMicroelectronics',
     'Integrated Circuits',
     'Microcontrollers',
     'Integrated Circuits > Microcontrollers',
     'ARM Cortex-M4 MCU, 512KB Flash, 96KB RAM, 84MHz',
     'https://www.st.com/resource/en/datasheet/stm32f401re.pdf',
     'LQFP64',
     'active',
     true,
     '{"core": "ARM Cortex-M4", "flash": "512KB", "ram": "96KB", "speed": "84MHz", "package": "LQFP64"}'::jsonb,
     0.95,
     'manual',
     0, 0,
     NOW(), NOW()),

    -- WiFi Module - ESP32
    (gen_random_uuid(),
     'ESP32-WROOM-32E',
     'Espressif Systems',
     'RF and Wireless',
     'WiFi Modules',
     'RF and Wireless > WiFi Modules',
     'WiFi + Bluetooth MCU Module, 4MB Flash',
     'https://www.espressif.com/sites/default/files/documentation/esp32-wroom-32e_datasheet_en.pdf',
     'Module',
     'active',
     true,
     '{"wifi": "802.11 b/g/n", "bluetooth": "BT 4.2 + BLE", "flash": "4MB", "pins": "38"}'::jsonb,
     0.92,
     'manual',
     0, 0,
     NOW(), NOW()),

    -- Capacitor - MLCC
    (gen_random_uuid(),
     'GRM155R71H104KE14D',
     'Murata',
     'Passive Components',
     'Capacitors',
     'Passive Components > Capacitors',
     '0.1uF 50V X7R 0402 MLCC Capacitor',
     'https://www.murata.com/products/productdata/8796747104286/GRME.pdf',
     '0402',
     'active',
     true,
     '{"capacitance": "0.1uF", "voltage": "50V", "tolerance": "10%", "dielectric": "X7R", "package": "0402"}'::jsonb,
     0.98,
     'manual',
     0, 0,
     NOW(), NOW()),

    -- Voltage Regulator
    (gen_random_uuid(),
     'LM2596S-5.0',
     'Texas Instruments',
     'Power Management',
     'Voltage Regulators',
     'Power Management > Voltage Regulators',
     '5V 3A Step-Down Voltage Regulator',
     'https://www.ti.com/lit/ds/symlink/lm2596.pdf',
     'TO-263',
     'active',
     true,
     '{"output_voltage": "5V", "output_current": "3A", "input_voltage": "4.5V-40V", "efficiency": "up to 90%"}'::jsonb,
     0.90,
     'manual',
     0, 0,
     NOW(), NOW()),

    -- Sensor - Temperature/Humidity
    (gen_random_uuid(),
     'SHT31-DIS-B',
     'Sensirion',
     'Sensors',
     'Temperature Sensors',
     'Sensors > Temperature Sensors',
     'Digital Humidity and Temperature Sensor',
     'https://sensirion.com/media/documents/213E6A3B/63A5A569/Datasheet_SHT3x_DIS.pdf',
     'DFN',
     'active',
     true,
     '{"humidity_accuracy": "2%RH", "temp_accuracy": "0.2C", "interface": "I2C", "package": "DFN"}'::jsonb,
     0.93,
     'manual',
     0, 0,
     NOW(), NOW())
ON CONFLICT (manufacturer_part_number, manufacturer) DO UPDATE SET
    description = EXCLUDED.description,
    specifications = EXCLUDED.specifications,
    updated_at = NOW();

-- =============================================================================
-- VERIFICATION
-- =============================================================================

DO $$
DECLARE
    supplier_count INTEGER;
    manufacturer_count INTEGER;
    category_count INTEGER;
    component_count INTEGER := 0;
    config_count INTEGER := 0;
BEGIN
    SELECT COUNT(*) INTO supplier_count FROM suppliers;
    SELECT COUNT(*) INTO manufacturer_count FROM manufacturers;
    SELECT COUNT(*) INTO category_count FROM categories;
    SELECT COUNT(*) INTO component_count FROM component_catalog;
    SELECT COUNT(*) INTO config_count FROM cns_enrichment_config;

    RAISE NOTICE '=== Components V2 Seed Data Applied ===';
    RAISE NOTICE '  Suppliers: %', supplier_count;
    RAISE NOTICE '  Manufacturers: %', manufacturer_count;
    RAISE NOTICE '  Categories: %', category_count;
    RAISE NOTICE '  Sample Components: %', component_count;
    RAISE NOTICE '  CNS Config Entries: %', config_count;
    RAISE NOTICE '=======================================';
END $$;

COMMIT;
