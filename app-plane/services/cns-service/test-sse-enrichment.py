#!/usr/bin/env python3
"""
SSE Enrichment Stream Test Script

Tests the CNS Service SSE endpoint for real-time BOM enrichment progress.
"""

import sys
import json
import time
import argparse
from typing import Optional
from datetime import datetime

try:
    import requests
    from sseclient import SSEClient
except ImportError:
    print("ERROR: Required packages not installed")
    print("Install with: pip install requests sseclient-py")
    sys.exit(1)


class Colors:
    """Terminal colors for better output"""
    HEADER = '\033[95m'
    BLUE = '\033[94m'
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    RED = '\033[91m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'


def print_colored(message: str, color: str = Colors.ENDC):
    """Print colored message"""
    print(f"{color}{message}{Colors.ENDC}")


def test_sse_stream(
    bom_id: str,
    token: Optional[str] = None,
    api_url: str = "http://localhost:27200",
    timeout: int = 300
):
    """
    Test SSE enrichment stream endpoint.

    Args:
        bom_id: BOM ID to stream events for
        token: JWT or admin token for authentication
        api_url: CNS API base URL
        timeout: Connection timeout in seconds
    """
    print_colored(f"\n{'='*60}", Colors.HEADER)
    print_colored("SSE Enrichment Stream Test", Colors.HEADER + Colors.BOLD)
    print_colored(f"{'='*60}\n", Colors.HEADER)

    # Build SSE URL
    stream_url = f"{api_url}/api/enrichment/stream/{bom_id}"
    if token:
        stream_url += f"?token={token}"

    print_colored(f"BOM ID: {bom_id}", Colors.BLUE)
    print_colored(f"API URL: {api_url}", Colors.BLUE)
    print_colored(f"Stream URL: {stream_url}", Colors.BLUE)
    print_colored(f"Timeout: {timeout}s\n", Colors.BLUE)

    # Test health endpoint first
    print_colored("Testing health endpoint...", Colors.YELLOW)
    try:
        health_response = requests.get(f"{api_url}/api/enrichment/health", timeout=5)
        if health_response.status_code == 200:
            health_data = health_response.json()
            print_colored(f"  Status: {health_data.get('status')}", Colors.GREEN)
            print_colored(f"  Redis: {health_data.get('redis')}\n", Colors.GREEN)
        else:
            print_colored(f"  Health check failed: {health_response.status_code}\n", Colors.RED)
    except Exception as e:
        print_colored(f"  Health check error: {e}\n", Colors.RED)

    # Connect to SSE stream
    print_colored("Connecting to SSE stream...", Colors.YELLOW)

    try:
        response = requests.get(
            stream_url,
            stream=True,
            timeout=timeout,
            headers={
                "Accept": "text/event-stream",
                "Cache-Control": "no-cache",
            }
        )

        if response.status_code != 200:
            print_colored(f"\nERROR: HTTP {response.status_code}", Colors.RED)
            print_colored(f"Response: {response.text}\n", Colors.RED)
            return False

        print_colored("Connected successfully!\n", Colors.GREEN)
        print_colored(f"{'='*60}\n", Colors.HEADER)

        # Parse SSE events
        client = SSEClient(response)
        event_count = 0
        start_time = time.time()

        for event in client.events():
            event_count += 1
            elapsed = time.time() - start_time

            # Print event header
            print_colored(f"\n[Event #{event_count}] {event.event}", Colors.HEADER + Colors.BOLD)
            print_colored(f"Elapsed: {elapsed:.1f}s", Colors.BLUE)

            # Parse JSON data
            try:
                data = json.loads(event.data)

                # Pretty print based on event type
                if event.event == 'connected':
                    print_colored(f"  Message: {data.get('message')}", Colors.GREEN)
                    print_colored(f"  BOM ID: {data.get('bom_id')}", Colors.BLUE)

                elif event.event == 'enrichment.started':
                    state = data.get('state', {})
                    print_colored(f"  Total Items: {state.get('total_items')}", Colors.BLUE)
                    print_colored(f"  Started At: {state.get('started_at')}", Colors.BLUE)
                    print_colored(f"  Workflow ID: {data.get('workflow_id')}", Colors.BLUE)

                    payload = data.get('payload', {})
                    config = payload.get('config', {})
                    if config:
                        print_colored(f"  Batch Size: {config.get('batch_size')}", Colors.BLUE)
                        print_colored(f"  Suppliers: {', '.join(config.get('suppliers', []))}", Colors.BLUE)

                elif event.event in ['progress', 'enrichment.progress']:
                    state = data.get('state', {})
                    total = state.get('total_items', 0)
                    enriched = state.get('enriched_items', 0)
                    failed = state.get('failed_items', 0)
                    pending = state.get('pending_items', 0)
                    percent = state.get('percent_complete', 0)

                    # Progress bar
                    bar_width = 40
                    filled = int(bar_width * percent / 100)
                    bar = '█' * filled + '░' * (bar_width - filled)

                    print_colored(f"  [{bar}] {percent:.1f}%", Colors.GREEN)
                    print_colored(f"  Enriched: {enriched}/{total}", Colors.GREEN)
                    if failed > 0:
                        print_colored(f"  Failed: {failed}", Colors.YELLOW)
                    print_colored(f"  Pending: {pending}", Colors.BLUE)

                    # Batch info
                    if 'current_batch' in state:
                        print_colored(
                            f"  Batch: {state.get('current_batch')}/{state.get('total_batches')}",
                            Colors.BLUE
                        )

                elif event.event == 'enrichment.completed':
                    state = data.get('state', {})
                    print_colored(f"  Status: {state.get('status')}", Colors.GREEN + Colors.BOLD)
                    print_colored(f"  Total Items: {state.get('total_items')}", Colors.GREEN)
                    print_colored(f"  Enriched: {state.get('enriched_items')}", Colors.GREEN)
                    if state.get('failed_items', 0) > 0:
                        print_colored(f"  Failed: {state.get('failed_items')}", Colors.YELLOW)
                    print_colored(f"  Completed At: {state.get('completed_at')}", Colors.GREEN)
                    print_colored("\nEnrichment completed successfully!", Colors.GREEN + Colors.BOLD)

                elif event.event == 'enrichment.failed':
                    print_colored(f"  Error: {data.get('error')}", Colors.RED + Colors.BOLD)
                    print_colored(f"  Message: {data.get('message')}", Colors.RED)
                    print_colored("\nEnrichment failed!", Colors.RED + Colors.BOLD)

                elif event.event == 'stream_end':
                    reason = data.get('reason', 'unknown')
                    print_colored(f"  Reason: {reason}", Colors.YELLOW)
                    print_colored("\nStream ended by server", Colors.YELLOW)
                    break

                elif event.event == 'error':
                    print_colored(f"  Error: {data.get('message')}", Colors.RED)
                    print_colored("\nServer error received", Colors.RED)

                else:
                    # Unknown event type - print full data
                    print_colored(f"  Data: {json.dumps(data, indent=2)}", Colors.BLUE)

            except json.JSONDecodeError as e:
                # Not JSON data (e.g., keepalive comment)
                if event.data.strip():
                    print_colored(f"  Raw: {event.data}", Colors.BLUE)

            # Check for terminal events
            if event.event in ['enrichment.completed', 'enrichment.failed', 'stream_end']:
                print_colored(f"\nStream completed after {elapsed:.1f}s", Colors.GREEN)
                return True

        print_colored(f"\nStream ended after {event_count} events ({elapsed:.1f}s)", Colors.YELLOW)
        return True

    except requests.exceptions.Timeout:
        print_colored(f"\nERROR: Connection timeout after {timeout}s", Colors.RED)
        return False
    except requests.exceptions.ConnectionError as e:
        print_colored(f"\nERROR: Connection failed: {e}", Colors.RED)
        return False
    except KeyboardInterrupt:
        print_colored("\n\nStream interrupted by user", Colors.YELLOW)
        return True
    except Exception as e:
        print_colored(f"\nERROR: Unexpected error: {e}", Colors.RED)
        import traceback
        traceback.print_exc()
        return False


