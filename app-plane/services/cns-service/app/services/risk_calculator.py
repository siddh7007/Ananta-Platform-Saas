"""
Risk Calculator Service

Calculates comprehensive risk scores for components using weighted factors:
- Lifecycle (30%): Based on component status
- Supply Chain (25%): Based on stock levels, lead times, suppliers
- Compliance (20%): Based on RoHS, REACH compliance
- Obsolescence (15%): Based on product age and trends
- Single Source (10%): Based on supplier diversity

Events Published:
- risk.calculated: Published to RabbitMQ after each risk calculation
  for downstream caching and alert processing.
"""

import json
import logging
import os
from datetime import datetime
from typing import Any, Dict, List, Optional
from dataclasses import dataclass, asdict

from sqlalchemy import text

from app.models.dual_database import get_dual_database

# RabbitMQ publisher import - optional
try:
    import pika
    from pika.exceptions import AMQPConnectionError
    PIKA_AVAILABLE = True
except ImportError:
    PIKA_AVAILABLE = False

logger = logging.getLogger(__name__)

# Event publishing configuration
RABBITMQ_HOST = os.getenv("RABBITMQ_HOST", "rabbitmq")
RABBITMQ_PORT = int(os.getenv("RABBITMQ_PORT", "5672"))
RABBITMQ_USER = os.getenv("RABBITMQ_USER", "admin")
RABBITMQ_PASSWORD = os.getenv("RABBITMQ_PASSWORD", "admin123_change_in_production")
EXCHANGE_NAME = "platform.events"


# =============================================================================
# CONFIGURATION
# =============================================================================

RISK_WEIGHTS = {
    'lifecycle': 0.30,
    'supply_chain': 0.25,
    'compliance': 0.20,
    'obsolescence': 0.15,
    'single_source': 0.10,
}

RISK_THRESHOLDS = {
    'low': (0, 30),
    'medium': (31, 60),
    'high': (61, 85),
    'critical': (86, 100),
}

LIFECYCLE_RISK_MAP = {
    'ACTIVE': 0,
    'PREVIEW': 10,
    'NRND': 50,
    'EOL': 80,
    'OBSOLETE': 100,
    'UNKNOWN': 25,
}


@dataclass
class ComponentRiskScore:
    """Risk score result"""
    component_id: str
    mpn: Optional[str] = None
    manufacturer: Optional[str] = None
    lifecycle_risk: int = 0
    supply_chain_risk: int = 0
    compliance_risk: int = 0
    obsolescence_risk: int = 0
    single_source_risk: int = 0
    total_risk_score: int = 0
    risk_level: str = "low"
    risk_factors: Optional[Dict[str, Any]] = None
    mitigation_suggestions: Optional[str] = None
    calculated_at: Optional[datetime] = None
    calculation_method: str = "weighted_average_v1"


@dataclass
class RiskCalculatedEvent:
    """Event published when risk is calculated for a component."""
    component_id: str
    organization_id: str
    mpn: Optional[str]
    manufacturer: Optional[str]
    total_risk_score: int
    risk_level: str
    lifecycle_risk: int
    supply_chain_risk: int
    compliance_risk: int
    obsolescence_risk: int
    single_source_risk: int
    calculated_at: str  # ISO format

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return {
            "event_type": "risk.calculated",
            "component_id": self.component_id,
            "organization_id": self.organization_id,
            "mpn": self.mpn,
            "manufacturer": self.manufacturer,
            "total_risk_score": self.total_risk_score,
            "risk_level": self.risk_level,
            "factor_scores": {
                "lifecycle": self.lifecycle_risk,
                "supply_chain": self.supply_chain_risk,
                "compliance": self.compliance_risk,
                "obsolescence": self.obsolescence_risk,
                "single_source": self.single_source_risk,
            },
            "calculated_at": self.calculated_at,
        }


