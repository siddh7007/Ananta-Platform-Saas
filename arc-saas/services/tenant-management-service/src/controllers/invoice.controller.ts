import {
  Count,
  CountSchema,
  Filter,
  repository,
  Where,
} from '@loopback/repository';
import {del, get, param, patch, post, put, requestBody} from '@loopback/rest';
import {
  CONTENT_TYPE,
  getModelSchemaRefSF,
  IAuthUserWithPermissions,
  OPERATION_SECURITY_SPEC,
  STATUS_CODE,
} from '@sourceloop/core';
import {authenticate, AuthenticationBindings, STRATEGY} from 'loopback4-authentication';
import {authorize} from 'loopback4-authorization';
import {InvoiceRepository} from '../repositories';
import {Invoice} from '../models';
import {PermissionKey} from '../permissions';
import {inject, service} from '@loopback/core';
import {InvoiceHelperService, CreateInvoiceOptions} from '../services';
import {AuditLoggerService} from '../services/audit-logger.service';

const basePath = '/invoices';

export class InvoiceController {
  constructor(
    @repository(InvoiceRepository)
    public invoiceRepository: InvoiceRepository,
    @inject('services.InvoiceHelperService')
    private readonly invoiceService: InvoiceHelperService,
    @service(AuditLoggerService)
    private readonly auditLogger: AuditLoggerService,
    @inject(AuthenticationBindings.CURRENT_USER, {optional: true})
    private readonly currentUser?: IAuthUserWithPermissions,
  ) {}

  /**
   * Get the current user's tenant ID for logging context.
   */
  private getTenantId(): string {
    return this.currentUser?.tenantId || 'system';
  }

  @authorize({
    permissions: [PermissionKey.CreateInvoice],
  })
  @authenticate(STRATEGY.BEARER, {
    passReqToCallback: true,
  })
  @post(basePath, {
    security: OPERATION_SECURITY_SPEC,
    responses: {
      [STATUS_CODE.OK]: {
        description: 'Invoice model instance POST success',
        content: {
          [CONTENT_TYPE.JSON]: {schema: getModelSchemaRefSF(Invoice)},
        },
      },
    },
  })
  async create(
    @requestBody({
      content: {
        [CONTENT_TYPE.JSON]: {
          schema: getModelSchemaRefSF(Invoice, {
            title: 'NewInvoice',
            exclude: ['id'],
          }),
        },
      },
    })
    invoice: Omit<Invoice, 'id'>,
    @param.query.boolean('autoCreatePaymentIntent', {
      description: 'If true, automatically creates a Stripe PaymentIntent for this invoice using the tenant default payment method',
    })
    autoCreatePaymentIntent?: boolean,
    @param.query.boolean('autoConfirm', {
      description: 'If true, immediately attempts to charge the customer (requires autoCreatePaymentIntent=true)',
    })
    autoConfirm?: boolean,
  ): Promise<Invoice> {
    const options: CreateInvoiceOptions = {
      autoCreatePaymentIntent: autoCreatePaymentIntent ?? false,
      autoConfirm: autoConfirm ?? false,
    };

    const createdInvoice = await this.invoiceService.createInvoice(invoice, options);

    // Log invoice creation (non-blocking)
    try {
      await this.auditLogger.logInvoiceCreated(
        createdInvoice.id,
        createdInvoice.id,
        invoice.tenantId || this.getTenantId(),
        undefined,
        createdInvoice.amount,
      );
    } catch {
      // Don't fail the operation if audit logging fails
    }

    return createdInvoice;
  }

  @authorize({
    permissions: [PermissionKey.CreateInvoice],
  })
  @authenticate(STRATEGY.BEARER, {
    passReqToCallback: true,
  })
  @get(`${basePath}/download`, {
    security: OPERATION_SECURITY_SPEC,
    responses: {
      [STATUS_CODE.NO_CONTENT]: {
        description: 'Invoice download success',
      },
    },
  })
  async downloadInvoice(@param.path.number('id') id: string): Promise<void> {
    return this.invoiceService.downloadInvoice(id);
  }

  @authorize({
    permissions: [PermissionKey.ViewInvoice],
  })
  @authenticate(STRATEGY.BEARER, {
    passReqToCallback: true,
  })
  @get(`${basePath}/count`, {
    security: OPERATION_SECURITY_SPEC,
    responses: {
      [STATUS_CODE.OK]: {
        description: 'Invoice model count',
        content: {[CONTENT_TYPE.JSON]: {schema: CountSchema}},
      },
    },
  })
  async count(@param.where(Invoice) where?: Where<Invoice>): Promise<Count> {
    return this.invoiceRepository.count(where);
  }

  @authorize({
    permissions: [PermissionKey.ViewInvoice],
  })
  @authenticate(STRATEGY.BEARER, {
    passReqToCallback: true,
  })
  @get(basePath, {
    security: OPERATION_SECURITY_SPEC,
    responses: {
      [STATUS_CODE.OK]: {
        description: 'Array of Invoice model instances',
        content: {
          [CONTENT_TYPE.JSON]: {
            schema: {
              type: 'array',
              items: getModelSchemaRefSF(Invoice, {includeRelations: true}),
            },
          },
        },
      },
    },
  })
  async find(
    @param.filter(Invoice) filter?: Filter<Invoice>,
  ): Promise<Invoice[]> {
    return this.invoiceRepository.find(filter);
  }

