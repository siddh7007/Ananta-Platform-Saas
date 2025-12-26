import {Getter, inject} from '@loopback/core';
import {Entity, Where} from '@loopback/repository';
import {SequelizeDataSource} from '@loopback/sequelize';
import {SequelizeUserModifyCrudRepository} from '@sourceloop/core/sequelize';
import {IAuthUserWithPermissions} from '@sourceloop/core';
import {AuthenticationBindings} from 'loopback4-authentication';

import {
  NotificationHistory,
  NotificationHistoryRelations,
  NotificationStatus,
} from '../../models/notification-history.model';
import {NotificationChannel} from '../../models/notification-preference.model';
import {TenantManagementDbSourceName} from '../../types';

/**
 * Repository for notification delivery history.
 * Provides methods for tracking, querying, and analyzing notification deliveries.
 */
export class NotificationHistoryRepository<
  T extends NotificationHistory = NotificationHistory,
> extends SequelizeUserModifyCrudRepository<
  T,
  typeof NotificationHistory.prototype.id,
  NotificationHistoryRelations
> {
  constructor(
    @inject(`datasources.${TenantManagementDbSourceName}`)
    dataSource: SequelizeDataSource,
    @inject.getter(AuthenticationBindings.CURRENT_USER)
    public readonly getCurrentUser: Getter<IAuthUserWithPermissions>,
    @inject('models.NotificationHistory')
    private readonly notificationHistory: typeof Entity & {prototype: T},
  ) {
    super(notificationHistory as any, dataSource, getCurrentUser);
  }

  /**
   * Find notifications by tenant ID with pagination.
   */
  async findByTenantId(
    tenantId: string,
    options?: {
      limit?: number;
      offset?: number;
      channel?: NotificationChannel;
      status?: NotificationStatus;
      workflowId?: string;
      startDate?: Date;
      endDate?: Date;
    },
  ): Promise<T[]> {
    const where: Where<T> = {tenantId} as Where<T>;

    if (options?.channel) {
      (where as Record<string, unknown>).channel = options.channel;
    }
    if (options?.status) {
      (where as Record<string, unknown>).status = options.status;
    }
    if (options?.workflowId) {
      (where as Record<string, unknown>).workflowId = options.workflowId;
    }
    if (options?.startDate) {
      (where as Record<string, unknown>).createdOn = {gte: options.startDate};
    }
    if (options?.endDate) {
      const existing = (where as Record<string, unknown>).createdOn as Record<string, unknown> | undefined;
      if (existing) {
        existing.lte = options.endDate;
      } else {
        (where as Record<string, unknown>).createdOn = {lte: options.endDate};
      }
    }

    return this.find({
      where,
      order: ['createdOn DESC'],
      limit: options?.limit ?? 50,
      skip: options?.offset ?? 0,
    });
  }

  /**
   * Find notification by transaction ID.
   */
  async findByTransactionId(transactionId: string): Promise<T | null> {
    return this.findOne({
      where: {transactionId} as Where<T>,
    });
  }

  /**
   * Find notification by Novu message ID.
   */
  async findByNovuMessageId(novuMessageId: string): Promise<T | null> {
    return this.findOne({
      where: {novuMessageId} as Where<T>,
    });
  }

  /**
   * Update notification status.
   */
  async updateStatus(
    id: string,
    status: NotificationStatus,
    additionalData?: {
      errorMessage?: string;
      errorCode?: string;
      deliveredAt?: Date;
      openedAt?: Date;
      clickedAt?: Date;
      attempts?: number;
    },
  ): Promise<void> {
    const updateData: Partial<T> = {status} as Partial<T>;

    if (additionalData) {
      Object.assign(updateData, additionalData);
    }

    await this.updateById(id, updateData);
  }

  /**
   * Record a new notification being sent.
   */
  async recordNotification(data: {
    tenantId: string;
    workflowId: string;
    workflowName?: string;
    subscriberId: string;
    channel: NotificationChannel;
    recipientEmail?: string;
    recipientPhone?: string;
    subject?: string;
    payload?: Record<string, unknown>;
    transactionId?: string;
    novuMessageId?: string;
    category?: string;
  }): Promise<T> {
    return this.create({
      ...data,
      status: NotificationStatus.SENT,
      sentAt: new Date(),
      attempts: 1,
    } as Partial<T>);
  }

  /**
   * Get notification statistics for a tenant.
   */
  async getStatistics(
    tenantId: string,
    options?: {
      startDate?: Date;
      endDate?: Date;
    },
  ): Promise<{
    total: number;
    sent: number;
    delivered: number;
    failed: number;
    pending: number;
    bounced: number;
    opened: number;
    clicked: number;
    byChannel: Record<string, number>;
    byWorkflow: Record<string, number>;
  }> {
    const where: Where<T> = {tenantId} as Where<T>;

    if (options?.startDate) {
      (where as Record<string, unknown>).createdOn = {gte: options.startDate};
    }
    if (options?.endDate) {
      const existing = (where as Record<string, unknown>).createdOn as Record<string, unknown> | undefined;
      if (existing) {
        existing.lte = options.endDate;
      } else {
        (where as Record<string, unknown>).createdOn = {lte: options.endDate};
      }
    }

    const notifications = await this.find({where});

    const stats = {
      total: notifications.length,
      sent: 0,
      delivered: 0,
      failed: 0,
      pending: 0,
      bounced: 0,
      opened: 0,
      clicked: 0,
      byChannel: {} as Record<string, number>,
      byWorkflow: {} as Record<string, number>,
    };

    for (const n of notifications) {
      // Count by status
      switch (n.status) {
        case NotificationStatus.SENT:
          stats.sent++;
          break;
        case NotificationStatus.DELIVERED:
          stats.delivered++;
          break;
        case NotificationStatus.FAILED:
          stats.failed++;
          break;
        case NotificationStatus.PENDING:
          stats.pending++;
          break;
        case NotificationStatus.BOUNCED:
          stats.bounced++;
          break;
        case NotificationStatus.OPENED:
          stats.opened++;
          break;
        case NotificationStatus.CLICKED:
          stats.clicked++;
          break;
      }

      // Count by channel
      stats.byChannel[n.channel] = (stats.byChannel[n.channel] || 0) + 1;

      // Count by workflow
      const workflowKey = n.workflowName || n.workflowId;
      stats.byWorkflow[workflowKey] = (stats.byWorkflow[workflowKey] || 0) + 1;
    }

    return stats;
  }

  /**
   * Get delivery rate for a tenant.
   */
  async getDeliveryRate(
    tenantId: string,
    options?: {
      startDate?: Date;
      endDate?: Date;
    },
  ): Promise<number> {
    const stats = await this.getStatistics(tenantId, options);
    if (stats.total === 0) return 0;
    return ((stats.delivered + stats.opened + stats.clicked) / stats.total) * 100;
  }

  /**
   * Get recent failures for debugging.
   */
  async getRecentFailures(
    tenantId: string,
    limit = 20,
  ): Promise<T[]> {
    return this.find({
      where: {
        tenantId,
        status: {inq: [NotificationStatus.FAILED, NotificationStatus.BOUNCED]},
      } as Where<T>,
      order: ['createdOn DESC'],
      limit,
    });
  }

  /**
   * Delete old notifications (for cleanup/archival).
   */
  async deleteOlderThan(tenantId: string, date: Date): Promise<number> {
    const result = await this.deleteAll({
      tenantId,
      createdOn: {lt: date},
    } as Where<T>);
    return result.count;
  }
}
