/**
 * Configure Novu Email Provider
 *
 * This script configures an email provider integration in Novu.
 * Run after bootstrap-novu.js
 *
 * Usage:
 *   node scripts/configure-novu-email.js
 */

const https = require('https');
const http = require('http');

// Configuration - Update these with your values
const CONFIG = {
  // Novu API endpoint
  novuApiUrl: process.env.NOVU_BACKEND_URL || 'http://localhost:13100',

  // Get this from Novu dashboard or bootstrap-novu.js output
  novuApiKey: process.env.NOVU_API_KEY || '',

  // Email Provider Selection (uncomment the one you want to use)
  // Options: 'sendgrid', 'ses', 'nodemailer', 'mailgun', 'postmark', 'resend'
  emailProvider: 'nodemailer',

  // Provider Credentials - Fill in based on your provider
  credentials: {
    // SendGrid
    sendgrid: {
      apiKey: 'SG.your-sendgrid-api-key',
      from: 'noreply@yourdomain.com',
      senderName: 'Ananta Platform',
    },

    // AWS SES
    ses: {
      accessKeyId: 'your-aws-access-key',
      secretAccessKey: 'your-aws-secret-key',
      region: 'us-east-1',
      from: 'verified@yourdomain.com',
      senderName: 'Ananta Platform',
    },

    // NodeMailer (SMTP) - Good for Gmail, Outlook, etc.
    nodemailer: {
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE !== 'false', // true for 465, false for 587
      user: process.env.SMTP_USER || 'your-email@gmail.com',
      password: process.env.SMTP_PASSWORD || 'your-app-password',
      from: process.env.SMTP_FROM || 'your-email@gmail.com',
      senderName: process.env.SMTP_SENDER_NAME || 'Ananta Platform',
    },

    // Mailgun
    mailgun: {
      apiKey: 'your-mailgun-api-key',
      domain: 'yourdomain.com',
      username: 'postmaster@yourdomain.com',
      from: 'noreply@yourdomain.com',
      senderName: 'Ananta Platform',
    },

    // Postmark
    postmark: {
      apiKey: 'your-postmark-server-token',
      from: 'noreply@yourdomain.com',
      senderName: 'Ananta Platform',
    },

    // Resend
    resend: {
      apiKey: 're_your-resend-api-key',
      from: 'noreply@yourdomain.com',
      senderName: 'Ananta Platform',
    },
  },
};

/**
 * Provider configurations mapping
 */
const PROVIDER_CONFIG = {
  sendgrid: {
    providerId: 'sendgrid',
    channel: 'email',
    credentials: (creds) => ({
      apiKey: creds.apiKey,
      from: creds.from,
      senderName: creds.senderName,
    }),
  },

  ses: {
    providerId: 'ses',
    channel: 'email',
    credentials: (creds) => ({
      accessKeyId: creds.accessKeyId,
      secretAccessKey: creds.secretAccessKey,
      region: creds.region,
      from: creds.from,
      senderName: creds.senderName,
    }),
  },

  nodemailer: {
    providerId: 'nodemailer',
    channel: 'email',
    credentials: (creds) => ({
      host: creds.host,
      port: creds.port,
      secure: creds.secure,
      user: creds.user,
      password: creds.password,
      from: creds.from,
      senderName: creds.senderName,
    }),
  },

  mailgun: {
    providerId: 'mailgun',
    channel: 'email',
    credentials: (creds) => ({
      apiKey: creds.apiKey,
      domain: creds.domain,
      username: creds.username,
      from: creds.from,
      senderName: creds.senderName,
    }),
  },

  postmark: {
    providerId: 'postmark',
    channel: 'email',
    credentials: (creds) => ({
      apiKey: creds.apiKey,
      from: creds.from,
      senderName: creds.senderName,
    }),
  },

  resend: {
    providerId: 'resend',
    channel: 'email',
    credentials: (creds) => ({
      apiKey: creds.apiKey,
      from: creds.from,
      senderName: creds.senderName,
    }),
  },
};

/**
 * Make HTTP request to Novu API
 */
function makeRequest(path, method, data) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, CONFIG.novuApiUrl);
    const isHttps = url.protocol === 'https:';
    const client = isHttps ? https : http;

    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `ApiKey ${CONFIG.novuApiKey}`,
      },
    };

    const req = client.request(options, (res) => {
      let body = '';

      res.on('data', (chunk) => {
        body += chunk;
      });

      res.on('end', () => {
        try {
          const parsed = body ? JSON.parse(body) : {};
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(parsed);
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${body}`));
          }
        } catch (err) {
          reject(err);
        }
      });
    });

    req.on('error', reject);

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

/**
 * Configure email provider integration
 */
async function configureEmailProvider() {
  console.log('[INFO] Configuring Novu email provider...');

  if (!CONFIG.novuApiKey) {
    console.error('[ERROR] NOVU_API_KEY is not set');
    console.log('       Set it in .env or pass as environment variable');
    console.log('       Get it from Novu dashboard Settings > API Keys');
    process.exit(1);
  }

  const provider = CONFIG.emailProvider;
  const providerConfig = PROVIDER_CONFIG[provider];

  if (!providerConfig) {
    console.error(`[ERROR] Unknown provider: ${provider}`);
    console.log('       Supported providers:', Object.keys(PROVIDER_CONFIG).join(', '));
    process.exit(1);
  }

  const providerCreds = CONFIG.credentials[provider];
  const credentials = providerConfig.credentials(providerCreds);

  try {
    // Create integration
    const integration = await makeRequest('/v1/integrations', 'POST', {
      providerId: providerConfig.providerId,
      channel: providerConfig.channel,
      credentials: credentials,
      active: true,
      check: false, // Set to true to test credentials
    });

    console.log('[OK] Email provider configured successfully');
    console.log('     Provider:', provider);
    console.log('     Integration ID:', integration.data?._id);
    console.log('     From Email:', credentials.from);
    console.log('     Sender Name:', credentials.senderName);
    console.log('');
    console.log('[NEXT] Test sending an email using your Novu workflows');
    console.log('       Dashboard: http://localhost:14200');

  } catch (error) {
    console.error('[ERROR] Failed to configure email provider');
    console.error('       ', error.message);

    if (error.message.includes('Duplicate')) {
      console.log('');
      console.log('[INFO] Integration may already exist');
      console.log('      Check Novu dashboard: http://localhost:14200/integrations');
    }

    process.exit(1);
  }
}

/**
 * Test email provider by listing existing integrations
 */
async function listIntegrations() {
  console.log('[INFO] Listing existing integrations...');

  try {
    const response = await makeRequest('/v1/integrations', 'GET');
    const integrations = response.data || [];

    console.log(`[OK] Found ${integrations.length} integration(s)`);

    integrations.forEach((integration) => {
      console.log(`     - ${integration.providerId} (${integration.channel})`);
      console.log(`       Active: ${integration.active}`);
      console.log(`       ID: ${integration._id}`);
    });

    console.log('');

  } catch (error) {
    console.error('[ERROR] Failed to list integrations');
    console.error('       ', error.message);
  }
}

// Main execution
async function main() {
  console.log('='.repeat(70));
  console.log('Novu Email Provider Configuration');
  console.log('='.repeat(70));
  console.log('');

  // List existing integrations first
  await listIntegrations();

  // Configure new provider
  await configureEmailProvider();
}

main().catch((error) => {
  console.error('[ERROR] Unexpected error:', error);
  process.exit(1);
});
