"""
Notification Event Publisher

Publishes notification events to RabbitMQ for async processing
by the novu-consumer service.
"""

import json
import logging
from dataclasses import dataclass, asdict
from typing import Dict, Any, Optional

import pika
from pika.exceptions import AMQPConnectionError

logger = logging.getLogger(__name__)


@dataclass
class NotificationEvent:
    """Event to be published to RabbitMQ for async notification delivery."""
    workflow_id: str
    subscriber_id: str
    payload: Dict[str, Any]
    event_type: str = "notification"
    overrides: Optional[Dict[str, Any]] = None

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        data = {
            "event_type": self.event_type,
            "workflow_id": self.workflow_id,
            "subscriber_id": self.subscriber_id,
            "payload": self.payload,
        }
        if self.overrides:
            data["overrides"] = self.overrides
        return data


class NotificationPublisher:
    """
    Publishes notification events to RabbitMQ.

    Used by services to queue non-critical notifications for
    async processing by the novu-consumer service.

    Usage:
        publisher = NotificationPublisher()
        event = NotificationEvent(
            workflow_id="risk-threshold-exceeded",
            subscriber_id="user-uuid",
            payload={"component_mpn": "ABC123", "new_score": 75}
        )
        publisher.publish(event)
    """

    def __init__(
        self,
        host: str = "rabbitmq",
        port: int = 5672,
        username: str = "admin",
        password: str = "admin123_change_in_production",
        exchange: str = "platform.events",
    ):
        self.host = host
        self.port = port
        self.exchange = exchange
        self.credentials = pika.PlainCredentials(username, password)
        self.params = pika.ConnectionParameters(
            host=host,
            port=port,
            credentials=self.credentials,
            heartbeat=600,
        )
        self._connection: Optional[pika.BlockingConnection] = None
        self._channel = None

    def _ensure_connection(self) -> bool:
        """
        Ensure RabbitMQ connection is active.

        Returns:
            True if connected, False otherwise
        """
        try:
            if self._connection is None or self._connection.is_closed:
                self._connection = pika.BlockingConnection(self.params)
                self._channel = self._connection.channel()
                self._channel.exchange_declare(
                    exchange=self.exchange,
                    exchange_type="topic",
                    durable=True,
                )
                logger.debug(f"Connected to RabbitMQ at {self.host}:{self.port}")
            return True
        except AMQPConnectionError as e:
            logger.error(f"Failed to connect to RabbitMQ: {e}")
            return False
        except Exception as e:
            logger.error(f"Unexpected error connecting to RabbitMQ: {e}")
            return False

    def publish(
        self,
        event: NotificationEvent,
        routing_key: Optional[str] = None,
    ) -> bool:
        """
        Publish notification event to RabbitMQ.

        Args:
            event: NotificationEvent to publish
            routing_key: Optional custom routing key (defaults to notification.{workflow_id})

        Returns:
            True if published successfully
        """
        if not self._ensure_connection():
            logger.error("Cannot publish - not connected to RabbitMQ")
            return False

        try:
            if not routing_key:
                routing_key = f"notification.{event.workflow_id}"

            message = json.dumps(event.to_dict())

            self._channel.basic_publish(
                exchange=self.exchange,
                routing_key=routing_key,
                body=message,
                properties=pika.BasicProperties(
                    delivery_mode=2,  # Persistent
                    content_type="application/json",
                ),
            )
            logger.info(
                f"Published notification event: workflow={event.workflow_id}, "
                f"subscriber={event.subscriber_id}, routing_key={routing_key}"
            )
            return True

        except Exception as e:
            logger.error(f"Failed to publish notification event: {e}")
            # Reset connection on error
            self._connection = None
            self._channel = None
            return False

    def publish_batch(
        self,
        events: list[NotificationEvent],
    ) -> Dict[str, int]:
        """
        Publish multiple notification events.

        Args:
            events: List of NotificationEvents to publish

        Returns:
            Dict with counts: {"success": N, "failed": N}
        """
        stats = {"success": 0, "failed": 0}

        for event in events:
            if self.publish(event):
                stats["success"] += 1
            else:
                stats["failed"] += 1

        logger.info(f"Batch publish complete: {stats}")
        return stats

    def close(self):
        """Close RabbitMQ connection."""
        try:
            if self._connection and not self._connection.is_closed:
                self._connection.close()
                logger.debug("Closed RabbitMQ connection")
        except Exception as e:
            logger.error(f"Error closing RabbitMQ connection: {e}")
        finally:
            self._connection = None
            self._channel = None

    def __enter__(self):
        """Context manager entry."""
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        """Context manager exit - close connection."""
        self.close()
        return False


# Convenience function for one-off publishing
def publish_notification(
    workflow_id: str,
    subscriber_id: str,
    payload: Dict[str, Any],
    host: str = "rabbitmq",
    port: int = 5672,
) -> bool:
    """
    Convenience function to publish a single notification.

    Args:
        workflow_id: Novu workflow ID
        subscriber_id: Target subscriber ID
        payload: Notification data
        host: RabbitMQ host
        port: RabbitMQ port

    Returns:
        True if published successfully
    """
    event = NotificationEvent(
        workflow_id=workflow_id,
        subscriber_id=subscriber_id,
        payload=payload,
    )
    with NotificationPublisher(host=host, port=port) as publisher:
        return publisher.publish(event)
