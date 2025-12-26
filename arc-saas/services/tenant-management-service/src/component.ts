// Copyright (c) 2023 Sourcefuse Technologies
//
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT
import {Booter} from '@loopback/boot';
import {
  Binding,
  Component,
  Constructor,
  ControllerClass,
  CoreBindings,
  createBindingFromClass,
  createServiceBinding,
  inject,
  ProviderMap,
  ServiceOrProviderClass,
} from '@loopback/core';
import {Class, Model, Repository} from '@loopback/repository';
import {RestApplication} from '@loopback/rest';
import {
  BooterBasePathMixin,
  CoreComponent,
  CoreControllerBooter,
  CoreModelBooter,
  SECURITY_SCHEME_SPEC,
  ServiceSequence,
} from '@sourceloop/core';
import {RequestLoggerInterceptor} from './interceptors';
import {AuthenticationComponent} from 'loopback4-authentication';
import {
  AuthorizationBindings,
  AuthorizationComponent,
} from 'loopback4-authorization';
import {
  EventConnectorBinding,
  LEAD_TOKEN_VERIFIER,
  SYSTEM_USER,
  TenantManagementServiceBindings,
} from './keys';
import {
  Address,
  AuditLog,
  Contact,
  CreateLeadDTO,
  Invoice,
  Lead,
  LeadToken,
  NotificationHistory,
  NotificationPreference,
  PaymentIntent,
  PaymentMethod,
  ProvisioningDTO,
  Resource,
  Tenant,
  TenantMgmtConfig,
  TenantOnboardDTO,
  TenantQuota,
  UsageEvent,
  UsageSummary,
  User,
  UserActivity,
  UserInvitation,
  UserRole,
  VerifyLeadResponseDTO,
  WebhookDTO,
  WebhookSecret,
} from './models';
import {LeadTokenVerifierProvider, SystemUserProvider} from './providers';
import {
  AddressRepository,
  AuditLogRepository,
  ContactRepository,
  InvoiceRepository,
  LeadRepository,
  LeadTokenRepository,
  NotificationHistoryRepository,
  NotificationPreferenceRepository,
  PaymentIntentRepository,
  PaymentMethodRepository,
  ResourceRepository,
  TenantMgmtConfigRepository,
  TenantQuotaRepository,
  TenantRepository,
  UsageEventRepository,
  UsageSummaryRepository,
  UserActivityRepository,
  UserInvitationRepository,
  UserRepository,
  UserRoleRepository,
  WebhookSecretRepository,
} from './repositories/sequelize';
import {
  CryptoHelperService,
  EventConnector,
  InvoiceHelperService,
  KeycloakAdminService,
  LeadAuthenticator,
  NotificationService,
  OnboardingService,
  PaymentService,
  ProvisioningService,
  StripeService,
  StripeWebhookService,
  StructuredLoggerService,
  UsageService,
  WebhookHelperService,
} from './services';
import {ITenantManagementServiceConfig} from './types';
import {IdpHelperService} from './services/idp-helper.service';
import {LeadHelperService} from './services/lead-helper.service';
import {EventStreamConnectorComponent} from 'loopback4-message-bus-connector';

