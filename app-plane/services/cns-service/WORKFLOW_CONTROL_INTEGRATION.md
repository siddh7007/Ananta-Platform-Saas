# Workflow Control Consumer Integration

## Overview

The WorkflowControlConsumer has been successfully integrated into the CNS service to listen for workflow control events from RabbitMQ and forward them to Temporal workflows.

## Architecture

```
RabbitMQ Stream (stream.platform.admin)
    │
    ├─ admin.workflow.paused    ──┐
    ├─ admin.workflow.resumed   ──┤──> WorkflowControlConsumer
    └─ admin.workflow.cancelled ──┘         │
                                            ▼
                                  Temporal Client
                                            │
                                            ├─ signal("pause")
                                            ├─ signal("resume")
                                            └─ signal("cancel")
                                            │
                                            ▼
                                  Running Workflows
                                            │
                                            ▼
                                  Audit Logs (Supabase)
```

## Components

### 1. WorkflowControlConsumer
**File**: `app/workers/workflow_control_consumer.py`

- **Extends**: `BaseRStreamConsumer`
- **Stream**: `stream.platform.admin`
- **Consumer Group**: `workflow-control-consumer`
- **Routing Keys**:
  - `admin.workflow.paused` → sends `pause` signal
  - `admin.workflow.resumed` → sends `resume` signal
  - `admin.workflow.cancelled` → sends `cancel` signal

**Key Features**:
- Connects to RabbitMQ Streams via rstream library
- Maintains Temporal client connection with retry logic
- Handles workflow control signals
- Logs audit events to `audit_logs` table in Supabase
- Automatic message deduplication
- Health tracking and metrics

### 2. Workflow Control Runner
**File**: `app/workers/workflow_control_runner.py`

Provides lifecycle management for the consumer:

```python
from app.workers.workflow_control_runner import (
    start_workflow_control_consumer,
    stop_workflow_control_consumer,
    is_consumer_running,
    get_consumer_stats,
)
```

**Functions**:
- `start_workflow_control_consumer()` - Starts consumer as asyncio background task
- `stop_workflow_control_consumer()` - Gracefully stops consumer
- `is_consumer_running()` - Check if consumer is active
- `get_consumer_stats()` - Get consumer metrics

### 3. Main Application Integration
**File**: `app/main.py`

The consumer is registered in the FastAPI lifespan context:

**Startup** (lines 237-252):
```python
# Start workflow control consumer (listens for pause/resume/cancel events)
from app.workers.workflow_control_runner import (
    start_workflow_control_consumer,
    stop_workflow_control_consumer,
)
workflow_control_task = None
try:
    workflow_control_task = start_workflow_control_consumer()
    if workflow_control_task:
        logger.info("✅ Workflow control consumer started successfully")
    else:
        logger.warning("⚠️  Workflow control consumer not started")
except Exception as e:
    logger.error(f"❌ Failed to start workflow control consumer: {e}")
    workflow_control_task = None
```

**Shutdown** (lines 262-267):
```python
# Shutdown background tasks
if monitor_task:
    await stop_supplier_health_monitor()

if workflow_control_task:
    await stop_workflow_control_consumer()
```

## Event Flow

### Example: Pause Workflow

1. **Admin triggers pause** via Admin Dashboard UI
2. **Event published** to RabbitMQ:
   ```json
   {
     "event_type": "admin.workflow.paused",
     "workflow_id": "bom-enrichment-uuid-12345",
     "bom_id": "bom-uuid-67890",
     "admin_id": "user-uuid-54321",
     "timestamp": "2025-12-16T19:45:00Z"
   }
   ```
3. **WorkflowControlConsumer receives** event from stream
4. **Temporal signal sent**:
   ```python
   handle = temporal_client.get_workflow_handle(workflow_id)
   await handle.signal("pause")
   ```
5. **Audit log written** to `audit_logs` table:
   ```sql
   INSERT INTO audit_logs (
     action, entity_type, entity_id, user_id, metadata
   ) VALUES (
     'workflow_paused', 'bom_processing', 'bom-uuid-67890',
     'user-uuid-54321', '{"workflow_id": "bom-enrichment-uuid-12345"}'
   )
   ```

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `RABBITMQ_HOST` | `localhost` | RabbitMQ server host |
| `RABBITMQ_STREAM_PORT` | `27251` | RabbitMQ stream port |
| `RABBITMQ_USER` | `admin` | RabbitMQ username |
| `RABBITMQ_PASS` | `admin123_...` | RabbitMQ password |
| `RABBITMQ_VHOST` | `/` | RabbitMQ virtual host |
| `TEMPORAL_HOST` | `localhost:7233` | Temporal server address |

