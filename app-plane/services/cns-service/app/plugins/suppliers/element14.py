"""
Element14 (Farnell/Newark) API Plugin

Element14 supplier integration for component search and enrichment.

Requirements:
- Element14 API key (from Farnell/Newark developer portal)

API Docs: https://partner.element14.com/docs/
"""

import requests
import logging
from typing import List, Optional, Dict, Any
from datetime import datetime

from .base import SupplierPlugin, SupplierSearchResult, SupplierProductData, SupplierAPIError

logger = logging.getLogger(__name__)


class Element14Plugin(SupplierPlugin):
    """
    Element14 (Farnell/Newark) API integration plugin.

    Configuration required:
    {
        "api_key": "your-api-key",
        "store": "us",  # "us" for Newark, "uk" for Farnell
        "enabled": true
    }
    """

    BASE_URL = 'https://api.element14.com/catalog/products'

    # Store identifiers (must match V1 format)
    STORES = {
        'us': 'us.newark.com',      # Americas (Newark)
        'uk': 'uk.farnell.com',     # Europe/MEA/Japan (Farnell)
        'sg': 'sg.element14.com',   # Asia Pacific
    }

    def __init__(self, config: Dict[str, Any]):
        self.api_key = config.get('api_key')
        store_code = config.get('store', 'uk')  # Default to Farnell (UK) - API key works with this
        self.store = self.STORES.get(store_code, 'uk.farnell.com')
        super().__init__(config)

    def validate_config(self) -> None:
        """Validate Element14 configuration"""
        if not self.api_key:
            raise ValueError("Element14: api_key is required")

    def search_by_mpn(
        self,
        mpn: str,
        manufacturer: Optional[str] = None,
        limit: int = 10
    ) -> List[SupplierSearchResult]:
        """
        Search for component by MPN using Element14 Search API.

        Args:
            mpn: Manufacturer part number
            manufacturer: Optional manufacturer name
            limit: Maximum number of results

        Returns:
            List of search results
        """
        # Note: Element14 API has specific parameter casing requirements
        # - 'callinfo.apiKey' (lowercase 'callinfo')
        # - 'callInfo.*' (uppercase 'I' for other callInfo params)
        # - 'versionNumber' is REQUIRED
        #
        # IMPORTANT: Element14 API returns 400 Bad Request if manufacturer is prepended
        # to the search term. Use ONLY manuPartNum:MPN format.
        # Manufacturer filtering should happen in result processing.
        search_term = f'manuPartNum:{mpn}'

        params = {
            'versionNumber': '1.4',  # API version - REQUIRED!
            'term': search_term,
            'storeInfo.id': self.store,
            'resultsSettings.offset': 0,
            'resultsSettings.numberOfResults': min(limit, 50),
            'resultsSettings.refinements.filters': '',
            'resultsSettings.responseGroup': 'large',
            'callInfo.omitXmlSchema': 'false',  # uppercase 'I'
            'callInfo.callback': '',  # uppercase 'I'
            'callInfo.responseDataFormat': 'json',  # uppercase 'I'
            'callinfo.apiKey': self.api_key  # lowercase 'callinfo' for API key
        }

        try:
            response = requests.get(
                self.BASE_URL,
                params=params,
                timeout=30
            )
            response.raise_for_status()

            # Parse JSON response with better error handling
            # Element14 sometimes returns JSONP format instead of JSON
            # e.g., ({...}) or callback({...}) - we need to strip the wrapper
            try:
                response_text = response.text.strip()

                # Handle JSONP wrapper - strip leading/trailing callback wrapper
                if response_text.startswith('(') and response_text.endswith(')'):
                    # Simple JSONP: ({...})
                    response_text = response_text[1:-1]
                    logger.debug("Element14: Stripped JSONP wrapper (parentheses)")
                elif '(' in response_text and response_text.endswith(')'):
                    # Named callback: callbackName({...})
                    import re
                    jsonp_match = re.match(r'^[a-zA-Z_][a-zA-Z0-9_]*\s*\((.*)\)$', response_text, re.DOTALL)
                    if jsonp_match:
                        response_text = jsonp_match.group(1)
                        logger.debug("Element14: Stripped JSONP wrapper (named callback)")

                import json
                result = json.loads(response_text)
            except (ValueError, json.JSONDecodeError) as json_error:
                # If JSON parsing fails, log response content for debugging
                logger.error(f"Failed to parse Element14 JSON response: {json_error}")
                logger.error(f"Response content (first 500 chars): {response.text[:500]}")
                raise SupplierAPIError(
                    f"Invalid JSON response from Element14 API: {json_error}",
                    supplier="Element14"
                )

            # Parse search results - check both possible response formats
            products = []
            if 'keywordSearchReturn' in result:
                products = result.get('keywordSearchReturn', {}).get('products', [])
            elif 'manufacturerPartNumberSearchReturn' in result:
                # Fallback for part number searches
                products = result.get('manufacturerPartNumberSearchReturn', {}).get('products', [])

            results = []
            for product in products:
                # DEBUG: Log all available fields from Element14 API
                logger.info(f"🔍 Element14 API response fields: {list(product.keys())}")
                logger.info(f"🔍 Full Element14 response for {mpn}: {product}")

                parsed = self._parse_search_result(product, mpn)
                if parsed:
                    results.append(parsed)

            logger.info(f"✅ Element14 search: found {len(results)} results for '{mpn}'")
            return results

        except requests.exceptions.HTTPError as e:
            logger.error(f"Element14 API HTTP error: {e.response.status_code} - Response: {e.response.text[:500]}")
            raise SupplierAPIError(
                f"Element14 API request failed: {str(e)}",
                supplier="Element14"
            )
        except requests.exceptions.RequestException as e:
            logger.error(f"Element14 API request exception: {str(e)}")
            raise SupplierAPIError(
                f"Element14 API error: {e}",
                supplier="Element14"
            )

    def get_product_details(
        self,
        mpn: str,
        manufacturer: Optional[str] = None
    ) -> Optional[SupplierProductData]:
        """
        Get complete product details for a specific MPN.
        Extracts ALL available fields from Element14 API response.

        Args:
            mpn: Manufacturer part number
            manufacturer: Optional manufacturer name

        Returns:
            Complete product data or None if not found
        """
        # Get raw API response using search
        # IMPORTANT: Element14 API returns 400 Bad Request if manufacturer is prepended
        # Use ONLY manuPartNum:MPN format.
        search_term = f'manuPartNum:{mpn}'

        params = {
            'versionNumber': '1.4',
            'term': search_term,
            'storeInfo.id': self.store,
            'resultsSettings.offset': 0,
            'resultsSettings.numberOfResults': 1,
            'resultsSettings.responseGroup': 'large',
            'callInfo.omitXmlSchema': 'false',
            'callInfo.callback': '',
            'callInfo.responseDataFormat': 'json',
            'callinfo.apiKey': self.api_key
        }

        try:
            response = requests.get(self.BASE_URL, params=params, timeout=30)
            response.raise_for_status()
            result = response.json()

            # Extract products from response
            products = []
            if 'keywordSearchReturn' in result:
                products = result.get('keywordSearchReturn', {}).get('products', [])
            elif 'manufacturerPartNumberSearchReturn' in result:
                products = result.get('manufacturerPartNumberSearchReturn', {}).get('products', [])

            if not products:
                logger.info(f"Element14: No results found for '{mpn}'")
                return None

            # Get first/best result and parse ALL fields
            product = products[0]

            # Basic fields
            part_mpn = product.get('translatedManufacturerPartNumber', '')
            part_mfr = product.get('brandName', '')
            description = product.get('displayName', '')

            # Enhanced description from productOverview
            product_overview = product.get('productOverview', {})
            if product_overview:
                detailed_desc = product_overview.get('description', '')
                if detailed_desc and len(detailed_desc) > len(description):
                    description = detailed_desc

            # Category - Element14 uses 'translatedCategoryName'
            category = product.get('translatedCategoryName')

            # Product Series/Range from Product Range attribute (extracted later)
            product_series = None

            # Lifecycle status - Element14 uses 'productStatus' (STOCKED, NO_LONGER_MANUFACTURED)
            # and 'releaseStatusCode' (numeric)
            product_status = product.get('productStatus', '')
            lifecycle = product_status if product_status else str(product.get('releaseStatusCode', ''))

            # Image URL - Element14 uses 'image' object with full URLs
            image_url = None
            image_obj = product.get('image')
            if image_obj:
                # Prefer full mainImageURL, fallback to baseName
                image_url = image_obj.get('mainImageURL') or image_obj.get('vrntPath') or image_obj.get('baseName')

            # Availability - Element14 uses 'stock' object AND 'inv' field
            availability = 0
            stock_info = product.get('stock', {})
            if stock_info:
                availability = stock_info.get('level', 0)
            # Also check direct 'inv' field (more reliable)
            inv_value = product.get('inv')
            if inv_value and (not availability or inv_value > availability):
                availability = inv_value

            # Pricing - Element14 uses 'prices' array
            prices = product.get('prices', [])
            unit_price = None
            currency = 'USD'
            price_breaks = []

            for price_obj in prices:
                qty = price_obj.get('from', 0)
                price_val = price_obj.get('cost', 0)
                price_currency = price_obj.get('currency', 'USD')

                if price_val:
                    price_breaks.append({'quantity': qty, 'price': price_val})
                    if unit_price is None:
                        unit_price = price_val
                        currency = price_currency

            # Lead time - Element14 uses 'stock.leastLeadTime' (numeric days directly)
            lead_time_days = None
            if stock_info:
                # leastLeadTime is already in days (e.g., 120)
                lead_time_val = stock_info.get('leastLeadTime')
                if lead_time_val is not None:
                    try:
                        lead_time_days = int(lead_time_val)
                        logger.debug(f"Element14: Extracted lead time {lead_time_days} days")
                    except (ValueError, TypeError) as e:
                        logger.debug(f"Element14: Failed to parse lead time '{lead_time_val}': {e}")

            # URLs
            datasheet_url = None
            datasheets = product.get('datasheets', [])
            if datasheets:
                datasheet_url = datasheets[0].get('url')

            # 3D Model - Element14 may provide CAD files in various fields
            model_3d_url = None
            # Check for CAD files in documents or media
            documents = product.get('documents', []) or product.get('media', [])
            for doc in documents:
                doc_type = doc.get('type', '').lower() or doc.get('documentType', '').lower()
                doc_url = doc.get('url', '') or doc.get('documentUrl', '')

                # Check for 3D model indicators
                if doc_url and (
                    '3d' in doc_type or
                    'cad' in doc_type or
                    'model' in doc_type or
                    'step' in doc_type or
                    doc_url.lower().endswith(('.step', '.stp', '.igs', '.iges', '.stl'))
                ):
                    model_3d_url = doc_url
                    logger.debug(f"Element14: Extracted 3D model URL (type: {doc_type})")
                    break

            product_url = product.get('productUrl')
            element14_sku = product.get('sku', '')

            # Parameters from 'attributes' array
            parameters = {}
            package = None  # Initialize package before attributes loop
            eccn_code = None  # Will be extracted from attributes

            attributes = product.get('attributes', [])
            if attributes:
                for attr in attributes:
                    attr_name = attr.get('attributeLabel', '')
                    attr_value = attr.get('attributeValue', '')
                    attr_unit = attr.get('attributeUnit', '')

                    if attr_name and attr_value:
                        # Include unit if available (e.g., "192 KB" instead of just "192")
                        full_value = f"{attr_value} {attr_unit}".strip() if attr_unit else attr_value

                        # Keep original parameter name (with spaces) for PARAM_MAPPINGS matching
                        param_key = attr_name
                        # Store raw string for normalizer regex matching
                        parameters[param_key] = full_value

                        # Extract package from "IC Case / Package" attribute
                        if attr_name in ['IC Case / Package', 'Package', 'Package / Case', 'Case', 'Case Style', 'Package Type']:
                            package = attr_value
                            logger.debug(f"Element14: Extracted package '{package}' from attribute '{attr_name}'")

                        # Extract HTS/Tariff code
                        if attr_name.lower() == 'tariffcode':
                            parameters['hts_code'] = attr_value

                        # Extract ECCN codes
                        if attr_name.lower() == 'useccn':
                            eccn_code = attr_value
                            parameters['us_eccn'] = attr_value
                        elif attr_name.lower() == 'eueccn':
                            parameters['eu_eccn'] = attr_value

                        # Extract Product Range as product_series
                        if attr_name == 'Product Range':
                            product_series = attr_value

                        # Extract MSL (Moisture Sensitivity Level)
                        if attr_name == 'MSL':
                            parameters['msl'] = attr_value

                        # Extract SVHC compliance
                        if attr_name == 'SVHC':
                            parameters['svhc'] = attr_value

                        # Extract hazardous status
                        if attr_name.lower() == 'hazardous':
                            parameters['hazardous'] = attr_value

            # Additional Element14-specific fields
            pack_size = product.get('packSize')
            if pack_size:
                parameters['pack_size'] = str(pack_size)

            unit_of_measure = product.get('unitOfMeasure')
            if unit_of_measure:
                parameters['unit_of_measure'] = unit_of_measure

            # Minimum Order Quantity - Element14 uses 'translatedMinimumOrderQuality'
            min_order_qty = product.get('translatedMinimumOrderQuality') or product.get('minimumOrderQuantity')
            if min_order_qty:
                parameters['minimum_order_quantity'] = str(min_order_qty)

            # Order Multiple - Element14 uses 'orderMultiples'
            order_mult = product.get('orderMultiples')
            if order_mult:
                parameters['order_multiple'] = str(order_mult)

            # Packaging type from 'packageName' field (e.g., "Each", "Cut Tape", "Re-Reel")
            package_name = product.get('packageName')
            if package_name:
                parameters['packaging'] = package_name

            # Reeling available
            reeling = product.get('reeling')
            if reeling is not None:
                parameters['reeling_available'] = 'Yes' if reeling else 'No'

            # Re-reeling charge
            reel_charge = product.get('reReelingCharge')
            if reel_charge:
                parameters['reeling_charge'] = str(reel_charge)

            # Country of Origin
            country_of_origin = product.get('countryOfOrigin')
            if country_of_origin:
                parameters['country_of_origin'] = country_of_origin

            # Commodity Class Code
            commodity_code = product.get('commodityClassCode')
            if commodity_code:
                parameters['commodity_class_code'] = commodity_code

            # Product Overview fields
            if product_overview:
                # Key features (bullets)
                bullets = product_overview.get('bullets')
                if bullets:
                    parameters['key_features'] = bullets
                # Applications
                applications = product_overview.get('applications')
                if applications:
                    parameters['applications'] = applications
                # Warnings (supply chain alerts)
                warnings = product_overview.get('warnings')
                if warnings:
                    parameters['supply_warnings'] = warnings

            # Related/Alternative packaging options
            related_info = product.get('related', {})
            if related_info:
                packaging_options = related_info.get('packagingOptions', {})
                if packaging_options:
                    alt_sku = packaging_options.get('sku')
                    if alt_sku:
                        parameters['alternate_sku'] = alt_sku

            # RoHS compliance - Element14 uses 'rohsStatusCode' ('YES', 'NO', etc.)
            rohs_status = product.get('rohsStatusCode', '')
            rohs_compliant = None
            if rohs_status:
                if rohs_status.upper() in ['YES', 'COMPLIANT', 'ROHS3 COMPLIANT']:
                    rohs_compliant = True
                elif rohs_status.upper() in ['NO', 'NON-COMPLIANT', 'NOT COMPLIANT']:
                    rohs_compliant = False

            # ECCN code was extracted from attributes above (eccn_code variable)
            # No need to override here

            # Calculate match confidence
            # Normalize MPNs for comparison (remove common formatting differences)
            import re
            def normalize_mpn(mpn_str: str) -> str:
                """Normalize MPN by removing hyphens, spaces, slashes for comparison"""
                return re.sub(r'[\-\s/]', '', mpn_str.upper())

            product_mpn_upper = part_mpn.upper()
            search_mpn_upper = mpn.upper()
            product_mpn_norm = normalize_mpn(product_mpn_upper)
            search_mpn_norm = normalize_mpn(search_mpn_upper)

            if product_mpn_upper == search_mpn_upper:
                confidence = 100.0
            elif product_mpn_norm == search_mpn_norm:
                # Same MPN but different formatting (e.g., 172287-1103 vs 1722871103)
                confidence = 98.0
            elif search_mpn_upper in product_mpn_upper or search_mpn_norm in product_mpn_norm:
                confidence = 90.0
            elif product_mpn_upper in search_mpn_upper or product_mpn_norm in search_mpn_norm:
                confidence = 85.0
            else:
                confidence = 75.0

            return SupplierProductData(
                mpn=part_mpn,
                manufacturer=part_mfr,
                description=description,
                category=category,
                product_series=product_series,  # Extracted from "Product Range" attribute
                supplier_sku=element14_sku,
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
                eccn_code=eccn_code,
                supplier_name='Element14',
                supplier_url=product_url,
                last_updated=datetime.now(),
                match_confidence=confidence
            )

        except requests.exceptions.RequestException as e:
            logger.error(f"Element14 API error: {e}")
            return None

    def _parse_search_result(self, product: Dict[str, Any], search_mpn: str) -> Optional[SupplierSearchResult]:
        """Parse Element14 search result"""
        try:
            mpn = product.get('translatedManufacturerPartNumber', '')
            manufacturer = product.get('brandName', '')
            description = product.get('displayName', '')

            if not mpn or not manufacturer:
                return None

            # Extract availability
            availability_info = product.get('stock', {})
            availability = availability_info.get('level', 0)

            # Extract pricing
            prices = product.get('prices', [])
            unit_price = None
            currency = 'USD'

            if prices:
                # Find the lowest quantity price break
                min_qty_price = min(prices, key=lambda p: p.get('from', 999999))
                unit_price = min_qty_price.get('cost')
                currency = min_qty_price.get('currency', 'USD')

            # Extract URLs
            datasheet_url = product.get('datasheets', [{}])[0].get('url') if product.get('datasheets') else None
            product_url = product.get('productUrl')

            # Element14 SKU
            element14_sku = product.get('sku', '')

            # Calculate match confidence
            product_mpn_upper = mpn.upper()
            search_mpn_upper = search_mpn.upper()

            if product_mpn_upper == search_mpn_upper:
                confidence = 100.0
            elif search_mpn_upper in product_mpn_upper:
                confidence = 90.0
            else:
                confidence = 75.0

            return SupplierSearchResult(
                mpn=mpn,
                manufacturer=manufacturer,
                description=description,
                availability=availability,
                unit_price=unit_price,
                currency=currency,
                datasheet_url=datasheet_url,
                supplier_sku=element14_sku,
                supplier_url=product_url,
                lifecycle_status=None,
                match_confidence=confidence
            )

        except Exception as e:
            logger.error(f"Failed to parse Element14 search result: {e}")
            return None
