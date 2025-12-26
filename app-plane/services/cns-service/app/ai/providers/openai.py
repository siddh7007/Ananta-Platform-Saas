"""
OpenAI AI Provider

Cloud-based LLM provider using OpenAI's GPT models.

Configuration:
    OPENAI_ENABLED=true
    OPENAI_API_KEY=sk-...
    OPENAI_MODEL=gpt-4-turbo
"""

import logging
import json
from typing import Dict, Any, List, Optional

try:
    from openai import AsyncOpenAI
    HAS_OPENAI = True
except ImportError:
    HAS_OPENAI = False
    logger = logging.getLogger(__name__)
    logger.warning("openai package not installed - OpenAI provider will not work")

from app.core.interfaces import AIProviderInterface, AISuggestion

logger = logging.getLogger(__name__)


class OpenAIProvider(AIProviderInterface):
    """
    OpenAI AI provider (cloud-based, paid)

    Benefits:
    - High quality responses
    - Fast inference
    - Well-documented API
    - JSON mode support

    Costs:
    - GPT-4 Turbo: ~$0.01-0.03 per request
    - GPT-3.5 Turbo: ~$0.001-0.002 per request
    """

    def __init__(
        self,
        api_key: str,
        model: str = "gpt-4-turbo",
        max_tokens: int = 1000,
        temperature: float = 0.3
    ):
        if not HAS_OPENAI:
            raise ImportError("openai package not installed. Install with: pip install openai")

        self.api_key = api_key
        self.model = model
        self.max_tokens = max_tokens
        self.temperature = temperature
        self._client: Optional[AsyncOpenAI] = None
        self._initialized = False

    @property
    def plugin_name(self) -> str:
        return "openai-ai-provider"

    @property
    def plugin_version(self) -> str:
        return "1.0.0"

    @property
    def provider_name(self) -> str:
        return "openai"

    @property
    def provider_type(self) -> str:
        return "cloud_api"

    async def initialize(self, config: Dict[str, Any]) -> None:
        """Initialize OpenAI client"""
        self._client = AsyncOpenAI(api_key=self.api_key)

        # Test connectivity (cheap call)
        try:
            models = await self._client.models.list()
            logger.info(f"✅ OpenAI initialized - Model: {self.model}")
        except Exception as e:
            logger.warning(f"⚠️  OpenAI connectivity test failed: {e}")

        self._initialized = True

    async def shutdown(self) -> None:
        """Close OpenAI client"""
        if self._client:
            await self._client.close()
            self._client = None
        self._initialized = False

    async def health_check(self) -> Dict[str, Any]:
        """Check OpenAI API connectivity"""
        if not self._client:
            return {
                "status": "unhealthy",
                "message": "Client not initialized"
            }

        try:
            # Quick test with minimal cost
            response = await self._client.chat.completions.create(
                model=self.model,
                messages=[{"role": "user", "content": "Hi"}],
                max_tokens=5
            )

            return {
                "status": "healthy",
                "provider": "openai",
                "model": self.model,
                "tokens_used": response.usage.total_tokens
            }
        except Exception as e:
            return {
                "status": "unhealthy",
                "provider": "openai",
                "error": str(e)
            }

    async def is_available(self) -> bool:
        """Check if OpenAI is available"""
        health = await self.health_check()
        return health.get("status") == "healthy"

    async def _chat_completion(
        self,
        messages: List[Dict[str, str]],
        response_format: Optional[Dict] = None
    ) -> str:
        """
        Call OpenAI chat completion API

        Args:
            messages: List of message dicts with role and content
            response_format: Optional format specification (e.g., {"type": "json_object"})

        Returns:
            Response text
        """
        if not self._client:
            raise RuntimeError("OpenAIProvider not initialized")

        try:
            params = {
                "model": self.model,
                "messages": messages,
                "max_tokens": self.max_tokens,
                "temperature": self.temperature
            }

            if response_format:
                params["response_format"] = response_format

            response = await self._client.chat.completions.create(**params)

            content = response.choices[0].message.content
            logger.debug(f"OpenAI tokens used: {response.usage.total_tokens}")

            return content

        except Exception as e:
            logger.error(f"OpenAI API error: {e}")
            raise

    async def suggest_category(
        self,
        description: str,
        mpn: str,
        manufacturer: Optional[str] = None,
        available_categories: Optional[List[str]] = None
    ) -> AISuggestion:
        """
        Suggest component category using OpenAI
        """
        logger.debug(f"OpenAI category suggestion for {mpn}")

        system = """You are an expert in electronic component classification.
Given a component description, suggest the most appropriate category.
Return your answer as JSON with fields: category, confidence (0-100), reasoning."""

        if available_categories:
            categories_str = "\n".join(f"- {cat}" for cat in available_categories[:50])
            system += f"\n\nAvailable categories:\n{categories_str}"

        user_msg = f"""Manufacturer Part Number: {mpn}
Manufacturer: {manufacturer or "Unknown"}
Description: {description}

Suggest the most appropriate component category. Respond in JSON format:
{{"category": "suggested category", "confidence": 85, "reasoning": "brief explanation"}}"""

        messages = [
            {"role": "system", "content": system},
            {"role": "user", "content": user_msg}
        ]

        response_text = await self._chat_completion(
            messages,
            response_format={"type": "json_object"}
        )

        try:
            result = json.loads(response_text)

            return AISuggestion({
                "field": "category",
                "suggestion": result.get("category"),
                "confidence": float(result.get("confidence", 0)) / 100.0,
                "reasoning": result.get("reasoning", "OpenAI suggestion")
            })

        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse OpenAI JSON: {e}")
            return AISuggestion({
                "field": "category",
                "suggestion": "Unknown",
                "confidence": 0.0,
                "reasoning": f"Parse error: {str(e)}"
            })

    async def extract_specifications(
        self,
        description: str,
        mpn: str,
        category: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Extract technical specifications using OpenAI
        """
        logger.debug(f"OpenAI spec extraction for {mpn}")

        system = """You are an expert at extracting technical specifications from component descriptions.
Extract key specifications and return them as JSON with parameter names as keys.
Focus on electrical, physical, and environmental specifications."""

        user_msg = f"""Component: {mpn}
Category: {category or "Unknown"}
Description: {description}

Extract all technical specifications. Return as JSON:
{{"voltage": "3.3V", "current": "500mA", "package": "SOT-23"}}"""

        messages = [
            {"role": "system", "content": system},
            {"role": "user", "content": user_msg}
        ]

        response_text = await self._chat_completion(
            messages,
            response_format={"type": "json_object"}
        )

        try:
            specs = json.loads(response_text)
            return specs if isinstance(specs, dict) else {}
        except json.JSONDecodeError:
            logger.error("Failed to parse OpenAI specs response")
            return {}

    async def enhance_description(
        self,
        mpn: str,
        raw_description: str,
        specifications: Optional[Dict] = None
    ) -> str:
        """
        Enhance component description using OpenAI
        """
        logger.debug(f"OpenAI description enhancement for {mpn}")

        system = """You are an expert technical writer for electronic components.
Improve component descriptions to be clear, concise, and technically accurate.
Keep the enhanced description under 200 words."""

        specs_str = ""
        if specifications:
            specs_str = "\nSpecifications: " + ", ".join(f"{k}: {v}" for k, v in specifications.items())

        user_msg = f"""Component: {mpn}
Raw Description: {raw_description}{specs_str}

Enhance this description to be more professional and informative."""

        messages = [
            {"role": "system", "content": system},
            {"role": "user", "content": user_msg}
        ]

        enhanced = await self._chat_completion(messages)
        return enhanced.strip()

    async def resolve_conflict(
        self,
        field: str,
        values: List[Any],
        component_data: Any
    ) -> Any:
        """
        Resolve conflicting values using OpenAI
        """
        logger.debug(f"OpenAI conflict resolution for field '{field}'")

        system = """You are an expert at resolving conflicting data in electronic component databases.
Given multiple values for a field, choose the most accurate one based on context."""

        values_str = "\n".join(f"- {v}" for v in values)

        user_msg = f"""Component: {component_data.get('mpn', 'Unknown')}
Field: {field}
Conflicting values:
{values_str}

Which value is most likely correct? Return only the chosen value."""

        messages = [
            {"role": "system", "content": system},
            {"role": "user", "content": user_msg}
        ]

        result = await self._chat_completion(messages)
        return result.strip()

    async def get_cost_estimate(self) -> Dict[str, float]:
        """
        Cost estimate for OpenAI API
        """
        cost_per_1k_tokens = {
            "gpt-4-turbo": 0.03,
            "gpt-4": 0.06,
            "gpt-3.5-turbo": 0.002
        }

        # Estimate ~500 tokens per request (input + output)
        base_cost = cost_per_1k_tokens.get(self.model, 0.03) * 0.5

        return {
            "cost_per_request": base_cost,
            "cost_per_token": cost_per_1k_tokens.get(self.model, 0.03) / 1000,
            "model": self.model
        }
