"""
Claude AI Provider

Anthropic's Claude AI models for component enrichment.

Configuration:
    CLAUDE_ENABLED=true
    CLAUDE_API_KEY=sk-ant-...
    CLAUDE_MODEL=claude-3-sonnet-20240229
"""

import logging
import json
from typing import Dict, Any, List, Optional

try:
    from anthropic import AsyncAnthropic
    HAS_ANTHROPIC = True
except ImportError:
    HAS_ANTHROPIC = False
    logger = logging.getLogger(__name__)
    logger.warning("anthropic package not installed - Claude provider will not work")

from app.core.interfaces import AIProviderInterface, AISuggestion

logger = logging.getLogger(__name__)


class ClaudeProvider(AIProviderInterface):
    """
    Claude AI provider (Anthropic, cloud-based, paid)

    Benefits:
    - High quality responses
    - Strong reasoning capabilities
    - Large context window
    - JSON output support

    Models:
    - claude-3-opus: Highest quality, slower, more expensive
    - claude-3-sonnet: Balanced quality/speed/cost
    - claude-3-haiku: Fast, cheaper, good for simple tasks

    Costs:
    - Opus: ~$0.015-0.075 per request
    - Sonnet: ~$0.003-0.015 per request
    - Haiku: ~$0.00025-0.00125 per request
    """

    def __init__(
        self,
        api_key: str,
        model: str = "claude-3-sonnet-20240229",
        max_tokens: int = 1000,
        temperature: float = 0.3
    ):
        if not HAS_ANTHROPIC:
            raise ImportError("anthropic package not installed. Install with: pip install anthropic")

        self.api_key = api_key
        self.model = model
        self.max_tokens = max_tokens
        self.temperature = temperature
        self._client: Optional[AsyncAnthropic] = None
        self._initialized = False

    @property
    def plugin_name(self) -> str:
        return "claude-ai-provider"

    @property
    def plugin_version(self) -> str:
        return "1.0.0"

    @property
    def provider_name(self) -> str:
        return "claude"

    @property
    def provider_type(self) -> str:
        return "cloud_api"

    async def initialize(self, config: Dict[str, Any]) -> None:
        """Initialize Claude client"""
        self._client = AsyncAnthropic(api_key=self.api_key)

        logger.info(f"✅ Claude initialized - Model: {self.model}")
        self._initialized = True

    async def shutdown(self) -> None:
        """Close Claude client"""
        if self._client:
            await self._client.close()
            self._client = None
        self._initialized = False

    async def health_check(self) -> Dict[str, Any]:
        """Check Claude API connectivity"""
        if not self._client:
            return {
                "status": "unhealthy",
                "message": "Client not initialized"
            }

        try:
            # Quick test with minimal cost
            response = await self._client.messages.create(
                model=self.model,
                max_tokens=10,
                messages=[{"role": "user", "content": "Hi"}]
            )

            return {
                "status": "healthy",
                "provider": "claude",
                "model": self.model,
                "input_tokens": response.usage.input_tokens,
                "output_tokens": response.usage.output_tokens
            }
        except Exception as e:
            return {
                "status": "unhealthy",
                "provider": "claude",
                "error": str(e)
            }

    async def is_available(self) -> bool:
        """Check if Claude is available"""
        health = await self.health_check()
        return health.get("status") == "healthy"

    async def _messages_api(
        self,
        system: str,
        user_message: str
    ) -> str:
        """
        Call Claude Messages API

        Args:
            system: System prompt
            user_message: User message

        Returns:
            Response text
        """
        if not self._client:
            raise RuntimeError("ClaudeProvider not initialized")

        try:
            response = await self._client.messages.create(
                model=self.model,
                max_tokens=self.max_tokens,
                temperature=self.temperature,
                system=system,
                messages=[
                    {"role": "user", "content": user_message}
                ]
            )

            content = response.content[0].text
            logger.debug(
                f"Claude tokens - Input: {response.usage.input_tokens}, "
                f"Output: {response.usage.output_tokens}"
            )

            return content

        except Exception as e:
            logger.error(f"Claude API error: {e}")
            raise

    async def suggest_category(
        self,
        description: str,
        mpn: str,
        manufacturer: Optional[str] = None,
        available_categories: Optional[List[str]] = None
    ) -> AISuggestion:
        """
        Suggest component category using Claude
        """
        logger.debug(f"Claude category suggestion for {mpn}")

        system = """You are an expert in electronic component classification.
Given a component description, suggest the most appropriate category.
Return your answer as JSON with fields: category, confidence (0-100), reasoning."""

        if available_categories:
            categories_str = "\n".join(f"- {cat}" for cat in available_categories[:50])
            system += f"\n\nAvailable categories:\n{categories_str}"

        user_msg = f"""Manufacturer Part Number: {mpn}
Manufacturer: {manufacturer or "Unknown"}
Description: {description}

Suggest the most appropriate component category. Respond in JSON format only:
{{"category": "suggested category", "confidence": 85, "reasoning": "brief explanation"}}"""

        response_text = await self._messages_api(system, user_msg)

        try:
            # Extract JSON from response (Claude sometimes adds explanations)
            if "```json" in response_text:
                json_start = response_text.find("```json") + 7
                json_end = response_text.find("```", json_start)
                response_text = response_text[json_start:json_end]
            elif "```" in response_text:
                json_start = response_text.find("```") + 3
                json_end = response_text.find("```", json_start)
                response_text = response_text[json_start:json_end]

            result = json.loads(response_text.strip())

            return AISuggestion({
                "field": "category",
                "suggestion": result.get("category"),
                "confidence": float(result.get("confidence", 0)) / 100.0,
                "reasoning": result.get("reasoning", "Claude suggestion")
            })

        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse Claude JSON: {e}")
            logger.debug(f"Raw response: {response_text}")

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
        Extract technical specifications using Claude
        """
        logger.debug(f"Claude spec extraction for {mpn}")

        system = """You are an expert at extracting technical specifications from component descriptions.
