"""
Single Component Enrichment Temporal Workflow

Handles on-demand enrichment of individual components with full visibility in Temporal UI:
- Each activity is a separate step visible in UI with input/output
- Raw API responses from suppliers are logged
- Normalized data output is tracked
- Quality scoring factors are exposed

Workflow Features:
- Triggered from Component Search UI
- Multi-tier enrichment (Catalog -> Suppliers -> AI -> Web Scraping)
- Full traceability in Temporal UI
- Progress tracking via SSE/Redis
"""

import logging
import asyncio
import os
from datetime import timedelta, datetime, timezone
from typing import Dict, Any, Optional, List
from temporalio import workflow, activity
from temporalio.common import RetryPolicy
from dataclasses import dataclass, field
from decimal import Decimal
from uuid import UUID

logger = logging.getLogger(__name__)


# ============================================================================
# JSON Serialization Helpers
# ============================================================================

def _json_safe(value: Any) -> Any:
    """Recursively convert objects to JSON-serializable representations."""
    if isinstance(value, dict):
        return {k: _json_safe(v) for k, v in value.items()}
    if isinstance(value, (list, tuple, set)):
        return [_json_safe(v) for v in value]
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, UUID):
        return str(value)
    return value


# ============================================================================
# Request/Response Dataclasses (Visible in Temporal UI)
# ============================================================================

@dataclass
class SingleComponentRequest:
    """
    Request to enrich a single component.

    All fields are visible in Temporal UI workflow input.
    """
    workflow_id: str
    mpn: str
    manufacturer: Optional[str] = None
    organization_id: str = ""
    user_id: Optional[str] = None
    force_refresh: bool = False
    enable_suppliers: bool = True
    enable_ai: bool = False
    enable_web_scraping: bool = False
    preferred_suppliers: List[str] = field(default_factory=lambda: ["digikey", "mouser"])
    # Consumer/API fields
    requested_by: Optional[str] = None
    request_source: str = "api"  # "api", "stream", "batch"
    correlation_id: Optional[str] = None


@dataclass
class SingleComponentProgress:
    """Progress tracking for single component workflow"""
    current_step: str
    steps_completed: int
    total_steps: int
    percent_complete: float
    tiers_used: List[str] = field(default_factory=list)
    quality_score: Optional[float] = None


@dataclass
class SingleComponentResult:
    """
    Final result of single component enrichment.

    All fields are visible in Temporal UI workflow output.
    """
    success: bool
    mpn: str
    manufacturer: Optional[str]
    component_id: Optional[str] = None
    quality_score: float = 0.0
    routing_destination: str = "rejected"
    tiers_used: List[str] = field(default_factory=list)
    ai_used: bool = False
    web_scraping_used: bool = False
    processing_time_ms: float = 0.0
    error: Optional[str] = None
    data: Optional[Dict[str, Any]] = None


# ============================================================================
# Workflow Definition
# ============================================================================

