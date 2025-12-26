/**
 * Bootstrap Novu Email Templates
 *
 * This script creates all required notification workflows/templates in Novu.
 * Run after initial bootstrap-novu.js has been executed.
 *
 * Usage: node bootstrap-novu-templates.js
 */
const { MongoClient, ObjectId } = require('mongodb');

const MONGO_URL = process.env.NOVU_MONGO_URL || 'mongodb://localhost:27017';
const DB_NAME = 'novu';

// Use existing IDs from bootstrap-novu.js
const ORG_ID = new ObjectId('6931905380e6f7e26e0ddaa7');
const ENV_ID = new ObjectId('6931905380e6f7e26e0ddaad');
const USER_ID = new ObjectId('6931905380e6f7e26e0ddaa4');

/**
 * Email Template Definitions for Ananta Platform
 */
const EMAIL_TEMPLATES = [
  // ============================================
  // USER MANAGEMENT TEMPLATES
  // ============================================
  {
    triggerId: 'user-invitation',
    name: 'User Invitation',
    description: 'Invitation email sent when a user is invited to join a tenant',
    steps: [
      {
        type: 'email',
        subject: 'You\'ve been invited to join {{tenantName}}',
        content: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>You're Invited!</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; margin: 0; padding: 0; background-color: #f4f4f5;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <div style="background: white; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05); overflow: hidden;">
      <!-- Header -->
      <div style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); padding: 32px; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 24px; font-weight: 600;">You're Invited! 🎉</h1>
      </div>

      <!-- Content -->
      <div style="padding: 32px;">
        <p style="color: #374151; font-size: 16px; margin: 0 0 16px;">
          Hi{{#if firstName}} {{firstName}}{{/if}},
        </p>

        <p style="color: #374151; font-size: 16px; margin: 0 0 24px;">
          You've been invited to join <strong>{{tenantName}}</strong> as a <strong>{{roleKey}}</strong>.
        </p>

        {{#if invitedByName}}
        <p style="color: #6b7280; font-size: 14px; margin: 0 0 24px;">
          Invited by: {{invitedByName}}
        </p>
        {{/if}}

        <div style="text-align: center; margin: 32px 0;">
          <a href="{{invitationUrl}}" style="display: inline-block; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
            Accept Invitation
          </a>
        </div>

        <p style="color: #6b7280; font-size: 14px; margin: 24px 0 0; text-align: center;">
          This invitation expires on {{expiresAt}}.
        </p>

        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">

        <p style="color: #9ca3af; font-size: 12px; margin: 0; text-align: center;">
          If you didn't expect this invitation, you can safely ignore this email.
        </p>
      </div>
    </div>

    <!-- Footer -->
    <div style="text-align: center; padding: 24px;">
      <p style="color: #9ca3af; font-size: 12px; margin: 0;">
        Powered by Ananta Platform
      </p>
    </div>
  </div>
</body>
</html>
        `.trim(),
      },
      {
        type: 'in_app',
        content: 'You\'ve been invited to join {{tenantName}} as a {{roleKey}}. Click to accept.',
        cta: {
          type: 'redirect',
          data: { url: '{{invitationUrl}}' },
        },
      },
    ],
  },

  {
    triggerId: 'user-welcome',
    name: 'User Welcome',
    description: 'Welcome email sent after user accepts invitation and creates account',
    steps: [
      {
        type: 'email',
        subject: 'Welcome to {{tenantName}}!',
        content: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; margin: 0; padding: 0; background-color: #f4f4f5;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <div style="background: white; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05); overflow: hidden;">
      <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 32px; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 24px;">Welcome Aboard! 🚀</h1>
      </div>

      <div style="padding: 32px;">
        <p style="color: #374151; font-size: 16px; margin: 0 0 16px;">
          Hi {{firstName}},
        </p>

        <p style="color: #374151; font-size: 16px; margin: 0 0 24px;">
          Your account has been successfully created. You now have access to <strong>{{tenantName}}</strong>.
        </p>

        <div style="background: #f9fafb; border-radius: 8px; padding: 20px; margin: 24px 0;">
          <h3 style="color: #374151; margin: 0 0 12px; font-size: 14px; font-weight: 600;">Your Account Details:</h3>
          <p style="color: #6b7280; font-size: 14px; margin: 4px 0;"><strong>Email:</strong> {{email}}</p>
          <p style="color: #6b7280; font-size: 14px; margin: 4px 0;"><strong>Role:</strong> {{roleKey}}</p>
        </div>

        <div style="text-align: center; margin: 32px 0;">
          <a href="{{loginUrl}}" style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600;">
            Go to Dashboard
          </a>
        </div>
      </div>
    </div>
  </div>
</body>
</html>
        `.trim(),
      },
    ],
  },

  {
    triggerId: 'password-reset',
    name: 'Password Reset',
    description: 'Password reset request email',
    steps: [
      {
        type: 'email',
        subject: 'Reset your password',
        content: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; margin: 0; padding: 0; background-color: #f4f4f5;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <div style="background: white; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05); overflow: hidden;">
      <div style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 32px; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 24px;">Password Reset 🔐</h1>
      </div>

      <div style="padding: 32px;">
        <p style="color: #374151; font-size: 16px; margin: 0 0 16px;">
          Hi{{#if firstName}} {{firstName}}{{/if}},
        </p>

        <p style="color: #374151; font-size: 16px; margin: 0 0 24px;">
          We received a request to reset your password. Click the button below to create a new password.
        </p>

        <div style="text-align: center; margin: 32px 0;">
          <a href="{{resetUrl}}" style="display: inline-block; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600;">
            Reset Password
          </a>
        </div>

        <p style="color: #6b7280; font-size: 14px; margin: 24px 0 0; text-align: center;">
          This link expires in 1 hour.
        </p>

        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">

        <p style="color: #9ca3af; font-size: 12px; margin: 0; text-align: center;">
          If you didn't request a password reset, please ignore this email or contact support.
        </p>
      </div>
    </div>
  </div>
</body>
</html>
        `.trim(),
      },
    ],
  },

  // ============================================
  // TENANT MANAGEMENT TEMPLATES
  // ============================================
  {
    triggerId: 'tenant-welcome',
    name: 'Tenant Welcome',
    description: 'Welcome email sent when tenant provisioning is complete',
    steps: [
      {
        type: 'email',
        subject: 'Welcome to Ananta Platform! Your workspace is ready 🎉',
        content: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; margin: 0; padding: 0; background-color: #f4f4f5;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <div style="background: white; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05); overflow: hidden;">
      <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 32px; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 24px;">Your Workspace is Ready! 🚀</h1>
      </div>

      <div style="padding: 32px;">
        <p style="color: #374151; font-size: 16px; margin: 0 0 16px;">
          Hi {{firstName}},
        </p>

        <p style="color: #374151; font-size: 16px; margin: 0 0 24px;">
          Congratulations! Your <strong>{{tenantName}}</strong> workspace has been successfully created and is ready to use.
        </p>

        <div style="background: #f9fafb; border-radius: 8px; padding: 20px; margin: 24px 0;">
          <h3 style="color: #374151; margin: 0 0 12px; font-size: 14px; font-weight: 600;">Getting Started:</h3>
          <ul style="color: #6b7280; font-size: 14px; margin: 0; padding-left: 20px;">
            <li style="margin-bottom: 8px;">Log in to your new workspace</li>
            <li style="margin-bottom: 8px;">Complete your profile setup</li>
            <li style="margin-bottom: 8px;">Invite your team members</li>
            <li style="margin-bottom: 8px;">Explore your dashboard</li>
          </ul>
        </div>

        <div style="text-align: center; margin: 32px 0;">
          <a href="{{appPlaneUrl}}" style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600;">
            Access Your Workspace
          </a>
        </div>

        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">

        <p style="color: #6b7280; font-size: 14px; margin: 0; text-align: center;">
          Need help? Contact our support team anytime.
        </p>
      </div>
    </div>

    <div style="text-align: center; padding: 24px;">
      <p style="color: #9ca3af; font-size: 12px; margin: 0;">
        Powered by Ananta Platform
      </p>
    </div>
  </div>
</body>
</html>
        `.trim(),
      },
      {
        type: 'in_app',
        content: '🎉 Your workspace {{tenantName}} is ready! Click to access your dashboard.',
        cta: {
          type: 'redirect',
          data: { url: '{{appPlaneUrl}}' },
        },
      },
    ],
  },

  {
    triggerId: 'tenant-provisioning-failed',
    name: 'Tenant Provisioning Failed',
    description: 'Notification when tenant provisioning fails',
    steps: [
      {
        type: 'email',
        subject: 'Tenant Provisioning Failed - Action Required',
        content: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; margin: 0; padding: 0; background-color: #f4f4f5;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <div style="background: white; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05); overflow: hidden;">
      <div style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); padding: 32px; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 24px;">Provisioning Failed ⚠️</h1>
      </div>

      <div style="padding: 32px;">
        <p style="color: #374151; font-size: 16px; margin: 0 0 16px;">
          Hi {{firstName}},
        </p>

        <p style="color: #374151; font-size: 16px; margin: 0 0 24px;">
          We encountered an issue while setting up your tenant <strong>{{tenantName}}</strong>.
        </p>

        <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 16px; margin: 24px 0;">
          <p style="color: #991b1b; font-size: 14px; margin: 0;">
            <strong>Error:</strong> {{errorMessage}}
          </p>
        </div>

        <p style="color: #374151; font-size: 16px; margin: 0 0 24px;">
          Our team has been notified and is working on resolving this issue. You can also contact support for assistance.
        </p>

        <div style="text-align: center; margin: 32px 0;">
          <a href="{{supportUrl}}" style="display: inline-block; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600;">
            Contact Support
          </a>
        </div>
      </div>
    </div>
  </div>
</body>
</html>
        `.trim(),
      },
      {
        type: 'in_app',
        content: '⚠️ Tenant provisioning failed for {{tenantName}}. Error: {{errorMessage}}',
      },
    ],
  },

  {
    triggerId: 'tenant-deprovisioning',
    name: 'Tenant Deprovisioning',
    description: 'Notification when tenant is being deprovisioned',
    steps: [
      {
        type: 'email',
        subject: 'Your {{tenantName}} account will be deactivated',
        content: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; margin: 0; padding: 0; background-color: #f4f4f5;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <div style="background: white; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05); overflow: hidden;">
      <div style="background: linear-gradient(135deg, #6b7280 0%, #4b5563 100%); padding: 32px; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 24px;">Account Deactivation Notice</h1>
      </div>

      <div style="padding: 32px;">
        <p style="color: #374151; font-size: 16px; margin: 0 0 16px;">
          Hi {{firstName}},
        </p>

        <p style="color: #374151; font-size: 16px; margin: 0 0 24px;">
          Your <strong>{{tenantName}}</strong> account is scheduled for deactivation{{#if deactivationDate}} on {{deactivationDate}}{{/if}}.
        </p>

        <div style="background: #fef3c7; border: 1px solid #fcd34d; border-radius: 8px; padding: 16px; margin: 24px 0;">
          <p style="color: #92400e; font-size: 14px; margin: 0;">
            <strong>Important:</strong> Please export any data you wish to keep before this date.
          </p>
        </div>

        <p style="color: #374151; font-size: 16px; margin: 0 0 24px;">
          {{#if reason}}Reason: {{reason}}{{/if}}
        </p>

        <p style="color: #6b7280; font-size: 14px; margin: 24px 0 0;">
          If you believe this is an error or wish to reactivate your account, please contact support.
        </p>
      </div>
    </div>
  </div>
</body>
</html>
        `.trim(),
      },
    ],
  },

  // ============================================
  // SUBSCRIPTION & BILLING TEMPLATES
  // ============================================
  {
    triggerId: 'subscription-created',
    name: 'Subscription Created',
    description: 'Notification when a new subscription is created',
    steps: [
      {
        type: 'email',
        subject: 'Your {{planName}} subscription is active!',
        content: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; margin: 0; padding: 0; background-color: #f4f4f5;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <div style="background: white; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05); overflow: hidden;">
      <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 32px; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 24px;">Subscription Activated! ✨</h1>
      </div>

      <div style="padding: 32px;">
        <p style="color: #374151; font-size: 16px; margin: 0 0 16px;">
          Hi {{firstName}},
        </p>

        <p style="color: #374151; font-size: 16px; margin: 0 0 24px;">
          Your subscription to the <strong>{{planName}}</strong> plan is now active.
        </p>

        <div style="background: #f9fafb; border-radius: 8px; padding: 20px; margin: 24px 0;">
          <h3 style="color: #374151; margin: 0 0 12px; font-size: 14px; font-weight: 600;">Subscription Details:</h3>
          <p style="color: #6b7280; font-size: 14px; margin: 4px 0;"><strong>Plan:</strong> {{planName}}</p>
          <p style="color: #6b7280; font-size: 14px; margin: 4px 0;"><strong>Price:</strong> {{price}} / {{billingCycle}}</p>
          <p style="color: #6b7280; font-size: 14px; margin: 4px 0;"><strong>Start Date:</strong> {{startDate}}</p>
          {{#if trialEndDate}}<p style="color: #6b7280; font-size: 14px; margin: 4px 0;"><strong>Trial Ends:</strong> {{trialEndDate}}</p>{{/if}}
        </div>

        <div style="text-align: center; margin: 32px 0;">
          <a href="{{dashboardUrl}}" style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600;">
            Go to Dashboard
          </a>
        </div>
      </div>
    </div>
  </div>
</body>
</html>
        `.trim(),
      },
      {
        type: 'in_app',
        content: '✨ Your {{planName}} subscription is now active!',
      },
    ],
  },

  {
    triggerId: 'subscription-upgraded',
    name: 'Subscription Upgraded',
    description: 'Notification when subscription is upgraded',
    steps: [
      {
        type: 'email',
        subject: 'Your subscription has been upgraded to {{newPlanName}}',
        content: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; margin: 0; padding: 0; background-color: #f4f4f5;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <div style="background: white; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05); overflow: hidden;">
      <div style="background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); padding: 32px; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 24px;">Upgrade Complete! 🚀</h1>
      </div>

      <div style="padding: 32px;">
        <p style="color: #374151; font-size: 16px; margin: 0 0 16px;">
          Hi {{firstName}},
        </p>

        <p style="color: #374151; font-size: 16px; margin: 0 0 24px;">
          Your subscription has been upgraded from <strong>{{previousPlanName}}</strong> to <strong>{{newPlanName}}</strong>.
        </p>

        <div style="background: #f5f3ff; border-radius: 8px; padding: 20px; margin: 24px 0;">
          <h3 style="color: #5b21b6; margin: 0 0 12px; font-size: 14px; font-weight: 600;">New Plan Benefits:</h3>
          {{#each features}}
          <p style="color: #6b7280; font-size: 14px; margin: 4px 0;">✓ {{this}}</p>
          {{/each}}
        </div>

        <p style="color: #374151; font-size: 14px; margin: 0 0 24px;">
          <strong>New Price:</strong> {{newPrice}} / {{billingCycle}}
        </p>
      </div>
    </div>
  </div>
</body>
</html>
        `.trim(),
      },
    ],
  },

  {
    triggerId: 'subscription-cancelled',
    name: 'Subscription Cancelled',
    description: 'Notification when subscription is cancelled',
    steps: [
      {
        type: 'email',
        subject: 'Your subscription has been cancelled',
        content: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; margin: 0; padding: 0; background-color: #f4f4f5;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <div style="background: white; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05); overflow: hidden;">
      <div style="background: linear-gradient(135deg, #6b7280 0%, #4b5563 100%); padding: 32px; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 24px;">Subscription Cancelled</h1>
      </div>

      <div style="padding: 32px;">
        <p style="color: #374151; font-size: 16px; margin: 0 0 16px;">
          Hi {{firstName}},
        </p>

        <p style="color: #374151; font-size: 16px; margin: 0 0 24px;">
          Your <strong>{{planName}}</strong> subscription has been cancelled.
        </p>

        <div style="background: #f9fafb; border-radius: 8px; padding: 20px; margin: 24px 0;">
          <p style="color: #6b7280; font-size: 14px; margin: 0;">
            <strong>Access Until:</strong> {{accessEndDate}}
          </p>
        </div>

        <p style="color: #374151; font-size: 16px; margin: 0 0 24px;">
          We're sorry to see you go. If you change your mind, you can reactivate your subscription at any time.
        </p>

        <div style="text-align: center; margin: 32px 0;">
          <a href="{{reactivateUrl}}" style="display: inline-block; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600;">
            Reactivate Subscription
          </a>
        </div>
      </div>
    </div>
  </div>
</body>
</html>
        `.trim(),
      },
    ],
  },

  {
    triggerId: 'payment-failed',
    name: 'Payment Failed',
    description: 'Notification when payment fails',
    steps: [
      {
        type: 'email',
        subject: 'Action Required: Payment Failed',
        content: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; margin: 0; padding: 0; background-color: #f4f4f5;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <div style="background: white; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05); overflow: hidden;">
      <div style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); padding: 32px; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 24px;">Payment Failed ⚠️</h1>
      </div>

      <div style="padding: 32px;">
        <p style="color: #374151; font-size: 16px; margin: 0 0 16px;">
          Hi {{firstName}},
        </p>

        <p style="color: #374151; font-size: 16px; margin: 0 0 24px;">
          We were unable to process your payment of <strong>{{amount}}</strong> for your <strong>{{planName}}</strong> subscription.
        </p>

        <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 16px; margin: 24px 0;">
          <p style="color: #991b1b; font-size: 14px; margin: 0;">
            <strong>Reason:</strong> {{failureReason}}
          </p>
        </div>

        <p style="color: #374151; font-size: 16px; margin: 0 0 24px;">
          Please update your payment method to avoid service interruption.
        </p>

        <div style="text-align: center; margin: 32px 0;">
          <a href="{{updatePaymentUrl}}" style="display: inline-block; background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600;">
            Update Payment Method
          </a>
        </div>

        <p style="color: #6b7280; font-size: 14px; margin: 24px 0 0; text-align: center;">
          We'll retry the payment in 3 days.
        </p>
      </div>
    </div>
  </div>
</body>
</html>
        `.trim(),
      },
      {
        type: 'in_app',
        content: '⚠️ Payment failed for {{amount}}. Please update your payment method.',
        cta: {
          type: 'redirect',
          data: { url: '{{updatePaymentUrl}}' },
        },
      },
    ],
  },

  {
    triggerId: 'payment-success',
    name: 'Payment Success',
    description: 'Payment receipt/confirmation',
    steps: [
      {
        type: 'email',
        subject: 'Payment Receipt - {{amount}}',
        content: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; margin: 0; padding: 0; background-color: #f4f4f5;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <div style="background: white; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05); overflow: hidden;">
      <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 32px; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 24px;">Payment Received ✓</h1>
      </div>

      <div style="padding: 32px;">
        <p style="color: #374151; font-size: 16px; margin: 0 0 24px;">
          Thank you for your payment!
        </p>

        <div style="background: #f9fafb; border-radius: 8px; padding: 20px; margin: 24px 0;">
          <h3 style="color: #374151; margin: 0 0 12px; font-size: 14px; font-weight: 600;">Payment Details:</h3>
          <p style="color: #6b7280; font-size: 14px; margin: 4px 0;"><strong>Amount:</strong> {{amount}}</p>
          <p style="color: #6b7280; font-size: 14px; margin: 4px 0;"><strong>Date:</strong> {{paymentDate}}</p>
          <p style="color: #6b7280; font-size: 14px; margin: 4px 0;"><strong>Invoice #:</strong> {{invoiceNumber}}</p>
          <p style="color: #6b7280; font-size: 14px; margin: 4px 0;"><strong>Plan:</strong> {{planName}}</p>
        </div>

        <div style="text-align: center; margin: 32px 0;">
          <a href="{{invoiceUrl}}" style="display: inline-block; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600;">
            View Invoice
          </a>
        </div>
      </div>
    </div>
  </div>
</body>
</html>
        `.trim(),
      },
    ],
  },

  {
    triggerId: 'trial-ending-soon',
    name: 'Trial Ending Soon',
    description: 'Reminder that trial period is ending',
    steps: [
      {
        type: 'email',
        subject: 'Your trial ends in {{daysRemaining}} days',
        content: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; margin: 0; padding: 0; background-color: #f4f4f5;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <div style="background: white; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05); overflow: hidden;">
      <div style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 32px; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 24px;">Trial Ending Soon ⏰</h1>
      </div>

      <div style="padding: 32px;">
        <p style="color: #374151; font-size: 16px; margin: 0 0 16px;">
          Hi {{firstName}},
        </p>

        <p style="color: #374151; font-size: 16px; margin: 0 0 24px;">
          Your free trial of <strong>{{planName}}</strong> will end in <strong>{{daysRemaining}} days</strong> ({{trialEndDate}}).
        </p>

        <p style="color: #374151; font-size: 16px; margin: 0 0 24px;">
          To continue enjoying all features without interruption, please add a payment method.
        </p>

        <div style="text-align: center; margin: 32px 0;">
          <a href="{{upgradeUrl}}" style="display: inline-block; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600;">
            Continue with {{planName}}
          </a>
        </div>
      </div>
    </div>
  </div>
</body>
</html>
        `.trim(),
      },
      {
        type: 'in_app',
        content: '⏰ Your trial ends in {{daysRemaining}} days. Add payment method to continue.',
        cta: {
          type: 'redirect',
          data: { url: '{{upgradeUrl}}' },
        },
      },
    ],
  },

  // ============================================
  // LEAD VALIDATION TEMPLATES
  // ============================================
  {
    triggerId: 'lead-validation',
    name: 'Lead Email Validation',
    description: 'Email verification for new lead registration',
    steps: [
      {
        type: 'email',
        subject: 'Verify your email for {{companyName}}',
        content: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; margin: 0; padding: 0; background-color: #f4f4f5;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <div style="background: white; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05); overflow: hidden;">
      <div style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); padding: 32px; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 24px;">Verify Your Email ✉️</h1>
      </div>

      <div style="padding: 32px;">
        <p style="color: #374151; font-size: 16px; margin: 0 0 16px;">
          Hi {{firstName}},
        </p>

        <p style="color: #374151; font-size: 16px; margin: 0 0 24px;">
          Thank you for registering <strong>{{companyName}}</strong> on Ananta Platform. Please verify your email address to continue.
        </p>

        <div style="text-align: center; margin: 32px 0;">
          <a href="{{validationUrl}}" style="display: inline-block; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600;">
            Verify Email Address
          </a>
        </div>

        <p style="color: #6b7280; font-size: 14px; margin: 24px 0 0; text-align: center;">
          This link expires in 24 hours.
        </p>
      </div>
    </div>
  </div>
</body>
</html>
        `.trim(),
      },
    ],
  },
];

/**
 * Create a Novu workflow/template
 */
async function createWorkflow(db, template, groupId) {
  const workflowId = new ObjectId();

  // Build steps array
  const steps = template.steps.map((step, index) => {
    const stepId = new ObjectId();
    const stepConfig = {
      _templateId: workflowId,
      active: true,
      shouldStopOnFail: false,
      template: {
        type: step.type,
        content: step.content,
        _feedId: null,
        _layoutId: null,
      },
      _parentId: index === 0 ? null : steps[index - 1]?._id,
      filters: [],
      _id: stepId,
      uuid: stepId.toString(),
    };

    // Add email-specific fields
    if (step.type === 'email') {
      stepConfig.template.subject = step.subject;
      stepConfig.template.contentType = 'customHtml';
    }

    // Add CTA for in_app notifications
    if (step.cta) {
      stepConfig.template.cta = step.cta;
    }

    return stepConfig;
  });

  const workflow = {
    _id: workflowId,
    name: template.name,
    description: template.description,
    active: true,
    draft: false,
    preferenceSettings: {
      email: true,
      sms: false,
      in_app: true,
      chat: false,
      push: false,
    },
    critical: false,
    triggers: [{
      type: 'event',
      identifier: template.triggerId,
      variables: [],
    }],
    steps: steps,
    tags: [],
    _notificationGroupId: groupId,
    _environmentId: ENV_ID,
    _organizationId: ORG_ID,
    _creatorId: USER_ID,
    deleted: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  // Check if workflow already exists
  const existing = await db.collection('notificationtemplates').findOne({
    'triggers.identifier': template.triggerId,
    _environmentId: ENV_ID,
    deleted: false,
  });

  if (existing) {
    console.log(`   ⚠️  Workflow "${template.triggerId}" already exists, updating...`);
    await db.collection('notificationtemplates').updateOne(
      { _id: existing._id },
      { $set: { ...workflow, _id: existing._id, createdAt: existing.createdAt } }
    );
    return existing._id;
  }

  await db.collection('notificationtemplates').insertOne(workflow);
  return workflowId;
}

async function bootstrap() {
  const client = new MongoClient(MONGO_URL);

  try {
    await client.connect();
    console.log('✅ Connected to MongoDB\n');

    const db = client.db(DB_NAME);

    // Get or create notification group
    let group = await db.collection('notificationgroups').findOne({
      name: 'General',
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
      console.log('✅ Created notification group\n');
    }

    console.log('📧 Creating email templates...\n');

    for (const template of EMAIL_TEMPLATES) {
      try {
        await createWorkflow(db, template, group._id);
        console.log(`   ✓ ${template.name} (${template.triggerId})`);
      } catch (error) {
        console.error(`   ✗ ${template.name}: ${error.message}`);
      }
    }

    console.log('\n🎉 Novu templates bootstrap complete!');
    console.log(`\nCreated ${EMAIL_TEMPLATES.length} notification templates.`);
    console.log('\nTemplate IDs for reference:');
    EMAIL_TEMPLATES.forEach(t => {
      console.log(`   - ${t.triggerId}`);
    });

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await client.close();
  }
}

bootstrap();
