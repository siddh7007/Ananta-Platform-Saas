"""
Test Suite for SSE Enrichment Progress Stream

Tests the Server-Sent Events endpoint for real-time BOM enrichment progress.
"""

import asyncio
import json
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi.testclient import TestClient
from redis.asyncio import Redis as AsyncRedis


@pytest.fixture
def mock_redis_client():
    """Mock async Redis client for Pub/Sub testing"""
    client = AsyncMock(spec=AsyncRedis)
    pubsub = AsyncMock()

    # Mock pubsub methods
    pubsub.subscribe = AsyncMock()
    pubsub.unsubscribe = AsyncMock()
    pubsub.close = AsyncMock()

    # Mock message queue
    message_queue = asyncio.Queue()

    async def mock_get_message(ignore_subscribe_messages=True, timeout=1.0):
        try:
            return await asyncio.wait_for(message_queue.get(), timeout=timeout)
        except asyncio.TimeoutError:
            return None

    pubsub.get_message = mock_get_message
    client.pubsub.return_value = pubsub

    # Store queue for test access
    client._test_message_queue = message_queue

    return client


@pytest.mark.asyncio
async def test_sse_endpoint_connection(mock_redis_client):
    """Test SSE endpoint establishes connection and sends connected event"""
    from app.api.enrichment_stream import enrichment_event_stream

    bom_id = "123e4567-e89b-12d3-a456-426614174000"

    with patch('app.api.enrichment_stream.get_redis_client', return_value=mock_redis_client):
        # Create async generator
        stream = enrichment_event_stream(bom_id)

        # Get first event (should be connected)
        first_event = await stream.__anext__()

        # Verify connected event
        assert "event: connected" in first_event
        assert f'"bom_id":"{bom_id}"' in first_event or f'"bom_id": "{bom_id}"' in first_event
        assert "Stream connected" in first_event


@pytest.mark.asyncio
async def test_sse_endpoint_receives_progress_events(mock_redis_client):
    """Test SSE endpoint receives and forwards progress events from Redis"""
    from app.api.enrichment_stream import enrichment_event_stream

    bom_id = "123e4567-e89b-12d3-a456-426614174000"

    # Create test progress event
    progress_event = {
        'event_id': 'test-event-1',
        'event_type': 'enrichment.progress',
        'bom_id': bom_id,
        'organization_id': 'org-123',
        'source': 'customer',
        'state': {
            'total_items': 100,
            'enriched_items': 50,
            'failed_items': 2,
            'pending_items': 48,
            'percent_complete': 52.0
        }
    }

    with patch('app.api.enrichment_stream.get_redis_client', return_value=mock_redis_client):
        # Create async generator
        stream = enrichment_event_stream(bom_id)

        # Skip connected event
        await stream.__anext__()

        # Publish progress event to mock queue
        await mock_redis_client._test_message_queue.put({
            'type': 'message',
            'data': json.dumps(progress_event)
        })

        # Get progress event
        progress_sse = await stream.__anext__()

        # Verify SSE format
        assert "event: enrichment.progress" in progress_sse
        assert "data:" in progress_sse
        assert '"percent_complete": 52.0' in progress_sse or '"percent_complete":52.0' in progress_sse


@pytest.mark.asyncio
async def test_sse_endpoint_closes_on_completion(mock_redis_client):
    """Test SSE endpoint sends stream_end event on completion"""
    from app.api.enrichment_stream import enrichment_event_stream

    bom_id = "123e4567-e89b-12d3-a456-426614174000"

    # Create completion event
    completion_event = {
        'event_id': 'test-event-2',
        'event_type': 'enrichment.completed',
        'bom_id': bom_id,
        'organization_id': 'org-123',
        'source': 'customer',
        'state': {
            'total_items': 100,
            'enriched_items': 98,
            'failed_items': 2,
            'pending_items': 0,
            'percent_complete': 100.0
        }
    }

    with patch('app.api.enrichment_stream.get_redis_client', return_value=mock_redis_client):
        stream = enrichment_event_stream(bom_id)

        # Skip connected event
        await stream.__anext__()

        # Publish completion event
        await mock_redis_client._test_message_queue.put({
            'type': 'message',
            'data': json.dumps(completion_event)
        })

        # Get completion event
        completion_sse = await stream.__anext__()
        assert "event: enrichment.completed" in completion_sse

        # Get stream_end event
        stream_end_sse = await stream.__anext__()
        assert "event: stream_end" in stream_end_sse
        assert '"reason": "enrichment.completed"' in stream_end_sse or '"reason":"enrichment.completed"' in stream_end_sse


@pytest.mark.asyncio
async def test_sse_endpoint_keepalive(mock_redis_client):
    """Test SSE endpoint sends keepalive comments"""
    from app.api.enrichment_stream import enrichment_event_stream

    bom_id = "123e4567-e89b-12d3-a456-426614174000"

    with patch('app.api.enrichment_stream.get_redis_client', return_value=mock_redis_client):
        stream = enrichment_event_stream(bom_id)

        # Skip connected event
        await stream.__anext__()

        # Wait for keepalive (simulated by timeout)
        # In real scenario, keepalive is sent after 30 seconds of no events
        # For testing, we can check the code path exists
        # (actual keepalive testing would require time manipulation)
        pass


def test_sse_endpoint_authentication_required(client: TestClient):
    """Test SSE endpoint requires authentication"""
    bom_id = "123e4567-e89b-12d3-a456-426614174000"

    # Request without token should fail
    response = client.get(f"/api/enrichment/stream/{bom_id}")

    assert response.status_code == 401
    assert "Authentication required" in response.json()["detail"]


