"""
DigiKey API Plugin

DigiKey supplier integration for component search and enrichment.

Requirements:
- DigiKey API credentials (Client ID, Client Secret)
- OAuth2 access token (obtained through authorization flow)

API Docs: https://developer.digikey.com/
"""

import requests
import logging
import threading
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta, timezone
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

from .base import SupplierPlugin, SupplierSearchResult, SupplierProductData, SupplierAPIError
from .parameter_parser import ParameterParser, extract_compliance_data
from app.core.enrichment_config_loader import get_enrichment_config

logger = logging.getLogger(__name__)


class DigiKeyPlugin(SupplierPlugin):
    """
    DigiKey API integration plugin.

    Configuration required:
    {
        "client_id": "your-client-id",
        "client_secret": "your-client-secret",
        "access_token": "your-access-token",
        "sandbox": true,  # Use sandbox API (default: true)
        "enabled": true
    }
    """

    def __init__(self, config: Dict[str, Any]):
        # API configuration
        self.client_id = config.get('client_id')
        self.client_secret = config.get('client_secret')
        self.access_token = config.get('access_token')
        self.refresh_token = config.get('refresh_token')
        self.token_expires_at = config.get('token_expires_at')
        self.token_save_callback = config.get('token_save_callback')

        # Thread safety for token refresh
        self._refresh_lock = threading.Lock()

        # Sandbox vs Production
        sandbox = config.get('sandbox', True)
        self.base_url = 'https://sandbox-api.digikey.com' if sandbox else 'https://api.digikey.com'
        self.token_url = f"{self.base_url}/v1/oauth2/token"

        # Create session with retry strategy
        self.session = self._create_session_with_retries()

        super().__init__(config)

    def validate_config(self) -> None:
        """Validate DigiKey configuration"""
        if not self.client_id:
            raise ValueError("DigiKey: client_id is required")
        if not self.client_secret:
            raise ValueError("DigiKey: client_secret is required")
        if not self.access_token:
            logger.warning("DigiKey: access_token not provided - API calls will fail until token is set")
        if not self.refresh_token:
            logger.warning("DigiKey: refresh_token not provided - automatic token refresh disabled")

    def _refresh_access_token(self) -> bool:
        """
        Attempt to refresh the DigiKey access token using the refresh_token.

        Thread-safe implementation with automatic rollback on persistence failure.
        """
        if not self.refresh_token:
            logger.warning("DigiKey: Cannot refresh token (no refresh_token configured)")
            return False

        # Acquire lock to prevent concurrent refresh attempts
        with self._refresh_lock:
            # Double-check token hasn't been refreshed by another thread
            if self.token_expires_at:
                try:
                    # Parse expires_at (could be string or datetime)
                    if isinstance(self.token_expires_at, str):
                        expires_dt = datetime.fromisoformat(self.token_expires_at.replace('Z', '+00:00'))
                    else:
                        expires_dt = self.token_expires_at

                    # If token still has >5 minutes, skip refresh
                    if datetime.now(timezone.utc) < expires_dt - timedelta(minutes=5):
                        logger.debug("DigiKey: Token still fresh, skipping refresh")
                        return True
                except Exception:
                    pass  # Parsing failed, proceed with refresh

            # Backup current tokens for rollback
            old_access = self.access_token
            old_refresh = self.refresh_token
            old_expires = self.token_expires_at

            try:
                auth = requests.auth.HTTPBasicAuth(self.client_id, self.client_secret)
                headers = {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Accept': 'application/json',
                }
                data = {
                    'grant_type': 'refresh_token',
                    'refresh_token': self.refresh_token,
                }
                resp = self.session.post(self.token_url, headers=headers, data=data, auth=auth, timeout=20)

                if resp.status_code != 200:
                    logger.warning(
                        "DigiKey: refresh token request failed (status=%s, body=%s)",
                        resp.status_code,
                        resp.text[:500],
                    )
                    return False

                tok = resp.json()
                new_access = tok.get('access_token')
                new_refresh = tok.get('refresh_token')
                expires_in = tok.get('expires_in', 1800)
                expires_at = datetime.now(timezone.utc) + timedelta(seconds=expires_in)

                # Validate response contains required fields
                if not new_access:
                    logger.error("DigiKey: Token refresh response missing access_token")
                    return False

                # Alert if DigiKey didn't rotate refresh token (unusual)
                if not new_refresh:
                    logger.warning("DigiKey: Token refresh response missing new refresh_token (using old)")
                    new_refresh = self.refresh_token

                # Update in-memory state BEFORE persisting
                if new_access:
                    self.access_token = new_access
                if new_refresh:
                    self.refresh_token = new_refresh
                self.token_expires_at = expires_at

                # Persist to database (critical path - must succeed)
                if self.token_save_callback:
                    try:
                        self.token_save_callback(
                            access_token=self.access_token,
                            refresh_token=self.refresh_token,
                            expires_at=expires_at,
                        )
                        logger.info(f"✅ DigiKey: Tokens refreshed and persisted (expires {expires_at.isoformat()})")
                    except Exception as exc:
                        # ROLLBACK: Persistence failed, restore old tokens
                        self.access_token = old_access
                        self.refresh_token = old_refresh
                        self.token_expires_at = old_expires
                        logger.error(
                            f"❌ DigiKey: Token persistence failed, rolled back to previous tokens: {exc}"
                        )
                        return False
                else:
                    logger.warning("DigiKey: No save callback configured, tokens not persisted")

                return True

            except Exception as exc:
                # Refresh request failed, restore old tokens
                self.access_token = old_access
                self.refresh_token = old_refresh
                self.token_expires_at = old_expires
                logger.error(f"DigiKey: Token refresh exception, rolled back: {exc}")
                return False

    def _create_session_with_retries(self) -> requests.Session:
        """Create requests session with automatic retry on failures"""
        session = requests.Session()

        # Retry strategy: 3 retries with exponential backoff
        retry_strategy = Retry(
            total=3,
            backoff_factor=1,
            status_forcelist=[429, 500, 502, 503, 504],
            allowed_methods=["HEAD", "GET", "POST"]
        )

        adapter = HTTPAdapter(max_retries=retry_strategy)
        session.mount('http://', adapter)
        session.mount('https://', adapter)

        return session

    def _make_request(
        self,
        endpoint: str,
        method: str = 'GET',
        params: Optional[Dict] = None,
        data: Optional[Dict] = None
    ) -> Dict[str, Any]:
        """
        Make authenticated API request to DigiKey.

        Args:
            endpoint: API endpoint (e.g., '/products/v4/search/keyword')
            method: HTTP method ('GET' or 'POST')
            params: Query parameters
            data: JSON body data

        Returns:
            API response as dictionary

        Raises:
            SupplierAPIError: If request fails
        """
        if not self.access_token:
            raise SupplierAPIError(
                "Access token not configured. Run OAuth2 flow first.",
                supplier="DigiKey"
            )

        # Proactive token refresh if expiring soon (5 minute buffer)
        if self.token_expires_at and self.refresh_token:
            try:
                if isinstance(self.token_expires_at, str):
                    expires_dt = datetime.fromisoformat(self.token_expires_at.replace('Z', '+00:00'))
                else:
                    expires_dt = self.token_expires_at

                # Refresh if expiring within 5 minutes
                buffer_time = expires_dt - timedelta(minutes=5)
                if datetime.now(timezone.utc) >= buffer_time:
                    logger.info("DigiKey: Token expiring soon, refreshing proactively")
                    self._refresh_access_token()
            except Exception as e:
                logger.warning(f"DigiKey: Failed to check token expiration: {e}")

        url = f"{self.base_url}{endpoint}"
        headers = {
            'Authorization': f'Bearer {self.access_token}',
            'X-DIGIKEY-Client-Id': self.client_id,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        }

        try:
            if method == 'GET':
                response = self.session.get(url, headers=headers, params=params, timeout=30)
            elif method == 'POST':
                response = self.session.post(url, headers=headers, json=data, timeout=30)
            else:
                raise ValueError(f"Unsupported method: {method}")

            response.raise_for_status()
            return response.json()

        except requests.exceptions.HTTPError as e:
            status_code = e.response.status_code if e.response else None
            response_body = e.response.text[:500] if e.response else "No response body"
            error_msg = f"DigiKey API error: {e}"

            if status_code == 401 and self._refresh_access_token():
                # Retry once with the refreshed token
                logger.info(f"DigiKey: Retrying request to {endpoint} after token refresh")
                headers['Authorization'] = f'Bearer {self.access_token}'
                retry_resp = None
                if method == 'GET':
                    retry_resp = self.session.get(url, headers=headers, params=params, timeout=30)
                elif method == 'POST':
                    retry_resp = self.session.post(url, headers=headers, json=data, timeout=30)
                if retry_resp is not None and retry_resp.status_code < 400:
                    logger.info(f"DigiKey: Retry successful for {endpoint}")
                    return retry_resp.json()

            if status_code == 429:
                error_msg = "Rate limit exceeded"
                logger.error(f"❌ DigiKey API Rate Limit: {method} {endpoint} - Status {status_code}")
            elif status_code == 401:
                error_msg = "Authentication failed - access token may be expired"
                logger.error(f"❌ DigiKey API Auth Failed: {method} {endpoint} - Status {status_code}")
                logger.error(f"   Response: {response_body}")
            else:
                logger.error(f"❌ DigiKey API HTTP Error: {method} {endpoint} - Status {status_code}")
                logger.error(f"   Response: {response_body}")

            raise SupplierAPIError(error_msg, supplier="DigiKey", status_code=status_code)

        except requests.exceptions.RequestException as e:
            logger.error(f"❌ DigiKey API Request Failed: {method} {endpoint}")
            logger.error(f"   Error: {str(e)}")
            raise SupplierAPIError(f"Request failed: {e}", supplier="DigiKey")

    def search_by_mpn(
        self,
        mpn: str,
        manufacturer: Optional[str] = None,
        limit: int = 10
    ) -> List[SupplierSearchResult]:
        """
        Search for component by MPN using DigiKey APIs.

        Strategy: Try ProductDetails API first (more precise), then fallback to keyword search.

        Args:
            mpn: Manufacturer part number
            manufacturer: Optional manufacturer name
            limit: Maximum number of results

        Returns:
            List of search results
        """
        results = []

        # STEP 1: Try ProductDetails API first (more precise, direct MPN lookup)
        logger.info(f"🔍 DigiKey: Trying ProductDetails API for '{mpn}'")
        direct_result = self._search_by_product_details(mpn)
        if direct_result:
            logger.info(f"✅ DigiKey ProductDetails API: found result for '{mpn}'")
            return [direct_result]

        # STEP 2: Fallback to keyword search
        logger.info(f"🔄 DigiKey ProductDetails returned nothing, falling back to keyword search for '{mpn}'")

        endpoint = '/products/v4/search/keyword'

        # Build search query
        query = mpn
        if manufacturer:
            query = f"{manufacturer} {mpn}"

        data = {
            'Keywords': query,
            'Limit': min(limit, 50),  # DigiKey max is 50
            'Offset': 0,
            'SearchOptions': [],
            'Sort': {
                'SortOption': 'SortByUnitPrice',
                'Direction': 'Ascending'
            }
        }

        try:
            response = self._make_request(endpoint, method='POST', data=data)

            products = response.get('Products', [])

            for product in products:
                # DEBUG: Log all available fields from DigiKey API
                logger.info(f"🔍 DigiKey API response fields: {list(product.keys())}")
                logger.info(f"🔍 Full DigiKey response for {mpn}: {product}")

                # Store full product data for later enrichment
                result = self._parse_search_result(product)
                if result:
                    # Store raw product data for detailed extraction
                    result.raw_data = product

                    # Calculate match confidence based on MPN similarity
                    # Normalize MPNs for comparison (remove common formatting differences)
                    import re
                    def normalize_mpn(mpn_str: str) -> str:
                        """Normalize MPN by removing hyphens, spaces, slashes for comparison"""
                        return re.sub(r'[\-\s/]', '', mpn_str.upper())

                    product_mpn = result.mpn.upper()
                    search_mpn = mpn.upper()
                    product_mpn_norm = normalize_mpn(product_mpn)
                    search_mpn_norm = normalize_mpn(search_mpn)

                    if product_mpn == search_mpn:
                        result.match_confidence = 100.0
                    elif product_mpn_norm == search_mpn_norm:
                        # Same MPN but different formatting (e.g., 172287-1103 vs 1722871103)
                        result.match_confidence = 98.0
                    elif search_mpn in product_mpn or search_mpn_norm in product_mpn_norm:
                        result.match_confidence = 90.0
                    elif product_mpn in search_mpn or product_mpn_norm in search_mpn_norm:
                        result.match_confidence = 85.0
                    else:
                        result.match_confidence = 70.0

                    results.append(result)

            logger.info(f"✅ DigiKey keyword search: found {len(results)} results for '{mpn}'")
            return results

        except SupplierAPIError:
            raise
        except Exception as e:
            raise SupplierAPIError(f"Search failed: {e}", supplier="DigiKey")

    def _search_by_product_details(self, mpn: str) -> Optional[SupplierSearchResult]:
        """
        Try to find a product using the ProductDetails API endpoint.
        This endpoint accepts manufacturer part numbers directly.

        Args:
            mpn: Manufacturer part number

        Returns:
            SupplierSearchResult if found, None otherwise
        """
        # ProductDetails endpoint: GET /products/v4/{partNumber}
        # URL-encode the MPN in case it has special characters
        import urllib.parse
        encoded_mpn = urllib.parse.quote(mpn, safe='')
        endpoint = f'/products/v4/search/{encoded_mpn}/productdetails'

        try:
            response = self._make_request(endpoint, method='GET')

            # Response should be a single product
            product = response.get('Product', response)  # Handle both formats

            if not product:
                logger.info(f"DigiKey ProductDetails: No product data for '{mpn}'")
                return None

            logger.info(f"🔍 DigiKey ProductDetails API response fields: {list(product.keys())}")

            result = self._parse_search_result(product)
            if result:
                result.raw_data = product

                # Calculate confidence - direct lookup is high confidence
                import re
                def normalize_mpn(mpn_str: str) -> str:
                    return re.sub(r'[\-\s/]', '', mpn_str.upper())

                product_mpn = result.mpn.upper()
                search_mpn = mpn.upper()
                product_mpn_norm = normalize_mpn(product_mpn)
                search_mpn_norm = normalize_mpn(search_mpn)

                if product_mpn == search_mpn:
                    result.match_confidence = 100.0
                elif product_mpn_norm == search_mpn_norm:
                    result.match_confidence = 98.0
                elif search_mpn in product_mpn or search_mpn_norm in product_mpn_norm:
                    result.match_confidence = 95.0  # Higher confidence for direct lookup
                elif product_mpn in search_mpn or product_mpn_norm in search_mpn_norm:
                    result.match_confidence = 90.0
                else:
                    result.match_confidence = 75.0

                return result

        except SupplierAPIError as e:
            # 404 or other errors mean part not found - this is expected
            if '404' in str(e) or 'not found' in str(e).lower():
                logger.info(f"DigiKey ProductDetails: Part '{mpn}' not found (404)")
            else:
                logger.warning(f"DigiKey ProductDetails API error for '{mpn}': {e}")
            return None
        except Exception as e:
            logger.warning(f"DigiKey ProductDetails unexpected error for '{mpn}': {e}")
            return None

        return None

    def get_product_details(
        self,
        mpn: str,
        manufacturer: Optional[str] = None
    ) -> Optional[SupplierProductData]:
        """
        Get complete product details for a specific MPN.

        Args:
            mpn: Manufacturer part number
            manufacturer: Optional manufacturer name

        Returns:
            Complete product data or None if not found
        """
        # Search for the product first
        search_results = self.search_by_mpn(mpn, manufacturer, limit=1)

        if not search_results:
            logger.info(f"DigiKey: No results found for '{mpn}'")
            return None

        # Get the best match (highest confidence)
        best_match = max(search_results, key=lambda r: r.match_confidence)

        # Get detailed product information
        # Note: In V4 API, detailed info is already in search results
        # For more details, you can use the product details endpoint:
        # GET /products/v4/{digikey_part_number}

        return self._enrich_product_data(best_match)

    def _parse_search_result(self, product: Dict[str, Any]) -> Optional[SupplierSearchResult]:
        """
        Parse DigiKey search result into SupplierSearchResult.

        Args:
            product: Raw product data from DigiKey API

        Returns:
            Parsed search result or None if invalid
        """
        try:
            # Extract basic info
            mpn = product.get('ManufacturerProductNumber', '')  # Fixed: was ManufacturerPartNumber
            manufacturer = product.get('Manufacturer', {}).get('Name', '')
            description = product.get('Description', {}).get('ProductDescription', '')  # Fixed: was at root level

            if not mpn or not manufacturer:
                return None

            # Extract pricing from ProductVariations
            unit_price = None
            currency = 'USD'
            product_variations = product.get('ProductVariations', [])
            if product_variations and len(product_variations) > 0:
                standard_pricing = product_variations[0].get('StandardPricing', [])
                if standard_pricing:
                    # Get the first price break (unit price)
                    unit_price = standard_pricing[0].get('UnitPrice')

            # Extract availability
            availability = product.get('QuantityAvailable', 0)

            # Extract URLs
            datasheet_url = product.get('DatasheetUrl')
            product_url = product.get('ProductUrl')

            # DigiKey part number (SKU) from ProductVariations
            digikey_sku = ''
            if product_variations and len(product_variations) > 0:
                digikey_sku = product_variations[0].get('DigiKeyProductNumber', '')

            return SupplierSearchResult(
                mpn=mpn,
                manufacturer=manufacturer,
                description=description,
                availability=availability,
                unit_price=unit_price,
                currency=currency,
                datasheet_url=datasheet_url,
                supplier_sku=digikey_sku,
                supplier_url=product_url,
                lifecycle_status=None,  # Not in search results
                match_confidence=100.0  # Will be adjusted later
            )

        except Exception as e:
            logger.error(f"Failed to parse DigiKey search result: {e}")
            return None

    def _enrich_product_data(self, search_result: SupplierSearchResult) -> SupplierProductData:
        """
        Enrich search result with additional product data.
        Extracts ALL available fields from DigiKey API response.

        Args:
            search_result: Basic search result with raw_data

        Returns:
            Enriched product data with all available fields
        """
        # Get raw product data (stored during search)
        product = getattr(search_result, 'raw_data', {})

        if not product:
            # Fallback to basic data if raw_data not available
            return SupplierProductData(
                mpn=search_result.mpn,
                manufacturer=search_result.manufacturer,
                description=search_result.description,
                supplier_sku=search_result.supplier_sku,
                availability=search_result.availability,
                unit_price=search_result.unit_price,
                currency=search_result.currency,
                datasheet_url=search_result.datasheet_url,
                model_3d_url=None,  # No 3D model in fallback path
                supplier_name='DigiKey',
                supplier_url=search_result.supplier_url,
                last_updated=datetime.now(),
                match_confidence=search_result.match_confidence
            )

        # Extract all available fields from DigiKey API response
        try:
            # Basic fields
            mpn = product.get('ManufacturerProductNumber', search_result.mpn)  # Fixed: was ManufacturerPartNumber
            manufacturer = product.get('Manufacturer', {}).get('Name', search_result.manufacturer)
            description = product.get('Description', {}).get('ProductDescription', search_result.description)  # Fixed: nested

            # Category - DigiKey uses 'Category' and 'Family'
            category_obj = product.get('Category', {})
            family_obj = product.get('Family', {})
            category = category_obj.get('Name') or family_obj.get('Name')

            # Lifecycle status - DigiKey uses 'ProductStatus'
            lifecycle = product.get('ProductStatus', {}).get('Status', '')  # Fixed: was 'Name', should be 'Status'

            # Image URL - DigiKey uses 'PhotoUrl' in search results
            image_url = product.get('PhotoUrl') or product.get('PrimaryPhoto')
            if not image_url:
                photos = product.get('Photos', [])
                if photos:
                    image_url = photos[0].get('Url')

            # Availability
            availability = product.get('QuantityAvailable', search_result.availability)

            # Pricing - DigiKey uses 'StandardPricing' nested in ProductVariations
            product_variations = product.get('ProductVariations', [])
            unit_price = None
            currency = 'USD'
            price_breaks = []

            if product_variations and len(product_variations) > 0:
                standard_pricing = product_variations[0].get('StandardPricing', [])
                for price_obj in standard_pricing:
                    qty = price_obj.get('BreakQuantity', 0)
                    price_val = price_obj.get('UnitPrice', 0)

                    if price_val:
                        price_breaks.append({'quantity': qty, 'price': price_val})
                        if unit_price is None:
                            unit_price = price_val
                            # DigiKey typically uses USD but may vary
                            currency = 'USD'

            # Lead time - DigiKey provides ManufacturerLeadWeeks (convert weeks to days)
            lead_time_days = None
            lead_time_weeks = product.get('ManufacturerLeadWeeks')
            if lead_time_weeks:
                try:
                    import re
                    match = re.search(r'(\d+)', str(lead_time_weeks))
                    if match:
                        weeks = int(match.group(1))
                        lead_time_days = weeks * 7
                        logger.debug(f"DigiKey: Converted lead time {weeks} weeks → {lead_time_days} days")
                except Exception as e:
                    logger.debug(f"DigiKey: Failed to parse ManufacturerLeadWeeks '{lead_time_weeks}': {e}")
                    pass

            # URLs
            datasheet_url = product.get('DatasheetUrl', search_result.datasheet_url)
            product_url = product.get('ProductUrl', search_result.supplier_url)
            digikey_sku = product.get('DigiKeyPartNumber', search_result.supplier_sku)

            # 3D Model - DigiKey provides MediaLinks array with various media types
            model_3d_url = None
            media_links = product.get('MediaLinks', [])
            if media_links:
                for media in media_links:
                    media_type = media.get('MediaType', '').lower()
                    media_url = media.get('Url', '')

                    # Check for 3D model indicators in MediaType or URL
                    if media_url and (
                        '3d' in media_type or
                        'cad' in media_type or
                        'model' in media_type or
                        media_url.lower().endswith(('.step', '.stp', '.igs', '.iges', '.stl'))
                    ):
                        model_3d_url = media_url
                        logger.debug(f"DigiKey: Extracted 3D model URL from MediaLinks (type: {media_type})")
                        break  # Take first 3D model found

            # Parameters from 'Parameters' array (DigiKey's product specifications)
            parameters = {}
            package = None  # Initialize package before Parameters loop

            params_list = product.get('Parameters', [])
            if params_list:
                for param in params_list:
                    # DigiKey API uses 'ParameterText' and 'ValueText', not 'Parameter' and 'Value'
                    param_name = param.get('ParameterText', '')
                    param_value = param.get('ValueText', '')
                    if param_name and param_value:
                        # Keep original parameter name (with spaces) for PARAM_MAPPINGS matching
                        # Lowercase will happen in normalize_vendor_parameters
                        param_key = param_name
                        # Store raw string for normalizer regex matching
                        # (ParameterParser can be used later for advanced parsing if needed)
                        parameters[param_key] = param_value

                        # Extract package from "Package / Case" parameter for quality scorer RECOMMENDED_FIELDS
                        if param_name in ['Package / Case', 'Package', 'Supplier Device Package']:
                            package = param_value
                            logger.debug(f"DigiKey: Extracted package '{package}' from parameter '{param_name}'")

            # Extract Classifications object FIRST (needed for rohs/reach/eccn/hts extraction)
            classifications = product.get('Classifications', {})

            # Compliance - RoHS (from Classifications object, not top-level)
            rohs_compliant = None
            rohs_status = classifications.get('RohsStatus') or product.get('RoHSStatus')  # Try Classifications first, fallback to top-level
            if rohs_status:
                if 'compliant' in str(rohs_status).lower():
                    rohs_compliant = True
                elif 'non' in str(rohs_status).lower():
                    rohs_compliant = False

            # Compliance - REACH (from Classifications object, not top-level)
            reach_compliant = None
            reach_status = classifications.get('ReachStatus') or product.get('ReachStatus')  # Try Classifications first, fallback to top-level
            if reach_status:
                if 'compliant' in str(reach_status).lower() or 'unaffected' in str(reach_status).lower():
                    reach_compliant = True
                elif 'non' in str(reach_status).lower() or 'affected' in str(reach_status).lower():
                    reach_compliant = False

            # Compliance - Halogen Free
            halogen_free = None
            halogen_status = product.get('HalogenFree')
            if halogen_status is not None:
                halogen_free = bool(halogen_status)

            # Compliance - AEC Qualified
            aec_qualified = None
            aec_status = product.get('AECQualified')
            if aec_status is not None:
                aec_qualified = bool(aec_status)

            # ECCN code - DigiKey uses 'ExportControlClassificationNumber' in Classifications
            eccn_code = classifications.get('ExportControlClassNumber') or product.get('ECCN')

            # HTS code - DigiKey uses 'HtsusCode' in Classifications
            hts_code = classifications.get('HtsusCode')

            # Additional DigiKey-specific fields - extract from ProductVariations array
            # MinimumOrderQuantity and PackageType are inside ProductVariations, not at top level
            product_variations = product.get('ProductVariations', [])
            if product_variations:
                # Use first variation (typically the default/standard packaging)
                first_variation = product_variations[0]
                min_order_qty = first_variation.get('MinimumOrderQuantity')
                if min_order_qty:
                    parameters['minimum_order_quantity'] = str(min_order_qty)

                package_type = first_variation.get('PackageType', {})
                packaging = package_type.get('Name')
                if packaging:
                    parameters['packaging'] = packaging

            # Add HTS code to parameters for quality scorer RECOMMENDED_FIELDS
            if hts_code:
                parameters['hts_code'] = hts_code

            return SupplierProductData(
                mpn=mpn,
                manufacturer=manufacturer,
                description=description,
                category=category,
                supplier_sku=digikey_sku,
                availability=availability,
                unit_price=unit_price,
                currency=currency,
                price_breaks=price_breaks,
                lead_time_days=lead_time_days,
                datasheet_url=datasheet_url,
                image_url=image_url,
                model_3d_url=model_3d_url,
                lifecycle_status=lifecycle,
                package=package,
                parameters=parameters,
                rohs_compliant=rohs_compliant,
                reach_compliant=reach_compliant,
                halogen_free=halogen_free,
                aec_qualified=aec_qualified,
                eccn_code=eccn_code,
                supplier_name='DigiKey',
                supplier_url=product_url,
                last_updated=datetime.now(),
                match_confidence=search_result.match_confidence
            )

        except Exception as e:
            logger.error(f"Failed to enrich DigiKey product data: {e}", exc_info=True)
            # Fallback to basic data
            return SupplierProductData(
                mpn=search_result.mpn,
                manufacturer=search_result.manufacturer,
                description=search_result.description,
                supplier_sku=search_result.supplier_sku,
                availability=search_result.availability,
                unit_price=search_result.unit_price,
                currency=search_result.currency,
                datasheet_url=search_result.datasheet_url,
                model_3d_url=None,  # No 3D model in fallback path
                supplier_name='DigiKey',
                supplier_url=search_result.supplier_url,
                last_updated=datetime.now(),
                match_confidence=search_result.match_confidence
            )

    def _check_connectivity(self) -> bool:
        """
        Check if DigiKey API is reachable using authenticated lightweight endpoint.

        Uses Product Search v4 API with minimal query to confirm auth works.
        """
        if not self.access_token:
            logger.debug("DigiKey health check: No access token configured")
            return False

        try:
            # Use Product Search v4 API with minimal query - confirms authentication
            headers = {
                'Authorization': f'Bearer {self.access_token}',
                'X-DIGIKEY-Client-Id': self.client_id,
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            }
            # Minimal search request - just need to confirm API responds
            data = {
                'Keywords': 'test',
                'Limit': 1,
                'Offset': 0
            }
            response = self.session.post(
                f"{self.base_url}/products/v4/search/keyword",
                headers=headers,
                json=data,
                timeout=10
            )

            # 200 = Success, API is healthy and auth works
            # 401 = Auth failed (expired token)
            # 403 = Forbidden (subscription issue)
            if response.status_code == 200:
                logger.debug("DigiKey health check: OK")
                return True
            elif response.status_code == 401:
                logger.warning("DigiKey health check: Authentication failed (token may be expired)")
                return False
            elif response.status_code == 403:
                logger.warning("DigiKey health check: Forbidden (check API subscription)")
                return False
            else:
                logger.warning(f"DigiKey health check: Unexpected status {response.status_code}")
                return False

        except requests.exceptions.Timeout as e:
            logger.warning(f"DigiKey health check timeout: {e}")
            return False
        except requests.exceptions.RequestException as e:
            logger.error(f"DigiKey health check failed: {e}", exc_info=True)
            return False
        except Exception as e:
            logger.error(f"DigiKey health check unexpected error: {e}", exc_info=True)
            return False
