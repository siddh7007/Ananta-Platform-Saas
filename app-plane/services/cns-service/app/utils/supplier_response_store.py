import json
import logging
import uuid
from typing import Optional, List, Dict, Any

from sqlalchemy import text

from app.models.dual_database import get_dual_database

logger = logging.getLogger(__name__)

TABLE_SQL = """
CREATE TABLE IF NOT EXISTS supplier_enrichment_responses (
    id UUID PRIMARY KEY,
    job_id UUID,
    line_id UUID,
    mpn TEXT,
    manufacturer TEXT,
    vendor TEXT,
    payload JSONB NOT NULL,
    normalized JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_supplier_responses_job ON supplier_enrichment_responses(job_id);
CREATE INDEX IF NOT EXISTS idx_supplier_responses_line ON supplier_enrichment_responses(line_id);
"""


class SupplierResponseStore:
    def __init__(self) -> None:
        self._dual_db = get_dual_database()
        self._initialized = False

    def _get_session(self):
        session_gen = self._dual_db.get_session("components")
        session = next(session_gen)
        return session, session_gen

    def _ensure_table(self, session) -> None:
        if self._initialized:
            return
        session.execute(text(TABLE_SQL))
        session.commit()
        self._initialized = True

    def save_response(
        self,
        *,
        job_id: Optional[str],
        line_id: Optional[str],
        mpn: str,
        manufacturer: Optional[str],
        vendor: Optional[str],
        payload: Dict[str, Any],
        normalized: Optional[Dict[str, Any]] = None,
    ) -> None:
        if not payload:
            return

        session, session_gen = self._get_session()
        try:
            self._ensure_table(session)
            insert_sql = text(
                """
                INSERT INTO supplier_enrichment_responses (
                    id, job_id, line_id, mpn, manufacturer, vendor, payload, normalized
                ) VALUES (
                    :id, :job_id, :line_id, :mpn, :manufacturer, :vendor, CAST(:payload AS jsonb), CAST(:normalized AS jsonb)
                )
                """
            )
            session.execute(
                insert_sql,
                {
                    "id": str(uuid.uuid4()),
                    "job_id": job_id,
                    "line_id": line_id,
                    "mpn": mpn,
                    "manufacturer": manufacturer,
                    "vendor": vendor,
                    "payload": json.dumps(payload, default=str),
                    "normalized": json.dumps(normalized, default=str) if normalized else None,
                },
            )
            session.commit()
        except Exception as exc:
            session.rollback()
            logger.warning(f"Failed to store supplier response for {mpn}: {exc}")
        finally:
            try:
                next(session_gen)
            except StopIteration:
                pass

    def list_responses(
        self,
        *,
        job_id: Optional[str] = None,
        line_id: Optional[str] = None,
        limit: int = 100,
    ) -> List[Dict[str, Any]]:
        session, session_gen = self._get_session()
        try:
            self._ensure_table(session)
            clauses = []
            params: Dict[str, Any] = {"limit": limit}
            if job_id:
                clauses.append("job_id = :job_id")
                params["job_id"] = job_id
            if line_id:
                clauses.append("line_id = :line_id")
                params["line_id"] = line_id

            where_sql = f"WHERE {' AND '.join(clauses)}" if clauses else ""
            query = text(
                f"""
                SELECT id, job_id, line_id, mpn, manufacturer, vendor,
                       payload, normalized, created_at
                FROM supplier_enrichment_responses
                {where_sql}
                ORDER BY created_at DESC
                LIMIT :limit
                """
            )
            rows = session.execute(query, params).fetchall()
            results = []
            for row in rows:
                mapping = row._mapping
                results.append(
                    {
                        "id": str(mapping["id"]),
                        "job_id": mapping["job_id"] and str(mapping["job_id"]),
                        "line_id": mapping["line_id"] and str(mapping["line_id"]),
                        "mpn": mapping["mpn"],
                        "manufacturer": mapping["manufacturer"],
                        "vendor": mapping["vendor"],
                        "payload": mapping["payload"],
                        "normalized": mapping["normalized"],
                        "created_at": mapping["created_at"].isoformat() if mapping["created_at"] else None,
                    }
                )
            return results
        finally:
            try:
                next(session_gen)
            except StopIteration:
                pass


_supplier_store: Optional[SupplierResponseStore] = None


def get_supplier_response_store() -> SupplierResponseStore:
    global _supplier_store
    if _supplier_store is None:
        _supplier_store = SupplierResponseStore()
    return _supplier_store
