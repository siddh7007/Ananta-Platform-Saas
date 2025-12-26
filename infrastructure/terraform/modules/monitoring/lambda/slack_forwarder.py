"""
Slack Alert Forwarder Lambda Function
Forwards CloudWatch/SNS alerts to Slack via webhook
"""

import json
import os
import urllib3
from datetime import datetime

http = urllib3.PoolManager()


def handler(event, context):
    """
    Lambda handler for forwarding alerts to Slack

    Args:
        event: SNS event containing CloudWatch alarm data
        context: Lambda context

    Returns:
        dict: Response status
    """

    webhook_url = os.environ.get('SLACK_WEBHOOK_URL')

    if not webhook_url:
        print("ERROR: SLACK_WEBHOOK_URL not set")
        return {
            'statusCode': 500,
            'body': json.dumps('Slack webhook URL not configured')
        }

    # Parse SNS message
    try:
        message = json.loads(event['Records'][0]['Sns']['Message'])
    except (KeyError, json.JSONDecodeError) as e:
        print(f"ERROR parsing SNS message: {e}")
        return {
            'statusCode': 400,
            'body': json.dumps(f'Invalid SNS message: {e}')
        }

    # Extract alert details
    alarm_state = message.get('NewStateValue', 'ALARM')
    alarm_name = message.get('AlarmName', 'Unknown Alarm')
    alarm_description = message.get('AlarmDescription', '')
    reason = message.get('NewStateReason', 'No reason provided')
    region = message.get('Region', 'unknown')
    timestamp = message.get('StateChangeTime', datetime.utcnow().isoformat())

    # Determine color and emoji based on state
    if alarm_state == 'ALARM':
        color = 'danger'
        emoji = ':fire:'
    elif alarm_state == 'OK':
        color = 'good'
        emoji = ':white_check_mark:'
    else:
        color = 'warning'
        emoji = ':warning:'

    # Get trigger details
    trigger = message.get('Trigger', {})
    metric_name = trigger.get('MetricName', 'unknown')
    namespace = trigger.get('Namespace', 'unknown')
    threshold = trigger.get('Threshold', 'N/A')

    # Build Slack message
    slack_payload = {
        "username": "Ananta Platform Alerts",
        "icon_emoji": ":chart_with_upwards_trend:",
        "attachments": [
            {
                "color": color,
                "title": f"{emoji} {alarm_name}",
                "text": alarm_description or reason,
                "fields": [
                    {
                        "title": "Status",
                        "value": alarm_state,
                        "short": True
                    },
                    {
                        "title": "Region",
                        "value": region,
                        "short": True
                    },
                    {
                        "title": "Metric",
                        "value": f"{namespace} - {metric_name}",
                        "short": True
                    },
                    {
                        "title": "Threshold",
                        "value": str(threshold),
                        "short": True
                    },
                    {
                        "title": "Reason",
                        "value": reason,
                        "short": False
                    }
                ],
                "footer": "Ananta Platform Monitoring",
                "ts": int(datetime.fromisoformat(timestamp.replace('Z', '+00:00')).timestamp())
            }
        ]
    }

    # Add action buttons if alarm is firing
    if alarm_state == 'ALARM':
        alarm_arn = message.get('AlarmArn', '')
        if alarm_arn:
            # Extract AWS region and account from ARN
            arn_parts = alarm_arn.split(':')
            aws_region = arn_parts[3] if len(arn_parts) > 3 else region
            account_id = arn_parts[4] if len(arn_parts) > 4 else 'unknown'

            console_url = (
                f"https://console.aws.amazon.com/cloudwatch/home?"
                f"region={aws_region}#alarmsV2:alarm/{alarm_name}"
            )

            slack_payload['attachments'][0]['actions'] = [
                {
                    "type": "button",
                    "text": "View in CloudWatch",
                    "url": console_url,
                    "style": "danger"
                },
                {
                    "type": "button",
                    "text": "View Grafana Dashboard",
                    "url": "http://localhost:3001/d/platform-overview"
                }
            ]

    # Send to Slack
    try:
        encoded_data = json.dumps(slack_payload).encode('utf-8')

        response = http.request(
            'POST',
            webhook_url,
            body=encoded_data,
            headers={'Content-Type': 'application/json'}
        )

        print(f"Slack response: {response.status}")

        if response.status == 200:
            return {
                'statusCode': 200,
                'body': json.dumps('Alert forwarded to Slack')
            }
        else:
            print(f"ERROR: Slack API returned {response.status}: {response.data}")
            return {
                'statusCode': response.status,
                'body': json.dumps(f'Slack API error: {response.data.decode()}')
            }

    except Exception as e:
        print(f"ERROR sending to Slack: {e}")
        return {
            'statusCode': 500,
            'body': json.dumps(f'Failed to send to Slack: {str(e)}')
        }
