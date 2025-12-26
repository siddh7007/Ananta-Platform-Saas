/**
 * Deployment Activities
 *
 * Handles application deployment, rollback, and DNS configuration.
 */

import { Context } from '@temporalio/activity';
import * as AWS from 'aws-sdk';
import { config } from '../config';
import {
  DeployApplicationInput,
  DeploymentResult,
  RollbackDeploymentInput,
  ConfigureDnsInput,
  DnsResult,
} from '../types';
import { ResourceData, TenantTier } from '../types/common.types';
import { v4 as uuidv4 } from 'uuid';
import { createLogger } from '../utils/logger';
import { createActivityTracer } from '../observability/activity-tracer';
import {
  ResourceNotFoundError,
  ServiceUnavailableError,
  TimeoutError,
} from '../utils/errors';

const logger = createLogger('deployment-activities');

// ============================================
// AWS Clients
// ============================================

const ecs = new AWS.ECS({ region: config.aws.region });
const route53 = new AWS.Route53({ region: config.aws.region });

// ============================================
// Deploy Application
// ============================================

export async function deployApplication(
  input: DeployApplicationInput
): Promise<DeploymentResult> {
  const tracer = createActivityTracer('deployApplication', input.tenantId, input.tier);
  tracer.start();
  tracer.addAttributes({ tenantKey: input.tenantKey });

  const ctx = Context.current();
  const deploymentId = uuidv4();

  ctx.heartbeat('Starting application deployment');

  logger.info('Starting application deployment', {
    tenantId: input.tenantId,
    tenantKey: input.tenantKey,
    tier: input.tier,
    deploymentId,
  });

  try {
    // Get deployment configuration based on tier
    const deployConfig = getDeploymentConfig(input.tier);

    // Step 1: Update ECS service or create new deployment
    ctx.heartbeat('Updating ECS service');

    const clusterName =
      input.infrastructureOutputs.ecs_cluster_name ||
      `${input.tenantKey}-cluster`;
    const serviceName =
      input.infrastructureOutputs.ecs_service_name ||
      `${input.tenantKey}-service`;

    // For silo tier, we have dedicated ECS resources
    // For pooled tier, we update configuration in shared resources
    if (input.tier === 'silo') {
      await deploySiloApplication(input, clusterName, serviceName, ctx);
    } else {
      await deployPooledApplication(input, ctx);
    }

    // Step 2: Wait for deployment to stabilize (only for silo tier with dedicated ECS)
    if (input.tier === 'silo') {
      ctx.heartbeat('Waiting for deployment to stabilize');

      await waitForServiceStable(clusterName, serviceName, ctx);
    } else {
      // Pooled tier doesn't have dedicated ECS services - skip stability check
      ctx.heartbeat('Pooled deployment configured');
      logger.info('Skipping ECS stability check for pooled tier', {
        tenantId: input.tenantId,
        tier: input.tier,
      });
    }

    // Step 3: Perform health check (skip in development mode)
    ctx.heartbeat('Performing health check');

    const appPlaneUrl = buildAppPlaneUrl(input.tenantKey, input.tier);
    let healthCheckPassed = true;

    if (config.skipHealthCheck) {
      logger.info('Skipping health check (development mode)', {
        tenantId: input.tenantId,
        tier: input.tier,
        appPlaneUrl,
      });
    } else {
      healthCheckPassed = await performHealthCheck(appPlaneUrl);

      if (!healthCheckPassed) {
        throw new Error('Health check failed after deployment');
      }
    }

    // Step 4: Collect deployed resources
    const resources = collectDeploymentResources(input);

    const result: DeploymentResult = {
      deploymentId,
      status: 'deployed',
      appPlaneUrl,
      adminPortalUrl: `${appPlaneUrl}/admin`,
      resources,
      version: input.version || 'latest',
      healthCheckPassed,
    };

    tracer.success(result);
    logger.info('Application deployment completed', {
      tenantId: input.tenantId,
      deploymentId,
      appPlaneUrl,
      healthCheckPassed,
    });

    return result;
  } catch (error) {
    tracer.failure(error instanceof Error ? error : new Error(String(error)));
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Application deployment failed', {
      tenantId: input.tenantId,
      deploymentId,
      error: message,
    });
    throw new ServiceUnavailableError(`Application deployment failed: ${message}`);
  }
}

