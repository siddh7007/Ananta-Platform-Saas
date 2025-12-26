import {injectable, BindingScope} from '@loopback/core';
import {Client, Connection} from '@temporalio/client';
import {HttpErrors} from '@loopback/rest';

/**
 * Temporal client service for triggering workflows from tenant-management-service.
 * Provides a singleton Temporal client with connection pooling.
 */
@injectable({scope: BindingScope.SINGLETON})
export class TemporalClientService {
  private client: Client | null = null;
  private connection: Connection | null = null;
  private connecting: Promise<void> | null = null;

  private readonly temporalAddress: string;
  private readonly temporalNamespace: string;
  private readonly taskQueue: string;
  private readonly maxRetries: number;
  private readonly retryDelay: number;

  constructor() {
    this.temporalAddress = process.env.TEMPORAL_ADDRESS || 'localhost:7233';
    this.temporalNamespace = process.env.TEMPORAL_NAMESPACE || 'arc-saas';
    this.taskQueue = process.env.TEMPORAL_TASK_QUEUE || 'tenant-provisioning';
    this.maxRetries = parseInt(process.env.TEMPORAL_MAX_RETRIES || '3', 10);
    this.retryDelay = parseInt(process.env.TEMPORAL_RETRY_DELAY_MS || '2000', 10);
  }

  /**
   * Get or create Temporal client connection.
   * Uses singleton pattern with connection pooling.
   */
  private async getClient(): Promise<Client> {
    if (this.client) {
      return this.client;
    }

    // Prevent multiple concurrent connection attempts
    if (this.connecting) {
      await this.connecting;
      if (this.client) {
        return this.client;
      }
    }

    this.connecting = this.connect();
    await this.connecting;
    this.connecting = null;

    if (!this.client) {
      throw new HttpErrors.InternalServerError(
        'Failed to establish Temporal client connection',
      );
    }

    return this.client;
  }

