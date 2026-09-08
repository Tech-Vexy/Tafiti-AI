"""
Base external API client with standardized error handling, retry logic, rate limiting, and caching.

This provides a consistent interface for all external service integrations including
OpenAlex, Semantic Scholar, CORE, Elsevier, DOAJ, AJOL, AfricArXiv.
"""

import httpx
import asyncio
from typing import Optional, Dict, Any, Callable, TypeVar, Generic
from datetime import datetime, timedelta
from functools import wraps
import time

from app.core.config import settings
from app.core.logger import get_logger
from app.core.cache import cache

logger = get_logger("external_client")

T = TypeVar('T')


class ExternalAPIError(Exception):
    """Base exception for external API errors."""
    def __init__(self, message: str, status_code: Optional[int] = None, response_data: Optional[Dict] = None):
        self.message = message
        self.status_code = status_code
        self.response_data = response_data
        super().__init__(message)


class RateLimitError(ExternalAPIError):
    """Raised when rate limit is exceeded."""
    pass


class AuthenticationError(ExternalAPIError):
    """Raised when authentication fails."""
    pass


class ServiceUnavailableError(ExternalAPIError):
    """Raised when the external service is unavailable."""
    pass


class ValidationError(ExternalAPIError):
    """Raised when response validation fails."""
    pass


def retry_on_failure(
    max_retries: int = 3,
    backoff_factor: float = 1.0,
    retryable_exceptions: tuple = (httpx.TimeoutException, httpx.NetworkError, ServiceUnavailableError),
):
    """
    Decorator to retry failed requests with exponential backoff.
    """
    def decorator(func: Callable[..., T]) -> Callable[..., T]:
        @wraps(func)
        async def wrapper(*args, **kwargs) -> T:
            last_exception = None
            
            for attempt in range(max_retries + 1):
                try:
                    return await func(*args, **kwargs)
                except retryable_exceptions as e:
                    last_exception = e
                    if attempt < max_retries:
                        wait_time = backoff_factor * (2 ** attempt)
                        logger.warning(f"Retry attempt {attempt + 1}/{max_retries} after {wait_time:.1f}s: {str(e)}")
                        await asyncio.sleep(wait_time)
                    else:
                        logger.error(f"Max retries ({max_retries}) exceeded for {func.__name__}")
                        raise
                except Exception as e:
                    # Don't retry non-retryable exceptions
                    raise
            
            raise last_exception
        return wrapper
    return decorator


