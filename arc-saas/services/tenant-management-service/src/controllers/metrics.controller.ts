import {get} from '@loopback/openapi-v3';
import {Response, RestBindings} from '@loopback/rest';
import {inject} from '@loopback/context';
import {authorize} from 'loopback4-authorization';
import {STATUS_CODE} from '@sourceloop/core';
import {repository} from '@loopback/repository';
import {
  TenantRepository,
  LeadRepository,
  SubscriptionRepository,
  UserRepository,
  UserInvitationRepository,
  InvoiceRepository,
} from '../repositories/sequelize';
import {TenantStatus} from '../enums';

/**
 * Prometheus metrics registry for tracking application metrics.
 * Uses simple counters and gauges that are thread-safe via atomic operations.
 */
class MetricsRegistry {
  private static instance: MetricsRegistry;
  private counters: Map<string, number> = new Map();
  private gauges: Map<string, number> = new Map();
  private histogramBuckets: Map<string, number[]> = new Map();
  private histogramSums: Map<string, number> = new Map();
  private histogramCounts: Map<string, number> = new Map();

  static getInstance(): MetricsRegistry {
    if (!MetricsRegistry.instance) {
      MetricsRegistry.instance = new MetricsRegistry();
    }
    return MetricsRegistry.instance;
  }

  incCounter(name: string, labels: Record<string, string> = {}, value = 1): void {
    const key = this.buildKey(name, labels);
    const current = this.counters.get(key) ?? 0;
    this.counters.set(key, current + value);
  }

  setGauge(name: string, value: number, labels: Record<string, string> = {}): void {
    const key = this.buildKey(name, labels);
    this.gauges.set(key, value);
  }

  observeHistogram(name: string, value: number, labels: Record<string, string> = {}): void {
    const key = this.buildKey(name, labels);
    const buckets = this.histogramBuckets.get(key) ?? [];
    buckets.push(value);
    this.histogramBuckets.set(key, buckets);

    const sum = (this.histogramSums.get(key) ?? 0) + value;
    this.histogramSums.set(key, sum);

    const count = (this.histogramCounts.get(key) ?? 0) + 1;
    this.histogramCounts.set(key, count);
  }

  getCounters(): Map<string, number> {
    return this.counters;
  }

  getGauges(): Map<string, number> {
    return this.gauges;
  }

  getHistograms(): {
    buckets: Map<string, number[]>;
    sums: Map<string, number>;
    counts: Map<string, number>;
  } {
    return {
      buckets: this.histogramBuckets,
      sums: this.histogramSums,
      counts: this.histogramCounts,
    };
  }