def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(
        description="Test CNS Service SSE enrichment stream endpoint",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Test with specific BOM ID (will fail without auth)
  python test-sse-enrichment.py abc123

  # Test with admin token
  python test-sse-enrichment.py abc123 --token "your-admin-token"

  # Test with JWT token
  python test-sse-enrichment.py abc123 --token "eyJhbGciOiJSUzI1NiIs..."

  # Test with custom API URL
  python test-sse-enrichment.py abc123 --api-url http://localhost:8000

  # Test with longer timeout
  python test-sse-enrichment.py abc123 --timeout 600
        """
    )

    parser.add_argument(
        "bom_id",
        help="BOM ID to stream enrichment events for"
    )
    parser.add_argument(
        "--token",
        help="Authentication token (JWT or admin token)",
        default=None
    )
    parser.add_argument(
        "--api-url",
        help="CNS API base URL (default: http://localhost:27200)",
        default="http://localhost:27200"
    )
    parser.add_argument(
        "--timeout",
        help="Connection timeout in seconds (default: 300)",
        type=int,
        default=300
    )

    args = parser.parse_args()

    # Run test
    success = test_sse_stream(
        bom_id=args.bom_id,
        token=args.token,
        api_url=args.api_url,
        timeout=args.timeout
    )

    # Exit with appropriate code
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
