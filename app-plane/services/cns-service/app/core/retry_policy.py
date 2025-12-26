"""
CRITICAL-7: Retry Policy with Exponential Backoff

Handles transient failures gracefully with configurable retry logic
"""

import logging
import asyncio
import random
from typing import Callable, Any, Type, Tuple, Optional
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)


class RetryConfig:
    """Configuration for retry policy"""
    
    def __init__(
        self,
        max_retries: int = 3,
        initial_delay: float = 0.1,
        max_delay: float = 30.0,
        exponential_base: float = 2.0,
        jitter: bool = True,
        retry_on: Optional[Tuple[Type[Exception], ...]] = None
    ):
        """
        Args:
            max_retries: Maximum number of retries (default 3)
            initial_delay: Initial delay in seconds (default 0.1)
            max_delay: Maximum delay between retries (default 30.0)
            exponential_base: Base for exponential backoff (default 2.0)
            jitter: Add randomness to delay to avoid thundering herd (default True)
            retry_on: Tuple of exception types to retry on (default: transient errors)
        """
        self.max_retries = max_retries
        self.initial_delay = initial_delay
        self.max_delay = max_delay
        self.exponential_base = exponential_base
        self.jitter = jitter
        
        # Default transient errors to retry on
        if retry_on is None:
            self.retry_on = (
                TimeoutError,
                ConnectionError,
                OSError,
                RuntimeError  # For async timeouts
            )
        else:
            self.retry_on = retry_on
    
    def calculate_delay(self, attempt: int) -> float:
        """Calculate delay for retry attempt"""
        # Exponential backoff: initial_delay * exponential_base^attempt
        delay = self.initial_delay * (self.exponential_base ** attempt)
        
        # Cap at max_delay
        delay = min(delay, self.max_delay)
        
        # Add jitter (±10%)
        if self.jitter:
            jitter_amount = delay * 0.1
            delay += random.uniform(-jitter_amount, jitter_amount)
        
        return max(0, delay)  # Ensure non-negative


class RetryPolicy:
    """Retry policy handler"""
    
    def __init__(self, config: RetryConfig = None):
        self.config = config or RetryConfig()
        self.attempt_count = 0
        self.last_exception = None
    
    async def execute_async(
        self,
        func: Callable,
        *args,
        **kwargs
    ) -> Any:
        """
        Execute async function with retry logic
        
        Usage:
            policy = RetryPolicy()
            result = await policy.execute_async(
                vendor_client.search,
                mpn,
                timeout=10
            )
        """
        last_exception = None
        
        for attempt in range(self.config.max_retries + 1):
            try:
                self.attempt_count = attempt
                result = await func(*args, **kwargs)
                
                if attempt > 0:
                    logger.info(f"Retry successful after {attempt} attempt(s)")
                
                return result
            
            except Exception as e:
                last_exception = e
                self.last_exception = e
                
                # Check if this exception should be retried
                if not isinstance(e, self.config.retry_on):
                    logger.error(f"Non-retryable exception: {type(e).__name__}: {e}")
                    raise
                
                # Check if we've exhausted retries
                if attempt >= self.config.max_retries:
                    logger.error(
                        f"Exceeded max retries ({self.config.max_retries}) for {func.__name__}",
                        exc_info=True
                    )
                    raise
                
                # Calculate delay
                delay = self.config.calculate_delay(attempt)
                
                logger.warning(
                    f"Attempt {attempt + 1} failed ({type(e).__name__}), "
                    f"retrying in {delay:.2f}s... ({self.config.max_retries - attempt} retries left)"
                )
                
                await asyncio.sleep(delay)
        
        raise last_exception
    
    def execute_sync(
        self,
        func: Callable,
        *args,
        **kwargs
    ) -> Any:
        """
        Execute sync function with retry logic
        
        Usage:
            policy = RetryPolicy()
            result = policy.execute_sync(
                requests.get,
                url,
                timeout=10
            )
        """
        import time
        
        last_exception = None
        
        for attempt in range(self.config.max_retries + 1):
            try:
                self.attempt_count = attempt
                result = func(*args, **kwargs)
                
                if attempt > 0:
                    logger.info(f"Retry successful after {attempt} attempt(s)")
                
                return result
            
            except Exception as e:
                last_exception = e
                self.last_exception = e
                
                # Check if this exception should be retried
                if not isinstance(e, self.config.retry_on):
                    logger.error(f"Non-retryable exception: {type(e).__name__}: {e}")
                    raise
                
                # Check if we've exhausted retries
                if attempt >= self.config.max_retries:
                    logger.error(
                        f"Exceeded max retries ({self.config.max_retries}) for {func.__name__}",
                        exc_info=True
                    )
                    raise
                
                # Calculate delay
                delay = self.config.calculate_delay(attempt)
                
                logger.warning(
                    f"Attempt {attempt + 1} failed ({type(e).__name__}), "
                    f"retrying in {delay:.2f}s... ({self.config.max_retries - attempt} retries left)"
                )
                
                time.sleep(delay)
        
        raise last_exception
    
    def get_stats(self) -> dict:
        """Get retry statistics"""
        return {
            "attempt_count": self.attempt_count,
            "max_retries": self.config.max_retries,
            "last_exception": str(self.last_exception),
            "config": {
                "initial_delay": self.config.initial_delay,
                "max_delay": self.config.max_delay,
                "exponential_base": self.config.exponential_base,
                "jitter": self.config.jitter
            }
        }


