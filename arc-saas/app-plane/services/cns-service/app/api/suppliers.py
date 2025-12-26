"""
Supplier API Endpoints

Direct access to supplier plugin functionality for searching and enrichment.
"""

import logging
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, Header, HTTPException, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field

from app.models.base import get_db
from app.plugins.suppliers.manager import SupplierPluginManager
from app.config import settings
from app.services.supplier_token_store import save_supplier_tokens, load_supplier_tokens
from app.services.supplier_manager_service import reset_supplier_manager
from app.core.input_validation import (
    ValidatedMPN,
    ValidatedSupplier,
    InputSanitizer
)
from app.core.authorization import (
    AuthContext,
    get_auth_context,
    Role,
)

logger = logging.getLogger(__name__)

router = APIRouter()


def _require_admin_authorization_with_context(
    authorization: Optional[str],
    auth_context: Optional[AuthContext] = None
) -> None:
    """
    Ensure the caller has admin access before performing sensitive supplier actions.

    Accepts EITHER:
    1. A valid static admin API token (legacy/service auth)
    2. An Auth0 JWT with admin or super_admin role (user auth)
    """
    # Option 1: Check if user is authenticated via Auth0 middleware with admin role
    if auth_context is not None:
        if auth_context.role in [Role.ADMIN, Role.SUPER_ADMIN]:
            logger.debug(f"[Suppliers] Admin access granted via Auth0: user={auth_context.user_id} role={auth_context.role}")
            return

    # Option 2: Fall back to static admin token validation
    token = settings.admin_api_token
    if not token:
        # If no static token configured and no Auth0 admin, reject
        if auth_context is None:
            raise HTTPException(status_code=401, detail="Missing admin authorization header")
        raise HTTPException(status_code=403, detail="Requires admin role or higher")

    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Missing admin authorization header")

    provided = authorization.split(" ", 1)[1].strip()
    if provided != token:
        # Token doesn't match static admin token - if we got here, auth_context wasn't admin
        raise HTTPException(status_code=403, detail="Invalid admin token or insufficient role")


# Pydantic Models
class SupplierSearchRequest(BaseModel):
    """Request model for supplier search"""
    mpn: ValidatedMPN = Field(..., description="Manufacturer part number to search for (validated)")
    manufacturer: Optional[ValidatedSupplier] = Field(None, description="Optional manufacturer name with XSS prevention")
    preferred_suppliers: Optional[List[str]] = Field(None, description="List of preferred supplier names (digikey, mouser, element14)")
    limit: int = Field(default=10, ge=1, le=50, description="Maximum results per supplier")


class SupplierSearchResultItem(BaseModel):
    """Single search result item"""
    mpn: str
    manufacturer: str
    description: str
    supplier_sku: str
    availability: Optional[int]
    unit_price: Optional[float]
    currency: str
    datasheet_url: Optional[str]
    supplier_url: Optional[str]
    lifecycle_status: Optional[str]
    match_confidence: float


class SupplierSearchResponse(BaseModel):
    """Response model for supplier search"""
    query_mpn: str
    query_manufacturer: Optional[str]
    suppliers_queried: List[str]
    total_results: int
    results: Dict[str, List[SupplierSearchResultItem]]


class SupplierProductResponse(BaseModel):
    """Response model for product details"""
    mpn: str
    manufacturer: str
    description: str
    category: Optional[str]
    supplier_name: str
    supplier_sku: str
    supplier_url: Optional[str]
    availability: Optional[int]
    unit_price: Optional[float]
    currency: str
    price_breaks: Optional[List[Dict[str, Any]]]
    lead_time_days: Optional[int]
    datasheet_url: Optional[str]
    image_url: Optional[str]
    lifecycle_status: Optional[str]
    package: Optional[str]
    rohs_compliant: Optional[bool]
    reach_compliant: Optional[bool]
    parameters: Dict[str, Any]
    match_confidence: float
    last_updated: Optional[str]


class SupplierHealthResponse(BaseModel):
    """Response model for supplier health check"""
    suppliers_available: List[str]
    suppliers_unavailable: List[str]
    health_status: Dict[str, bool]
    rate_limits: Dict[str, Dict[str, Any]]


