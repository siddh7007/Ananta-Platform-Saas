"""
Ollama AI Provider

Local, self-hosted LLM provider using Ollama.
Supports multiple models: llama3, mistral, codellama, etc.

Configuration:
    OLLAMA_ENABLED=true
    OLLAMA_URL=http://ollama:27260
    OLLAMA_MODEL=llama3:8b
"""

import logging
import httpx
import json
from typing import Dict, Any, List, Optional

from app.core.interfaces import AIProviderInterface, AISuggestion

logger = logging.getLogger(__name__)


class OllamaProvider(AIProviderInterface):
    """
    Ollama AI provider (local, self-hosted)

    Benefits:
    - Free (no API costs)
    - Fast (local network)
    - Private (no data leaves infrastructure)
    - Multiple model support
    """

    def __init__(
        self,
        base_url: str,
        model: str = "llama3:8b",
        timeout: int = 60,
        max_retries: int = 2
    ):
        self.base_url = base_url.rstrip("/")
        self.model = model
        self.timeout = timeout
        self.max_retries = max_retries
        self._client: Optional[httpx.AsyncClient] = None
        self._initialized = False

    @property
    def plugin_name(self) -> str:
        return "ollama-ai-provider"

    @property
    def plugin_version(self) -> str:
        return "1.0.0"

    @property
    def provider_name(self) -> str:
        return "ollama"

    @property
    def provider_type(self) -> str:
        return "local_llm"

    async def initialize(self, config: Dict[str, Any]) -> None:
        """Initialize HTTP client"""
        self._client = httpx.AsyncClient(
            base_url=self.base_url,
            timeout=self.timeout
        )

        # Test connectivity
        try:
            response = await self._client.get("/api/tags")
            response.raise_for_status()
            models = response.json()
            logger.info(f"✅ Ollama initialized - Available models: {len(models.get('models', []))}")
        except Exception as e:
            logger.warning(f"⚠️  Ollama connectivity test failed: {e}")

        self._initialized = True

    async def shutdown(self) -> None:
        """Close HTTP client"""
        if self._client:
            await self._client.aclose()
            self._client = None
        self._initialized = False

    async def health_check(self) -> Dict[str, Any]:
        """Check Ollama connectivity"""
        if not self._client:
            return {
                "status": "unhealthy",
                "message": "Client not initialized"
            }

        try:
            response = await self._client.get("/api/tags", timeout=5.0)
            response.raise_for_status()
            models_data = response.json()

            return {
                "status": "healthy",
                "provider": "ollama",
                "url": self.base_url,
                "model": self.model,
                "available_models": len(models_data.get("models", [])),
                "latency_ms": int(response.elapsed.total_seconds() * 1000)
            }
        except Exception as e:
            return {
                "status": "unhealthy",
                "provider": "ollama",
                "error": str(e)
            }

    async def is_available(self) -> bool:
        """Check if Ollama is available"""
        health = await self.health_check()
        return health.get("status") == "healthy"

    async def _generate(self, prompt: str, system: Optional[str] = None) -> str:
        """
        Generate text using Ollama

        Args:
            prompt: User prompt
            system: Optional system message

        Returns:
            Generated text
        """
        if not self._client:
            raise RuntimeError("OllamaProvider not initialized")

        payload = {
            "model": self.model,
            "prompt": prompt,
            "stream": False
        }

        if system:
            payload["system"] = system

        try:
            response = await self._client.post(
                "/api/generate",
                json=payload,
                timeout=self.timeout
            )
            response.raise_for_status()
            result = response.json()
            return result.get("response", "")

        except httpx.HTTPStatusError as e:
            logger.error(f"Ollama API error: {e.response.status_code} - {e.response.text}")
            raise
        except Exception as e:
            logger.error(f"Ollama error: {e}")
            raise

    async def suggest_category(
        self,
        description: str,
        mpn: str,
        manufacturer: Optional[str] = None,
        available_categories: Optional[List[str]] = None
    ) -> AISuggestion:
        """
        Suggest component category using Ollama
        """
        logger.debug(f"Ollama category suggestion for {mpn}")

        # Build prompt
        system = """You are an expert in electronic component classification.
Given a component description, suggest the most appropriate category.
Return your answer as JSON with fields: category, confidence (0-100), reasoning."""

        if available_categories:
            categories_str = "\n".join(f"- {cat}" for cat in available_categories[:50])
            system += f"\n\nAvailable categories:\n{categories_str}"

        prompt = f"""Manufacturer Part Number: {mpn}
Manufacturer: {manufacturer or "Unknown"}
Description: {description}

Suggest the most appropriate component category. Respond in JSON format only:
{{"category": "suggested category", "confidence": 85, "reasoning": "brief explanation"}}"""

        response_text = await self._generate(prompt, system)

        # Parse JSON from response
        try:
            # Extract JSON from markdown code blocks if present
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
                "confidence": float(result.get("confidence", 0)) / 100.0,  # Convert to 0-1
                "reasoning": result.get("reasoning", "Ollama suggestion")
            })

        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse Ollama JSON response: {e}")
            logger.debug(f"Raw response: {response_text}")

            # Fallback: extract category from text
            return AISuggestion({
                "field": "category",
                "suggestion": "Unknown",
                "confidence": 0.0,
                "reasoning": f"Failed to parse response: {str(e)}"
            })

    async def extract_specifications(
        self,
        description: str,
        mpn: str,
        category: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Extract technical specifications using Ollama
        """
        logger.debug(f"Ollama spec extraction for {mpn}")

        system = """You are an expert at extracting technical specifications from component descriptions.
Extract key specifications and return them as JSON with parameter names as keys.
Focus on electrical, physical, and environmental specifications."""

        prompt = f"""Component: {mpn}
Category: {category or "Unknown"}
Description: {description}

Extract all technical specifications from the description.
Return as JSON only (no other text):
{{"voltage": "3.3V", "current": "500mA", "package": "SOT-23", "temperature": "-40 to 125°C"}}"""

        response_text = await self._generate(prompt, system)

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
            logger.error(f"Failed to parse Ollama specs: {e}")
            return {}

    async def enhance_description(
        self,
        mpn: str,
        raw_description: str,
        specifications: Optional[Dict] = None
    ) -> str:
        """
        Enhance component description using Ollama
        """
        logger.debug(f"Ollama description enhancement for {mpn}")

        system = """You are an expert technical writer for electronic components.
Improve component descriptions to be clear, concise, and technically accurate.
Keep the enhanced description under 200 words."""

        specs_str = ""
        if specifications:
            specs_str = "\nSpecifications: " + ", ".join(f"{k}: {v}" for k, v in specifications.items())

        prompt = f"""Component: {mpn}
Raw Description: {raw_description}{specs_str}

Enhance this description to be more professional and informative.
Return only the enhanced description (no JSON, no explanations)."""

        enhanced = await self._generate(prompt, system)
        return enhanced.strip()

    async def resolve_conflict(
        self,
        field: str,
        values: List[Any],
        component_data: Any
    ) -> Any:
        """
        Resolve conflicting values using Ollama
        """
        logger.debug(f"Ollama conflict resolution for field '{field}'")

        system = """You are an expert at resolving conflicting data in electronic component databases.
Given multiple values for a field, choose the most accurate one based on context."""

        values_str = "\n".join(f"- {v}" for v in values)

        prompt = f"""Component: {component_data.get('mpn', 'Unknown')}
Field: {field}
Conflicting values:
{values_str}

Which value is most likely correct? Return only the chosen value (no explanations)."""

        result = await self._generate(prompt, system)
        return result.strip()

    async def get_cost_estimate(self) -> Dict[str, float]:
        """
        Cost estimate (Ollama is free/self-hosted)
        """
        return {
            "cost_per_request": 0.0,
            "cost_per_token": 0.0,
            "monthly_compute_cost": 0.0  # Self-hosted
        }