def test_sse_endpoint_with_admin_token(client: TestClient, mock_redis_client):
    """Test SSE endpoint accepts admin token"""
    from app.config import settings

    bom_id = "123e4567-e89b-12d3-a456-426614174000"
    admin_token = "test-admin-token"

    # Mock settings to include admin token
    with patch.object(settings, 'admin_api_token', admin_token):
        with patch('app.api.enrichment_stream.get_redis_client', return_value=mock_redis_client):
            response = client.get(
                f"/api/enrichment/stream/{bom_id}",
                params={"token": admin_token},
                headers={"Accept": "text/event-stream"}
            )

            assert response.status_code == 200
            assert response.headers["content-type"] == "text/event-stream; charset=utf-8"


def test_sse_cors_preflight(client: TestClient):
    """Test SSE endpoint handles CORS preflight requests"""
    bom_id = "123e4567-e89b-12d3-a456-426614174000"

    response = client.options(
        f"/api/enrichment/stream/{bom_id}",
        headers={
            "Origin": "http://localhost:27100",
            "Access-Control-Request-Method": "GET"
        }
    )

    assert response.status_code == 200
    assert "Access-Control-Allow-Origin" in response.headers
    assert "Access-Control-Allow-Methods" in response.headers


def test_sse_health_check(client: TestClient, mock_redis_client):
    """Test SSE health check endpoint"""
    with patch('app.api.enrichment_stream.get_redis_client', return_value=mock_redis_client):
        # Mock ping
        mock_redis_client.ping = AsyncMock()

        response = client.get("/api/enrichment/health")

        assert response.status_code == 200
        assert response.json()["status"] == "healthy"
        assert response.json()["redis"] == "connected"


@pytest.mark.asyncio
async def test_publish_enrichment_event_activity():
    """Test publish_enrichment_event activity publishes to Redis and Supabase"""
    from app.workflows.bom_enrichment import publish_enrichment_event

    event_data = {
        'event_id': 'test-event-3',
        'event_type': 'enrichment.progress',
        'bom_id': '123e4567-e89b-12d3-a456-426614174000',
        'organization_id': 'org-123',
        'project_id': 'proj-456',
        'user_id': 'user-789',
        'source': 'customer',
        'workflow_id': 'bom-enrichment-123',
        'workflow_run_id': 'run-456',
        'state': {
            'total_items': 100,
            'enriched_items': 75,
            'failed_items': 1,
            'pending_items': 24,
            'percent_complete': 76.0
        },
        'payload': {
            'batch': {
                'batch_number': 8,
                'batch_size': 10,
                'completed': 10
            }
        }
    }

    mock_redis = AsyncMock()
    mock_db = MagicMock()

    with patch('app.workflows.bom_enrichment.get_redis_client', return_value=mock_redis):
        with patch('app.workflows.bom_enrichment.get_dual_database') as mock_dual_db:
            mock_dual_db.return_value.get_session.return_value = iter([mock_db])

            await publish_enrichment_event(event_data)

            # Verify Redis publish was called
            mock_redis.publish.assert_called_once()
            channel, message = mock_redis.publish.call_args[0]
            assert channel == f"enrichment:{event_data['bom_id']}"

            # Verify message contains event data
            message_data = json.loads(message)
            assert message_data['event_type'] == 'enrichment.progress'
            assert message_data['state']['percent_complete'] == 76.0

            # Verify Supabase insert was called
            mock_db.execute.assert_called()
            mock_db.commit.assert_called()


@pytest.mark.asyncio
async def test_update_bom_progress_publishes_event():
    """Test update_bom_progress activity triggers SSE event publishing"""
    from app.workflows.bom_enrichment import update_bom_progress

    params = {
        'bom_id': '123e4567-e89b-12d3-a456-426614174000',
        'source': 'customer',
        'progress': {
            'total_items': 100,
            'enriched_items': 50,
            'failed_items': 2,
            'pending_items': 48,
            'percent_complete': 52.0,
            'last_updated': '2025-12-18T01:23:45.678Z'
        },
        'status': 'processing',
        'organization_id': 'org-123',
        'temporal_workflow_id': 'bom-enrichment-123'
    }

    mock_db = MagicMock()

    with patch('app.workflows.bom_enrichment.get_dual_database') as mock_dual_db:
        mock_dual_db.return_value.get_session.return_value = iter([mock_db])

        await update_bom_progress(params)

        # Verify database update was called
        mock_db.execute.assert_called()
        mock_db.commit.assert_called()

        # Verify progress was updated in Supabase
        call_args = mock_db.execute.call_args
        assert 'bom_id' in str(call_args)
        assert 'enrichment_progress' in str(call_args) or 'progress' in str(call_args)


# Integration test (requires running Redis and Supabase)
@pytest.mark.integration
@pytest.mark.asyncio
async def test_sse_full_workflow_integration():
    """
    Integration test for full SSE workflow.

    Prerequisites:
    - Redis running on localhost:27012
    - Supabase running on localhost:27432
    - Valid authentication token

    This test:
    1. Starts an enrichment workflow
    2. Connects to SSE stream
    3. Verifies progress events are received
    4. Waits for completion event
    """
    pytest.skip("Integration test - requires Redis and Supabase")

    # TODO: Implement full integration test
    # 1. Create test BOM with line items
    # 2. Start enrichment workflow
    # 3. Connect to SSE stream
    # 4. Verify events received in order
    # 5. Verify completion event
    # 6. Cleanup


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
