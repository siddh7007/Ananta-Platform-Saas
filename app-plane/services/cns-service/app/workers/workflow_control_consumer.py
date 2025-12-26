"""
Workflow Control Event Consumer

Listens for workflow control events from RabbitMQ and sends signals
to Temporal workflows:
- admin.workflow.paused → Send pause signal
- admin.workflow.resumed → Send resume signal
- admin.workflow.cancelled → Send cancel signal

Usage:
    python -m app.workers.workflow_control_consumer
"""

import asyncio
import logging
from typing import Dict, Any, Tuple
from app.workers.base_consumer import BaseRStreamConsumer

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class WorkflowControlConsumer(BaseRStreamConsumer):
    """
    RabbitMQ Streams consumer for workflow control events.
    Sends Temporal signals to pause/resume/cancel workflows.
    """

    def __init__(self):
        super().__init__(
            stream='stream.platform.admin',
            consumer_name='workflow-control-consumer',
            routing_keys=[
                'admin.workflow.paused',
                'admin.workflow.resumed',
                'admin.workflow.cancelled',
            ]
        )

    async def handle_message(
        self,
        event_data: Dict[str, Any],
        routing_key: str,
        priority: int
    ) -> Tuple[bool, str]:
        """
        Handle workflow control events by sending signals to Temporal.

        Args:
            event_data: Event payload containing workflow_id
            routing_key: Event type (paused/resumed/cancelled)
            priority: Message priority

        Returns:
            Tuple of (success: bool, error_type: str)
        """
        try:
            workflow_id = event_data.get('workflow_id')
            admin_id = event_data.get('admin_id')
            bom_id = event_data.get('bom_id')

            if not workflow_id:
                logger.error("Missing workflow_id in event data")
                return (False, 'permanent')

            # Determine action from routing key
            action = routing_key.split('.')[-1]  # paused, resumed, cancelled

            logger.info(
                f"[WorkflowControl] Received {action} event: workflow_id={workflow_id}, "
                f"admin_id={admin_id}"
            )

            # Get workflow handle
            handle = self.temporal_client.get_workflow_handle(workflow_id)

            # Send appropriate signal
            if action == 'paused':
                await handle.signal("pause")
                logger.info(f"[WorkflowControl] Sent pause signal to {workflow_id}")

            elif action == 'resumed':
                await handle.signal("resume")
                logger.info(f"[WorkflowControl] Sent resume signal to {workflow_id}")

            elif action == 'cancelled':
                await handle.signal("cancel")
                logger.info(f"[WorkflowControl] Sent cancel signal to {workflow_id}")

            else:
                logger.warning(f"[WorkflowControl] Unknown action: {action}")
                return (False, 'permanent')

            # Log audit event
            await self._log_workflow_control_action(
                workflow_id=workflow_id,
                bom_id=bom_id,
                action=action,
                admin_id=admin_id
            )

            return (True, '')

        except Exception as e:
            logger.error(
                f"[WorkflowControl] Error handling event: {e}",
                exc_info=True
            )
            return (False, 'transient')

    async def _log_workflow_control_action(
        self,
        workflow_id: str,
        bom_id: str,
        action: str,
        admin_id: str
    ):
        """Log workflow control action to audit log"""
        try:
            from sqlalchemy import text

            with self.get_database_session("supabase") as db:
                query = text("""
                    INSERT INTO audit_logs (
                        action,
                        entity_type,
                        entity_id,
                        user_id,
                        metadata,
                        created_at
                    ) VALUES (
                        :action,
                        'bom_processing',
                        :bom_id,
                        :user_id,
                        :metadata::jsonb,
                        NOW()
                    )
                """)

                import json
                db.execute(query, {
                    'action': f'workflow_{action}',
                    'bom_id': bom_id,
                    'user_id': admin_id,
                    'metadata': json.dumps({
                        'workflow_id': workflow_id,
                        'action': action
                    })
                })
                db.commit()

        except Exception as e:
            logger.warning(f"[WorkflowControl] Failed to log audit: {e}")


async def main():
    """Main entry point"""
    consumer = WorkflowControlConsumer()
    await consumer.start()


if __name__ == '__main__':
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("\nWorkflow Control Consumer stopped")
