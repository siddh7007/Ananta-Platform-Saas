-- =============================================================================
-- DigiKey Categories Master Migration
-- =============================================================================
-- Generated: 2025-12-09 12:30:53
-- Total Categories: 1200
-- Level 1 (Root): 50
-- Level 2: 644
-- Level 3: 483
-- Level 4+: 23
-- =============================================================================

-- Transaction wrapper
BEGIN;

-- Clear existing categories
TRUNCATE TABLE categories RESTART IDENTITY CASCADE;


-- =============================================================================
-- STEP 1: Insert Level 1 (Root) Categories
-- =============================================================================

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
VALUES ('Anti-Static, ESD, Clean Room Products', NULL, 28, 1, 'Anti-Static, ESD, Clean Room Products', 8247, NULL);

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
VALUES ('Audio Products', NULL, 10, 1, 'Audio Products', 11915, NULL);

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
VALUES ('Battery Products', NULL, 6, 1, 'Battery Products', 8766, NULL);

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
VALUES ('Boxes, Enclosures, Racks', NULL, 27, 1, 'Boxes, Enclosures, Racks', 91243, NULL);

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
VALUES ('Cable Assemblies', NULL, 21, 1, 'Cable Assemblies', 1031917, NULL);

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
VALUES ('Cables, Wires', NULL, 22, 1, 'Cables, Wires', 94721, NULL);

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
VALUES ('Cables, Wires - Management', NULL, 23, 1, 'Cables, Wires - Management', 113355, NULL);

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
VALUES ('Capacitors', NULL, 3, 1, 'Capacitors', 1319711, NULL);

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
VALUES ('Circuit Protection', NULL, 9, 1, 'Circuit Protection', 299391, NULL);

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
VALUES ('Computer Equipment', NULL, 38, 1, 'Computer Equipment', 12766, NULL);

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
VALUES ('Connectors, Interconnects', NULL, 20, 1, 'Connectors, Interconnects', 5379166, NULL);

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
VALUES ('Crystals, Oscillators, Resonators', NULL, 12, 1, 'Crystals, Oscillators, Resonators', 740455, NULL);

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
VALUES ('Development Boards, Kits, Programmers', NULL, 33, 1, 'Development Boards, Kits, Programmers', 68708, NULL);

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
VALUES ('Discrete Semiconductor Products', NULL, 19, 1, 'Discrete Semiconductor Products', 255073, NULL);

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
VALUES ('Embedded Computers', NULL, 45, 1, 'Embedded Computers', 8525, NULL);

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
VALUES ('Fans, Blowers, Thermal Management', NULL, 16, 1, 'Fans, Blowers, Thermal Management', 175434, NULL);

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
VALUES ('Filters', NULL, 36, 1, 'Filters', 47652, NULL);

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
VALUES ('Hardware, Fasteners, Accessories', NULL, 26, 1, 'Hardware, Fasteners, Accessories', 145703, NULL);

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
VALUES ('Inductors, Coils, Chokes', NULL, 4, 1, 'Inductors, Coils, Chokes', 157717, NULL);

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
VALUES ('Industrial Automation and Controls', NULL, 34, 1, 'Industrial Automation and Controls', 281448, NULL);

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
VALUES ('Industrial Supplies', NULL, 49, 1, 'Industrial Supplies', 14482, NULL);

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
VALUES ('Integrated Circuits (ICs)', NULL, 32, 1, 'Integrated Circuits (ICs)', 641883, NULL);

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
VALUES ('Isolators', NULL, 39, 1, 'Isolators', 26780, NULL);

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
VALUES ('Kits', NULL, 31, 1, 'Kits', 19658, NULL);

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
VALUES ('Labels, Signs, Barriers, Identification', NULL, 980, 1, 'Labels, Signs, Barriers, Identification', 42944, NULL);

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
VALUES ('Line Protection, Distribution, Backups', NULL, 35, 1, 'Line Protection, Distribution, Backups', 13882, NULL);

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
VALUES ('Magnetics - Transformer, Inductor Components', NULL, 46, 1, 'Magnetics - Transformer, Inductor Components', 14008, NULL);

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
VALUES ('Maker/DIY, Educational', NULL, 47, 1, 'Maker/DIY, Educational', 2946, NULL);

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
VALUES ('Memory - Modules, Cards', NULL, 24, 1, 'Memory - Modules, Cards', 15697, NULL);

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
VALUES ('Motors, Actuators, Solenoids and Drivers', NULL, 13, 1, 'Motors, Actuators, Solenoids and Drivers', 44772, NULL);

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
VALUES ('Networking Solutions', NULL, 44, 1, 'Networking Solutions', 26835, NULL);

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
VALUES ('Optical Inspection Equipment', NULL, 42, 1, 'Optical Inspection Equipment', 4156, NULL);

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
VALUES ('Optics', NULL, 41, 1, 'Optics', 2064, NULL);

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
VALUES ('Optoelectronics', NULL, 7, 1, 'Optoelectronics', 242244, NULL);

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
VALUES ('Potentiometers, Variable Resistors', NULL, 5, 1, 'Potentiometers, Variable Resistors', 715354, NULL);

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
VALUES ('Power Supplies - Board Mount', NULL, 43, 1, 'Power Supplies - Board Mount', 113040, NULL);

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
VALUES ('Power Supplies - External/Internal (Off-Board)', NULL, 8, 1, 'Power Supplies - External/Internal (Off-Board)', 118834, NULL);

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
VALUES ('Prototyping, Fabrication Products', NULL, 30, 1, 'Prototyping, Fabrication Products', 7001, NULL);

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
VALUES ('Relays', NULL, 14, 1, 'Relays', 84331, NULL);

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
VALUES ('Resistors', NULL, 2, 1, 'Resistors', 1771516, NULL);

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
VALUES ('RF and Wireless', NULL, 37, 1, 'RF and Wireless', 104974, NULL);

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
VALUES ('Safety Products', NULL, 2116, 1, 'Safety Products', 29372, NULL);

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
VALUES ('Sensors, Transducers', NULL, 25, 1, 'Sensors, Transducers', 170335, NULL);

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
VALUES ('Soldering, Desoldering, Rework Products', NULL, 18, 1, 'Soldering, Desoldering, Rework Products', 13785, NULL);

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
VALUES ('Switches', NULL, 15, 1, 'Switches', 294709, NULL);

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
VALUES ('Tapes, Adhesives, Materials', NULL, 40, 1, 'Tapes, Adhesives, Materials', 46392, NULL);

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
VALUES ('Test and Measurement', NULL, 29, 1, 'Test and Measurement', 39528, NULL);

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
VALUES ('Tools', NULL, 17, 1, 'Tools', 190072, NULL);

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
VALUES ('Transformers', NULL, 11, 1, 'Transformers', 19758, NULL);

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
VALUES ('Uncategorized', NULL, 1, 1, 'Uncategorized', 222339, NULL);


-- =============================================================================
-- STEP 2: Insert Level 2+ Categories (with parent_id lookup)
-- =============================================================================


