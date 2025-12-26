"""
Alert Service

Manages alert creation, delivery, and preference checking.
Supports automatic alerts triggered by:
- Risk score threshold crossings
- Lifecycle status changes
- Compliance status changes
- Stock/availability issues
- Price changes

Alert Types:
- LIFECYCLE: Component lifecycle status changes
- RISK: Risk score threshold exceeded
- PRICE: Price changes beyond threshold
- AVAILABILITY: Stock/availability issues
- COMPLIANCE: Compliance status changes
- PCN: Product Change Notifications

Delivery Methods:
- In-app: Instant delivery via Novu (if configured) or database
- Email: Via Novu workflows or SMTP fallback
- Webhook: Via Novu or direct HTTP delivery
"""

import logging
from datetime import datetime
from typing import Any, Dict, List, Optional
from dataclasses import dataclass
from enum import Enum

from sqlalchemy import text

from app.models.dual_database import get_dual_database
from app.config import get_settings

logger = logging.getLogger(__name__)

# Novu integration imports - optional
try:
    from shared.notification.config import NotificationConfig
    from shared.notification.providers import get_notification_provider
    from shared.notification.workflows import get_workflow, is_critical_alert
    from shared.notification.publisher import NotificationPublisher, NotificationEvent
    NOVU_AVAILABLE = True
except ImportError:
    NOVU_AVAILABLE = False
    logger.info("[AlertService] Novu integration not available - using database-only delivery")


class AlertType(str, Enum):
    LIFECYCLE = "LIFECYCLE"
    RISK = "RISK"
    PRICE = "PRICE"
    AVAILABILITY = "AVAILABILITY"
    COMPLIANCE = "COMPLIANCE"
    PCN = "PCN"
    SUPPLY_CHAIN = "SUPPLY_CHAIN"


class AlertSeverity(str, Enum):
    CRITICAL = "CRITICAL"
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"
    INFO = "INFO"


# Default alert configurations
ALERT_TYPE_CONFIG = {
    AlertType.LIFECYCLE: {
        'description': 'Component lifecycle status changes',
        'triggers': ['NRND', 'EOL', 'OBSOLETE'],
        'default_enabled': True,
        'default_severity_map': {
            'OBSOLETE': AlertSeverity.CRITICAL,
            'EOL': AlertSeverity.HIGH,
            'NRND': AlertSeverity.MEDIUM,
        }
    },
    AlertType.RISK: {
        'description': 'Risk score threshold exceeded',
        'triggers': {'min_score': 60},
        'default_enabled': True,
        'default_severity_map': {
            'critical': AlertSeverity.CRITICAL,
            'high': AlertSeverity.HIGH,
            'medium': AlertSeverity.MEDIUM,
        }
    },
    AlertType.PRICE: {
        'description': 'Price changes beyond threshold',
        'triggers': {'change_percent': 10},
        'default_enabled': False,
    },
    AlertType.AVAILABILITY: {
        'description': 'Stock/availability issues',
        'triggers': {'min_stock': 100, 'max_lead_time_days': 84},
        'default_enabled': True,
    },
    AlertType.COMPLIANCE: {
        'description': 'Compliance status changes',
        'triggers': ['rohs_change', 'reach_change'],
        'default_enabled': True,
    },
    AlertType.PCN: {
        'description': 'Product Change Notifications',
        'triggers': ['manufacturer_pcn'],
        'default_enabled': True,
    },
    AlertType.SUPPLY_CHAIN: {
        'description': 'Supply chain issues (scarcity, single-source, supplier diversity)',
        'triggers': {
            'min_suppliers': 2,           # Alert if less than 2 suppliers
            'scarcity_stock_threshold': 500,  # Scarcity if global stock < 500
            'lead_time_increase_percent': 50,  # Alert on 50%+ lead time increase
        },
        'default_enabled': True,
        'default_severity_map': {
            'single_source': AlertSeverity.HIGH,
            'scarcity': AlertSeverity.CRITICAL,
            'lead_time_spike': AlertSeverity.MEDIUM,
        }
    }
}


@dataclass
class Alert:
    """Alert record"""
    id: Optional[str] = None
    organization_id: str = ""
    user_id: Optional[str] = None
    severity: str = "MEDIUM"
    alert_type: str = "RISK"
    title: str = ""
    message: str = ""
    component_id: Optional[str] = None
    context: Optional[Dict[str, Any]] = None
    action_url: Optional[str] = None
    is_read: bool = False
    created_at: Optional[datetime] = None


