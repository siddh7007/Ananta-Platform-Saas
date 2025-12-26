// Bootstrap Novu with organization, environment, and workflow
const { MongoClient, ObjectId } = require('mongodb');
const bcrypt = require('bcryptjs');

const MONGO_URL = 'mongodb://localhost:27017';
const DB_NAME = 'novu-db';  // Must match docker-compose MONGO_URL

async function bootstrap() {
  const client = new MongoClient(MONGO_URL);

  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');

    const db = client.db(DB_NAME);

    // Generate IDs
    const orgId = new ObjectId('6931905380e6f7e26e0ddaa7');
    const envId = new ObjectId('6931905380e6f7e26e0ddaad');
    const userId = new ObjectId('6931905380e6f7e26e0ddaa4');
    const apiKey = '5ca03001f68a03bb43078f230365faf5';

    // Create user
    const hashedPassword = await bcrypt.hash('admin123', 10);
    await db.collection('users').insertOne({
      _id: userId,
      firstName: 'arc',
      lastName: 'admin',
      email: 'admin@example.com',
      password: hashedPassword,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    console.log('✅ Created user');

    // Create organization
    await db.collection('organizations').insertOne({
      _id: orgId,
      name: 'Arc SaaS',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    console.log('✅ Created organization');

    // Create member
    await db.collection('members').insertOne({
      _userId: userId,
      _organizationId: orgId,
      roles: ['admin'],
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    console.log('✅ Created organization member');

    // Create environment
    await db.collection('environments').insertOne({
      _id: envId,
      name: 'Development',
      _organizationId: orgId,
      identifier: envId.toString(),
      apiKeys: [{
        key: apiKey,
        _userId: userId,
      }],
      widget: {
        notificationCenterEncryption: false,
      },
      dns: {
        mxRecordConfigured: false,
        inboundParseDomain: '',
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    console.log('✅ Created environment');
    console.log(`   App Identifier: ${envId.toString()}`);
    console.log(`   API Key: ${apiKey}`);

    // Create notification group
    const groupId = new ObjectId();
    await db.collection('notificationgroups').insertOne({
      _id: groupId,
      name: 'General',
      _environmentId: envId,
      _organizationId: orgId,
      _parentId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    console.log('✅ Created notification group');

    // Create tenant-welcome workflow
    const workflowId = new ObjectId();
    const triggerId = 'tenant-welcome';

    await db.collection('notificationtemplates').insertOne({
      _id: workflowId,
      name: 'Tenant Welcome',
      description: 'Welcome notification when tenant is provisioned',
      active: true,
      draft: false,
      // Novu v3 required fields
      type: 'REGULAR',           // REGULAR for dashboard-editable workflows
      origin: 'novu-cloud',      // Required for v3 compatibility
      isBlueprint: false,
      payloadSchema: { type: 'object', additionalProperties: true, properties: {} },
      validatePayload: true,
      isTranslationEnabled: false,
      severity: 'none',
      preferenceSettings: {
        email: true,
        sms: true,
        in_app: true,
        chat: true,
        push: true,
      },
      critical: false,
      triggers: [{
        type: 'event',
        identifier: triggerId,
        variables: [],
        reservedVariables: [],
        subscriberVariables: [],
      }],
      steps: [{
        _templateId: workflowId,
        active: true,
        shouldStopOnFail: false,
        type: 'REGULAR',  // Step type must also be REGULAR
        replyCallback: {},
        metadata: { timed: { weekDays: [], monthDays: [] } },
        template: {
          type: 'in_app',
          active: true,
          variables: [],
          content: 'Welcome to {{tenantName}}!\n\nYour tenant has been successfully provisioned.\n\nAdmin: {{firstName}} {{lastName}}\nEmail: {{email}}',
          cta: {
            type: 'redirect',
            data: {
              url: '{{appPlaneUrl}}',
            },
            action: {
              buttons: [{
                type: 'primary',
                content: 'Go to Dashboard',
              }],
            },
          },
          _feedId: null,
          _layoutId: null,
          _environmentId: envId,
          _organizationId: orgId,
          _creatorId: userId,
          deleted: false,
        },
        _parentId: null,
        filters: [],
        variants: [],
        _id: new ObjectId(),
        uuid: new ObjectId().toString(),
      }],
      tags: [],
      _notificationGroupId: groupId,
      _environmentId: envId,
      _organizationId: orgId,
      _creatorId: userId,
      deleted: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    console.log('✅ Created tenant-welcome workflow');
    console.log(`   Trigger ID: ${triggerId}`);

    console.log('\n🎉 Novu bootstrap complete!');
    console.log('\nConfiguration for .env files:');
    console.log(`\nservices/temporal-worker-service/.env:`);
    console.log(`NOVU_API_KEY=${apiKey}`);
    console.log(`\napps/admin-app/.env:`);
    console.log(`VITE_NOVU_APP_IDENTIFIER=${envId.toString()}`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.close();
  }
}

bootstrap();
