#!/usr/bin/env python3
"""Debug script to find which config field is causing JSON parsing error"""
import os
import sys
from pathlib import Path

# Load .env manually
env_file = Path(__file__).parent / ".env"
env_vars = {}

if env_file.exists():
    with open(env_file) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#'):
                if '=' in line:
                    key, value = line.split('=', 1)
                    env_vars[key.strip()] = value.strip()

print("Environment variables that might cause JSON parsing issues:")
print("=" * 70)

# Check for variables that might be parsed as JSON
problem_vars = []
for key, value in env_vars.items():
    # Check if it's a List field that might cause issues
    if value and (value.startswith('[') or value.startswith('{') or ',' in value):
        print(f"⚠️  {key} = {value[:100]}...")
        problem_vars.append((key, value))

print("\n" + "=" * 70)
print(f"Found {len(problem_vars)} potentially problematic variables")

# Now try importing config to see actual error
print("\nAttempting to import config...")
print("=" * 70)

try:
    from app.config import Settings
    settings = Settings()
    print("✅ SUCCESS! Config loaded without errors.")
except Exception as e:
    print(f"❌ ERROR: {type(e).__name__}")
    print(f"Message: {str(e)}")

    # Try to extract which field failed
    import traceback
    tb = traceback.format_exc()
    print("\nFull traceback:")
    print(tb)

    # Look for field name in traceback
    if "field_name" in tb:
        print("\n🔍 Searching for field name in error...")
