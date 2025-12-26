#!/usr/bin/env python3
"""Test that parameter normalization creates extracted_specs with real supplier format"""
import sys
sys.path.insert(0, '/app')

from app.core.normalizers import normalize_component_data

# Simulate supplier data with parameters (like Mouser/DigiKey would return)
# Using original parameter names with SPACES (as suppliers provide)
test_component = {
    'mpn': 'ATMEGA328P-PU',
    'manufacturer': 'Microchip',
    'description': 'MCU 8-bit ATmega AVR RISC 32KB Flash',
    'parameters': {
        'Operating Temperature': '-40°C ~ 85°C',
        'Supply Voltage': '1.8V ~ 5.5V',
        'Frequency': '20MHz',
        'Package / Case': 'DIP-28',
        'Resistance': '10K',
        'Capacitance': '100nF',
        'Current': '200mA',
        'Power': '1/4W',
        'Tolerance': '±5%',
        'Mounting Type': 'Through Hole',
    }
}

print("=" * 60)
print("Testing Parameter Normalization (Real Supplier Format)")
print("=" * 60)

print(f"\nInput parameters: {list(test_component['parameters'].keys())}")

normalized = normalize_component_data(test_component)

print(f"\nNormalized component keys: {list(normalized.keys())}")

if 'extracted_specs' in normalized:
    print(f"\n✅ extracted_specs created!")
    print(f"   Fields: {list(normalized['extracted_specs'].keys())}")
    print(f"\n   Checking quality scorer expectations:")

    expected_fields = ["package", "voltage", "current", "power", "resistance", "capacitance", "frequency", "temp_range", "tolerance", "mounting_type"]
    found = []
    missing = []

    for field in expected_fields:
        if field in normalized['extracted_specs']:
            found.append(field)
            print(f"   ✅ {field}: {normalized['extracted_specs'][field]}")
        else:
            missing.append(field)
            print(f"   ❌ {field}: MISSING")

    print(f"\n   Score: {len(found)}/{len(expected_fields)} = {(len(found)/len(expected_fields))*100:.1f}%")

    if len(found) >= 8:  # Need at least 80% for good score
        print(f"\n   🎉 Should get 80%+ on spec extraction (worth 20% of total)")
        print(f"   Estimated quality score: 85+ (well above 80 threshold!)")
    else:
        print(f"\n   ⚠️  Low spec extraction score, quality may still be < 80")
else:
    print(f"\n❌ extracted_specs NOT created!")
    print(f"   This means quality scorer will give 0 points for spec extraction")

print("\n" + "=" * 60)
