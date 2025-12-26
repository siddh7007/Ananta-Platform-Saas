"""
Docker Management API

Provides endpoints for managing Docker containers and services.
"""

import subprocess
import json
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from django.conf import settings
import logging

# Import structured logging
from catalog.logging_config import get_logger

logger = get_logger(__name__)


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


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def container_status(request):
    """Get status of all Docker containers."""
    result = run_docker_command(['docker-compose', 'ps', '--format', 'json'])

    if not result['success']:
        return Response(
            {'error': result['error']},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

    try:
        # Parse JSON output from docker-compose ps
        containers = []
        for line in result['output'].strip().split('\n'):
            if line:
                containers.append(json.loads(line))

        return Response({'containers': containers})
    except json.JSONDecodeError:
        # Fallback to text parsing
        return Response({
            'containers': [],
            'output': result['output']
        })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def restart_service(request):
    """Restart a specific service or all services."""
    service_name = request.data.get('service')

    if service_name:
        logger.info(f"Restarting service: {service_name}")
        result = run_docker_command(['docker-compose', 'restart', service_name])
    else:
        logger.info("Restarting all services")
        result = run_docker_command(['docker-compose', 'restart'])

    if result['success']:
        return Response({
            'message': f"Successfully restarted {service_name or 'all services'}",
            'output': result['output']
        })
    else:
        return Response(
            {
                'error': f"Failed to restart {service_name or 'all services'}",
                'details': result['error']
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def rebuild_service(request):
    """Rebuild and restart a specific service."""
    service_name = request.data.get('service')

    if not service_name:
        return Response(
            {'error': 'Service name is required'},
            status=status.HTTP_400_BAD_REQUEST
        )

    logger.info(f"Rebuilding service: {service_name}")

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
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

    # Recreate the service
    restart_result = run_docker_command([
        'docker-compose', 'up', '-d', '--force-recreate', service_name
    ])

    if restart_result['success']:
        return Response({
            'message': f"Successfully rebuilt and restarted {service_name}",
            'build_output': build_result['output'],
            'restart_output': restart_result['output']
        })
    else:
        return Response(
            {
                'error': f"Built {service_name} but failed to restart",
                'details': restart_result['error']
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def stop_service(request):
    """Stop a specific service or all services."""
    service_name = request.data.get('service')

    if service_name:
        logger.info(f"Stopping service: {service_name}")
        result = run_docker_command(['docker-compose', 'stop', service_name])
    else:
        logger.info("Stopping all services")
        result = run_docker_command(['docker-compose', 'stop'])

    if result['success']:
        return Response({
            'message': f"Successfully stopped {service_name or 'all services'}",
            'output': result['output']
        })
    else:
        return Response(
            {
                'error': f"Failed to stop {service_name or 'all services'}",
                'details': result['error']
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def start_service(request):
    """Start a specific service or all services."""
    service_name = request.data.get('service')

    if service_name:
        logger.info(f"Starting service: {service_name}")
        result = run_docker_command(['docker-compose', 'up', '-d', service_name])
    else:
        logger.info("Starting all services")
        result = run_docker_command(['docker-compose', 'up', '-d'])

    if result['success']:
        return Response({
            'message': f"Successfully started {service_name or 'all services'}",
            'output': result['output']
        })
    else:
        return Response(
            {
                'error': f"Failed to start {service_name or 'all services'}",
                'details': result['error']
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def container_logs(request):
    """Get logs for a specific container."""
    service_name = request.query_params.get('service')
    tail = request.query_params.get('tail', '100')

    if not service_name:
        return Response(
            {'error': 'Service name is required'},
            status=status.HTTP_400_BAD_REQUEST
        )

    result = run_docker_command([
        'docker-compose', 'logs', '--tail', str(tail), service_name
    ])

    if result['success']:
        return Response({
            'service': service_name,
            'logs': result['output']
        })
    else:
        return Response(
            {
                'error': f"Failed to get logs for {service_name}",
                'details': result['error']
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
