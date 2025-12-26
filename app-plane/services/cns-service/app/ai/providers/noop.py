"""
No-Op AI Provider

Disabled AI provider that returns None for all suggestions.
Useful when you want to disable AI entirely and rely only on rule-based logic.

Usage:
    - Set ENABLE_AI_SUGGESTIONS=false in .env
    - Plugin manager will use NoOpAIProvider instead of real AI
"""

import logging
from typing import Dict, Any, List, Optional

from app.core.interfaces import AIProviderInterface, AISuggestion

logger = logging.getLogger(__name__)


class NoOpAIProvider(AIProviderInterface):
    """
    No-operation AI provider (disabled AI)

    Returns None or empty results for all AI operations.
    """

    def __init__(self):
        self._initialized = False

    @property
    def plugin_name(self) -> str:
        return "noop-ai-provider"

    @property
    def plugin_version(self) -> str:
        return "1.0.0"

    @property
    def provider_name(self) -> str:
        return "noop"

    @property
    def provider_type(self) -> str:
        return "disabled"

    async def initialize(self, config: Dict[str, Any]) -> None:
        """Initialize (no-op)"""
        logger.info("NoOpAIProvider initialized (AI disabled)")
        self._initialized = True

    async def shutdown(self) -> None:
        """Shutdown (no-op)"""
        self._initialized = False

    async def health_check(self) -> Dict[str, Any]:
        """Health check - always healthy"""
        return {
            "status": "healthy",
            "provider": "noop",
            "message": "AI disabled (NoOpAIProvider)",
            "latency_ms": 0
        }

    async def is_available(self) -> bool:
        """Always available (even though it does nothing)"""
        return True

    async def suggest_category(
        self,
        description: str,
        mpn: str,
        manufacturer: Optional[str] = None,
        available_categories: Optional[List[str]] = None
    ) -> AISuggestion:
        """
        Return empty suggestion (AI disabled)
        """
        logger.debug(f"AI disabled - no category suggestion for {mpn}")
        return AISuggestion({
            "field": "category",
            "suggestion": None,
            "confidence": 0.0,
            "reasoning": "AI suggestions disabled"
        })

    async def extract_specifications(
        self,
        description: str,
        mpn: str,
        category: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Return empty specifications (AI disabled)
        """
        logger.debug(f"AI disabled - no spec extraction for {mpn}")
        return {}

    async def enhance_description(
        self,
        mpn: str,
        raw_description: str,
        specifications: Optional[Dict] = None
    ) -> str:
        """
        Return raw description unchanged (AI disabled)
        """
        return raw_description

    async def resolve_conflict(
        self,
        field: str,
        values: List[Any],
        component_data: Any
    ) -> Any:
        """
        Return first value (no AI resolution)
        """
        logger.debug(f"AI disabled - no conflict resolution for {field}")
        return values[0] if values else None

    async def get_cost_estimate(self) -> Dict[str, float]:
        """No cost (AI disabled)"""
        return {
            "cost_per_request": 0.0,
            "cost_per_token": 0.0,
            "monthly_cost": 0.0
        }
