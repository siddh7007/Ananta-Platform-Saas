import {inject, lifeCycleObserver, LifeCycleObserver} from '@loopback/core';
import {SequelizeDataSource} from '@loopback/sequelize';

const DEFAULT_MAX_CONNECTIONS = 25;
const DEFAULT_DB_IDLE_TIMEOUT_MILLIS = 60000;
const DEFAULT_DB_CONNECTION_TIMEOUT_MILLIS = 2000;

const config = {
  name: 'TenantManagementDB',
  connector: 'postgresql',
  host: process.env.DB_HOST ?? 'localhost',
  port: +(process.env.DB_PORT ?? 5432),
  user: process.env.DB_USER ?? 'postgres',
  password: process.env.DB_PASSWORD ?? 'postgres',
  database: process.env.DB_DATABASE ?? 'arc_saas',
  schema: process.env.DB_SCHEMA ?? 'main',
};

@lifeCycleObserver('datasource')
export class TenantManagementDbDataSource
  extends SequelizeDataSource
  implements LifeCycleObserver
{
  static readonly dataSourceName = 'TenantManagementDB';
  static readonly defaultConfig = config;

  constructor(
    @inject('datasources.config.TenantManagementDB', {optional: true})
    dsConfig: object = config,
  ) {
    if (!!+(process.env.ENABLE_DB_CONNECTION_POOLING ?? 0)) {
      const dbPool = {
        max: +(process.env.DB_MAX_CONNECTIONS ?? DEFAULT_MAX_CONNECTIONS),
        idleTimeoutMillis: +(
          process.env.DB_IDLE_TIMEOUT_MILLIS ?? DEFAULT_DB_IDLE_TIMEOUT_MILLIS
        ),
        connectionTimeoutMillis: +(
          process.env.DB_CONNECTION_TIMEOUT_MILLIS ??
          DEFAULT_DB_CONNECTION_TIMEOUT_MILLIS
        ),
      };

      dsConfig = {...dsConfig, ...dbPool};
    }

    super(dsConfig);
  }
}
