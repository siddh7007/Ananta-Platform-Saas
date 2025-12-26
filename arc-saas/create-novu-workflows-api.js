/**
 * Create Novu Workflows via API (v3.11.0 compatible)
 * Uses the official API to ensure dashboard compatibility
 */

const API_URL = process.env.NOVU_BACKEND_URL || 'http://localhost:13100';
const API_KEY = process.env.NOVU_API_KEY;

if (!API_KEY) {
  console.error('[ERROR] NOVU_API_KEY environment variable is required');
  console.error('Usage: NOVU_API_KEY=your-key node create-novu-workflows-api.js');
  process.exit(1);
}

const workflows = [
  {
    name: 'User Invitation',
    description: 'Invitation email when user is invited to tenant',
    notificationGroupId: null, // Will be set after getting/creating group
    steps: [
      {
        template: {
          type: 'email',
          subject: "You're invited to {{tenantName}}",
          content: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2>Welcome to {{tenantName}}!</h2>
  <p>Hi {{firstName}},</p>
  <p>{{invitedByName}} has invited you to join <strong>{{tenantName}}</strong> as a <strong>{{roleKey}}</strong>.</p>
  <p style="margin: 30px 0;">
    <a href="{{invitationUrl}}" style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
      Accept Invitation
    </a>
  </p>
  <p style="color: #666; font-size: 14px;">This invitation expires on {{expiresAt}}.</p>
</div>`,
          contentType: 'customHtml'
        }
      }
    ],
    triggers: [{ identifier: 'user-invitation' }]
  },
  {
    name: 'Tenant Welcome',
    description: 'Welcome email when tenant is successfully provisioned',
    steps: [
      {
        template: {
          type: 'email',
          subject: 'Welcome to {{tenantName}} - Your Account is Ready!',
          content: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2>Welcome to {{tenantName}}!</h2>
  <p>Hi {{firstName}} {{lastName}},</p>
  <p>Great news! Your account has been successfully provisioned and is ready to use.</p>
  <p><strong>Account Details:</strong></p>
  <ul>
    <li>Organization: {{tenantName}}</li>
    <li>Email: {{email}}</li>
  </ul>
  <p style="margin: 30px 0;">
    <a href="{{appPlaneUrl}}" style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
      Go to Dashboard
    </a>
  </p>
</div>`,
          contentType: 'customHtml'
        }
      }
    ],
    triggers: [{ identifier: 'tenant-welcome' }]
  },
  {
    name: 'Tenant Provisioning Failed',
    description: 'Notification when tenant provisioning fails',
    steps: [
      {
        template: {
          type: 'email',
          subject: 'Issue with Your {{tenantName}} Account Setup',
          content: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2>Account Setup Issue</h2>
  <p>Hi {{firstName}},</p>
  <p>We encountered an issue while setting up your account for <strong>{{tenantName}}</strong>.</p>
  <p style="background-color: #FEE2E2; border-left: 4px solid #DC2626; padding: 12px; margin: 20px 0;">
    {{errorMessage}}
  </p>
  <p>Our team has been notified and is working to resolve this issue.</p>
  <p style="margin: 30px 0;">
    <a href="{{supportUrl}}" style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
      Contact Support
    </a>
  </p>
</div>`,
          contentType: 'customHtml'
        }
      }
    ],
    triggers: [{ identifier: 'tenant-provisioning-failed' }]
  },
  {
    name: 'Payment Failed',
    description: 'Notification when payment fails',
    steps: [
      {
        template: {
          type: 'email',
          subject: 'Payment Issue for {{tenantName}}',
          content: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2>Payment Issue</h2>
  <p>Hi {{firstName}},</p>
  <p>We were unable to process your payment for <strong>{{planName}}</strong>.</p>
  <p><strong>Details:</strong></p>
  <ul>
    <li>Amount: {{amount}}</li>
    <li>Reason: {{failureReason}}</li>
  </ul>
  <p style="margin: 30px 0;">
    <a href="{{updatePaymentUrl}}" style="background-color: #DC2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
      Update Payment Method
    </a>
  </p>
</div>`,
          contentType: 'customHtml'
        }
      }
    ],
    triggers: [{ identifier: 'payment-failed' }]
  },
  {
    name: 'Subscription Created',
    description: 'Confirmation when subscription is created',
    steps: [
      {
        template: {
          type: 'email',
          subject: 'Your {{planName}} Subscription is Active!',
          content: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2>Subscription Confirmed</h2>
  <p>Hi {{firstName}},</p>
  <p>Your subscription to <strong>{{planName}}</strong> is now active!</p>
  <p><strong>Subscription Details:</strong></p>
  <ul>
    <li>Plan: {{planName}}</li>
    <li>Price: {{price}} / {{billingCycle}}</li>
    <li>Start Date: {{startDate}}</li>
  </ul>
  <p style="margin: 30px 0;">
    <a href="{{dashboardUrl}}" style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
      View Dashboard
    </a>
  </p>
</div>`,
          contentType: 'customHtml'
        }
      }
    ],
    triggers: [{ identifier: 'subscription-created' }]
  },
  {
    name: 'Trial Ending Soon',
    description: 'Reminder that trial is ending',
    steps: [
      {
        template: {
          type: 'email',
          subject: 'Your {{planName}} Trial Ends in {{daysRemaining}} Days',
          content: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2>Trial Ending Soon</h2>
  <p>Hi {{firstName}},</p>
  <p>Your trial of <strong>{{planName}}</strong> will end in <strong>{{daysRemaining}} days</strong> on {{trialEndDate}}.</p>
  <p>To continue enjoying uninterrupted access, please upgrade to a paid plan.</p>
  <p style="margin: 30px 0;">
    <a href="{{upgradeUrl}}" style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
      Upgrade Now
    </a>
  </p>
</div>`,
          contentType: 'customHtml'
        }
      }
    ],
    triggers: [{ identifier: 'trial-ending-soon' }]
  }
];