export class TenantManagementServiceComponent implements Component {
  constructor(
    @inject(CoreBindings.APPLICATION_INSTANCE)
    private readonly application: RestApplication,
    @inject(TenantManagementServiceBindings.Config, {optional: true})
    private readonly tenantMgmtConfig?: ITenantManagementServiceConfig,
  ) {
    this.providers = {};

    // Mount core component
    this.application.component(CoreComponent);
    this.application.component(EventStreamConnectorComponent);
    this.application.api({
      openapi: '3.0.0',
      info: {
        title: 'Audit Service',
        version: '1.0.0',
      },
      paths: {},
      components: {
        securitySchemes: SECURITY_SCHEME_SPEC,
      },
      servers: [{url: '/'}],
    });

    if (!this.tenantMgmtConfig?.useCustomSequence) {
      // Mount default sequence if needed
      this.setupSequence();
    }

    this.booters = [
      BooterBasePathMixin(CoreModelBooter, __dirname, {
        interface: TenantManagementServiceComponent.name,
      }),
      BooterBasePathMixin(CoreControllerBooter, __dirname, {
        dirs: ['controllers'],
        extensions: ['.controller.js'],
        nested: true,
        interface: TenantManagementServiceComponent.name,
      }),
    ];
    this.repositories = [
      AddressRepository,
      AuditLogRepository,
      ContactRepository,
      InvoiceRepository,
      LeadTokenRepository,
      LeadRepository,
      NotificationHistoryRepository,
      NotificationPreferenceRepository,
      PaymentIntentRepository,
      PaymentMethodRepository,
      ResourceRepository,
      TenantRepository,
      TenantQuotaRepository,
      UsageEventRepository,
      UsageSummaryRepository,
      UserActivityRepository,
      UserInvitationRepository,
      UserRepository,
      UserRoleRepository,
      WebhookSecretRepository,
      TenantMgmtConfigRepository,
    ];

    this.models = [
      Address,
      AuditLog,
      Contact,
      Invoice,
      Lead,
      LeadToken,
      NotificationHistory,
      NotificationPreference,
      PaymentIntent,
      PaymentMethod,
      Resource,
      Tenant,
      TenantQuota,
      UsageEvent,
      UsageSummary,
      User,
      UserActivity,
      UserInvitation,
      UserRole,
      WebhookSecret,
      CreateLeadDTO,
      ProvisioningDTO,
      TenantOnboardDTO,
      VerifyLeadResponseDTO,
      WebhookDTO,
      TenantMgmtConfig,
    ];

    this.bindings = [
      Binding.bind(LEAD_TOKEN_VERIFIER).toProvider(LeadTokenVerifierProvider),
      Binding.bind(SYSTEM_USER).toProvider(SystemUserProvider),
      createServiceBinding(ProvisioningService),
      createServiceBinding(OnboardingService),
      createServiceBinding(LeadAuthenticator),
      createServiceBinding(CryptoHelperService),
      Binding.bind('services.NotificationService').toClass(NotificationService),
      createServiceBinding(WebhookHelperService),
      createServiceBinding(InvoiceHelperService),
      createServiceBinding(IdpHelperService),
      createServiceBinding(LeadHelperService),
      createServiceBinding(StripeService),
      createServiceBinding(StripeWebhookService),
      createServiceBinding(PaymentService),
      createServiceBinding(StructuredLoggerService),
      createServiceBinding(KeycloakAdminService),
      createServiceBinding(UsageService),
      // Request logging interceptor - provides correlation IDs and structured logging
      createBindingFromClass(RequestLoggerInterceptor, {
        key: 'interceptors.RequestLoggerInterceptor',
      }),
    ];

    this.addClassBindingIfNotPresent(EventConnectorBinding.key, EventConnector);
  }

  providers?: ProviderMap = {};

  bindings: Binding[] = [];

  services?: ServiceOrProviderClass[];
  booters?: Class<Booter>[];

  /**
   * An optional list of Repository classes to bind for dependency injection
   * via `app.repository()` API.
   */
  repositories?: Class<Repository<Model>>[];

  /**
   * An optional list of Model classes to bind for dependency injection
   * via `app.model()` API.
   */
  models?: Class<Model>[];

  /**
   * An array of controller classes
   */
  controllers?: ControllerClass[];

  /**
   * Setup ServiceSequence by default if no other sequnce provided
   *
   */
  setupSequence() {
    this.application.sequence(ServiceSequence);

    // Mount authentication component for default sequence
    this.application.component(AuthenticationComponent);

    // Mount authorization component for default sequence
    this.application.bind(AuthorizationBindings.CONFIG).to({
      allowAlwaysPaths: [
        '/explorer',
        '/user-invitations/by-token',
        '/user-invitations/',
      ],
    });
    this.application.component(AuthorizationComponent);
  }

  private addClassBindingIfNotPresent<T>(key: string, cls: Constructor<T>) {
    if (!this.application.isBound(key)) {
      this.bindings.push(
        createBindingFromClass(cls, {
          key: key,
        }),
      );
    }
  }
}
