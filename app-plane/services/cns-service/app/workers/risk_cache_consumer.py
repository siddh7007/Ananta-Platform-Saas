"""
Risk Cache Consumer

RabbitMQ consumer that listens for risk.calculated events and populates
the Redis read model cache for fast risk score lookups.

This enables the cache-aside pattern where:
1. RiskCalculator publishes risk.calculated event after each calculation
2. This consumer receives the event and caches the score in Redis
3. Risk API checks Redis cache first before querying database

Event Format:
{
    "event_type": "risk.calculated",
    "component_id": "uuid",
    "organization_id": "uuid",
    "mpn": "string",
    "manufacturer": "string",
    "total_risk_score": int,
    "risk_level": "string",
    "factor_scores": {
        "lifecycle": int,
        "supply_chain": int,
        "compliance": int,
        "obsolescence": int,
        "single_source": int
    },
    "calculated_at": "ISO datetime string"
}
"""

import json
import logging
import os
import signal
import sys
import time
from typing import Dict, Any

import pika
from pika.exceptions import AMQPConnectionError

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
    stream=sys.stdout,
)
logger = logging.getLogger("risk-cache-consumer")

# Configuration from environment
RABBITMQ_HOST = os.getenv("RABBITMQ_HOST", "rabbitmq")
RABBITMQ_PORT = int(os.getenv("RABBITMQ_PORT", "5672"))
RABBITMQ_USER = os.getenv("RABBITMQ_USER", "admin")
RABBITMQ_PASSWORD = os.getenv("RABBITMQ_PASSWORD", "admin123_change_in_production")

REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379/0")

EXCHANGE_NAME = "platform.events"
QUEUE_NAME = "risk-cache-updates"
ROUTING_KEY = "risk.calculated.#"  # All risk.calculated events

# Retry settings
MAX_RETRIES = 5
RETRY_DELAY = 5  # seconds


