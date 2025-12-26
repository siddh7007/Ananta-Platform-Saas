import {BindingScope, inject, injectable, service, lifeCycleObserver, LifeCycleObserver} from '@loopback/core';
import {repository} from '@loopback/repository';
import {juggler} from '@loopback/repository';
import {HttpErrors} from '@loopback/rest';
import {ILogger, LOGGER} from '@sourceloop/core';
import {TenantStatus} from '../enums';
import {SubscriptionDTO, TenantWithRelations} from '../models';
import {TenantRepository} from '../repositories';
import {TemporalProvisioningService} from './temporal-provisioning.service';

const MAX_RETRIES = 5;
const RETRY_DELAYS = [60, 300, 900, 3600, 7200]; // seconds: 1m, 5m, 15m, 1h, 2h
const RETRY_CHECK_INTERVAL = 30000; // 30 seconds
const REDIS_KEY_PREFIX = 'provisioning-retry:';
const DEAD_LETTER_PREFIX = 'provisioning-retry-dead-letter:';

// UUID v4 validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface ProvisioningRetryRecord {
  tenantId: string;
  subscriptionId: string;
  retryCount: number;
  lastAttempt: Date;
  nextAttempt: Date;
  lastError: string;
  status: 'pending' | 'retrying' | 'failed' | 'succeeded';
  originalSubscription?: Partial<SubscriptionDTO>; // Preserve original subscription context
}

@injectable({scope: BindingScope.SINGLETON})
@lifeCycleObserver('service')
export class ProvisioningRetryService implements LifeCycleObserver {
  private intervalTimer: NodeJS.Timeout | undefined;
  private useRedis: boolean = false;
  private kvConnector: any;
  private inMemoryQueue: Map<string, ProvisioningRetryRecord> = new Map();
  private isProcessing: boolean = false; // Guard against concurrent processing

  constructor(
    @inject('datasources.TenantManagementCacheDB')
    private cacheDataSource: juggler.DataSource,
    @repository(TenantRepository)
    private tenantRepository: TenantRepository,
    @service(TemporalProvisioningService)
    private temporalProvisioningService: TemporalProvisioningService<SubscriptionDTO>,
    @inject(LOGGER.LOGGER_INJECT)
    private logger: ILogger,
  ) {
    this.initialize();
  }

