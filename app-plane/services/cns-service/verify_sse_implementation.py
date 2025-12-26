#!/usr/bin/env python3
"""
SSE Implementation Verification Script

Verifies that all components of the SSE enrichment progress implementation
are correctly configured and operational.

Usage:
    python verify_sse_implementation.py
"""

import os
import sys
from pathlib import Path


def check_file_exists(file_path: str, description: str) -> bool:
    """Check if a file exists"""
    path = Path(file_path)
    if path.exists():
        print(f"[OK] {description}: {file_path}")
        return True
    else:
        print(f"[FAIL] {description} MISSING: {file_path}")
        return False


def check_import(module_path: str, description: str) -> bool:
    """Check if a Python module can be imported"""
    try:
        module_parts = module_path.rsplit('.', 1)
        if len(module_parts) == 2:
            module_name, attr_name = module_parts
            module = __import__(module_name, fromlist=[attr_name])
            getattr(module, attr_name)
        else:
            __import__(module_path)
        print(f"[OK] {description}: {module_path}")
        return True
    except ImportError as e:
        print(f"[FAIL] {description} import failed: {e}")
        return False
    except AttributeError as e:
        print(f"[FAIL] {description} attribute not found: {e}")
        return False


def check_endpoint_registered(description: str) -> bool:
    """Check if SSE endpoint is registered in API router"""
    try:
        from app.api import api_router

        # Check if enrichment_stream router is included
        routes = [route.path for route in api_router.routes]
        sse_routes = [r for r in routes if '/enrichment/stream' in r]

        if sse_routes:
            print(f"[OK] {description}: {', '.join(sse_routes)}")
            return True
        else:
            print(f"[FAIL] {description}: No SSE routes found")
            return False
    except Exception as e:
        print(f"[FAIL] {description} check failed: {e}")
        return False


def check_redis_connection() -> bool:
    """Check if Redis is accessible"""
    try:
        from app.cache.redis_cache import get_cache

        cache = get_cache()
        if cache and cache.is_connected:
            print("[OK] Redis connection: Connected")
            return True
        else:
            print("[WARN]  Redis connection: Not connected (may need to start services)")
            return False
    except Exception as e:
        print(f"[WARN]  Redis connection check failed: {e}")
        return False


def check_database_table(table_name: str) -> bool:
    """Check if database table exists"""
    try:
        from app.models.dual_database import get_dual_database
        from sqlalchemy import text

        dual_db = get_dual_database()
        db = next(dual_db.get_session("supabase"))

        result = db.execute(text(f"""
            SELECT EXISTS (
                SELECT FROM information_schema.tables
                WHERE table_name = '{table_name}'
            )
        """))

        exists = result.scalar()

        if exists:
            print(f"[OK] Database table '{table_name}': Exists")
            return True
        else:
            print(f"[FAIL] Database table '{table_name}': NOT FOUND")
            return False
    except Exception as e:
        print(f"[WARN]  Database table check failed: {e}")
        return False


def main():
    print("=" * 70)
    print("SSE ENRICHMENT PROGRESS IMPLEMENTATION VERIFICATION")
    print("=" * 70)
    print()

    results = []

    # 1. Check core files
    print("[1/7] Checking core implementation files...")
    results.append(check_file_exists(
        "app/api/enrichment_stream.py",
        "SSE endpoint implementation"
    ))
    results.append(check_file_exists(
        "app/workflows/bom_enrichment.py",
        "Enrichment workflow"
    ))
    results.append(check_file_exists(
        "app/cache/redis_cache.py",
        "Redis cache utilities"
    ))
    print()

    # 2. Check imports
    print("[2/7] Checking Python imports...")
    results.append(check_import(
        "app.api.enrichment_stream.enrichment_event_stream",
        "SSE event stream generator"
    ))
    results.append(check_import(
        "app.workflows.bom_enrichment.publish_enrichment_event",
        "Publish enrichment event activity"
    ))
    results.append(check_import(
        "app.workflows.bom_enrichment.update_bom_progress",
        "Update BOM progress activity"
    ))
    results.append(check_import(
        "app.cache.redis_cache.get_redis_client",
        "Async Redis client"
    ))
    print()

    # 3. Check API router registration
    print("[3/7] Checking API router registration...")
    results.append(check_endpoint_registered(
        "SSE endpoint registration"
    ))
    print()

    # 4. Check Redis connection
    print("[4/7] Checking Redis connection...")
    redis_ok = check_redis_connection()
    results.append(redis_ok)
    print()

    # 5. Check database table
    print("[5/7] Checking database schema...")
    db_ok = check_database_table("enrichment_events")
    results.append(db_ok)
    print()

    # 6. Check documentation
    print("[6/7] Checking documentation...")
    results.append(check_file_exists(
        "SSE_ENRICHMENT_PROGRESS_IMPLEMENTATION.md",
        "Implementation documentation"
    ))
    results.append(check_file_exists(
        "tests/test_sse_enrichment_stream.py",
        "Test suite"
    ))
    results.append(check_file_exists(
        "examples/sse_client_example.py",
        "Client example"
    ))
    print()

    # 7. Check CORS configuration
    print("[7/7] Checking CORS configuration...")
    try:
        from app.main import app

        # Check if CORS middleware is configured
        middlewares = [m.cls.__name__ for m in app.user_middleware]
        if 'CORSMiddleware' in middlewares:
            print("[OK] CORS middleware: Configured")
            results.append(True)
        else:
            print("[FAIL] CORS middleware: Not configured")
            results.append(False)
    except Exception as e:
        print(f"[WARN]  CORS configuration check failed: {e}")
        results.append(False)
    print()

    # Summary
    print("=" * 70)
    passed = sum(results)
    total = len(results)
    percentage = (passed / total * 100) if total > 0 else 0

    print(f"VERIFICATION SUMMARY: {passed}/{total} checks passed ({percentage:.1f}%)")
    print("=" * 70)
    print()

    if passed == total:
        print("[OK] ALL CHECKS PASSED - SSE implementation is complete!")
        print()
        print("Next steps:")
        print("1. Start Redis: docker-compose up -d app-plane-redis")
        print("2. Start CNS service: cd app && python -m uvicorn main:app --reload")
        print("3. Test SSE endpoint:")
        print("   curl -N http://localhost:27200/api/enrichment/stream/{bom_id}?token=xxx")
        print()
        return 0
    else:
        print("[WARN]  SOME CHECKS FAILED - Review errors above")
        print()
        if not redis_ok:
            print("Note: Redis connection failures are expected if services are not running.")
        if not db_ok:
            print("Note: Database checks require Supabase to be running.")
        print()
        return 1


if __name__ == '__main__':
    sys.exit(main())
