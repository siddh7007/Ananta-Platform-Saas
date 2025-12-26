/**
 * Billing Dashboard Page
 *
 * Main billing overview showing subscription status, usage, and recent invoices.
 * Role-based actions:
 * - All users: View subscription and usage
 * - Owner: Manage Billing and Change Plan buttons
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, CheckCircle, FileText } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { SubscriptionCard, UsageMetricsCard, InvoiceHistoryTable } from '@/components/billing';
import {
  getCurrentSubscription,
  getUsageMetrics,
  getInvoices,
  openBillingPortal,
  checkStripeReturnStatus,
  clearStripeReturnStatus,
} from '@/services/billing.service';
import type { Subscription, UsageMetrics, Invoice } from '@/types/subscription';

export default function BillingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [metrics, setMetrics] = useState<UsageMetrics | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stripeStatus, setStripeStatus] = useState<'success' | 'cancelled' | null>(null);

  // Check for Stripe return status
  useEffect(() => {
    const status = checkStripeReturnStatus();
    if (status) {
      setStripeStatus(status);
      clearStripeReturnStatus();
      // Auto-clear success message after 5 seconds
      if (status === 'success') {
        setTimeout(() => setStripeStatus(null), 5000);
      }
    }
  }, []);

  // Load data
  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      setError(null);

      try {
        const [subscriptionData, metricsData, invoicesData] = await Promise.all([
          getCurrentSubscription().catch(() => null),
          getUsageMetrics().catch(() => null),
          getInvoices({ limit: 3 }).catch(() => ({ data: [], total: 0 })),
        ]);

        setSubscription(subscriptionData);
        setMetrics(metricsData);
        setInvoices(invoicesData.data);
      } catch (err) {
        console.error('Failed to load billing data:', err);
        setError('Failed to load billing information');
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, []);

  const handleManageBilling = async () => {
    try {
      const result = await openBillingPortal();
      if (result.success && result.url) {
        window.location.href = result.url;
        return;
      }
      if (!result.success && result.error) {
        throw result.error;
      }
      throw new Error('Missing billing portal URL');
    } catch (err) {
      console.error('Failed to open billing portal:', err);
      setError('Failed to open billing portal. Please try again.');
    }
  };

  const handleChangePlan = () => {
    navigate('/billing/plans');
  };

  const handleViewAllInvoices = () => {
    navigate('/billing/invoices');
  };

  const handleDownloadPdf = (invoice: Invoice) => {
    if (invoice.pdfUrl) {
      window.open(invoice.pdfUrl, '_blank');
    }
  };

  const handleViewInvoice = (invoice: Invoice) => {
    if (invoice.hostedUrl) {
      window.open(invoice.hostedUrl, '_blank');
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Billing & Subscription</h1>
        <p className="text-muted-foreground">
          Manage your subscription, view usage, and download invoices.
        </p>
      </div>

      {/* Stripe return status banners */}
      {stripeStatus === 'success' && (
        <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-lg">
          <CheckCircle className="h-5 w-5 text-green-600" />
          <div>
            <p className="font-medium text-green-800">Changes saved successfully</p>
            <p className="text-sm text-green-700">
              Your billing information has been updated.
            </p>
          </div>
        </div>
      )}

      {stripeStatus === 'cancelled' && (
        <div className="flex items-center gap-3 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <AlertCircle className="h-5 w-5 text-yellow-600" />
          <div>
            <p className="font-medium text-yellow-800">Changes not saved</p>
            <p className="text-sm text-yellow-700">
              You cancelled the billing update. No changes were made.
            </p>
          </div>
          <button
            onClick={() => setStripeStatus(null)}
            className="ml-auto text-yellow-700 hover:text-yellow-900"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle className="h-5 w-5 text-red-600" />
          <p className="text-red-700">{error}</p>
          <button
            onClick={() => setError(null)}
            className="ml-auto text-red-700 hover:text-red-900"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main content grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Subscription Card */}
        <SubscriptionCard
          subscription={subscription}
          userRole={user?.role || 'analyst'}
          isLoading={isLoading}
          onManageBilling={handleManageBilling}
          onChangePlan={handleChangePlan}
        />

        {/* Usage Metrics */}
        <UsageMetricsCard metrics={metrics} isLoading={isLoading} />
      </div>

      {/* Recent Invoices */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Recent Invoices
          </h2>
          {invoices.length > 0 && (
            <button
              onClick={handleViewAllInvoices}
              className="text-sm text-primary hover:underline"
            >
              View All Invoices
            </button>
          )}
        </div>

        <InvoiceHistoryTable
          invoices={invoices}
          total={invoices.length}
          page={1}
          limit={3}
          isLoading={isLoading}
          onDownloadPdf={handleDownloadPdf}
          onViewInvoice={handleViewInvoice}
        />
      </div>
    </div>
  );
}
