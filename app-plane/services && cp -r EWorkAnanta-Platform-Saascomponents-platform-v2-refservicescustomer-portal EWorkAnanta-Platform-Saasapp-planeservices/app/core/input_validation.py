"""
CRITICAL-6: Input Validation & Sanitization

Prevents SQL injection, XSS, command injection attacks
"""

import re
import logging
from typing import Any, Optional, Dict, List
from pydantic import BaseModel, validator

logger = logging.getLogger(__name__)


class MPNValidator:
    """MPN (Manufacturer Part Number) validation"""
    
    # Valid MPN pattern: alphanumeric, dash, plus, forward slash
    PATTERN = re.compile(r'^[A-Z0-9\-+/]+$')
    MAX_LENGTH = 50
    
    @staticmethod
    def validate(mpn: str) -> bool:
        """Validate MPN format"""
        if not mpn or len(mpn) > MPNValidator.MAX_LENGTH:
            return False
        
        # Check for injection patterns
        dangerous_patterns = ["'", '"', ";", "--", "*/", "/*", "xp_", "sp_", "$", "{", "}", "`"]
        for pattern in dangerous_patterns:
            if pattern in mpn:
                logger.warning(f"Blocked injection attempt in MPN: {pattern}")
                return False
        
        # Check format
        if not MPNValidator.PATTERN.match(mpn.upper()):
            logger.warning(f"Invalid MPN format: {mpn}")
            return False
        
        return True
    
    @staticmethod
    def sanitize(mpn: str) -> str:
        """Sanitize MPN"""
        if not mpn:
            return ""
        # Normalize to uppercase and remove spaces
        sanitized = mpn.upper().strip()
        # Remove any invalid characters
        sanitized = re.sub(r'[^A-Z0-9\-+/]', '', sanitized)
        return sanitized


class CategoryValidator:
    """Category name validation"""
    
    PATTERN = re.compile(r'^[A-Z0-9\s\-&().,/]+$')
    MAX_LENGTH = 200
    
    @staticmethod
    def validate(category: str) -> bool:
        """Validate category name"""
        if not category or len(category) > CategoryValidator.MAX_LENGTH:
            return False
        
        # Check for HTML tags
        if '<' in category or '>' in category:
            logger.warning(f"Blocked XSS attempt in category")
            return False
        
        # Check for injection patterns
        if "'" in category or '"' in category or ";" in category:
            logger.warning(f"Blocked injection attempt in category")
            return False
        
        # Check format
        if not CategoryValidator.PATTERN.match(category.upper()):
            logger.warning(f"Invalid category format: {category}")
            return False
        
        return True
    
    @staticmethod
    def sanitize(category: str) -> str:
        """Sanitize category"""
        if not category:
            return ""
        sanitized = category.upper().strip()
        sanitized = re.sub(r'[^A-Z0-9\s\-&().,/]', '', sanitized)
        return sanitized


class SupplierValidator:
    """Supplier data validation"""
    
    @staticmethod
    def validate_id(supplier_id: str) -> bool:
        """Validate supplier ID (lowercase, alphanumeric, underscore)"""
        if not supplier_id or len(supplier_id) > 50:
            return False
        return re.match(r'^[a-z0-9_]+$', supplier_id) is not None
    
    @staticmethod
    def validate_name(name: str) -> bool:
        """Validate supplier name"""
        if not name or len(name) > 200:
            return False
        # No special injection characters
        return "'" not in name and '"' not in name and ";" not in name
    
    @staticmethod
    def validate_url(url: str) -> bool:
        """Validate URL"""
        if not url:
            return False
        return url.startswith("http://") or url.startswith("https://")
    
    @staticmethod
    def validate_email(email: str) -> bool:
        """Validate email address"""
        if not email:
            return False
        return re.match(r'^[\w\.-]+@[\w\.-]+\.\w+$', email) is not None
    
    @staticmethod
    def sanitize(data: Dict) -> Dict:
        """Sanitize supplier data"""
        return {
            "id": data.get("id", "").lower(),
            "name": data.get("name", "").strip(),
            "url": data.get("url", "").strip(),
            "email": data.get("email", "").strip()
        }


# Pydantic validation models
class ValidatedMPN(BaseModel):
    """MPN with validation"""
    mpn: str
    
    @validator("mpn")
    def validate_mpn(cls, v):
        if not MPNValidator.validate(v):
            raise ValueError(f"Invalid MPN: {v}")
        return MPNValidator.sanitize(v)


