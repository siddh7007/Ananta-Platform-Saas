import {inject, service} from '@loopback/core';
import {
  Count,
  CountSchema,
  Filter,
  repository,
  Where,
} from '@loopback/repository';
import {
  del,
  get,
  HttpErrors,
  param,
  patch,
  post,
  put,
  requestBody,
  RestBindings,
} from '@loopback/rest';
import {
  CONTENT_TYPE,
  getModelSchemaRefSF,
  OPERATION_SECURITY_SPEC,
  rateLimitKeyGenPublic,
  STATUS_CODE,
} from '@sourceloop/core';
import {
  authenticate,
  AuthenticationBindings,
  STRATEGY,
} from 'loopback4-authentication';
import {authorize} from 'loopback4-authorization';
import {CreateLeadDTO, Lead} from '../models';
import {PermissionKey} from '../permissions';
import {LeadRepository} from '../repositories';
import {OnboardingService, LeadAuthenticator} from '../services';
import {ratelimit} from 'loopback4-ratelimiter';
import {LEAD_TOKEN_VERIFIER} from '../keys';
import {LeadUserWithToken} from '../types';
import {VerifyLeadResponseDTO} from '../models/dtos/verify-lead-response-dto.model';
import {LeadHelperService} from '../services/lead-helper.service';
import {AuditLoggerService} from '../services/audit-logger.service';
import {verify} from 'jsonwebtoken';

const basePath = '/leads';
const leadDescription = 'Lead model instance';

export class LeadController {
  constructor(
    @repository(LeadRepository)
    public leadRepository: LeadRepository,
    @inject('services.OnboardingService')
    public readonly onboarding: OnboardingService,
    @inject('services.LeadHelperService')
    private readonly leadService: LeadHelperService,
    @inject(RestBindings.Http.REQUEST)
    private readonly request: Request,
    @service(LeadAuthenticator)
    private readonly leadAuthenticator: LeadAuthenticator,
    @service(AuditLoggerService)
    private readonly auditLogger: AuditLoggerService,
  ) {}

  @ratelimit(true, {
    max: Number.parseInt(process.env.PUBLIC_API_MAX_ATTEMPTS ?? '10'),
    keyGenerator: rateLimitKeyGenPublic,
  })
  @authorize({
    permissions: ['*'],
  })
  @post(basePath, {
    responses: {
      [STATUS_CODE.OK]: {
        description: leadDescription,
        content: {
          [CONTENT_TYPE.JSON]: {schema: getModelSchemaRefSF(Lead)},
        },
      },
    },
  })
  async create(
    @requestBody({
      content: {
        [CONTENT_TYPE.JSON]: {
          schema: getModelSchemaRefSF(CreateLeadDTO, {
            title: 'CreateLeadDTO',
            exclude: ['isValidated', 'addressId', 'id'],
          }),
        },
      },
    })
    lead: Omit<CreateLeadDTO, 'isValidated' | 'addressId' | 'id'>,
  ): Promise<{[key: string]: string}> {
    const result = await this.onboarding.addLead(lead);

    // Log lead creation (non-blocking)
    try {
      // Extract lead ID from result (assuming it returns {id: string})
      const leadId = result.id || 'unknown';
      await this.auditLogger.logLeadCreated(leadId, lead.email, {
        firstName: lead.firstName,
        lastName: lead.lastName,
        companyName: lead.companyName,
      });
    } catch {
      // Don't fail the operation if audit logging fails
    }

    return result;
  }

  /**
   * GET /leads/verify?token=xxx - Public endpoint for email verification
   * Called by frontend when user clicks the verification link in their email.
   * The token is the random key that maps to a JWT in the token store.
   */
  @ratelimit(true, {
    max: Number.parseInt(process.env.PUBLIC_API_MAX_ATTEMPTS ?? '10'),
    keyGenerator: rateLimitKeyGenPublic,
  })
  @authorize({
    permissions: ['*'],
  })
  @get(`${basePath}/verify`, {
    responses: {
      [STATUS_CODE.OK]: {
        description: 'Verify lead email and return token for onboarding',
        content: {
          [CONTENT_TYPE.JSON]: {
            schema: {
              type: 'object',
              properties: {
                id: {type: 'string'},
                email: {type: 'string'},
                token: {type: 'string'},
              },
            },
          },
        },
      },
    },
  })
  async verifyEmailToken(
    @param.query.string('token') token: string,
  ): Promise<{id: string; email: string; token: string}> {
    if (!token) {
      throw new HttpErrors.BadRequest('Token is required');
    }

    // Look up the JWT from the token store using the verification key
    const storedToken = await this.leadAuthenticator.getToken(token);
    if (!storedToken || !storedToken.token) {
      throw new HttpErrors.NotFound('Invalid or expired verification token');
    }

    // Verify and decode the JWT to get lead info
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new HttpErrors.InternalServerError('JWT_SECRET is not configured');
    }

