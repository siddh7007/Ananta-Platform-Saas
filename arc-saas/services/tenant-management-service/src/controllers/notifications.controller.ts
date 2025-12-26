import {get, post, put, param, requestBody, HttpErrors} from '@loopback/rest';
import {inject} from '@loopback/core';
import {service} from '@loopback/core';
import {repository} from '@loopback/repository';
import {
  CONTENT_TYPE,
  OPERATION_SECURITY_SPEC,
  STATUS_CODE,
  getModelSchemaRefSF,
} from '@sourceloop/core';
import {authenticate, STRATEGY, AuthenticationBindings} from 'loopback4-authentication';
import {authorize} from 'loopback4-authorization';
import {PermissionKey} from '../permissions';
import {IAuthUserWithPermissions} from '@sourceloop/core';
import {
  NotificationAdminService,
  NotificationTemplateDto,
  NotificationHistoryDto,
  SubscriberDto,
  SendNotificationResult,
} from '../services/notification-admin.service';
import {
  NotificationPreference,
  NotificationCategory,
  NotificationChannel,
} from '../models/notification-preference.model';
import {NotificationHistory, NotificationStatus} from '../models/notification-history.model';
import {NotificationPreferenceRepository, NotificationHistoryRepository} from '../repositories/sequelize';

const basePath = '/notifications';

/**
 * Request body for sending a test notification
 */
interface TestNotificationRequest {
  templateId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  payload?: Record<string, unknown>;
}

/**
 * Notifications Controller
 *
 * Provides admin endpoints for managing notifications via Novu.
 * All data is proxied from Novu's API - we don't persist locally.
 *
 * Endpoints:
 * - GET /notifications/templates - List notification templates
 * - GET /notifications/templates/{id} - Get template details
 * - GET /notifications/history - Get notification history for tenant
 * - GET /notifications/subscribers - List subscribers for tenant
 * - GET /notifications/subscribers/{id} - Get subscriber details
 * - POST /notifications/test - Send a test notification
 * - GET /notifications/health - Check Novu connectivity
 */
export class NotificationsController {
  constructor(
    @inject(AuthenticationBindings.CURRENT_USER, {optional: true})
    private readonly currentUser?: IAuthUserWithPermissions,
    @service(NotificationAdminService)
    private readonly notificationAdminService?: NotificationAdminService,
    @repository(NotificationPreferenceRepository)
    private readonly preferenceRepository?: NotificationPreferenceRepository,
    @repository(NotificationHistoryRepository)
    private readonly historyRepository?: NotificationHistoryRepository,
  ) {}

  /**
   * Get tenant ID from current user context
   */
  private getTenantId(): string {
    const tenantId = this.currentUser?.tenantId;
    if (!tenantId) {
      throw new HttpErrors.Forbidden('Tenant context required');
    }
    return tenantId;
  }

  // ============================================
  // Template Endpoints
  // ============================================

