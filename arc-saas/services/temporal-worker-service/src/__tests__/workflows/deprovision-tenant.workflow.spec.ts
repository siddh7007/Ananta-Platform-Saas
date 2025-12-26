/**
 * Deprovision Tenant Workflow Tests
 *
 * Unit tests for the tenant deprovisioning workflow using
 * Temporal's testing framework with mocked activities.
 */

import { describe, it, before, after, beforeEach } from 'mocha';
import { strict as assert } from 'assert';
import {
  TestWorkflowEnvironment,
  MockActivityEnvironment,
} from '@temporalio/testing';
import { Worker, Runtime, DefaultLogger, LogEntry } from '@temporalio/worker';
import { WorkflowClient } from '@temporalio/client';
import { v4 as uuid } from 'uuid';

import { deprovisionTenantWorkflow } from '../../workflows/deprovision-tenant.workflow';
import {
  TenantDeprovisioningInput,
  TenantDeprovisioningResult,
  DeprovisioningStep,
  TenantTier,
} from '../../types';

// ============================================
// Mock Activities Factory
// ============================================

interface MockActivityOptions {
  failAt?: string;
  failWithMessage?: string;
  tenantDetails?: {
    name: string;
    contacts: Array<{ email: string; name: string }>;
    idpOrganizationId?: string;
    idpProvider?: string;
  };
  deletedResources?: string[];
}

function createMockActivities(options: MockActivityOptions = {}) {
  const callLog: string[] = [];

  const createFailingActivity = (name: string) => {
    return async (...args: unknown[]) => {
      callLog.push(name);
      if (options.failAt === name) {
        throw new Error(options.failWithMessage || `${name} failed`);
      }
      return {};
    };
  };

  return {
    callLog,
    activities: {
      // Tenant Activities
      updateTenantStatus: async (input: {
        tenantId: string;
        status: string;
        message: string;
        metadata?: Record<string, unknown>;
      }) => {
        callLog.push('updateTenantStatus');
        if (options.failAt === 'updateTenantStatus') {
          throw new Error(options.failWithMessage || 'updateTenantStatus failed');
        }
        return { success: true };
      },

      getTenantDetails: async (tenantId: string) => {
        callLog.push('getTenantDetails');
        if (options.failAt === 'getTenantDetails') {
          throw new Error(options.failWithMessage || 'getTenantDetails failed');
        }
        return options.tenantDetails || {
          name: 'Test Tenant',
          contacts: [{ email: 'admin@test.com', name: 'Admin' }],
          idpOrganizationId: 'org-123',
          idpProvider: 'keycloak',
        };
      },

      backupTenantData: async (input: {
        tenantId: string;
        tenantKey: string;
        includeDatabase: boolean;
        includeStorage: boolean;
      }) => {
        callLog.push('backupTenantData');
        if (options.failAt === 'backupTenantData') {
          throw new Error(options.failWithMessage || 'backupTenantData failed');
        }
        return {
          backupId: uuid(),
          location: `s3://backups/${input.tenantKey}`,
          size: 1024000,
        };
      },

      deleteResources: async (input: { tenantId: string; deleteAll: boolean }) => {
        callLog.push('deleteResources');
        if (options.failAt === 'deleteResources') {
          throw new Error(options.failWithMessage || 'deleteResources failed');
        }
        return { deletedCount: 5 };
      },

      // Notification Activities
      sendDeprovisioningNotification: async (input: {
        tenantId: string;
        tenantName: string;
        contacts: Array<{ email: string; name: string }>;
        gracePeriodDays?: number;
      }) => {
        callLog.push('sendDeprovisioningNotification');
        if (options.failAt === 'sendDeprovisioningNotification') {
          throw new Error(options.failWithMessage || 'sendDeprovisioningNotification failed');
        }
        return { sent: true, recipients: input.contacts.length };
      },

      // Deployment Activities
      removeDeployment: async (input: {
        tenantId: string;
        tenantKey: string;
        tier: TenantTier;
      }) => {
        callLog.push('removeDeployment');
        if (options.failAt === 'removeDeployment') {
          throw new Error(options.failWithMessage || 'removeDeployment failed');
        }
        return { success: true };
      },

      // Infrastructure Activities
      destroyInfrastructure: async (input: {
        tenantId: string;
        tenantKey: string;
        tier: TenantTier;
        force: boolean;
      }) => {
        callLog.push('destroyInfrastructure');
        if (options.failAt === 'destroyInfrastructure') {
          throw new Error(options.failWithMessage || 'destroyInfrastructure failed');
        }
        return {
          success: true,
          deletedResources: options.deletedResources || [
            'database',
            'storage',
            'networking',
            'compute',
          ],
        };
      },

      // IdP Activities
      deleteIdPOrganization: async (input: {
        tenantId: string;
        provider: string;
        organizationId: string;
      }) => {
        callLog.push('deleteIdPOrganization');
        if (options.failAt === 'deleteIdPOrganization') {
          throw new Error(options.failWithMessage || 'deleteIdPOrganization failed');
        }
        return { deleted: true };
      },
    },
  };
}

