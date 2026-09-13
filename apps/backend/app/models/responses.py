"""
Standardized API Response Schemas
==================================
Provides consistent response structures across all API endpoints.
"""

from typing import Generic, TypeVar, Optional, Any, List
from app.core.timeutil import utcnow
from pydantic import BaseModel, ConfigDict, Field
from datetime import datetime

T = TypeVar('T')


class APIResponse(BaseModel, Generic[T]):
    """Standard API response wrapper with consistent structure."""
    success: bool = Field(..., description="Indicates if the request was successful")
    data: Optional[T] = Field(None, description="Response data payload")
    message: Optional[str] = Field(None, description="Human-readable message")
    error: Optional[str] = Field(None, description="Error message if request failed")
    timestamp: datetime = Field(default_factory=utcnow, description="Response timestamp")
    
    model_config = ConfigDict(json_schema_extra={
        "example": {
            "success": True,
            "data": {},
            "message": "Operation completed successfully",
            "error": None,
            "timestamp": "2024-01-01T00:00:00"
        }
    })


class PaginatedResponse(BaseModel, Generic[T]):
    """Standard paginated response structure."""
    success: bool = True
    data: List[T] = Field(default_factory=list, description="List of items")
    total: int = Field(..., description="Total number of items")
    page: int = Field(..., description="Current page number")
    page_size: int = Field(..., description="Number of items per page")
    total_pages: int = Field(..., description="Total number of pages")
    message: Optional[str] = None
    timestamp: datetime = Field(default_factory=utcnow)
    
    model_config = ConfigDict(json_schema_extra={
        "example": {
            "success": True,
            "data": [],
            "total": 100,
            "page": 1,
            "page_size": 20,
            "total_pages": 5,
            "message": None,
            "timestamp": "2024-01-01T00:00:00"
        }
    })


class ValidationError(BaseModel):
    """Detailed validation error information."""
    field: str = Field(..., description="Field that failed validation")
    message: str = Field(..., description="Validation error message")
    value: Optional[Any] = Field(None, description="Invalid value provided")


class ErrorResponse(BaseModel):
    """Standard error response structure."""
    success: bool = False
    error: str = Field(..., description="Error type or code")
    message: str = Field(..., description="Human-readable error message")
    details: Optional[List[ValidationError]] = Field(None, description="Detailed validation errors")
    timestamp: datetime = Field(default_factory=utcnow)
    
    model_config = ConfigDict(json_schema_extra={
        "example": {
            "success": False,
            "error": "ValidationError",
            "message": "Invalid input data",
            "details": [
                {
                    "field": "email",
                    "message": "Invalid email format",
                    "value": "invalid-email"
                }
            ],
            "timestamp": "2024-01-01T00:00:00"
        }
    })


class HealthCheckResponse(BaseModel):
    """Health check response with dependency status."""
    status: str = Field(..., description="Overall health status: healthy, degraded, unhealthy")
    version: str = Field(..., description="API version")
    timestamp: datetime = Field(default_factory=utcnow)
    dependencies: dict = Field(default_factory=dict, description="Status of external dependencies")
    
    model_config = ConfigDict(json_schema_extra={
        "example": {
            "status": "healthy",
            "version": "2.0.0",
            "timestamp": "2024-01-01T00:00:00",
            "dependencies": {
                "database": "healthy",
                "redis": "healthy",
                "qdrant": "healthy"
            }
        }
    })
