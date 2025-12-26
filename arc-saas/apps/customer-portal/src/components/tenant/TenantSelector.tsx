import { useState } from 'react';
import { ChevronDown, Building2, Check, Plus, Search } from 'lucide-react';
import { useTenant } from '@/contexts/TenantContext';
import { cn } from '@/lib/utils';

/**
 * Tenant selector dropdown component
 * Shows current tenant and allows switching between available tenants
 * For super_admin, shows all tenants; for regular users, shows their tenants only
 */
export function TenantSelector() {
  const { tenants, currentTenant, selectTenant, isLoading, isSuperAdmin } = useTenant();
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Filter tenants based on search query
  const filteredTenants = tenants.filter(
    (tenant) =>
      tenant.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tenant.key.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelect = (tenantId: string) => {
    selectTenant(tenantId);
    setIsOpen(false);
    setSearchQuery('');
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 rounded-md border bg-muted/50 px-3 py-1.5">
        <div className="h-4 w-4 animate-pulse rounded bg-muted" />
        <div className="h-4 w-24 animate-pulse rounded bg-muted" />
      </div>
    );
  }

  if (!currentTenant) {
    return null;
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm transition-colors',
          'hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
          isOpen && 'bg-muted/50'
        )}
        aria-label={`Current workspace: ${currentTenant.name}. ${tenants.length > 1 ? 'Click to switch workspaces.' : ''}`}
        aria-expanded={tenants.length > 1 ? isOpen : undefined}
        aria-haspopup={tenants.length > 1 ? 'listbox' : undefined}
      >
        <Building2 className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        <span className="max-w-[150px] truncate font-medium">{currentTenant.name}</span>
        {tenants.length > 1 && (
          <ChevronDown
            className={cn(
              'h-4 w-4 text-muted-foreground transition-transform',
              isOpen && 'rotate-180'
            )}
            aria-hidden="true"
          />
        )}
      </button>

      {isOpen && tenants.length > 1 && (
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
          <div className="absolute right-0 top-full z-50 mt-1 w-64 rounded-lg border bg-card shadow-lg">
            {/* Search (show for super_admin or when many tenants) */}
            {(isSuperAdmin || tenants.length > 5) && (
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

            {/* Tenant list */}
            <div className="max-h-64 overflow-y-auto p-1">
              {filteredTenants.length === 0 ? (
                <div className="px-3 py-2 text-center text-sm text-muted-foreground">
                  No workspaces found
                </div>
              ) : (
                filteredTenants.map((tenant) => (
                  <button
                    key={tenant.id}
                    onClick={() => handleSelect(tenant.id)}
                    className={cn(
                      'flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors',
                      'hover:bg-muted',
                      tenant.id === currentTenant.id && 'bg-muted'
                    )}
                  >
                    <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="flex-1 truncate">
                      <div className="font-medium">{tenant.name}</div>
                      <div className="text-xs text-muted-foreground">{tenant.key}</div>
                    </div>
                    {tenant.id === currentTenant.id && (
                      <Check className="h-4 w-4 shrink-0 text-primary" />
                    )}
                  </button>
                ))
              )}
            </div>

            {/* Staff indicator for super_admin */}
            {isSuperAdmin && (
              <div className="border-t p-2">
                <div className="flex items-center gap-2 rounded-md bg-amber-500/10 px-3 py-2 text-xs text-amber-600">
                  <span className="font-medium">Staff Mode</span>
                  <span className="text-amber-500/80">- All tenants visible</span>
                </div>
              </div>
            )}

            {/* Create new workspace (if allowed) */}
            {!isSuperAdmin && (
              <div className="border-t p-1">
                <button
                  onClick={() => {
                    setIsOpen(false);
                    // Navigate to create workspace
                    window.location.href = '/settings/workspaces/new';
                  }}
                  className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <Plus className="h-4 w-4" />
                  Create new workspace
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
