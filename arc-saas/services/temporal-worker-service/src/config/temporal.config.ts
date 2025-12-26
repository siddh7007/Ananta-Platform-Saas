/**
 * Temporal configuration
 */

import { TLSConfig } from '@temporalio/client';
import * as fs from 'fs';

export interface TemporalConfig {
  address: string;
  namespace: string;
  taskQueue: string;
  tls?: TLSConfig;
  workerOptions: {
    maxConcurrentActivities: number;
    maxConcurrentWorkflows: number;
    maxCachedWorkflows: number;
  };
}

export interface DatabaseConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  schema: string;
  ssl: boolean;
}

export interface Auth0Config {
  enabled: boolean;
  domain: string;
  clientId: string;
  clientSecret: string;
  managementAudience: string;
}

export interface KeycloakConfig {
  enabled: boolean;
  url: string;
  realm: string;
  adminClientId: string;
  adminUsername: string;
  adminPassword: string;
}

export interface TerraformConfig {
  enabled: boolean;
  cloudEnabled: boolean;
  cloudToken?: string;
  cloudOrg?: string;
  workspaces: {
    silo: string;
    pooled: string;
    bridge: string;
  };
  localEnabled: boolean;
  workingDir?: string;
  stateBackend?: string;
  stateBucket?: string;
  stateRegion?: string;
}

export interface AwsConfig {
  region: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  ses: {
    fromEmail: string;
    replyToEmail: string;
  };
}

export interface NovuConfig {
  enabled: boolean;
  apiKey: string;
  backendUrl: string;
  supportEmail: string;
  templates: {
    welcome: string;
    provisioningFailed: string;
    deprovisioning: string;
  };
}

export interface StorageConfig {
  s3: {
    endpoint: string;
    region: string;
    accessKeyId: string;
    secretAccessKey: string;
    forcePathStyle: boolean;
  };
}

export interface ServiceUrls {
  tenantManagement: {
    url: string;
  };
}

export interface AppConfig {
  temporal: TemporalConfig;
  database: DatabaseConfig;
  auth0: Auth0Config;
  keycloak: KeycloakConfig;
  terraform: TerraformConfig;
  aws: AwsConfig;
  novu: NovuConfig;
  storage?: StorageConfig;
  services?: ServiceUrls;
  controlPlaneUrl: string;
  appPlaneBaseUrl: string;
  isDevelopment: boolean;
  skipHealthCheck: boolean;
}

function loadTlsConfig(): TLSConfig | undefined {
  const tlsEnabled = process.env.TEMPORAL_TLS_ENABLED === 'true';
  if (!tlsEnabled) return undefined;

  const certPath = process.env.TEMPORAL_TLS_CERT_PATH;
  const keyPath = process.env.TEMPORAL_TLS_KEY_PATH;

  if (!certPath || !keyPath) {
    throw new Error('TLS enabled but cert/key paths not provided');
  }

  return {
    clientCertPair: {
      crt: fs.readFileSync(certPath),
      key: fs.readFileSync(keyPath),
    },
  };
}

