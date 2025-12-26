#!/bin/bash
# Setup Novu Workflow for Tenant Provisioning
# This script creates the tenant-welcome workflow in Novu

set -e

NOVU_API_URL="http://localhost:13100"

# Get your API key from Novu Dashboard: http://localhost:14200
# Go to Settings → API Keys → Copy API Key
if [ -z "$NOVU_API_KEY" ]; then
  echo "❌ Error: NOVU_API_KEY environment variable is not set"
  echo ""
  echo "To get your API key:"
  echo "1. Open http://localhost:14200"
  echo "2. Go to Settings → API Keys"
  echo "3. Copy the API Key"
  echo "4. Run: export NOVU_API_KEY='<your-api-key>'"
  echo ""
  exit 1
fi

echo "🔧 Setting up Novu workflow..."

# Create tenant-welcome workflow
WORKFLOW_RESPONSE=$(curl -s -X POST "$NOVU_API_URL/v1/workflows" \
  -H "Authorization: ApiKey $NOVU_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "tenant-welcome",
    "description": "Welcome notification when tenant is provisioned",
    "notificationGroupId": "general",
    "steps": [
      {
        "template": {
          "type": "in_app",
          "content": "Welcome to {{tenantName}}! 🎉\n\nYour tenant has been successfully provisioned and is ready to use.\n\n**Details:**\n- Tenant ID: {{tenantId}}\n- Admin: {{firstName}} {{lastName}}\n- App URL: {{appPlaneUrl}}\n- Admin Portal: {{adminPortalUrl}}\n\nClick below to get started!",
          "cta": {
            "action": {
              "type": "redirect",
              "target": "{{appPlaneUrl}}"
            },
            "data": {
              "url": "{{appPlaneUrl}}"
            }
          }
        }
      }
    ],
    "active": true
  }')

echo "Response: $WORKFLOW_RESPONSE"

# Check if workflow was created
if echo "$WORKFLOW_RESPONSE" | grep -q '"_id"'; then
  echo "✅ Workflow 'tenant-welcome' created successfully!"
  WORKFLOW_ID=$(echo "$WORKFLOW_RESPONSE" | jq -r '.data._id')
  echo "Workflow ID: $WORKFLOW_ID"
else
  echo "❌ Failed to create workflow"
  echo "Response: $WORKFLOW_RESPONSE"
  exit 1
fi

echo ""
echo "✅ Novu workflow setup complete!"
echo ""
echo "You can now:"
echo "1. Login to admin portal: http://localhost:5000 (admin/admin123)"
echo "2. Provision a tenant to trigger notification"
echo "3. Check notification bell in admin portal"