class BaseExternalClient:
    """
    Base class for external API clients with standardized error handling, retry logic, and caching.
    """
    
    def __init__(
        self,
        base_url: str,
        service_name: str,
        timeout: float = 15.0,
        max_retries: int = 3,
        cache_ttl: int = 3600,
        api_key: Optional[str] = None,
        rate_limit_per_minute: Optional[int] = None,
    ):
        self.base_url = base_url.rstrip('/')
        self.service_name = service_name
        self.timeout = timeout
        self.max_retries = max_retries
        self.cache_ttl = cache_ttl
        self.api_key = api_key
        self.rate_limit_per_minute = rate_limit_per_minute
        
        self._client: Optional[httpx.AsyncClient] = None
        self._rate_limit_tracker: Dict[str, list] = {}
        
        logger.info(f"Initialized {service_name} client with base_url={base_url}")
    
    @property
    def client(self) -> httpx.AsyncClient:
        """Get or create HTTP client."""
        if self._client is None:
            self._client = httpx.AsyncClient(timeout=self.timeout)
        return self._client
    
    async def close(self):
        """Close the HTTP client."""
        if self._client:
            await self._client.aclose()
            self._client = None
    
    def _check_rate_limit(self, endpoint: str = "default") -> bool:
        """Check if rate limit has been exceeded."""
        if not self.rate_limit_per_minute:
            return True
        
        now = time.time()
        minute_ago = now - 60
        
        if endpoint not in self._rate_limit_tracker:
            self._rate_limit_tracker[endpoint] = []
        
        # Remove requests older than 1 minute
        self._rate_limit_tracker[endpoint] = [
            timestamp for timestamp in self._rate_limit_tracker[endpoint]
            if timestamp > minute_ago
        ]
        
        if len(self._rate_limit_tracker[endpoint]) >= self.rate_limit_per_minute:
            logger.warning(f"Rate limit exceeded for {self.service_name} endpoint {endpoint}")
            return False
        
        self._rate_limit_tracker[endpoint].append(now)
        return True
    
    def _get_cache_key(self, endpoint: str, params: Optional[Dict] = None) -> str:
        """Generate cache key for request."""
        return cache.make_key(f"{self.service_name}:{endpoint}", params)
    
    async def _get_cached_response(self, cache_key: str) -> Optional[Any]:
        """Get cached response if available."""
        try:
            cached = await cache.get(cache_key)
            if cached:
                logger.debug(f"Cache hit for {self.service_name}: {cache_key}")
                return cached
        except Exception as e:
            logger.warning(f"Cache retrieval failed for {self.service_name}: {e}")
        return None
    
    async def _cache_response(self, cache_key: str, response: Any, ttl: Optional[int] = None):
        """Cache response with TTL."""
        try:
            ttl = ttl or self.cache_ttl
            if ttl > 0:
                await cache.set(cache_key, response, ttl=ttl)
        except Exception as e:
            logger.warning(f"Cache set failed for {self.service_name}: {e}")
    
    def _handle_error_response(self, response: httpx.Response) -> None:
        """Handle error responses from external APIs."""
        status_code = response.status_code
        
        try:
            response_data = response.json()
        except (ValueError, KeyError):
            response_data = None
        
        if status_code == 401:
            raise AuthenticationError(
                f"Authentication failed for {self.service_name}",
                status_code=status_code,
                response_data=response_data
            )
        elif status_code == 429:
            raise RateLimitError(
                f"Rate limit exceeded for {self.service_name}",
                status_code=status_code,
                response_data=response_data
            )
        elif status_code >= 500:
            raise ServiceUnavailableError(
                f"Service unavailable for {self.service_name}",
                status_code=status_code,
                response_data=response_data
            )
        elif status_code >= 400:
            raise ExternalAPIError(
                f"Bad request to {self.service_name}: {response.text}",
                status_code=status_code,
                response_data=response_data
            )
    
    def _build_headers(self, additional_headers: Optional[Dict] = None) -> Dict[str, str]:
        """Build standard headers for requests."""
        headers = {
            "User-Agent": f"TafitiAI/{settings.VERSION}",
            "Accept": "application/json",
        }
        
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
        
        if additional_headers:
            headers.update(additional_headers)
        
        return headers
    
    @retry_on_failure(max_retries=3, backoff_factor=1.0)
    async def get(
        self,
        endpoint: str,
        params: Optional[Dict] = None,
        headers: Optional[Dict] = None,
        use_cache: bool = True,
        cache_ttl: Optional[int] = None,
        validate_response: Optional[Callable[[Dict], bool]] = None,
    ) -> Dict[str, Any]:
        """
        Make GET request with caching, retry logic, and error handling.
        
        Args:
            endpoint: API endpoint path
            params: Query parameters
            headers: Additional headers
            use_cache: Whether to use cache
            cache_ttl: Custom cache TTL
            validate_response: Optional response validation function
        
        Returns:
            Response data as dictionary
        
        Raises:
            ExternalAPIError: If request fails
        """
        if not self._check_rate_limit(endpoint):
            raise RateLimitError(f"Rate limit exceeded for {self.service_name}")
        
        cache_key = self._get_cache_key(endpoint, params)
        
        if use_cache:
            cached = await self._get_cached_response(cache_key)
            if cached:
                return cached
        
        url = f"{self.base_url}/{endpoint.lstrip('/')}"
        request_headers = self._build_headers(headers)
        
        logger.debug(f"GET {url} with params={params}")
        
        try:
            response = await self.client.get(url, params=params, headers=request_headers)
            response.raise_for_status()
            
            data = response.json()
            
            # Validate response if validator provided
            if validate_response and not validate_response(data):
                raise ValidationError(f"Response validation failed for {self.service_name}")
            
            # Cache successful response
            if use_cache:
                await self._cache_response(cache_key, data, cache_ttl)
            
            return data
            
        except httpx.HTTPStatusError as e:
            self._handle_error_response(e.response)
            raise
        except httpx.TimeoutException as e:
            logger.error(f"Timeout for {self.service_name}: {str(e)}")
            raise ServiceUnavailableError(f"Timeout connecting to {self.service_name}")
        except httpx.NetworkError as e:
            logger.error(f"Network error for {self.service_name}: {str(e)}")
            raise ServiceUnavailableError(f"Network error connecting to {self.service_name}")
        except Exception as e:
            logger.error(f"Unexpected error for {self.service_name}: {str(e)}")
            raise ExternalAPIError(f"Unexpected error: {str(e)}")
    
    @retry_on_failure(max_retries=3, backoff_factor=1.0)
    async def post(
        self,
        endpoint: str,
        data: Optional[Dict] = None,
        json: Optional[Dict] = None,
        headers: Optional[Dict] = None,
        use_cache: bool = False,
        cache_ttl: Optional[int] = None,
        validate_response: Optional[Callable[[Dict], bool]] = None,
    ) -> Dict[str, Any]:
        """
        Make POST request with retry logic, optional caching, and error handling.
        
        Args:
            endpoint: API endpoint path
            data: Form data
            json: JSON data
            headers: Additional headers
            use_cache: Whether to check/store in cache
            cache_ttl: Custom cache TTL
            validate_response: Optional response validation function
        
        Returns:
            Response data as dictionary
        
        Raises:
            ExternalAPIError: If request fails
        """
        if not self._check_rate_limit(endpoint):
            raise RateLimitError(f"Rate limit exceeded for {self.service_name}")
        
        cache_key = self._get_cache_key(endpoint, json or data) if use_cache else None
        if use_cache and cache_key:
            cached = await self._get_cached_response(cache_key)
            if cached:
                return cached
        
        url = f"{self.base_url}/{endpoint.lstrip('/')}"
        request_headers = self._build_headers(headers)
        
        logger.debug(f"POST {url}")
        
        try:
            response = await self.client.post(
                url,
                data=data,
                json=json,
                headers=request_headers
            )
            response.raise_for_status()
            
            response_data = response.json()
            
            # Validate response if validator provided
            if validate_response and not validate_response(response_data):
                raise ValidationError(f"Response validation failed for {self.service_name}")
            
            if use_cache and cache_key:
                await self._cache_response(cache_key, response_data, cache_ttl)
            
            return response_data
            
        except httpx.HTTPStatusError as e:
            self._handle_error_response(e.response)
            raise
        except httpx.TimeoutException as e:
            logger.error(f"Timeout for {self.service_name}: {str(e)}")
            raise ServiceUnavailableError(f"Timeout connecting to {self.service_name}")
        except httpx.NetworkError as e:
            logger.error(f"Network error for {self.service_name}: {str(e)}")
            raise ServiceUnavailableError(f"Network error connecting to {self.service_name}")
        except Exception as e:
            logger.error(f"Unexpected error for {self.service_name}: {str(e)}")
            raise ExternalAPIError(f"Unexpected error: {str(e)}")
    
    async def health_check(self) -> bool:
        """
        Check if the external service is healthy.
        
        Returns:
            True if service is healthy, False otherwise
        """
        try:
            # Try a simple request to check connectivity
            await self.get("/", use_cache=False)
            return True
        except Exception as e:
            logger.warning(f"Health check failed for {self.service_name}: {e}")
            return False
    
    def __aenter__(self):
        return self
    
    def __aexit__(self, exc_type, exc_val, exc_tb):
        return self.close()
