"""
Input Validation Utilities
===========================
Provides comprehensive input validation and sanitization for API endpoints.
"""

import re
from typing import Optional, List
from pydantic import BaseModel, field_validator, Field
from fastapi import HTTPException, status
from app.core.logger import get_logger

logger = get_logger("validation")


class ValidationError(Exception):
    """Custom validation error with detailed information."""
    def __init__(self, field: str, message: str, value: any = None):
        self.field = field
        self.message = message
        self.value = value
        super().__init__(f"{field}: {message}")


def sanitize_string(input_string: str, max_length: int = 1000, allow_html: bool = False) -> str:
    """
    Sanitize string input to prevent XSS and injection attacks.
    
    Args:
        input_string: The string to sanitize
        max_length: Maximum allowed length
        allow_html: Whether to allow HTML tags
        
    Returns:
        Sanitized string
    """
    if not input_string:
        return ""
    
    # Truncate to max length
    sanitized = input_string[:max_length]
    
    # Remove potentially dangerous characters if HTML not allowed
    if not allow_html:
        # Remove script tags and common XSS patterns
        sanitized = re.sub(r'<script.*?>.*?</script>', '', sanitized, flags=re.IGNORECASE | re.DOTALL)
        sanitized = re.sub(r'<.*?on\w+.*?>', '', sanitized, flags=re.IGNORECASE)
        sanitized = re.sub(r'javascript:', '', sanitized, flags=re.IGNORECASE)
    
    return sanitized.strip()


def validate_email(email: str) -> bool:
    """
    Validate email format.
    
    Args:
        email: Email address to validate
        
    Returns:
        True if valid, False otherwise
    """
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return re.match(pattern, email) is not None


def validate_url(url: str) -> bool:
    """
    Validate URL format.
    
    Args:
        url: URL to validate
        
    Returns:
        True if valid, False otherwise
    """
    pattern = r'^https?://[^\s/$.?#].[^\s]*$'
    return re.match(pattern, url) is not None


def validate_uuid(uuid_string: str) -> bool:
    """
    Validate UUID format.
    
    Args:
        uuid_string: UUID string to validate
        
    Returns:
        True if valid, False otherwise
    """
    pattern = r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    return re.match(pattern, uuid_string.lower()) is not None


class PaginationParams(BaseModel):
    """Standard pagination parameters with validation."""
    page: int = Field(default=1, ge=1, description="Page number (1-based)")
    page_size: int = Field(default=20, ge=1, le=100, description="Number of items per page")
    
    @field_validator('page')
    @classmethod
    def validate_page(cls, v):
        if v < 1:
            raise ValueError("Page number must be at least 1")
        return v
    
    @field_validator('page_size')
    @classmethod
    def validate_page_size(cls, v):
        if v < 1 or v > 100:
            raise ValueError("Page size must be between 1 and 100")
        return v
    
    @property
    def offset(self) -> int:
        """Calculate offset for database queries."""
        return (self.page - 1) * self.page_size


class SearchQueryValidator(BaseModel):
    """Validator for search query inputs."""
    query: str = Field(..., min_length=2, max_length=500, description="Search query string")
    
    @field_validator('query')
    @classmethod
    def sanitize_query(cls, v):
        sanitized = sanitize_string(v, max_length=500)
        if len(sanitized) < 2:
            raise ValueError("Query must be at least 2 characters long")
        return sanitized


def raise_validation_error(field: str, message: str, value: any = None):
    """
    Raise a standardized validation error.
    
    Args:
        field: Field name that failed validation
        message: Error message
        value: Invalid value (optional)
    """
    logger.warning(f"Validation failed for field '{field}': {message}")
    raise HTTPException(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        detail={
            "field": field,
            "message": message,
            "value": value
        }
    )
