#!/usr/bin/env python3
"""
Comprehensive test for all critical fixes:
1. ParameterParser fix: raw strings stored, not dicts
2. Semiconductor spec mappings: gate_threshold_voltage, collector_emitter_voltage
3. Quality scorer: finding advanced spec fields
4. Compliance fields: handling string values
"""
import sys
sys.path.insert(0, '/app')

from app.core.normalizers import normalize_component_data
from app.core.quality_scorer import calculate_quality_score

# Simulate supplier data with all types of parameters
test_component = {
    'mpn': 'IRF540NPBF',
    'manufacturer': 'Infineon',
    'description': 'MOSFET N-CH 100V 33A TO-220AB',
    'api_source': 'mouser',  # Should score 100% for source quality (30% of total)
    'parameters': {
        # Basic electrical (should map via PARAM_MAPPINGS)
        'Operating Temperature': '-55°C ~ 175°C',
        'Supply Voltage': '100V',
        'Current': '33A',
        'Power': '130W',
        'Resistance': '44mOhm',
        'Package / Case': 'TO-220AB',
        'Mounting Type': 'Through Hole',
        'Tolerance': '±10%',

        # Semiconductor-specific (NEW MAPPINGS)
        'Gate Threshold Voltage': '2V ~ 4V',
        'VGS(th)': '3V',
        'Switching Frequency': '1MHz',
        'RDS(on)': '44mOhm',

        # Compliance
        'RoHS': 'RoHS Compliant',
        'RoHS Compliant': 'Yes',
        'REACH Compliant': 'Compliant',
    },
    # Direct fields
    'rohs_compliant': 'Yes',
    'reach_compliant': 'Compliant',
    'category': 'Discrete Semiconductors > Transistors - FETs, MOSFETs - Single',
}

print("=" * 80)
print("Comprehensive Fix Validation Test")
print("=" * 80)

print("\n[1/4] Testing Parameter Normalization (raw strings, not dicts)")
print("-" * 80)
normalized = normalize_component_data(test_component)

# Check that extracted_specs exists and has fields
if 'extracted_specs' not in normalized:
    print("❌ CRITICAL: extracted_specs not created!")
    sys.exit(1)

extracted = normalized['extracted_specs']
print(f"✅ extracted_specs created with {len(extracted)} fields")

# Check specific fields that should be extracted
expected_basic = {
    'temp_range': 'Operating Temperature',
    'voltage': 'Supply Voltage',
    'current': 'Current',
    'power': 'Power',
    'resistance': 'Resistance',
    'package': 'Package / Case',
    'mounting_type': 'Mounting Type',
    'tolerance': 'Tolerance',
}

print("\nBasic parameter mappings:")
basic_pass = 0
for canonical, vendor_name in expected_basic.items():
    if canonical in extracted:
        value = extracted[canonical]
        # Check it's a STRING not a dict (ParameterParser fix validation)
        if isinstance(value, dict):
            print(f"  ❌ {canonical}: GOT DICT (ParameterParser not fixed!)")
            print(f"     Value: {value}")
        else:
            print(f"  ✅ {canonical}: {value} (from '{vendor_name}')")
            basic_pass += 1
    else:
        print(f"  ❌ {canonical}: MISSING (from '{vendor_name}')")

print(f"\nBasic mappings: {basic_pass}/{len(expected_basic)} passed")

print("\n[2/4] Testing Semiconductor Spec Mappings (NEW)")
print("-" * 80)

expected_semiconductor = {
    'gate_threshold_voltage': 'Gate Threshold Voltage / VGS(th)',
    'switching_frequency': 'Switching Frequency',
    'rds_on': 'RDS(on)',
}

print("Semiconductor parameter mappings:")
semi_pass = 0
for canonical, vendor_name in expected_semiconductor.items():
    if canonical in extracted:
        value = extracted[canonical]
        print(f"  ✅ {canonical}: {value} (from '{vendor_name}')")
        semi_pass += 1
    else:
        print(f"  ❌ {canonical}: MISSING (from '{vendor_name}')")

