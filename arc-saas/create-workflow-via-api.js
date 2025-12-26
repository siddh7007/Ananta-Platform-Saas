const { Novu } = require('@novu/node');

const NOVU_API_KEY = process.env.NOVU_API_KEY;
const NOVU_BACKEND_URL = process.env.NOVU_BACKEND_URL || 'http://localhost:13100';

if (!NOVU_API_KEY) {
  console.error('[ERROR] NOVU_API_KEY environment variable is required');
  console.error('Usage: NOVU_API_KEY=your-key node create-workflow-via-api.js');
  process.exit(1);
}

const novu = new Novu(NOVU_API_KEY, {
  backendUrl: NOVU_BACKEND_URL,
});

async function createWorkflow() {
  try {
    console.log('Creating tenant-welcome workflow...');

    const workflow = await novu.notificationTemplates.create({
      name: 'tenant-welcome',
      notificationGroupId: '6931905380e6f7e26e0ddab1',
      tags: ['tenant', 'welcome'],
      description: 'Welcome notification for new tenants',
      steps: [
        {
          active: true,
          shouldStopOnFail: false,
          template: {
            type: 'in_app',
            content: 'Welcome to {{tenantName}}! Your tenant has been successfully provisioned.',
            cta: {
              type: 'redirect',
              data: {
                url: '{{appPlaneUrl}}'
              },
              action: {
                buttons: [
                  {
                    type: 'primary',
                    content: 'Go to Dashboard'
                  }
                ]
              }
            }
          }
        }
      ],
      active: true,
      draft: false
    });

    console.log('✅ Workflow created:', workflow.data);
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error('Response:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

createWorkflow();