async function createWorkflows() {
  console.log('='.repeat(70));
  console.log('Creating Novu Workflows via API (v3.11.0 compatible)');
  console.log('='.repeat(70));
  console.log('');

  const headers = {
    'Authorization': `ApiKey ${API_KEY}`,
    'Content-Type': 'application/json'
  };

  try {
    // Get or create notification group
    console.log('[INFO] Fetching notification groups...');
    const groupsRes = await fetch(`${API_URL}/v1/notification-groups`, { headers });
    const groupsData = await groupsRes.json();

    let groupId;
    if (groupsData.data && groupsData.data.length > 0) {
      groupId = groupsData.data[0]._id;
      console.log(`[OK] Using existing group: ${groupsData.data[0].name} (${groupId})`);
    } else {
      console.log('[INFO] Creating notification group...');
      const createGroupRes = await fetch(`${API_URL}/v1/notification-groups`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ name: 'General' })
      });
      const newGroup = await createGroupRes.json();
      groupId = newGroup.data._id;
      console.log(`[OK] Created group: General (${groupId})`);
    }

    // Create each workflow
    for (const workflow of workflows) {
      console.log(`\n[INFO] Creating workflow: ${workflow.name}`);

      const payload = {
        name: workflow.name,
        description: workflow.description,
        notificationGroupId: groupId,
        active: true,
        draft: false,
        critical: false,
        steps: workflow.steps,
        triggers: workflow.triggers,
        preferenceSettings: {
          email: true,
          sms: false,
          in_app: true,
          chat: false,
          push: false
        }
      };

      const res = await fetch(`${API_URL}/v1/notification-templates`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });

      const result = await res.json();

      if (res.ok) {
        console.log(`[OK] Created: ${workflow.name}`);
        console.log(`     Trigger ID: ${workflow.triggers[0].identifier}`);
        console.log(`     Workflow ID: ${result.data._id}`);
      } else {
        console.log(`[ERROR] Failed to create ${workflow.name}:`);
        console.log(`        ${JSON.stringify(result)}`);
      }
    }

    console.log('\n' + '='.repeat(70));
    console.log('[SUCCESS] Workflow creation complete!');
    console.log('='.repeat(70));
    console.log('\nAccess Novu Dashboard: http://localhost:14200/workflows');
    console.log('');

  } catch (error) {
    console.error('[ERROR]', error.message);
    process.exit(1);
  }
}

createWorkflows();
