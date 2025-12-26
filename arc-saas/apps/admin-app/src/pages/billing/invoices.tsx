import { useList, useCreate, useNotification } from "@refinedev/core";
import { useState } from "react";
import {
  Receipt,
  DollarSign,
  Calendar,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Download,
  CreditCard,
  Filter,
  Search,
  Eye,
  Loader2,
  ArrowRight,
  Building2,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Invoice {
  id: string;
  tenantId: string;
  subscriptionId?: string;
  invoiceNumber?: string;
  amount: number;
  currencyCode: string;
  status: "pending" | "paid" | "overdue" | "cancelled" | "failed" | "refunded";
  dueDate: string;
  startDate?: string;
  endDate?: string;
  paidAt?: string;
  invoiceFile?: string;
  createdOn?: string;
  modifiedOn?: string;
}

interface PaymentIntent {
  id: string;
  invoiceId: string;
  status: string;
  amount: number;
  currency: string;
  requiresAction: boolean;
  clientSecret?: string;
}

interface PayInvoiceResult {
  paymentIntent: PaymentIntent;
  clientSecret?: string;
  requiresAction: boolean;
  status: string;
}

const INVOICE_STATUS_CONFIG: Record<
  string,
  { label: string; color: string; bgColor: string; icon: typeof Clock }
> = {
  pending: {
    label: "Pending",
    color: "text-yellow-700",
    bgColor: "bg-yellow-100",
    icon: Clock,
  },
  paid: {
    label: "Paid",
    color: "text-green-700",
    bgColor: "bg-green-100",
    icon: CheckCircle,
  },
  overdue: {
    label: "Overdue",
    color: "text-red-700",
    bgColor: "bg-red-100",
    icon: AlertTriangle,
  },
  cancelled: {
    label: "Cancelled",
    color: "text-gray-500",
    bgColor: "bg-gray-100",
    icon: XCircle,
  },
  failed: {
    label: "Failed",
    color: "text-red-700",
    bgColor: "bg-red-100",
    icon: XCircle,
  },
  refunded: {
    label: "Refunded",
    color: "text-blue-700",
    bgColor: "bg-blue-100",
    icon: RefreshCw,
  },
};

export function InvoicesPage() {
  const { open: notify } = useNotification();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [paymentInProgress, setPaymentInProgress] = useState<string | null>(null);

  // Fetch invoices
  const {
    data: invoicesData,
    isLoading,
    refetch,
  } = useList<Invoice>({
    resource: "invoices",
    pagination: { pageSize: 50 },
    sorters: [{ field: "createdOn", order: "desc" }],
  });

  // Pay invoice mutation
  const { mutate: payInvoice } = useCreate<PayInvoiceResult>();

  // Retry payment mutation
  const { mutate: retryPayment } = useCreate<PayInvoiceResult>();

  const invoices = invoicesData?.data || [];

  // Filter invoices
  const filteredInvoices = invoices.filter((invoice) => {
    // Status filter
    if (statusFilter !== "all" && invoice.status !== statusFilter) {
      return false;
    }
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        invoice.id.toLowerCase().includes(query) ||
        invoice.invoiceNumber?.toLowerCase().includes(query) ||
        invoice.tenantId.toLowerCase().includes(query)
      );
    }
    return true;
  });

  // Calculate totals
  const totalPending = invoices
    .filter((i) => i.status === "pending")
    .reduce((sum, i) => sum + i.amount, 0);
  const totalPaid = invoices
    .filter((i) => i.status === "paid")
    .reduce((sum, i) => sum + i.amount, 0);
  const totalOverdue = invoices
    .filter((i) => i.status === "overdue")
    .reduce((sum, i) => sum + i.amount, 0);

  const handlePayInvoice = async (invoiceId: string, tenantId: string) => {
    setPaymentInProgress(invoiceId);

    payInvoice(
      {
        resource: `invoices/${invoiceId}/pay`,
        values: { tenantId },
      },
      {
        onSuccess: (data) => {
          const result = data.data;
          if (result.status === "succeeded") {
            notify?.({
              type: "success",
              message: "Payment successful",
              description: "The invoice has been paid.",
            });
          } else if (result.requiresAction) {
            notify?.({
              type: "progress",
              message: "Authentication required",
              description: "Customer needs to complete 3D Secure authentication.",
            });
            // In a real app, you would redirect to Stripe for 3DS
          } else {
            notify?.({
              type: "progress",
              message: "Payment processing",
              description: `Payment status: ${result.status}`,
            });
          }
          setPaymentInProgress(null);
          refetch();
        },
        onError: (error) => {
          notify?.({
            type: "error",
            message: "Payment failed",
            description: error.message,
          });
          setPaymentInProgress(null);
        },
      }
    );
  };

  const handleRetryPayment = async (invoiceId: string, tenantId: string) => {
    setPaymentInProgress(invoiceId);

    retryPayment(
      {
        resource: `invoices/${invoiceId}/retry-payment`,
        values: { tenantId },
      },
      {
        onSuccess: (data) => {
          const result = data.data;
          notify?.({
            type: result.status === "succeeded" ? "success" : "progress",
            message: result.status === "succeeded" ? "Payment successful" : "Retry initiated",
            description: `Payment status: ${result.status}`,
          });
          setPaymentInProgress(null);
          refetch();
        },
        onError: (error) => {
          notify?.({
            type: "error",
            message: "Retry failed",
            description: error.message,
          });
          setPaymentInProgress(null);
        },
      }
    );
  };

  const formatCurrency = (amount: number, currency: string = "USD") => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const isOverdue = (invoice: Invoice): boolean => {
    return (
      invoice.status === "pending" && new Date(invoice.dueDate) < new Date()
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Invoices</h1>
          <p className="text-muted-foreground">
            Manage and pay tenant invoices
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className="inline-flex items-center justify-center rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted"
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border bg-card p-6">
          <div className="flex items-center gap-2">
            <div className="h-10 w-10 rounded-lg bg-yellow-100 flex items-center justify-center">
              <Clock className="h-5 w-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Pending</p>
              <p className="text-2xl font-bold">{formatCurrency(totalPending)}</p>
            </div>
          </div>
        </div>
        <div className="rounded-lg border bg-card p-6">
          <div className="flex items-center gap-2">
            <div className="h-10 w-10 rounded-lg bg-green-100 flex items-center justify-center">
              <CheckCircle className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Paid</p>
              <p className="text-2xl font-bold">{formatCurrency(totalPaid)}</p>
            </div>
          </div>
        </div>
        <div className="rounded-lg border bg-card p-6">
          <div className="flex items-center gap-2">
            <div className="h-10 w-10 rounded-lg bg-red-100 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Overdue</p>
              <p className="text-2xl font-bold text-red-600">
                {formatCurrency(totalOverdue)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by invoice ID, number, or tenant..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-md border pl-10 pr-4 py-2 text-sm"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-md border px-3 py-2 text-sm"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="paid">Paid</option>
            <option value="overdue">Overdue</option>
            <option value="failed">Failed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {/* Invoices Table */}
      <div className="rounded-lg border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                  Invoice
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                  Tenant
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                  Due Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
                  </td>
                </tr>
              ) : filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                    No invoices found
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((invoice) => {
                  const statusConfig =
                    INVOICE_STATUS_CONFIG[
                      isOverdue(invoice) ? "overdue" : invoice.status
                    ] || INVOICE_STATUS_CONFIG.pending;
                  const StatusIcon = statusConfig.icon;
                  const canPay =
                    invoice.status === "pending" || invoice.status === "overdue";
                  const canRetry = invoice.status === "failed";

                  return (
                    <tr key={invoice.id} className="hover:bg-muted/50">
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-mono text-sm font-medium">
                            {invoice.invoiceNumber || `INV-${invoice.id.slice(0, 8)}`}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {invoice.id.slice(0, 8)}...
                          </p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{invoice.tenantId.slice(0, 8)}...</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <p className="font-medium">
                          {formatCurrency(invoice.amount, invoice.currencyCode)}
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full",
                            statusConfig.bgColor,
                            statusConfig.color
                          )}
                        >
                          <StatusIcon className="h-3 w-3" />
                          {isOverdue(invoice) ? "Overdue" : statusConfig.label}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Calendar className="h-4 w-4" />
                          {formatDate(invoice.dueDate)}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          {canPay && (
                            <button
                              onClick={() =>
                                handlePayInvoice(invoice.id, invoice.tenantId)
                              }
                              disabled={paymentInProgress === invoice.id}
                              className="inline-flex items-center rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                            >
                              {paymentInProgress === invoice.id ? (
                                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                              ) : (
                                <CreditCard className="mr-1 h-3 w-3" />
                              )}
                              Pay
                            </button>
                          )}
                          {canRetry && (
                            <button
                              onClick={() =>
                                handleRetryPayment(invoice.id, invoice.tenantId)
                              }
                              disabled={paymentInProgress === invoice.id}
                              className="inline-flex items-center rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-50"
                            >
                              {paymentInProgress === invoice.id ? (
                                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                              ) : (
                                <RefreshCw className="mr-1 h-3 w-3" />
                              )}
                              Retry
                            </button>
                          )}
                          <button
                            onClick={() => setSelectedInvoice(invoice)}
                            className="inline-flex items-center rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted"
                          >
                            <Eye className="mr-1 h-3 w-3" />
                            View
                          </button>
                          {invoice.invoiceFile && (
                            <button className="inline-flex items-center rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted">
                              <Download className="mr-1 h-3 w-3" />
                              PDF
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Invoice Detail Modal */}
      {selectedInvoice && (
        <InvoiceDetailModal
          invoice={selectedInvoice}
          onClose={() => setSelectedInvoice(null)}
          onPay={() => {
            handlePayInvoice(selectedInvoice.id, selectedInvoice.tenantId);
            setSelectedInvoice(null);
          }}
        />
      )}
    </div>
  );
}

/**
 * Invoice detail modal
 */
function InvoiceDetailModal({
  invoice,
  onClose,
  onPay,
}: {
  invoice: Invoice;
  onClose: () => void;
  onPay: () => void;
}) {
  const formatCurrency = (amount: number, currency: string = "USD") => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const canPay = invoice.status === "pending" || invoice.status === "overdue";
  const isOverdue =
    invoice.status === "pending" && new Date(invoice.dueDate) < new Date();
  const statusConfig =
    INVOICE_STATUS_CONFIG[isOverdue ? "overdue" : invoice.status];
  const StatusIcon = statusConfig?.icon || Clock;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-lg rounded-lg bg-background p-6 shadow-lg">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Invoice Details</h2>
          <span
            className={cn(
              "inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full",
              statusConfig?.bgColor,
              statusConfig?.color
            )}
          >
            <StatusIcon className="h-3 w-3" />
            {isOverdue ? "Overdue" : statusConfig?.label}
          </span>
        </div>

        <div className="mt-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Invoice Number</p>
              <p className="font-mono font-medium">
                {invoice.invoiceNumber || `INV-${invoice.id.slice(0, 8)}`}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Amount</p>
              <p className="text-xl font-bold">
                {formatCurrency(invoice.amount, invoice.currencyCode)}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Due Date</p>
              <p className={cn("font-medium", isOverdue && "text-red-600")}>
                {formatDate(invoice.dueDate)}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Paid At</p>
              <p className="font-medium">
                {invoice.paidAt ? formatDate(invoice.paidAt) : "-"}
              </p>
            </div>
          </div>

          {invoice.startDate && invoice.endDate && (
            <div>
              <p className="text-sm text-muted-foreground">Billing Period</p>
              <p className="font-medium">
                {formatDate(invoice.startDate)} - {formatDate(invoice.endDate)}
              </p>
            </div>
          )}

          <div>
            <p className="text-sm text-muted-foreground">Invoice ID</p>
            <p className="font-mono text-sm">{invoice.id}</p>
          </div>

          <div>
            <p className="text-sm text-muted-foreground">Tenant ID</p>
            <p className="font-mono text-sm">{invoice.tenantId}</p>
          </div>

          {invoice.subscriptionId && (
            <div>
              <p className="text-sm text-muted-foreground">Subscription ID</p>
              <p className="font-mono text-sm">{invoice.subscriptionId}</p>
            </div>
          )}
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            Close
          </button>
          {canPay && (
            <button
              onClick={onPay}
              className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              <CreditCard className="mr-2 h-4 w-4" />
              Pay Invoice
              <ArrowRight className="ml-2 h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default InvoicesPage;
