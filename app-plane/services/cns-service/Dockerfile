# syntax=docker/dockerfile:1.4

# Component Intelligence Portal (CIP) Service - Dockerfile
# Multi-stage build for production-ready image with BuildKit cache optimization
# NOTE: This Dockerfile expects context to be ./services/cns-service

# ==========================================
# Stage 1: Base Python Image
# ==========================================
FROM python:3.11-slim as base

# Set environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Install system dependencies with BuildKit cache mount
RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,target=/var/lib/apt,sharing=locked \
    apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    postgresql-client \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create app user (non-root for security)
RUN useradd -m -u 1000 cipuser && \
    mkdir -p /app && \
    chown -R cipuser:cipuser /app

WORKDIR /app

# ==========================================
# Stage 2: Dependencies Installation
# ==========================================
FROM base as dependencies

# Copy requirements first (for Docker layer caching)
# Context is ./services/cns-service so use local paths
COPY requirements.txt .

# Install Python dependencies with BuildKit cache mount
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install --no-cache-dir -r requirements.txt

# ==========================================
# Stage 3: Application
# ==========================================
FROM dependencies as application

# Copy shared module first (from context/shared if it exists)
COPY --chown=cipuser:cipuser shared/ ./shared/

# Copy application code (local paths within context)
COPY --chown=cipuser:cipuser app/ ./app/
COPY --chown=cipuser:cipuser migrations/ ./migrations/

# Switch to non-root user
USER cipuser

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Start command
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]

# ==========================================
# Stage 4: Development (Optional)
# ==========================================
FROM dependencies as development

# Install development dependencies
COPY requirements-dev.txt .
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install --no-cache-dir -r requirements-dev.txt

# Copy shared module first
COPY --chown=cipuser:cipuser shared/ ./shared/

# Copy application code
COPY --chown=cipuser:cipuser app/ ./app/
COPY --chown=cipuser:cipuser migrations/ ./migrations/
# Tests are optional, only copy if exists
RUN mkdir -p ./tests

# Switch to non-root user
USER cipuser

# Expose port
EXPOSE 8000

# Development command with hot reload
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
