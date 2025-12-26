import {inject} from '@loopback/core';
import {
  Count,
  CountSchema,
  Filter,
  FilterExcludingWhere,
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
} from '@loopback/rest';
import {authorize} from 'loopback4-authorization';
import {
  authenticate,
  AuthenticationBindings,
  STRATEGY,
} from 'loopback4-authentication';
import {
  CONTENT_TYPE,
  getModelSchemaRefSF,
  IAuthUserWithPermissions,
  OPERATION_SECURITY_SPEC,
  STATUS_CODE,
} from '@sourceloop/core';
import {SubscriptionPlan} from '../models';
import {SubscriptionPlanRepository} from '../repositories/sequelize';
import {PermissionKey} from '../permissions';

const basePath = '/plans';

// Default plans to seed if database is empty
const DEFAULT_PLANS: Partial<SubscriptionPlan>[] = [
  {
    id: 'plan-free',
    name: 'Free',
    tier: 'FREE',
    description: 'Get started for free - perfect for personal projects',
    price: 0,
    billingCycle: 'month',
    features: ['1 user', '1 GB storage', 'Community support', 'Basic analytics'],
    limits: {maxUsers: 1, maxStorage: 1, maxProjects: 3, maxApiCalls: 1000},
    isActive: true,
    sortOrder: 0,
  },
  {
    id: 'plan-basic',
    name: 'Basic',
    tier: 'BASIC',
    description: 'Perfect for small teams getting started',
    price: 29,
    billingCycle: 'month',
    features: [
      'Up to 5 users',
      '10 GB storage',
      'Email support',
      'Basic analytics',
      'API access',
    ],
    limits: {maxUsers: 5, maxStorage: 10, maxProjects: 10, maxApiCalls: 10000},
    isActive: true,
    sortOrder: 1,
  },
  {
    id: 'plan-standard',
    name: 'Standard',
    tier: 'STANDARD',
    description: 'Best for growing businesses',
    price: 79,
    billingCycle: 'month',
    features: [
      'Up to 25 users',
      '100 GB storage',
      'Priority email support',
      'Advanced analytics',
      'API access',
      'Custom integrations',
      'SSO authentication',
    ],
    limits: {maxUsers: 25, maxStorage: 100, maxProjects: 50, maxApiCalls: 100000},
    isActive: true,
    isPopular: true,
    sortOrder: 2,
  },
  {
    id: 'plan-premium',
    name: 'Premium',
    tier: 'PREMIUM',
    description: 'For enterprises with advanced needs',
    price: 199,
    billingCycle: 'month',
    features: [
      'Unlimited users',
      '1 TB storage',
      '24/7 phone & email support',
      'Enterprise analytics',
      'Unlimited API access',
      'Custom integrations',
      'SSO authentication',
      'Dedicated account manager',
      'Custom SLA',
      'On-premise deployment option',
    ],
    limits: {maxUsers: null, maxStorage: 1000, maxProjects: null, maxApiCalls: null},
    isActive: true,
    sortOrder: 3,
  },
];

export class PlanController {
  constructor(
    @repository(SubscriptionPlanRepository)
    public planRepository: SubscriptionPlanRepository,
    @inject(AuthenticationBindings.CURRENT_USER, {optional: true})
    private readonly currentUser?: IAuthUserWithPermissions,
  ) {}

  /**
   * Seed default plans if the database is empty.
   */
  private async seedDefaultPlans(): Promise<void> {
    const count = await this.planRepository.count();
    if (count.count === 0) {
      for (const plan of DEFAULT_PLANS) {
        await this.planRepository.create(plan as SubscriptionPlan);
      }
    }
  }

  @authorize({permissions: ['*']})
  @get(basePath, {
    responses: {
      [STATUS_CODE.OK]: {
        description: 'Array of Plan model instances',
        content: {
          [CONTENT_TYPE.JSON]: {
            schema: {
              type: 'array',
              items: getModelSchemaRefSF(SubscriptionPlan, {includeRelations: true}),
            },
          },
        },
      },
    },
  })
  async find(@param.filter(SubscriptionPlan) filter?: Filter<SubscriptionPlan>): Promise<SubscriptionPlan[]> {
    // Seed default plans if empty
    await this.seedDefaultPlans();

    // Default to sorting by sortOrder
    const defaultFilter: Filter<SubscriptionPlan> = {
      ...filter,
      order: filter?.order ?? ['sortOrder ASC'],
    };
    return this.planRepository.find(defaultFilter);
  }

  @authorize({permissions: ['*']})
  @get(`${basePath}/count`, {
    responses: {
      [STATUS_CODE.OK]: {
        description: 'Plan model count',
        content: {[CONTENT_TYPE.JSON]: {schema: CountSchema}},
      },
    },
  })
  async count(@param.where(SubscriptionPlan) where?: Where<SubscriptionPlan>): Promise<Count> {
    return this.planRepository.count(where);
  }

