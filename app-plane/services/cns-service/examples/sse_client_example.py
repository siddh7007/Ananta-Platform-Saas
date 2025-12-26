#!/usr/bin/env python3
"""
SSE Client Example for BOM Enrichment Progress

Demonstrates how to consume the Server-Sent Events endpoint for real-time
BOM enrichment progress tracking.

Usage:
    python sse_client_example.py --bom-id <uuid> --token <admin_token_or_jwt>

Requirements:
    pip install httpx
"""

import argparse
import asyncio
import json
import logging
from datetime import datetime
from typing import AsyncIterator

import httpx

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class BOMEnrichmentProgressClient:
    """Client for consuming BOM enrichment progress via SSE"""

    def __init__(self, base_url: str, bom_id: str, token: str):
        self.base_url = base_url.rstrip('/')
        self.bom_id = bom_id
        self.token = token
        self.client = None

    async def connect(self) -> AsyncIterator[dict]:
        """
        Connect to SSE stream and yield parsed events

        Yields:
            dict: Parsed event data
        """
        url = f"{self.base_url}/api/enrichment/stream/{self.bom_id}?token={self.token}"

        logger.info(f"Connecting to SSE stream: {url}")

        async with httpx.AsyncClient(timeout=300.0) as client:
            self.client = client

            async with client.stream('GET', url, headers={
                'Accept': 'text/event-stream',
                'Cache-Control': 'no-cache'
            }) as response:
                if response.status_code != 200:
                    error_text = await response.aread()
                    raise Exception(
                        f"SSE connection failed: {response.status_code} - {error_text.decode()}"
                    )

                logger.info("SSE connection established")

                event_type = None
                event_data = None

                async for line in response.aiter_lines():
                    line = line.strip()

                    # Skip empty lines and keepalive comments
                    if not line or line.startswith(':'):
                        continue

                    # Parse SSE fields
                    if line.startswith('event:'):
                        event_type = line[6:].strip()

                    elif line.startswith('data:'):
                        data_str = line[5:].strip()
                        try:
                            event_data = json.loads(data_str)
                        except json.JSONDecodeError as e:
                            logger.warning(f"Failed to parse event data: {e}")
                            continue

                        # Yield complete event
                        if event_type and event_data:
                            yield {
                                'event': event_type,
                                'data': event_data,
                                'timestamp': datetime.utcnow().isoformat()
                            }

                            # Reset for next event
                            event_type = None
                            event_data = None

    async def monitor_progress(self) -> dict:
        """
        Monitor enrichment progress until completion

        Returns:
            dict: Final enrichment summary
        """
        progress_data = {
            'status': 'unknown',
            'percent_complete': 0.0,
            'total_items': 0,
            'enriched_items': 0,
            'failed_items': 0,
            'start_time': datetime.utcnow(),
            'end_time': None
        }

        try:
            async for event in self.connect():
                event_type = event['event']
                data = event['data']

                if event_type == 'connected':
                    logger.info(f"Connected to stream for BOM: {data.get('bom_id')}")

                elif event_type == 'enrichment.progress':
                    state = data.get('state', {})
                    progress_data.update({
                        'status': 'enriching',
                        'percent_complete': state.get('percent_complete', 0.0),
                        'total_items': state.get('total_items', 0),
                        'enriched_items': state.get('enriched_items', 0),
                        'failed_items': state.get('failed_items', 0),
                    })

                    logger.info(
                        f"Progress: {progress_data['enriched_items']}/{progress_data['total_items']} "
                        f"({progress_data['percent_complete']:.1f}%)"
                    )

                    # Optional: Display batch info
                    payload = data.get('payload', {})
                    batch_info = payload.get('batch', {})
                    if batch_info:
                        logger.info(
                            f"  Batch {batch_info.get('batch_number')}: "
                            f"{batch_info.get('completed')} items completed"
                        )

                elif event_type == 'enrichment.completed':
                    state = data.get('state', {})
                    progress_data.update({
                        'status': 'completed',
                        'percent_complete': 100.0,
                        'total_items': state.get('total_items', 0),
                        'enriched_items': state.get('enriched_items', 0),
                        'failed_items': state.get('failed_items', 0),
                        'end_time': datetime.utcnow()
                    })

                    logger.info("Enrichment completed successfully!")
                    logger.info(
                        f"Final: {progress_data['enriched_items']} enriched, "
                        f"{progress_data['failed_items']} failed"
                    )

                elif event_type == 'enrichment.failed':
                    state = data.get('state', {})
                    error_message = state.get('error_message', 'Unknown error')
                    progress_data.update({
                        'status': 'failed',
                        'error': error_message,
                        'end_time': datetime.utcnow()
                    })

                    logger.error(f"Enrichment failed: {error_message}")

                elif event_type == 'stream_end':
                    reason = data.get('reason')
                    logger.info(f"Stream ended: {reason}")
                    break

                elif event_type == 'error':
                    message = data.get('message', 'Unknown error')
                    logger.error(f"Error event received: {message}")
                    progress_data['status'] = 'error'
                    progress_data['error'] = message
                    break

        except Exception as e:
            logger.error(f"SSE connection error: {e}")
            progress_data['status'] = 'error'
            progress_data['error'] = str(e)

        # Calculate duration
        if progress_data['end_time']:
            duration = (progress_data['end_time'] - progress_data['start_time']).total_seconds()
            progress_data['duration_seconds'] = duration
            logger.info(f"Total duration: {duration:.1f} seconds")

        return progress_data


async def main():
    parser = argparse.ArgumentParser(
        description='Monitor BOM enrichment progress via SSE'
    )
    parser.add_argument(
        '--bom-id',
        required=True,
        help='BOM ID to monitor'
    )
    parser.add_argument(
        '--token',
        required=True,
        help='Admin API token or JWT'
    )
    parser.add_argument(
        '--base-url',
        default='http://localhost:27200',
        help='CNS service base URL (default: http://localhost:27200)'
    )

    args = parser.parse_args()

    client = BOMEnrichmentProgressClient(
        base_url=args.base_url,
        bom_id=args.bom_id,
        token=args.token
    )

    logger.info("=" * 60)
    logger.info("BOM Enrichment Progress Monitor")
    logger.info("=" * 60)
    logger.info(f"BOM ID: {args.bom_id}")
    logger.info(f"Base URL: {args.base_url}")
    logger.info("=" * 60)

    result = await client.monitor_progress()

    logger.info("=" * 60)
    logger.info("Final Summary:")
    logger.info(f"  Status: {result['status']}")
    logger.info(f"  Total Items: {result['total_items']}")
    logger.info(f"  Enriched: {result['enriched_items']}")
    logger.info(f"  Failed: {result['failed_items']}")
    if result.get('duration_seconds'):
        logger.info(f"  Duration: {result['duration_seconds']:.1f} seconds")
    if result.get('error'):
        logger.info(f"  Error: {result['error']}")
    logger.info("=" * 60)


if __name__ == '__main__':
    asyncio.run(main())
