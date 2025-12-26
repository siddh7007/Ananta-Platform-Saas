// Script to create validate-lead notification template in Novu MongoDB
// Run with: docker exec arc-saas-novu-mongo mongosh novu-db < create-validate-lead-template.js

const template = {
  _environmentId: ObjectId('6931905380e6f7e26e0ddaad'),
  _organizationId: ObjectId('6931905380e6f7e26e0ddaa7'),
  _creatorId: ObjectId('6931905380e6f7e26e0ddaa4'),
  name: 'Lead Email Verification',
  description: 'Email verification for new lead registrations',
  active: true,
  draft: false,
  critical: false,
  preferenceSettings: {
    email: true,
    sms: false,
    in_app: false,
    chat: false,
    push: false
  },
  tags: ['lead', 'verification', 'email'],
  triggers: [
    {
      type: 'event',
      identifier: 'validate-lead',
      variables: [
        {
          name: 'firstName',
          type: 'String',
          required: true,
          _id: new ObjectId()
        },
        {
          name: 'companyName',
          type: 'String',
          required: true,
          _id: new ObjectId()
        },
        {
          name: 'email',
          type: 'String',
          required: true,
          _id: new ObjectId()
        },
        {
          name: 'validationUrl',
          type: 'String',
          required: true,
          _id: new ObjectId()
        }
      ],
      reservedVariables: [],
      subscriberVariables: [
        { name: 'email', _id: new ObjectId() }
      ],
      _id: new ObjectId()
    }
  ],
  steps: [
    {
      _id: new ObjectId(),
      _templateId: new ObjectId(),
      active: true,
      shouldStopOnFail: false,
      template: {
        _id: new ObjectId(),
        type: 'email',
        active: true,
        subject: 'Verify Your Email - {{companyName}}',
        name: 'Email Verification',
        content: `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            margin: 0;
            padding: 0;
            background-color: #f4f4f5;
        }
        .container {
            max-width: 600px;
            margin: 40px auto;
            background: white;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        .header {
            background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
            color: white;
            padding: 40px 20px;
            text-align: center;
        }
        .header h1 {
            margin: 0;
            font-size: 28px;
            font-weight: 600;
        }
        .content {
            padding: 40px 30px;
            background: white;
        }
        .content p {
            margin: 0 0 16px 0;
            font-size: 16px;
            color: #374151;
        }
        .button-container {
            text-align: center;
            margin: 35px 0;
        }
        .button {
            display: inline-block;
            background: #2563eb;
            color: white !important;
            padding: 14px 40px;
            text-decoration: none;
            border-radius: 6px;
            font-weight: 600;
            font-size: 16px;
            transition: background 0.2s;
        }
        .button:hover {
            background: #1d4ed8;
        }
        .link-text {
            margin-top: 25px;
            padding: 20px;
            background: #f9fafb;
            border-radius: 6px;
            border-left: 4px solid #2563eb;
        }
        .link-text p {
            color: #6b7280;
            font-size: 14px;
            margin: 0 0 8px 0;
        }
        .link-text code {
            display: block;
            font-family: 'Courier New', monospace;
            font-size: 12px;
            color: #1f2937;
            word-break: break-all;
            padding: 8px;
            background: white;
            border-radius: 4px;
            margin-top: 8px;
        }
        .expiry-notice {
            margin-top: 25px;
            padding: 15px;
            background: #fef3c7;
            border-left: 4px solid #f59e0b;
            border-radius: 4px;
        }
        .expiry-notice p {
            color: #92400e;
            font-size: 14px;
            margin: 0;
        }
        .footer {
            text-align: center;
            padding: 30px 20px;
            color: #6b7280;
            font-size: 13px;
            background: #f9fafb;
            border-top: 1px solid #e5e7eb;
        }
        .footer p {
            margin: 5px 0;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚀 Welcome to Ananta Platform!</h1>
        </div>
        <div class="content">
            <p>Hi <strong>{{firstName}}</strong>,</p>
            <p>Thank you for registering <strong>{{companyName}}</strong> with Ananta Platform!</p>
            <p>To complete your registration and start setting up your account, please verify your email address by clicking the button below:</p>

            <div class="button-container">
                <a href="{{validationUrl}}" class="button">Verify Email Address</a>
            </div>

            <div class="link-text">
                <p><strong>Can't click the button?</strong> Copy and paste this link into your browser:</p>
                <code>{{validationUrl}}</code>
            </div>

            <div class="expiry-notice">
                <p>⏱️ This verification link will expire in <strong>24 hours</strong> for security reasons.</p>
            </div>

            <p style="margin-top: 30px;">If you didn't request this verification, you can safely ignore this email.</p>
        </div>
        <div class="footer">
            <p>&copy; 2024 Ananta Platform. All rights reserved.</p>
            <p>Questions? Contact us at support@ananta-platform.com</p>
        </div>
    </div>
</body>
</html>`,
        contentType: 'customHtml',
        variables: [],
        _creatorId: ObjectId('6931905380e6f7e26e0ddaa4'),
        _environmentId: ObjectId('6931905380e6f7e26e0ddaad'),
        _organizationId: ObjectId('6931905380e6f7e26e0ddaa7'),
        _feedId: null,
        _layoutId: null,
        preheader: 'Verify your email to get started',
        senderName: 'Ananta Platform'
      },
      filters: [],
      _parentId: null,
      metadata: {
        amount: 1,
        unit: 'seconds',
        type: 'regular'
      },
      replyCallback: null,
      uuid: new ObjectId().toString()
    }
  ],
  notificationGroupId: ObjectId('6931905380e6f7e26e0ddaa8'),
  _notificationGroupId: ObjectId('6931905380e6f7e26e0ddaa8'),
  deleted: false,
  createdAt: new Date(),
  updatedAt: new Date(),
  __v: 0
};

// Insert the template
const result = db.notificationtemplates.insertOne(template);

print('Validate-lead template created successfully!');
print('Template ID:', result.insertedId);
print('Identifier: validate-lead');
print('');
print('You can now send verification emails from your backend using:');
print('  NotificationType.ValidateLead or trigger identifier: "validate-lead"');
