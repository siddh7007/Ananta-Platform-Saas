import moment, {unitOfTime} from 'moment';
import {Plan, Subscription} from '../models';
import {repository} from '@loopback/repository';
import {
  BillingCycleRepository,
  PlanRepository,
  SubscriptionRepository,
} from '../repositories';
import {BindingScope, injectable} from '@loopback/context';
import {SubscriptionStatus} from '../enums';
import {HttpErrors} from '@loopback/rest';

const DATE_FORMAT = 'YYYY-MM-DD';

// ============================================
// Types for subscription operations
// ============================================

export interface CreateSubscriptionInput {
  subscriberId: string;
  planId: string;
  invoiceId?: string;
  startTrial?: boolean;
  autoRenew?: boolean;
  metaData?: object;
}

export interface RenewSubscriptionResult {
  subscription: Subscription;
  newEndDate: string;
  renewalCount: number;
}

export interface ChangePlanInput {
  subscriptionId: string;
  newPlanId: string;
  immediate?: boolean;
  prorate?: boolean;
}

export interface ChangePlanResult {
  subscription: Subscription;
  previousPlanId: string;
  prorationCredit?: number;
  effectiveDate: string;
}

export interface CancelSubscriptionInput {
  subscriptionId: string;
  reason?: string;
  immediate?: boolean;
}

export interface TrialConversionResult {
  subscription: Subscription;
  convertedAt: string;
  newEndDate: string;
}

@injectable({scope: BindingScope.TRANSIENT})
export class SubscriptionService {
  constructor(
    @repository(SubscriptionRepository)
    private readonly subscriptionRepository: SubscriptionRepository,
    @repository(PlanRepository)
    private readonly planRepository: PlanRepository,
    @repository(BillingCycleRepository)
    private readonly billingCycleRepository: BillingCycleRepository,
  ) {}

  // ============================================
  // Create Subscription (with trial support)
  // ============================================

  async createSubscription(
    input: CreateSubscriptionInput | Omit<Subscription, 'id' | 'startDate' | 'endDate'>,
  ): Promise<Subscription> {
    // Handle legacy input format
    const isLegacyInput = 'status' in input;

    const planId = input.planId;
    const subscriberId = input.subscriberId;
    const invoiceId = isLegacyInput
      ? (input as Subscription).invoiceId
      : (input as CreateSubscriptionInput).invoiceId;
    const startTrial = isLegacyInput
      ? false
      : (input as CreateSubscriptionInput).startTrial;
    const autoRenew = isLegacyInput
      ? true
      : (input as CreateSubscriptionInput).autoRenew ?? true;
    const metaData = isLegacyInput
      ? undefined
      : (input as CreateSubscriptionInput).metaData;

    const plan = await this.planRepository.findById(planId);
    const billingCycle = await this.billingCycleRepository.findById(
      plan.billingCycleId,
    );

    const startDate = moment().format(DATE_FORMAT);
    let endDate: string;
    let isTrial = false;
    let trialEndDate: string | undefined;

    // Handle trial period if enabled and requested
    if (startTrial && plan.trialEnabled && plan.trialDuration) {
      isTrial = true;
      trialEndDate = moment()
        .add(plan.trialDuration, this._unitMap(plan.trialDurationUnit || 'day'))
        .format(DATE_FORMAT);
      // During trial, end date is the trial end date
      endDate = trialEndDate;
    } else {
      // Standard subscription period
      endDate = moment()
        .add(billingCycle.duration, this._unitMap(billingCycle.durationUnit))
        .format(DATE_FORMAT);
    }

    const status = isLegacyInput
      ? (input as Subscription).status
      : (isTrial ? SubscriptionStatus.ACTIVE : SubscriptionStatus.PENDING);

    return this.subscriptionRepository.create({
      subscriberId,
      planId,
      invoiceId: invoiceId ?? '',
      status,
      startDate,
      endDate,
      isTrial,
      trialEndDate,
      autoRenew,
      renewalCount: 0,
      metaData,
    });
  }

  // ============================================
  // Renew Subscription
  // ============================================

