#!/usr/bin/env python3
"""
RabbitMQ Streams Setup Script
=============================
Creates the necessary streams for the CNS service event-driven architecture.
"""

import os
import pika
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger('setup_rabbitmq')

# Configuration - uses AMQP port (5672), not Streams port
RABBITMQ_CONFIG = {
    'host': os.getenv('RABBITMQ_HOST', 'rabbitmq'),
    'port': int(os.getenv('RABBITMQ_PORT', '5672')),
    'user': os.getenv('RABBITMQ_USER', 'admin'),
    'password': os.getenv('RABBITMQ_PASS', 'admin123'),
    'virtual_host': os.getenv('RABBITMQ_VHOST', '/')
}

# Exchange configuration
EXCHANGE_NAME = 'platform.events'
EXCHANGE_TYPE = 'topic'

# Stream configurations
STREAMS = [
    {
        'name': 'stream.platform.bom',
        'description': 'Durable BOM lifecycle and upload events',
        'bindings': ['customer.bom.*'],
        'max_length_bytes': 5368709120,  # 5GB
    },
    {
        'name': 'stream.platform.enrichment',
        'description': 'Durable enrichment lifecycle and component events',
        'bindings': ['customer.bom.enrichment_*', 'enrichment.component.*', 'enrichment.api.*'],
        'max_length_bytes': 10737418240,  # 10GB
    },
    {
        'name': 'stream.platform.admin',
        'description': 'Durable admin workflow and bulk upload events',
        'bindings': ['admin.workflow.*', 'admin.bom.*', 'cns.bulk_upload.*', 'cns.bom.bulk_uploaded', 'cns.catalog.component_added'],
        'max_length_bytes': 5368709120,  # 5GB
    },
    {
        'name': 'stream.platform.audit',
        'description': 'Catch-all audit stream',
        'bindings': ['*.*.*'],
        'max_length_bytes': 10737418240,  # 10GB
    },
]

# Standard queues
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
        ]
    },
    {
        'name': 'audit-events',
        'description': 'Complete audit trail (all events)',
        'durable': True,
        'bindings': ['*.*.*'],
    },
]


def setup_rabbitmq():
    """Set up RabbitMQ exchanges, streams, and queues"""
    logger.info("=" * 70)
    logger.info("RabbitMQ Event System Setup")
    logger.info("=" * 70)
    logger.info(f"Connecting to RabbitMQ at {RABBITMQ_CONFIG['host']}:{RABBITMQ_CONFIG['port']}...")

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
        channel = connection.channel()

        logger.info("[OK] Connected to RabbitMQ")

        # 1. Declare main exchange
        logger.info(f"Creating exchange: '{EXCHANGE_NAME}' (type: {EXCHANGE_TYPE})")
        channel.exchange_declare(
            exchange=EXCHANGE_NAME,
            exchange_type=EXCHANGE_TYPE,
            durable=True,
            auto_delete=False
        )
        logger.info(f"[OK] Exchange '{EXCHANGE_NAME}' created")

        # 2. Declare dead letter exchange
        dlx_exchange = f"{EXCHANGE_NAME}.dlx"
        channel.exchange_declare(
            exchange=dlx_exchange,
            exchange_type='topic',
            durable=True,
            auto_delete=False
        )
        logger.info(f"[OK] Dead letter exchange '{dlx_exchange}' created")

        # 3. Create dead letter queue
        dlq_name = 'dead-letter-queue'
        channel.queue_declare(
            queue=dlq_name,
            durable=True,
            arguments={'x-message-ttl': 86400000}
        )
        channel.queue_bind(exchange=dlx_exchange, queue=dlq_name, routing_key='#')
        logger.info(f"[OK] Dead letter queue '{dlq_name}' created")

        # 4. Declare streams
        logger.info("-" * 70)
        logger.info(f"Creating {len(STREAMS)} event streams...")
        for stream_config in STREAMS:
            stream_name = stream_config['name']
            bindings = stream_config['bindings']
            max_length_bytes = stream_config.get('max_length_bytes', 1073741824)

            logger.info(f"Stream: {stream_name}")

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
            logger.info(f"  [OK] Stream '{stream_name}' created with {len(bindings)} bindings")

        # 5. Declare standard queues
        logger.info("-" * 70)
        logger.info(f"Creating {len(QUEUES)} event queues...")
        for queue_config in QUEUES:
            queue_name = queue_config['name']
            bindings = queue_config['bindings']

            logger.info(f"Queue: {queue_name}")

            channel.queue_declare(
                queue=queue_name,
                durable=queue_config.get('durable', True),
                arguments={
                    'x-dead-letter-exchange': dlx_exchange,
                    'x-dead-letter-routing-key': f"dlx.{queue_name}",
                    'x-max-length': 100000,
                }
            )

            for routing_key in bindings:
                channel.queue_bind(
                    exchange=EXCHANGE_NAME,
                    queue=queue_name,
                    routing_key=routing_key
                )
            logger.info(f"  [OK] Queue '{queue_name}' created with {len(bindings)} bindings")

        # Summary
        logger.info("=" * 70)
        logger.info("[OK] RabbitMQ Event System Setup Complete!")
        logger.info("=" * 70)
        logger.info(f"Exchange: {EXCHANGE_NAME}")
        logger.info(f"Streams: {len(STREAMS)}")
        logger.info(f"Queues: {len(QUEUES)}")

        connection.close()
        return True

    except Exception as e:
        logger.error(f"Error: {e}", exc_info=True)
        return False


if __name__ == '__main__':
    success = setup_rabbitmq()
    exit(0 if success else 1)