class AlertService:
    """
    Manages alert creation, delivery, and preferences.

    Supports Novu integration for multi-channel notifications when configured.
    Falls back to database-only delivery when Novu is not available.
    """

    def __init__(self):
        self.config = ALERT_TYPE_CONFIG
        self._init_novu()

    async def _get_user_thresholds(
        self,
        organization_id: str,
        alert_type: str,
    ) -> Dict[str, Any]:
        """
        Get user-configured thresholds for an alert type.

        Falls back to default thresholds if user hasn't configured custom values.
        """
        try:
            db = next(get_dual_database().get_session("supabase"))

            # Get threshold config from any user in the org with this preference
            # (Organization-level threshold settings)
            sql = """
                SELECT threshold_config
                FROM alert_preferences
                WHERE organization_id = :org_id
                AND alert_type = :alert_type
                AND threshold_config IS NOT NULL
                LIMIT 1
            """
            row = db.execute(text(sql), {
                "org_id": organization_id,
                "alert_type": alert_type
            }).fetchone()

            if row and row._mapping.get("threshold_config"):
                return row._mapping["threshold_config"]

        except Exception as e:
            logger.warning(f"[AlertService] Error getting user thresholds: {e}")

        # Return default thresholds from config
        config = self.config.get(AlertType(alert_type), {})
        triggers = config.get('triggers', {})
        if isinstance(triggers, dict):
            return triggers
        return {}

    def _init_novu(self):
        """Initialize Novu provider if available and configured."""
        self.novu_provider = None
        self.novu_publisher = None
        self.novu_enabled = False

        if not NOVU_AVAILABLE:
            logger.info("[AlertService] Novu not available")
            return

        try:
            settings = get_settings()
            provider_name = getattr(settings, 'notification_provider', 'none')

            if provider_name == 'none':
                logger.info("[AlertService] Novu disabled via config")
                return

            novu_config = NotificationConfig.from_env()

            if novu_config.is_configured:
                self.novu_provider = get_notification_provider(novu_config)
                self.novu_publisher = NotificationPublisher(
                    host=novu_config.rabbitmq_host,
                    port=novu_config.rabbitmq_port,
                    username=novu_config.rabbitmq_user,
                    password=novu_config.rabbitmq_password,
                )
                self.novu_enabled = True
                logger.info(f"[AlertService] Novu enabled with provider: {self.novu_provider.provider_name}")
            else:
                logger.info("[AlertService] Novu not configured (missing API key)")

        except Exception as e:
            logger.warning(f"[AlertService] Failed to initialize Novu: {e}")

    async def create_alert(
        self,
        organization_id: str,
        alert_type: str,
        severity: str,
        title: str,
        message: str,
        component_id: Optional[str] = None,
        context: Optional[Dict[str, Any]] = None,
        action_url: Optional[str] = None,
    ) -> Alert:
        """
        Create a new alert and queue for delivery.

        Args:
            organization_id: Organization to alert
            alert_type: Type of alert (LIFECYCLE, RISK, etc.)
            severity: Severity level (CRITICAL, HIGH, MEDIUM, LOW, INFO)
            title: Alert title
            message: Alert message
            component_id: Related component (optional)
            context: Additional context data
            action_url: URL for action button

        Returns:
            Created Alert object
        """
        try:
            db = next(get_dual_database().get_session("supabase"))

            # Get all users who should receive this alert
            watchers = await self._get_alert_recipients(
                db, organization_id, alert_type, component_id
            )

            created_alerts = []

            for user_id in watchers:
                # Check user preferences
                if not await self._should_send_alert(db, user_id, organization_id, alert_type, context):
                    logger.debug(f"[AlertService] Skipping alert for user {user_id} - preferences filtered")
                    continue

                # Check for duplicate alerts (same type, component, user within 24h)
                if component_id:
                    dedup_sql = """
                        SELECT id FROM alerts
                        WHERE user_id = :user_id
                        AND alert_type = :alert_type
                        AND component_id = :component_id
                        AND deleted_at IS NULL
                        AND created_at > NOW() - INTERVAL '24 hours'
                        LIMIT 1
                    """
                    dedup_params = {
                        "user_id": user_id,
                        "alert_type": alert_type,
                        "component_id": component_id,
                    }
                    existing = db.execute(text(dedup_sql), dedup_params).fetchone()
                    if existing:
                        logger.info(
                            f"[AlertService] Skipping duplicate alert: type={alert_type}, "
                            f"component={component_id}, user={user_id} (existing: {existing._mapping['id']})"
                        )
                        continue

                # Create alert for user
                import json

                logger.debug(f"[AlertService] Creating alert: type={alert_type}, user={user_id}, severity={severity}")

                sql = """
                    INSERT INTO alerts (
                        organization_id, user_id, severity, alert_type,
                        title, message, component_id, context, action_url,
                        is_read, created_at
                    ) VALUES (
                        :org_id, :user_id, :severity, :alert_type,
                        :title, :message, :component_id, :context, :action_url,
                        FALSE, NOW()
                    )
                    RETURNING id, created_at
                """

                params = {
                    "org_id": organization_id,
                    "user_id": user_id,
                    "severity": severity,
                    "alert_type": alert_type,
                    "title": title,
                    "message": message,
                    "component_id": component_id,
                    "context": json.dumps(context) if context else None,
                    "action_url": action_url,
                }

                row = db.execute(text(sql), params).fetchone()

                if row:
                    m = row._mapping
                    alert = Alert(
                        id=str(m["id"]),
                        organization_id=organization_id,
                        user_id=user_id,
                        severity=severity,
                        alert_type=alert_type,
                        title=title,
                        message=message,
                        component_id=component_id,
                        context=context,
                        action_url=action_url,
                        created_at=m["created_at"],
                    )
                    created_alerts.append(alert)

                    # Queue delivery based on preferences (includes Novu if configured)
                    await self._queue_delivery(
                        db, str(m["id"]), user_id, organization_id,
                        alert_type, title, message, context
                    )

            db.commit()

            logger.info(f"[AlertService] Created {len(created_alerts)} alerts for {alert_type}")

            # Return first alert if any created
            return created_alerts[0] if created_alerts else Alert(
                organization_id=organization_id,
                alert_type=alert_type,
                severity=severity,
                title=title,
                message=message,
            )

        except Exception as e:
            logger.error(f"[AlertService] Error creating alert: {e}", exc_info=True)
            raise

    async def check_risk_threshold(
        self,
        component_id: str,
        organization_id: str,
        old_score: int,
        new_score: int,
        risk_level: str,
        component_mpn: Optional[str] = None,
    ):
        """
        Create alert if risk score crosses threshold.

        Uses user-configured thresholds from alert_preferences.threshold_config:
        - risk_min: Minimum score to trigger alert (default: 60)
        - critical_threshold: Score for critical severity (default: 85)
        """
        try:
            # Get user-configured thresholds
            thresholds = await self._get_user_thresholds(organization_id, AlertType.RISK.value)
            high_threshold = thresholds.get('risk_min', 60)
            critical_threshold = thresholds.get('critical_threshold', 85)

            # Determine if threshold crossed
            crossed_high = old_score < high_threshold and new_score >= high_threshold
            crossed_critical = old_score < critical_threshold and new_score >= critical_threshold

            if not (crossed_high or crossed_critical):
                return None  # No threshold crossed

            severity = AlertSeverity.CRITICAL if crossed_critical else AlertSeverity.HIGH
            threshold_name = "critical" if crossed_critical else "high"
            threshold_value = critical_threshold if crossed_critical else high_threshold

            title = f"Risk Alert: {component_mpn or component_id}"
            message = f"Component risk score increased from {old_score} to {new_score} ({risk_level} risk, threshold: {threshold_value})"

            if crossed_critical:
                message += ". IMMEDIATE ATTENTION REQUIRED."

            context = {
                "old_score": old_score,
                "new_score": new_score,
                "risk_level": risk_level,
                "threshold_crossed": threshold_name,
                "thresholds_used": {
                    "risk_min": high_threshold,
                    "critical_threshold": critical_threshold,
                }
            }

            alert = await self.create_alert(
                organization_id=organization_id,
                alert_type=AlertType.RISK.value,
                severity=severity.value,
                title=title,
                message=message,
                component_id=component_id,
                context=context,
                action_url=f"/components/{component_id}/risk",
            )

            logger.info(f"[AlertService] Risk threshold alert created for {component_id}")
            return alert

        except Exception as e:
            logger.error(f"[AlertService] Error checking risk threshold: {e}", exc_info=True)
            return None

    async def check_lifecycle_change(
        self,
        component_id: str,
        organization_id: str,
        old_status: str,
        new_status: str,
        component_mpn: Optional[str] = None,
    ):
        """
        Create alert on lifecycle status change to NRND, EOL, or OBSOLETE.
        """
        try:
            # Only alert on concerning status changes
            alert_statuses = ['NRND', 'EOL', 'OBSOLETE']
            new_status_upper = new_status.upper() if new_status else ''

            if new_status_upper not in alert_statuses:
                return  # Not a concerning change

            # Determine severity
            severity_map = {
                'OBSOLETE': AlertSeverity.CRITICAL,
                'EOL': AlertSeverity.HIGH,
                'NRND': AlertSeverity.MEDIUM,
            }
            severity = severity_map.get(new_status_upper, AlertSeverity.MEDIUM)

            title = f"Lifecycle Alert: {component_mpn or component_id}"
            message_map = {
                'OBSOLETE': f"Component is now OBSOLETE. No longer manufactured.",
                'EOL': f"Component marked End of Life (EOL). Limited availability expected.",
                'NRND': f"Component marked Not Recommended for New Designs (NRND).",
            }
            message = message_map.get(new_status_upper, f"Lifecycle status changed to {new_status}")

            if old_status:
                message += f" (was: {old_status})"

            context = {
                "old_status": old_status,
                "new_status": new_status,
            }

            alert = await self.create_alert(
                organization_id=organization_id,
                alert_type=AlertType.LIFECYCLE.value,
                severity=severity.value,
                title=title,
                message=message,
                component_id=component_id,
                context=context,
                action_url=f"/components/{component_id}",
            )

            logger.info(f"[AlertService] Lifecycle alert created for {component_id}: {new_status}")
            return alert

        except Exception as e:
            logger.error(f"[AlertService] Error checking lifecycle change: {e}", exc_info=True)
            return None

    async def check_compliance_change(
        self,
        component_id: str,
        organization_id: str,
        compliance_type: str,  # 'rohs' or 'reach'
        old_status: Any,
        new_status: Any,
        component_mpn: Optional[str] = None,
    ):
        """
        Create alert on compliance status change to non-compliant.
        """
        try:
            # Only alert if becoming non-compliant
            if new_status not in (False, 'NON_COMPLIANT', 'Non-Compliant'):
                return

            severity = AlertSeverity.HIGH
            compliance_name = compliance_type.upper()

            title = f"Compliance Alert: {component_mpn or component_id}"
            message = f"Component is now marked as {compliance_name} non-compliant."

            context = {
                "compliance_type": compliance_type,
                "old_status": str(old_status),
                "new_status": str(new_status),
            }

            alert = await self.create_alert(
                organization_id=organization_id,
                alert_type=AlertType.COMPLIANCE.value,
                severity=severity.value,
                title=title,
                message=message,
                component_id=component_id,
                context=context,
                action_url=f"/components/{component_id}",
            )

            logger.info(f"[AlertService] Compliance alert created for {component_id}: {compliance_type}")

        except Exception as e:
            logger.error(f"[AlertService] Error checking compliance change: {e}", exc_info=True)

    async def check_availability_issue(
        self,
        component_id: str,
        organization_id: str,
        stock_quantity: Optional[int],
        lead_time_days: Optional[int],
        component_mpn: Optional[str] = None,
    ):
        """
        Create alert on stock or availability issues.

        Uses user-configured thresholds from alert_preferences.threshold_config:
        - min_stock: Minimum stock level (default: 100)
        - max_lead_time_days: Maximum lead time in days (default: 84)
        - alert_on_zero_stock: Always alert on zero stock (default: true)
        """
        try:
            # Get user-configured thresholds
            thresholds = await self._get_user_thresholds(organization_id, AlertType.AVAILABILITY.value)
            min_stock = thresholds.get('min_stock', 100)
            max_lead_time = thresholds.get('max_lead_time_days', 84)
            alert_on_zero = thresholds.get('alert_on_zero_stock', True)

            issues = []

            # Check stock
            if stock_quantity is not None:
                if stock_quantity == 0 and alert_on_zero:
                    issues.append("NO STOCK AVAILABLE")
                elif stock_quantity < min_stock and stock_quantity > 0:
                    issues.append(f"Low stock: {stock_quantity} units (threshold: {min_stock})")

            # Check lead time
            if lead_time_days is not None and lead_time_days > max_lead_time:
                issues.append(f"Extended lead time: {lead_time_days} days (threshold: {max_lead_time})")

            if not issues:
                return None  # No availability issues

            severity = AlertSeverity.HIGH if stock_quantity == 0 else AlertSeverity.MEDIUM

            title = f"Availability Alert: {component_mpn or component_id}"
            message = "; ".join(issues)

            context = {
                "stock_quantity": stock_quantity,
                "lead_time_days": lead_time_days,
                "issues": issues,
                "thresholds_used": {
                    "min_stock": min_stock,
                    "max_lead_time_days": max_lead_time,
                }
            }

            alert = await self.create_alert(
                organization_id=organization_id,
                alert_type=AlertType.AVAILABILITY.value,
                severity=severity.value,
                title=title,
                message=message,
                component_id=component_id,
                context=context,
                action_url=f"/components/{component_id}",
            )

            logger.info(f"[AlertService] Availability alert created for {component_id}")
            return alert

        except Exception as e:
            logger.error(f"[AlertService] Error checking availability: {e}", exc_info=True)
            return None

    async def check_price_change(
        self,
        component_id: str,
        organization_id: str,
        new_price_breaks: List[Dict[str, Any]],
        component_mpn: Optional[str] = None,
    ) -> Optional[Alert]:
        """
        Create alert when price changes significantly.

        Uses user-configured thresholds from alert_preferences.threshold_config:
        - increase_percent: Price increase threshold (default: 10%)
        - decrease_percent: Price decrease threshold for EOL warning (default: 20%)
        """
        try:
            if not new_price_breaks:
                return None

            # Get user-configured thresholds
            thresholds = await self._get_user_thresholds(organization_id, AlertType.PRICE.value)
            increase_threshold = thresholds.get('increase_percent', 10)
            decrease_threshold = thresholds.get('decrease_percent', 20)

            # Get unit price (quantity=1 or lowest quantity tier)
            new_unit_price = None
            for pb in sorted(new_price_breaks, key=lambda x: x.get('quantity', 0)):
                if pb.get('price') is not None:
                    new_unit_price = float(pb['price'])
                    break

            if new_unit_price is None:
                return None

            # Get previous price from database
            db = next(get_dual_database().get_session("supabase"))
            sql = """
                SELECT last_unit_price, price_updated_at
                FROM component_price_history
                WHERE component_id = :component_id
                ORDER BY price_updated_at DESC
                LIMIT 1
            """
            row = db.execute(text(sql), {"component_id": component_id}).fetchone()

            if not row:
                # No price history - store current and skip alert
                await self._store_price_history(db, component_id, new_unit_price, new_price_breaks)
                return None

            old_price = float(row._mapping["last_unit_price"])

            if old_price == 0:
                # Can't calculate percentage change from zero
                await self._store_price_history(db, component_id, new_unit_price, new_price_breaks)
                return None

            # Calculate percentage change
            change_percent = ((new_unit_price - old_price) / old_price) * 100

            # Check for significant changes using user thresholds
            issues = []
            severity = AlertSeverity.MEDIUM

            if change_percent >= increase_threshold:
                issues.append(f"Price increased by {change_percent:.1f}% (threshold: {increase_threshold}%)")
                if change_percent >= 25:
                    severity = AlertSeverity.HIGH
            elif change_percent <= -decrease_threshold:
                issues.append(f"Price dropped by {abs(change_percent):.1f}% (possible EOL clearance)")
                severity = AlertSeverity.MEDIUM

            if not issues:
                # Update price history without alerting
                await self._store_price_history(db, component_id, new_unit_price, new_price_breaks)
                return None

            title = f"Price Alert: {component_mpn or component_id}"
            message = f"Unit price changed from ${old_price:.4f} to ${new_unit_price:.4f}. {'; '.join(issues)}"

            context = {
                "old_price": old_price,
                "new_price": new_unit_price,
                "change_percent": round(change_percent, 2),
                "price_breaks": new_price_breaks,
            }

            alert = await self.create_alert(
                organization_id=organization_id,
                alert_type=AlertType.PRICE.value,
                severity=severity.value,
                title=title,
                message=message,
                component_id=component_id,
                context=context,
                action_url=f"/components/{component_id}",
            )

            # Update price history
            await self._store_price_history(db, component_id, new_unit_price, new_price_breaks)

            logger.info(f"[AlertService] Price alert created for {component_id}: {change_percent:.1f}%")
            return alert

        except Exception as e:
            logger.error(f"[AlertService] Error checking price change: {e}", exc_info=True)
            return None

    async def _store_price_history(
        self,
        db,
        component_id: str,
        unit_price: float,
        price_breaks: List[Dict[str, Any]],
    ):
        """Store price in history table for future comparisons."""
        try:
            import json
            sql = """
                INSERT INTO component_price_history (
                    component_id, last_unit_price, price_breaks, price_updated_at
                ) VALUES (
                    :component_id, :unit_price, :price_breaks, NOW()
                )
                ON CONFLICT (component_id) DO UPDATE SET
                    last_unit_price = EXCLUDED.last_unit_price,
                    price_breaks = EXCLUDED.price_breaks,
                    price_updated_at = NOW()
            """
            db.execute(text(sql), {
                "component_id": component_id,
                "unit_price": unit_price,
                "price_breaks": json.dumps(price_breaks),
            })
            db.commit()
        except Exception as e:
            logger.warning(f"[AlertService] Error storing price history: {e}")

    async def check_supply_chain_issue(
        self,
        component_id: str,
        organization_id: str,
        enrichment_data: Dict[str, Any],
        component_mpn: Optional[str] = None,
    ) -> Optional[Alert]:
        """
        Check for supply chain issues and create alerts.

        Uses user-configured thresholds from alert_preferences.threshold_config:
        - min_suppliers: Minimum supplier count (default: 2)
        - scarcity_stock_threshold: Scarcity stock level (default: 500)
        - extended_lead_time_days: Extended lead time threshold (default: 120)
        - alert_on_single_source: Alert on single source (default: true)
        """
        try:
            # Get user-configured thresholds
            thresholds = await self._get_user_thresholds(organization_id, AlertType.SUPPLY_CHAIN.value)
            min_suppliers = thresholds.get('min_suppliers', 2)
            scarcity_threshold = thresholds.get('scarcity_stock_threshold', 500)
            extended_lead_time = thresholds.get('extended_lead_time_days', 120)
            alert_on_single_source = thresholds.get('alert_on_single_source', True)

            issues = []
            severity = AlertSeverity.MEDIUM

            # Check supplier count
            supplier_count = enrichment_data.get('supplier_count', 1)
            suppliers_available = enrichment_data.get('suppliers_available', [])

            if isinstance(suppliers_available, list):
                supplier_count = len(suppliers_available)
            elif isinstance(suppliers_available, int):
                supplier_count = suppliers_available

            # Single-source risk
            if supplier_count < min_suppliers and alert_on_single_source:
                if supplier_count == 1:
                    issues.append(f"SINGLE SOURCE: Only 1 supplier available (threshold: {min_suppliers})")
                    severity = AlertSeverity.HIGH
                elif supplier_count == 0:
                    issues.append("NO SUPPLIERS: Component not available from any supplier")
                    severity = AlertSeverity.CRITICAL

            # Check global stock (scarcity)
            stock_quantity = enrichment_data.get('stock_quantity', 0) or 0
            if stock_quantity < scarcity_threshold:
                if stock_quantity == 0:
                    issues.append(f"SCARCITY: Zero stock available globally")
                    severity = AlertSeverity.CRITICAL
                elif stock_quantity < 100:
                    issues.append(f"SCARCITY: Only {stock_quantity} units available globally")
                    severity = AlertSeverity.HIGH
                else:
                    issues.append(f"LOW SUPPLY: Only {stock_quantity} units (threshold: {scarcity_threshold})")

            # Check for extended lead time (supply chain stress indicator)
            lead_time_days = enrichment_data.get('lead_time_days')
            if lead_time_days and lead_time_days > extended_lead_time:
                issues.append(f"EXTENDED LEAD TIME: {lead_time_days} days (threshold: {extended_lead_time})")
                if lead_time_days > 180:  # > 6 months
                    severity = AlertSeverity.HIGH

            # Check for manufacturer concentration (all from same source)
            manufacturer = enrichment_data.get('manufacturer', '')
            if manufacturer and supplier_count == 1:
                issues.append(f"Single manufacturer ({manufacturer}) with single supplier")

            if not issues:
                return None

            title = f"Supply Chain Alert: {component_mpn or component_id}"
            message = "; ".join(issues)

            context = {
                "supplier_count": supplier_count,
                "suppliers_available": suppliers_available if isinstance(suppliers_available, list) else [],
                "stock_quantity": stock_quantity,
                "lead_time_days": lead_time_days,
                "manufacturer": manufacturer,
                "issues": issues,
                "thresholds_used": {
                    "min_suppliers": min_suppliers,
                    "scarcity_stock_threshold": scarcity_threshold,
                    "extended_lead_time_days": extended_lead_time,
                }
            }

            alert = await self.create_alert(
                organization_id=organization_id,
                alert_type=AlertType.SUPPLY_CHAIN.value,
                severity=severity.value,
                title=title,
                message=message,
                component_id=component_id,
                context=context,
                action_url=f"/components/{component_id}/supply-chain",
            )

            logger.info(f"[AlertService] Supply chain alert created for {component_id}")
            return alert

        except Exception as e:
            logger.error(f"[AlertService] Error checking supply chain: {e}", exc_info=True)
            return None

    async def _get_alert_recipients(
        self,
        db,
        organization_id: str,
        alert_type: str,
        component_id: Optional[str] = None,
    ) -> List[str]:
        """Get list of user IDs who should receive this alert."""
        user_ids = set()

        # Get users with this alert type enabled
        pref_sql = """
            SELECT DISTINCT user_id
            FROM alert_preferences
            WHERE organization_id = :org_id
            AND alert_type = :alert_type
            AND is_enabled = TRUE
            AND in_app_enabled = TRUE
        """
        pref_rows = db.execute(text(pref_sql), {
            "org_id": organization_id,
            "alert_type": alert_type
        }).fetchall()

        for row in pref_rows:
            user_ids.add(row._mapping["user_id"])

        # If component-specific, also include component watchers
        if component_id:
            watch_column_map = {
                AlertType.LIFECYCLE.value: "watch_lifecycle",
                AlertType.RISK.value: "watch_risk",
                AlertType.PRICE.value: "watch_price",
                AlertType.AVAILABILITY.value: "watch_stock",
                AlertType.COMPLIANCE.value: "watch_compliance",
                AlertType.PCN.value: "watch_pcn",
                AlertType.SUPPLY_CHAIN.value: "watch_supply_chain",
            }
            watch_column = watch_column_map.get(alert_type, "watch_lifecycle")

            watch_sql = f"""
                SELECT DISTINCT user_id
                FROM component_watches
                WHERE component_id = :component_id
                AND {watch_column} = TRUE
            """
            watch_rows = db.execute(text(watch_sql), {"component_id": component_id}).fetchall()

            for row in watch_rows:
                user_ids.add(row._mapping["user_id"])

        # If no specific preferences found, get all org members (default behavior)
        if not user_ids:
            member_sql = """
                SELECT DISTINCT user_id
                FROM organization_memberships
                WHERE organization_id = :org_id
            """
            member_rows = db.execute(text(member_sql), {"org_id": organization_id}).fetchall()

            for row in member_rows:
                user_ids.add(row._mapping["user_id"])

        return list(user_ids)

    async def _should_send_alert(
        self,
        db,
        user_id: str,
        organization_id: str,
        alert_type: str,
        context: Optional[Dict[str, Any]] = None,
    ) -> bool:
        """Check if alert should be sent based on user preferences."""
        try:
            # Get user preference for this alert type
            sql = """
                SELECT is_enabled as is_active, in_app_enabled, threshold_config
                FROM alert_preferences
                WHERE user_id = :user_id
                AND organization_id = :org_id
                AND alert_type = :alert_type
            """
            row = db.execute(text(sql), {
                "user_id": user_id,
                "org_id": organization_id,
                "alert_type": alert_type
            }).fetchone()

            if not row:
                # No preference set - use defaults
                config = self.config.get(AlertType(alert_type), {})
                return config.get('default_enabled', True)

            m = row._mapping

            if not m["is_active"] or not m["in_app_enabled"]:
                return False

            # Check threshold config if context provided
            threshold_config = m.get("threshold_config")
            if threshold_config and context:
                # For risk alerts, check min_score threshold
                if alert_type == AlertType.RISK.value:
                    min_score = threshold_config.get('risk_min', 60)
                    new_score = context.get('new_score', 0)
                    if new_score < min_score:
                        return False

            return True

        except Exception as e:
            logger.warning(f"[AlertService] Error checking preferences: {e}")
            return True  # Default to sending

    async def _queue_delivery(
        self,
        db,
        alert_id: str,
        user_id: str,
        organization_id: str,
        alert_type: str,
        title: str = "",
        message: str = "",
        context: Optional[Dict[str, Any]] = None,
    ):
        """
        Queue alert for delivery via configured channels.

        If Novu is enabled, triggers Novu workflow for multi-channel delivery.
        Otherwise falls back to database-based delivery queue.
        """
        try:
            # Try Novu delivery first if enabled
            if self.novu_enabled and NOVU_AVAILABLE:
                await self._deliver_via_novu(
                    alert_id=alert_id,
                    user_id=user_id,
                    alert_type=alert_type,
                    title=title,
                    message=message,
                    context=context,
                )
                return

            # Fallback to database-based delivery queue
            await self._queue_delivery_legacy(
                db=db,
                alert_id=alert_id,
                user_id=user_id,
                organization_id=organization_id,
                alert_type=alert_type,
            )

        except Exception as e:
            logger.warning(f"[AlertService] Error queuing delivery: {e}")
            # Don't raise - alert is already created

    async def _deliver_via_novu(
        self,
        alert_id: str,
        user_id: str,
        alert_type: str,
        title: str,
        message: str,
        context: Optional[Dict[str, Any]] = None,
    ):
        """
        Deliver alert via Novu notification service.

        Uses sync delivery for critical alerts, async (RabbitMQ) for non-critical.
        """
        try:
            workflow = get_workflow(alert_type)
            if not workflow:
                logger.warning(f"[AlertService] No Novu workflow for {alert_type}")
                return

            payload = {
                "alert_id": alert_id,
                "title": title,
                "message": message,
                "alert_type": alert_type,
                **(context or {}),
            }

            # Critical alerts: sync delivery via provider
            if is_critical_alert(alert_type):
                result = await self.novu_provider.send_notification(
                    subscriber_id=user_id,
                    workflow_id=workflow.workflow_id,
                    payload=payload,
                )
                if result.success:
                    logger.info(f"[AlertService] Novu sync delivery: {workflow.workflow_id} -> {user_id}")
                    # Record delivery with Novu transaction ID
                    await self._record_novu_delivery(
                        alert_id=alert_id,
                        user_id=user_id,
                        transaction_id=result.transaction_id,
                    )
                else:
                    logger.warning(f"[AlertService] Novu delivery failed: {result.error}")
            else:
                # Non-critical: async delivery via RabbitMQ
                event = NotificationEvent(
                    workflow_id=workflow.workflow_id,
                    subscriber_id=user_id,
                    payload=payload,
                )
                if self.novu_publisher.publish(event):
                    logger.info(f"[AlertService] Novu async queued: {workflow.workflow_id} -> {user_id}")
                else:
                    logger.warning("[AlertService] Failed to queue async notification")

        except Exception as e:
            logger.error(f"[AlertService] Novu delivery error: {e}", exc_info=True)

    async def _record_novu_delivery(
        self,
        alert_id: str,
        user_id: str,
        transaction_id: Optional[str],
    ):
        """Record Novu delivery in alert_deliveries table."""
        try:
            db = next(get_dual_database().get_session("supabase"))
            sql = """
                INSERT INTO alert_deliveries (
                    alert_id, delivery_method, recipient, status, delivered_at,
                    novu_transaction_id
                ) VALUES (
                    :alert_id, 'novu', :user_id, 'delivered', NOW(),
                    :transaction_id
                )
            """
            db.execute(text(sql), {
                "alert_id": alert_id,
                "user_id": user_id,
                "transaction_id": transaction_id,
            })
            db.commit()
        except Exception as e:
            logger.warning(f"[AlertService] Error recording Novu delivery: {e}")

    async def _queue_delivery_legacy(
        self,
        db,
        alert_id: str,
        user_id: str,
        organization_id: str,
        alert_type: str,
    ):
        """Legacy delivery queue (database-based) when Novu is not enabled."""
        try:
            # Get user preferences
            sql = """
                SELECT email_enabled, webhook_enabled, email_address, webhook_url
                FROM alert_preferences
                WHERE user_id = :user_id
                AND organization_id = :org_id
                AND alert_type = :alert_type
            """
            row = db.execute(text(sql), {
                "user_id": user_id,
                "org_id": organization_id,
                "alert_type": alert_type
            }).fetchone()

            # In-app delivery is always instant (alert already created)
            in_app_sql = """
                INSERT INTO alert_deliveries (
                    alert_id, delivery_method, recipient, status, delivered_at
                ) VALUES (
                    :alert_id, 'in_app', :user_id, 'delivered', NOW()
                )
            """
            db.execute(text(in_app_sql), {"alert_id": alert_id, "user_id": user_id})

            if row:
                m = row._mapping

                # Queue email delivery if enabled
                if m.get("email_enabled") and m.get("email_address"):
                    email_sql = """
                        INSERT INTO alert_deliveries (
                            alert_id, delivery_method, recipient, status
                        ) VALUES (
                            :alert_id, 'email', :email, 'pending'
                        )
                    """
                    db.execute(text(email_sql), {
                        "alert_id": alert_id,
                        "email": m["email_address"]
                    })

                # Queue webhook delivery if enabled
                if m.get("webhook_enabled") and m.get("webhook_url"):
                    webhook_sql = """
                        INSERT INTO alert_deliveries (
                            alert_id, delivery_method, recipient, status
                        ) VALUES (
                            :alert_id, 'webhook', :webhook_url, 'pending'
                        )
                    """
                    db.execute(text(webhook_sql), {
                        "alert_id": alert_id,
                        "webhook_url": m["webhook_url"]
                    })

        except Exception as e:
            logger.warning(f"[AlertService] Error in legacy delivery queue: {e}")
