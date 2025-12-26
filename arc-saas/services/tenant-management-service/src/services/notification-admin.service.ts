import {injectable, BindingScope} from '@loopback/core';
import {Novu} from '@novu/api';

/**
 * DTO for Novu workflow/template
 * Maps to Novu's workflow API response structure
 */
export interface NotificationTemplateDto {
  id: string;
  name: string;
  description?: string;
  triggers: Array<{identifier: string; type: string}>;
  steps: Array<{
    stepId: string;
    name: string;
    template: {type: string; content?: string};
  }>;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Raw Novu workflow response structure
 */
interface NovuWorkflow {
  _id?: string;
  name?: string;
  description?: string;
  active?: boolean;
  triggers?: Array<{identifier?: string; type?: string}>;
  steps?: Array<{
    _id?: string;
    name?: string;
    template?: {type?: string; content?: string};
  }>;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * DTO for notification history item
 */
export interface NotificationHistoryDto {
  id: string;
  transactionId: string;
  templateId: string;
  templateName?: string;
  subscriberId: string;
  channel: string;
  status: 'sent' | 'error' | 'pending' | 'warning';
  content?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * DTO for subscriber details
 */
export interface SubscriberDto {
  subscriberId: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  avatar?: string;
  data?: Record<string, unknown>;
  channels?: Array<{
    type: string;
    credentials: Record<string, unknown>;
  }>;
  createdAt: string;
  updatedAt: string;
}

/**
 * Input for sending a test notification
 */
export interface SendTestNotificationInput {
  templateId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  payload?: Record<string, unknown>;
}

/**
 * Result of sending a notification
 */
export interface SendNotificationResult {
  success: boolean;
  transactionId?: string;
  error?: string;
}

/**
 * Fallback workflow/template definitions
 * Used when Novu API is unavailable or returns no results
 * These represent the expected workflows that should be configured in Novu dashboard
 */
const FALLBACK_TEMPLATES: NotificationTemplateDto[] = [
  {
    id: 'payment-success',
    name: 'Payment Success',
    description: 'Sent when a payment is successfully processed',
    triggers: [{identifier: 'payment-success', type: 'event'}],
    steps: [{stepId: 'email-step', name: 'Email', template: {type: 'email'}}],
    active: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'payment-failed',
    name: 'Payment Failed',
    description: 'Sent when a payment fails',
    triggers: [{identifier: 'payment-failed', type: 'event'}],
    steps: [{stepId: 'email-step', name: 'Email', template: {type: 'email'}}],
    active: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'invoice-paid',
    name: 'Invoice Paid',
    description: 'Sent when an invoice is paid',
    triggers: [{identifier: 'invoice-paid', type: 'event'}],
    steps: [{stepId: 'email-step', name: 'Email', template: {type: 'email'}}],
    active: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'invoice-payment-failed',
    name: 'Invoice Payment Failed',
    description: 'Sent when an invoice payment fails',
    triggers: [{identifier: 'invoice-payment-failed', type: 'event'}],
    steps: [{stepId: 'email-step', name: 'Email', template: {type: 'email'}}],
    active: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'subscription-created',
    name: 'Subscription Created',
    description: 'Sent when a new subscription is created',
    triggers: [{identifier: 'subscription-created', type: 'event'}],
    steps: [{stepId: 'email-step', name: 'Email', template: {type: 'email'}}],
    active: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'subscription-cancelled',
    name: 'Subscription Cancelled',
    description: 'Sent when a subscription is cancelled',
    triggers: [{identifier: 'subscription-cancelled', type: 'event'}],
    steps: [{stepId: 'email-step', name: 'Email', template: {type: 'email'}}],
    active: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'user-invitation',
    name: 'User Invitation',
    description: 'Sent when a user is invited to a tenant',
    triggers: [{identifier: 'user-invitation', type: 'event'}],
    steps: [{stepId: 'email-step', name: 'Email', template: {type: 'email'}}],
    active: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'user-welcome',
    name: 'User Welcome',
    description: 'Sent when a new user completes registration',
    triggers: [{identifier: 'user-welcome', type: 'event'}],
    steps: [{stepId: 'email-step', name: 'Email', template: {type: 'email'}}],
    active: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'lead-verification',
    name: 'Lead Verification',
    description: 'Sent when a new lead needs to verify their email',
    triggers: [{identifier: 'lead-verification', type: 'event'}],
    steps: [{stepId: 'email-step', name: 'Email', template: {type: 'email'}}],
    active: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'tenant-provisioned',
    name: 'Tenant Provisioned',
    description: 'Sent when tenant provisioning is complete',
    triggers: [{identifier: 'tenant-provisioned', type: 'event'}],
    steps: [{stepId: 'email-step', name: 'Email', template: {type: 'email'}}],
    active: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

/**
 * Service for Novu admin operations.
 * Proxies Novu API for template management, history, and subscriber operations.
 *
 * Note: In @novu/api 0.6.x, workflow/template management is done via Novu dashboard.
 * This service provides static template definitions and proxies runtime operations.
 */
@injectable({scope: BindingScope.SINGLETON})
export class NotificationAdminService {
  private client: Novu | null = null;
  private readonly enabled: boolean;
  private readonly apiKey: string;
  private readonly backendUrl: string;

  constructor() {
    this.enabled = process.env.NOVU_ENABLED === 'true';
    this.apiKey = process.env.NOVU_API_KEY || '';
    this.backendUrl = process.env.NOVU_BACKEND_URL || 'http://localhost:3100';
  }

  /**
   * Check if Novu is enabled
   */
  isEnabled(): boolean {
    return this.enabled && !!this.apiKey;
  }

  /**
   * Get or create Novu client
   */
  private getClient(): Novu {
    if (!this.isEnabled()) {
      throw new Error(
        'Novu is not enabled. Set NOVU_ENABLED=true and configure NOVU_API_KEY',
      );
    }

    if (!this.client) {
      this.client = new Novu({
        secretKey: this.apiKey,
        serverURL: this.backendUrl,
      });
    }

    return this.client;
  }

  /**
   * Generate a subscriber ID for a tenant user
   */
  generateSubscriberId(tenantId: string, email: string): string {
    const sanitizedEmail = email.replace(/[^a-zA-Z0-9]/g, '_');
    return `tenant-${tenantId}-${sanitizedEmail}`;
  }

  // ============================================
  // Template/Workflow Operations
  // ============================================

  /**
   * Fetch workflows from Novu REST API
   * The @novu/api SDK v0.6.x doesn't expose workflow APIs, so we use direct HTTP calls
   */
  private async fetchWorkflowsFromApi(): Promise<NotificationTemplateDto[]> {
    try {
      const response = await fetch(`${this.backendUrl}/v1/workflows`, {
        method: 'GET',
        headers: {
          'Authorization': `ApiKey ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        console.warn(`[NotificationAdminService] Failed to fetch workflows: ${response.status} ${response.statusText}`);
        return [];
      }

      const data = await response.json() as {data?: NovuWorkflow[]};
      const workflows = data.data || [];

      return workflows.map((workflow): NotificationTemplateDto => ({
        id: workflow.triggers?.[0]?.identifier || workflow._id || '',
        name: workflow.name || 'Unnamed Workflow',
        description: workflow.description,
        triggers: (workflow.triggers || []).map(t => ({
          identifier: t.identifier || '',
          type: t.type || 'event',
        })),
        steps: (workflow.steps || []).map(s => ({
          stepId: s._id || '',
          name: s.name || 'Step',
          template: {
            type: s.template?.type || 'email',
            content: s.template?.content,
          },
        })),
        active: workflow.active ?? true,
        createdAt: workflow.createdAt || new Date().toISOString(),
        updatedAt: workflow.updatedAt || new Date().toISOString(),
      }));
    } catch (error) {
      console.warn('[NotificationAdminService] Error fetching workflows from API:', error);
      return [];
    }
  }

  /**
   * Fetch a single workflow by trigger identifier from Novu REST API
   */
  private async fetchWorkflowFromApi(workflowId: string): Promise<NotificationTemplateDto | null> {
    try {
      // First try by workflow ID directly
      const response = await fetch(`${this.backendUrl}/v1/workflows/${workflowId}`, {
        method: 'GET',
        headers: {
          'Authorization': `ApiKey ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        // If not found by ID, search in all workflows by trigger identifier
        const allWorkflows = await this.fetchWorkflowsFromApi();
        return allWorkflows.find(w => w.id === workflowId) || null;
      }

      const data = await response.json() as {data?: NovuWorkflow};
      const workflow = data.data;

      if (!workflow) {
        return null;
      }

      return {
        id: workflow.triggers?.[0]?.identifier || workflow._id || '',
        name: workflow.name || 'Unnamed Workflow',
        description: workflow.description,
        triggers: (workflow.triggers || []).map(t => ({
          identifier: t.identifier || '',
          type: t.type || 'event',
        })),
        steps: (workflow.steps || []).map(s => ({
          stepId: s._id || '',
          name: s.name || 'Step',
          template: {
            type: s.template?.type || 'email',
            content: s.template?.content,
          },
        })),
        active: workflow.active ?? true,
        createdAt: workflow.createdAt || new Date().toISOString(),
        updatedAt: workflow.updatedAt || new Date().toISOString(),
      };
    } catch (error) {
      console.warn(`[NotificationAdminService] Error fetching workflow ${workflowId}:`, error);
      return null;
    }
  }

  /**
   * List all notification templates/workflows
   * Fetches from Novu API if enabled, falls back to static definitions
   */
  async listTemplates(): Promise<NotificationTemplateDto[]> {
    if (!this.isEnabled()) {
      return FALLBACK_TEMPLATES;
    }

    // Fetch from Novu API
    const apiWorkflows = await this.fetchWorkflowsFromApi();

    if (apiWorkflows.length > 0) {
      return apiWorkflows;
    }

    // Fallback to static definitions if API returns nothing
    console.info('[NotificationAdminService] No workflows from API, using fallback templates');
    return FALLBACK_TEMPLATES;
  }

  /**
   * Get a single template by ID (trigger identifier)
   * Fetches from Novu API if enabled, falls back to static definitions
   */
  async getTemplate(templateId: string): Promise<NotificationTemplateDto | null> {
    if (!this.isEnabled()) {
      return FALLBACK_TEMPLATES.find(t => t.id === templateId) || null;
    }

    // Fetch from Novu API
    const apiWorkflow = await this.fetchWorkflowFromApi(templateId);

    if (apiWorkflow) {
      return apiWorkflow;
    }

    // Fallback to static definitions if API doesn't find it
    return FALLBACK_TEMPLATES.find(t => t.id === templateId) || null;
  }

  // ============================================
  // History Operations
  // ============================================

  /**
   * Get notification history for a tenant
   * Filters by subscriber IDs that belong to the tenant
   */
  async getHistoryForTenant(
    tenantId: string,
    options?: {
      page?: number;
      limit?: number;
      channel?: string;
    },
  ): Promise<{data: NotificationHistoryDto[]; total: number; hasMore: boolean}> {
    if (!this.isEnabled()) {
      return {data: [], total: 0, hasMore: false};
    }

    try {
      const client = this.getClient();

      // Novu's notifications.list uses pagination with request object
      const page = options?.page || 0;
      const limit = options?.limit || 20;

      // Build request - filter by tenant subscriber prefix pattern
      const tenantPrefix = `tenant-${tenantId}-`;

      // Fetch notifications
      const response = await client.notifications.list({
        page,
        limit: limit * 2, // Fetch more to account for filtering
      });

      // Extract and filter notifications for this tenant
      const notifications: NotificationHistoryDto[] = [];

      // Response has .result which contains the activities data
      const result = response?.result;
      const activities = (result as unknown as {data?: unknown[]})?.data || [];

      for (const notification of activities as Array<Record<string, unknown>>) {
        const subscriberId = notification.subscriber as string;
        const to = notification.to as Record<string, unknown>;
        const actualSubscriberId = subscriberId || (to?.subscriberId as string);

        if (actualSubscriberId?.startsWith(tenantPrefix)) {
          notifications.push({
            id: (notification._id as string) || (notification.id as string) || '',
            transactionId: (notification.transactionId as string) || '',
            templateId: (notification._templateId as string) || (notification.templateId as string) || '',
            templateName: notification.templateIdentifier as string | undefined,
            subscriberId: actualSubscriberId,
            channel: (notification.channel as string) || 'email',
            status: (notification.status as 'sent' | 'error' | 'pending' | 'warning') || 'pending',
            content: notification.content as string | undefined,
            createdAt: (notification.createdAt as string) || new Date().toISOString(),
            updatedAt: (notification.updatedAt as string) || new Date().toISOString(),
          });

          if (notifications.length >= limit) {
            break;
          }
        }
      }

      return {
        data: notifications,
        total: notifications.length,
        hasMore: notifications.length >= limit,
      };
    } catch (error) {
      console.error('Failed to get notification history:', error);
      return {data: [], total: 0, hasMore: false};
    }
  }

  // ============================================
  // Subscriber Operations
  // ============================================

  /**
   * Get subscriber details
   */
  async getSubscriber(subscriberId: string): Promise<SubscriberDto | null> {
    if (!this.isEnabled()) {
      return null;
    }

    try {
      const client = this.getClient();
      const response = await client.subscribers.retrieve(subscriberId);

      if (!response?.result) {
        return null;
      }

      const sub = response.result as Record<string, unknown>;
      return {
        subscriberId: (sub.subscriberId as string) || '',
        email: sub.email as string | undefined,
        firstName: sub.firstName as string | undefined,
        lastName: sub.lastName as string | undefined,
        phone: sub.phone as string | undefined,
        avatar: sub.avatar as string | undefined,
        data: sub.data as Record<string, unknown> | undefined,
        channels: sub.channels as Array<{
          type: string;
          credentials: Record<string, unknown>;
        }>,
        createdAt: (sub.createdAt as string) || new Date().toISOString(),
        updatedAt: (sub.updatedAt as string) || new Date().toISOString(),
      };
    } catch (error) {
      console.error(`Failed to get subscriber ${subscriberId}:`, error);
      return null;
    }
  }

  /**
   * List subscribers for a tenant
   */
  async listSubscribersForTenant(
    tenantId: string,
    options?: {page?: number; limit?: number},
  ): Promise<SubscriberDto[]> {
    if (!this.isEnabled()) {
      return [];
    }

    try {
      const client = this.getClient();
      const page = options?.page || 0;
      const limit = options?.limit || 20;

      // subscribers.list takes positional args: page, limit
      // Returns PageIterator which has result property directly on first call
      const pageIterator = await client.subscribers.list(page, limit * 2);

      // Filter by tenant prefix
      const tenantPrefix = `tenant-${tenantId}-`;
      const subscribers: SubscriberDto[] = [];

      // PageIterator has the result directly accessible
      // The type is: PageIterator<SubscribersV1ControllerListSubscribersResponse>
      // Which includes result property from the response
      const result = (pageIterator as unknown as {result?: unknown})?.result;
      const subs = (result as unknown as {data?: unknown[]})?.data || [];

      for (const sub of subs as Array<Record<string, unknown>>) {
        const subscriberId = sub.subscriberId as string;
        if (subscriberId?.startsWith(tenantPrefix)) {
          subscribers.push({
            subscriberId,
            email: sub.email as string | undefined,
            firstName: sub.firstName as string | undefined,
            lastName: sub.lastName as string | undefined,
            phone: sub.phone as string | undefined,
            avatar: sub.avatar as string | undefined,
            data: sub.data as Record<string, unknown> | undefined,
            channels: sub.channels as Array<{
              type: string;
              credentials: Record<string, unknown>;
            }>,
            createdAt: (sub.createdAt as string) || new Date().toISOString(),
            updatedAt: (sub.updatedAt as string) || new Date().toISOString(),
          });

          if (subscribers.length >= limit) {
            break;
          }
        }
      }

      return subscribers;
    } catch (error) {
      console.error('Failed to list subscribers:', error);
      return [];
    }
  }

  // ============================================
  // Test Notification
  // ============================================

  /**
   * Send a test notification
   */
  async sendTestNotification(
    tenantId: string,
    input: SendTestNotificationInput,
  ): Promise<SendNotificationResult> {
    if (!this.isEnabled()) {
      return {
        success: true,
        transactionId: 'skipped-novu-disabled',
      };
    }

    try {
      const client = this.getClient();
      const subscriberId = this.generateSubscriberId(tenantId, input.email);

      // Upsert subscriber
      try {
        await client.subscribers.create({
          subscriberId,
          email: input.email,
          firstName: input.firstName || '',
          lastName: input.lastName || '',
          data: {tenantId, isTest: true},
        });
      } catch {
        // Subscriber may exist - use upsert
        try {
          await client.subscribers.upsert({
            email: input.email,
            firstName: input.firstName || '',
            lastName: input.lastName || '',
            data: {tenantId, isTest: true},
          }, subscriberId);
        } catch {
          // Ignore if upsert also fails - subscriber exists
        }
      }

      // Trigger notification
      const response = await client.trigger({
        workflowId: input.templateId,
        to: {
          subscriberId,
          email: input.email,
        },
        payload: {
          ...input.payload,
          tenantId,
          isTest: true,
        },
      });

      return {
        success: true,
        transactionId: response?.result?.transactionId || 'test-triggered',
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('Failed to send test notification:', error);
      return {
        success: false,
        error: message,
      };
    }
  }

  // ============================================
  // Health Check
  // ============================================

  /**
   * Check Novu connectivity
   */
  async healthCheck(): Promise<{healthy: boolean; message: string}> {
    if (!this.isEnabled()) {
      return {healthy: false, message: 'Novu is disabled'};
    }

    try {
      const client = this.getClient();
      // Simple check - list subscribers (should return even if empty)
      await client.subscribers.list(0, 1);
      return {healthy: true, message: 'Connected to Novu'};
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return {healthy: false, message: `Novu connection failed: ${message}`};
    }
  }
}