Extract key specifications and return them as JSON with parameter names as keys.
Focus on electrical, physical, and environmental specifications."""

        user_msg = f"""Component: {mpn}
Category: {category or "Unknown"}
Description: {description}

Extract all technical specifications. Return as JSON only:
{{"voltage": "3.3V", "current": "500mA", "package": "SOT-23", "temperature": "-40 to 125°C"}}"""

        response_text = await self._messages_api(system, user_msg)

        try:
            # Extract JSON
            if "```json" in response_text:
                json_start = response_text.find("```json") + 7
                json_end = response_text.find("```", json_start)
                response_text = response_text[json_start:json_end]
            elif "```" in response_text:
                json_start = response_text.find("```") + 3
                json_end = response_text.find("```", json_start)
                response_text = response_text[json_start:json_end]

            specs = json.loads(response_text.strip())
            return specs if isinstance(specs, dict) else {}

        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse Claude specs: {e}")
            return {}

    async def enhance_description(
        self,
        mpn: str,
        raw_description: str,
        specifications: Optional[Dict] = None
    ) -> str:
        """
        Enhance component description using Claude
        """
        logger.debug(f"Claude description enhancement for {mpn}")

        system = """You are an expert technical writer for electronic components.
Improve component descriptions to be clear, concise, and technically accurate.
Keep the enhanced description under 200 words."""

        specs_str = ""
        if specifications:
            specs_str = "\nSpecifications: " + ", ".join(f"{k}: {v}" for k, v in specifications.items())

        user_msg = f"""Component: {mpn}
Raw Description: {raw_description}{specs_str}

Enhance this description to be more professional and informative.
Return only the enhanced description (no JSON, no explanations)."""

        enhanced = await self._messages_api(system, user_msg)
        return enhanced.strip()

    async def resolve_conflict(
        self,
        field: str,
        values: List[Any],
        component_data: Any
    ) -> Any:
        """
        Resolve conflicting values using Claude
        """
        logger.debug(f"Claude conflict resolution for field '{field}'")

        system = """You are an expert at resolving conflicting data in electronic component databases.
Given multiple values for a field, choose the most accurate one based on context.
Explain your reasoning briefly."""

        values_str = "\n".join(f"- {v}" for v in values)

        user_msg = f"""Component: {component_data.get('mpn', 'Unknown')}
Field: {field}
Conflicting values:
{values_str}

Which value is most likely correct? Return only the chosen value (no explanations)."""

        result = await self._messages_api(system, user_msg)
        return result.strip()

    async def get_cost_estimate(self) -> Dict[str, float]:
        """
        Cost estimate for Claude API
        """
        cost_per_1m_tokens = {
            "claude-3-opus-20240229": 15.0,  # Input tokens
            "claude-3-sonnet-20240229": 3.0,
            "claude-3-haiku-20240307": 0.25
        }

        # Estimate ~500 tokens per request (input + output)
        # Input is typically more, output less
        base_cost = cost_per_1m_tokens.get(self.model, 3.0) * 0.0005

        return {
            "cost_per_request": base_cost,
            "cost_per_token": cost_per_1m_tokens.get(self.model, 3.0) / 1_000_000,
            "model": self.model
        }
