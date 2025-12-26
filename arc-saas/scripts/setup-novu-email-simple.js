/**
 * Simple Novu Email Configuration (API-based)
 * Bypasses dashboard compatibility issues
 *
 * Usage:
 *   1. Set environment variables (see below)
 *   2. Run: node scripts/setup-novu-email-simple.js
 */

const { MongoClient, ObjectId } = require('mongodb');

// Configuration
const MONGO_URL = process.env.NOVU_MONGO_URL || 'mongodb://localhost:27017';
const DB_NAME = 'novu-db';  // Must match docker-compose MONGO_URL

// Email provider configuration from environment
const EMAIL_CONFIG = {
  provider: process.env.EMAIL_PROVIDER || 'nodemailer', // nodemailer, sendgrid, ses

  // SMTP (NodeMailer) - for Gmail, Outlook, etc.
  smtp: {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true', // true for 465, false for 587
    user: process.env.SMTP_USER || '',
    password: process.env.SMTP_PASSWORD || '',
    from: process.env.SMTP_FROM || '',
    senderName: process.env.SMTP_SENDER_NAME || 'Ananta Platform',
  },

  // SendGrid
  sendgrid: {
    apiKey: process.env.SENDGRID_API_KEY || '',
    from: process.env.SENDGRID_FROM || '',
    senderName: process.env.SENDGRID_SENDER_NAME || 'Ananta Platform',
  },

  // AWS SES
  ses: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
    region: process.env.AWS_REGION || 'us-east-1',
    from: process.env.SES_FROM || '',
    senderName: process.env.SES_SENDER_NAME || 'Ananta Platform',
  },
};

async function setupEmailProvider() {
  console.log('='.repeat(70));
  console.log('Novu Email Provider Setup (Direct MongoDB)');
  console.log('='.repeat(70));
  console.log('');

  const client = new MongoClient(MONGO_URL);

  try {
    await client.connect();
    console.log('[OK] Connected to MongoDB');

    const db = client.db(DB_NAME);

    // Get the environment ID
    const env = await db.collection('environments').findOne({});
    if (!env) {
      console.error('[ERROR] No Novu environment found. Run bootstrap-novu.js first');
      process.exit(1);
    }

    const envId = env._id;
    const orgId = env._organizationId;
    console.log(`[OK] Found environment: ${env.name} (${envId})`);

    // Prepare integration credentials based on provider
    let credentials = {};
    let providerId = '';

    switch (EMAIL_CONFIG.provider) {
      case 'nodemailer':
        providerId = 'nodemailer';
        credentials = {
          from: EMAIL_CONFIG.smtp.from,
          senderName: EMAIL_CONFIG.smtp.senderName,
          host: EMAIL_CONFIG.smtp.host,
          port: EMAIL_CONFIG.smtp.port,
          secure: EMAIL_CONFIG.smtp.secure,
          user: EMAIL_CONFIG.smtp.user,
          password: EMAIL_CONFIG.smtp.password,
        };

        if (!credentials.user || !credentials.password || !credentials.from) {
          console.error('[ERROR] SMTP credentials incomplete');
          console.log('       Required: SMTP_USER, SMTP_PASSWORD, SMTP_FROM');
          process.exit(1);
        }
        break;

      case 'sendgrid':
        providerId = 'sendgrid';
        credentials = {
          apiKey: EMAIL_CONFIG.sendgrid.apiKey,
          from: EMAIL_CONFIG.sendgrid.from,
          senderName: EMAIL_CONFIG.sendgrid.senderName,
        };

        if (!credentials.apiKey || !credentials.from) {
          console.error('[ERROR] SendGrid credentials incomplete');
          console.log('       Required: SENDGRID_API_KEY, SENDGRID_FROM');
          process.exit(1);
        }
        break;

      case 'ses':
        providerId = 'ses';
        credentials = {
          accessKeyId: EMAIL_CONFIG.ses.accessKeyId,
          secretAccessKey: EMAIL_CONFIG.ses.secretAccessKey,
          region: EMAIL_CONFIG.ses.region,
          from: EMAIL_CONFIG.ses.from,
          senderName: EMAIL_CONFIG.ses.senderName,
        };

        if (!credentials.accessKeyId || !credentials.secretAccessKey || !credentials.from) {
          console.error('[ERROR] AWS SES credentials incomplete');
          console.log('       Required: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, SES_FROM');
          process.exit(1);
        }
        break;

      default:
        console.error(`[ERROR] Unknown provider: ${EMAIL_CONFIG.provider}`);
        console.log('       Supported: nodemailer, sendgrid, ses');
        process.exit(1);
    }

    // Check if integration already exists
    const existing = await db.collection('integrations').findOne({
      _environmentId: envId,
      providerId: providerId,
      channel: 'email',
    });

    if (existing) {
      console.log(`[INFO] Updating existing ${providerId} integration`);

      await db.collection('integrations').updateOne(
        { _id: existing._id },
        {
          $set: {
            credentials: credentials,
            active: true,
            updatedAt: new Date(),
          },
        }
      );

      console.log('[OK] Email integration updated');
    } else {
      console.log(`[INFO] Creating new ${providerId} integration`);

      await db.collection('integrations').insertOne({
        _environmentId: envId,
        _organizationId: orgId,
        providerId: providerId,
        channel: 'email',
        credentials: credentials,
        active: true,
        primary: true,
        priority: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      console.log('[OK] Email integration created');
    }

    console.log('');
    console.log('='.repeat(70));
    console.log('Email Provider Configuration Complete');
    console.log('='.repeat(70));
    console.log('');
    console.log('Provider:', providerId);
    console.log('From Email:', credentials.from);
    console.log('Sender Name:', credentials.senderName);

    if (providerId === 'nodemailer') {
      console.log('SMTP Host:', credentials.host);
      console.log('SMTP Port:', credentials.port);
    }

    console.log('');
    console.log('[NEXT STEPS]');
    console.log('1. Verify integration in Novu dashboard: http://localhost:14200/integrations');
    console.log('2. Create email templates via API (run bootstrap-novu-templates.js)');
    console.log('3. Test email sending');
    console.log('');

  } catch (error) {
    console.error('[ERROR] Setup failed:', error.message);
    process.exit(1);
  } finally {
    await client.close();
  }
}

// Run setup
setupEmailProvider();
