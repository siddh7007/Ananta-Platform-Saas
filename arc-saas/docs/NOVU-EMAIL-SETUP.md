# Novu Email Configuration Guide

## Quick Start

### 1. Choose Your Email Provider

For **testing/development** (easiest):
- **Gmail SMTP** - Use your Gmail account with app password
- **Outlook/Office365 SMTP** - Use your Microsoft account

For **production**:
- **SendGrid** - Popular, reliable, generous free tier
- **AWS SES** - Cost-effective for high volume
- **Postmark** - Great deliverability

### 2. Configure Email Provider

#### Option A: Using Gmail (Testing/Development)

**Step 1: Create Gmail App Password**

1. Go to your Google Account: https://myaccount.google.com/
2. Enable 2-Step Verification (required for app passwords)
3. Go to Security > 2-Step Verification > App passwords
4. Select "Mail" and "Other (Custom name)"
5. Name it "Ananta Platform Novu"
6. Copy the 16-character app password

**Step 2: Update Environment Variables**

Edit `arc-saas/.env`:

```bash
# Novu Configuration
NOVU_ENABLED=true
NOVU_API_KEY=your-novu-api-key  # Get from bootstrap-novu.js or dashboard
NOVU_BACKEND_URL=http://localhost:13100

# SMTP Configuration (Gmail)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-16-char-app-password
SMTP_FROM=your-email@gmail.com
SMTP_SENDER_NAME=Ananta Platform
```

**Step 3: Run Configuration Script**

```bash
cd arc-saas
node scripts/configure-novu-email.js
```

#### Option B: Using SendGrid (Production)

**Step 1: Get SendGrid API Key**

1. Sign up at https://sendgrid.com (free tier: 100 emails/day)
2. Go to Settings > API Keys
3. Create API Key with "Full Access"
4. Copy the API key

**Step 2: Verify Sender Email**

1. In SendGrid dashboard, go to Settings > Sender Authentication
2. Verify a Single Sender or Domain
3. Complete email verification

**Step 3: Update Configuration**

Edit `scripts/configure-novu-email.js`:

```javascript
const CONFIG = {
  novuApiUrl: 'http://localhost:13100',
  novuApiKey: process.env.NOVU_API_KEY,
  emailProvider: 'sendgrid',  // Change this

  credentials: {
    sendgrid: {
      apiKey: 'SG.your-actual-sendgrid-api-key',
      from: 'verified@yourdomain.com',
      senderName: 'Ananta Platform',
    },
  },
};
```

**Step 4: Run Configuration Script**

```bash
node scripts/configure-novu-email.js
```

#### Option C: Using AWS SES (Production - High Volume)

**Step 1: Set Up AWS SES**

1. Go to AWS Console > SES
2. Verify your email address or domain
3. Request production access (starts in sandbox mode)
4. Create IAM user with SES permissions
5. Get Access Key ID and Secret Access Key

**Step 2: Update Configuration**

```javascript
const CONFIG = {
  emailProvider: 'ses',

  credentials: {
    ses: {
      accessKeyId: 'AKIA...',
      secretAccessKey: 'your-secret-key',
      region: 'us-east-1',
      from: 'verified@yourdomain.com',
      senderName: 'Ananta Platform',
    },
  },
};
```

### 3. Verify Configuration

#### Check Novu Dashboard

1. Open http://localhost:14200
2. Login to Novu
3. Go to **Integrations**
4. You should see your email provider listed and **Active**

#### Test Email Sending

Create a test script:

```bash
node scripts/test-novu-email.js
```

