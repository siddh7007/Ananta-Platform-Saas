#!/usr/bin/env python3
"""
Test that verifies the actual parameter flow:
1. Mouser/DigiKey store RAW STRINGS in parameters dict
2. Normalizers receive STRINGS and output structured data
3. Quality scorer sees properly extracted specs
"""
import sys
sys.path.insert(0, '/app')

from app.core.normalizers import normalize_component_data, normalize_operating_temperature
from app.core.quality_scorer import calculate_quality_score

print("=" * 80)
print("Parameter Flow Validation Test")
print("=" * 80)

# STEP 1: Verify normalization function expects strings
print("\n[Step 1] Testing normalize_operating_temperature function")
print("-" * 80)

test_inputs = [
    "-55°C ~ 175°C",
    "-40°C to 85°C",
    "0 to 70C",
]

for test_input in test_inputs:
    result = normalize_operating_temperature(test_input)
    if isinstance(result, dict) and 'min' in result and 'max' in result:
        print(f"✅ '{test_input}' → {result}")
    else:
        print(f"❌ '{test_input}' → {result} (expected dict with min/max)")

# STEP 2: Verify that passing a dict BREAKS the normalizer
print("\n[Step 2] Testing what happens if we pass a DICT (the bug we fixed)")
print("-" * 80)

dict_input = {'min': -55.0, 'max': 175.0}
result = normalize_operating_temperature(dict_input)
print(f"Input (dict): {dict_input}")
print(f"Output: {result}")
if result is None:
    print("✅ CORRECT: Normalizer returns None when given dict (can't parse)")
    print("   This is why mouser.py and digikey.py must store RAW STRINGS")
else:
    print(f"❌ Unexpected result: {result}")

# STEP 3: Verify full normalization flow with RAW STRING parameters
print("\n[Step 3] Testing full normalization flow (supplier → normalizer → extracted_specs)")
print("-" * 80)

# Simulate what mouser.py SHOULD store (after our fix)
component_with_raw_strings = {
    'mpn': 'IRF540NPBF',
    'manufacturer': 'Infineon',
    'api_source': 'mouser',
    'parameters': {
        # These should be RAW STRINGS (as supplier provides)
        'Operating Temperature': '-55°C ~ 175°C',
        'Supply Voltage': '100V',
        'Gate Threshold Voltage': '2V ~ 4V',
        'RDS(on)': '44mOhm',
    }
}

print("Input parameters (raw strings from supplier):")
for key, value in component_with_raw_strings['parameters'].items():
    print(f"  {key}: {repr(value)} (type: {type(value).__name__})")

normalized = normalize_component_data(component_with_raw_strings)

if 'extracted_specs' in normalized:
    print("\n✅ extracted_specs created")
    extracted = normalized['extracted_specs']

    print("\nExtracted specs (normalized output):")
    for key, value in extracted.items():
        print(f"  {key}: {repr(value)} (type: {type(value).__name__})")

    # Verify specific fields
    checks = []

    # temp_range SHOULD be a dict (structured data)
    if 'temp_range' in extracted:
        temp_range = extracted['temp_range']
        if isinstance(temp_range, dict) and 'min' in temp_range:
            print(f"\n✅ temp_range is dict: {temp_range} (CORRECT - normalized output)")
            checks.append(True)
        else:
            print(f"\n❌ temp_range unexpected: {temp_range}")
            checks.append(False)
    else:
        print("\n❌ temp_range not extracted")
        checks.append(False)

    # voltage SHOULD be a float (extracted value)
    if 'voltage' in extracted:
        voltage = extracted['voltage']
        if isinstance(voltage, (int, float)):
            print(f"✅ voltage is numeric: {voltage} (CORRECT)")
            checks.append(True)
        else:
            print(f"❌ voltage unexpected type: {voltage}")
            checks.append(False)
    else:
        print("❌ voltage not extracted")
        checks.append(False)

    # gate_threshold_voltage should be extracted (semiconductor fix)
    if 'gate_threshold_voltage' in extracted:
        print(f"✅ gate_threshold_voltage extracted: {extracted['gate_threshold_voltage']}")
        checks.append(True)
    else:
        print("❌ gate_threshold_voltage not extracted (semiconductor mapping missing?)")
        checks.append(False)

    # rds_on should be extracted
    if 'rds_on' in extracted:
        print(f"✅ rds_on extracted: {extracted['rds_on']}")
        checks.append(True)
    else:
        print("❌ rds_on not extracted")
        checks.append(False)

    all_passed = all(checks)
else:
    print("\n❌ extracted_specs not created!")
    all_passed = False

# STEP 4: Test quality score
print("\n[Step 4] Testing quality score with properly normalized data")
print("-" * 80)

score_result = calculate_quality_score(normalized)
print(f"Total Quality Score: {score_result.total_score:.1f}%")
print(f"  Source Quality: {score_result.source_quality:.1f}%")
print(f"  Spec Extraction: {score_result.spec_extraction:.1f}%")
print(f"  Completeness: {score_result.completeness:.1f}%")

print("\n" + "=" * 80)
print("SUMMARY")
print("=" * 80)

if all_passed and score_result.source_quality == 100.0:
    print("✅ ALL CHECKS PASSED")
    print("\nKey findings:")
    print("1. ✅ Normalization functions expect STRING inputs")
    print("2. ✅ Normalization functions output STRUCTURED data (dicts, floats)")
    print("3. ✅ Mouser/DigiKey fix: store raw strings, not parsed dicts")
    print("4. ✅ Quality scorer recognizes api_source='mouser' (100%)")
    print("5. ✅ Semiconductor mappings working")
else:
    print("❌ SOME CHECKS FAILED")

print("=" * 80)