### Docker Compose

The consumer connects to services defined in `app-plane/docker-compose.yml`:

- **RabbitMQ**: `app-plane-rabbitmq` (port 27251 for streams)
- **Temporal**: `shared-temporal` (port 27020)
- **Supabase DB**: `app-plane-supabase-db` (port 27432)

## Monitoring

### Health Check

Consumer health is included in the application startup logs:

```
✅ Workflow control consumer started successfully
```

### Consumer Stats

Get real-time stats programmatically:

```python
from app.workers.workflow_control_runner import get_consumer_stats

stats = get_consumer_stats()
# {
#   "running": true,
#   "messages_processed": 42,
#   "messages_succeeded": 40,
#   "messages_failed": 2,
#   "is_healthy": true,
#   "last_message_time": "2025-12-16T19:45:30",
#   "last_error": null
# }
```

### Logs

Consumer logs include:

- `📨 Processing: admin.workflow.paused` - Message received
- `[WorkflowControl] Sent pause signal to {workflow_id}` - Signal sent
- `✅ Message #42 processed successfully` - Success
- `❌ Error processing message` - Failure with traceback

## Error Handling

The consumer distinguishes between error types:

### Transient Errors
Temporary issues that should be retried:
- Temporal connection failure
- Database connection timeout
- Network issues

**Behavior**: Message is NOT acknowledged, will be redelivered

### Permanent Errors
Unrecoverable issues that should not be retried:
- Missing `workflow_id` in event
- Unknown action type
- Invalid event format

**Behavior**: Message is acknowledged (dropped)

## Testing

### Static Verification

Run the static verification script to check integration:

```bash
cd app-plane/services/cns-service
python verify_integration_static.py
```

This checks:
- ✅ Consumer class structure
- ✅ Runner module functions
- ✅ Main.py integration
- ✅ Startup/shutdown hooks

### Runtime Testing

1. **Start CNS service**:
   ```bash
   python -m app.main
   ```

2. **Check logs** for startup message:
   ```
   ✅ Workflow control consumer started successfully
   ```

3. **Send test event** via RabbitMQ:
   ```python
   # Publish to stream.platform.admin
   event = {
       "event_type": "admin.workflow.paused",
       "workflow_id": "test-workflow-123",
       "bom_id": "test-bom-456",
       "admin_id": "test-admin-789"
   }
   # Routing key: admin.workflow.paused
   ```

4. **Verify in logs**:
   ```
   📨 Processing: admin.workflow.paused
   [WorkflowControl] Sent pause signal to test-workflow-123
   ✅ Message #1 processed successfully
   ```

## Troubleshooting

### Consumer doesn't start

**Check**: RabbitMQ connection
```bash
docker logs app-plane-rabbitmq
```

**Check**: Stream exists
```bash
docker exec app-plane-rabbitmq rabbitmq-streams list
```

### Temporal signals not working

**Check**: Temporal connection
```bash
docker logs shared-temporal
```

**Check**: Workflow exists
```bash
docker exec shared-temporal temporal workflow show \
  --workflow-id "bom-enrichment-uuid-12345" \
  --namespace default
```

### Messages not processed

**Check**: Consumer logs
```bash
docker logs app-plane-cns-service | grep WorkflowControl
```

**Check**: Routing key matches
- Event routing key must be exactly `admin.workflow.paused`, `admin.workflow.resumed`, or `admin.workflow.cancelled`

## Next Steps

1. **Add health endpoint** to expose consumer stats via REST API
2. **Prometheus metrics** for monitoring consumer performance
3. **Dead letter queue** for failed messages
4. **Rate limiting** to prevent signal flooding
5. **Batch signal processing** for efficiency
6. **Circuit breaker** pattern for Temporal connection
7. **Alert on consumer failure** via monitoring stack

## Files Modified

| File | Lines | Description |
|------|-------|-------------|
| `app/main.py` | 94-111, 237-267 | Added consumer startup/shutdown |
| `app/workers/workflow_control_consumer.py` | NEW | Consumer implementation |
| `app/workers/workflow_control_runner.py` | NEW | Lifecycle management |
| `verify_integration_static.py` | NEW | Static verification script |

## Dependencies

- `rstream` - RabbitMQ Streams Python client
- `temporalio` - Temporal Python SDK
- `sqlalchemy` - Database access for audit logs
- `asyncio` - Async task management

All dependencies are already in the CNS service requirements.
