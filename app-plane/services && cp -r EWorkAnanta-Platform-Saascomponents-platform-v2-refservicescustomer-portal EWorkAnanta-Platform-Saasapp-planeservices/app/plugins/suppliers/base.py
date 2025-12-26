"""
Base Supplier Plugin Interface

Defines the contract for supplier API integrations.
All supplier plugins must implement this interface.
"""

from abc import ABC, abstractmethod
from typing import List, Optional, Dict, Any
from dataclasses import dataclass, field
from datetime import datetime
import logging

logger = logging.getLogger(__name__)


@dataclass
class SupplierSearchResult:
    """
    Result from supplier search query.

    Contains basic product information returned from search.
    """
    mpn: str
    manufacturer: str
    description: str
    availability: Optional[int] = None
    unit_price: Optional[float] = None
    currency: str = 'USD'
    datasheet_url: Optional[str] = None
    supplier_sku: Optional[str] = None
    supplier_url: Optional[str] = None
    lifecycle_status: Optional[str] = None
    match_confidence: float = 100.0  # 0-100% match confidence


@dataclass
class SupplierProductData:
    """
    Complete product data from supplier API.

    Contains enriched product information including parameters,
    compliance data, pricing tiers, etc.
    """
    # Basic info
    mpn: str
    manufacturer: str
    description: str
    category: Optional[str] = None

    # Taxonomy / Category Hierarchy (Phase 2)
    category_path: Optional[str] = None  # Full hierarchy: "Semiconductors > ICs > Microcontrollers"
    subcategory: Optional[str] = None  # Second level: "ARM Microcontrollers"
    product_family: Optional[str] = None  # Family: "STM32F4 Series"
    product_series: Optional[str] = None  # Series: "STM32F4"

    # Availability & Pricing
    supplier_sku: Optional[str] = None
    availability: Optional[int] = None
    unit_price: Optional[float] = None
    currency: str = 'USD'
    price_breaks: List[Dict[str, Any]] = field(default_factory=list)  # [{qty: 100, price: 1.50}]
    lead_time_days: Optional[int] = None

    # Technical specs
    datasheet_url: Optional[str] = None
    image_url: Optional[str] = None
    model_3d_url: Optional[str] = None  # 3D CAD model (STEP, STP, etc.)
    lifecycle_status: Optional[str] = None
    package: Optional[str] = None

    # Parameters (structured technical attributes)
    parameters: Dict[str, Any] = field(default_factory=dict)
    # Example: {
    #   "operating_temperature": {"min": -40, "max": 85, "unit": "°C"},
    #   "supply_voltage": {"min": 2.7, "max": 3.6, "unit": "V"},
    #   "frequency": {"value": 72, "unit": "MHz"}
    # }

    # Compliance data
    rohs_compliant: Optional[bool] = None
    reach_compliant: Optional[bool] = None
    halogen_free: Optional[bool] = None
    aec_qualified: Optional[bool] = None
    eccn_code: Optional[str] = None

    # Metadata
    supplier_name: Optional[str] = None
    supplier_url: Optional[str] = None
    last_updated: Optional[datetime] = None
    match_confidence: float = 100.0

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for serialization"""
        return {
            'mpn': self.mpn,
            'manufacturer': self.manufacturer,
            'description': self.description,
            'category': self.category,
            'category_path': self.category_path,
            'subcategory': self.subcategory,
            'product_family': self.product_family,
            'product_series': self.product_series,
            'supplier_sku': self.supplier_sku,
            'availability': self.availability,
            'unit_price': self.unit_price,
            'currency': self.currency,
            'price_breaks': self.price_breaks,
            'lead_time_days': self.lead_time_days,
            'datasheet_url': self.datasheet_url,
            'image_url': self.image_url,
            'model_3d_url': self.model_3d_url,
            'lifecycle_status': self.lifecycle_status,
            'package': self.package,
            'parameters': self.parameters,
            'rohs_compliant': self.rohs_compliant,
            'reach_compliant': self.reach_compliant,
            'halogen_free': self.halogen_free,
            'aec_qualified': self.aec_qualified,
            'eccn_code': self.eccn_code,
            'supplier_name': self.supplier_name,
            'supplier_url': self.supplier_url,
            'last_updated': self.last_updated.isoformat() if self.last_updated else None,
            'match_confidence': self.match_confidence,
        }


class SupplierPlugin(ABC):
    """
    Abstract base class for supplier API plugins.

    All supplier integrations (DigiKey, Mouser, Element14, etc.)
    must implement this interface.
    """

    def __init__(self, config: Dict[str, Any]):
        """
        Initialize plugin with configuration.

        Args:
            config: Configuration dictionary with API keys, endpoints, etc.
                Example:
                {
                    "api_key": "your-api-key",
                    "api_secret": "your-api-secret",
                    "endpoint": "https://api.supplier.com",
                    "enabled": true,
                    "cache_ttl": 3600
                }
        """
        self.config = config
        self.enabled = config.get('enabled', True)
        self.name = self.__class__.__name__.replace('Plugin', '').lower()

        # Validate configuration on init
        self.validate_config()

    @abstractmethod
    def validate_config(self) -> None:
        """
        Validate plugin configuration.

        Should raise ValueError if configuration is invalid.
        """
        pass

    @abstractmethod
    def search_by_mpn(
        self,
        mpn: str,
        manufacturer: Optional[str] = None,
        limit: int = 10
    ) -> List[SupplierSearchResult]:
        """
        Search for component by MPN (Manufacturer Part Number).

        Args:
            mpn: Manufacturer part number to search for
            manufacturer: Optional manufacturer name to filter results
            limit: Maximum number of results to return

        Returns:
            List of search results ordered by relevance

        Raises:
            SupplierAPIError: If API request fails
        """
        pass

    @abstractmethod
    def get_product_details(
        self,
        mpn: str,
        manufacturer: Optional[str] = None
    ) -> Optional[SupplierProductData]:
        """
        Get complete product details for a specific MPN.

        Args:
            mpn: Manufacturer part number
            manufacturer: Optional manufacturer name for better matching

        Returns:
            Complete product data or None if not found

        Raises:
            SupplierAPIError: If API request fails
        """
        pass

    def is_available(self) -> bool:
        """
        Check if plugin is available and properly configured.

        Returns:
            True if plugin can be used, False otherwise
        """
        return self.enabled and self._check_connectivity()

    def _check_connectivity(self) -> bool:
        """
        Check connectivity to supplier API.

        Override this method to implement custom health checks.

        Returns:
            True if API is reachable, False otherwise
        """
        return True  # Default: assume available

    def get_rate_limit_info(self) -> Dict[str, Any]:
        """
        Get current rate limit information.

        Returns:
            Dictionary with rate limit info:
            {
                "limit": 1000,
                "remaining": 850,
                "reset_at": "2025-01-01T00:00:00Z"
            }
        """
        return {}

    def __repr__(self) -> str:
        return f"<{self.__class__.__name__} enabled={self.enabled}>"


class SupplierAPIError(Exception):
    """Raised when supplier API request fails"""

    def __init__(self, message: str, supplier: str, status_code: Optional[int] = None):
        self.message = message
        self.supplier = supplier
        self.status_code = status_code
        super().__init__(self.message)

    def __str__(self):
        if self.status_code:
            return f"[{self.supplier}] {self.message} (HTTP {self.status_code})"
        return f"[{self.supplier}] {self.message}"