  async renewSubscription(subscriptionId: string): Promise<RenewSubscriptionResult> {
    const subscription = await this.subscriptionRepository.findById(subscriptionId);

    if (!subscription) {
      throw new HttpErrors.NotFound(`Subscription ${subscriptionId} not found`);
    }

    if (subscription.status === SubscriptionStatus.CANCELLED) {
      throw new HttpErrors.BadRequest('Cannot renew a cancelled subscription');
    }

    const plan = await this.planRepository.findById(subscription.planId);
    const billingCycle = await this.billingCycleRepository.findById(
      plan.billingCycleId,
    );

    // Calculate new end date from current end date (not from now)
    const newEndDate = moment(subscription.endDate)
      .add(billingCycle.duration, this._unitMap(billingCycle.durationUnit))
      .format(DATE_FORMAT);

    const renewalCount = (subscription.renewalCount ?? 0) + 1;

    await this.subscriptionRepository.updateById(subscriptionId, {
      endDate: newEndDate,
      renewalCount,
      status: SubscriptionStatus.ACTIVE,
      // Clear trial flags on renewal
      isTrial: false,
      trialEndDate: undefined,
    });

    const updated = await this.subscriptionRepository.findById(subscriptionId);

    return {
      subscription: updated,
      newEndDate,
      renewalCount,
    };
  }

  // ============================================
  // Auto-renew eligible subscriptions
  // ============================================

  async processAutoRenewals(): Promise<RenewSubscriptionResult[]> {
    const results: RenewSubscriptionResult[] = [];

    // Find subscriptions that are due for renewal (end date is today or passed)
    // and have auto-renew enabled
    const subscriptions = await this.subscriptionRepository.find({
      where: {
        status: SubscriptionStatus.ACTIVE,
        autoRenew: true,
      },
    });

    const dueForRenewal = subscriptions.filter(sub =>
      moment(sub.endDate).isSameOrBefore(moment(), 'day'),
    );

    for (const subscription of dueForRenewal) {
      try {
        const result = await this.renewSubscription(subscription.id);
        results.push(result);
      } catch (error) {
        // Log error but continue processing other subscriptions
        console.error(
          `Failed to renew subscription ${subscription.id}:`,
          error,
        );
      }
    }

    return results;
  }

  // ============================================
  // Convert Trial to Paid
  // ============================================

  async convertTrialToPaid(subscriptionId: string): Promise<TrialConversionResult> {
    const subscription = await this.subscriptionRepository.findById(subscriptionId);

    if (!subscription) {
      throw new HttpErrors.NotFound(`Subscription ${subscriptionId} not found`);
    }

    if (!subscription.isTrial) {
      throw new HttpErrors.BadRequest('Subscription is not in trial period');
    }

    const plan = await this.planRepository.findById(subscription.planId);
    const billingCycle = await this.billingCycleRepository.findById(
      plan.billingCycleId,
    );

    const convertedAt = moment().format(DATE_FORMAT);
    const newEndDate = moment()
      .add(billingCycle.duration, this._unitMap(billingCycle.durationUnit))
      .format(DATE_FORMAT);

    await this.subscriptionRepository.updateById(subscriptionId, {
      isTrial: false,
      trialEndDate: undefined,
      startDate: convertedAt,
      endDate: newEndDate,
      status: SubscriptionStatus.ACTIVE,
    });

    const updated = await this.subscriptionRepository.findById(subscriptionId);

    return {
      subscription: updated,
      convertedAt,
      newEndDate,
    };
  }

  // ============================================
  // Change Plan (Upgrade/Downgrade)
  // ============================================

  async changePlan(input: ChangePlanInput): Promise<ChangePlanResult> {
    const subscription = await this.subscriptionRepository.findById(
      input.subscriptionId,
    );

    if (!subscription) {
      throw new HttpErrors.NotFound(
        `Subscription ${input.subscriptionId} not found`,
      );
    }

    if (subscription.status !== SubscriptionStatus.ACTIVE) {
      throw new HttpErrors.BadRequest(
        'Can only change plan for active subscriptions',
      );
    }

    const currentPlan = await this.planRepository.findById(subscription.planId);
    const newPlan = await this.planRepository.findById(input.newPlanId);

    if (!newPlan) {
      throw new HttpErrors.NotFound(`Plan ${input.newPlanId} not found`);
    }

    let prorationCredit: number | undefined;
    const effectiveDate = moment().format(DATE_FORMAT);
    let newEndDate = subscription.endDate;

    // Calculate proration if requested
    if (input.prorate) {
      prorationCredit = this._calculateProration(
        subscription,
        currentPlan,
        newPlan,
      );
    }

    // If immediate, recalculate end date based on new plan
    if (input.immediate) {
      const billingCycle = await this.billingCycleRepository.findById(
        newPlan.billingCycleId,
      );
      newEndDate = moment()
        .add(billingCycle.duration, this._unitMap(billingCycle.durationUnit))
        .format(DATE_FORMAT);
    }

    await this.subscriptionRepository.updateById(input.subscriptionId, {
      planId: input.newPlanId,
      previousPlanId: subscription.planId,
      planChangedAt: effectiveDate,
      prorationCredit,
      ...(input.immediate && {
        startDate: effectiveDate,
        endDate: newEndDate,
      }),
    });

    const updated = await this.subscriptionRepository.findById(
      input.subscriptionId,
    );

    return {
      subscription: updated,
      previousPlanId: subscription.planId,
      prorationCredit,
      effectiveDate,
    };
  }

