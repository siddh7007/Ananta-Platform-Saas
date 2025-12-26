/**
 * Infrastructure Activities (Terraform)
 *
 * Handles infrastructure provisioning and destruction using Terraform.
 * Supports both Terraform Cloud and local Terraform execution.
 */

import { Context } from '@temporalio/activity';
import axios, { AxiosInstance } from 'axios';
import { config } from '../config';
import {
  ProvisionInfrastructureInput,
  InfrastructureResult,
  DestroyInfrastructureInput,
  TerraformRunStatus,
} from '../types';
import { ResourceData, TenantTier } from '../types/common.types';
import { createLogger } from '../utils/logger';
import { createActivityTracer } from '../observability/activity-tracer';
import {
  InvalidConfigurationError,
  ServiceUnavailableError,
  TimeoutError,
} from '../utils/errors';

const logger = createLogger('infrastructure-activities');

// ============================================
// Terraform Cloud Client
// ============================================

let tfCloudClient: AxiosInstance | null = null;

function getTerraformCloudClient(): AxiosInstance {
  if (!tfCloudClient && config.terraform.cloudEnabled) {
    logger.debug('Initializing Terraform Cloud client');
    tfCloudClient = axios.create({
      baseURL: 'https://app.terraform.io/api/v2',
      headers: {
        Authorization: `Bearer ${config.terraform.cloudToken}`,
        'Content-Type': 'application/vnd.api+json',
      },
      timeout: 30000, // 30 second timeout
    });
  }
  if (!tfCloudClient) {
    throw new InvalidConfigurationError('Terraform Cloud is not configured');
  }
  return tfCloudClient;
}

// ============================================
// Provision Infrastructure
// ============================================

export async function provisionInfrastructure(
  input: ProvisionInfrastructureInput
): Promise<InfrastructureResult> {
  const tracer = createActivityTracer('provisionInfrastructure', input.tenantId, input.tier);
  tracer.start();
  tracer.addAttributes({
    tenantKey: input.tenantKey,
    backend: config.terraform.cloudEnabled ? 'cloud' : 'local',
  });

  const ctx = Context.current();
  ctx.heartbeat('Starting infrastructure provisioning');

  logger.info('Starting infrastructure provisioning', {
    tenantId: input.tenantId,
    tenantKey: input.tenantKey,
    tier: input.tier,
    region: input.region || config.aws.region,
  });

  try {
    let result: InfrastructureResult;

    if (config.terraform.cloudEnabled) {
      result = await provisionWithTerraformCloud(input, ctx);
    } else if (config.terraform.localEnabled) {
      result = await provisionWithLocalTerraform(input, ctx);
    } else {
      throw new InvalidConfigurationError('No Terraform backend configured');
    }

    tracer.success(result);
    logger.info('Infrastructure provisioning completed', {
      tenantId: input.tenantId,
      runId: result.runId,
      resourceCount: result.resources.length,
    });

    return result;
  } catch (error) {
    tracer.failure(error instanceof Error ? error : new Error(String(error)));
    throw error;
  }
}

// ============================================
// Terraform Cloud Implementation
// ============================================

