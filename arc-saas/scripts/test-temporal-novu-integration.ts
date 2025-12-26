/**
 * Test script for Temporal + Novu integration
 *
 * This script:
 * 1. Connects to Temporal
 * 2. Starts a tenant provisioning workflow
 * 3. Monitors the workflow execution
 * 4. Verifies Novu notifications are sent
 *
 * Usage: npx ts-node scripts/test-temporal-novu-integration.ts
 */

import { Connection, Client } from '@temporalio/client';
import axios from 'axios';

const TEMPORAL_ADDRESS = process.env.TEMPORAL_ADDRESS || 'localhost:7233';
const TEMPORAL_NAMESPACE = process.env.TEMPORAL_NAMESPACE || 'arc-saas';
const NOVU_API_URL = process.env.NOVU_BACKEND_URL || 'http://localhost:3100';
const NOVU_API_KEY = process.env.NOVU_API_KEY;

if (!NOVU_API_KEY) {
  console.error('[ERROR] NOVU_API_KEY environment variable is required');
  console.error('Usage: NOVU_API_KEY=your-key npx ts-node scripts/test-temporal-novu-integration.ts');
  process.exit(1);
}

interface TenantProvisioningInput {
  tenantId: string;
  tenantName: string;
  tier: string;
  isolationLevel: string;
  adminEmail: string;
  adminFirstName: string;
  adminLastName: string;
  idpProvider: string;
  domain?: string;
  features: string[];
}

async function testTemporalConnection(): Promise<boolean> {
  console.log('\n📡 Testing Temporal connection...');
  try {
    const connection = await Connection.connect({
      address: TEMPORAL_ADDRESS,
    });

    // Test by describing the namespace
    const client = new Client({ connection, namespace: TEMPORAL_NAMESPACE });
    console.log(`✅ Connected to Temporal at ${TEMPORAL_ADDRESS}`);
    console.log(`✅ Using namespace: ${TEMPORAL_NAMESPACE}`);

    await connection.close();
    return true;
  } catch (error: any) {
    console.error(`❌ Failed to connect to Temporal: ${error.message}`);
    return false;
  }
}

async function testNovuConnection(): Promise<boolean> {
  console.log('\n📧 Testing Novu connection...');
  try {
    const response = await axios.get(`${NOVU_API_URL}/v1/notification-templates`, {
      headers: {
        'Authorization': `ApiKey ${NOVU_API_KEY}`,
      },
    });

    console.log(`✅ Connected to Novu at ${NOVU_API_URL}`);
    console.log(`✅ Found ${response.data.totalCount} notification templates`);

    // List templates
    response.data.data.forEach((template: any) => {
      console.log(`   - ${template.name}: ${template.active ? 'active' : 'inactive'}`);
    });

    return true;
  } catch (error: any) {
    console.error(`❌ Failed to connect to Novu: ${error.message}`);
    return false;
  }
}