  private async initialize() {
    try {
      this.kvConnector = await this.cacheDataSource.connector;
      this.useRedis = this.kvConnector?.name === 'kv-redis';

      if (!this.useRedis) {
        this.logger.warn(
          '[ProvisioningRetry] Redis not configured, using in-memory queue. Retries will not persist across restarts.',
        );
      }

      this.startRetryProcessor();
      this.logger.info('[ProvisioningRetry] Retry processor started');
    } catch (error) {
      this.logger.error(
        `[ProvisioningRetry] Failed to initialize: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  private startRetryProcessor() {
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
    }

    this.intervalTimer = setInterval(async () => {
      // Guard against concurrent processing
      if (this.isProcessing) {
        this.logger.warn('[ProvisioningRetry] Previous batch still processing, skipping this tick');
        return;
      }

      try {
        this.isProcessing = true;
        await this.processRetryQueue();
      } catch (error) {
        this.logger.error(
          `[ProvisioningRetry] Error in retry processor: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      } finally {
        this.isProcessing = false;
      }
    }, RETRY_CHECK_INTERVAL);
  }

  private isValidUUID(id: string): boolean {
    return UUID_REGEX.test(id);
  }

  async queueForRetry(
    tenantId: string,
    subscriptionId: string,
    error: string,
    originalSubscription?: Partial<SubscriptionDTO>,
  ): Promise<void> {
    // Validate UUIDs
    if (!this.isValidUUID(tenantId)) {
      throw new HttpErrors.BadRequest(`Invalid tenant ID format: ${tenantId}`);
    }
    if (!this.isValidUUID(subscriptionId)) {
      throw new HttpErrors.BadRequest(`Invalid subscription ID format: ${subscriptionId}`);
    }

    const now = new Date();
    // Add jitter to prevent retry storms (10% random variance)
    const jitter = Math.random() * 0.1 * RETRY_DELAYS[0];
    const record: ProvisioningRetryRecord = {
      tenantId,
      subscriptionId,
      retryCount: 0,
      lastAttempt: now,
      nextAttempt: new Date(now.getTime() + (RETRY_DELAYS[0] + jitter) * 1000),
      lastError: error,
      status: 'pending',
      originalSubscription, // Preserve original subscription context
    };

    await this.saveRecord(tenantId, record);

    await this.tenantRepository.updateById(tenantId, {
      status: TenantStatus.QUEUED_FOR_RETRY,
    });

    this.logger.info(
      `[ProvisioningRetry] Queued tenant ${tenantId} for retry. Next attempt at ${record.nextAttempt.toISOString()}`,
    );
  }

  async processRetryQueue(): Promise<void> {
    const pendingRetries = await this.getAllPendingRetries();
    const now = new Date();

    for (const record of pendingRetries) {
      if (record.status !== 'pending' && record.status !== 'retrying') {
        continue;
      }

      if (now < record.nextAttempt) {
        continue;
      }

      this.logger.info(
        `[ProvisioningRetry] Processing retry for tenant ${record.tenantId}, attempt ${record.retryCount + 1}/${MAX_RETRIES}`,
      );

      record.status = 'retrying';
      record.lastAttempt = now;
      await this.saveRecord(record.tenantId, record);

      try {
        // Verify tenant still exists and is in retriable state
        let tenant: TenantWithRelations | null = null;
        try {
          tenant = await this.tenantRepository.findById(record.tenantId, {
            include: [
              {relation: 'contacts'},
              {relation: 'address'},
              {relation: 'lead'},
            ],
          }) as TenantWithRelations;
        } catch {
          // Tenant was deleted
          this.logger.error(`[ProvisioningRetry] Tenant ${record.tenantId} not found, removing from retry queue`);
          await this.deleteRecord(record.tenantId);
          continue;
        }

        // Check if tenant is already provisioned
        if (tenant.status === TenantStatus.ACTIVE || tenant.status === TenantStatus.INACTIVE) {
          this.logger.warn(`[ProvisioningRetry] Tenant ${record.tenantId} already in state ${tenant.status}, removing from retry queue`);
          await this.deleteRecord(record.tenantId);
          continue;
        }

        // Use original subscription context if available, otherwise fallback to defaults
        const subscription: SubscriptionDTO = {
          id: record.subscriptionId,
          planId: record.originalSubscription?.planId || 'plan-basic',
          subscriberId: record.tenantId,
          startDate: record.originalSubscription?.startDate || new Date().toISOString(),
          endDate: record.originalSubscription?.endDate || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
          status: record.originalSubscription?.status ?? 0,
          invoiceId: record.originalSubscription?.invoiceId || '',
        };

        await this.temporalProvisioningService.provisionTenant(
          tenant,
          subscription,
        );

        record.status = 'succeeded';
        await this.saveRecord(record.tenantId, record);
        await this.deleteRecord(record.tenantId);

        this.logger.info(
          `[ProvisioningRetry] Successfully provisioned tenant ${record.tenantId} on retry`,
        );
      } catch (retryError) {
        const errorMessage =
          retryError instanceof Error ? retryError.message : 'Unknown error';
        record.lastError = errorMessage;
        record.retryCount++;

        if (record.retryCount >= MAX_RETRIES) {
          record.status = 'failed';
          await this.moveToDeadLetter(record);
          await this.deleteRecord(record.tenantId);

          await this.tenantRepository.updateById(record.tenantId, {
            status: TenantStatus.PROVISIONFAILED,
          });

          this.logger.error(
            `[ProvisioningRetry] Max retries exceeded for tenant ${record.tenantId}. Moved to dead letter queue.`,
          );
        } else {
          const delaySeconds = RETRY_DELAYS[record.retryCount];
          record.nextAttempt = new Date(now.getTime() + delaySeconds * 1000);
          record.status = 'pending';
          await this.saveRecord(record.tenantId, record);

          this.logger.warn(
            `[ProvisioningRetry] Retry ${record.retryCount}/${MAX_RETRIES} failed for tenant ${record.tenantId}. Next attempt at ${record.nextAttempt.toISOString()}. Error: ${errorMessage}`,
          );
        }
      }
    }
  }

  async getRetryStatus(
    tenantId: string,
  ): Promise<ProvisioningRetryRecord | undefined> {
    return this.getRecord(tenantId);
  }

  async getAllPendingRetries(): Promise<ProvisioningRetryRecord[]> {
    if (this.useRedis) {
      try {
        const keys = await this.scanKeys(`${REDIS_KEY_PREFIX}*`);
        const records: ProvisioningRetryRecord[] = [];

        for (const key of keys) {
          const value = await this.kvConnector.get(key);
          if (value) {
            const record = JSON.parse(value);
            record.lastAttempt = new Date(record.lastAttempt);
            record.nextAttempt = new Date(record.nextAttempt);
            records.push(record);
          }
        }

        return records;
      } catch (error) {
        this.logger.error(
          `[ProvisioningRetry] Error reading from Redis: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
        return [];
      }
    } else {
      return Array.from(this.inMemoryQueue.values());
    }
  }

  async cancelRetry(tenantId: string): Promise<boolean> {
    const record = await this.getRecord(tenantId);

    if (!record) {
      return false;
    }

    await this.deleteRecord(tenantId);

    await this.tenantRepository.updateById(tenantId, {
      status: TenantStatus.PROVISION_CANCELLED,
    });

    this.logger.info(`[ProvisioningRetry] Cancelled retry for tenant ${tenantId}`);
    return true;
  }

  private async saveRecord(
    tenantId: string,
    record: ProvisioningRetryRecord,
  ): Promise<void> {
    if (this.useRedis) {
      try {
        const key = `${REDIS_KEY_PREFIX}${tenantId}`;
        await this.kvConnector.set(key, JSON.stringify(record));
      } catch (error) {
        this.logger.error(
          `[ProvisioningRetry] Error saving to Redis: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
        this.inMemoryQueue.set(tenantId, record);
      }
    } else {
      this.inMemoryQueue.set(tenantId, record);
    }
  }

  private async getRecord(
    tenantId: string,
  ): Promise<ProvisioningRetryRecord | undefined> {
    if (this.useRedis) {
      try {
        const key = `${REDIS_KEY_PREFIX}${tenantId}`;
        const value = await this.kvConnector.get(key);

        if (value) {
          const record = JSON.parse(value);
          record.lastAttempt = new Date(record.lastAttempt);
          record.nextAttempt = new Date(record.nextAttempt);
          return record;
        }
      } catch (error) {
        this.logger.error(
          `[ProvisioningRetry] Error reading from Redis: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }
    }

    return this.inMemoryQueue.get(tenantId);
  }

  private async deleteRecord(tenantId: string): Promise<void> {
    if (this.useRedis) {
      try {
        const key = `${REDIS_KEY_PREFIX}${tenantId}`;
        await this.kvConnector.delete(key);
      } catch (error) {
        this.logger.error(
          `[ProvisioningRetry] Error deleting from Redis: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }
    }

    this.inMemoryQueue.delete(tenantId);
  }

  private async moveToDeadLetter(record: ProvisioningRetryRecord): Promise<void> {
    if (this.useRedis) {
      try {
        const key = `${DEAD_LETTER_PREFIX}${record.tenantId}`;
        await this.kvConnector.set(key, JSON.stringify(record));
      } catch (error) {
        this.logger.error(
          `[ProvisioningRetry] Error moving to dead letter queue: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }
    }

    this.logger.error(
      `[ProvisioningRetry] Dead letter record for tenant ${record.tenantId}: ${JSON.stringify(record)}`,
    );
  }

  private async scanKeys(pattern: string): Promise<string[]> {
    if (!this.useRedis) {
      return [];
    }

    try {
      return new Promise((resolve, reject) => {
        this.kvConnector.keys(pattern, (err: Error, keys: string[]) => {
          if (err) {
            reject(err);
          } else {
            resolve(keys || []);
          }
        });
      });
    } catch (error) {
      this.logger.error(
        `[ProvisioningRetry] Error scanning keys: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      return [];
    }
  }

  async stop(): Promise<void> {
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
      this.intervalTimer = undefined;
      this.logger.info('[ProvisioningRetry] Retry processor stopped');
    }
  }
}
