// Copyright (c) 2023 Sourcefuse Technologies
//
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT
import {BootMixin} from '@loopback/boot';
import {ApplicationConfig, BindingScope, createServiceBinding} from '@loopback/core';
import {RepositoryMixin} from '@loopback/repository';
import {RestApplication} from '@loopback/rest';
import * as path from 'path';
import {TenantManagementServiceComponent} from './component';
import {WebhookTenantManagementServiceComponent} from './webhook.component';
import {TenantManagementDbDataSource, TenantManagementCacheDataSource} from './datasources';
import {TemporalBindings} from './keys';
import {TemporalClientProvider, BearerTokenVerifierProvider} from './providers';
import {TemporalProvisioningService} from './services/temporal-provisioning.service';
import {NotificationAdminService} from './services/notification-admin.service';
import {NovuNotificationService} from './services/novu-notification.service';
import {ProvisioningRetryService} from './services/provisioning-retry.service';
import {Strategies} from 'loopback4-authentication';
import {RequestLoggerMiddleware} from './middleware';

export {ApplicationConfig};

export class TenantMgmtServiceApplication extends BootMixin(
  RepositoryMixin(RestApplication),
) {
  constructor(options: ApplicationConfig = {}) {
    super(options);
    this.static('/', path.join(__dirname, '../public'));

    // Register request logging middleware - runs for ALL HTTP requests
    // This provides accurate request/response timing and status codes
    this.middleware(RequestLoggerMiddleware.provider());

    // Bind the PostgreSQL datasource (SequelizeDataSource requires direct binding)
    this.bind('datasources.TenantManagementDB').toClass(TenantManagementDbDataSource).inScope(BindingScope.SINGLETON);

    // Bind the Cache datasource (in-memory for local dev, Redis for production)
    this.dataSource(TenantManagementCacheDataSource);

    // Bind Temporal client and provisioning service
    this.bind(TemporalBindings.CLIENT).toProvider(TemporalClientProvider);
    this.add(createServiceBinding(TemporalProvisioningService));

    // Bind Novu notification services
    this.add(createServiceBinding(NotificationAdminService));
    this.add(createServiceBinding(NovuNotificationService));

    // Bind provisioning retry service
    this.add(createServiceBinding(ProvisioningRetryService));

    // Bind mock BullMQ producer for local development (Temporal is used for workflows)
    this.bind('sf.producer.bullmq').to({
      send: async () => { console.log('[BullMQ Mock] Event sent (no-op)'); },
    });

    this.component(TenantManagementServiceComponent);
    this.component(WebhookTenantManagementServiceComponent);

    // Bind the custom bearer token verifier for local development
    // This MUST come AFTER the components are loaded to override their binding
    // This uses symmetric JWT verification with JWT_SECRET
    this.bind(Strategies.Passport.BEARER_TOKEN_VERIFIER).toProvider(
      BearerTokenVerifierProvider,
    );
    this.projectRoot = __dirname;
    this.bootOptions = {
      controllers: {
        dirs: ['controllers'],
        extensions: ['.controller.js'],
        nested: true,
      },
    };
  }
}
