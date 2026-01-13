"""
Configuration Management for CNS (Component Normalization Service)

Loads environment variables and provides typed configuration objects.
"""

from typing import List, Optional
from pydantic_settings import BaseSettings
from pydantic import Field, field_validator


class Settings(BaseSettings):
    """Main configuration class for CNS (Component Normalization Service)"""

    # ===================================
    # Service Configuration
    # ===================================
    service_name: str = Field(default="cns-service", alias="SERVICE_NAME")
    port: int = Field(default=27800, alias="PORT")  # Alias for cns_port
    cns_port: int = Field(default=27800, alias="CNS_PORT")
    cns_host: str = Field(default="0.0.0.0", alias="CNS_HOST")
    log_level: str = Field(default="INFO", alias="LOG_LEVEL")
    environment: str = Field(default="development", alias="ENVIRONMENT")
    public_dashboard_url: Optional[str] = Field(default=None, alias="PUBLIC_DASHBOARD_URL")

    # ===================================
    # Database Configuration
    # ===================================
    database_url: str = Field(..., alias="DATABASE_URL")

    @field_validator('database_url')
    @classmethod
    def strip_database_url(cls, v: str) -> str:
        """Strip whitespace from database URL"""
        return v.strip() if v else v
    db_pool_size: int = Field(default=20, alias="DB_POOL_SIZE")  # Alias
    database_pool_size: int = Field(default=20, alias="DATABASE_POOL_SIZE")
    db_max_overflow: int = Field(default=10, alias="DB_MAX_OVERFLOW")  # Alias
    database_max_overflow: int = Field(default=10, alias="DATABASE_MAX_OVERFLOW")

    # Redis Cache
    redis_enabled: bool = Field(default=True, alias="REDIS_ENABLED")
    redis_url: str = Field(default="redis://localhost:6379/0", alias="REDIS_URL")
    cache_ttl_seconds: int = Field(default=3600, alias="CACHE_TTL_SECONDS")  # 1 hour
    redis_cache_ttl: int = Field(default=3600, alias="REDIS_CACHE_TTL")  # Backward compat

    # ===================================
    # Temporal Workflow Configuration
    # ===================================
    temporal_enabled: bool = Field(default=False, alias="TEMPORAL_ENABLED")

    @field_validator('temporal_enabled', mode='before')
    @classmethod
    def parse_temporal_enabled(cls, v):
        """Parse temporal_enabled from various string formats"""
        if isinstance(v, str):
            v = v.strip().lower()
            return v in ('true', '1', 'yes', 'on')
        return v

    temporal_host: str = Field(default="localhost:7233", alias="TEMPORAL_HOST")
    temporal_url: str = Field(default="localhost:7233", alias="TEMPORAL_URL")  # Backward compat
    temporal_namespace: str = Field(default="default", alias="TEMPORAL_NAMESPACE")
    temporal_task_queue: str = Field(default="cns-enrichment", alias="TEMPORAL_TASK_QUEUE")

    @field_validator('temporal_task_queue')
    @classmethod
    def strip_temporal_task_queue(cls, v: str) -> str:
        """Strip whitespace from task queue name"""
        return v.strip() if v else v

    # ===================================
    # Enrichment Rate Limiting Configuration
    # ===================================
    enrichment_delays_enabled: bool = Field(default=True, alias="ENRICHMENT_DELAYS_ENABLED")

    @field_validator('enrichment_delays_enabled', mode='before')
    @classmethod
    def parse_enrichment_delays_enabled(cls, v):
        """Parse enrichment_delays_enabled from various string formats"""
        if isinstance(v, str):
            v = v.strip().lower()
            return v in ('true', '1', 'yes', 'on')
        return v

    enrichment_delay_per_component_ms: int = Field(
        default=500,
        alias="ENRICHMENT_DELAY_PER_COMPONENT_MS",
        description="Delay in milliseconds between processing each component (prevents API rate limiting)"
    )

    enrichment_delay_per_batch_ms: int = Field(
        default=2000,
        alias="ENRICHMENT_DELAY_PER_BATCH_MS",
        description="Delay in milliseconds between processing each batch of components"
    )

    enrichment_batch_size: int = Field(
        default=10,
        alias="ENRICHMENT_BATCH_SIZE",
        description="Number of components to process in parallel per batch"
    )

    @field_validator('enrichment_delay_per_component_ms', 'enrichment_delay_per_batch_ms')
    @classmethod
    def validate_delay_values(cls, v):
        """Ensure delay values are non-negative"""
        if v < 0:
            raise ValueError("Delay values must be non-negative")
        return v

    @field_validator('enrichment_batch_size')
    @classmethod
    def validate_batch_size(cls, v):
        """Ensure batch size is positive"""
        if v <= 0:
            raise ValueError("Batch size must be positive")
        return v

    # ===================================
    # MinIO/S3 Storage Configuration
    # ===================================
    minio_enabled: bool = Field(default=True, alias="MINIO_ENABLED")
    minio_endpoint: str = Field(default="localhost:27040", alias="MINIO_ENDPOINT")
    # Public endpoint for presigned URLs (browser-accessible) - falls back to minio_endpoint
    minio_public_endpoint: Optional[str] = Field(default=None, alias="MINIO_PUBLIC_ENDPOINT")
    minio_access_key: str = Field(default="minioadmin", alias="MINIO_ACCESS_KEY")
    minio_secret_key: str = Field(default="minioadmin", alias="MINIO_SECRET_KEY")
    minio_secure: bool = Field(default=False, alias="MINIO_SECURE")  # True for HTTPS
    minio_bucket_uploads: str = Field(default="bulk-uploads", alias="MINIO_BUCKET_UPLOADS")
    minio_bucket_results: str = Field(default="enriched-results", alias="MINIO_BUCKET_RESULTS")
    minio_bucket_archive: str = Field(default="bulk-uploads-archive", alias="MINIO_BUCKET_ARCHIVE")

    # ===================================
    # Directus Integration
    # ===================================
    directus_url: Optional[str] = Field(default=None, alias="DIRECTUS_URL")
    directus_public_url: Optional[str] = Field(default=None, alias="DIRECTUS_PUBLIC_URL")
    directus_admin_email: Optional[str] = Field(default=None, alias="DIRECTUS_ADMIN_EMAIL")
    directus_admin_password: Optional[str] = Field(default=None, alias="DIRECTUS_ADMIN_PASSWORD")
    directus_storage_location: str = Field(default="s3audit", alias="DIRECTUS_STORAGE_LOCATION")

    # ===================================
    # AI Providers Configuration
    # ===================================
    # Ollama (Local, Free - Priority 1)
    ollama_enabled: bool = Field(default=True, alias="OLLAMA_ENABLED")
    ollama_url: str = Field(default="http://localhost:27260", alias="OLLAMA_URL")
    ollama_model: str = Field(default="llama3:8b", alias="OLLAMA_MODEL")
    ollama_timeout: int = Field(default=30, alias="OLLAMA_TIMEOUT")

    # Langflow (Visual Workflows)
    langflow_enabled: bool = Field(default=False, alias="LANGFLOW_ENABLED")
    langflow_url: Optional[str] = Field(default=None, alias="LANGFLOW_URL")
    langflow_api_key: Optional[str] = Field(default=None, alias="LANGFLOW_API_KEY")
    langflow_flow_id_category: Optional[str] = Field(default=None, alias="LANGFLOW_FLOW_ID_CATEGORY")
    langflow_flow_id_specs: Optional[str] = Field(default=None, alias="LANGFLOW_FLOW_ID_SPECS")
    langflow_flow_id_description: Optional[str] = Field(default=None, alias="LANGFLOW_FLOW_ID_DESCRIPTION")

    # OpenAI (Priority 2)
    openai_enabled: bool = Field(default=False, alias="OPENAI_ENABLED")
    openai_api_key: Optional[str] = Field(default=None, alias="OPENAI_API_KEY")
    openai_model: str = Field(default="gpt-4-turbo", alias="OPENAI_MODEL")
    openai_max_tokens: int = Field(default=1000, alias="OPENAI_MAX_TOKENS")
    openai_temperature: float = Field(default=0.3, alias="OPENAI_TEMPERATURE")

    # Claude (Priority 3)
    claude_enabled: bool = Field(default=False, alias="CLAUDE_ENABLED")
    claude_api_key: Optional[str] = Field(default=None, alias="CLAUDE_API_KEY")
    claude_model: str = Field(default="claude-3-sonnet-20240229", alias="CLAUDE_MODEL")
    claude_max_tokens: int = Field(default=1000, alias="CLAUDE_MAX_TOKENS")
    claude_temperature: float = Field(default=0.3, alias="CLAUDE_TEMPERATURE")

    # Perplexity (Priority 4 - Web Search)
    perplexity_enabled: bool = Field(default=False, alias="PERPLEXITY_ENABLED")
    perplexity_api_key: Optional[str] = Field(default=None, alias="PERPLEXITY_API_KEY")
    perplexity_model: str = Field(default="pplx-7b-online", alias="PERPLEXITY_MODEL")
    perplexity_max_tokens: int = Field(default=500, alias="PERPLEXITY_MAX_TOKENS")

    # ===================================
    # AI Routing Configuration
    # ===================================
    ai_use_condition: str = Field(default="always", alias="AI_USE_CONDITION")
    ai_quality_threshold: int = Field(default=80, alias="AI_QUALITY_THRESHOLD")
    ai_categories_only: Optional[List[str]] = Field(default=None, alias="AI_CATEGORIES_ONLY")

    @field_validator("ai_categories_only", mode="before")
    @classmethod
    def parse_ai_categories(cls, v):
        if isinstance(v, str):
            return [cat.strip() for cat in v.split(",")]
        return v

    # ===================================
    # Supplier API Configuration - Tier 1
    # ===================================
    supplier_rate_limit_per_minute: int = Field(default=100, alias="SUPPLIER_RATE_LIMIT_PER_MINUTE")

    # Mouser
    mouser_enabled: bool = Field(default=True, alias="MOUSER_ENABLED")
    mouser_api_key: Optional[str] = Field(default=None, alias="MOUSER_API_KEY")
    mouser_base_url: str = Field(default="https://api.mouser.com/api/v1", alias="MOUSER_BASE_URL")
    mouser_rate_limit: int = Field(default=100, alias="MOUSER_RATE_LIMIT")  # per minute

    # DigiKey
    digikey_enabled: bool = Field(default=True, alias="DIGIKEY_ENABLED")
    digikey_client_id: Optional[str] = Field(default=None, alias="DIGIKEY_CLIENT_ID")
    digikey_client_secret: Optional[str] = Field(default=None, alias="DIGIKEY_CLIENT_SECRET")
    digikey_access_token: Optional[str] = Field(default=None, alias="DIGIKEY_ACCESS_TOKEN")
    digikey_refresh_token: Optional[str] = Field(default=None, alias="DIGIKEY_REFRESH_TOKEN")
    digikey_token_expires_at: Optional[str] = Field(default=None, alias="DIGIKEY_TOKEN_EXPIRES_AT")

    @field_validator('digikey_token_expires_at')
    @classmethod
    def validate_token_expires_at(cls, v: Optional[str]) -> Optional[str]:
        """Validate token expiry is a valid ISO 8601 datetime string"""
        if v is None:
            return v

        try:
            from datetime import datetime
            # Try parsing as ISO 8601 (supports both 'Z' and '+00:00' formats)
            datetime.fromisoformat(v.replace('Z', '+00:00'))
            return v
        except (ValueError, AttributeError) as e:
            raise ValueError(
                f"Invalid datetime format for DIGIKEY_TOKEN_EXPIRES_AT: '{v}'. "
                f"Expected ISO 8601 format (e.g., '2025-01-15T10:30:00Z' or '2025-01-15T10:30:00+00:00'). "
                f"Error: {e}"
            )

    digikey_redirect_uri: Optional[str] = Field(default=None, alias="DIGIKEY_REDIRECT_URI")
    digikey_base_url: str = Field(default="https://api.digikey.com", alias="DIGIKEY_BASE_URL")
    digikey_sandbox: bool = Field(default=False, alias="DIGIKEY_SANDBOX")
    digikey_rate_limit: int = Field(default=1000, alias="DIGIKEY_RATE_LIMIT")  # per day

    # Element14
    element14_enabled: bool = Field(default=True, alias="ELEMENT14_ENABLED")
    element14_api_key: Optional[str] = Field(default=None, alias="ELEMENT14_API_KEY")
    element14_store: str = Field(default="uk", alias="ELEMENT14_STORE")  # uk=Farnell, us=Newark, sg=APAC
    element14_base_url: str = Field(
        default="https://api.element14.com/catalog/products",
        alias="ELEMENT14_BASE_URL"
    )
    element14_rate_limit: int = Field(default=50, alias="ELEMENT14_RATE_LIMIT")  # per minute

    # ===================================
    # Supplier API Configuration - Tier 2
    # ===================================
    octopart_enabled: bool = Field(default=False, alias="OCTOPART_ENABLED")
    octopart_api_key: Optional[str] = Field(default=None, alias="OCTOPART_API_KEY")
    octopart_base_url: str = Field(default="https://octopart.com/api/v4", alias="OCTOPART_BASE_URL")

    siliconexpert_enabled: bool = Field(default=False, alias="SILICONEXPERT_ENABLED")
    siliconexpert_api_key: Optional[str] = Field(default=None, alias="SILICONEXPERT_API_KEY")
    siliconexpert_base_url: str = Field(
        default="https://api.siliconexpert.com",
        alias="SILICONEXPERT_BASE_URL"
    )

    # ===================================
    # Quality & Routing Configuration
    # ===================================
    quality_reject_threshold: int = Field(default=70, alias="QUALITY_REJECT_THRESHOLD")
    quality_staging_threshold: int = Field(default=94, alias="QUALITY_STAGING_THRESHOLD")
    quality_auto_approve_threshold: int = Field(default=95, alias="QUALITY_AUTO_APPROVE_THRESHOLD")

    # Re-enrichment quality thresholds
    quality_reenrich_threshold: int = Field(
        default=80,
        alias="QUALITY_REENRICH_THRESHOLD",
        description="Re-enrich components with quality score below this threshold"
    )
    quality_persist_threshold: int = Field(
        default=80,
        alias="QUALITY_PERSIST_THRESHOLD",
        description="Only persist components to database if quality score >= this threshold (low quality goes to Redis)"
    )
    supplier_health_monitor_enabled: bool = Field(default=True, alias="SUPPLIER_HEALTH_MONITOR_ENABLED")
    supplier_health_interval_seconds: int = Field(default=300, alias="SUPPLIER_HEALTH_INTERVAL_SECONDS")
    enrichment_staleness_days: int = Field(
        default=90,
        alias="ENRICHMENT_STALENESS_DAYS",
        description="Re-enrich components not updated in this many days"
    )
    reenrich_fallback_data: bool = Field(
        default=True,
        alias="REENRICH_FALLBACK_DATA",
        description="Always re-enrich components that have fallback/mock data"
    )
    low_quality_redis_ttl_days: int = Field(
        default=7,
        alias="LOW_QUALITY_REDIS_TTL_DAYS",
        description="TTL in days for low-quality components stored in Redis"
    )
    enable_enrichment_audit: bool = Field(
        default=True,
        alias="ENABLE_ENRICHMENT_AUDIT",
        description="Enable CSV/S3 audit trail for enrichment debugging (vendor responses, normalized data, quality scores)"
    )

    @field_validator("quality_reject_threshold", "quality_staging_threshold", "quality_auto_approve_threshold", "quality_reenrich_threshold", "quality_persist_threshold")
    @classmethod
    def validate_quality_threshold(cls, v):
        if not 0 <= v <= 100:
            raise ValueError("Quality threshold must be between 0 and 100")
        return v

    # ===================================
    # Authentication & Security
    # ===================================
    keycloak_url: str = Field(
        default="http://localhost:27100/realms/components-platform",
        alias="KEYCLOAK_URL"
    )
    keycloak_client_id: str = Field(default="cns-service", alias="KEYCLOAK_CLIENT_ID")
    keycloak_client_secret: Optional[str] = Field(default=None, alias="KEYCLOAK_CLIENT_SECRET")
    jwt_secret_key: str = Field(..., alias="JWT_SECRET_KEY")
    jwt_algorithm: str = Field(default="HS256", alias="JWT_ALGORITHM")
    jwt_expiration: int = Field(default=3600, alias="JWT_EXPIRATION")  # 1 hour

    # ===================================
    # Auth0 Configuration
    # ===================================
    auth0_enabled: bool = Field(default=False, alias="AUTH0_ENABLED")
    auth0_domain: Optional[str] = Field(default=None, alias="AUTH0_DOMAIN")
    auth0_audience: Optional[str] = Field(default=None, alias="AUTH0_AUDIENCE")
    auth0_client_id: Optional[str] = Field(default=None, alias="AUTH0_CLIENT_ID")
    auth0_client_secret: Optional[str] = Field(default=None, alias="AUTH0_CLIENT_SECRET")
    auth0_namespace: str = Field(
        default="https://ananta.component.platform",
        alias="AUTH0_NAMESPACE",
        description="Namespace for Auth0 custom claims (e.g., https://ananta.component.platform)"
    )

    # Auth0 Management API (for syncing app_metadata after auto-provision)
    # Uses M2M app with read:users, update:users scopes
    auth0_m2m_client_id: Optional[str] = Field(default=None, alias="AUTH0_M2M_CLIENT_ID")
    auth0_m2m_client_secret: Optional[str] = Field(default=None, alias="AUTH0_M2M_CLIENT_SECRET")

    @property
    def auth0_jwks_uri(self) -> Optional[str]:
        """Auto-derive JWKS URI from Auth0 domain"""
        if self.auth0_domain:
            return f"https://{self.auth0_domain}/.well-known/jwks.json"
        return None

    @property
    def auth0_issuer(self) -> Optional[str]:
        """Auto-derive Issuer URL from Auth0 domain"""
        if self.auth0_domain:
            return f"https://{self.auth0_domain}/"
        return None

    @field_validator('auth0_enabled', mode='before')
    @classmethod
    def parse_auth0_enabled(cls, v):
        """Parse auth0_enabled from various string formats"""
        if isinstance(v, str):
            v = v.strip().lower()
            return v in ('true', '1', 'yes', 'on')
        return v


    # ===================================
    # Billing & Stripe Configuration
    # ===================================
    billing_provider: str = Field(
        default="none",
        alias="BILLING_PROVIDER",
        description="Payment provider: 'none', 'stripe', 'paypal'"
    )
    stripe_enabled: bool = Field(default=False, alias="STRIPE_ENABLED")
    stripe_secret_key: Optional[str] = Field(default=None, alias="STRIPE_SECRET_KEY")
    stripe_publishable_key: Optional[str] = Field(default=None, alias="STRIPE_PUBLISHABLE_KEY")
    stripe_webhook_secret: Optional[str] = Field(default=None, alias="STRIPE_WEBHOOK_SECRET")
    stripe_price_starter: Optional[str] = Field(default=None, alias="STRIPE_PRICE_STARTER")
    stripe_price_professional: Optional[str] = Field(default=None, alias="STRIPE_PRICE_PROFESSIONAL")
    stripe_price_enterprise: Optional[str] = Field(default=None, alias="STRIPE_PRICE_ENTERPRISE")
    stripe_trial_days: int = Field(default=14, alias="STRIPE_TRIAL_DAYS")

    @field_validator('stripe_enabled', mode='before')
    @classmethod
    def parse_stripe_enabled(cls, v):
        """Parse stripe_enabled from various string formats"""
        if isinstance(v, str):
            v = v.strip().lower()
            return v in ('true', '1', 'yes', 'on')
        return v

    # ===================================
    # Proxy/Load Balancer Configuration
    # ===================================
    # Number of trusted proxy hops. When > 0, X-Forwarded-For is trusted
    # but only the Nth value from the right is used (to prevent spoofing).
    # Set to 1 for single reverse proxy, 2 for CDN + LB, etc.
    # When 0, X-Forwarded-For is ignored and only X-Real-IP or client IP is used.
    trusted_proxy_count: int = Field(default=0, alias="TRUSTED_PROXY_COUNT")

    # ===================================
    # CORS Configuration
    # ===================================
    # TRAEFIK_PORT: Single port variable for all Traefik routing (default: 8889)
    # Change this ONE value to switch Traefik port everywhere
    traefik_port: int = Field(default=8889, alias="TRAEFIK_PORT")

    # CORS_ORIGINS: Comma-separated list of allowed origins (env var or default)
    # Example: CORS_ORIGINS=http://cbp.localhost:8888,http://localhost:27100
    # If not set, uses comprehensive defaults for local development
    # NOTE: Cannot use underscore prefix (_field) - Pydantic BaseSettings ignores private fields for env var mapping
    cors_origins_raw: str = Field(default="", alias="CORS_ORIGINS")

    @property
    def cors_origins(self) -> List[str]:
        """Get CORS origins list from env var or use defaults"""
        # If env var is set, parse it (comma-separated)
        if self.cors_origins_raw:
            return [origin.strip() for origin in self.cors_origins_raw.split(",") if origin.strip()]

        # Traefik hostnames
        traefik_hosts = ["cbp", "cns", "dashboard", "studio", "novu", "novu-api"]
        port = self.traefik_port

        # Generate Traefik origins dynamically from TRAEFIK_PORT
        traefik_origins = [f"http://{host}.localhost:{port}" for host in traefik_hosts]
        # Also include port 80 (no port in URL)
        traefik_origins_noport = [f"http://{host}.localhost" for host in traefik_hosts[:2]]  # cbp, cns only

        # Direct localhost origins (port-forwarded) - these are fixed
        direct_origins = [
            "http://localhost:27500",  # Main dashboard via Traefik
            "http://localhost:27510",  # Customer Portal (direct Vite dev)
            "http://localhost:27100",  # Customer Portal (Docker)
            "http://localhost:27555",  # Admin App (arc-saas)
            "http://localhost:27710",  # CNS Dashboard (Vite dev)
            "http://localhost:27250",  # CNS Dashboard (Docker)
            "http://localhost:27150",  # Backstage Portal (Vite dev)
            "http://localhost:27400",  # Dashboard (Next.js)
            "http://localhost:3000",   # Grafana
        ]

        return traefik_origins + traefik_origins_noport + direct_origins

    cors_allow_credentials: bool = True

    # ===================================
    # File Upload Configuration
    # ===================================
    max_upload_size: int = Field(default=10485760, alias="MAX_UPLOAD_SIZE")  # 10 MB
    # NOTE: ALLOWED_FILE_EXTENSIONS has same Pydantic parsing issue as CORS_ORIGINS
    # Using defaults instead
    allowed_file_extensions: List[str] = [".csv", ".xlsx", ".xls"]
    upload_dir: str = Field(default="/tmp/cns-uploads", alias="UPLOAD_DIR")

    # ===================================
    # Monitoring & Observability
    # ===================================
    grafana_url: str = Field(default="http://localhost:3000", alias="GRAFANA_URL")
    loki_url: str = Field(default="http://localhost:3100", alias="LOKI_URL")
    prometheus_url: str = Field(default="http://localhost:9090", alias="PROMETHEUS_URL")
    enable_metrics: bool = Field(default=True, alias="ENABLE_METRICS")
    metrics_port: int = Field(default=27801, alias="METRICS_PORT")

    # ===================================
    # Feature Flags
    # ===================================
    enable_ai_suggestions: bool = Field(default=True, alias="ENABLE_AI_SUGGESTIONS")
    enable_web_scraping: bool = Field(default=False, alias="ENABLE_WEB_SCRAPING")
    enable_tier2_suppliers: bool = Field(default=False, alias="ENABLE_TIER2_SUPPLIERS")
    enable_tier3_oem: bool = Field(default=False, alias="ENABLE_TIER3_OEM")
    enable_multi_ai_fallback: bool = Field(default=True, alias="ENABLE_MULTI_AI_FALLBACK")
    enable_cost_tracking: bool = Field(default=True, alias="ENABLE_COST_TRACKING")
    enable_gate_logging: bool = Field(default=True, alias="ENABLE_GATE_LOGGING")

    # BOM Upload Idempotency - when enabled, uploading the same file content
    # returns the existing BOM instead of creating a duplicate.
    # Disable for testing when you need to re-upload the same file.
    bom_upload_idempotency_enabled: bool = Field(
        default=True,
        alias="BOM_UPLOAD_IDEMPOTENCY_ENABLED",
        description="When enabled, uploading the same file returns existing BOM. Disable for testing."
    )

    @field_validator('bom_upload_idempotency_enabled', mode='before')
    @classmethod
    def parse_bom_upload_idempotency_enabled(cls, v):
        """Parse bom_upload_idempotency_enabled from various string formats"""
        if isinstance(v, str):
            v = v.strip().lower()
            return v in ('true', '1', 'yes', 'on')
        return v

    # CNS Projects Alignment - Scope Validation (CRITICAL SECURITY FEATURE)
    enable_project_scope_validation: bool = Field(
        default=True,
        alias="ENABLE_PROJECT_SCOPE_VALIDATION",
        description="Enable project-based scope validation with automatic organization_id derivation."
    )

    # ===================================
    # Notification Delivery Configuration
    # ===================================
    # Novu Notification Service
    notification_provider: str = Field(
        default="none",
        alias="NOTIFICATION_PROVIDER",
        description="Notification provider: 'none' (disabled), 'novu' (Novu service)"
    )
    novu_api_key: Optional[str] = Field(default=None, alias="NOVU_API_KEY")
    novu_api_url: str = Field(
        default="http://novu-api:3000",
        alias="NOVU_API_URL",
        description="Novu API URL for self-hosted instance"
    )

    # SMTP Email Configuration (for alert email delivery)
    smtp_host: Optional[str] = Field(default=None, alias="SMTP_HOST")
    smtp_port: int = Field(default=587, alias="SMTP_PORT")
    smtp_user: Optional[str] = Field(default=None, alias="SMTP_USER")
    smtp_password: Optional[str] = Field(default=None, alias="SMTP_PASSWORD")
    smtp_from_email: Optional[str] = Field(default=None, alias="SMTP_FROM_EMAIL")
    smtp_from_name: str = Field(default="Components Platform", alias="SMTP_FROM_NAME")
    smtp_use_tls: bool = Field(default=True, alias="SMTP_USE_TLS")

    # Webhook Configuration
    notification_webhook_timeout_seconds: int = Field(
        default=30,
        alias="NOTIFICATION_WEBHOOK_TIMEOUT_SECONDS",
        description="HTTP timeout for webhook delivery"
    )
    notification_webhook_secret: Optional[str] = Field(
        default=None,
        alias="NOTIFICATION_WEBHOOK_SECRET",
        description="HMAC secret for signing webhook payloads"
    )

    # Delivery Processing Configuration
    notification_max_retries: int = Field(
        default=3,
        alias="NOTIFICATION_MAX_RETRIES",
        description="Max retry attempts for failed deliveries"
    )
    notification_batch_size: int = Field(
        default=50,
        alias="NOTIFICATION_BATCH_SIZE",
        description="Number of pending deliveries to process per batch"
    )
    notification_processor_interval_seconds: int = Field(
        default=60,
        alias="NOTIFICATION_PROCESSOR_INTERVAL_SECONDS",
        description="Interval between delivery processing runs"
    )

    # ===================================
    # Admin/API Security
    # ===================================
    # Optional admin token to guard internal lookup endpoints. When set, requests
    # to /api/admin/* must include Authorization: Bearer <ADMIN_API_TOKEN>.
    admin_api_token: Optional[str] = Field(default=None, alias="ADMIN_API_TOKEN")

    # Admin token IP whitelist (comma-separated IPs)
    # When set, admin token requests are only allowed from these IPs
    # Example: "192.168.1.100,10.0.0.50"
    admin_token_allowed_ips: Optional[str] = Field(
        default=None,
        alias="ADMIN_TOKEN_ALLOWED_IPS",
        description="Comma-separated list of IPs allowed to use admin token (empty = all allowed)"
    )

    # ===================================
    # Development & Testing
    # ===================================
    debug: bool = Field(default=False, alias="DEBUG")
    test_mode: bool = Field(default=False, alias="TEST_MODE")
    mock_supplier_apis: bool = Field(default=False, alias="MOCK_SUPPLIER_APIS")

    class Config:
        # env_file = ".env"  # TEMP DISABLED: Bypass .env loading, rely on docker-compose env vars
        env_file_encoding = "utf-8"
        case_sensitive = False
        extra = "ignore"  # Ignore extra environment variables

    def get_enabled_ai_providers(self) -> List[str]:
        """Get list of enabled AI providers in priority order"""
        providers = []
        if self.ollama_enabled:
            providers.append("ollama")
        if self.claude_enabled and self.claude_api_key:
            providers.append("claude")
        if self.openai_enabled and self.openai_api_key:
            providers.append("openai")
        if self.perplexity_enabled and self.perplexity_api_key:
            providers.append("perplexity")
        return providers

    def get_digikey_redirect_uri(self) -> str:
        """
        Resolve DigiKey OAuth redirect URI.

        Priority:
        1. DIGIKEY_REDIRECT_URI environment variable (explicit override)
        2. PUBLIC_DASHBOARD_URL + /supplier-apis/digikey/callback
        3. Default https://localhost:27500/cns/supplier-apis/digikey/callback
        """
        if self.digikey_redirect_uri:
            return self.digikey_redirect_uri

        base = (self.public_dashboard_url or "https://localhost:27500/cns").rstrip("/")
        return f"{base}/supplier-apis/digikey/callback"

    def get_enabled_tier1_suppliers(self) -> List[str]:
        """Get list of enabled Tier 1 suppliers"""
        suppliers = []
        if self.mouser_enabled and self.mouser_api_key:
            suppliers.append("mouser")
        if self.digikey_enabled and self.digikey_client_id:
            suppliers.append("digikey")
        if self.element14_enabled and self.element14_api_key:
            suppliers.append("element14")
        return suppliers

    def is_production(self) -> bool:
        """Check if running in production environment"""
        return self.environment.lower() == "production"

    def is_development(self) -> bool:
        """Check if running in development environment"""
        return self.environment.lower() == "development"


# ===================================
# Access Control Constants
# ===================================
# Platform Super Admin organization - a system-level org for testing/admin operations.
# BOMs belonging to this org are accessible to all authenticated staff users.
# This enables platform administrators to create shared test/demo BOMs.
PLATFORM_SUPER_ADMIN_ORG = "a0000000-0000-0000-0000-000000000000"


# Global settings instance
# Will be loaded when the module is imported
settings = Settings()