@workflow.defn
class SingleComponentEnrichmentWorkflow:
    """
    Temporal workflow for single component enrichment.

    Each activity call becomes a separate step in Temporal UI, showing:
    - Activity name
    - Input parameters (JSON)
    - Output result (JSON)
    - Duration
    - Retry attempts (if any)

    Features:
    - Cancel signal support
    - Progress query support
    - Full traceability
    """

    def __init__(self):
        self.progress = SingleComponentProgress(
            current_step="initializing",
            steps_completed=0,
            total_steps=8,
            percent_complete=0.0
        )
        self.cancelled = False

    @workflow.signal
    async def cancel(self):
        """Cancel the workflow"""
        self.cancelled = True
        workflow.logger.info("Workflow cancelled by signal")

    @workflow.query
    def get_progress(self) -> Dict[str, Any]:
        """Query current progress"""
        return {
            "current_step": self.progress.current_step,
            "steps_completed": self.progress.steps_completed,
            "total_steps": self.progress.total_steps,
            "percent_complete": self.progress.percent_complete,
            "tiers_used": self.progress.tiers_used,
            "quality_score": self.progress.quality_score,
        }

    def _update_progress(self, step: str, completed: int):
        """Update progress tracking"""
        self.progress.current_step = step
        self.progress.steps_completed = completed
        self.progress.percent_complete = (completed / self.progress.total_steps) * 100

    @workflow.run
    async def run(self, request: SingleComponentRequest) -> Dict[str, Any]:
        """
        Execute single component enrichment workflow.

        Each await workflow.execute_activity() call creates a visible step
        in Temporal UI with full input/output logging.

        Steps:
        1. Validate Input
        2. Lookup Catalog
        3. Enrich from Suppliers (if enabled)
        4. Apply AI Enhancement (if enabled)
        5. Apply Web Scraping (if enabled)
        6. Calculate Quality Score
        7. Normalize Data
        8. Save to Catalog
        """
        workflow.logger.info(f"Starting single component enrichment: {request.mpn}")
        # Use workflow.now() for deterministic time in Temporal workflow
        start_time = workflow.now()
        tiers_used = []
        enrichment_data = {}

        try:
            # ================================================================
            # STEP 1: Validate Input
            # ================================================================
            self._update_progress("validate_input", 0)
            workflow.logger.info(f"Step 1: Validating input for {request.mpn}")

            validation_result = await workflow.execute_activity(
                validate_component_input_activity,
                {
                    "mpn": request.mpn,
                    "manufacturer": request.manufacturer,
                    "organization_id": request.organization_id,
                },
                start_to_close_timeout=timedelta(seconds=10),
                retry_policy=RetryPolicy(maximum_attempts=2),
            )

            if not validation_result.get("valid"):
                return _json_safe({
                    "success": False,
                    "mpn": request.mpn,
                    "manufacturer": request.manufacturer,
                    "error": validation_result.get("error", "Validation failed"),
                    "processing_time_ms": _calc_duration_ms(start_time, workflow.now()),
                })

            normalized_mpn = validation_result.get("normalized_mpn", request.mpn)
            self._update_progress("validate_input", 1)

            # Check for cancellation
            if self.cancelled:
                return _json_safe({"success": False, "error": "Cancelled by user"})

            # ================================================================
            # STEP 2: Lookup Catalog
            # ================================================================
            self._update_progress("lookup_catalog", 1)
            workflow.logger.info(f"Step 2: Checking catalog for {normalized_mpn}")

            catalog_result = await workflow.execute_activity(
                lookup_catalog_activity,
                {
                    "mpn": normalized_mpn,
                    "manufacturer": request.manufacturer,
                    "force_refresh": request.force_refresh,
                },
                start_to_close_timeout=timedelta(seconds=15),
                retry_policy=RetryPolicy(maximum_attempts=2),
            )

            tiers_used.append("catalog")
            self.progress.tiers_used = tiers_used
            self._update_progress("lookup_catalog", 2)

            # If found in catalog with good quality and not force_refresh, return early
            if catalog_result.get("found") and not request.force_refresh:
                existing_score = catalog_result.get("quality_score", 0)
                if existing_score >= 70:
                    workflow.logger.info(f"Found in catalog with quality {existing_score}, returning existing data")
                    return _json_safe({
                        "success": True,
                        "mpn": normalized_mpn,
                        "manufacturer": catalog_result.get("manufacturer"),
                        "component_id": catalog_result.get("component_id"),
                        "quality_score": existing_score,
                        "routing_destination": _get_routing(existing_score),
                        "tiers_used": tiers_used,
                        "data": catalog_result.get("data"),
                        "processing_time_ms": _calc_duration_ms(start_time, workflow.now()),
                    })

            enrichment_data = catalog_result.get("data", {})

            # Check for cancellation
            if self.cancelled:
                return _json_safe({"success": False, "error": "Cancelled by user"})

            # ================================================================
            # STEP 3: Enrich from Suppliers (if enabled)
            # ================================================================
            supplier_data = {}
            if request.enable_suppliers:
                self._update_progress("enrich_suppliers", 2)
                workflow.logger.info(f"Step 3: Enriching from suppliers for {normalized_mpn}")

                supplier_result = await workflow.execute_activity(
                    enrich_from_suppliers_activity,
                    {
                        "mpn": normalized_mpn,
                        "manufacturer": request.manufacturer,
                        "preferred_suppliers": request.preferred_suppliers,
                    },
                    start_to_close_timeout=timedelta(seconds=60),
                    retry_policy=RetryPolicy(
                        maximum_attempts=3,
                        initial_interval=timedelta(seconds=2),
                        backoff_coefficient=2.0,
                    ),
                )

                tiers_used.append("suppliers")
                self.progress.tiers_used = tiers_used
                supplier_data = supplier_result
                enrichment_data = {**enrichment_data, **supplier_result.get("combined", {})}

            self._update_progress("enrich_suppliers", 3)

            # Check for cancellation
            if self.cancelled:
                return _json_safe({"success": False, "error": "Cancelled by user"})

            # ================================================================
            # STEP 4: Apply AI Enhancement (if enabled)
            # ================================================================
            ai_result = {}
            ai_used = False
            if request.enable_ai:
                self._update_progress("apply_ai", 3)
                workflow.logger.info(f"Step 4: Applying AI enhancement for {normalized_mpn}")

                ai_result = await workflow.execute_activity(
                    apply_ai_enhancement_activity,
                    {
                        "mpn": normalized_mpn,
                        "manufacturer": request.manufacturer,
                        "current_data": enrichment_data,
                    },
                    start_to_close_timeout=timedelta(seconds=30),
                    retry_policy=RetryPolicy(maximum_attempts=2),
                )

                if ai_result.get("enhanced"):
                    tiers_used.append("ai")
                    self.progress.tiers_used = tiers_used
                    enrichment_data = {**enrichment_data, **ai_result.get("enhanced_data", {})}
                    ai_used = True

            self._update_progress("apply_ai", 4)

            # Check for cancellation
            if self.cancelled:
                return _json_safe({"success": False, "error": "Cancelled by user"})

            # ================================================================
            # STEP 5: Apply Web Scraping (if enabled)
            # ================================================================
            web_scraping_used = False
            if request.enable_web_scraping:
                self._update_progress("web_scraping", 4)
                workflow.logger.info(f"Step 5: Applying web scraping for {normalized_mpn}")

                scraping_result = await workflow.execute_activity(
                    apply_web_scraping_activity,
                    {
                        "mpn": normalized_mpn,
                        "manufacturer": request.manufacturer,
                        "current_data": enrichment_data,
                    },
                    start_to_close_timeout=timedelta(seconds=45),
                    retry_policy=RetryPolicy(maximum_attempts=2),
                )

                if scraping_result.get("found"):
                    tiers_used.append("web_scraping")
                    self.progress.tiers_used = tiers_used
                    enrichment_data = {**enrichment_data, **scraping_result.get("data", {})}
                    web_scraping_used = True

            self._update_progress("web_scraping", 5)

            # ================================================================
            # STEP 6: Calculate Quality Score
            # ================================================================
            self._update_progress("calculate_quality", 5)
            workflow.logger.info(f"Step 6: Calculating quality score for {normalized_mpn}")

            quality_result = await workflow.execute_activity(
                calculate_quality_score_activity,
                {
                    "mpn": normalized_mpn,
                    "data": enrichment_data,
                    "tiers_used": tiers_used,
                },
                start_to_close_timeout=timedelta(seconds=10),
                retry_policy=RetryPolicy(maximum_attempts=2),
            )

            quality_score = quality_result.get("score", 0)
            self.progress.quality_score = quality_score
            self._update_progress("calculate_quality", 6)

            # ================================================================
            # STEP 7: Normalize Data
            # ================================================================
            self._update_progress("normalize_data", 6)
            workflow.logger.info(f"Step 7: Normalizing data for {normalized_mpn}")

            normalize_result = await workflow.execute_activity(
                normalize_component_data_activity,
                {
                    "mpn": normalized_mpn,
                    "manufacturer": request.manufacturer,
                    "raw_data": enrichment_data,
                    "supplier_data": supplier_data,
                    "quality_score": quality_score,
                },
                start_to_close_timeout=timedelta(seconds=15),
                retry_policy=RetryPolicy(maximum_attempts=2),
            )

            normalized_data = normalize_result.get("normalized", {})
            self._update_progress("normalize_data", 7)

            # ================================================================
            # STEP 8: Save to Catalog
            # ================================================================
            self._update_progress("save_catalog", 7)
            workflow.logger.info(f"Step 8: Saving to catalog for {normalized_mpn}")

            save_result = await workflow.execute_activity(
                save_to_catalog_activity,
                {
                    "mpn": normalized_mpn,
                    "manufacturer": request.manufacturer or normalized_data.get("manufacturer"),
                    "data": normalized_data,
                    "quality_score": quality_score,
                    "organization_id": request.organization_id,
                    "tiers_used": tiers_used,
                },
                start_to_close_timeout=timedelta(seconds=15),
                retry_policy=RetryPolicy(maximum_attempts=3),
            )

            self._update_progress("complete", 8)

            # ================================================================
            # Publish Result Event
            # ================================================================
            await workflow.execute_activity(
                publish_enrichment_result_activity,
                {
                    "workflow_id": request.workflow_id,
                    "mpn": normalized_mpn,
                    "success": True,
                    "quality_score": quality_score,
                    "component_id": save_result.get("component_id"),
                },
                start_to_close_timeout=timedelta(seconds=10),
            )

            # Build final result
            processing_time_ms = _calc_duration_ms(start_time, workflow.now())

            result = {
                "success": True,
                "mpn": normalized_mpn,
                "manufacturer": normalized_data.get("manufacturer") or request.manufacturer,
                "component_id": save_result.get("component_id"),
                "quality_score": quality_score,
                "routing_destination": _get_routing(quality_score),
                "tiers_used": tiers_used,
                "ai_used": ai_used,
                "web_scraping_used": web_scraping_used,
                "processing_time_ms": processing_time_ms,
                "data": normalized_data,
                "quality_factors": quality_result.get("factors", []),
            }

            workflow.logger.info(
                f"Single component enrichment completed: {normalized_mpn} "
                f"(quality={quality_score}, tiers={tiers_used})"
            )

            return _json_safe(result)

        except Exception as e:
            workflow.logger.error(f"Single component enrichment failed: {e}")

            # Try to publish failure event
            try:
                await workflow.execute_activity(
                    publish_enrichment_result_activity,
                    {
                        "workflow_id": request.workflow_id,
                        "mpn": request.mpn,
                        "success": False,
                        "error": str(e),
                    },
                    start_to_close_timeout=timedelta(seconds=5),
                )
            except Exception:
                pass

            return _json_safe({
                "success": False,
                "mpn": request.mpn,
                "manufacturer": request.manufacturer,
                "error": str(e),
                "tiers_used": tiers_used,
                "processing_time_ms": _calc_duration_ms(start_time, workflow.now()),
            })


