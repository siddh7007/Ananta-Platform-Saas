# Webhook Bridge

Simple HTTP webhook receiver that handles Control Plane events and provisions resources in the App Plane.

## Events Handled

### `tenant.provisioned`
When Control Plane provisions a new tenant:
1. Create organization in Supabase
2. Create admin user in Auth0 organization
3. Initialize default project
4. Set resource limits based on plan

### `subscription.changed`
When subscription plan changes:
1. Update organization limits in Supabase
2. Enable/disable features based on plan

### `user.invited`
When user is invited from Control Plane:
1. Create user in Auth0 organization
2. Create user record in Supabase

## Webhook Security

All webhooks are signed with HMAC-SHA256:
```
X-Webhook-Signature: sha256=<signature>
```

Verify signature before processing any event.