class ValidatedComponent(BaseModel):
    """Component with validation"""
    mpn: str
    name: str
    category_id: Optional[int] = None
    supplier_id: Optional[str] = None
    description: Optional[str] = None
    datasheet_url: Optional[str] = None
    
    @validator("mpn")
    def validate_mpn(cls, v):
        if not MPNValidator.validate(v):
            raise ValueError(f"Invalid MPN: {v}")
        return MPNValidator.sanitize(v)
    
    @validator("name")
    def validate_name(cls, v):
        if not v or len(v) > 200:
            raise ValueError("Invalid name")
        return v.strip()
    
    @validator("category_id")
    def validate_category(cls, v):
        if v is not None and v <= 0:
            raise ValueError("Category ID must be positive")
        return v
    
    @validator("supplier_id")
    def validate_supplier(cls, v):
        if v and not SupplierValidator.validate_id(v):
            raise ValueError("Invalid supplier ID")
        return v
    
    @validator("description")
    def validate_description(cls, v):
        if v and len(v) > 1000:
            raise ValueError("Description too long")
        return v
    
    @validator("datasheet_url")
    def validate_datasheet(cls, v):
        if v and not SupplierValidator.validate_url(v):
            raise ValueError("Invalid URL")
        return v


class ValidatedCategory(BaseModel):
    """Category with validation"""
    name: str
    parent_id: Optional[int] = None
    description: Optional[str] = None
    
    @validator("name")
    def validate_name(cls, v):
        if not CategoryValidator.validate(v):
            raise ValueError(f"Invalid category: {v}")
        return CategoryValidator.sanitize(v)
    
    @validator("parent_id")
    def validate_parent(cls, v):
        if v is not None and v <= 0:
            raise ValueError("Parent ID must be positive")
        return v
    
    @validator("description")
    def validate_description(cls, v):
        if v and len(v) > 500:
            raise ValueError("Description too long")
        return v


class ValidatedSupplier(BaseModel):
    """Supplier with validation"""
    supplier_id: str
    name: str
    url: Optional[str] = None
    email: Optional[str] = None
    api_endpoint: Optional[str] = None
    
    @validator("supplier_id")
    def validate_id(cls, v):
        if not SupplierValidator.validate_id(v):
            raise ValueError("Invalid supplier ID")
        return v
    
    @validator("name")
    def validate_name(cls, v):
        if not SupplierValidator.validate_name(v):
            raise ValueError("Invalid supplier name")
        return v
    
    @validator("url")
    def validate_url(cls, v):
        if v and not SupplierValidator.validate_url(v):
            raise ValueError("Invalid URL")
        return v
    
    @validator("email")
    def validate_email(cls, v):
        if v and not SupplierValidator.validate_email(v):
            raise ValueError("Invalid email")
        return v
    
    @validator("api_endpoint")
    def validate_api(cls, v):
        if v and not SupplierValidator.validate_url(v):
            raise ValueError("Invalid API endpoint")
        return v


class InputSanitizer:
    """Utility for sanitizing various input types"""
    
    @staticmethod
    def sanitize_string(value: str, max_length: int = 10000) -> str:
        """Sanitize string"""
        if not isinstance(value, str):
            return ""
        
        # Remove null bytes
        value = value.replace('\x00', '')
        
        # Remove control characters
        value = ''.join(char for char in value if ord(char) >= 32 or char in '\t\n\r')
        
        # Limit length
        if len(value) > max_length:
            value = value[:max_length]
        
        return value.strip()
    
    @staticmethod
    def sanitize_number(value: Any) -> float:
        """Sanitize number"""
        try:
            return float(value)
        except (ValueError, TypeError):
            return 0.0
    
    @staticmethod
    def sanitize_dict(data: Dict, allowed_keys: Optional[List[str]] = None) -> Dict:
        """Sanitize dictionary"""
        if not isinstance(data, dict):
            return {}
        
        result = {}
        for key, value in data.items():
            # Check if key is allowed
            if allowed_keys and key not in allowed_keys:
                continue
            
            # Sanitize value based on type
            if isinstance(value, str):
                result[key] = InputSanitizer.sanitize_string(value)
            elif isinstance(value, dict):
                result[key] = InputSanitizer.sanitize_dict(value, allowed_keys)
            elif isinstance(value, list):
                result[key] = InputSanitizer.sanitize_list(value)
            elif isinstance(value, (int, float)):
                result[key] = InputSanitizer.sanitize_number(value)
            else:
                result[key] = value
        
        return result
    
    @staticmethod
    def sanitize_list(data: List, max_length: int = 1000) -> List:
        """Sanitize list"""
        if not isinstance(data, list):
            return []
        
        # Limit list length
        if len(data) > max_length:
            data = data[:max_length]
        
        result = []
        for item in data:
            if isinstance(item, str):
                result.append(InputSanitizer.sanitize_string(item))
            elif isinstance(item, dict):
                result.append(InputSanitizer.sanitize_dict(item))
            elif isinstance(item, list):
                result.append(InputSanitizer.sanitize_list(item))
            else:
                result.append(item)
        
        return result
