// Send test notification using Novu SDK
const { Novu } = require('@novu/node');

const NOVU_API_KEY = process.env.NOVU_API_KEY;
const NOVU_BACKEND_URL = process.env.NOVU_BACKEND_URL || 'http://localhost:13100';

if (!NOVU_API_KEY) {
  console.error('[ERROR] NOVU_API_KEY environment variable is required');
  console.error('Usage: NOVU_API_KEY=your-key node send-test-notification.js');
  process.exit(1);
}

const novu = new Novu(NOVU_API_KEY, {
  backendUrl: NOVU_BACKEND_URL,
});

async function sendNotification() {
  try {
    console.log('Creating/updating subscriber...');
    const subscriber = await novu.subscribers.identify('admin', {
      email: 'admin@arc-saas.local',
      firstName: 'Admin',
      lastName: 'User',
    });
    console.log('✅ Subscriber:', subscriber.data);

    console.log('\nTriggering notification...');
    const result = await novu.trigger('tenant-welcome', {
      to: {
        subscriberId: 'admin',
      },
      payload: {
        tenantId: 'dd000000-0000-0000-0000-000000000001',
        tenantName: 'Test Corporation',
        firstName: 'Admin',
        lastName: 'User',
        email: 'admin@arc-saas.local',
        appPlaneUrl: 'http://localhost:5173',
        adminPortalUrl: 'http://localhost:5000',
      },
    });
    console.log('✅ Notification triggered:', result.data);

    // Wait a bit for processing
    await new Promise(resolve => setTimeout(resolve, 3000));

    console.log('\nFetching notifications for subscriber...');
    const notifications = await novu.subscribers.getNotificationsFeed('admin');
    console.log('✅ Notifications:', JSON.stringify(notifications.data, null, 2));

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
  }
}

sendNotification();
