"""
Archived dual-database routing logic.

This snapshot preserves the pre-unification routing behavior where staff uploads
were directed to the Components V2 Postgres database and customer uploads to
Supabase. The live middleware now always stores BOM uploads in Supabase; keep
this file only for historical reference / potential rollback.
"""

import logging
from dataclasses import dataclass
from enum import Enum
from typing import Dict, Optional

logger = logging.getLogger(__name__)

class DatabaseType(str, Enum):
    COMPONENTS_V2 = "components_v2"
    SUPABASE = "supabase"

@dataclass
class RoutingContext:
    organization_id: Optional[int] = None
    organization_type: Optional[str] = None
    user_role: Optional[str] = None
    upload_source: Optional[str] = None
    is_bulk_operation: bool = False

    def determine_database(self) -> DatabaseType:
        """Legacy routing rules (before upload unification)."""
        if self.organization_type:
            if self.organization_type == "staff":
                return DatabaseType.COMPONENTS_V2
            if self.organization_type in ("customer", "partner"):
                return DatabaseType.SUPABASE

        if self.upload_source:
            if self.upload_source == "staff":
                return DatabaseType.COMPONENTS_V2
            if self.upload_source == "customer":
                return DatabaseType.SUPABASE

        if self.user_role in ("admin", "staff"):
            return DatabaseType.COMPONENTS_V2

        logger.warning(
            "[LEGACY ROUTER] Ambiguous context, defaulting to Supabase: org_type=%s user_role=%s",
            self.organization_type,
            self.user_role,
        )
        return DatabaseType.SUPABASE

    def to_dict(self) -> Dict[str, Optional[str]]:
        return {
            "organization_id": self.organization_id,
            "organization_type": self.organization_type,
            "user_role": self.user_role,
            "upload_source": self.upload_source,
            "is_bulk_operation": self.is_bulk_operation,
            "routed_to": self.determine_database().value,
        }

__all__ = ["RoutingContext", "DatabaseType"]
