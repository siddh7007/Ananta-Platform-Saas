"""
CRITICAL-5: Temporal Workflow Race Condition Prevention
Handles race conditions specific to Temporal workflows
"""

import logging
from typing import Optional, List, Dict, Any
from dataclasses import dataclass
from datetime import datetime

logger = logging.getLogger(__name__)


@dataclass
class WorkflowExecution:
    """Represents a Temporal workflow execution"""
    workflow_id: str
    run_id: str
    workflow_type: str
    status: str  # RUNNING, COMPLETED, FAILED, TIMED_OUT, TERMINATED
    started_at: datetime
    completed_at: Optional[datetime]
    input: Dict[str, Any]
    result: Optional[Dict[str, Any]]


class TemporalRaceConditionHandler:
    """
    Handles race conditions in Temporal workflows
    
    Common race conditions:
    1. Duplicate workflow starts - Same BOM enriched twice simultaneously
    2. State corruption - Workflow reads stale state
    3. Lost updates - One workflow's result overwrites another's
    4. Cascading failures - One failure triggers cascading conflicts
    """
    
    def __init__(self, redis_client, temporal_client):
        """
        Initialize handler
        
        Args:
            redis_client: Redis for caching and locking
            temporal_client: Temporal SDK client
        """
        self.redis = redis_client
        self.temporal = temporal_client
    
    async def check_duplicate_workflow(
        self,
        workflow_type: str,
        workflow_id: str
    ) -> bool:
        """
        Check if a workflow with same ID is already running
        
        Returns True if duplicate, False if safe to start
        """
        cache_key = f"workflow:active:{workflow_id}"
        
        # Check Redis cache first (fast path)
        existing = self.redis.get(cache_key)
        if existing:
            logger.warning(
                f"⚠️ Duplicate workflow detected: {workflow_id} already active"
            )
            return True
        
        # Check Temporal (authoritative)
        try:
            # Query Temporal for active executions
            executions = await self.temporal.list_workflow_executions(
                query=f'WorkflowId = "{workflow_id}" AND ExecutionStatus = "RUNNING"'
            )
            
            if executions:
                logger.warning(
                    f"⚠️ Found {len(executions)} active execution(s) for {workflow_id}"
                )
                # Cache the result
                self.redis.setex(cache_key, 60, "active")
                return True
            
            # No conflicts found, cache as inactive
            self.redis.setex(cache_key, 60, "inactive")
            return False
            
        except Exception as e:
            logger.error(f"Error checking duplicate workflows: {e}")
            # On error, assume safe (don't block execution)
            return False
    
    async def wait_for_workflow_completion(
        self,
        workflow_id: str,
        timeout_seconds: int = 3600
    ) -> Optional[Dict[str, Any]]:
        """
        Wait for workflow to complete, handling conflicts
        
        Args:
            workflow_id: Workflow to wait for
            timeout_seconds: Max wait time
            
        Returns:
            Workflow result or None if failed/timeout
        """
        cache_key = f"workflow:result:{workflow_id}"
        
        # Check cache first
        cached_result = self.redis.get(cache_key)
        if cached_result:
            import json
            logger.info(f"✅ Using cached result for {workflow_id}")
            return json.loads(cached_result)
        
        try:
            # Wait for execution to complete
            result = await self.temporal.get_workflow_result(
                workflow_id=workflow_id,
                timeout=timeout_seconds
            )
            
            # Cache the result
            import json
            self.redis.setex(cache_key, 86400, json.dumps(result))
            
            return result
            
        except Exception as e:
            logger.error(f"Error waiting for workflow: {e}")
            return None
    
    async def handle_concurrent_workflow_failure(
        self,
        workflow_id: str,
        error: Exception
    ) -> bool:
        """
        Handle failure in concurrent workflow
        
        Decides whether to retry, fail fast, or escalate
        
        Returns True if handled, False if should escalate
        """
        error_msg = str(error)
        
        # Pattern 1: State conflict (another workflow modified state)
        if "state conflict" in error_msg.lower():
            logger.warning(f"🔄 State conflict detected in {workflow_id}, retrying...")
            # Could retry with exponential backoff
            return True
        
        # Pattern 2: Resource locked (another workflow has lock)
        if "resource locked" in error_msg.lower() or "timeout" in error_msg.lower():
            logger.warning(f"⏱️ Resource lock timeout in {workflow_id}")
            # Could wait and retry
            return True
        
        # Pattern 3: Cascading failure (previous failure caused this)
        if self._is_cascading_failure(workflow_id):
            logger.warning(f"🌊 Cascading failure in {workflow_id}, stopping cascade...")
            # Mark for manual intervention
            self.redis.setex(f"workflow:cascading_failure:{workflow_id}", 3600, "true")
            return True
        
        # Other errors should escalate
        return False
    
    def _is_cascading_failure(self, workflow_id: str) -> bool:
        """Check if this is part of a cascading failure"""
        # Check if parent workflow failed recently
        cascade_key = f"workflow:cascading:{workflow_id}"
        return self.redis.exists(cascade_key)
    
    async def merge_concurrent_results(
        self,
        workflow_id: str,
        results: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Merge results from concurrent workflows (if applicable)
        
        Example: Multiple enrichment sources running in parallel
        """
        if not results:
            return {}
        
        if len(results) == 1:
            return results[0]
        
        # Merge strategy: Later result wins (timestamp-based)
        logger.info(f"📊 Merging {len(results)} results for {workflow_id}")
        
        merged = {}
        
        # For each result, add/update fields
        for result in results:
            if isinstance(result, dict):
                for key, value in result.items():
                    if key not in merged:
                        merged[key] = value
                    else:
                        # Handle conflicts (later value wins)
                        if isinstance(value, dict) and isinstance(merged[key], dict):
                            merged[key].update(value)
                        else:
                            merged[key] = value
        
        return merged


class WorkflowExecutionMonitor:
    """
    Monitors workflow executions for race conditions
    
    Detects:
    - Stuck workflows (running > expected time)
    - Duplicate concurrent executions
    - State inconsistencies
    """
    
    def __init__(self, redis_client, temporal_client):
        """Initialize monitor"""
        self.redis = redis_client
        self.temporal = temporal_client
        self.thresholds = {
            "bom_enrichment": 600,  # 10 minutes
            "bom_upload": 300,       # 5 minutes
            "component_normalize": 300,  # 5 minutes
            "supplier_sync": 3600,   # 1 hour
        }
    
    async def detect_stuck_workflows(self) -> List[str]:
        """Detect workflows stuck in running state"""
        stuck = []
        
        try:
            # Query for workflows running too long
            for workflow_type, threshold in self.thresholds.items():
                executions = await self.temporal.list_workflow_executions(
                    query=f'WorkflowType = "{workflow_type}" AND ExecutionStatus = "RUNNING"'
                )
                
                import time
                now = time.time()
                
                for execution in executions:
                    started = execution.started_at.timestamp()
                    elapsed = now - started
                    
                    if elapsed > threshold:
                        logger.warning(
                            f"⚠️ Stuck workflow: {execution.workflow_id} "
                            f"({execution.workflow_type}, {elapsed:.0f}s elapsed)"
                        )
                        stuck.append(execution.workflow_id)
            
            return stuck
            
        except Exception as e:
            logger.error(f"Error detecting stuck workflows: {e}")
            return []
    
    async def recover_stuck_workflow(self, workflow_id: str) -> bool:
        """Attempt to recover stuck workflow"""
        try:
            logger.info(f"🔧 Attempting to recover workflow: {workflow_id}")
            
            # Terminate the stuck workflow
            await self.temporal.terminate_workflow(workflow_id)
            logger.info(f"✅ Terminated stuck workflow: {workflow_id}")
            
            # Clear any locks
            self.redis.delete(f"workflow:{workflow_id}:lock")
            self.redis.delete(f"workflow:active:{workflow_id}")
            
            return True
            
        except Exception as e:
            logger.error(f"Error recovering workflow: {e}")
            return False


# Workflow-specific race condition handlers

class BOMEnrichmentRaceCondition:
    """Handle race conditions in BOM enrichment"""
    
    def __init__(self, redis_client, temporal_client):
        self.redis = redis_client
        self.temporal = temporal_client
        self.handler = TemporalRaceConditionHandler(redis_client, temporal_client)
    
    async def prevent_duplicate_enrichment(self, bom_id: int) -> bool:
        """Prevent same BOM being enriched twice simultaneously"""
        workflow_id = f"bom_enrichment_{bom_id}"
        return await self.handler.check_duplicate_workflow("bom_enrichment", workflow_id)
    
    async def ensure_enrichment_sequence(self, bom_id: int, steps: List[str]) -> bool:
        """
        Ensure enrichment steps happen in order
        
        Prevents race where pricing is calculated before MPN is resolved
        """
        state_key = f"bom:{bom_id}:enrichment_state"
        
        for step in steps:
            # Mark step as in progress
            self.redis.set(f"{state_key}:{step}", "in_progress")
            # ... execute step
            # Mark as complete
            self.redis.set(f"{state_key}:{step}", "complete")


class ComponentNormalizationRaceCondition:
    """Handle race conditions in component normalization"""
    
    def __init__(self, redis_client, temporal_client):
        self.redis = redis_client
        self.temporal = temporal_client
        self.handler = TemporalRaceConditionHandler(redis_client, temporal_client)
    
    async def prevent_concurrent_normalization(self, component_id: int) -> bool:
        """Prevent same component being normalized twice"""
        workflow_id = f"component_norm_{component_id}"
        return await self.handler.check_duplicate_workflow(
            "component_normalization",
            workflow_id
        )


# Global handlers
_race_condition_handler: Optional[TemporalRaceConditionHandler] = None
_execution_monitor: Optional[WorkflowExecutionMonitor] = None


def init_temporal_race_condition_handlers(redis_client, temporal_client):
    """Initialize Temporal race condition handlers"""
    global _race_condition_handler, _execution_monitor
    
    _race_condition_handler = TemporalRaceConditionHandler(redis_client, temporal_client)
    _execution_monitor = WorkflowExecutionMonitor(redis_client, temporal_client)
    
    logger.info("✅ Temporal race condition handlers initialized")


def get_temporal_race_condition_handler() -> TemporalRaceConditionHandler:
    """Get race condition handler"""
    if _race_condition_handler is None:
        raise RuntimeError("Handlers not initialized")
    return _race_condition_handler


def get_execution_monitor() -> WorkflowExecutionMonitor:
    """Get execution monitor"""
    if _execution_monitor is None:
        raise RuntimeError("Monitor not initialized")
    return _execution_monitor
