"""
Risk Integration Service

Integrates risk calculation and alert generation into the BOM enrichment workflow.
This module provides non-blocking risk processing that runs after component enrichment.
"""

import logging
import asyncio
from typing import Optional, Dict, Any
from datetime import datetime

logger = logging.getLogger(__name__)


async def process_component_risk(
    component_id: str,
    organization_id: str,
    enrichment_data: Dict[str, Any],
    mpn: str,
    manufacturer: Optional[str] = None,
    previous_lifecycle_status: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Process risk calculation and alert generation for a newly enriched component.

    This function is designed to be called asynchronously after enrichment completes.
    It will not raise exceptions - all errors are logged and handled gracefully.

    Args:
        component_id: UUID of the component in the catalog
        organization_id: Organization ID for tenant isolation
        enrichment_data: The enrichment data with lifecycle_status, parameters, etc.
        mpn: Manufacturer Part Number
        manufacturer: Manufacturer name
        previous_lifecycle_status: Previous lifecycle status (for change detection)

    Returns:
        Dict with risk calculation and alert results
    """
    result = {
        'risk_calculated': False,
        'alerts_generated': [],
        'errors': []
    }

    if not component_id:
        logger.debug(f"Skipping risk calculation - no component_id for {mpn}")
        return result

    try:
        # Import services here to avoid circular imports
        from app.services.risk_calculator import RiskCalculatorService
        from app.services.alert_service import AlertService

        risk_calculator = RiskCalculatorService()
        alert_service = AlertService()

        # ============================================================================
        # STEP 1: CALCULATE RISK SCORE
        # ============================================================================
        logger.info(f"Calculating risk score for component {mpn} (ID: {component_id})")

        try:
            risk_score = await risk_calculator.calculate_total_risk(
                component_id=component_id,
                organization_id=organization_id,
                force_recalculate=True  # Always recalculate after enrichment
            )

            result['risk_calculated'] = True
            result['risk_score'] = risk_score.total_risk_score if risk_score else None
            result['risk_level'] = risk_score.risk_level if risk_score else None

            logger.info(
                f"Risk calculated for {mpn}: score={risk_score.total_risk_score}, "
                f"level={risk_score.risk_level}"
            )

        except Exception as risk_error:
            logger.warning(f"Risk calculation failed for {mpn}: {risk_error}")
            result['errors'].append(f"risk_calculation: {str(risk_error)}")
            risk_score = None

        # ============================================================================
        # STEP 2: CHECK FOR LIFECYCLE STATUS CHANGE
        # ============================================================================
        current_lifecycle = enrichment_data.get('lifecycle_status')

        if current_lifecycle and previous_lifecycle_status:
            if current_lifecycle != previous_lifecycle_status:
                logger.info(
                    f"Lifecycle status changed for {mpn}: "
                    f"{previous_lifecycle_status} -> {current_lifecycle}"
                )

                try:
                    alert = await alert_service.check_lifecycle_change(
                        component_id=component_id,
                        organization_id=organization_id,
                        old_status=previous_lifecycle_status,
                        new_status=current_lifecycle,
                        component_mpn=mpn,
                    )

                    if alert:
                        result['alerts_generated'].append({
                            'type': 'LIFECYCLE',
                            'alert_id': alert.id,
                            'severity': alert.severity
                        })
                        logger.info(f"Generated lifecycle alert for {mpn}: {alert.id}")

                except Exception as lifecycle_error:
                    logger.warning(f"Lifecycle alert check failed for {mpn}: {lifecycle_error}")
                    result['errors'].append(f"lifecycle_alert: {str(lifecycle_error)}")

        # ============================================================================
        # STEP 3: CHECK RISK THRESHOLD ALERTS
        # ============================================================================
        if risk_score and risk_score.total_risk_score:
            try:
                # Alert if risk score is high (>= 61)
                if risk_score.total_risk_score >= 61:
                    alert = await alert_service.check_risk_threshold(
                        component_id=component_id,
                        organization_id=organization_id,
                        old_score=0,  # New component or re-enrichment
                        new_score=risk_score.total_risk_score,
                        risk_level=risk_score.risk_level,
                        component_mpn=mpn,
                    )

                    if alert:
                        result['alerts_generated'].append({
                            'type': 'RISK',
                            'alert_id': alert.id,
                            'severity': alert.severity
                        })
                        logger.info(f"Generated risk alert for {mpn}: {alert.id}")

            except Exception as risk_alert_error:
                logger.warning(f"Risk threshold alert check failed for {mpn}: {risk_alert_error}")
                result['errors'].append(f"risk_alert: {str(risk_alert_error)}")

        # ============================================================================
        # STEP 4: CHECK COMPLIANCE STATUS
        # ============================================================================
        rohs_status = enrichment_data.get('rohs_compliant')
        reach_status = enrichment_data.get('reach_compliant')

        # Alert if compliance is unknown or non-compliant
        if rohs_status is False or reach_status is False:
            try:
                compliance_issue = []
                if rohs_status is False:
                    compliance_issue.append('RoHS non-compliant')
                if reach_status is False:
                    compliance_issue.append('REACH non-compliant')

                alert = await alert_service.create_alert(
                    organization_id=organization_id,
                    alert_type='COMPLIANCE',
                    severity='warning',
                    title=f'Compliance Issue: {mpn}',
                    message=f'Component {mpn} has compliance issues: {", ".join(compliance_issue)}',
                    component_id=component_id,
                    context={
                        'mpn': mpn,
                        'manufacturer': manufacturer,
                        'rohs_compliant': rohs_status,
                        'reach_compliant': reach_status,
                        'issues': compliance_issue
                    }
                )

                if alert:
                    result['alerts_generated'].append({
                        'type': 'COMPLIANCE',
                        'alert_id': alert.id,
                        'severity': alert.severity
                    })
                    logger.info(f"Generated compliance alert for {mpn}: {alert.id}")

            except Exception as compliance_error:
                logger.warning(f"Compliance alert check failed for {mpn}: {compliance_error}")
                result['errors'].append(f"compliance_alert: {str(compliance_error)}")

        # ============================================================================
        # STEP 5: CHECK AVAILABILITY ISSUES (STOCK / LEAD TIME)
        # ============================================================================
        stock_quantity = enrichment_data.get('stock_quantity')
        lead_time_days = enrichment_data.get('lead_time_days')

        if stock_quantity is not None or lead_time_days is not None:
            try:
                alert = await alert_service.check_availability_issue(
                    component_id=component_id,
                    organization_id=organization_id,
                    stock_quantity=stock_quantity,
                    lead_time_days=lead_time_days,
                    component_mpn=mpn
                )

                if alert:
                    result['alerts_generated'].append({
                        'type': 'AVAILABILITY',
                        'alert_id': alert.id,
                        'severity': alert.severity
                    })
                    logger.info(f"Generated availability alert for {mpn}: {alert.id}")

            except Exception as availability_error:
                logger.warning(f"Availability alert check failed for {mpn}: {availability_error}")
                result['errors'].append(f"availability_alert: {str(availability_error)}")

        # ============================================================================
        # STEP 6: CHECK PRICE CHANGES
        # ============================================================================
        price_breaks = enrichment_data.get('price_breaks')
        if price_breaks:
            try:
                alert = await alert_service.check_price_change(
                    component_id=component_id,
                    organization_id=organization_id,
                    new_price_breaks=price_breaks,
                    component_mpn=mpn
                )

                if alert:
                    result['alerts_generated'].append({
                        'type': 'PRICE',
                        'alert_id': alert.id,
                        'severity': alert.severity
                    })
                    logger.info(f"Generated price alert for {mpn}: {alert.id}")

            except Exception as price_error:
                logger.warning(f"Price alert check failed for {mpn}: {price_error}")
                result['errors'].append(f"price_alert: {str(price_error)}")

        # ============================================================================
        # STEP 7: CHECK SUPPLY CHAIN ISSUES (SCARCITY / SINGLE SOURCE)
        # ============================================================================
        try:
            alert = await alert_service.check_supply_chain_issue(
                component_id=component_id,
                organization_id=organization_id,
                enrichment_data=enrichment_data,
                component_mpn=mpn
            )

            if alert:
                result['alerts_generated'].append({
                    'type': 'SUPPLY_CHAIN',
                    'alert_id': alert.id,
                    'severity': alert.severity
                })
                logger.info(f"Generated supply chain alert for {mpn}: {alert.id}")

        except Exception as supply_chain_error:
            logger.warning(f"Supply chain alert check failed for {mpn}: {supply_chain_error}")
            result['errors'].append(f"supply_chain_alert: {str(supply_chain_error)}")

        logger.info(
            f"Risk processing complete for {mpn}: "
            f"calculated={result['risk_calculated']}, "
            f"alerts={len(result['alerts_generated'])}"
        )

    except Exception as e:
        logger.error(f"Risk processing failed for {mpn}: {e}", exc_info=True)
        result['errors'].append(f"general: {str(e)}")

    return result


def schedule_risk_processing(
    component_id: str,
    organization_id: str,
    enrichment_data: Dict[str, Any],
    mpn: str,
    manufacturer: Optional[str] = None,
    previous_lifecycle_status: Optional[str] = None,
) -> None:
    """
    Schedule risk processing as a background task.

    This is a fire-and-forget function that won't block the calling code.
    Use this from synchronous contexts where you can't await.

    Args:
        component_id: UUID of the component in the catalog
        organization_id: Organization ID for tenant isolation
        enrichment_data: The enrichment data with lifecycle_status, parameters, etc.
        mpn: Manufacturer Part Number
        manufacturer: Manufacturer name
        previous_lifecycle_status: Previous lifecycle status (for change detection)
    """
    if not component_id:
        logger.debug(f"Skipping risk scheduling - no component_id for {mpn}")
        return

    try:
        # Get or create an event loop
        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            # No running loop, create one
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)

        # Schedule the coroutine
        asyncio.create_task(
            process_component_risk(
                component_id=component_id,
                organization_id=organization_id,
                enrichment_data=enrichment_data,
                component_mpn=mpn,
                manufacturer=manufacturer,
                previous_lifecycle_status=previous_lifecycle_status,
            )
        )

        logger.debug(f"Scheduled risk processing for {mpn}")

    except Exception as e:
        logger.warning(f"Failed to schedule risk processing for {mpn}: {e}")


async def process_batch_risk(
    components: list[Dict[str, Any]],
    organization_id: str,
) -> Dict[str, Any]:
    """
    Process risk for a batch of components in parallel.

    Args:
        components: List of dicts with component_id, enrichment_data, mpn, manufacturer
        organization_id: Organization ID for tenant isolation

    Returns:
        Summary of batch risk processing results
    """
    results = {
        'total': len(components),
        'risk_calculated': 0,
        'alerts_generated': 0,
        'errors': 0,
        'components': []
    }

    tasks = []
    for comp in components:
        task = process_component_risk(
            component_id=comp.get('component_id'),
            organization_id=organization_id,
            enrichment_data=comp.get('enrichment_data', {}),
            mpn=comp.get('mpn', ''),
            manufacturer=comp.get('manufacturer'),
            previous_lifecycle_status=comp.get('previous_lifecycle_status'),
        )
        tasks.append(task)

    # Process all components in parallel
    component_results = await asyncio.gather(*tasks, return_exceptions=True)

    for i, comp_result in enumerate(component_results):
        if isinstance(comp_result, Exception):
            results['errors'] += 1
            results['components'].append({
                'mpn': components[i].get('mpn'),
                'error': str(comp_result)
            })
        else:
            if comp_result.get('risk_calculated'):
                results['risk_calculated'] += 1
            results['alerts_generated'] += len(comp_result.get('alerts_generated', []))
            if comp_result.get('errors'):
                results['errors'] += 1
            results['components'].append({
                'mpn': components[i].get('mpn'),
                'risk_score': comp_result.get('risk_score'),
                'risk_level': comp_result.get('risk_level'),
                'alerts': comp_result.get('alerts_generated', [])
            })

    logger.info(
        f"Batch risk processing complete: {results['risk_calculated']}/{results['total']} calculated, "
        f"{results['alerts_generated']} alerts, {results['errors']} errors"
    )

    return results
