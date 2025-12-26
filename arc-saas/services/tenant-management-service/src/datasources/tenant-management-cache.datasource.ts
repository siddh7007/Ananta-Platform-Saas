// Copyright (c) 2023 Sourcefuse Technologies
//
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT
import {inject, lifeCycleObserver, LifeCycleObserver} from '@loopback/core';
import {AnyObject, juggler} from '@loopback/repository';

const config = {
  name: 'TenantManagementCacheDB',
  connector: 'kv-memory',
  localStorage: '',
  file: '',
};

// Observe application's life cycle to disconnect the datasource when
// application is stopped. This allows the application to be shut down
// gracefully. The `stop()` method is inherited from `juggler.DataSource`.
// Learn more at https://loopback.io/doc/en/lb4/Life-cycle.html
@lifeCycleObserver('datasource')
export class TenantManagementCacheDataSource
  extends juggler.DataSource
  implements LifeCycleObserver
{
  static readonly dataSourceName = 'TenantManagementCacheDB';
  static readonly defaultConfig = config;

  constructor(
    @inject(`datasources.config.TenantManagementCacheDB`, {optional: true})
    dsConfig: AnyObject = config,
  ) {
    // Support Redis configuration via environment variables
    if (process.env.REDIS_HOST) {
      dsConfig = {
        name: 'TenantManagementCacheDB',
        connector: 'kv-redis',
        host: process.env.REDIS_HOST,
        port: +(process.env.REDIS_PORT ?? 6379),
        password: process.env.REDIS_PASSWORD,
        db: +(process.env.REDIS_DATABASE ?? 0),
      };
    }

    if (
      +process.env.REDIS_HAS_SENTINELS! &&
      !!process.env.REDIS_SENTINEL_HOST &&
      !!process.env.REDIS_SENTINEL_PORT
    ) {
      dsConfig.sentinels = [
        {
          host: process.env.REDIS_SENTINEL_HOST,
          port: +process.env.REDIS_SENTINEL_PORT,
        },
      ];
    }
    super(dsConfig);
  }
}