async function deploySiloApplication(
  input: DeployApplicationInput,
  clusterName: string,
  serviceName: string,
  ctx: Context
): Promise<void> {
  // Update ECS service with new task definition or force new deployment
  const imageTag = input.imageTag || 'latest';

  // Get current task definition
  const serviceDesc = await ecs
    .describeServices({
      cluster: clusterName,
      services: [serviceName],
    })
    .promise();

  if (!serviceDesc.services || serviceDesc.services.length === 0) {
    throw new ResourceNotFoundError(`Service ${serviceName} not found in cluster ${clusterName}`);
  }

  const currentTaskDef = serviceDesc.services[0].taskDefinition;

  // Get task definition details
  const taskDefDesc = await ecs
    .describeTaskDefinition({
      taskDefinition: currentTaskDef!,
    })
    .promise();

  if (!taskDefDesc.taskDefinition) {
    throw new Error('Task definition not found');
  }

  // Create new task definition with updated image
  const containerDefs = taskDefDesc.taskDefinition.containerDefinitions!.map(
    (container) => {
      if (container.name === 'app') {
        const [repo] = (container.image || '').split(':');
        return {
          ...container,
          image: `${repo}:${imageTag}`,
          environment: [
            ...(container.environment || []),
            { name: 'TENANT_ID', value: input.tenantId },
            { name: 'TENANT_KEY', value: input.tenantKey },
            ...(input.config
              ? Object.entries(input.config).map(([key, value]) => ({
                  name: key,
                  value: String(value),
                }))
              : []),
          ],
        };
      }
      return container;
    }
  );

  ctx.heartbeat('Registering new task definition');

  const newTaskDef = await ecs
    .registerTaskDefinition({
      family: taskDefDesc.taskDefinition.family!,
      taskRoleArn: taskDefDesc.taskDefinition.taskRoleArn,
      executionRoleArn: taskDefDesc.taskDefinition.executionRoleArn,
      networkMode: taskDefDesc.taskDefinition.networkMode,
      containerDefinitions: containerDefs,
      cpu: taskDefDesc.taskDefinition.cpu,
      memory: taskDefDesc.taskDefinition.memory,
      requiresCompatibilities: taskDefDesc.taskDefinition.requiresCompatibilities,
    })
    .promise();

  // Update service with new task definition
  ctx.heartbeat('Updating ECS service');

  await ecs
    .updateService({
      cluster: clusterName,
      service: serviceName,
      taskDefinition: newTaskDef.taskDefinition!.taskDefinitionArn,
      forceNewDeployment: true,
    })
    .promise();
}

async function deployPooledApplication(
  input: DeployApplicationInput,
  ctx: Context
): Promise<void> {
  // For pooled deployments, we update tenant configuration in shared infrastructure
  // This could involve:
  // 1. Updating tenant configuration in a shared database
  // 2. Updating routing rules in API Gateway or Load Balancer
  // 3. Notifying the application of new tenant

  ctx.heartbeat('Configuring pooled tenant');

  // In a real implementation, this would call the application's tenant onboarding API
  // or update shared configuration store (e.g., DynamoDB, Parameter Store)

  // For now, we'll simulate the configuration
  await sleep(2000);

  logger.info('Configured pooled tenant', {
    tenantId: input.tenantId,
    tenantKey: input.tenantKey,
  });
}

async function waitForServiceStable(
  clusterName: string,
  serviceName: string,
  ctx: Context
): Promise<void> {
  const maxAttempts = 60;
  const pollInterval = 10000;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    ctx.heartbeat(`Checking service stability (attempt ${attempt + 1})`);

    try {
      const result = await ecs
        .describeServices({
          cluster: clusterName,
          services: [serviceName],
        })
        .promise();

      const service = result.services?.[0];

      if (service) {
        const runningCount = service.runningCount || 0;
        const desiredCount = service.desiredCount || 0;
        const deployments = service.deployments || [];

        // Check if service is stable
        if (
          runningCount === desiredCount &&
          deployments.length === 1 &&
          deployments[0].rolloutState === 'COMPLETED'
        ) {
          return;
        }
      }
    } catch (error) {
      // Continue polling
    }

    await sleep(pollInterval);
  }

  throw new TimeoutError('Service did not stabilize within 10 minute timeout');
}

async function performHealthCheck(appUrl: string): Promise<boolean> {
  const axios = (await import('axios')).default;
  const maxAttempts = 10;
  const pollInterval = 5000;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const response = await axios.get(`${appUrl}/health`, {
        timeout: 5000,
        validateStatus: (status) => status < 500,
      });

      if (response.status === 200) {
        return true;
      }
    } catch (error) {
      // Continue polling
    }

    await sleep(pollInterval);
  }

  return false;
}

// ============================================
// Rollback Deployment
// ============================================

export async function rollbackDeployment(
  input: RollbackDeploymentInput
): Promise<void> {
  const tracer = createActivityTracer('rollbackDeployment', input.tenantId);
  tracer.start();
  tracer.addAttributes({ deploymentId: input.deploymentId });

  const ctx = Context.current();
  ctx.heartbeat('Rolling back deployment');

  logger.info('Rolling back deployment', {
    tenantId: input.tenantId,
    deploymentId: input.deploymentId,
  });

  try {
    // In a real implementation, this would:
    // 1. Get the previous task definition version
    // 2. Update the ECS service to use it
    // 3. Wait for rollback to complete

    await sleep(2000);

    tracer.success();
    logger.info('Deployment rollback completed', {
      tenantId: input.tenantId,
      deploymentId: input.deploymentId,
    });
  } catch (error) {
    tracer.failure(error instanceof Error ? error : new Error(String(error)));
    throw error;
  }
}

// ============================================
// Remove Deployment
// ============================================

