/**
 * Invoice History Page
 *
 * Full invoice listing with filtering and pagination.
 * View-only for all roles (route access enforced via navigation rules).
 */

import { useEffect, useState } from 'react';
import { ArrowLeft, Filter } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { InvoiceHistoryTable } from '@/components/billing';
import { getInvoices } from '@/services/billing.service';
import type { Invoice } from '@/types/subscription';

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'All Statuses' },
  { value: 'paid', label: 'Paid' },
  { value: 'open', label: 'Open' },
  { value: 'draft', label: 'Draft' },
  { value: 'void', label: 'Void' },
  { value: 'uncollectible', label: 'Uncollectible' },
];

export default function InvoicesPage() {
  const navigate = useNavigate();

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const limit = 10;

  // Load invoices
  useEffect(() => {
    async function loadInvoices() {
      setIsLoading(true);
      setError(null);

      try {
        const data = await getInvoices({
          page,
          limit,
          status: statusFilter || undefined,
        });
        setInvoices(data.data);
        setTotal(data.total);
      } catch (err) {
        console.error('Failed to load invoices:', err);
        setError('Failed to load invoices');
      } finally {
        setIsLoading(false);
      }
    }

    loadInvoices();
  }, [page, statusFilter]);

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
  };

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setStatusFilter(e.target.value);
    setPage(1); // Reset to first page when filter changes
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
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/billing')}
          className="p-2 hover:bg-muted rounded-md"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold">Invoice History</h1>
          <p className="text-muted-foreground">
            View and download your past invoices.
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <select
            value={statusFilter}
            onChange={handleStatusChange}
            className="px-3 py-2 border rounded-md bg-background text-sm"
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {/* Invoice Table */}
      <InvoiceHistoryTable
        invoices={invoices}
        total={total}
        page={page}
        limit={limit}
        isLoading={isLoading}
        onPageChange={handlePageChange}
        onDownloadPdf={handleDownloadPdf}
        onViewInvoice={handleViewInvoice}
      />
    </div>
  );
}
