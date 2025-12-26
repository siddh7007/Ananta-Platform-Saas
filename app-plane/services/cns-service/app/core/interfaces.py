"""
Core Interfaces for CNS Plugin System

Defines abstract base classes (interfaces) that all plugins must implement.
This allows easy swapping of implementations without changing core code.
"""

from abc import ABC, abstractmethod
from typing import Dict, Any, List, Optional
from enum import Enum


# ==========================================
# Enums
# ==========================================

class ProviderType(str, Enum):
    """Types of providers that can be plugged in"""
    AI = "ai"
    SUPPLIER = "supplier"
    WORKFLOW = "workflow"
    NORMALIZER = "normalizer"
    QUALITY_SCORER = "quality_scorer"


class ConfidenceLevel(str, Enum):
    """Confidence levels for AI suggestions"""
    HIGH = "high"      # >= 90%
    MEDIUM = "medium"  # 70-89%
    LOW = "low"        # < 70%


# ==========================================
# Data Models
# ==========================================

class ComponentData(dict):
    """
    Component data structure (flexible dictionary)

    Common fields:
    - mpn: str
    - manufacturer: str
    - description: str
    - category: str
    - datasheet_url: str
    - specifications: dict
    - pricing: list[dict]
    - lifecycle: str
    - rohs: str
    """
    pass


class AISuggestion(dict):
    """
    AI suggestion structure

    Fields:
    - field: str (e.g., "category", "description")
    - suggestion: str (suggested value)
    - confidence: float (0.0-1.0)
    - reasoning: str (why this suggestion)
    """
    pass


class QualityScore(dict):
    """
    Quality score breakdown

    Fields:
    - overall: float (0-100)
    - breakdown: dict (score per field)
    - issues: list[str]
    - missing_fields: list[str]
    """
    pass


# ==========================================
# AI Provider Interface
# ==========================================

