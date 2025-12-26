-- =============================================================================
-- Components V2 Database - Seed Data
-- =============================================================================
-- Comprehensive category taxonomy, manufacturers, and suppliers
-- =============================================================================

-- =============================================================================
-- SUPPLIERS (Major Component Distributors)
-- =============================================================================
INSERT INTO suppliers (name, website, api_enabled, api_key_env_var, rate_limit_per_minute) VALUES
    ('DigiKey', 'https://www.digikey.com', TRUE, 'DIGIKEY_API_KEY', 60),
    ('Mouser', 'https://www.mouser.com', TRUE, 'MOUSER_API_KEY', 30),
    ('Arrow', 'https://www.arrow.com', TRUE, 'ARROW_API_KEY', 60),
    ('Avnet', 'https://www.avnet.com', TRUE, 'AVNET_API_KEY', 60),
    ('Newark/Element14', 'https://www.newark.com', TRUE, 'ELEMENT14_API_KEY', 30),
    ('RS Components', 'https://www.rs-online.com', FALSE, NULL, 30),
    ('Future Electronics', 'https://www.futureelectronics.com', FALSE, NULL, 30),
    ('TTI', 'https://www.tti.com', FALSE, NULL, 30)
ON CONFLICT (name) DO NOTHING;

-- =============================================================================
-- MANUFACTURERS (Common Electronic Component Manufacturers)
-- =============================================================================
INSERT INTO manufacturers (name, website, aliases) VALUES
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
    ('Nexperia', 'https://www.nexperia.com', '["Nexperia B.V."]')
ON CONFLICT (name) DO NOTHING;

-- =============================================================================
-- CATEGORIES - ROOT LEVEL (Level 1)
-- =============================================================================
INSERT INTO categories (name, level, path, description) VALUES
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
-- CATEGORIES - INTEGRATED CIRCUITS (Level 2)
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
    ('ASICs', 'Application Specific Integrated Circuits'),
    ('Audio ICs', 'Audio codecs, amplifiers, and processors'),
    ('Video ICs', 'Video processors, encoders, and decoders'),
    ('Motor Drivers', 'Motor control ICs and drivers')
) AS sub(name, description)
ON CONFLICT DO NOTHING;

-- =============================================================================
-- CATEGORIES - MEMORY ICs (Level 3)
-- =============================================================================
INSERT INTO categories (name, parent_id, level, path, description)
SELECT
    sub.name,
    (SELECT id FROM categories WHERE path = 'Integrated Circuits > Memory ICs'),
    3,
    'Integrated Circuits > Memory ICs > ' || sub.name,
    sub.description
FROM (VALUES
    ('Flash Memory', 'NOR Flash, NAND Flash, Serial Flash'),
    ('DRAM', 'DDR3, DDR4, DDR5, LPDDR'),
    ('SRAM', 'Static RAM for cache and buffer applications'),
    ('EEPROM', 'Electrically Erasable Programmable ROM'),
    ('FRAM', 'Ferroelectric RAM - non-volatile with fast write'),
    ('MRAM', 'Magnetoresistive RAM'),
    ('NVRAM', 'Non-Volatile RAM')
) AS sub(name, description)
ON CONFLICT DO NOTHING;

-- =============================================================================
-- CATEGORIES - DISCRETE SEMICONDUCTORS (Level 2)
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
    ('Thyristors', 'SCRs, TRIACs, and DIACs'),
    ('RF Transistors', 'RF and microwave transistors')
) AS sub(name, description)
ON CONFLICT DO NOTHING;

-- =============================================================================
-- CATEGORIES - PASSIVE COMPONENTS (Level 2)
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
-- CATEGORIES - CAPACITORS (Level 3)
-- =============================================================================
INSERT INTO categories (name, parent_id, level, path, description)
SELECT
    sub.name,
    (SELECT id FROM categories WHERE path = 'Passive Components > Capacitors'),
    3,
    'Passive Components > Capacitors > ' || sub.name,
    sub.description
