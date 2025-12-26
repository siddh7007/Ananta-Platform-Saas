/**
 * Project BOM List Page
 *
 * Lists BOMs within a specific project context.
 * Similar to BomListPage but filtered by project ID.
 */

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/useToast';
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
  ArrowLeft,
  FolderKanban,
  Loader2,
  Upload,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { hasMinimumRole, AppRole } from '@/config/auth';
import { useProject } from '@/hooks/useProjects';
import { cnsApi } from '@/lib/axios';
import { BomListSkeleton } from '@/components/shared';
import { ResponsiveTable, type ResponsiveTableColumn } from '@/components/ui/ResponsiveTable';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { DeleteBomDialog, type BomInfo } from '@/components/bom/DeleteBomDialog';
import { getBomStatusType, getBomStatusLabel } from '@/lib/bom-status';
import { deleteBom } from '@/services/bom.service';
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

interface BomListResponse {
  items: Bom[];
  total: number;
}

export function ProjectBomListPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<BomStatus | ''>('');
  const [selectedBoms, setSelectedBoms] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);

  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [bomToDelete, setBomToDelete] = useState<BomInfo | null>(null);

  const canCreate = hasMinimumRole((user?.role as AppRole) || 'analyst', 'engineer');
  const canDelete = hasMinimumRole((user?.role as AppRole) || 'analyst', 'admin');

  // Fetch project details
  const { data: project, isLoading: isLoadingProject, error: projectError } = useProject(projectId || '');

  // Store project context in localStorage for BOM upload navigation
  useEffect(() => {
    if (project && projectId) {
      localStorage.setItem('current_project_id', projectId);
      localStorage.setItem('current_project_name', project.name);
    }
  }, [project, projectId]);

  // Fetch BOMs for this project from CNS service
  const { data, isLoading, isError, refetch } = useQuery<BomListResponse>({
    queryKey: ['project-boms', projectId, searchQuery, statusFilter, currentPage],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('project_id', projectId || '');
      params.set('page', String(currentPage));
      params.set('page_size', String(PAGE_SIZE));

      if (searchQuery) {
        params.set('search', searchQuery);
      }
      if (statusFilter) {
        params.set('status', statusFilter);
      }

      const response = await cnsApi.get<BomListResponse>(`/boms?${params}`);
      // cnsApi axios interceptor auto-transforms snake_case -> camelCase
      // (component_count -> lineCount, enriched_count -> enrichedCount, etc.)
      const apiData = response.data as unknown as { items?: Bom[]; total?: number; data?: Bom[] };
      const items = apiData.items || apiData.data || [];

      return {
        items,
        total: apiData.total || items.length,
      };
    },
    enabled: !!projectId,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  const boms = data?.items || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: deleteBom,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-boms', projectId] });
      toast({
        title: 'BOM deleted',
        description: 'The BOM has been permanently deleted.',
      });
      setSelectedBoms((prev) => prev.filter((id) => id !== bomToDelete?.id));
      setBomToDelete(null);
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to delete BOM',
        description: error.message || 'An error occurred while deleting the BOM.',
        variant: 'destructive',
      });
    },
  });

  // Open delete dialog for a BOM
  const handleDeleteClick = useCallback((bom: Bom) => {
    setBomToDelete({
      id: bom.id,
      name: bom.name,
      lineItemCount: bom.lineCount,
      createdAt: bom.createdAt,
    });
    setDeleteDialogOpen(true);
  }, []);

  // Confirm single delete
  const handleDeleteConfirm = useCallback(async (bomId: string) => {
    await deleteMutation.mutateAsync(bomId);
  }, [deleteMutation]);

  // Bulk delete handler
  const handleBulkDelete = useCallback(async () => {
    if (selectedBoms.length === 0) return;

    try {
      // Delete all selected BOMs sequentially
      for (const bomId of selectedBoms) {
        await deleteBom(bomId);
      }
      queryClient.invalidateQueries({ queryKey: ['project-boms', projectId] });
      toast({
        title: 'BOMs deleted',
        description: `Successfully deleted ${selectedBoms.length} BOM(s).`,
      });
      setSelectedBoms([]);
    } catch (error) {
      toast({
        title: 'Failed to delete BOMs',
        description: error instanceof Error ? error.message : 'An error occurred.',
        variant: 'destructive',
      });
    }
  }, [selectedBoms, projectId, queryClient, toast]);

  // Helper to calculate enrichment progress
  const getEnrichmentProgress = useCallback((bom: Bom) => {
    const lineCount = bom.lineCount ?? 0;
    const enrichedCount = bom.enrichedCount ?? 0;
    if (lineCount === 0) return 0;
    return Math.round((enrichedCount / lineCount) * 100);
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
          {(bom.lineCount ?? 0).toLocaleString()}
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
          onClick={(e) => {
            e.stopPropagation();
            handleDeleteClick(bom);
          }}
          aria-label="Delete BOM"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      )}
    </div>
  ), [canDelete, navigate, handleDeleteClick]);

  // Loading state for project
  if (isLoadingProject) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">Loading project...</span>
      </div>
    );
  }

  // Project error or not found
  if (projectError || !project) {
    return (
      <div className="space-y-6">
        <button
          onClick={() => navigate('/projects')}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Projects
        </button>

        <div className="rounded-lg border bg-card p-12 text-center">
          <AlertCircle className="mx-auto h-16 w-16 text-destructive opacity-50" />
          <h3 className="mt-4 text-lg font-semibold">Project Not Found</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            The project you're looking for doesn't exist or you don't have access.
          </p>
          <Button
            onClick={() => navigate('/projects')}
            className="mt-6"
          >
            Browse Projects
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb / Back Navigation */}
      <div className="flex items-center gap-2 text-sm">
        <Link
          to="/projects"
          className="text-muted-foreground hover:text-foreground"
        >
          Projects
        </Link>
        <span className="text-muted-foreground">/</span>
        <Link
          to={`/projects/${projectId}`}
          className="text-muted-foreground hover:text-foreground"
        >
          {project.name}
        </Link>
        <span className="text-muted-foreground">/</span>
        <span className="font-medium">BOMs</span>
      </div>

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
            <FolderKanban className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{project.name} BOMs</h1>
            <p className="text-sm text-muted-foreground">
              Manage BOMs in this project
            </p>
          </div>
        </div>
        {canCreate && (
          <Button onClick={() => navigate(`/projects/${projectId}/bom/upload`)}>
            <Upload className="h-4 w-4 mr-2" />
            Upload BOM
          </Button>
        )}
      </div>

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
          >
            <Trash2 className="h-4 w-4 mr-1" />
            Delete
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
              <div className="flex flex-col items-center justify-center p-12 text-center">
                <FileText className="h-12 w-12 text-muted-foreground/50" aria-hidden="true" />
                <h3 className="mt-4 text-lg font-medium">No BOMs in this project</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {searchQuery || statusFilter
                    ? 'Try adjusting your search or filters.'
                    : 'Upload your first BOM to this project.'}
                </p>
                {canCreate && !searchQuery && !statusFilter && (
                  <Button
                    onClick={() => navigate(`/projects/${projectId}/bom/upload`)}
                    className="mt-4"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Upload BOM
                  </Button>
                )}
              </div>
            }
            selectable
            selectedKeys={selectedBoms}
            onSelectionChange={setSelectedBoms}
            onRowClick={(bom) => navigate(`/boms/${bom.id}`)}
            renderActions={renderActions}
            ariaLabel={`BOMs in project ${project.name}`}
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

      {/* Delete Confirmation Dialog */}
      <DeleteBomDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        bom={bomToDelete}
        onConfirm={handleDeleteConfirm}
        isDeleting={deleteMutation.isPending}
      />
    </div>
  );
}

export default ProjectBomListPage;
