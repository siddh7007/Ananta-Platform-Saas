#!/bin/bash
# ==============================================================================
# MinIO Bucket Initialization Script
# ==============================================================================
# Port: 27040 (API), 27041 (Console)
# Based on docker-compose.yml minio-init service
#
# This script creates all required buckets for the Ananta Platform.
# Run after MinIO is healthy.
#
# Usage:
#   ./init-buckets.sh                    # Uses defaults
#   MINIO_ENDPOINT=localhost:27040 ./init-buckets.sh
#   docker exec -it app-plane-minio /bin/sh -c "$(cat init-buckets.sh)"
# ==============================================================================

set -e

# Configuration (can be overridden by environment variables)
MINIO_ENDPOINT="${MINIO_ENDPOINT:-http://minio:9000}"
MINIO_ROOT_USER="${MINIO_ROOT_USER:-minioadmin}"
MINIO_ROOT_PASSWORD="${MINIO_ROOT_PASSWORD:-minioadmin}"
MINIO_ALIAS="${MINIO_ALIAS:-myminio}"

# Bucket names
S3_BUCKET_NAME="${S3_BUCKET_NAME:-bom-uploads}"
S3_BUCKET_DOCUMENTS="${S3_BUCKET_DOCUMENTS:-documents}"
S3_BUCKET_EXPORTS="${S3_BUCKET_EXPORTS:-exports}"
S3_BUCKET_AVATARS="${S3_BUCKET_AVATARS:-avatars}"
S3_BUCKET_AUDIT="${S3_BUCKET_AUDIT:-enrichment-audit}"
S3_BUCKET_BULK="${S3_BUCKET_BULK:-bulk-uploads}"
S3_BUCKET_NOVU="${S3_BUCKET_NOVU:-novu-storage}"

echo "=============================================="
echo "MinIO Bucket Initialization"
echo "=============================================="
echo "Endpoint: ${MINIO_ENDPOINT}"
echo "User: ${MINIO_ROOT_USER}"
echo ""

# Wait for MinIO to be ready
echo "Waiting for MinIO to be ready..."
until curl -sf "${MINIO_ENDPOINT}/minio/health/live" > /dev/null 2>&1; do
    echo "MinIO not ready, waiting..."
    sleep 2
done
echo "MinIO is ready!"

# Configure mc alias
echo ""
echo "Configuring MinIO client alias..."
mc alias set "${MINIO_ALIAS}" "${MINIO_ENDPOINT}" "${MINIO_ROOT_USER}" "${MINIO_ROOT_PASSWORD}"

# Create buckets
echo ""
echo "Creating buckets..."

mc mb "${MINIO_ALIAS}/${S3_BUCKET_NAME}" --ignore-existing
echo "  Created: ${S3_BUCKET_NAME}"

mc mb "${MINIO_ALIAS}/${S3_BUCKET_DOCUMENTS}" --ignore-existing
echo "  Created: ${S3_BUCKET_DOCUMENTS}"

mc mb "${MINIO_ALIAS}/${S3_BUCKET_EXPORTS}" --ignore-existing
echo "  Created: ${S3_BUCKET_EXPORTS}"

mc mb "${MINIO_ALIAS}/${S3_BUCKET_AVATARS}" --ignore-existing
echo "  Created: ${S3_BUCKET_AVATARS}"

mc mb "${MINIO_ALIAS}/${S3_BUCKET_AUDIT}" --ignore-existing
echo "  Created: ${S3_BUCKET_AUDIT}"

mc mb "${MINIO_ALIAS}/${S3_BUCKET_BULK}" --ignore-existing
echo "  Created: ${S3_BUCKET_BULK}"

mc mb "${MINIO_ALIAS}/${S3_BUCKET_NOVU}" --ignore-existing
echo "  Created: ${S3_BUCKET_NOVU}"

# Set public access for avatars bucket
echo ""
echo "Setting public access for avatars bucket..."
mc anonymous set download "${MINIO_ALIAS}/${S3_BUCKET_AVATARS}"

# List all buckets
echo ""
echo "=============================================="
echo "Bucket Summary"
echo "=============================================="
mc ls "${MINIO_ALIAS}"

echo ""
echo "MinIO buckets initialized successfully!"
echo ""
echo "Access URLs:"
echo "  API: ${MINIO_ENDPOINT}"
echo "  Console: ${MINIO_ENDPOINT/9000/9001}"
