# syntax=docker/dockerfile:1.4

# Component Intelligence Portal (CIP) Service - Dockerfile
# Multi-stage build for production-ready image with BuildKit cache optimization

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
COPY requirements.txt .

# Install Python dependencies with BuildKit cache mount
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install --no-cache-dir -r requirements.txt

# ==========================================
# Stage 3: Application
# ==========================================
FROM dependencies as application

# Copy application code
COPY --chown=cipuser:cipuser app/ ./app/
COPY --chown=cipuser:cipuser migrations/ ./migrations/

# Switch to non-root user
USER cipuser

# Expose port (default 27800, uses CNS_PORT env var)
EXPOSE 27800 27801

# Health check (uses CNS_PORT from environment, fallback 27800)
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:${CNS_PORT:-27800}/health || exit 1

# Start command (uses CNS_PORT from environment, fallback 27800)
CMD uvicorn app.main:app --host 0.0.0.0 --port ${CNS_PORT:-27800}

# ==========================================
# Stage 4: Development (Optional)
# ==========================================
FROM dependencies as development

# Install development dependencies
COPY requirements-dev.txt .
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install --no-cache-dir -r requirements-dev.txt

# Copy application code
COPY --chown=cipuser:cipuser app/ ./app/
COPY --chown=cipuser:cipuser migrations/ ./migrations/
COPY --chown=cipuser:cipuser tests/ ./tests/

# Switch to non-root user
USER cipuser

# Expose ports (main + metrics)
EXPOSE 27800 27801

# Development command with hot reload (uses CNS_PORT from environment, fallback 27800)
CMD uvicorn app.main:app --host 0.0.0.0 --port ${CNS_PORT:-27800} --reload