class RiskEventPublisher:
    """
    Publishes risk.calculated events to RabbitMQ for downstream processing.

    Events are consumed by:
    - Risk cache service (for Redis read model)
    - Alert service (for threshold notifications)
    """

    def __init__(self):
        self._connection: Optional[Any] = None
        self._channel = None

    def _ensure_connection(self) -> bool:
        """Ensure RabbitMQ connection is active."""
        if not PIKA_AVAILABLE:
            logger.debug("[RiskEventPublisher] pika not available")
            return False

        try:
            if self._connection is None or self._connection.is_closed:
                credentials = pika.PlainCredentials(RABBITMQ_USER, RABBITMQ_PASSWORD)
                params = pika.ConnectionParameters(
                    host=RABBITMQ_HOST,
                    port=RABBITMQ_PORT,
                    credentials=credentials,
                    heartbeat=600,
                )
                self._connection = pika.BlockingConnection(params)
                self._channel = self._connection.channel()
                self._channel.exchange_declare(
                    exchange=EXCHANGE_NAME,
                    exchange_type="topic",
                    durable=True,
                )
                logger.debug(f"[RiskEventPublisher] Connected to RabbitMQ at {RABBITMQ_HOST}:{RABBITMQ_PORT}")
            return True
        except AMQPConnectionError as e:
            logger.warning(f"[RiskEventPublisher] Failed to connect to RabbitMQ: {e}")
            return False
        except Exception as e:
            logger.warning(f"[RiskEventPublisher] Unexpected error: {e}")
            return False

    def publish(self, event: RiskCalculatedEvent) -> bool:
        """
        Publish risk.calculated event to RabbitMQ.

        Args:
            event: RiskCalculatedEvent to publish

        Returns:
            True if published successfully
        """
        if not self._ensure_connection():
            logger.debug("[RiskEventPublisher] Skipping publish - not connected")
            return False

        try:
            routing_key = f"risk.calculated.{event.organization_id}"
            message = json.dumps(event.to_dict())

            self._channel.basic_publish(
                exchange=EXCHANGE_NAME,
                routing_key=routing_key,
                body=message,
                properties=pika.BasicProperties(
                    delivery_mode=2,  # Persistent
                    content_type="application/json",
                ),
            )

            logger.info(
                f"[RiskEventPublisher] Published risk.calculated: "
                f"component={event.component_id}, score={event.total_risk_score}, "
                f"org={event.organization_id}"
            )
            return True

        except Exception as e:
            logger.error(f"[RiskEventPublisher] Failed to publish event: {e}")
            self._connection = None
            self._channel = None
            return False

    def close(self):
        """Close RabbitMQ connection."""
        try:
            if self._connection and not self._connection.is_closed:
                self._connection.close()
        except Exception:
            pass
        finally:
            self._connection = None
            self._channel = None


# Global publisher instance (lazy initialization)
_risk_event_publisher: Optional[RiskEventPublisher] = None


def get_risk_event_publisher() -> RiskEventPublisher:
    """Get or create the global risk event publisher."""
    global _risk_event_publisher
    if _risk_event_publisher is None:
        _risk_event_publisher = RiskEventPublisher()
    return _risk_event_publisher


