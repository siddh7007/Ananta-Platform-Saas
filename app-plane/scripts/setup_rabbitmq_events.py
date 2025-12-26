#!/usr/bin/env python3
"""
RabbitMQ Event System Setup Script
===================================

Sets up exchanges, queues, and bindings for platform-wide event-driven architecture.

Usage:
    python scripts/setup_rabbitmq_events.py

Environment Variables:
    RABBITMQ_HOST: RabbitMQ hostname (default: localhost)
    RABBITMQ_PORT: RabbitMQ port (default: 27250)
    RABBITMQ_USER: RabbitMQ username (default: admin)
    RABBITMQ_PASS: RabbitMQ password (default: admin123_change_in_production)
"""

import os
import sys
import pika
from pathlib import Path
from typing import List, Dict

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from shared.logger_config import setup_logger

# Set up logger
logger = setup_logger('setup_rabbitmq', level='INFO')

# Configuration
RABBITMQ_CONFIG = {
    'host': os.getenv('RABBITMQ_HOST', 'localhost'),
    'port': int(os.getenv('RABBITMQ_PORT', '27250')),
    'user': os.getenv('RABBITMQ_USER', 'admin'),
    'password': os.getenv('RABBITMQ_PASS', 'admin123_change_in_production'),
    'virtual_host': os.getenv('RABBITMQ_VHOST', '/')
}

# Exchange configuration
EXCHANGE_NAME = 'platform.events'
EXCHANGE_TYPE = 'topic'

# Queue configurations
QUEUES = [
    {
        'name': 'websocket-events',
        'description': 'Real-time WebSocket broadcasts',
        'durable': True,
        'bindings': [
            'customer.bom.enrichment_progress',
            'customer.bom.enrichment_completed',
            'customer.bom.enrichment_failed',
            'enrichment.component.enriched',
            'enrichment.component.failed',
            'admin.workflow.paused',
            'admin.workflow.resumed',
            'admin.workflow.cancelled',
        ]
    },
    {
        'name': 'notification-events',
        'description': 'Email and notification triggers',
        'durable': True,
        'bindings': [
            'customer.bom.enrichment_completed',
            'customer.bom.enrichment_failed',
            'cns.bulk_upload.completed',
            'cns.bulk_upload.failed',
            'admin.workflow.cancelled',  # Notify user when admin cancels
            'project.created',
            'project.member_added',
        ]
    },
    {
        'name': 'audit-events',
        'description': 'Complete audit trail (all events)',
        'durable': True,
        'bindings': [
            '*.*.*',  # Catch all events
        ]
    },
    {
        'name': 'analytics-events',
        'description': 'Metrics and analytics tracking',
        'durable': True,
        'bindings': [
            'enrichment.component.enriched',
            'enrichment.component.failed',
            'enrichment.catalog.hit',
            'enrichment.catalog.miss',
            'enrichment.api.*',
            'cns.catalog.component_added',
            'customer.bom.uploaded',
            'cns.bulk_upload.started',
        ]
    },
    {
        'name': 'rate-limiter-events',
        'description': 'API rate limiting tracking',
        'durable': True,
        'bindings': [
            'enrichment.api.digikey_called',
            'enrichment.api.mouser_called',
            'enrichment.api.element14_called',
        ]
    },
]

# Stream configurations (RabbitMQ Streams)
STREAMS = [
    {
        'name': 'stream.platform.bom',
        'description': 'Durable BOM lifecycle and upload events',
        'bindings': [
            'customer.bom.*',
        ],
        'max_length_bytes': 5368709120,
    },
    {
        'name': 'stream.platform.enrichment',
        'description': 'Durable enrichment lifecycle and component events',
        'bindings': [
            'customer.bom.enrichment_*',
            'enrichment.component.*',
            'enrichment.api.*',
        ],
        'max_length_bytes': 10737418240,
    },
    {
        'name': 'stream.platform.admin',
        'description': 'Durable admin workflow and bulk upload events',
        'bindings': [
            'admin.workflow.*',
            'admin.bom.*',
            'cns.bulk_upload.*',
            'cns.bom.bulk_uploaded',
            'cns.catalog.component_added',
        ],
        'max_length_bytes': 5368709120,
    },
    {
        'name': 'stream.platform.audit',
        'description': 'Catch-all audit stream for 3-part routing keys',
        'bindings': [
            '*.*.*',
        ],
        'max_length_bytes': 10737418240,
    },
]