-- Level 2 Categories (644 categories)

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Anti-Static, ESD Bags, Materials', p.id, 605, 2, 'Anti-Static, ESD, Clean Room Products > Anti-Static, ESD Bags, Materials', 1267, NULL
FROM categories p WHERE p.digikey_id = 28;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Anti-Static, ESD Clothing', p.id, 610, 2, 'Anti-Static, ESD, Clean Room Products > Anti-Static, ESD Clothing', 1044, NULL
FROM categories p WHERE p.digikey_id = 28;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Anti-Static, ESD Device Containers', p.id, 607, 2, 'Anti-Static, ESD, Clean Room Products > Anti-Static, ESD Device Containers', 1198, NULL
FROM categories p WHERE p.digikey_id = 28;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Anti-Static, ESD Grounding Mats', p.id, 606, 2, 'Anti-Static, ESD, Clean Room Products > Anti-Static, ESD Grounding Mats', 1179, NULL
FROM categories p WHERE p.digikey_id = 28;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Anti-Static, ESD Straps, Grounding Cords', p.id, 604, 2, 'Anti-Static, ESD, Clean Room Products > Anti-Static, ESD Straps, Grounding Cords', 694, NULL
FROM categories p WHERE p.digikey_id = 28;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Anti-Static, ESD, Clean Room Accessories', p.id, 603, 2, 'Anti-Static, ESD, Clean Room Products > Anti-Static, ESD, Clean Room Accessories', 1202, NULL
FROM categories p WHERE p.digikey_id = 28;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Clean Room Swabs and Brushes', p.id, 611, 2, 'Anti-Static, ESD, Clean Room Products > Clean Room Swabs and Brushes', 320, NULL
FROM categories p WHERE p.digikey_id = 28;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Clean Room Treatments, Cleaners, Wipes', p.id, 608, 2, 'Anti-Static, ESD, Clean Room Products > Clean Room Treatments, Cleaners, Wipes', 413, NULL
FROM categories p WHERE p.digikey_id = 28;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Ionizer Equipment', p.id, 609, 2, 'Anti-Static, ESD, Clean Room Products > Ionizer Equipment', 228, NULL
FROM categories p WHERE p.digikey_id = 28;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Modular ESD Desks, Workstations', p.id, 1016, 2, 'Anti-Static, ESD, Clean Room Products > Modular ESD Desks, Workstations', 333, NULL
FROM categories p WHERE p.digikey_id = 28;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Monitors, Testers', p.id, 612, 2, 'Anti-Static, ESD, Clean Room Products > Monitors, Testers', 369, NULL
FROM categories p WHERE p.digikey_id = 28;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Accessories', p.id, 159, 2, 'Audio Products > Accessories', 612, NULL
FROM categories p WHERE p.digikey_id = 10;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Alarms, Buzzers, and Sirens', p.id, 157, 2, 'Audio Products > Alarms, Buzzers, and Sirens', 6433, NULL
FROM categories p WHERE p.digikey_id = 10;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Amplifiers', p.id, 998, 2, 'Audio Products > Amplifiers', 31, NULL
FROM categories p WHERE p.digikey_id = 10;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Buzzer Elements, Piezo Benders', p.id, 160, 2, 'Audio Products > Buzzer Elements, Piezo Benders', 272, NULL
FROM categories p WHERE p.digikey_id = 10;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Guitar Parts, Accessories', p.id, 1001, 2, 'Audio Products > Guitar Parts, Accessories', 1, NULL
FROM categories p WHERE p.digikey_id = 10;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Microphones', p.id, 158, 2, 'Audio Products > Microphones', 1508, NULL
FROM categories p WHERE p.digikey_id = 10;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Speakers', p.id, 156, 2, 'Audio Products > Speakers', 3058, NULL
FROM categories p WHERE p.digikey_id = 10;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Batteries Non-Rechargeable (Primary)', p.id, 90, 2, 'Battery Products > Batteries Non-Rechargeable (Primary)', 1789, NULL
FROM categories p WHERE p.digikey_id = 6;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Batteries Rechargeable (Secondary)', p.id, 91, 2, 'Battery Products > Batteries Rechargeable (Secondary)', 1887, NULL
FROM categories p WHERE p.digikey_id = 6;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Battery Chargers', p.id, 85, 2, 'Battery Products > Battery Chargers', 799, NULL
FROM categories p WHERE p.digikey_id = 6;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Battery Holders, Clips, Contacts', p.id, 86, 2, 'Battery Products > Battery Holders, Clips, Contacts', 1860, NULL
FROM categories p WHERE p.digikey_id = 6;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Battery Packs', p.id, 89, 2, 'Battery Products > Battery Packs', 1720, NULL
FROM categories p WHERE p.digikey_id = 6;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Battery Product Accessories', p.id, 87, 2, 'Battery Products > Battery Product Accessories', 631, NULL
FROM categories p WHERE p.digikey_id = 6;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Cigarette Lighter Assemblies', p.id, 88, 2, 'Battery Products > Cigarette Lighter Assemblies', 80, NULL
FROM categories p WHERE p.digikey_id = 6;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Backplanes', p.id, 589, 2, 'Boxes, Enclosures, Racks > Backplanes', 129, NULL
FROM categories p WHERE p.digikey_id = 27;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Box Accessories', p.id, 595, 2, 'Boxes, Enclosures, Racks > Box Accessories', 10796, NULL
FROM categories p WHERE p.digikey_id = 27;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Box Components', p.id, 596, 2, 'Boxes, Enclosures, Racks > Box Components', 5765, NULL
FROM categories p WHERE p.digikey_id = 27;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Boxes', p.id, 594, 2, 'Boxes, Enclosures, Racks > Boxes', 28513, NULL
FROM categories p WHERE p.digikey_id = 27;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Cams', p.id, 960, 2, 'Boxes, Enclosures, Racks > Cams', 66, NULL
FROM categories p WHERE p.digikey_id = 27;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Card Guide Accessories', p.id, 600, 2, 'Boxes, Enclosures, Racks > Card Guide Accessories', 612, NULL
FROM categories p WHERE p.digikey_id = 27;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Card Guides', p.id, 591, 2, 'Boxes, Enclosures, Racks > Card Guides', 726, NULL
FROM categories p WHERE p.digikey_id = 27;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Card Rack Accessories', p.id, 601, 2, 'Boxes, Enclosures, Racks > Card Rack Accessories', 403, NULL
FROM categories p WHERE p.digikey_id = 27;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Card Racks', p.id, 588, 2, 'Boxes, Enclosures, Racks > Card Racks', 275, NULL
FROM categories p WHERE p.digikey_id = 27;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Evaluation, Development Board Enclosures', p.id, 975, 2, 'Boxes, Enclosures, Racks > Evaluation, Development Board Enclosures', 786, NULL
FROM categories p WHERE p.digikey_id = 27;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Handles', p.id, 590, 2, 'Boxes, Enclosures, Racks > Handles', 9824, NULL
FROM categories p WHERE p.digikey_id = 27;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Latches, Locks', p.id, 973, 2, 'Boxes, Enclosures, Racks > Latches, Locks', 1194, NULL
FROM categories p WHERE p.digikey_id = 27;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Patchbay, Jack Panel Accessories', p.id, 593, 2, 'Boxes, Enclosures, Racks > Patchbay, Jack Panel Accessories', 569, NULL
FROM categories p WHERE p.digikey_id = 27;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Patchbay, Jack Panels', p.id, 592, 2, 'Boxes, Enclosures, Racks > Patchbay, Jack Panels', 2386, NULL
FROM categories p WHERE p.digikey_id = 27;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Rack Accessories', p.id, 598, 2, 'Boxes, Enclosures, Racks > Rack Accessories', 13925, NULL
FROM categories p WHERE p.digikey_id = 27;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Rack Components', p.id, 599, 2, 'Boxes, Enclosures, Racks > Rack Components', 6518, NULL
FROM categories p WHERE p.digikey_id = 27;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Rack Thermal Management', p.id, 602, 2, 'Boxes, Enclosures, Racks > Rack Thermal Management', 3817, NULL
FROM categories p WHERE p.digikey_id = 27;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Racks', p.id, 597, 2, 'Boxes, Enclosures, Racks > Racks', 4139, NULL
FROM categories p WHERE p.digikey_id = 27;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Storage', p.id, 1097, 2, 'Boxes, Enclosures, Racks > Storage', 749, NULL
FROM categories p WHERE p.digikey_id = 27;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Storage Accessories', p.id, 1098, 2, 'Boxes, Enclosures, Racks > Storage Accessories', 51, NULL
FROM categories p WHERE p.digikey_id = 27;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Barrel Connector Cables', p.id, 2038, 2, 'Cable Assemblies > Barrel Connector Cables', 2127, NULL
FROM categories p WHERE p.digikey_id = 21;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Between Series Adapter Cables', p.id, 459, 2, 'Cable Assemblies > Between Series Adapter Cables', 6078, NULL
FROM categories p WHERE p.digikey_id = 21;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Circular Cable Assemblies', p.id, 448, 2, 'Cable Assemblies > Circular Cable Assemblies', 108026, NULL
FROM categories p WHERE p.digikey_id = 21;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Coaxial Cables (RF)', p.id, 456, 2, 'Cable Assemblies > Coaxial Cables (RF)', 550496, NULL
FROM categories p WHERE p.digikey_id = 21;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'D-Shaped, Centronics Cables', p.id, 466, 2, 'Cable Assemblies > D-Shaped, Centronics Cables', 481, NULL
FROM categories p WHERE p.digikey_id = 21;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'D-Sub Cables', p.id, 461, 2, 'Cable Assemblies > D-Sub Cables', 14306, NULL
FROM categories p WHERE p.digikey_id = 21;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Fiber Optic Cables', p.id, 449, 2, 'Cable Assemblies > Fiber Optic Cables', 52424, NULL
FROM categories p WHERE p.digikey_id = 21;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Firewire Cables (IEEE 1394)', p.id, 454, 2, 'Cable Assemblies > Firewire Cables (IEEE 1394)', 162, NULL
FROM categories p WHERE p.digikey_id = 21;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Flat Flex Jumpers, Cables (FFC, FPC)', p.id, 458, 2, 'Cable Assemblies > Flat Flex Jumpers, Cables (FFC, FPC)', 2078, NULL
FROM categories p WHERE p.digikey_id = 21;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Flat Flex Ribbon Jumpers, Cables', p.id, 457, 2, 'Cable Assemblies > Flat Flex Ribbon Jumpers, Cables', 26521, NULL
FROM categories p WHERE p.digikey_id = 21;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Jumper Wires, Pre-Crimped Leads', p.id, 453, 2, 'Cable Assemblies > Jumper Wires, Pre-Crimped Leads', 23130, NULL
FROM categories p WHERE p.digikey_id = 21;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'LGH Cables', p.id, 465, 2, 'Cable Assemblies > LGH Cables', 412, NULL
FROM categories p WHERE p.digikey_id = 21;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Modular/Ethernet Cables (RJ45, RJ11)', p.id, 451, 2, 'Cable Assemblies > Modular/Ethernet Cables (RJ45, RJ11)', 57849, NULL
FROM categories p WHERE p.digikey_id = 21;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Pluggable Cables', p.id, 460, 2, 'Cable Assemblies > Pluggable Cables', 21996, NULL
FROM categories p WHERE p.digikey_id = 21;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Power, Line Cables and Extension Cords', p.id, 452, 2, 'Cable Assemblies > Power, Line Cables and Extension Cords', 6804, NULL
FROM categories p WHERE p.digikey_id = 21;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Rectangular Cable Assemblies', p.id, 450, 2, 'Cable Assemblies > Rectangular Cable Assemblies', 145923, NULL
FROM categories p WHERE p.digikey_id = 21;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Smart Cables', p.id, 468, 2, 'Cable Assemblies > Smart Cables', 118, NULL
FROM categories p WHERE p.digikey_id = 21;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Solid State Lighting Cables', p.id, 469, 2, 'Cable Assemblies > Solid State Lighting Cables', 315, NULL
FROM categories p WHERE p.digikey_id = 21;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Specialized Cable Assemblies', p.id, 467, 2, 'Cable Assemblies > Specialized Cable Assemblies', 3040, NULL
FROM categories p WHERE p.digikey_id = 21;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'USB Cables', p.id, 455, 2, 'Cable Assemblies > USB Cables', 6688, NULL
FROM categories p WHERE p.digikey_id = 21;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Video Cables (DVI, HDMI)', p.id, 462, 2, 'Cable Assemblies > Video Cables (DVI, HDMI)', 2943, NULL
FROM categories p WHERE p.digikey_id = 21;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Coaxial Cables (RF)', p.id, 475, 2, 'Cables, Wires > Coaxial Cables (RF)', 4406, NULL
FROM categories p WHERE p.digikey_id = 22;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Fiber Optic Cables', p.id, 471, 2, 'Cables, Wires > Fiber Optic Cables', 4760, NULL
FROM categories p WHERE p.digikey_id = 22;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Flat Flex Cables (FFC, FPC)', p.id, 476, 2, 'Cables, Wires > Flat Flex Cables (FFC, FPC)', 169, NULL
FROM categories p WHERE p.digikey_id = 22;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Flat Ribbon Cables', p.id, 472, 2, 'Cables, Wires > Flat Ribbon Cables', 6696, NULL
FROM categories p WHERE p.digikey_id = 22;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Modular - Flat Cable', p.id, 477, 2, 'Cables, Wires > Modular - Flat Cable', 319, NULL
FROM categories p WHERE p.digikey_id = 22;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Multiple Conductor Cables', p.id, 473, 2, 'Cables, Wires > Multiple Conductor Cables', 49527, NULL
FROM categories p WHERE p.digikey_id = 22;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Single Conductor Cables (Hook-Up Wire)', p.id, 474, 2, 'Cables, Wires > Single Conductor Cables (Hook-Up Wire)', 28737, NULL
FROM categories p WHERE p.digikey_id = 22;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Wire Wrap', p.id, 470, 2, 'Cables, Wires > Wire Wrap', 107, NULL
FROM categories p WHERE p.digikey_id = 22;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Accessories', p.id, 479, 2, 'Cables, Wires - Management > Accessories', 11835, NULL
FROM categories p WHERE p.digikey_id = 23;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Bushings, Grommets', p.id, 491, 2, 'Cables, Wires - Management > Bushings, Grommets', 4413, NULL
FROM categories p WHERE p.digikey_id = 23;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Cable and Cord Grips', p.id, 492, 2, 'Cables, Wires - Management > Cable and Cord Grips', 19114, NULL
FROM categories p WHERE p.digikey_id = 23;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Cable Supports and Fasteners', p.id, 490, 2, 'Cables, Wires - Management > Cable Supports and Fasteners', 6301, NULL
FROM categories p WHERE p.digikey_id = 23;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Cable Ties - Holders and Mountings', p.id, 488, 2, 'Cables, Wires - Management > Cable Ties - Holders and Mountings', 1377, NULL
FROM categories p WHERE p.digikey_id = 23;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Cable Ties and Zip Ties', p.id, 482, 2, 'Cables, Wires - Management > Cable Ties and Zip Ties', 6216, NULL
FROM categories p WHERE p.digikey_id = 23;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Cold Shrink Tape, Tubing', p.id, 485, 2, 'Cables, Wires - Management > Cold Shrink Tape, Tubing', 129, NULL
FROM categories p WHERE p.digikey_id = 23;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Fiber Optic Cables', p.id, 481, 2, 'Cables, Wires - Management > Fiber Optic Cables', 159, NULL
FROM categories p WHERE p.digikey_id = 23;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Grounding Braid, Straps', p.id, 494, 2, 'Cables, Wires - Management > Grounding Braid, Straps', 756, NULL
FROM categories p WHERE p.digikey_id = 23;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Heat Shrink Boots, Caps', p.id, 499, 2, 'Cables, Wires - Management > Heat Shrink Boots, Caps', 5914, NULL
FROM categories p WHERE p.digikey_id = 23;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Heat Shrink Fabric', p.id, 489, 2, 'Cables, Wires - Management > Heat Shrink Fabric', 273, NULL
FROM categories p WHERE p.digikey_id = 23;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Heat Shrink Tubing', p.id, 483, 2, 'Cables, Wires - Management > Heat Shrink Tubing', 14133, NULL
FROM categories p WHERE p.digikey_id = 23;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Heat Shrink Wrap', p.id, 497, 2, 'Cables, Wires - Management > Heat Shrink Wrap', 12, NULL
FROM categories p WHERE p.digikey_id = 23;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Labels, Labeling', p.id, 484, 2, 'Cables, Wires - Management > Labels, Labeling', 9134, NULL
FROM categories p WHERE p.digikey_id = 23;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Markers', p.id, 493, 2, 'Cables, Wires - Management > Markers', 13709, NULL
FROM categories p WHERE p.digikey_id = 23;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Protective Hoses, Solid Tubing, Sleeving', p.id, 480, 2, 'Cables, Wires - Management > Protective Hoses, Solid Tubing, Sleeving', 4969, NULL
FROM categories p WHERE p.digikey_id = 23;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Pulling, Support Grips', p.id, 498, 2, 'Cables, Wires - Management > Pulling, Support Grips', 735, NULL
FROM categories p WHERE p.digikey_id = 23;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Solder Sleeve', p.id, 478, 2, 'Cables, Wires - Management > Solder Sleeve', 2176, NULL
FROM categories p WHERE p.digikey_id = 23;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Spiral Wrap, Expandable Sleeving', p.id, 495, 2, 'Cables, Wires - Management > Spiral Wrap, Expandable Sleeving', 3334, NULL
FROM categories p WHERE p.digikey_id = 23;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Splice Enclosures, Protection', p.id, 496, 2, 'Cables, Wires - Management > Splice Enclosures, Protection', 320, NULL
FROM categories p WHERE p.digikey_id = 23;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Wire Ducts, Raceways', p.id, 2039, 2, 'Cables, Wires - Management > Wire Ducts, Raceways', 8346, NULL
FROM categories p WHERE p.digikey_id = 23;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Accessories', p.id, 63, 2, 'Capacitors > Accessories', 235, NULL
FROM categories p WHERE p.digikey_id = 3;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Aluminum - Polymer Capacitors', p.id, 69, 2, 'Capacitors > Aluminum - Polymer Capacitors', 10490, NULL
FROM categories p WHERE p.digikey_id = 3;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Aluminum Electrolytic Capacitors', p.id, 58, 2, 'Capacitors > Aluminum Electrolytic Capacitors', 112873, NULL
FROM categories p WHERE p.digikey_id = 3;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Capacitor Networks, Arrays', p.id, 57, 2, 'Capacitors > Capacitor Networks, Arrays', 1406, NULL
FROM categories p WHERE p.digikey_id = 3;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Ceramic Capacitors', p.id, 60, 2, 'Capacitors > Ceramic Capacitors', 881765, NULL
FROM categories p WHERE p.digikey_id = 3;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Electric Double Layer Capacitors (EDLC), Supercapacitors', p.id, 61, 2, 'Capacitors > Electric Double Layer Capacitors (EDLC), Supercapacitors', 3040, NULL
FROM categories p WHERE p.digikey_id = 3;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Film Capacitors', p.id, 62, 2, 'Capacitors > Film Capacitors', 167937, NULL
FROM categories p WHERE p.digikey_id = 3;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Mica and PTFE Capacitors', p.id, 64, 2, 'Capacitors > Mica and PTFE Capacitors', 9009, NULL
FROM categories p WHERE p.digikey_id = 3;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Motor Start, Motor Run Capacitors (AC)', p.id, 2112, 2, 'Capacitors > Motor Start, Motor Run Capacitors (AC)', 3258, NULL
FROM categories p WHERE p.digikey_id = 3;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Niobium Oxide Capacitors', p.id, 67, 2, 'Capacitors > Niobium Oxide Capacitors', 217, NULL
FROM categories p WHERE p.digikey_id = 3;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Silicon Capacitors', p.id, 68, 2, 'Capacitors > Silicon Capacitors', 376, NULL
FROM categories p WHERE p.digikey_id = 3;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Tantalum - Polymer Capacitors', p.id, 70, 2, 'Capacitors > Tantalum - Polymer Capacitors', 13052, NULL
FROM categories p WHERE p.digikey_id = 3;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Tantalum Capacitors', p.id, 59, 2, 'Capacitors > Tantalum Capacitors', 110697, NULL
FROM categories p WHERE p.digikey_id = 3;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Thin Film Capacitors', p.id, 66, 2, 'Capacitors > Thin Film Capacitors', 3733, NULL
FROM categories p WHERE p.digikey_id = 3;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Trimmers, Variable Capacitors', p.id, 65, 2, 'Capacitors > Trimmers, Variable Capacitors', 1623, NULL
FROM categories p WHERE p.digikey_id = 3;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Circuit Breakers', p.id, 143, 2, 'Circuit Protection > Circuit Breakers', 75709, NULL
FROM categories p WHERE p.digikey_id = 9;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Circuit Protection Accessories', p.id, 145, 2, 'Circuit Protection > Circuit Protection Accessories', 9855, NULL
FROM categories p WHERE p.digikey_id = 9;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Electrical, Specialty Fuses', p.id, 155, 2, 'Circuit Protection > Electrical, Specialty Fuses', 27577, NULL
FROM categories p WHERE p.digikey_id = 9;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Fuseholders', p.id, 140, 2, 'Circuit Protection > Fuseholders', 7000, NULL
FROM categories p WHERE p.digikey_id = 9;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Fuses', p.id, 139, 2, 'Circuit Protection > Fuses', 25090, NULL
FROM categories p WHERE p.digikey_id = 9;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Gas Discharge Tube Arresters (GDT)', p.id, 142, 2, 'Circuit Protection > Gas Discharge Tube Arresters (GDT)', 4715, NULL
FROM categories p WHERE p.digikey_id = 9;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Ground Fault Circuit Interrupter (GFCI)', p.id, 148, 2, 'Circuit Protection > Ground Fault Circuit Interrupter (GFCI)', 832, NULL
FROM categories p WHERE p.digikey_id = 9;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Inrush Current Limiters (ICL)', p.id, 151, 2, 'Circuit Protection > Inrush Current Limiters (ICL)', 2235, NULL
FROM categories p WHERE p.digikey_id = 9;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Lighting Protection', p.id, 154, 2, 'Circuit Protection > Lighting Protection', 78, NULL
FROM categories p WHERE p.digikey_id = 9;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'PTC Resettable Fuses', p.id, 150, 2, 'Circuit Protection > PTC Resettable Fuses', 5135, NULL
FROM categories p WHERE p.digikey_id = 9;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Surge Suppression ICs', p.id, 152, 2, 'Circuit Protection > Surge Suppression ICs', 581, NULL
FROM categories p WHERE p.digikey_id = 9;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Thermal Cutoffs (Thermal Fuses)', p.id, 146, 2, 'Circuit Protection > Thermal Cutoffs (Thermal Fuses)', 403, NULL
FROM categories p WHERE p.digikey_id = 9;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Transient Voltage Suppressors (TVS)', p.id, 2040, 2, 'Circuit Protection > Transient Voltage Suppressors (TVS)', 115649, NULL
FROM categories p WHERE p.digikey_id = 9;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Varistors, MOVs', p.id, 141, 2, 'Circuit Protection > Varistors, MOVs', 24532, NULL
FROM categories p WHERE p.digikey_id = 9;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Accessories', p.id, 881, 2, 'Computer Equipment > Accessories', 5817, NULL
FROM categories p WHERE p.digikey_id = 38;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Adapter Cards', p.id, 888, 2, 'Computer Equipment > Adapter Cards', 1483, NULL
FROM categories p WHERE p.digikey_id = 38;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Adapters, Converters', p.id, 882, 2, 'Computer Equipment > Adapters, Converters', 1405, NULL
FROM categories p WHERE p.digikey_id = 38;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Brackets', p.id, 889, 2, 'Computer Equipment > Brackets', 43, NULL
FROM categories p WHERE p.digikey_id = 38;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Cameras, Projectors', p.id, 898, 2, 'Computer Equipment > Cameras, Projectors', 395, NULL
FROM categories p WHERE p.digikey_id = 38;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Computer Mouse, Trackballs', p.id, 893, 2, 'Computer Equipment > Computer Mouse, Trackballs', 212, NULL
FROM categories p WHERE p.digikey_id = 38;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Desktop Joysticks, Simulation Products', p.id, 899, 2, 'Computer Equipment > Desktop Joysticks, Simulation Products', 47, NULL
FROM categories p WHERE p.digikey_id = 38;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Keyboards', p.id, 885, 2, 'Computer Equipment > Keyboards', 560, NULL
FROM categories p WHERE p.digikey_id = 38;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'KVM Switches (Keyboard Video Mouse)', p.id, 890, 2, 'Computer Equipment > KVM Switches (Keyboard Video Mouse)', 384, NULL
FROM categories p WHERE p.digikey_id = 38;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'KVM Switches (Keyboard Video Mouse) - Cables', p.id, 896, 2, 'Computer Equipment > KVM Switches (Keyboard Video Mouse) - Cables', 151, NULL
FROM categories p WHERE p.digikey_id = 38;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Magnetic Strip, Smart Card Readers', p.id, 891, 2, 'Computer Equipment > Magnetic Strip, Smart Card Readers', 52, NULL
FROM categories p WHERE p.digikey_id = 38;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Memory Card Readers', p.id, 895, 2, 'Computer Equipment > Memory Card Readers', 35, NULL
FROM categories p WHERE p.digikey_id = 38;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Monitors', p.id, 900, 2, 'Computer Equipment > Monitors', 604, NULL
FROM categories p WHERE p.digikey_id = 38;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Printers, Label Makers', p.id, 887, 2, 'Computer Equipment > Printers, Label Makers', 459, NULL
FROM categories p WHERE p.digikey_id = 38;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Privacy Filters, Screen Protectors', p.id, 883, 2, 'Computer Equipment > Privacy Filters, Screen Protectors', 637, NULL
FROM categories p WHERE p.digikey_id = 38;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Server Acceleration Cards', p.id, 986, 2, 'Computer Equipment > Server Acceleration Cards', 54, NULL
FROM categories p WHERE p.digikey_id = 38;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'USB Hubs', p.id, 1015, 2, 'Computer Equipment > USB Hubs', 428, NULL
FROM categories p WHERE p.digikey_id = 38;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'AC Power Connectors', p.id, 2026, 2, 'Connectors, Interconnects > AC Power Connectors', 14454, NULL
FROM categories p WHERE p.digikey_id = 20;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Backplane Connectors', p.id, 2000, 2, 'Connectors, Interconnects > Backplane Connectors', 62372, NULL
FROM categories p WHERE p.digikey_id = 20;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Banana and Tip Connectors', p.id, 2001, 2, 'Connectors, Interconnects > Banana and Tip Connectors', 2152, NULL
FROM categories p WHERE p.digikey_id = 20;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Barrel Connectors', p.id, 2002, 2, 'Connectors, Interconnects > Barrel Connectors', 4013, NULL
FROM categories p WHERE p.digikey_id = 20;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Between Series Adapters', p.id, 373, 2, 'Connectors, Interconnects > Between Series Adapters', 843, NULL
FROM categories p WHERE p.digikey_id = 20;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Blade Type Power Connectors', p.id, 2003, 2, 'Connectors, Interconnects > Blade Type Power Connectors', 3709, NULL
FROM categories p WHERE p.digikey_id = 20;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Card Edge Connectors', p.id, 2004, 2, 'Connectors, Interconnects > Card Edge Connectors', 620201, NULL
FROM categories p WHERE p.digikey_id = 20;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Circular Connectors', p.id, 2005, 2, 'Connectors, Interconnects > Circular Connectors', 2991968, NULL
FROM categories p WHERE p.digikey_id = 20;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Coaxial Connectors (RF)', p.id, 2007, 2, 'Connectors, Interconnects > Coaxial Connectors (RF)', 43753, NULL
FROM categories p WHERE p.digikey_id = 20;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Contacts', p.id, 2008, 2, 'Connectors, Interconnects > Contacts', 4268, NULL
FROM categories p WHERE p.digikey_id = 20;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'D-Sub, D-Shaped Connectors', p.id, 2011, 2, 'Connectors, Interconnects > D-Sub, D-Shaped Connectors', 257935, NULL
FROM categories p WHERE p.digikey_id = 20;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'FFC, FPC (Flat Flexible) Connectors', p.id, 2013, 2, 'Connectors, Interconnects > FFC, FPC (Flat Flexible) Connectors', 17568, NULL
FROM categories p WHERE p.digikey_id = 20;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Fiber Optic Connectors', p.id, 2014, 2, 'Connectors, Interconnects > Fiber Optic Connectors', 6144, NULL
FROM categories p WHERE p.digikey_id = 20;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Heavy Duty Connectors', p.id, 2015, 2, 'Connectors, Interconnects > Heavy Duty Connectors', 24524, NULL
FROM categories p WHERE p.digikey_id = 20;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Keystone Connectors', p.id, 2017, 2, 'Connectors, Interconnects > Keystone Connectors', 3657, NULL
FROM categories p WHERE p.digikey_id = 20;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'LGH Connectors', p.id, 441, 2, 'Connectors, Interconnects > LGH Connectors', 342, NULL
FROM categories p WHERE p.digikey_id = 20;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Memory Connectors', p.id, 2021, 2, 'Connectors, Interconnects > Memory Connectors', 4600, NULL
FROM categories p WHERE p.digikey_id = 20;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Modular/Ethernet Connectors', p.id, 2022, 2, 'Connectors, Interconnects > Modular/Ethernet Connectors', 21072, NULL
FROM categories p WHERE p.digikey_id = 20;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Photovoltaic (Solar Panel) Connectors', p.id, 2023, 2, 'Connectors, Interconnects > Photovoltaic (Solar Panel) Connectors', 572, NULL
FROM categories p WHERE p.digikey_id = 20;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Pluggable Connectors', p.id, 2024, 2, 'Connectors, Interconnects > Pluggable Connectors', 6382, NULL
FROM categories p WHERE p.digikey_id = 20;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Rectangular Connectors', p.id, 2027, 2, 'Connectors, Interconnects > Rectangular Connectors', 986655, NULL
FROM categories p WHERE p.digikey_id = 20;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Shunts, Jumpers', p.id, 304, 2, 'Connectors, Interconnects > Shunts, Jumpers', 1469, NULL
FROM categories p WHERE p.digikey_id = 20;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Sockets for ICs, Transistors', p.id, 2028, 2, 'Connectors, Interconnects > Sockets for ICs, Transistors', 20205, NULL
FROM categories p WHERE p.digikey_id = 20;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Solid State Lighting Connectors', p.id, 2029, 2, 'Connectors, Interconnects > Solid State Lighting Connectors', 1845, NULL
FROM categories p WHERE p.digikey_id = 20;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Terminal Blocks', p.id, 2030, 2, 'Connectors, Interconnects > Terminal Blocks', 227040, NULL
FROM categories p WHERE p.digikey_id = 20;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Terminal Junction Systems', p.id, 422, 2, 'Connectors, Interconnects > Terminal Junction Systems', 3257, NULL
FROM categories p WHERE p.digikey_id = 20;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Terminal Strips and Turret Boards', p.id, 306, 2, 'Connectors, Interconnects > Terminal Strips and Turret Boards', 475, NULL
FROM categories p WHERE p.digikey_id = 20;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Terminals', p.id, 2031, 2, 'Connectors, Interconnects > Terminals', 41405, NULL
FROM categories p WHERE p.digikey_id = 20;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'USB, DVI, HDMI Connectors', p.id, 2032, 2, 'Connectors, Interconnects > USB, DVI, HDMI Connectors', 6286, NULL
FROM categories p WHERE p.digikey_id = 20;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Crystal, Oscillator, Resonator Accessories', p.id, 175, 2, 'Crystals, Oscillators, Resonators > Crystal, Oscillator, Resonator Accessories', 167, NULL
FROM categories p WHERE p.digikey_id = 12;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Crystals', p.id, 171, 2, 'Crystals, Oscillators, Resonators > Crystals', 119359, NULL
FROM categories p WHERE p.digikey_id = 12;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Oscillators', p.id, 172, 2, 'Crystals, Oscillators, Resonators > Oscillators', 603386, NULL
FROM categories p WHERE p.digikey_id = 12;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Pin Configurable/Selectable Oscillators', p.id, 176, 2, 'Crystals, Oscillators, Resonators > Pin Configurable/Selectable Oscillators', 5074, NULL
FROM categories p WHERE p.digikey_id = 12;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Programmable Oscillators', p.id, 169, 2, 'Crystals, Oscillators, Resonators > Programmable Oscillators', 9820, NULL
FROM categories p WHERE p.digikey_id = 12;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Resonators', p.id, 174, 2, 'Crystals, Oscillators, Resonators > Resonators', 1883, NULL
FROM categories p WHERE p.digikey_id = 12;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Stand Alone Programmers', p.id, 170, 2, 'Crystals, Oscillators, Resonators > Stand Alone Programmers', 28, NULL
FROM categories p WHERE p.digikey_id = 12;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'VCOs (Voltage Controlled Oscillators)', p.id, 173, 2, 'Crystals, Oscillators, Resonators > VCOs (Voltage Controlled Oscillators)', 738, NULL
FROM categories p WHERE p.digikey_id = 12;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Accessories', p.id, 783, 2, 'Development Boards, Kits, Programmers > Accessories', 2824, NULL
FROM categories p WHERE p.digikey_id = 33;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Evaluation Boards', p.id, 2041, 2, 'Development Boards, Kits, Programmers > Evaluation Boards', 58632, NULL
FROM categories p WHERE p.digikey_id = 33;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Programmers, Emulators, and Debuggers', p.id, 799, 2, 'Development Boards, Kits, Programmers > Programmers, Emulators, and Debuggers', 1182, NULL
FROM categories p WHERE p.digikey_id = 33;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Programming Adapters, Sockets', p.id, 798, 2, 'Development Boards, Kits, Programmers > Programming Adapters, Sockets', 1995, NULL
FROM categories p WHERE p.digikey_id = 33;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Software, Services', p.id, 784, 2, 'Development Boards, Kits, Programmers > Software, Services', 4075, NULL
FROM categories p WHERE p.digikey_id = 33;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Current Regulation - Diodes, Transistors', p.id, 1164, 2, 'Discrete Semiconductor Products > Current Regulation - Diodes, Transistors', 1154, NULL
FROM categories p WHERE p.digikey_id = 19;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Diodes', p.id, 2042, 2, 'Discrete Semiconductor Products > Diodes', 146984, NULL
FROM categories p WHERE p.digikey_id = 19;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Power Driver Modules', p.id, 296, 2, 'Discrete Semiconductor Products > Power Driver Modules', 1284, NULL
FROM categories p WHERE p.digikey_id = 19;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Thyristors', p.id, 2043, 2, 'Discrete Semiconductor Products > Thyristors', 10485, NULL
FROM categories p WHERE p.digikey_id = 19;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Transistors', p.id, 2045, 2, 'Discrete Semiconductor Products > Transistors', 95166, NULL
FROM categories p WHERE p.digikey_id = 19;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Embedded Computer Accessories', p.id, 931, 2, 'Embedded Computers > Embedded Computer Accessories', 1357, NULL
FROM categories p WHERE p.digikey_id = 45;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Embedded Computer Interface Boards', p.id, 932, 2, 'Embedded Computers > Embedded Computer Interface Boards', 647, NULL
FROM categories p WHERE p.digikey_id = 45;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Single Board Computers (SBCs)', p.id, 933, 2, 'Embedded Computers > Single Board Computers (SBCs)', 6521, NULL
FROM categories p WHERE p.digikey_id = 45;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Fans', p.id, 2046, 2, 'Fans, Blowers, Thermal Management > Fans', 31551, NULL
FROM categories p WHERE p.digikey_id = 16;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Heat Tape, Heat Blankets and Heaters', p.id, 1005, 2, 'Fans, Blowers, Thermal Management > Heat Tape, Heat Blankets and Heaters', 1651, NULL
FROM categories p WHERE p.digikey_id = 16;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Thermal', p.id, 2047, 2, 'Fans, Blowers, Thermal Management > Thermal', 142232, NULL
FROM categories p WHERE p.digikey_id = 16;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Cable Ferrites', p.id, 840, 2, 'Filters > Cable Ferrites', 1997, NULL
FROM categories p WHERE p.digikey_id = 36;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Ceramic Filters', p.id, 846, 2, 'Filters > Ceramic Filters', 1392, NULL
FROM categories p WHERE p.digikey_id = 36;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Common Mode Chokes', p.id, 839, 2, 'Filters > Common Mode Chokes', 9263, NULL
FROM categories p WHERE p.digikey_id = 36;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'DSL Filters', p.id, 842, 2, 'Filters > DSL Filters', 24, NULL
FROM categories p WHERE p.digikey_id = 36;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'EMI/RFI Filters (LC, RC Networks)', p.id, 835, 2, 'Filters > EMI/RFI Filters (LC, RC Networks)', 2102, NULL
FROM categories p WHERE p.digikey_id = 36;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Feed Through Capacitors', p.id, 845, 2, 'Filters > Feed Through Capacitors', 3750, NULL
FROM categories p WHERE p.digikey_id = 36;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Ferrite Beads and Chips', p.id, 841, 2, 'Filters > Ferrite Beads and Chips', 8525, NULL
FROM categories p WHERE p.digikey_id = 36;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Ferrite Disks and Plates', p.id, 843, 2, 'Filters > Ferrite Disks and Plates', 128, NULL
FROM categories p WHERE p.digikey_id = 36;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Filter Accessories', p.id, 834, 2, 'Filters > Filter Accessories', 69, NULL
FROM categories p WHERE p.digikey_id = 36;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Helical Filters', p.id, 837, 2, 'Filters > Helical Filters', 6, NULL
FROM categories p WHERE p.digikey_id = 36;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Monolithic Crystals', p.id, 847, 2, 'Filters > Monolithic Crystals', 94, NULL
FROM categories p WHERE p.digikey_id = 36;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Power Line Filter Modules', p.id, 838, 2, 'Filters > Power Line Filter Modules', 13806, NULL
FROM categories p WHERE p.digikey_id = 36;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'RF Filters', p.id, 844, 2, 'Filters > RF Filters', 4133, NULL
FROM categories p WHERE p.digikey_id = 36;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'SAW Filters', p.id, 836, 2, 'Filters > SAW Filters', 2363, NULL
FROM categories p WHERE p.digikey_id = 36;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Accessories', p.id, 569, 2, 'Hardware, Fasteners, Accessories > Accessories', 2019, NULL
FROM categories p WHERE p.digikey_id = 26;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Bearings', p.id, 979, 2, 'Hardware, Fasteners, Accessories > Bearings', 271, NULL
FROM categories p WHERE p.digikey_id = 26;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Board Spacers, Standoffs', p.id, 582, 2, 'Hardware, Fasteners, Accessories > Board Spacers, Standoffs', 22658, NULL
FROM categories p WHERE p.digikey_id = 26;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Board Supports', p.id, 578, 2, 'Hardware, Fasteners, Accessories > Board Supports', 4556, NULL
FROM categories p WHERE p.digikey_id = 26;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Bumpers, Feet, Pads, Grips', p.id, 570, 2, 'Hardware, Fasteners, Accessories > Bumpers, Feet, Pads, Grips', 6975, NULL
FROM categories p WHERE p.digikey_id = 26;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Clips, Hangers, Hooks', p.id, 954, 2, 'Hardware, Fasteners, Accessories > Clips, Hangers, Hooks', 414, NULL
FROM categories p WHERE p.digikey_id = 26;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Component Insulators, Mounts, Spacers', p.id, 585, 2, 'Hardware, Fasteners, Accessories > Component Insulators, Mounts, Spacers', 783, NULL
FROM categories p WHERE p.digikey_id = 26;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'DIN Rail Channel', p.id, 580, 2, 'Hardware, Fasteners, Accessories > DIN Rail Channel', 1967, NULL
FROM categories p WHERE p.digikey_id = 26;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Foam', p.id, 587, 2, 'Hardware, Fasteners, Accessories > Foam', 508, NULL
FROM categories p WHERE p.digikey_id = 26;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Hinges', p.id, 976, 2, 'Hardware, Fasteners, Accessories > Hinges', 756, NULL
FROM categories p WHERE p.digikey_id = 26;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Hole Plugs - Tapered Caps', p.id, 581, 2, 'Hardware, Fasteners, Accessories > Hole Plugs - Tapered Caps', 3344, NULL
FROM categories p WHERE p.digikey_id = 26;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Knobs', p.id, 568, 2, 'Hardware, Fasteners, Accessories > Knobs', 10010, NULL
FROM categories p WHERE p.digikey_id = 26;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Miscellaneous', p.id, 579, 2, 'Hardware, Fasteners, Accessories > Miscellaneous', 4492, NULL
FROM categories p WHERE p.digikey_id = 26;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Mounting Brackets', p.id, 574, 2, 'Hardware, Fasteners, Accessories > Mounting Brackets', 163, NULL
FROM categories p WHERE p.digikey_id = 26;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Nuts', p.id, 573, 2, 'Hardware, Fasteners, Accessories > Nuts', 1306, NULL
FROM categories p WHERE p.digikey_id = 26;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Reclosable Fasteners', p.id, 967, 2, 'Hardware, Fasteners, Accessories > Reclosable Fasteners', 1683, NULL
FROM categories p WHERE p.digikey_id = 26;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Rivets', p.id, 576, 2, 'Hardware, Fasteners, Accessories > Rivets', 2965, NULL
FROM categories p WHERE p.digikey_id = 26;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Screw Grommets', p.id, 584, 2, 'Hardware, Fasteners, Accessories > Screw Grommets', 371, NULL
FROM categories p WHERE p.digikey_id = 26;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Screws, Bolts', p.id, 572, 2, 'Hardware, Fasteners, Accessories > Screws, Bolts', 27600, NULL
FROM categories p WHERE p.digikey_id = 26;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Seals - Cord Stock', p.id, 1172, 2, 'Hardware, Fasteners, Accessories > Seals - Cord Stock', 986, NULL
FROM categories p WHERE p.digikey_id = 26;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Seals - O-Rings', p.id, 1171, 2, 'Hardware, Fasteners, Accessories > Seals - O-Rings', 6988, NULL
FROM categories p WHERE p.digikey_id = 26;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Springs', p.id, 3004, 2, 'Hardware, Fasteners, Accessories > Springs', 15237, NULL
FROM categories p WHERE p.digikey_id = 26;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Structural, Motion Hardware', p.id, 586, 2, 'Hardware, Fasteners, Accessories > Structural, Motion Hardware', 23971, NULL
FROM categories p WHERE p.digikey_id = 26;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Washers', p.id, 2048, 2, 'Hardware, Fasteners, Accessories > Washers', 5680, NULL
FROM categories p WHERE p.digikey_id = 26;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Adjustable Inductors', p.id, 72, 2, 'Inductors, Coils, Chokes > Adjustable Inductors', 276, NULL
FROM categories p WHERE p.digikey_id = 4;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Arrays, Signal Transformers', p.id, 73, 2, 'Inductors, Coils, Chokes > Arrays, Signal Transformers', 1322, NULL
FROM categories p WHERE p.digikey_id = 4;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Delay Lines', p.id, 74, 2, 'Inductors, Coils, Chokes > Delay Lines', 50, NULL
FROM categories p WHERE p.digikey_id = 4;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Fixed Inductors', p.id, 71, 2, 'Inductors, Coils, Chokes > Fixed Inductors', 155795, NULL
FROM categories p WHERE p.digikey_id = 4;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Wireless Charging Coils', p.id, 75, 2, 'Inductors, Coils, Chokes > Wireless Charging Coils', 274, NULL
FROM categories p WHERE p.digikey_id = 4;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Cable and Hose Carriers, Drag Chains', p.id, 1014, 2, 'Industrial Automation and Controls > Cable and Hose Carriers, Drag Chains', 4178, NULL
FROM categories p WHERE p.digikey_id = 34;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Cam Positioners', p.id, 808, 2, 'Industrial Automation and Controls > Cam Positioners', 16, NULL
FROM categories p WHERE p.digikey_id = 34;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Controllers', p.id, 2049, 2, 'Industrial Automation and Controls > Controllers', 17901, NULL
FROM categories p WHERE p.digikey_id = 34;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Graphical/Numeric Displays', p.id, 2115, 2, 'Industrial Automation and Controls > Graphical/Numeric Displays', 21, NULL
FROM categories p WHERE p.digikey_id = 34;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Greases and Lubricants', p.id, 1013, 2, 'Industrial Automation and Controls > Greases and Lubricants', 137, NULL
FROM categories p WHERE p.digikey_id = 34;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Human Machine Interface (HMI)', p.id, 2050, 2, 'Industrial Automation and Controls > Human Machine Interface (HMI)', 2392, NULL
FROM categories p WHERE p.digikey_id = 34;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Industrial Automation Accessories', p.id, 800, 2, 'Industrial Automation and Controls > Industrial Automation Accessories', 11592, NULL
FROM categories p WHERE p.digikey_id = 34;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Industrial Equipment', p.id, 815, 2, 'Industrial Automation and Controls > Industrial Equipment', 4499, NULL
FROM categories p WHERE p.digikey_id = 34;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Industrial Lighting', p.id, 2051, 2, 'Industrial Automation and Controls > Industrial Lighting', 3455, NULL
FROM categories p WHERE p.digikey_id = 34;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Industrial Lighting Control', p.id, 2052, 2, 'Industrial Automation and Controls > Industrial Lighting Control', 299, NULL
FROM categories p WHERE p.digikey_id = 34;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Industrial PCs', p.id, 1062, 2, 'Industrial Automation and Controls > Industrial PCs', 5744, NULL
FROM categories p WHERE p.digikey_id = 34;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Industrial Sensors', p.id, 2114, 2, 'Industrial Automation and Controls > Industrial Sensors', 119252, NULL
FROM categories p WHERE p.digikey_id = 34;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Industrial Specialized', p.id, 804, 2, 'Industrial Automation and Controls > Industrial Specialized', 1135, NULL
FROM categories p WHERE p.digikey_id = 34;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Liquid Filtration', p.id, 978, 2, 'Industrial Automation and Controls > Liquid Filtration', 534, NULL
FROM categories p WHERE p.digikey_id = 34;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Machine Vision', p.id, 2053, 2, 'Industrial Automation and Controls > Machine Vision', 5174, NULL
FROM categories p WHERE p.digikey_id = 34;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Monitors', p.id, 2054, 2, 'Industrial Automation and Controls > Monitors', 2317, NULL
FROM categories p WHERE p.digikey_id = 34;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Panel Meters', p.id, 2055, 2, 'Industrial Automation and Controls > Panel Meters', 4686, NULL
FROM categories p WHERE p.digikey_id = 34;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Pneumatics, Hydraulics', p.id, 2056, 2, 'Industrial Automation and Controls > Pneumatics, Hydraulics', 78501, NULL
FROM categories p WHERE p.digikey_id = 34;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Protection Relays & Systems', p.id, 810, 2, 'Industrial Automation and Controls > Protection Relays & Systems', 1279, NULL
FROM categories p WHERE p.digikey_id = 34;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Robotics', p.id, 2057, 2, 'Industrial Automation and Controls > Robotics', 4051, NULL
FROM categories p WHERE p.digikey_id = 34;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Signal Conditioners and Isolators', p.id, 1020, 2, 'Industrial Automation and Controls > Signal Conditioners and Isolators', 977, NULL
FROM categories p WHERE p.digikey_id = 34;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Stackable Tower Lighting, Beacons, and Components', p.id, 953, 2, 'Industrial Automation and Controls > Stackable Tower Lighting, Beacons, and Components', 8061, NULL
FROM categories p WHERE p.digikey_id = 34;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Time Delay Relays', p.id, 952, 2, 'Industrial Automation and Controls > Time Delay Relays', 5247, NULL
FROM categories p WHERE p.digikey_id = 34;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Carts and Trucks', p.id, 1076, 2, 'Industrial Supplies > Carts and Trucks', 1002, NULL
FROM categories p WHERE p.digikey_id = 49;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Dock and Warehouse', p.id, 2092, 2, 'Industrial Supplies > Dock and Warehouse', 218, NULL
FROM categories p WHERE p.digikey_id = 49;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Electrical', p.id, 2093, 2, 'Industrial Supplies > Electrical', 302, NULL
FROM categories p WHERE p.digikey_id = 49;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Fans', p.id, 2094, 2, 'Industrial Supplies > Fans', 251, NULL
FROM categories p WHERE p.digikey_id = 49;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'HVAC', p.id, 2095, 2, 'Industrial Supplies > HVAC', 1016, NULL
FROM categories p WHERE p.digikey_id = 49;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Janitorial and Maintenance Products', p.id, 1110, 2, 'Industrial Supplies > Janitorial and Maintenance Products', 3322, NULL
FROM categories p WHERE p.digikey_id = 49;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Maintenance', p.id, 2096, 2, 'Industrial Supplies > Maintenance', 501, NULL
FROM categories p WHERE p.digikey_id = 49;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Office Equipment', p.id, 2097, 2, 'Industrial Supplies > Office Equipment', 713, NULL
FROM categories p WHERE p.digikey_id = 49;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Office Furniture', p.id, 2098, 2, 'Industrial Supplies > Office Furniture', 570, NULL
FROM categories p WHERE p.digikey_id = 49;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Outdoor Products', p.id, 2099, 2, 'Industrial Supplies > Outdoor Products', 1137, NULL
FROM categories p WHERE p.digikey_id = 49;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Product, Material Handling and Storage', p.id, 2100, 2, 'Industrial Supplies > Product, Material Handling and Storage', 4106, NULL
FROM categories p WHERE p.digikey_id = 49;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Safety', p.id, 2101, 2, 'Industrial Supplies > Safety', 77, NULL
FROM categories p WHERE p.digikey_id = 49;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Shipping and Packaging Products', p.id, 1151, 2, 'Industrial Supplies > Shipping and Packaging Products', 334, NULL
FROM categories p WHERE p.digikey_id = 49;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Storage Containers & Bins', p.id, 2103, 2, 'Industrial Supplies > Storage Containers & Bins', 3, NULL
FROM categories p WHERE p.digikey_id = 49;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Vehicle Maintenance and Customization Products', p.id, 1153, 2, 'Industrial Supplies > Vehicle Maintenance and Customization Products', 82, NULL
FROM categories p WHERE p.digikey_id = 49;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Workstation, Office Furniture and Equipment', p.id, 2104, 2, 'Industrial Supplies > Workstation, Office Furniture and Equipment', 848, NULL
FROM categories p WHERE p.digikey_id = 49;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Audio Special Purpose', p.id, 741, 2, 'Integrated Circuits (ICs) > Audio Special Purpose', 1432, NULL
FROM categories p WHERE p.digikey_id = 32;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Clock/Timing', p.id, 2006, 2, 'Integrated Circuits (ICs) > Clock/Timing', 27122, NULL
FROM categories p WHERE p.digikey_id = 32;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Data Acquisition', p.id, 2009, 2, 'Integrated Circuits (ICs) > Data Acquisition', 33853, NULL
FROM categories p WHERE p.digikey_id = 32;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Embedded', p.id, 2012, 2, 'Integrated Circuits (ICs) > Embedded', 133495, NULL
FROM categories p WHERE p.digikey_id = 32;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Interface', p.id, 2016, 2, 'Integrated Circuits (ICs) > Interface', 50995, NULL
FROM categories p WHERE p.digikey_id = 32;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Linear', p.id, 2018, 2, 'Integrated Circuits (ICs) > Linear', 45304, NULL
FROM categories p WHERE p.digikey_id = 32;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Logic', p.id, 2019, 2, 'Integrated Circuits (ICs) > Logic', 59437, NULL
FROM categories p WHERE p.digikey_id = 32;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Memory', p.id, 2020, 2, 'Integrated Circuits (ICs) > Memory', 59201, NULL
FROM categories p WHERE p.digikey_id = 32;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Power Management (PMIC)', p.id, 2025, 2, 'Integrated Circuits (ICs) > Power Management (PMIC)', 228376, NULL
FROM categories p WHERE p.digikey_id = 32;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Specialized ICs', p.id, 686, 2, 'Integrated Circuits (ICs) > Specialized ICs', 2668, NULL
FROM categories p WHERE p.digikey_id = 32;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Digital Isolators', p.id, 901, 2, 'Isolators > Digital Isolators', 5710, NULL
FROM categories p WHERE p.digikey_id = 39;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Isolators - Gate Drivers', p.id, 906, 2, 'Isolators > Isolators - Gate Drivers', 4156, NULL
FROM categories p WHERE p.digikey_id = 39;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Optocouplers, Optoisolators', p.id, 2058, 2, 'Isolators > Optocouplers, Optoisolators', 16802, NULL
FROM categories p WHERE p.digikey_id = 39;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Special Purpose Isolators', p.id, 905, 2, 'Isolators > Special Purpose Isolators', 112, NULL
FROM categories p WHERE p.digikey_id = 39;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Audio Kits', p.id, 669, 2, 'Kits > Audio Kits', 45, NULL
FROM categories p WHERE p.digikey_id = 31;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Cable Assembly Kits', p.id, 663, 2, 'Kits > Cable Assembly Kits', 39, NULL
FROM categories p WHERE p.digikey_id = 31;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Cables, Wires - Single Conductors', p.id, 665, 2, 'Kits > Cables, Wires - Single Conductors', 14477, NULL
FROM categories p WHERE p.digikey_id = 31;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Capacitor Kits', p.id, 651, 2, 'Kits > Capacitor Kits', 767, NULL
FROM categories p WHERE p.digikey_id = 31;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Circuit Protection - Assortment Kits', p.id, 666, 2, 'Kits > Circuit Protection - Assortment Kits', 103, NULL
FROM categories p WHERE p.digikey_id = 31;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Circuit Protection Kits - Fuse', p.id, 667, 2, 'Kits > Circuit Protection Kits - Fuse', 233, NULL
FROM categories p WHERE p.digikey_id = 31;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Circuit Protection Kits - TVS Diodes', p.id, 668, 2, 'Kits > Circuit Protection Kits - TVS Diodes', 31, NULL
FROM categories p WHERE p.digikey_id = 31;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Connector Adapter Kits', p.id, 660, 2, 'Kits > Connector Adapter Kits', 52, NULL
FROM categories p WHERE p.digikey_id = 31;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Connector Kits', p.id, 656, 2, 'Kits > Connector Kits', 872, NULL
FROM categories p WHERE p.digikey_id = 31;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Crystal Kits', p.id, 671, 2, 'Kits > Crystal Kits', 6, NULL
FROM categories p WHERE p.digikey_id = 31;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Discrete Assortment Kits', p.id, 659, 2, 'Kits > Discrete Assortment Kits', 44, NULL
FROM categories p WHERE p.digikey_id = 31;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'EMI, Filter Kits', p.id, 646, 2, 'Kits > EMI, Filter Kits', 223, NULL
FROM categories p WHERE p.digikey_id = 31;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Fiber Optic Kits', p.id, 674, 2, 'Kits > Fiber Optic Kits', 87, NULL
FROM categories p WHERE p.digikey_id = 31;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Hardware Kits', p.id, 645, 2, 'Kits > Hardware Kits', 104, NULL
FROM categories p WHERE p.digikey_id = 31;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Heat Shrink Tubing Kits', p.id, 675, 2, 'Kits > Heat Shrink Tubing Kits', 212, NULL
FROM categories p WHERE p.digikey_id = 31;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Inductor Kits', p.id, 655, 2, 'Kits > Inductor Kits', 397, NULL
FROM categories p WHERE p.digikey_id = 31;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Integrated Circuits (ICs) Kits', p.id, 658, 2, 'Kits > Integrated Circuits (ICs) Kits', 69, NULL
FROM categories p WHERE p.digikey_id = 31;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Kit Accessories', p.id, 649, 2, 'Kits > Kit Accessories', 30, NULL
FROM categories p WHERE p.digikey_id = 31;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'LED Kits', p.id, 647, 2, 'Kits > LED Kits', 57, NULL
FROM categories p WHERE p.digikey_id = 31;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Miscellaneous', p.id, 657, 2, 'Kits > Miscellaneous', 233, NULL
FROM categories p WHERE p.digikey_id = 31;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Optics - Light Pipe Kits', p.id, 676, 2, 'Kits > Optics - Light Pipe Kits', 8, NULL
FROM categories p WHERE p.digikey_id = 31;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Potentiometer Kits', p.id, 652, 2, 'Kits > Potentiometer Kits', 33, NULL
FROM categories p WHERE p.digikey_id = 31;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Prototyping Boards, Fabrication Kits', p.id, 672, 2, 'Kits > Prototyping Boards, Fabrication Kits', 32, NULL
FROM categories p WHERE p.digikey_id = 31;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Resistor Kits', p.id, 653, 2, 'Kits > Resistor Kits', 555, NULL
FROM categories p WHERE p.digikey_id = 31;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'RF Shield Kits', p.id, 677, 2, 'Kits > RF Shield Kits', 30, NULL
FROM categories p WHERE p.digikey_id = 31;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Sensor Kits', p.id, 662, 2, 'Kits > Sensor Kits', 380, NULL
FROM categories p WHERE p.digikey_id = 31;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Static Control Kit', p.id, 650, 2, 'Kits > Static Control Kit', 341, NULL
FROM categories p WHERE p.digikey_id = 31;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Switch Kits', p.id, 678, 2, 'Kits > Switch Kits', 54, NULL
FROM categories p WHERE p.digikey_id = 31;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Tape Kits', p.id, 673, 2, 'Kits > Tape Kits', 32, NULL
FROM categories p WHERE p.digikey_id = 31;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Thermistor Kits', p.id, 664, 2, 'Kits > Thermistor Kits', 21, NULL
FROM categories p WHERE p.digikey_id = 31;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Transformer Kits', p.id, 654, 2, 'Kits > Transformer Kits', 40, NULL
FROM categories p WHERE p.digikey_id = 31;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Wire and Cable Tie Kits', p.id, 661, 2, 'Kits > Wire and Cable Tie Kits', 51, NULL
FROM categories p WHERE p.digikey_id = 31;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Barriers, Barricades, Floor Markings, Tapes', p.id, 983, 2, 'Labels, Signs, Barriers, Identification > Barriers, Barricades, Floor Markings, Tapes', 1065, NULL
FROM categories p WHERE p.digikey_id = 980;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Label, Sign, Barrier Accessories', p.id, 987, 2, 'Labels, Signs, Barriers, Identification > Label, Sign, Barrier Accessories', 862, NULL
FROM categories p WHERE p.digikey_id = 980;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Labels, Stickers, Decals - Blank', p.id, 981, 2, 'Labels, Signs, Barriers, Identification > Labels, Stickers, Decals - Blank', 12530, NULL
FROM categories p WHERE p.digikey_id = 980;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Labels, Stickers, Decals - Preprinted', p.id, 982, 2, 'Labels, Signs, Barriers, Identification > Labels, Stickers, Decals - Preprinted', 9787, NULL
FROM categories p WHERE p.digikey_id = 980;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Lockouts, Padlocks', p.id, 577, 2, 'Labels, Signs, Barriers, Identification > Lockouts, Padlocks', 2117, NULL
FROM categories p WHERE p.digikey_id = 980;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Signs, Nameplates, Posters', p.id, 985, 2, 'Labels, Signs, Barriers, Identification > Signs, Nameplates, Posters', 13010, NULL
FROM categories p WHERE p.digikey_id = 980;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Tags', p.id, 984, 2, 'Labels, Signs, Barriers, Identification > Tags', 3573, NULL
FROM categories p WHERE p.digikey_id = 980;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'DC to AC (Power) Inverters', p.id, 833, 2, 'Line Protection, Distribution, Backups > DC to AC (Power) Inverters', 636, NULL
FROM categories p WHERE p.digikey_id = 35;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Line Conditioners', p.id, 830, 2, 'Line Protection, Distribution, Backups > Line Conditioners', 72, NULL
FROM categories p WHERE p.digikey_id = 35;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Line Protection, Distribution Accessories', p.id, 831, 2, 'Line Protection, Distribution, Backups > Line Protection, Distribution Accessories', 5058, NULL
FROM categories p WHERE p.digikey_id = 35;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Power Distribution, Surge Protectors', p.id, 832, 2, 'Line Protection, Distribution, Backups > Power Distribution, Surge Protectors', 5987, NULL
FROM categories p WHERE p.digikey_id = 35;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Uninterruptible Power Supply (UPS) Systems', p.id, 829, 2, 'Line Protection, Distribution, Backups > Uninterruptible Power Supply (UPS) Systems', 2129, NULL
FROM categories p WHERE p.digikey_id = 35;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Bobbins (Coil Formers), Mounts, Hardware', p.id, 935, 2, 'Magnetics - Transformer, Inductor Components > Bobbins (Coil Formers), Mounts, Hardware', 1173, NULL
FROM categories p WHERE p.digikey_id = 46;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Ferrite Cores', p.id, 936, 2, 'Magnetics - Transformer, Inductor Components > Ferrite Cores', 12128, NULL
FROM categories p WHERE p.digikey_id = 46;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Magnet Wire', p.id, 934, 2, 'Magnetics - Transformer, Inductor Components > Magnet Wire', 707, NULL
FROM categories p WHERE p.digikey_id = 46;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Books, Media', p.id, 937, 2, 'Maker/DIY, Educational > Books, Media', 302, NULL
FROM categories p WHERE p.digikey_id = 47;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Educational Kits', p.id, 939, 2, 'Maker/DIY, Educational > Educational Kits', 1535, NULL
FROM categories p WHERE p.digikey_id = 47;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Gadgets, Gizmos', p.id, 941, 2, 'Maker/DIY, Educational > Gadgets, Gizmos', 141, NULL
FROM categories p WHERE p.digikey_id = 47;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Prototyping, Fabrication', p.id, 938, 2, 'Maker/DIY, Educational > Prototyping, Fabrication', 106, NULL
FROM categories p WHERE p.digikey_id = 47;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Robotics Kits', p.id, 942, 2, 'Maker/DIY, Educational > Robotics Kits', 546, NULL
FROM categories p WHERE p.digikey_id = 47;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Wearables', p.id, 940, 2, 'Maker/DIY, Educational > Wearables', 316, NULL
FROM categories p WHERE p.digikey_id = 47;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Memory - Modules', p.id, 505, 2, 'Memory - Modules, Cards > Memory - Modules', 2909, NULL
FROM categories p WHERE p.digikey_id = 24;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Memory Card, Module Accessories', p.id, 500, 2, 'Memory - Modules, Cards > Memory Card, Module Accessories', 93, NULL
FROM categories p WHERE p.digikey_id = 24;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Memory Cards', p.id, 501, 2, 'Memory - Modules, Cards > Memory Cards', 3300, NULL
FROM categories p WHERE p.digikey_id = 24;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Solid State Drives (SSDs), Hard Disk Drives (HDDs)', p.id, 503, 2, 'Memory - Modules, Cards > Solid State Drives (SSDs), Hard Disk Drives (HDDs)', 8778, NULL
FROM categories p WHERE p.digikey_id = 24;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Specialized', p.id, 502, 2, 'Memory - Modules, Cards > Specialized', 65, NULL
FROM categories p WHERE p.digikey_id = 24;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'USB Flash Drives', p.id, 504, 2, 'Memory - Modules, Cards > USB Flash Drives', 552, NULL
FROM categories p WHERE p.digikey_id = 24;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Accessories', p.id, 177, 2, 'Motors, Actuators, Solenoids and Drivers > Accessories', 10447, NULL
FROM categories p WHERE p.digikey_id = 13;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Electric Actuators/Cylinders', p.id, 1157, 2, 'Motors, Actuators, Solenoids and Drivers > Electric Actuators/Cylinders', 1939, NULL
FROM categories p WHERE p.digikey_id = 13;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Motor Driver Boards, Modules', p.id, 181, 2, 'Motors, Actuators, Solenoids and Drivers > Motor Driver Boards, Modules', 16191, NULL
FROM categories p WHERE p.digikey_id = 13;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Motors - AC, DC', p.id, 178, 2, 'Motors, Actuators, Solenoids and Drivers > Motors - AC, DC', 9627, NULL
FROM categories p WHERE p.digikey_id = 13;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Solenoids', p.id, 180, 2, 'Motors, Actuators, Solenoids and Drivers > Solenoids', 466, NULL
FROM categories p WHERE p.digikey_id = 13;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Stepper Motors', p.id, 179, 2, 'Motors, Actuators, Solenoids and Drivers > Stepper Motors', 1226, NULL
FROM categories p WHERE p.digikey_id = 13;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Variable Frequency Drives (VFDs)', p.id, 2113, 2, 'Motors, Actuators, Solenoids and Drivers > Variable Frequency Drives (VFDs)', 4876, NULL
FROM categories p WHERE p.digikey_id = 13;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Accessories', p.id, 925, 2, 'Networking Solutions > Accessories', 3543, NULL
FROM categories p WHERE p.digikey_id = 44;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Gateways, Routers', p.id, 928, 2, 'Networking Solutions > Gateways, Routers', 7550, NULL
FROM categories p WHERE p.digikey_id = 44;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Media Converters', p.id, 929, 2, 'Networking Solutions > Media Converters', 3836, NULL
FROM categories p WHERE p.digikey_id = 44;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Miscellaneous', p.id, 926, 2, 'Networking Solutions > Miscellaneous', 2791, NULL
FROM categories p WHERE p.digikey_id = 44;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Serial Device Servers', p.id, 930, 2, 'Networking Solutions > Serial Device Servers', 1361, NULL
FROM categories p WHERE p.digikey_id = 44;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Switches, Hubs', p.id, 927, 2, 'Networking Solutions > Switches, Hubs', 7754, NULL
FROM categories p WHERE p.digikey_id = 44;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Arms, Mounts, Stands', p.id, 915, 2, 'Optical Inspection Equipment > Arms, Mounts, Stands', 138, NULL
FROM categories p WHERE p.digikey_id = 42;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Cameras', p.id, 913, 2, 'Optical Inspection Equipment > Cameras', 51, NULL
FROM categories p WHERE p.digikey_id = 42;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Eyepieces, Lenses', p.id, 916, 2, 'Optical Inspection Equipment > Eyepieces, Lenses', 141, NULL
FROM categories p WHERE p.digikey_id = 42;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Illumination Sources', p.id, 920, 2, 'Optical Inspection Equipment > Illumination Sources', 96, NULL
FROM categories p WHERE p.digikey_id = 42;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Lamps - Magnifying, Task', p.id, 917, 2, 'Optical Inspection Equipment > Lamps - Magnifying, Task', 889, NULL
FROM categories p WHERE p.digikey_id = 42;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Loupes, Magnifiers', p.id, 918, 2, 'Optical Inspection Equipment > Loupes, Magnifiers', 89, NULL
FROM categories p WHERE p.digikey_id = 42;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Machine Vision - Accessories', p.id, 1121, 2, 'Optical Inspection Equipment > Machine Vision - Accessories', 856, NULL
FROM categories p WHERE p.digikey_id = 42;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Machine Vision - Lenses', p.id, 1077, 2, 'Optical Inspection Equipment > Machine Vision - Lenses', 592, NULL
FROM categories p WHERE p.digikey_id = 42;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Microscopes', p.id, 914, 2, 'Optical Inspection Equipment > Microscopes', 536, NULL
FROM categories p WHERE p.digikey_id = 42;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Optical Inspection Accessories', p.id, 912, 2, 'Optical Inspection Equipment > Optical Inspection Accessories', 617, NULL
FROM categories p WHERE p.digikey_id = 42;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Video Inspection Systems', p.id, 919, 2, 'Optical Inspection Equipment > Video Inspection Systems', 151, NULL
FROM categories p WHERE p.digikey_id = 42;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Beamsplitters', p.id, 1156, 2, 'Optics > Beamsplitters', 39, NULL
FROM categories p WHERE p.digikey_id = 41;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Filters', p.id, 1044, 2, 'Optics > Filters', 59, NULL
FROM categories p WHERE p.digikey_id = 41;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Laser Optics', p.id, 2060, 2, 'Optics > Laser Optics', 274, NULL
FROM categories p WHERE p.digikey_id = 41;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Lenses', p.id, 1045, 2, 'Optics > Lenses', 1478, NULL
FROM categories p WHERE p.digikey_id = 41;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Mirrors', p.id, 1158, 2, 'Optics > Mirrors', 132, NULL
FROM categories p WHERE p.digikey_id = 41;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Polarizers', p.id, 1046, 2, 'Optics > Polarizers', 63, NULL
FROM categories p WHERE p.digikey_id = 41;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Prisms', p.id, 1122, 2, 'Optics > Prisms', 19, NULL
FROM categories p WHERE p.digikey_id = 41;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Ballasts, Inverters', p.id, 97, 2, 'Optoelectronics > Ballasts, Inverters', 283, NULL
FROM categories p WHERE p.digikey_id = 7;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Circuit Board Indicators, Arrays, Light Bars, Bar Graphs', p.id, 106, 2, 'Optoelectronics > Circuit Board Indicators, Arrays, Light Bars, Bar Graphs', 7516, NULL
FROM categories p WHERE p.digikey_id = 7;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Cold Cathode Fluorescent (CCFL) & UV Lamps', p.id, 104, 2, 'Optoelectronics > Cold Cathode Fluorescent (CCFL) & UV Lamps', 181, NULL
FROM categories p WHERE p.digikey_id = 7;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Display Backlights', p.id, 1168, 2, 'Optoelectronics > Display Backlights', 100, NULL
FROM categories p WHERE p.digikey_id = 7;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Display Bezels, Lenses', p.id, 93, 2, 'Optoelectronics > Display Bezels, Lenses', 88, NULL
FROM categories p WHERE p.digikey_id = 7;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Display, Monitor - LCD Driver/Controller', p.id, 114, 2, 'Optoelectronics > Display, Monitor - LCD Driver/Controller', 99, NULL
FROM categories p WHERE p.digikey_id = 7;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Electroluminescent', p.id, 127, 2, 'Optoelectronics > Electroluminescent', 86, NULL
FROM categories p WHERE p.digikey_id = 7;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Fiber Optic Attenuators', p.id, 119, 2, 'Optoelectronics > Fiber Optic Attenuators', 296, NULL
FROM categories p WHERE p.digikey_id = 7;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Fiber Optic Receivers', p.id, 117, 2, 'Optoelectronics > Fiber Optic Receivers', 379, NULL
FROM categories p WHERE p.digikey_id = 7;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Fiber Optic Switches, Multiplexers, Demultiplexers', p.id, 120, 2, 'Optoelectronics > Fiber Optic Switches, Multiplexers, Demultiplexers', 887, NULL
FROM categories p WHERE p.digikey_id = 7;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Fiber Optic Transceiver Modules', p.id, 118, 2, 'Optoelectronics > Fiber Optic Transceiver Modules', 25010, NULL
FROM categories p WHERE p.digikey_id = 7;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Fiber Optic Transmitters - Discrete', p.id, 116, 2, 'Optoelectronics > Fiber Optic Transmitters - Discrete', 228, NULL
FROM categories p WHERE p.digikey_id = 7;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Fiber Optic Transmitters - Drive Circuitry Integrated', p.id, 115, 2, 'Optoelectronics > Fiber Optic Transmitters - Drive Circuitry Integrated', 106, NULL
FROM categories p WHERE p.digikey_id = 7;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'HeNe Laser Heads', p.id, 1119, 2, 'Optoelectronics > HeNe Laser Heads', 25, NULL
FROM categories p WHERE p.digikey_id = 7;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'HeNe Laser System Accessories', p.id, 1009, 2, 'Optoelectronics > HeNe Laser System Accessories', 11, NULL
FROM categories p WHERE p.digikey_id = 7;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'HeNe Laser Systems', p.id, 1008, 2, 'Optoelectronics > HeNe Laser Systems', 33, NULL
FROM categories p WHERE p.digikey_id = 7;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Incandescent, Neon Lamps', p.id, 101, 2, 'Optoelectronics > Incandescent, Neon Lamps', 2490, NULL
FROM categories p WHERE p.digikey_id = 7;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Lamp Replacements', p.id, 109, 2, 'Optoelectronics > Lamp Replacements', 1406, NULL
FROM categories p WHERE p.digikey_id = 7;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Laser Diode, Module Accessories', p.id, 966, 2, 'Optoelectronics > Laser Diode, Module Accessories', 93, NULL
FROM categories p WHERE p.digikey_id = 7;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Laser Diodes, Laser Modules - Laser Delivery, Laser Fibers', p.id, 1055, 2, 'Optoelectronics > Laser Diodes, Laser Modules - Laser Delivery, Laser Fibers', 345, NULL
FROM categories p WHERE p.digikey_id = 7;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Laser Diodes, Modules', p.id, 95, 2, 'Optoelectronics > Laser Diodes, Modules', 1085, NULL
FROM categories p WHERE p.digikey_id = 7;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'LCD, OLED Character and Numeric', p.id, 99, 2, 'Optoelectronics > LCD, OLED Character and Numeric', 2178, NULL
FROM categories p WHERE p.digikey_id = 7;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'LCD, OLED, Graphic', p.id, 107, 2, 'Optoelectronics > LCD, OLED, Graphic', 4987, NULL
FROM categories p WHERE p.digikey_id = 7;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'LED Addressable, Specialty', p.id, 126, 2, 'Optoelectronics > LED Addressable, Specialty', 598, NULL
FROM categories p WHERE p.digikey_id = 7;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'LED Character and Numeric', p.id, 92, 2, 'Optoelectronics > LED Character and Numeric', 5959, NULL
FROM categories p WHERE p.digikey_id = 7;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'LED COBs, Engines, Modules, Strips', p.id, 111, 2, 'Optoelectronics > LED COBs, Engines, Modules, Strips', 32392, NULL
FROM categories p WHERE p.digikey_id = 7;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'LED Color Lighting', p.id, 125, 2, 'Optoelectronics > LED Color Lighting', 5376, NULL
FROM categories p WHERE p.digikey_id = 7;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'LED Dot Matrix and Cluster', p.id, 96, 2, 'Optoelectronics > LED Dot Matrix and Cluster', 693, NULL
FROM categories p WHERE p.digikey_id = 7;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'LED Emitters - Infrared, UV, Visible', p.id, 94, 2, 'Optoelectronics > LED Emitters - Infrared, UV, Visible', 4198, NULL
FROM categories p WHERE p.digikey_id = 7;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'LED Indication - Discrete', p.id, 105, 2, 'Optoelectronics > LED Indication - Discrete', 25414, NULL
FROM categories p WHERE p.digikey_id = 7;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'LED Lighting Kits', p.id, 129, 2, 'Optoelectronics > LED Lighting Kits', 65, NULL
FROM categories p WHERE p.digikey_id = 7;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'LED Thermal Products', p.id, 121, 2, 'Optoelectronics > LED Thermal Products', 369, NULL
FROM categories p WHERE p.digikey_id = 7;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'LED White Lighting', p.id, 124, 2, 'Optoelectronics > LED White Lighting', 43953, NULL
FROM categories p WHERE p.digikey_id = 7;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Lenses', p.id, 112, 2, 'Optoelectronics > Lenses', 3420, NULL
FROM categories p WHERE p.digikey_id = 7;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Light Pipes', p.id, 102, 2, 'Optoelectronics > Light Pipes', 35797, NULL
FROM categories p WHERE p.digikey_id = 7;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Lighting Fixtures', p.id, 1161, 2, 'Optoelectronics > Lighting Fixtures', 216, NULL
FROM categories p WHERE p.digikey_id = 7;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Optoelectronics Accessories', p.id, 98, 2, 'Optoelectronics > Optoelectronics Accessories', 7002, NULL
FROM categories p WHERE p.digikey_id = 7;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Optomechanical', p.id, 1047, 2, 'Optoelectronics > Optomechanical', 477, NULL
FROM categories p WHERE p.digikey_id = 7;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Panel Indicators, Pilot Lights', p.id, 108, 2, 'Optoelectronics > Panel Indicators, Pilot Lights', 23238, NULL
FROM categories p WHERE p.digikey_id = 7;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Reflectors', p.id, 122, 2, 'Optoelectronics > Reflectors', 476, NULL
FROM categories p WHERE p.digikey_id = 7;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Remote Phosphor Light Source', p.id, 123, 2, 'Optoelectronics > Remote Phosphor Light Source', 269, NULL
FROM categories p WHERE p.digikey_id = 7;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Spacers, Standoffs', p.id, 100, 2, 'Optoelectronics > Spacers, Standoffs', 3772, NULL
FROM categories p WHERE p.digikey_id = 7;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Touch Screen Overlays', p.id, 110, 2, 'Optoelectronics > Touch Screen Overlays', 261, NULL
FROM categories p WHERE p.digikey_id = 7;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Vacuum Fluorescent (VFD)', p.id, 103, 2, 'Optoelectronics > Vacuum Fluorescent (VFD)', 223, NULL
FROM categories p WHERE p.digikey_id = 7;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Xenon Lighting', p.id, 128, 2, 'Optoelectronics > Xenon Lighting', 164, NULL
FROM categories p WHERE p.digikey_id = 7;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Accessories', p.id, 76, 2, 'Potentiometers, Variable Resistors > Accessories', 183, NULL
FROM categories p WHERE p.digikey_id = 5;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Adjustable Power Resistor', p.id, 83, 2, 'Potentiometers, Variable Resistors > Adjustable Power Resistor', 1167, NULL
FROM categories p WHERE p.digikey_id = 5;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Joystick Potentiometers', p.id, 82, 2, 'Potentiometers, Variable Resistors > Joystick Potentiometers', 15, NULL
FROM categories p WHERE p.digikey_id = 5;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Rotary Potentiometers, Rheostats', p.id, 84, 2, 'Potentiometers, Variable Resistors > Rotary Potentiometers, Rheostats', 681146, NULL
FROM categories p WHERE p.digikey_id = 5;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Scale Dials', p.id, 79, 2, 'Potentiometers, Variable Resistors > Scale Dials', 108, NULL
FROM categories p WHERE p.digikey_id = 5;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Slide Potentiometers', p.id, 78, 2, 'Potentiometers, Variable Resistors > Slide Potentiometers', 14004, NULL
FROM categories p WHERE p.digikey_id = 5;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Thumbwheel Potentiometers', p.id, 77, 2, 'Potentiometers, Variable Resistors > Thumbwheel Potentiometers', 386, NULL
FROM categories p WHERE p.digikey_id = 5;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Trimmer Potentiometers', p.id, 80, 2, 'Potentiometers, Variable Resistors > Trimmer Potentiometers', 18317, NULL
FROM categories p WHERE p.digikey_id = 5;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Value Display Potentiometers', p.id, 81, 2, 'Potentiometers, Variable Resistors > Value Display Potentiometers', 28, NULL
FROM categories p WHERE p.digikey_id = 5;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'AC DC Converters', p.id, 923, 2, 'Power Supplies - Board Mount > AC DC Converters', 7267, NULL
FROM categories p WHERE p.digikey_id = 43;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Board Mount Power Supply Accessories', p.id, 921, 2, 'Power Supplies - Board Mount > Board Mount Power Supply Accessories', 894, NULL
FROM categories p WHERE p.digikey_id = 43;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'DC DC Converters', p.id, 922, 2, 'Power Supplies - Board Mount > DC DC Converters', 104551, NULL
FROM categories p WHERE p.digikey_id = 43;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'LED Drivers', p.id, 924, 2, 'Power Supplies - Board Mount > LED Drivers', 328, NULL
FROM categories p WHERE p.digikey_id = 43;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'AC AC Wall Power Adapters', p.id, 135, 2, 'Power Supplies - External/Internal (Off-Board) > AC AC Wall Power Adapters', 213, NULL
FROM categories p WHERE p.digikey_id = 8;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'AC DC Configurable Power Supplies (Factory Assembled)', p.id, 955, 2, 'Power Supplies - External/Internal (Off-Board) > AC DC Configurable Power Supplies (Factory Assembled)', 423, NULL
FROM categories p WHERE p.digikey_id = 8;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'AC DC Configurable Power Supply Chassis', p.id, 134, 2, 'Power Supplies - External/Internal (Off-Board) > AC DC Configurable Power Supply Chassis', 1435, NULL
FROM categories p WHERE p.digikey_id = 8;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'AC DC Configurable Power Supply Modules', p.id, 136, 2, 'Power Supplies - External/Internal (Off-Board) > AC DC Configurable Power Supply Modules', 169, NULL
FROM categories p WHERE p.digikey_id = 8;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'AC DC Converters', p.id, 133, 2, 'Power Supplies - External/Internal (Off-Board) > AC DC Converters', 79911, NULL
FROM categories p WHERE p.digikey_id = 8;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'AC DC Desktop, Wall Power Adapters', p.id, 130, 2, 'Power Supplies - External/Internal (Off-Board) > AC DC Desktop, Wall Power Adapters', 14746, NULL
FROM categories p WHERE p.digikey_id = 8;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'DC DC Converters', p.id, 132, 2, 'Power Supplies - External/Internal (Off-Board) > DC DC Converters', 8230, NULL
FROM categories p WHERE p.digikey_id = 8;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'External/Internal Power Supply Accessories', p.id, 131, 2, 'Power Supplies - External/Internal (Off-Board) > External/Internal Power Supply Accessories', 2017, NULL
FROM categories p WHERE p.digikey_id = 8;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Industrial, DIN Rail Power Supplies', p.id, 1064, 2, 'Power Supplies - External/Internal (Off-Board) > Industrial, DIN Rail Power Supplies', 5029, NULL
FROM categories p WHERE p.digikey_id = 8;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'LED Drivers', p.id, 137, 2, 'Power Supplies - External/Internal (Off-Board) > LED Drivers', 5633, NULL
FROM categories p WHERE p.digikey_id = 8;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Power over Ethernet (PoE)', p.id, 138, 2, 'Power Supplies - External/Internal (Off-Board) > Power over Ethernet (PoE)', 1028, NULL
FROM categories p WHERE p.digikey_id = 8;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT '3D Printers', p.id, 943, 2, 'Prototyping, Fabrication Products > 3D Printers', 107, NULL
FROM categories p WHERE p.digikey_id = 30;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT '3D Printing Accessories', p.id, 956, 2, 'Prototyping, Fabrication Products > 3D Printing Accessories', 350, NULL
FROM categories p WHERE p.digikey_id = 30;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT '3D Printing Materials', p.id, 944, 2, 'Prototyping, Fabrication Products > 3D Printing Materials', 1911, NULL
FROM categories p WHERE p.digikey_id = 30;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Accessories', p.id, 635, 2, 'Prototyping, Fabrication Products > Accessories', 377, NULL
FROM categories p WHERE p.digikey_id = 30;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Adapter, Breakout Boards', p.id, 643, 2, 'Prototyping, Fabrication Products > Adapter, Breakout Boards', 1737, NULL
FROM categories p WHERE p.digikey_id = 30;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Card Extenders', p.id, 641, 2, 'Prototyping, Fabrication Products > Card Extenders', 68, NULL
FROM categories p WHERE p.digikey_id = 30;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Coating, Grease, Repair', p.id, 642, 2, 'Prototyping, Fabrication Products > Coating, Grease, Repair', 371, NULL
FROM categories p WHERE p.digikey_id = 30;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Custom Configurable PCB''s', p.id, 1159, 2, 'Prototyping, Fabrication Products > Custom Configurable PCB''s', 12, NULL
FROM categories p WHERE p.digikey_id = 30;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Drill Bits, End Mills', p.id, 644, 2, 'Prototyping, Fabrication Products > Drill Bits, End Mills', 477, NULL
FROM categories p WHERE p.digikey_id = 30;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Etching and Fabrication Equipment', p.id, 639, 2, 'Prototyping, Fabrication Products > Etching and Fabrication Equipment', 52, NULL
FROM categories p WHERE p.digikey_id = 30;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Jumper Wire', p.id, 640, 2, 'Prototyping, Fabrication Products > Jumper Wire', 642, NULL
FROM categories p WHERE p.digikey_id = 30;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'PCB Routers, Milling Machines', p.id, 972, 2, 'Prototyping, Fabrication Products > PCB Routers, Milling Machines', 34, NULL
FROM categories p WHERE p.digikey_id = 30;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Prototype Boards Perforated', p.id, 636, 2, 'Prototyping, Fabrication Products > Prototype Boards Perforated', 562, NULL
FROM categories p WHERE p.digikey_id = 30;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Prototype Boards Unperforated', p.id, 637, 2, 'Prototyping, Fabrication Products > Prototype Boards Unperforated', 70, NULL
FROM categories p WHERE p.digikey_id = 30;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Solderless Breadboards', p.id, 638, 2, 'Prototyping, Fabrication Products > Solderless Breadboards', 231, NULL
FROM categories p WHERE p.digikey_id = 30;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Accessories', p.id, 182, 2, 'Relays > Accessories', 5852, NULL
FROM categories p WHERE p.digikey_id = 14;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Automotive Relays', p.id, 962, 2, 'Relays > Automotive Relays', 2027, NULL
FROM categories p WHERE p.digikey_id = 14;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Contactors (Electromechanical)', p.id, 969, 2, 'Relays > Contactors (Electromechanical)', 15551, NULL
FROM categories p WHERE p.digikey_id = 14;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Contactors (Solid State)', p.id, 970, 2, 'Relays > Contactors (Solid State)', 1094, NULL
FROM categories p WHERE p.digikey_id = 14;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'High Frequency (RF) Relays', p.id, 963, 2, 'Relays > High Frequency (RF) Relays', 1006, NULL
FROM categories p WHERE p.digikey_id = 14;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'I/O Relay Module Racks', p.id, 190, 2, 'Relays > I/O Relay Module Racks', 234, NULL
FROM categories p WHERE p.digikey_id = 14;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'I/O Relay Modules', p.id, 186, 2, 'Relays > I/O Relay Modules', 719, NULL
FROM categories p WHERE p.digikey_id = 14;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Power Relays, Over 2 Amps', p.id, 188, 2, 'Relays > Power Relays, Over 2 Amps', 35987, NULL
FROM categories p WHERE p.digikey_id = 14;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Reed Relays', p.id, 964, 2, 'Relays > Reed Relays', 1592, NULL
FROM categories p WHERE p.digikey_id = 14;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Relay Sockets', p.id, 184, 2, 'Relays > Relay Sockets', 2008, NULL
FROM categories p WHERE p.digikey_id = 14;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Signal Relays, Up to 2 Amps', p.id, 189, 2, 'Relays > Signal Relays, Up to 2 Amps', 8200, NULL
FROM categories p WHERE p.digikey_id = 14;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Solid State Relays (SSR)', p.id, 183, 2, 'Relays > Solid State Relays (SSR)', 10061, NULL
FROM categories p WHERE p.digikey_id = 14;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Accessories', p.id, 51, 2, 'Resistors > Accessories', 228, NULL
FROM categories p WHERE p.digikey_id = 2;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Chassis Mount Resistors', p.id, 54, 2, 'Resistors > Chassis Mount Resistors', 28294, NULL
FROM categories p WHERE p.digikey_id = 2;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Chip Resistor - Surface Mount', p.id, 52, 2, 'Resistors > Chip Resistor - Surface Mount', 1183690, NULL
FROM categories p WHERE p.digikey_id = 2;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Resistor Networks, Arrays', p.id, 50, 2, 'Resistors > Resistor Networks, Arrays', 36350, NULL
FROM categories p WHERE p.digikey_id = 2;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Specialized Resistors', p.id, 55, 2, 'Resistors > Specialized Resistors', 1108, NULL
FROM categories p WHERE p.digikey_id = 2;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Through Hole Resistors', p.id, 53, 2, 'Resistors > Through Hole Resistors', 521846, NULL
FROM categories p WHERE p.digikey_id = 2;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Attenuators', p.id, 852, 2, 'RF and Wireless > Attenuators', 7783, NULL
FROM categories p WHERE p.digikey_id = 37;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Balun', p.id, 849, 2, 'RF and Wireless > Balun', 1210, NULL
FROM categories p WHERE p.digikey_id = 37;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'RF Accessories', p.id, 866, 2, 'RF and Wireless > RF Accessories', 5479, NULL
FROM categories p WHERE p.digikey_id = 37;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'RF Amplifiers', p.id, 860, 2, 'RF and Wireless > RF Amplifiers', 7397, NULL
FROM categories p WHERE p.digikey_id = 37;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'RF Antennas', p.id, 875, 2, 'RF and Wireless > RF Antennas', 15926, NULL
FROM categories p WHERE p.digikey_id = 37;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'RF Circulators and Isolators', p.id, 1010, 2, 'RF and Wireless > RF Circulators and Isolators', 2331, NULL
FROM categories p WHERE p.digikey_id = 37;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'RF Demodulators', p.id, 878, 2, 'RF and Wireless > RF Demodulators', 228, NULL
FROM categories p WHERE p.digikey_id = 37;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'RF Detectors', p.id, 862, 2, 'RF and Wireless > RF Detectors', 523, NULL
FROM categories p WHERE p.digikey_id = 37;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'RF Directional Coupler', p.id, 850, 2, 'RF and Wireless > RF Directional Coupler', 3114, NULL
FROM categories p WHERE p.digikey_id = 37;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'RF Front End (LNA + PA)', p.id, 876, 2, 'RF and Wireless > RF Front End (LNA + PA)', 639, NULL
FROM categories p WHERE p.digikey_id = 37;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'RF Misc ICs and Modules', p.id, 863, 2, 'RF and Wireless > RF Misc ICs and Modules', 3220, NULL
FROM categories p WHERE p.digikey_id = 37;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'RF Mixers', p.id, 861, 2, 'RF and Wireless > RF Mixers', 1619, NULL
FROM categories p WHERE p.digikey_id = 37;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'RF Modulators', p.id, 877, 2, 'RF and Wireless > RF Modulators', 222, NULL
FROM categories p WHERE p.digikey_id = 37;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'RF Multiplexers', p.id, 868, 2, 'RF and Wireless > RF Multiplexers', 1189, NULL
FROM categories p WHERE p.digikey_id = 37;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'RF Power Controller ICs', p.id, 864, 2, 'RF and Wireless > RF Power Controller ICs', 52, NULL
FROM categories p WHERE p.digikey_id = 37;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'RF Power Dividers/Splitters', p.id, 851, 2, 'RF and Wireless > RF Power Dividers/Splitters', 1574, NULL
FROM categories p WHERE p.digikey_id = 37;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'RF Receiver, Transmitter, and Transceiver Finished Units', p.id, 873, 2, 'RF and Wireless > RF Receiver, Transmitter, and Transceiver Finished Units', 2411, NULL
FROM categories p WHERE p.digikey_id = 37;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'RF Receivers', p.id, 870, 2, 'RF and Wireless > RF Receivers', 1725, NULL
FROM categories p WHERE p.digikey_id = 37;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'RF Shields', p.id, 867, 2, 'RF and Wireless > RF Shields', 16360, NULL
FROM categories p WHERE p.digikey_id = 37;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'RF Switches', p.id, 865, 2, 'RF and Wireless > RF Switches', 6510, NULL
FROM categories p WHERE p.digikey_id = 37;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'RF Transceiver ICs', p.id, 879, 2, 'RF and Wireless > RF Transceiver ICs', 4931, NULL
FROM categories p WHERE p.digikey_id = 37;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'RF Transceiver Modules and Modems', p.id, 872, 2, 'RF and Wireless > RF Transceiver Modules and Modems', 7322, NULL
FROM categories p WHERE p.digikey_id = 37;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'RF Transmitters', p.id, 871, 2, 'RF and Wireless > RF Transmitters', 595, NULL
FROM categories p WHERE p.digikey_id = 37;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'RFI and EMI - Contacts, Fingerstock and Gaskets', p.id, 945, 2, 'RF and Wireless > RFI and EMI - Contacts, Fingerstock and Gaskets', 4452, NULL
FROM categories p WHERE p.digikey_id = 37;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'RFI and EMI - Shielding and Absorbing Materials', p.id, 869, 2, 'RF and Wireless > RFI and EMI - Shielding and Absorbing Materials', 4249, NULL
FROM categories p WHERE p.digikey_id = 37;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'RFID Accessories', p.id, 857, 2, 'RF and Wireless > RFID Accessories', 289, NULL
FROM categories p WHERE p.digikey_id = 37;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'RFID Antennas', p.id, 855, 2, 'RF and Wireless > RFID Antennas', 532, NULL
FROM categories p WHERE p.digikey_id = 37;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'RFID Reader Modules', p.id, 854, 2, 'RF and Wireless > RFID Reader Modules', 629, NULL
FROM categories p WHERE p.digikey_id = 37;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'RFID Transponders, Tags', p.id, 853, 2, 'RF and Wireless > RFID Transponders, Tags', 901, NULL
FROM categories p WHERE p.digikey_id = 37;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'RFID, RF Access, Monitoring ICs', p.id, 880, 2, 'RF and Wireless > RFID, RF Access, Monitoring ICs', 1488, NULL
FROM categories p WHERE p.digikey_id = 37;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Subscriber Identification Module (SIM) Cards', p.id, 1163, 2, 'RF and Wireless > Subscriber Identification Module (SIM) Cards', 74, NULL
FROM categories p WHERE p.digikey_id = 37;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Direct Human Safety', p.id, 2117, 2, 'Safety Products > Direct Human Safety', 3638, NULL
FROM categories p WHERE p.digikey_id = 2116;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Machine Safety', p.id, 2091, 2, 'Safety Products > Machine Safety', 21838, NULL
FROM categories p WHERE p.digikey_id = 2116;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'User Controlled Safety', p.id, 2118, 2, 'Safety Products > User Controlled Safety', 3896, NULL
FROM categories p WHERE p.digikey_id = 2116;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Color Sensors', p.id, 539, 2, 'Sensors, Transducers > Color Sensors', 123, NULL
FROM categories p WHERE p.digikey_id = 25;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Current Sensors', p.id, 525, 2, 'Sensors, Transducers > Current Sensors', 6009, NULL
FROM categories p WHERE p.digikey_id = 25;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Encoders', p.id, 507, 2, 'Sensors, Transducers > Encoders', 15307, NULL
FROM categories p WHERE p.digikey_id = 25;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Float, Level Sensors', p.id, 521, 2, 'Sensors, Transducers > Float, Level Sensors', 4273, NULL
FROM categories p WHERE p.digikey_id = 25;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Flow Sensors', p.id, 520, 2, 'Sensors, Transducers > Flow Sensors', 915, NULL
FROM categories p WHERE p.digikey_id = 25;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Force Sensors, Load Cells', p.id, 531, 2, 'Sensors, Transducers > Force Sensors, Load Cells', 1243, NULL
FROM categories p WHERE p.digikey_id = 25;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Gas Sensors', p.id, 530, 2, 'Sensors, Transducers > Gas Sensors', 1426, NULL
FROM categories p WHERE p.digikey_id = 25;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Humidity, Moisture Sensors', p.id, 529, 2, 'Sensors, Transducers > Humidity, Moisture Sensors', 933, NULL
FROM categories p WHERE p.digikey_id = 25;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'IrDA Transceiver Modules', p.id, 538, 2, 'Sensors, Transducers > IrDA Transceiver Modules', 140, NULL
FROM categories p WHERE p.digikey_id = 25;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'LVDT Transducers (Linear Variable Differential Transformer)', p.id, 522, 2, 'Sensors, Transducers > LVDT Transducers (Linear Variable Differential Transformer)', 567, NULL
FROM categories p WHERE p.digikey_id = 25;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Magnetic Sensors', p.id, 2068, 2, 'Sensors, Transducers > Magnetic Sensors', 8823, NULL
FROM categories p WHERE p.digikey_id = 25;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Magnets', p.id, 2069, 2, 'Sensors, Transducers > Magnets', 2225, NULL
FROM categories p WHERE p.digikey_id = 25;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Motion Sensors', p.id, 2070, 2, 'Sensors, Transducers > Motion Sensors', 4745, NULL
FROM categories p WHERE p.digikey_id = 25;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Multifunction', p.id, 551, 2, 'Sensors, Transducers > Multifunction', 613, NULL
FROM categories p WHERE p.digikey_id = 25;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Optical Sensors', p.id, 2071, 2, 'Sensors, Transducers > Optical Sensors', 13048, NULL
FROM categories p WHERE p.digikey_id = 25;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Particle, Dust Sensors', p.id, 509, 2, 'Sensors, Transducers > Particle, Dust Sensors', 58, NULL
FROM categories p WHERE p.digikey_id = 25;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Position Sensors', p.id, 2072, 2, 'Sensors, Transducers > Position Sensors', 18490, NULL
FROM categories p WHERE p.digikey_id = 25;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Pressure Sensors, Transducers', p.id, 512, 2, 'Sensors, Transducers > Pressure Sensors, Transducers', 31438, NULL
FROM categories p WHERE p.digikey_id = 25;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Proximity Sensors', p.id, 524, 2, 'Sensors, Transducers > Proximity Sensors', 5278, NULL
FROM categories p WHERE p.digikey_id = 25;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Proximity/Occupancy Sensors Finished Units', p.id, 563, 2, 'Sensors, Transducers > Proximity/Occupancy Sensors Finished Units', 634, NULL
FROM categories p WHERE p.digikey_id = 25;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Sensor Cable Accessories', p.id, 949, 2, 'Sensors, Transducers > Sensor Cable Accessories', 1369, NULL
FROM categories p WHERE p.digikey_id = 25;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Sensor Cable Assemblies', p.id, 950, 2, 'Sensors, Transducers > Sensor Cable Assemblies', 2837, NULL
FROM categories p WHERE p.digikey_id = 25;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Sensor Interface Junction Blocks', p.id, 951, 2, 'Sensors, Transducers > Sensor Interface Junction Blocks', 3377, NULL
FROM categories p WHERE p.digikey_id = 25;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Sensor, Transducer Accessories', p.id, 510, 2, 'Sensors, Transducers > Sensor, Transducer Accessories', 12913, NULL
FROM categories p WHERE p.digikey_id = 25;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Sensor, Transducer Amplifiers', p.id, 557, 2, 'Sensors, Transducers > Sensor, Transducer Amplifiers', 1135, NULL
FROM categories p WHERE p.digikey_id = 25;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Shock Sensors', p.id, 528, 2, 'Sensors, Transducers > Shock Sensors', 72, NULL
FROM categories p WHERE p.digikey_id = 25;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Solar Cells', p.id, 514, 2, 'Sensors, Transducers > Solar Cells', 545, NULL
FROM categories p WHERE p.digikey_id = 25;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Specialized Sensors', p.id, 561, 2, 'Sensors, Transducers > Specialized Sensors', 2751, NULL
FROM categories p WHERE p.digikey_id = 25;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Strain Gauges', p.id, 559, 2, 'Sensors, Transducers > Strain Gauges', 1099, NULL
FROM categories p WHERE p.digikey_id = 25;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Temperature Sensors', p.id, 2075, 2, 'Sensors, Transducers > Temperature Sensors', 25800, NULL
FROM categories p WHERE p.digikey_id = 25;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Touch Sensors', p.id, 971, 2, 'Sensors, Transducers > Touch Sensors', 106, NULL
FROM categories p WHERE p.digikey_id = 25;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Ultrasonic Receivers, Transmitters', p.id, 527, 2, 'Sensors, Transducers > Ultrasonic Receivers, Transmitters', 2043, NULL
FROM categories p WHERE p.digikey_id = 25;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Desoldering Braid, Wick, Pumps', p.id, 265, 2, 'Soldering, Desoldering, Rework Products > Desoldering Braid, Wick, Pumps', 447, NULL
FROM categories p WHERE p.digikey_id = 18;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Flux, Flux Remover', p.id, 266, 2, 'Soldering, Desoldering, Rework Products > Flux, Flux Remover', 462, NULL
FROM categories p WHERE p.digikey_id = 18;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Fume, Smoke Extraction', p.id, 269, 2, 'Soldering, Desoldering, Rework Products > Fume, Smoke Extraction', 151, NULL
FROM categories p WHERE p.digikey_id = 18;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Holders, Stands', p.id, 267, 2, 'Soldering, Desoldering, Rework Products > Holders, Stands', 161, NULL
FROM categories p WHERE p.digikey_id = 18;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Solder', p.id, 262, 2, 'Soldering, Desoldering, Rework Products > Solder', 1771, NULL
FROM categories p WHERE p.digikey_id = 18;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Solder Sponges, Tip Cleaners', p.id, 263, 2, 'Soldering, Desoldering, Rework Products > Solder Sponges, Tip Cleaners', 145, NULL
FROM categories p WHERE p.digikey_id = 18;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Solder Stencils, Templates', p.id, 272, 2, 'Soldering, Desoldering, Rework Products > Solder Stencils, Templates', 646, NULL
FROM categories p WHERE p.digikey_id = 18;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Soldering Irons, Tweezers, Handles', p.id, 268, 2, 'Soldering, Desoldering, Rework Products > Soldering Irons, Tweezers, Handles', 471, NULL
FROM categories p WHERE p.digikey_id = 18;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Soldering, Desoldering, Rework Accessories', p.id, 261, 2, 'Soldering, Desoldering, Rework Products > Soldering, Desoldering, Rework Accessories', 3934, NULL
FROM categories p WHERE p.digikey_id = 18;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Soldering, Desoldering, Rework Stations', p.id, 264, 2, 'Soldering, Desoldering, Rework Products > Soldering, Desoldering, Rework Stations', 469, NULL
FROM categories p WHERE p.digikey_id = 18;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Soldering, Desoldering, Rework Tips, Nozzles', p.id, 270, 2, 'Soldering, Desoldering, Rework Products > Soldering, Desoldering, Rework Tips, Nozzles', 5128, NULL
FROM categories p WHERE p.digikey_id = 18;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Accessories', p.id, 192, 2, 'Switches > Accessories', 15453, NULL
FROM categories p WHERE p.digikey_id = 15;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Accessories - Boots, Seals', p.id, 215, 2, 'Switches > Accessories - Boots, Seals', 716, NULL
FROM categories p WHERE p.digikey_id = 15;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Accessories - Caps', p.id, 210, 2, 'Switches > Accessories - Caps', 5462, NULL
FROM categories p WHERE p.digikey_id = 15;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Configurable Switch Components', p.id, 2076, 2, 'Switches > Configurable Switch Components', 24794, NULL
FROM categories p WHERE p.digikey_id = 15;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'DIP Switches', p.id, 194, 2, 'Switches > DIP Switches', 8547, NULL
FROM categories p WHERE p.digikey_id = 15;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Disconnect Switch Components', p.id, 153, 2, 'Switches > Disconnect Switch Components', 3545, NULL
FROM categories p WHERE p.digikey_id = 15;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Keylock Switches', p.id, 196, 2, 'Switches > Keylock Switches', 19127, NULL
FROM categories p WHERE p.digikey_id = 15;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Keypad Switches', p.id, 202, 2, 'Switches > Keypad Switches', 501, NULL
FROM categories p WHERE p.digikey_id = 15;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Limit Switches', p.id, 198, 2, 'Switches > Limit Switches', 25307, NULL
FROM categories p WHERE p.digikey_id = 15;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Magnetic, Reed Switches', p.id, 193, 2, 'Switches > Magnetic, Reed Switches', 1013, NULL
FROM categories p WHERE p.digikey_id = 15;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Navigation Switches, Joystick', p.id, 204, 2, 'Switches > Navigation Switches, Joystick', 2200, NULL
FROM categories p WHERE p.digikey_id = 15;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Programmable Display Switches', p.id, 212, 2, 'Switches > Programmable Display Switches', 39, NULL
FROM categories p WHERE p.digikey_id = 15;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Pushbutton Switches', p.id, 199, 2, 'Switches > Pushbutton Switches', 88604, NULL
FROM categories p WHERE p.digikey_id = 15;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Pushbutton Switches - Hall Effect', p.id, 211, 2, 'Switches > Pushbutton Switches - Hall Effect', 89, NULL
FROM categories p WHERE p.digikey_id = 15;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Rocker Switches', p.id, 195, 2, 'Switches > Rocker Switches', 26011, NULL
FROM categories p WHERE p.digikey_id = 15;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Rotary Switches', p.id, 200, 2, 'Switches > Rotary Switches', 8520, NULL
FROM categories p WHERE p.digikey_id = 15;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Selector Switches', p.id, 203, 2, 'Switches > Selector Switches', 24056, NULL
FROM categories p WHERE p.digikey_id = 15;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Slide Switches', p.id, 213, 2, 'Switches > Slide Switches', 3720, NULL
FROM categories p WHERE p.digikey_id = 15;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Tactile Switches', p.id, 197, 2, 'Switches > Tactile Switches', 14054, NULL
FROM categories p WHERE p.digikey_id = 15;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Thumbwheel Switches', p.id, 214, 2, 'Switches > Thumbwheel Switches', 693, NULL
FROM categories p WHERE p.digikey_id = 15;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Toggle Switches', p.id, 201, 2, 'Switches > Toggle Switches', 22258, NULL
FROM categories p WHERE p.digikey_id = 15;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT '2D Materials', p.id, 961, 2, 'Tapes, Adhesives, Materials > 2D Materials', 85, NULL
FROM categories p WHERE p.digikey_id = 40;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Accessories', p.id, 907, 2, 'Tapes, Adhesives, Materials > Accessories', 136, NULL
FROM categories p WHERE p.digikey_id = 40;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Films', p.id, 965, 2, 'Tapes, Adhesives, Materials > Films', 564, NULL
FROM categories p WHERE p.digikey_id = 40;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Glue, Adhesives, Applicators', p.id, 909, 2, 'Tapes, Adhesives, Materials > Glue, Adhesives, Applicators', 4243, NULL
FROM categories p WHERE p.digikey_id = 40;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Raw Materials - Composites', p.id, 2107, 2, 'Tapes, Adhesives, Materials > Raw Materials - Composites', 617, NULL
FROM categories p WHERE p.digikey_id = 40;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Raw Materials - Felt', p.id, 2106, 2, 'Tapes, Adhesives, Materials > Raw Materials - Felt', 38, NULL
FROM categories p WHERE p.digikey_id = 40;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Raw Materials - Foam', p.id, 2105, 2, 'Tapes, Adhesives, Materials > Raw Materials - Foam', 1638, NULL
FROM categories p WHERE p.digikey_id = 40;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Raw Materials - Graphite', p.id, 2108, 2, 'Tapes, Adhesives, Materials > Raw Materials - Graphite', 38, NULL
FROM categories p WHERE p.digikey_id = 40;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Raw Materials - Plastics', p.id, 2110, 2, 'Tapes, Adhesives, Materials > Raw Materials - Plastics', 5915, NULL
FROM categories p WHERE p.digikey_id = 40;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Raw Materials - Rubber', p.id, 2109, 2, 'Tapes, Adhesives, Materials > Raw Materials - Rubber', 4163, NULL
FROM categories p WHERE p.digikey_id = 40;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Tape', p.id, 908, 2, 'Tapes, Adhesives, Materials > Tape', 28828, NULL
FROM categories p WHERE p.digikey_id = 40;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Tape Dispensers', p.id, 910, 2, 'Tapes, Adhesives, Materials > Tape Dispensers', 127, NULL
FROM categories p WHERE p.digikey_id = 40;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Data Acquisition (DAQ)', p.id, 1017, 2, 'Test and Measurement > Data Acquisition (DAQ)', 2019, NULL
FROM categories p WHERE p.digikey_id = 29;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'GPIB & Communications', p.id, 1018, 2, 'Test and Measurement > GPIB & Communications', 130, NULL
FROM categories p WHERE p.digikey_id = 29;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Test and Measurement Accessories', p.id, 613, 2, 'Test and Measurement > Test and Measurement Accessories', 8215, NULL
FROM categories p WHERE p.digikey_id = 29;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Test Equipment', p.id, 2078, 2, 'Test and Measurement > Test Equipment', 14225, NULL
FROM categories p WHERE p.digikey_id = 29;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Test Leads', p.id, 2079, 2, 'Test and Measurement > Test Leads', 13193, NULL
FROM categories p WHERE p.digikey_id = 29;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Test Points', p.id, 616, 2, 'Test and Measurement > Test Points', 394, NULL
FROM categories p WHERE p.digikey_id = 29;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Test Probe Tips', p.id, 622, 2, 'Test and Measurement > Test Probe Tips', 669, NULL
FROM categories p WHERE p.digikey_id = 29;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Thermometers', p.id, 617, 2, 'Test and Measurement > Thermometers', 683, NULL
FROM categories p WHERE p.digikey_id = 29;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Abrasives and Surface Conditioning Products', p.id, 948, 2, 'Tools > Abrasives and Surface Conditioning Products', 18092, NULL
FROM categories p WHERE p.digikey_id = 17;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Accessories', p.id, 227, 2, 'Tools > Accessories', 16424, NULL
FROM categories p WHERE p.digikey_id = 17;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Assorted Tool Kits', p.id, 245, 2, 'Tools > Assorted Tool Kits', 1373, NULL
FROM categories p WHERE p.digikey_id = 17;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Brushes', p.id, 1023, 2, 'Tools > Brushes', 17, NULL
FROM categories p WHERE p.digikey_id = 17;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Chemicals, Cleaners', p.id, 260, 2, 'Tools > Chemicals, Cleaners', 693, NULL
FROM categories p WHERE p.digikey_id = 17;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Crimpers, Applicators, Presses', p.id, 2111, 2, 'Tools > Crimpers, Applicators, Presses', 84381, NULL
FROM categories p WHERE p.digikey_id = 17;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Dispensing Equipment', p.id, 2080, 2, 'Tools > Dispensing Equipment', 2540, NULL
FROM categories p WHERE p.digikey_id = 17;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Excavators, Hooks, Picks, Probes, Tuning Tools', p.id, 241, 2, 'Tools > Excavators, Hooks, Picks, Probes, Tuning Tools', 207, NULL
FROM categories p WHERE p.digikey_id = 17;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Fiber Optics and Accessories', p.id, 256, 2, 'Tools > Fiber Optics and Accessories', 707, NULL
FROM categories p WHERE p.digikey_id = 17;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Flashlights', p.id, 237, 2, 'Tools > Flashlights', 296, NULL
FROM categories p WHERE p.digikey_id = 17;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Hammers', p.id, 246, 2, 'Tools > Hammers', 653, NULL
FROM categories p WHERE p.digikey_id = 17;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Heat Guns, Torches, Accessories', p.id, 255, 2, 'Tools > Heat Guns, Torches, Accessories', 1286, NULL
FROM categories p WHERE p.digikey_id = 17;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Hex, Torx Keys', p.id, 257, 2, 'Tools > Hex, Torx Keys', 1230, NULL
FROM categories p WHERE p.digikey_id = 17;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Insertion, Extraction', p.id, 229, 2, 'Tools > Insertion, Extraction', 3857, NULL
FROM categories p WHERE p.digikey_id = 17;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Knives, Scissors, Cutting Tools', p.id, 242, 2, 'Tools > Knives, Scissors, Cutting Tools', 1750, NULL
FROM categories p WHERE p.digikey_id = 17;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Paint Supplies', p.id, 1111, 2, 'Tools > Paint Supplies', 78, NULL
FROM categories p WHERE p.digikey_id = 17;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Pliers', p.id, 243, 2, 'Tools > Pliers', 2563, NULL
FROM categories p WHERE p.digikey_id = 17;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Pressure Washers', p.id, 1112, 2, 'Tools > Pressure Washers', 6, NULL
FROM categories p WHERE p.digikey_id = 17;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Punchdown, Blades', p.id, 244, 2, 'Tools > Punchdown, Blades', 176, NULL
FROM categories p WHERE p.digikey_id = 17;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Punches', p.id, 248, 2, 'Tools > Punches', 371, NULL
FROM categories p WHERE p.digikey_id = 17;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Screwdrivers, Nut Drivers and Sets', p.id, 2081, 2, 'Tools > Screwdrivers, Nut Drivers and Sets', 9709, NULL
FROM categories p WHERE p.digikey_id = 17;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Socket and Socket Handles', p.id, 2082, 2, 'Tools > Socket and Socket Handles', 8228, NULL
FROM categories p WHERE p.digikey_id = 17;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Specialized Tools', p.id, 233, 2, 'Tools > Specialized Tools', 21658, NULL
FROM categories p WHERE p.digikey_id = 17;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Spiral Wrap, Expandable Sleeving', p.id, 238, 2, 'Tools > Spiral Wrap, Expandable Sleeving', 57, NULL
FROM categories p WHERE p.digikey_id = 17;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Staking Tools', p.id, 252, 2, 'Tools > Staking Tools', 66, NULL
FROM categories p WHERE p.digikey_id = 17;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Tool Bags, Boxes and Cabinets', p.id, 1113, 2, 'Tools > Tool Bags, Boxes and Cabinets', 419, NULL
FROM categories p WHERE p.digikey_id = 17;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Tweezers', p.id, 240, 2, 'Tools > Tweezers', 2448, NULL
FROM categories p WHERE p.digikey_id = 17;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Vacuums', p.id, 235, 2, 'Tools > Vacuums', 134, NULL
FROM categories p WHERE p.digikey_id = 17;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Vises', p.id, 253, 2, 'Tools > Vises', 111, NULL
FROM categories p WHERE p.digikey_id = 17;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Wire Cutters', p.id, 234, 2, 'Tools > Wire Cutters', 2227, NULL
FROM categories p WHERE p.digikey_id = 17;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Wire Strippers and Accessories', p.id, 230, 2, 'Tools > Wire Strippers and Accessories', 1590, NULL
FROM categories p WHERE p.digikey_id = 17;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Wire Tie Guns and Accessories', p.id, 254, 2, 'Tools > Wire Tie Guns and Accessories', 237, NULL
FROM categories p WHERE p.digikey_id = 17;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Wire Wrap', p.id, 231, 2, 'Tools > Wire Wrap', 62, NULL
FROM categories p WHERE p.digikey_id = 17;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Workbenches, Stations and Accessories', p.id, 2083, 2, 'Tools > Workbenches, Stations and Accessories', 1001, NULL
FROM categories p WHERE p.digikey_id = 17;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Wrenches', p.id, 258, 2, 'Tools > Wrenches', 5425, NULL
FROM categories p WHERE p.digikey_id = 17;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Accessories', p.id, 161, 2, 'Transformers > Accessories', 211, NULL
FROM categories p WHERE p.digikey_id = 11;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Audio Transformers', p.id, 162, 2, 'Transformers > Audio Transformers', 1005, NULL
FROM categories p WHERE p.digikey_id = 11;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Current Sense Transformers', p.id, 163, 2, 'Transformers > Current Sense Transformers', 2992, NULL
FROM categories p WHERE p.digikey_id = 11;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Isolation Transformers and Autotransformers, Step Up, Step Down', p.id, 167, 2, 'Transformers > Isolation Transformers and Autotransformers, Step Up, Step Down', 610, NULL
FROM categories p WHERE p.digikey_id = 11;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Power Transformers', p.id, 164, 2, 'Transformers > Power Transformers', 7352, NULL
FROM categories p WHERE p.digikey_id = 11;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Pulse Transformers', p.id, 166, 2, 'Transformers > Pulse Transformers', 5278, NULL
FROM categories p WHERE p.digikey_id = 11;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Specialty Transformers', p.id, 165, 2, 'Transformers > Specialty Transformers', 272, NULL
FROM categories p WHERE p.digikey_id = 11;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Switching Converter, SMPS Transformers', p.id, 168, 2, 'Transformers > Switching Converter, SMPS Transformers', 2038, NULL
FROM categories p WHERE p.digikey_id = 11;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Unclassified', p.id, 48, 2, 'Uncategorized > Unclassified', 222339, NULL
FROM categories p WHERE p.digikey_id = 1;


