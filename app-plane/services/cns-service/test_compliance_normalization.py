#!/usr/bin/env python3
"""Test compliance field normalization with real supplier string values"""
import sys
sys.path.insert(0, '/app')

from app.core.normalizers import normalize_component_data

# Simulate supplier data with compliance fields as strings (real supplier format)
test_component = {
    'mpn': 'ATMEGA328P-PU',
    'manufacturer': 'Microchip',
    'description': 'MCU 8-bit ATmega AVR RISC 32KB Flash',
    'parameters': {
        # RoHS field name test - should map to 'rohs_status'
        'RoHS': 'RoHS Compliant',

        # Compliance fields with string values (as suppliers provide)
        'RoHS Compliant': 'Yes',
        'REACH Compliant': 'Compliant',
        'Halogen Free': 'Yes',
        'AEC-Q100': 'Qualified',
    },
    # Direct compliance fields for testing
    'rohs_compliant': 'Yes',
    'reach_compliant': 'Compliant',
    'halogen_free': 'true',
    'aec_qualified': '1',
}

print("=" * 70)
print("Testing Compliance Field Normalization")
print("=" * 70)

print("\nInput fields:")
print(f"  RoHS parameter: {test_component['parameters']['RoHS']}")
print(f"  RoHS Compliant parameter: {test_component['parameters']['RoHS Compliant']}")
print(f"  rohs_compliant direct: {test_component['rohs_compliant']}")
print(f"  reach_compliant direct: {test_component['reach_compliant']}")
print(f"  halogen_free direct: {test_component['halogen_free']}")
print(f"  aec_qualified direct: {test_component['aec_qualified']}")

normalized = normalize_component_data(test_component)

print("\n" + "=" * 70)
print("Normalization Results")
print("=" * 70)

# Test 1: RoHS field name mapping
print("\n1. RoHS Field Name Mapping (rohs → rohs_status):")
if 'rohs_status' in normalized:
    print(f"   ✅ rohs_status: {normalized['rohs_status']}")
else:
    print(f"   ❌ rohs_status: MISSING")

# Test 2: Boolean string conversion for compliance fields
print("\n2. Boolean String Conversion:")

compliance_fields = {
    'rohs_compliant': ('Yes', True),
    'reach_compliant': ('Compliant', True),
    'halogen_free': ('true', True),
    'aec_qualified': ('1', True),
}

all_passed = True
for field, (input_val, expected) in compliance_fields.items():
    if field in normalized:
        actual = normalized[field]
        status = "✅" if actual == expected else "❌"
        print(f"   {status} {field}: {input_val} → {actual} (expected {expected})")
        if actual != expected:
            all_passed = False
    else:
        print(f"   ❌ {field}: MISSING")
        all_passed = False

# Test 3: Check extracted_specs has compliance data
print("\n3. Extracted Specs Compliance Fields:")
if 'extracted_specs' in normalized:
    extracted = normalized['extracted_specs']

    # Check for compliance fields in extracted_specs
    compliance_in_specs = {
        'rohs_compliant': extracted.get('rohs_compliant'),
        'reach_compliant': extracted.get('reach_compliant'),
        'halogen_free': extracted.get('halogen_free'),
        'aec_qualified': extracted.get('aec_qualified'),
    }

    for field, value in compliance_in_specs.items():
        if value is not None:
            print(f"   ✅ {field}: {value}")
        else:
            print(f"   ⚠️  {field}: not in extracted_specs (may be in root)")
else:
    print("   ❌ extracted_specs not created")

# Test 4: Overall compliance status
print("\n" + "=" * 70)
if all_passed:
    print("✅ ALL TESTS PASSED - Compliance fields handling string values correctly!")
else:
    print("❌ SOME TESTS FAILED - Check boolean string conversion")

print("=" * 70)
