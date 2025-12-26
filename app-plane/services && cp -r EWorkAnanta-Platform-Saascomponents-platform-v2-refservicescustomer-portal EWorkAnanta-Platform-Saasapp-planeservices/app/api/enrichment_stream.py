"""
Real-time Enrichment Progress Stream API

Server-Sent Events (SSE) endpoint for streaming enrichment progress updates.
Uses Redis Pub/Sub for event distribution with automatic reconnection.

Features:
- Real-time progress updates via SSE
- Automatic reconnection (browser native)
- Redis Pub/Sub backend for scalability
- Per-BOM event channels
- Graceful error handling
"""

import asyncio
import json
import logging
from typing import AsyncGenerator

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse
from redis.asyncio import Redis
from redis.exceptions import RedisError

from app.cache.redis_cache import get_redis_client

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/enrichment", tags=["enrichment-stream"])


class SSEMessage:
    """Server-Sent Event message formatter"""

    @staticmethod
    def format(data: dict, event: str = None, id: str = None, retry: int = None) -> str:
        """Format data as SSE message"""
        message = ""

        if event:
            message += f"event: {event}\n"
        if id:
            message += f"id: {id}\n"
        if retry:
            message += f"retry: {retry}\n"

        # Data must be JSON string
        message += f"data: {json.dumps(data)}\n\n"

        return message


async def enrichment_event_stream(bom_id: str) -> AsyncGenerator[str, None]:
    """
    Async generator that yields SSE-formatted enrichment events.

    Subscribes to Redis channel `enrichment:{bom_id}` and streams all
    published events to the client with automatic keepalive.

    Args:
        bom_id: BOM identifier to stream events for

    Yields:
        SSE-formatted event strings
    """
    redis_client: Redis = None
    pubsub = None

    try:
        redis_client = await get_redis_client()
        pubsub = redis_client.pubsub()

        # Subscribe to BOM-specific channel
        channel = f"enrichment:{bom_id}"
        await pubsub.subscribe(channel)

        logger.info(f"[SSE] Client connected to stream for BOM: {bom_id}")

        # Send initial connection confirmation
        yield SSEMessage.format(
            {"type": "connected", "bom_id": bom_id, "message": "Stream connected"},
            event="connected"
        )

        # Set keepalive interval (30 seconds)
        keepalive_interval = 30
        last_keepalive = asyncio.get_event_loop().time()

        # Listen for messages
        while True:
            try:
                # Non-blocking get with timeout for keepalive
                message = await asyncio.wait_for(
                    pubsub.get_message(ignore_subscribe_messages=True, timeout=1.0),
                    timeout=1.0
                )

                if message and message['type'] == 'message':
                    # Parse and forward the event
                    try:
                        event_data = json.loads(message['data'])
                        event_type = event_data.get('event_type', 'progress')

                        yield SSEMessage.format(
                            event_data,
                            event=event_type,
                            id=event_data.get('event_id')
                        )

                        logger.debug(f"[SSE] Sent event {event_type} for BOM {bom_id}")

                        # If enrichment completed or failed, send final message and close
                        if event_type in ['enrichment.completed', 'enrichment.failed']:
                            yield SSEMessage.format(
                                {"type": "stream_end", "reason": event_type},
                                event="stream_end"
                            )
                            logger.info(f"[SSE] Stream ended for BOM {bom_id}: {event_type}")
                            break

                    except json.JSONDecodeError as e:
                        logger.error(f"[SSE] Failed to decode event data: {e}")
                        continue

                # Send keepalive comment every 30 seconds
                current_time = asyncio.get_event_loop().time()
                if current_time - last_keepalive > keepalive_interval:
                    yield ": keepalive\n\n"
                    last_keepalive = current_time

            except asyncio.TimeoutError:
                # Timeout is expected for keepalive - continue listening
                continue
            except asyncio.CancelledError:
                # Client disconnected
                logger.info(f"[SSE] Client disconnected from BOM {bom_id}")
                break

    except RedisError as e:
        logger.error(f"[SSE] Redis error for BOM {bom_id}: {e}")
        yield SSEMessage.format(
            {"type": "error", "message": "Redis connection error"},
            event="error"
        )
    except Exception as e:
        logger.error(f"[SSE] Unexpected error for BOM {bom_id}: {e}", exc_info=True)
        yield SSEMessage.format(
            {"type": "error", "message": "Internal server error"},
            event="error"
        )
    finally:
        # Cleanup
        if pubsub:
            try:
                await pubsub.unsubscribe()
                await pubsub.close()
                logger.debug(f"[SSE] Cleaned up pubsub for BOM {bom_id}")
            except Exception as e:
                logger.warning(f"[SSE] Error during pubsub cleanup: {e}")


