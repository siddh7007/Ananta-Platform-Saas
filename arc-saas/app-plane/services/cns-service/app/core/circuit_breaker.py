"""
CRITICAL-7: Circuit Breaker for Vendor APIs

Prevents cascading failures by stopping calls to failing vendors
"""

import logging
import time
from typing import Callable, Any, Optional
from enum import Enum
from datetime import datetime, timedelta
import asyncio
import threading

logger = logging.getLogger(__name__)


class CircuitBreakerState(str, Enum):
    """Circuit breaker states"""
    CLOSED = "CLOSED"           # Normal operation
    OPEN = "OPEN"              # Failing, reject requests
    HALF_OPEN = "HALF_OPEN"    # Testing if service recovered


class CircuitBreaker:
    """
    Circuit breaker to prevent cascading failures
    
    States:
    - CLOSED: Requests pass through normally
    - OPEN: Requests fail immediately (circuit broken)
    - HALF_OPEN: Limited requests allowed to test recovery
    """
    
    def __init__(
        self,
        name: str,
        failure_threshold: int = 5,
        success_threshold: int = 2,
        timeout: int = 60,
        on_open: Optional[Callable] = None,
        on_close: Optional[Callable] = None
    ):
        """
        Args:
            name: Circuit breaker name
            failure_threshold: Failures before opening circuit (default 5)
            success_threshold: Successes in HALF_OPEN before closing (default 2)
            timeout: Seconds before trying recovery (default 60)
            on_open: Callback when circuit opens
            on_close: Callback when circuit closes
        """
        self.name = name
        self.failure_threshold = failure_threshold
        self.success_threshold = success_threshold
        self.timeout = timeout
        self.on_open = on_open
        self.on_close = on_close
        
        # State tracking
        self.state = CircuitBreakerState.CLOSED
        self.failure_count = 0
        self.success_count = 0
        self.last_failure_time = None
        self.last_state_change = datetime.utcnow()
    
    def can_execute(self) -> bool:
        """Check if request can be executed"""
        if self.state == CircuitBreakerState.CLOSED:
            return True
        
        if self.state == CircuitBreakerState.OPEN:
            # Check if timeout has passed
            elapsed = (datetime.utcnow() - self.last_state_change).total_seconds()
            if elapsed >= self.timeout:
                logger.info(f"[{self.name}] Attempting recovery (HALF_OPEN)")
                self._change_state(CircuitBreakerState.HALF_OPEN)
                self.success_count = 0
                return True
            return False
        
        if self.state == CircuitBreakerState.HALF_OPEN:
            return True
        
        return False
    
    def record_success(self):
        """Record successful request"""
        self.failure_count = 0
        
        if self.state == CircuitBreakerState.CLOSED:
            return  # Already closed, nothing to do
        
        if self.state == CircuitBreakerState.HALF_OPEN:
            self.success_count += 1
            
            if self.success_count >= self.success_threshold:
                logger.info(f"[{self.name}] Recovery successful, closing circuit")
                self._change_state(CircuitBreakerState.CLOSED)
                self.success_count = 0
                if self.on_close:
                    self.on_close()
    
    def record_failure(self, exception: Exception = None):
        """Record failed request"""
        self.failure_count += 1
        self.last_failure_time = datetime.utcnow()
        
        logger.warning(
            f"[{self.name}] Failure #{self.failure_count}/{self.failure_threshold}",
            exc_info=exception if exception else False
        )
        
        if self.state == CircuitBreakerState.HALF_OPEN:
            logger.warning(f"[{self.name}] Recovery failed, reopening circuit")
            self._change_state(CircuitBreakerState.OPEN)
            self.success_count = 0
            if self.on_open:
                self.on_open()
        
        elif self.state == CircuitBreakerState.CLOSED:
            if self.failure_count >= self.failure_threshold:
                logger.error(f"[{self.name}] Threshold exceeded, opening circuit")
                self._change_state(CircuitBreakerState.OPEN)
                if self.on_open:
                    self.on_open()
    
    def _change_state(self, new_state: CircuitBreakerState):
        """Change circuit breaker state"""
        old_state = self.state
        self.state = new_state
        self.last_state_change = datetime.utcnow()
        logger.info(f"[{self.name}] State changed: {old_state} → {new_state}")
    
    def get_status(self) -> dict:
        """Get circuit breaker status"""
        return {
            "name": self.name,
            "state": self.state.value,
            "failure_count": self.failure_count,
            "success_count": self.success_count,
            "last_failure": self.last_failure_time.isoformat() if self.last_failure_time else None,
            "last_state_change": self.last_state_change.isoformat()
        }


class CircuitBreakerManager:
    """Manages multiple circuit breakers"""
    
    def __init__(self):
        self.breakers: dict[str, CircuitBreaker] = {}
        self.lock = asyncio.Lock()
    
    async def get_or_create(
        self,
        name: str,
        failure_threshold: int = 5,
        success_threshold: int = 2,
        timeout: int = 60
    ) -> CircuitBreaker:
        """Get or create circuit breaker"""
        async with self.lock:
            if name not in self.breakers:
                self.breakers[name] = CircuitBreaker(
                    name=name,
                    failure_threshold=failure_threshold,
                    success_threshold=success_threshold,
                    timeout=timeout
                )
            return self.breakers[name]
    
    async def get_status(self) -> dict:
        """Get status of all circuit breakers"""
        return {
            name: breaker.get_status()
            for name, breaker in self.breakers.items()
        }
    
    async def reset(self, name: str = None):
        """Reset circuit breaker(s)"""
        async with self.lock:
            if name:
                if name in self.breakers:
                    self.breakers[name].failure_count = 0
                    self.breakers[name].success_count = 0
                    self.breakers[name]._change_state(CircuitBreakerState.CLOSED)
                    logger.info(f"[{name}] Reset")
            else:
                for breaker in self.breakers.values():
                    breaker.failure_count = 0
                    breaker.success_count = 0
                    breaker._change_state(CircuitBreakerState.CLOSED)
                logger.info("All circuit breakers reset")


