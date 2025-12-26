# =============================================================================
# OpenTelemetry Collector with AWS X-Ray Support
# =============================================================================

FROM otel/opentelemetry-collector-contrib:0.91.0

# Add health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:13133/health || exit 1

# Set working directory
WORKDIR /etc/otel

# Default command (config path can be overridden)
CMD ["--config=/etc/otel-collector-config.yaml"]
