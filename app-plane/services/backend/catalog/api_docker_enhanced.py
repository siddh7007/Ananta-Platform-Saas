"""
Docker Management API - Enhanced Version

Provides comprehensive endpoints for managing Docker containers and services.
Includes Docker SDK integration for better container management.
"""

import subprocess
import json
import docker
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework import status as http_status
from django.conf import settings
import logging
from datetime import datetime
from typing import Dict, List, Optional
from .container_health_monitor_optimized import health_monitor_optimized as health_monitor

# Import structured logging
from catalog.logging_config import get_logger

logger = get_logger(__name__)

# Initialize Docker client
try:
    docker_client = docker.from_env()
    logger.info("Docker client initialized successfully")
except Exception as e:
    logger.error(f"Failed to initialize Docker client: {e}")
    docker_client = None


def run_docker_command(command: list) -> dict:
    """
    Execute a docker-compose command and return the result.

    Args:
        command: List of command parts to execute

    Returns:
        dict with 'success', 'output', and optional 'error' keys
    """
    try:
        result = subprocess.run(
            command,
            cwd='/app',  # Docker compose file location
            capture_output=True,
            text=True,
            timeout=300  # 5 minute timeout
        )

        return {
            'success': result.returncode == 0,
            'output': result.stdout,
            'error': result.stderr if result.returncode != 0 else None,
            'return_code': result.returncode
        }
    except subprocess.TimeoutExpired:
        return {
            'success': False,
            'output': '',
            'error': 'Command timed out after 5 minutes'
        }
    except Exception as e:
        return {
            'success': False,
            'output': '',
            'error': str(e)
        }


def get_container_stats_sdk(container_name: str) -> Optional[Dict]:
    """
    Get container stats using Docker SDK.

    Args:
        container_name: Name of the container

    Returns:
        dict with CPU, memory, and network stats or None if error
    """
    if not docker_client:
        return None

    try:
        container = docker_client.containers.get(container_name)
        stats = container.stats(stream=False)

        # Calculate CPU percentage
        cpu_delta = stats['cpu_stats']['cpu_usage']['total_usage'] - \
                   stats['precpu_stats']['cpu_usage']['total_usage']
        system_delta = stats['cpu_stats']['system_cpu_usage'] - \
                      stats['precpu_stats']['system_cpu_usage']
        cpu_percent = (cpu_delta / system_delta) * \
                     len(stats['cpu_stats']['cpu_usage']['percpu_usage']) * 100.0 \
                     if system_delta > 0 else 0.0

        # Calculate memory usage
        memory_usage = stats['memory_stats'].get('usage', 0)
        memory_limit = stats['memory_stats'].get('limit', 0)
        memory_percent = (memory_usage / memory_limit) * 100.0 if memory_limit > 0 else 0.0

        return {
            'cpu_percent': round(cpu_percent, 2),
            'memory_usage_mb': round(memory_usage / (1024 * 1024), 2),
            'memory_limit_mb': round(memory_limit / (1024 * 1024), 2),
            'memory_percent': round(memory_percent, 2),
            'network_rx_bytes': stats['networks'].get('eth0', {}).get('rx_bytes', 0),
            'network_tx_bytes': stats['networks'].get('eth0', {}).get('tx_bytes', 0),
        }
    except Exception as e:
        logger.error(f"Failed to get stats for {container_name}: {e}")
        return None


@api_view(['GET'])
@permission_classes([AllowAny])  # TEMPORARY - TODO: Re-enable IsAuthenticated
@throttle_classes([])  # Disable throttling for dashboard/control panel polling
def container_status(request):
    """Get status of all Docker containers using Docker SDK."""
    try:
        if not docker_client:
            return Response(
                {'error': 'Docker client not available'},
                status=http_status.HTTP_503_SERVICE_UNAVAILABLE
            )

        # Get all containers using Docker SDK
        all_containers = docker_client.containers.list(all=True)

        containers = []
        for container in all_containers:
            container_name = container.name

            # Only process components-v2 containers
            if not container_name.startswith('components-v2-'):
                continue

            containers.append({
                'Name': container_name,
                'Service': container_name.replace('components-v2-', ''),
                'State': container.status,
                'Status': container.status,
                'Id': container.short_id
            })

        return Response({
            'containers': containers,
            'total': len(containers),
            'timestamp': datetime.utcnow().isoformat()
        })

    except Exception as e:
        logger.error(f"Failed to get container status: {e}")
        return Response(
            {'error': str(e)},
            status=http_status.HTTP_500_INTERNAL_SERVER_ERROR
        )



