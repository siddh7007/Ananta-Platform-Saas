import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useList, useDelete } from '@refinedev/core';
import {
  FileText,
  Plus,
  Search,
  Filter,
  Eye,
  Trash2,
  Download,
  RefreshCw,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  PlayCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { hasMinimumRole, AppRole } from '@/config/auth';
import { BomListSkeleton, EmptyState } from '@/components/shared';
import { ResponsiveTable, type ResponsiveTableColumn } from '@/components/ui/ResponsiveTable';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { getBomStatusType, getBomStatusLabel } from '@/lib/bom-status';
import type { Bom, BomStatus } from '@/types/bom';

// Valid status filter options (matching BomStatus type)
const STATUS_FILTER_OPTIONS: Array<{ value: BomStatus | ''; label: string }> = [
  { value: '', label: 'All Status' },
  { value: 'pending', label: 'Pending' },
  { value: 'analyzing', label: 'Analyzing' },
  { value: 'processing', label: 'Processing' },
  { value: 'enriching', label: 'Enriching' },
  { value: 'mapping_pending', label: 'Mapping Pending' },
  { value: 'completed', label: 'Completed' },
  { value: 'failed', label: 'Failed' },
  { value: 'cancelled', label: 'Cancelled' },
];

const PAGE_SIZE = 20;

export function BomListPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<BomStatus | ''>('');
  const [selectedBoms, setSelectedBoms] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const canCreate = hasMinimumRole((user?.role as AppRole) || 'analyst', 'engineer');
  const canDelete = hasMinimumRole((user?.role as AppRole) || 'analyst', 'admin');

  // Fetch BOMs from CNS service
  const { data, isLoading, isError, refetch } = useList<Bom>({
    resource: 'boms',
    filters: [
      ...(searchQuery ? [{ field: 'name', operator: 'contains' as const, value: searchQuery }] : []),
      ...(statusFilter ? [{ field: 'status', operator: 'eq' as const, value: statusFilter }] : []),
    ],
    sorters: [{ field: 'createdAt', order: 'desc' }],
    pagination: { current: currentPage, pageSize: PAGE_SIZE },
    meta: {
      dataProviderName: 'cns',
    },
  });

  const { mutateAsync: deleteBomAsync, isLoading: isDeleting } = useDelete();

  const boms = data?.data || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const handleDelete = useCallback(async (bomId: string) => {
    if (!window.confirm('Are you sure you want to delete this BOM?')) return;

    setDeleteError(null);
    try {
      await deleteBomAsync({
        resource: 'boms',
        id: bomId,
        dataProviderName: 'cns',
      });
      // Refetch after successful delete
      await refetch();
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : 'Failed to delete BOM');
    }
  }, [deleteBomAsync, refetch]);

  const handleBulkDelete = useCallback(async () => {
    if (selectedBoms.length === 0) return;
    if (!window.confirm(`Delete ${selectedBoms.length} BOMs? This action cannot be undone.`)) return;

    setDeleteError(null);
    try {
      // Delete sequentially to handle errors better
      for (const id of selectedBoms) {
        await deleteBomAsync({
          resource: 'boms',
          id,
          dataProviderName: 'cns',
        });
      }
      setSelectedBoms([]);
      // Refetch after all deletions
      await refetch();
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : 'Failed to delete some BOMs');
      // Refetch to show current state
      await refetch();
    }
  }, [selectedBoms, deleteBomAsync, refetch]);

  // Helper to calculate enrichment progress
  const getEnrichmentProgress = useCallback((bom: Bom) => {
    if (bom.lineCount === 0) return 0;
    return Math.round((bom.enrichedCount / bom.lineCount) * 100);
  }, []);

  // Pagination handlers
  const handlePreviousPage = useCallback(() => {
    setCurrentPage((prev) => Math.max(1, prev - 1));
  }, []);

  const handleNextPage = useCallback(() => {
    setCurrentPage((prev) => Math.min(totalPages, prev + 1));
  }, [totalPages]);

  // Reset to page 1 when filters change
  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
    setCurrentPage(1);
  }, []);

  const handleStatusFilterChange = useCallback((value: BomStatus | '') => {
    setStatusFilter(value);
    setCurrentPage(1);
  }, []);

  // Define columns for ResponsiveTable
  const columns: ResponsiveTableColumn<Bom>[] = useMemo(() => [
    {
      key: 'name',
      header: 'Name',
      isPrimary: true,
      render: (bom) => (
        <div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/boms/${bom.id}`);
            }}
            className="font-medium text-foreground hover:text-primary hover:underline text-left"
          >
            {bom.name}
          </button>
          {bom.description && (
            <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">
              {bom.description}
            </p>
          )}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (bom) => (
        <StatusBadge
          status={getBomStatusType(bom.status)}
          customLabel={getBomStatusLabel(bom.status)}
          size="sm"
        />
      ),
    },
    {
      key: 'lineCount',
      header: 'Lines',
      showOnMobile: true,
      render: (bom) => (
        <span className="text-sm text-muted-foreground">
          {bom.lineCount.toLocaleString()}
        </span>
      ),
    },
    {
      key: 'enrichment',
      header: 'Enrichment',
      showOnMobile: true,
      render: (bom) => {
        const progress = getEnrichmentProgress(bom);
        return (
          <div className="flex items-center gap-2">
            <div
              className="h-2 w-20 overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-valuenow={progress}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`Enrichment progress: ${progress}%`}
            >
              <div
                className={cn(
                  'h-full transition-all',
                  progress === 100
                    ? 'bg-green-500'
                    : progress > 50
                      ? 'bg-amber-500'
                      : 'bg-blue-500'
                )}
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-xs text-muted-foreground">{progress}%</span>
          </div>
        );
      },
    },
    {
      key: 'workflow',
      header: 'Workflow',
      render: (bom) => bom.temporalWorkflowId ? (
        <a
          href={`http://localhost:27021/namespaces/default/workflows/${bom.temporalWorkflowId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-sm text-blue-600 hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          <PlayCircle className="h-3 w-3" />
          <span className="truncate max-w-[100px]">{bom.temporalWorkflowId.split('-').slice(-1)[0]}</span>
          <ExternalLink className="h-3 w-3" />
        </a>
      ) : (
        <span className="text-xs text-muted-foreground">-</span>
      ),
    },
    {
      key: 'createdAt',
      header: 'Created',
      showOnMobile: true,
      render: (bom) => (
        <span className="text-sm text-muted-foreground">
          {new Date(bom.createdAt).toLocaleDateString()}
        </span>
      ),
    },
  ], [navigate, getEnrichmentProgress]);

  // Render row actions
  const renderActions = useCallback((bom: Bom) => (
    <div className="flex items-center justify-end gap-1">
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={() => navigate(`/boms/${bom.id}`)}
        aria-label="View BOM details"
      >
        <Eye className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={() => {
          // TODO: Implement export
        }}
        aria-label="Export BOM"
      >
        <Download className="h-4 w-4" />
      </Button>
      {canDelete && (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 hover:bg-red-100 hover:text-red-600"
          onClick={() => handleDelete(bom.id)}
          disabled={isDeleting}
          aria-label="Delete BOM"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      )}
    </div>
  ), [canDelete, navigate, handleDelete, isDeleting]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Bills of Materials</h1>
          <p className="text-sm text-muted-foreground">
            Manage and enrich your component BOMs
          </p>
        </div>
        {canCreate && (
          <Button onClick={() => navigate('/boms/create')}>
            <Plus className="h-4 w-4 mr-2" />
            Upload BOM
          </Button>
        )}
      </div>

      {/* Error Alert */}
      {deleteError && (
        <div
          className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-red-800"
          role="alert"
        >
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <div className="flex-1">
            <p className="font-medium">Error</p>
            <p className="text-sm">{deleteError}</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setDeleteError(null)}
            className="text-red-600 hover:bg-red-100"
          >
            Dismiss
          </Button>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col gap-4 rounded-lg border bg-card p-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            placeholder="Search BOMs..."
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="w-full rounded-md border bg-background py-2 pl-9 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            aria-label="Search BOMs by name"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <select
            value={statusFilter}
            onChange={(e) => handleStatusFilterChange(e.target.value as BomStatus | '')}
            className="rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            aria-label="Filter by status"
          >
            {STATUS_FILTER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <Button
            variant="outline"
            size="icon"
            onClick={() => refetch()}
            aria-label="Refresh list"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Bulk Actions */}
      {selectedBoms.length > 0 && canDelete && (
        <div
          className="flex items-center gap-4 rounded-lg border border-amber-200 bg-amber-50 p-3"
          role="status"
          aria-live="polite"
        >
          <span className="text-sm font-medium">
            {selectedBoms.length} selected
          </span>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleBulkDelete}
            disabled={isDeleting}
          >
            <Trash2 className="h-4 w-4 mr-1" />
            {isDeleting ? 'Deleting...' : 'Delete'}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelectedBoms([])}
          >
            Clear selection
          </Button>
        </div>
      )}

      {/* Table - Responsive */}
      <div className="rounded-lg border bg-card">
        {isError ? (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <AlertCircle className="h-12 w-12 text-red-500" aria-hidden="true" />
            <h3 className="mt-4 text-lg font-medium">Failed to load BOMs</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              There was an error loading your BOMs. Please try again.
            </p>
            <Button onClick={() => refetch()} className="mt-4">
              Retry
            </Button>
          </div>
        ) : (
          <ResponsiveTable
            data={boms}
            columns={columns}
            getRowKey={(bom) => bom.id}
            isLoading={isLoading}
            loadingComponent={<BomListSkeleton rows={5} />}
            emptyMessage="No BOMs found"
            emptyComponent={
              <EmptyState
                icon={FileText}
                title="No BOMs found"
                description={
                  searchQuery || statusFilter
                    ? 'Try adjusting your search or filters.'
                    : 'Upload your first BOM to get started with component analysis.'
                }
                size="md"
                action={
                  canCreate && !searchQuery && !statusFilter
                    ? {
                        label: 'Upload BOM',
                        onClick: () => navigate('/boms/create'),
                        variant: 'default',
                      }
                    : undefined
                }
              />
            }
            selectable
            selectedKeys={selectedBoms}
            onSelectionChange={setSelectedBoms}
            onRowClick={(bom) => navigate(`/boms/${bom.id}`)}
            renderActions={renderActions}
            ariaLabel="Bills of Materials"
          />
        )}
      </div>

      {/* Pagination */}
      {boms.length > 0 && (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {((currentPage - 1) * PAGE_SIZE) + 1} to {Math.min(currentPage * PAGE_SIZE, total)} of {total} BOMs
          </p>
          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePreviousPage}
                disabled={currentPage === 1}
                aria-label="Previous page"
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Previous
              </Button>
              <span className="px-3 text-sm text-muted-foreground">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={handleNextPage}
                disabled={currentPage === totalPages}
                aria-label="Next page"
              >
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default BomListPage;
