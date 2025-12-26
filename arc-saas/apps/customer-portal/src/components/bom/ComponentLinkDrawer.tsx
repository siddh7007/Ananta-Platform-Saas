/**
 * Component Link Drawer
 *
 * Drawer component for searching and linking components to BOM line items.
 * Opens from BOM detail when user wants to manually link a component.
 */

import { useState, useEffect, useCallback } from 'react';
import { useList } from '@refinedev/core';
import {
  X,
  Search,
  Link2,
  CheckCircle,
  AlertTriangle,
  XCircle,
  HelpCircle,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Component, LifecycleStatus } from '@/types/component';
import { LIFECYCLE_CONFIG, getLifecycleColor } from '@/types/component';
import type { BomLineItem } from '@/types/bom';
import { linkComponentToLine } from '@/services/bom.service';

interface ComponentLinkDrawerProps {
  open: boolean;
  onClose: () => void;
  bomId: string;
  lineItem: BomLineItem | null;
  onLinked: (lineItemId: string, componentId: string) => void;
}

export function ComponentLinkDrawer({
  open,
  onClose,
  bomId,
  lineItem,
  onLinked,
}: ComponentLinkDrawerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [linking, setLinking] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);

  // Initialize search with line item MPN
  useEffect(() => {
    if (lineItem && open) {
      setSearchQuery(lineItem.mpn || '');
      setDebouncedQuery(lineItem.mpn || '');
      setLinkError(null);
    }
  }, [lineItem, open]);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Build filters
  const filters = debouncedQuery
    ? [{ field: 'q', operator: 'contains' as const, value: debouncedQuery }]
    : [];

  // Fetch components
  const { data, isLoading } = useList<Component>({
    resource: 'components',
    filters,
    pagination: { current: 1, pageSize: 20 },
    sorters: [{ field: 'mpn', order: 'asc' }],
    queryOptions: {
      enabled: open && debouncedQuery.length >= 2,
    },
  });

  const components = data?.data ?? [];

  // Handle link component
  const handleLink = useCallback(
    async (component: Component) => {
      if (!lineItem) return;

      setLinking(true);
      setLinkError(null);

      try {
        await linkComponentToLine({
          bomId,
          lineItemId: lineItem.id,
          componentId: component.id,
          matchType: 'manual',
        });

        onLinked(lineItem.id, component.id);
        onClose();
      } catch (error) {
        console.error('Failed to link component:', error);
        setLinkError('Failed to link component. Please try again.');
      } finally {
        setLinking(false);
      }
    },
    [bomId, lineItem, onLinked, onClose]
  );

  const getLifecycleIcon = (status?: LifecycleStatus) => {
    if (!status) return <HelpCircle className="h-4 w-4 text-gray-400" />;
    switch (status) {
      case 'active':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'nrnd':
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
      case 'obsolete':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'preview':
        return <AlertTriangle className="h-4 w-4 text-blue-600" />;
      default:
        return <HelpCircle className="h-4 w-4 text-gray-400" />;
    }
  };

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40 transition-opacity"
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className={cn(
          'fixed right-0 top-0 h-full w-full max-w-lg bg-background shadow-xl z-50',
          'transform transition-transform duration-300 ease-in-out',
          open ? 'translate-x-0' : 'translate-x-full'
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <h2 className="text-lg font-semibold">Link Component</h2>
            {lineItem && (
              <p className="text-sm text-muted-foreground">
                Line {lineItem.lineNumber}: {lineItem.mpn}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-muted rounded-md"
            disabled={linking}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex flex-col h-[calc(100%-64px)]">
          {/* Search */}
          <div className="p-4 border-b">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search by MPN or manufacturer..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
                autoFocus
              />
            </div>
            {lineItem?.manufacturer && (
              <p className="mt-2 text-sm text-muted-foreground">
                Original manufacturer: {lineItem.manufacturer}
              </p>
            )}
          </div>

          {/* Error message */}
          {linkError && (
            <div className="mx-4 mt-4 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
              {linkError}
            </div>
          )}

          {/* Results */}
          <div className="flex-1 overflow-y-auto p-4">
            {debouncedQuery.length < 2 ? (
              <div className="text-center text-muted-foreground py-8">
                Enter at least 2 characters to search
              </div>
            ) : isLoading ? (
              <div className="text-center py-8">
                <RefreshCw className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                <p className="mt-2 text-sm text-muted-foreground">Searching...</p>
              </div>
            ) : components.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                No components found for "{debouncedQuery}"
              </div>
            ) : (
              <div className="space-y-2">
                {components.map((component) => (
                  <div
                    key={component.id}
                    className="border rounded-md p-3 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-primary">
                            {component.mpn}
                          </span>
                          {component.lifecycle_status && (
                            <span
                              className={cn(
                                'text-xs px-1.5 py-0.5 rounded-full flex items-center gap-1',
                                getLifecycleColor(component.lifecycle_status)
                              )}
                            >
                              {getLifecycleIcon(component.lifecycle_status)}
                              {LIFECYCLE_CONFIG[component.lifecycle_status]?.label}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-0.5">
                          {component.manufacturer}
                        </p>
                        {component.description && (
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                            {component.description}
                          </p>
                        )}
                        {component.category && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {component.category}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col gap-1 ml-2">
                        <button
                          onClick={() => handleLink(component)}
                          disabled={linking}
                          className={cn(
                            'flex items-center gap-1 px-3 py-1.5 text-sm rounded-md',
                            'bg-primary text-primary-foreground hover:bg-primary/90',
                            'disabled:opacity-50 disabled:cursor-not-allowed'
                          )}
                        >
                          <Link2 className="h-4 w-4" />
                          Link
                        </button>
                        {component.datasheet_url && (
                          <a
                            href={component.datasheet_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 px-3 py-1.5 text-sm border rounded-md hover:bg-muted"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <ExternalLink className="h-3 w-3" />
                            Datasheet
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t bg-muted/30">
            <p className="text-xs text-muted-foreground text-center">
              Select a component to link it to this BOM line item.
              This will update the enrichment data for this line.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
