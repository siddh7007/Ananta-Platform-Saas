"""
Environment Variable Validation

Validates configuration at startup to fail fast on misconfiguration.

This prevents runtime errors from missing or invalid configuration values.
All validation errors are collected and reported together.
"""

import logging
from typing import List, Dict, Any, Optional
from pydantic import ValidationError

logger = logging.getLogger(__name__)


class ConfigValidationError(Exception):
    """Raised when configuration validation fails"""

    def __init__(self, errors: List[str]):
        self.errors = errors
        error_message = "Configuration validation failed:\n" + "\n".join(f"  - {e}" for e in errors)
        super().__init__(error_message)


class ConfigValidator:
    """
    Validates environment configuration at startup

    Usage:
        from app.core.validation import ConfigValidator
        from app.config import settings

        # At startup (in main.py lifespan)
        ConfigValidator.validate_at_startup(settings)
    """

    @staticmethod
    def validate_at_startup(settings) -> None:
        """
        Validate all configuration at startup

        Raises:
            ConfigValidationError: If validation fails
        """
        errors = []

        # Collect all validation errors
        errors.extend(ConfigValidator._validate_required_fields(settings))
        errors.extend(ConfigValidator._validate_database_config(settings))
        errors.extend(ConfigValidator._validate_dual_database_config(settings))
        errors.extend(ConfigValidator._validate_ai_config(settings))
        errors.extend(ConfigValidator._validate_supplier_config(settings))
        errors.extend(ConfigValidator._validate_redis_config(settings))
        errors.extend(ConfigValidator._validate_temporal_config(settings))
        errors.extend(ConfigValidator._validate_ports(settings))

        if errors:
            raise ConfigValidationError(errors)

        logger.info("Configuration validation passed")

    @staticmethod
    def _validate_required_fields(settings) -> List[str]:
        """Validate required fields"""
        errors = []

        if not settings.database_url:
            errors.append("DATABASE_URL is required")

        if not settings.service_name:
            errors.append("SERVICE_NAME is required")

        return errors

    @staticmethod
    def _validate_database_config(settings) -> List[str]:
        """Validate database configuration"""
        errors = []

        # Check DATABASE_URL format
        if settings.database_url:
            if not settings.database_url.startswith(("postgresql://", "postgres://")):
                errors.append(
                    "DATABASE_URL must start with 'postgresql://' or 'postgres://'"
                )

        # Check pool settings
        if settings.db_pool_size < 1:
            errors.append("DB_POOL_SIZE must be >= 1")

        if settings.db_max_overflow < 0:
            errors.append("DB_MAX_OVERFLOW must be >= 0")

        return errors

    @staticmethod
    def _validate_dual_database_config(settings) -> List[str]:
        """
        Validate dual-database configuration for CNS service.

        CNS uses two databases:
        - Supabase (SUPABASE_DATABASE_URL): Customer data (BOMs, organizations)
        - Components-V2 (COMPONENTS_V2_DATABASE_URL): Internal catalog

        This validates:
        1. Both URLs are set (or warns if missing)
        2. URLs don't point to default localhost:5432 (common misconfiguration)
        3. URLs point to different databases (not the same database)
        """
        import os
        errors = []
        warnings = []

        # Get dual-database URLs from environment
        supabase_url = os.getenv("SUPABASE_DATABASE_URL", "")
        components_url = os.getenv("COMPONENTS_V2_DATABASE_URL", "")
        primary_url = settings.database_url if hasattr(settings, "database_url") else ""

        # Log resolved URLs (hide credentials)
        def mask_url(url: str) -> str:
            if not url:
                return "(not set)"
            try:
                # Mask password in URL
                if "@" in url:
                    prefix = url.split("@")[0]
                    suffix = url.split("@")[1]
                    if ":" in prefix:
                        user_part = prefix.rsplit(":", 1)[0]
                        return f"{user_part}:****@{suffix}"
                return url
            except Exception:
                return url[:20] + "..."

        logger.info(f"[Dual-DB Config] DATABASE_URL: {mask_url(primary_url)}")
        logger.info(f"[Dual-DB Config] SUPABASE_DATABASE_URL: {mask_url(supabase_url)}")
        logger.info(f"[Dual-DB Config] COMPONENTS_V2_DATABASE_URL: {mask_url(components_url)}")

        # Check for common misconfiguration: localhost:5432 (default PostgreSQL port)
        misconfigured_ports = []
        for name, url in [
            ("DATABASE_URL", primary_url),
            ("SUPABASE_DATABASE_URL", supabase_url),
            ("COMPONENTS_V2_DATABASE_URL", components_url),
        ]:
            if url and "localhost:5432" in url:
                misconfigured_ports.append(name)

        if misconfigured_ports:
            warning_msg = (
                f"[WARNING] Possible misconfiguration: {', '.join(misconfigured_ports)} "
                f"points to localhost:5432 (default PostgreSQL). "
                f"Expected ports: Supabase=27432, Components-V2=27010. "
                f"See README.md for dual-database configuration."
            )
            logger.warning(warning_msg)
            # Don't fail, just warn - could be intentional for development

        # Check if both dual-database URLs are set
        if not supabase_url:
            logger.warning(
                "[Dual-DB Config] SUPABASE_DATABASE_URL not set. "
                "Customer data operations may use wrong database. "
                "See README.md for dual-database configuration."
            )

        if not components_url:
            logger.warning(
                "[Dual-DB Config] COMPONENTS_V2_DATABASE_URL not set. "
                "Catalog operations may use wrong database. "
                "See README.md for dual-database configuration."
            )

        # Check if URLs point to same database (common mistake)
        if supabase_url and components_url:
            # Extract host:port/database from URLs
            def extract_db_identifier(url: str) -> str:
                try:
                    # postgresql://user:pass@host:port/database
                    if "@" in url:
                        return url.split("@")[1]
                    return url
                except Exception:
                    return url

            supabase_id = extract_db_identifier(supabase_url)
            components_id = extract_db_identifier(components_url)

            if supabase_id == components_id:
                logger.warning(
                    f"[Dual-DB Config] SUPABASE_DATABASE_URL and COMPONENTS_V2_DATABASE_URL "
                    f"point to the SAME database ({mask_url(supabase_url)}). "
                    f"This is likely a misconfiguration. They should point to different databases."
                )

        # Validate URL formats if set
        for name, url in [
            ("SUPABASE_DATABASE_URL", supabase_url),
            ("COMPONENTS_V2_DATABASE_URL", components_url),
        ]:
            if url and not url.startswith(("postgresql://", "postgres://")):
                errors.append(
                    f"{name} must start with 'postgresql://' or 'postgres://'"
                )

        return errors

    @staticmethod
    def _validate_ai_config(settings) -> List[str]:
        """Validate AI provider configuration"""
        errors = []

        # If AI is enabled, at least one provider must be configured
        if settings.enable_ai_suggestions:
            has_provider = False

            if settings.ollama_enabled:
                has_provider = True
                if not settings.ollama_url:
                    errors.append("OLLAMA_URL is required when OLLAMA_ENABLED=true")
                if not settings.ollama_model:
                    errors.append("OLLAMA_MODEL is required when OLLAMA_ENABLED=true")

            if settings.langflow_enabled:
                has_provider = True
                if not settings.langflow_url:
                    errors.append("LANGFLOW_URL is required when LANGFLOW_ENABLED=true")
                # Flow IDs are optional (can be set per-request)

            if settings.openai_enabled:
                has_provider = True
                if not settings.openai_api_key:
                    errors.append("OPENAI_API_KEY is required when OPENAI_ENABLED=true")

            if settings.claude_enabled:
                has_provider = True
                if not settings.claude_api_key:
                    errors.append("CLAUDE_API_KEY is required when CLAUDE_ENABLED=true")

            if not has_provider:
                errors.append(
                    "ENABLE_AI_SUGGESTIONS=true but no AI provider is enabled. "
                    "Enable at least one: OLLAMA_ENABLED, LANGFLOW_ENABLED, "
                    "OPENAI_ENABLED, or CLAUDE_ENABLED"
                )

        # Validate AI routing condition
        if hasattr(settings, "ai_use_condition"):
            valid_conditions = ["always", "never", "quality_based", "category_based", "custom"]
            if settings.ai_use_condition not in valid_conditions:
                errors.append(
                    f"AI_USE_CONDITION must be one of: {', '.join(valid_conditions)}"
                )

            # Validate quality threshold
            if settings.ai_use_condition == "quality_based":
                if not hasattr(settings, "ai_quality_threshold"):
                    errors.append(
                        "AI_QUALITY_THRESHOLD is required when AI_USE_CONDITION=quality_based"
                    )
                elif not (0 <= settings.ai_quality_threshold <= 100):
                    errors.append("AI_QUALITY_THRESHOLD must be between 0 and 100")

            # Validate categories whitelist
            if settings.ai_use_condition == "category_based":
                if not hasattr(settings, "ai_categories_only") or not settings.ai_categories_only:
                    errors.append(
                        "AI_CATEGORIES_ONLY is required when AI_USE_CONDITION=category_based"
                    )

        return errors

    @staticmethod
    def _validate_supplier_config(settings) -> List[str]:
        """Validate supplier API configuration"""
        errors = []

        # Mouser
        if settings.mouser_enabled:
            if not settings.mouser_api_key:
                errors.append("MOUSER_API_KEY is required when MOUSER_ENABLED=true")

        # DigiKey
        if settings.digikey_enabled:
            if not settings.digikey_client_id:
                errors.append("DIGIKEY_CLIENT_ID is required when DIGIKEY_ENABLED=true")
            if not settings.digikey_client_secret:
                errors.append("DIGIKEY_CLIENT_SECRET is required when DIGIKEY_ENABLED=true")

        # Element14
        if settings.element14_enabled:
            if not settings.element14_api_key:
                errors.append("ELEMENT14_API_KEY is required when ELEMENT14_ENABLED=true")

        # Validate rate limits
        if hasattr(settings, "supplier_rate_limit_per_minute"):
            if settings.supplier_rate_limit_per_minute < 1:
                errors.append("SUPPLIER_RATE_LIMIT_PER_MINUTE must be >= 1")

        return errors

    @staticmethod
    def _validate_redis_config(settings) -> List[str]:
        """Validate Redis configuration"""
        errors = []

        if settings.redis_enabled:
            if not settings.redis_url:
                errors.append("REDIS_URL is required when REDIS_ENABLED=true")

            # Validate cache TTL
            if hasattr(settings, "cache_ttl_seconds"):
                if settings.cache_ttl_seconds < 0:
                    errors.append("CACHE_TTL_SECONDS must be >= 0")

        return errors

    @staticmethod
    def _validate_temporal_config(settings) -> List[str]:
        """Validate Temporal workflow configuration"""
        errors = []

        if settings.temporal_enabled:
            if not settings.temporal_host:
                errors.append("TEMPORAL_HOST is required when TEMPORAL_ENABLED=true")

            if not settings.temporal_namespace:
                errors.append("TEMPORAL_NAMESPACE is required when TEMPORAL_ENABLED=true")

            if not settings.temporal_task_queue:
                errors.append("TEMPORAL_TASK_QUEUE is required when TEMPORAL_ENABLED=true")

        return errors

    @staticmethod
    def _validate_ports(settings) -> List[str]:
        """Validate port configuration"""
        errors = []

        # Service port
        if not (1024 <= settings.port <= 65535):
            errors.append("PORT must be between 1024 and 65535")

        return errors

    @staticmethod
    def get_validation_summary(settings) -> Dict[str, Any]:
        """
        Get validation summary without raising errors

        Returns:
            Dict with validation status and details
        """
        import os
        all_errors = []

        all_errors.extend(ConfigValidator._validate_required_fields(settings))
        all_errors.extend(ConfigValidator._validate_database_config(settings))
        all_errors.extend(ConfigValidator._validate_dual_database_config(settings))
        all_errors.extend(ConfigValidator._validate_ai_config(settings))
        all_errors.extend(ConfigValidator._validate_supplier_config(settings))
        all_errors.extend(ConfigValidator._validate_redis_config(settings))
        all_errors.extend(ConfigValidator._validate_temporal_config(settings))
        all_errors.extend(ConfigValidator._validate_ports(settings))

        # Get dual-database status
        supabase_url = os.getenv("SUPABASE_DATABASE_URL", "")
        components_url = os.getenv("COMPONENTS_V2_DATABASE_URL", "")

        return {
            "valid": len(all_errors) == 0,
            "error_count": len(all_errors),
            "errors": all_errors,
            "config_summary": {
                "database": "configured" if settings.database_url else "missing",
                "dual_database": {
                    "supabase": "configured" if supabase_url else "missing",
                    "components_v2": "configured" if components_url else "missing",
                },
                "ai_enabled": settings.enable_ai_suggestions,
                "ai_providers": {
                    "ollama": settings.ollama_enabled,
                    "langflow": settings.langflow_enabled,
                    "openai": settings.openai_enabled if hasattr(settings, "openai_enabled") else False,
                    "claude": settings.claude_enabled if hasattr(settings, "claude_enabled") else False,
                },
                "suppliers": {
                    "mouser": settings.mouser_enabled if hasattr(settings, "mouser_enabled") else False,
                    "digikey": settings.digikey_enabled if hasattr(settings, "digikey_enabled") else False,
                    "element14": settings.element14_enabled if hasattr(settings, "element14_enabled") else False,
                },
                "redis": settings.redis_enabled if hasattr(settings, "redis_enabled") else False,
                "temporal": settings.temporal_enabled if hasattr(settings, "temporal_enabled") else False,
            }
        }


# Helper function for health checks
def get_config_health() -> Dict[str, Any]:
    """
    Get configuration health status

    Returns:
        Health check response with config validation status
    """
    from app.config import settings

    summary = ConfigValidator.get_validation_summary(settings)

    return {
        "status": "healthy" if summary["valid"] else "unhealthy",
        "validation": summary
    }
