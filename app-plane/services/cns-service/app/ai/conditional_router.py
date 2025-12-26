"""
Conditional AI Router

Smart router that decides when to use AI based on rules/conditions.

Use Cases:
1. Use AI only for quality score < 80%
2. Use AI only for specific categories
3. Use AI only during business hours (cost savings)
4. Use different AI providers based on quality score
5. Skip AI entirely for trusted suppliers

Configuration:
    AI_USE_CONDITION=quality_based  # quality_based | always | never | category_based
    AI_QUALITY_THRESHOLD=80          # Use AI only if quality < this
    AI_CATEGORIES_ONLY=["Resistors", "Capacitors"]  # Use AI only for these categories
"""

import logging
from typing import Dict, Any, List, Optional, Callable
from enum import Enum

from app.core.interfaces import AIProviderInterface, AISuggestion, ComponentData
from app.core.plugin_manager import get_plugin_manager

logger = logging.getLogger(__name__)


class AICondition(str, Enum):
    """When to use AI"""
    ALWAYS = "always"                # Use AI for all components
    NEVER = "never"                  # Never use AI (use NoOpAIProvider)
    QUALITY_BASED = "quality_based"  # Use AI only for quality < threshold
    CATEGORY_BASED = "category_based"  # Use AI only for specific categories
    CUSTOM = "custom"                # Use custom condition function