async function provisionWithTerraformCloud(
  input: ProvisionInfrastructureInput,
  ctx: Context
): Promise<InfrastructureResult> {
  const client = getTerraformCloudClient();
  const workspaceName = getWorkspaceForTier(input.tier);

  try {
    // Step 1: Get workspace ID
    ctx.heartbeat('Getting workspace');

    const workspaceResponse = await client.get(
      `/organizations/${config.terraform.cloudOrg}/workspaces/${workspaceName}`
    );
    const workspaceId = workspaceResponse.data.data.id;

    // Step 2: Set variables for this tenant
    ctx.heartbeat('Setting Terraform variables');

    await setTerraformVariables(client, workspaceId, {
      tenant_id: input.tenantId,
      tenant_key: input.tenantKey,
      tenant_tier: input.tier,
      region: input.region || config.aws.region,
      idp_organization_id: input.idpOrganizationId || '',
      ...input.customVariables,
    });

    // Step 3: Create a configuration version (trigger run)
    ctx.heartbeat('Triggering Terraform run');

    const runResponse = await client.post(`/runs`, {
      data: {
        type: 'runs',
        attributes: {
          message: `Provisioning tenant: ${input.tenantKey}`,
          'auto-apply': true,
          'plan-only': false,
        },
        relationships: {
          workspace: {
            data: {
              type: 'workspaces',
              id: workspaceId,
            },
          },
        },
      },
    });

    const runId = runResponse.data.data.id;

    // Step 4: Wait for run completion
    const result = await waitForTerraformRun(client, runId, ctx);

    if (result.status !== 'applied') {
      throw new Error(`Terraform run failed with status: ${result.status}`);
    }

    // Step 5: Get outputs
    ctx.heartbeat('Getting Terraform outputs');

    const outputs = await getTerraformOutputs(client, workspaceId);

    // Step 6: Map outputs to resources
    const resources = mapOutputsToResources(outputs, input.tenantId);

    return {
      runId,
      status: 'applied',
      outputs,
      resources,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Terraform Cloud provisioning failed: ${message}`);
  }
}

async function setTerraformVariables(
  client: AxiosInstance,
  workspaceId: string,
  variables: Record<string, string>
): Promise<void> {
  // Get existing variables
  const existingVarsResponse = await client.get(
    `/workspaces/${workspaceId}/vars`
  );
  const existingVars = existingVarsResponse.data.data;

  for (const [key, value] of Object.entries(variables)) {
    const existing = existingVars.find(
      (v: { attributes: { key: string } }) => v.attributes.key === key
    );

    if (existing) {
      // Update existing variable
      await client.patch(`/vars/${existing.id}`, {
        data: {
          type: 'vars',
          id: existing.id,
          attributes: {
            value,
          },
        },
      });
    } else {
      // Create new variable
      await client.post(`/vars`, {
        data: {
          type: 'vars',
          attributes: {
            key,
            value,
            category: 'terraform',
            sensitive: key.includes('secret') || key.includes('password'),
          },
          relationships: {
            workspace: {
              data: {
                type: 'workspaces',
                id: workspaceId,
              },
            },
          },
        },
      });
    }
  }
}

async function waitForTerraformRun(
  client: AxiosInstance,
  runId: string,
  ctx: Context
): Promise<TerraformRunStatus> {
  const terminalStatuses = [
    'applied',
    'errored',
    'cancelled',
    'discarded',
    'planned_and_finished',
  ];

  let attempts = 0;
  const maxAttempts = 120; // 30 minutes with 15s interval
  const pollInterval = 15000;

  while (attempts < maxAttempts) {
    ctx.heartbeat(`Checking Terraform run status (attempt ${attempts + 1})`);

    const response = await client.get(`/runs/${runId}`);
    const status = response.data.data.attributes.status;
    const message = response.data.data.attributes.message;

    if (terminalStatuses.includes(status)) {
      return {
        runId,
        status: status as TerraformRunStatus['status'],
        message,
      };
    }

    await sleep(pollInterval);
    attempts++;
  }

  throw new TimeoutError('Terraform run timed out after 30 minutes');
}

async function getTerraformOutputs(
  client: AxiosInstance,
  workspaceId: string
): Promise<Record<string, string>> {
  const response = await client.get(
    `/workspaces/${workspaceId}/current-state-version?include=outputs`
  );

  const outputs: Record<string, string> = {};
  const outputsData = response.data.included || [];

  for (const output of outputsData) {
    if (output.type === 'state-version-outputs') {
      outputs[output.attributes.name] = output.attributes.value;
    }
  }

  return outputs;
}

// ============================================
// Local Terraform Implementation
// ============================================

async function provisionWithLocalTerraform(
  input: ProvisionInfrastructureInput,
  ctx: Context
): Promise<InfrastructureResult> {
  const { execSync } = await import('child_process');
  const workingDir = `${config.terraform.workingDir}/${input.tier}`;

  try {
    // Create tfvars content
    const tfvars = Object.entries({
      tenant_id: input.tenantId,
      tenant_key: input.tenantKey,
      tenant_tier: input.tier,
      region: input.region || config.aws.region,
      idp_organization_id: input.idpOrganizationId || '',
      ...input.customVariables,
    })
      .map(([key, value]) => `${key} = "${value}"`)
      .join('\n');

    const tfvarsFile = `${workingDir}/tenant-${input.tenantKey}.tfvars`;

    // Write tfvars file
    const fs = await import('fs');
    fs.writeFileSync(tfvarsFile, tfvars);

    // Initialize Terraform
    ctx.heartbeat('Initializing Terraform');
    execSync('terraform init -input=false', {
      cwd: workingDir,
      stdio: 'pipe',
    });

    // Plan
    ctx.heartbeat('Planning Terraform changes');
    execSync(
      `terraform plan -var-file=${tfvarsFile} -out=tfplan -input=false`,
      {
        cwd: workingDir,
        stdio: 'pipe',
      }
    );

    // Apply
    ctx.heartbeat('Applying Terraform changes');
    execSync('terraform apply -auto-approve tfplan', {
      cwd: workingDir,
      stdio: 'pipe',
    });

    // Get outputs
    ctx.heartbeat('Getting Terraform outputs');
    const outputsJson = execSync('terraform output -json', {
      cwd: workingDir,
      encoding: 'utf-8',
    });

    const rawOutputs = JSON.parse(outputsJson);
    const outputs: Record<string, string> = {};

    for (const [key, value] of Object.entries(rawOutputs)) {
      outputs[key] = (value as { value: string }).value;
    }

    const resources = mapOutputsToResources(outputs, input.tenantId);

    return {
      runId: `local-${Date.now()}`,
      status: 'applied',
      outputs,
      resources,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Local Terraform provisioning failed: ${message}`);
  }
}

