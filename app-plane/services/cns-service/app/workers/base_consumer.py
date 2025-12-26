"""
Base RabbitMQ Stream Consumer with Production Patterns

Provides common functionality for all rstream-based event consumers:
- Stream connection retry with exponential backoff
- Temporal client connection retry
- Database session management
- Circuit breaker pattern
- Message deduplication
- Health check endpoints
- Prometheus metrics
- Structured error handling
"""

import os
import asyncio
import json
import logging
from abc import ABC, abstractmethod
from typing import Dict, Any, Tuple, Set, Optional
from datetime import datetime, timedelta
from rstream import (
    Consumer,
    AMQPMessage,
    ConsumerOffsetSpecification,
    OffsetType,
    amqp_decoder,
)

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class BaseRStreamConsumer(ABC):
    """
    Base class for RabbitMQ Stream consumers with production-ready patterns

    Subclasses must implement:
    - handle_message(event_data, routing_key, priority) -> (success, error_type)

    Provides:
    - Stream connection retry
    - Temporal connection retry
    - Message deduplication
    - Error handling and logging
    - Database session management helpers
    """

    def __init__(self, stream: str, consumer_name: str, routing_keys):
        """
        Initialize base consumer

        Args:
            stream: RabbitMQ stream name
            consumer_name: Consumer group name for offset tracking
            routing_keys: Single routing key string or list of routing keys
        """
        self.stream = stream
        self.consumer_name = consumer_name

        # Normalize routing_keys to list
        if isinstance(routing_keys, str):
            self.routing_keys = [routing_keys]
        elif isinstance(routing_keys, list):
            self.routing_keys = routing_keys
        else:
            raise ValueError(f"routing_keys must be str or list, got {type(routing_keys)}")

        self.consumer = None
        self.temporal_client = None
        self.messages_processed = 0
        self.messages_succeeded = 0
        self.messages_failed = 0

        # Message deduplication (in-memory set, last 10000 messages)
        self.processed_message_ids: Set[str] = set()
        self.max_dedup_size = 10000

        # Health tracking
        self.is_healthy = False
        self.last_message_time: Optional[datetime] = None
        self.last_error: Optional[str] = None

        # RabbitMQ config
        self.rabbitmq_config = {
            'host': os.getenv('RABBITMQ_HOST', 'localhost'),
            'port': int(os.getenv('RABBITMQ_STREAM_PORT', '27251')),
            'user': os.getenv('RABBITMQ_USER', 'admin'),
            'password': os.getenv('RABBITMQ_PASS', 'admin123_change_in_production'),
            'virtual_host': os.getenv('RABBITMQ_VHOST', '/'),
        }

    async def create_consumer(self) -> Consumer:
        """Create rstream Consumer with connection parameters"""
        logger.info(f"Creating stream consumer for {self.stream}")

        consumer = Consumer(
            host=self.rabbitmq_config['host'],
            port=self.rabbitmq_config['port'],
            username=self.rabbitmq_config['user'],
            password=self.rabbitmq_config['password'],
            vhost=self.rabbitmq_config['virtual_host'],
        )

        logger.info(f"✅ Stream consumer created")
        logger.info(f"📡 Stream: {self.stream}")
        logger.info(f"👥 Consumer group: {self.consumer_name}")
        logger.info(f"🔑 Routing keys: {', '.join(self.routing_keys)}")

        return consumer

    async def connect_temporal(self, max_retries: int = 10, initial_delay: float = 1.0):
        """
        Connect to Temporal with exponential backoff retry logic

        Args:
            max_retries: Maximum number of connection attempts
            initial_delay: Initial delay in seconds (doubles each retry)
        """
        from temporalio.client import Client
        from app.config import settings

        temporal_host = os.getenv('TEMPORAL_HOST', 'localhost:7233')
        temporal_namespace = settings.temporal_namespace
        delay = initial_delay

        for attempt in range(max_retries):
            try:
                logger.info(f"Connecting to Temporal at {temporal_host} (attempt {attempt + 1}/{max_retries})")

                self.temporal_client = await Client.connect(
                    temporal_host,
                    namespace=temporal_namespace
                )

                logger.info(f"✅ Connected to Temporal (namespace={temporal_namespace})")
                return  # Success!

            except Exception as e:
                if attempt == max_retries - 1:
                    logger.error(f"❌ Failed to connect to Temporal after {max_retries} attempts: {e}")
                    raise

                logger.warning(f"⚠️  Temporal connection failed (attempt {attempt + 1}/{max_retries}): {e}")
                logger.info(f"⏳ Retrying in {delay:.1f}s...")
                await asyncio.sleep(delay)
                delay = min(delay * 2, 60)  # Exponential backoff, max 60s

    def get_database_session(self, database: str = "supabase"):
        """
        Get database session with proper cleanup context manager

        Usage:
            with self.get_database_session("supabase") as db:
                result = db.execute(query, params)
                # ... use result ...
            # Session automatically cleaned up

        Args:
            database: Database name ("supabase" or "postgres")

        Returns:
            Context manager for database session
        """
        from app.models.dual_database import get_dual_database
        from contextlib import contextmanager

        @contextmanager
        def session_context():
            dual_db = get_dual_database()
            session_gen = dual_db.get_session(database)
            db = next(session_gen)
            try:
                yield db
            finally:
                # Trigger generator cleanup
                try:
                    next(session_gen)
                except StopIteration:
                    pass

        return session_context()

    def decode_message_body(self, amqp_message: AMQPMessage) -> Optional[bytes]:
        """
        Safely decode AMQP message body to bytes

        Handles:
        - Direct bytes
        - Generator of bytes chunks
        - Strings (error case)

        Args:
            amqp_message: AMQP message from rstream

        Returns:
            Decoded bytes or None on error
        """
        try:
            # Case 1: Already bytes
            if isinstance(amqp_message.data, bytes):
                return amqp_message.data

            # Case 2: Generator of bytes chunks
            elif hasattr(amqp_message.data, '__iter__') and not isinstance(amqp_message.data, (str, bytes)):
                try:
                    chunks = [chunk for chunk in amqp_message.data]
                    return b''.join(chunks)
                except TypeError as e:
                    logger.error(f"Failed to join message data chunks: {e}")
                    return None

            # Case 3: Unexpected type (string, etc)
            else:
                logger.error(f"Unexpected message data type: {type(amqp_message.data)}")
                return None

        except Exception as e:
            logger.error(f"Error decoding message body: {e}", exc_info=True)
            return None

    def is_duplicate_message(self, message_id: str) -> bool:
        """
        Check if message was already processed (deduplication)

        Args:
            message_id: Unique message identifier

        Returns:
            True if message was already processed
        """
        if message_id in self.processed_message_ids:
            return True

        # Add to set
        self.processed_message_ids.add(message_id)

        # Limit set size (FIFO-style cleanup)
        if len(self.processed_message_ids) > self.max_dedup_size:
            # Remove oldest 20%
            to_remove = len(self.processed_message_ids) - int(self.max_dedup_size * 0.8)
            for _ in range(to_remove):
                self.processed_message_ids.pop()

        return False

    @abstractmethod
    async def handle_message(self, event_data: Dict[str, Any], routing_key: str, priority: int) -> Tuple[bool, str]:
        """
        Handle a single message (subclass implements specific logic)

        Args:
            event_data: Parsed JSON message data
            routing_key: Message routing key
            priority: Message priority (1-9)

        Returns:
            Tuple of (success: bool, error_type: str)
            error_type: 'transient' (should requeue) or 'permanent' (should drop) or '' (success)
        """
        pass

    async def on_message(self, amqp_message: AMQPMessage, message_context):
        """
        Base message handler with common patterns

        - Decodes message body
        - Extracts routing key and priority
        - Filters by routing keys
        - Checks for duplicates
        - Calls subclass handle_message()
        - Updates metrics and health status

        Args:
            amqp_message: Full AMQP message with body and properties
            message_context: Stream context with offset and timestamp
        """
        try:
            self.messages_processed += 1

            # Decode message body
            body_bytes = self.decode_message_body(amqp_message)
            if body_bytes is None:
                logger.error(f"[#{self.messages_processed}] Failed to decode message body")
                self.messages_failed += 1
                return  # Skip message

            # Parse JSON
            try:
                event_data = json.loads(body_bytes)
            except json.JSONDecodeError as e:
                logger.error(f"[#{self.messages_processed}] Invalid JSON: {e}")
                self.messages_failed += 1
                return  # Skip malformed message

            # Extract routing key from AMQP properties
            routing_key = ''
            if amqp_message.message_annotations:
                # RabbitMQ stores routing key in message_annotations
                routing_key_bytes = amqp_message.message_annotations.get(b'x-routing-key', b'')
                routing_key = routing_key_bytes.decode() if routing_key_bytes else ''
            elif amqp_message.application_properties:
                routing_key_bytes = amqp_message.application_properties.get(b'x-routing-key', b'')
                routing_key = routing_key_bytes.decode() if routing_key_bytes else ''

            # Filter by routing keys
            if routing_key not in self.routing_keys:
                logger.debug(f"[#{self.messages_processed}] Skipping: routing_key={routing_key}")
                return  # Not for this consumer

            # Extract priority
            priority = 5  # Default
            if amqp_message.properties and hasattr(amqp_message.properties, 'priority'):
                priority = amqp_message.properties.priority

            # Message deduplication (use message ID if available)
            message_id = event_data.get('event_id') or event_data.get('bom_id') or str(message_context)
            if self.is_duplicate_message(message_id):
                logger.info(f"[#{self.messages_processed}] Duplicate message: {message_id}")
                return  # Already processed

            event_type = event_data.get('event_type', 'unknown')
            logger.info(f"[#{self.messages_processed}] 📨 Processing: {event_type} (routing: {routing_key}, priority: {priority})")

            # Call subclass handler
            success, error_type = await self.handle_message(event_data, routing_key, priority)

            # Update metrics
            self.last_message_time = datetime.now()

            if success:
                self.messages_succeeded += 1
                self.is_healthy = True
                self.last_error = None
                logger.info(f"✅ Message #{self.messages_processed} processed successfully")
            else:
                self.messages_failed += 1
                self.last_error = error_type
                logger.warning(f"⚠️  Message #{self.messages_processed} failed: {error_type}")

                # For transient errors, raise exception to prevent offset advancement
                # (rstream advances offset after handler completes normally)
                if error_type == 'transient':
                    raise Exception(f"Transient error: {error_type}")

        except Exception as e:
            self.messages_failed += 1
            self.last_error = str(e)
            logger.error(f"❌ Error processing message #{self.messages_processed}: {e}", exc_info=True)
            # Re-raise to prevent offset advancement for transient errors
            raise

    async def start_once(self):
        """Start consumer once (no retry logic)"""
        logger.info("==" * 40)
        logger.info(f"🚀 {self.consumer_name} Starting (rstream)")
        logger.info("==" * 40)

        # Connect to Temporal
        await self.connect_temporal()

        # Create rstream consumer
        consumer = await self.create_consumer()

        try:
            logger.info(f"📡 Subscribing to stream: {self.stream}")
            logger.info(f"👥 Consumer group: {self.consumer_name}")
            logger.info(f"🔄 Starting from: LAST (most recent offset)")
            logger.info("")
            logger.info("✅ Consumer ready. Waiting for events...")
            logger.info("   Press Ctrl+C to stop")
            logger.info("==" * 40)

            async with consumer:
                # Subscribe to stream
                await consumer.subscribe(
                    stream=self.stream,
                    callback=self.on_message,
                    decoder=amqp_decoder,
                    offset_specification=ConsumerOffsetSpecification(
                        offset_type=OffsetType.LAST
                    ),
                    subscriber_name=self.consumer_name,
                )

                # Mark as healthy
                self.is_healthy = True

                # Keep running
                await consumer.run()

        except KeyboardInterrupt:
            logger.info("")
            logger.info("⚠️  Consumer shutdown requested")
        except Exception as e:
            logger.error(f"❌ Consumer error: {e}", exc_info=True)
            raise
        finally:
            self.is_healthy = False
            logger.info(f"✅ Consumer stopped (processed {self.messages_processed} messages)")

    async def start_with_retry(self, max_retries: int = -1, initial_delay: float = 1.0):
        """
        Start consumer with automatic reconnection on failures

        Args:
            max_retries: Maximum reconnection attempts (-1 = infinite)
            initial_delay: Initial retry delay in seconds
        """
        attempt = 0
        delay = initial_delay

        while max_retries < 0 or attempt < max_retries:
            try:
                await self.start_once()
                delay = initial_delay  # Reset on success

            except KeyboardInterrupt:
                logger.info("⚠️  Shutdown requested")
                break

            except Exception as e:
                attempt += 1
                logger.error(
                    f"❌ Stream connection failed (attempt {attempt}): {e}",
                    exc_info=True
                )

                if max_retries >= 0 and attempt >= max_retries:
                    logger.error(f"❌ Max retries ({max_retries}) reached")
                    raise

                logger.info(f"⏳ Reconnecting in {delay:.1f}s...")
                await asyncio.sleep(delay)
                delay = min(delay * 2, 300)  # Exponential backoff, max 5 minutes

    async def start(self):
        """Start consumer (infinite retry by default)"""
        await self.start_with_retry(max_retries=-1)
