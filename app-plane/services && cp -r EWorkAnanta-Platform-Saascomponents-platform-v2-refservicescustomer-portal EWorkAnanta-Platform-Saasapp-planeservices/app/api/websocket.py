"""
WebSocket API for real-time BOM job progress tracking.

Provides WebSocket endpoint for customers to receive real-time progress updates
for their BOM enrichment jobs without polling.
"""

import logging
import asyncio
import json
from typing import Dict, Set
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from datetime import datetime

logger = logging.getLogger(__name__)

router = APIRouter()

# Global connection manager
class ConnectionManager:
    """
    Manages WebSocket connections for BOM job progress tracking.

    Supports multiple clients per job_id and broadcasting updates to all
    connected clients for a specific job.
    """

    def __init__(self):
        # job_id -> Set[WebSocket]
        self.active_connections: Dict[str, Set[WebSocket]] = {}
        self._lock = asyncio.Lock()

    async def connect(self, websocket: WebSocket, job_id: str):
        """Accept and register a new WebSocket connection"""
        await websocket.accept()
        async with self._lock:
            if job_id not in self.active_connections:
                self.active_connections[job_id] = set()
            self.active_connections[job_id].add(websocket)
        logger.info(f"✅ WebSocket connected for job {job_id} (total: {len(self.active_connections[job_id])} clients)")

    async def disconnect(self, websocket: WebSocket, job_id: str):
        """Remove a WebSocket connection"""
        async with self._lock:
            if job_id in self.active_connections:
                self.active_connections[job_id].discard(websocket)
                if not self.active_connections[job_id]:
                    # Remove empty job_id entry
                    del self.active_connections[job_id]
        logger.info(f"❌ WebSocket disconnected for job {job_id}")

    async def broadcast_to_job(self, job_id: str, message: dict):
        """
        Broadcast a message to all clients watching a specific job.

        Args:
            job_id: The job ID to broadcast to
            message: Dictionary to send as JSON
        """
        async with self._lock:
            if job_id not in self.active_connections:
                return

            # Create list of connections to avoid modification during iteration
            connections = list(self.active_connections[job_id])

        # Broadcast outside the lock to avoid blocking
        disconnected = []
        for websocket in connections:
            try:
                await websocket.send_json(message)
            except Exception as e:
                logger.warning(f"Failed to send to WebSocket for job {job_id}: {e}")
                disconnected.append(websocket)

        # Clean up disconnected clients
        if disconnected:
            async with self._lock:
                if job_id in self.active_connections:
                    for ws in disconnected:
                        self.active_connections[job_id].discard(ws)
                    if not self.active_connections[job_id]:
                        del self.active_connections[job_id]

    def get_connection_count(self, job_id: str) -> int:
        """Get number of active connections for a job"""
        return len(self.active_connections.get(job_id, set()))


# Global singleton manager
manager = ConnectionManager()


@router.websocket("/ws/jobs/{job_id}/progress")
async def websocket_job_progress(
    websocket: WebSocket,
    job_id: str
):
    """
    WebSocket endpoint for real-time job progress updates.

    Connect to this endpoint to receive real-time updates for a specific BOM job.

    **URL**: `ws://localhost:27800/api/ws/jobs/{job_id}/progress`

    **Message Format**:
    ```json
    {
        "event": "progress" | "status_change" | "item_completed" | "item_failed" | "completed" | "error",
        "job_id": "uuid-here",
        "data": {
            "progress": 45,
            "status": "processing",
            "total_items": 100,
            "enriched_count": 40,
            "failed_count": 5,
            "current_item": {
                "mpn": "STM32F407VGT6",
                "manufacturer": "STMicroelectronics"
            },
            "message": "Processing item 45/100"
        },
        "timestamp": "2025-11-08T05:30:00Z"
    }
    ```

    **Events**:
    - `connected`: Initial connection confirmation
    - `progress`: Progress percentage update (sent every item)
    - `status_change`: Job status changed (pending -> processing -> completed)
    - `item_completed`: Individual item enriched successfully
    - `item_failed`: Individual item enrichment failed
    - `completed`: Job finished (all items processed)
    - `error`: Error occurred during processing
    - `ping`: Keep-alive ping (sent every 30 seconds)

    **Example Client Code (JavaScript)**:
    ```javascript
    const ws = new WebSocket('ws://localhost:27800/api/ws/jobs/abc-123/progress');

    ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        console.log('Event:', msg.event, 'Progress:', msg.data.progress);

        if (msg.event === 'progress') {
            updateProgressBar(msg.data.progress);
        } else if (msg.event === 'completed') {
            showCompletionMessage(msg.data);
        }
    };

    ws.onerror = (error) => console.error('WebSocket error:', error);
    ws.onclose = () => console.log('Connection closed');
    ```
    """
    await manager.connect(websocket, job_id)

    # Send initial connection confirmation
    await websocket.send_json({
        "event": "connected",
        "job_id": job_id,
        "message": f"Connected to job {job_id} progress stream",
        "timestamp": datetime.utcnow().isoformat() + "Z"
    })

    try:
        # Keep connection alive with periodic pings
        while True:
            try:
                # Wait for messages from client (or timeout for ping)
                # Client can send {"type": "ping"} to keep connection alive
                data = await asyncio.wait_for(websocket.receive_text(), timeout=30.0)

                # Echo back pings
                try:
                    msg = json.loads(data)
                    if msg.get("type") == "ping":
                        await websocket.send_json({
                            "event": "pong",
                            "timestamp": datetime.utcnow().isoformat() + "Z"
                        })
                except json.JSONDecodeError:
                    pass

            except asyncio.TimeoutError:
                # Send keep-alive ping
                await websocket.send_json({
                    "event": "ping",
                    "timestamp": datetime.utcnow().isoformat() + "Z"
                })

    except WebSocketDisconnect:
        logger.info(f"Client disconnected from job {job_id}")
    except Exception as e:
        logger.error(f"WebSocket error for job {job_id}: {e}", exc_info=True)
    finally:
        await manager.disconnect(websocket, job_id)


def get_connection_manager() -> ConnectionManager:
    """
    Get the global WebSocket connection manager.

    Use this in background processing to send progress updates:

    ```python
    from app.api.websocket import get_connection_manager

    manager = get_connection_manager()
    await manager.broadcast_to_job(job_id, {
        "event": "progress",
        "job_id": job_id,
        "data": {"progress": 50},
        "timestamp": datetime.utcnow().isoformat() + "Z"
    })
    ```
    """
    return manager