class RetryDecorator:
    """Decorator for retry logic"""
    
    def __init__(
        self,
        max_retries: int = 3,
        initial_delay: float = 0.1,
        max_delay: float = 30.0,
        exponential_base: float = 2.0,
        jitter: bool = True
    ):
        self.config = RetryConfig(
            max_retries=max_retries,
            initial_delay=initial_delay,
            max_delay=max_delay,
            exponential_base=exponential_base,
            jitter=jitter
        )
    
    def __call__(self, func: Callable) -> Callable:
        """Decorate function with retry logic"""
        
        if asyncio.iscoroutinefunction(func):
            async def async_wrapper(*args, **kwargs):
                policy = RetryPolicy(self.config)
                return await policy.execute_async(func, *args, **kwargs)
            return async_wrapper
        else:
            def sync_wrapper(*args, **kwargs):
                policy = RetryPolicy(self.config)
                return policy.execute_sync(func, *args, **kwargs)
            return sync_wrapper


# Convenience functions
async def retry_async(
    func: Callable,
    *args,
    max_retries: int = 3,
    initial_delay: float = 0.1,
    **kwargs
) -> Any:
    """
    Execute async function with retry logic
    
    Usage:
        result = await retry_async(
            vendor_client.search,
            mpn,
            max_retries=3
        )
    """
    config = RetryConfig(max_retries=max_retries, initial_delay=initial_delay)
    policy = RetryPolicy(config)
    return await policy.execute_async(func, *args, **kwargs)


def retry_sync(
    func: Callable,
    *args,
    max_retries: int = 3,
    initial_delay: float = 0.1,
    **kwargs
) -> Any:
    """
    Execute sync function with retry logic
    
    Usage:
        result = retry_sync(
            requests.get,
            url,
            max_retries=3
        )
    """
    config = RetryConfig(max_retries=max_retries, initial_delay=initial_delay)
    policy = RetryPolicy(config)
    return policy.execute_sync(func, *args, **kwargs)


# Preset configurations
class RetryPresets:
    """Predefined retry configurations"""
    
    # Quick retry: for fast operations
    QUICK = RetryConfig(
        max_retries=2,
        initial_delay=0.05,
        max_delay=1.0
    )
    
    # Standard retry: for most operations
    STANDARD = RetryConfig(
        max_retries=3,
        initial_delay=0.1,
        max_delay=10.0
    )
    
    # Aggressive retry: for critical operations
    AGGRESSIVE = RetryConfig(
        max_retries=5,
        initial_delay=0.2,
        max_delay=30.0
    )
    
    # Patient retry: for long-running operations
    PATIENT = RetryConfig(
        max_retries=10,
        initial_delay=1.0,
        max_delay=60.0
    )