    try {
      const decoded = verify(storedToken.token, secret, {
        issuer: process.env.JWT_ISSUER,
        algorithms: ['HS256'],
      }) as {id: string; email?: string};

      // Mark the lead as validated
      await this.leadRepository.updateById(decoded.id, {
        isValidated: true,
      });

      // Invalidate the token after successful verification (one-time use)
      await this.leadAuthenticator.removeToken(token);

      // Fetch lead to get email if not in token
      const lead = await this.leadRepository.findById(decoded.id);

      // Log lead verification (non-blocking)
      try {
        await this.auditLogger.logLeadVerified(decoded.id, lead.email);
      } catch {
        // Don't fail the operation if audit logging fails
      }

      return {
        id: decoded.id,
        email: lead.email,
        token: storedToken.token,
      };
    } catch (error) {
      throw new HttpErrors.Unauthorized('Invalid or expired token');
    }
  }

  @authorize({
    permissions: ['*'],
  })
  @authenticate(
    STRATEGY.BEARER,
    {
      passReqToCallback: true,
    },
    undefined,
    LEAD_TOKEN_VERIFIER,
  )
  @post(`${basePath}/{id}/verify`, {
    security: OPERATION_SECURITY_SPEC,
    responses: {
      [STATUS_CODE.OK]: {
        description: 'A response with token for the verified lead',
        content: {
          [CONTENT_TYPE.JSON]: {
            schema: getModelSchemaRefSF(VerifyLeadResponseDTO),
          },
        },
      },
    },
  })
  async validateLead(
    @param.path.string('id') id: string,
    @inject(AuthenticationBindings.CURRENT_USER)
    leadUser: LeadUserWithToken,
  ): Promise<VerifyLeadResponseDTO> {
    return this.leadService.validateLead(id, leadUser);
  }

  @authorize({
    permissions: [PermissionKey.ViewLead],
  })
  @authenticate(STRATEGY.BEARER, {
    passReqToCallback: true,
  })
  @get(`${basePath}/count`, {
    security: OPERATION_SECURITY_SPEC,
    responses: {
      [STATUS_CODE.OK]: {
        description: 'Lead model count',
        content: {[CONTENT_TYPE.JSON]: {schema: CountSchema}},
      },
    },
  })
  async count(@param.where(Lead) where?: Where<Lead>): Promise<Count> {
    return this.leadRepository.count(where);
  }

  @authorize({
    permissions: [PermissionKey.ViewLead],
  })
  @authenticate(STRATEGY.BEARER, {
    passReqToCallback: true,
  })
  @get(basePath, {
    security: OPERATION_SECURITY_SPEC,
    responses: {
      [STATUS_CODE.OK]: {
        description: 'Array of Lead model instances',
        content: {
          [CONTENT_TYPE.JSON]: {
            schema: {
              type: 'array',
              items: getModelSchemaRefSF(Lead, {includeRelations: true}),
            },
          },
        },
      },
    },
  })
  async find(@param.filter(Lead) filter?: Filter<Lead>): Promise<Lead[]> {
    return this.leadRepository.find(filter);
  }

  @authorize({
    permissions: [PermissionKey.UpdateLead],
  })
  @authenticate(STRATEGY.BEARER, {
    passReqToCallback: true,
  })
  @patch(basePath, {
    security: OPERATION_SECURITY_SPEC,
    responses: {
      [STATUS_CODE.OK]: {
        description: 'Lead PATCH success',
        content: {
          [CONTENT_TYPE.JSON]: {
            schema: getModelSchemaRefSF(Lead),
          },
        },
      },
    },
  })
  async updateAll(
    @requestBody({
      content: {
        [CONTENT_TYPE.JSON]: {
          schema: getModelSchemaRefSF(Lead, {partial: true}),
        },
      },
    })
    lead: Lead,
    @param.where(Lead) where?: Where<Lead>,
  ): Promise<Count> {
    throw HttpErrors.MethodNotAllowed();
  }

  @authorize({
    permissions: [PermissionKey.ViewLead],
  })
  @authenticate(STRATEGY.BEARER, {
    passReqToCallback: true,
  })
  @get(`${basePath}/{id}`, {
    security: OPERATION_SECURITY_SPEC,
    responses: {
      [STATUS_CODE.OK]: {
        description: leadDescription,
        content: {
          [CONTENT_TYPE.JSON]: {schema: getModelSchemaRefSF(Lead)},
        },
      },
    },
  })
  async findById(
    @param.path.string('id') id: string,
    // sonarignore:start
    @param.filter(Lead, {exclude: 'where'})
    filter?: Filter<Lead>,
    // sonarignore:end
  ): Promise<Lead> {
    return this.leadRepository.findById(id, filter);
  }

  @authorize({
    permissions: [PermissionKey.UpdateLead],
  })
  @authenticate(STRATEGY.BEARER, {
    passReqToCallback: true,
  })
  @patch(`${basePath}/{id}`, {
    security: OPERATION_SECURITY_SPEC,
    responses: {
      [STATUS_CODE.NO_CONTENT]: {
        description: 'Lead PATCH success',
        content: {
          [CONTENT_TYPE.JSON]: {
            schema: getModelSchemaRefSF(Lead),
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
          schema: getModelSchemaRefSF(Lead, {partial: true}),
        },
      },
    })
    lead: Lead,
  ): Promise<void> {
    throw HttpErrors.MethodNotAllowed();
  }

  @authorize({
    permissions: [PermissionKey.UpdateLead],
  })
  @authenticate(STRATEGY.BEARER, {
    passReqToCallback: true,
  })
  @put(`${basePath}/{id}`, {
    security: OPERATION_SECURITY_SPEC,
    responses: {
      [STATUS_CODE.NO_CONTENT]: {
        description: 'Lead PUT success',
      },
    },
  })
  async replaceById(
    @param.path.string('id') id: string,
    @requestBody() lead: Lead,
  ): Promise<void> {
    throw new HttpErrors.MethodNotAllowed();
  }

  @authorize({
    permissions: [PermissionKey.DeleteLead],
  })
  @authenticate(STRATEGY.BEARER, {
    passReqToCallback: true,
  })
  @del(`${basePath}/{id}`, {
    security: OPERATION_SECURITY_SPEC,
    responses: {
      [STATUS_CODE.NO_CONTENT]: {
        description: 'Lead DELETE success',
      },
    },
  })
  async deleteById(@param.path.string('id') id: string): Promise<void> {
    throw HttpErrors.MethodNotAllowed();
  }
}