-- Level 3 Categories (483 categories)

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Barrel Audio Cables', p.id, 463, 3, 'Cable Assemblies > Barrel Connector Cables > Barrel Audio Cables', 1217, NULL
FROM categories p WHERE p.digikey_id = 2038;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Barrel Power Cables', p.id, 464, 3, 'Cable Assemblies > Barrel Connector Cables > Barrel Power Cables', 910, NULL
FROM categories p WHERE p.digikey_id = 2038;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Wire Duct, Raceway Accessories', p.id, 487, 3, 'Cables, Wires - Management > Wire Ducts, Raceways > Wire Duct, Raceway Accessories', 3281, NULL
FROM categories p WHERE p.digikey_id = 2039;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Wire Duct, Raceway Covers', p.id, 957, 3, 'Cables, Wires - Management > Wire Ducts, Raceways > Wire Duct, Raceway Covers', 786, NULL
FROM categories p WHERE p.digikey_id = 2039;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Wire Ducts, Raceways', p.id, 486, 3, 'Cables, Wires - Management > Wire Ducts, Raceways > Wire Ducts, Raceways', 4279, NULL
FROM categories p WHERE p.digikey_id = 2039;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Mixed Technology', p.id, 149, 3, 'Circuit Protection > Transient Voltage Suppressors (TVS) > Mixed Technology', 1184, NULL
FROM categories p WHERE p.digikey_id = 2040;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Surge Protection Devices (SPDs)', p.id, 992, 3, 'Circuit Protection > Transient Voltage Suppressors (TVS) > Surge Protection Devices (SPDs)', 11883, NULL
FROM categories p WHERE p.digikey_id = 2040;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Thyristors', p.id, 147, 3, 'Circuit Protection > Transient Voltage Suppressors (TVS) > Thyristors', 2522, NULL
FROM categories p WHERE p.digikey_id = 2040;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'TVS Diodes', p.id, 144, 3, 'Circuit Protection > Transient Voltage Suppressors (TVS) > TVS Diodes', 100060, NULL
FROM categories p WHERE p.digikey_id = 2040;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Plugs and Receptacles', p.id, 1170, 3, 'Connectors, Interconnects > AC Power Connectors > Plugs and Receptacles', 5150, NULL
FROM categories p WHERE p.digikey_id = 2026;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Power Entry Connector Accessories', p.id, 341, 3, 'Connectors, Interconnects > AC Power Connectors > Power Entry Connector Accessories', 1125, NULL
FROM categories p WHERE p.digikey_id = 2026;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Power Entry Modules (PEM)', p.id, 301, 3, 'Connectors, Interconnects > AC Power Connectors > Power Entry Modules (PEM)', 8179, NULL
FROM categories p WHERE p.digikey_id = 2026;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'ARINC', p.id, 386, 3, 'Connectors, Interconnects > Backplane Connectors > ARINC', 912, NULL
FROM categories p WHERE p.digikey_id = 2000;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'ARINC Inserts', p.id, 430, 3, 'Connectors, Interconnects > Backplane Connectors > ARINC Inserts', 2259, NULL
FROM categories p WHERE p.digikey_id = 2000;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Backplane Connector Accessories', p.id, 343, 3, 'Connectors, Interconnects > Backplane Connectors > Backplane Connector Accessories', 2409, NULL
FROM categories p WHERE p.digikey_id = 2000;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Backplane Connector Contacts', p.id, 335, 3, 'Connectors, Interconnects > Backplane Connectors > Backplane Connector Contacts', 2535, NULL
FROM categories p WHERE p.digikey_id = 2000;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Backplane Connector Housings', p.id, 372, 3, 'Connectors, Interconnects > Backplane Connectors > Backplane Connector Housings', 9359, NULL
FROM categories p WHERE p.digikey_id = 2000;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'DIN 41612', p.id, 307, 3, 'Connectors, Interconnects > Backplane Connectors > DIN 41612', 5129, NULL
FROM categories p WHERE p.digikey_id = 2000;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Hard Metric, Standard', p.id, 406, 3, 'Connectors, Interconnects > Backplane Connectors > Hard Metric, Standard', 4471, NULL
FROM categories p WHERE p.digikey_id = 2000;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Specialized', p.id, 407, 3, 'Connectors, Interconnects > Backplane Connectors > Specialized', 35298, NULL
FROM categories p WHERE p.digikey_id = 2000;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Banana and Tip Connector Accessories', p.id, 351, 3, 'Connectors, Interconnects > Banana and Tip Connectors > Banana and Tip Connector Accessories', 61, NULL
FROM categories p WHERE p.digikey_id = 2001;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Banana and Tip Connector Adapters', p.id, 381, 3, 'Connectors, Interconnects > Banana and Tip Connectors > Banana and Tip Connector Adapters', 75, NULL
FROM categories p WHERE p.digikey_id = 2001;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Binding Posts', p.id, 310, 3, 'Connectors, Interconnects > Banana and Tip Connectors > Binding Posts', 256, NULL
FROM categories p WHERE p.digikey_id = 2001;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Jacks, Plugs', p.id, 302, 3, 'Connectors, Interconnects > Banana and Tip Connectors > Jacks, Plugs', 1760, NULL
FROM categories p WHERE p.digikey_id = 2001;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Audio Connectors', p.id, 434, 3, 'Connectors, Interconnects > Barrel Connectors > Audio Connectors', 2560, NULL
FROM categories p WHERE p.digikey_id = 2002;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Barrel Connector Accessories', p.id, 348, 3, 'Connectors, Interconnects > Barrel Connectors > Barrel Connector Accessories', 108, NULL
FROM categories p WHERE p.digikey_id = 2002;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Barrel Connector Adapters', p.id, 376, 3, 'Connectors, Interconnects > Barrel Connectors > Barrel Connector Adapters', 218, NULL
FROM categories p WHERE p.digikey_id = 2002;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Power Connectors', p.id, 435, 3, 'Connectors, Interconnects > Barrel Connectors > Power Connectors', 1127, NULL
FROM categories p WHERE p.digikey_id = 2002;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Blade Type Power Connector Accessories', p.id, 360, 3, 'Connectors, Interconnects > Blade Type Power Connectors > Blade Type Power Connector Accessories', 470, NULL
FROM categories p WHERE p.digikey_id = 2003;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Blade Type Power Connector Assemblies', p.id, 357, 3, 'Connectors, Interconnects > Blade Type Power Connectors > Blade Type Power Connector Assemblies', 2124, NULL
FROM categories p WHERE p.digikey_id = 2003;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Blade Type Power Connector Contacts', p.id, 420, 3, 'Connectors, Interconnects > Blade Type Power Connectors > Blade Type Power Connector Contacts', 370, NULL
FROM categories p WHERE p.digikey_id = 2003;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Blade Type Power Connector Housings', p.id, 419, 3, 'Connectors, Interconnects > Blade Type Power Connectors > Blade Type Power Connector Housings', 745, NULL
FROM categories p WHERE p.digikey_id = 2003;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Card Edge Connector Accessories', p.id, 349, 3, 'Connectors, Interconnects > Card Edge Connectors > Card Edge Connector Accessories', 180, NULL
FROM categories p WHERE p.digikey_id = 2004;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Card Edge Connector Adapters', p.id, 429, 3, 'Connectors, Interconnects > Card Edge Connectors > Card Edge Connector Adapters', 70, NULL
FROM categories p WHERE p.digikey_id = 2004;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Card Edge Connector Contacts', p.id, 345, 3, 'Connectors, Interconnects > Card Edge Connectors > Card Edge Connector Contacts', 160, NULL
FROM categories p WHERE p.digikey_id = 2004;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Card Edge Connector Housings', p.id, 354, 3, 'Connectors, Interconnects > Card Edge Connectors > Card Edge Connector Housings', 249, NULL
FROM categories p WHERE p.digikey_id = 2004;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Edgeboard Connectors', p.id, 303, 3, 'Connectors, Interconnects > Card Edge Connectors > Edgeboard Connectors', 619542, NULL
FROM categories p WHERE p.digikey_id = 2004;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Backshells and Cable Clamps', p.id, 313, 3, 'Connectors, Interconnects > Circular Connectors > Backshells and Cable Clamps', 64024, NULL
FROM categories p WHERE p.digikey_id = 2005;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Circular Connector Accessories', p.id, 329, 3, 'Connectors, Interconnects > Circular Connectors > Circular Connector Accessories', 68553, NULL
FROM categories p WHERE p.digikey_id = 2005;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Circular Connector Adapters', p.id, 378, 3, 'Connectors, Interconnects > Circular Connectors > Circular Connector Adapters', 47623, NULL
FROM categories p WHERE p.digikey_id = 2005;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Circular Connector Assemblies', p.id, 436, 3, 'Connectors, Interconnects > Circular Connectors > Circular Connector Assemblies', 2232196, NULL
FROM categories p WHERE p.digikey_id = 2005;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Circular Connector Contacts', p.id, 330, 3, 'Connectors, Interconnects > Circular Connectors > Circular Connector Contacts', 6694, NULL
FROM categories p WHERE p.digikey_id = 2005;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Circular Connector Housings', p.id, 320, 3, 'Connectors, Interconnects > Circular Connectors > Circular Connector Housings', 572878, NULL
FROM categories p WHERE p.digikey_id = 2005;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Coaxial Connector (RF) Accessories', p.id, 342, 3, 'Connectors, Interconnects > Coaxial Connectors (RF) > Coaxial Connector (RF) Accessories', 2472, NULL
FROM categories p WHERE p.digikey_id = 2007;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Coaxial Connector (RF) Adapters', p.id, 374, 3, 'Connectors, Interconnects > Coaxial Connectors (RF) > Coaxial Connector (RF) Adapters', 9121, NULL
FROM categories p WHERE p.digikey_id = 2007;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Coaxial Connector (RF) Assemblies', p.id, 437, 3, 'Connectors, Interconnects > Coaxial Connectors (RF) > Coaxial Connector (RF) Assemblies', 30056, NULL
FROM categories p WHERE p.digikey_id = 2007;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Coaxial Connector (RF) Contacts', p.id, 388, 3, 'Connectors, Interconnects > Coaxial Connectors (RF) > Coaxial Connector (RF) Contacts', 353, NULL
FROM categories p WHERE p.digikey_id = 2007;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Coaxial Connector (RF) Terminators', p.id, 382, 3, 'Connectors, Interconnects > Coaxial Connectors (RF) > Coaxial Connector (RF) Terminators', 1751, NULL
FROM categories p WHERE p.digikey_id = 2007;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Contacts, Spring Loaded (Pogo Pins), and Pressure', p.id, 311, 3, 'Connectors, Interconnects > Contacts > Contacts, Spring Loaded (Pogo Pins), and Pressure', 725, NULL
FROM categories p WHERE p.digikey_id = 2008;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Leadframe', p.id, 416, 3, 'Connectors, Interconnects > Contacts > Leadframe', 59, NULL
FROM categories p WHERE p.digikey_id = 2008;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Multi Purpose', p.id, 336, 3, 'Connectors, Interconnects > Contacts > Multi Purpose', 3484, NULL
FROM categories p WHERE p.digikey_id = 2008;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Centronics Connectors', p.id, 438, 3, 'Connectors, Interconnects > D-Sub, D-Shaped Connectors > Centronics Connectors', 2684, NULL
FROM categories p WHERE p.digikey_id = 2011;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'D-Sub Connector Assemblies', p.id, 439, 3, 'Connectors, Interconnects > D-Sub, D-Shaped Connectors > D-Sub Connector Assemblies', 212759, NULL
FROM categories p WHERE p.digikey_id = 2011;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'D-Sub, D-Shaped Connector Accessories', p.id, 339, 3, 'Connectors, Interconnects > D-Sub, D-Shaped Connectors > D-Sub, D-Shaped Connector Accessories', 3026, NULL
FROM categories p WHERE p.digikey_id = 2011;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'D-Sub, D-Shaped Connector Adapters', p.id, 375, 3, 'Connectors, Interconnects > D-Sub, D-Shaped Connectors > D-Sub, D-Shaped Connector Adapters', 1634, NULL
FROM categories p WHERE p.digikey_id = 2011;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'D-Sub, D-Shaped Connector Backshells, Hoods', p.id, 355, 3, 'Connectors, Interconnects > D-Sub, D-Shaped Connectors > D-Sub, D-Shaped Connector Backshells, Hoods', 7957, NULL
FROM categories p WHERE p.digikey_id = 2011;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'D-Sub, D-Shaped Connector Contacts', p.id, 332, 3, 'Connectors, Interconnects > D-Sub, D-Shaped Connectors > D-Sub, D-Shaped Connector Contacts', 2146, NULL
FROM categories p WHERE p.digikey_id = 2011;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'D-Sub, D-Shaped Connector Housings', p.id, 321, 3, 'Connectors, Interconnects > D-Sub, D-Shaped Connectors > D-Sub, D-Shaped Connector Housings', 25984, NULL
FROM categories p WHERE p.digikey_id = 2011;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'D-Sub, D-Shaped Connector Jackscrews', p.id, 447, 3, 'Connectors, Interconnects > D-Sub, D-Shaped Connectors > D-Sub, D-Shaped Connector Jackscrews', 1714, NULL
FROM categories p WHERE p.digikey_id = 2011;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'D-Sub, D-Shaped Connector Terminators', p.id, 383, 3, 'Connectors, Interconnects > D-Sub, D-Shaped Connectors > D-Sub, D-Shaped Connector Terminators', 31, NULL
FROM categories p WHERE p.digikey_id = 2011;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'FFC, FPC (Flat Flexible) Connector Accessories', p.id, 350, 3, 'Connectors, Interconnects > FFC, FPC (Flat Flexible) Connectors > FFC, FPC (Flat Flexible) Connector Accessories', 58, NULL
FROM categories p WHERE p.digikey_id = 2013;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'FFC, FPC (Flat Flexible) Connector Assemblies', p.id, 399, 3, 'Connectors, Interconnects > FFC, FPC (Flat Flexible) Connectors > FFC, FPC (Flat Flexible) Connector Assemblies', 17050, NULL
FROM categories p WHERE p.digikey_id = 2013;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'FFC, FPC (Flat Flexible) Connector Contacts', p.id, 344, 3, 'Connectors, Interconnects > FFC, FPC (Flat Flexible) Connectors > FFC, FPC (Flat Flexible) Connector Contacts', 121, NULL
FROM categories p WHERE p.digikey_id = 2013;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'FFC, FPC (Flat Flexible) Connector Housings', p.id, 390, 3, 'Connectors, Interconnects > FFC, FPC (Flat Flexible) Connectors > FFC, FPC (Flat Flexible) Connector Housings', 339, NULL
FROM categories p WHERE p.digikey_id = 2013;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Fiber Optic Connector Accessories', p.id, 389, 3, 'Connectors, Interconnects > Fiber Optic Connectors > Fiber Optic Connector Accessories', 647, NULL
FROM categories p WHERE p.digikey_id = 2014;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Fiber Optic Connector Adapters', p.id, 387, 3, 'Connectors, Interconnects > Fiber Optic Connectors > Fiber Optic Connector Adapters', 3202, NULL
FROM categories p WHERE p.digikey_id = 2014;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Fiber Optic Connector Assemblies', p.id, 440, 3, 'Connectors, Interconnects > Fiber Optic Connectors > Fiber Optic Connector Assemblies', 1964, NULL
FROM categories p WHERE p.digikey_id = 2014;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Fiber Optic Connector Housings', p.id, 445, 3, 'Connectors, Interconnects > Fiber Optic Connectors > Fiber Optic Connector Housings', 331, NULL
FROM categories p WHERE p.digikey_id = 2014;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Heavy Duty Connector Accessories', p.id, 358, 3, 'Connectors, Interconnects > Heavy Duty Connectors > Heavy Duty Connector Accessories', 3595, NULL
FROM categories p WHERE p.digikey_id = 2015;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Heavy Duty Connector Assemblies', p.id, 327, 3, 'Connectors, Interconnects > Heavy Duty Connectors > Heavy Duty Connector Assemblies', 620, NULL
FROM categories p WHERE p.digikey_id = 2015;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Heavy Duty Connector Contacts', p.id, 337, 3, 'Connectors, Interconnects > Heavy Duty Connectors > Heavy Duty Connector Contacts', 1859, NULL
FROM categories p WHERE p.digikey_id = 2015;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Heavy Duty Connector Frames', p.id, 362, 3, 'Connectors, Interconnects > Heavy Duty Connectors > Heavy Duty Connector Frames', 520, NULL
FROM categories p WHERE p.digikey_id = 2015;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Heavy Duty Connector Housings, Hoods, Bases', p.id, 363, 3, 'Connectors, Interconnects > Heavy Duty Connectors > Heavy Duty Connector Housings, Hoods, Bases', 13959, NULL
FROM categories p WHERE p.digikey_id = 2015;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Heavy Duty Connector Inserts, Modules', p.id, 361, 3, 'Connectors, Interconnects > Heavy Duty Connectors > Heavy Duty Connector Inserts, Modules', 3971, NULL
FROM categories p WHERE p.digikey_id = 2015;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Keystone Connector Accessories', p.id, 426, 3, 'Connectors, Interconnects > Keystone Connectors > Keystone Connector Accessories', 371, NULL
FROM categories p WHERE p.digikey_id = 2017;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Keystone Faceplates, Frames', p.id, 427, 3, 'Connectors, Interconnects > Keystone Connectors > Keystone Faceplates, Frames', 1504, NULL
FROM categories p WHERE p.digikey_id = 2017;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Keystone Inserts', p.id, 428, 3, 'Connectors, Interconnects > Keystone Connectors > Keystone Inserts', 1782, NULL
FROM categories p WHERE p.digikey_id = 2017;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Inline Module Sockets', p.id, 413, 3, 'Connectors, Interconnects > Memory Connectors > Inline Module Sockets', 2484, NULL
FROM categories p WHERE p.digikey_id = 2021;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Memory Connector Accessories', p.id, 352, 3, 'Connectors, Interconnects > Memory Connectors > Memory Connector Accessories', 140, NULL
FROM categories p WHERE p.digikey_id = 2021;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'PC Card Sockets', p.id, 414, 3, 'Connectors, Interconnects > Memory Connectors > PC Card Sockets', 1957, NULL
FROM categories p WHERE p.digikey_id = 2021;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'PC Cards - Adapters', p.id, 421, 3, 'Connectors, Interconnects > Memory Connectors > PC Cards - Adapters', 19, NULL
FROM categories p WHERE p.digikey_id = 2021;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Modular/Ethernet Connector (RJ45, RJ11) Jacks', p.id, 366, 3, 'Connectors, Interconnects > Modular/Ethernet Connectors > Modular/Ethernet Connector (RJ45, RJ11) Jacks', 10437, NULL
FROM categories p WHERE p.digikey_id = 2022;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Modular/Ethernet Connector (RJ45, RJ11) Plugs', p.id, 367, 3, 'Connectors, Interconnects > Modular/Ethernet Connectors > Modular/Ethernet Connector (RJ45, RJ11) Plugs', 1683, NULL
FROM categories p WHERE p.digikey_id = 2022;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Modular/Ethernet Connector (RJ45) Jacks With Magnetics', p.id, 365, 3, 'Connectors, Interconnects > Modular/Ethernet Connectors > Modular/Ethernet Connector (RJ45) Jacks With Magnetics', 6389, NULL
FROM categories p WHERE p.digikey_id = 2022;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Modular/Ethernet Connector Accessories', p.id, 442, 3, 'Connectors, Interconnects > Modular/Ethernet Connectors > Modular/Ethernet Connector Accessories', 1039, NULL
FROM categories p WHERE p.digikey_id = 2022;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Modular/Ethernet Connector Adapters', p.id, 379, 3, 'Connectors, Interconnects > Modular/Ethernet Connectors > Modular/Ethernet Connector Adapters', 1256, NULL
FROM categories p WHERE p.digikey_id = 2022;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Modular/Ethernet Connector Plug Housings', p.id, 403, 3, 'Connectors, Interconnects > Modular/Ethernet Connectors > Modular/Ethernet Connector Plug Housings', 169, NULL
FROM categories p WHERE p.digikey_id = 2022;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Modular/Ethernet Connector Wiring Blocks', p.id, 418, 3, 'Connectors, Interconnects > Modular/Ethernet Connectors > Modular/Ethernet Connector Wiring Blocks', 69, NULL
FROM categories p WHERE p.digikey_id = 2022;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Modular/Ethernet Connector Wiring Blocks Accessories', p.id, 417, 3, 'Connectors, Interconnects > Modular/Ethernet Connectors > Modular/Ethernet Connector Wiring Blocks Accessories', 30, NULL
FROM categories p WHERE p.digikey_id = 2022;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Photovoltaic (Solar Panel) Connector Accessories', p.id, 424, 3, 'Connectors, Interconnects > Photovoltaic (Solar Panel) Connectors > Photovoltaic (Solar Panel) Connector Accessories', 90, NULL
FROM categories p WHERE p.digikey_id = 2023;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Photovoltaic (Solar Panel) Connector Assemblies', p.id, 326, 3, 'Connectors, Interconnects > Photovoltaic (Solar Panel) Connectors > Photovoltaic (Solar Panel) Connector Assemblies', 417, NULL
FROM categories p WHERE p.digikey_id = 2023;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Photovoltaic (Solar Panel) Connector Contacts', p.id, 423, 3, 'Connectors, Interconnects > Photovoltaic (Solar Panel) Connectors > Photovoltaic (Solar Panel) Connector Contacts', 65, NULL
FROM categories p WHERE p.digikey_id = 2023;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Pluggable Connector Accessories', p.id, 346, 3, 'Connectors, Interconnects > Pluggable Connectors > Pluggable Connector Accessories', 554, NULL
FROM categories p WHERE p.digikey_id = 2024;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Pluggable Connector Assemblies', p.id, 443, 3, 'Connectors, Interconnects > Pluggable Connectors > Pluggable Connector Assemblies', 5828, NULL
FROM categories p WHERE p.digikey_id = 2024;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Arrays, Edge Type, Mezzanine (Board to Board)', p.id, 308, 3, 'Connectors, Interconnects > Rectangular Connectors > Arrays, Edge Type, Mezzanine (Board to Board)', 30276, NULL
FROM categories p WHERE p.digikey_id = 2027;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Board In, Direct Wire to Board', p.id, 317, 3, 'Connectors, Interconnects > Rectangular Connectors > Board In, Direct Wire to Board', 2042, NULL
FROM categories p WHERE p.digikey_id = 2027;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Board Spacers, Stackers (Board to Board)', p.id, 400, 3, 'Connectors, Interconnects > Rectangular Connectors > Board Spacers, Stackers (Board to Board)', 339039, NULL
FROM categories p WHERE p.digikey_id = 2027;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Free Hanging, Panel Mount', p.id, 316, 3, 'Connectors, Interconnects > Rectangular Connectors > Free Hanging, Panel Mount', 22107, NULL
FROM categories p WHERE p.digikey_id = 2027;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Headers, Male Pins', p.id, 314, 3, 'Connectors, Interconnects > Rectangular Connectors > Headers, Male Pins', 342372, NULL
FROM categories p WHERE p.digikey_id = 2027;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Headers, Receptacles, Female Sockets', p.id, 315, 3, 'Connectors, Interconnects > Rectangular Connectors > Headers, Receptacles, Female Sockets', 180577, NULL
FROM categories p WHERE p.digikey_id = 2027;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Headers, Specialty Pin', p.id, 318, 3, 'Connectors, Interconnects > Rectangular Connectors > Headers, Specialty Pin', 8665, NULL
FROM categories p WHERE p.digikey_id = 2027;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Rectangular Connector Accessories', p.id, 340, 3, 'Connectors, Interconnects > Rectangular Connectors > Rectangular Connector Accessories', 7632, NULL
FROM categories p WHERE p.digikey_id = 2027;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Rectangular Connector Adapters', p.id, 380, 3, 'Connectors, Interconnects > Rectangular Connectors > Rectangular Connector Adapters', 407, NULL
FROM categories p WHERE p.digikey_id = 2027;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Rectangular Connector Contacts', p.id, 331, 3, 'Connectors, Interconnects > Rectangular Connectors > Rectangular Connector Contacts', 8355, NULL
FROM categories p WHERE p.digikey_id = 2027;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Rectangular Connector Housings', p.id, 319, 3, 'Connectors, Interconnects > Rectangular Connectors > Rectangular Connector Housings', 34027, NULL
FROM categories p WHERE p.digikey_id = 2027;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Spring Loaded', p.id, 408, 3, 'Connectors, Interconnects > Rectangular Connectors > Spring Loaded', 11156, NULL
FROM categories p WHERE p.digikey_id = 2027;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'IC Sockets', p.id, 409, 3, 'Connectors, Interconnects > Sockets for ICs, Transistors > IC Sockets', 19781, NULL
FROM categories p WHERE p.digikey_id = 2028;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Socket Accessories', p.id, 410, 3, 'Connectors, Interconnects > Sockets for ICs, Transistors > Socket Accessories', 159, NULL
FROM categories p WHERE p.digikey_id = 2028;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Socket Adapters', p.id, 411, 3, 'Connectors, Interconnects > Sockets for ICs, Transistors > Socket Adapters', 265, NULL
FROM categories p WHERE p.digikey_id = 2028;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Solid State Lighting Connector Accessories', p.id, 432, 3, 'Connectors, Interconnects > Solid State Lighting Connectors > Solid State Lighting Connector Accessories', 272, NULL
FROM categories p WHERE p.digikey_id = 2029;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Solid State Lighting Connector Assemblies', p.id, 444, 3, 'Connectors, Interconnects > Solid State Lighting Connectors > Solid State Lighting Connector Assemblies', 1338, NULL
FROM categories p WHERE p.digikey_id = 2029;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Solid State Lighting Connector Contacts', p.id, 446, 3, 'Connectors, Interconnects > Solid State Lighting Connectors > Solid State Lighting Connector Contacts', 235, NULL
FROM categories p WHERE p.digikey_id = 2029;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Barrier Blocks', p.id, 368, 3, 'Connectors, Interconnects > Terminal Blocks > Barrier Blocks', 40639, NULL
FROM categories p WHERE p.digikey_id = 2030;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Din Rail, Channel', p.id, 369, 3, 'Connectors, Interconnects > Terminal Blocks > Din Rail, Channel', 11090, NULL
FROM categories p WHERE p.digikey_id = 2030;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Headers, Plugs and Sockets', p.id, 370, 3, 'Connectors, Interconnects > Terminal Blocks > Headers, Plugs and Sockets', 87339, NULL
FROM categories p WHERE p.digikey_id = 2030;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Interface Modules', p.id, 431, 3, 'Connectors, Interconnects > Terminal Blocks > Interface Modules', 1649, NULL
FROM categories p WHERE p.digikey_id = 2030;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Panel Mount', p.id, 425, 3, 'Connectors, Interconnects > Terminal Blocks > Panel Mount', 1366, NULL
FROM categories p WHERE p.digikey_id = 2030;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Power Distribution', p.id, 412, 3, 'Connectors, Interconnects > Terminal Blocks > Power Distribution', 1603, NULL
FROM categories p WHERE p.digikey_id = 2030;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Specialized', p.id, 433, 3, 'Connectors, Interconnects > Terminal Blocks > Specialized', 3934, NULL
FROM categories p WHERE p.digikey_id = 2030;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Terminal Block Accessories', p.id, 2033, 3, 'Connectors, Interconnects > Terminal Blocks > Terminal Block Accessories', 23083, NULL
FROM categories p WHERE p.digikey_id = 2030;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Terminal Block Adapters', p.id, 322, 3, 'Connectors, Interconnects > Terminal Blocks > Terminal Block Adapters', 646, NULL
FROM categories p WHERE p.digikey_id = 2030;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Terminal Block Contacts', p.id, 338, 3, 'Connectors, Interconnects > Terminal Blocks > Terminal Block Contacts', 71, NULL
FROM categories p WHERE p.digikey_id = 2030;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Wire to Board', p.id, 371, 3, 'Connectors, Interconnects > Terminal Blocks > Wire to Board', 55620, NULL
FROM categories p WHERE p.digikey_id = 2030;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Barrel, Bullet Connectors', p.id, 393, 3, 'Connectors, Interconnects > Terminals > Barrel, Bullet Connectors', 453, NULL
FROM categories p WHERE p.digikey_id = 2031;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Foil Connectors', p.id, 402, 3, 'Connectors, Interconnects > Terminals > Foil Connectors', 33, NULL
FROM categories p WHERE p.digikey_id = 2031;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Housings, Boots', p.id, 325, 3, 'Connectors, Interconnects > Terminals > Housings, Boots', 1720, NULL
FROM categories p WHERE p.digikey_id = 2031;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Knife Connectors', p.id, 404, 3, 'Connectors, Interconnects > Terminals > Knife Connectors', 61, NULL
FROM categories p WHERE p.digikey_id = 2031;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Lugs', p.id, 395, 3, 'Connectors, Interconnects > Terminals > Lugs', 3876, NULL
FROM categories p WHERE p.digikey_id = 2031;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Magnetic Wire Connectors', p.id, 353, 3, 'Connectors, Interconnects > Terminals > Magnetic Wire Connectors', 827, NULL
FROM categories p WHERE p.digikey_id = 2031;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'PC Pin Receptacles, Socket Connectors', p.id, 324, 3, 'Connectors, Interconnects > Terminals > PC Pin Receptacles, Socket Connectors', 5669, NULL
FROM categories p WHERE p.digikey_id = 2031;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'PC Pin, Single Post Connectors', p.id, 323, 3, 'Connectors, Interconnects > Terminals > PC Pin, Single Post Connectors', 3212, NULL
FROM categories p WHERE p.digikey_id = 2031;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Quick Connects, Quick Disconnect Connectors', p.id, 392, 3, 'Connectors, Interconnects > Terminals > Quick Connects, Quick Disconnect Connectors', 5503, NULL
FROM categories p WHERE p.digikey_id = 2031;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Ring Connectors', p.id, 394, 3, 'Connectors, Interconnects > Terminals > Ring Connectors', 7995, NULL
FROM categories p WHERE p.digikey_id = 2031;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Screw Connectors', p.id, 396, 3, 'Connectors, Interconnects > Terminals > Screw Connectors', 780, NULL
FROM categories p WHERE p.digikey_id = 2031;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Solder Lug Connectors', p.id, 401, 3, 'Connectors, Interconnects > Terminals > Solder Lug Connectors', 47, NULL
FROM categories p WHERE p.digikey_id = 2031;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Spade Connectors', p.id, 391, 3, 'Connectors, Interconnects > Terminals > Spade Connectors', 2794, NULL
FROM categories p WHERE p.digikey_id = 2031;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Specialized Connectors', p.id, 356, 3, 'Connectors, Interconnects > Terminals > Specialized Connectors', 3166, NULL
FROM categories p WHERE p.digikey_id = 2031;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Terminal Accessories', p.id, 415, 3, 'Connectors, Interconnects > Terminals > Terminal Accessories', 327, NULL
FROM categories p WHERE p.digikey_id = 2031;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Terminal Adapters', p.id, 405, 3, 'Connectors, Interconnects > Terminals > Terminal Adapters', 84, NULL
FROM categories p WHERE p.digikey_id = 2031;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Turret Connectors', p.id, 328, 3, 'Connectors, Interconnects > Terminals > Turret Connectors', 1132, NULL
FROM categories p WHERE p.digikey_id = 2031;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Wire Pin Connectors', p.id, 397, 3, 'Connectors, Interconnects > Terminals > Wire Pin Connectors', 278, NULL
FROM categories p WHERE p.digikey_id = 2031;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Wire Splice Connectors', p.id, 305, 3, 'Connectors, Interconnects > Terminals > Wire Splice Connectors', 3301, NULL
FROM categories p WHERE p.digikey_id = 2031;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Wire to Board Connectors', p.id, 398, 3, 'Connectors, Interconnects > Terminals > Wire to Board Connectors', 147, NULL
FROM categories p WHERE p.digikey_id = 2031;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'USB, DVI, HDMI Connector Accessories', p.id, 347, 3, 'Connectors, Interconnects > USB, DVI, HDMI Connectors > USB, DVI, HDMI Connector Accessories', 349, NULL
FROM categories p WHERE p.digikey_id = 2032;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'USB, DVI, HDMI Connector Adapters', p.id, 377, 3, 'Connectors, Interconnects > USB, DVI, HDMI Connectors > USB, DVI, HDMI Connector Adapters', 1009, NULL
FROM categories p WHERE p.digikey_id = 2032;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'USB, DVI, HDMI Connector Assemblies', p.id, 312, 3, 'Connectors, Interconnects > USB, DVI, HDMI Connectors > USB, DVI, HDMI Connector Assemblies', 4928, NULL
FROM categories p WHERE p.digikey_id = 2032;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Analog to Digital Converters (ADCs) Evaluation Boards', p.id, 791, 3, 'Development Boards, Kits, Programmers > Evaluation Boards > Analog to Digital Converters (ADCs) Evaluation Boards', 1902, NULL
FROM categories p WHERE p.digikey_id = 2041;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Audio Amplifier Evaluation Boards', p.id, 789, 3, 'Development Boards, Kits, Programmers > Evaluation Boards > Audio Amplifier Evaluation Boards', 749, NULL
FROM categories p WHERE p.digikey_id = 2041;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'DC/DC & AC/DC (Off-Line) SMPS Evaluation Boards', p.id, 792, 3, 'Development Boards, Kits, Programmers > Evaluation Boards > DC/DC & AC/DC (Off-Line) SMPS Evaluation Boards', 7412, NULL
FROM categories p WHERE p.digikey_id = 2041;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Digital to Analog Converters (DACs) Evaluation Boards', p.id, 793, 3, 'Development Boards, Kits, Programmers > Evaluation Boards > Digital to Analog Converters (DACs) Evaluation Boards', 734, NULL
FROM categories p WHERE p.digikey_id = 2041;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Embedded Complex Logic (FPGA, CPLD) Evaluation Boards', p.id, 796, 3, 'Development Boards, Kits, Programmers > Evaluation Boards > Embedded Complex Logic (FPGA, CPLD) Evaluation Boards', 1076, NULL
FROM categories p WHERE p.digikey_id = 2041;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Embedded MCU, DSP Evaluation Boards', p.id, 786, 3, 'Development Boards, Kits, Programmers > Evaluation Boards > Embedded MCU, DSP Evaluation Boards', 5132, NULL
FROM categories p WHERE p.digikey_id = 2041;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Evaluation and Demonstration Boards and Kits', p.id, 787, 3, 'Development Boards, Kits, Programmers > Evaluation Boards > Evaluation and Demonstration Boards and Kits', 15407, NULL
FROM categories p WHERE p.digikey_id = 2041;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Expansion Boards, Daughter Cards', p.id, 797, 3, 'Development Boards, Kits, Programmers > Evaluation Boards > Expansion Boards, Daughter Cards', 7781, NULL
FROM categories p WHERE p.digikey_id = 2041;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'LED Driver Evaluation Boards', p.id, 794, 3, 'Development Boards, Kits, Programmers > Evaluation Boards > LED Driver Evaluation Boards', 1533, NULL
FROM categories p WHERE p.digikey_id = 2041;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Linear Voltage Regulator Evaluation Boards', p.id, 790, 3, 'Development Boards, Kits, Programmers > Evaluation Boards > Linear Voltage Regulator Evaluation Boards', 945, NULL
FROM categories p WHERE p.digikey_id = 2041;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Op Amp Evaluation Boards', p.id, 788, 3, 'Development Boards, Kits, Programmers > Evaluation Boards > Op Amp Evaluation Boards', 1071, NULL
FROM categories p WHERE p.digikey_id = 2041;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'RF, RFID, Wireless Evaluation Boards', p.id, 1165, 3, 'Development Boards, Kits, Programmers > Evaluation Boards > RF, RFID, Wireless Evaluation Boards', 10554, NULL
FROM categories p WHERE p.digikey_id = 2041;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Sensor Evaluation Boards', p.id, 795, 3, 'Development Boards, Kits, Programmers > Evaluation Boards > Sensor Evaluation Boards', 4336, NULL
FROM categories p WHERE p.digikey_id = 2041;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Bridge Rectifiers', p.id, 299, 3, 'Discrete Semiconductor Products > Diodes > Bridge Rectifiers', 7357, NULL
FROM categories p WHERE p.digikey_id = 2042;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Rectifiers', p.id, 2085, 3, 'Discrete Semiconductor Products > Diodes > Rectifiers', 65729, NULL
FROM categories p WHERE p.digikey_id = 2042;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'RF Diodes', p.id, 284, 3, 'Discrete Semiconductor Products > Diodes > RF Diodes', 2307, NULL
FROM categories p WHERE p.digikey_id = 2042;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Variable Capacitance (Varicaps, Varactors)', p.id, 282, 3, 'Discrete Semiconductor Products > Diodes > Variable Capacitance (Varicaps, Varactors)', 957, NULL
FROM categories p WHERE p.digikey_id = 2042;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Zener', p.id, 2086, 3, 'Discrete Semiconductor Products > Diodes > Zener', 70634, NULL
FROM categories p WHERE p.digikey_id = 2042;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'DIACs, SIDACs', p.id, 274, 3, 'Discrete Semiconductor Products > Thyristors > DIACs, SIDACs', 302, NULL
FROM categories p WHERE p.digikey_id = 2043;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'SCRs', p.id, 281, 3, 'Discrete Semiconductor Products > Thyristors > SCRs', 4059, NULL
FROM categories p WHERE p.digikey_id = 2043;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'SCRs - Modules', p.id, 298, 3, 'Discrete Semiconductor Products > Thyristors > SCRs - Modules', 2500, NULL
FROM categories p WHERE p.digikey_id = 2043;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'TRIACs', p.id, 300, 3, 'Discrete Semiconductor Products > Thyristors > TRIACs', 3624, NULL
FROM categories p WHERE p.digikey_id = 2043;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Bipolar (BJT)', p.id, 2087, 3, 'Discrete Semiconductor Products > Transistors > Bipolar (BJT)', 31406, NULL
FROM categories p WHERE p.digikey_id = 2045;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'FETs, MOSFETs', p.id, 2088, 3, 'Discrete Semiconductor Products > Transistors > FETs, MOSFETs', 54967, NULL
FROM categories p WHERE p.digikey_id = 2045;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'IGBTs', p.id, 2089, 3, 'Discrete Semiconductor Products > Transistors > IGBTs', 7467, NULL
FROM categories p WHERE p.digikey_id = 2045;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'JFETs', p.id, 288, 3, 'Discrete Semiconductor Products > Transistors > JFETs', 1109, NULL
FROM categories p WHERE p.digikey_id = 2045;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Programmable Unijunction', p.id, 290, 3, 'Discrete Semiconductor Products > Transistors > Programmable Unijunction', 43, NULL
FROM categories p WHERE p.digikey_id = 2045;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Special Purpose', p.id, 294, 3, 'Discrete Semiconductor Products > Transistors > Special Purpose', 174, NULL
FROM categories p WHERE p.digikey_id = 2045;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'AC Fans', p.id, 216, 3, 'Fans, Blowers, Thermal Management > Fans > AC Fans', 4109, NULL
FROM categories p WHERE p.digikey_id = 2046;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'DC Brushless Fans (BLDC)', p.id, 217, 3, 'Fans, Blowers, Thermal Management > Fans > DC Brushless Fans (BLDC)', 25438, NULL
FROM categories p WHERE p.digikey_id = 2046;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Fan Accessories', p.id, 223, 3, 'Fans, Blowers, Thermal Management > Fans > Fan Accessories', 653, NULL
FROM categories p WHERE p.digikey_id = 2046;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Fan Cords', p.id, 974, 3, 'Fans, Blowers, Thermal Management > Fans > Fan Cords', 297, NULL
FROM categories p WHERE p.digikey_id = 2046;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Finger Guards, Filters & Sleeves', p.id, 221, 3, 'Fans, Blowers, Thermal Management > Fans > Finger Guards, Filters & Sleeves', 1054, NULL
FROM categories p WHERE p.digikey_id = 2046;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Adhesives, Epoxies, Greases, Pastes', p.id, 220, 3, 'Fans, Blowers, Thermal Management > Thermal > Adhesives, Epoxies, Greases, Pastes', 926, NULL
FROM categories p WHERE p.digikey_id = 2047;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Heat Pipes, Vapor Chambers', p.id, 977, 3, 'Fans, Blowers, Thermal Management > Thermal > Heat Pipes, Vapor Chambers', 1349, NULL
FROM categories p WHERE p.digikey_id = 2047;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Heat Sinks', p.id, 219, 3, 'Fans, Blowers, Thermal Management > Thermal > Heat Sinks', 124149, NULL
FROM categories p WHERE p.digikey_id = 2047;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Liquid Cooling, Heating', p.id, 226, 3, 'Fans, Blowers, Thermal Management > Thermal > Liquid Cooling, Heating', 403, NULL
FROM categories p WHERE p.digikey_id = 2047;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Pads, Sheets, Bridges', p.id, 218, 3, 'Fans, Blowers, Thermal Management > Thermal > Pads, Sheets, Bridges', 12590, NULL
FROM categories p WHERE p.digikey_id = 2047;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Thermal Accessories', p.id, 224, 3, 'Fans, Blowers, Thermal Management > Thermal > Thermal Accessories', 988, NULL
FROM categories p WHERE p.digikey_id = 2047;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Thermoelectric, Peltier Assemblies', p.id, 225, 3, 'Fans, Blowers, Thermal Management > Thermal > Thermoelectric, Peltier Assemblies', 236, NULL
FROM categories p WHERE p.digikey_id = 2047;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Thermoelectric, Peltier Modules', p.id, 222, 3, 'Fans, Blowers, Thermal Management > Thermal > Thermoelectric, Peltier Modules', 1591, NULL
FROM categories p WHERE p.digikey_id = 2047;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Compression, Tapered Springs', p.id, 1002, 3, 'Hardware, Fasteners, Accessories > Springs > Compression, Tapered Springs', 11869, NULL
FROM categories p WHERE p.digikey_id = 3004;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Extension, Drawbar Springs', p.id, 1006, 3, 'Hardware, Fasteners, Accessories > Springs > Extension, Drawbar Springs', 2737, NULL
FROM categories p WHERE p.digikey_id = 3004;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Torsion Springs', p.id, 1007, 3, 'Hardware, Fasteners, Accessories > Springs > Torsion Springs', 631, NULL
FROM categories p WHERE p.digikey_id = 3004;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Bushing, Shoulder Washers', p.id, 583, 3, 'Hardware, Fasteners, Accessories > Washers > Bushing, Shoulder Washers', 2457, NULL
FROM categories p WHERE p.digikey_id = 2048;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Standard Washers', p.id, 571, 3, 'Hardware, Fasteners, Accessories > Washers > Standard Washers', 3223, NULL
FROM categories p WHERE p.digikey_id = 2048;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Cable Assemblies', p.id, 823, 3, 'Industrial Automation and Controls > Controllers > Cable Assemblies', 4440, NULL
FROM categories p WHERE p.digikey_id = 2049;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Controller Accessories', p.id, 816, 3, 'Industrial Automation and Controls > Controllers > Controller Accessories', 1985, NULL
FROM categories p WHERE p.digikey_id = 2049;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Liquid, Level', p.id, 806, 3, 'Industrial Automation and Controls > Controllers > Liquid, Level', 557, NULL
FROM categories p WHERE p.digikey_id = 2049;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'PLC Modules', p.id, 821, 3, 'Industrial Automation and Controls > Controllers > PLC Modules', 4327, NULL
FROM categories p WHERE p.digikey_id = 2049;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Process, Temperature', p.id, 801, 3, 'Industrial Automation and Controls > Controllers > Process, Temperature', 4779, NULL
FROM categories p WHERE p.digikey_id = 2049;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Programmable (PLC, PAC)', p.id, 814, 3, 'Industrial Automation and Controls > Controllers > Programmable (PLC, PAC)', 1813, NULL
FROM categories p WHERE p.digikey_id = 2049;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Human Machine Interface (HMI) Accessories', p.id, 947, 3, 'Industrial Automation and Controls > Human Machine Interface (HMI) > Human Machine Interface (HMI) Accessories', 817, NULL
FROM categories p WHERE p.digikey_id = 2050;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Machine Interface', p.id, 946, 3, 'Industrial Automation and Controls > Human Machine Interface (HMI) > Machine Interface', 1575, NULL
FROM categories p WHERE p.digikey_id = 2050;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Pick to Light', p.id, 1063, 3, 'Industrial Automation and Controls > Industrial Lighting > Pick to Light', 355, NULL
FROM categories p WHERE p.digikey_id = 2051;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Task Lighting', p.id, 1061, 3, 'Industrial Automation and Controls > Industrial Lighting > Task Lighting', 3100, NULL
FROM categories p WHERE p.digikey_id = 2051;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Lighting Control', p.id, 819, 3, 'Industrial Automation and Controls > Industrial Lighting Control > Lighting Control', 186, NULL
FROM categories p WHERE p.digikey_id = 2052;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Lighting Control Accessories', p.id, 820, 3, 'Industrial Automation and Controls > Industrial Lighting Control > Lighting Control Accessories', 113, NULL
FROM categories p WHERE p.digikey_id = 2052;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Color Sensors - Industrial', p.id, 1070, 3, 'Industrial Automation and Controls > Industrial Sensors > Color Sensors - Industrial', 71, NULL
FROM categories p WHERE p.digikey_id = 2114;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Encoders - Industrial', p.id, 1075, 3, 'Industrial Automation and Controls > Industrial Sensors > Encoders - Industrial', 12336, NULL
FROM categories p WHERE p.digikey_id = 2114;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Float, Level Sensors - Industrial', p.id, 1068, 3, 'Industrial Automation and Controls > Industrial Sensors > Float, Level Sensors - Industrial', 2594, NULL
FROM categories p WHERE p.digikey_id = 2114;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Flow Sensors - Industrial', p.id, 1067, 3, 'Industrial Automation and Controls > Industrial Sensors > Flow Sensors - Industrial', 1578, NULL
FROM categories p WHERE p.digikey_id = 2114;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Force Sensors, Load Cells - Industrial', p.id, 1066, 3, 'Industrial Automation and Controls > Industrial Sensors > Force Sensors, Load Cells - Industrial', 2148, NULL
FROM categories p WHERE p.digikey_id = 2114;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Photoelectric, Industrial', p.id, 562, 3, 'Industrial Automation and Controls > Industrial Sensors > Photoelectric, Industrial', 19989, NULL
FROM categories p WHERE p.digikey_id = 2114;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Position, Proximity, Speed (Modules) - Industrial', p.id, 1065, 3, 'Industrial Automation and Controls > Industrial Sensors > Position, Proximity, Speed (Modules) - Industrial', 379, NULL
FROM categories p WHERE p.digikey_id = 2114;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Pressure Sensors, Transducers - Industrial', p.id, 1069, 3, 'Industrial Automation and Controls > Industrial Sensors > Pressure Sensors, Transducers - Industrial', 62389, NULL
FROM categories p WHERE p.digikey_id = 2114;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Proximity Sensors - Industrial', p.id, 1074, 3, 'Industrial Automation and Controls > Industrial Sensors > Proximity Sensors - Industrial', 14791, NULL
FROM categories p WHERE p.digikey_id = 2114;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Temperature Sensors - Analog and Digital Output - Industrial', p.id, 1073, 3, 'Industrial Automation and Controls > Industrial Sensors > Temperature Sensors - Analog and Digital Output - Industrial', 595, NULL
FROM categories p WHERE p.digikey_id = 2114;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Thermostats - Mechanical - Industrial', p.id, 1072, 3, 'Industrial Automation and Controls > Industrial Sensors > Thermostats - Mechanical - Industrial', 2175, NULL
FROM categories p WHERE p.digikey_id = 2114;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Ultrasonic Receivers, Transmitters - Industrial', p.id, 1071, 3, 'Industrial Automation and Controls > Industrial Sensors > Ultrasonic Receivers, Transmitters - Industrial', 207, NULL
FROM categories p WHERE p.digikey_id = 2114;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Bar Code Readers', p.id, 1059, 3, 'Industrial Automation and Controls > Machine Vision > Bar Code Readers', 1967, NULL
FROM categories p WHERE p.digikey_id = 2053;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Camera/Sensors', p.id, 828, 3, 'Industrial Automation and Controls > Machine Vision > Camera/Sensors', 1895, NULL
FROM categories p WHERE p.digikey_id = 2053;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Control/Processing', p.id, 827, 3, 'Industrial Automation and Controls > Machine Vision > Control/Processing', 160, NULL
FROM categories p WHERE p.digikey_id = 2053;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Machine Vision Lighting', p.id, 826, 3, 'Industrial Automation and Controls > Machine Vision > Machine Vision Lighting', 1152, NULL
FROM categories p WHERE p.digikey_id = 2053;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Current/Voltage Transducer Monitors', p.id, 807, 3, 'Industrial Automation and Controls > Monitors > Current/Voltage Transducer Monitors', 1065, NULL
FROM categories p WHERE p.digikey_id = 2054;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Relay Output Monitors', p.id, 811, 3, 'Industrial Automation and Controls > Monitors > Relay Output Monitors', 1252, NULL
FROM categories p WHERE p.digikey_id = 2054;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Counters, Hour Meters', p.id, 802, 3, 'Industrial Automation and Controls > Panel Meters > Counters, Hour Meters', 1465, NULL
FROM categories p WHERE p.digikey_id = 2055;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Meters', p.id, 805, 3, 'Industrial Automation and Controls > Panel Meters > Meters', 2626, NULL
FROM categories p WHERE p.digikey_id = 2055;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Panel Meter Accessories', p.id, 818, 3, 'Industrial Automation and Controls > Panel Meters > Panel Meter Accessories', 595, NULL
FROM categories p WHERE p.digikey_id = 2055;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Actuators/Cylinders', p.id, 1054, 3, 'Industrial Automation and Controls > Pneumatics, Hydraulics > Actuators/Cylinders', 9863, NULL
FROM categories p WHERE p.digikey_id = 2056;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Fittings, Couplings, and Distributors', p.id, 1052, 3, 'Industrial Automation and Controls > Pneumatics, Hydraulics > Fittings, Couplings, and Distributors', 9782, NULL
FROM categories p WHERE p.digikey_id = 2056;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Pneumatics Accessories', p.id, 1053, 3, 'Industrial Automation and Controls > Pneumatics, Hydraulics > Pneumatics Accessories', 36932, NULL
FROM categories p WHERE p.digikey_id = 2056;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Preparation/Treatment', p.id, 1051, 3, 'Industrial Automation and Controls > Pneumatics, Hydraulics > Preparation/Treatment', 2905, NULL
FROM categories p WHERE p.digikey_id = 2056;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Shock Absorbers, Dampers', p.id, 1022, 3, 'Industrial Automation and Controls > Pneumatics, Hydraulics > Shock Absorbers, Dampers', 1929, NULL
FROM categories p WHERE p.digikey_id = 2056;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Tubing, Hose, Piping', p.id, 1021, 3, 'Industrial Automation and Controls > Pneumatics, Hydraulics > Tubing, Hose, Piping', 3404, NULL
FROM categories p WHERE p.digikey_id = 2056;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Valves and Control', p.id, 809, 3, 'Industrial Automation and Controls > Pneumatics, Hydraulics > Valves and Control', 13686, NULL
FROM categories p WHERE p.digikey_id = 2056;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'End Effectors', p.id, 994, 3, 'Industrial Automation and Controls > Robotics > End Effectors', 1974, NULL
FROM categories p WHERE p.digikey_id = 2057;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Robotics Accessories', p.id, 995, 3, 'Industrial Automation and Controls > Robotics > Robotics Accessories', 1972, NULL
FROM categories p WHERE p.digikey_id = 2057;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Robots', p.id, 993, 3, 'Industrial Automation and Controls > Robotics > Robots', 105, NULL
FROM categories p WHERE p.digikey_id = 2057;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Air Curtain Doors', p.id, 1099, 3, 'Industrial Supplies > Dock and Warehouse > Air Curtain Doors', 95, NULL
FROM categories p WHERE p.digikey_id = 2092;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Dock Equipment', p.id, 1096, 3, 'Industrial Supplies > Dock and Warehouse > Dock Equipment', 84, NULL
FROM categories p WHERE p.digikey_id = 2092;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Ladders, Steps, and Platforms', p.id, 1078, 3, 'Industrial Supplies > Dock and Warehouse > Ladders, Steps, and Platforms', 25, NULL
FROM categories p WHERE p.digikey_id = 2092;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Mirrors', p.id, 1155, 3, 'Industrial Supplies > Dock and Warehouse > Mirrors', 14, NULL
FROM categories p WHERE p.digikey_id = 2092;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Cords, Wires and Accessories', p.id, 1079, 3, 'Industrial Supplies > Electrical > Cords, Wires and Accessories', 14, NULL
FROM categories p WHERE p.digikey_id = 2093;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Generators', p.id, 1080, 3, 'Industrial Supplies > Electrical > Generators', 24, NULL
FROM categories p WHERE p.digikey_id = 2093;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Lighting', p.id, 1081, 3, 'Industrial Supplies > Electrical > Lighting', 251, NULL
FROM categories p WHERE p.digikey_id = 2093;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Lighting Accessories', p.id, 1082, 3, 'Industrial Supplies > Electrical > Lighting Accessories', 13, NULL
FROM categories p WHERE p.digikey_id = 2093;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Agricultural, Dock and Exhaust', p.id, 1100, 3, 'Industrial Supplies > Fans > Agricultural, Dock and Exhaust', 23, NULL
FROM categories p WHERE p.digikey_id = 2094;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Blowers and Floor Dryers', p.id, 1101, 3, 'Industrial Supplies > Fans > Blowers and Floor Dryers', 32, NULL
FROM categories p WHERE p.digikey_id = 2094;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Components - Motors', p.id, 1102, 3, 'Industrial Supplies > Fans > Components - Motors', 65, NULL
FROM categories p WHERE p.digikey_id = 2094;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Components and Accessories', p.id, 1103, 3, 'Industrial Supplies > Fans > Components and Accessories', 33, NULL
FROM categories p WHERE p.digikey_id = 2094;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Household, Office and Pedestal Fans', p.id, 1104, 3, 'Industrial Supplies > Fans > Household, Office and Pedestal Fans', 98, NULL
FROM categories p WHERE p.digikey_id = 2094;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Air Conditioners', p.id, 1105, 3, 'Industrial Supplies > HVAC > Air Conditioners', 206, NULL
FROM categories p WHERE p.digikey_id = 2095;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Air Filters', p.id, 1106, 3, 'Industrial Supplies > HVAC > Air Filters', 310, NULL
FROM categories p WHERE p.digikey_id = 2095;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Air Purifiers, Dehumidifiers and Humidifiers', p.id, 1108, 3, 'Industrial Supplies > HVAC > Air Purifiers, Dehumidifiers and Humidifiers', 19, NULL
FROM categories p WHERE p.digikey_id = 2095;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Heaters', p.id, 1109, 3, 'Industrial Supplies > HVAC > Heaters', 358, NULL
FROM categories p WHERE p.digikey_id = 2095;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'HVAC Parts and Accessories', p.id, 1124, 3, 'Industrial Supplies > HVAC > HVAC Parts and Accessories', 123, NULL
FROM categories p WHERE p.digikey_id = 2095;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Air Compressor Tools and Accessories', p.id, 1083, 3, 'Industrial Supplies > Maintenance > Air Compressor Tools and Accessories', 378, NULL
FROM categories p WHERE p.digikey_id = 2096;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Air Compressors', p.id, 1084, 3, 'Industrial Supplies > Maintenance > Air Compressors', 2, NULL
FROM categories p WHERE p.digikey_id = 2096;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Magnets', p.id, 1085, 3, 'Industrial Supplies > Maintenance > Magnets', 5, NULL
FROM categories p WHERE p.digikey_id = 2096;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Mats', p.id, 1086, 3, 'Industrial Supplies > Maintenance > Mats', 116, NULL
FROM categories p WHERE p.digikey_id = 2096;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'File Cabinets, Bookcases', p.id, 1126, 3, 'Industrial Supplies > Office Equipment > File Cabinets, Bookcases', 78, NULL
FROM categories p WHERE p.digikey_id = 2097;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Food Storage and Preparation', p.id, 1127, 3, 'Industrial Supplies > Office Equipment > Food Storage and Preparation', 46, NULL
FROM categories p WHERE p.digikey_id = 2097;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Office Supplies', p.id, 1128, 3, 'Industrial Supplies > Office Equipment > Office Supplies', 488, NULL
FROM categories p WHERE p.digikey_id = 2097;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Water Fountains and Refilling Stations', p.id, 1129, 3, 'Industrial Supplies > Office Equipment > Water Fountains and Refilling Stations', 101, NULL
FROM categories p WHERE p.digikey_id = 2097;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Partitions and Accessories', p.id, 1131, 3, 'Industrial Supplies > Office Furniture > Partitions and Accessories', 488, NULL
FROM categories p WHERE p.digikey_id = 2098;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Safes, Secure Storage', p.id, 1132, 3, 'Industrial Supplies > Office Furniture > Safes, Secure Storage', 52, NULL
FROM categories p WHERE p.digikey_id = 2098;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Tables', p.id, 1133, 3, 'Industrial Supplies > Office Furniture > Tables', 30, NULL
FROM categories p WHERE p.digikey_id = 2098;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Bikes, Racks and Locks', p.id, 1134, 3, 'Industrial Supplies > Outdoor Products > Bikes, Racks and Locks', 45, NULL
FROM categories p WHERE p.digikey_id = 2099;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Canopies, Shelters and Sheds', p.id, 1135, 3, 'Industrial Supplies > Outdoor Products > Canopies, Shelters and Sheds', 13, NULL
FROM categories p WHERE p.digikey_id = 2099;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Cans, Trash Cans and Covers', p.id, 1144, 3, 'Industrial Supplies > Outdoor Products > Cans, Trash Cans and Covers', 133, NULL
FROM categories p WHERE p.digikey_id = 2099;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Cold Weather Products, Clothing', p.id, 1136, 3, 'Industrial Supplies > Outdoor Products > Cold Weather Products, Clothing', 179, NULL
FROM categories p WHERE p.digikey_id = 2099;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Lawn Tools', p.id, 1138, 3, 'Industrial Supplies > Outdoor Products > Lawn Tools', 27, NULL
FROM categories p WHERE p.digikey_id = 2099;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Miscellaneous', p.id, 1139, 3, 'Industrial Supplies > Outdoor Products > Miscellaneous', 86, NULL
FROM categories p WHERE p.digikey_id = 2099;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Mowers, Vacuums, Blowers and Cutters', p.id, 1140, 3, 'Industrial Supplies > Outdoor Products > Mowers, Vacuums, Blowers and Cutters', 8, NULL
FROM categories p WHERE p.digikey_id = 2099;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Outdoor Furniture', p.id, 1141, 3, 'Industrial Supplies > Outdoor Products > Outdoor Furniture', 149, NULL
FROM categories p WHERE p.digikey_id = 2099;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Parking Lot and Safety', p.id, 1142, 3, 'Industrial Supplies > Outdoor Products > Parking Lot and Safety', 491, NULL
FROM categories p WHERE p.digikey_id = 2099;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Snow and Ice Removal', p.id, 1143, 3, 'Industrial Supplies > Outdoor Products > Snow and Ice Removal', 6, NULL
FROM categories p WHERE p.digikey_id = 2099;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Building/Construction Products', p.id, 1145, 3, 'Industrial Supplies > Product, Material Handling and Storage > Building/Construction Products', 135, NULL
FROM categories p WHERE p.digikey_id = 2100;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Dollies', p.id, 1089, 3, 'Industrial Supplies > Product, Material Handling and Storage > Dollies', 7, NULL
FROM categories p WHERE p.digikey_id = 2100;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Drum Accessories', p.id, 1090, 3, 'Industrial Supplies > Product, Material Handling and Storage > Drum Accessories', 84, NULL
FROM categories p WHERE p.digikey_id = 2100;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Drum Cradles, Lifts, Trucks', p.id, 1091, 3, 'Industrial Supplies > Product, Material Handling and Storage > Drum Cradles, Lifts, Trucks', 81, NULL
FROM categories p WHERE p.digikey_id = 2100;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Drum Pumps', p.id, 1092, 3, 'Industrial Supplies > Product, Material Handling and Storage > Drum Pumps', 34, NULL
FROM categories p WHERE p.digikey_id = 2100;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Drums, Pails', p.id, 1093, 3, 'Industrial Supplies > Product, Material Handling and Storage > Drums, Pails', 6, NULL
FROM categories p WHERE p.digikey_id = 2100;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Pallets', p.id, 1146, 3, 'Industrial Supplies > Product, Material Handling and Storage > Pallets', 1, NULL
FROM categories p WHERE p.digikey_id = 2100;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Rack, Shelving, Stand Accessories', p.id, 1148, 3, 'Industrial Supplies > Product, Material Handling and Storage > Rack, Shelving, Stand Accessories', 537, NULL
FROM categories p WHERE p.digikey_id = 2100;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Racks, Shelving, Stands', p.id, 1147, 3, 'Industrial Supplies > Product, Material Handling and Storage > Racks, Shelving, Stands', 2771, NULL
FROM categories p WHERE p.digikey_id = 2100;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Storage Containers and Bins', p.id, 1149, 3, 'Industrial Supplies > Product, Material Handling and Storage > Storage Containers and Bins', 450, NULL
FROM categories p WHERE p.digikey_id = 2100;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Absorbents, Trays and Cleaners', p.id, 1094, 3, 'Industrial Supplies > Safety > Absorbents, Trays and Cleaners', 32, NULL
FROM categories p WHERE p.digikey_id = 2101;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Exit Signs and Emergency Lights', p.id, 1095, 3, 'Industrial Supplies > Safety > Exit Signs and Emergency Lights', 20, NULL
FROM categories p WHERE p.digikey_id = 2101;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Fuel, Oil and General Purpose Cans', p.id, 1150, 3, 'Industrial Supplies > Safety > Fuel, Oil and General Purpose Cans', 25, NULL
FROM categories p WHERE p.digikey_id = 2101;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Garage Storage and Organization', p.id, 1152, 3, 'Industrial Supplies > Storage Containers & Bins > Garage Storage and Organization', 3, NULL
FROM categories p WHERE p.digikey_id = 2103;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Carts and Stands', p.id, 1116, 3, 'Industrial Supplies > Workstation, Office Furniture and Equipment > Carts and Stands', 35, NULL
FROM categories p WHERE p.digikey_id = 2104;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Chairs and Stools', p.id, 1117, 3, 'Industrial Supplies > Workstation, Office Furniture and Equipment > Chairs and Stools', 290, NULL
FROM categories p WHERE p.digikey_id = 2104;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Computer Workstations', p.id, 1118, 3, 'Industrial Supplies > Workstation, Office Furniture and Equipment > Computer Workstations', 220, NULL
FROM categories p WHERE p.digikey_id = 2104;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Hazardous Material, Safety Cabinets', p.id, 1154, 3, 'Industrial Supplies > Workstation, Office Furniture and Equipment > Hazardous Material, Safety Cabinets', 17, NULL
FROM categories p WHERE p.digikey_id = 2104;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Lockers, Storage Cabinets and Accessories', p.id, 1087, 3, 'Industrial Supplies > Workstation, Office Furniture and Equipment > Lockers, Storage Cabinets and Accessories', 285, NULL
FROM categories p WHERE p.digikey_id = 2104;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Turntables', p.id, 1088, 3, 'Industrial Supplies > Workstation, Office Furniture and Equipment > Turntables', 1, NULL
FROM categories p WHERE p.digikey_id = 2104;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Application Specific Clock/Timing', p.id, 763, 3, 'Integrated Circuits (ICs) > Clock/Timing > Application Specific Clock/Timing', 3716, NULL
FROM categories p WHERE p.digikey_id = 2006;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Clock Buffers, Drivers', p.id, 764, 3, 'Integrated Circuits (ICs) > Clock/Timing > Clock Buffers, Drivers', 3826, NULL
FROM categories p WHERE p.digikey_id = 2006;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Clock Generators, PLLs, Frequency Synthesizers', p.id, 728, 3, 'Integrated Circuits (ICs) > Clock/Timing > Clock Generators, PLLs, Frequency Synthesizers', 14828, NULL
FROM categories p WHERE p.digikey_id = 2006;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Delay Lines', p.id, 688, 3, 'Integrated Circuits (ICs) > Clock/Timing > Delay Lines', 661, NULL
FROM categories p WHERE p.digikey_id = 2006;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'IC Batteries', p.id, 762, 3, 'Integrated Circuits (ICs) > Clock/Timing > IC Batteries', 4, NULL
FROM categories p WHERE p.digikey_id = 2006;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Programmable Timers and Oscillators', p.id, 689, 3, 'Integrated Circuits (ICs) > Clock/Timing > Programmable Timers and Oscillators', 1720, NULL
FROM categories p WHERE p.digikey_id = 2006;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Real Time Clocks', p.id, 690, 3, 'Integrated Circuits (ICs) > Clock/Timing > Real Time Clocks', 2367, NULL
FROM categories p WHERE p.digikey_id = 2006;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'ADCs/DACs - Special Purpose', p.id, 768, 3, 'Integrated Circuits (ICs) > Data Acquisition > ADCs/DACs - Special Purpose', 2814, NULL
FROM categories p WHERE p.digikey_id = 2009;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Analog Front End (AFE)', p.id, 724, 3, 'Integrated Circuits (ICs) > Data Acquisition > Analog Front End (AFE)', 749, NULL
FROM categories p WHERE p.digikey_id = 2009;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Analog to Digital Converters (ADC)', p.id, 700, 3, 'Integrated Circuits (ICs) > Data Acquisition > Analog to Digital Converters (ADC)', 14086, NULL
FROM categories p WHERE p.digikey_id = 2009;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Digital Potentiometers', p.id, 717, 3, 'Integrated Circuits (ICs) > Data Acquisition > Digital Potentiometers', 4377, NULL
FROM categories p WHERE p.digikey_id = 2009;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Digital to Analog Converters (DAC)', p.id, 701, 3, 'Integrated Circuits (ICs) > Data Acquisition > Digital to Analog Converters (DAC)', 11116, NULL
FROM categories p WHERE p.digikey_id = 2009;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Touch Screen Controllers', p.id, 775, 3, 'Integrated Circuits (ICs) > Data Acquisition > Touch Screen Controllers', 711, NULL
FROM categories p WHERE p.digikey_id = 2009;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Application Specific Microcontrollers', p.id, 769, 3, 'Integrated Circuits (ICs) > Embedded > Application Specific Microcontrollers', 2155, NULL
FROM categories p WHERE p.digikey_id = 2012;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'CPLDs (Complex Programmable Logic Devices)', p.id, 695, 3, 'Integrated Circuits (ICs) > Embedded > CPLDs (Complex Programmable Logic Devices)', 4124, NULL
FROM categories p WHERE p.digikey_id = 2012;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'DSP (Digital Signal Processors)', p.id, 698, 3, 'Integrated Circuits (ICs) > Embedded > DSP (Digital Signal Processors)', 3335, NULL
FROM categories p WHERE p.digikey_id = 2012;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'FPGAs (Field Programmable Gate Array)', p.id, 696, 3, 'Integrated Circuits (ICs) > Embedded > FPGAs (Field Programmable Gate Array)', 24076, NULL
FROM categories p WHERE p.digikey_id = 2012;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'FPGAs (Field Programmable Gate Array) with Microcontrollers', p.id, 767, 3, 'Integrated Circuits (ICs) > Embedded > FPGAs (Field Programmable Gate Array) with Microcontrollers', 67, NULL
FROM categories p WHERE p.digikey_id = 2012;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Microcontrollers', p.id, 685, 3, 'Integrated Circuits (ICs) > Embedded > Microcontrollers', 83634, NULL
FROM categories p WHERE p.digikey_id = 2012;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Microcontrollers, Microprocessor, FPGA Modules', p.id, 721, 3, 'Integrated Circuits (ICs) > Embedded > Microcontrollers, Microprocessor, FPGA Modules', 1648, NULL
FROM categories p WHERE p.digikey_id = 2012;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Microprocessors', p.id, 694, 3, 'Integrated Circuits (ICs) > Embedded > Microprocessors', 7389, NULL
FROM categories p WHERE p.digikey_id = 2012;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'PLDs (Programmable Logic Device)', p.id, 719, 3, 'Integrated Circuits (ICs) > Embedded > PLDs (Programmable Logic Device)', 1119, NULL
FROM categories p WHERE p.digikey_id = 2012;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'System On Chip (SoC)', p.id, 777, 3, 'Integrated Circuits (ICs) > Embedded > System On Chip (SoC)', 5948, NULL
FROM categories p WHERE p.digikey_id = 2012;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Analog Switches - Special Purpose', p.id, 780, 3, 'Integrated Circuits (ICs) > Interface > Analog Switches - Special Purpose', 2114, NULL
FROM categories p WHERE p.digikey_id = 2016;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Analog Switches, Multiplexers, Demultiplexers', p.id, 747, 3, 'Integrated Circuits (ICs) > Interface > Analog Switches, Multiplexers, Demultiplexers', 10078, NULL
FROM categories p WHERE p.digikey_id = 2016;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'CODECS', p.id, 716, 3, 'Integrated Circuits (ICs) > Interface > CODECS', 1422, NULL
FROM categories p WHERE p.digikey_id = 2016;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Controllers', p.id, 753, 3, 'Integrated Circuits (ICs) > Interface > Controllers', 3414, NULL
FROM categories p WHERE p.digikey_id = 2016;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Direct Digital Synthesis (DDS)', p.id, 723, 3, 'Integrated Circuits (ICs) > Interface > Direct Digital Synthesis (DDS)', 105, NULL
FROM categories p WHERE p.digikey_id = 2016;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Drivers, Receivers, Transceivers', p.id, 710, 3, 'Integrated Circuits (ICs) > Interface > Drivers, Receivers, Transceivers', 17325, NULL
FROM categories p WHERE p.digikey_id = 2016;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Encoders, Decoders, Converters', p.id, 709, 3, 'Integrated Circuits (ICs) > Interface > Encoders, Decoders, Converters', 507, NULL
FROM categories p WHERE p.digikey_id = 2016;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Filters - Active', p.id, 735, 3, 'Integrated Circuits (ICs) > Interface > Filters - Active', 961, NULL
FROM categories p WHERE p.digikey_id = 2016;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'I/O Expanders', p.id, 749, 3, 'Integrated Circuits (ICs) > Interface > I/O Expanders', 1132, NULL
FROM categories p WHERE p.digikey_id = 2016;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Modems - ICs and Modules', p.id, 722, 3, 'Integrated Circuits (ICs) > Interface > Modems - ICs and Modules', 301, NULL
FROM categories p WHERE p.digikey_id = 2016;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Modules', p.id, 778, 3, 'Integrated Circuits (ICs) > Interface > Modules', 143, NULL
FROM categories p WHERE p.digikey_id = 2016;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Sensor and Detector Interfaces', p.id, 752, 3, 'Integrated Circuits (ICs) > Interface > Sensor and Detector Interfaces', 1255, NULL
FROM categories p WHERE p.digikey_id = 2016;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Sensor, Capacitive Touch', p.id, 560, 3, 'Integrated Circuits (ICs) > Interface > Sensor, Capacitive Touch', 600, NULL
FROM categories p WHERE p.digikey_id = 2016;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Serializers, Deserializers', p.id, 755, 3, 'Integrated Circuits (ICs) > Interface > Serializers, Deserializers', 1189, NULL
FROM categories p WHERE p.digikey_id = 2016;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Signal Buffers, Repeaters, Splitters', p.id, 756, 3, 'Integrated Circuits (ICs) > Interface > Signal Buffers, Repeaters, Splitters', 1394, NULL
FROM categories p WHERE p.digikey_id = 2016;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Signal Terminators', p.id, 683, 3, 'Integrated Circuits (ICs) > Interface > Signal Terminators', 236, NULL
FROM categories p WHERE p.digikey_id = 2016;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Specialized', p.id, 754, 3, 'Integrated Circuits (ICs) > Interface > Specialized', 4392, NULL
FROM categories p WHERE p.digikey_id = 2016;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Telecom', p.id, 702, 3, 'Integrated Circuits (ICs) > Interface > Telecom', 3096, NULL
FROM categories p WHERE p.digikey_id = 2016;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'UARTs (Universal Asynchronous Receiver Transmitter)', p.id, 714, 3, 'Integrated Circuits (ICs) > Interface > UARTs (Universal Asynchronous Receiver Transmitter)', 935, NULL
FROM categories p WHERE p.digikey_id = 2016;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Voice Record and Playback', p.id, 733, 3, 'Integrated Circuits (ICs) > Interface > Voice Record and Playback', 396, NULL
FROM categories p WHERE p.digikey_id = 2016;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Amplifiers', p.id, 2034, 3, 'Integrated Circuits (ICs) > Linear > Amplifiers', 38011, NULL
FROM categories p WHERE p.digikey_id = 2018;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Analog Multipliers, Dividers', p.id, 772, 3, 'Integrated Circuits (ICs) > Linear > Analog Multipliers, Dividers', 155, NULL
FROM categories p WHERE p.digikey_id = 2018;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Comparators', p.id, 692, 3, 'Integrated Circuits (ICs) > Linear > Comparators', 4973, NULL
FROM categories p WHERE p.digikey_id = 2018;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Video Processing', p.id, 684, 3, 'Integrated Circuits (ICs) > Linear > Video Processing', 2165, NULL
FROM categories p WHERE p.digikey_id = 2018;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Buffers, Drivers, Receivers, Transceivers', p.id, 704, 3, 'Integrated Circuits (ICs) > Logic > Buffers, Drivers, Receivers, Transceivers', 14155, NULL
FROM categories p WHERE p.digikey_id = 2019;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Comparators', p.id, 773, 3, 'Integrated Circuits (ICs) > Logic > Comparators', 407, NULL
FROM categories p WHERE p.digikey_id = 2019;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Counters, Dividers', p.id, 731, 3, 'Integrated Circuits (ICs) > Logic > Counters, Dividers', 2693, NULL
FROM categories p WHERE p.digikey_id = 2019;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'FIFOs Memory', p.id, 707, 3, 'Integrated Circuits (ICs) > Logic > FIFOs Memory', 2921, NULL
FROM categories p WHERE p.digikey_id = 2019;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Flip Flops', p.id, 706, 3, 'Integrated Circuits (ICs) > Logic > Flip Flops', 6468, NULL
FROM categories p WHERE p.digikey_id = 2019;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Gates and Inverters', p.id, 705, 3, 'Integrated Circuits (ICs) > Logic > Gates and Inverters', 13542, NULL
FROM categories p WHERE p.digikey_id = 2019;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Gates and Inverters - Multi-Function, Configurable', p.id, 770, 3, 'Integrated Circuits (ICs) > Logic > Gates and Inverters - Multi-Function, Configurable', 1294, NULL
FROM categories p WHERE p.digikey_id = 2019;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Latches', p.id, 708, 3, 'Integrated Circuits (ICs) > Logic > Latches', 2992, NULL
FROM categories p WHERE p.digikey_id = 2019;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Multivibrators', p.id, 711, 3, 'Integrated Circuits (ICs) > Logic > Multivibrators', 689, NULL
FROM categories p WHERE p.digikey_id = 2019;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Parity Generators and Checkers', p.id, 720, 3, 'Integrated Circuits (ICs) > Logic > Parity Generators and Checkers', 194, NULL
FROM categories p WHERE p.digikey_id = 2019;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Shift Registers', p.id, 712, 3, 'Integrated Circuits (ICs) > Logic > Shift Registers', 2168, NULL
FROM categories p WHERE p.digikey_id = 2019;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Signal Switches, Multiplexers, Decoders', p.id, 743, 3, 'Integrated Circuits (ICs) > Logic > Signal Switches, Multiplexers, Decoders', 7489, NULL
FROM categories p WHERE p.digikey_id = 2019;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Specialty Logic', p.id, 703, 3, 'Integrated Circuits (ICs) > Logic > Specialty Logic', 1245, NULL
FROM categories p WHERE p.digikey_id = 2019;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Translators, Level Shifters', p.id, 732, 3, 'Integrated Circuits (ICs) > Logic > Translators, Level Shifters', 2703, NULL
FROM categories p WHERE p.digikey_id = 2019;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Universal Bus Functions', p.id, 725, 3, 'Integrated Circuits (ICs) > Logic > Universal Bus Functions', 477, NULL
FROM categories p WHERE p.digikey_id = 2019;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Batteries', p.id, 766, 3, 'Integrated Circuits (ICs) > Memory > Batteries', 13, NULL
FROM categories p WHERE p.digikey_id = 2020;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Configuration PROMs for FPGAs', p.id, 697, 3, 'Integrated Circuits (ICs) > Memory > Configuration PROMs for FPGAs', 584, NULL
FROM categories p WHERE p.digikey_id = 2020;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Controllers', p.id, 736, 3, 'Integrated Circuits (ICs) > Memory > Controllers', 304, NULL
FROM categories p WHERE p.digikey_id = 2020;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Memory', p.id, 774, 3, 'Integrated Circuits (ICs) > Memory > Memory', 58300, NULL
FROM categories p WHERE p.digikey_id = 2020;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'AC DC Converters, Offline Switchers', p.id, 748, 3, 'Integrated Circuits (ICs) > Power Management (PMIC) > AC DC Converters, Offline Switchers', 4625, NULL
FROM categories p WHERE p.digikey_id = 2025;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Battery Chargers', p.id, 781, 3, 'Integrated Circuits (ICs) > Power Management (PMIC) > Battery Chargers', 3442, NULL
FROM categories p WHERE p.digikey_id = 2025;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Battery Management', p.id, 713, 3, 'Integrated Circuits (ICs) > Power Management (PMIC) > Battery Management', 4898, NULL
FROM categories p WHERE p.digikey_id = 2025;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Current Regulation/Management', p.id, 734, 3, 'Integrated Circuits (ICs) > Power Management (PMIC) > Current Regulation/Management', 1421, NULL
FROM categories p WHERE p.digikey_id = 2025;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'DC DC Switching Controllers', p.id, 715, 3, 'Integrated Circuits (ICs) > Power Management (PMIC) > DC DC Switching Controllers', 10543, NULL
FROM categories p WHERE p.digikey_id = 2025;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Display Drivers', p.id, 729, 3, 'Integrated Circuits (ICs) > Power Management (PMIC) > Display Drivers', 1165, NULL
FROM categories p WHERE p.digikey_id = 2025;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Energy Metering', p.id, 765, 3, 'Integrated Circuits (ICs) > Power Management (PMIC) > Energy Metering', 488, NULL
FROM categories p WHERE p.digikey_id = 2025;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Full, Half-Bridge (H Bridge) Drivers', p.id, 746, 3, 'Integrated Circuits (ICs) > Power Management (PMIC) > Full, Half-Bridge (H Bridge) Drivers', 1389, NULL
FROM categories p WHERE p.digikey_id = 2025;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Gate Drivers', p.id, 730, 3, 'Integrated Circuits (ICs) > Power Management (PMIC) > Gate Drivers', 6447, NULL
FROM categories p WHERE p.digikey_id = 2025;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Hot Swap Controllers', p.id, 718, 3, 'Integrated Circuits (ICs) > Power Management (PMIC) > Hot Swap Controllers', 2022, NULL
FROM categories p WHERE p.digikey_id = 2025;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Laser Drivers', p.id, 681, 3, 'Integrated Circuits (ICs) > Power Management (PMIC) > Laser Drivers', 420, NULL
FROM categories p WHERE p.digikey_id = 2025;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'LED Drivers', p.id, 745, 3, 'Integrated Circuits (ICs) > Power Management (PMIC) > LED Drivers', 7133, NULL
FROM categories p WHERE p.digikey_id = 2025;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Lighting, Ballast Controllers', p.id, 751, 3, 'Integrated Circuits (ICs) > Power Management (PMIC) > Lighting, Ballast Controllers', 452, NULL
FROM categories p WHERE p.digikey_id = 2025;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Motor Drivers, Controllers', p.id, 744, 3, 'Integrated Circuits (ICs) > Power Management (PMIC) > Motor Drivers, Controllers', 5060, NULL
FROM categories p WHERE p.digikey_id = 2025;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'OR Controllers, Ideal Diodes', p.id, 758, 3, 'Integrated Circuits (ICs) > Power Management (PMIC) > OR Controllers, Ideal Diodes', 646, NULL
FROM categories p WHERE p.digikey_id = 2025;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'PFC (Power Factor Correction)', p.id, 759, 3, 'Integrated Circuits (ICs) > Power Management (PMIC) > PFC (Power Factor Correction)', 1076, NULL
FROM categories p WHERE p.digikey_id = 2025;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Power Distribution Switches, Load Drivers', p.id, 726, 3, 'Integrated Circuits (ICs) > Power Management (PMIC) > Power Distribution Switches, Load Drivers', 7383, NULL
FROM categories p WHERE p.digikey_id = 2025;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Power Management - Specialized', p.id, 761, 3, 'Integrated Circuits (ICs) > Power Management (PMIC) > Power Management - Specialized', 7241, NULL
FROM categories p WHERE p.digikey_id = 2025;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Power Over Ethernet (PoE) Controllers', p.id, 779, 3, 'Integrated Circuits (ICs) > Power Management (PMIC) > Power Over Ethernet (PoE) Controllers', 833, NULL
FROM categories p WHERE p.digikey_id = 2025;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Power Supply Controllers, Monitors', p.id, 760, 3, 'Integrated Circuits (ICs) > Power Management (PMIC) > Power Supply Controllers, Monitors', 2255, NULL
FROM categories p WHERE p.digikey_id = 2025;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'RMS to DC Converters', p.id, 740, 3, 'Integrated Circuits (ICs) > Power Management (PMIC) > RMS to DC Converters', 132, NULL
FROM categories p WHERE p.digikey_id = 2025;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Special Purpose Regulators', p.id, 750, 3, 'Integrated Circuits (ICs) > Power Management (PMIC) > Special Purpose Regulators', 4835, NULL
FROM categories p WHERE p.digikey_id = 2025;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Supervisors', p.id, 691, 3, 'Integrated Circuits (ICs) > Power Management (PMIC) > Supervisors', 38791, NULL
FROM categories p WHERE p.digikey_id = 2025;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Thermal Management', p.id, 738, 3, 'Integrated Circuits (ICs) > Power Management (PMIC) > Thermal Management', 473, NULL
FROM categories p WHERE p.digikey_id = 2025;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'V/F and F/V Converters', p.id, 727, 3, 'Integrated Circuits (ICs) > Power Management (PMIC) > V/F and F/V Converters', 135, NULL
FROM categories p WHERE p.digikey_id = 2025;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Voltage Reference', p.id, 693, 3, 'Integrated Circuits (ICs) > Power Management (PMIC) > Voltage Reference', 8458, NULL
FROM categories p WHERE p.digikey_id = 2025;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Voltage Regulators - DC DC Switching Regulators', p.id, 739, 3, 'Integrated Circuits (ICs) > Power Management (PMIC) > Voltage Regulators - DC DC Switching Regulators', 37178, NULL
FROM categories p WHERE p.digikey_id = 2025;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Voltage Regulators - Linear + Switching', p.id, 776, 3, 'Integrated Circuits (ICs) > Power Management (PMIC) > Voltage Regulators - Linear + Switching', 1503, NULL
FROM categories p WHERE p.digikey_id = 2025;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Voltage Regulators - Linear Regulator Controllers', p.id, 757, 3, 'Integrated Circuits (ICs) > Power Management (PMIC) > Voltage Regulators - Linear Regulator Controllers', 360, NULL
FROM categories p WHERE p.digikey_id = 2025;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Voltage Regulators - Linear, Low Drop Out (LDO) Regulators', p.id, 699, 3, 'Integrated Circuits (ICs) > Power Management (PMIC) > Voltage Regulators - Linear, Low Drop Out (LDO) Regulators', 67572, NULL
FROM categories p WHERE p.digikey_id = 2025;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Logic Output Optoisolators', p.id, 902, 3, 'Isolators > Optocouplers, Optoisolators > Logic Output Optoisolators', 2471, NULL
FROM categories p WHERE p.digikey_id = 2058;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Transistor, Photovoltaic Output Optoisolators', p.id, 903, 3, 'Isolators > Optocouplers, Optoisolators > Transistor, Photovoltaic Output Optoisolators', 12483, NULL
FROM categories p WHERE p.digikey_id = 2058;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Triac, SCR Output Optoisolators', p.id, 904, 3, 'Isolators > Optocouplers, Optoisolators > Triac, SCR Output Optoisolators', 1848, NULL
FROM categories p WHERE p.digikey_id = 2058;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Beam Expanders', p.id, 1042, 3, 'Optics > Laser Optics > Beam Expanders', 20, NULL
FROM categories p WHERE p.digikey_id = 2060;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'F-Theta Lenses', p.id, 1041, 3, 'Optics > Laser Optics > F-Theta Lenses', 46, NULL
FROM categories p WHERE p.digikey_id = 2060;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Faraday Isolators', p.id, 1048, 3, 'Optics > Laser Optics > Faraday Isolators', 54, NULL
FROM categories p WHERE p.digikey_id = 2060;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Focus Lenses', p.id, 1043, 3, 'Optics > Laser Optics > Focus Lenses', 4, NULL
FROM categories p WHERE p.digikey_id = 2060;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Laser Modulators', p.id, 1050, 3, 'Optics > Laser Optics > Laser Modulators', 93, NULL
FROM categories p WHERE p.digikey_id = 2060;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Laser Optics Accessories', p.id, 1120, 3, 'Optics > Laser Optics > Laser Optics Accessories', 23, NULL
FROM categories p WHERE p.digikey_id = 2060;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Pockels Cells', p.id, 1049, 3, 'Optics > Laser Optics > Pockels Cells', 34, NULL
FROM categories p WHERE p.digikey_id = 2060;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Personal Protective Equipment (PPE)', p.id, 259, 3, 'Safety Products > Direct Human Safety > Personal Protective Equipment (PPE)', 3638, NULL
FROM categories p WHERE p.digikey_id = 2117;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Bumpers and Edges', p.id, 1058, 3, 'Safety Products > Machine Safety > Bumpers and Edges', 109, NULL
FROM categories p WHERE p.digikey_id = 2091;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Controllers', p.id, 822, 3, 'Safety Products > Machine Safety > Controllers', 377, NULL
FROM categories p WHERE p.digikey_id = 2091;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Interlock Switches', p.id, 1060, 3, 'Safety Products > Machine Safety > Interlock Switches', 3719, NULL
FROM categories p WHERE p.digikey_id = 2091;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Laser Scanners', p.id, 988, 3, 'Safety Products > Machine Safety > Laser Scanners', 389, NULL
FROM categories p WHERE p.digikey_id = 2091;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Light Curtains, Light Grids', p.id, 959, 3, 'Safety Products > Machine Safety > Light Curtains, Light Grids', 14320, NULL
FROM categories p WHERE p.digikey_id = 2091;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Machine Safety Accessories', p.id, 1123, 3, 'Safety Products > Machine Safety > Machine Safety Accessories', 1241, NULL
FROM categories p WHERE p.digikey_id = 2091;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Mats', p.id, 1057, 3, 'Safety Products > Machine Safety > Mats', 138, NULL
FROM categories p WHERE p.digikey_id = 2091;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Safety Relays', p.id, 989, 3, 'Safety Products > Machine Safety > Safety Relays', 1545, NULL
FROM categories p WHERE p.digikey_id = 2091;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Cable Pull Switches', p.id, 968, 3, 'Safety Products > User Controlled Safety > Cable Pull Switches', 619, NULL
FROM categories p WHERE p.digikey_id = 2118;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Emergency Stop (E-Stop) Switches', p.id, 1056, 3, 'Safety Products > User Controlled Safety > Emergency Stop (E-Stop) Switches', 3277, NULL
FROM categories p WHERE p.digikey_id = 2118;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Compass, Magnetic Field (Modules)', p.id, 553, 3, 'Sensors, Transducers > Magnetic Sensors > Compass, Magnetic Field (Modules)', 43, NULL
FROM categories p WHERE p.digikey_id = 2068;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Linear, Compass (ICs)', p.id, 554, 3, 'Sensors, Transducers > Magnetic Sensors > Linear, Compass (ICs)', 1408, NULL
FROM categories p WHERE p.digikey_id = 2068;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Position, Proximity, Speed (Modules)', p.id, 552, 3, 'Sensors, Transducers > Magnetic Sensors > Position, Proximity, Speed (Modules)', 3304, NULL
FROM categories p WHERE p.digikey_id = 2068;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Switches (Solid State)', p.id, 565, 3, 'Sensors, Transducers > Magnetic Sensors > Switches (Solid State)', 4068, NULL
FROM categories p WHERE p.digikey_id = 2068;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Multi Purpose Magnets', p.id, 511, 3, 'Sensors, Transducers > Magnets > Multi Purpose Magnets', 2091, NULL
FROM categories p WHERE p.digikey_id = 2069;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Sensor Matched Magnets', p.id, 566, 3, 'Sensors, Transducers > Magnets > Sensor Matched Magnets', 134, NULL
FROM categories p WHERE p.digikey_id = 2069;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Accelerometers', p.id, 515, 3, 'Sensors, Transducers > Motion Sensors > Accelerometers', 2327, NULL
FROM categories p WHERE p.digikey_id = 2070;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Gyroscopes', p.id, 555, 3, 'Sensors, Transducers > Motion Sensors > Gyroscopes', 176, NULL
FROM categories p WHERE p.digikey_id = 2070;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'IMUs (Inertial Measurement Units)', p.id, 567, 3, 'Sensors, Transducers > Motion Sensors > IMUs (Inertial Measurement Units)', 522, NULL
FROM categories p WHERE p.digikey_id = 2070;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Inclinometers', p.id, 533, 3, 'Sensors, Transducers > Motion Sensors > Inclinometers', 404, NULL
FROM categories p WHERE p.digikey_id = 2070;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Optical Motion Sensors', p.id, 534, 3, 'Sensors, Transducers > Motion Sensors > Optical Motion Sensors', 749, NULL
FROM categories p WHERE p.digikey_id = 2070;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Tilt Switches', p.id, 523, 3, 'Sensors, Transducers > Motion Sensors > Tilt Switches', 77, NULL
FROM categories p WHERE p.digikey_id = 2070;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Vibration Sensors', p.id, 519, 3, 'Sensors, Transducers > Motion Sensors > Vibration Sensors', 490, NULL
FROM categories p WHERE p.digikey_id = 2070;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Ambient Light, IR, UV Sensors', p.id, 536, 3, 'Sensors, Transducers > Optical Sensors > Ambient Light, IR, UV Sensors', 1018, NULL
FROM categories p WHERE p.digikey_id = 2071;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Camera Modules', p.id, 1003, 3, 'Sensors, Transducers > Optical Sensors > Camera Modules', 1387, NULL
FROM categories p WHERE p.digikey_id = 2071;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Distance Measuring', p.id, 542, 3, 'Sensors, Transducers > Optical Sensors > Distance Measuring', 1073, NULL
FROM categories p WHERE p.digikey_id = 2071;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Image Sensors, Camera', p.id, 532, 3, 'Sensors, Transducers > Optical Sensors > Image Sensors, Camera', 2413, NULL
FROM categories p WHERE p.digikey_id = 2071;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Photo Detectors - CdS Cells', p.id, 540, 3, 'Sensors, Transducers > Optical Sensors > Photo Detectors - CdS Cells', 89, NULL
FROM categories p WHERE p.digikey_id = 2071;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Photo Detectors - Logic Output', p.id, 545, 3, 'Sensors, Transducers > Optical Sensors > Photo Detectors - Logic Output', 143, NULL
FROM categories p WHERE p.digikey_id = 2071;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Photo Detectors - Remote Receiver', p.id, 541, 3, 'Sensors, Transducers > Optical Sensors > Photo Detectors - Remote Receiver', 1292, NULL
FROM categories p WHERE p.digikey_id = 2071;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Photodiodes', p.id, 543, 3, 'Sensors, Transducers > Optical Sensors > Photodiodes', 1304, NULL
FROM categories p WHERE p.digikey_id = 2071;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Photointerrupters - Slot Type - Logic Output', p.id, 547, 3, 'Sensors, Transducers > Optical Sensors > Photointerrupters - Slot Type - Logic Output', 951, NULL
FROM categories p WHERE p.digikey_id = 2071;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Photointerrupters - Slot Type - Transistor Output', p.id, 548, 3, 'Sensors, Transducers > Optical Sensors > Photointerrupters - Slot Type - Transistor Output', 1253, NULL
FROM categories p WHERE p.digikey_id = 2071;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Photonics - Counters, Detectors, SPCM (Single Photon Counting Module)', p.id, 1011, 3, 'Sensors, Transducers > Optical Sensors > Photonics - Counters, Detectors, SPCM (Single Photon Counting Module)', 751, NULL
FROM categories p WHERE p.digikey_id = 2071;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Phototransistors', p.id, 544, 3, 'Sensors, Transducers > Optical Sensors > Phototransistors', 828, NULL
FROM categories p WHERE p.digikey_id = 2071;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Reflective - Analog Output', p.id, 546, 3, 'Sensors, Transducers > Optical Sensors > Reflective - Analog Output', 349, NULL
FROM categories p WHERE p.digikey_id = 2071;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Reflective - Logic Output', p.id, 556, 3, 'Sensors, Transducers > Optical Sensors > Reflective - Logic Output', 197, NULL
FROM categories p WHERE p.digikey_id = 2071;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Angle, Linear Position Measuring', p.id, 549, 3, 'Sensors, Transducers > Position Sensors > Angle, Linear Position Measuring', 18490, NULL
FROM categories p WHERE p.digikey_id = 2072;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Analog and Digital Output', p.id, 518, 3, 'Sensors, Transducers > Temperature Sensors > Analog and Digital Output', 2932, NULL
FROM categories p WHERE p.digikey_id = 2075;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'NTC Thermistors', p.id, 508, 3, 'Sensors, Transducers > Temperature Sensors > NTC Thermistors', 10762, NULL
FROM categories p WHERE p.digikey_id = 2075;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'PTC Thermistors', p.id, 550, 3, 'Sensors, Transducers > Temperature Sensors > PTC Thermistors', 1051, NULL
FROM categories p WHERE p.digikey_id = 2075;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'RTD (Resistance Temperature Detector)', p.id, 535, 3, 'Sensors, Transducers > Temperature Sensors > RTD (Resistance Temperature Detector)', 2032, NULL
FROM categories p WHERE p.digikey_id = 2075;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Thermocouples, Temperature Probes', p.id, 513, 3, 'Sensors, Transducers > Temperature Sensors > Thermocouples, Temperature Probes', 6828, NULL
FROM categories p WHERE p.digikey_id = 2075;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Thermostats - Mechanical', p.id, 516, 3, 'Sensors, Transducers > Temperature Sensors > Thermostats - Mechanical', 1356, NULL
FROM categories p WHERE p.digikey_id = 2075;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Thermostats - Solid State', p.id, 564, 3, 'Sensors, Transducers > Temperature Sensors > Thermostats - Solid State', 839, NULL
FROM categories p WHERE p.digikey_id = 2075;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Configurable Switch Bodies', p.id, 206, 3, 'Switches > Configurable Switch Components > Configurable Switch Bodies', 20034, NULL
FROM categories p WHERE p.digikey_id = 2076;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Configurable Switch Contact Blocks', p.id, 207, 3, 'Switches > Configurable Switch Components > Configurable Switch Contact Blocks', 1606, NULL
FROM categories p WHERE p.digikey_id = 2076;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Configurable Switch Illumination Sources', p.id, 208, 3, 'Switches > Configurable Switch Components > Configurable Switch Illumination Sources', 1312, NULL
FROM categories p WHERE p.digikey_id = 2076;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Configurable Switch Lens', p.id, 209, 3, 'Switches > Configurable Switch Components > Configurable Switch Lens', 1842, NULL
FROM categories p WHERE p.digikey_id = 2076;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Combination Sets', p.id, 958, 3, 'Test and Measurement > Test Equipment > Combination Sets', 113, NULL
FROM categories p WHERE p.digikey_id = 2078;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Electrical Testers, Current Probes', p.id, 634, 3, 'Test and Measurement > Test Equipment > Electrical Testers, Current Probes', 1296, NULL
FROM categories p WHERE p.digikey_id = 2078;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Environmental Testers', p.id, 632, 3, 'Test and Measurement > Test Equipment > Environmental Testers', 3146, NULL
FROM categories p WHERE p.digikey_id = 2078;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Force/Torque Gauges', p.id, 1019, 3, 'Test and Measurement > Test Equipment > Force/Torque Gauges', 218, NULL
FROM categories p WHERE p.digikey_id = 2078;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Function Generators', p.id, 630, 3, 'Test and Measurement > Test Equipment > Function Generators', 238, NULL
FROM categories p WHERE p.digikey_id = 2078;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Multimeters', p.id, 615, 3, 'Test and Measurement > Test Equipment > Multimeters', 805, NULL
FROM categories p WHERE p.digikey_id = 2078;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Oscilloscopes', p.id, 614, 3, 'Test and Measurement > Test Equipment > Oscilloscopes', 654, NULL
FROM categories p WHERE p.digikey_id = 2078;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Power Supplies (Test, Bench)', p.id, 633, 3, 'Test and Measurement > Test Equipment > Power Supplies (Test, Bench)', 2094, NULL
FROM categories p WHERE p.digikey_id = 2078;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'RF Analyzers', p.id, 631, 3, 'Test and Measurement > Test Equipment > RF Analyzers', 150, NULL
FROM categories p WHERE p.digikey_id = 2078;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Specialty Equipment', p.id, 618, 3, 'Test and Measurement > Test Equipment > Specialty Equipment', 4517, NULL
FROM categories p WHERE p.digikey_id = 2078;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Variable Transformers', p.id, 619, 3, 'Test and Measurement > Test Equipment > Variable Transformers', 994, NULL
FROM categories p WHERE p.digikey_id = 2078;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Alligator, Crocodile, Heavy Duty Clips', p.id, 623, 3, 'Test and Measurement > Test Leads > Alligator, Crocodile, Heavy Duty Clips', 761, NULL
FROM categories p WHERE p.digikey_id = 2079;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Banana, Meter Interface', p.id, 627, 3, 'Test and Measurement > Test Leads > Banana, Meter Interface', 2782, NULL
FROM categories p WHERE p.digikey_id = 2079;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'BNC Interface', p.id, 625, 3, 'Test and Measurement > Test Leads > BNC Interface', 342, NULL
FROM categories p WHERE p.digikey_id = 2079;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Grabbers, Hooks', p.id, 620, 3, 'Test and Measurement > Test Leads > Grabbers, Hooks', 475, NULL
FROM categories p WHERE p.digikey_id = 2079;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'IC Clips', p.id, 624, 3, 'Test and Measurement > Test Leads > IC Clips', 170, NULL
FROM categories p WHERE p.digikey_id = 2079;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Jumper, Specialty', p.id, 626, 3, 'Test and Measurement > Test Leads > Jumper, Specialty', 6112, NULL
FROM categories p WHERE p.digikey_id = 2079;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Kits, Assortments', p.id, 628, 3, 'Test and Measurement > Test Leads > Kits, Assortments', 245, NULL
FROM categories p WHERE p.digikey_id = 2079;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Oscilloscope Probes', p.id, 629, 3, 'Test and Measurement > Test Leads > Oscilloscope Probes', 485, NULL
FROM categories p WHERE p.digikey_id = 2079;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Thermocouples, Temperature Probes', p.id, 621, 3, 'Test and Measurement > Test Leads > Thermocouples, Temperature Probes', 1821, NULL
FROM categories p WHERE p.digikey_id = 2079;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Crimp Heads, Die Sets', p.id, 232, 3, 'Tools > Crimpers, Applicators, Presses > Crimp Heads, Die Sets', 5576, NULL
FROM categories p WHERE p.digikey_id = 2111;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Crimper, Applicator, Press Accessories', p.id, 250, 3, 'Tools > Crimpers, Applicators, Presses > Crimper, Applicator, Press Accessories', 59497, NULL
FROM categories p WHERE p.digikey_id = 2111;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Crimpers, Applicators, Presses', p.id, 228, 3, 'Tools > Crimpers, Applicators, Presses > Crimpers, Applicators, Presses', 19308, NULL
FROM categories p WHERE p.digikey_id = 2111;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Applicators, Dispensers', p.id, 990, 3, 'Tools > Dispensing Equipment > Applicators, Dispensers', 155, NULL
FROM categories p WHERE p.digikey_id = 2080;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Bottles, Syringes', p.id, 991, 3, 'Tools > Dispensing Equipment > Bottles, Syringes', 681, NULL
FROM categories p WHERE p.digikey_id = 2080;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Tips, Nozzles', p.id, 271, 3, 'Tools > Dispensing Equipment > Tips, Nozzles', 1704, NULL
FROM categories p WHERE p.digikey_id = 2080;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Screw and Nut Driver Bits, Blades and Handles', p.id, 236, 3, 'Tools > Screwdrivers, Nut Drivers and Sets > Screw and Nut Driver Bits, Blades and Handles', 3896, NULL
FROM categories p WHERE p.digikey_id = 2081;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Screw and Nut Driver Sets', p.id, 249, 3, 'Tools > Screwdrivers, Nut Drivers and Sets > Screw and Nut Driver Sets', 1833, NULL
FROM categories p WHERE p.digikey_id = 2081;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Screw and Nut Drivers', p.id, 239, 3, 'Tools > Screwdrivers, Nut Drivers and Sets > Screw and Nut Drivers', 3980, NULL
FROM categories p WHERE p.digikey_id = 2081;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Socket Sets', p.id, 247, 3, 'Tools > Socket and Socket Handles > Socket Sets', 882, NULL
FROM categories p WHERE p.digikey_id = 2082;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Sockets, Handles', p.id, 251, 3, 'Tools > Socket and Socket Handles > Sockets, Handles', 7346, NULL
FROM categories p WHERE p.digikey_id = 2082;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Workbench and Station Accessories', p.id, 1115, 3, 'Tools > Workbenches, Stations and Accessories > Workbench and Station Accessories', 252, NULL
FROM categories p WHERE p.digikey_id = 2083;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Workbenches and Stations', p.id, 1114, 3, 'Tools > Workbenches, Stations and Accessories > Workbenches and Stations', 749, NULL
FROM categories p WHERE p.digikey_id = 2083;