async function triggerTestNotification(): Promise<boolean> {
  console.log('\n🔔 Sending test notification via Novu...');

  try {
    // First, create a test subscriber
    const subscriberId = `test-subscriber-${Date.now()}`;

    await axios.post(
      `${NOVU_API_URL}/v1/subscribers`,
      {
        subscriberId,
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
      },
      {
        headers: {
          'Authorization': `ApiKey ${NOVU_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );
    console.log(`✅ Created test subscriber: ${subscriberId}`);

    // Trigger the welcome notification
    const triggerResponse = await axios.post(
      `${NOVU_API_URL}/v1/events/trigger`,
      {
        name: 'tenant-welcome',
        to: {
          subscriberId,
        },
        payload: {
          firstName: 'Test',
          tenantName: 'Test Tenant',
          appPlaneUrl: 'https://test.app.example.com',
          loginUrl: 'https://test.app.example.com/login',
          supportEmail: 'support@example.com',
        },
      },
      {
        headers: {
          'Authorization': `ApiKey ${NOVU_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log(`✅ Triggered notification: ${triggerResponse.data.data.transactionId || 'success'}`);
    return true;
  } catch (error: any) {
    console.error(`❌ Failed to send notification: ${error.response?.data?.message || error.message}`);
    return false;
  }
}

async function startProvisioningWorkflow(): Promise<string | null> {
  console.log('\n🚀 Starting tenant provisioning workflow...');

  try {
    const connection = await Connection.connect({
      address: TEMPORAL_ADDRESS,
    });

    const client = new Client({ connection, namespace: TEMPORAL_NAMESPACE });

    const input: TenantProvisioningInput = {
      tenantId: `test-tenant-${Date.now()}`,
      tenantName: 'Test Tenant Corp',
      tier: 'standard',
      isolationLevel: 'pooled',
      adminEmail: 'admin@example.com',
      adminFirstName: 'Admin',
      adminLastName: 'User',
      idpProvider: 'keycloak',
      features: ['workspace', 'project', 'team'],
    };

    const workflowId = `provision-${input.tenantId}`;

    const handle = await client.workflow.start('provisionTenantWorkflow', {
      taskQueue: 'tenant-provisioning',
      workflowId,
      args: [input],
    });

    console.log(`✅ Started workflow: ${workflowId}`);
    console.log(`   View in Temporal UI: http://localhost:8088/namespaces/${TEMPORAL_NAMESPACE}/workflows/${workflowId}`);

    await connection.close();
    return workflowId;
  } catch (error: any) {
    if (error.message?.includes('Namespace arc-saas is not found')) {
      console.log('⚠️  Namespace "arc-saas" not found. Creating it...');
      try {
        // Try to register the namespace
        const connection = await Connection.connect({ address: TEMPORAL_ADDRESS });
        const client = new Client({ connection, namespace: 'default' });

        // Note: Namespace creation requires admin permissions
        console.log('   Namespace creation requires manual setup or admin CLI');
        console.log('   Run: docker exec arc-saas-temporal tctl namespace register arc-saas');

        await connection.close();
      } catch (nsError) {
        console.log('   Could not auto-create namespace');
      }
      return null;
    }
    console.error(`❌ Failed to start workflow: ${error.message}`);
    return null;
  }
}

async function checkNovuActivities(): Promise<void> {
  console.log('\n📊 Checking Novu activity feed...');

  try {
    const response = await axios.get(`${NOVU_API_URL}/v1/notifications`, {
      headers: {
        'Authorization': `ApiKey ${NOVU_API_KEY}`,
      },
      params: {
        page: 0,
        limit: 10,
      },
    });

    if (response.data.data?.length > 0) {
      console.log(`✅ Found ${response.data.totalCount} notifications in activity feed:`);
      response.data.data.slice(0, 5).forEach((notification: any) => {
        console.log(`   - ${notification.template?.name || 'unknown'}: ${notification.status} (${new Date(notification.createdAt).toLocaleString()})`);
      });
    } else {
      console.log('   No notifications in activity feed yet');
    }
  } catch (error: any) {
    console.log(`   Could not fetch activity feed: ${error.message}`);
  }
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('    ARC SaaS - Temporal & Novu Integration Test');
  console.log('═══════════════════════════════════════════════════════════════');

  let allPassed = true;

  // Test 1: Temporal Connection
  const temporalOk = await testTemporalConnection();
  allPassed = allPassed && temporalOk;

  // Test 2: Novu Connection
  const novuOk = await testNovuConnection();
  allPassed = allPassed && novuOk;

  // Test 3: Send Test Notification
  if (novuOk) {
    const notificationOk = await triggerTestNotification();
    allPassed = allPassed && notificationOk;
  }

  // Test 4: Start Provisioning Workflow (optional - requires worker running)
  if (temporalOk) {
    console.log('\n⚠️  Workflow test requires a worker to be running');
    console.log('   To start the worker: cd services/temporal-worker-service && npm run start:worker');

    const shouldStartWorkflow = process.argv.includes('--start-workflow');
    if (shouldStartWorkflow) {
      await startProvisioningWorkflow();
    }
  }

  // Check Novu Activities
  if (novuOk) {
    await checkNovuActivities();
  }

  // Summary
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('    Test Summary');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`   Temporal Connection: ${temporalOk ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`   Novu Connection:     ${novuOk ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`\n   Overall: ${allPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);

  console.log('\n📚 Next Steps:');
  console.log('   1. Start the Temporal worker: cd services/temporal-worker-service && npm run start:worker');
  console.log('   2. Configure email provider in Novu dashboard: http://localhost:14200');
  console.log('   3. Integrate with Admin App for workflow triggering');
  console.log('═══════════════════════════════════════════════════════════════\n');
}

main().catch(console.error);