  @authenticate(STRATEGY.BEARER, {passReqToCallback: true})
  @authorize({permissions: [PermissionKey.ViewNotifications, PermissionKey.ManageNotificationTemplates]})
  @get(`${basePath}/templates`, {
    security: OPERATION_SECURITY_SPEC,
    summary: 'List all notification templates',
    description: 'Returns all notification workflows/templates from Novu',
    responses: {
      [STATUS_CODE.OK]: {
        description: 'Array of notification templates',
        content: {
          [CONTENT_TYPE.JSON]: {
            schema: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: {type: 'string'},
                  name: {type: 'string'},
                  description: {type: 'string'},
                  active: {type: 'boolean'},
                  createdAt: {type: 'string', format: 'date-time'},
                  updatedAt: {type: 'string', format: 'date-time'},
                },
              },
            },
          },
        },
      },
    },
  })
  async listTemplates(): Promise<NotificationTemplateDto[]> {
    // Ensure tenant context exists (for audit purposes)
    this.getTenantId();

    if (!this.notificationAdminService) {
      throw new HttpErrors.ServiceUnavailable('Notification service not available');
    }

    return this.notificationAdminService.listTemplates();
  }

  @authenticate(STRATEGY.BEARER, {passReqToCallback: true})
  @authorize({permissions: [PermissionKey.ViewNotifications, PermissionKey.ManageNotificationTemplates]})
  @get(`${basePath}/templates/{id}`, {
    security: OPERATION_SECURITY_SPEC,
    summary: 'Get template details',
    description: 'Returns a single notification template by ID',
    responses: {
      [STATUS_CODE.OK]: {
        description: 'Notification template details',
        content: {
          [CONTENT_TYPE.JSON]: {
            schema: {
              type: 'object',
              properties: {
                id: {type: 'string'},
                name: {type: 'string'},
                description: {type: 'string'},
                triggers: {type: 'array'},
                steps: {type: 'array'},
                active: {type: 'boolean'},
                createdAt: {type: 'string', format: 'date-time'},
                updatedAt: {type: 'string', format: 'date-time'},
              },
            },
          },
        },
      },
      [STATUS_CODE.NOT_FOUND]: {
        description: 'Template not found',
      },
    },
  })
  async getTemplate(
    @param.path.string('id') id: string,
  ): Promise<NotificationTemplateDto> {
    this.getTenantId();

    if (!this.notificationAdminService) {
      throw new HttpErrors.ServiceUnavailable('Notification service not available');
    }

    const template = await this.notificationAdminService.getTemplate(id);
    if (!template) {
      throw new HttpErrors.NotFound(`Template with ID ${id} not found`);
    }

    return template;
  }

  // ============================================
  // History Endpoints
  // ============================================

  @authenticate(STRATEGY.BEARER, {passReqToCallback: true})
  @authorize({permissions: [PermissionKey.ViewNotifications, PermissionKey.ViewNotificationHistory]})
  @get(`${basePath}/history`, {
    security: OPERATION_SECURITY_SPEC,
    summary: 'Get notification history for tenant',
    description: 'Returns notification delivery history filtered by current tenant',
    responses: {
      [STATUS_CODE.OK]: {
        description: 'Notification history',
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
                      transactionId: {type: 'string'},
                      templateId: {type: 'string'},
                      templateName: {type: 'string'},
                      subscriberId: {type: 'string'},
                      channel: {type: 'string'},
                      status: {type: 'string', enum: ['sent', 'error', 'pending', 'warning']},
                      createdAt: {type: 'string', format: 'date-time'},
                    },
                  },
                },
                total: {type: 'number'},
                hasMore: {type: 'boolean'},
              },
            },
          },
        },
      },
    },
  })
  async getHistory(
    @param.query.number('page') page?: number,
    @param.query.number('limit') limit?: number,
    @param.query.string('channel') channel?: string,
  ): Promise<{data: NotificationHistoryDto[]; total: number; hasMore: boolean}> {
    const tenantId = this.getTenantId();

    if (!this.notificationAdminService) {
      throw new HttpErrors.ServiceUnavailable('Notification service not available');
    }

    return this.notificationAdminService.getHistoryForTenant(tenantId, {
      page: page || 0,
      limit: Math.min(limit || 20, 100),
      channel,
    });
  }

  // ============================================
  // Subscriber Endpoints
  // ============================================

  @authenticate(STRATEGY.BEARER, {passReqToCallback: true})
  @authorize({permissions: [PermissionKey.ViewNotifications]})
  @get(`${basePath}/subscribers`, {
    security: OPERATION_SECURITY_SPEC,
    summary: 'List subscribers for tenant',
    description: 'Returns all notification subscribers belonging to current tenant',
    responses: {
      [STATUS_CODE.OK]: {
        description: 'Array of subscribers',
        content: {
          [CONTENT_TYPE.JSON]: {
            schema: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  subscriberId: {type: 'string'},
                  email: {type: 'string'},
                  firstName: {type: 'string'},
                  lastName: {type: 'string'},
                  createdAt: {type: 'string', format: 'date-time'},
                },
              },
            },
          },
        },
      },
    },
  })
  async listSubscribers(
    @param.query.number('page') page?: number,
    @param.query.number('limit') limit?: number,
  ): Promise<SubscriberDto[]> {
    const tenantId = this.getTenantId();

    if (!this.notificationAdminService) {
      throw new HttpErrors.ServiceUnavailable('Notification service not available');
    }

    return this.notificationAdminService.listSubscribersForTenant(tenantId, {
      page: page || 0,
      limit: Math.min(limit || 20, 100),
    });
  }

  @authenticate(STRATEGY.BEARER, {passReqToCallback: true})
  @authorize({permissions: [PermissionKey.ViewNotifications]})
  @get(`${basePath}/subscribers/{id}`, {
    security: OPERATION_SECURITY_SPEC,
    summary: 'Get subscriber details',
    description: 'Returns details for a specific subscriber',
    responses: {
      [STATUS_CODE.OK]: {
        description: 'Subscriber details',
        content: {
          [CONTENT_TYPE.JSON]: {
            schema: {
              type: 'object',
              properties: {
                subscriberId: {type: 'string'},
                email: {type: 'string'},
                firstName: {type: 'string'},
                lastName: {type: 'string'},
                phone: {type: 'string'},
                data: {type: 'object'},
                createdAt: {type: 'string', format: 'date-time'},
              },
            },
          },
        },
      },
      [STATUS_CODE.NOT_FOUND]: {
        description: 'Subscriber not found',
      },
    },
  })
  async getSubscriber(
    @param.path.string('id') id: string,
  ): Promise<SubscriberDto> {
    const tenantId = this.getTenantId();

    if (!this.notificationAdminService) {
      throw new HttpErrors.ServiceUnavailable('Notification service not available');
    }

    // Verify subscriber belongs to tenant
    const tenantPrefix = `tenant-${tenantId}-`;
    if (!id.startsWith(tenantPrefix)) {
      throw new HttpErrors.Forbidden('Subscriber does not belong to this tenant');
    }

    const subscriber = await this.notificationAdminService.getSubscriber(id);
    if (!subscriber) {
      throw new HttpErrors.NotFound(`Subscriber with ID ${id} not found`);
    }

    return subscriber;
  }

  // ============================================
  // Test Notification
  // ============================================

  @authenticate(STRATEGY.BEARER, {passReqToCallback: true})
  @authorize({permissions: [PermissionKey.SendTestNotification, PermissionKey.ManageNotificationTemplates]})
  @post(`${basePath}/test`, {
    security: OPERATION_SECURITY_SPEC,
    summary: 'Send a test notification',
    description: 'Sends a test notification to verify template configuration',
    responses: {
      [STATUS_CODE.OK]: {
        description: 'Test notification result',
        content: {
          [CONTENT_TYPE.JSON]: {
            schema: {
              type: 'object',
              properties: {
                success: {type: 'boolean'},
                transactionId: {type: 'string'},
                error: {type: 'string'},
              },
            },
          },
        },
      },
      [STATUS_CODE.BAD_REQUEST]: {
        description: 'Invalid request body',
      },
    },
  })
  async sendTestNotification(
    @requestBody({
      content: {
        [CONTENT_TYPE.JSON]: {
          schema: {
            type: 'object',
            required: ['templateId', 'email'],
            properties: {
              templateId: {type: 'string', description: 'Novu workflow/template ID'},
              email: {type: 'string', format: 'email', description: 'Recipient email'},
              firstName: {type: 'string', description: 'Optional first name'},
              lastName: {type: 'string', description: 'Optional last name'},
              payload: {
                type: 'object',
                description: 'Custom payload for template variables',
                additionalProperties: true,
              },
            },
          },
        },
      },
    })
    request: TestNotificationRequest,
  ): Promise<SendNotificationResult> {
    const tenantId = this.getTenantId();

    if (!this.notificationAdminService) {
      throw new HttpErrors.ServiceUnavailable('Notification service not available');
    }

    if (!request.templateId || !request.email) {
      throw new HttpErrors.BadRequest('templateId and email are required');
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(request.email)) {
      throw new HttpErrors.BadRequest('Invalid email format');
    }

    console.info('Sending test notification', {
      tenantId,
      templateId: request.templateId,
      email: request.email,
      userId: this.currentUser?.id,
    });

    return this.notificationAdminService.sendTestNotification(tenantId, {
      templateId: request.templateId,
      email: request.email,
      firstName: request.firstName,
      lastName: request.lastName,
      payload: request.payload,
    });
  }

  // ============================================
  // Health Check
  // ============================================

  @authenticate(STRATEGY.BEARER, {passReqToCallback: true})
  @authorize({permissions: [PermissionKey.ViewNotifications]})
  @get(`${basePath}/health`, {
    security: OPERATION_SECURITY_SPEC,
    summary: 'Check Novu connectivity',
    description: 'Returns the health status of the Novu notification service',
    responses: {
      [STATUS_CODE.OK]: {
        description: 'Health status',
        content: {
          [CONTENT_TYPE.JSON]: {
            schema: {
              type: 'object',
              properties: {
                healthy: {type: 'boolean'},
                message: {type: 'string'},
              },
            },
          },
        },
      },
    },
  })
  async healthCheck(): Promise<{healthy: boolean; message: string}> {
    this.getTenantId();

    if (!this.notificationAdminService) {
      return {healthy: false, message: 'Notification service not available'};
    }

    return this.notificationAdminService.healthCheck();
  }

  // ============================================
  // Notification Preferences
  // ============================================

  @authenticate(STRATEGY.BEARER, {passReqToCallback: true})
  @authorize({permissions: [PermissionKey.ViewNotifications, PermissionKey.ManageNotificationPreferences]})
  @get(`${basePath}/preferences`, {
    security: OPERATION_SECURITY_SPEC,
    summary: 'Get all notification preferences for tenant',
    description: 'Returns notification channel preferences for all categories. Returns defaults for categories without explicit settings.',
    responses: {
      [STATUS_CODE.OK]: {
        description: 'Array of notification preferences (one per category)',
        content: {
          [CONTENT_TYPE.JSON]: {
            schema: {
              type: 'array',
              items: getModelSchemaRefSF(NotificationPreference),
            },
          },
        },
      },
    },
  })
  async listPreferences(): Promise<NotificationPreference[]> {
    const tenantId = this.getTenantId();

    if (!this.preferenceRepository) {
      throw new HttpErrors.ServiceUnavailable('Preference repository not available');
    }

    return this.preferenceRepository.getAllEffectivePreferences(tenantId);
  }

  @authenticate(STRATEGY.BEARER, {passReqToCallback: true})
  @authorize({permissions: [PermissionKey.ViewNotifications, PermissionKey.ManageNotificationPreferences]})
  @get(`${basePath}/preferences/{category}`, {
    security: OPERATION_SECURITY_SPEC,
    summary: 'Get notification preference for a specific category',
    description: 'Returns notification channel preference for the specified category. Returns default if not explicitly set.',
    responses: {
      [STATUS_CODE.OK]: {
        description: 'Notification preference for category',
        content: {
          [CONTENT_TYPE.JSON]: {
            schema: getModelSchemaRefSF(NotificationPreference),
          },
        },
      },
      [STATUS_CODE.BAD_REQUEST]: {
        description: 'Invalid category',
      },
    },
  })
  async getPreference(
    @param.path.string('category') category: string,
  ): Promise<NotificationPreference> {
    const tenantId = this.getTenantId();

    if (!this.preferenceRepository) {
      throw new HttpErrors.ServiceUnavailable('Preference repository not available');
    }

    // Validate category
    if (!Object.values(NotificationCategory).includes(category as NotificationCategory)) {
      throw new HttpErrors.BadRequest(
        `Invalid category. Must be one of: ${Object.values(NotificationCategory).join(', ')}`,
      );
    }

    return this.preferenceRepository.getEffectivePreference(
      tenantId,
      category as NotificationCategory,
    );
  }

  @authenticate(STRATEGY.BEARER, {passReqToCallback: true})
  @authorize({permissions: [PermissionKey.ManageNotificationPreferences]})
  @put(`${basePath}/preferences/{category}`, {
    security: OPERATION_SECURITY_SPEC,
    summary: 'Update notification preference for a category',
    description: 'Creates or updates notification channel settings for a specific category',
    responses: {
      [STATUS_CODE.OK]: {
        description: 'Updated notification preference',
        content: {
          [CONTENT_TYPE.JSON]: {
            schema: getModelSchemaRefSF(NotificationPreference),
          },
        },
      },
      [STATUS_CODE.BAD_REQUEST]: {
        description: 'Invalid category or request body',
      },
    },
  })
  async updatePreference(
    @param.path.string('category') category: string,
    @requestBody({
      content: {
        [CONTENT_TYPE.JSON]: {
          schema: {
            type: 'object',
            properties: {
              emailEnabled: {type: 'boolean', description: 'Enable email notifications'},
              smsEnabled: {type: 'boolean', description: 'Enable SMS notifications'},
              pushEnabled: {type: 'boolean', description: 'Enable push notifications'},
              inAppEnabled: {type: 'boolean', description: 'Enable in-app notifications'},
              webhookEnabled: {type: 'boolean', description: 'Enable webhook notifications'},
              webhookUrl: {type: 'string', format: 'uri', description: 'Webhook URL (required if webhookEnabled is true)'},
            },
          },
        },
      },
    })
    data: {
      emailEnabled?: boolean;
      smsEnabled?: boolean;
      pushEnabled?: boolean;
      inAppEnabled?: boolean;
      webhookEnabled?: boolean;
      webhookUrl?: string;
    },
  ): Promise<NotificationPreference> {
    const tenantId = this.getTenantId();

    if (!this.preferenceRepository) {
      throw new HttpErrors.ServiceUnavailable('Preference repository not available');
    }

    // Validate category
    if (!Object.values(NotificationCategory).includes(category as NotificationCategory)) {
      throw new HttpErrors.BadRequest(
        `Invalid category. Must be one of: ${Object.values(NotificationCategory).join(', ')}`,
      );
    }

    // Validate webhook URL if webhook is enabled
    if (data.webhookEnabled && !data.webhookUrl) {
      throw new HttpErrors.BadRequest('webhookUrl is required when webhookEnabled is true');
    }

    if (data.webhookUrl) {
      try {
        new URL(data.webhookUrl);
      } catch {
        throw new HttpErrors.BadRequest('Invalid webhookUrl format');
      }
    }

    console.info('Updating notification preference', {
      tenantId,
      category,
      userId: this.currentUser?.id,
    });

    return this.preferenceRepository.upsertPreference(
      tenantId,
      category as NotificationCategory,
      data,
    );
  }

  @authenticate(STRATEGY.BEARER, {passReqToCallback: true})
  @authorize({permissions: [PermissionKey.ManageNotificationPreferences]})
  @put(`${basePath}/preferences`, {
    security: OPERATION_SECURITY_SPEC,
    summary: 'Bulk update notification preferences',
    description: 'Updates notification channel settings for multiple categories at once',
    responses: {
      [STATUS_CODE.OK]: {
        description: 'Array of updated notification preferences',
        content: {
          [CONTENT_TYPE.JSON]: {
            schema: {
              type: 'array',
              items: getModelSchemaRefSF(NotificationPreference),
            },
          },
        },
      },
      [STATUS_CODE.BAD_REQUEST]: {
        description: 'Invalid request body',
      },
    },
  })
  async bulkUpdatePreferences(
    @requestBody({
      content: {
        [CONTENT_TYPE.JSON]: {
          schema: {
            type: 'array',
            items: {
              type: 'object',
              required: ['category'],
              properties: {
                category: {
                  type: 'string',
                  enum: Object.values(NotificationCategory),
                  description: 'Notification category',
                },
                emailEnabled: {type: 'boolean'},
                smsEnabled: {type: 'boolean'},
                pushEnabled: {type: 'boolean'},
                inAppEnabled: {type: 'boolean'},
                webhookEnabled: {type: 'boolean'},
                webhookUrl: {type: 'string', format: 'uri'},
              },
            },
          },
        },
      },
    })
    preferences: Array<{
      category: NotificationCategory;
      emailEnabled?: boolean;
      smsEnabled?: boolean;
      pushEnabled?: boolean;
      inAppEnabled?: boolean;
      webhookEnabled?: boolean;
      webhookUrl?: string;
    }>,
  ): Promise<NotificationPreference[]> {
    const tenantId = this.getTenantId();

    if (!this.preferenceRepository) {
      throw new HttpErrors.ServiceUnavailable('Preference repository not available');
    }

    if (!Array.isArray(preferences) || preferences.length === 0) {
      throw new HttpErrors.BadRequest('Request body must be a non-empty array');
    }

    // Validate all categories
    for (const pref of preferences) {
      if (!Object.values(NotificationCategory).includes(pref.category)) {
        throw new HttpErrors.BadRequest(
          `Invalid category "${pref.category}". Must be one of: ${Object.values(NotificationCategory).join(', ')}`,
        );
      }

      // Validate webhook URL if webhook is enabled
      if (pref.webhookEnabled && !pref.webhookUrl) {
        throw new HttpErrors.BadRequest(
          `webhookUrl is required for category "${pref.category}" when webhookEnabled is true`,
        );
      }

      if (pref.webhookUrl) {
        try {
          new URL(pref.webhookUrl);
        } catch {
          throw new HttpErrors.BadRequest(`Invalid webhookUrl format for category "${pref.category}"`);
        }
      }
    }

    console.info('Bulk updating notification preferences', {
      tenantId,
      categoryCount: preferences.length,
      userId: this.currentUser?.id,
    });

    return this.preferenceRepository.bulkUpsertPreferences(tenantId, preferences);
  }

  @authenticate(STRATEGY.BEARER, {passReqToCallback: true})
  @authorize({permissions: [PermissionKey.ViewNotifications]})
  @get(`${basePath}/preferences/categories`, {
    security: OPERATION_SECURITY_SPEC,
    summary: 'List available notification categories',
    description: 'Returns all available notification categories and their descriptions',
    responses: {
      [STATUS_CODE.OK]: {
        description: 'Array of notification categories',
        content: {
          [CONTENT_TYPE.JSON]: {
            schema: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: {type: 'string'},
                  name: {type: 'string'},
                  description: {type: 'string'},
                },
              },
            },
          },
        },
      },
    },
  })
  async listCategories(): Promise<Array<{id: string; name: string; description: string}>> {
    this.getTenantId();

    return [
      {
        id: NotificationCategory.BILLING,
        name: 'Billing',
        description: 'Payment confirmations, invoice notifications, billing alerts',
      },
      {
        id: NotificationCategory.SUBSCRIPTION,
        name: 'Subscription',
        description: 'Subscription changes, renewals, plan updates',
      },
      {
        id: NotificationCategory.USER,
        name: 'User',
        description: 'User invitations, account updates, welcome emails',
      },
      {
        id: NotificationCategory.SYSTEM,
        name: 'System',
        description: 'System maintenance, platform updates, announcements',
      },
      {
        id: NotificationCategory.SECURITY,
        name: 'Security',
        description: 'Security alerts, login notifications, password changes',
      },
      {
        id: NotificationCategory.WORKFLOW,
        name: 'Workflow',
        description: 'Workflow status updates, provisioning notifications',
      },
    ];
  }

  // ============================================
  // Local Notification History (Persisted)
  // ============================================

  @authenticate(STRATEGY.BEARER, {passReqToCallback: true})
  @authorize({permissions: [PermissionKey.ViewNotifications, PermissionKey.ViewNotificationHistory]})
  @get(`${basePath}/local-history`, {
    security: OPERATION_SECURITY_SPEC,
    summary: 'Get local notification history for tenant',
    description: 'Returns notification delivery history from local database (persisted)',
    responses: {
      [STATUS_CODE.OK]: {
        description: 'Local notification history',
        content: {
          [CONTENT_TYPE.JSON]: {
            schema: {
              type: 'object',
              properties: {
                data: {
                  type: 'array',
                  items: getModelSchemaRefSF(NotificationHistory),
                },
                total: {type: 'number'},
                hasMore: {type: 'boolean'},
              },
            },
          },
        },
      },
    },
  })
  async getLocalHistory(
    @param.query.number('page') page?: number,
    @param.query.number('limit') limit?: number,
    @param.query.string('channel') channel?: string,
    @param.query.string('status') status?: string,
    @param.query.string('workflowId') workflowId?: string,
  ): Promise<{data: NotificationHistory[]; total: number; hasMore: boolean}> {
    const tenantId = this.getTenantId();

    if (!this.historyRepository) {
      throw new HttpErrors.ServiceUnavailable('History repository not available');
    }

    const pageNum = page || 0;
    const pageLimit = Math.min(limit || 20, 100);
    const offset = pageNum * pageLimit;

    // Build the where clause for counting
    const whereClause: Record<string, unknown> = {tenantId};
    if (channel) {
      whereClause.channel = channel;
    }
    if (status) {
      whereClause.status = status;
    }
    if (workflowId) {
      whereClause.workflowId = workflowId;
    }

    // Get total count for pagination
    const totalCount = await this.historyRepository.count(whereClause);

    const data = await this.historyRepository.findByTenantId(tenantId, {
      limit: pageLimit,
      offset,
      channel: channel as NotificationChannel | undefined,
      status: status as NotificationStatus | undefined,
      workflowId,
    });

    const hasMore = offset + data.length < totalCount.count;

    return {
      data,
      total: totalCount.count,
      hasMore,
    };
  }

  @authenticate(STRATEGY.BEARER, {passReqToCallback: true})
  @authorize({permissions: [PermissionKey.ViewNotifications, PermissionKey.ViewNotificationHistory]})
  @get(`${basePath}/local-history/{id}`, {
    security: OPERATION_SECURITY_SPEC,
    summary: 'Get a specific notification record',
    description: 'Returns details of a specific notification from local history',
    responses: {
      [STATUS_CODE.OK]: {
        description: 'Notification details',
        content: {
          [CONTENT_TYPE.JSON]: {
            schema: getModelSchemaRefSF(NotificationHistory),
          },
        },
      },
      [STATUS_CODE.NOT_FOUND]: {
        description: 'Notification not found',
      },
    },
  })
  async getLocalHistoryById(
    @param.path.string('id') id: string,
  ): Promise<NotificationHistory> {
    const tenantId = this.getTenantId();

    if (!this.historyRepository) {
      throw new HttpErrors.ServiceUnavailable('History repository not available');
    }

    const notification = await this.historyRepository.findById(id);

    if (!notification || notification.tenantId !== tenantId) {
      throw new HttpErrors.NotFound(`Notification with ID ${id} not found`);
    }

    return notification;
  }

  // ============================================
  // Notification Analytics
  // ============================================

  @authenticate(STRATEGY.BEARER, {passReqToCallback: true})
  @authorize({permissions: [PermissionKey.ViewNotifications, PermissionKey.ViewNotificationHistory]})
  @get(`${basePath}/analytics`, {
    security: OPERATION_SECURITY_SPEC,
    summary: 'Get notification analytics for tenant',
    description: 'Returns notification statistics and metrics for the current tenant',
    responses: {
      [STATUS_CODE.OK]: {
        description: 'Notification analytics',
        content: {
          [CONTENT_TYPE.JSON]: {
            schema: {
              type: 'object',
              properties: {
                total: {type: 'number'},
                sent: {type: 'number'},
                delivered: {type: 'number'},
                failed: {type: 'number'},
                pending: {type: 'number'},
                bounced: {type: 'number'},
                opened: {type: 'number'},
                clicked: {type: 'number'},
                deliveryRate: {type: 'number'},
                byChannel: {
                  type: 'object',
                  additionalProperties: {type: 'number'},
                },
                byWorkflow: {
                  type: 'object',
                  additionalProperties: {type: 'number'},
                },
              },
            },
          },
        },
      },
    },
  })
  async getAnalytics(
    @param.query.string('startDate') startDate?: string,
    @param.query.string('endDate') endDate?: string,
  ): Promise<{
    total: number;
    sent: number;
    delivered: number;
    failed: number;
    pending: number;
    bounced: number;
    opened: number;
    clicked: number;
    deliveryRate: number;
    byChannel: Record<string, number>;
    byWorkflow: Record<string, number>;
  }> {
    const tenantId = this.getTenantId();

    if (!this.historyRepository) {
      throw new HttpErrors.ServiceUnavailable('History repository not available');
    }

    const options: {startDate?: Date; endDate?: Date} = {};
    if (startDate) {
      options.startDate = new Date(startDate);
    }
    if (endDate) {
      options.endDate = new Date(endDate);
    }

    const stats = await this.historyRepository.getStatistics(tenantId, options);
    const deliveryRate = await this.historyRepository.getDeliveryRate(tenantId, options);

    return {
      ...stats,
      deliveryRate: Math.round(deliveryRate * 100) / 100,
    };
  }

  @authenticate(STRATEGY.BEARER, {passReqToCallback: true})
  @authorize({permissions: [PermissionKey.ViewNotifications, PermissionKey.ViewNotificationHistory]})
  @get(`${basePath}/analytics/failures`, {
    security: OPERATION_SECURITY_SPEC,
    summary: 'Get recent notification failures',
    description: 'Returns recent failed notifications for debugging',
    responses: {
      [STATUS_CODE.OK]: {
        description: 'Recent failures',
        content: {
          [CONTENT_TYPE.JSON]: {
            schema: {
              type: 'array',
              items: getModelSchemaRefSF(NotificationHistory),
            },
          },
        },
      },
    },
  })
  async getRecentFailures(
    @param.query.number('limit') limit?: number,
  ): Promise<NotificationHistory[]> {
    const tenantId = this.getTenantId();

    if (!this.historyRepository) {
      throw new HttpErrors.ServiceUnavailable('History repository not available');
    }

    return this.historyRepository.getRecentFailures(tenantId, limit || 20);
  }

  // ============================================
  // Record Notification (Internal Use)
  // ============================================

  @authenticate(STRATEGY.BEARER, {passReqToCallback: true})
  @authorize({permissions: [PermissionKey.ManageNotificationTemplates]})
  @post(`${basePath}/record`, {
    security: OPERATION_SECURITY_SPEC,
    summary: 'Record a notification (internal)',
    description: 'Records a notification in local history. Used internally by notification services.',
    responses: {
      [STATUS_CODE.OK]: {
        description: 'Recorded notification',
        content: {
          [CONTENT_TYPE.JSON]: {
            schema: getModelSchemaRefSF(NotificationHistory),
          },
        },
      },
    },
  })
  async recordNotification(
    @requestBody({
      content: {
        [CONTENT_TYPE.JSON]: {
          schema: {
            type: 'object',
            required: ['workflowId', 'subscriberId', 'channel'],
            properties: {
              workflowId: {type: 'string'},
              workflowName: {type: 'string'},
              subscriberId: {type: 'string'},
              channel: {type: 'string', enum: Object.values(NotificationChannel)},
              recipientEmail: {type: 'string'},
              recipientPhone: {type: 'string'},
              subject: {type: 'string'},
              payload: {type: 'object'},
              transactionId: {type: 'string'},
              novuMessageId: {type: 'string'},
              category: {type: 'string'},
            },
          },
        },
      },
    })
    data: {
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
    },
  ): Promise<NotificationHistory> {
    const tenantId = this.getTenantId();

    if (!this.historyRepository) {
      throw new HttpErrors.ServiceUnavailable('History repository not available');
    }

    return this.historyRepository.recordNotification({
      tenantId,
      ...data,
    });
  }

  @authenticate(STRATEGY.BEARER, {passReqToCallback: true})
  @authorize({permissions: [PermissionKey.ManageNotificationTemplates]})
  @put(`${basePath}/record/{id}/status`, {
    security: OPERATION_SECURITY_SPEC,
    summary: 'Update notification status (internal)',
    description: 'Updates the delivery status of a notification. Used internally.',
    responses: {
      [STATUS_CODE.OK]: {
        description: 'Status updated',
        content: {
          [CONTENT_TYPE.JSON]: {
            schema: {
              type: 'object',
              properties: {
                success: {type: 'boolean'},
              },
            },
          },
        },
      },
    },
  })
  async updateNotificationStatus(
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        [CONTENT_TYPE.JSON]: {
          schema: {
            type: 'object',
            required: ['status'],
            properties: {
              status: {type: 'string', enum: Object.values(NotificationStatus)},
              errorMessage: {type: 'string'},
              errorCode: {type: 'string'},
              deliveredAt: {type: 'string', format: 'date-time'},
              openedAt: {type: 'string', format: 'date-time'},
              clickedAt: {type: 'string', format: 'date-time'},
              attempts: {type: 'number'},
            },
          },
        },
      },
    })
    data: {
      status: NotificationStatus;
      errorMessage?: string;
      errorCode?: string;
      deliveredAt?: string;
      openedAt?: string;
      clickedAt?: string;
      attempts?: number;
    },
  ): Promise<{success: boolean}> {
    const tenantId = this.getTenantId();

    if (!this.historyRepository) {
      throw new HttpErrors.ServiceUnavailable('History repository not available');
    }

    // Verify the notification belongs to this tenant
    const notification = await this.historyRepository.findById(id);
    if (!notification || notification.tenantId !== tenantId) {
      throw new HttpErrors.NotFound(`Notification with ID ${id} not found`);
    }

    await this.historyRepository.updateStatus(id, data.status, {
      errorMessage: data.errorMessage,
      errorCode: data.errorCode,
      deliveredAt: data.deliveredAt ? new Date(data.deliveredAt) : undefined,
      openedAt: data.openedAt ? new Date(data.openedAt) : undefined,
      clickedAt: data.clickedAt ? new Date(data.clickedAt) : undefined,
      attempts: data.attempts,
    });

    return {success: true};
  }
}