  @authorize({
    permissions: [PermissionKey.UpdateInvoice],
  })
  @authenticate(STRATEGY.BEARER, {
    passReqToCallback: true,
  })
  @patch(basePath, {
    security: OPERATION_SECURITY_SPEC,
    responses: {
      [STATUS_CODE.OK]: {
        description: 'Invoice PATCH success',
        content: {
          [CONTENT_TYPE.JSON]: {
            schema: getModelSchemaRefSF(Invoice),
          },
        },
      },
    },
  })
  async updateAll(
    @requestBody({
      content: {
        [CONTENT_TYPE.JSON]: {
          schema: getModelSchemaRefSF(Invoice, {partial: true}),
        },
      },
    })
    invoice: Invoice,
    @param.where(Invoice) where?: Where<Invoice>,
  ): Promise<Count> {
    return this.invoiceRepository.updateAll(invoice, where);
  }

  @authorize({
    permissions: [PermissionKey.ViewInvoice],
  })
  @authenticate(STRATEGY.BEARER, {
    passReqToCallback: true,
  })
  @get(`${basePath}/{id}`, {
    security: OPERATION_SECURITY_SPEC,
    responses: {
      [STATUS_CODE.OK]: {
        description: 'Invoice model instance success',
        content: {
          [CONTENT_TYPE.JSON]: {schema: getModelSchemaRefSF(Invoice)},
        },
      },
    },
  })
  async findById(
    @param.path.string('id') id: string,
    // sonarignore:start
    @param.filter(Invoice, {exclude: 'where'})
    filter?: Filter<Invoice>,
    // sonarignore:end
  ): Promise<Invoice> {
    return this.invoiceRepository.findById(id, filter);
  }

  @authorize({
    permissions: [PermissionKey.UpdateInvoice],
  })
  @authenticate(STRATEGY.BEARER, {
    passReqToCallback: true,
  })
  @patch(`${basePath}/{id}`, {
    security: OPERATION_SECURITY_SPEC,
    responses: {
      [STATUS_CODE.NO_CONTENT]: {
        description: 'Invoice PATCH success',
        content: {
          [CONTENT_TYPE.JSON]: {
            schema: getModelSchemaRefSF(Invoice),
          },
        },
      },
    },
  })
  async updateById(
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        [CONTENT_TYPE.JSON]: {
          schema: getModelSchemaRefSF(Invoice, {partial: true}),
        },
      },
    })
    invoice: Invoice,
  ): Promise<void> {
    const existingInvoice = await this.invoiceRepository.findById(id);
    await this.invoiceRepository.updateById(id, invoice);

    // Log invoice update (non-blocking)
    try {
      await this.auditLogger.logInvoiceUpdated(
        id,
        id,
        existingInvoice.tenantId || this.getTenantId(),
        invoice as unknown as Record<string, unknown>,
      );
    } catch {
      // Don't fail the operation if audit logging fails
    }
  }

  @authorize({
    permissions: [PermissionKey.UpdateInvoice],
  })
  @authenticate(STRATEGY.BEARER, {
    passReqToCallback: true,
  })
  @put(`${basePath}/{id}`, {
    security: OPERATION_SECURITY_SPEC,
    responses: {
      [STATUS_CODE.NO_CONTENT]: {
        description: 'Invoice PUT success',
      },
    },
  })
  async replaceById(
    @param.path.string('id') id: string,
    @requestBody() invoice: Invoice,
  ): Promise<void> {
    const existingInvoice = await this.invoiceRepository.findById(id);
    await this.invoiceRepository.replaceById(id, invoice);

    // Log invoice replace (non-blocking)
    try {
      await this.auditLogger.logInvoiceUpdated(
        id,
        id,
        existingInvoice.tenantId || this.getTenantId(),
        {replaced: true, newData: invoice as unknown as Record<string, unknown>},
      );
    } catch {
      // Don't fail the operation if audit logging fails
    }
  }

  @authorize({
    permissions: [PermissionKey.DeleteInvoice],
  })
  @authenticate(STRATEGY.BEARER, {
    passReqToCallback: true,
  })
  @del(`${basePath}/{id}`, {
    security: OPERATION_SECURITY_SPEC,
    responses: {
      [STATUS_CODE.NO_CONTENT]: {
        description: 'Invoice DELETE success',
      },
    },
  })
  async deleteById(@param.path.string('id') id: string): Promise<void> {
    const existingInvoice = await this.invoiceRepository.findById(id);
    await this.invoiceRepository.deleteById(id);

    // Log invoice deletion (non-blocking)
    try {
      await this.auditLogger.logInvoiceDeleted(
        id,
        id,
        existingInvoice.tenantId || this.getTenantId(),
      );
    } catch {
      // Don't fail the operation if audit logging fails
    }
  }
}