FROM (VALUES
    ('Ceramic Capacitors', 'MLCC - X5R, X7R, C0G, Y5V'),
    ('Electrolytic Capacitors', 'Aluminum electrolytic capacitors'),
    ('Tantalum Capacitors', 'Solid and wet tantalum'),
    ('Film Capacitors', 'Polyester, polypropylene, PPS'),
    ('Supercapacitors', 'EDLCs and hybrid capacitors'),
    ('Mica Capacitors', 'High stability mica capacitors')
) AS sub(name, description)
ON CONFLICT DO NOTHING;

-- =============================================================================
-- CATEGORIES - RESISTORS (Level 3)
-- =============================================================================
INSERT INTO categories (name, parent_id, level, path, description)
SELECT
    sub.name,
    (SELECT id FROM categories WHERE path = 'Passive Components > Resistors'),
    3,
    'Passive Components > Resistors > ' || sub.name,
    sub.description
FROM (VALUES
    ('Chip Resistors', 'SMD thick and thin film resistors'),
    ('Through-Hole Resistors', 'Axial and radial lead resistors'),
    ('Current Sense Resistors', 'Low ohm shunt resistors'),
    ('Potentiometers', 'Variable resistors and trimmers'),
    ('Resistor Networks', 'Resistor arrays and SIPs'),
    ('High Power Resistors', 'Wirewound and ceramic power resistors'),
    ('Precision Resistors', 'High accuracy thin film resistors')
) AS sub(name, description)
ON CONFLICT DO NOTHING;

-- =============================================================================
-- CATEGORIES - CONNECTORS (Level 2)
-- =============================================================================
INSERT INTO categories (name, parent_id, level, path, description)
SELECT
    sub.name,
    (SELECT id FROM categories WHERE name = 'Connectors' AND level = 1),
    2,
    'Connectors > ' || sub.name,
    sub.description
FROM (VALUES
    ('USB Connectors', 'USB-A, USB-B, USB-C, Micro, Mini'),
    ('HDMI Connectors', 'HDMI, Mini HDMI, Micro HDMI'),
    ('Ethernet Connectors', 'RJ45, RJ11, modular jacks'),
    ('D-Sub Connectors', 'DB9, DB15, DB25, HD connectors'),
    ('Pin Headers', 'Male and female pin headers'),
    ('Terminal Blocks', 'Screw, spring, and pluggable terminals'),
    ('RF Coaxial', 'SMA, BNC, N-Type, MCX, MMCX'),
    ('Board-to-Board', 'Mezzanine and stacking connectors'),
    ('Wire-to-Board', 'JST, Molex, and crimp housings'),
    ('FFC/FPC', 'Flat flexible cable connectors'),
    ('Circular Connectors', 'Industrial and military circular'),
    ('Power Connectors', 'DC jacks, barrel connectors'),
    ('Card Edge', 'PCI, PCIe, and memory card slots'),
    ('Audio Connectors', '3.5mm, 6.35mm, XLR, RCA')
) AS sub(name, description)
ON CONFLICT DO NOTHING;

-- =============================================================================
-- CATEGORIES - ELECTROMECHANICAL (Level 2)
-- =============================================================================
INSERT INTO categories (name, parent_id, level, path, description)
SELECT
    sub.name,
    (SELECT id FROM categories WHERE name = 'Electromechanical' AND level = 1),
    2,
    'Electromechanical > ' || sub.name,
    sub.description
FROM (VALUES
    ('Relays', 'Signal, power, solid state, and reed relays'),
    ('Switches', 'Toggle, pushbutton, DIP, and rotary switches'),
    ('Circuit Breakers', 'Thermal and magnetic circuit breakers'),
    ('Fuses', 'Cartridge, blade, PTC, and resettable fuses'),
    ('Motors', 'DC, stepper, servo, and brushless motors'),
    ('Fans and Blowers', 'Cooling fans and thermal management'),
    ('Encoders', 'Rotary and linear encoders'),
    ('Speakers and Buzzers', 'Audio transducers and piezo buzzers')
) AS sub(name, description)
ON CONFLICT DO NOTHING;

