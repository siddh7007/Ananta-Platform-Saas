#!/bin/bash

# Setup Novu Notification Workflows for Arc SaaS
# This script creates the required notification templates

set -e

NOVU_API_URL="${NOVU_BACKEND_URL:-http://localhost:13100}"
NOVU_API_KEY="${NOVU_API_KEY}"

if [ -z "$NOVU_API_KEY" ]; then
  echo "[ERROR] NOVU_API_KEY environment variable is required"
  echo "Usage: NOVU_API_KEY=your-key ./setup-novu-workflows.sh"
  exit 1
fi

echo "Setting up Novu notification workflows..."
echo "API URL: $NOVU_API_URL"
echo ""

# Create tenant-welcome workflow
echo "Creating tenant-welcome workflow..."
curl -X POST "$NOVU_API_URL/v1/workflows" \
  -H "Authorization: ApiKey $NOVU_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Tenant Welcome",
    "notificationGroupId": "default",
    "tags": ["tenant", "provisioning"],
    "description": "Welcome notification sent when a tenant is successfully provisioned",
    "steps": [
      {
        "template": {
          "type": "in_app",
          "content": "Welcome to {{tenantName}}! Your tenant has been successfully provisioned.",
          "cta": {
            "type": "redirect",
            "data": {
              "url": "{{appPlaneUrl}}"
            },
            "action": {
              "status": "pending",
              "buttons": [
                {
                  "type": "primary",
                  "content": "Go to Dashboard"
                }
              ]
            }
          }
        },
        "active": true,
        "shouldStopOnFail": false,
        "filters": []
      }
    ],
    "active": true,
    "draft": false,
    "critical": false,
    "preferenceSettings": {
      "email": true,
      "sms": true,
      "in_app": true,
      "chat": true,
      "push": true
    }
  }' | jq .

echo ""
echo "Creating tenant-provisioning-failed workflow..."
curl -X POST "$NOVU_API_URL/v1/workflows" \
  -H "Authorization: ApiKey $NOVU_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Tenant Provisioning Failed",
    "notificationGroupId": "default",
    "tags": ["tenant", "error"],
    "description": "Error notification sent when tenant provisioning fails",
    "steps": [
      {
        "template": {
          "type": "in_app",
          "content": "Tenant provisioning failed for {{tenantName}}. Error: {{error}}",
          "cta": {
            "type": "redirect",
            "data": {
              "url": "{{supportUrl}}"
            },
            "action": {
              "status": "pending",
              "buttons": [
                {
                  "type": "secondary",
                  "content": "Contact Support"
                }
              ]
            }
          }
        },
        "active": true,
        "shouldStopOnFail": false,
        "filters": []
      }
    ],
    "active": true,
    "draft": false,
    "critical": true,
    "preferenceSettings": {
      "email": true,
      "sms": false,
      "in_app": true,
      "chat": false,
      "push": false
    }
  }' | jq .

echo ""
echo "✅ Novu workflows created successfully!"
echo ""
echo "Access Novu Dashboard: http://localhost:14200"
echo "API Key: $NOVU_API_KEY"
