"""
Temporal Client for CNS Service

Provides integration with Temporal workflows for background job processing.
"""

import logging
from typing import Optional
from temporalio.client import Client
from app.config import settings

logger = logging.getLogger(__name__)


class TemporalClientManager:
    """
    Manages Temporal client connection for CNS service

    Usage:
        client_manager = TemporalClientManager()
        await client_manager.connect()
        client = client_manager.get_client()
    """

    def __init__(self):
        self._client: Optional[Client] = None
        self._connected = False

    async def connect(self) -> bool:
        """
        Connect to Temporal server

        Returns:
            True if connected successfully, False otherwise
        """
        if not settings.temporal_enabled:
            logger.warning("Temporal is disabled in configuration (TEMPORAL_ENABLED=False)")
            return False

        if self._connected and self._client:
            logger.info("Already connected to Temporal")
            return True

        try:
            # Use temporal_url (from TEMPORAL_URL env var) or fall back to temporal_host
            temporal_address = settings.temporal_url or settings.temporal_host
            logger.info(f"Connecting to Temporal at {temporal_address}")

            self._client = await Client.connect(
                temporal_address,
                namespace=settings.temporal_namespace
            )

            self._connected = True
            logger.info(f"Successfully connected to Temporal (namespace: {settings.temporal_namespace})")
            return True

        except Exception as e:
            logger.error(f"Failed to connect to Temporal: {e}")
            self._connected = False
            self._client = None
            return False

    def get_client(self) -> Optional[Client]:
        """
        Get Temporal client

        Returns:
            Temporal client if connected, None otherwise
        """
        if not self._connected:
            logger.warning("Temporal client not connected. Call connect() first.")
            return None

        return self._client

    def is_connected(self) -> bool:
        """Check if client is connected"""
        return self._connected and self._client is not None

    async def disconnect(self):
        """Disconnect from Temporal"""
        if self._client:
            # Temporal client doesn't need explicit disconnect
            self._client = None
            self._connected = False
            logger.info("Disconnected from Temporal")


# Global client manager instance
_temporal_client_manager: Optional[TemporalClientManager] = None


def get_temporal_client_manager() -> TemporalClientManager:
    """
    Get global Temporal client manager instance

    Returns:
        TemporalClientManager instance
    """
    global _temporal_client_manager

    if _temporal_client_manager is None:
        _temporal_client_manager = TemporalClientManager()

    return _temporal_client_manager


async def ensure_temporal_connected() -> bool:
    """
    Ensure Temporal client is connected

    Returns:
        True if connected, False otherwise
    """
    manager = get_temporal_client_manager()

    if manager.is_connected():
        return True

    return await manager.connect()
