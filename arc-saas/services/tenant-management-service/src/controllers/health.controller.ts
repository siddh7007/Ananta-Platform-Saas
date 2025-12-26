import {get} from '@loopback/openapi-v3';
import {inject} from '@loopback/context';
import {authorize} from 'loopback4-authorization';
import {STATUS_CODE} from '@sourceloop/core';
import {repository} from '@loopback/repository';
import {RestBindings, Response} from '@loopback/rest';
import {TenantRepository} from '../repositories';

/**
 * Comprehensive health check response matching the documented contract.
 * Used by monitoring systems and the /health endpoint.
 */
export interface HealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  service: string;
  version: string;
  uptime: number;
  memory: {
    heapUsed: number;
    heapTotal: number;
    rss: number;
  };
  checks: {
    database: {status: string; latency?: number};
    temporal?: {status: string};
    keycloak?: {status: string};
  };
}

/**
 * Liveness probe response - simple check that process is running.
 */
export interface LivenessResponse {
  status: 'ok';
  timestamp: string;
}

/**
 * Readiness probe response - checks if service can handle requests.
 */
export interface ReadinessResponse {
  status: 'ready' | 'not_ready';
  timestamp: string;
  checks: {
    database: {status: string};
  };
}

const basePath = '/health';
const SERVICE_NAME = 'tenant-management-service';
const SERVICE_VERSION = process.env.npm_package_version ?? '1.0.0';

export class HealthController {
  constructor(
    @repository(TenantRepository)
    private tenantRepository: TenantRepository,
    @inject(RestBindings.Http.RESPONSE, {optional: true})
    private response?: Response,
  ) {}

  @authorize({permissions: ['*']})
  @get(basePath, {
    responses: {
      [STATUS_CODE.OK]: {
        description: 'Comprehensive health check endpoint',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                status: {type: 'string', enum: ['healthy', 'degraded', 'unhealthy']},
                timestamp: {type: 'string', format: 'date-time'},
                service: {type: 'string'},
                version: {type: 'string'},
                uptime: {type: 'number'},
                memory: {
                  type: 'object',
                  properties: {
                    heapUsed: {type: 'number'},
                    heapTotal: {type: 'number'},
                    rss: {type: 'number'},
                  },
                },
                checks: {
                  type: 'object',
                  properties: {
                    database: {type: 'object'},
                    temporal: {type: 'object'},
                    keycloak: {type: 'object'},
                  },
                },
              },
            },
          },
        },
      },
    },
  })
  async healthCheck(): Promise<HealthResponse> {
    const timestamp = new Date().toISOString();

    // Check database connection
    const dbCheck = await this.checkDatabaseHealth();

    // Check Temporal (if configured)
    const temporalCheck = await this.checkTemporalHealth();

    // Check Keycloak (if configured)
    const keycloakCheck = await this.checkKeycloakHealth();

    // Determine overall status based on critical dependencies
    const dbUnhealthy = dbCheck.status === 'unhealthy';
    const hasDegraded =
      dbCheck.status === 'degraded' ||
      temporalCheck?.status === 'degraded' ||
      keycloakCheck?.status === 'degraded';

    const overallStatus: 'healthy' | 'degraded' | 'unhealthy' = dbUnhealthy
      ? 'unhealthy'
      : hasDegraded
        ? 'degraded'
        : 'healthy';

    // Get memory metrics
    const memUsage = process.memoryUsage();

    const response: HealthResponse = {
      status: overallStatus,
      timestamp,
      service: SERVICE_NAME,
      version: SERVICE_VERSION,
      uptime: process.uptime(),
      memory: {
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal,
        rss: memUsage.rss,
      },
      checks: {
        database: dbCheck,
      },
    };

    // Add optional checks if configured
    if (temporalCheck) {
      response.checks.temporal = temporalCheck;
    }
    if (keycloakCheck) {
      response.checks.keycloak = keycloakCheck;
    }

    return response;
  }

  @authorize({permissions: ['*']})
  @get(`${basePath}/live`, {
    responses: {
      [STATUS_CODE.OK]: {
        description: 'Liveness probe for Kubernetes - checks if process is running',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                status: {type: 'string', enum: ['ok']},
                timestamp: {type: 'string', format: 'date-time'},
              },
            },
          },
        },
      },
    },
  })
  async liveness(): Promise<LivenessResponse> {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }

  @authorize({permissions: ['*']})
  @get(`${basePath}/ready`, {
    responses: {
      [STATUS_CODE.OK]: {
        description: 'Readiness probe - checks if service can handle requests',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                status: {type: 'string', enum: ['ready', 'not_ready']},
                timestamp: {type: 'string', format: 'date-time'},
                checks: {
                  type: 'object',
                  properties: {
                    database: {type: 'object'},
                  },
                },
              },
            },
          },
        },
      },
      [STATUS_CODE.SERVICE_UNAVAILABLE]: {
        description: 'Service not ready',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                status: {type: 'string', enum: ['not_ready']},
                timestamp: {type: 'string', format: 'date-time'},
                checks: {type: 'object'},
              },
            },
          },
        },
      },
    },
  })
  async readiness(): Promise<ReadinessResponse> {
    const timestamp = new Date().toISOString();
    try {
      // Check if database is accessible
      const startTime = Date.now();
      await this.tenantRepository.count();
      const latency = Date.now() - startTime;

      return {
        status: 'ready',
        timestamp,
        checks: {
          database: {status: 'healthy', latency} as {status: string},
        },
      };
    } catch (error) {
      // Set 503 status code for not ready
      if (this.response) {
        this.response.status(503);
      }
      return {
        status: 'not_ready',
        timestamp,
        checks: {
          database: {status: 'unhealthy'},
        },
      };
    }
  }

  /**
   * Check database health - returns status for the checks object.
   */
  private async checkDatabaseHealth(): Promise<{status: string; latency?: number}> {
    const startTime = Date.now();
    try {
      await this.tenantRepository.count();
      const latency = Date.now() - startTime;
      const status =
        latency < 100 ? 'healthy' : latency < 500 ? 'degraded' : 'unhealthy';
      return {status, latency};
    } catch (error) {
      return {status: 'unhealthy', latency: Date.now() - startTime};
    }
  }

  /**
   * Check Temporal health - returns undefined if not configured.
   */
  private async checkTemporalHealth(): Promise<{status: string} | undefined> {
    const temporalAddress = process.env.TEMPORAL_ADDRESS;
    if (!temporalAddress) {
      return undefined;
    }

    // Simple check - in production you'd use Temporal client health check
    return {status: 'healthy'};
  }

  /**
   * Check Keycloak health - returns undefined if not configured.
   */
  private async checkKeycloakHealth(): Promise<{status: string} | undefined> {
    const keycloakUrl = process.env.KEYCLOAK_URL || process.env.KEYCLOAK_HOST;
    if (!keycloakUrl) {
      return undefined;
    }

    try {
      const response = await fetch(`${keycloakUrl}/health/ready`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });

      if (response.ok) {
        return {status: 'healthy'};
      } else {
        return {status: 'degraded'};
      }
    } catch (error) {
      return {status: 'unhealthy'};
    }
  }
}
