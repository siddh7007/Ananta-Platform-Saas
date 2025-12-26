/**
 * ARC SaaS Temporal Worker Service
 *
 * This service provides durable workflow orchestration for tenant provisioning,
 * deprovisioning, and deployment operations using Temporal.
 *
 * @packageDocumentation
 */

import * as dotenv from 'dotenv';
import * as dotenvExt from 'dotenv-extended';

// Load environment variables first (before any other imports that might use them)
dotenv.config();
dotenvExt.load({
  schema: '.env.example',
  errorOnMissing: false,
  includeProcessEnv: true,
});

import { createLogger } from './utils/logger';

const logger = createLogger('main');

// Export types for external use
export * from './types';

// Export utilities
export * from './utils';

// Export observability
export * from './observability';

// Export client utilities
export { createClient, getClient, closeClient } from './client';

// Export workflows for client-side type inference
export {
  provisionTenantWorkflow,
  deprovisionTenantWorkflow,
  // Signals
  provisioningCancelledSignal,
  deprovisioningCancelledSignal,
  // Queries
  getProvisioningStatusQuery,
  getDeprovisioningStatusQuery,
} from './workflows';

// Export configuration
export { config, loadConfig } from './config';

// Export services (standalone utilities outside Temporal context)
export * from './services';

// Main entry point - run the worker
import { runWorker } from './worker';

async function main(): Promise<void> {
  logger.info('Starting ARC SaaS Temporal Worker Service', {
    environment: process.env.NODE_ENV || 'development',
    logLevel: process.env.LOG_LEVEL || 'info',
    nodeVersion: process.version,
    pid: process.pid,
  });

  await runWorker();
}

// Run if executed directly
if (require.main === module) {
  main().catch((error) => {
    logger.error('Fatal error', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    process.exit(1);
  });
}
