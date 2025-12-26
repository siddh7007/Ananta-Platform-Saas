"""
Risk Calculation Service - Multi-Level Risk Analysis

This service provides comprehensive risk calculation with:
- Organization-specific risk profiles (configurable weights/thresholds)
- Component base risk scores (from enrichment data)
- BOM line item contextual risk (usage-context aware)
- BOM health summaries (aggregate grades A-F)
- Project risk summaries

Architecture:
- Uses organization_risk_profiles for customer-specific configuration
- Calculates base risk from enrichment data (lifecycle, compliance, etc.)
- Applies contextual modifiers (quantity, lead time, criticality)
- Aggregates to BOM and project levels

Events Published:
- risk.bom.calculated: BOM health score updated
- risk.project.calculated: Project risk summary updated

Error Handling:
- All operations wrapped in try/except with detailed logging
- Graceful degradation when profile/data missing
- Default profile auto-created if not present
"""

import json
import logging
from dataclasses import dataclass, field
from datetime import datetime
from decimal import Decimal
from typing import Any, Dict, List, Optional, Tuple
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.models.dual_database import get_dual_database

# Import existing risk calculator for base calculations
try:
    from app.services.risk_calculator import (
        RiskCalculatorService as BaseRiskCalculator,
        LIFECYCLE_RISK_MAP,
    )
    BASE_CALCULATOR_AVAILABLE = True
except ImportError:
    BASE_CALCULATOR_AVAILABLE = False
    LIFECYCLE_RISK_MAP = {
        'ACTIVE': 0, 'PREVIEW': 10, 'NRND': 50,
        'EOL': 80, 'OBSOLETE': 100, 'UNKNOWN': 25,
    }

# Import Redis cache
try:
    from app.cache.redis_cache import get_cache
    REDIS_AVAILABLE = True
except ImportError:
    REDIS_AVAILABLE = False

logger = logging.getLogger(__name__)


# =============================================================================
# DATA CLASSES
# =============================================================================

@dataclass
class OrganizationRiskProfile:
    """Organization-specific risk configuration."""
    id: Optional[str] = None
    organization_id: str = ""

    # Risk Factor Weights (must sum to 100)
    lifecycle_weight: int = 30
    supply_chain_weight: int = 25
    compliance_weight: int = 20
    obsolescence_weight: int = 15
    single_source_weight: int = 10

    # Risk Level Thresholds
    low_threshold: int = 30
    medium_threshold: int = 60
    high_threshold: int = 85

    # Context Modifier Weights
    quantity_weight: float = 0.15
    lead_time_weight: float = 0.10
    criticality_weight: float = 0.20

    # Preset Info
    preset_name: str = "default"
    custom_factors: List[Dict] = field(default_factory=list)


@dataclass
class ComponentBaseRisk:
    """Base risk score for a component."""
    id: Optional[str] = None
    mpn: str = ""
    manufacturer: str = ""

    lifecycle_risk: int = 0
    supply_chain_risk: int = 0
    compliance_risk: int = 0
    obsolescence_risk: int = 0
    single_source_risk: int = 0

    default_total_score: int = 0
    default_risk_level: str = "low"

    lead_time_days: Optional[int] = None
    stock_quantity: Optional[int] = None
    supplier_count: int = 0

    risk_factors: Dict = field(default_factory=dict)
    data_sources: List[str] = field(default_factory=list)
    calculation_date: Optional[datetime] = None


@dataclass
class BOMLineItemRisk:
    """Contextual risk score for a BOM line item."""
    id: Optional[str] = None
    bom_line_item_id: str = ""
    organization_id: str = ""

    base_risk_score: int = 0
    quantity_modifier: int = 0
    lead_time_modifier: int = 0
    criticality_modifier: int = 0
    user_criticality_level: int = 5

    contextual_risk_score: int = 0
    risk_level: str = "low"

    alternates_available: int = 0
    alternate_risk_reduction: int = 0


@dataclass
class BOMRiskSummary:
    """Aggregate BOM health summary."""
    id: Optional[str] = None
    bom_id: str = ""
    organization_id: str = ""

    low_risk_count: int = 0
    medium_risk_count: int = 0
    high_risk_count: int = 0
    critical_risk_count: int = 0
    total_line_items: int = 0

    average_risk_score: float = 0.0
    weighted_risk_score: float = 0.0
    max_risk_score: int = 0
    min_risk_score: int = 0

    health_grade: str = "A"
    score_trend: str = "stable"

    top_risk_factors: List[Dict] = field(default_factory=list)
    top_risk_components: List[Dict] = field(default_factory=list)


@dataclass
class ProjectRiskSummary:
    """Project-level risk aggregation."""
    id: Optional[str] = None
    project_id: str = ""
    organization_id: str = ""

    total_boms: int = 0
    healthy_boms: int = 0
    at_risk_boms: int = 0
    critical_boms: int = 0

    total_components: int = 0
    unique_components: int = 0
    average_bom_health_score: float = 0.0

    low_risk_total: int = 0
    medium_risk_total: int = 0
    high_risk_total: int = 0
    critical_risk_total: int = 0


# =============================================================================
# RISK CALCULATION SERVICE
# =============================================================================

