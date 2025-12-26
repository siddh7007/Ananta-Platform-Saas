"""
Langflow AI Provider

Integrates with Langflow for workflow-based AI operations.
Langflow provides visual workflow building for AI tasks.

Configuration:
    LANGFLOW_ENABLED=true
    LANGFLOW_URL=http://langflow:7860
    LANGFLOW_API_KEY=your-api-key
    LANGFLOW_FLOW_ID_CATEGORY=uuid-for-category-flow
    LANGFLOW_FLOW_ID_SPECS=uuid-for-specs-flow
"""

import logging
import httpx
from typing import Dict, Any, List, Optional

from app.core.interfaces import AIProviderInterface, AISuggestion

logger = logging.getLogger(__name__)


class LangflowProvider(AIProviderInterface):
    """
    Langflow AI provider

    Uses Langflow workflows for AI operations.
    Each AI task (category suggestion, spec extraction, etc.) can have
    its own custom Langflow workflow.
    """

    def __init__(
        self,
        base_url: str,
        api_key: Optional[str] = None,
        flow_id_category: Optional[str] = None,
        flow_id_specs: Optional[str] = None,
        flow_id_description: Optional[str] = None,
        timeout: int = 30
    ):
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.flow_id_category = flow_id_category
        self.flow_id_specs = flow_id_specs
        self.flow_id_description = flow_id_description
        self.timeout = timeout
        self._client: Optional[httpx.AsyncClient] = None
        self._initialized = False

    @property
    def plugin_name(self) -> str:
        return "langflow-ai-provider"

    @property
    def plugin_version(self) -> str:
        return "1.0.0"

    @property
    def provider_name(self) -> str:
        return "langflow"

    @property
    def provider_type(self) -> str:
        return "workflow"

    async def initialize(self, config: Dict[str, Any]) -> None:
        """Initialize HTTP client"""
        headers = {}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"

        self._client = httpx.AsyncClient(
            base_url=self.base_url,
            headers=headers,
            timeout=self.timeout
        )

        logger.info(f"LangflowProvider initialized (URL: {self.base_url})")
        self._initialized = True

    async def shutdown(self) -> None:
        """Close HTTP client"""
        if self._client:
            await self._client.aclose()
            self._client = None
        self._initialized = False

    async def health_check(self) -> Dict[str, Any]:
        """Check Langflow connectivity"""
        if not self._client:
            return {
                "status": "unhealthy",
                "message": "Client not initialized"
            }

        try:
            # Try to ping Langflow API
            response = await self._client.get("/api/v1/health", timeout=5.0)
            response.raise_for_status()

            return {
                "status": "healthy",
                "provider": "langflow",
                "url": self.base_url,
                "latency_ms": int(response.elapsed.total_seconds() * 1000)
            }
        except Exception as e:
            return {
                "status": "unhealthy",
                "provider": "langflow",
                "error": str(e)
            }

    async def is_available(self) -> bool:
        """Check if Langflow is available"""
        health = await self.health_check()
        return health.get("status") == "healthy"

    async def _run_flow(
        self,
        flow_id: str,
        inputs: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Run a Langflow workflow

        Args:
            flow_id: Langflow flow UUID
            inputs: Input data for the flow

        Returns:
            Flow output as dict
        """
        if not self._client:
            raise RuntimeError("LangflowProvider not initialized")

        if not flow_id:
            raise ValueError("Flow ID not configured")

        try:
            response = await self._client.post(
                f"/api/v1/run/{flow_id}",
                json={"inputs": inputs}
            )
            response.raise_for_status()
            return response.json()

        except httpx.HTTPStatusError as e:
            logger.error(f"Langflow API error: {e.response.status_code} - {e.response.text}")
            raise
        except Exception as e:
            logger.error(f"Langflow error: {e}")
            raise

    async def suggest_category(
        self,
        description: str,
        mpn: str,
        manufacturer: Optional[str] = None,
        available_categories: Optional[List[str]] = None
    ) -> AISuggestion:
        """
        Suggest category using Langflow workflow
        """
        logger.debug(f"Langflow category suggestion for {mpn}")

        result = await self._run_flow(
            self.flow_id_category,
            {
                "mpn": mpn,
                "description": description,
                "manufacturer": manufacturer or "",
                "available_categories": available_categories or []
            }
        )

        # Parse Langflow output
        # Expected format: {"category": "...", "confidence": 0.85, "reasoning": "..."}
        output = result.get("outputs", [{}])[0]

        return AISuggestion({
            "field": "category",
            "suggestion": output.get("category"),
            "confidence": output.get("confidence", 0.0),
            "reasoning": output.get("reasoning", "Langflow suggestion")
        })

    async def extract_specifications(
        self,
        description: str,
        mpn: str,
        category: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Extract specifications using Langflow workflow
        """
        logger.debug(f"Langflow spec extraction for {mpn}")

        result = await self._run_flow(
            self.flow_id_specs,
            {
                "mpn": mpn,
                "description": description,
                "category": category or ""
            }
        )

        # Parse Langflow output
        # Expected format: {"specifications": {"resistance": "10k", ...}}
        output = result.get("outputs", [{}])[0]
        return output.get("specifications", {})

    async def enhance_description(
        self,
        mpn: str,
        raw_description: str,
        specifications: Optional[Dict] = None
    ) -> str:
        """
        Enhance description using Langflow workflow
        """
        logger.debug(f"Langflow description enhancement for {mpn}")

        result = await self._run_flow(
            self.flow_id_description,
            {
                "mpn": mpn,
                "raw_description": raw_description,
                "specifications": specifications or {}
            }
        )

        # Parse Langflow output
        output = result.get("outputs", [{}])[0]
        return output.get("enhanced_description", raw_description)

    async def resolve_conflict(
        self,
        field: str,
        values: List[Any],
        component_data: Any
    ) -> Any:
        """
        Resolve conflict (use first value - could be enhanced with Langflow)
        """
        logger.debug(f"Langflow conflict resolution for {field}")
        # TODO: Create dedicated Langflow workflow for conflict resolution
        return values[0] if values else None

    async def get_cost_estimate(self) -> Dict[str, float]:
        """
        Cost estimate (Langflow is self-hosted, so mainly compute cost)
        """
        return {
            "cost_per_request": 0.0,  # Self-hosted
            "cost_per_token": 0.0,
            "monthly_compute_cost": 50.0  # Estimated server cost
        }