-- Level 4 Categories (23 categories)

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Accessories', p.id, 309, 4, 'Connectors, Interconnects > Terminal Blocks > Terminal Block Accessories > Accessories', 8032, NULL
FROM categories p WHERE p.digikey_id = 2033;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Terminal Block Jumpers', p.id, 385, 4, 'Connectors, Interconnects > Terminal Blocks > Terminal Block Accessories > Terminal Block Jumpers', 3759, NULL
FROM categories p WHERE p.digikey_id = 2033;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Terminal Block Marker Strips', p.id, 384, 4, 'Connectors, Interconnects > Terminal Blocks > Terminal Block Accessories > Terminal Block Marker Strips', 8416, NULL
FROM categories p WHERE p.digikey_id = 2033;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Terminal Block Wire Ferrules', p.id, 364, 4, 'Connectors, Interconnects > Terminal Blocks > Terminal Block Accessories > Terminal Block Wire Ferrules', 2876, NULL
FROM categories p WHERE p.digikey_id = 2033;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Diode Arrays', p.id, 286, 4, 'Discrete Semiconductor Products > Diodes > Rectifiers > Diode Arrays', 16122, NULL
FROM categories p WHERE p.digikey_id = 2085;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Single Diodes', p.id, 280, 4, 'Discrete Semiconductor Products > Diodes > Rectifiers > Single Diodes', 49607, NULL
FROM categories p WHERE p.digikey_id = 2085;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Single Zener Diodes', p.id, 287, 4, 'Discrete Semiconductor Products > Diodes > Zener > Single Zener Diodes', 68344, NULL
FROM categories p WHERE p.digikey_id = 2086;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Zener Diode Arrays', p.id, 295, 4, 'Discrete Semiconductor Products > Diodes > Zener > Zener Diode Arrays', 2290, NULL
FROM categories p WHERE p.digikey_id = 2086;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Bipolar RF Transistors', p.id, 283, 4, 'Discrete Semiconductor Products > Transistors > Bipolar (BJT) > Bipolar RF Transistors', 1685, NULL
FROM categories p WHERE p.digikey_id = 2087;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Bipolar Transistor Arrays', p.id, 277, 4, 'Discrete Semiconductor Products > Transistors > Bipolar (BJT) > Bipolar Transistor Arrays', 2194, NULL
FROM categories p WHERE p.digikey_id = 2087;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Bipolar Transistor Arrays, Pre-Biased', p.id, 293, 4, 'Discrete Semiconductor Products > Transistors > Bipolar (BJT) > Bipolar Transistor Arrays, Pre-Biased', 2070, NULL
FROM categories p WHERE p.digikey_id = 2087;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Single Bipolar Transistors', p.id, 276, 4, 'Discrete Semiconductor Products > Transistors > Bipolar (BJT) > Single Bipolar Transistors', 21254, NULL
FROM categories p WHERE p.digikey_id = 2087;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Single, Pre-Biased Bipolar Transistors', p.id, 292, 4, 'Discrete Semiconductor Products > Transistors > Bipolar (BJT) > Single, Pre-Biased Bipolar Transistors', 4203, NULL
FROM categories p WHERE p.digikey_id = 2087;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'FET, MOSFET Arrays', p.id, 289, 4, 'Discrete Semiconductor Products > Transistors > FETs, MOSFETs > FET, MOSFET Arrays', 6187, NULL
FROM categories p WHERE p.digikey_id = 2088;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'RF FETs, MOSFETs', p.id, 285, 4, 'Discrete Semiconductor Products > Transistors > FETs, MOSFETs > RF FETs, MOSFETs', 3400, NULL
FROM categories p WHERE p.digikey_id = 2088;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Single FETs, MOSFETs', p.id, 278, 4, 'Discrete Semiconductor Products > Transistors > FETs, MOSFETs > Single FETs, MOSFETs', 45380, NULL
FROM categories p WHERE p.digikey_id = 2088;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'IGBT Arrays', p.id, 291, 4, 'Discrete Semiconductor Products > Transistors > IGBTs > IGBT Arrays', 20, NULL
FROM categories p WHERE p.digikey_id = 2089;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'IGBT Modules', p.id, 297, 4, 'Discrete Semiconductor Products > Transistors > IGBTs > IGBT Modules', 3039, NULL
FROM categories p WHERE p.digikey_id = 2089;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Single IGBTs', p.id, 279, 4, 'Discrete Semiconductor Products > Transistors > IGBTs > Single IGBTs', 4408, NULL
FROM categories p WHERE p.digikey_id = 2089;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Audio Amplifiers', p.id, 742, 4, 'Integrated Circuits (ICs) > Linear > Amplifiers > Audio Amplifiers', 4320, NULL
FROM categories p WHERE p.digikey_id = 2034;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Instrumentation, Op Amps, Buffer Amps', p.id, 687, 4, 'Integrated Circuits (ICs) > Linear > Amplifiers > Instrumentation, Op Amps, Buffer Amps', 30743, NULL
FROM categories p WHERE p.digikey_id = 2034;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Special Purpose Amplifiers', p.id, 771, 4, 'Integrated Circuits (ICs) > Linear > Amplifiers > Special Purpose Amplifiers', 1531, NULL
FROM categories p WHERE p.digikey_id = 2034;

INSERT INTO categories (name, parent_id, digikey_id, level, path, product_count, description)
SELECT 'Video Amps and Modules', p.id, 737, 4, 'Integrated Circuits (ICs) > Linear > Amplifiers > Video Amps and Modules', 1417, NULL
FROM categories p WHERE p.digikey_id = 2034;


-- Commit transaction
COMMIT;

-- =============================================================================
-- VERIFICATION
-- =============================================================================
DO $$
DECLARE
    total_count INTEGER;
    level1_count INTEGER;
    level2_count INTEGER;
    level3_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO total_count FROM categories;
    SELECT COUNT(*) INTO level1_count FROM categories WHERE level = 1;
    SELECT COUNT(*) INTO level2_count FROM categories WHERE level = 2;
    SELECT COUNT(*) INTO level3_count FROM categories WHERE level = 3;

    RAISE NOTICE '========================================';
    RAISE NOTICE 'DigiKey Categories Import Complete';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Total categories: %', total_count;
    RAISE NOTICE 'Level 1 (Root): %', level1_count;
    RAISE NOTICE 'Level 2: %', level2_count;
    RAISE NOTICE 'Level 3: %', level3_count;
    RAISE NOTICE '========================================';
END $$;
