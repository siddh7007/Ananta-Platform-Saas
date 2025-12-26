/**
 * Provision Tenant Workflow Unit Tests
 *
 * Tests for the tenant provisioning workflow including:
 * - Input validation
 * - Happy path completion
 * - Saga compensation (rollback on failure)
 * - Status query responses
 * - Cancellation handling
 */

import { describe, it, beforeEach, afterEach } from 'mocha';
import { strict as assert } from 'assert';
import { TestWorkflowEnvironment } from '@temporalio/testing';
import { Worker, Runtime, DefaultLogger, LogEntry } from '@temporalio/worker';
import { v4 as uuid } from 'uuid';

import { provisionTenantWorkflow, getProvisioningStatusQuery, provisioningCancelledSignal } from '../../workflows';
import { TenantProvisioningInput, TenantProvisioningResult } from '../../types';

/**
 * Mock activities for testing
 * These simulate external service calls without actual network requests
 */
const createMockActivities = (options: {
  shouldFail?: string; // Activity name to fail
  failMessage?: string;
}) => {
  const callLog: string[] = [];
  const { shouldFail, failMessage = 'Mock failure' } = options;

  const maybeThrow = (activityName: string) => {
    callLog.push(activityName);
    if (shouldFail === activityName) {
      throw new Error(failMessage);
    }
  };

  return {
    callLog,
    activities: {
      // IdP Activities
      createIdPOrganization: async (input: any) => {
        maybeThrow('createIdPOrganization');
        return {
          organizationId: `org-${uuid().slice(0, 8)}`,
          clientId: `client-${uuid().slice(0, 8)}`,
          loginUrl: `https://auth.example.com/login/${input.tenantKey}`,
        };
      },
      deleteIdPOrganization: async () => {
        maybeThrow('deleteIdPOrganization');
        return { success: true };
      },

      // User Activities
      createKeycloakUser: async (input: any) => {
        maybeThrow('createKeycloakUser');
        return {
          userId: `user-${uuid().slice(0, 8)}`,
          email: input.email,
          username: input.email,
        };
      },
      deleteKeycloakUser: async () => {
        maybeThrow('deleteKeycloakUser');
        return { success: true };
      },

      // Tenant Activities
      updateTenantStatus: async () => {
        maybeThrow('updateTenantStatus');
        return { success: true };
      },
      provisionTenantSchema: async (input: any) => {
        maybeThrow('provisionTenantSchema');
        return {
          schemaName: `tenant_${input.tenantKey}`,
          tables: ['users', 'settings', 'data'],
        };
      },
      deprovisionTenantSchema: async () => {
        maybeThrow('deprovisionTenantSchema');
        return { success: true };
      },
      createResources: async () => {
        maybeThrow('createResources');
        return { success: true };
      },
      getTenantDetails: async (tenantId: string) => {
        maybeThrow('getTenantDetails');
        return {
          id: tenantId,
          name: 'Test Tenant',
          contacts: [],
          idpProvider: 'keycloak',
          idpOrganizationId: `org-${uuid().slice(0, 8)}`,
        };
      },

      // Storage Activities
      provisionTenantStorage: async (input: any) => {
        maybeThrow('provisionTenantStorage');
        return {
          bucketName: `tenant-${input.tenantKey}-storage`,
          region: 'us-east-1',
        };
      },
      deprovisionTenantStorage: async () => {
        maybeThrow('deprovisionTenantStorage');
        return { success: true };
      },

      // Infrastructure Activities
      provisionInfrastructure: async (input: any) => {
        maybeThrow('provisionInfrastructure');
        return {
          runId: `tf-run-${uuid().slice(0, 8)}`,
          status: 'applied',
          outputs: {
            loadBalancerDns: `${input.tenantKey}.app.example.com`,
          },
          resources: [
            {
              type: 'bucket',
              externalIdentifier: `bucket-${input.tenantKey}`,
              metadata: { region: 'us-east-1' },
            },
          ],
        };
      },
      destroyInfrastructure: async () => {
        maybeThrow('destroyInfrastructure');
        return { deletedResources: [] };
      },

      // Deployment Activities
      deployApplication: async (input: any) => {
        maybeThrow('deployApplication');
        return {
          deploymentId: `deploy-${uuid().slice(0, 8)}`,
          appPlaneUrl: `https://${input.tenantKey}.app.example.com`,
          adminPortalUrl: `https://${input.tenantKey}.admin.example.com`,
          resources: [],
        };
      },
      rollbackDeployment: async () => {
        maybeThrow('rollbackDeployment');
        return { success: true };
      },
      configureDns: async () => {
        maybeThrow('configureDns');
        return { success: true };
      },

      // Billing Activities
      createBillingCustomer: async () => {
        maybeThrow('createBillingCustomer');
        return {
          customerId: `cus-${uuid().slice(0, 8)}`,
        };
      },
      createTenantSubscription: async () => {
        maybeThrow('createTenantSubscription');
        return {
          subscriptionId: `sub-${uuid().slice(0, 8)}`,
        };
      },
      deleteBillingCustomer: async () => {
        maybeThrow('deleteBillingCustomer');
        return { success: true };
      },

      // Notification Activities
      sendWelcomeEmail: async () => {
        maybeThrow('sendWelcomeEmail');
        return { success: true };
      },
      sendProvisioningFailedEmail: async () => {
        maybeThrow('sendProvisioningFailedEmail');
        return { success: true };
      },

      // App Plane Webhook Activities
      notifyTenantProvisioned: async () => {
        maybeThrow('notifyTenantProvisioned');
        return { success: true };
      },

      // Supabase App Plane Activities
      provisionSupabaseOrganization: async () => {
        maybeThrow('provisionSupabaseOrganization');
        return {
          organizationId: `org-${uuid().slice(0, 8)}`,
        };
      },
    },
  };
};

