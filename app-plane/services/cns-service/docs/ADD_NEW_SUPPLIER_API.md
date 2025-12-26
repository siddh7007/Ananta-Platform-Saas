# Adding New Supplier API Integration

**Version:** 1.0
**Last Updated:** 2025-01-11
**Audience:** Developers extending the CNS (Component Normalization Service)

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture Summary](#architecture-summary)
3. [Prerequisites](#prerequisites)
4. [Step-by-Step Implementation](#step-by-step-implementation)
   - [Step 1: Create the Plugin File](#step-1-create-the-plugin-file)
   - [Step 2: Register Plugin in Manager](#step-2-register-plugin-in-manager)
   - [Step 3: Add Configuration Settings](#step-3-add-configuration-settings)
   - [Step 4: Update Environment Variables](#step-4-update-environment-variables)
   - [Step 5: Update UI Components](#step-5-update-ui-components)
   - [Step 6: Update Quality Scorer (Optional)](#step-6-update-quality-scorer-optional)
   - [Step 7: OAuth Token Persistence (OAuth2 Only)](#step-7-oauth-token-persistence-for-oauth2-suppliers-only)
   - [Step 8: Add OAuth API Endpoints (OAuth2 Only)](#step-8-add-oauth-api-endpoints-for-oauth2-suppliers-only)
5. [Files to Modify](#files-to-modify)
6. [Testing Checklist](#testing-checklist)
7. [Best Practices](#best-practices)
8. [Reference: Existing Plugins](#reference-existing-plugins)
9. [Appendices](#appendix-a-common-field-mappings)
   - [A: Common Field Mappings](#appendix-a-common-field-mappings)
   - [B: HTTP Timeout Best Practices](#appendix-b-http-timeout-best-practices)
   - [C: Circuit Breaker Configuration](#appendix-c-circuit-breaker-configuration)
   - [D: Input Validation](#appendix-d-input-validation)

---

## Overview

The CNS service uses a **modular plugin architecture** for supplier API integrations. Each supplier (DigiKey, Mouser, Element14, etc.) is implemented as a self-contained plugin that:

- Implements the `SupplierPlugin` abstract base class
- Handles authentication (API Key or OAuth2)
- Searches by MPN (Manufacturer Part Number)
- Returns enriched product data
- Is isolated via circuit breakers and rate limiters

---

## Architecture Summary

```
┌─────────────────────────────────────────────────────────────────┐
│                    SupplierPluginManager                        │
│  (app/plugins/suppliers/manager.py)                             │
│  - Loads all plugins from SUPPLIER_PLUGINS registry             │
│  - Manages circuit breakers per vendor                          │
│  - Enforces rate limits via Redis                               │
│  - Aggregates results from multiple suppliers                   │
└──────────────────────┬──────────────────────────────────────────┘
                       │
        ┌──────────────┼──────────────┬──────────────┐
        ▼              ▼              ▼              ▼
┌───────────────┐ ┌───────────────┐ ┌───────────────┐ ┌───────────────┐
│ DigiKeyPlugin │ │ MouserPlugin  │ │Element14Plugin│ │ [NEW PLUGIN]  │
│ (OAuth2)      │ │ (API Key)     │ │ (API Key)     │ │               │
└───────────────┘ └───────────────┘ └───────────────┘ └───────────────┘
        │              │              │              │
        └──────────────┴──────────────┴──────────────┘
                       │
                       ▼
              SupplierPlugin (ABC)
              app/plugins/suppliers/base.py
```

---

## Prerequisites

Before implementing a new supplier integration:

1. **API Documentation**: Obtain and review the supplier's API documentation
2. **API Credentials**: Get API key, client ID/secret, or OAuth credentials
3. **Rate Limits**: Understand the supplier's rate limiting policy
4. **Response Format**: Map the supplier's response fields to our data models

---

## Step-by-Step Implementation

### Step 1: Create the Plugin File

Create a new file: `app/plugins/suppliers/{supplier_name}.py`

#### Template:

```python
"""
{SupplierName} API Plugin

{Brief description of the supplier}

Requirements:
- {List API credentials needed}

API Docs: {URL to API documentation}
"""

import requests
import logging
from typing import List, Optional, Dict, Any
from datetime import datetime

from .base import SupplierPlugin, SupplierSearchResult, SupplierProductData, SupplierAPIError
from .parameter_parser import ParameterParser, extract_compliance_data

logger = logging.getLogger(__name__)


class {SupplierName}Plugin(SupplierPlugin):
    """
    {SupplierName} API integration plugin.

    Configuration required:
    {
        "api_key": "your-api-key",          # For API Key auth
        "client_id": "your-client-id",      # For OAuth
        "client_secret": "your-client-secret",
        "enabled": true,
        "sandbox": false
    }
    """

    def __init__(self, config: Dict[str, Any]):
        # Store configuration
        self.api_key = config.get('api_key')
        # OR for OAuth:
        # self.client_id = config.get('client_id')
        # self.client_secret = config.get('client_secret')

        # API endpoints
        self.base_url = config.get('base_url', 'https://api.supplier.com/v1')

        # Create HTTP session with retries
        self.session = requests.Session()

        # Call parent init (validates config)
        super().__init__(config)

    def validate_config(self) -> None:
        """Validate plugin configuration"""
        if not self.api_key:
            raise ValueError("{SupplierName}: api_key is required")
        # Add more validation as needed

    def search_by_mpn(
        self,
        mpn: str,
        manufacturer: Optional[str] = None,
        limit: int = 10
    ) -> List[SupplierSearchResult]:
        """
        Search for component by MPN.

        Args:
            mpn: Manufacturer part number to search for
            manufacturer: Optional manufacturer name filter
            limit: Maximum results to return

        Returns:
            List of SupplierSearchResult objects
        """
        results = []

        try:
            # Build API request
            headers = self._get_auth_headers()

            # NOTE: Most supplier APIs use POST for search (not GET)
            # Example: Mouser uses POST with JSON body
            # Adjust based on your supplier's API documentation

            # Option A: GET request (simpler APIs)
            # params = {'keyword': mpn, 'limit': limit}
            # response = self.session.get(f"{self.base_url}/search", headers=headers, params=params, timeout=30)

            # Option B: POST request (Mouser, DigiKey pattern - more common)
            data = {
                'SearchRequest': {
                    'partNumber': mpn,
                    'manufacturer': manufacturer,
                    'limit': limit
                }
            }
            response = self.session.post(
                f"{self.base_url}/search",
                headers=headers,
                json=data,
                timeout=30
            )

            # Handle errors
            if response.status_code != 200:
                raise SupplierAPIError(
                    f"Search failed: {response.text}",
                    supplier=self.name,
                    status_code=response.status_code
                )

            # Parse response
            data = response.json()

            for item in data.get('products', []):
                results.append(SupplierSearchResult(
                    mpn=item.get('manufacturerPartNumber', ''),
                    manufacturer=item.get('manufacturer', ''),
                    description=item.get('description', ''),
                    availability=item.get('stockQuantity'),
                    unit_price=item.get('unitPrice'),
                    currency=item.get('currency', 'USD'),
                    datasheet_url=item.get('datasheetUrl'),
                    supplier_sku=item.get('supplierPartNumber'),
                    supplier_url=item.get('productUrl'),
                    lifecycle_status=item.get('lifecycleStatus'),
                    match_confidence=self._calculate_match_confidence(mpn, item)
                ))

        except requests.RequestException as e:
            raise SupplierAPIError(
                f"Network error: {e}",
                supplier=self.name
            )

        return results

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
            SupplierProductData or None if not found
        """
        try:
            headers = self._get_auth_headers()

            # Make API call for detailed product info
            response = self.session.get(
                f"{self.base_url}/products/{mpn}",
                headers=headers,
                timeout=30
            )

            if response.status_code == 404:
                return None

            if response.status_code != 200:
                raise SupplierAPIError(
                    f"Get details failed: {response.text}",
                    supplier=self.name,
                    status_code=response.status_code
                )

            data = response.json()

            # Extract compliance data
            compliance = extract_compliance_data(data.get('compliance', {}))

            # Extract parameters
            params = self._extract_parameters(data.get('parameters', []))

            return SupplierProductData(
                # Basic info
                mpn=data.get('manufacturerPartNumber', mpn),
                manufacturer=data.get('manufacturer', ''),
                description=data.get('description', ''),
                category=data.get('category'),

                # Category hierarchy (Phase 2)
                category_path=data.get('categoryPath'),
                subcategory=data.get('subcategory'),
                product_family=data.get('productFamily'),
                product_series=data.get('productSeries'),

                # Availability & Pricing
                supplier_sku=data.get('supplierPartNumber'),
                availability=data.get('stockQuantity'),
                unit_price=data.get('unitPrice'),
                currency=data.get('currency', 'USD'),
                price_breaks=data.get('priceBreaks', []),
                lead_time_days=data.get('leadTimeDays'),

                # Technical
                datasheet_url=data.get('datasheetUrl'),
                image_url=data.get('imageUrl'),
                model_3d_url=data.get('cadModelUrl'),
                lifecycle_status=data.get('lifecycleStatus'),
                package=data.get('package'),

                # Parameters
                parameters=params,

                # Compliance
                rohs_compliant=compliance.get('rohs'),
                reach_compliant=compliance.get('reach'),
                halogen_free=compliance.get('halogen_free'),
                aec_qualified=compliance.get('aec_q100') or compliance.get('aec_q200'),
                eccn_code=compliance.get('eccn'),

                # Metadata
                supplier_name=self.name,
                supplier_url=data.get('productUrl'),
                last_updated=datetime.utcnow(),
                match_confidence=100.0
            )

        except requests.RequestException as e:
            raise SupplierAPIError(
                f"Network error: {e}",
                supplier=self.name
            )

    def _get_auth_headers(self) -> Dict[str, str]:
        """Build authentication headers"""
        return {
            'Authorization': f'Bearer {self.api_key}',
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        }

    def _calculate_match_confidence(self, search_mpn: str, item: Dict) -> float:
        """Calculate match confidence score (0-100)"""
        result_mpn = item.get('manufacturerPartNumber', '')

        # Exact match
        if result_mpn.upper() == search_mpn.upper():
            return 100.0

        # Partial match
        if search_mpn.upper() in result_mpn.upper():
            return 90.0

        return 70.0

    def _extract_parameters(self, raw_params: List[Dict]) -> Dict[str, Any]:
        """Extract and normalize technical parameters"""
        params = {}

        for p in raw_params:
            name = p.get('name', '').lower().replace(' ', '_')
            value = p.get('value')
            unit = p.get('unit')

            if name and value is not None:
                params[name] = {
                    'value': value,
                    'unit': unit
                } if unit else value

        return params
```

---

### Step 2: Register Plugin in Manager

**File:** `app/plugins/suppliers/manager.py`

#### 2.1 Add Import

```python
# Add at top with other imports
from .{supplier_name} import {SupplierName}Plugin
```

#### 2.2 Add to SupplierName Enum

```python
class SupplierName(str, Enum):
    """Supported supplier names"""
    DIGIKEY = 'digikey'
    MOUSER = 'mouser'
    ELEMENT14 = 'element14'
    {SUPPLIER_UPPER} = '{supplier_name}'  # ADD THIS
```

#### 2.3 Add to SUPPLIER_PLUGINS Registry

```python
# Plugin registry mapping supplier name to plugin class
SUPPLIER_PLUGINS = {
    SupplierName.DIGIKEY: DigiKeyPlugin,
    SupplierName.MOUSER: MouserPlugin,
    SupplierName.ELEMENT14: Element14Plugin,
    SupplierName.{SUPPLIER_UPPER}: {SupplierName}Plugin,  # ADD THIS
}
```

---

### Step 3: Add Configuration Settings

**File:** `app/config.py`

Add configuration fields in the `Settings` class:

```python
# ===================================
# Supplier API Configuration - {SupplierName}
# ===================================
{supplier_name}_enabled: bool = Field(default=False, alias="{SUPPLIER_UPPER}_ENABLED")
{supplier_name}_api_key: Optional[str] = Field(default=None, alias="{SUPPLIER_UPPER}_API_KEY")
{supplier_name}_base_url: str = Field(
    default="https://api.{supplier}.com/v1",
    alias="{SUPPLIER_UPPER}_BASE_URL"
)
{supplier_name}_rate_limit: int = Field(default=100, alias="{SUPPLIER_UPPER}_RATE_LIMIT")  # per hour
```

For OAuth-based suppliers, add:

```python
{supplier_name}_client_id: Optional[str] = Field(default=None, alias="{SUPPLIER_UPPER}_CLIENT_ID")
{supplier_name}_client_secret: Optional[str] = Field(default=None, alias="{SUPPLIER_UPPER}_CLIENT_SECRET")
{supplier_name}_access_token: Optional[str] = Field(default=None, alias="{SUPPLIER_UPPER}_ACCESS_TOKEN")
{supplier_name}_refresh_token: Optional[str] = Field(default=None, alias="{SUPPLIER_UPPER}_REFRESH_TOKEN")
{supplier_name}_token_expires_at: Optional[str] = Field(default=None, alias="{SUPPLIER_UPPER}_TOKEN_EXPIRES_AT")
{supplier_name}_sandbox: bool = Field(default=True, alias="{SUPPLIER_UPPER}_SANDBOX")
```

Update `get_enabled_tier1_suppliers()` or add `get_enabled_tier2_suppliers()` as appropriate.

---

### Step 4: Update Environment Variables

**Files to update:**

#### 4.1 Local Development: `.env` or `.env.local`

```bash
# {SupplierName} Configuration
{SUPPLIER_UPPER}_ENABLED=true
{SUPPLIER_UPPER}_API_KEY=your-api-key-here
{SUPPLIER_UPPER}_BASE_URL=https://api.supplier.com/v1
{SUPPLIER_UPPER}_RATE_LIMIT=100
```

#### 4.2 Docker: `docker-compose.yml`

Add environment variables to the `cns-service` service:

```yaml
cns-service:
  environment:
    - {SUPPLIER_UPPER}_ENABLED=${{{SUPPLIER_UPPER}_ENABLED:-false}}
    - {SUPPLIER_UPPER}_API_KEY=${{{SUPPLIER_UPPER}_API_KEY:-}}
    - {SUPPLIER_UPPER}_BASE_URL=${{{SUPPLIER_UPPER}_BASE_URL:-https://api.supplier.com/v1}}
    - {SUPPLIER_UPPER}_RATE_LIMIT=${{{SUPPLIER_UPPER}_RATE_LIMIT:-100}}
```

---

### Step 5: Update UI Components

#### 5.1 Supplier APIs Configuration Page

**File:** `dashboard/src/config/SupplierAPIsConfig.tsx`

##### 5.1.1 Add to SupplierConfigs interface:

```typescript
interface SupplierConfigs {
  tier1: {
    mouser: SupplierConfig;
    digikey: SupplierConfig;
    element14: SupplierConfig;
  };
  tier2: {
    octopart: SupplierConfig;
    siliconexpert: SupplierConfig;
    {supplierName}: SupplierConfig;  // ADD THIS
  };
  // ...
}
```

##### 5.1.2 Add to DEFAULT_CONFIGS:

```typescript
const DEFAULT_CONFIGS: SupplierConfigs = {
  // ...
  tier2: {
    // ...
    {supplierName}: {
      enabled: false,
      apiKey: '',
      baseUrl: 'https://api.{supplier}.com/v1',
      rateLimit: 100,
    },
  },
};
```

##### 5.1.3 Add Tab and Form Fields:

In the render section, add a new `<TabPanel>` for the supplier with appropriate form fields.

---

#### 5.2 Supplier Status Dashboard

**File:** `dashboard/src/dashboard/SupplierStatus.tsx`

Add the new supplier to the status display:

```typescript
const SUPPLIERS = [
  { name: 'digikey', label: 'DigiKey', color: '#cc0000' },
  { name: 'mouser', label: 'Mouser', color: '#0066cc' },
  { name: 'element14', label: 'Element14', color: '#ff6600' },
  { name: '{supplierName}', label: '{SupplierName}', color: '#00cc66' },  // ADD
];
```

---

#### 5.3 Supplier Chip Component

**File:** `dashboard/src/components/shared/SupplierChip.tsx`

Add supplier color mapping:

```typescript
const supplierColors: Record<string, string> = {
  digikey: '#cc0000',
  mouser: '#0066cc',
  element14: '#ff6600',
  {supplierName}: '#00cc66',  // ADD
};
```

---

#### 5.4 Theme Configuration

**File:** `dashboard/src/theme.ts` (or similar)

If using a centralized theme, add:

```typescript
export const getSupplierColor = (supplier: string): string => {
  const colors: Record<string, string> = {
    digikey: '#cc0000',
    mouser: '#0066cc',
    element14: '#ff6600',
    {supplierName}: '#00cc66',  // ADD
  };
  return colors[supplier.toLowerCase()] || '#666666';
};
```

---

### Step 6: Update Quality Scorer (Optional)

If the new supplier has different data quality characteristics, update the quality scorer.

**File:** `app/core/quality_scorer.py`

```python
# Source quality scores (lines 126-144 in quality_scorer.py)
SOURCE_QUALITY_SCORES = {
    # Tier 1: Official distributors with verified data
    "mouser": 100,
    "digikey": 100,
    "element14": 95,
    "newark": 95,
    "avnet": 90,
    "arrow": 90,
    "{supplier_name}": 90,  # ADD - adjust score based on data quality tier

    # Tier 2: Aggregators with good data quality
    "octopart": 85,
    "findchips": 80,
    "siliconexpert": 90,

    # Tier 3: Web scraping / unknown
    "web_scrape": 50,
    "unknown": 40,
    "manual_entry": 70,
}
```

**Quality Score Tier Guidelines:**
| Tier | Score Range | Criteria |
|------|-------------|----------|
| Tier 1 | 95-100 | Authorized distributor, verified data, official API |
| Tier 2 | 80-94 | Aggregator with good data quality, multiple sources |
| Tier 3 | 50-79 | Web scraping, manufacturer direct, unknown quality |

---

### Step 7: OAuth Token Persistence (For OAuth2 Suppliers Only)

If your supplier uses OAuth2 (like DigiKey), tokens need to survive service restarts.

**File:** `app/services/supplier_manager_service.py`

Add a configuration block for your supplier in the `initialize_supplier_manager()` function:

```python
# ===================================
# {SupplierName} Configuration (OAuth2)
# ===================================
if settings.{supplier_name}_enabled:
    # Load persisted tokens (survives restarts)
    stored_tokens = load_supplier_tokens('{supplier_name}')
    access_token = stored_tokens.get('access_token') or settings.{supplier_name}_access_token
    refresh_token = stored_tokens.get('refresh_token') or settings.{supplier_name}_refresh_token
    token_expires_at = stored_tokens.get('expires_at') or getattr(settings, '{supplier_name}_token_expires_at', None)
    has_credentials = bool(settings.{supplier_name}_client_id and settings.{supplier_name}_client_secret)
    has_access_token = bool(access_token)

    supplier_config['{supplier_name}'] = {
        'client_id': settings.{supplier_name}_client_id,
        'client_secret': settings.{supplier_name}_client_secret,
        'access_token': access_token,
        'refresh_token': refresh_token,
        'token_expires_at': token_expires_at,
        'base_url': settings.{supplier_name}_base_url,
        'sandbox': getattr(settings, '{supplier_name}_sandbox', False),
        'rate_limit': settings.{supplier_name}_rate_limit,
        # IMPORTANT: Callback to persist tokens after refresh
        'token_save_callback': partial(save_supplier_tokens, '{supplier_name}'),
        'enabled': has_credentials and has_access_token
    }

    if has_credentials and has_access_token:
        logger.info("  [OK] {SupplierName}: enabled")
    elif has_credentials:
        logger.warning("  [WARN] {SupplierName}: configured but missing OAuth2 access token")
    else:
        logger.info("  [SKIP] {SupplierName}: disabled (no credentials)")
else:
    logger.info("  [SKIP] {SupplierName}: disabled by config")
    supplier_config['{supplier_name}'] = {'enabled': False}
```

**Token Persistence Table:**

The `supplier_tokens` table is auto-created by `app/services/supplier_token_store.py`:

```sql
CREATE TABLE IF NOT EXISTS supplier_tokens (
    supplier_name TEXT PRIMARY KEY,
    access_token TEXT,
    refresh_token TEXT,
    expires_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

### Step 8: Add OAuth API Endpoints (For OAuth2 Suppliers Only)

**File:** `app/api/suppliers.py`

Add OAuth endpoints for your supplier:

```python
# {SupplierName} OAuth Endpoints

@router.get("/{supplier_name}/oauth/url")
def get_{supplier_name}_oauth_url(
    authorization: Optional[str] = Header(default=None),
    auth_context: AuthContext = Depends(get_auth_context),
):
    """Get {SupplierName} OAuth2 authorization URL"""
    _require_admin_authorization_with_context(authorization, auth_context)
    # Build and return authorization URL
    ...

@router.post("/{supplier_name}/oauth/token")
def exchange_{supplier_name}_oauth_code(
    request: OAuthTokenRequest,
    authorization: Optional[str] = Header(default=None),
    auth_context: AuthContext = Depends(get_auth_context),
):
    """Exchange authorization code for access token"""
    _require_admin_authorization_with_context(authorization, auth_context)
    # Exchange code, save tokens, reset manager
    ...

@router.post("/{supplier_name}/oauth/refresh")
def refresh_{supplier_name}_oauth_token(
    authorization: Optional[str] = Header(default=None),
    auth_context: AuthContext = Depends(get_auth_context),
):
    """Refresh OAuth access token"""
    _require_admin_authorization_with_context(authorization, auth_context)
    # Refresh token, save, reset manager
    ...
```

**See DigiKey OAuth implementation** in `app/api/suppliers.py:520-701` for complete example.

---

## Files to Modify

### Backend (CNS Service)

| File | Change Type | Description |
|------|-------------|-------------|
| `app/plugins/suppliers/{supplier_name}.py` | **CREATE** | New plugin implementation |
| `app/plugins/suppliers/manager.py` | MODIFY | Import, enum, registry |
| `app/plugins/suppliers/__init__.py` | MODIFY | Export new plugin |
| `app/config.py` | MODIFY | Add config fields |
| `app/core/quality_scorer.py` | MODIFY | Add source quality score (lines 126-144) |
| `app/services/supplier_manager_service.py` | MODIFY | Add config loader block (OAuth only) |
| `app/api/suppliers.py` | MODIFY | Add OAuth endpoints (OAuth only) |

### Configuration

| File | Change Type | Description |
|------|-------------|-------------|
| `.env` | MODIFY | Add env vars for local dev |
| `docker-compose.yml` | MODIFY | Add env vars for Docker |

### Frontend (Dashboard)

| File | Change Type | Description |
|------|-------------|-------------|
| `dashboard/src/config/SupplierAPIsConfig.tsx` | MODIFY | Add config UI |
| `dashboard/src/config/SupplierConfigCard.tsx` | MODIFY | If custom fields needed |
| `dashboard/src/dashboard/SupplierStatus.tsx` | MODIFY | Add to status display |
| `dashboard/src/components/shared/SupplierChip.tsx` | MODIFY | Add color |
| `dashboard/src/theme.ts` | MODIFY | Add supplier color |

---

## Testing Checklist

### Unit Tests

- [ ] Plugin initializes with valid config
- [ ] Plugin throws on invalid config
- [ ] `search_by_mpn()` returns valid results
- [ ] `search_by_mpn()` handles API errors gracefully
- [ ] `get_product_details()` returns complete data
- [ ] `get_product_details()` returns None for not found
- [ ] Rate limiting is respected
- [ ] Circuit breaker triggers on failures

### Integration Tests

- [ ] Plugin loads via SupplierPluginManager
- [ ] Plugin appears in enabled suppliers list when configured
- [ ] Enrichment uses new supplier when enabled
- [ ] Results merge correctly with other suppliers
- [ ] Quality scores reflect supplier source

### UI Tests

- [ ] Config page shows new supplier
- [ ] Enable/disable toggle works
- [ ] API credentials save correctly
- [ ] Test connection button works
- [ ] Supplier status shows in dashboard
- [ ] Supplier chip renders with correct color

---

## Best Practices

### 1. Error Handling

Always wrap API calls and raise `SupplierAPIError`:

```python
try:
    response = self.session.get(url, timeout=30)
except requests.Timeout:
    raise SupplierAPIError("Request timeout", supplier=self.name)
except requests.ConnectionError:
    raise SupplierAPIError("Connection failed", supplier=self.name)
```

### 2. Rate Limiting

The manager handles rate limiting, but log warnings:

```python
logger.info(f"[OK] {self.name}: found {len(results)} results for '{mpn}'")
```

### 3. Data Normalization

Use `ParameterParser` for consistent parameter extraction:

```python
from .parameter_parser import ParameterParser, extract_compliance_data
```

### 4. No Emojis in Logs

Per CLAUDE.md guidelines, use text markers:

```python
# Good
logger.info(f"[OK] {self.name}: initialized successfully")
logger.warning(f"[WARN] {self.name}: rate limit approaching")
logger.error(f"[ERROR] {self.name}: API request failed")

# Bad (avoid)
logger.info(f"✅ {self.name}: initialized successfully")
```

### 5. Thread Safety

For OAuth token refresh, use locks:

```python
import threading

self._refresh_lock = threading.Lock()

def _refresh_token(self):
    with self._refresh_lock:
        # Token refresh logic
```

---

## Reference: Existing Plugins

Study these implementations as reference:

| Plugin | Auth Type | Key Features |
|--------|-----------|--------------|
| `digikey.py` | OAuth2 | Token refresh, retry, 3D models |
| `mouser.py` | API Key | Category taxonomy, CAD models |
| `element14.py` | API Key | Multi-store (UK/US/APAC), JSONP |

### DigiKey (OAuth2 Example)

- Thread-safe token refresh with `_refresh_lock`
- Automatic token persistence via callback
- ProductDetails API + keyword search fallback

### Mouser (API Key Example)

- Simple API key authentication
- Full category hierarchy extraction
- CAD model URLs

### Element14 (Multi-Store Example)

- Store-based endpoints (Farnell, Newark, Element14)
- JSONP response unwrapping
- Regional pricing

---

## Summary

Adding a new supplier API requires:

1. **Create plugin** implementing `SupplierPlugin` ABC
2. **Register** in manager's enum and registry
3. **Add config** fields in `config.py`
4. **Set env vars** for development and Docker
5. **Update UI** for configuration and status display
6. **Test** unit, integration, and UI

The modular architecture ensures new suppliers are isolated and don't affect existing integrations.

---

## Appendix A: Common Field Mappings

Use this table to map supplier API response fields to `SupplierProductData`:

| SupplierProductData Field | Mouser Field | DigiKey Field | Element14 Field |
|---------------------------|--------------|---------------|-----------------|
| `mpn` | `ManufacturerPartNumber` | `ManufacturerPartNumber` | `translatedManufacturerPartNumber` |
| `manufacturer` | `Manufacturer` | `Manufacturer.Value` | `vendorName` |
| `description` | `Description` | `ProductDescription` | `displayName` |
| `category` | `Category` (leaf) | `Category.Value` | `categoryPath[-1]` |
| `category_path` | `Category` (full) | `LimitedTaxonomy.Value` | `categoryPath.join(' > ')` |
| `supplier_sku` | `MouserPartNumber` | `DigiKeyPartNumber` | `sku` |
| `availability` | `Availability` | `QuantityAvailable` | `inv` |
| `unit_price` | `PriceBreaks[0].Price` | `UnitPrice` | `prices[0].cost` |
| `price_breaks` | `PriceBreaks[]` | `StandardPricing[]` | `prices[]` |
| `datasheet_url` | `DataSheetUrl` | `PrimaryDatasheet` | `datasheets[0].url` |
| `image_url` | `ImagePath` | `PrimaryPhoto` | `image.baseName` |
| `lifecycle_status` | `LifecycleStatus` | `ProductStatus` | `productStatus` |
| `package` | `ProductAttributes[Package]` | `Parameters[Package]` | `attributes[Package]` |
| `parameters` | `ProductAttributes[]` | `Parameters[]` | `attributes[]` |
| `rohs_compliant` | `ROHSStatus` | `RoHSStatus` | `rohsStatusCode` |
| `lead_time_days` | `LeadTime` | `ManufacturerLeadWeeks * 7` | `leadTime` |

---

## Appendix B: HTTP Timeout Best Practices

| Operation | Recommended Timeout | Rationale |
|-----------|---------------------|-----------|
| Search (`search_by_mpn`) | 30 seconds | Search may query large catalogs |
| Product Details (`get_product_details`) | 30 seconds | Full product data retrieval |
| Token Refresh (OAuth) | 20 seconds | OAuth server should respond quickly |
| Health Check | 10 seconds | Quick connectivity test |
| Connectivity Check | 5 seconds | Very basic ping |

```python
# Example with custom timeouts
response = self.session.post(
    endpoint,
    headers=headers,
    json=data,
    timeout=(5, 30)  # (connect_timeout, read_timeout)
)
```

---

## Appendix C: Circuit Breaker Configuration

The `SupplierPluginManager` uses circuit breakers to isolate supplier failures:

| Setting | Default | Description |
|---------|---------|-------------|
| `failure_threshold` | 5 | Failures before circuit opens |
| `recovery_timeout` | 30 seconds | Time before half-open state |
| `half_open_requests` | 1 | Test requests in half-open state |

Circuit breaker states:
- **CLOSED**: Normal operation, requests pass through
- **OPEN**: All requests fail fast (supplier down)
- **HALF_OPEN**: Limited test requests to check recovery

---

## Appendix D: Input Validation

Use the validation models from `app/core/input_validation.py`:

```python
from app.core.input_validation import (
    ValidatedMPN,      # MPN with XSS/injection prevention
    ValidatedSupplier, # Supplier data validation
    InputSanitizer     # General sanitization utilities
)

# In API endpoint
class SearchRequest(BaseModel):
    mpn: ValidatedMPN  # Auto-validates and sanitizes MPN
    manufacturer: Optional[ValidatedSupplier] = None
```

**MPN Validation Rules:**
- Max 50 characters
- Alphanumeric, dash, plus, forward slash only
- Blocks: `'`, `"`, `;`, `--`, `*/`, `$`, `{`, `}`, backtick

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.1 | 2025-01-11 | Added OAuth token persistence, field mappings, timeouts, circuit breaker docs |
| 1.0 | 2025-01-11 | Initial documentation |
