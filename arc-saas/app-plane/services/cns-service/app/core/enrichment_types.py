"""Shared enrichment domain types.

These types are intended to be used by both the modular enrichment
service and the BOM enrichment workflow so that enrichment behavior
is defined in one place.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Literal


@dataclass
class EnrichmentContext:
  """Context for enriching a single component.

  This encapsulates the caller's environment (organization, project, BOM,
  line item, etc.) and is safe to pass between layers.
  """

  organization_id: str
  project_id: Optional[str] = None
  bom_id: Optional[str] = None
  line_item_id: Optional[str] = None
  source: Literal["customer", "staff"] = "customer"
  priority: Literal["high", "normal"] = "normal"
  user_id: Optional[str] = None


@dataclass
class UnifiedEnrichmentResult:
  """Result of enriching a single component.

  This is a generic result model that can be adapted to existing
  service-specific result types.
  """

  mpn: str
  success: bool
  data: Optional[Dict[str, Any]] = None
  quality_score: float = 0.0
  routing_destination: str = "rejected"  # "production", "staging", "rejected"
  tiers_used: List[str] = field(default_factory=list)
  ai_used: bool = False
  web_scraping_used: bool = False
  error: Optional[str] = None
  processing_time_ms: float = 0.0