/**
 * Create a valid test input for provisioning workflow
 */
const createTestInput = (overrides?: Partial<TenantProvisioningInput>): TenantProvisioningInput => ({
  tenantId: uuid(),
  tenantKey: 'testco',
  tenantName: 'Test Company',
  tier: 'pooled',
  domains: [],
  contacts: [
    {
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@test.com',
      isPrimary: true,
    },
  ],
  subscription: {
    id: uuid(),
    planId: 'plan-basic',
    tier: 'pooled',
    startDate: new Date().toISOString(),
    endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
  },
  idpConfig: {
    provider: 'keycloak',
    createOrganization: true,
    createAdminUser: true,
    ssoEnabled: false,
    mfaEnabled: false,
  },
  ...overrides,
});

describe('provisionTenantWorkflow', function () {
  // Increase timeout for workflow tests
  this.timeout(30000);

  let testEnv: TestWorkflowEnvironment;
  let worker: Worker;

  beforeEach(async function () {
    // Skip in CI if no Temporal test server
    if (process.env.CI && !process.env.TEMPORAL_TEST_SERVER) {
      this.skip();
      return;
    }
  });

  afterEach(async function () {
    if (worker) {
      await worker.shutdown();
    }
    if (testEnv) {
      await testEnv.teardown();
    }
  });

  describe('Input Validation', function () {
    it('should reject input without tenantId', async function () {
      testEnv = await TestWorkflowEnvironment.createLocal();
      const { activities } = createMockActivities({});

      worker = await Worker.create({
        connection: testEnv.nativeConnection,
        taskQueue: 'test-queue',
        workflowsPath: require.resolve('../../workflows'),
        activities,
      });

      const client = testEnv.client;
      const input = createTestInput();
      delete (input as any).tenantId;

      await worker.runUntil(async () => {
        const handle = await client.workflow.start(provisionTenantWorkflow, {
          taskQueue: 'test-queue',
          workflowId: `test-${uuid()}`,
          args: [input as TenantProvisioningInput],
        });

        try {
          await handle.result();
          assert.fail('Expected workflow to fail with validation error');
        } catch (error: any) {
          assert.ok(error.message.includes('tenantId is required'));
        }
      });
    });

    it('should reject input without tenantKey', async function () {
      testEnv = await TestWorkflowEnvironment.createLocal();
      const { activities } = createMockActivities({});

      worker = await Worker.create({
        connection: testEnv.nativeConnection,
        taskQueue: 'test-queue',
        workflowsPath: require.resolve('../../workflows'),
        activities,
      });

      const client = testEnv.client;
      const input = createTestInput();
      delete (input as any).tenantKey;

      await worker.runUntil(async () => {
        const handle = await client.workflow.start(provisionTenantWorkflow, {
          taskQueue: 'test-queue',
          workflowId: `test-${uuid()}`,
          args: [input as TenantProvisioningInput],
        });

        try {
          await handle.result();
          assert.fail('Expected workflow to fail with validation error');
        } catch (error: any) {
          assert.ok(error.message.includes('tenantKey is required'));
        }
      });
    });

    it('should reject invalid tier', async function () {
      testEnv = await TestWorkflowEnvironment.createLocal();
      const { activities } = createMockActivities({});

      worker = await Worker.create({
        connection: testEnv.nativeConnection,
        taskQueue: 'test-queue',
        workflowsPath: require.resolve('../../workflows'),
        activities,
      });

      const client = testEnv.client;
      const input = createTestInput({ tier: 'invalid' as any });

      await worker.runUntil(async () => {
        const handle = await client.workflow.start(provisionTenantWorkflow, {
          taskQueue: 'test-queue',
          workflowId: `test-${uuid()}`,
          args: [input],
        });

        try {
          await handle.result();
          assert.fail('Expected workflow to fail with validation error');
        } catch (error: any) {
          assert.ok(error.message.includes('Invalid tier'));
        }
      });
    });
  });

  describe('Happy Path', function () {
    it('should complete provisioning for pooled tier', async function () {
      testEnv = await TestWorkflowEnvironment.createLocal();
      const { activities, callLog } = createMockActivities({});

      worker = await Worker.create({
        connection: testEnv.nativeConnection,
        taskQueue: 'test-queue',
        workflowsPath: require.resolve('../../workflows'),
        activities,
      });

      const client = testEnv.client;
      const input = createTestInput({ tier: 'pooled' });

      await worker.runUntil(async () => {
        const handle = await client.workflow.start(provisionTenantWorkflow, {
          taskQueue: 'test-queue',
          workflowId: `test-${uuid()}`,
          args: [input],
        });

        const result = await handle.result();

        // Verify success
        assert.equal(result.success, true);
        assert.equal(result.tenantId, input.tenantId);
        assert.ok(result.appPlaneUrl);
        assert.ok(result.schemaName);

        // Verify pooled tier skips infrastructure provisioning
        assert.ok(!callLog.includes('provisionInfrastructure'), 'Should skip infra for pooled tier');
      });
    });

    it('should provision infrastructure for silo tier', async function () {
      testEnv = await TestWorkflowEnvironment.createLocal();
      const { activities, callLog } = createMockActivities({});

      worker = await Worker.create({
        connection: testEnv.nativeConnection,
        taskQueue: 'test-queue',
        workflowsPath: require.resolve('../../workflows'),
        activities,
      });

      const client = testEnv.client;
      const input = createTestInput({ tier: 'silo' });

      await worker.runUntil(async () => {
        const handle = await client.workflow.start(provisionTenantWorkflow, {
          taskQueue: 'test-queue',
          workflowId: `test-${uuid()}`,
          args: [input],
        });

        const result = await handle.result();

        // Verify success
        assert.equal(result.success, true);

        // Verify infrastructure was provisioned for silo tier
        assert.ok(callLog.includes('provisionInfrastructure'), 'Should provision infra for silo tier');
      });
    });

    it('should create IdP organization when configured', async function () {
      testEnv = await TestWorkflowEnvironment.createLocal();
      const { activities, callLog } = createMockActivities({});

      worker = await Worker.create({
        connection: testEnv.nativeConnection,
        taskQueue: 'test-queue',
        workflowsPath: require.resolve('../../workflows'),
        activities,
      });

      const client = testEnv.client;
      const input = createTestInput({
        idpConfig: {
          provider: 'keycloak',
          createOrganization: true,
          createAdminUser: true,
        },
      });

      await worker.runUntil(async () => {
        const handle = await client.workflow.start(provisionTenantWorkflow, {
          taskQueue: 'test-queue',
          workflowId: `test-${uuid()}`,
          args: [input],
        });

        const result = await handle.result();

        assert.equal(result.success, true);
        assert.ok(result.idpOrganizationId);
        assert.ok(callLog.includes('createIdPOrganization'));
        assert.ok(callLog.includes('createKeycloakUser'));
      });
    });
  });

  describe('Status Queries', function () {
    it('should return current status via query', async function () {
      testEnv = await TestWorkflowEnvironment.createLocal();
      const { activities } = createMockActivities({});

      worker = await Worker.create({
        connection: testEnv.nativeConnection,
        taskQueue: 'test-queue',
        workflowsPath: require.resolve('../../workflows'),
        activities,
      });

      const client = testEnv.client;
      const input = createTestInput();

      await worker.runUntil(async () => {
        const handle = await client.workflow.start(provisionTenantWorkflow, {
          taskQueue: 'test-queue',
          workflowId: `test-${uuid()}`,
          args: [input],
        });

        // Wait a bit for workflow to start processing
        await new Promise((resolve) => setTimeout(resolve, 100));

        // Query status
        const status = await handle.query(getProvisioningStatusQuery);
        assert.ok(status.step);
        assert.ok(typeof status.progress === 'number');
        assert.ok(status.startedAt);

        await handle.result();
      });
    });
  });

  describe('Saga Compensation (Rollback)', function () {
    it('should rollback IdP on storage failure', async function () {
      testEnv = await TestWorkflowEnvironment.createLocal();
      const { activities, callLog } = createMockActivities({
        shouldFail: 'provisionTenantStorage',
        failMessage: 'Storage provisioning failed',
      });

      worker = await Worker.create({
        connection: testEnv.nativeConnection,
        taskQueue: 'test-queue',
        workflowsPath: require.resolve('../../workflows'),
        activities,
      });

      const client = testEnv.client;
      const input = createTestInput();

      await worker.runUntil(async () => {
        const handle = await client.workflow.start(provisionTenantWorkflow, {
          taskQueue: 'test-queue',
          workflowId: `test-${uuid()}`,
          args: [input],
        });

        const result = await handle.result();

        // Verify failure
        assert.equal(result.success, false);
        assert.ok(result.error?.includes('Storage provisioning failed'));
        assert.equal(result.compensationExecuted, true);

        // Verify compensation was called
        assert.ok(callLog.includes('deprovisionTenantSchema'), 'Should rollback database schema');
        assert.ok(callLog.includes('deleteIdPOrganization'), 'Should rollback IdP');
      });
    });

    it('should rollback infrastructure on deployment failure', async function () {
      testEnv = await TestWorkflowEnvironment.createLocal();
      const { activities, callLog } = createMockActivities({
        shouldFail: 'deployApplication',
        failMessage: 'Deployment failed',
      });

      worker = await Worker.create({
        connection: testEnv.nativeConnection,
        taskQueue: 'test-queue',
        workflowsPath: require.resolve('../../workflows'),
        activities,
      });

      const client = testEnv.client;
      const input = createTestInput({ tier: 'silo' }); // Use silo to test infra rollback

      await worker.runUntil(async () => {
        const handle = await client.workflow.start(provisionTenantWorkflow, {
          taskQueue: 'test-queue',
          workflowId: `test-${uuid()}`,
          args: [input],
        });

        const result = await handle.result();

        assert.equal(result.success, false);
        assert.equal(result.compensationExecuted, true);

        // Verify infrastructure was rolled back
        assert.ok(callLog.includes('destroyInfrastructure'), 'Should rollback infrastructure');
        assert.ok(callLog.includes('deprovisionTenantStorage'), 'Should rollback storage');
      });
    });

    it('should send failure notification on error', async function () {
      testEnv = await TestWorkflowEnvironment.createLocal();
      const { activities, callLog } = createMockActivities({
        shouldFail: 'provisionTenantSchema',
        failMessage: 'Database error',
      });

      worker = await Worker.create({
        connection: testEnv.nativeConnection,
        taskQueue: 'test-queue',
        workflowsPath: require.resolve('../../workflows'),
        activities,
      });

      const client = testEnv.client;
      const input = createTestInput();

      await worker.runUntil(async () => {
        const handle = await client.workflow.start(provisionTenantWorkflow, {
          taskQueue: 'test-queue',
          workflowId: `test-${uuid()}`,
          args: [input],
        });

        await handle.result();

        // Verify failure notification was sent
        assert.ok(callLog.includes('sendProvisioningFailedEmail'), 'Should send failure notification');
      });
    });
  });

  describe('Cancellation', function () {
    it('should handle cancellation signal', async function () {
      testEnv = await TestWorkflowEnvironment.createLocal();
      const { activities } = createMockActivities({});

      // Make storage slow to allow cancellation
      const slowActivities = {
        ...activities,
        provisionTenantStorage: async (input: any) => {
          await new Promise((resolve) => setTimeout(resolve, 5000));
          return activities.provisionTenantStorage(input);
        },
      };

      worker = await Worker.create({
        connection: testEnv.nativeConnection,
        taskQueue: 'test-queue',
        workflowsPath: require.resolve('../../workflows'),
        activities: slowActivities,
      });

      const client = testEnv.client;
      const input = createTestInput();

      await worker.runUntil(async () => {
        const handle = await client.workflow.start(provisionTenantWorkflow, {
          taskQueue: 'test-queue',
          workflowId: `test-${uuid()}`,
          args: [input],
        });

        // Wait for workflow to start
        await new Promise((resolve) => setTimeout(resolve, 100));

        // Send cancellation signal
        await handle.signal(provisioningCancelledSignal);

        const result = await handle.result();

        // Workflow should complete with failure due to cancellation
        assert.equal(result.success, false);
        assert.ok(result.error?.includes('cancelled'));
      });
    });
  });
});
