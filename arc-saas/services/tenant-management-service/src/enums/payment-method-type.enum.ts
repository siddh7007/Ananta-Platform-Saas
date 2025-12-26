/**
 * Payment method types supported by the platform
 */
export enum PaymentMethodType {
  /** Credit or debit card */
  CARD = 'card',
  /** Bank account via ACH */
  BANK_ACCOUNT = 'bank_account',
  /** SEPA Direct Debit */
  SEPA_DEBIT = 'sepa_debit',
  /** PayPal */
  PAYPAL = 'paypal',
}
