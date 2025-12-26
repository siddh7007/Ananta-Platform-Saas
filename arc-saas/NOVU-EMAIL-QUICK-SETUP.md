# Novu Email Quick Setup - Bypass Dashboard Issues

## Problem
Novu v2.3.0 dashboard shows: **"This workflow is not supported in this version of the dashboard"**

## Solution
Configure email directly via MongoDB (bypasses dashboard entirely).

---

## Quick Setup (Gmail - 5 minutes)

### Step 1: Get Gmail App Password

1. Go to https://myaccount.google.com/security
2. Enable **2-Step Verification** (required)
3. Go back to Security â†’ **App passwords**
4. Create app password:
   - App: Mail
   - Device: Other (Custom name) â†’ "Ananta Novu"
5. **Copy the 16-character password** (no spaces)

### Step 2: Add to Environment File

Edit `arc-saas/.env` and add:

```bash
# Gmail SMTP Configuration
EMAIL_PROVIDER=nodemailer
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=abcd efgh ijkl mnop  # Your 16-char app password
SMTP_FROM=your-email@gmail.com
SMTP_SENDER_NAME=Ananta Platform
```

**Important**: Remove spaces from the app password!

### Step 3: Run Setup Script

```bash
cd arc-saas
node scripts/setup-novu-email-simple.js
```

Expected output:
```
======================================================================
Novu Email Provider Setup (Direct MongoDB)
======================================================================

[OK] Connected to MongoDB
[OK] Found environment: Development (6931905380e6f7e26e0ddaad)
[INFO] Creating new nodemailer integration
[OK] Email integration created

======================================================================
Email Provider Configuration Complete
======================================================================

Provider: nodemailer
From Email: your-email@gmail.com
Sender Name: Ananta Platform
SMTP Host: smtp.gmail.com
SMTP Port: 587

[NEXT STEPS]
1. Verify integration in Novu dashboard: http://localhost:14200/integrations
2. Create email templates via API (run bootstrap-novu-templates.js)
3. Test email sending
```

### Step 4: Verify (Optional)

You can check the Novu dashboard at http://localhost:14200/integrations but you don't need to - the integration is already active!

---

## Alternative: SendGrid (Production)

### Step 1: Get SendGrid API Key

1. Sign up at https://sendgrid.com (free: 100 emails/day)
2. Go to Settings â†’ API Keys
3. Create API Key (Full Access)
4. **Verify sender email** in SendGrid dashboard

### Step 2: Configure

Edit `arc-saas/.env`:

```bash
EMAIL_PROVIDER=sendgrid
SENDGRID_API_KEY=SG.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
SENDGRID_FROM=verified@yourdomain.com
SENDGRID_SENDER_NAME=Ananta Platform
```

### Step 3: Run Setup

```bash
node scripts/setup-novu-email-simple.js
```

---

## Testing Email

Create `test-email.js`:

```javascript
const { Novu } = require('@novu/api');

const novu = new Novu({
  secretKey: '<your-novu-api-key>', // From bootstrap-novu.js
  serverURL: 'http://localhost:13100',
});

(async () => {
  try {
    // Create test subscriber
    await novu.subscribers.create({
      subscriberId: 'test-123',
      email: 'your-email@gmail.com',
      firstName: 'Test',
      lastName: 'User',
    });

    console.log('[OK] Subscriber created');

    // Trigger test notification
    // Note: This requires a workflow to exist
    const result = await novu.trigger({
      workflowId: 'tenant-welcome',
      to: { subscriberId: 'test-123' },
      payload: {
        firstName: 'Test',
        lastName: 'User',
        email: 'test@example.com',
        tenantName: 'Test Organization',
        appPlaneUrl: 'http://localhost:27100',
      },
    });

    console.log('[OK] Email triggered:', result.result);
  } catch (error) {
    console.error('[ERROR]', error.message);
  }
})();
```

Run:
```bash
node test-email.js
```

---

## Troubleshooting

### "Authentication failed" (Gmail)

- âœ… Use **App Password**, not your regular Gmail password
- âœ… 2-Step Verification must be enabled
- âœ… Remove spaces from the 16-character password

### "No Novu environment found"

Run the bootstrap script first:
```bash
node bootstrap-novu.js
```

### "SMTP credentials incomplete"

Make sure you set all required variables:
- `SMTP_USER`
- `SMTP_PASSWORD`
- `SMTP_FROM`

### Emails not arriving

1. Check spam folder
2. Check Novu Activity Feed: http://localhost:14200/activities
3. Check MongoDB directly:
   ```bash
   docker exec -it arc-saas-novu-mongo mongosh
   use novu
   db.integrations.find({ channel: 'email' }).pretty()
   ```

---

## Configuration Examples

See [.env.novu-email-example](.env.novu-email-example) for all provider configurations:
- Gmail
- Outlook/Office365
- SendGrid
- AWS SES
- Custom SMTP

---

## Dashboard Access

**URL**: http://localhost:14200

**Login**:
- Email: `admin@example.com`
- Password: `admin123`

**Note**: You may see "workflow not supported" errors in the dashboard UI. This is OK - the email integration works via API regardless of dashboard compatibility.

---

## Next Steps

1. âœ… Configure email provider (done after running setup script)
2. Create email workflow templates (optional - use bootstrap-novu-templates.js)
3. Test email in your application (user invitations, etc.)
4. Monitor emails in Novu Activity Feed

The integration is now active and emails will be sent when your application triggers Novu workflows!