class ConditionalAIRouter:
    """
    Routes AI requests based on conditions

    Example Usage:
        router = ConditionalAIRouter(
            condition=AICondition.QUALITY_BASED,
            quality_threshold=80
        )

        # AI will only be used if quality < 80
        suggestion = await router.suggest_category(
            description="...",
            mpn="...",
            quality_score=75  # < 80, so AI is used
        )

        # AI will NOT be used if quality >= 80
        suggestion = await router.suggest_category(
            description="...",
            mpn="...",
            quality_score=85  # >= 80, so AI is skipped
        )
    """

    def __init__(
        self,
        condition: AICondition = AICondition.ALWAYS,
        quality_threshold: int = 80,
        categories_whitelist: Optional[List[str]] = None,
        custom_condition: Optional[Callable] = None,
        fallback_provider_name: str = "noop"  # Use NoOp when condition not met
    ):
        """
        Initialize conditional AI router

        Args:
            condition: When to use AI
            quality_threshold: Quality score threshold (for quality_based)
            categories_whitelist: List of categories to use AI for (for category_based)
            custom_condition: Custom condition function (for custom mode)
            fallback_provider_name: Provider to use when condition not met
        """
        self.condition = condition
        self.quality_threshold = quality_threshold
        self.categories_whitelist = categories_whitelist or []
        self.custom_condition = custom_condition
        self.fallback_provider_name = fallback_provider_name

        self._plugin_manager = get_plugin_manager()

    def should_use_ai(
        self,
        component_data: Optional[ComponentData] = None,
        quality_score: Optional[float] = None,
        category: Optional[str] = None,
        **kwargs
    ) -> bool:
        """
        Determine if AI should be used based on conditions

        Args:
            component_data: Full component data
            quality_score: Quality score (0-100)
            category: Component category
            **kwargs: Additional context

        Returns:
            True if AI should be used, False otherwise
        """
        if self.condition == AICondition.ALWAYS:
            return True

        if self.condition == AICondition.NEVER:
            return False

        if self.condition == AICondition.QUALITY_BASED:
            if quality_score is None:
                logger.warning("Quality score not provided for quality_based AI routing")
                return True  # Default to using AI if score unknown

            # Use AI only if quality is below threshold
            use_ai = quality_score < self.quality_threshold
            logger.debug(
                f"Quality-based AI routing: score={quality_score}, "
                f"threshold={self.quality_threshold}, use_ai={use_ai}"
            )
            return use_ai

        if self.condition == AICondition.CATEGORY_BASED:
            if not category:
                logger.warning("Category not provided for category_based AI routing")
                return True  # Default to using AI if category unknown

            # Use AI only for whitelisted categories
            use_ai = category in self.categories_whitelist
            logger.debug(
                f"Category-based AI routing: category={category}, "
                f"whitelist={self.categories_whitelist}, use_ai={use_ai}"
            )
            return use_ai

        if self.condition == AICondition.CUSTOM:
            if not self.custom_condition:
                logger.error("Custom condition function not provided")
                return True

            # Use custom condition function
            try:
                return self.custom_condition(
                    component_data=component_data,
                    quality_score=quality_score,
                    category=category,
                    **kwargs
                )
            except Exception as e:
                logger.error(f"Error in custom AI condition: {e}")
                return True  # Default to using AI on error

        # Default: use AI
        return True

    def get_provider(
        self,
        component_data: Optional[ComponentData] = None,
        quality_score: Optional[float] = None,
        category: Optional[str] = None,
        **kwargs
    ) -> AIProviderInterface:
        """
        Get appropriate AI provider based on conditions

        Returns:
            AI provider (real or NoOp based on condition)
        """
        should_use = self.should_use_ai(
            component_data=component_data,
            quality_score=quality_score,
            category=category,
            **kwargs
        )

        if should_use:
            # Use real AI provider
            provider = self._plugin_manager.get_ai_provider()
            if provider:
                logger.debug(f"Using AI provider: {provider.provider_name}")
                return provider

        # Condition not met or no provider available - use fallback (NoOp)
        fallback = self._plugin_manager.get_ai_provider(self.fallback_provider_name)
        if fallback:
            logger.debug(f"Using fallback provider: {fallback.provider_name}")
            return fallback

        # Last resort: return NoOp
        logger.warning("No AI provider available, returning None")
        return None

    async def suggest_category(
        self,
        description: str,
        mpn: str,
        manufacturer: Optional[str] = None,
        available_categories: Optional[List[str]] = None,
        quality_score: Optional[float] = None,
        **kwargs
    ) -> AISuggestion:
        """
        Conditionally suggest category using AI

        Args:
            description: Component description
            mpn: Manufacturer part number
            manufacturer: Manufacturer name
            available_categories: List of available categories
            quality_score: Current quality score (determines if AI is used)

        Returns:
            AI suggestion (or empty if condition not met)
        """
        provider = self.get_provider(quality_score=quality_score, **kwargs)
        if not provider:
            return AISuggestion({
                "field": "category",
                "suggestion": None,
                "confidence": 0.0,
                "reasoning": "No AI provider available"
            })

        return await provider.suggest_category(
            description=description,
            mpn=mpn,
            manufacturer=manufacturer,
            available_categories=available_categories
        )

    async def extract_specifications(
        self,
        description: str,
        mpn: str,
        category: Optional[str] = None,
        quality_score: Optional[float] = None,
        **kwargs
    ) -> Dict[str, Any]:
        """
        Conditionally extract specifications using AI
        """
        provider = self.get_provider(
            quality_score=quality_score,
            category=category,
            **kwargs
        )
        if not provider:
            return {}

        return await provider.extract_specifications(
            description=description,
            mpn=mpn,
            category=category
        )

    async def enhance_description(
        self,
        mpn: str,
        raw_description: str,
        specifications: Optional[Dict] = None,
        quality_score: Optional[float] = None,
        **kwargs
    ) -> str:
        """
        Conditionally enhance description using AI
        """
        provider = self.get_provider(quality_score=quality_score, **kwargs)
        if not provider:
            return raw_description

        return await provider.enhance_description(
            mpn=mpn,
            raw_description=raw_description,
            specifications=specifications
        )

    async def resolve_conflict(
        self,
        field: str,
        values: List[Any],
        component_data: ComponentData,
        quality_score: Optional[float] = None,
        **kwargs
    ) -> Any:
        """
        Conditionally resolve data conflicts using AI
        """
        provider = self.get_provider(
            component_data=component_data,
            quality_score=quality_score,
            **kwargs
        )
        if not provider:
            # Return first value if no AI
            return values[0] if values else None

        return await provider.resolve_conflict(
            field=field,
            values=values,
            component_data=component_data
        )


# ==========================================
# Example Custom Condition Functions
# ==========================================

def use_ai_for_low_quality_or_specific_categories(
    quality_score: Optional[float] = None,
    category: Optional[str] = None,
    **kwargs
) -> bool:
    """
    Custom condition: Use AI for quality < 80 OR specific categories

    Example:
        router = ConditionalAIRouter(
            condition=AICondition.CUSTOM,
            custom_condition=use_ai_for_low_quality_or_specific_categories
        )
    """
    # Use AI if quality is low
    if quality_score and quality_score < 80:
        return True

    # Use AI for complex categories that need help
    complex_categories = ["ICs", "Microcontrollers", "FPGAs"]
    if category and category in complex_categories:
        return True

    # Otherwise, don't use AI
    return False


def use_ai_during_business_hours(**kwargs) -> bool:
    """
    Custom condition: Use AI only during business hours (cost savings)
    """
    from datetime import datetime

    now = datetime.now()
    # Business hours: 9 AM - 6 PM, Monday-Friday
    is_business_hours = (
        now.weekday() < 5 and  # Monday-Friday
        9 <= now.hour < 18     # 9 AM - 6 PM
    )

    return is_business_hours
