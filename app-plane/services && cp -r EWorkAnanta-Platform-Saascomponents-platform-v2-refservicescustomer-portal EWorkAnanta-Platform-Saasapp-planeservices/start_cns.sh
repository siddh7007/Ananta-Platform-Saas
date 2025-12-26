#!/bin/bash
# CNS Service Startup Script (Host-based Development)
# NOTE: For production, use Docker Compose instead
# Clears docker-compose environment variables and uses local .env file

echo "Starting CNS Service on Host..."
echo "WARNING: This runs CNS on the host. For production, use Docker Compose."
echo

# Load CNS_PORT from .env or use default
export CNS_PORT=${CNS_PORT:-27800}

# Unset docker-compose environment variables
unset DATABASE_URL
unset CORS_ORIGINS
unset ALLOWED_FILE_EXTENSIONS

# Start CNS service with reload for development
cd "$(dirname "$0")"
echo "Starting on port $CNS_PORT..."
python -m uvicorn app.main:app --host 0.0.0.0 --port $CNS_PORT --reload