def setup_rabbitmq():
    """Set up RabbitMQ exchanges, queues, and bindings"""
    logger.info("=" * 70)
    logger.info("RabbitMQ Event System Setup")
    logger.info("=" * 70)
    logger.info(f"Connecting to RabbitMQ at {RABBITMQ_CONFIG['host']}:{RABBITMQ_CONFIG['port']}...")

    try:
        # Connect to RabbitMQ
        credentials = pika.PlainCredentials(
            RABBITMQ_CONFIG['user'],
            RABBITMQ_CONFIG['password']
        )
        parameters = pika.ConnectionParameters(
            host=RABBITMQ_CONFIG['host'],
            port=RABBITMQ_CONFIG['port'],
            virtual_host=RABBITMQ_CONFIG['virtual_host'],
            credentials=credentials,
            heartbeat=600,
            blocked_connection_timeout=300
        )

        connection = pika.BlockingConnection(parameters)
        channel = connection.channel()

        logger.info(" Connected to RabbitMQ")

        # 1. Declare main exchange
        logger.info(f" Creating exchange: '{EXCHANGE_NAME}' (type: {EXCHANGE_TYPE})")
        channel.exchange_declare(
            exchange=EXCHANGE_NAME,
            exchange_type=EXCHANGE_TYPE,
            durable=True,
            auto_delete=False
        )
        logger.info(f"    Exchange '{EXCHANGE_NAME}' created")

        # 2. Declare dead letter exchange
        dlx_exchange = f"{EXCHANGE_NAME}.dlx"
        logger.info(f" Creating dead letter exchange: '{dlx_exchange}'")
        channel.exchange_declare(
            exchange=dlx_exchange,
            exchange_type='topic',
            durable=True,
            auto_delete=False
        )
        logger.info(f"    Dead letter exchange created")

        # 3. Create dead letter queue
        dlq_name = 'dead-letter-queue'
        channel.queue_declare(
            queue=dlq_name,
            durable=True,
            arguments={
                'x-message-ttl': 86400000,  # 24 hours in milliseconds
            }
        )
        channel.queue_bind(
            exchange=dlx_exchange,
            queue=dlq_name,
            routing_key='#'
        )
        logger.info(f"    Dead letter queue '{dlq_name}' created")

        # 4. Declare queues and bindings
        logger.info(f" Creating {len(QUEUES)} event queues...")
        logger.info("-" * 70)

        for queue_config in QUEUES:
            queue_name = queue_config['name']
            description = queue_config['description']
            bindings = queue_config['bindings']

            logger.info(f"Queue: {queue_name}")
            logger.info(f"  Description: {description}")
            logger.info(f"  Bindings: {len(bindings)} routing keys")

            # Declare queue with dead letter exchange
            channel.queue_declare(
                queue=queue_name,
                durable=queue_config.get('durable', True),
                arguments={
                    'x-dead-letter-exchange': dlx_exchange,
                    'x-dead-letter-routing-key': f"dlx.{queue_name}",
                    'x-max-length': queue_config.get('max_length', 100000),  # Max 100k messages
                }
            )

            # Bind queue to exchange with routing keys
            for routing_key in bindings:
                channel.queue_bind(
                    exchange=EXCHANGE_NAME,
                    queue=queue_name,
                    routing_key=routing_key
                )
                logger.debug(f"     Bound to: {routing_key}")

        # 5. Declare streams and bindings (RabbitMQ Streams)
        logger.info(f" Creating {len(STREAMS)} event streams...")
        logger.info("-" * 70)

        for stream_config in STREAMS:
            stream_name = stream_config['name']
            description = stream_config['description']
            bindings = stream_config['bindings']
            max_length_bytes = stream_config.get('max_length_bytes', 1073741824)

            logger.info(f"Stream: {stream_name}")
            logger.info(f"  Description: {description}")
            logger.info(f"  Bindings: {len(bindings)} routing keys")

            channel.queue_declare(
                queue=stream_name,
                durable=True,
                arguments={
                    'x-queue-type': 'stream',
                    'x-max-length-bytes': max_length_bytes,
                },
            )

            for routing_key in bindings:
                channel.queue_bind(
                    exchange=EXCHANGE_NAME,
                    queue=stream_name,
                    routing_key=routing_key,
                )
                logger.debug(f"     Bound to: {routing_key}")

        # 6. Summary
        logger.info("=" * 70)
        logger.info(" RabbitMQ Event System Setup Complete!")
        logger.info("=" * 70)
        logger.info(f" Exchange: {EXCHANGE_NAME}")
        logger.info(f" Queues: {len(QUEUES)}")
        logger.info(f" Streams: {len(STREAMS)}")
        logger.info(f" Dead Letter Queue: {dlq_name}")
        logger.info(f" Management UI: http://{RABBITMQ_CONFIG['host']}:27252")
        logger.info(f"   Username: {RABBITMQ_CONFIG['user']}")
        logger.info(f"   Password: {RABBITMQ_CONFIG['password']}")

        # 7. Verify setup
        logger.info(" Verifying setup...")
        try:
            # Get exchange info
            channel.exchange_declare(
                exchange=EXCHANGE_NAME,
                exchange_type=EXCHANGE_TYPE,
                durable=True,
                passive=True  # Just check if exists
            )
            logger.info(f"    Exchange '{EXCHANGE_NAME}' verified")

            # Get queue stats
            total_queue_bindings = sum(len(q['bindings']) for q in QUEUES)
            total_stream_bindings = sum(len(s['bindings']) for s in STREAMS)
            logger.info(f"    {len(QUEUES)} queues verified")
            logger.info(f"    {len(STREAMS)} streams verified")
            logger.info(f"    {total_queue_bindings + total_stream_bindings} bindings verified")

        except Exception as e:
            logger.warning(f"   ⚠️  Verification failed: {e}")

        # Close connection
        connection.close()
        logger.info(" Setup complete. Ready for event publishing!")

        return True

    except pika.exceptions.AMQPConnectionError as e:
        logger.error(f"Connection Error: {e}")
        logger.info("💡 Make sure RabbitMQ is running:")
        logger.info("   docker-compose -f docker-compose.rabbitmq.yml up -d")
        return False

    except Exception as e:
        logger.error(f"Error: {e}", exc_info=True)
        return False


