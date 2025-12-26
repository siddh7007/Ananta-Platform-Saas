# Novu Email Templates - Ananta Platform

This document describes all Novu notification templates used in the Ananta Platform.

## Setup

Run the bootstrap scripts to create templates in your Novu instance:

```bash
# First, ensure Novu services are running
docker-compose up -d novu-mongodb novu-redis novu-api novu-worker

# Bootstrap initial Novu setup (organization, environment, API keys)
node bootstrap-novu.js

# Bootstrap all email templates
node bootstrap-novu-templates.js
```

## Template Reference

### User Management

#### `user-invitation`
Sent when a user is invited to join a tenant.

**Payload:**
```typescript
{
  firstName?: string;
  lastName?: string;
  email: string;
  tenantName: string;
  roleKey: string;
  invitedByName?: string;
  invitationUrl: string;
  expiresAt: string;
}
```

#### `user-welcome`
Sent after a user accepts an invitation and creates their account.

**Payload:**
```typescript
{
  firstName: string;
  lastName: string;
  email: string;
  tenantName: string;
  roleKey: string;
  loginUrl: string;
}
```

#### `password-reset`
Password reset request.

**Payload:**
```typescript
{
  firstName?: string;
  email: string;
  resetUrl: string;
}
```

### Tenant Management

#### `tenant-welcome`
Sent when a tenant is successfully provisioned.

**Payload:**
```typescript
{
  firstName: string;
  lastName: string;
  email: string;
  tenantName: string;
  appPlaneUrl: string;
}
```

#### `tenant-provisioning-failed`
Sent when tenant provisioning fails.

**Payload:**
```typescript
{
  firstName: string;
  email: string;
  tenantName: string;
  errorMessage: string;
  supportUrl: string;
}
```

#### `tenant-deprovisioning`
Sent when a tenant is being deprovisioned.

**Payload:**
```typescript
{
  firstName: string;
  email: string;
  tenantName: string;
  deactivationDate?: string;
  reason?: string;
}
```

### Subscription & Billing

#### `subscription-created`
Sent when a new subscription is created.

**Payload:**
```typescript
{
  firstName: string;
  email: string;
  planName: string;
  price: string;
  billingCycle: string;
  startDate: string;
  trialEndDate?: string;
  dashboardUrl: string;
}
```

#### `subscription-upgraded`
Sent when a subscription is upgraded.

**Payload:**
```typescript
{
  firstName: string;
  email: string;
  previousPlanName: string;
  newPlanName: string;
  newPrice: string;
  billingCycle: string;
  features: string[];
}
```

#### `subscription-cancelled`
Sent when a subscription is cancelled.

**Payload:**
```typescript
{
  firstName: string;
  email: string;
  planName: string;
  accessEndDate: string;
  reactivateUrl: string;
}
```

#### `payment-failed`
Sent when a payment fails.

**Payload:**
```typescript
{
  firstName: string;
  email: string;
  amount: string;
  planName: string;
  failureReason: string;
  updatePaymentUrl: string;
}
```

#### `payment-success`
Payment receipt/confirmation.

**Payload:**
```typescript
{
  email: string;
  amount: string;
  paymentDate: string;
  invoiceNumber: string;
  planName: string;
  invoiceUrl: string;
}
```

#### `trial-ending-soon`
Reminder that trial period is ending (sent 3 days before trial ends).

**Payload:**
```typescript
{
  firstName: string;
  email: string;
  planName: string;
  daysRemaining: number;
  trialEndDate: string;
  upgradeUrl: string;
}
```

### Lead Validation

#### `lead-validation`
Email verification for new lead registration.

**Payload:**
```typescript
{
  firstName: string;
  email: string;
  companyName: string;
  validationUrl: string;
}
```

## Usage in Code

### Temporal Worker Service

```typescript
import { sendEmail } from './activities/notification.activities';

// In workflow
await sendEmail({
  workflowId: 'user-invitation',
  subscriberId: `tenant-${tenantId}-${email.replace(/[@.]/g, '_')}`,
  tenantId,
  email,
  payload: {
    firstName: 'John',
    tenantName: 'Acme Corp',
    roleKey: 'admin',
    invitationUrl: 'https://...',
    expiresAt: '2024-01-15',
  },
});
```

### Tenant Management Service

```typescript
import { NovuNotificationService } from './services/novu-notification.service';

await this.novuService.sendNotification({
  workflowId: 'user-invitation',
  tenantId: invitation.tenantId,
  recipient: {
    email: invitation.email,
    firstName: invitation.firstName,
    lastName: invitation.lastName,
  },
  payload: {
    invitationToken: token,
    invitationUrl: `${FRONTEND_URL}/accept-invitation?token=${token}`,
    roleKey: invitation.roleKey,
    tenantName: tenant.name,
    expiresAt: expiresAt.toISOString(),
  },
});
```

## Customization

Templates use Handlebars syntax for variable interpolation:
- `{{variable}}` - Simple variable
- `{{#if condition}}...{{/if}}` - Conditional blocks
- `{{#each array}}...{{/each}}` - Loops

To customize templates, either:
1. Edit the `bootstrap-novu-templates.js` file and re-run it
2. Use the Novu dashboard at http://localhost:4200 (when running locally)

## Environment Variables

```bash
# Backend Services
NOVU_API_KEY=your-api-key
NOVU_BACKEND_URL=http://localhost:3000
NOVU_ENABLED=true

# Frontend Apps
VITE_NOVU_APP_IDENTIFIER=your-environment-id
VITE_NOVU_BACKEND_URL=http://localhost:3000
```
