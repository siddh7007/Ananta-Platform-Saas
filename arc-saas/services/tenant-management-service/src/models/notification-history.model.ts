import {model, property} from '@loopback/repository';
import {UserModifiableEntity} from '@sourceloop/core';
import {NotificationChannel} from './notification-preference.model';

/**
 * Notification delivery status.
 */
export enum NotificationStatus {
  PENDING = 'pending',
  SENT = 'sent',
  DELIVERED = 'delivered',
  FAILED = 'failed',
  BOUNCED = 'bounced',
  OPENED = 'opened',
  CLICKED = 'clicked',
}

/**
 * NotificationHistory model for local persistence of notification delivery records.
 * This provides an audit trail independent of Novu API availability.
 */
@model({
  name: 'notification_history',
  description: 'Notification delivery history for audit and analytics',
  settings: {
    indexes: {
      idx_notification_history_tenant: {
        keys: {tenant_id: 1},
      },
      idx_notification_history_tenant_created: {
        keys: {tenant_id: 1, created_on: -1},
      },
      idx_notification_history_workflow: {
        keys: {workflow_id: 1},
      },
      idx_notification_history_status: {
        keys: {status: 1},
      },
      idx_notification_history_channel: {
        keys: {channel: 1},
      },
      idx_notification_history_transaction: {
        keys: {transaction_id: 1},
        options: {unique: true, sparse: true},
      },
    },
  },
})
export class NotificationHistory extends UserModifiableEntity {
  @property({
    type: 'string',
    id: true,
    generated: true,
    postgresql: {
      dataType: 'uuid',
    },
  })
  id: string;

  @property({
    type: 'string',
    required: true,
    name: 'tenant_id',
    postgresql: {
      dataType: 'uuid',
    },
    description: 'Tenant this notification was sent for',
  })
  tenantId: string;

  @property({
    type: 'string',
    required: true,
    name: 'workflow_id',
    description: 'Novu workflow/template ID used',
  })
  workflowId: string;

  @property({
    type: 'string',
    name: 'workflow_name',
    description: 'Human-readable workflow name',
  })
  workflowName?: string;

  @property({
    type: 'string',
    required: true,
    name: 'subscriber_id',
    description: 'Novu subscriber ID (format: tenant-{tenantId}-{email})',
  })
  subscriberId: string;

  @property({
    type: 'string',
    required: true,
    name: 'channel',
    jsonSchema: {
      enum: Object.values(NotificationChannel),
    },
    description: 'Notification channel used',
  })
  channel: NotificationChannel;

  @property({
    type: 'string',
    required: true,
    name: 'status',
    jsonSchema: {
      enum: Object.values(NotificationStatus),
    },
    default: NotificationStatus.PENDING,
    description: 'Delivery status',
  })
  status: NotificationStatus;

  @property({
    type: 'string',
    name: 'recipient_email',
    description: 'Email address of recipient (if email channel)',
  })
  recipientEmail?: string;

  @property({
    type: 'string',
    name: 'recipient_phone',
    description: 'Phone number of recipient (if SMS channel)',
  })
  recipientPhone?: string;

  @property({
    type: 'string',
    name: 'subject',
    description: 'Email subject or notification title',
  })
  subject?: string;

  @property({
    type: 'object',
    name: 'payload',
    postgresql: {
      dataType: 'jsonb',
    },
    description: 'Notification payload/variables sent',
  })
  payload?: Record<string, unknown>;

  @property({
    type: 'string',
    name: 'transaction_id',
    description: 'Unique transaction ID from Novu',
  })
  transactionId?: string;

  @property({
    type: 'string',
    name: 'novu_message_id',
    description: 'Novu message/notification ID',
  })
  novuMessageId?: string;

  @property({
    type: 'number',
    name: 'attempts',
    default: 1,
    description: 'Number of delivery attempts',
  })
  attempts?: number;

  @property({
    type: 'string',
    name: 'error_message',
    description: 'Error message if delivery failed',
  })
  errorMessage?: string;

  @property({
    type: 'string',
    name: 'error_code',
    description: 'Error code if delivery failed',
  })
  errorCode?: string;

  @property({
    type: 'date',
    name: 'sent_at',
    description: 'When the notification was sent',
  })
  sentAt?: Date;

  @property({
    type: 'date',
    name: 'delivered_at',
    description: 'When the notification was delivered',
  })
  deliveredAt?: Date;

  @property({
    type: 'date',
    name: 'opened_at',
    description: 'When the notification was opened (if tracked)',
  })
  openedAt?: Date;

  @property({
    type: 'date',
    name: 'clicked_at',
    description: 'When a link was clicked (if tracked)',
  })
  clickedAt?: Date;

  @property({
    type: 'string',
    name: 'category',
    description: 'Notification category (billing, subscription, etc.)',
  })
  category?: string;

  @property({
    type: 'object',
    name: 'metadata',
    postgresql: {
      dataType: 'jsonb',
    },
    description: 'Additional metadata',
  })
  metadata?: Record<string, unknown>;

  constructor(data?: Partial<NotificationHistory>) {
    super(data);
  }
}

export interface NotificationHistoryRelations {}

export type NotificationHistoryWithRelations = NotificationHistory &
  NotificationHistoryRelations;
