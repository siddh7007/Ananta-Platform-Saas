/**
 * Temporal Client Factory
 *
 * Creates and manages Temporal client connections for starting workflows
 * and querying workflow state.
 */

import { Client, Connection, ConnectionOptions } from '@temporalio/client';
import { config, TemporalConfig } from './config';

let clientInstance: Client | null = null;
let connectionInstance: Connection | null = null;

/**
 * Get connection options based on configuration
 */
function getConnectionOptions(temporalConfig: TemporalConfig): ConnectionOptions {
  const options: ConnectionOptions = {
    address: temporalConfig.address,
  };

  if (temporalConfig.tls) {
    options.tls = temporalConfig.tls;
  }

  return options;
}

/**
 * Create a new Temporal connection
 */
export async function createConnection(
  temporalConfig?: TemporalConfig
): Promise<Connection> {
  const cfg = temporalConfig || config.temporal;
  const options = getConnectionOptions(cfg);

  console.log(`Connecting to Temporal server at ${cfg.address}...`);

  const connection = await Connection.connect(options);

  console.log('Connected to Temporal server');

  return connection;
}

/**
 * Create a new Temporal client
 */
export async function createClient(
  temporalConfig?: TemporalConfig
): Promise<Client> {
  const cfg = temporalConfig || config.temporal;
  const connection = await createConnection(cfg);

  const client = new Client({
    connection,
    namespace: cfg.namespace,
  });

  console.log(`Temporal client created for namespace: ${cfg.namespace}`);

  return client;
}

/**
 * Get or create singleton Temporal client
 */
export async function getClient(): Promise<Client> {
  if (!clientInstance) {
    connectionInstance = await createConnection();
    clientInstance = new Client({
      connection: connectionInstance,
      namespace: config.temporal.namespace,
    });
  }
  return clientInstance;
}

/**
 * Close the Temporal client connection
 */
export async function closeClient(): Promise<void> {
  if (connectionInstance) {
    await connectionInstance.close();
    connectionInstance = null;
    clientInstance = null;
    console.log('Temporal client connection closed');
  }
}

/**
 * Export workflow handle types for external use
 */
export { WorkflowHandle, WorkflowExecutionInfo } from '@temporalio/client';
