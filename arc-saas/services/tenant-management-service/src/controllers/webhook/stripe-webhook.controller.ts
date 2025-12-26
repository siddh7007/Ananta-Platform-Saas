import {inject} from '@loopback/core';
import {post, Request, RestBindings, HttpErrors} from '@loopback/rest';
import {
  CONTENT_TYPE,
  STATUS_CODE,
  ILogger,
  LOGGER,
} from '@sourceloop/core';
import {authorize} from 'loopback4-authorization';
import {StripeService} from '../../services/stripe.service';
import {StripeWebhookService} from '../../services/stripe-webhook.service';

const basePath = '/webhooks/stripe';

/**
 * Stripe Webhook Controller
 *
 * Handles incoming webhooks from Stripe for payment events.
 * Uses signature verification to ensure webhooks are authentic.
 *
 * IMPORTANT: This endpoint must receive the raw request body for
 * signature verification. LoopBack's body parser must be configured
 * to provide raw body access.
 */
export class StripeWebhookController {
  constructor(
    @inject('services.StripeService')
    private readonly stripeService: StripeService,
    @inject('services.StripeWebhookService')
    private readonly webhookService: StripeWebhookService,
    @inject(RestBindings.Http.REQUEST)
    private readonly request: Request,
    @inject(LOGGER.LOGGER_INJECT)
    private readonly logger: ILogger,
  ) {}

  /**
   * Handle incoming Stripe webhooks
   *
   * Stripe sends webhooks for various payment events. This endpoint:
   * 1. Verifies the webhook signature using the raw body
   * 2. Dispatches to appropriate handler based on event type
   * 3. Returns 200 OK to acknowledge receipt (Stripe will retry on failure)
   *
   * Supported events:
   * - payment_intent.succeeded - Payment was successful
   * - payment_intent.payment_failed - Payment failed
   * - payment_intent.canceled - Payment was canceled
   * - payment_method.attached - Payment method added to customer
   * - payment_method.detached - Payment method removed from customer
   * - customer.subscription.created - Subscription created
   * - customer.subscription.updated - Subscription updated
   * - customer.subscription.deleted - Subscription deleted
   * - invoice.paid - Invoice was paid
   * - invoice.payment_failed - Invoice payment failed
   */
  @authorize({permissions: ['*']})
  @post(`${basePath}`, {
    responses: {
      [STATUS_CODE.OK]: {
        description: 'Webhook received successfully',
        content: {
          [CONTENT_TYPE.JSON]: {
            schema: {
              type: 'object',
              properties: {
                received: {type: 'boolean'},
              },
            },
          },
        },
      },
      [STATUS_CODE.BAD_REQUEST]: {
        description: 'Invalid webhook payload or signature',
      },
    },
  })
  async handleWebhook(): Promise<{received: boolean}> {
    // Get the raw body for signature verification
    // The body should be the raw string/buffer, not parsed JSON
    const rawBody = (this.request as Request & {rawBody?: string | Buffer})
      .rawBody;
    const signature = this.request.headers['stripe-signature'] as string;

    if (!rawBody) {
      this.logger.error(
        '[Stripe Webhook] No raw body available for signature verification',
      );
      throw new HttpErrors.BadRequest(
        'Webhook error: No raw body available for signature verification',
      );
    }

    if (!signature) {
      this.logger.error('[Stripe Webhook] Missing stripe-signature header');
      throw new HttpErrors.BadRequest(
        'Webhook error: Missing stripe-signature header',
      );
    }

    try {
      // Verify signature and construct event
      const event = this.stripeService.constructWebhookEvent(
        rawBody,
        signature,
      );

      if (!event) {
        this.logger.error('[Stripe Webhook] Failed to construct event');
        throw new HttpErrors.BadRequest('Webhook error: Invalid signature');
      }

      this.logger.info(
        `[Stripe Webhook] Received event: ${event.type} (${event.id})`,
      );

      // Process the event
      await this.webhookService.processEvent(event);

      this.logger.info(
        `[Stripe Webhook] Successfully processed event: ${event.type} (${event.id})`,
      );

      return {received: true};
    } catch (error) {
      if (error instanceof HttpErrors.HttpError) {
        throw error;
      }

      this.logger.error(
        `[Stripe Webhook] Error processing webhook: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new HttpErrors.BadRequest(
        `Webhook error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }
}