export function loadConfig(): AppConfig {
  // Determine Temporal address based on cloud vs self-hosted
  const useCloud = process.env.TEMPORAL_CLOUD_ENABLED === 'true';
  const temporalAddress = useCloud
    ? `${process.env.TEMPORAL_CLOUD_NAMESPACE}.tmprl.cloud:7233`
    : process.env.TEMPORAL_ADDRESS || 'localhost:7233';

  const namespace = useCloud
    ? process.env.TEMPORAL_CLOUD_NAMESPACE || 'default'
    : process.env.TEMPORAL_NAMESPACE || 'arc-saas';

  return {
    temporal: {
      address: temporalAddress,
      namespace,
      taskQueue: process.env.TEMPORAL_TASK_QUEUE || 'tenant-provisioning',
      tls: loadTlsConfig(),
      workerOptions: {
        maxConcurrentActivities: parseInt(
          process.env.TEMPORAL_WORKER_MAX_CONCURRENT_ACTIVITIES || '10',
          10
        ),
        maxConcurrentWorkflows: parseInt(
          process.env.TEMPORAL_WORKER_MAX_CONCURRENT_WORKFLOWS || '50',
          10
        ),
        maxCachedWorkflows: parseInt(
          process.env.TEMPORAL_WORKER_MAX_CACHED_WORKFLOWS || '100',
          10
        ),
      },
    },

    database: {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'password',
      database: process.env.DB_DATABASE || 'tenant_management',
      schema: process.env.DB_SCHEMA || 'main',
      ssl: process.env.DB_SSL === 'true',
    },

    auth0: {
      enabled: process.env.AUTH0_ENABLED === 'true',
      domain: process.env.AUTH0_DOMAIN || '',
      clientId: process.env.AUTH0_CLIENT_ID || '',
      clientSecret: process.env.AUTH0_CLIENT_SECRET || '',
      managementAudience:
        process.env.AUTH0_MANAGEMENT_AUDIENCE ||
        `https://${process.env.AUTH0_DOMAIN}/api/v2/`,
    },

    keycloak: {
      enabled: process.env.KEYCLOAK_ENABLED === 'true',
      url: process.env.KEYCLOAK_URL || 'http://localhost:8080',
      realm: process.env.KEYCLOAK_REALM || 'master',
      adminClientId: process.env.KEYCLOAK_ADMIN_CLIENT_ID || 'admin-cli',
      adminUsername: process.env.KEYCLOAK_ADMIN_USERNAME || 'admin',
      adminPassword: process.env.KEYCLOAK_ADMIN_PASSWORD || 'admin',
    },

    terraform: {
      enabled: process.env.TERRAFORM_ENABLED === 'true',
      cloudEnabled: process.env.TF_CLOUD_ENABLED === 'true',
      cloudToken: process.env.TF_CLOUD_TOKEN,
      cloudOrg: process.env.TF_CLOUD_ORG,
      workspaces: {
        silo: process.env.TF_WORKSPACE_SILO || 'tenant-silo',
        pooled: process.env.TF_WORKSPACE_POOLED || 'tenant-pooled',
        bridge: process.env.TF_WORKSPACE_BRIDGE || 'tenant-bridge',
      },
      localEnabled: process.env.TF_LOCAL_ENABLED === 'true',
      workingDir: process.env.TF_WORKING_DIR,
      stateBackend: process.env.TF_STATE_BACKEND,
      stateBucket: process.env.TF_STATE_BUCKET,
      stateRegion: process.env.TF_STATE_REGION,
    },

    aws: {
      region: process.env.AWS_REGION || 'us-east-1',
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      ses: {
        fromEmail: process.env.SES_FROM_EMAIL || 'noreply@example.com',
        replyToEmail: process.env.SES_REPLY_TO_EMAIL || 'support@example.com',
      },
    },

    novu: {
      enabled: process.env.NOVU_ENABLED === 'true',
      apiKey: process.env.NOVU_API_KEY || '',
      backendUrl: process.env.NOVU_BACKEND_URL || 'http://localhost:3000',
      supportEmail: process.env.NOVU_SUPPORT_EMAIL || 'support@example.com',
      templates: {
        welcome: process.env.NOVU_TEMPLATE_WELCOME || 'tenant-welcome',
        provisioningFailed:
          process.env.NOVU_TEMPLATE_PROVISIONING_FAILED || 'tenant-provisioning-failed',
        deprovisioning:
          process.env.NOVU_TEMPLATE_DEPROVISIONING || 'tenant-deprovisioning',
      },
    },

    services: {
      tenantManagement: {
        url: process.env.TENANT_MANAGEMENT_SERVICE_URL || 'http://localhost:4300',
      },
    },

    controlPlaneUrl: process.env.CONTROL_PLANE_URL || 'http://localhost:3000',
    appPlaneBaseUrl:
      process.env.APP_PLANE_BASE_URL || 'https://{tenant}.app.example.com',
    isDevelopment: process.env.NODE_ENV !== 'production',
    skipHealthCheck:
      process.env.SKIP_HEALTH_CHECK === 'true' ||
      process.env.NODE_ENV !== 'production',
  };
}

export const config = loadConfig();
