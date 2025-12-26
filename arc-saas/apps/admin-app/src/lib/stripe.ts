/**
 * Stripe configuration and initialization
 *
 * This module initializes Stripe.js with the publishable key from environment variables.
 * The Stripe instance is loaded asynchronously to avoid blocking the main thread.
 */

import { loadStripe, type Stripe } from "@stripe/stripe-js";

// Get Stripe publishable key from environment
const STRIPE_PUBLISHABLE_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || "";

// Stripe promise singleton
let stripePromise: Promise<Stripe | null> | null = null;

/**
 * Get or create the Stripe instance
 * Uses singleton pattern to ensure only one Stripe instance is created
 */
export function getStripe(): Promise<Stripe | null> {
  if (!stripePromise) {
    if (!STRIPE_PUBLISHABLE_KEY) {
      console.warn(
        "[Stripe] No publishable key found. Set VITE_STRIPE_PUBLISHABLE_KEY in your .env file."
      );
      return Promise.resolve(null);
    }
    stripePromise = loadStripe(STRIPE_PUBLISHABLE_KEY);
  }
  return stripePromise;
}

/**
 * Check if Stripe is configured
 */
export function isStripeConfigured(): boolean {
  return Boolean(STRIPE_PUBLISHABLE_KEY);
}

/**
 * Stripe Elements appearance customization
 * Matches the app's design system
 */
export const stripeElementsAppearance = {
  theme: "stripe" as const,
  variables: {
    colorPrimary: "#0f172a",
    colorBackground: "#ffffff",
    colorText: "#0f172a",
    colorDanger: "#dc2626",
    fontFamily: "Inter, system-ui, sans-serif",
    borderRadius: "6px",
    spacingUnit: "4px",
  },
  rules: {
    ".Input": {
      border: "1px solid #e2e8f0",
      boxShadow: "none",
      padding: "10px 12px",
    },
    ".Input:focus": {
      border: "1px solid #0f172a",
      boxShadow: "0 0 0 1px #0f172a",
    },
    ".Input--invalid": {
      border: "1px solid #dc2626",
    },
    ".Label": {
      fontWeight: "500",
      marginBottom: "6px",
    },
    ".Error": {
      color: "#dc2626",
      fontSize: "14px",
    },
  },
};

/**
 * Card Element options
 */
export const cardElementOptions = {
  style: {
    base: {
      fontSize: "16px",
      color: "#0f172a",
      fontFamily: "Inter, system-ui, sans-serif",
      "::placeholder": {
        color: "#94a3b8",
      },
    },
    invalid: {
      color: "#dc2626",
      iconColor: "#dc2626",
    },
  },
  hidePostalCode: false,
};
