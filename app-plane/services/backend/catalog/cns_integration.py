"""
CNS Integration Module

Handles integration between Django backend and CNS (Component Normalization Service)
for BOM enrichment via Temporal workflows.
"""

import logging
import httpx
import os

logger = logging.getLogger(__name__)

# CNS Service Configuration
#
# CNS_API_URL can be provided either with or without the trailing
# "/api" segment. To make configuration more forgiving, we accept
# both forms and normalise to a single internal base that always
# includes "/api".
_raw_cns_url = os.getenv('CNS_API_URL', 'http://cns-service:27800/api').rstrip('/')

if _raw_cns_url.endswith('/api'):
    CNS_API_URL = _raw_cns_url
else:
    CNS_API_URL = f"{_raw_cns_url}/api"

CNS_TIMEOUT = int(os.getenv('CNS_TIMEOUT', '30'))


def trigger_bom_enrichment_workflow(bom_id: str, organization_id: str, total_items: int) -> str:
    """
    Trigger Temporal workflow for BOM enrichment via CNS Service

    Args:
        bom_id: UUID of the BOM to enrich
        tenant_id: UUID of the tenant
        total_items: Number of line items in the BOM

    Returns:
        workflow_id: Temporal workflow ID

    Raises:
        Exception: If workflow trigger fails
    """
    logger.info(f"[GATE: CNS Integration] Starting BOM enrichment trigger")
    logger.info(f"[GATE: CNS Integration]   BOM ID: {bom_id}")
    logger.info(f"[GATE: CNS Integration]   Tenant ID: {tenant_id}")
    logger.info(f"[GATE: CNS Integration]   Total Items: {total_items}")
    logger.info(f"[GATE: CNS Integration]   CNS API URL: {CNS_API_URL}")

    endpoint = f"{CNS_API_URL}/bom/workflow/start"

    payload = {
        "bom_id": bom_id,
        "organization_id": organization_id,
        "total_items": total_items,
        "source": "customer_portal"
    }

    try:
        logger.info(f"[GATE: CNS Integration] Sending POST request to {endpoint}")
        logger.info(f"[GATE: CNS Integration] Payload: {payload}")

        with httpx.Client(timeout=CNS_TIMEOUT) as client:
            response = client.post(endpoint, json=payload)

            logger.info(f"[GATE: CNS Integration] Response status: {response.status_code}")
            logger.info(f"[GATE: CNS Integration] Response body: {response.text[:500]}")

            response.raise_for_status()

            result = response.json()
            workflow_id = result.get('workflow_id')

            if not workflow_id:
                logger.error(f"[GATE: CNS Integration] ❌ No workflow_id in response: {result}")
                raise ValueError("CNS API did not return workflow_id")

            logger.info(f"[GATE: CNS Integration] ✅ Workflow triggered successfully")
            logger.info(f"[GATE: CNS Integration] ✅ Workflow ID: {workflow_id}")

            return workflow_id

    except httpx.HTTPStatusError as e:
        logger.error(f"[GATE: CNS Integration] ❌ HTTP error: {e.response.status_code}")
        logger.error(f"[GATE: CNS Integration] ❌ Response: {e.response.text}")
        raise Exception(f"CNS API returned {e.response.status_code}: {e.response.text}")

    except httpx.RequestError as e:
        logger.error(f"[GATE: CNS Integration] ❌ Request error: {str(e)}")
        logger.error(f"[GATE: CNS Integration] ❌ Could not connect to CNS at {CNS_API_URL}")
        raise Exception(f"Failed to connect to CNS Service: {str(e)}")

    except Exception as e:
        logger.error(f"[GATE: CNS Integration] ❌ Unexpected error: {str(e)}", exc_info=True)
        raise


def get_workflow_status(workflow_id: str) -> dict:
    """
    Get status of a Temporal workflow from CNS Service

    Args:
        workflow_id: Temporal workflow ID

    Returns:
        dict: Workflow status information
    """
    logger.info(f"[GATE: CNS Integration] Getting workflow status: {workflow_id}")

    endpoint = f"{CNS_API_URL}/bom/workflow/{workflow_id}/status"

    try:
        with httpx.Client(timeout=CNS_TIMEOUT) as client:
            response = client.get(endpoint)
            response.raise_for_status()

            status_data = response.json()
            logger.info(f"[GATE: CNS Integration] ✅ Workflow status retrieved: {status_data.get('status')}")

            return status_data

    except Exception as e:
        logger.error(f"[GATE: CNS Integration] ❌ Failed to get workflow status: {str(e)}")
        raise


def cancel_workflow(workflow_id: str) -> bool:
    """
    Cancel a running Temporal workflow via CNS Service

    Args:
        workflow_id: Temporal workflow ID

    Returns:
        bool: True if cancelled successfully
    """
    logger.info(f"[GATE: CNS Integration] Cancelling workflow: {workflow_id}")

    endpoint = f"{CNS_API_URL}/bom/workflow/{workflow_id}/cancel"

    try:
        with httpx.Client(timeout=CNS_TIMEOUT) as client:
            response = client.post(endpoint)
            response.raise_for_status()

            logger.info(f"[GATE: CNS Integration] ✅ Workflow cancelled: {workflow_id}")
            return True

    except Exception as e:
        logger.error(f"[GATE: CNS Integration] ❌ Failed to cancel workflow: {str(e)}")
        raise
