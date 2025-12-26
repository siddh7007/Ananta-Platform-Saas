import { useList, useCreate, useDelete, useNotification, useCustomMutation } from "@refinedev/core";
import { useState, useEffect } from "react";
import {
  Elements,
  CardElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import type { StripeCardElementChangeEvent } from "@stripe/stripe-js";
import {
  CreditCard,
  Plus,
  Trash2,
  Star,
  Building2,
  AlertCircle,
  CheckCircle,
  Loader2,
  RefreshCw,
  Lock,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getStripe, isStripeConfigured, cardElementOptions, stripeElementsAppearance } from "@/lib/stripe";

interface PaymentMethod {
  id: string;
  tenantId: string;
  type: "card" | "us_bank_account" | "sepa_debit";
  isDefault: boolean;
  stripePaymentMethodId?: string;
  stripeCustomerId?: string;
  cardDetails?: {
    brand: string;
    last4: string;
    expMonth: number;
    expYear: number;
    funding?: string;
    country?: string;
  };
  bankAccountDetails?: {
    bankName?: string;
    last4: string;
    accountHolderType?: string;
    routingNumber?: string;
  };
  billingDetails?: {
    name?: string;
    email?: string;
    address?: {
      line1?: string;
      city?: string;
      state?: string;
      postalCode?: string;
      country?: string;
    };
  };
  createdOn?: string;
  deleted?: boolean;
}

interface SetupIntent {
  clientSecret: string;
  setupIntentId: string;
}

const CARD_BRAND_ICONS: Record<string, string> = {
  visa: "VISA",
  mastercard: "MC",
  amex: "AMEX",
  discover: "DISC",
  diners: "DINE",
  jcb: "JCB",
  unionpay: "UP",
  unknown: "CARD",
};

export function PaymentMethodsPage() {
  const { open: notify } = useNotification();
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedMethodId, setSelectedMethodId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  // Fetch payment methods
  const {
    data: methodsData,
    isLoading,
    refetch,
  } = useList<PaymentMethod>({
    resource: "payment-methods",
    pagination: { pageSize: 50 },
    sorters: [{ field: "createdOn", order: "desc" }],
  });

  // Delete mutation
  const { mutate: deleteMethod, isLoading: isDeleting } = useDelete();

  // Set default mutation - use PATCH method
  const { mutate: setDefaultMutation, isLoading: isSettingDefault } = useCustomMutation();

  const paymentMethods = methodsData?.data || [];
  const defaultMethod = paymentMethods.find((m) => m.isDefault);

  const handleSetDefault = async (methodId: string) => {
    setSelectedMethodId(methodId);
    setDefaultMutation(
      {
        url: `payment-methods/${methodId}/set-default`,
        method: "patch",
        values: {},
      },
      {
        onSuccess: () => {
          notify?.({
            type: "success",
            message: "Default payment method updated",
          });
          refetch();
          setSelectedMethodId(null);
        },
        onError: (error) => {
          notify?.({
            type: "error",
            message: `Failed to set default: ${error.message}`,
          });
          setSelectedMethodId(null);
        },
      }
    );
  };

  const handleDelete = async (methodId: string) => {
    deleteMethod(
      {
        resource: "payment-methods",
        id: methodId,
      },
      {
        onSuccess: () => {
          notify?.({
            type: "success",
            message: "Payment method removed",
          });
          setConfirmDelete(null);
          refetch();
        },
        onError: (error) => {
          notify?.({
            type: "error",
            message: `Failed to remove: ${error.message}`,
          });
          setConfirmDelete(null);
        },
      }
    );
  };

  const formatCardBrand = (brand: string): string => {
    return CARD_BRAND_ICONS[brand.toLowerCase()] || brand.toUpperCase();
  };

  const isExpiringSoon = (expMonth: number, expYear: number): boolean => {
    const now = new Date();
    const expDate = new Date(expYear, expMonth - 1);
    const threeMonthsFromNow = new Date(now.getFullYear(), now.getMonth() + 3);
    return expDate <= threeMonthsFromNow;
  };

  const isExpired = (expMonth: number, expYear: number): boolean => {
    const now = new Date();
    const expDate = new Date(expYear, expMonth);
    return expDate < now;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Payment Methods</h1>
          <p className="text-muted-foreground">
            Manage payment methods for subscription billing
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            className="inline-flex items-center justify-center rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </button>
          <button
            onClick={() => setShowAddForm(true)}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Payment Method
          </button>
        </div>
      </div>

      {/* Stripe Not Configured Warning */}
      {!isStripeConfigured() && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5" />
            <div>
              <p className="font-medium text-amber-800">Stripe Not Configured</p>
              <p className="text-sm text-amber-700 mt-1">
                Set <code className="bg-amber-100 px-1 rounded">VITE_STRIPE_PUBLISHABLE_KEY</code> in your{" "}
                <code className="bg-amber-100 px-1 rounded">.env</code> file to enable payment processing.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Default Payment Method Banner */}
      {defaultMethod && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4">
          <div className="flex items-center gap-3">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <div>
              <p className="font-medium text-green-800">Default Payment Method</p>
              <p className="text-sm text-green-700">
                {defaultMethod.type === "card" && defaultMethod.cardDetails && (
                  <>
                    {formatCardBrand(defaultMethod.cardDetails.brand)} ending in{" "}
                    {defaultMethod.cardDetails.last4}
                  </>
                )}
                {defaultMethod.type === "us_bank_account" &&
                  defaultMethod.bankAccountDetails && (
                    <>
                      {defaultMethod.bankAccountDetails.bankName} ending in{" "}
                      {defaultMethod.bankAccountDetails.last4}
                    </>
                  )}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* No Payment Methods Warning */}
      {!isLoading && paymentMethods.length === 0 && (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-6 text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-yellow-500" />
          <h3 className="mt-4 text-lg font-semibold text-yellow-800">
            No Payment Methods
          </h3>
          <p className="mt-2 text-sm text-yellow-700">
            Add a payment method to enable automatic billing for subscriptions.
          </p>
          <button
            onClick={() => setShowAddForm(true)}
            className="mt-4 inline-flex items-center justify-center rounded-md bg-yellow-600 px-4 py-2 text-sm font-medium text-white hover:bg-yellow-700"
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Payment Method
          </button>
        </div>
      )}

      {/* Payment Methods Grid */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {paymentMethods.map((method) => (
            <div
              key={method.id}
              className={cn(
                "relative rounded-lg border bg-card p-6",
                method.isDefault && "ring-2 ring-primary"
              )}
            >
              {/* Default Badge */}
              {method.isDefault && (
                <div className="absolute -top-2 -right-2 rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">
                  Default
                </div>
              )}

              {/* Card Display */}
              {method.type === "card" && method.cardDetails && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center">
                        <CreditCard className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <p className="font-bold text-lg">
                          {formatCardBrand(method.cardDetails.brand)}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          **** **** **** {method.cardDetails.last4}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Expires</span>
                    <span
                      className={cn(
                        "font-medium",
                        isExpired(
                          method.cardDetails.expMonth,
                          method.cardDetails.expYear
                        ) && "text-red-600",
                        !isExpired(
                          method.cardDetails.expMonth,
                          method.cardDetails.expYear
                        ) &&
                          isExpiringSoon(
                            method.cardDetails.expMonth,
                            method.cardDetails.expYear
                          ) &&
                          "text-yellow-600"
                      )}
                    >
                      {String(method.cardDetails.expMonth).padStart(2, "0")}/
                      {method.cardDetails.expYear}
                      {isExpired(
                        method.cardDetails.expMonth,
                        method.cardDetails.expYear
                      ) && " (Expired)"}
                      {!isExpired(
                        method.cardDetails.expMonth,
                        method.cardDetails.expYear
                      ) &&
                        isExpiringSoon(
                          method.cardDetails.expMonth,
                          method.cardDetails.expYear
                        ) &&
                        " (Expiring soon)"}
                    </span>
                  </div>

                  {method.cardDetails.funding && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Type</span>
                      <span className="capitalize">{method.cardDetails.funding}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Bank Account Display */}
              {method.type === "us_bank_account" && method.bankAccountDetails && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center">
                      <Building2 className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-bold">
                        {method.bankAccountDetails.bankName || "Bank Account"}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        **** {method.bankAccountDetails.last4}
                      </p>
                    </div>
                  </div>

                  {method.bankAccountDetails.accountHolderType && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Account Type</span>
                      <span className="capitalize">
                        {method.bankAccountDetails.accountHolderType}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Billing Details */}
              {method.billingDetails?.name && (
                <div className="mt-4 pt-4 border-t">
                  <p className="text-sm text-muted-foreground">
                    {method.billingDetails.name}
                  </p>
                  {method.billingDetails.address && (
                    <p className="text-xs text-muted-foreground">
                      {method.billingDetails.address.city},{" "}
                      {method.billingDetails.address.state}{" "}
                      {method.billingDetails.address.postalCode}
                    </p>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="mt-4 pt-4 border-t flex items-center justify-between">
                {!method.isDefault ? (
                  <button
                    onClick={() => handleSetDefault(method.id)}
                    disabled={isSettingDefault && selectedMethodId === method.id}
                    className="inline-flex items-center text-sm font-medium text-primary hover:underline disabled:opacity-50"
                  >
                    {isSettingDefault && selectedMethodId === method.id ? (
                      <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                    ) : (
                      <Star className="mr-1 h-3 w-3" />
                    )}
                    Set as Default
                  </button>
                ) : (
                  <span className="text-sm text-muted-foreground">
                    Primary payment method
                  </span>
                )}

                {confirmDelete === method.id ? (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleDelete(method.id)}
                      disabled={isDeleting}
                      className="text-sm font-medium text-red-600 hover:underline disabled:opacity-50"
                    >
                      {isDeleting ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        "Confirm"
                      )}
                    </button>
                    <button
                      onClick={() => setConfirmDelete(null)}
                      className="text-sm text-muted-foreground hover:underline"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmDelete(method.id)}
                    disabled={method.isDefault}
                    className={cn(
                      "inline-flex items-center text-sm font-medium hover:underline",
                      method.isDefault
                        ? "text-muted-foreground cursor-not-allowed"
                        : "text-red-600"
                    )}
                    title={
                      method.isDefault
                        ? "Cannot remove default payment method"
                        : "Remove payment method"
                    }
                  >
                    <Trash2 className="mr-1 h-3 w-3" />
                    Remove
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Payment Method Modal */}
      {showAddForm && (
        <AddPaymentMethodModal
          onClose={() => setShowAddForm(false)}
          onSuccess={() => {
            setShowAddForm(false);
            refetch();
          }}
        />
      )}
    </div>
  );
}

/**
 * Modal for adding a new payment method
 * Uses Stripe SetupIntent for secure card collection
 */
function AddPaymentMethodModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { open: notify } = useNotification();
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [isCreatingIntent, setIsCreatingIntent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Create setup intent
  const { mutate: createSetupIntent } = useCreate<SetupIntent>();

  // Create setup intent on mount
  useEffect(() => {
    if (!isStripeConfigured()) {
      setError("Stripe is not configured. Please set VITE_STRIPE_PUBLISHABLE_KEY.");
      return;
    }

    setIsCreatingIntent(true);
    createSetupIntent(
      {
        resource: "payment-methods/setup-intent",
        values: {},
      },
      {
        onSuccess: (data) => {
          setClientSecret(data.data.clientSecret);
          setIsCreatingIntent(false);
        },
        onError: (err) => {
          setError(err.message || "Failed to create setup intent");
          setIsCreatingIntent(false);
        },
      }
    );
  }, [createSetupIntent]);

  const stripePromise = getStripe();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg bg-background p-6 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Add Payment Method</h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
          >
            <XCircle className="h-5 w-5" />
          </button>
        </div>
        <p className="text-sm text-muted-foreground mb-6">
          Add a new card for automatic billing. Your card information is securely
          processed by Stripe.
        </p>

        {error && (
          <div className="mb-4 rounded-md bg-red-50 border border-red-200 p-3">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {isCreatingIntent ? (
          <div className="py-12 text-center">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground" />
            <p className="mt-4 text-sm text-muted-foreground">
              Preparing secure form...
            </p>
          </div>
        ) : clientSecret && stripePromise ? (
          <Elements
            stripe={stripePromise}
            options={{
              clientSecret,
              appearance: stripeElementsAppearance,
            }}
          >
            <StripeCardForm
              clientSecret={clientSecret}
              onClose={onClose}
              onSuccess={onSuccess}
              notify={notify}
            />
          </Elements>
        ) : !isStripeConfigured() ? (
          <div className="py-8 text-center">
            <AlertCircle className="mx-auto h-12 w-12 text-amber-500" />
            <p className="mt-4 text-sm text-muted-foreground">
              Stripe is not configured. Please set your publishable key.
            </p>
            <button
              onClick={onClose}
              className="mt-4 rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted"
            >
              Close
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Stripe Card Form Component
 * Must be wrapped in Elements provider
 */
function StripeCardForm({
  clientSecret,
  onClose,
  onSuccess,
  notify,
}: {
  clientSecret: string;
  onClose: () => void;
  onSuccess: () => void;
  notify?: (params: { type: "error" | "success" | "progress"; message: string; description?: string }) => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [cardError, setCardError] = useState<string | null>(null);
  const [cardComplete, setCardComplete] = useState(false);
  const [billingName, setBillingName] = useState("");
  const [setAsDefault, setSetAsDefault] = useState(true);

  // Mutation to persist payment method to our DB after Stripe confirmation
  const { mutate: savePaymentMethod } = useCreate();

  const handleCardChange = (event: StripeCardElementChangeEvent) => {
    setCardComplete(event.complete);
    setCardError(event.error?.message || null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      setCardError("Stripe has not loaded yet. Please try again.");
      return;
    }

    const cardElement = elements.getElement(CardElement);
    if (!cardElement) {
      setCardError("Card element not found.");
      return;
    }

    if (!billingName.trim()) {
      setCardError("Please enter the cardholder name.");
      return;
    }

    setIsProcessing(true);
    setCardError(null);

    try {
      // Confirm the SetupIntent with the actual clientSecret
      const { error, setupIntent } = await stripe.confirmCardSetup(
        clientSecret,
        {
          payment_method: {
            card: cardElement,
            billing_details: {
              name: billingName,
            },
          },
        }
      );

      if (error) {
        setCardError(error.message || "An error occurred while saving your card.");
        setIsProcessing(false);
        return;
      }

      if (setupIntent?.status === "succeeded" && setupIntent.payment_method) {
        // Now persist the payment method to our backend
        const stripePaymentMethodId = typeof setupIntent.payment_method === "string"
          ? setupIntent.payment_method
          : setupIntent.payment_method.id;

        savePaymentMethod(
          {
            resource: "payment-methods",
            values: {
              stripePaymentMethodId,
              setAsDefault,
            },
          },
          {
            onSuccess: () => {
              notify?.({
                type: "success",
                message: "Payment method added successfully",
              });
              onSuccess();
            },
            onError: (err) => {
              setCardError(`Card saved to Stripe but failed to save to account: ${err.message}`);
              setIsProcessing(false);
            },
          }
        );
      } else {
        setCardError("Setup did not complete. Please try again.");
        setIsProcessing(false);
      }
    } catch (err) {
      setCardError("An unexpected error occurred. Please try again.");
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Cardholder Name */}
      <div>
        <label
          htmlFor="billingName"
          className="block text-sm font-medium text-foreground mb-1.5"
        >
          Cardholder Name
        </label>
        <input
          id="billingName"
          type="text"
          value={billingName}
          onChange={(e) => setBillingName(e.target.value)}
          placeholder="John Doe"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          disabled={isProcessing}
        />
      </div>

      {/* Card Element */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-1.5">
          Card Details
        </label>
        <div className="rounded-md border border-input bg-background p-3">
          <CardElement
            options={cardElementOptions}
            onChange={handleCardChange}
          />
        </div>
      </div>

      {/* Set as Default Checkbox */}
      <div className="flex items-center gap-2">
        <input
          id="setAsDefault"
          type="checkbox"
          checked={setAsDefault}
          onChange={(e) => setSetAsDefault(e.target.checked)}
          className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
          disabled={isProcessing}
        />
        <label htmlFor="setAsDefault" className="text-sm text-muted-foreground">
          Set as default payment method
        </label>
      </div>

      {/* Error Message */}
      {cardError && (
        <div className="rounded-md bg-red-50 border border-red-200 p-3">
          <p className="text-sm text-red-700">{cardError}</p>
        </div>
      )}

      {/* Security Notice */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Lock className="h-3 w-3" />
        <span>Your card information is encrypted and secure</span>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={onClose}
          disabled={isProcessing}
          className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!stripe || isProcessing || !cardComplete}
          className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isProcessing ? "Processing..." : "Add Card"}
        </button>
      </div>
    </form>
  );
}

export default PaymentMethodsPage;