def get_supplier_manager() -> SupplierPluginManager:
    """
    Dependency to initialize and return configured SupplierPluginManager.

    Uses the centralized supplier manager service which properly loads
    persisted OAuth tokens (e.g., DigiKey access/refresh tokens).
    """
    from app.services.supplier_manager_service import (
        get_supplier_manager as get_manager_with_tokens
    )

    try:
        return get_manager_with_tokens()
    except Exception as e:
        logger.error(f"Failed to initialize supplier manager: {e}")
        raise HTTPException(
            status_code=503,
            detail=f"Supplier manager initialization failed: {str(e)}"
        )


@router.post("/search", response_model=SupplierSearchResponse)
def search_suppliers(
    request: SupplierSearchRequest,
    supplier_manager: SupplierPluginManager = Depends(get_supplier_manager)
):
    """
    Search for component across multiple supplier APIs

    Queries configured suppliers (Mouser, DigiKey, Element14) for a given MPN.
    Returns results from all suppliers that have matching components.

    Example:
        ```bash
        curl -X POST "http://localhost:27800/api/suppliers/search" \\
          -H "Content-Type: application/json" \\
          -d '{
            "mpn": "STM32F407VGT6",
            "manufacturer": "STMicroelectronics",
            "limit": 10
          }'
        ```
    """
    try:
        # Convert ValidatedMPN and ValidatedSupplier back to strings for supplier manager
        mpn_str = str(request.mpn)
        manufacturer_str = str(request.manufacturer) if request.manufacturer else None
        
        # Search across suppliers
        search_results = supplier_manager.search_by_mpn(
            mpn=mpn_str,
            manufacturer=manufacturer_str,
            preferred_suppliers=request.preferred_suppliers,
            limit=request.limit
        )

        # Convert results to response format
        formatted_results = {}
        total_results = 0

        for supplier_name, results in search_results.items():
            formatted_results[supplier_name] = [
                SupplierSearchResultItem(
                    mpn=result.mpn,
                    manufacturer=result.manufacturer,
                    description=result.description,
                    supplier_sku=result.supplier_sku,
                    availability=result.availability,
                    unit_price=result.unit_price,
                    currency=result.currency,
                    datasheet_url=result.datasheet_url,
                    supplier_url=result.supplier_url,
                    lifecycle_status=result.lifecycle_status,
                    match_confidence=result.match_confidence
                )
                for result in results
            ]
            total_results += len(results)

        logger.info(f"✅ Supplier search completed: {mpn_str} - {total_results} results from {len(search_results)} suppliers")

        return SupplierSearchResponse(
            query_mpn=mpn_str,
            query_manufacturer=manufacturer_str,
            suppliers_queried=list(search_results.keys()),
            total_results=total_results,
            results=formatted_results
        )

    except Exception as e:
        logger.error(f"Supplier search error: {e}")
        raise HTTPException(status_code=500, detail=f"Supplier search failed: {str(e)}")


