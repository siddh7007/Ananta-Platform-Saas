"""
Development Logger View - Receives console logs from frontend
Only active when DEBUG=True
"""
import json
import logging
from datetime import datetime
from pathlib import Path
from django.conf import settings
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

logger = logging.getLogger(__name__)

# Log file location
LOG_DIR = Path('/app/logs')
LOG_FILE = LOG_DIR / 'customer-portal-console.log'


def ensure_log_dir():
    """Ensure log directory exists"""
    LOG_DIR.mkdir(parents=True, exist_ok=True)


@csrf_exempt
@require_http_methods(["POST"])
def dev_logs_endpoint(request):
    """
    Receive console logs from frontend and write to file
    Only active in development mode (DEBUG=True)
    """
    # Only allow in development
    if not settings.DEBUG:
        return JsonResponse({
            'error': 'Development logging disabled in production'
        }, status=403)

    try:
        data = json.loads(request.body)
        logs = data.get('logs', [])

        if not logs:
            return JsonResponse({'status': 'ok', 'received': 0})

        # Ensure log directory exists
        ensure_log_dir()

        # Write logs to file
        with open(LOG_FILE, 'a', encoding='utf-8') as f:
            for log_entry in logs:
                timestamp = log_entry.get('timestamp', datetime.now().isoformat())
                level = log_entry.get('level', 'log').upper()
                message = log_entry.get('message', '')

                # Format: [2025-01-07T20:30:45.123Z] [ERROR] Message here
                f.write(f"[{timestamp}] [{level}] {message}\n")

        return JsonResponse({
            'status': 'ok',
            'received': len(logs),
            'log_file': str(LOG_FILE)
        })

    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON'}, status=400)
    except Exception as e:
        logger.error(f"Error writing dev logs: {e}")
        return JsonResponse({'error': str(e)}, status=500)