class RiskCalculatorService:
    """
    Calculates comprehensive risk scores for components.
    """

    def __init__(self):
        self.weights = RISK_WEIGHTS
        self.thresholds = RISK_THRESHOLDS

    def classify_risk_level(self, score: int) -> str:
        """Classify risk level based on total score."""
        if score <= 30:
            return "low"
        elif score <= 60:
            return "medium"
        elif score <= 85:
            return "high"
        else:
            return "critical"

    def calculate_lifecycle_risk(self, lifecycle_status: Optional[str]) -> tuple[int, List[str]]:
        """
        Calculate lifecycle risk based on component status.

        Returns:
            Tuple of (risk_score, contributing_factors)
        """
        factors = []

        if not lifecycle_status:
            factors.append("Lifecycle status unknown")
            return LIFECYCLE_RISK_MAP.get('UNKNOWN', 25), factors

        status_upper = lifecycle_status.upper()
        score = LIFECYCLE_RISK_MAP.get(status_upper, LIFECYCLE_RISK_MAP['UNKNOWN'])

        if status_upper == 'OBSOLETE':
            factors.append("Component is obsolete - no longer manufactured")
        elif status_upper == 'EOL':
            factors.append("End of Life announced - limited availability")
        elif status_upper == 'NRND':
            factors.append("Not Recommended for New Designs")
        elif status_upper == 'PREVIEW':
            factors.append("New product with limited availability")
        elif status_upper == 'UNKNOWN':
            factors.append("Lifecycle status unknown - data quality issue")

        return score, factors

    def calculate_supply_chain_risk(self, component_data: Dict[str, Any]) -> tuple[int, List[str]]:
        """
        Calculate supply chain risk based on availability data.

        Factors:
        - Stock quantity (low stock = high risk)
        - Lead time (>12 weeks = high risk)
        - Number of suppliers
        """
        score = 0
        factors = []

        # Stock quantity risk
        stock = component_data.get('stock_quantity')
        if stock is not None:
            if stock == 0:
                score += 40
                factors.append("No stock available")
            elif stock < 100:
                score += 30
                factors.append(f"Very low stock: {stock} units")
            elif stock < 1000:
                score += 15
                factors.append(f"Low stock: {stock} units")
        else:
            score += 10
            factors.append("Stock quantity unknown")

        # Lead time risk
        lead_time_days = component_data.get('lead_time_days')
        if lead_time_days is not None:
            if lead_time_days > 84:  # > 12 weeks
                score += 25
                factors.append(f"Long lead time: {lead_time_days} days")
            elif lead_time_days > 56:  # > 8 weeks
                score += 15
                factors.append(f"Extended lead time: {lead_time_days} days")
        else:
            score += 5
            factors.append("Lead time unknown")

        # Supplier count risk (if available)
        supplier_count = component_data.get('supplier_count', 1)
        if supplier_count == 1:
            score += 20
            factors.append("Single supplier available")
        elif supplier_count == 2:
            score += 10
            factors.append("Limited suppliers (2)")

        return min(score, 100), factors

    def calculate_compliance_risk(self, component_data: Dict[str, Any]) -> tuple[int, List[str]]:
        """
        Calculate compliance risk based on regulatory compliance status.

        Factors:
        - RoHS compliance
        - REACH compliance
        - AEC-Q qualification (for automotive)
        """
        score = 0
        factors = []

        # RoHS compliance
        rohs = component_data.get('rohs_compliant')
        if rohs is None or rohs == 'UNKNOWN':
            score += 20
            factors.append("RoHS compliance unknown")
        elif rohs in (False, 'NON_COMPLIANT', 'Non-Compliant'):
            score += 40
            factors.append("Not RoHS compliant")

        # REACH compliance
        reach = component_data.get('reach_compliant')
        if reach is None:
            score += 15
            factors.append("REACH compliance unknown")
        elif reach is False:
            score += 30
            factors.append("Not REACH compliant")

        # Halogen-free status
        halogen_free = component_data.get('halogen_free')
        if halogen_free is False:
            score += 10
            factors.append("Contains halogens")

        # AEC-Q qualification (for automotive applications)
        aec_qualified = component_data.get('aec_qualified')
        is_automotive = component_data.get('is_automotive_project', False)
        if is_automotive and not aec_qualified:
            score += 20
            factors.append("Not AEC-Q qualified for automotive use")

        return min(score, 100), factors

    def calculate_obsolescence_risk(self, component_data: Dict[str, Any]) -> tuple[int, List[str]]:
        """
        Calculate obsolescence risk based on product age and trends.

        Factors:
        - Years since introduction
        - Lifecycle trajectory
        - Market availability trends
        """
        score = 0
        factors = []

        # Product age (if introduction date available)
        intro_date = component_data.get('introduction_date')
        if intro_date:
            try:
                if isinstance(intro_date, str):
                    intro_year = int(intro_date[:4])
                else:
                    intro_year = intro_date.year
                current_year = datetime.now().year
                age_years = current_year - intro_year

                if age_years > 10:
                    score += 30
                    factors.append(f"Product age: {age_years} years (>10)")
                elif age_years > 5:
                    score += 15
                    factors.append(f"Product age: {age_years} years")
            except (ValueError, AttributeError):
                pass

        # Lifecycle status trajectory
        lifecycle = component_data.get('lifecycle_status', '').upper()
        if lifecycle == 'NRND':
            score += 25
            factors.append("Trending towards end of life (NRND)")

        # Manufacturer EOL history (placeholder - would need historical data)
        manufacturer = component_data.get('manufacturer')
        if manufacturer and manufacturer.lower() in ['ti', 'texas instruments']:
            # Example: Some manufacturers have aggressive EOL policies
            pass

        return min(score, 100), factors

    def calculate_single_source_risk(self, component_data: Dict[str, Any]) -> tuple[int, List[str]]:
        """
        Calculate single source risk based on supplier diversity.

        Factors:
        - Number of authorized distributors
        - Alternative parts available
        - Geographic distribution
        """
        score = 0
        factors = []

        # Number of distributors
        distributor_count = component_data.get('distributor_count', 0)
        if distributor_count <= 1:
            score += 50
            factors.append("Single authorized distributor")
        elif distributor_count == 2:
            score += 25
            factors.append("Limited distributors (2)")
        elif distributor_count <= 3:
            score += 10
            factors.append("Few distributors (3)")

        # Alternative parts (if cross-reference data available)
        alternatives = component_data.get('alternative_parts', [])
        if not alternatives:
            score += 30
            factors.append("No alternative parts identified")
        elif len(alternatives) < 2:
            score += 15
            factors.append("Limited alternatives available")

        # Geographic concentration
        regions = component_data.get('supplier_regions', [])
        if len(regions) == 1:
            score += 20
            factors.append(f"Suppliers concentrated in single region: {regions[0]}")

        return min(score, 100), factors

    def calculate_total_score(
        self,
        lifecycle: int,
        supply_chain: int,
        compliance: int,
        obsolescence: int,
        single_source: int
    ) -> int:
        """Calculate weighted total risk score."""
        total = (
            lifecycle * self.weights['lifecycle'] +
            supply_chain * self.weights['supply_chain'] +
            compliance * self.weights['compliance'] +
            obsolescence * self.weights['obsolescence'] +
            single_source * self.weights['single_source']
        )
        return min(100, max(0, round(total)))

    def generate_mitigation_suggestions(self, risk_score: ComponentRiskScore) -> str:
        """Generate mitigation suggestions based on risk factors."""
        suggestions = []

        if risk_score.lifecycle_risk >= 50:
            if risk_score.lifecycle_risk >= 80:
                suggestions.append("URGENT: Identify replacement parts immediately")
                suggestions.append("Secure last-time-buy inventory if needed")
            else:
                suggestions.append("Plan for component phase-out")
                suggestions.append("Evaluate alternative parts")

        if risk_score.supply_chain_risk >= 50:
            suggestions.append("Diversify supplier base")
            suggestions.append("Increase safety stock levels")
            suggestions.append("Negotiate long-term supply agreements")

        if risk_score.compliance_risk >= 40:
            suggestions.append("Verify compliance documentation")
            suggestions.append("Consider compliant alternatives")

        if risk_score.single_source_risk >= 50:
            suggestions.append("Identify second-source alternatives")
            suggestions.append("Qualify backup suppliers")

        if risk_score.obsolescence_risk >= 50:
            suggestions.append("Monitor manufacturer announcements")
            suggestions.append("Consider newer technology alternatives")

        if not suggestions:
            suggestions.append("Component risk within acceptable limits")
            suggestions.append("Continue standard monitoring")

        return "\n".join(f"• {s}" for s in suggestions)

    async def calculate_total_risk(
        self,
        component_id: str,
        organization_id: str,
        force_recalculate: bool = False
    ) -> ComponentRiskScore:
        """
        Calculate and store complete risk score for a component.

        Args:
            component_id: UUID of the component
            organization_id: UUID of the organization
            force_recalculate: If True, recalculate even if recent score exists

        Returns:
            ComponentRiskScore with all calculated factors
        """
        try:
            db = next(get_dual_database().get_session("supabase"))

            # Get component data from central catalog
            # Note: Central component catalog is shared, not tenant-specific
            sql = """
                SELECT
                    id,
                    manufacturer_part_number,
                    manufacturer,
                    lifecycle_status,
                    rohs_compliant,
                    reach_compliant,
                    halogen_free,
                    aec_qualified,
                    stock_quantity,
                    lead_time_days,
                    introduction_date
                FROM component_catalog
                WHERE id = :component_id
            """
            params = {"component_id": component_id}

            row = db.execute(text(sql), params).fetchone()

            if not row:
                raise ValueError(f"Component not found: {component_id}")

            m = row._mapping
            component_data = dict(m)

            # Calculate individual risk factors
            lifecycle_risk, lifecycle_factors = self.calculate_lifecycle_risk(
                component_data.get('lifecycle_status')
            )
            supply_chain_risk, supply_factors = self.calculate_supply_chain_risk(component_data)
            compliance_risk, compliance_factors = self.calculate_compliance_risk(component_data)
            obsolescence_risk, obsolescence_factors = self.calculate_obsolescence_risk(component_data)
            single_source_risk, single_source_factors = self.calculate_single_source_risk(component_data)

            # Calculate total
            total_score = self.calculate_total_score(
                lifecycle_risk,
                supply_chain_risk,
                compliance_risk,
                obsolescence_risk,
                single_source_risk
            )
            risk_level = self.classify_risk_level(total_score)

            # Build risk factors detail
            risk_factors = {
                'lifecycle': {
                    'score': lifecycle_risk,
                    'weight': self.weights['lifecycle'],
                    'factors': lifecycle_factors
                },
                'supply_chain': {
                    'score': supply_chain_risk,
                    'weight': self.weights['supply_chain'],
                    'factors': supply_factors
                },
                'compliance': {
                    'score': compliance_risk,
                    'weight': self.weights['compliance'],
                    'factors': compliance_factors
                },
                'obsolescence': {
                    'score': obsolescence_risk,
                    'weight': self.weights['obsolescence'],
                    'factors': obsolescence_factors
                },
                'single_source': {
                    'score': single_source_risk,
                    'weight': self.weights['single_source'],
                    'factors': single_source_factors
                }
            }

            # Create result
            result = ComponentRiskScore(
                component_id=component_id,
                mpn=component_data.get('manufacturer_part_number'),
                manufacturer=component_data.get('manufacturer'),
                lifecycle_risk=lifecycle_risk,
                supply_chain_risk=supply_chain_risk,
                compliance_risk=compliance_risk,
                obsolescence_risk=obsolescence_risk,
                single_source_risk=single_source_risk,
                total_risk_score=total_score,
                risk_level=risk_level,
                risk_factors=risk_factors,
                calculated_at=datetime.utcnow(),
            )

            # Generate mitigation suggestions
            result.mitigation_suggestions = self.generate_mitigation_suggestions(result)

            # Store the result
            await self._store_risk_score(db, result, organization_id)

            # Publish risk.calculated event for downstream processing (cache, alerts)
            self._publish_risk_event(result, organization_id)

            logger.info(f"[RiskCalculator] Calculated risk for {component_id}: score={total_score}, level={risk_level}")

            return result

        except ValueError:
            raise
        except Exception as e:
            logger.error(f"[RiskCalculator] Error calculating risk for {component_id}: {e}", exc_info=True)
            raise

    async def _store_risk_score(self, db, risk_score: ComponentRiskScore, organization_id: str):
        """Store calculated risk score in database."""
        import json

        try:
            # Get previous score for history tracking
            prev_sql = """
                SELECT total_risk_score FROM component_risk_scores
                WHERE component_id = :component_id
            """
            prev_row = db.execute(text(prev_sql), {"component_id": risk_score.component_id}).fetchone()
            prev_score = prev_row._mapping.get("total_risk_score") if prev_row else None

            # Upsert risk score
            upsert_sql = """
                INSERT INTO component_risk_scores (
                    component_id, organization_id,
                    lifecycle_risk, supply_chain_risk, compliance_risk,
                    obsolescence_risk, single_source_risk,
                    total_risk_score, risk_level,
                    risk_factors, mitigation_suggestions,
                    calculation_date, updated_at
                ) VALUES (
                    :component_id, :org_id,
                    :lifecycle_risk, :supply_chain_risk, :compliance_risk,
                    :obsolescence_risk, :single_source_risk,
                    :total_risk_score, :risk_level,
                    :risk_factors, :mitigation_suggestions,
                    NOW(), NOW()
                )
                ON CONFLICT (component_id) DO UPDATE SET
                    lifecycle_risk = :lifecycle_risk,
                    supply_chain_risk = :supply_chain_risk,
                    compliance_risk = :compliance_risk,
                    obsolescence_risk = :obsolescence_risk,
                    single_source_risk = :single_source_risk,
                    total_risk_score = :total_risk_score,
                    risk_level = :risk_level,
                    risk_factors = :risk_factors,
                    mitigation_suggestions = :mitigation_suggestions,
                    calculation_date = NOW(),
                    updated_at = NOW()
            """

            params = {
                "component_id": risk_score.component_id,
                "org_id": organization_id,
                "lifecycle_risk": risk_score.lifecycle_risk,
                "supply_chain_risk": risk_score.supply_chain_risk,
                "compliance_risk": risk_score.compliance_risk,
                "obsolescence_risk": risk_score.obsolescence_risk,
                "single_source_risk": risk_score.single_source_risk,
                "total_risk_score": risk_score.total_risk_score,
                "risk_level": risk_score.risk_level,
                "risk_factors": json.dumps(risk_score.risk_factors) if risk_score.risk_factors else None,
                "mitigation_suggestions": risk_score.mitigation_suggestions,
            }

            db.execute(text(upsert_sql), params)

            # Insert history record if score changed
            if prev_score is None or prev_score != risk_score.total_risk_score:
                history_sql = """
                    INSERT INTO risk_score_history (
                        component_id, organization_id,
                        total_risk_score, risk_level, score_change,
                        lifecycle_risk, supply_chain_risk, compliance_risk,
                        obsolescence_risk, single_source_risk,
                        recorded_date
                    ) VALUES (
                        :component_id, :org_id,
                        :total_risk_score, :risk_level, :score_change,
                        :lifecycle_risk, :supply_chain_risk, :compliance_risk,
                        :obsolescence_risk, :single_source_risk,
                        NOW()
                    )
                """

                score_change = risk_score.total_risk_score - (prev_score or 0)
                history_params = {
                    "component_id": risk_score.component_id,
                    "org_id": organization_id,
                    "total_risk_score": risk_score.total_risk_score,
                    "risk_level": risk_score.risk_level,
                    "score_change": score_change,
                    "lifecycle_risk": risk_score.lifecycle_risk,
                    "supply_chain_risk": risk_score.supply_chain_risk,
                    "compliance_risk": risk_score.compliance_risk,
                    "obsolescence_risk": risk_score.obsolescence_risk,
                    "single_source_risk": risk_score.single_source_risk,
                }

                db.execute(text(history_sql), history_params)

            db.commit()

        except Exception as e:
            logger.error(f"[RiskCalculator] Error storing risk score: {e}", exc_info=True)
            db.rollback()
            raise

    def _publish_risk_event(self, risk_score: ComponentRiskScore, organization_id: str):
        """
        Publish risk.calculated event to RabbitMQ for downstream processing.

        This event is consumed by:
        - Risk cache consumer (populates Redis read model)
        - Alert service (for threshold notifications)

        Args:
            risk_score: Calculated risk score
            organization_id: Organization ID
        """
        try:
            publisher = get_risk_event_publisher()

            event = RiskCalculatedEvent(
                component_id=risk_score.component_id,
                organization_id=organization_id,
                mpn=risk_score.mpn,
                manufacturer=risk_score.manufacturer,
                total_risk_score=risk_score.total_risk_score,
                risk_level=risk_score.risk_level,
                lifecycle_risk=risk_score.lifecycle_risk,
                supply_chain_risk=risk_score.supply_chain_risk,
                compliance_risk=risk_score.compliance_risk,
                obsolescence_risk=risk_score.obsolescence_risk,
                single_source_risk=risk_score.single_source_risk,
                calculated_at=risk_score.calculated_at.isoformat() if risk_score.calculated_at else datetime.utcnow().isoformat(),
            )

            publisher.publish(event)

        except Exception as e:
            # Don't fail the main operation if event publishing fails
            logger.warning(f"[RiskCalculator] Failed to publish risk event: {e}")
