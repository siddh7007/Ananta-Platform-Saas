import {Provider, inject, BindingScope} from '@loopback/core';
import {Client, Connection, ConnectionOptions} from '@temporalio/client';
import {TemporalBindings, TemporalConfig} from '../keys';

/**
 * Provider for Temporal Client
 *
 * Creates and manages the Temporal client connection for starting and
 * managing workflows.
 */
export class TemporalClientProvider implements Provider<Client> {
  private client: Client | null = null;
  private connection: Connection | null = null;

  constructor(
    @inject(TemporalBindings.CONFIG, {optional: true})
    private temporalConfig?: TemporalConfig,
  ) {}

  async value(): Promise<Client> {
    if (!this.client) {
      await this.connect();
    }
    return this.client!;
  }

  private async connect(): Promise<void> {
    const config = this.temporalConfig || this.getDefaultConfig();

    const connectionOptions: ConnectionOptions = {
      address: config.address,
    };

    if (config.tls) {
      connectionOptions.tls = config.tls;
    }

    console.log(`Connecting to Temporal server at ${config.address}...`);

    this.connection = await Connection.connect(connectionOptions);

    this.client = new Client({
      connection: this.connection,
      namespace: config.namespace,
    });

    console.log(`Connected to Temporal namespace: ${config.namespace}`);
  }

  private getDefaultConfig(): TemporalConfig {
    return {
      address: process.env.TEMPORAL_ADDRESS || 'localhost:7233',
      namespace: process.env.TEMPORAL_NAMESPACE || 'arc-saas',
      taskQueue: process.env.TEMPORAL_TASK_QUEUE || 'tenant-provisioning',
    };
  }

  async disconnect(): Promise<void> {
    if (this.connection) {
      await this.connection.close();
      this.connection = null;
      this.client = null;
    }
  }
}