  /**
   * Helper method to delay execution
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Establish connection to Temporal server with retry logic
   */
  private async connect(): Promise<void> {
    let lastError: Error | unknown;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        this.connection = await Connection.connect({
          address: this.temporalAddress,
        });

        this.client = new Client({
          connection: this.connection,
          namespace: this.temporalNamespace,
        });

        console.info('Temporal client connected', {
          address: this.temporalAddress,
          namespace: this.temporalNamespace,
          attempt,
        });

        return; // Success!
      } catch (error) {
        lastError = error;
        console.warn(`Failed to connect to Temporal (attempt ${attempt}/${this.maxRetries})`, {
          address: this.temporalAddress,
          error: error instanceof Error ? error.message : 'Unknown error',
        });

        // If not the last attempt, wait before retrying
        if (attempt < this.maxRetries) {
          await this.delay(this.retryDelay * attempt); // Exponential backoff
        }
      }
    }

    // All retries failed
    console.error('Failed to connect to Temporal after max retries', {
      address: this.temporalAddress,
      maxRetries: this.maxRetries,
      error: lastError instanceof Error ? lastError.message : 'Unknown error',
    });

    throw lastError;
  }

  /**
   * Start a user invitation workflow
   */
  async startUserInvitationWorkflow(input: {
    email: string;
    firstName?: string;
    lastName?: string;
    roleKey: string;
    tenantId: string;
    invitedBy: string;
    expiresInDays?: number;
  }): Promise<{
    workflowId: string;
    runId: string;
  }> {
    const client = await this.getClient();

    // Generate unique workflow ID
    const workflowId = `user-invitation-${input.tenantId}-${input.email}-${Date.now()}`;

    try {
      const handle = await client.workflow.start('userInvitationWorkflow', {
        taskQueue: this.taskQueue,
        workflowId,
        args: [input],
        // Workflow timeout - 5 minutes should be enough for invitation
        workflowExecutionTimeout: '5 minutes',
      });

      console.info('User invitation workflow started', {
        workflowId: handle.workflowId,
        runId: handle.firstExecutionRunId,
        email: input.email,
        tenantId: input.tenantId,
      });

      return {
        workflowId: handle.workflowId,
        runId: handle.firstExecutionRunId,
      };
    } catch (error) {
      console.error('Failed to start user invitation workflow', {
        workflowId,
        email: input.email,
        tenantId: input.tenantId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new HttpErrors.InternalServerError(
        `Failed to start invitation workflow: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Get workflow status by ID
   */
  async getWorkflowStatus(workflowId: string): Promise<{
    status: string;
    result?: unknown;
    error?: string;
  }> {
    const client = await this.getClient();

    try {
      const handle = client.workflow.getHandle(workflowId);
      const description = await handle.describe();

      return {
        status: description.status.name,
        result: description.status.name === 'COMPLETED' ? await handle.result() : undefined,
      };
    } catch (error) {
      console.error('Failed to get workflow status', {
        workflowId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return {
        status: 'UNKNOWN',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Type guard for InvitationWorkflowStatus
   */
  private isInvitationWorkflowStatus(value: unknown): value is {
    step: string;
    progress: number;
    message?: string;
    emailSent?: boolean;
  } {
    return (
      typeof value === 'object' &&
      value !== null &&
      'step' in value &&
      'progress' in value &&
      typeof (value as any).step === 'string' &&
      typeof (value as any).progress === 'number'
    );
  }

  /**
   * Query workflow for invitation status
   */
  async getInvitationWorkflowStatus(workflowId: string): Promise<{
    step: string;
    progress: number;
    message?: string;
    emailSent?: boolean;
  }> {
    const client = await this.getClient();

    try {
      const handle = client.workflow.getHandle(workflowId);
      const status = await handle.query('getInvitationStatus');

      // Validate the response type
      if (!this.isInvitationWorkflowStatus(status)) {
        throw new HttpErrors.InternalServerError(
          'Invalid workflow status response format',
        );
      }

      return status;
    } catch (error) {
      console.error('Failed to query invitation workflow status', {
        workflowId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new HttpErrors.InternalServerError(
        `Failed to query workflow: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Start a sync user role workflow
   * Used when roles are assigned, updated, or revoked in Control Plane
   * to sync the changes to App Plane (Supabase).
   */
  async startSyncUserRoleWorkflow(input: {
    operation: 'assign' | 'update' | 'revoke';
    tenantId: string;
    tenantKey?: string;
    userId: string;
    userEmail: string;
    firstName?: string;
    lastName?: string;
    keycloakUserId?: string;
    roleKey: string;
    previousRoleKey?: string;
    scopeType?: string;
    scopeId?: string;
    performedBy: string;
  }): Promise<{
    workflowId: string;
    runId: string;
  }> {
    const client = await this.getClient();

    // Generate unique workflow ID
    const workflowId = `sync-user-role-${input.operation}-${input.tenantId}-${input.userId}-${Date.now()}`;

    try {
      const handle = await client.workflow.start('syncUserRoleWorkflow', {
        taskQueue: this.taskQueue,
        workflowId,
        args: [input],
        // Workflow timeout - 2 minutes should be enough for role sync
        workflowExecutionTimeout: '2 minutes',
      });

      console.info('Sync user role workflow started', {
        workflowId: handle.workflowId,
        runId: handle.firstExecutionRunId,
        operation: input.operation,
        userEmail: input.userEmail,
        tenantId: input.tenantId,
        roleKey: input.roleKey,
      });

      return {
        workflowId: handle.workflowId,
        runId: handle.firstExecutionRunId,
      };
    } catch (error) {
      console.error('Failed to start sync user role workflow', {
        workflowId,
        operation: input.operation,
        userEmail: input.userEmail,
        tenantId: input.tenantId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      // Don't throw - role sync is non-critical, log and continue
      // The sync can be retried manually if needed
      return {
        workflowId: '',
        runId: '',
      };
    }
  }

  /**
   * Close the Temporal connection (for graceful shutdown)
   */
  async close(): Promise<void> {
    if (this.connection) {
      await this.connection.close();
      this.connection = null;
      this.client = null;
      console.info('Temporal client connection closed');
    }
  }
}
