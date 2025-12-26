"""
Audit Logger Service - RabbitMQ Event Consumer
==============================================

Consumes events from RabbitMQ and stores them in Supabase audit_logs table.

This service subscribes to all platform events (auth.*, customer.*, admin.*, etc.)
and creates comprehensive audit trail records for compliance and security.

Environment Variables:
    RABBITMQ_HOST: RabbitMQ hostname (default: localhost)
    RABBITMQ_PORT: RabbitMQ port (default: 27250)
    RABBITMQ_USER: RabbitMQ username (default: admin)
    RABBITMQ_PASS: RabbitMQ password
    SUPABASE_URL: Supabase project URL
    SUPABASE_SERVICE_KEY: Supabase service role key (bypasses RLS)
"""

import os
import json
import signal
import sys
from datetime import datetime
from typing import Dict, Any, Optional

import pika
from pika.exceptions import AMQPConnectionError

from config import Config
from supabase_client import SupabaseClient
from shared.logger_config import get_logger

logger = get_logger('audit-logger')

# Global flag for graceful shutdown
shutdown_flag = False


class AuditLoggerService:
    """
    RabbitMQ consumer that stores all events in audit_logs table
    """

    def __init__(self):
        self.config = Config()
        self.supabase_client = SupabaseClient()
        self.connection = None
        self.channel = None

    def connect_rabbitmq(self):
        """Establish connection to RabbitMQ"""
        try:
            credentials = pika.PlainCredentials(
                self.config.RABBITMQ_USER,
                self.config.RABBITMQ_PASS
            )
            parameters = pika.ConnectionParameters(
                host=self.config.RABBITMQ_HOST,
                port=self.config.RABBITMQ_PORT,
                virtual_host=self.config.RABBITMQ_VHOST,
                credentials=credentials,
                heartbeat=600,
                blocked_connection_timeout=300
            )

            self.connection = pika.BlockingConnection(parameters)
            self.channel = self.connection.channel()

            logger.info(f"Connected to RabbitMQ at {self.config.RABBITMQ_HOST}:{self.config.RABBITMQ_PORT}")

        except AMQPConnectionError as e:
            logger.error(f"Failed to connect to RabbitMQ: {e}")
            raise

    def setup_queues(self):
        """
        Setup queues and bindings for audit logging

        We subscribe to all platform events using wildcard routing keys:
        - auth.* (login, logout)
        - customer.* (BOM operations, projects, organizations)
        - admin.* (workflow actions, admin operations)
        - enrichment.* (component enrichment events)
        - cns.* (CNS-specific events)
        """
        exchange = self.config.RABBITMQ_EXCHANGE

        # Declare exchange (should already exist, but ensure it's there)
        self.channel.exchange_declare(
            exchange=exchange,
            exchange_type='topic',
            durable=True
        )

        # Create audit logger queue
        queue_name = 'audit-logger'
        self.channel.queue_declare(queue=queue_name, durable=True)

        # Bind to all event categories using wildcard routing keys
        # Using # to match zero or more words (supports hierarchical routing keys like auth.user.login)
        routing_keys = [
            'auth.#',           # All auth events (auth.*, auth.user.*, auth.cns.*, etc.)
            'customer.#',       # All customer events (customer.*, customer.bom.*, etc.)
            'admin.#',          # All admin events (admin.*, admin.workflow.*, etc.)
            'enrichment.#',     # All enrichment events (enrichment.*, enrichment.catalog.*, etc.)
            'cns.#',            # All CNS events (cns.*, cns.catalog.*, etc.)
        ]

        for routing_key in routing_keys:
            self.channel.queue_bind(
                exchange=exchange,
                queue=queue_name,
                routing_key=routing_key
            )
            logger.info(f"Bound queue '{queue_name}' to routing key: {routing_key}")

        return queue_name

    def process_event(self, ch, method, properties, body):
        """
        Process incoming event and store in audit_logs table

        Args:
            ch: Channel
            method: Delivery method (contains routing_key)
            properties: Message properties
            body: Message body (JSON)
        """
        try:
            logger.info(f"[CALLBACK] Received message with routing_key: {method.routing_key}")

            # Parse event
            event = json.loads(body)
            routing_key = method.routing_key

            logger.info(f"[CALLBACK] Parsed event: {json.dumps(event)[:200]}...")

            # Extract common fields
            event_type = event.get('event_type', routing_key)
            timestamp = event.get('timestamp', datetime.utcnow().isoformat())

            # Extract actor information (who performed the action)
            user_id = event.get('user_id')
            username = event.get('username')
            email = event.get('email')
            ip_address = event.get('ip_address')
            user_agent = event.get('user_agent')
            source = event.get('source')
            session_id = event.get('session_id')
            tenant_id = event.get('tenant_id')

            # Store full event as JSONB
            event_data = event

            # Create audit log record
            audit_log = {
                'event_type': event_type,
                'routing_key': routing_key,
                'timestamp': timestamp,
                'user_id': user_id,
                'username': username,
                'email': email,
                'ip_address': ip_address,
                'user_agent': user_agent,
                'source': source,
                'session_id': session_id,
                'tenant_id': tenant_id,
                'event_data': event_data,
            }

            # Remove None values (Supabase handles defaults)
            audit_log = {k: v for k, v in audit_log.items() if v is not None}

            logger.info(f"[CALLBACK] Inserting audit log: event_type={event_type}, email={email}")

            # Insert into Supabase
            result = self.supabase_client.insert_audit_log(audit_log)

            logger.info(f"[CALLBACK] Insert result: {result is not None}")

            if result:
                logger.info(f"✓ Stored audit log: {event_type} (routing_key: {routing_key}, email: {email})")
            else:
                logger.warning(f"✗ Failed to store audit log: {event_type}")

            # Acknowledge message
            ch.basic_ack(delivery_tag=method.delivery_tag)

        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse event JSON: {e}")
            # Reject and don't requeue malformed messages
            ch.basic_nack(delivery_tag=method.delivery_tag, requeue=False)

        except Exception as e:
            logger.error(f"Error processing event: {e}", exc_info=True)
            # Reject and requeue for retry
            ch.basic_nack(delivery_tag=method.delivery_tag, requeue=True)

    def start(self):
        """Start consuming events"""
        try:
            self.connect_rabbitmq()
            queue_name = self.setup_queues()

            logger.info(f"Starting audit logger service...")
            logger.info(f"Consuming from queue: {queue_name}")
            logger.info(f"Storing audit logs in Supabase table: audit_logs")

            # Start consuming
            self.channel.basic_qos(prefetch_count=10)  # Process 10 messages at a time
            self.channel.basic_consume(
                queue=queue_name,
                on_message_callback=self.process_event
            )

            logger.info("Audit logger service is running. Press CTRL+C to exit.")
            self.channel.start_consuming()

        except KeyboardInterrupt:
            logger.info("Received shutdown signal...")
            self.stop()

        except Exception as e:
            logger.error(f"Fatal error in audit logger service: {e}", exc_info=True)
            self.stop()
            sys.exit(1)

    def stop(self):
        """Gracefully stop the service"""
        logger.info("Shutting down audit logger service...")

        if self.channel and not self.channel.is_closed:
            self.channel.stop_consuming()

        if self.connection and not self.connection.is_closed:
            self.connection.close()

        logger.info("Audit logger service stopped")


def signal_handler(sig, frame):
    """Handle shutdown signals"""
    global shutdown_flag
    logger.info(f"Received signal {sig}, initiating graceful shutdown...")
    shutdown_flag = True


if __name__ == '__main__':
    # Register signal handlers for graceful shutdown
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)

    # Start service
    logger.info("=" * 70)
    logger.info("Audit Logger Service - Starting")
    logger.info("=" * 70)

    service = AuditLoggerService()
    service.start()