@router.options("/stream/{bom_id}")
async def stream_enrichment_options(request: Request, bom_id: str):
    """
    CORS preflight handler for SSE endpoints.
    
    Browsers send OPTIONS request before EventSource connections to check
    if CORS is allowed. Must respond with proper CORS headers.
    """
    from fastapi.responses import Response
    from app.config import settings

    origin = request.headers.get("origin") or "*"
    # If credentials are enabled, cannot use wildcard origin
    if settings.cors_allow_credentials and origin:
        allow_origin = origin
    else:
        allow_origin = "*"

    return Response(
        status_code=200,
        headers={
            "Access-Control-Allow-Origin": allow_origin,
            "Access-Control-Allow-Credentials": "true" if settings.cors_allow_credentials else "false",
            "Access-Control-Allow-Methods": "GET, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
            "Access-Control-Max-Age": "3600",
        }
    )


@router.get("/stream/{bom_id}")
async def stream_enrichment_progress(request: Request, bom_id: str, token: str = None):
    """
    SSE endpoint for real-time enrichment progress updates.

    Streams enrichment events for a specific BOM using Server-Sent Events.
    The connection stays open and pushes events as they occur.

    Authentication:
        Since EventSource doesn't support custom headers, authentication is
        done via query parameter: ?token=<admin_token_or_auth0_jwt>

    Args:
        bom_id: BOM identifier to stream events for
        token: Admin API token OR Auth0 JWT for authentication (query parameter)

    Returns:
        StreamingResponse with text/event-stream content type

    Example:
        ```javascript
        const eventSource = new EventSource('/api/enrichment/stream/123?token=xxx');

        eventSource.addEventListener('progress', (e) => {
            const data = JSON.parse(e.data);
            console.log('Progress:', data.state.percent_complete);
        });

        eventSource.addEventListener('enrichment.completed', (e) => {
            console.log('Enrichment completed!');
            eventSource.close();
        });
        ```
    """
    if not bom_id:
        raise HTTPException(status_code=400, detail="BOM ID is required")

    from app.config import settings
    admin_token = getattr(settings, 'admin_api_token', None)

    # Check if auth context is already set by middleware (e.g., from Authorization header)
    auth_context = getattr(request.state, 'auth_context', None)

    if not auth_context:
        # No auth context from middleware, try query param token
        if not token:
            raise HTTPException(status_code=401, detail="Authentication required. Pass token as query parameter.")

        # Check if token looks like a JWT
        if token.startswith('eyJ'):
            from app.middleware.auth_middleware import validate_auth0_token, validate_supabase_token

            logger.info(f"[SSE] Attempting JWT validation for BOM {bom_id}")

            # Try Auth0 JWT first (RS256)
            claims = None
            try:
                claims = await validate_auth0_token(token)
                if claims:
                    logger.info(f"[SSE] Auth0 JWT validated for BOM {bom_id}: sub={claims.get('sub')}")
                else:
                    logger.warning(f"[SSE] Auth0 JWT validation returned None for BOM {bom_id}")
            except Exception as e:
                logger.warning(f"[SSE] Auth0 JWT validation failed for BOM {bom_id}: {type(e).__name__}: {e}")

            # If Auth0 failed, try Supabase JWT (HS256)
            if not claims:
                try:
                    claims = await validate_supabase_token(token)
                    if claims:
                        logger.info(f"[SSE] Supabase JWT validated for BOM {bom_id}: sub={claims.get('sub')}")
                    else:
                        logger.warning(f"[SSE] Supabase JWT validation returned None for BOM {bom_id}")
                except Exception as e:
                    logger.warning(f"[SSE] Supabase JWT validation also failed for BOM {bom_id}: {type(e).__name__}: {e}")

            if not claims:
                raise HTTPException(status_code=401, detail="Invalid JWT token")

            # JWT is valid - allow access
            # TODO: Add BOM ownership verification (check if BOM.organization_id matches user's org)
        else:
            # Not a JWT, try static admin token
            if not admin_token or token != admin_token:
                raise HTTPException(status_code=401, detail="Invalid token")

    from app.config import settings

    origin = request.headers.get("origin") or "*"
    if settings.cors_allow_credentials and origin:
        allow_origin = origin
    else:
        allow_origin = "*"

    return StreamingResponse(
        enrichment_event_stream(bom_id),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # Disable nginx buffering
            "Access-Control-Allow-Origin": allow_origin,  # Echo origin or allow all
            "Access-Control-Allow-Credentials": "true" if settings.cors_allow_credentials else "false",
            "Access-Control-Allow-Methods": "GET, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
            "Access-Control-Expose-Headers": "Content-Type, X-Request-ID",
        }
    )


@router.get("/health")
async def stream_health():
    """Health check endpoint for SSE service"""
    try:
        redis_client = await get_redis_client()
        await redis_client.ping()
        return {"status": "healthy", "redis": "connected"}
    except Exception as e:
        logger.error(f"[SSE] Health check failed: {e}")
        raise HTTPException(status_code=503, detail="Redis unavailable")
