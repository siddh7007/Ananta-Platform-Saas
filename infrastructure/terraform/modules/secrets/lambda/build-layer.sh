#!/bin/bash
# =============================================================================
# Build psycopg2 Lambda Layer
# =============================================================================
# This script builds a psycopg2 Lambda layer compatible with Python 3.11
# runtime using Docker to ensure compatibility with AWS Lambda environment.
#
# Usage: ./build-layer.sh
# Output: layers/psycopg2-layer.zip
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LAYERS_DIR="${SCRIPT_DIR}/layers"
PYTHON_DIR="${LAYERS_DIR}/python"

echo "[INFO] Building psycopg2 Lambda layer..."
echo "[INFO] Script directory: ${SCRIPT_DIR}"

# Cleanup previous builds
if [ -d "${LAYERS_DIR}" ]; then
    echo "[INFO] Cleaning up previous build artifacts..."
    rm -rf "${LAYERS_DIR}"
fi

# Create directories
mkdir -p "${PYTHON_DIR}"

echo "[INFO] Installing psycopg2-binary using Docker..."

# Use AWS Lambda Python 3.11 runtime container to build layer
docker run --rm \
    -v "${LAYERS_DIR}:/out" \
    public.ecr.aws/lambda/python:3.11 \
    /bin/bash -c "pip install psycopg2-binary -t /out/python && chmod -R 755 /out"

if [ $? -ne 0 ]; then
    echo "[ERROR] Failed to install psycopg2-binary"
    exit 1
fi

echo "[INFO] Creating layer zip archive..."
cd "${LAYERS_DIR}"
zip -r psycopg2-layer.zip python/ -q

if [ $? -ne 0 ]; then
    echo "[ERROR] Failed to create zip archive"
    exit 1
fi

# Get zip size
LAYER_SIZE=$(du -h psycopg2-layer.zip | cut -f1)
echo "[OK] Layer built successfully: ${LAYERS_DIR}/psycopg2-layer.zip (${LAYER_SIZE})"

# Cleanup python directory
echo "[INFO] Cleaning up temporary files..."
rm -rf "${PYTHON_DIR}"

echo "[OK] Build complete!"
echo ""
echo "Next steps:"
echo "1. Verify layer exists: ls -lh ${LAYERS_DIR}/psycopg2-layer.zip"
echo "2. Deploy with Terraform: terraform apply"
echo ""