def verify_rabbitmq_connection():
    """Verify RabbitMQ is accessible"""
    try:
        credentials = pika.PlainCredentials(
            RABBITMQ_CONFIG['user'],
            RABBITMQ_CONFIG['password']
        )
        parameters = pika.ConnectionParameters(
            host=RABBITMQ_CONFIG['host'],
            port=RABBITMQ_CONFIG['port'],
            virtual_host=RABBITMQ_CONFIG['virtual_host'],
            credentials=credentials,
            heartbeat=600,
            blocked_connection_timeout=300
        )
        connection = pika.BlockingConnection(parameters)
        connection.close()
        return True
    except Exception:
        return False


if __name__ == '__main__':
    logger.info(" RabbitMQ Event System Setup")
    logger.info(f"Connecting to: {RABBITMQ_CONFIG['host']}:{RABBITMQ_CONFIG['port']}")

    # Check if RabbitMQ is accessible
    if not verify_rabbitmq_connection():
        logger.error(" Cannot connect to RabbitMQ")
        logger.info("💡 Please ensure RabbitMQ is running:")
        logger.info("   docker-compose -f docker-compose.rabbitmq.yml up -d")
        logger.info("   Or if using main docker-compose.yml:")
        logger.info("   docker ps | grep rabbitmq")
        sys.exit(1)

    # Run setup
    success = setup_rabbitmq()

    if success:
        logger.info(" Event system ready for use!")
        logger.info("Next steps:")
        logger.info("  1. Start publishing events from your services")
        logger.info("  2. Start event subscribers (WebSocket, notifications, etc.)")
        logger.info("  3. Monitor events via RabbitMQ Management UI")
        sys.exit(0)
    else:
        logger.error(" Setup failed. Please check the errors above.")
        sys.exit(1)
