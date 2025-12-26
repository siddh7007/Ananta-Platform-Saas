/**
 * Invoice History Table Component
 *
 * Displays paginated invoice history with status badges and PDF download.
 * Responsive: table on desktop, stacked cards on mobile.
 * Requires engineer+ role to view (enforced at page level).
 */

import { useMemo } from 'react';
import {
  FileText,
  Download,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { InvoiceListSkeleton } from '@/components/shared';
import { ResponsiveTable, type ResponsiveTableColumn } from '@/components/ui/ResponsiveTable';
import type { Invoice, InvoiceStatus } from '@/types/subscription';
import { formatCurrency } from '@/types/subscription';

export interface InvoiceHistoryTableProps {
  invoices: Invoice[];
  total: number;
  page: number;
  limit: number;
  isLoading?: boolean;
  onPageChange?: (page: number) => void;
  onDownloadPdf?: (invoice: Invoice) => void;
  onViewInvoice?: (invoice: Invoice) => void;
}

const INVOICE_STATUS_CONFIG: Record<
  InvoiceStatus,
  { label: string; color: string }
> = {
  draft: { label: 'Draft', color: 'bg-gray-100 text-gray-700' },
  open: { label: 'Open', color: 'bg-yellow-100 text-yellow-700' },
  paid: { label: 'Paid', color: 'bg-green-100 text-green-700' },
  void: { label: 'Void', color: 'bg-gray-100 text-gray-700' },
  uncollectible: { label: 'Uncollectible', color: 'bg-red-100 text-red-700' },
};

export function InvoiceHistoryTable({
  invoices,
  total,
  page,
  limit,
  isLoading = false,
  onPageChange,
  onDownloadPdf,
  onViewInvoice,
}: InvoiceHistoryTableProps) {
  const totalPages = Math.ceil(total / limit);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  // Define columns for ResponsiveTable
  const columns: ResponsiveTableColumn<Invoice>[] = useMemo(() => [
    {
      key: 'number',
      header: 'Invoice',
      isPrimary: true,
      render: (invoice) => (
        <div>
          <div className="font-medium">{invoice.number}</div>
          <div className="text-xs text-muted-foreground">
            {formatDate(invoice.periodStart)} - {formatDate(invoice.periodEnd)}
          </div>
        </div>
      ),
    },
    {
      key: 'createdAt',
      header: 'Date',
      showOnMobile: true,
      render: (invoice) => (
        <span className="text-sm">{formatDate(invoice.createdAt)}</span>
      ),
    },
    {
      key: 'amount',
      header: 'Amount',
      showOnMobile: true,
      render: (invoice) => (
        <span className="font-medium">
          {formatCurrency(invoice.amount, invoice.currency)}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      showOnMobile: true,
      render: (invoice) => {
        const statusConfig = INVOICE_STATUS_CONFIG[invoice.status];
        return (
          <span
            className={cn(
              'text-xs px-2 py-1 rounded-full font-medium',
              statusConfig.color
            )}
          >
            {statusConfig.label}
          </span>
        );
      },
    },
  ], []);

  // Render row actions
  const renderActions = (invoice: Invoice) => (
    <div className="flex items-center justify-end gap-2">
      {invoice.pdfUrl && onDownloadPdf && (
        <button
          onClick={() => onDownloadPdf(invoice)}
          className="p-1.5 hover:bg-muted rounded-md"
          title="Download PDF"
        >
          <Download className="h-4 w-4" />
        </button>
      )}
      {invoice.hostedUrl && onViewInvoice && (
        <button
          onClick={() => onViewInvoice(invoice)}
          className="p-1.5 hover:bg-muted rounded-md"
          title="View Invoice"
        >
          <ExternalLink className="h-4 w-4" />
        </button>
      )}
    </div>
  );

  // Empty state
  if (!isLoading && invoices.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-8 text-center">
        <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
        <h3 className="font-medium mb-1">No invoices yet</h3>
        <p className="text-sm text-muted-foreground">
          Invoices will appear here after your first billing period.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card">
      {/* Header */}
      <div className="p-4 border-b">
        <h3 className="font-semibold flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Invoice History
        </h3>
      </div>

      {/* Responsive Table */}
      <ResponsiveTable
        data={invoices}
        columns={columns}
        getRowKey={(invoice) => invoice.id}
        isLoading={isLoading}
        loadingComponent={<InvoiceListSkeleton rows={limit} />}
        renderActions={(onDownloadPdf || onViewInvoice) ? renderActions : undefined}
        hoverable
      />

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="p-4 border-t flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-sm text-muted-foreground">
            Showing {(page - 1) * limit + 1}-{Math.min(page * limit, total)} of{' '}
            {total}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onPageChange?.(page - 1)}
              disabled={page <= 1}
              className="p-1 rounded-md hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <span className="text-sm">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => onPageChange?.(page + 1)}
              disabled={page >= totalPages}
              className="p-1 rounded-md hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default InvoiceHistoryTable;
