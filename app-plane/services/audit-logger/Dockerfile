# Audit Logger Service - Dockerfile
# RabbitMQ event consumer that stores audit logs in Supabase

FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY services/audit-logger/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy shared module first
COPY shared/ /app/shared/

# Copy application code
COPY services/audit-logger/app/ /app/

# Run as non-root user
RUN useradd -m -u 1000 audit-logger && chown -R audit-logger:audit-logger /app
USER audit-logger

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD python -c "from supabase_client import SupabaseClient; SupabaseClient().health_check()" || exit 1

# Start service
CMD ["python", "-u", "main.py"]