class SyncCircuitBreakerManager:
    """
    Synchronous version of CircuitBreakerManager for use in non-async code.

    Uses threading.Lock instead of asyncio.Lock to avoid async/await requirements.
    The CircuitBreaker class itself is already synchronous, so no async needed.
    """

    def __init__(self):
        self.breakers: dict[str, CircuitBreaker] = {}
        self.lock = threading.Lock()

    def get_or_create(
        self,
        name: str,
        failure_threshold: int = 5,
        success_threshold: int = 2,
        timeout: int = 60
    ) -> CircuitBreaker:
        """Get or create circuit breaker (synchronous)"""
        with self.lock:
            if name not in self.breakers:
                self.breakers[name] = CircuitBreaker(
                    name=name,
                    failure_threshold=failure_threshold,
                    success_threshold=success_threshold,
                    timeout=timeout
                )
            return self.breakers[name]

    def get_status(self) -> dict:
        """Get status of all circuit breakers (synchronous)"""
        with self.lock:
            return {
                name: breaker.get_status()
                for name, breaker in self.breakers.items()
            }

    def reset(self, name: str = None):
        """Reset circuit breaker(s) (synchronous)"""
        with self.lock:
            if name:
                if name in self.breakers:
                    self.breakers[name].failure_count = 0
                    self.breakers[name].success_count = 0
                    self.breakers[name]._change_state(CircuitBreakerState.CLOSED)
                    logger.info(f"[{name}] Reset")
            else:
                for breaker in self.breakers.values():
                    breaker.failure_count = 0
                    breaker.success_count = 0
                    breaker._change_state(CircuitBreakerState.CLOSED)
                logger.info("All circuit breakers reset")


# Global instances
circuit_breaker_manager = CircuitBreakerManager()
sync_circuit_breaker_manager = SyncCircuitBreakerManager()


async def call_with_circuit_breaker(
    name: str,
    func: Callable,
    *args,
    failure_threshold: int = 5,
    **kwargs
) -> Any:
    """
    Call function with circuit breaker protection
    
    Usage:
        result = await call_with_circuit_breaker(
            "mouser_api",
            mouser_client.search,
            mpn
        )
    """
    breaker = await circuit_breaker_manager.get_or_create(
        name,
        failure_threshold=failure_threshold
    )
    
    if not breaker.can_execute():
        raise Exception(f"Circuit breaker is {breaker.state.value} for {name}")
    
    try:
        result = await func(*args, **kwargs) if asyncio.iscoroutinefunction(func) else func(*args, **kwargs)
        breaker.record_success()
        return result
    except Exception as e:
        breaker.record_failure(e)
        raise


def call_with_circuit_breaker_sync(
    name: str,
    func: Callable,
    *args,
    failure_threshold: int = 5,
    success_threshold: int = 2,
    timeout: int = 60,
    **kwargs
) -> Any:
    """
    Call function with circuit breaker protection (synchronous version)

    Usage:
        result = call_with_circuit_breaker_sync(
            "mouser_api",
            mouser_client.search,
            mpn,
            failure_threshold=5
        )
    """
    breaker = sync_circuit_breaker_manager.get_or_create(
        name,
        failure_threshold=failure_threshold,
        success_threshold=success_threshold,
        timeout=timeout
    )

    if not breaker.can_execute():
        raise Exception(f"Circuit breaker is {breaker.state.value} for {name}")

    try:
        result = func(*args, **kwargs)
        breaker.record_success()
        return result
    except Exception as e:
        breaker.record_failure(e)
        raise


def decorator_circuit_breaker(
    name: str,
    failure_threshold: int = 5,
    success_threshold: int = 2,
    timeout: int = 60
):
    """
    Decorator for circuit breaker protection
    
    Usage:
        @decorator_circuit_breaker("mouser_api")
        async def get_mouser_data(mpn):
            return await mouser_client.search(mpn)
    """
    def decorator(func: Callable) -> Callable:
        async def async_wrapper(*args, **kwargs):
            breaker = await circuit_breaker_manager.get_or_create(
                name,
                failure_threshold=failure_threshold,
                success_threshold=success_threshold,
                timeout=timeout
            )
            
            if not breaker.can_execute():
                raise Exception(f"Circuit breaker is {breaker.state.value} for {name}")
            
            try:
                result = await func(*args, **kwargs)
                breaker.record_success()
                return result
            except Exception as e:
                breaker.record_failure(e)
                raise
        
        def sync_wrapper(*args, **kwargs):
            breaker = circuit_breaker_manager.breakers.get(name)
            if not breaker:
                breaker = CircuitBreaker(
                    name=name,
                    failure_threshold=failure_threshold,
                    success_threshold=success_threshold,
                    timeout=timeout
                )
                circuit_breaker_manager.breakers[name] = breaker
            
            if not breaker.can_execute():
                raise Exception(f"Circuit breaker is {breaker.state.value} for {name}")
            
            try:
                result = func(*args, **kwargs)
                breaker.record_success()
                return result
            except Exception as e:
                breaker.record_failure(e)
                raise
        
        if asyncio.iscoroutinefunction(func):
            return async_wrapper
        else:
            return sync_wrapper
    
    return decorator