  private _calculateProration(
    subscription: Subscription,
    currentPlan: Plan,
    _newPlan: Plan,
  ): number {
    // Calculate days remaining in current period
    const today = moment();
    const endDate = moment(subscription.endDate);
    const startDate = moment(subscription.startDate);

    const totalDays = endDate.diff(startDate, 'days');
    const daysRemaining = endDate.diff(today, 'days');

    if (daysRemaining <= 0 || totalDays <= 0) {
      return 0;
    }

    // Calculate unused value from current plan
    const dailyRate = currentPlan.price / totalDays;
    const unusedValue = dailyRate * daysRemaining;

    return Math.round(unusedValue * 100) / 100; // Round to 2 decimal places
  }

  // ============================================
  // Cancel Subscription
  // ============================================

  async cancelSubscription(
    input: CancelSubscriptionInput,
  ): Promise<Subscription> {
    const subscription = await this.subscriptionRepository.findById(
      input.subscriptionId,
    );

    if (!subscription) {
      throw new HttpErrors.NotFound(
        `Subscription ${input.subscriptionId} not found`,
      );
    }

    const cancelledAt = moment().format(DATE_FORMAT);

    const updateData: Partial<Subscription> = {
      cancelledAt,
      cancellationReason: input.reason,
      autoRenew: false, // Disable auto-renew
    };

    if (input.immediate) {
      // Immediate cancellation - mark as cancelled and end now
      updateData.status = SubscriptionStatus.CANCELLED;
      updateData.endDate = cancelledAt;
    } else {
      // End-of-period cancellation - will be cancelled when period ends
      // Status stays active until then
      updateData.status = SubscriptionStatus.ACTIVE;
    }

    await this.subscriptionRepository.updateById(
      input.subscriptionId,
      updateData,
    );

    return this.subscriptionRepository.findById(input.subscriptionId);
  }

  // ============================================
  // Reactivate Cancelled Subscription
  // ============================================

  async reactivateSubscription(subscriptionId: string): Promise<Subscription> {
    const subscription = await this.subscriptionRepository.findById(subscriptionId);

    if (!subscription) {
      throw new HttpErrors.NotFound(`Subscription ${subscriptionId} not found`);
    }

    if (subscription.status !== SubscriptionStatus.CANCELLED) {
      throw new HttpErrors.BadRequest(
        'Can only reactivate cancelled subscriptions',
      );
    }

    const plan = await this.planRepository.findById(subscription.planId);
    const billingCycle = await this.billingCycleRepository.findById(
      plan.billingCycleId,
    );

    // Start fresh period
    const startDate = moment().format(DATE_FORMAT);
    const endDate = moment()
      .add(billingCycle.duration, this._unitMap(billingCycle.durationUnit))
      .format(DATE_FORMAT);

    await this.subscriptionRepository.updateById(subscriptionId, {
      status: SubscriptionStatus.ACTIVE,
      startDate,
      endDate,
      cancelledAt: undefined,
      cancellationReason: undefined,
      autoRenew: true,
    });

    return this.subscriptionRepository.findById(subscriptionId);
  }

  // ============================================
  // Get Trials Ending Soon
  // ============================================

  async getTrialsEndingSoon(
    daysRemaining: number = 3,
  ): Promise<{id: string; daysToTrialEnd: number; subscriberId: string}[]> {
    const subscriptions = await this.subscriptionRepository.find({
      where: {
        status: SubscriptionStatus.ACTIVE,
        isTrial: true,
      },
    });

    return subscriptions
      .filter(
        sub =>
          sub.trialEndDate &&
          moment(sub.trialEndDate).isBefore(
            moment().add(daysRemaining, 'days'),
          ) &&
          moment(sub.trialEndDate).isAfter(moment()),
      )
      .map(sub => ({
        id: sub.id,
        daysToTrialEnd: moment(sub.trialEndDate).diff(moment(), 'days'),
        subscriberId: sub.subscriberId,
      }));
  }

  // ============================================
  // Handle Expired Trials
  // ============================================