-- =============================================================================
-- CATEGORIES - POWER MANAGEMENT (Level 2)
-- =============================================================================
INSERT INTO categories (name, parent_id, level, path, description)
SELECT
    sub.name,
    (SELECT id FROM categories WHERE name = 'Power Management' AND level = 1),
    2,
    'Power Management > ' || sub.name,
    sub.description
FROM (VALUES
    ('AC-DC Converters', 'Power supplies and AC-DC modules'),
    ('DC-DC Converters', 'Buck, boost, and isolated DC-DC'),
    ('Voltage Regulators', 'Linear LDOs and switching regulators'),
    ('Battery Management', 'Charger ICs and fuel gauges'),
    ('Power Modules', 'Integrated power modules'),
    ('POL Regulators', 'Point-of-load regulators'),
    ('Wireless Power', 'Qi transmitters and receivers'),
    ('Power Factor Correction', 'PFC controllers and modules')
) AS sub(name, description)
ON CONFLICT DO NOTHING;

-- =============================================================================
-- CATEGORIES - SENSORS (Level 2)
-- =============================================================================
INSERT INTO categories (name, parent_id, level, path, description)
SELECT
    sub.name,
    (SELECT id FROM categories WHERE name = 'Sensors' AND level = 1),
    2,
    'Sensors > ' || sub.name,
    sub.description
FROM (VALUES
    ('Temperature Sensors', 'Thermocouples, RTDs, and digital temp sensors'),
    ('Pressure Sensors', 'Absolute, gauge, and differential pressure'),
    ('Motion Sensors', 'Accelerometers, gyroscopes, and IMUs'),
    ('Proximity Sensors', 'Capacitive, inductive, and optical proximity'),
    ('Current Sensors', 'Hall effect and shunt-based current sensing'),
    ('Voltage Sensors', 'Voltage dividers and isolated sensing'),
    ('Humidity Sensors', 'Relative humidity and moisture sensors'),
    ('Gas Sensors', 'CO2, VOC, and air quality sensors'),
    ('Light Sensors', 'Ambient light and UV sensors'),
    ('Magnetic Sensors', 'Hall effect and magnetoresistive sensors'),
    ('Force Sensors', 'Load cells and force sensing resistors'),
    ('Flow Sensors', 'Liquid and gas flow measurement')
) AS sub(name, description)
ON CONFLICT DO NOTHING;

-- =============================================================================
-- CATEGORIES - RF AND WIRELESS (Level 2)
-- =============================================================================
INSERT INTO categories (name, parent_id, level, path, description)
SELECT
    sub.name,
    (SELECT id FROM categories WHERE name = 'RF and Wireless' AND level = 1),
    2,
    'RF and Wireless > ' || sub.name,
    sub.description
FROM (VALUES
    ('RF Modules', 'WiFi, Bluetooth, Zigbee, LoRa modules'),
    ('Antennas', 'Chip, PCB, external, and GPS antennas'),
    ('RF Amplifiers', 'LNAs, PAs, and driver amplifiers'),
    ('RF Switches', 'SPDT, SP4T, and antenna switches'),
    ('RF Filters', 'SAW, BAW, and ceramic filters'),
    ('Mixers', 'RF mixers and frequency converters'),
    ('Attenuators', 'Fixed and variable RF attenuators'),
    ('Wireless SoCs', 'Integrated wireless system-on-chip')
) AS sub(name, description)
ON CONFLICT DO NOTHING;