export async function removeDeployment(input: {
  tenantId: string;
  tenantKey: string;
  tier: TenantTier;
}): Promise<void> {
  const tracer = createActivityTracer('removeDeployment', input.tenantId, input.tier);
  tracer.start();
  tracer.addAttributes({ tenantKey: input.tenantKey });

  const ctx = Context.current();
  ctx.heartbeat('Removing deployment');

  logger.info('Removing deployment', {
    tenantId: input.tenantId,
    tenantKey: input.tenantKey,
    tier: input.tier,
  });

  try {
    if (input.tier === 'silo') {
      // For silo, the infrastructure activities handle ECS cleanup
      logger.info('Silo deployment will be removed with infrastructure', {
        tenantKey: input.tenantKey,
      });
    } else {
      // For pooled, remove tenant configuration
      logger.info('Removing pooled tenant configuration', {
        tenantKey: input.tenantKey,
      });
      await sleep(1000);
    }

    tracer.success();
    logger.info('Deployment removal completed', {
      tenantId: input.tenantId,
      tenantKey: input.tenantKey,
    });
  } catch (error) {
    tracer.failure(error instanceof Error ? error : new Error(String(error)));
    throw error;
  }
}

// ============================================
// Configure DNS
// ============================================

export async function configureDns(input: ConfigureDnsInput): Promise<DnsResult> {
  const tracer = createActivityTracer('configureDns', input.tenantId);
  tracer.start();
  tracer.addAttributes({
    tenantKey: input.tenantKey,
    domainCount: input.domains.length,
  });

  const ctx = Context.current();
  ctx.heartbeat('Configuring DNS');

  logger.info('Configuring DNS', {
    tenantId: input.tenantId,
    tenantKey: input.tenantKey,
    domains: input.domains,
  });

  const records: DnsResult['records'] = [];

  try {
    // Get hosted zone for the base domain
    const baseDomain = getBaseDomain(input.domains[0]);
    const hostedZone = await findHostedZone(baseDomain);

    if (!hostedZone) {
      throw new ResourceNotFoundError(`Hosted zone not found for domain: ${baseDomain}`);
    }

    for (const domain of input.domains) {
      ctx.heartbeat(`Configuring DNS for ${domain}`);

      const recordType = input.recordType || 'CNAME';
      const ttl = 300;

      const changeBatch: AWS.Route53.ChangeBatch = {
        Changes: [
          {
            Action: 'UPSERT',
            ResourceRecordSet: {
              Name: domain,
              Type: recordType,
              TTL: ttl,
              ResourceRecords: [{ Value: input.targetEndpoint }],
            },
          },
        ],
      };

      await route53
        .changeResourceRecordSets({
          HostedZoneId: hostedZone.Id,
          ChangeBatch: changeBatch,
        })
        .promise();

      records.push({
        domain,
        recordType,
        value: input.targetEndpoint,
        ttl,
      });
    }

    const result: DnsResult = {
      configured: true,
      records,
    };

    tracer.success(result);
    logger.info('DNS configuration completed', {
      tenantId: input.tenantId,
      recordCount: records.length,
    });

    return result;
  } catch (error) {
    tracer.failure(error instanceof Error ? error : new Error(String(error)));
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('DNS configuration failed', {
      tenantId: input.tenantId,
      error: message,
    });
    throw error;
  }
}

async function findHostedZone(
  domain: string
): Promise<AWS.Route53.HostedZone | null> {
  const result = await route53.listHostedZonesByName({ DNSName: domain }).promise();

  const zone = result.HostedZones?.find(
    (z) => z.Name === `${domain}.` || domain.endsWith(z.Name.slice(0, -1))
  );

  return zone || null;
}

function getBaseDomain(domain: string): string {
  const parts = domain.split('.');
  if (parts.length > 2) {
    return parts.slice(-2).join('.');
  }
  return domain;
}

// ============================================
// Utility Functions
// ============================================

function getDeploymentConfig(tier: TenantTier): Record<string, unknown> {
  const configs: Record<TenantTier, Record<string, unknown>> = {
    silo: {
      dedicatedResources: true,
      scalingMin: 2,
      scalingMax: 10,
    },
    pooled: {
      dedicatedResources: false,
      sharedCluster: true,
    },
    bridge: {
      dedicatedResources: true,
      sharedDatabase: true,
      scalingMin: 1,
      scalingMax: 5,
    },
  };

  return configs[tier];
}

function buildAppPlaneUrl(tenantKey: string, tier: TenantTier): string {
  const template = config.appPlaneBaseUrl;
  return template.replace('{tenant}', tenantKey);
}

function collectDeploymentResources(input: DeployApplicationInput): ResourceData[] {
  const resources: ResourceData[] = [];

  if (input.infrastructureOutputs.ecs_service_name) {
    resources.push({
      type: 'container',
      externalIdentifier: input.infrastructureOutputs.ecs_service_name,
      metadata: {
        cluster: input.infrastructureOutputs.ecs_cluster_name,
        tenantId: input.tenantId,
      },
    });
  }

  return resources;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