print(f"\nSemiconductor mappings: {semi_pass}/{len(expected_semiconductor)} passed")

print("\n[3/4] Testing Quality Scorer")
print("-" * 80)

score_result = calculate_quality_score(normalized)

print(f"Total Quality Score: {score_result.total_score:.1f}%")
print(f"Routing Decision: {score_result.routing.value}")
print("\nScore Breakdown:")
print(f"  Completeness:        {score_result.completeness:.1f}% (weight: 40%)")
print(f"  Source Quality:      {score_result.source_quality:.1f}% (weight: 30%)")
print(f"  Spec Extraction:     {score_result.spec_extraction:.1f}% (weight: 20%)")
print(f"  Category Confidence: {score_result.category_confidence:.1f}% (weight: 10%)")

if score_result.issues:
    print("\nIssues Detected:")
    for issue in score_result.issues:
        print(f"  - {issue}")

# Specific validations
print("\nValidation Checks:")

# Check 1: Source quality should be 100% (mouser)
if score_result.source_quality == 100.0:
    print("  ✅ Source quality: 100% (api_source='mouser' recognized)")
else:
    print(f"  ❌ Source quality: {score_result.source_quality:.1f}% (should be 100% for mouser)")

# Check 2: Spec extraction should be high (10+ fields extracted)
spec_count = len([f for f in extracted if f in [
    'package', 'voltage', 'current', 'power', 'resistance', 'capacitance',
    'inductance', 'frequency', 'temp_range', 'tolerance', 'pin_count',
    'mounting_type', 'pitch', 'esr', 'dcr', 'rds_on', 'forward_voltage',
    'reverse_voltage', 'saturation_current', 'switching_frequency',
    'gate_threshold_voltage', 'collector_emitter_voltage'
]])

print(f"  ℹ️  Spec fields found: {spec_count}/23 quality scorer fields")
if score_result.spec_extraction >= 40.0:  # At least 40% of spec fields
    print(f"  ✅ Spec extraction: {score_result.spec_extraction:.1f}% (>= 40%)")
else:
    print(f"  ❌ Spec extraction: {score_result.spec_extraction:.1f}% (< 40%)")

# Check 3: Overall score should be >= 80
if score_result.total_score >= 80.0:
    print(f"  ✅ Total score: {score_result.total_score:.1f}% (>= 80, will go to database!)")
else:
    print(f"  ⚠️  Total score: {score_result.total_score:.1f}% (< 80, will go to Redis)")

print("\n[4/4] Testing Compliance Fields")
print("-" * 80)

compliance_fields = ['rohs_compliant', 'reach_compliant', 'halogen_free', 'aec_qualified']
print("Boolean string conversion:")
compliance_pass = 0
for field in compliance_fields:
    if field in normalized:
        value = normalized[field]
        if value is True:
            print(f"  ✅ {field}: {value} (string converted to boolean)")
            compliance_pass += 1
        else:
            print(f"  ⚠️  {field}: {value} (not True)")
    else:
        print(f"  - {field}: not present")

print("\n" + "=" * 80)
print("SUMMARY")
print("=" * 80)

all_checks = [
    ("ParameterParser fix (raw strings)", basic_pass == len(expected_basic)),
    ("Semiconductor mappings", semi_pass == len(expected_semiconductor)),
    ("Source quality (mouser=100%)", score_result.source_quality == 100.0),
    ("Spec extraction (>= 40%)", score_result.spec_extraction >= 40.0),
    ("Quality score (>= 80%)", score_result.total_score >= 80.0),
    ("Compliance fields", compliance_pass >= 2),
]

passed = sum(1 for _, check in all_checks if check)
total = len(all_checks)

for check_name, result in all_checks:
    status = "✅" if result else "❌"
    print(f"{status} {check_name}")

print(f"\n{'='*80}")
if passed == total:
    print(f"🎉 ALL CHECKS PASSED ({passed}/{total})")
    print("Components should now achieve 80+ quality scores and go to database!")
else:
    print(f"⚠️  SOME CHECKS FAILED ({passed}/{total} passed)")
    print("Review the issues above.")

print("=" * 80)