# ============================================================================
# Helper Functions
# ============================================================================

def _calc_duration_ms(start_time: datetime, end_time: datetime = None) -> float:
    """Calculate duration in milliseconds from start time to end time"""
    if end_time is None:
        # Only call datetime.now() from activities, not workflows
        end_time = datetime.now(timezone.utc)
    return (end_time - start_time).total_seconds() * 1000


def _get_routing(quality_score: float) -> str:
    """Determine routing destination based on quality score"""
    if quality_score >= 95:
        return "production"
    elif quality_score >= 70:
        return "staging"
    else:
        return "rejected"


# ============================================================================
# Activities (Each appears as separate step in Temporal UI)
# ============================================================================

@activity.defn
async def validate_component_input_activity(data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Activity 1: Validate component input parameters.

    Visible in Temporal UI as:
    - Input: {mpn, manufacturer, organization_id}
    - Output: {valid, normalized_mpn, errors}
    """
    mpn = data.get("mpn", "").strip()
    manufacturer = data.get("manufacturer", "").strip() if data.get("manufacturer") else None

    logger.info(f"[Activity] Validating input: mpn={mpn}, manufacturer={manufacturer}")

    errors = []

    # MPN validation
    if not mpn:
        errors.append("MPN is required")
    elif len(mpn) < 2:
        errors.append("MPN must be at least 2 characters")
    elif len(mpn) > 100:
        errors.append("MPN exceeds maximum length of 100 characters")

    # Normalize MPN (uppercase, remove common separators)
    normalized_mpn = mpn.upper().strip() if mpn else ""

    result = {
        "valid": len(errors) == 0,
        "normalized_mpn": normalized_mpn,
        "original_mpn": mpn,
        "manufacturer": manufacturer,
        "errors": errors,
    }

    logger.info(f"[Activity] Validation result: valid={result['valid']}, errors={errors}")
    return result


@activity.defn
async def lookup_catalog_activity(data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Activity 2: Lookup component in catalog database.

    Visible in Temporal UI as:
    - Input: {mpn, manufacturer, force_refresh}
    - Output: {found, component_id, quality_score, data}
    """
    from app.models.dual_database import get_dual_database
    from sqlalchemy import text

    mpn = data.get("mpn")
    manufacturer = data.get("manufacturer")

    logger.info(f"[Activity] Catalog lookup: mpn={mpn}, manufacturer={manufacturer}")

    try:
        dual_db = get_dual_database()
        session_gen = dual_db.get_session("components")
        db = next(session_gen)

        try:
            # Query component_catalog table
            query = text("""
                SELECT
                    id, manufacturer_part_number, manufacturer,
                    description, category, subcategory,
                    datasheet_url, quality_score, enrichment_source,
                    specifications, supplier_data, created_at, updated_at
                FROM component_catalog
                WHERE UPPER(manufacturer_part_number) = UPPER(:mpn)
                LIMIT 1
            """)

            result = db.execute(query, {"mpn": mpn}).fetchone()

            if result:
                component_data = {
                    "component_id": str(result[0]),
                    "mpn": result[1],
                    "manufacturer": result[2],
                    "description": result[3],
                    "category": result[4],
                    "subcategory": result[5],
                    "datasheet_url": result[6],
                    "quality_score": float(result[7]) if result[7] else 0,
                    "enrichment_source": result[8],
                    "specifications": result[9] if result[9] else {},
                    "supplier_data": result[10] if result[10] else {},
                }

                logger.info(f"[Activity] Found in catalog: id={component_data['component_id']}, quality={component_data['quality_score']}")

                return {
                    "found": True,
                    "component_id": component_data["component_id"],
                    "manufacturer": component_data["manufacturer"],
                    "quality_score": component_data["quality_score"],
                    "data": component_data,
                }
            else:
                logger.info(f"[Activity] Not found in catalog: {mpn}")
                return {
                    "found": False,
                    "component_id": None,
                    "quality_score": 0,
                    "data": {},
                }

        finally:
            try:
                next(session_gen)
            except StopIteration:
                pass

    except Exception as e:
        logger.error(f"[Activity] Catalog lookup error: {e}")
        return {
            "found": False,
            "error": str(e),
            "data": {},
        }


@activity.defn
async def enrich_from_suppliers_activity(data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Activity 3: Enrich component from supplier APIs.

    Visible in Temporal UI as:
    - Input: {mpn, manufacturer, preferred_suppliers}
    - Output: {
        digikey: {response_raw, normalized, duration_ms},
        mouser: {response_raw, normalized, duration_ms},
        combined: {...}
      }
    """
    from app.services.supplier_manager_service import get_supplier_manager

    mpn = data.get("mpn")
    manufacturer = data.get("manufacturer")
    preferred_suppliers = data.get("preferred_suppliers", ["digikey", "mouser"])

    logger.info(f"[Activity] Supplier enrichment: mpn={mpn}, suppliers={preferred_suppliers}")

    result = {
        "mpn": mpn,
        "manufacturer": manufacturer,
        "suppliers_queried": [],
        "suppliers_found": [],
        "combined": {},
    }

    try:
        manager = get_supplier_manager()

        for supplier_name in preferred_suppliers:
            start_time = datetime.now(timezone.utc)
            supplier_result = {
                "supplier": supplier_name,
                "response_raw": None,
                "normalized": None,
                "duration_ms": 0,
                "found": False,
                "error": None,
            }

            try:
                # Call supplier API
                response = await manager.search_component(
                    supplier_name,
                    mpn,
                    manufacturer=manufacturer
                )

                supplier_result["duration_ms"] = (datetime.now(timezone.utc) - start_time).total_seconds() * 1000

                if response and response.get("parts"):
                    supplier_result["response_raw"] = _json_safe(response)
                    supplier_result["found"] = True

                    # Normalize supplier response
                    normalized = _normalize_supplier_response(supplier_name, response)
                    supplier_result["normalized"] = normalized

                    # Merge into combined
                    result["combined"] = {**result["combined"], **normalized}
                    result["suppliers_found"].append(supplier_name)

                    logger.info(f"[Activity] {supplier_name}: Found {len(response.get('parts', []))} parts")
                else:
                    logger.info(f"[Activity] {supplier_name}: No results")

            except Exception as e:
                supplier_result["error"] = str(e)
                supplier_result["duration_ms"] = (datetime.now(timezone.utc) - start_time).total_seconds() * 1000
                logger.warning(f"[Activity] {supplier_name} error: {e}")

            result["suppliers_queried"].append(supplier_name)
            result[supplier_name] = supplier_result

        logger.info(f"[Activity] Supplier enrichment complete: found={result['suppliers_found']}")
        return result

    except Exception as e:
        logger.error(f"[Activity] Supplier enrichment failed: {e}")
        result["error"] = str(e)
        return result


def _normalize_supplier_response(supplier: str, response: Dict[str, Any]) -> Dict[str, Any]:
    """Normalize supplier response to standard format"""
    parts = response.get("parts", [])
    if not parts:
        return {}

    # Take first match
    part = parts[0]

    normalized = {
        "price": part.get("unit_price") or part.get("price"),
        "stock_quantity": part.get("stock") or part.get("quantity_available"),
        "lead_time_days": part.get("lead_time_days"),
        "manufacturer": part.get("manufacturer"),
        "description": part.get("description"),
        "datasheet_url": part.get("datasheet_url"),
        "lifecycle_status": part.get("lifecycle_status") or part.get("life_cycle"),
        "package": part.get("package") or part.get("packaging"),
        "rohs_compliant": part.get("rohs") or part.get("rohs_compliant"),
        f"{supplier}_part_number": part.get("supplier_part_number"),
        f"{supplier}_url": part.get("product_url"),
    }

    return {k: v for k, v in normalized.items() if v is not None}


@activity.defn
async def apply_ai_enhancement_activity(data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Activity 4: Apply AI enhancement to component data.

    Visible in Temporal UI as:
    - Input: {mpn, manufacturer, current_data}
    - Output: {enhanced, enhanced_data, ai_response_raw, confidence}
    """
    mpn = data.get("mpn")
    current_data = data.get("current_data", {})

    logger.info(f"[Activity] AI enhancement: mpn={mpn}")

    # AI enhancement is optional and may not be configured
    # For now, return placeholder - integrate with actual AI service later

    result = {
        "enhanced": False,
        "enhanced_data": {},
        "ai_response_raw": None,
        "confidence": 0.0,
        "reason": "AI enhancement not configured",
    }

    try:
        # Check if AI is configured
        ai_enabled = os.getenv("AI_ENRICHMENT_ENABLED", "false").lower() == "true"

        if not ai_enabled:
            result["reason"] = "AI enrichment disabled in configuration"
            return result

        # TODO: Integrate with actual AI service (Ollama, OpenAI, etc.)
        # For now, return unenhanced

        logger.info(f"[Activity] AI enhancement skipped: not implemented")
        return result

    except Exception as e:
        logger.error(f"[Activity] AI enhancement error: {e}")
        result["error"] = str(e)
        return result


@activity.defn
async def apply_web_scraping_activity(data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Activity 5: Apply web scraping to get additional data.

    Visible in Temporal UI as:
    - Input: {mpn, manufacturer, current_data}
    - Output: {found, data, sources_scraped}
    """
    mpn = data.get("mpn")

    logger.info(f"[Activity] Web scraping: mpn={mpn}")

    result = {
        "found": False,
        "data": {},
        "sources_scraped": [],
        "reason": "Web scraping not configured",
    }

    try:
        # Check if web scraping is enabled
        scraping_enabled = os.getenv("WEB_SCRAPING_ENABLED", "false").lower() == "true"

        if not scraping_enabled:
            result["reason"] = "Web scraping disabled in configuration"
            return result

        # TODO: Integrate with actual web scraping service
        # For now, return empty

        logger.info(f"[Activity] Web scraping skipped: not implemented")
        return result

    except Exception as e:
        logger.error(f"[Activity] Web scraping error: {e}")
        result["error"] = str(e)
        return result


@activity.defn
async def calculate_quality_score_activity(data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Activity 6: Calculate quality score for component data.

    Visible in Temporal UI as:
    - Input: {mpn, data, tiers_used}
    - Output: {score, factors, routing}
    """
    from app.core.quality_scorer import QualityScorer

    mpn = data.get("mpn")
    component_data = data.get("data", {})
    tiers_used = data.get("tiers_used", [])

    logger.info(f"[Activity] Quality scoring: mpn={mpn}")

    try:
        scorer = QualityScorer()
        score, factors = scorer.calculate_score(component_data)

        routing = _get_routing(score)

        result = {
            "score": score,
            "factors": factors,
            "routing": routing,
            "tiers_used": tiers_used,
        }

        logger.info(f"[Activity] Quality score: {score}, routing: {routing}")
        return result

    except Exception as e:
        logger.error(f"[Activity] Quality scoring error: {e}")
        # Return conservative score on error
        return {
            "score": 50.0,
            "factors": [{"name": "error", "weight": 0, "value": str(e)}],
            "routing": "staging",
            "error": str(e),
        }


@activity.defn
async def normalize_component_data_activity(data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Activity 7: Normalize component data to standard schema.

    Visible in Temporal UI as:
    - Input: {mpn, manufacturer, raw_data, supplier_data, quality_score}
    - Output: {normalized, mappings_applied}
    """
    from app.core.normalizers import normalize_component_data

    mpn = data.get("mpn")
    manufacturer = data.get("manufacturer")
    raw_data = data.get("raw_data", {})
    supplier_data = data.get("supplier_data", {})
    quality_score = data.get("quality_score", 0)

    logger.info(f"[Activity] Normalizing data: mpn={mpn}")

    try:
        # Build normalized component structure
        normalized = {
            "manufacturer_part_number": mpn,
            "manufacturer": manufacturer or raw_data.get("manufacturer"),
            "description": raw_data.get("description"),
            "category": raw_data.get("category"),
            "subcategory": raw_data.get("subcategory"),
            "datasheet_url": raw_data.get("datasheet_url"),
            "quality_score": quality_score,
            "specifications": raw_data.get("specifications", {}),
            "supplier_data": supplier_data,
            "lifecycle_status": raw_data.get("lifecycle_status"),
            "package": raw_data.get("package"),
            "rohs_compliant": raw_data.get("rohs_compliant"),
            "price": raw_data.get("price"),
            "stock_quantity": raw_data.get("stock_quantity"),
            "lead_time_days": raw_data.get("lead_time_days"),
        }

        # Remove None values
        normalized = {k: v for k, v in normalized.items() if v is not None}

        result = {
            "normalized": _json_safe(normalized),
            "mappings_applied": ["standard_schema"],
            "fields_populated": list(normalized.keys()),
        }

        logger.info(f"[Activity] Normalized {len(normalized)} fields")
        return result

    except Exception as e:
        logger.error(f"[Activity] Normalization error: {e}")
        return {
            "normalized": {"manufacturer_part_number": mpn, "manufacturer": manufacturer},
            "error": str(e),
        }


@activity.defn
async def save_to_catalog_activity(data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Activity 8: Save component to catalog database.

    Visible in Temporal UI as:
    - Input: {mpn, manufacturer, data, quality_score, organization_id, tiers_used}
    - Output: {saved, component_id, location}
    """
    from app.models.dual_database import get_dual_database
    from sqlalchemy import text
    import uuid
    import json

    mpn = data.get("mpn")
    manufacturer = data.get("manufacturer")
    component_data = data.get("data", {})
    quality_score = data.get("quality_score", 0)
    tiers_used = data.get("tiers_used", [])

    logger.info(f"[Activity] Saving to catalog: mpn={mpn}, quality={quality_score}")

    try:
        dual_db = get_dual_database()
        session_gen = dual_db.get_session("components")
        db = next(session_gen)

        try:
            # Check if component already exists
            check_query = text("""
                SELECT id FROM component_catalog
                WHERE UPPER(manufacturer_part_number) = UPPER(:mpn)
                LIMIT 1
            """)
            existing = db.execute(check_query, {"mpn": mpn}).fetchone()

            component_id = str(existing[0]) if existing else str(uuid.uuid4())

            if existing:
                # Update existing
                update_query = text("""
                    UPDATE component_catalog SET
                        manufacturer = COALESCE(:manufacturer, manufacturer),
                        description = COALESCE(:description, description),
                        category = COALESCE(:category, category),
                        subcategory = COALESCE(:subcategory, subcategory),
                        datasheet_url = COALESCE(:datasheet_url, datasheet_url),
                        quality_score = :quality_score,
                        enrichment_source = :enrichment_source,
                        specifications = COALESCE(:specifications::jsonb, specifications),
                        supplier_data = COALESCE(:supplier_data::jsonb, supplier_data),
                        updated_at = NOW()
                    WHERE id = :id
                """)

                db.execute(update_query, {
                    "id": component_id,
                    "manufacturer": manufacturer,
                    "description": component_data.get("description"),
                    "category": component_data.get("category"),
                    "subcategory": component_data.get("subcategory"),
                    "datasheet_url": component_data.get("datasheet_url"),
                    "quality_score": quality_score,
                    "enrichment_source": ",".join(tiers_used),
                    "specifications": json.dumps(component_data.get("specifications", {})),
                    "supplier_data": json.dumps(component_data.get("supplier_data", {})),
                })

                logger.info(f"[Activity] Updated existing component: {component_id}")

            else:
                # Insert new
                insert_query = text("""
                    INSERT INTO component_catalog (
                        id, manufacturer_part_number, manufacturer,
                        description, category, subcategory,
                        datasheet_url, quality_score, enrichment_source,
                        specifications, supplier_data, created_at, updated_at
                    ) VALUES (
                        :id, :mpn, :manufacturer,
                        :description, :category, :subcategory,
                        :datasheet_url, :quality_score, :enrichment_source,
                        :specifications::jsonb, :supplier_data::jsonb, NOW(), NOW()
                    )
                """)

                db.execute(insert_query, {
                    "id": component_id,
                    "mpn": mpn,
                    "manufacturer": manufacturer,
                    "description": component_data.get("description"),
                    "category": component_data.get("category"),
                    "subcategory": component_data.get("subcategory"),
                    "datasheet_url": component_data.get("datasheet_url"),
                    "quality_score": quality_score,
                    "enrichment_source": ",".join(tiers_used),
                    "specifications": json.dumps(component_data.get("specifications", {})),
                    "supplier_data": json.dumps(component_data.get("supplier_data", {})),
                })

                logger.info(f"[Activity] Inserted new component: {component_id}")

            db.commit()

            return {
                "saved": True,
                "component_id": component_id,
                "location": "component_catalog",
                "action": "updated" if existing else "inserted",
            }

        except Exception as e:
            db.rollback()
            raise
        finally:
            try:
                next(session_gen)
            except StopIteration:
                pass

    except Exception as e:
        logger.error(f"[Activity] Save to catalog error: {e}")
        return {
            "saved": False,
            "error": str(e),
        }


@activity.defn
async def publish_enrichment_result_activity(data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Activity 9: Publish enrichment result to Redis for SSE streaming.

    Visible in Temporal UI as:
    - Input: {workflow_id, mpn, success, quality_score}
    - Output: {published, channel}
    """
    import redis
    import json

    workflow_id = data.get("workflow_id")
    mpn = data.get("mpn")
    success = data.get("success", False)

    logger.info(f"[Activity] Publishing result: workflow={workflow_id}, success={success}")

    try:
        redis_url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
        r = redis.from_url(redis_url)

        channel = f"single-component:{workflow_id}"

        message = {
            "type": "completed" if success else "failed",
            "workflow_id": workflow_id,
            "mpn": mpn,
            "success": success,
            "quality_score": data.get("quality_score"),
            "component_id": data.get("component_id"),
            "error": data.get("error"),
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

        r.publish(channel, json.dumps(message))

        logger.info(f"[Activity] Published to channel: {channel}")

        return {
            "published": True,
            "channel": channel,
        }

    except Exception as e:
        logger.error(f"[Activity] Publish error: {e}")
        return {
            "published": False,
            "error": str(e),
        }