  private buildKey(name: string, labels: Record<string, string>): string {
    const labelStr = Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}="${v}"`)
      .join(',');
    return labelStr ? `${name}{${labelStr}}` : name;
  }
}

// Export singleton for use in other services
export const metricsRegistry = MetricsRegistry.getInstance();

const basePath = '/metrics';

/**
 * Prometheus-compatible metrics endpoint controller.
 * Exposes application metrics in Prometheus text format.
 */
export class MetricsController {
  constructor(
    @repository(TenantRepository)
    private tenantRepository: TenantRepository,
    @repository(LeadRepository)
    private leadRepository: LeadRepository,
    @repository(SubscriptionRepository)
    private subscriptionRepository: SubscriptionRepository,
    @repository(UserRepository)
    private userRepository: UserRepository,
    @repository(UserInvitationRepository)
    private invitationRepository: UserInvitationRepository,
    @repository(InvoiceRepository)
    private invoiceRepository: InvoiceRepository,
    @inject(RestBindings.Http.RESPONSE)
    private response: Response,
  ) {}

  @authorize({permissions: ['*']})
  @get(basePath, {
    responses: {
      [STATUS_CODE.OK]: {
        description: 'Prometheus metrics endpoint',
        content: {
          'text/plain': {
            schema: {type: 'string'},
          },
        },
      },
    },
  })
  async getMetrics(): Promise<Response> {
    const metrics: string[] = [];
    const timestamp = Date.now();

    // Add help and type comments for each metric family
    metrics.push('# HELP tenant_management_info Service information');
    metrics.push('# TYPE tenant_management_info gauge');
    metrics.push(`tenant_management_info{version="1.0.0",service="tenant-management-service"} 1`);

    // Process metrics
    metrics.push('');
    metrics.push('# HELP process_uptime_seconds Process uptime in seconds');
    metrics.push('# TYPE process_uptime_seconds gauge');
    metrics.push(`process_uptime_seconds ${process.uptime().toFixed(2)}`);

    // Memory metrics
    const memUsage = process.memoryUsage();
    metrics.push('');
    metrics.push('# HELP process_heap_bytes Process heap memory usage');
    metrics.push('# TYPE process_heap_bytes gauge');
    metrics.push(`process_heap_bytes{type="used"} ${memUsage.heapUsed}`);
    metrics.push(`process_heap_bytes{type="total"} ${memUsage.heapTotal}`);

    metrics.push('');
    metrics.push('# HELP process_memory_bytes Process memory usage');
    metrics.push('# TYPE process_memory_bytes gauge');
    metrics.push(`process_memory_bytes{type="rss"} ${memUsage.rss}`);
    metrics.push(`process_memory_bytes{type="external"} ${memUsage.external}`);

    // Node.js version
    metrics.push('');
    metrics.push('# HELP nodejs_version_info Node.js version info');
    metrics.push('# TYPE nodejs_version_info gauge');
    metrics.push(`nodejs_version_info{version="${process.version}"} 1`);

    // Business metrics - Tenants
    try {
      const tenantCounts = await this.getTenantMetrics();
      metrics.push('');
      metrics.push('# HELP tenants_total Total number of tenants by status');
      metrics.push('# TYPE tenants_total gauge');
      for (const [status, count] of Object.entries(tenantCounts)) {
        metrics.push(`tenants_total{status="${status}"} ${count}`);
      }
    } catch (error) {
      metrics.push('');
      metrics.push('# HELP tenants_total Total number of tenants by status');
      metrics.push('# TYPE tenants_total gauge');
      metrics.push(`tenants_total{status="error"} 0`);
    }

    // Business metrics - Leads
    try {
      const leadCount = await this.leadRepository.count();
      metrics.push('');
      metrics.push('# HELP leads_total Total number of leads');
      metrics.push('# TYPE leads_total gauge');
      metrics.push(`leads_total ${leadCount.count}`);
    } catch (error) {
      metrics.push('');
      metrics.push('# HELP leads_total Total number of leads');
      metrics.push('# TYPE leads_total gauge');
      metrics.push(`leads_total 0`);
    }

    // Business metrics - Subscriptions
    try {
      const subscriptionCount = await this.subscriptionRepository.count();
      metrics.push('');
      metrics.push('# HELP subscriptions_total Total number of subscriptions');
      metrics.push('# TYPE subscriptions_total gauge');
      metrics.push(`subscriptions_total ${subscriptionCount.count}`);
    } catch (error) {
      metrics.push('');
      metrics.push('# HELP subscriptions_total Total number of subscriptions');
      metrics.push('# TYPE subscriptions_total gauge');
      metrics.push(`subscriptions_total 0`);
    }

    // Business metrics - Users
    try {
      const userCount = await this.userRepository.count();
      metrics.push('');
      metrics.push('# HELP users_total Total number of users');
      metrics.push('# TYPE users_total gauge');
      metrics.push(`users_total ${userCount.count}`);
    } catch (error) {
      metrics.push('');
      metrics.push('# HELP users_total Total number of users');
      metrics.push('# TYPE users_total gauge');
      metrics.push(`users_total 0`);
    }

    // Business metrics - Invitations
    try {
      const invitationCount = await this.invitationRepository.count();
      metrics.push('');
      metrics.push('# HELP user_invitations_total Total number of user invitations');
      metrics.push('# TYPE user_invitations_total gauge');
      metrics.push(`user_invitations_total ${invitationCount.count}`);
    } catch (error) {
      metrics.push('');
      metrics.push('# HELP user_invitations_total Total number of user invitations');
      metrics.push('# TYPE user_invitations_total gauge');
      metrics.push(`user_invitations_total 0`);
    }

    // Business metrics - Invoices
    try {
      const invoiceCount = await this.invoiceRepository.count();
      metrics.push('');
      metrics.push('# HELP invoices_total Total number of invoices');
      metrics.push('# TYPE invoices_total gauge');
      metrics.push(`invoices_total ${invoiceCount.count}`);
    } catch (error) {
      metrics.push('');
      metrics.push('# HELP invoices_total Total number of invoices');
      metrics.push('# TYPE invoices_total gauge');
      metrics.push(`invoices_total 0`);
    }

    // Custom application counters from registry
    const registry = MetricsRegistry.getInstance();
    const counters = registry.getCounters();
    if (counters.size > 0) {
      metrics.push('');
      metrics.push('# HELP app_requests_total Application request counters');
      metrics.push('# TYPE app_requests_total counter');
      for (const [key, value] of counters) {
        metrics.push(`app_requests_total${key.includes('{') ? key.substring(key.indexOf('{')) : ''} ${value}`);
      }
    }

    // Custom gauges from registry
    const gauges = registry.getGauges();
    if (gauges.size > 0) {
      metrics.push('');
      metrics.push('# HELP app_gauge Application gauge metrics');
      metrics.push('# TYPE app_gauge gauge');
      for (const [key, value] of gauges) {
        const labelPart = key.includes('{') ? key.substring(key.indexOf('{')) : '';
        metrics.push(`app_gauge${labelPart} ${value}`);
      }
    }

    // Database connection status
    metrics.push('');
    metrics.push('# HELP database_up Database connection status (1=up, 0=down)');
    metrics.push('# TYPE database_up gauge');
    try {
      await this.tenantRepository.count();
      metrics.push(`database_up{db="postgresql"} 1`);
    } catch (error) {
      metrics.push(`database_up{db="postgresql"} 0`);
    }

    // HTTP response in Prometheus text format
    this.response.setHeader('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
    this.response.send(metrics.join('\n') + '\n');
    return this.response;
  }

  /**
   * Get tenant metrics using COUNT queries instead of loading all rows.
   * This is much more efficient for large datasets and won't block the event loop.
   */
  private async getTenantMetrics(): Promise<Record<string, number>> {
    const results: Record<string, number> = {
      active: 0,
      pending_provision: 0,
      provisioning: 0,
      provision_failed: 0,
      deprovisioning: 0,
      inactive: 0,
      total: 0,
    };

    try {
      // Use parallel COUNT queries instead of loading all tenant rows
      // This prevents blocking the event loop with large datasets
      const [
        totalCount,
        activeCount,
        pendingCount,
        provisioningCount,
        failedCount,
        deprovisioningCount,
        inactiveCount,
      ] = await Promise.all([
        this.tenantRepository.count(),
        this.tenantRepository.count({status: TenantStatus.ACTIVE}),
        this.tenantRepository.count({status: TenantStatus.PENDINGPROVISION}),
        this.tenantRepository.count({status: TenantStatus.PROVISIONING}),
        this.tenantRepository.count({status: TenantStatus.PROVISIONFAILED}),
        this.tenantRepository.count({status: TenantStatus.DEPROVISIONING}),
        this.tenantRepository.count({status: TenantStatus.INACTIVE}),
      ]);

      results.total = totalCount.count;
      results.active = activeCount.count;
      results.pending_provision = pendingCount.count;
      results.provisioning = provisioningCount.count;
      results.provision_failed = failedCount.count;
      results.deprovisioning = deprovisioningCount.count;
      results.inactive = inactiveCount.count;
    } catch (error) {
      // Return zeros on error - metrics endpoint should not fail
    }

    return results;
  }
}
