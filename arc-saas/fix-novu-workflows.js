/**
 * Fix Novu Workflows - Migrate from old format to new format
 * This script recreates workflows in a format compatible with latest Novu
 */

const { MongoClient, ObjectId } = require('mongodb');

const MONGO_URL = 'mongodb://localhost:27017';
const DB_NAME = 'novu-db';

// IDs from bootstrap script
const ORG_ID = new ObjectId('6931905380e6f7e26e0ddaa7');
const ENV_ID = new ObjectId('6931905380e6f7e26e0ddaad');
const USER_ID = new ObjectId('6931905380e6f7e26e0ddaa4');

async function fixWorkflows() {
  const client = new MongoClient(MONGO_URL);

  try {
    await client.connect();
    console.log('[OK] Connected to MongoDB');

    const db = client.db(DB_NAME);

    // Get or create notification group
    let group = await db.collection('notificationgroups').findOne({
      _environmentId: ENV_ID,
    });

    if (!group) {
      const groupId = new ObjectId();
      await db.collection('notificationgroups').insertOne({
        _id: groupId,
        name: 'General',
        _environmentId: ENV_ID,
        _organizationId: ORG_ID,
        _parentId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      group = { _id: groupId };
      console.log('[OK] Created notification group');
    }

    // Workflow definitions compatible with latest Novu
    const workflows = [
      {
        name: 'User Invitation',
        description: 'Invitation email when user is invited to tenant',
        triggerId: 'user-invitation',
        steps: [
          {
            type: 'email',
            name: 'User Invitation Email',
            subject: "You're invited to {{tenantName}}",
            content: `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2>Welcome to {{tenantName}}!</h2>

  <p>Hi {{firstName}},</p>

  <p>{{invitedByName}} has invited you to join <strong>{{tenantName}}</strong> as a <strong>{{roleKey}}</strong>.</p>

  <p style="margin: 30px 0;">
    <a href="{{invitationUrl}}" style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
      Accept Invitation
    </a>
  </p>

  <p style="color: #666; font-size: 14px;">
    This invitation expires on {{expiresAt}}.
  </p>

  <p style="color: #666; font-size: 14px; margin-top: 30px;">
    If you didn't expect this invitation, you can safely ignore this email.
  </p>
</div>
            `.trim(),
          },
        ],
      },
      {
        name: 'Tenant Welcome',
        description: 'Welcome email when tenant is successfully provisioned',
        triggerId: 'tenant-welcome',
        steps: [
          {
            type: 'email',
            name: 'Tenant Welcome Email',
            subject: 'Welcome to {{tenantName}} - Your Account is Ready!',
            content: `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2>🎉 Welcome to {{tenantName}}!</h2>

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

  <p>If you have any questions, feel free to reach out to our support team.</p>

  <p style="color: #666; font-size: 14px; margin-top: 30px;">
    Thank you for choosing Ananta Platform!
  </p>
</div>
            `.trim(),
          },
        ],
      },
      {
        name: 'Tenant Provisioning Failed',
        description: 'Notification when tenant provisioning fails',
        triggerId: 'tenant-provisioning-failed',
        steps: [
          {
            type: 'email',
            name: 'Provisioning Failed Email',
            subject: 'Issue with Your {{tenantName}} Account Setup',
            content: `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2>Account Setup Issue</h2>

  <p>Hi {{firstName}},</p>

  <p>We encountered an issue while setting up your account for <strong>{{tenantName}}</strong>.</p>

  <p><strong>Error Details:</strong></p>
  <p style="background-color: #FEE2E2; border-left: 4px solid #DC2626; padding: 12px; margin: 20px 0;">
    {{errorMessage}}
  </p>

  <p>Our team has been notified and is working to resolve this issue. We'll contact you shortly with an update.</p>

  <p style="margin: 30px 0;">
    <a href="{{supportUrl}}" style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
      Contact Support
    </a>
  </p>

  <p style="color: #666; font-size: 14px;">
    We apologize for the inconvenience and appreciate your patience.
  </p>
</div>
            `.trim(),
          },
        ],
      },
      {
        name: 'Payment Failed',
        description: 'Notification when payment fails',
        triggerId: 'payment-failed',
        steps: [
          {
            type: 'email',
            name: 'Payment Failed Email',
            subject: 'Payment Issue for {{tenantName}}',
            content: `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2>Payment Issue</h2>

  <p>Hi {{firstName}},</p>

  <p>We were unable to process your payment for <strong>{{planName}}</strong>.</p>

  <p><strong>Details:</strong></p>
  <ul>
    <li>Amount: {{amount}}</li>
    <li>Reason: {{failureReason}}</li>
  </ul>

  <p>Please update your payment method to avoid service interruption.</p>

  <p style="margin: 30px 0;">
    <a href="{{updatePaymentUrl}}" style="background-color: #DC2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
      Update Payment Method
    </a>
  </p>
</div>
            `.trim(),
          },
        ],
      },
      {
        name: 'Subscription Created',
        description: 'Confirmation when subscription is created',
        triggerId: 'subscription-created',
        steps: [
          {
            type: 'email',
            name: 'Subscription Created Email',
            subject: 'Your {{planName}} Subscription is Active!',
            content: `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2>Subscription Confirmed ✓</h2>

  <p>Hi {{firstName}},</p>

  <p>Your subscription to <strong>{{planName}}</strong> is now active!</p>

  <p><strong>Subscription Details:</strong></p>
  <ul>
    <li>Plan: {{planName}}</li>
    <li>Price: {{price}} / {{billingCycle}}</li>
    <li>Start Date: {{startDate}}</li>
    {{#if trialEndDate}}
    <li>Trial Ends: {{trialEndDate}}</li>
    {{/if}}
  </ul>

  <p style="margin: 30px 0;">
    <a href="{{dashboardUrl}}" style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
      View Dashboard
    </a>
  </p>
</div>
            `.trim(),
          },
        ],
      },
      {
        name: 'Trial Ending Soon',
        description: 'Reminder that trial is ending',
        triggerId: 'trial-ending-soon',
        steps: [
          {
            type: 'email',
            name: 'Trial Ending Email',
            subject: 'Your {{planName}} Trial Ends in {{daysRemaining}} Days',
            content: `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2>Trial Ending Soon</h2>

  <p>Hi {{firstName}},</p>

  <p>Your trial of <strong>{{planName}}</strong> will end in <strong>{{daysRemaining}} days</strong> on {{trialEndDate}}.</p>

  <p>To continue enjoying uninterrupted access, please upgrade to a paid plan.</p>

  <p style="margin: 30px 0;">
    <a href="{{upgradeUrl}}" style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
      Upgrade Now
    </a>
  </p>
</div>
            `.trim(),
          },
        ],
      },
    ];

    // Create workflows
    for (const workflow of workflows) {
      console.log(`\n[INFO] Creating workflow: ${workflow.name}`);

      const workflowId = new ObjectId();

      // Create step documents with Novu v3 required fields
      const steps = workflow.steps.map((step, index) => {
        const stepId = new ObjectId();
        return {
          _id: stepId,
          _templateId: workflowId,
          _parentId: index > 0 ? workflow.steps[index - 1]._id : null,
          active: true,
          shouldStopOnFail: false,
          type: 'REGULAR',  // Novu v3: step type must also be REGULAR
          replyCallback: {},
          metadata: { timed: { weekDays: [], monthDays: [] } },
          filters: [],
          variants: [],
          template: {
            type: step.type,
            name: step.name,
            subject: step.subject,
            content: step.content,
            contentType: 'customHtml',
            active: true,
            variables: [],
            _feedId: null,
            _layoutId: null,
            _environmentId: ENV_ID,
            _organizationId: ORG_ID,
            _creatorId: USER_ID,
            deleted: false,
          },
          uuid: new ObjectId().toString(),
          name: step.name,
        };
      });

      // Create workflow document with Novu v3 required fields
      await db.collection('notificationtemplates').insertOne({
        _id: workflowId,
        name: workflow.name,
        description: workflow.description,
        active: true,
        draft: false,
        critical: false,
        // Novu v3 required fields
        type: 'REGULAR',           // REGULAR for dashboard-editable workflows
        origin: 'novu-cloud',      // Required for v3 compatibility
        isBlueprint: false,
        payloadSchema: { type: 'object', additionalProperties: true, properties: {} },
        validatePayload: true,
        isTranslationEnabled: false,
        severity: 'none',
        tags: [],
        triggers: [
          {
            type: 'event',
            identifier: workflow.triggerId,
            variables: [],
            reservedVariables: [],
            subscriberVariables: [],
          },
        ],
        steps: steps,
        _notificationGroupId: group._id,
        _environmentId: ENV_ID,
        _organizationId: ORG_ID,
        _creatorId: USER_ID,
        deleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        preferenceSettings: {
          email: true,
          sms: false,
          in_app: true,
          chat: false,
          push: false,
        },
      });

      console.log(`[OK] Created workflow: ${workflow.name}`);
      console.log(`     Trigger ID: ${workflow.triggerId}`);
    }

    console.log('\n' + '='.repeat(70));
    console.log('[SUCCESS] All workflows created successfully!');
    console.log('='.repeat(70));
    console.log('\nYou can now:');
    console.log('1. View workflows in dashboard: http://localhost:14200/workflows');
    console.log('2. Configure email provider in: http://localhost:14200/integrations');
    console.log('3. Test workflows via API or your application');
    console.log('');

  } catch (error) {
    console.error('[ERROR]', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await client.close();
  }
}

fixWorkflows();