class RiskCacheConsumer:
    """
    RabbitMQ consumer that populates Redis cache from risk.calculated events.

    This is part of the CQRS/event-driven cache pattern where:
    - Write side: RiskCalculatorService stores in Supabase and publishes event
    - Read side: This consumer populates Redis for fast lookups
    """

    def __init__(self):
        self.connection = None
        self.channel = None
        self.redis_client = None
        self._init_redis()

    def _init_redis(self):
        """Initialize Redis client."""
        try:
            import redis
            self.redis_client = redis.from_url(
                REDIS_URL,
                decode_responses=True,
                socket_connect_timeout=5,
            )
            # Test connection
            self.redis_client.ping()
            logger.info(f"Connected to Redis at {REDIS_URL}")
        except Exception as e:
            logger.warning(f"Redis connection failed, running in stub mode: {e}")
            self.redis_client = None

    def _connect_rabbitmq(self) -> bool:
        """Connect to RabbitMQ with retry logic."""
        for attempt in range(MAX_RETRIES):
            try:
                credentials = pika.PlainCredentials(RABBITMQ_USER, RABBITMQ_PASSWORD)
                parameters = pika.ConnectionParameters(
                    host=RABBITMQ_HOST,
                    port=RABBITMQ_PORT,
                    credentials=credentials,
                    heartbeat=600,
                    blocked_connection_timeout=300,
                )
                self.connection = pika.BlockingConnection(parameters)
                self.channel = self.connection.channel()

                # Declare main exchange
                self.channel.exchange_declare(
                    exchange=EXCHANGE_NAME,
                    exchange_type="topic",
                    durable=True,
                )

                # Declare dead-letter exchange (DLX) for failed messages
                self.channel.exchange_declare(
                    exchange=f"{EXCHANGE_NAME}.dlx",
                    exchange_type="topic",
                    durable=True,
                )

                # Declare queue with DLX
                self.channel.queue_declare(
                    queue=QUEUE_NAME,
                    durable=True,
                    arguments={
                        "x-message-ttl": 86400000,  # 24 hours
                        "x-dead-letter-exchange": f"{EXCHANGE_NAME}.dlx",
                    },
                )

                # Bind queue to exchange
                self.channel.queue_bind(
                    exchange=EXCHANGE_NAME,
                    queue=QUEUE_NAME,
                    routing_key=ROUTING_KEY,
                )

                logger.info(f"Connected to RabbitMQ at {RABBITMQ_HOST}:{RABBITMQ_PORT}")
                logger.info(f"Bound to exchange '{EXCHANGE_NAME}' with routing key '{ROUTING_KEY}'")
                return True

            except AMQPConnectionError as e:
                logger.warning(f"RabbitMQ connection attempt {attempt + 1}/{MAX_RETRIES} failed: {e}")
                if attempt < MAX_RETRIES - 1:
                    time.sleep(RETRY_DELAY)
                else:
                    logger.error("Failed to connect to RabbitMQ after max retries")
                    return False

        return False

    def _cache_risk_score(self, event_data: Dict[str, Any]) -> bool:
        """
        Cache risk score in Redis.

        Args:
            event_data: risk.calculated event data

        Returns:
            True if cached successfully
        """
        if not self.redis_client:
            logger.debug("[STUB] Would cache risk score")
            return True

        try:
            org_id = event_data.get("organization_id")
            component_id = event_data.get("component_id")

            if not org_id or not component_id:
                logger.warning("Missing organization_id or component_id in event")
                return False

            # Build cache key
            key = f"risk:org:{org_id}:component:{component_id}"

            # Build cache data
            cache_data = {
                "component_id": component_id,
                "organization_id": org_id,
                "mpn": event_data.get("mpn"),
                "manufacturer": event_data.get("manufacturer"),
                "total_risk_score": event_data.get("total_risk_score", 0),
                "risk_level": event_data.get("risk_level", "low"),
                "factor_scores": event_data.get("factor_scores", {}),
                "cached_at": event_data.get("calculated_at"),
            }

            # Cache with 1 hour TTL
            self.redis_client.setex(
                key,
                3600,  # 1 hour TTL
                json.dumps(cache_data),
            )

            logger.info(
                f"Cached risk score: component={component_id}, "
                f"score={cache_data['total_risk_score']}, org={org_id}"
            )
            return True

        except Exception as e:
            logger.error(f"Failed to cache risk score: {e}")
            return False

    def _process_message(self, ch, method, properties, body):
        """Process incoming risk.calculated event."""
        try:
            message = json.loads(body)
            event_type = message.get("event_type", "unknown")

            logger.info(f"Received event: type={event_type}")

            # Only process risk.calculated events
            if event_type != "risk.calculated":
                logger.debug(f"Ignoring event type: {event_type}")
                ch.basic_ack(delivery_tag=method.delivery_tag)
                return

            component_id = message.get("component_id")
            org_id = message.get("organization_id")

            if not component_id or not org_id:
                logger.warning("Missing component_id or organization_id")
                ch.basic_ack(delivery_tag=method.delivery_tag)
                return

            # Cache the risk score
            success = self._cache_risk_score(message)

            if success:
                ch.basic_ack(delivery_tag=method.delivery_tag)
            else:
                # Requeue for retry
                ch.basic_nack(delivery_tag=method.delivery_tag, requeue=True)

        except json.JSONDecodeError as e:
            logger.error(f"Invalid JSON in message: {e}")
            ch.basic_nack(delivery_tag=method.delivery_tag, requeue=False)
        except Exception as e:
            logger.error(f"Error processing message: {e}")
            ch.basic_nack(delivery_tag=method.delivery_tag, requeue=True)

    def _setup_signal_handlers(self):
        """Setup signal handlers for graceful shutdown."""
        def signal_handler(signum, frame):
            sig_name = signal.Signals(signum).name
            logger.info(f"Received {sig_name}, initiating graceful shutdown...")
            self.stop()
            sys.exit(0)

        signal.signal(signal.SIGTERM, signal_handler)
        signal.signal(signal.SIGINT, signal_handler)

    def start(self):
        """Start consuming messages from RabbitMQ."""
        # Setup signal handlers for container orchestration
        self._setup_signal_handlers()

        if not self._connect_rabbitmq():
            logger.error("Cannot start consumer - RabbitMQ connection failed")
            sys.exit(1)

        # Set QoS
        self.channel.basic_qos(prefetch_count=10)

        # Start consuming
        self.channel.basic_consume(
            queue=QUEUE_NAME,
            on_message_callback=self._process_message,
            auto_ack=False,
        )

        logger.info("Risk cache consumer started, waiting for messages...")
        logger.info(f"Redis configured: {self.redis_client is not None}")

        try:
            self.channel.start_consuming()
        except KeyboardInterrupt:
            logger.info("Shutting down consumer...")
            self.channel.stop_consuming()
        finally:
            if self.connection:
                self.connection.close()

    def stop(self):
        """Stop the consumer gracefully."""
        if self.channel:
            self.channel.stop_consuming()
        if self.connection:
            self.connection.close()


if __name__ == "__main__":
    logger.info("=" * 60)
    logger.info("Risk Cache Consumer Service Starting")
    logger.info("=" * 60)
    logger.info(f"RabbitMQ: {RABBITMQ_HOST}:{RABBITMQ_PORT}")
    logger.info(f"Redis: {REDIS_URL}")
    logger.info(f"Exchange: {EXCHANGE_NAME}")
    logger.info(f"Queue: {QUEUE_NAME}")
    logger.info(f"Routing Key: {ROUTING_KEY}")
    logger.info("=" * 60)

    consumer = RiskCacheConsumer()
    consumer.start()