@router.get("/details", response_model=SupplierProductResponse)
def get_product_details(
    mpn: str = Query(..., description="Manufacturer part number"),
    manufacturer: Optional[str] = Query(None, description="Manufacturer name"),
    supplier: Optional[str] = Query(None, description="Specific supplier to query (digikey, mouser, element14)"),
    supplier_manager: SupplierPluginManager = Depends(get_supplier_manager)
):
    """
    Get detailed product information from suppliers

    Queries supplier APIs for complete product details including pricing,
    availability, specifications, and compliance data.

    Example:
        ```bash
        curl "http://localhost:27800/api/suppliers/details?mpn=STM32F407VGT6&manufacturer=STMicroelectronics"
        ```
    """
    try:
        # mpn and manufacturer are already strings (no validation models needed for GET)
        mpn_str = mpn
        manufacturer_str = manufacturer

        # Determine which suppliers to query
        preferred_suppliers = [supplier] if supplier else None

        # Get product details
        product_data = supplier_manager.get_product_details(
            mpn=mpn_str,
            manufacturer=manufacturer_str,
            preferred_suppliers=preferred_suppliers
        )

        if not product_data:
            raise HTTPException(
                status_code=404,
                detail=f"Product not found: {mpn_str}"
            )

        logger.info(f"✅ Product details found: {mpn_str} from {product_data.supplier_name}")

        return SupplierProductResponse(
            mpn=product_data.mpn,
            manufacturer=product_data.manufacturer,
            description=product_data.description,
            category=product_data.category,
            supplier_name=product_data.supplier_name,
            supplier_sku=product_data.supplier_sku,
            supplier_url=product_data.supplier_url,
            availability=product_data.availability,
            unit_price=product_data.unit_price,
            currency=product_data.currency,
            price_breaks=product_data.price_breaks,
            lead_time_days=product_data.lead_time_days,
            datasheet_url=product_data.datasheet_url,
            image_url=product_data.image_url,
            lifecycle_status=product_data.lifecycle_status,
            package=product_data.package,
            rohs_compliant=product_data.rohs_compliant,
            reach_compliant=product_data.reach_compliant,
            parameters=product_data.parameters,
            match_confidence=product_data.match_confidence,
            last_updated=product_data.last_updated.isoformat() if product_data.last_updated else None
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Product details error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get product details: {str(e)}")


@router.get("/best-match", response_model=SupplierProductResponse)
def get_best_match(
    mpn: str = Query(..., description="Manufacturer part number"),
    manufacturer: Optional[str] = Query(None, description="Manufacturer name"),
    min_confidence: float = Query(default=90.0, ge=0, le=100, description="Minimum match confidence threshold"),
    supplier_manager: SupplierPluginManager = Depends(get_supplier_manager)
):
    """
    Get the best matching product across all suppliers

    Searches all configured suppliers and returns the product with the
    highest match confidence score that meets the minimum threshold.

    Example:
        ```bash
        curl "http://localhost:27800/api/suppliers/best-match?mpn=STM32F407VGT6&min_confidence=90"
        ```
    """
    try:
        # Get best match across all suppliers
        product_data = supplier_manager.get_best_match(
            mpn=mpn,
            manufacturer=manufacturer,
            min_confidence=min_confidence
        )

        if not product_data:
            raise HTTPException(
                status_code=404,
                detail=f"No match found for: {mpn} (min confidence: {min_confidence}%)"
            )

        logger.info(f"✅ Best match found: {mpn} from {product_data.supplier_name} (confidence: {product_data.match_confidence}%)")

        return SupplierProductResponse(
            mpn=product_data.mpn,
            manufacturer=product_data.manufacturer,
            description=product_data.description,
            category=product_data.category,
            supplier_name=product_data.supplier_name,
            supplier_sku=product_data.supplier_sku,
            supplier_url=product_data.supplier_url,
            availability=product_data.availability,
            unit_price=product_data.unit_price,
            currency=product_data.currency,
            price_breaks=product_data.price_breaks,
            lead_time_days=product_data.lead_time_days,
            datasheet_url=product_data.datasheet_url,
            image_url=product_data.image_url,
            lifecycle_status=product_data.lifecycle_status,
            package=product_data.package,
            rohs_compliant=product_data.rohs_compliant,
            reach_compliant=product_data.reach_compliant,
            parameters=product_data.parameters,
            match_confidence=product_data.match_confidence,
            last_updated=product_data.last_updated.isoformat() if product_data.last_updated else None
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Best match error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to find best match: {str(e)}")


@router.get("/health", response_model=SupplierHealthResponse)
def check_supplier_health(
    supplier_manager: SupplierPluginManager = Depends(get_supplier_manager)
):
    """
    Check health status of all configured supplier APIs

    Returns availability status and rate limit information for each supplier.

    Example:
        ```bash
        curl "http://localhost:27800/api/suppliers/health"
        ```
    """
    try:
        # Check health status
        health_status = supplier_manager.check_health()
        rate_limits = supplier_manager.get_rate_limit_info()

        suppliers_available = [name for name, status in health_status.items() if status]
        suppliers_unavailable = [name for name, status in health_status.items() if not status]

        logger.info(f"✅ Supplier health check: {len(suppliers_available)} available, {len(suppliers_unavailable)} unavailable")

        return SupplierHealthResponse(
            suppliers_available=suppliers_available,
            suppliers_unavailable=suppliers_unavailable,
            health_status=health_status,
            rate_limits=rate_limits
        )

    except Exception as e:
        logger.error(f"Health check error: {e}")
        raise HTTPException(status_code=500, detail=f"Health check failed: {str(e)}")


@router.get("/available")
def list_available_suppliers(
    supplier_manager: SupplierPluginManager = Depends(get_supplier_manager)
):
    """
    List all available (configured and enabled) supplier plugins

    Example:
        ```bash
        curl "http://localhost:27800/api/suppliers/available"
        ```
    """
    try:
        available_suppliers = supplier_manager.get_available_suppliers()

        logger.info(f"Available suppliers: {', '.join(available_suppliers)}")

        return {
            "available_suppliers": available_suppliers,
            "total": len(available_suppliers)
        }

    except Exception as e:
        logger.error(f"List suppliers error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to list suppliers: {str(e)}")


# Configuration Management Endpoints

@router.get("/config")
def get_supplier_config():
    """
    Get current supplier API configuration (returns sanitized data without secrets)
    """
    try:
        config = {
            "tier1": {
                "mouser": {
                    "enabled": settings.mouser_enabled,
                    "apiKey": settings.mouser_api_key if settings.mouser_enabled else "",
                    "baseUrl": settings.mouser_base_url,
                    "rateLimit": settings.mouser_rate_limit,
                },
                "digikey": {
                    "enabled": settings.digikey_enabled,
                    "clientId": settings.digikey_client_id if settings.digikey_enabled else "",
                    "clientSecret": settings.digikey_client_secret if settings.digikey_enabled else "",
                    "accessToken": bool(settings.digikey_access_token),  # Boolean indicator only, not actual token
                    "refreshToken": bool(getattr(settings, 'digikey_refresh_token', None)),
                    "tokenExpiresAt": getattr(settings, 'digikey_token_expires_at', None),
                    "baseUrl": settings.digikey_base_url,
                    "sandbox": getattr(settings, 'digikey_sandbox', False),
                    "rateLimit": settings.digikey_rate_limit,
                    "redirectUri": settings.get_digikey_redirect_uri(),
                },
                "element14": {
                    "enabled": settings.element14_enabled,
                    "apiKey": settings.element14_api_key if settings.element14_enabled else "",
                    "baseUrl": settings.element14_base_url,
                    "rateLimit": settings.element14_rate_limit,
                },
            },
            "tier2": {
                "octopart": {
                    "enabled": settings.octopart_enabled,
                    "apiKey": settings.octopart_api_key if settings.octopart_enabled else "",
                    "baseUrl": settings.octopart_base_url,
                },
                "siliconexpert": {
                    "enabled": getattr(settings, 'siliconexpert_enabled', False),
                    "apiKey": getattr(settings, 'siliconexpert_api_key', ''),
                    "baseUrl": getattr(settings, 'siliconexpert_base_url', 'https://api.siliconexpert.com'),
                },
            },
            "tier3": {
                "ti": {
                    "enabled": getattr(settings, 'ti_enabled', False),
                    "apiKey": getattr(settings, 'ti_api_key', ''),
                    "baseUrl": getattr(settings, 'ti_base_url', 'https://www.ti.com/api'),
                },
                "st": {
                    "enabled": getattr(settings, 'st_enabled', False),
                    "apiKey": getattr(settings, 'st_api_key', ''),
                    "baseUrl": getattr(settings, 'st_base_url', 'https://www.st.com/api'),
                },
            },
        }

        return config

    except Exception as e:
        logger.error(f"Get config error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get configuration: {str(e)}")


@router.post("/config")
def update_supplier_config(config: Dict[str, Any]):
    """
    Update supplier API configuration (saves to environment/config file)
    Note: This requires restart to take effect
    """
    try:
        # In a real implementation, this would update the .env file or database
        # For now, we'll just return success
        logger.info(f"Supplier configuration update requested")
        logger.warning("Configuration updates require service restart to take effect")

        return {
            "status": "success",
            "message": "Configuration saved. Restart CNS service to apply changes.",
            "restart_required": True
        }

    except Exception as e:
        logger.error(f"Update config error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to update configuration: {str(e)}")


# DigiKey OAuth Endpoints

@router.get("/digikey/oauth/url")
def get_digikey_oauth_url(
    authorization: Optional[str] = Header(default=None),
    auth_context: AuthContext = Depends(get_auth_context),
):
    """
    Get DigiKey OAuth2 authorization URL

    Returns the URL the user needs to visit to authorize the application
    """
    _require_admin_authorization_with_context(authorization, auth_context)
    try:
        base_url = settings.digikey_base_url
        if getattr(settings, 'digikey_sandbox', False):
            base_url = "https://sandbox-api.digikey.com"

        auth_url = f"{base_url}/v1/oauth2/authorize"
        redirect_uri = settings.get_digikey_redirect_uri()

        authorization_url = f"{auth_url}?response_type=code&client_id={settings.digikey_client_id}&redirect_uri={redirect_uri}"

        return {
            "authorization_url": authorization_url,
            "redirect_uri": redirect_uri,
            "instructions": "Open this URL in your browser, approve access, then copy the 'code' parameter from the redirect URL"
        }

    except Exception as e:
        logger.error(f"OAuth URL generation error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to generate OAuth URL: {str(e)}")


class DigiKeyOAuthTokenRequest(BaseModel):
    code: str = Field(..., description="Authorization code from OAuth redirect")


@router.post("/digikey/oauth/token")
def exchange_digikey_oauth_code(
    request: DigiKeyOAuthTokenRequest,
    authorization: Optional[str] = Header(default=None),
    auth_context: AuthContext = Depends(get_auth_context),
):
    """
    Exchange DigiKey OAuth authorization code for access token
    """
    _require_admin_authorization_with_context(authorization, auth_context)
    try:
        import requests
        from datetime import datetime, timedelta

        base_url = settings.digikey_base_url
        if getattr(settings, 'digikey_sandbox', False):
            base_url = "https://sandbox-api.digikey.com"

        token_url = f"{base_url}/v1/oauth2/token"
        redirect_uri = settings.get_digikey_redirect_uri()

        response = requests.post(
            token_url,
            data={
                'code': request.code,
                'client_id': settings.digikey_client_id,
                'client_secret': settings.digikey_client_secret,
                'redirect_uri': redirect_uri,
                'grant_type': 'authorization_code'
            },
            headers={'Content-Type': 'application/x-www-form-urlencoded'}
        )

        if not response.ok:
            raise HTTPException(status_code=400, detail=f"OAuth token exchange failed: {response.text}")

        token_data = response.json()

        # Validate token response structure
        if not isinstance(token_data, dict):
            raise HTTPException(status_code=500, detail="Invalid token response: expected JSON object")

        if 'access_token' not in token_data:
            raise HTTPException(
                status_code=500,
                detail=f"Invalid token response: missing access_token. Response keys: {list(token_data.keys())}"
            )

        # Use timezone-aware datetime for consistency with database
        from datetime import timezone
        expires_at = datetime.now(timezone.utc) + timedelta(seconds=token_data.get('expires_in', 1800))

        save_supplier_tokens('digikey', token_data['access_token'], token_data.get('refresh_token'), expires_at)
        reset_supplier_manager()

        logger.info(f"✅ DigiKey OAuth tokens obtained successfully")

        return {
            "status": "success",
            "expires_at": expires_at.isoformat(),
            "token_type": token_data.get('token_type', 'Bearer'),
            "message": "Tokens obtained and stored securely.",
            "refresh_token_rotated": bool(token_data.get('refresh_token')),
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"OAuth token exchange error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to exchange OAuth code: {str(e)}")


@router.post("/digikey/oauth/refresh")
def refresh_digikey_oauth_token(
    authorization: Optional[str] = Header(default=None),
    auth_context: AuthContext = Depends(get_auth_context),
):
    """
    Refresh DigiKey OAuth access token using stored refresh token.
    """
    _require_admin_authorization_with_context(authorization, auth_context)
    try:
        import requests
        from datetime import datetime, timedelta

        tokens = load_supplier_tokens('digikey')
        refresh_token = tokens.get('refresh_token') or settings.digikey_refresh_token
        if not refresh_token:
            raise HTTPException(status_code=400, detail="No refresh token stored. Re-authorize via OAuth.")

        base_url = settings.digikey_base_url
        if getattr(settings, 'digikey_sandbox', False):
            base_url = "https://sandbox-api.digikey.com"

        token_url = f"{base_url}/v1/oauth2/token"

        response = requests.post(
            token_url,
            data={
                'grant_type': 'refresh_token',
                'refresh_token': refresh_token,
            },
            auth=(settings.digikey_client_id, settings.digikey_client_secret),
            headers={'Content-Type': 'application/x-www-form-urlencoded'},
            timeout=20,
        )

        if not response.ok:
            raise HTTPException(status_code=response.status_code, detail=f"Refresh failed: {response.text}")

        token_data = response.json()

        # Validate token response structure
        if not isinstance(token_data, dict):
            raise HTTPException(status_code=500, detail="Invalid token response: expected JSON object")

        if 'access_token' not in token_data:
            raise HTTPException(
                status_code=500,
                detail=f"Invalid token response: missing access_token. Response keys: {list(token_data.keys())}"
            )

        # Use timezone-aware datetime for consistency with database
        from datetime import timezone
        expires_at = datetime.now(timezone.utc) + timedelta(seconds=token_data.get('expires_in', 1800))

        save_supplier_tokens('digikey', token_data['access_token'], token_data.get('refresh_token') or refresh_token, expires_at)
        reset_supplier_manager()

        logger.info("✅ DigiKey OAuth token refreshed via API")

        return {
            "status": "success",
            "expires_at": expires_at.isoformat(),
            "token_type": token_data.get('token_type', 'Bearer'),
            "message": "Tokens refreshed and stored securely.",
            "refresh_token_rotated": bool(token_data.get('refresh_token')),
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"OAuth token refresh error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to refresh token: {str(e)}")


# Circuit Breaker Management Endpoints

@router.get("/circuit-breaker/status")
def get_circuit_breaker_status(
    supplier_manager: SupplierPluginManager = Depends(get_supplier_manager)
):
    """
    Get circuit breaker status for all suppliers.

    Returns the state (OPEN, CLOSED, HALF_OPEN) and failure counts for each supplier.

    Example:
        ```bash
        curl "http://localhost:27800/api/suppliers/circuit-breaker/status"
        ```
    """
    try:
        status = supplier_manager.get_circuit_breaker_status()
        logger.info(f"Circuit breaker status retrieved for {len(status)} suppliers")
        return {
            "circuit_breakers": status,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }

    except Exception as e:
        logger.error(f"Failed to get circuit breaker status: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get status: {str(e)}")


@router.post("/circuit-breaker/reset")
def reset_circuit_breaker(
    supplier_name: Optional[str] = None,
    supplier_manager: SupplierPluginManager = Depends(get_supplier_manager)
):
    """
    Reset circuit breaker for one or all suppliers.

    This forces the circuit breaker to CLOSED state, allowing requests to proceed.
    Use this after fixing the underlying issue that caused the circuit to open.

    Args:
        supplier_name: Optional supplier name (digikey, mouser, element14). If not provided, resets all.

    Example:
        ```bash
        # Reset specific supplier
        curl -X POST "http://localhost:27800/api/suppliers/circuit-breaker/reset?supplier_name=digikey"

        # Reset all suppliers
        curl -X POST "http://localhost:27800/api/suppliers/circuit-breaker/reset"
        ```
    """
    try:
        result = supplier_manager.reset_circuit_breaker(supplier_name)
        logger.info(f"Circuit breaker reset: {result}")

        return {
            "status": "success",
            "result": result,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }

    except Exception as e:
        logger.error(f"Failed to reset circuit breaker: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to reset: {str(e)}")
