"""Database-backed category registry helpers used for staged normalization runs."""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from typing import Any, Dict, Optional
import json

from sqlalchemy import text
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

_TABLE_PATTERN = re.compile(r"^[A-Za-z0-9_.]+$")


@dataclass
class CategoryRegistryResult:
    vendor: str
    vendor_category_path: str
    canonical_category_id: Optional[int]
    canonical_name: Optional[str]
    canonical_path: Optional[str]
    confidence_score: Optional[float]
    is_verified: Optional[bool]
    match_count: Optional[int]
    raw: Dict[str, Any]


class CategoryRegistryResolver:
    """Lightweight helper that queries a category registry table."""

    def __init__(
        self,
        db: Session,
        table_name: str,
        minimum_confidence: float = 0.0,
    ):
        if not table_name or not _TABLE_PATTERN.match(table_name):
            raise ValueError("Invalid category registry table name")
        self.db = db
        self.table_name = table_name
        self.minimum_confidence = minimum_confidence

    def resolve(self, vendor: str, vendor_category: str) -> Optional[CategoryRegistryResult]:
        """Return the best staged registry mapping for the vendor/category pair."""
        if not vendor or not vendor_category:
            return None

        vendor = vendor.lower().strip()
        vendor_category = vendor_category.strip()

        sql = text(
            f"""
            SELECT
                v.vendor,
                v.vendor_category_path,
                v.canonical_category_id,
                v.confidence_score,
                v.is_verified,
                v.match_count,
                c.name AS canonical_name,
                c.path AS canonical_path
            FROM {self.table_name} AS v
            LEFT JOIN categories AS c
              ON c.id = v.canonical_category_id
            WHERE v.vendor = :vendor
              AND lower(v.vendor_category_path) = lower(:vendor_category)
            ORDER BY v.is_verified DESC,
                     v.confidence_score DESC NULLS LAST,
                     v.match_count DESC NULLS LAST,
                     v.updated_at DESC NULLS LAST
            LIMIT 1
            """
        )

        try:
            row = self.db.execute(sql, {
                "vendor": vendor,
                "vendor_category": vendor_category,
            }).mappings().first()
        except Exception as exc:  # pragma: no cover - DB errors logged but not fatal
            logger.warning(
                "Category registry lookup failed",
                exc_info=True,
                extra={
                    "vendor": vendor,
                    "vendor_category": vendor_category,
                    "table": self.table_name,
                },
            )
            return None

        if not row:
            return None

        confidence = row.get("confidence_score")
        if confidence is not None and confidence < self.minimum_confidence:
            return None

        return CategoryRegistryResult(
            vendor=row.get("vendor", vendor),
            vendor_category_path=row.get("vendor_category_path", vendor_category),
            canonical_category_id=row.get("canonical_category_id"),
            canonical_name=row.get("canonical_name"),
            canonical_path=row.get("canonical_path"),
            confidence_score=confidence,
            is_verified=row.get("is_verified"),
            match_count=row.get("match_count"),
            raw=dict(row),
        )


class DualCategoryNormalizationMonitor:
    """Runs staged registry lookups in parallel and records deltas without affecting output."""

    def __init__(self, resolver: CategoryRegistryResolver, experiment_name: str = "stage"):
        self.resolver = resolver
        self.experiment_name = experiment_name
        self.stats: Dict[str, int] = self._blank_stats()

    def _blank_stats(self) -> Dict[str, int]:
        return {
            "attempted": 0,
            "registry_hits": 0,
            "registry_misses": 0,
            "matches": 0,
            "mismatches": 0,
            "errors": 0,
        }

    def compare(
        self,
        *,
        vendor: str,
        vendor_category: str,
        mpn: Optional[str],
        legacy_category: Optional[str],
        legacy_confidence: Optional[float],
    ) -> Optional[CategoryRegistryResult]:
        self.stats["attempted"] += 1

        try:
            registry_result = self.resolver.resolve(vendor, vendor_category)
        except Exception:  # pragma: no cover - safeguard
            self.stats["errors"] += 1
            logger.warning(
                "Dual-run registry comparison failed",
                exc_info=True,
                extra={
                    "vendor": vendor,
                    "vendor_category": vendor_category,
                    "experiment": self.experiment_name,
                    "mpn": mpn,
                },
            )
            return None

        if not registry_result:
            self.stats["registry_misses"] += 1
            return None

        self.stats["registry_hits"] += 1

        staged_category = registry_result.canonical_path or registry_result.canonical_name
        if staged_category and staged_category == legacy_category:
            self.stats["matches"] += 1
        else:
            self.stats["mismatches"] += 1
            payload = {
                "experiment": self.experiment_name,
                "vendor": vendor,
                "vendor_category": vendor_category,
                "mpn": mpn,
                "legacy_category": legacy_category,
                "legacy_confidence": legacy_confidence,
                "staged_category": staged_category,
                "staged_confidence": registry_result.confidence_score,
                "staged_verified": registry_result.is_verified,
                "match_count": registry_result.match_count,
            }
            logger.info(
                "Dual-run category mismatch | %s",
                json.dumps(payload, sort_keys=True),
            )
        return registry_result

    def get_stats(self) -> Dict[str, int]:
        return dict(self.stats)

    def reset(self) -> None:
        self.stats = self._blank_stats()
