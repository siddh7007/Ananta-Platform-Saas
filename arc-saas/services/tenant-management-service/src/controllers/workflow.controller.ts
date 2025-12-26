import {get, post, param, requestBody, HttpErrors, RestBindings, Request} from '@loopback/rest';
import {inject} from '@loopback/core';
import {repository} from '@loopback/repository';
import {
  CONTENT_TYPE,
  OPERATION_SECURITY_SPEC,
  STATUS_CODE,
} from '@sourceloop/core';
import {authenticate, STRATEGY, AuthenticationBindings} from 'loopback4-authentication';
import {authorize} from 'loopback4-authorization';
import {PermissionKey} from '../permissions';
import {Client, Connection} from '@temporalio/client';
import {IAuthUserWithPermissions} from '@sourceloop/core';
import {TenantRepository} from '../repositories/sequelize/tenant.repository';
import {SubscriptionRepository} from '../repositories/sequelize/subscription.repository';
import {ContactRepository} from '../repositories/sequelize/contact.repository';

const basePath = '/workflows';

interface WorkflowInfo {
  id: string;
  workflowId: string;
  workflowType: string;
  tenantId?: string;
  tenantName?: string;
  status: string;
  startTime: string;
  endTime?: string;
  runId: string;
}

interface WorkflowDetail extends WorkflowInfo {
  result?: unknown;
  error?: string;
  memo?: Record<string, unknown>;
  searchAttributes?: Record<string, unknown>;
}

interface WorkflowHistoryEvent {
  id: string;
  eventType: string;
  timestamp: string;
  details?: Record<string, unknown>;
}

interface WorkflowListFilter {
  status?: string;
  workflowType?: string;
  tenantId?: string;
  startTimeFrom?: string;
  startTimeTo?: string;
  limit?: number;
  offset?: number;
}

interface WorkflowActionResult {
  success: boolean;
  workflowId: string;
  message: string;
  action: 'restart' | 'cancel';
  performedBy?: string;
  timestamp: string;
}

/**
 * TenantProvisioningInput interface matching temporal-worker-service types
 */
interface TenantProvisioningInput {
  tenantId: string;
  tenantKey: string;
  tenantName: string;
  tier: 'silo' | 'pooled' | 'bridge';
  domains: string[];
  contacts: Array<{
    firstName?: string;
    lastName?: string;
    email: string;
    isPrimary?: boolean;
  }>;
  subscription: {
    id: string;
    planId: string;
    tier: 'silo' | 'pooled' | 'bridge';
    startDate: string;
    endDate: string;
  };
  idpConfig?: {
    provider: 'keycloak' | 'auth0' | 'cognito';
    createOrganization?: boolean;
    createAdminUser?: boolean;
    ssoEnabled?: boolean;
    mfaEnabled?: boolean;
  };
}

export class WorkflowController {
  private client: Client | null = null;
  private readonly temporalAddress: string;
  private readonly temporalNamespace: string;
  private readonly taskQueue: string;

  constructor(
    @inject(AuthenticationBindings.CURRENT_USER, {optional: true})
    private readonly currentUser?: IAuthUserWithPermissions,
    @repository(TenantRepository)
    private readonly tenantRepository?: TenantRepository,
    @repository(SubscriptionRepository)
    private readonly subscriptionRepository?: SubscriptionRepository,
    @repository(ContactRepository)
    private readonly contactRepository?: ContactRepository,
  ) {
    this.temporalAddress = process.env.TEMPORAL_ADDRESS || 'localhost:7233';
    this.temporalNamespace = process.env.TEMPORAL_NAMESPACE || 'arc-saas';
    this.taskQueue = process.env.TEMPORAL_TASK_QUEUE || 'tenant-provisioning';
  }

  private async getClient(): Promise<Client> {
    if (this.client) {
      return this.client;
    }

    try {
      const connection = await Connection.connect({
        address: this.temporalAddress,
      });

      this.client = new Client({
        connection,
        namespace: this.temporalNamespace,
      });

      return this.client;
    } catch (error) {
      console.error('Failed to connect to Temporal', error);
      throw error;
    }
  }

  private mapStatus(status: string): string {
    // Map Temporal status names to expected frontend values
    switch (status) {
      case 'RUNNING':
        return 'running';
      case 'COMPLETED':
        return 'completed';
      case 'FAILED':
        return 'failed';
      case 'CANCELLED':
      case 'CANCELED':
        return 'cancelled';
      case 'TERMINATED':
        return 'failed';
      case 'TIMED_OUT':
        return 'timed_out';
      default:
        return status.toLowerCase();
    }
  }