class AIProviderInterface(ABC):
    """
    Abstract interface for AI providers

    Implementations:
    - OllamaProvider (local, free)
    - OpenAIProvider (API, paid)
    - ClaudeProvider (API, paid)
    - PerplexityProvider (web search)
    - LangflowProvider (workflow-based AI)
    - NoOpAIProvider (disabled AI)
    """

    @property
    @abstractmethod
    def provider_name(self) -> str:
        """Unique provider name (e.g., "ollama", "langflow")"""
        pass

    @property
    @abstractmethod
    def provider_type(self) -> str:
        """Provider type (e.g., "local", "api", "workflow")"""
        pass

    @abstractmethod
    async def is_available(self) -> bool:
        """Check if provider is available and configured"""
        pass

    @abstractmethod
    async def suggest_category(
        self,
        description: str,
        mpn: str,
        manufacturer: Optional[str] = None,
        available_categories: Optional[List[str]] = None
    ) -> AISuggestion:
        """
        Suggest category for a component

        Returns:
            AISuggestion with category suggestion and confidence
        """
        pass

    @abstractmethod
    async def extract_specifications(
        self,
        description: str,
        mpn: str,
        category: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Extract specifications from description

        Returns:
            Dict of specifications (e.g., {"resistance": "10k", "tolerance": "1%"})
        """
        pass

    @abstractmethod
    async def enhance_description(
        self,
        mpn: str,
        raw_description: str,
        specifications: Optional[Dict] = None
    ) -> str:
        """
        Enhance/clean up component description

        Returns:
            Enhanced description
        """
        pass

    @abstractmethod
    async def resolve_conflict(
        self,
        field: str,
        values: List[Any],
        component_data: ComponentData
    ) -> Any:
        """
        Resolve conflicting data from multiple sources

        Args:
            field: Field name with conflict (e.g., "lifecycle")
            values: List of conflicting values
            component_data: Full component data for context

        Returns:
            Resolved value
        """
        pass

    async def get_cost_estimate(self) -> Dict[str, float]:
        """
        Get cost estimate for this provider

        Returns:
            Dict with cost per request, cost per token, etc.
        """
        return {"cost_per_request": 0.0}


# ==========================================
# Supplier API Interface
# ==========================================

class SupplierInterface(ABC):
    """
    Abstract interface for supplier API clients

    Implementations:
    - MouserClient
    - DigiKeyClient
    - Element14Client
    - OctopartClient
    - SiliconExpertClient
    - MockSupplierClient (for testing)
    """

    @property
    @abstractmethod
    def supplier_name(self) -> str:
        """Supplier name (e.g., "mouser", "digikey")"""
        pass

    @property
    @abstractmethod
    def tier(self) -> int:
        """Supplier tier (1-4)"""
        pass

    @abstractmethod
    async def is_available(self) -> bool:
        """Check if API is available and configured"""
        pass

    @abstractmethod
    async def search_by_mpn(self, mpn: str) -> Optional[ComponentData]:
        """
        Search for component by manufacturer part number

        Returns:
            ComponentData if found, None otherwise
        """
        pass

    @abstractmethod
    async def get_pricing(self, mpn: str) -> List[Dict[str, Any]]:
        """
        Get pricing tiers for component

        Returns:
            List of pricing tiers: [{"quantity": 1, "price": 0.50}, ...]
        """
        pass

    @abstractmethod
    async def get_availability(self, mpn: str) -> Dict[str, Any]:
        """
        Get stock availability

        Returns:
            {"in_stock": 1000, "lead_time_days": 7, "supplier": "mouser"}
        """
        pass

    async def get_rate_limit_status(self) -> Dict[str, Any]:
        """
        Get current rate limit status

        Returns:
            {"remaining": 95, "limit": 100, "reset_at": "2025-11-02T12:00:00Z"}
        """
        return {"remaining": None, "limit": None}


# ==========================================
# Normalizer Interface
# ==========================================

class NormalizerInterface(ABC):
    """
    Abstract interface for data normalizers

    Implementations:
    - MPNNormalizer
    - CategoryNormalizer
    - PriceNormalizer
    - SpecificationNormalizer
    """

    @property
    @abstractmethod
    def normalizer_name(self) -> str:
        """Normalizer name (e.g., "mpn", "category")"""
        pass

    @abstractmethod
    def normalize(self, value: Any, context: Optional[Dict] = None) -> Any:
        """
        Normalize a value

        Args:
            value: Value to normalize
            context: Additional context (e.g., {"manufacturer": "Texas Instruments"})

        Returns:
            Normalized value
        """
        pass

    @abstractmethod
    def validate(self, value: Any) -> bool:
        """
        Validate if value is in correct format

        Returns:
            True if valid, False otherwise
        """
        pass


# ==========================================
# Quality Scorer Interface
# ==========================================

class QualityScorerInterface(ABC):
    """
    Abstract interface for quality scoring

    Implementations:
    - WeightedQualityScorer (default)
    - MLQualityScorer (machine learning-based)
    - RuleBasedQualityScorer
    """

    @property
    @abstractmethod
    def scorer_name(self) -> str:
        """Scorer name (e.g., "weighted", "ml")"""
        pass

    @abstractmethod
    def calculate_score(self, component_data: ComponentData) -> QualityScore:
        """
        Calculate quality score for component data

        Returns:
            QualityScore with overall score and breakdown
        """
        pass

    @abstractmethod
    def get_route(self, score: float) -> str:
        """
        Determine routing based on score

        Args:
            score: Overall quality score (0-100)

        Returns:
            Route: "production", "staging", or "rejected"
        """
        pass


# ==========================================
# Workflow Orchestrator Interface
# ==========================================

class WorkflowOrchestratorInterface(ABC):
    """
    Abstract interface for workflow orchestration

    Implementations:
    - TemporalOrchestrator (distributed workflows)
    - DirectusOrchestrator (simple flows via Directus)
    - LocalOrchestrator (in-process, for testing)
    """

    @property
    @abstractmethod
    def orchestrator_name(self) -> str:
        """Orchestrator name (e.g., "temporal", "directus")"""
        pass

    @abstractmethod
    async def start_bom_enrichment(
        self,
        bom_lines: List[Dict],
        job_id: str,
        customer_id: Optional[int] = None,
        options: Optional[Dict] = None
    ) -> str:
        """
        Start BOM enrichment workflow

        Returns:
            Workflow execution ID
        """
        pass

    @abstractmethod
    async def get_workflow_status(self, execution_id: str) -> Dict[str, Any]:
        """
        Get status of running workflow

        Returns:
            {"status": "running", "progress": 45, "items_processed": 45, ...}
        """
        pass

    @abstractmethod
    async def cancel_workflow(self, execution_id: str) -> bool:
        """
        Cancel running workflow

        Returns:
            True if cancelled successfully
        """
        pass


# ==========================================
# Plugin Interface (Base)
# ==========================================

class PluginInterface(ABC):
    """
    Base interface for all plugins

    All plugins (AI, Supplier, Normalizer, etc.) inherit from this
    """

    @property
    @abstractmethod
    def plugin_name(self) -> str:
        """Unique plugin name"""
        pass

    @property
    @abstractmethod
    def plugin_version(self) -> str:
        """Plugin version (semantic versioning)"""
        pass

    @abstractmethod
    async def initialize(self, config: Dict[str, Any]) -> None:
        """
        Initialize plugin with configuration

        Args:
            config: Plugin-specific configuration
        """
        pass

    @abstractmethod
    async def shutdown(self) -> None:
        """Cleanup resources on shutdown"""
        pass

    @abstractmethod
    async def health_check(self) -> Dict[str, Any]:
        """
        Check plugin health

        Returns:
            {"status": "healthy", "latency_ms": 123, ...}
        """
        pass
