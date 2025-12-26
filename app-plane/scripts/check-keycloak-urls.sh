#!/bin/bash
# =============================================================================
# Keycloak URL Consistency Check
# =============================================================================
# Ensures all Keycloak URLs use the standard port 8180
# Run: ./scripts/check-keycloak-urls.sh
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_PLANE_DIR="$(dirname "$SCRIPT_DIR")"

echo "Checking for non-standard Keycloak URLs..."
echo ""

# Define non-standard ports to check for
BAD_PORTS="localhost:14003|localhost:27210|localhost:27015"

# Search for bad URLs (excluding node_modules, backups, and this script)
FOUND=$(grep -rn "$BAD_PORTS" "$APP_PLANE_DIR" \
  --include="*.ts" \
  --include="*.tsx" \
  --include="*.env*" \
  --include="*.yml" \
  --include="*.yaml" \
  --include="*.json" \
  2>/dev/null | grep -v node_modules | grep -v ".backup" | grep -v "check-keycloak-urls" || true)

if [ -n "$FOUND" ]; then
  echo "ERROR: Found non-standard Keycloak URLs:"
  echo ""
  echo "$FOUND"
  echo ""
  echo "All Keycloak URLs should use http://localhost:8180"
  echo ""
  echo "To fix, replace:"
  echo "  - localhost:14003 -> localhost:8180"
  echo "  - localhost:27210 -> localhost:8180"
  echo "  - localhost:27015 -> localhost:8180"
  exit 1
else
  echo "OK: All Keycloak URLs use standard port 8180"
  exit 0
fi