// ============================================
// Destroy Infrastructure
// ============================================

export async function destroyInfrastructure(
  input: DestroyInfrastructureInput
): Promise<{ deletedResources: ResourceData[] }> {
  const tracer = createActivityTracer('destroyInfrastructure', input.tenantId, input.tier);
  tracer.start();
  tracer.addAttributes({
    tenantKey: input.tenantKey,
    backend: config.terraform.cloudEnabled ? 'cloud' : 'local',
    force: input.force ?? false,
  });

  const ctx = Context.current();
  ctx.heartbeat('Starting infrastructure destruction');

  logger.info('Starting infrastructure destruction', {
    tenantId: input.tenantId,
    tenantKey: input.tenantKey,
    tier: input.tier,
    force: input.force,
  });

  try {
    let result: { deletedResources: ResourceData[] };

    if (config.terraform.cloudEnabled) {
      result = await destroyWithTerraformCloud(input, ctx);
    } else if (config.terraform.localEnabled) {
      result = await destroyWithLocalTerraform(input, ctx);
    } else {
      throw new InvalidConfigurationError('No Terraform backend configured');
    }

    tracer.success(result);
    logger.info('Infrastructure destruction completed', {
      tenantId: input.tenantId,
      tenantKey: input.tenantKey,
    });

    return result;
  } catch (error) {
    tracer.failure(error instanceof Error ? error : new Error(String(error)));
    throw error;
  }
}

