/**
 * Temporal Worker
 *
 * The worker polls the Temporal server for tasks and executes workflows
 * and activities. This is the main runtime component.
 */

// Load environment variables FIRST, before any other imports that use them
import * as dotenv from 'dotenv';
dotenv.config();

import { NativeConnection, Worker, Runtime } from '@temporalio/worker';
import * as activities from './activities';
import { config } from './config';
import { createLogger } from './utils/logger';
import {
  initTelemetry,
  shutdownTelemetry,
  getTemporalMetrics,
} from './observability';

const logger = createLogger('worker');

/**
 * Configure Temporal runtime (logging, telemetry)
 */
function configureRuntime(): void {
  // Initialize OpenTelemetry first
  initTelemetry();

  // Configure Temporal runtime logger to use structured logger
  const runtimeLogger = createLogger('temporal-runtime');

  Runtime.install({
    logger: {
      log: (level, message, meta) => {
        switch (level) {
          case 'TRACE':
            runtimeLogger.trace(message, meta);
            break;
          case 'DEBUG':
            runtimeLogger.debug(message, meta);
            break;
          case 'INFO':
            runtimeLogger.info(message, meta);
            break;
          case 'WARN':
            runtimeLogger.warn(message, meta);
            break;
          case 'ERROR':
            runtimeLogger.error(message, meta);
            break;
          default:
            runtimeLogger.info(message, meta);
        }
      },
      trace: (message, meta) => runtimeLogger.trace(message, meta),
      debug: (message, meta) => runtimeLogger.debug(message, meta),
      info: (message, meta) => runtimeLogger.info(message, meta),
      warn: (message, meta) => runtimeLogger.warn(message, meta),
      error: (message, meta) => runtimeLogger.error(message, meta),
    },
    // Enable OpenTelemetry integration for Temporal
    telemetryOptions: {
      logging: {
        forward: {},
      },
      metrics: {
        prometheus: process.env.PROMETHEUS_ENABLED === 'true'
          ? { bindAddress: `0.0.0.0:${process.env.TEMPORAL_METRICS_PORT || '9090'}` }
          : undefined,
      },
    },
  });

  logger.info('Temporal runtime configured with observability');
}

/**
 * Create and configure the Temporal worker
 */
export async function createWorker(): Promise<Worker> {
  const { temporal } = config;

  logger.info('Creating Temporal worker', {
    address: temporal.address,
    namespace: temporal.namespace,
    taskQueue: temporal.taskQueue,
  });

  // Create native connection to Temporal server
  const connection = await NativeConnection.connect({
    address: temporal.address,
    tls: temporal.tls,
  });

  // Create worker with workflows and activities
  const worker = await Worker.create({
    connection,
    namespace: temporal.namespace,
    taskQueue: temporal.taskQueue,

    // Register workflows (bundled from workflows directory)
    workflowsPath: require.resolve('./workflows'),

    // Register activities
    activities,

    // Worker tuning options
    maxConcurrentActivityTaskExecutions: temporal.workerOptions.maxConcurrentActivities,
    maxConcurrentWorkflowTaskExecutions: temporal.workerOptions.maxConcurrentWorkflows,
    maxCachedWorkflows: temporal.workerOptions.maxCachedWorkflows,

    // Enable SDK tracing for OpenTelemetry integration
    enableSDKTracing: true,
  });

  logger.info('Temporal worker created successfully', {
    maxConcurrentActivities: temporal.workerOptions.maxConcurrentActivities,
    maxConcurrentWorkflows: temporal.workerOptions.maxConcurrentWorkflows,
  });

  return worker;
}

/**
 * Run the worker (main entry point)
 */
export async function runWorker(): Promise<void> {
  configureRuntime();

  const worker = await createWorker();

  // Get metrics instance for tracking
  const temporalMetrics = getTemporalMetrics();

  logger.info('Starting Temporal worker');

  // Handle shutdown gracefully
  const shutdown = async () => {
    logger.info('Shutting down worker...');
    worker.shutdown();
    await shutdownTelemetry();
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  try {
    // Run the worker (blocks until shutdown)
    await worker.run();
    logger.info('Worker stopped gracefully');
  } catch (error) {
    logger.error('Worker error', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    await shutdownTelemetry();
    process.exit(1);
  }
}

// Allow running directly
if (require.main === module) {
  runWorker().catch((err) => {
    logger.error('Failed to start worker', {
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    });
    process.exit(1);
  });
}