@api_view(['POST'])
@permission_classes([AllowAny])  # TEMPORARY - TODO: Re-enable IsAuthenticated
def restart_service(request):
    """Restart a specific service or all services."""
    service_name = request.data.get('service')

    if service_name:
        logger.info(f"User {request.user.email} restarting service: {service_name}")
        result = run_docker_command(['docker-compose', 'restart', service_name])
    else:
        logger.info(f"User {request.user.email} restarting all services")
        result = run_docker_command(['docker-compose', 'restart'])

    if result['success']:
        return Response({
            'message': f"Successfully restarted {service_name or 'all services'}",
            'output': result['output'],
            'timestamp': datetime.utcnow().isoformat()
        })
    else:
        return Response(
            {
                'error': f"Failed to restart {service_name or 'all services'}",
                'details': result['error']
            },
            status=http_status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([AllowAny])  # TEMPORARY - TODO: Re-enable IsAuthenticated
def rebuild_service(request):
    """Rebuild and restart a specific service."""
    service_name = request.data.get('service')

    if not service_name:
        return Response(
            {'error': 'Service name is required'},
            status=http_status.HTTP_400_BAD_REQUEST
        )

    logger.info(f"User {request.user.email} rebuilding service: {service_name}")

    # Build the service
    build_result = run_docker_command([
        'docker-compose', 'build', '--no-cache', service_name
    ])

    if not build_result['success']:
        return Response(
            {
                'error': f"Failed to build {service_name}",
                'details': build_result['error']
            },
            status=http_status.HTTP_500_INTERNAL_SERVER_ERROR
        )

    # Recreate the service
    restart_result = run_docker_command([
        'docker-compose', 'up', '-d', '--force-recreate', service_name
    ])

    if restart_result['success']:
        return Response({
            'message': f"Successfully rebuilt and restarted {service_name}",
            'build_output': build_result['output'],
            'restart_output': restart_result['output'],
            'timestamp': datetime.utcnow().isoformat()
        })
    else:
        return Response(
            {
                'error': f"Built {service_name} but failed to restart",
                'details': restart_result['error']
            },
            status=http_status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([AllowAny])  # TEMPORARY - TODO: Re-enable IsAuthenticated
def stop_service(request):
    """Stop a specific service or all services."""
    service_name = request.data.get('service')

    if service_name:
        logger.info(f"User {request.user.email} stopping service: {service_name}")
        result = run_docker_command(['docker-compose', 'stop', service_name])
    else:
        logger.info(f"User {request.user.email} stopping all services")
        result = run_docker_command(['docker-compose', 'stop'])

    if result['success']:
        return Response({
            'message': f"Successfully stopped {service_name or 'all services'}",
            'output': result['output'],
            'timestamp': datetime.utcnow().isoformat()
        })
    else:
        return Response(
            {
                'error': f"Failed to stop {service_name or 'all services'}",
                'details': result['error']
            },
            status=http_status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([AllowAny])  # TEMPORARY - TODO: Re-enable IsAuthenticated
def start_service(request):
    """Start a specific service or all services."""
    service_name = request.data.get('service')

    if service_name:
        logger.info(f"User {request.user.email} starting service: {service_name}")
        result = run_docker_command(['docker-compose', 'up', '-d', service_name])
    else:
        logger.info(f"User {request.user.email} starting all services")
        result = run_docker_command(['docker-compose', 'up', '-d'])

    if result['success']:
        return Response({
            'message': f"Successfully started {service_name or 'all services'}",
            'output': result['output'],
            'timestamp': datetime.utcnow().isoformat()
        })
    else:
        return Response(
            {
                'error': f"Failed to start {service_name or 'all services'}",
                'details': result['error']
            },
            status=http_status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['DELETE'])
@permission_classes([AllowAny])  # TEMPORARY - TODO: Re-enable IsAuthenticated
def kill_service(request):
    """
    Kill (force stop) a specific service.

    This is a destructive operation that forcefully terminates a container.
    Use with caution!
    """
    service_name = request.data.get('service')

    if not service_name:
        return Response(
            {'error': 'Service name is required'},
            status=http_status.HTTP_400_BAD_REQUEST
        )

    logger.warning(f"User {request.user.email} KILLING service: {service_name}")

    # Try Docker SDK first (cleaner)
    if docker_client:
        try:
            container = docker_client.containers.get(f"components-v2-{service_name}")
            container.kill()
            return Response({
                'message': f"Successfully killed {service_name}",
                'method': 'docker_sdk',
                'timestamp': datetime.utcnow().isoformat()
            })
        except docker.errors.NotFound:
            logger.warning(f"Container components-v2-{service_name} not found, trying docker-compose")
        except Exception as e:
            logger.error(f"Docker SDK kill failed: {e}, trying docker-compose")

    # Fallback to docker-compose kill
    result = run_docker_command(['docker-compose', 'kill', service_name])

    if result['success']:
        return Response({
            'message': f"Successfully killed {service_name}",
            'method': 'docker_compose',
            'output': result['output'],
            'timestamp': datetime.utcnow().isoformat()
        })
    else:
        return Response(
            {
                'error': f"Failed to kill {service_name}",
                'details': result['error']
            },
            status=http_status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([AllowAny])  # TEMPORARY - TODO: Re-enable IsAuthenticated
def container_logs(request):
    """Get logs for a specific container."""
    service_name = request.query_params.get('service')
    tail = request.query_params.get('tail', '100')
    follow = request.query_params.get('follow', 'false').lower() == 'true'

    if not service_name:
        return Response(
            {'error': 'Service name is required'},
            status=http_status.HTTP_400_BAD_REQUEST
        )

    command = ['docker-compose', 'logs', '--tail', str(tail)]
    if not follow:
        command.extend(['--no-follow'])
    command.append(service_name)

    result = run_docker_command(command)

    if result['success']:
        return Response({
            'service': service_name,
            'logs': result['output'],
            'tail': tail,
            'timestamp': datetime.utcnow().isoformat()
        })
    else:
        return Response(
            {
                'error': f"Failed to get logs for {service_name}",
                'details': result['error']
            },
            status=http_status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([AllowAny])  # TEMPORARY - TODO: Re-enable IsAuthenticated
def container_stats_sdk(request):
    """
    Get real-time stats for a specific container using Docker SDK.

    Returns CPU, memory, and network usage.
    """
    service_name = request.query_params.get('service')

    if not service_name:
        return Response(
            {'error': 'Service name is required'},
            status=http_status.HTTP_400_BAD_REQUEST
        )

    if not docker_client:
        return Response(
            {'error': 'Docker SDK client not available'},
            status=http_status.HTTP_500_INTERNAL_SERVER_ERROR
        )

    stats = get_container_stats_sdk(f"components-v2-{service_name}")

    if stats:
        return Response({
            'service': service_name,
            'stats': stats,
            'timestamp': datetime.utcnow().isoformat()
        })
    else:
        return Response(
            {'error': f"Failed to get stats for {service_name}"},
            status=http_status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([AllowAny])  # TEMPORARY - TODO: Re-enable IsAuthenticated
@throttle_classes([])  # Disable throttling for health check polling
def health_check(request):
    """
    Health check endpoint for Docker API.

    Returns Docker engine status and available endpoints.
    """
    docker_status = 'available' if docker_client else 'unavailable'

    endpoints = {
        'status': '/api/docker/status - Get all container status',
        'start': '/api/docker/start - Start service(s)',
        'stop': '/api/docker/stop - Stop service(s)',
        'restart': '/api/docker/restart - Restart service(s)',
        'kill': '/api/docker/kill - Force stop service',
        'rebuild': '/api/docker/rebuild - Rebuild and restart service',
        'logs': '/api/docker/logs - Get container logs',
        'stats': '/api/docker/stats - Get container stats (SDK)',
        'health': '/api/docker/health - This endpoint',
        'health-summary': '/api/docker/health-summary - Docker SDK health monitoring',
    }

    return Response({
        'status': 'healthy',
        'docker_sdk': docker_status,
        'endpoints': endpoints,
        'timestamp': datetime.utcnow().isoformat()
    })


@api_view(['GET'])
@permission_classes([AllowAny])  # TEMPORARY - TODO: Re-enable IsAuthenticated
@throttle_classes([])  # Disable throttling for health monitoring polling
def health_summary(request):
    """
    Get comprehensive health summary using Docker SDK.

    Returns detailed health status for all containers including:
    - Total containers, running vs stopped counts
    - Healthy vs unhealthy counts
    - Operational percentage
    - Individual container health details

    Query Parameters:
        filter: Container name prefix filter (default: 'components-v2-')
    """
    try:
        name_filter = request.GET.get('filter', 'components-v2-')
        summary = health_monitor.get_health_summary(name_filter)

        return Response(summary)

    except Exception as e:
        logger.error(f"Failed to get health summary: {e}")
        return Response(
            {'error': str(e)},
            status=http_status.HTTP_500_INTERNAL_SERVER_ERROR
        )