-- =============================================================================
-- CATEGORIES - OPTOELECTRONICS (Level 2)
-- =============================================================================
INSERT INTO categories (name, parent_id, level, path, description)
SELECT
    sub.name,
    (SELECT id FROM categories WHERE name = 'Optoelectronics' AND level = 1),
    2,
    'Optoelectronics > ' || sub.name,
    sub.description
FROM (VALUES
    ('LEDs', 'Indicator, high power, RGB, and IR LEDs'),
    ('LED Displays', '7-segment, dot matrix, and light bars'),
    ('LCD Displays', 'Character and graphic LCD modules'),
    ('OLED Displays', 'OLED panels and modules'),
    ('Laser Diodes', 'Visible, IR, and VCSEL lasers'),
    ('Photodiodes', 'PIN, avalanche, and UV photodiodes'),
    ('Phototransistors', 'Optical sensors and detectors'),
    ('Optocouplers', 'Optoisolators and solid state relays'),
    ('Image Sensors', 'CMOS and CCD image sensors'),
    ('Fiber Optics', 'Transceivers and fiber components')
) AS sub(name, description)
ON CONFLICT DO NOTHING;

-- =============================================================================
-- CATEGORIES - CABLE AND WIRE (Level 2)
-- =============================================================================
INSERT INTO categories (name, parent_id, level, path, description)
SELECT
    sub.name,
    (SELECT id FROM categories WHERE name = 'Cable and Wire' AND level = 1),
    2,
    'Cable and Wire > ' || sub.name,
    sub.description
FROM (VALUES
    ('Hook-Up Wire', 'Single conductor wire'),
    ('Ribbon Cable', 'Flat ribbon and IDC cable'),
    ('Coaxial Cable', 'RG series and semi-rigid coax'),
    ('Multi-Conductor Cable', 'Shielded and unshielded multi-wire'),
    ('Cable Assemblies', 'Pre-terminated cable assemblies'),
    ('Wire Management', 'Heat shrink, sleeving, and cable ties'),
    ('Flat Flex Cable', 'FFC and FPC cables')
) AS sub(name, description)
ON CONFLICT DO NOTHING;

-- =============================================================================
-- CNS ENRICHMENT DEFAULT CONFIG
-- =============================================================================
INSERT INTO cns_enrichment_config (config_key, config_value, value_type, category, description, default_value) VALUES
    ('enrichment_batch_size', '10', 'integer', 'performance', 'Number of components to process per batch', '10'),
    ('enrichment_delay_per_component_ms', '500', 'integer', 'performance', 'Delay between processing each component (ms)', '500'),
    ('enrichment_delay_per_batch_ms', '2000', 'integer', 'performance', 'Delay between batches (ms)', '2000'),
    ('quality_threshold', '80', 'integer', 'quality', 'Minimum quality score to store in database', '80'),
    ('enable_ai_normalization', 'true', 'boolean', 'ai', 'Enable AI-assisted category normalization', 'true'),
    ('ai_model_name', 'claude-sonnet-4', 'string', 'ai', 'AI model for normalization', 'claude-sonnet-4'),
    ('ai_temperature', '0.2', 'float', 'ai', 'AI model temperature setting', '0.2'),
    ('max_concurrent_enrichments', '5', 'integer', 'performance', 'Maximum concurrent enrichment jobs', '5'),
    ('cache_ttl_seconds', '3600', 'integer', 'storage', 'Redis cache TTL in seconds', '3600'),
    ('audit_retention_days', '90', 'integer', 'audit', 'Days to retain audit logs', '90')
ON CONFLICT (config_key) DO NOTHING;

-- =============================================================================
-- SUMMARY
-- =============================================================================
-- This seed data provides:
-- - 8 major suppliers
-- - 30 manufacturers
-- - 10 root categories
-- - 70+ subcategories (Level 2)
-- - 20+ sub-subcategories (Level 3)
-- - Default CNS enrichment configuration
--
-- Total: ~100 categories with proper hierarchy
-- For full 1200+ DigiKey categories, run import_digikey_categories.py
-- =============================================================================