class RiskCalculationService:
    """
    Comprehensive risk calculation service with multi-level analysis.

    Features:
    - Organization-specific risk profiles
    - Component base risk calculation
    - BOM line item contextual risk
    - BOM health aggregation
    - Project risk summaries
    """

    def __init__(self):
        """Initialize risk calculation service."""
        self._profile_cache: Dict[str, OrganizationRiskProfile] = {}
        self._base_calculator = BaseRiskCalculator() if BASE_CALCULATOR_AVAILABLE else None
        logger.debug("[RiskCalculationService] Initialized")

    # =========================================================================
    # ORGANIZATION RISK PROFILE
    # =========================================================================

    async def get_or_create_profile(
        self,
        organization_id: str,
        db: Optional[Session] = None
    ) -> OrganizationRiskProfile:
        """
        Get organization risk profile or create default.

        Args:
            organization_id: Organization UUID
            db: Optional database session

        Returns:
            OrganizationRiskProfile instance
        """
        try:
            # Check memory cache first
            cache_key = f"risk_profile:{organization_id}"
            if cache_key in self._profile_cache:
                logger.debug(f"[RiskProfile] Cache hit: org={organization_id}")
                return self._profile_cache[cache_key]

            # Check Redis cache
            if REDIS_AVAILABLE:
                try:
                    cache = get_cache()
                    if cache and cache.is_connected:
                        cached = cache.get(f"org_risk_profile:{organization_id}")
                        if cached:
                            profile = OrganizationRiskProfile(**cached)
                            self._profile_cache[cache_key] = profile
                            logger.debug(f"[RiskProfile] Redis hit: org={organization_id}")
                            return profile
                except Exception as e:
                    logger.warning(f"[RiskProfile] Redis error: {e}")

            # Query database
            if db is None:
                db = next(get_dual_database().get_session("supabase"))

            sql = """
                SELECT
                    id, organization_id,
                    lifecycle_weight, supply_chain_weight, compliance_weight,
                    obsolescence_weight, single_source_weight,
                    low_threshold, medium_threshold, high_threshold,
                    quantity_weight, lead_time_weight, criticality_weight,
                    preset_name, custom_factors
                FROM organization_risk_profiles
                WHERE organization_id = :org_id
            """

            row = db.execute(text(sql), {"org_id": organization_id}).fetchone()

            if row:
                m = row._mapping
                profile = OrganizationRiskProfile(
                    id=str(m["id"]),
                    organization_id=str(m["organization_id"]),
                    lifecycle_weight=m["lifecycle_weight"],
                    supply_chain_weight=m["supply_chain_weight"],
                    compliance_weight=m["compliance_weight"],
                    obsolescence_weight=m["obsolescence_weight"],
                    single_source_weight=m["single_source_weight"],
                    low_threshold=m["low_threshold"],
                    medium_threshold=m["medium_threshold"],
                    high_threshold=m["high_threshold"],
                    quantity_weight=float(m["quantity_weight"]),
                    lead_time_weight=float(m["lead_time_weight"]),
                    criticality_weight=float(m["criticality_weight"]),
                    preset_name=m.get("preset_name") or "default",
                    custom_factors=m.get("custom_factors") or [],
                )
                logger.debug(f"[RiskProfile] Loaded from DB: org={organization_id}")
            else:
                # Create default profile
                profile = await self._create_default_profile(organization_id, db)

            # Cache the profile
            self._profile_cache[cache_key] = profile

            # Cache in Redis
            if REDIS_AVAILABLE:
                try:
                    cache = get_cache()
                    if cache and cache.is_connected:
                        cache.set(
                            f"org_risk_profile:{organization_id}",
                            {
                                "id": profile.id,
                                "organization_id": profile.organization_id,
                                "lifecycle_weight": profile.lifecycle_weight,
                                "supply_chain_weight": profile.supply_chain_weight,
                                "compliance_weight": profile.compliance_weight,
                                "obsolescence_weight": profile.obsolescence_weight,
                                "single_source_weight": profile.single_source_weight,
                                "low_threshold": profile.low_threshold,
                                "medium_threshold": profile.medium_threshold,
                                "high_threshold": profile.high_threshold,
                                "quantity_weight": profile.quantity_weight,
                                "lead_time_weight": profile.lead_time_weight,
                                "criticality_weight": profile.criticality_weight,
                                "preset_name": profile.preset_name,
                                "custom_factors": profile.custom_factors,
                            },
                            ttl=3600  # 1 hour
                        )
                except Exception as e:
                    logger.warning(f"[RiskProfile] Redis cache write error: {e}")

            return profile

        except Exception as e:
            logger.error(f"[RiskProfile] Error getting profile: {e}", exc_info=True)
            # Return default profile on error
            return OrganizationRiskProfile(organization_id=organization_id)

    async def _create_default_profile(
        self,
        organization_id: str,
        db: Session
    ) -> OrganizationRiskProfile:
        """Create default risk profile for organization."""
        try:
            sql = """
                INSERT INTO organization_risk_profiles (
                    organization_id, preset_name
                ) VALUES (
                    :org_id, 'default'
                )
                ON CONFLICT (organization_id) DO NOTHING
                RETURNING id
            """
            result = db.execute(text(sql), {"org_id": organization_id})
            row = result.fetchone()
            db.commit()

            profile_id = str(row._mapping["id"]) if row else None

            logger.info(f"[RiskProfile] Created default profile: org={organization_id}")

            return OrganizationRiskProfile(
                id=profile_id,
                organization_id=organization_id,
            )

        except Exception as e:
            logger.error(f"[RiskProfile] Error creating profile: {e}", exc_info=True)
            db.rollback()
            return OrganizationRiskProfile(organization_id=organization_id)

    async def update_profile(
        self,
        organization_id: str,
        updates: Dict[str, Any],
        db: Optional[Session] = None
    ) -> OrganizationRiskProfile:
        """
        Update organization risk profile.

        Args:
            organization_id: Organization UUID
            updates: Dict of fields to update
            db: Optional database session

        Returns:
            Updated OrganizationRiskProfile
        """
        try:
            if db is None:
                db = next(get_dual_database().get_session("supabase"))

            # Validate weights sum to 100 if any weight is being updated
            weight_fields = [
                'lifecycle_weight', 'supply_chain_weight', 'compliance_weight',
                'obsolescence_weight', 'single_source_weight'
            ]
            if any(f in updates for f in weight_fields):
                # Get current profile
                current = await self.get_or_create_profile(organization_id, db)
                total = sum([
                    updates.get('lifecycle_weight', current.lifecycle_weight),
                    updates.get('supply_chain_weight', current.supply_chain_weight),
                    updates.get('compliance_weight', current.compliance_weight),
                    updates.get('obsolescence_weight', current.obsolescence_weight),
                    updates.get('single_source_weight', current.single_source_weight),
                ])
                if total != 100:
                    raise ValueError(f"Risk weights must sum to 100, got {total}")

            # Build update SQL
            set_clauses = []
            params = {"org_id": organization_id}
            allowed_fields = weight_fields + [
                'low_threshold', 'medium_threshold', 'high_threshold',
                'quantity_weight', 'lead_time_weight', 'criticality_weight',
                'preset_name', 'custom_factors', 'updated_by'
            ]

            for field_name, value in updates.items():
                if field_name in allowed_fields:
                    set_clauses.append(f"{field_name} = :{field_name}")
                    params[field_name] = json.dumps(value) if field_name == 'custom_factors' else value

            if not set_clauses:
                return await self.get_or_create_profile(organization_id, db)

            set_clauses.append("updated_at = NOW()")

            sql = f"""
                UPDATE organization_risk_profiles
                SET {', '.join(set_clauses)}
                WHERE organization_id = :org_id
            """

            db.execute(text(sql), params)
            db.commit()

            # Invalidate caches
            cache_key = f"risk_profile:{organization_id}"
            self._profile_cache.pop(cache_key, None)

            if REDIS_AVAILABLE:
                try:
                    cache = get_cache()
                    if cache and cache.is_connected:
                        cache.delete(f"org_risk_profile:{organization_id}")
                except Exception:
                    pass

            logger.info(f"[RiskProfile] Updated: org={organization_id} fields={list(updates.keys())}")

            return await self.get_or_create_profile(organization_id, db)

        except ValueError:
            raise
        except Exception as e:
            logger.error(f"[RiskProfile] Error updating profile: {e}", exc_info=True)
            raise

    # =========================================================================
    # RISK LEVEL CLASSIFICATION
    # =========================================================================

    def classify_risk_level(
        self,
        score: int,
        profile: Optional[OrganizationRiskProfile] = None
    ) -> str:
        """
        Classify risk level using organization-specific thresholds.

        Args:
            score: Risk score (0-100)
            profile: Optional organization risk profile

        Returns:
            Risk level: 'low', 'medium', 'high', 'critical'
        """
        if profile is None:
            low_threshold = 30
            medium_threshold = 60
            high_threshold = 85
        else:
            low_threshold = profile.low_threshold
            medium_threshold = profile.medium_threshold
            high_threshold = profile.high_threshold

        if score <= low_threshold:
            return "low"
        elif score <= medium_threshold:
            return "medium"
        elif score <= high_threshold:
            return "high"
        else:
            return "critical"

    # =========================================================================
    # COMPONENT BASE RISK CALCULATION
    # =========================================================================

    async def calculate_component_base_risk(
        self,
        mpn: str,
        manufacturer: str,
        component_data: Dict[str, Any],
        data_sources: Optional[List[str]] = None
    ) -> ComponentBaseRisk:
        """
        Calculate base risk score for a component from enrichment data.

        This is called during BOM enrichment to populate component_base_risk_scores.

        Args:
            mpn: Manufacturer part number
            manufacturer: Manufacturer name
            component_data: Enrichment data (lifecycle, compliance, stock, etc.)
            data_sources: List of data sources used

        Returns:
            ComponentBaseRisk with calculated scores
        """
        try:
            risk_factors: Dict[str, Dict] = {}

            # Calculate individual risk factors
            lifecycle_risk = self._calculate_lifecycle_risk(
                component_data.get('lifecycle_status'),
                risk_factors
            )
            supply_chain_risk = self._calculate_supply_chain_risk(
                component_data,
                risk_factors
            )
            compliance_risk = self._calculate_compliance_risk(
                component_data,
                risk_factors
            )
            obsolescence_risk = self._calculate_obsolescence_risk(
                component_data,
                risk_factors
            )
            single_source_risk = self._calculate_single_source_risk(
                component_data,
                risk_factors
            )

            # Calculate default total (using standard weights)
            default_total = self._calculate_weighted_score(
                lifecycle_risk,
                supply_chain_risk,
                compliance_risk,
                obsolescence_risk,
                single_source_risk,
            )

            default_level = self.classify_risk_level(default_total)

            result = ComponentBaseRisk(
                mpn=mpn,
                manufacturer=manufacturer,
                lifecycle_risk=lifecycle_risk,
                supply_chain_risk=supply_chain_risk,
                compliance_risk=compliance_risk,
                obsolescence_risk=obsolescence_risk,
                single_source_risk=single_source_risk,
                default_total_score=default_total,
                default_risk_level=default_level,
                lead_time_days=component_data.get('lead_time_days'),
                stock_quantity=component_data.get('stock_quantity'),
                supplier_count=component_data.get('supplier_count', 0),
                risk_factors=risk_factors,
                data_sources=data_sources or [],
                calculation_date=datetime.utcnow(),
            )

            logger.debug(
                f"[ComponentRisk] Calculated: mpn={mpn} score={default_total} "
                f"level={default_level}"
            )

            return result

        except Exception as e:
            logger.error(f"[ComponentRisk] Error calculating: {e}", exc_info=True)
            # Return safe default
            return ComponentBaseRisk(mpn=mpn, manufacturer=manufacturer)

    def _calculate_lifecycle_risk(
        self,
        lifecycle_status: Optional[str],
        risk_factors: Dict
    ) -> int:
        """Calculate lifecycle risk factor."""
        factors = []

        if not lifecycle_status:
            factors.append("Lifecycle status unknown")
            score = LIFECYCLE_RISK_MAP.get('UNKNOWN', 25)
        else:
            status = lifecycle_status.upper()
            score = LIFECYCLE_RISK_MAP.get(status, LIFECYCLE_RISK_MAP['UNKNOWN'])

            if status == 'OBSOLETE':
                factors.append("Component is obsolete")
            elif status == 'EOL':
                factors.append("End of Life announced")
            elif status == 'NRND':
                factors.append("Not Recommended for New Designs")

        risk_factors['lifecycle'] = {
            'score': score,
            'factors': factors,
            'status': lifecycle_status or 'UNKNOWN',
        }

        return score

    def _calculate_supply_chain_risk(
        self,
        component_data: Dict,
        risk_factors: Dict
    ) -> int:
        """Calculate supply chain risk factor."""
        score = 0
        factors = []

        # Stock quantity
        stock = component_data.get('stock_quantity')
        if stock is not None:
            if stock == 0:
                score += 40
                factors.append("No stock available")
            elif stock < 100:
                score += 30
                factors.append(f"Very low stock: {stock}")
            elif stock < 1000:
                score += 15
                factors.append(f"Low stock: {stock}")
        else:
            score += 10
            factors.append("Stock quantity unknown")

        # Lead time
        lead_time = component_data.get('lead_time_days')
        if lead_time is not None:
            if lead_time > 84:
                score += 25
                factors.append(f"Long lead time: {lead_time} days")
            elif lead_time > 56:
                score += 15
                factors.append(f"Extended lead time: {lead_time} days")
        else:
            score += 5
            factors.append("Lead time unknown")

        # Supplier count
        supplier_count = component_data.get('supplier_count', 1)
        if supplier_count == 1:
            score += 20
            factors.append("Single supplier")
        elif supplier_count == 2:
            score += 10
            factors.append("Limited suppliers")

        risk_factors['supply_chain'] = {
            'score': min(score, 100),
            'factors': factors,
            'stock': stock,
            'lead_time_days': lead_time,
            'supplier_count': supplier_count,
        }

        return min(score, 100)

    def _calculate_compliance_risk(
        self,
        component_data: Dict,
        risk_factors: Dict
    ) -> int:
        """Calculate compliance risk factor."""
        score = 0
        factors = []

        # RoHS
        rohs = component_data.get('rohs_compliant')
        if rohs is None or rohs == 'UNKNOWN':
            score += 20
            factors.append("RoHS compliance unknown")
        elif rohs in (False, 'NON_COMPLIANT', 'Non-Compliant'):
            score += 40
            factors.append("Not RoHS compliant")

        # REACH
        reach = component_data.get('reach_compliant')
        if reach is None:
            score += 15
            factors.append("REACH compliance unknown")
        elif reach is False:
            score += 30
            factors.append("Not REACH compliant")

        # Halogen-free
        if component_data.get('halogen_free') is False:
            score += 10
            factors.append("Contains halogens")

        risk_factors['compliance'] = {
            'score': min(score, 100),
            'factors': factors,
            'rohs': rohs,
            'reach': reach,
        }

        return min(score, 100)

    def _calculate_obsolescence_risk(
        self,
        component_data: Dict,
        risk_factors: Dict
    ) -> int:
        """Calculate obsolescence risk factor."""
        score = 0
        factors = []

        # Product age
        intro_date = component_data.get('introduction_date')
        if intro_date:
            try:
                if isinstance(intro_date, str):
                    intro_year = int(intro_date[:4])
                else:
                    intro_year = intro_date.year
                age = datetime.now().year - intro_year
                if age > 10:
                    score += 30
                    factors.append(f"Product age: {age} years")
                elif age > 5:
                    score += 15
                    factors.append(f"Product age: {age} years")
            except (ValueError, AttributeError):
                pass

        # Lifecycle trajectory
        lifecycle = (component_data.get('lifecycle_status') or '').upper()
        if lifecycle == 'NRND':
            score += 25
            factors.append("Trending towards EOL")

        risk_factors['obsolescence'] = {
            'score': min(score, 100),
            'factors': factors,
        }

        return min(score, 100)

    def _calculate_single_source_risk(
        self,
        component_data: Dict,
        risk_factors: Dict
    ) -> int:
        """Calculate single source risk factor."""
        score = 0
        factors = []

        # Distributor count
        dist_count = component_data.get('distributor_count', 0)
        if dist_count <= 1:
            score += 50
            factors.append("Single distributor")
        elif dist_count == 2:
            score += 25
            factors.append("Limited distributors")
        elif dist_count <= 3:
            score += 10
            factors.append("Few distributors")

        # Alternative parts
        alternatives = component_data.get('alternative_parts', [])
        if not alternatives:
            score += 30
            factors.append("No alternatives identified")
        elif len(alternatives) < 2:
            score += 15
            factors.append("Limited alternatives")

        risk_factors['single_source'] = {
            'score': min(score, 100),
            'factors': factors,
            'distributor_count': dist_count,
            'alternatives': len(alternatives) if alternatives else 0,
        }

        return min(score, 100)

    def _calculate_weighted_score(
        self,
        lifecycle: int,
        supply_chain: int,
        compliance: int,
        obsolescence: int,
        single_source: int,
        profile: Optional[OrganizationRiskProfile] = None
    ) -> int:
        """Calculate weighted total risk score."""
        if profile is None:
            weights = (0.30, 0.25, 0.20, 0.15, 0.10)
        else:
            weights = (
                profile.lifecycle_weight / 100,
                profile.supply_chain_weight / 100,
                profile.compliance_weight / 100,
                profile.obsolescence_weight / 100,
                profile.single_source_weight / 100,
            )

        total = (
            lifecycle * weights[0] +
            supply_chain * weights[1] +
            compliance * weights[2] +
            obsolescence * weights[3] +
            single_source * weights[4]
        )

        return min(100, max(0, round(total)))

    # =========================================================================
    # STORE COMPONENT BASE RISK
    # =========================================================================

    async def store_component_base_risk(
        self,
        base_risk: ComponentBaseRisk,
        db: Optional[Session] = None
    ) -> str:
        """
        Store component base risk score in database.

        Args:
            base_risk: Calculated base risk
            db: Optional database session

        Returns:
            UUID of stored risk score
        """
        try:
            if db is None:
                db = next(get_dual_database().get_session("supabase"))

            sql = """
                INSERT INTO component_base_risk_scores (
                    mpn, manufacturer,
                    lifecycle_risk, supply_chain_risk, compliance_risk,
                    obsolescence_risk, single_source_risk,
                    default_total_score, default_risk_level,
                    lead_time_days, stock_quantity, supplier_count,
                    risk_factors, data_sources,
                    calculation_date, updated_at
                ) VALUES (
                    :mpn, :manufacturer,
                    :lifecycle_risk, :supply_chain_risk, :compliance_risk,
                    :obsolescence_risk, :single_source_risk,
                    :default_total_score, :default_risk_level,
                    :lead_time_days, :stock_quantity, :supplier_count,
                    :risk_factors, :data_sources,
                    NOW(), NOW()
                )
                ON CONFLICT (mpn, manufacturer) DO UPDATE SET
                    lifecycle_risk = EXCLUDED.lifecycle_risk,
                    supply_chain_risk = EXCLUDED.supply_chain_risk,
                    compliance_risk = EXCLUDED.compliance_risk,
                    obsolescence_risk = EXCLUDED.obsolescence_risk,
                    single_source_risk = EXCLUDED.single_source_risk,
                    default_total_score = EXCLUDED.default_total_score,
                    default_risk_level = EXCLUDED.default_risk_level,
                    lead_time_days = EXCLUDED.lead_time_days,
                    stock_quantity = EXCLUDED.stock_quantity,
                    supplier_count = EXCLUDED.supplier_count,
                    risk_factors = EXCLUDED.risk_factors,
                    data_sources = EXCLUDED.data_sources,
                    calculation_date = NOW(),
                    updated_at = NOW()
                RETURNING id
            """

            params = {
                "mpn": base_risk.mpn,
                "manufacturer": base_risk.manufacturer,
                "lifecycle_risk": base_risk.lifecycle_risk,
                "supply_chain_risk": base_risk.supply_chain_risk,
                "compliance_risk": base_risk.compliance_risk,
                "obsolescence_risk": base_risk.obsolescence_risk,
                "single_source_risk": base_risk.single_source_risk,
                "default_total_score": base_risk.default_total_score,
                "default_risk_level": base_risk.default_risk_level,
                "lead_time_days": base_risk.lead_time_days,
                "stock_quantity": base_risk.stock_quantity,
                "supplier_count": base_risk.supplier_count,
                "risk_factors": json.dumps(base_risk.risk_factors),
                "data_sources": base_risk.data_sources,
            }

            result = db.execute(text(sql), params)
            row = result.fetchone()
            db.commit()

            risk_id = str(row._mapping["id"]) if row else None

            logger.debug(
                f"[ComponentRisk] Stored: mpn={base_risk.mpn} "
                f"score={base_risk.default_total_score} id={risk_id}"
            )

            return risk_id

        except Exception as e:
            logger.error(f"[ComponentRisk] Error storing: {e}", exc_info=True)
            if db:
                db.rollback()
            raise

    # =========================================================================
    # BOM LINE ITEM CONTEXTUAL RISK
    # =========================================================================

    async def calculate_line_item_contextual_risk(
        self,
        bom_line_item_id: str,
        organization_id: str,
        base_risk: ComponentBaseRisk,
        quantity: int,
        required_by_date: Optional[datetime] = None,
        user_criticality: int = 5,
        db: Optional[Session] = None
    ) -> BOMLineItemRisk:
        """
        Calculate contextual risk for a BOM line item.

        Applies context modifiers to base risk:
        - Quantity: Higher volumes = higher impact if component fails
        - Lead Time: Tight deadlines with long lead times = higher risk
        - Criticality: User-defined mission-critical components

        Args:
            bom_line_item_id: BOM line item UUID
            organization_id: Organization UUID
            base_risk: Component base risk
            quantity: Required quantity
            required_by_date: Optional delivery deadline
            user_criticality: User-defined criticality (1-10)
            db: Optional database session

        Returns:
            BOMLineItemRisk with contextual score
        """
        try:
            # Get organization profile
            profile = await self.get_or_create_profile(organization_id, db)

            # Calculate quantity modifier (higher quantity = higher impact)
            quantity_mod = self._calculate_quantity_modifier(quantity, profile)

            # Calculate lead time modifier
            lead_time_mod = self._calculate_lead_time_modifier(
                required_by_date,
                base_risk.lead_time_days,
                profile
            )

            # Calculate criticality modifier from user input
            criticality_mod = self._calculate_criticality_modifier(
                user_criticality,
                profile
            )

            # Calculate base risk using org profile weights
            weighted_base = self._calculate_weighted_score(
                base_risk.lifecycle_risk,
                base_risk.supply_chain_risk,
                base_risk.compliance_risk,
                base_risk.obsolescence_risk,
                base_risk.single_source_risk,
                profile
            )

            # Apply context modifiers
            context_adjustment = (
                quantity_mod * profile.quantity_weight +
                lead_time_mod * profile.lead_time_weight +
                criticality_mod * profile.criticality_weight
            )

            # Calculate final contextual score
            contextual_score = min(100, int(weighted_base + context_adjustment))
            risk_level = self.classify_risk_level(contextual_score, profile)

            result = BOMLineItemRisk(
                bom_line_item_id=bom_line_item_id,
                organization_id=organization_id,
                base_risk_score=weighted_base,
                quantity_modifier=int(quantity_mod),
                lead_time_modifier=int(lead_time_mod),
                criticality_modifier=int(criticality_mod),
                user_criticality_level=user_criticality,
                contextual_risk_score=contextual_score,
                risk_level=risk_level,
            )

            logger.debug(
                f"[LineItemRisk] Calculated: line_item={bom_line_item_id} "
                f"base={weighted_base} context={contextual_score} level={risk_level}"
            )

            return result

        except Exception as e:
            logger.error(f"[LineItemRisk] Error calculating: {e}", exc_info=True)
            # Return safe default
            return BOMLineItemRisk(
                bom_line_item_id=bom_line_item_id,
                organization_id=organization_id,
                base_risk_score=base_risk.default_total_score,
                contextual_risk_score=base_risk.default_total_score,
                risk_level=base_risk.default_risk_level,
            )

    def _calculate_quantity_modifier(
        self,
        quantity: int,
        profile: OrganizationRiskProfile
    ) -> float:
        """Calculate quantity modifier (0-100)."""
        if quantity <= 10:
            return 0
        elif quantity <= 100:
            return 10
        elif quantity <= 1000:
            return 25
        elif quantity <= 10000:
            return 50
        else:
            return 75

    def _calculate_lead_time_modifier(
        self,
        required_by: Optional[datetime],
        component_lead_time: Optional[int],
        profile: OrganizationRiskProfile
    ) -> float:
        """Calculate lead time urgency modifier (0-100)."""
        if not required_by or not component_lead_time:
            return 0

        days_until_required = (required_by - datetime.utcnow()).days
        if days_until_required <= 0:
            return 100  # Already past due

        buffer_days = days_until_required - component_lead_time
        if buffer_days < 0:
            return 80  # Lead time exceeds deadline
        elif buffer_days < 7:
            return 50  # Less than 1 week buffer
        elif buffer_days < 14:
            return 25  # Less than 2 weeks buffer
        else:
            return 0

    def _calculate_criticality_modifier(
        self,
        user_criticality: int,
        profile: OrganizationRiskProfile
    ) -> float:
        """Convert user criticality (1-10) to modifier (0-100)."""
        # Scale 1-10 to 0-100, with 5 being neutral (50)
        return (user_criticality - 1) * 11.1  # 1->0, 5->44.4, 10->100

    # =========================================================================
    # STORE BOM LINE ITEM RISK
    # =========================================================================

    async def store_line_item_risk(
        self,
        line_item_risk: BOMLineItemRisk,
        base_risk_id: Optional[str] = None,
        profile_id: Optional[str] = None,
        db: Optional[Session] = None
    ) -> str:
        """Store BOM line item contextual risk score."""
        try:
            if db is None:
                db = next(get_dual_database().get_session("supabase"))

            sql = """
                INSERT INTO bom_line_item_risk_scores (
                    bom_line_item_id, organization_id,
                    base_risk_id, base_risk_score,
                    quantity_modifier, lead_time_modifier, criticality_modifier,
                    user_criticality_level,
                    contextual_risk_score, risk_level,
                    alternates_available, alternate_risk_reduction,
                    profile_version_used, calculated_at, updated_at
                ) VALUES (
                    :bom_line_item_id, :organization_id,
                    :base_risk_id, :base_risk_score,
                    :quantity_modifier, :lead_time_modifier, :criticality_modifier,
                    :user_criticality_level,
                    :contextual_risk_score, :risk_level,
                    :alternates_available, :alternate_risk_reduction,
                    :profile_version_used, NOW(), NOW()
                )
                ON CONFLICT (bom_line_item_id) DO UPDATE SET
                    base_risk_id = EXCLUDED.base_risk_id,
                    base_risk_score = EXCLUDED.base_risk_score,
                    quantity_modifier = EXCLUDED.quantity_modifier,
                    lead_time_modifier = EXCLUDED.lead_time_modifier,
                    criticality_modifier = EXCLUDED.criticality_modifier,
                    user_criticality_level = EXCLUDED.user_criticality_level,
                    contextual_risk_score = EXCLUDED.contextual_risk_score,
                    risk_level = EXCLUDED.risk_level,
                    profile_version_used = EXCLUDED.profile_version_used,
                    calculated_at = NOW(),
                    updated_at = NOW()
                RETURNING id
            """

            params = {
                "bom_line_item_id": line_item_risk.bom_line_item_id,
                "organization_id": line_item_risk.organization_id,
                "base_risk_id": base_risk_id,
                "base_risk_score": line_item_risk.base_risk_score,
                "quantity_modifier": line_item_risk.quantity_modifier,
                "lead_time_modifier": line_item_risk.lead_time_modifier,
                "criticality_modifier": line_item_risk.criticality_modifier,
                "user_criticality_level": line_item_risk.user_criticality_level,
                "contextual_risk_score": line_item_risk.contextual_risk_score,
                "risk_level": line_item_risk.risk_level,
                "alternates_available": line_item_risk.alternates_available,
                "alternate_risk_reduction": line_item_risk.alternate_risk_reduction,
                "profile_version_used": profile_id,
            }

            result = db.execute(text(sql), params)
            row = result.fetchone()
            db.commit()

            return str(row._mapping["id"]) if row else None

        except Exception as e:
            logger.error(f"[LineItemRisk] Error storing: {e}", exc_info=True)
            if db:
                db.rollback()
            raise

    # =========================================================================
    # BOM RISK SUMMARY
    # =========================================================================

    async def calculate_bom_risk_summary(
        self,
        bom_id: str,
        organization_id: str,
        db: Optional[Session] = None
    ) -> BOMRiskSummary:
        """
        Calculate aggregate BOM health summary.

        Aggregates all line item contextual risks into:
        - Risk distribution (counts per level)
        - Average/weighted scores
        - Health grade (A-F)
        - Top risk factors and components

        Args:
            bom_id: BOM UUID
            organization_id: Organization UUID
            db: Optional database session

        Returns:
            BOMRiskSummary with aggregate scores
        """
        try:
            if db is None:
                db = next(get_dual_database().get_session("supabase"))

            profile = await self.get_or_create_profile(organization_id, db)

            # Get all line item risk scores for this BOM
            sql = """
                SELECT
                    blirs.contextual_risk_score,
                    blirs.risk_level,
                    bli.quantity,
                    bli.manufacturer_part_number as mpn,
                    bli.manufacturer
                FROM bom_line_item_risk_scores blirs
                JOIN bom_line_items bli ON bli.id = blirs.bom_line_item_id
                WHERE bli.bom_id = :bom_id
                AND blirs.organization_id = :org_id
            """

            rows = db.execute(text(sql), {
                "bom_id": bom_id,
                "org_id": organization_id
            }).fetchall()

            if not rows:
                logger.warning(f"[BOMRisk] No line items with risk scores: bom={bom_id}")
                return BOMRiskSummary(bom_id=bom_id, organization_id=organization_id)

            # Calculate aggregates
            distribution = {"low": 0, "medium": 0, "high": 0, "critical": 0}
            total_score = 0
            weighted_total = 0
            total_quantity = 0
            max_score = 0
            min_score = 100
            high_risk_components = []

            for row in rows:
                m = row._mapping
                score = m["contextual_risk_score"]
                level = m["risk_level"]
                qty = m["quantity"] or 1

                distribution[level] = distribution.get(level, 0) + 1
                total_score += score
                weighted_total += score * qty
                total_quantity += qty
                max_score = max(max_score, score)
                min_score = min(min_score, score)

                if level in ("high", "critical"):
                    high_risk_components.append({
                        "mpn": m["mpn"],
                        "manufacturer": m["manufacturer"],
                        "score": score,
                        "level": level,
                    })

            total_items = len(rows)
            avg_score = round(total_score / total_items, 2) if total_items else 0
            weighted_avg = round(weighted_total / total_quantity, 2) if total_quantity else 0

            # Calculate health grade
            critical_pct = (distribution["critical"] / total_items * 100) if total_items else 0
            high_pct = (distribution["high"] / total_items * 100) if total_items else 0
            health_grade = self._calculate_health_grade(critical_pct, high_pct)

            # Sort high-risk components by score
            high_risk_components.sort(key=lambda x: x["score"], reverse=True)

            # Calculate top risk factors (placeholder - would analyze factor distribution)
            top_factors = self._analyze_top_risk_factors(rows, db)

            # Get previous score for trend
            prev_score = await self._get_previous_bom_score(bom_id, organization_id, db)
            if prev_score is not None:
                if avg_score < prev_score - 5:
                    trend = "improving"
                elif avg_score > prev_score + 5:
                    trend = "worsening"
                else:
                    trend = "stable"
            else:
                trend = "stable"

            result = BOMRiskSummary(
                bom_id=bom_id,
                organization_id=organization_id,
                low_risk_count=distribution["low"],
                medium_risk_count=distribution["medium"],
                high_risk_count=distribution["high"],
                critical_risk_count=distribution["critical"],
                total_line_items=total_items,
                average_risk_score=avg_score,
                weighted_risk_score=weighted_avg,
                max_risk_score=max_score,
                min_risk_score=min_score if total_items else 0,
                health_grade=health_grade,
                score_trend=trend,
                top_risk_factors=top_factors,
                top_risk_components=high_risk_components[:5],  # Top 5
            )

            logger.info(
                f"[BOMRisk] Calculated summary: bom={bom_id} items={total_items} "
                f"avg={avg_score} grade={health_grade}"
            )

            return result

        except Exception as e:
            logger.error(f"[BOMRisk] Error calculating summary: {e}", exc_info=True)
            return BOMRiskSummary(bom_id=bom_id, organization_id=organization_id)

    def _calculate_health_grade(self, critical_pct: float, high_pct: float) -> str:
        """Calculate BOM health grade based on risk distribution."""
        combined = critical_pct + high_pct

        if combined < 5:
            return "A"
        elif combined < 15:
            return "B"
        elif combined < 30:
            return "C"
        elif combined < 50:
            return "D"
        else:
            return "F"

    def _analyze_top_risk_factors(self, rows: List, db: Session) -> List[Dict]:
        """Analyze top contributing risk factors across line items."""
        # Placeholder - would aggregate factor scores from base risks
        return []

    async def _get_previous_bom_score(
        self,
        bom_id: str,
        organization_id: str,
        db: Session
    ) -> Optional[float]:
        """Get previous BOM average score for trend calculation."""
        try:
            sql = """
                SELECT average_risk_score
                FROM bom_risk_summaries
                WHERE bom_id = :bom_id
                AND organization_id = :org_id
            """
            row = db.execute(text(sql), {
                "bom_id": bom_id,
                "org_id": organization_id
            }).fetchone()

            return float(row._mapping["average_risk_score"]) if row else None

        except Exception:
            return None

    # =========================================================================
    # STORE BOM RISK SUMMARY
    # =========================================================================

    async def store_bom_risk_summary(
        self,
        summary: BOMRiskSummary,
        profile_id: Optional[str] = None,
        db: Optional[Session] = None
    ) -> str:
        """Store BOM risk summary."""
        try:
            if db is None:
                db = next(get_dual_database().get_session("supabase"))

            sql = """
                INSERT INTO bom_risk_summaries (
                    bom_id, organization_id,
                    low_risk_count, medium_risk_count, high_risk_count, critical_risk_count,
                    total_line_items, average_risk_score, weighted_risk_score,
                    max_risk_score, min_risk_score, health_grade, score_trend,
                    top_risk_factors, top_risk_components,
                    previous_average_score, profile_version_used,
                    calculated_at, updated_at
                ) VALUES (
                    :bom_id, :organization_id,
                    :low_risk_count, :medium_risk_count, :high_risk_count, :critical_risk_count,
                    :total_line_items, :average_risk_score, :weighted_risk_score,
                    :max_risk_score, :min_risk_score, :health_grade, :score_trend,
                    :top_risk_factors, :top_risk_components,
                    :previous_average_score, :profile_version_used,
                    NOW(), NOW()
                )
                ON CONFLICT (bom_id) DO UPDATE SET
                    low_risk_count = EXCLUDED.low_risk_count,
                    medium_risk_count = EXCLUDED.medium_risk_count,
                    high_risk_count = EXCLUDED.high_risk_count,
                    critical_risk_count = EXCLUDED.critical_risk_count,
                    total_line_items = EXCLUDED.total_line_items,
                    average_risk_score = EXCLUDED.average_risk_score,
                    weighted_risk_score = EXCLUDED.weighted_risk_score,
                    max_risk_score = EXCLUDED.max_risk_score,
                    min_risk_score = EXCLUDED.min_risk_score,
                    health_grade = EXCLUDED.health_grade,
                    previous_average_score = bom_risk_summaries.average_risk_score,
                    score_trend = EXCLUDED.score_trend,
                    top_risk_factors = EXCLUDED.top_risk_factors,
                    top_risk_components = EXCLUDED.top_risk_components,
                    profile_version_used = EXCLUDED.profile_version_used,
                    calculated_at = NOW(),
                    updated_at = NOW()
                RETURNING id
            """

            params = {
                "bom_id": summary.bom_id,
                "organization_id": summary.organization_id,
                "low_risk_count": summary.low_risk_count,
                "medium_risk_count": summary.medium_risk_count,
                "high_risk_count": summary.high_risk_count,
                "critical_risk_count": summary.critical_risk_count,
                "total_line_items": summary.total_line_items,
                "average_risk_score": summary.average_risk_score,
                "weighted_risk_score": summary.weighted_risk_score,
                "max_risk_score": summary.max_risk_score,
                "min_risk_score": summary.min_risk_score,
                "health_grade": summary.health_grade,
                "score_trend": summary.score_trend,
                "top_risk_factors": json.dumps(summary.top_risk_factors),
                "top_risk_components": json.dumps(summary.top_risk_components),
                "previous_average_score": None,
                "profile_version_used": profile_id,
            }

            result = db.execute(text(sql), params)
            row = result.fetchone()
            db.commit()

            # Record history
            await self._record_bom_history(summary, db)

            return str(row._mapping["id"]) if row else None

        except Exception as e:
            logger.error(f"[BOMRisk] Error storing summary: {e}", exc_info=True)
            if db:
                db.rollback()
            raise

    async def _record_bom_history(self, summary: BOMRiskSummary, db: Session):
        """Record BOM risk score in history for trend analysis."""
        try:
            sql = """
                INSERT INTO risk_score_history (
                    entity_type, entity_id, organization_id,
                    total_risk_score, risk_level, health_grade,
                    recorded_date
                ) VALUES (
                    'bom', :bom_id, :org_id,
                    :score, :level, :grade,
                    NOW()::DATE
                )
                ON CONFLICT (entity_type, entity_id, recorded_date) DO UPDATE SET
                    total_risk_score = EXCLUDED.total_risk_score,
                    risk_level = EXCLUDED.risk_level,
                    health_grade = EXCLUDED.health_grade
            """

            # Determine risk level from average score
            profile = await self.get_or_create_profile(summary.organization_id, db)
            risk_level = self.classify_risk_level(int(summary.average_risk_score), profile)

            db.execute(text(sql), {
                "bom_id": summary.bom_id,
                "org_id": summary.organization_id,
                "score": int(summary.average_risk_score),
                "level": risk_level,
                "grade": summary.health_grade,
            })
            db.commit()

        except Exception as e:
            logger.warning(f"[BOMRisk] Error recording history: {e}")


# =============================================================================
# MODULE-LEVEL SINGLETON
# =============================================================================

_risk_calculation_service: Optional[RiskCalculationService] = None


def get_risk_calculation_service() -> RiskCalculationService:
    """Get or create the risk calculation service singleton."""
    global _risk_calculation_service
    if _risk_calculation_service is None:
        _risk_calculation_service = RiskCalculationService()
    return _risk_calculation_service
