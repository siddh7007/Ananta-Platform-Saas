"""
PagerDuty Alert Forwarder Lambda Function
Forwards CloudWatch/SNS alerts to PagerDuty Events API v2
"""

import json
import os
import urllib3
from datetime import datetime

http = urllib3.PoolManager()

PAGERDUTY_EVENTS_URL = "https://events.pagerduty.com/v2/enqueue"


def handler(event, context):
    """
    Lambda handler for forwarding alerts to PagerDuty

    Args:
        event: SNS event containing CloudWatch alarm data
        context: Lambda context

    Returns:
        dict: Response status
    """

    integration_key = os.environ.get('PAGERDUTY_INTEGRATION_KEY')

    if not integration_key:
        print("ERROR: PAGERDUTY_INTEGRATION_KEY not set")
        return {
            'statusCode': 500,
            'body': json.dumps('PagerDuty integration key not configured')
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

    # Determine event action (trigger or resolve)
    alarm_state = message.get('NewStateValue', 'ALARM')
    event_action = 'resolve' if alarm_state == 'OK' else 'trigger'

    # Extract alert details
    alarm_name = message.get('AlarmName', 'Unknown Alarm')
    alarm_description = message.get('AlarmDescription', '')
    reason = message.get('NewStateReason', 'No reason provided')
    region = message.get('Region', 'unknown')
    timestamp = message.get('StateChangeTime', datetime.utcnow().isoformat())

    # Build PagerDuty event payload
    pagerduty_payload = {
        "routing_key": integration_key,
        "event_action": event_action,
        "dedup_key": f"ananta-{alarm_name}",
        "payload": {
            "summary": f"{alarm_name}: {alarm_state}",
            "source": f"AWS CloudWatch - {region}",
            "severity": "critical",
            "timestamp": timestamp,
            "custom_details": {
                "alarm_name": alarm_name,
                "description": alarm_description,
                "state": alarm_state,
                "reason": reason,
                "region": region,
                "aws_account": message.get('AWSAccountId', 'unknown'),
                "namespace": message.get('Trigger', {}).get('Namespace', 'unknown'),
                "metric_name": message.get('Trigger', {}).get('MetricName', 'unknown'),
            }
        }
    }

    # Add links if available
    alarm_arn = message.get('AlarmArn')
    if alarm_arn:
        pagerduty_payload['payload']['component'] = alarm_arn

    # Send to PagerDuty
    try:
        encoded_data = json.dumps(pagerduty_payload).encode('utf-8')

        response = http.request(
            'POST',
            PAGERDUTY_EVENTS_URL,
            body=encoded_data,
            headers={'Content-Type': 'application/json'}
        )

        response_data = json.loads(response.data.decode('utf-8'))

        print(f"PagerDuty response: {response.status}")
        print(f"Response body: {response_data}")

        if response.status == 202:
            return {
                'statusCode': 200,
                'body': json.dumps({
                    'message': 'Alert forwarded to PagerDuty',
                    'dedup_key': response_data.get('dedup_key'),
                    'status': response_data.get('status')
                })
            }
        else:
            print(f"ERROR: PagerDuty API returned {response.status}")
            return {
                'statusCode': response.status,
                'body': json.dumps(f'PagerDuty API error: {response_data}')
            }

    except Exception as e:
        print(f"ERROR sending to PagerDuty: {e}")
        return {
            'statusCode': 500,
            'body': json.dumps(f'Failed to send to PagerDuty: {str(e)}')
        }