  async handleExpiredTrials(): Promise<
    {subscriptionId: string; subscriberId: string}[]
  > {
    const subscriptions = await this.subscriptionRepository.find({
      where: {
        status: SubscriptionStatus.ACTIVE,
        isTrial: true,
      },
    });

    const expiredTrials = subscriptions.filter(
      sub => sub.trialEndDate && moment(sub.trialEndDate).isBefore(moment()),
    );

    const updates = expiredTrials.map(sub =>
      this.subscriptionRepository.updateById(sub.id, {
        status: SubscriptionStatus.EXPIRED,
        isTrial: false,
      }),
    );

    await Promise.all(updates);

    return expiredTrials.map(sub => ({
      subscriptionId: sub.id,
      subscriberId: sub.subscriberId,
    }));
  }

  // ============================================
  // Existing methods (kept for backward compatibility)
  // ============================================

  private _unitMap(durationUnit: string): unitOfTime.DurationConstructor {
    switch (durationUnit) {
      case 'month':
        return 'M';
      case 'year':
        return 'y';
      case 'week':
        return 'week';
      default:
        return 'days';
    }
  }

  async getExpireSoonSubscriptions(): Promise<
    {id: string; daysRemainingToExpiry: number; subscriberId: string}[]
  > {
    const daysRemaining = 7;
    const subscriptions = await this.subscriptionRepository.find({
      where: {status: SubscriptionStatus.ACTIVE},
    });

    return subscriptions
      .filter(
        sub =>
          moment(sub.endDate).isBefore(moment().add(daysRemaining, 'days')) &&
          moment(sub.endDate).isAfter(moment()),
      )
      .map(sub => ({
        id: sub.id,
        daysRemainingToExpiry: moment(sub.endDate).diff(moment(), 'days'),
        subscriberId: sub.subscriberId,
      }));
  }

  async handleExpiredSubscriptions(
    dayCount: number,
  ): Promise<{subscriptionId: string; subscriberId: string}[]> {
    const subscriptions = await this.subscriptionRepository.find({
      where: {status: SubscriptionStatus.ACTIVE},
    });

    // Skip subscriptions scheduled for cancellation
    const markAsExpired = subscriptions
      .filter(
        sub =>
          moment(sub.endDate).isBefore(moment()) &&
          !sub.cancelledAt, // Don't mark as expired if pending cancellation
      )
      .map(sub =>
        this.subscriptionRepository.updateById(sub.id, {
          status: SubscriptionStatus.EXPIRED,
        }),
      );
    await Promise.all(markAsExpired);

    // Handle pending cancellations
    const pendingCancellations = subscriptions.filter(
      sub =>
        sub.cancelledAt &&
        moment(sub.endDate).isBefore(moment()) &&
        sub.status === SubscriptionStatus.ACTIVE,
    );

    const cancelPending = pendingCancellations.map(sub =>
      this.subscriptionRepository.updateById(sub.id, {
        status: SubscriptionStatus.CANCELLED,
      }),
    );
    await Promise.all(cancelPending);

    const range = moment().subtract(dayCount, 'days').format(DATE_FORMAT);
    const expiredSubscriptions = await this.subscriptionRepository.find({
      where: {status: SubscriptionStatus.EXPIRED},
    });

    return expiredSubscriptions
      .filter(sub => moment(sub.endDate).isAfter(range))
      .map(sub => ({
        subscriptionId: sub.id,
        subscriberId: sub.subscriberId,
      }));
  }

  // ============================================
  // Get Subscription with Plan Details
  // ============================================

  async getSubscriptionWithPlan(
    subscriptionId: string,
  ): Promise<Subscription & {plan: Plan}> {
    const subscription = await this.subscriptionRepository.findById(subscriptionId);

    if (!subscription) {
      throw new HttpErrors.NotFound(`Subscription ${subscriptionId} not found`);
    }

    const plan = await this.planRepository.findById(subscription.planId);

    // Cast to satisfy TypeScript - the spread creates a plain object
    // but the model methods are not required for the return type
    return {
      ...subscription,
      plan,
    } as Subscription & {plan: Plan};
  }

  // ============================================
  // Get Subscriber's Active Subscription
  // ============================================

  async getActiveSubscription(
    subscriberId: string,
  ): Promise<Subscription | null> {
    const subscriptions = await this.subscriptionRepository.find({
      where: {
        subscriberId,
        status: SubscriptionStatus.ACTIVE,
      },
      limit: 1,
    });

    return subscriptions.length > 0 ? subscriptions[0] : null;
  }
}
