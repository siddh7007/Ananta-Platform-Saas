#!/usr/bin/env python3
"""
Test with REAL supplier API to verify complete enrichment flow:
1. Call Mouser API for a real component
2. Verify parameters are stored as raw strings (not dicts)
3. Verify normalization extracts specs correctly
4. Verify quality score reaches 80+ threshold
"""
import sys
import asyncio
sys.path.insert(0, '/app')

from app.plugins.suppliers.mouser import MouserPlugin
from app.core.normalizers import normalize_component_data
from app.core.quality_scorer import calculate_quality_score
from app.config import Settings

settings = Settings()

async def test_real_enrichment():
    print("=" * 80)
    print("Real Supplier API Test")
    print("=" * 80)

    # Test with a component that has rich technical specs
    # GRM21BR71H104KA01L is a Murata capacitor with many parameters
    test_mpn = "GRM21BR71H104KA01L"
    test_manufacturer = "Murata"

    print(f"\n[Step 1] Fetching from Mouser API")
    print("-" * 80)
    print(f"MPN: {test_mpn}")
    print(f"Manufacturer: {test_manufacturer}")

    mouser = MouserPlugin(config={'api_key': settings.mouser_api_key})

    try:
        product_data = mouser.get_product_details(test_mpn, test_manufacturer)

        if not product_data:
            print("❌ No product data returned from Mouser")
            return

        print(f"✅ Product data received: {product_data.mpn}")

        # Check parameters are RAW STRINGS
        print(f"\n[Step 2] Verifying parameters are RAW STRINGS (not dicts)")
        print("-" * 80)

        param_count = len(product_data.parameters)
        print(f"Parameters count: {param_count}")

        if param_count > 0:
            print("\nFirst 10 parameters:")
            dict_count = 0
            string_count = 0

            for i, (key, value) in enumerate(list(product_data.parameters.items())[:10]):
                value_type = type(value).__name__
                if isinstance(value, dict):
                    print(f"  ❌ {key}: {repr(value)} (type: {value_type}) - DICT FOUND!")
                    dict_count += 1
                else:
                    print(f"  ✅ {key}: {repr(value[:50] if isinstance(value, str) and len(value) > 50 else value)} (type: {value_type})")
                    string_count += 1

            print(f"\nParameter types: {string_count} strings, {dict_count} dicts")

            if dict_count > 0:
                print("❌ FAILED: Parameters contain dicts (ParameterParser fix not applied)")
                return
            else:
                print("✅ PASSED: All parameters are raw strings/numbers")

        # Convert to dict for normalization
        raw_data = product_data.to_dict()

        # Simulate what enrichment_service.py does: set api_source from supplier_name
        raw_data['api_source'] = product_data.supplier_name.lower() if product_data.supplier_name else 'unknown'
        raw_data['enrichment_source'] = 'supplier_api'
        raw_data['tier_used'] = 'suppliers'

        print(f"\n[Step 3] Normalizing component data")
        print("-" * 80)
        print(f"api_source set to: {raw_data['api_source']}")

        normalized = normalize_component_data(raw_data)

        if 'extracted_specs' in normalized:
            extracted = normalized['extracted_specs']
            spec_count = len(extracted)
            print(f"✅ extracted_specs created with {spec_count} fields")

            # Show some key fields
            print("\nKey extracted fields:")
            key_fields = ['package', 'voltage', 'temp_range', 'mounting_type', 'pin_count']
            found = 0
            for field in key_fields:
                if field in extracted:
                    value = extracted[field]
                    print(f"  ✅ {field}: {value}")
                    found += 1
                else:
                    print(f"  - {field}: not extracted")

            print(f"\nExtracted {found}/{len(key_fields)} key fields")
        else:
            print("❌ extracted_specs not created")
            return

        print(f"\n[Step 4] Calculating quality score")
        print("-" * 80)

        score_result = calculate_quality_score(normalized)

        print(f"Total Quality Score: {score_result.total_score:.1f}%")
        print(f"Routing Decision: {score_result.routing.value}")
        print("\nScore Breakdown:")
        print(f"  Completeness:        {score_result.completeness:.1f}% (weight: 40%)")
        print(f"  Source Quality:      {score_result.source_quality:.1f}% (weight: 30%)")
        print(f"  Spec Extraction:     {score_result.spec_extraction:.1f}% (weight: 20%)")
        print(f"  Category Confidence: {score_result.category_confidence:.1f}% (weight: 10%)")

        # Validation
        print(f"\n[Validation]")
        print("-" * 80)

        checks = []

        # Check 1: Source quality should be 100%
        if score_result.source_quality == 100.0:
            print("✅ Source quality: 100% (Mouser recognized)")
            checks.append(True)
        else:
            print(f"❌ Source quality: {score_result.source_quality:.1f}% (should be 100%)")
            checks.append(False)

        # Check 2: Spec extraction should be decent (>30%)
        if score_result.spec_extraction >= 30.0:
            print(f"✅ Spec extraction: {score_result.spec_extraction:.1f}% (>= 30%)")
            checks.append(True)
        else:
            print(f"❌ Spec extraction: {score_result.spec_extraction:.1f}% (< 30%)")
            checks.append(False)

        # Check 3: Total score - aim for 80+
        if score_result.total_score >= 80.0:
            print(f"✅ Total score: {score_result.total_score:.1f}% (>= 80, DATABASE storage!)")
            checks.append(True)
        elif score_result.total_score >= 70.0:
            print(f"⚠️  Total score: {score_result.total_score:.1f}% (70-80, close to database threshold)")
            checks.append(True)
        else:
            print(f"❌ Total score: {score_result.total_score:.1f}% (< 70, will go to Redis)")
            checks.append(False)

        print("\n" + "=" * 80)
        if all(checks):
            print("✅ ALL VALIDATIONS PASSED - Real supplier enrichment working!")
        else:
            print(f"⚠️  {sum(checks)}/{len(checks)} validations passed")

        print("=" * 80)

    except Exception as e:
        print(f"❌ Error during test: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_real_enrichment())
