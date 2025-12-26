/**
 * Payment intent status values (aligned with Stripe)
 */
export enum PaymentIntentStatus {
  /** Payment requires a payment method to be attached */
  REQUIRES_PAYMENT_METHOD = 'requires_payment_method',
  /** Payment requires confirmation */
  REQUIRES_CONFIRMATION = 'requires_confirmation',
  /** Payment requires additional action (e.g., 3D Secure) */
  REQUIRES_ACTION = 'requires_action',
  /** Payment is being processed */
  PROCESSING = 'processing',
  /** Payment requires capture (for manual capture) */
  REQUIRES_CAPTURE = 'requires_capture',
  /** Payment was cancelled */
  CANCELLED = 'cancelled',
  /** Payment succeeded */
  SUCCEEDED = 'succeeded',
}