// ============================================
// Test Input Factory
// ============================================

function createTestInput(overrides: Partial<TenantDeprovisioningInput> = {}): TenantDeprovisioningInput {
  return {
    tenantId: uuid(),
    tenantKey: 'testco',
    tier: 'pooled',
    options: {
      gracePeriodDays: 0,
      deleteData: true,
      notifyUsers: false,
    },
    ...overrides,
  };
}

// ============================================
// Test Suites
// ============================================

describe('Deprovision Tenant Workflow', function () {
  this.timeout(30000); // Increase timeout for workflow tests

  let testEnv: TestWorkflowEnvironment;

  before(async () => {
    // Suppress noisy logs during tests
    Runtime.install({
      logger: new DefaultLogger('WARN'),
    });

    testEnv = await TestWorkflowEnvironment.createLocal();
  });

  after(async () => {
    await testEnv?.teardown();
  });

  // ============================================
  // Input Validation Tests
  // ============================================

  describe('Input Validation', () => {
    it('should reject missing tenantId', async () => {
      const { activities } = createMockActivities();

      const worker = await Worker.create({
        connection: testEnv.nativeConnection,
        taskQueue: 'test-deprovision-validation',
        workflowsPath: require.resolve('../../workflows/deprovision-tenant.workflow'),
        activities,
      });

      const client = testEnv.client;
      const workflowId = `test-deprovision-${uuid()}`;

      try {
        await worker.runUntil(async () => {
          const handle = await client.workflow.start(deprovisionTenantWorkflow, {
            workflowId,
            taskQueue: 'test-deprovision-validation',
            args: [{
              tenantId: '', // Empty - invalid
              tenantKey: 'test',
              tier: 'pooled',
            } as TenantDeprovisioningInput],
          });

          await handle.result();
        });
        assert.fail('Should have thrown validation error');
      } catch (error: unknown) {
        assert.ok(error instanceof Error);
        assert.ok(error.message.includes('tenantId') || error.message.includes('ValidationError'));
      }
    });

    it('should reject missing tenantKey', async () => {
      const { activities } = createMockActivities();

      const worker = await Worker.create({
        connection: testEnv.nativeConnection,
        taskQueue: 'test-deprovision-validation-key',
        workflowsPath: require.resolve('../../workflows/deprovision-tenant.workflow'),
        activities,
      });

      const client = testEnv.client;
      const workflowId = `test-deprovision-${uuid()}`;

      try {
        await worker.runUntil(async () => {
          const handle = await client.workflow.start(deprovisionTenantWorkflow, {
            workflowId,
            taskQueue: 'test-deprovision-validation-key',
            args: [{
              tenantId: uuid(),
              tenantKey: '', // Empty - invalid
              tier: 'pooled',
            } as TenantDeprovisioningInput],
          });

          await handle.result();
        });
        assert.fail('Should have thrown validation error');
      } catch (error: unknown) {
        assert.ok(error instanceof Error);
        assert.ok(error.message.includes('tenantKey') || error.message.includes('ValidationError'));
      }
    });

    it('should reject invalid tier', async () => {
      const { activities } = createMockActivities();

      const worker = await Worker.create({
        connection: testEnv.nativeConnection,
        taskQueue: 'test-deprovision-validation-tier',
        workflowsPath: require.resolve('../../workflows/deprovision-tenant.workflow'),
        activities,
      });

      const client = testEnv.client;
      const workflowId = `test-deprovision-${uuid()}`;

      try {
        await worker.runUntil(async () => {
          const handle = await client.workflow.start(deprovisionTenantWorkflow, {
            workflowId,
            taskQueue: 'test-deprovision-validation-tier',
            args: [{
              tenantId: uuid(),
              tenantKey: 'test',
              tier: 'invalid' as TenantTier, // Invalid tier
            } as TenantDeprovisioningInput],
          });

          await handle.result();
        });
        assert.fail('Should have thrown validation error');
      } catch (error: unknown) {
        assert.ok(error instanceof Error);
        assert.ok(error.message.includes('tier') || error.message.includes('ValidationError'));
      }
    });
  });

  // ============================================
  // Happy Path Tests
  // ============================================

  describe('Happy Path', () => {
    it('should complete full deprovisioning for pooled tenant', async () => {
      const { activities, callLog } = createMockActivities();
      const input = createTestInput({ tier: 'pooled' });

      const worker = await Worker.create({
        connection: testEnv.nativeConnection,
        taskQueue: 'test-deprovision-pooled',
        workflowsPath: require.resolve('../../workflows/deprovision-tenant.workflow'),
        activities,
      });

      const client = testEnv.client;
      const workflowId = `test-deprovision-${uuid()}`;

      const result = await worker.runUntil(async () => {
        const handle = await client.workflow.start(deprovisionTenantWorkflow, {
          workflowId,
          taskQueue: 'test-deprovision-pooled',
          args: [input],
        });

        return handle.result();
      });

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.tenantId, input.tenantId);
      assert.ok(result.deletedResources);
      assert.ok(result.deletedResources.length > 0);

      // Verify activity call order
      assert.ok(callLog.includes('updateTenantStatus'));
      assert.ok(callLog.includes('removeDeployment'));
      assert.ok(callLog.includes('destroyInfrastructure'));
      assert.ok(callLog.includes('getTenantDetails'));
      assert.ok(callLog.includes('deleteIdPOrganization'));
      assert.ok(callLog.includes('deleteResources'));
    });

    it('should complete full deprovisioning for silo tenant', async () => {
      const { activities, callLog } = createMockActivities();
      const input = createTestInput({ tier: 'silo' });

      const worker = await Worker.create({
        connection: testEnv.nativeConnection,
        taskQueue: 'test-deprovision-silo',
        workflowsPath: require.resolve('../../workflows/deprovision-tenant.workflow'),
        activities,
      });

      const client = testEnv.client;
      const workflowId = `test-deprovision-${uuid()}`;

      const result = await worker.runUntil(async () => {
        const handle = await client.workflow.start(deprovisionTenantWorkflow, {
          workflowId,
          taskQueue: 'test-deprovision-silo',
          args: [input],
        });

        return handle.result();
      });

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.tenantId, input.tenantId);
    });

    it('should backup data when deleteData is false', async () => {
      const { activities, callLog } = createMockActivities();
      const input = createTestInput({
        options: {
          deleteData: false,
          gracePeriodDays: 0,
          notifyUsers: false,
        },
      });

      const worker = await Worker.create({
        connection: testEnv.nativeConnection,
        taskQueue: 'test-deprovision-backup',
        workflowsPath: require.resolve('../../workflows/deprovision-tenant.workflow'),
        activities,
      });

      const client = testEnv.client;
      const workflowId = `test-deprovision-${uuid()}`;

      const result = await worker.runUntil(async () => {
        const handle = await client.workflow.start(deprovisionTenantWorkflow, {
          workflowId,
          taskQueue: 'test-deprovision-backup',
          args: [input],
        });

        return handle.result();
      });

      assert.strictEqual(result.success, true);
      assert.ok(callLog.includes('backupTenantData'));
    });

    it('should send notifications when notifyUsers is true', async () => {
      const { activities, callLog } = createMockActivities();
      const input = createTestInput({
        options: {
          deleteData: true,
          gracePeriodDays: 0,
          notifyUsers: true,
        },
      });

      const worker = await Worker.create({
        connection: testEnv.nativeConnection,
        taskQueue: 'test-deprovision-notify',
        workflowsPath: require.resolve('../../workflows/deprovision-tenant.workflow'),
        activities,
      });

      const client = testEnv.client;
      const workflowId = `test-deprovision-${uuid()}`;

      const result = await worker.runUntil(async () => {
        const handle = await client.workflow.start(deprovisionTenantWorkflow, {
          workflowId,
          taskQueue: 'test-deprovision-notify',
          args: [input],
        });

        return handle.result();
      });

      assert.strictEqual(result.success, true);
      assert.ok(callLog.includes('sendDeprovisioningNotification'));
    });
  });

  // ============================================
  // Status Query Tests
  // ============================================

  describe('Status Queries', () => {
    it('should return current deprovisioning status', async () => {
      const { activities } = createMockActivities();
      const input = createTestInput();

      const worker = await Worker.create({
        connection: testEnv.nativeConnection,
        taskQueue: 'test-deprovision-status',
        workflowsPath: require.resolve('../../workflows/deprovision-tenant.workflow'),
        activities,
      });

      const client = testEnv.client;
      const workflowId = `test-deprovision-${uuid()}`;

      await worker.runUntil(async () => {
        const handle = await client.workflow.start(deprovisionTenantWorkflow, {
          workflowId,
          taskQueue: 'test-deprovision-status',
          args: [input],
        });

        // Query status during execution
        const status = await handle.query('getDeprovisioningStatus');

        assert.ok(status);
        assert.ok(typeof status.step === 'string');
        assert.ok(typeof status.progress === 'number');
        assert.ok(status.startedAt);

        await handle.result();
      });
    });
  });

  // ============================================
  // Failure Handling Tests
  // ============================================

  describe('Failure Handling', () => {
    it('should return failure result when removeDeployment fails', async () => {
      const { activities } = createMockActivities({
        failAt: 'removeDeployment',
        failWithMessage: 'Deployment removal failed',
      });
      const input = createTestInput();

      const worker = await Worker.create({
        connection: testEnv.nativeConnection,
        taskQueue: 'test-deprovision-fail-deploy',
        workflowsPath: require.resolve('../../workflows/deprovision-tenant.workflow'),
        activities,
      });

      const client = testEnv.client;
      const workflowId = `test-deprovision-${uuid()}`;

      const result = await worker.runUntil(async () => {
        const handle = await client.workflow.start(deprovisionTenantWorkflow, {
          workflowId,
          taskQueue: 'test-deprovision-fail-deploy',
          args: [input],
        });

        return handle.result();
      });

      assert.strictEqual(result.success, false);
      assert.ok(result.error);
      assert.ok(result.error.includes('Deployment removal failed'));
      assert.strictEqual(result.failedStep, 'removing_application');
    });

    it('should return failure result when destroyInfrastructure fails', async () => {
      const { activities } = createMockActivities({
        failAt: 'destroyInfrastructure',
        failWithMessage: 'Terraform destroy failed',
      });
      const input = createTestInput();

      const worker = await Worker.create({
        connection: testEnv.nativeConnection,
        taskQueue: 'test-deprovision-fail-infra',
        workflowsPath: require.resolve('../../workflows/deprovision-tenant.workflow'),
        activities,
      });

      const client = testEnv.client;
      const workflowId = `test-deprovision-${uuid()}`;

      const result = await worker.runUntil(async () => {
        const handle = await client.workflow.start(deprovisionTenantWorkflow, {
          workflowId,
          taskQueue: 'test-deprovision-fail-infra',
          args: [input],
        });

        return handle.result();
      });

      assert.strictEqual(result.success, false);
      assert.ok(result.error);
      assert.ok(result.error.includes('Terraform destroy failed'));
      assert.strictEqual(result.failedStep, 'destroying_infrastructure');
    });

    it('should update tenant status to INACTIVE on failure', async () => {
      const { activities, callLog } = createMockActivities({
        failAt: 'deleteIdPOrganization',
        failWithMessage: 'IdP deletion failed',
      });
      const input = createTestInput();

      const worker = await Worker.create({
        connection: testEnv.nativeConnection,
        taskQueue: 'test-deprovision-fail-idp',
        workflowsPath: require.resolve('../../workflows/deprovision-tenant.workflow'),
        activities,
      });

      const client = testEnv.client;
      const workflowId = `test-deprovision-${uuid()}`;

      const result = await worker.runUntil(async () => {
        const handle = await client.workflow.start(deprovisionTenantWorkflow, {
          workflowId,
          taskQueue: 'test-deprovision-fail-idp',
          args: [input],
        });

        return handle.result();
      });

      assert.strictEqual(result.success, false);
      // Should have called updateTenantStatus multiple times
      // (initial DEPROVISIONING + final INACTIVE on failure)
      const statusCalls = callLog.filter((c) => c === 'updateTenantStatus');
      assert.ok(statusCalls.length >= 2);
    });
  });

  // ============================================
  // Edge Cases
  // ============================================

  describe('Edge Cases', () => {
    it('should handle tenant without IdP organization', async () => {
      const { activities, callLog } = createMockActivities({
        tenantDetails: {
          name: 'Test Tenant No IdP',
          contacts: [],
          idpOrganizationId: undefined, // No IdP org
          idpProvider: undefined,
        },
      });
      const input = createTestInput();

      const worker = await Worker.create({
        connection: testEnv.nativeConnection,
        taskQueue: 'test-deprovision-no-idp',
        workflowsPath: require.resolve('../../workflows/deprovision-tenant.workflow'),
        activities,
      });

      const client = testEnv.client;
      const workflowId = `test-deprovision-${uuid()}`;

      const result = await worker.runUntil(async () => {
        const handle = await client.workflow.start(deprovisionTenantWorkflow, {
          workflowId,
          taskQueue: 'test-deprovision-no-idp',
          args: [input],
        });

        return handle.result();
      });

      assert.strictEqual(result.success, true);
      // Should NOT have called deleteIdPOrganization
      assert.ok(!callLog.includes('deleteIdPOrganization'));
    });

    it('should handle tenant without contacts for notification', async () => {
      const { activities, callLog } = createMockActivities({
        tenantDetails: {
          name: 'Test Tenant No Contacts',
          contacts: [], // No contacts
          idpOrganizationId: 'org-123',
          idpProvider: 'keycloak',
        },
      });
      const input = createTestInput({
        options: {
          deleteData: true,
          gracePeriodDays: 0,
          notifyUsers: true, // Try to notify but no contacts
        },
      });

      const worker = await Worker.create({
        connection: testEnv.nativeConnection,
        taskQueue: 'test-deprovision-no-contacts',
        workflowsPath: require.resolve('../../workflows/deprovision-tenant.workflow'),
        activities,
      });

      const client = testEnv.client;
      const workflowId = `test-deprovision-${uuid()}`;

      const result = await worker.runUntil(async () => {
        const handle = await client.workflow.start(deprovisionTenantWorkflow, {
          workflowId,
          taskQueue: 'test-deprovision-no-contacts',
          args: [input],
        });

        return handle.result();
      });

      assert.strictEqual(result.success, true);
      // Should NOT have called sendDeprovisioningNotification
      assert.ok(!callLog.includes('sendDeprovisioningNotification'));
    });
  });
});
