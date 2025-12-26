"""
Plugin Manager for CNS Service

Manages registration, loading, and lifecycle of all plugins.
Provides dependency injection for plugins throughout the application.
"""

import logging
from typing import Dict, List, Optional, Type, Any
from app.core.interfaces import (
    PluginInterface,
    AIProviderInterface,
    SupplierInterface,
    NormalizerInterface,
    QualityScorerInterface,
    WorkflowOrchestratorInterface,
    ProviderType
)

logger = logging.getLogger(__name__)


class PluginManager:
    """
    Central plugin manager for CNS service

    Responsibilities:
    - Register plugins
    - Initialize plugins
    - Provide plugin instances
    - Manage plugin lifecycle
    - Handle plugin dependencies
    """

    def __init__(self):
        self._plugins: Dict[str, PluginInterface] = {}
        self._ai_providers: Dict[str, AIProviderInterface] = {}
        self._suppliers: Dict[str, SupplierInterface] = {}
        self._normalizers: Dict[str, NormalizerInterface] = {}
        self._quality_scorers: Dict[str, QualityScorerInterface] = {}
        self._workflow_orchestrators: Dict[str, WorkflowOrchestratorInterface] = {}
        self._initialized = False

        # Track plugin availability for graceful degradation
        self._plugin_status: Dict[str, str] = {}  # plugin_key -> "available" | "unavailable" | "error"
        self._plugin_errors: Dict[str, str] = {}  # plugin_key -> error_message

    # ==========================================
    # Registration Methods
    # ==========================================

    def register_ai_provider(
        self,
        provider: AIProviderInterface,
        priority: int = 100
    ) -> None:
        """
        Register an AI provider

        Args:
            provider: AI provider instance
            priority: Lower number = higher priority (default: 100)
        """
        name = provider.provider_name
        logger.info(f"Registering AI provider: {name} (priority: {priority})")

        self._ai_providers[name] = provider
        self._plugins[f"ai_{name}"] = provider

    def register_supplier(
        self,
        supplier: SupplierInterface,
        tier: int
    ) -> None:
        """
        Register a supplier API client

        Args:
            supplier: Supplier instance
            tier: Supplier tier (1-4)
        """
        name = supplier.supplier_name
        logger.info(f"Registering supplier: {name} (tier: {tier})")

        self._suppliers[name] = supplier
        self._plugins[f"supplier_{name}"] = supplier

    def register_normalizer(
        self,
        normalizer: NormalizerInterface
    ) -> None:
        """
        Register a normalizer

        Args:
            normalizer: Normalizer instance
        """
        name = normalizer.normalizer_name
        logger.info(f"Registering normalizer: {name}")

        self._normalizers[name] = normalizer
        self._plugins[f"normalizer_{name}"] = normalizer

    def register_quality_scorer(
        self,
        scorer: QualityScorerInterface,
        make_default: bool = False
    ) -> None:
        """
        Register a quality scorer

        Args:
            scorer: Quality scorer instance
            make_default: Set as default scorer
        """
        name = scorer.scorer_name
        logger.info(f"Registering quality scorer: {name} (default: {make_default})")

        self._quality_scorers[name] = scorer
        self._plugins[f"scorer_{name}"] = scorer

        if make_default or len(self._quality_scorers) == 1:
            self._quality_scorers["default"] = scorer

    def register_workflow_orchestrator(
        self,
        orchestrator: WorkflowOrchestratorInterface,
        make_default: bool = False
    ) -> None:
        """
        Register a workflow orchestrator

        Args:
            orchestrator: Workflow orchestrator instance
            make_default: Set as default orchestrator
        """
        name = orchestrator.orchestrator_name
        logger.info(f"Registering workflow orchestrator: {name} (default: {make_default})")

        self._workflow_orchestrators[name] = orchestrator
        self._plugins[f"orchestrator_{name}"] = orchestrator

        if make_default or len(self._workflow_orchestrators) == 1:
            self._workflow_orchestrators["default"] = orchestrator

    # ==========================================
    # Retrieval Methods
    # ==========================================

    def is_plugin_available(self, plugin_key: str) -> bool:
        """
        Check if a plugin is available (initialized without errors)

        Args:
            plugin_key: Plugin key (e.g., "ai_ollama", "supplier_mouser")

        Returns:
            True if plugin is available, False otherwise
        """
        return self._plugin_status.get(plugin_key) == "available"

    def get_unavailable_plugins(self) -> List[Dict[str, str]]:
        """
        Get list of unavailable plugins with error messages

        Returns:
            List of dicts with plugin info and errors
        """
        unavailable = []
        for plugin_key, status in self._plugin_status.items():
            if status in ("unavailable", "error"):
                plugin = self._plugins.get(plugin_key)
                unavailable.append({
                    "plugin_key": plugin_key,
                    "plugin_name": plugin.plugin_name if plugin else "unknown",
                    "status": status,
                    "error": self._plugin_errors.get(plugin_key, "Unknown error")
                })
        return unavailable

    def get_ai_provider(self, name: Optional[str] = None) -> Optional[AIProviderInterface]:
        """
        Get AI provider by name, or first available provider

        Args:
            name: Provider name (e.g., "ollama", "langflow")

        Returns:
            AI provider instance or None (skips unavailable plugins)
        """
        if name:
            plugin_key = f"ai_{name}"
            # Skip if plugin failed to initialize
            if not self.is_plugin_available(plugin_key):
                logger.warning(f"AI provider '{name}' is unavailable")
                return None
            return self._ai_providers.get(name)

        # Return first available provider
        for provider_name, provider in self._ai_providers.items():
            plugin_key = f"ai_{provider_name}"
            if self.is_plugin_available(plugin_key):
                return provider

        logger.warning("No available AI providers found")
        return None

    def get_available_ai_providers(self) -> List[AIProviderInterface]:
        """
        Get all registered and available AI providers

        Returns:
            List of available AI providers (sorted by priority)
        """
        return list(self._ai_providers.values())

    def get_supplier(self, name: str) -> Optional[SupplierInterface]:
        """
        Get supplier by name

        Args:
            name: Supplier name (e.g., "mouser", "digikey")

        Returns:
            Supplier instance or None
        """
        return self._suppliers.get(name)

    def get_suppliers_by_tier(self, tier: int) -> List[SupplierInterface]:
        """
        Get all suppliers in a specific tier

        Args:
            tier: Tier number (1-4)

        Returns:
            List of suppliers in that tier
        """
        return [s for s in self._suppliers.values() if s.tier == tier]

    def get_all_suppliers(self) -> List[SupplierInterface]:
        """
        Get all registered suppliers (sorted by tier)

        Returns:
            List of all suppliers
        """
        suppliers = list(self._suppliers.values())
        return sorted(suppliers, key=lambda s: s.tier)

    def get_normalizer(self, name: str) -> Optional[NormalizerInterface]:
        """
        Get normalizer by name

        Args:
            name: Normalizer name (e.g., "mpn", "category")

        Returns:
            Normalizer instance or None
        """
        return self._normalizers.get(name)

    def get_all_normalizers(self) -> Dict[str, NormalizerInterface]:
        """
        Get all registered normalizers

        Returns:
            Dict of normalizers {name: instance}
        """
        return self._normalizers.copy()

    def get_quality_scorer(self, name: str = "default") -> Optional[QualityScorerInterface]:
        """
        Get quality scorer by name

        Args:
            name: Scorer name (default: "default")

        Returns:
            Quality scorer instance or None
        """
        return self._quality_scorers.get(name)

    def get_workflow_orchestrator(
        self,
        name: str = "default"
    ) -> Optional[WorkflowOrchestratorInterface]:
        """
        Get workflow orchestrator by name

        Args:
            name: Orchestrator name (default: "default")

        Returns:
            Workflow orchestrator instance or None
        """
        return self._workflow_orchestrators.get(name)

    # ==========================================
    # Lifecycle Methods
    # ==========================================

    async def initialize_all(self, config: Dict[str, Any]) -> Dict[str, Any]:
        """
        Initialize all registered plugins with graceful degradation

        Args:
            config: Global configuration dict

        Returns:
            Dict with initialization summary
        """
        if self._initialized:
            logger.warning("Plugins already initialized")
            return {
                "status": "already_initialized",
                "initialized": [],
                "failed": []
            }

        logger.info(f"Initializing {len(self._plugins)} plugins...")

        initialized = []
        failed = []

        for plugin_key, plugin in self._plugins.items():
            try:
                plugin_config = config.get(plugin_key, {})
                await plugin.initialize(plugin_config)
                self._plugin_status[plugin_key] = "available"
                initialized.append(plugin_key)
                logger.info(f"✓ Initialized: {plugin.plugin_name}")
            except Exception as e:
                self._plugin_status[plugin_key] = "error"
                self._plugin_errors[plugin_key] = str(e)
                failed.append({
                    "plugin": plugin_key,
                    "name": plugin.plugin_name,
                    "error": str(e)
                })
                logger.error(f"✗ Failed to initialize {plugin_key}: {e}")
                # Continue initializing other plugins (graceful degradation)

        self._initialized = True

        # Determine overall status
        if len(failed) == 0:
            overall_status = "healthy"
            logger.info(f"✅ All {len(initialized)} plugins initialized successfully")
        elif len(initialized) > 0:
            overall_status = "degraded"
            logger.warning(
                f"⚠️  {len(initialized)} plugins initialized, {len(failed)} failed. "
                f"Service running in degraded mode."
            )
        else:
            overall_status = "critical"
            logger.error(f"❌ All plugins failed to initialize. Service may not function properly.")

        return {
            "status": overall_status,
            "total": len(self._plugins),
            "initialized": initialized,
            "initialized_count": len(initialized),
            "failed": failed,
            "failed_count": len(failed)
        }

    async def shutdown_all(self) -> None:
        """
        Shutdown all plugins and cleanup resources
        """
        if not self._initialized:
            return

        logger.info(f"Shutting down {len(self._plugins)} plugins...")

        for plugin_key, plugin in self._plugins.items():
            try:
                await plugin.shutdown()
                logger.info(f"✓ Shutdown: {plugin.plugin_name}")
            except Exception as e:
                logger.error(f"✗ Failed to shutdown {plugin_key}: {e}")

        self._initialized = False
        logger.info("All plugins shutdown")

    async def health_check_all(self) -> Dict[str, Any]:
        """
        Run health checks on all plugins

        Returns:
            Dict with health status of each plugin
        """
        results = {}

        for plugin_key, plugin in self._plugins.items():
            try:
                health = await plugin.health_check()
                results[plugin_key] = {
                    "status": health.get("status", "unknown"),
                    "name": plugin.plugin_name,
                    "version": plugin.plugin_version,
                    "details": health
                }
            except Exception as e:
                results[plugin_key] = {
                    "status": "error",
                    "name": plugin.plugin_name,
                    "error": str(e)
                }

        # Overall status
        all_healthy = all(
            r.get("status") == "healthy"
            for r in results.values()
        )

        return {
            "overall_status": "healthy" if all_healthy else "degraded",
            "plugins": results,
            "total_plugins": len(self._plugins)
        }

    # ==========================================
    # Utility Methods
    # ==========================================

    def list_plugins(self) -> Dict[str, List[str]]:
        """
        List all registered plugins by type

        Returns:
            Dict with plugin lists by type
        """
        return {
            "ai_providers": list(self._ai_providers.keys()),
            "suppliers": list(self._suppliers.keys()),
            "normalizers": list(self._normalizers.keys()),
            "quality_scorers": list(self._quality_scorers.keys()),
            "workflow_orchestrators": list(self._workflow_orchestrators.keys()),
        }

    def get_plugin_info(self, plugin_key: str) -> Optional[Dict[str, Any]]:
        """
        Get detailed info about a specific plugin

        Args:
            plugin_key: Plugin key (e.g., "ai_ollama", "supplier_mouser")

        Returns:
            Dict with plugin information
        """
        plugin = self._plugins.get(plugin_key)
        if not plugin:
            return None

        return {
            "name": plugin.plugin_name,
            "version": plugin.plugin_version,
            "key": plugin_key,
        }

    def is_initialized(self) -> bool:
        """Check if plugins are initialized"""
        return self._initialized


# ==========================================
# Global Plugin Manager Instance
# ==========================================

# Singleton instance
_plugin_manager = None


def get_plugin_manager() -> PluginManager:
    """
    Get global plugin manager instance (singleton)

    Returns:
        PluginManager instance
    """
    global _plugin_manager
    if _plugin_manager is None:
        _plugin_manager = PluginManager()
    return _plugin_manager
