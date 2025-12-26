import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ChevronDown, Layers, Check, Plus, Search, AlertCircle, RefreshCw } from 'lucide-react';
import { useWorkspaceContext } from '@/contexts/WorkspaceContext';
import { cn } from '@/lib/utils';

interface WorkspaceSelectorProps {
  /** Variant: 'header' for compact header style, 'sidebar' for full-width sidebar style */
  variant?: 'header' | 'sidebar';
}

/**
 * Workspace selector dropdown component
 * Shows current workspace and allows switching between available workspaces
 * within the current organization/tenant.
 *
 * Architecture:
 * - TenantSelector: switches organizations (Control Plane)
 * - WorkspaceSelector: switches workspaces within an org (App Plane/CNS)
 */
export function WorkspaceSelector({ variant = 'header' }: WorkspaceSelectorProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    workspaces,
    currentWorkspace,
    selectWorkspace,
    refreshWorkspaces,
    isLoading,
    error,
    hasMultipleWorkspaces,
    clearError
  } = useWorkspaceContext();
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const isSidebar = variant === 'sidebar';

  // Filter workspaces based on search query
  const filteredWorkspaces = workspaces.filter(
    (workspace) =>
      workspace.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      workspace.slug.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelect = (workspaceId: string) => {
    selectWorkspace(workspaceId);
    setIsOpen(false);
    setSearchQuery('');

    // Always navigate to dashboard when workspace changes to reload workspace-specific data
    navigate('/');
  };

  const handleRetry = async () => {
    setIsRefreshing(true);
    clearError();
    try {
      await refreshWorkspaces();
    } finally {
      setIsRefreshing(false);
    }
  };

  // Loading skeleton
  if (isLoading) {
    return (
      <div className={cn(
        'flex items-center gap-2 rounded-md bg-muted/50 animate-pulse',
        isSidebar ? 'w-full px-3 py-2.5' : 'border px-3 py-1.5'
      )}>
        <div className="h-4 w-4 rounded bg-muted" />
        <div className={cn('h-4 rounded bg-muted', isSidebar ? 'flex-1' : 'w-24')} />
        <div className="h-4 w-4 rounded bg-muted" />
      </div>
    );
  }

  // Error state with retry button
  if (error) {
    return (
      <button
        onClick={handleRetry}
        disabled={isRefreshing}
        className={cn(
          'flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 text-sm transition-colors',
          'hover:bg-destructive/20 focus:outline-none focus:ring-2 focus:ring-destructive focus:ring-offset-2',
          isRefreshing && 'opacity-70',
          isSidebar ? 'w-full px-3 py-2.5' : 'px-3 py-1.5'
        )}
        title={error}
      >
        {isRefreshing ? (
          <RefreshCw className="h-4 w-4 animate-spin text-destructive" />
        ) : (
          <AlertCircle className="h-4 w-4 text-destructive" />
        )}
        <span className="text-destructive">
          {isRefreshing ? 'Loading...' : 'Retry'}
        </span>
      </button>
    );
  }

  // No workspace available
  if (!currentWorkspace) {
    return (
      <div className={cn(
        'flex items-center gap-2 rounded-md border border-dashed text-sm text-muted-foreground',
        isSidebar ? 'w-full px-3 py-2.5' : 'px-3 py-1.5'
      )}>
        <Layers className="h-4 w-4" />
        <span>No workspace</span>
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'flex items-center gap-2 rounded-md text-sm transition-colors',
          'hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
          isOpen && 'bg-muted/50',
          isSidebar
            ? 'w-full border bg-background px-3 py-2.5'
            : 'border px-3 py-1.5'
        )}
        aria-label={`Current workspace: ${currentWorkspace.name}. ${hasMultipleWorkspaces ? 'Click to switch workspaces.' : ''}`}
        aria-expanded={hasMultipleWorkspaces ? isOpen : undefined}
        aria-haspopup={hasMultipleWorkspaces ? 'listbox' : undefined}
      >
        <Layers className="h-4 w-4 text-primary" aria-hidden="true" />
        <div className={cn('flex flex-col items-start', isSidebar ? 'flex-1' : '')}>
          {isSidebar && (
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Workspace
            </span>
          )}
          <span className={cn(
            'truncate font-medium',
            isSidebar ? 'max-w-[180px]' : 'max-w-[150px]'
          )}>
            {currentWorkspace.name}
          </span>
        </div>
        {hasMultipleWorkspaces && (
          <ChevronDown
            className={cn(
              'h-4 w-4 text-muted-foreground transition-transform ml-auto',
              isOpen && 'rotate-180'
            )}
            aria-hidden="true"
          />
        )}
      </button>

      {isOpen && hasMultipleWorkspaces && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => {
              setIsOpen(false);
              setSearchQuery('');
            }}
          />

          {/* Dropdown */}
          <div className={cn(
            'absolute z-50 mt-1 rounded-lg border bg-card shadow-lg',
            isSidebar ? 'left-0 right-0' : 'right-0 w-64'
          )}>
            {/* Search (show when many workspaces) */}
            {workspaces.length > 5 && (
              <div className="border-b p-2">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search workspaces..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full rounded-md border bg-background py-1.5 pl-8 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    autoFocus
                  />
                </div>
              </div>
            )}

            {/* Workspace list */}
            <div className="max-h-64 overflow-y-auto p-1">
              {filteredWorkspaces.length === 0 ? (
                <div className="px-3 py-2 text-center text-sm text-muted-foreground">
                  No workspaces found
                </div>
              ) : (
                filteredWorkspaces.map((workspace) => (
                  <button
                    key={workspace.id}
                    onClick={() => handleSelect(workspace.id)}
                    className={cn(
                      'flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors',
                      'hover:bg-muted',
                      workspace.id === currentWorkspace.id && 'bg-muted'
                    )}
                  >
                    <Layers className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="flex-1 truncate">
                      <div className="font-medium">{workspace.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {workspace.is_default ? 'Default' : workspace.slug}
                      </div>
                    </div>
                    {workspace.id === currentWorkspace.id && (
                      <Check className="h-4 w-4 shrink-0 text-primary" />
                    )}
                  </button>
                ))
              )}
            </div>

            {/* Create new workspace */}
            <div className="border-t p-1">
              <button
                onClick={() => {
                  setIsOpen(false);
                  navigate('/workspaces');
                }}
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <Plus className="h-4 w-4" />
                Manage workspaces
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