  @authorize({
    permissions: [PermissionKey.ViewTenant],
  })
  @authenticate(STRATEGY.BEARER, {
    passReqToCallback: true,
  })
  @get(`${basePath}/count`, {
    security: OPERATION_SECURITY_SPEC,
    responses: {
      [STATUS_CODE.OK]: {
        description: 'Workflow count',
        content: {
          [CONTENT_TYPE.JSON]: {
            schema: {
              type: 'object',
              properties: {
                count: {type: 'number'},
              },
            },
          },
        },
      },
    },
  })
  async count(): Promise<{count: number}> {
    try {
      const client = await this.getClient();
      const workflows = client.workflow.list();
      let count = 0;
      for await (const _ of workflows) {
        count++;
      }
      return {count};
    } catch (error) {
      console.error('Failed to count workflows', error);
      return {count: 0};
    }
  }

  @authorize({
    permissions: [PermissionKey.ViewTenant],
  })
  @authenticate(STRATEGY.BEARER, {
    passReqToCallback: true,
  })
  @get(basePath, {
    security: OPERATION_SECURITY_SPEC,
    responses: {
      [STATUS_CODE.OK]: {
        description: 'Array of workflow executions with pagination',
        content: {
          [CONTENT_TYPE.JSON]: {
            schema: {
              type: 'object',
              properties: {
                data: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      id: {type: 'string'},
                      workflowId: {type: 'string'},
                      workflowType: {type: 'string'},
                      tenantId: {type: 'string'},
                      tenantName: {type: 'string'},
                      status: {type: 'string'},
                      startTime: {type: 'string'},
                      endTime: {type: 'string'},
                      runId: {type: 'string'},
                    },
                  },
                },
                total: {type: 'number'},
                limit: {type: 'number'},
                offset: {type: 'number'},
              },
            },
          },
        },
      },
    },
  })
  async find(
    @param.query.string('status') status?: string,
    @param.query.string('workflowType') workflowType?: string,
    @param.query.string('tenantId') tenantId?: string,
    @param.query.string('startTimeFrom') startTimeFrom?: string,
    @param.query.string('startTimeTo') startTimeTo?: string,
    @param.query.number('limit') limit: number = 50,
    @param.query.number('offset') offset: number = 0,
  ): Promise<{data: WorkflowInfo[]; total: number; limit: number; offset: number}> {
    try {
      const client = await this.getClient();

      // Build Temporal query based on filters
      let query = '';
      const conditions: string[] = [];

      if (status) {
        // Map frontend status to Temporal status
        const temporalStatus = this.mapStatusToTemporal(status);
        if (temporalStatus) {
          conditions.push(`ExecutionStatus = "${temporalStatus}"`);
        }
      }

      if (workflowType) {
        conditions.push(`WorkflowType = "${workflowType}"`);
      }

      if (startTimeFrom) {
        conditions.push(`StartTime >= "${startTimeFrom}"`);
      }

      if (startTimeTo) {
        conditions.push(`StartTime <= "${startTimeTo}"`);
      }

      if (conditions.length > 0) {
        query = conditions.join(' AND ');
      }

      const workflows = query
        ? client.workflow.list({query})
        : client.workflow.list();

      const allResults: WorkflowInfo[] = [];

      for await (const workflow of workflows) {
        // Extract tenant ID from workflow ID if present
        let extractedTenantId: string | undefined;
        const uuidMatch = workflow.workflowId.match(
          /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i,
        );
        if (uuidMatch) {
          extractedTenantId = uuidMatch[0];
        }

        // Filter by tenantId if specified
        if (tenantId && extractedTenantId !== tenantId) {
          continue;
        }

        allResults.push({
          id: workflow.runId,
          workflowId: workflow.workflowId,
          workflowType: (workflow as any).type || 'Unknown',
          tenantId: extractedTenantId,
          tenantName: undefined,
          status: this.mapStatus(workflow.status.name),
          startTime: workflow.startTime?.toISOString() || new Date().toISOString(),
          endTime: workflow.closeTime?.toISOString(),
          runId: workflow.runId,
        });
      }

      // Sort by start time descending (newest first)
      allResults.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());

      // Apply pagination
      const total = allResults.length;
      const paginatedResults = allResults.slice(offset, offset + limit);

      return {
        data: paginatedResults,
        total,
        limit,
        offset,
      };
    } catch (error) {
      console.error('Failed to list workflows', error);
      return {data: [], total: 0, limit, offset};
    }
  }

  /**
   * Map frontend status to Temporal ExecutionStatus
   */
  private mapStatusToTemporal(status: string): string | null {
    switch (status.toLowerCase()) {
      case 'running':
        return 'Running';
      case 'completed':
        return 'Completed';
      case 'failed':
        return 'Failed';
      case 'cancelled':
      case 'canceled':
        return 'Canceled';
      case 'terminated':
        return 'Terminated';
      case 'timed_out':
        return 'TimedOut';
      default:
        return null;
    }
  }

  @authorize({
    permissions: [PermissionKey.ViewTenant],
  })
  @authenticate(STRATEGY.BEARER, {
    passReqToCallback: true,
  })
  @get(`${basePath}/{id}`, {
    security: OPERATION_SECURITY_SPEC,
    responses: {
      [STATUS_CODE.OK]: {
        description: 'Workflow execution details',
        content: {
          [CONTENT_TYPE.JSON]: {
            schema: {
              type: 'object',
            },
          },
        },
      },
    },
  })
  async findById(
    @param.path.string('id') id: string,
  ): Promise<WorkflowDetail | null> {
    try {
      const client = await this.getClient();
      const handle = client.workflow.getHandle(id);
      const description = await handle.describe();

      let result: unknown;
      let errorMessage: string | undefined;

      if (description.status.name === 'COMPLETED') {
        try {
          result = await handle.result();
        } catch (e) {
          // Result not available
        }
      } else if (description.status.name === 'FAILED') {
        errorMessage = 'Workflow failed';
      }

      return {
        id: description.runId,
        workflowId: description.workflowId,
        workflowType: description.type || 'Unknown',
        status: this.mapStatus(description.status.name),
        startTime: description.startTime?.toISOString() || new Date().toISOString(),
        endTime: description.closeTime?.toISOString(),
        runId: description.runId,
        result,
        error: errorMessage,
        memo: description.memo,
        searchAttributes: description.searchAttributes as Record<string, unknown>,
      };
    } catch (error) {
      console.error('Failed to get workflow', error);
      return null;
    }
  }

  /**
   * Restart a failed or terminated workflow.
   * This terminates the existing workflow (if running) and starts a new one.
   *
   * RBAC: Requires RestartWorkflow permission (10341)
   */
  @authorize({
    permissions: [PermissionKey.RestartWorkflow],
  })
  @authenticate(STRATEGY.BEARER, {
    passReqToCallback: true,
  })
  @post(`${basePath}/{id}/restart`, {
    security: OPERATION_SECURITY_SPEC,
    responses: {
      [STATUS_CODE.OK]: {
        description: 'Workflow restart result',
        content: {
          [CONTENT_TYPE.JSON]: {
            schema: {
              type: 'object',
              properties: {
                success: {type: 'boolean'},
                workflowId: {type: 'string'},
                message: {type: 'string'},
                action: {type: 'string'},
                performedBy: {type: 'string'},
                timestamp: {type: 'string'},
              },
            },
          },
        },
      },
      [STATUS_CODE.BAD_REQUEST]: {
        description: 'Cannot restart workflow in current state',
      },
      [STATUS_CODE.NOT_FOUND]: {
        description: 'Workflow not found',
      },
    },
  })
  async restart(
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        [CONTENT_TYPE.JSON]: {
          schema: {
            type: 'object',
            properties: {
              reason: {type: 'string', description: 'Reason for restart'},
            },
          },
        },
      },
    })
    body?: {reason?: string},
  ): Promise<WorkflowActionResult> {
    const performedBy = this.currentUser?.email || this.currentUser?.id || 'unknown';

    console.log(`[FLOW_RESTART] User ${performedBy} attempting to restart workflow: ${id}`);

    try {
      const client = await this.getClient();
      const handle = client.workflow.getHandle(id);

      // Get current workflow status
      const description = await handle.describe();
      const currentStatus = description.status.name;

      // Only allow restart for failed/terminated workflows
      const restartableStatuses = ['FAILED', 'TERMINATED', 'TIMED_OUT', 'CANCELLED', 'CANCELED'];
      if (!restartableStatuses.includes(currentStatus)) {
        throw new HttpErrors.BadRequest(
          `Cannot restart workflow in ${currentStatus} state. ` +
          `Restartable states: ${restartableStatuses.join(', ')}`
        );
      }

      // Get workflow type and args from memo if available
      const workflowType = description.type || 'TenantProvisioningWorkflow';
      const tenantId = this.extractTenantIdFromWorkflowId(id);

      if (!tenantId) {
        throw new HttpErrors.BadRequest(
          'Could not extract tenant ID from workflow ID. ' +
          'Expected format: provision-tenant-{uuid}'
        );
      }

      // Fetch full tenant data from database
      if (!this.tenantRepository || !this.subscriptionRepository || !this.contactRepository) {
        throw new HttpErrors.InternalServerError(
          'Required repositories not available for workflow restart'
        );
      }

      const tenant = await this.tenantRepository.findById(tenantId);
      if (!tenant) {
        throw new HttpErrors.NotFound(`Tenant ${tenantId} not found`);
      }

      // Fetch contacts for this tenant
      const contacts = await this.contactRepository.find({
        where: {tenantId},
      });

      // Fetch active subscription for this tenant
      const subscriptions = await this.subscriptionRepository.find({
        where: {tenantId, status: 'active'},
        limit: 1,
      });

      const subscription = subscriptions[0];
      if (!subscription) {
        throw new HttpErrors.BadRequest(
          `No active subscription found for tenant ${tenantId}. Cannot restart provisioning without subscription.`
        );
      }

      // Build the complete TenantProvisioningInput
      const provisioningInput: TenantProvisioningInput = {
        tenantId: tenant.id,
        tenantKey: tenant.key,
        tenantName: tenant.name,
        tier: (subscription.planTier === 'enterprise' ? 'silo' : 'pooled') as 'silo' | 'pooled' | 'bridge',
        domains: tenant.domains || [],
        contacts: contacts.map(c => ({
          firstName: c.firstName,
          lastName: c.lastName,
          email: c.email,
          isPrimary: c.isPrimary,
        })),
        subscription: {
          id: subscription.id,
          planId: subscription.planId,
          tier: (subscription.planTier === 'enterprise' ? 'silo' : 'pooled') as 'silo' | 'pooled' | 'bridge',
          startDate: subscription.currentPeriodStart?.toISOString() || new Date().toISOString(),
          endDate: subscription.currentPeriodEnd?.toISOString() || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        },
        idpConfig: {
          provider: (tenant.identityProvider || 'keycloak') as 'keycloak' | 'auth0' | 'cognito',
          createOrganization: true,
          createAdminUser: true,
        },
      };

      console.log(`[FLOW_RESTART] Built provisioning input for tenant ${tenantId}`, {
        tenantKey: provisioningInput.tenantKey,
        tier: provisioningInput.tier,
        contactCount: provisioningInput.contacts.length,
      });

      // Terminate the old workflow first (if somehow still running)
      try {
        await handle.terminate('Restarting workflow');
        console.log(`[FLOW_RESTART] Terminated old workflow: ${id}`);
      } catch (termError) {
        // Workflow may already be terminated, continue
        console.log(`[FLOW_RESTART] Workflow ${id} already terminated or termination not needed`);
      }

      // Start a new workflow with the complete provisioning input
      const newWorkflowId = `provision-tenant-${tenantId}`;
      const newHandle = await client.workflow.start(workflowType, {
        taskQueue: this.taskQueue,
        workflowId: newWorkflowId,
        args: [provisioningInput],
        memo: {
          restartedFrom: id,
          restartReason: body?.reason || 'Manual restart',
          restartedBy: performedBy,
          restartedAt: new Date().toISOString(),
        },
      });

      console.log(
        `[FLOW_RESTART] Successfully restarted workflow. ` +
        `Old: ${id}, New: ${newHandle.workflowId}, By: ${performedBy}`
      );

      return {
        success: true,
        workflowId: newHandle.workflowId,
        message: `Workflow restarted successfully. New workflow ID: ${newHandle.workflowId}`,
        action: 'restart',
        performedBy,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error(`[FLOW_ERROR] Failed to restart workflow ${id}:`, error);

      if (error instanceof HttpErrors.HttpError) {
        throw error;
      }

      throw new HttpErrors.InternalServerError(
        `Failed to restart workflow: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Cancel a running workflow.
   * This requests graceful cancellation - the workflow can handle cleanup.
   *
   * RBAC: Requires CancelWorkflow permission (10342)
   */
  @authorize({
    permissions: [PermissionKey.CancelWorkflow],
  })
  @authenticate(STRATEGY.BEARER, {
    passReqToCallback: true,
  })
  @post(`${basePath}/{id}/cancel`, {
    security: OPERATION_SECURITY_SPEC,
    responses: {
      [STATUS_CODE.OK]: {
        description: 'Workflow cancellation result',
        content: {
          [CONTENT_TYPE.JSON]: {
            schema: {
              type: 'object',
              properties: {
                success: {type: 'boolean'},
                workflowId: {type: 'string'},
                message: {type: 'string'},
                action: {type: 'string'},
                performedBy: {type: 'string'},
                timestamp: {type: 'string'},
              },
            },
          },
        },
      },
      [STATUS_CODE.BAD_REQUEST]: {
        description: 'Cannot cancel workflow in current state',
      },
      [STATUS_CODE.NOT_FOUND]: {
        description: 'Workflow not found',
      },
    },
  })
  async cancel(
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        [CONTENT_TYPE.JSON]: {
          schema: {
            type: 'object',
            properties: {
              reason: {type: 'string', description: 'Reason for cancellation'},
            },
          },
        },
      },
    })
    body?: {reason?: string},
  ): Promise<WorkflowActionResult> {
    const performedBy = this.currentUser?.email || this.currentUser?.id || 'unknown';

    console.log(`[FLOW_CANCEL] User ${performedBy} attempting to cancel workflow: ${id}`);

    try {
      const client = await this.getClient();
      const handle = client.workflow.getHandle(id);

      // Get current workflow status
      const description = await handle.describe();
      const currentStatus = description.status.name;

      // Only allow cancel for running workflows
      if (currentStatus !== 'RUNNING') {
        throw new HttpErrors.BadRequest(
          `Cannot cancel workflow in ${currentStatus} state. Only RUNNING workflows can be cancelled.`
        );
      }

      // Request cancellation (graceful)
      const reason = body?.reason || `Cancelled by ${performedBy}`;
      await handle.cancel();

      console.log(`[FLOW_CANCEL] Successfully cancelled workflow ${id}. By: ${performedBy}, Reason: ${reason}`);

      return {
        success: true,
        workflowId: id,
        message: `Workflow cancellation requested. Reason: ${reason}`,
        action: 'cancel',
        performedBy,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error(`[FLOW_ERROR] Failed to cancel workflow ${id}:`, error);

      if (error instanceof HttpErrors.HttpError) {
        throw error;
      }

      throw new HttpErrors.InternalServerError(
        `Failed to cancel workflow: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Terminate a workflow forcefully.
   * Unlike cancel, this does not allow the workflow to handle cleanup.
   *
   * RBAC: Requires CancelWorkflow permission (10342)
   */
  @authorize({
    permissions: [PermissionKey.CancelWorkflow],
  })
  @authenticate(STRATEGY.BEARER, {
    passReqToCallback: true,
  })
  @post(`${basePath}/{id}/terminate`, {
    security: OPERATION_SECURITY_SPEC,
    responses: {
      [STATUS_CODE.OK]: {
        description: 'Workflow termination result',
        content: {
          [CONTENT_TYPE.JSON]: {
            schema: {
              type: 'object',
              properties: {
                success: {type: 'boolean'},
                workflowId: {type: 'string'},
                message: {type: 'string'},
                action: {type: 'string'},
                performedBy: {type: 'string'},
                timestamp: {type: 'string'},
              },
            },
          },
        },
      },
    },
  })
  async terminate(
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        [CONTENT_TYPE.JSON]: {
          schema: {
            type: 'object',
            properties: {
              reason: {type: 'string', description: 'Reason for termination'},
            },
          },
        },
      },
    })
    body?: {reason?: string},
  ): Promise<WorkflowActionResult> {
    const performedBy = this.currentUser?.email || this.currentUser?.id || 'unknown';

    console.log(`[FLOW_TERMINATE] User ${performedBy} attempting to terminate workflow: ${id}`);

    try {
      const client = await this.getClient();
      const handle = client.workflow.getHandle(id);

      // Terminate immediately (no graceful handling)
      const reason = body?.reason || `Terminated by ${performedBy}`;
      await handle.terminate(reason);

      console.log(`[FLOW_TERMINATE] Successfully terminated workflow ${id}. By: ${performedBy}, Reason: ${reason}`);

      return {
        success: true,
        workflowId: id,
        message: `Workflow terminated. Reason: ${reason}`,
        action: 'cancel', // Using 'cancel' for type compatibility
        performedBy,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error(`[FLOW_ERROR] Failed to terminate workflow ${id}:`, error);

      if (error instanceof HttpErrors.HttpError) {
        throw error;
      }

      throw new HttpErrors.InternalServerError(
        `Failed to terminate workflow: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Extract tenant ID from workflow ID.
   * Workflow IDs follow pattern: provision-tenant-{uuid}
   */
  private extractTenantIdFromWorkflowId(workflowId: string): string | undefined {
    const uuidMatch = workflowId.match(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i,
    );
    return uuidMatch?.[0];
  }
}