async function destroyWithTerraformCloud(
  input: DestroyInfrastructureInput,
  ctx: Context
): Promise<{ deletedResources: ResourceData[] }> {
  const client = getTerraformCloudClient();
  const workspaceName = getWorkspaceForTier(input.tier);

  try {
    // Get workspace ID
    const workspaceResponse = await client.get(
      `/organizations/${config.terraform.cloudOrg}/workspaces/${workspaceName}`
    );
    const workspaceId = workspaceResponse.data.data.id;

    // Get current state to know what resources exist
    const stateResponse = await client.get(
      `/workspaces/${workspaceId}/current-state-version`
    );

    // Create destroy run
    ctx.heartbeat('Creating destroy run');

    const runResponse = await client.post(`/runs`, {
      data: {
        type: 'runs',
        attributes: {
          message: `Destroying tenant: ${input.tenantKey}`,
          'is-destroy': true,
          'auto-apply': input.force === true,
        },
        relationships: {
          workspace: {
            data: {
              type: 'workspaces',
              id: workspaceId,
            },
          },
        },
      },
    });

    const runId = runResponse.data.data.id;

    // Wait for completion
    const result = await waitForTerraformRun(client, runId, ctx);

    if (result.status !== 'applied' && result.status !== 'planned_and_finished') {
      throw new Error(`Terraform destroy failed with status: ${result.status}`);
    }

    return {
      deletedResources: [], // Resources tracked separately
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Terraform Cloud destroy failed: ${message}`);
  }
}

async function destroyWithLocalTerraform(
  input: DestroyInfrastructureInput,
  ctx: Context
): Promise<{ deletedResources: ResourceData[] }> {
  const { execSync } = await import('child_process');
  const workingDir = `${config.terraform.workingDir}/${input.tier}`;
  const tfvarsFile = `${workingDir}/tenant-${input.tenantKey}.tfvars`;

  try {
    ctx.heartbeat('Destroying Terraform resources');

    execSync(
      `terraform destroy -var-file=${tfvarsFile} -auto-approve -input=false`,
      {
        cwd: workingDir,
        stdio: 'pipe',
      }
    );

    // Clean up tfvars file
    const fs = await import('fs');
    if (fs.existsSync(tfvarsFile)) {
      fs.unlinkSync(tfvarsFile);
    }

    return {
      deletedResources: [],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Local Terraform destroy failed: ${message}`);
  }
}

// ============================================
// Utility Functions
// ============================================

function getWorkspaceForTier(tier: TenantTier): string {
  switch (tier) {
    case 'silo':
      return config.terraform.workspaces.silo;
    case 'pooled':
      return config.terraform.workspaces.pooled;
    case 'bridge':
      return config.terraform.workspaces.bridge;
    default:
      return config.terraform.workspaces.pooled;
  }
}

function mapOutputsToResources(
  outputs: Record<string, string>,
  tenantId: string
): ResourceData[] {
  const resources: ResourceData[] = [];

  // Map common Terraform outputs to resources
  if (outputs.s3_bucket_name) {
    resources.push({
      type: 'bucket',
      externalIdentifier: outputs.s3_bucket_name,
      metadata: {
        arn: outputs.s3_bucket_arn,
        region: outputs.region || config.aws.region,
        tenantId,
      },
    });
  }

  if (outputs.database_endpoint) {
    resources.push({
      type: 'database',
      externalIdentifier: outputs.database_endpoint,
      metadata: {
        host: outputs.database_host,
        port: outputs.database_port,
        name: outputs.database_name,
        tenantId,
      },
    });
  }

  if (outputs.ecs_cluster_name) {
    resources.push({
      type: 'container',
      externalIdentifier: outputs.ecs_cluster_name,
      metadata: {
        clusterArn: outputs.ecs_cluster_arn,
        serviceName: outputs.ecs_service_name,
        tenantId,
      },
    });
  }

  if (outputs.load_balancer_dns) {
    resources.push({
      type: 'load_balancer',
      externalIdentifier: outputs.load_balancer_dns,
      metadata: {
        arn: outputs.load_balancer_arn,
        tenantId,
      },
    });
  }

  if (outputs.vpc_id) {
    resources.push({
      type: 'vpc',
      externalIdentifier: outputs.vpc_id,
      metadata: {
        cidrBlock: outputs.vpc_cidr,
        tenantId,
      },
    });
  }

  return resources;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