  @authorize({permissions: ['*']})
  @get(`${basePath}/{id}`, {
    responses: {
      [STATUS_CODE.OK]: {
        description: 'Plan model instance',
        content: {
          [CONTENT_TYPE.JSON]: {
            schema: getModelSchemaRefSF(SubscriptionPlan, {includeRelations: true}),
          },
        },
      },
    },
  })
  async findById(
    @param.path.string('id') id: string,
    @param.filter(SubscriptionPlan, {exclude: 'where'}) filter?: FilterExcludingWhere<SubscriptionPlan>,
  ): Promise<SubscriptionPlan> {
    // Seed default plans if empty
    await this.seedDefaultPlans();

    const plan = await this.planRepository.findOne({
      ...filter,
      where: {id},
    });
    if (!plan) {
      throw new HttpErrors.NotFound(`Plan with id ${id} not found`);
    }
    return plan;
  }

  @authorize({
    permissions: [PermissionKey.CreatePlan, PermissionKey.ManagePlans],
  })
  @authenticate(STRATEGY.BEARER, {passReqToCallback: true})
  @post(basePath, {
    security: OPERATION_SECURITY_SPEC,
    responses: {
      [STATUS_CODE.OK]: {
        description: 'Plan model instance',
        content: {
          [CONTENT_TYPE.JSON]: {
            schema: getModelSchemaRefSF(SubscriptionPlan),
          },
        },
      },
    },
  })
  async create(
    @requestBody({
      content: {
        [CONTENT_TYPE.JSON]: {
          schema: getModelSchemaRefSF(SubscriptionPlan, {
            title: 'NewPlan',
            exclude: ['createdOn', 'modifiedOn', 'createdBy', 'modifiedBy'],
          }),
        },
      },
    })
    plan: Omit<SubscriptionPlan, 'createdOn' | 'modifiedOn' | 'createdBy' | 'modifiedBy'>,
  ): Promise<SubscriptionPlan> {
    // Check if plan with same ID already exists
    const existing = await this.planRepository.findOne({where: {id: plan.id}});
    if (existing) {
      throw new HttpErrors.Conflict(`Plan with id ${plan.id} already exists`);
    }
    return this.planRepository.create(plan);
  }

  @authorize({
    permissions: [PermissionKey.UpdatePlan, PermissionKey.ManagePlans],
  })
  @authenticate(STRATEGY.BEARER, {passReqToCallback: true})
  @patch(`${basePath}/{id}`, {
    security: OPERATION_SECURITY_SPEC,
    responses: {
      [STATUS_CODE.NO_CONTENT]: {
        description: 'Plan PATCH success',
      },
    },
  })
  async updateById(
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        [CONTENT_TYPE.JSON]: {
          schema: {
            type: 'object',
            title: 'PlanPartial',
            properties: {
              name: {type: 'string'},
              description: {type: 'string'},
              tier: {type: 'string', enum: ['FREE', 'BASIC', 'STANDARD', 'PREMIUM', 'ENTERPRISE']},
              price: {type: 'number'},
              billingCycle: {type: 'string', enum: ['month', 'quarter', 'year']},
              features: {type: 'array', items: {type: 'string'}},
              isActive: {type: 'boolean'},
              limits: {type: 'object'},
              trialEnabled: {type: 'boolean'},
              trialDuration: {type: 'number'},
              trialDurationUnit: {type: 'string', enum: ['days', 'weeks', 'months']},
              stripeProductId: {type: 'string'},
              stripePriceId: {type: 'string'},
              isPopular: {type: 'boolean'},
              sortOrder: {type: 'number'},
            },
          },
        },
      },
    })
    plan: Partial<SubscriptionPlan>,
  ): Promise<void> {
    // Verify plan exists
    const existing = await this.planRepository.findOne({where: {id}});
    if (!existing) {
      throw new HttpErrors.NotFound(`Plan with id ${id} not found`);
    }

    // Pass the data directly - Sequelize handles JSONB serialization automatically
    await this.planRepository.updateById(id, plan);
  }

  @authorize({
    permissions: [PermissionKey.UpdatePlan, PermissionKey.ManagePlans],
  })
  @authenticate(STRATEGY.BEARER, {passReqToCallback: true})
  @put(`${basePath}/{id}`, {
    security: OPERATION_SECURITY_SPEC,
    responses: {
      [STATUS_CODE.NO_CONTENT]: {
        description: 'Plan PUT success',
      },
    },
  })
  async replaceById(
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        [CONTENT_TYPE.JSON]: {
          schema: getModelSchemaRefSF(SubscriptionPlan),
        },
      },
    })
    plan: SubscriptionPlan,
  ): Promise<void> {
    // Verify plan exists
    const existing = await this.planRepository.findOne({where: {id}});
    if (!existing) {
      throw new HttpErrors.NotFound(`Plan with id ${id} not found`);
    }
    await this.planRepository.replaceById(id, plan);
  }

  @authorize({
    permissions: [PermissionKey.DeletePlan, PermissionKey.ManagePlans],
  })
  @authenticate(STRATEGY.BEARER, {passReqToCallback: true})
  @del(`${basePath}/{id}`, {
    security: OPERATION_SECURITY_SPEC,
    responses: {
      [STATUS_CODE.NO_CONTENT]: {
        description: 'Plan DELETE success',
      },
    },
  })
  async deleteById(@param.path.string('id') id: string): Promise<void> {
    // Verify plan exists
    const existing = await this.planRepository.findOne({where: {id}});
    if (!existing) {
      throw new HttpErrors.NotFound(`Plan with id ${id} not found`);
    }
    await this.planRepository.deleteById(id);
  }
}