```javascript
// test-novu-email.js
const { Novu } = require('@novu/api');

const novu = new Novu({
  secretKey: process.env.NOVU_API_KEY,
  serverURL: 'http://localhost:13100',
});

async function testEmail() {
  try {
    // Create subscriber
    await novu.subscribers.create({
      subscriberId: 'test-user-123',
      email: 'your-email@gmail.com',
      firstName: 'Test',
      lastName: 'User',
    });

    // Trigger notification
    const response = await novu.trigger({
      workflowId: 'user-invitation',  // Must exist in Novu
      to: {
        subscriberId: 'test-user-123',
      },
      payload: {
        firstName: 'Test',
        tenantName: 'Test Tenant',
        roleKey: 'admin',
        invitationUrl: 'http://localhost:27555/accept-invitation?token=test',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      },
    });

    console.log('[OK] Test email sent', response.result);
  } catch (error) {
    console.error('[ERROR] Failed to send test email', error);
  }
}

testEmail();
```

## Common Issues & Solutions

### Issue: "Authentication failed" (Gmail)

**Solution**:
- Make sure you created an **App Password** (not regular password)
- 2-Step Verification must be enabled
- Use the 16-character app password without spaces

### Issue: "Invalid API Key" (SendGrid)

**Solution**:
- Verify API key has "Full Access" permissions
- Check that sender email is verified in SendGrid
- API key should start with `SG.`

### Issue: "Email not sending"

**Solution**:
1. Check Novu dashboard > Activity Feed for errors
2. Verify integration is marked as **Active**
3. Check email templates exist in Novu
4. Run `node bootstrap-novu-templates.js` if templates missing

### Issue: "Emails going to spam"

**Solution**:
- For production, set up SPF, DKIM, DMARC records
- Use a verified domain (not Gmail for production)
- Warm up your sending domain gradually
- Use professional email provider (SendGrid, SES)

## Environment Variables Reference

```bash
# Required
NOVU_ENABLED=true
NOVU_API_KEY=your-api-key-from-novu
NOVU_BACKEND_URL=http://localhost:13100

# Gmail SMTP
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_FROM=your-email@gmail.com
SMTP_SENDER_NAME=Ananta Platform

# Outlook/Office365 SMTP
SMTP_HOST=smtp-mail.outlook.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@outlook.com
SMTP_PASSWORD=your-password
SMTP_FROM=your-email@outlook.com
SMTP_SENDER_NAME=Ananta Platform

# Custom SMTP
SMTP_HOST=smtp.yourdomain.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=noreply@yourdomain.com
SMTP_PASSWORD=your-password
SMTP_FROM=noreply@yourdomain.com
SMTP_SENDER_NAME=Ananta Platform
```

## Email Templates

All email templates are defined in Novu workflows. To customize:

1. **Via Dashboard** (Recommended):
   - Go to http://localhost:14200
   - Click "Workflows"
   - Select a workflow (e.g., "user-invitation")
   - Edit email template content

2. **Via Bootstrap Script**:
   - Edit `arc-saas/bootstrap-novu-templates.js`
   - Update template HTML/content
   - Run: `node bootstrap-novu-templates.js`

### Available Templates

| Workflow ID | Purpose | Trigger Event |
|------------|---------|---------------|
| `user-invitation` | User invited to tenant | POST /user-invitations |
| `user-welcome` | User account created | User accepts invitation |
| `tenant-welcome` | Tenant provisioned | Tenant provisioning complete |
| `tenant-provisioning-failed` | Tenant provisioning error | Provisioning workflow fails |
| `subscription-created` | New subscription | Subscription created |
| `payment-failed` | Payment failure | Stripe webhook |
| `payment-success` | Payment receipt | Stripe webhook |
| `trial-ending-soon` | Trial expiry warning | Scheduled job |
| `password-reset` | Password reset request | POST /auth/forgot-password |

## Next Steps

1. Configure your email provider using steps above
2. Test email sending with test script
3. Bootstrap email templates: `node bootstrap-novu-templates.js`
4. Test workflows in your application
5. Monitor Novu Activity Feed for delivery status

## Support

- **Novu Dashboard**: http://localhost:14200
- **Novu Docs**: https://docs.novu.co
- **Email Provider Docs**:
  - Gmail App Passwords: https://support.google.com/accounts/answer/185833
  - SendGrid: https://docs.sendgrid.com
  - AWS SES: https://docs.aws.amazon.com/ses/
