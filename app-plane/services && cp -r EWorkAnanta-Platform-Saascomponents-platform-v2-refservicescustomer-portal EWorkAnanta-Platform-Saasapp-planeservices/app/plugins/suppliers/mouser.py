"""
Mouser API Plugin

Mouser Electronics supplier integration for component search and enrichment.

Requirements:
- Mouser API key (from Mouser developer portal)

API Docs: https://www.mouser.com/api-hub/
"""

import requests
import logging
from typing import List, Optional, Dict, Any
from datetime import datetime

from .base import SupplierPlugin, SupplierSearchResult, SupplierProductData, SupplierAPIError
from .parameter_parser import ParameterParser

logger = logging.getLogger(__name__)


class MouserPlugin(SupplierPlugin):
    """
    Mouser API integration plugin.

    Configuration required:
    {
        "api_key": "your-api-key",
        "enabled": true
    }
    """

    BASE_URL = 'https://api.mouser.com/api/v1'

    def __init__(self, config: Dict[str, Any]):
        self.api_key = config.get('api_key')
        super().__init__(config)

    def validate_config(self) -> None:
        """Validate Mouser configuration"""
        if not self.api_key:
            raise ValueError("Mouser: api_key is required")

    def search_by_mpn(
        self,
        mpn: str,
        manufacturer: Optional[str] = None,
        limit: int = 10
    ) -> List[SupplierSearchResult]:
        """
        Search for component by MPN using Mouser Search API.

        Args:
            mpn: Manufacturer part number
            manufacturer: Optional manufacturer name
            limit: Maximum number of results

        Returns:
            List of search results
        """
        endpoint = f'{self.BASE_URL}/search/partnumber'

        # Build search query - combine manufacturer + MPN for better matching
        search_query = mpn
        if manufacturer:
            search_query = f"{manufacturer} {mpn}"

        params = {
            'apiKey': self.api_key
        }

        data = {
            'SearchByPartRequest': {
                'mouserPartNumber': search_query,  # Use combined search query
                'partSearchOptions': ''
            }
        }

        try:
            response = requests.post(
                endpoint,
                params=params,
                json=data,
                timeout=30
            )
            response.raise_for_status()
            result = response.json()

            # Parse search results
            search_results = result.get('SearchResults', {})
            parts = search_results.get('Parts', [])

            results = []
            for part in parts[:limit]:
                # DEBUG: Log all available fields from Mouser API
                logger.info(f"🔍 Mouser API response fields: {list(part.keys())}")
                logger.info(f"🔍 Full Mouser response for {mpn}: {part}")

                parsed = self._parse_search_result(part, mpn)
                if parsed:
                    results.append(parsed)

            logger.info(f"✅ Mouser search: found {len(results)} results for '{mpn}'")
            return results

        except requests.exceptions.RequestException as e:
            logger.error(f"❌ Mouser API Request Failed: POST {endpoint}")
            logger.error(f"   Search query: {search_query}")
            logger.error(f"   Error: {str(e)}")
            raise SupplierAPIError(f"Mouser API error: {e}", supplier="Mouser")

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
        # Call search to get raw Mouser data - combine manufacturer + MPN for better matching
        endpoint = f'{self.BASE_URL}/search/partnumber'
        params = {'apiKey': self.api_key}

        search_query = mpn
        if manufacturer:
            search_query = f"{manufacturer} {mpn}"

        data = {
            'SearchByPartRequest': {
                'mouserPartNumber': search_query,
                'partSearchOptions': ''
            }
        }

        try:
            response = requests.post(endpoint, params=params, json=data, timeout=30)
            response.raise_for_status()
            result = response.json()

            search_results = result.get('SearchResults', {})
            parts = search_results.get('Parts', [])

            if not parts:
                logger.info(f"Mouser: No results found for '{mpn}'")
                return None

            # Get first/best result and parse ALL fields
            part = parts[0]

            # Parse all 26+ Mouser fields (Phase 2: Now extracting full taxonomy)
            part_mpn = part.get('ManufacturerPartNumber', '')
            part_mfr = part.get('Manufacturer', '')
            description = part.get('Description', '')

            # PHASE 2: Extract full category taxonomy hierarchy
            # Mouser returns hierarchical category path like:
            # "Semiconductors > Integrated Circuits (ICs) > Microcontrollers - MCU"
            category_full = part.get('Category', '')  # Full hierarchical path
            subcategory = part.get('SubCategory', '')  # e.g., "ARM Microcontrollers - MCU"
            series = part.get('Series', '')  # e.g., "STM32F4"

            # Parse category hierarchy
            category_path = category_full if category_full else None
            if category_full and ' > ' in category_full:
                # Extract leaf node (last part) as category
                category_parts = category_full.split(' > ')
                category = category_parts[-1].strip()  # Last part = leaf node
            else:
                category = category_full if category_full else None

            # Product family and series
            product_family = subcategory if subcategory else None
            product_series = series if series else None

            lifecycle = part.get('LifecycleStatus', '')

            # Image URL
            image_url = part.get('ImagePath')  # NEW

            # 3D Model - Mouser may provide CADModels or MediaLinks array
            model_3d_url = None
            cad_models = part.get('CADModels', []) or part.get('MultimediaFiles', [])
            if cad_models:
                for model in cad_models:
                    model_url = model.get('Url', '') or model.get('FileUrl', '')
                    model_type = model.get('Type', '').lower() or model.get('FileType', '').lower()

                    # Check for 3D model indicators
                    if model_url and (
                        '3d' in model_type or
                        'cad' in model_type or
                        'step' in model_type or
                        model_url.lower().endswith(('.step', '.stp', '.igs', '.iges', '.stl'))
                    ):
                        model_3d_url = model_url
                        logger.debug(f"Mouser: Extracted 3D model URL (type: {model_type})")
                        break

            # Availability
            availability_str = part.get('Availability', '0').strip()
            try:
                availability = int(availability_str.replace(',', '').split()[0]) if availability_str and availability_str[0].isdigit() else 0
            except (ValueError, IndexError):
                availability = 0

            # Pricing
            price_breaks_raw = part.get('PriceBreaks', [])
            unit_price = None
            currency = 'USD'
            price_breaks = []

            for pb in price_breaks_raw:
                qty = pb.get('Quantity', 0)
                price_str = pb.get('Price', '0').replace('$', '').replace(',', '')
                price = float(price_str) if price_str else 0.0
                price_breaks.append({'quantity': qty, 'price': price})
                if unit_price is None:
                    unit_price = price
                    currency = pb.get('Currency', 'USD')

            # Lead time - parse "42 Days" to integer
            lead_time_days = None
            lead_time_str = part.get('LeadTime', '')  # NEW
            if lead_time_str:
                try:
                    # Extract first number from "42 Days"
                    import re
                    match = re.search(r'(\d+)', lead_time_str)
                    if match:
                        lead_time_days = int(match.group(1))
                        logger.debug(f"Mouser: Extracted lead time {lead_time_days} days from '{lead_time_str}'")
                except Exception as e:
                    logger.debug(f"Mouser: Failed to parse LeadTime '{lead_time_str}': {e}")
                    pass

            # URLs
            datasheet_url = part.get('DataSheetUrl')
            product_url = part.get('ProductDetailUrl')
            mouser_sku = part.get('MouserPartNumber', '')

            # Parameters from ProductAttributes
            parameters = {}
            package = None  # Initialize package before ProductAttributes loop

            product_attrs = part.get('ProductAttributes', [])  # NEW
            if product_attrs:
                for attr in product_attrs:
                    attr_name = attr.get('AttributeName', '')
                    attr_value = attr.get('AttributeValue', '')
                    if attr_name and attr_value:
                        # Keep original parameter name (with spaces) for PARAM_MAPPINGS matching
                        # Lowercase will happen in normalize_vendor_parameters
                        param_key = attr_name
                        # Store raw string for normalizer regex matching
                        # (ParameterParser can be used later for advanced parsing if needed)
                        parameters[param_key] = attr_value

                        # Extract package from "Package" or "Case Style" attributes for quality scorer RECOMMENDED_FIELDS
                        if attr_name in ['Package', 'Package / Case', 'Case', 'Case Style', 'Package Type', 'Case Type']:
                            package = attr_value
                            logger.debug(f"Mouser: Extracted package '{package}' from attribute '{attr_name}'")

            # Compliance - RoHS
            rohs_status = part.get('ROHSStatus', '')  # NEW
            rohs_compliant = None
            if 'compliant' in rohs_status.lower():
                rohs_compliant = True
            elif 'non' in rohs_status.lower() or 'not' in rohs_status.lower():
                rohs_compliant = False

            # Compliance - ECCN from ProductCompliance
            eccn_code = None
            product_compliance = part.get('ProductCompliance', [])  # NEW
            if product_compliance:
                for comp in product_compliance:
                    if comp.get('ComplianceName') == 'ECCN':
                        eccn_code = comp.get('ComplianceValue')
                        break

            # HTS code - Mouser may have this in ProductCompliance
            hts_code = None
            if product_compliance:
                for comp in product_compliance:
                    if comp.get('ComplianceName') in ['HTS', 'HTSCode', 'HTSUS']:
                        hts_code = comp.get('ComplianceValue')
                        break

            # Minimum Order Quantity - Mouser may have this in the part object
            min_order_qty = part.get('Min') or part.get('MinimumOrderQuantity') or part.get('Mult')
            if min_order_qty:
                parameters['minimum_order_quantity'] = str(min_order_qty)

            # Packaging type - Extract from ProductAttributes if available
            # Mouser uses 'Packaging' in ProductAttributes (e.g., "Reel", "Tube", "Bulk")
            packaging_type = None
            if product_attrs:
                for attr in product_attrs:
                    if attr.get('AttributeName', '').lower() in ['packaging', 'tape & reel']:
                        packaging_type = attr.get('AttributeValue')
                        parameters['packaging'] = packaging_type
                        break

            # Add HTS code to parameters for quality scorer RECOMMENDED_FIELDS
            if hts_code:
                parameters['hts_code'] = hts_code

            # Package was already extracted in the ProductAttributes loop above (lines 245-248)
            # No need to reassign it here - just use the extracted value

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
                # Phase 2: Full taxonomy hierarchy
                category_path=category_path,
                subcategory=subcategory,
                product_family=product_family,
                product_series=product_series,
                supplier_sku=mouser_sku,
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
                supplier_name='Mouser',
                supplier_url=product_url,
                last_updated=datetime.now(),
                match_confidence=confidence
            )

        except requests.exceptions.RequestException as e:
            logger.error(f"Mouser API error: {e}")
            return None

    def _parse_search_result(self, part: Dict[str, Any], search_mpn: str) -> Optional[SupplierSearchResult]:
        """Parse Mouser search result"""
        try:
            mpn = part.get('ManufacturerPartNumber', '')
            manufacturer = part.get('Manufacturer', '')
            description = part.get('Description', '')

            if not mpn or not manufacturer:
                return None

            # Extract availability - handle both numeric and text formats
            availability_str = part.get('Availability', '0').strip()
            try:
                # Try parsing as number: "1,234 In Stock" → 1234
                if availability_str and availability_str[0].isdigit():
                    availability = int(availability_str.replace(',', '').split()[0])
                else:
                    # Non-numeric format: "Out of Stock", "Contact Mouser", etc.
                    availability = 0
            except (ValueError, IndexError):
                # Fallback for any parsing errors
                availability = 0

            # Extract pricing
            price_breaks = part.get('PriceBreaks', [])
            unit_price = None
            currency = 'USD'

            if price_breaks:
                first_break = price_breaks[0]
                unit_price = float(first_break.get('Price', '0').replace('$', '').replace(',', ''))
                currency = first_break.get('Currency', 'USD')

            # Extract URLs
            datasheet_url = part.get('DataSheetUrl')
            product_url = part.get('ProductDetailUrl')

            # Mouser part number (SKU)
            mouser_sku = part.get('MouserPartNumber', '')

            # Lifecycle status
            lifecycle = part.get('LifecycleStatus', '')

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
                supplier_sku=mouser_sku,
                supplier_url=product_url,
                lifecycle_status=lifecycle,
                match_confidence=confidence
            )

        except Exception as e:
            logger.error(f"Failed to parse Mouser search result: {e}")
            return None
