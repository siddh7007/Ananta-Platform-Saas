"""
Container Health Monitor - Docker SDK Based
Provides real-time health status for all containers
"""

import docker
from typing import Dict, List, Optional
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

class ContainerHealthMonitor:
    """Monitor container health using Docker SDK"""
    
    def __init__(self):
        try:
            self.client = docker.from_env()
            logger.info("Container Health Monitor initialized")
        except Exception as e:
            logger.error(f"Failed to initialize Docker client: {e}")
            self.client = None
    
    def get_container_health(self, container_name: str) -> Dict:
        """Get detailed health status for a single container"""
        if not self.client:
            return {'status': 'unavailable', 'reason': 'Docker client not initialized'}
        
        try:
            container = self.client.containers.get(container_name)
            
            # Get health check status from inspect
            inspect_data = container.attrs
            health_data = inspect_data.get('State', {}).get('Health', {})
            
            return {
                'name': container.name,
                'status': container.status,
                'health': health_data.get('Status', 'none'),
                'healthy': health_data.get('Status') == 'healthy',
                'failing_streak': health_data.get('FailingStreak', 0),
                'last_check': self._parse_health_log(health_data.get('Log', [])),
                'state': inspect_data.get('State', {}).get('Status'),
                'running': container.status == 'running',
                'restart_count': inspect_data.get('RestartCount', 0),
                'started_at': inspect_data.get('State', {}).get('StartedAt'),
            }
        except docker.errors.NotFound:
            return {'status': 'not_found', 'name': container_name}
        except Exception as e:
            logger.error(f"Error getting health for {container_name}: {e}")
            return {'status': 'error', 'name': container_name, 'error': str(e)}
    
    def get_all_containers_health(self, name_filter: str = 'components-v2-') -> List[Dict]:
        """Get health status for all containers matching filter"""
        if not self.client:
            return []
        
        try:
            all_containers = self.client.containers.list(all=True)
            health_status = []
            
            for container in all_containers:
                if name_filter and not container.name.startswith(name_filter):
                    continue
                
                health_info = self.get_container_health(container.name)
                health_status.append(health_info)
            
            return health_status
        except Exception as e:
            logger.error(f"Error getting all containers health: {e}")
            return []
    
    def get_health_summary(self, name_filter: str = 'components-v2-') -> Dict:
        """Get summary of container health"""
        containers = self.get_all_containers_health(name_filter)
        
        healthy = sum(1 for c in containers if c.get('healthy'))
        unhealthy = sum(1 for c in containers if c.get('health') == 'unhealthy')
        no_healthcheck = sum(1 for c in containers if c.get('health') == 'none')
        running = sum(1 for c in containers if c.get('running'))
        stopped = len(containers) - running
        
        return {
            'total': len(containers),
            'running': running,
            'stopped': stopped,
            'healthy': healthy,
            'unhealthy': unhealthy,
            'no_healthcheck': no_healthcheck,
            'operational_percentage': round((healthy / len(containers) * 100) if containers else 0, 1),
            'timestamp': datetime.utcnow().isoformat(),
            'containers': containers
        }
    
    def _parse_health_log(self, health_log: List) -> Optional[Dict]:
        """Parse the most recent health check log entry"""
        if not health_log:
            return None
        
        latest = health_log[-1] if health_log else {}
        return {
            'exit_code': latest.get('ExitCode'),
            'output': latest.get('Output', '')[:200],  # Limit output length
            'timestamp': latest.get('End')
        }
    
    def get_unhealthy_containers(self, name_filter: str = 'components-v2-') -> List[Dict]:
        """Get list of unhealthy or stopped containers"""
        all_health = self.get_all_containers_health(name_filter)
        
        unhealthy = [
            c for c in all_health 
            if not c.get('running') or c.get('health') == 'unhealthy'
        ]
        
        return unhealthy

# Global instance
health_monitor = ContainerHealthMonitor()
