/**
 * Billing Activities
 *
 * Handles billing operations for tenant provisioning by calling
 * the subscription-service REST APIs.
 *
 * The subscription-service uses loopback4-billing with Stripe provider
 * to handle actual payment processing.
 */

import { Context } from '@temporalio/activity';
import { config } from '../config';
import { createLogger } from '../utils/logger';
import { createActivityTracer } from '../observability/activity-tracer';

const logger = createLogger('billing-activities');

// Subscription service URL from config
const SUBSCRIPTION_SERVICE_URL =
  process.env.SUBSCRIPTION_SERVICE_URL || 'http://localhost:3000';

// ============================================
// Type Definitions
// ============================================

export interface CreateBillingCustomerInput {
  tenantId: string;
  firstName: string;
  lastName: string;
  email: string;
  company?: string;
  phone?: string;
}

export interface CreateBillingCustomerOutput {
  customerId: string;
  email: string;
}

export interface BillingCustomerDto {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  company?: string;
  phone?: string;
}

// ============================================
// HTTP Client Helper
// ============================================

async function callSubscriptionService<T>(
  method: string,
  path: string,
  body?: unknown,
  headers?: Record<string, string>
): Promise<T> {
  const url = `${SUBSCRIPTION_SERVICE_URL}${path}`;

  logger.debug('Calling subscription service', { method, url });

  const response = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      // Use system token for service-to-service calls
      Authorization: `Bearer ${process.env.SYSTEM_API_TOKEN || ''}`,
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const errorText = await response.text();
    logger.error('Subscription service call failed', {
      status: response.status,
      error: errorText,
    });
    throw new Error(
      `Subscription service error: ${response.status} - ${errorText}`
    );
  }

  // Handle empty responses
  const text = await response.text();
  if (!text) {
    return {} as T;
  }

  return JSON.parse(text) as T;
}

// ============================================
// Create Billing Customer
// ============================================

/**
 * Creates a billing customer in the subscription service.
 * This calls the /billing-customer endpoint which uses loopback4-billing
 * to create the customer in Stripe.
 */
export async function createBillingCustomer(
  input: CreateBillingCustomerInput
): Promise<CreateBillingCustomerOutput> {
  const { tenantId, firstName, lastName, email, company, phone } = input;
  const tracer = createActivityTracer('createBillingCustomer', tenantId);

  logger.info('Creating billing customer', { tenantId, email });

  try {
    const customerDto = {
      firstName,
      lastName,
      email,
      company,
      phone,
    };

    const result = await callSubscriptionService<BillingCustomerDto>(
      'POST',
      '/billing-customer',
      customerDto,
      { tenantId }
    );

    logger.info('Billing customer created', {
      tenantId,
      customerId: result.id,
    });

    tracer.success({ customerId: result.id });
    return { customerId: result.id, email };
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to create billing customer', {
      tenantId,
      error: err.message,
    });
    tracer.failure(err);
    throw error;
  }
}

// ============================================
// Get Billing Customer
// ============================================

export interface GetBillingCustomerInput {
  tenantId: string;
}

/**
 * Gets billing customer details from the subscription service.
 */
export async function getBillingCustomer(
  input: GetBillingCustomerInput
): Promise<BillingCustomerDto | null> {
  const { tenantId } = input;
  const tracer = createActivityTracer('getBillingCustomer', tenantId);

  logger.info('Getting billing customer', { tenantId });

  try {
    const filter = encodeURIComponent(
      JSON.stringify({ where: { tenantId } })
    );
    const result = await callSubscriptionService<{
      customerDetails: BillingCustomerDto;
    }>('GET', `/billing-customer?filter=${filter}`);

    logger.info('Billing customer retrieved', {
      tenantId,
      customerId: result.customerDetails?.id,
    });

    tracer.success({ customerId: result.customerDetails?.id });
    return result.customerDetails;
  } catch (error) {
    const err = error as Error;
    // Customer not found is not an error
    if (err.message.includes('not present')) {
      logger.info('Billing customer not found', { tenantId });
      tracer.success({ found: false });
      return null;
    }
    logger.error('Failed to get billing customer', {
      tenantId,
      error: err.message,
    });
    tracer.failure(err);
    throw error;
  }
}

// ============================================
// Delete Billing Customer (for rollback)
// ============================================

export interface DeleteBillingCustomerInput {
  tenantId: string;
}

/**
 * Deletes a billing customer (for saga compensation).
 */
export async function deleteBillingCustomer(
  input: DeleteBillingCustomerInput
): Promise<void> {
  const { tenantId } = input;
  const tracer = createActivityTracer('deleteBillingCustomer', tenantId);

  logger.info('Deleting billing customer', { tenantId });

  try {
    await callSubscriptionService<void>('DELETE', `/billing-customer/${tenantId}`);

    logger.info('Billing customer deleted', { tenantId });
    tracer.success({});
  } catch (error) {
    const err = error as Error;
    // Not found is acceptable for rollback
    if (err.message.includes('not present') || err.message.includes('404')) {
      logger.info('Billing customer already deleted or not found', { tenantId });
      tracer.success({ alreadyDeleted: true });
      return;
    }
    logger.error('Failed to delete billing customer', {
      tenantId,
      error: err.message,
    });
    tracer.failure(err);
    throw error;
  }
}

// ============================================
// Create Subscription
// ============================================

export interface CreateSubscriptionInput {
  tenantId: string;
  planId: string;
  startDate?: Date;
}

export interface CreateSubscriptionOutput {
  subscriptionId: string;
  status: string;
  planId: string;
}

/**
 * Creates a subscription for a tenant in the subscription service.
 */
export async function createTenantSubscription(
  input: CreateSubscriptionInput
): Promise<CreateSubscriptionOutput> {
  const { tenantId, planId, startDate } = input;
  const tracer = createActivityTracer('createTenantSubscription', tenantId);

  logger.info('Creating tenant subscription', { tenantId, planId });

  try {
    const subscriptionData = {
      tenantId,
      planId,
      startDate: startDate || new Date(),
      status: 1, // Active
    };

    const result = await callSubscriptionService<{
      id: string;
      status: number;
      planId: string;
    }>('POST', '/subscriptions', subscriptionData);

    logger.info('Tenant subscription created', {
      tenantId,
      subscriptionId: result.id,
    });

    tracer.success({ subscriptionId: result.id });
    return {
      subscriptionId: result.id,
      status: result.status.toString(),
      planId: result.planId,
    };
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to create tenant subscription', {
      tenantId,
      error: err.message,
    });
    tracer.failure(err);
    throw error;
  }
}

// ============================================
// Update Subscription Status
// ============================================

export interface UpdateSubscriptionStatusInput {
  subscriptionId: string;
  status: number; // 1=active, 2=suspended, 3=cancelled
}

/**
 * Updates a subscription's status.
 */
export async function updateSubscriptionStatus(
  input: UpdateSubscriptionStatusInput
): Promise<void> {
  const { subscriptionId, status } = input;
  const tracer = createActivityTracer('updateSubscriptionStatus', subscriptionId);

  logger.info('Updating subscription status', { subscriptionId, status });

  try {
    await callSubscriptionService<void>(
      'PATCH',
      `/subscriptions/${subscriptionId}`,
      { status }
    );

    logger.info('Subscription status updated', { subscriptionId, status });
    tracer.success({});
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to update subscription status', {
      subscriptionId,
      error: err.message,
    });
    tracer.failure(err);
    throw error;
  }
}

