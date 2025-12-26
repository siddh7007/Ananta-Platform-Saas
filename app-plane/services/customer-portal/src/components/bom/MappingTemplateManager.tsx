/**
 * Mapping Template Manager Component
 * Manages saved column mapping templates
 * @module components/bom/MappingTemplateManager
 */

import React, { useState, useMemo } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Plus, Search, X } from 'lucide-react';
import { useMappingTemplates } from '../../hooks/useMappingTemplates';
import { MappingTemplateCard } from './MappingTemplateCard';
import type { CreateMappingTemplateRequest } from '../../types/column-mapping';

export interface MappingTemplateManagerProps {
  /** Tenant ID for filtering templates */
  tenantId: string;
  /** Current user ID for ownership checks */
  currentUserId: string;
  /** Apply template handler */
  onApply: (templateId: string) => void;
  /** Optional CSS class name */
  className?: string;
}

/**
 * Mapping Template Manager Component
 *
 * Provides template management UI:
 * - List templates with search
 * - Create/edit/delete operations
 * - Apply templates
 * - Toggle sharing (admin+ only)
 *
 * @example
 * ```tsx
 * <MappingTemplateManager
 *   tenantId="tenant-123"
 *   currentUserId="user-123"
 *   onApply={(id) => handleApplyTemplate(id)}
 * />
 * ```
 */
export const MappingTemplateManager: React.FC<MappingTemplateManagerProps> = ({
  tenantId,
  currentUserId,
  onApply,
  className = '',
}) => {
  const { templates, loading, create, update, remove } = useMappingTemplates({
    tenantId,
    autoLoad: true,
  });

  // Search query
  const [searchQuery, setSearchQuery] = useState('');

  // Create modal state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [newTemplateDescription, setNewTemplateDescription] = useState('');
  const [newTemplateShared, setNewTemplateShared] = useState(false);
  const [creating, setCreating] = useState(false);

  /**
   * Filter templates by search query
   */
  const filteredTemplates = useMemo(() => {
    if (!searchQuery.trim()) return templates;

    const query = searchQuery.toLowerCase();
    return templates.filter(
      (t) =>
        t.name.toLowerCase().includes(query) ||
        (t.description && t.description.toLowerCase().includes(query))
    );
  }, [templates, searchQuery]);

  /**
   * Handle template creation
   */
  const handleCreate = async () => {
    if (!newTemplateName.trim()) return;

    setCreating(true);

    try {
      const newTemplate: CreateMappingTemplateRequest = {
        name: newTemplateName.trim(),
        description: newTemplateDescription.trim() || undefined,
        tenantId,
        createdBy: currentUserId,
        isShared: newTemplateShared,
        mappings: [],
      };

      await create(newTemplate);

      // Reset form and close modal
      setNewTemplateName('');
      setNewTemplateDescription('');
      setNewTemplateShared(false);
      setCreateModalOpen(false);
    } catch (error) {
      console.error('[MappingTemplateManager] Failed to create template:', error);
    } finally {
      setCreating(false);
    }
  };

  /**
   * Handle template deletion
   */
  const handleDelete = async (templateId: string) => {
    if (!window.confirm('Are you sure you want to delete this template?')) {
      return;
    }

    try {
      await remove(templateId);
    } catch (error) {
      console.error('[MappingTemplateManager] Failed to delete template:', error);
    }
  };

  /**
   * Handle template edit
   */
  const handleEdit = (templateId: string) => {
    // TODO: Implement edit functionality
    console.log('Edit template:', templateId);
  };

  return (
    <div className={`rounded-lg border border-gray-200 bg-white shadow-sm ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Mapping Templates</h2>
          <p className="mt-1 text-sm text-gray-600">
            Manage reusable column mapping templates
          </p>
        </div>

        <button
          type="button"
          onClick={() => setCreateModalOpen(true)}
          className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          New Template
        </button>
      </div>

      {/* Search */}
      <div className="border-b border-gray-200 px-6 py-4">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400"
            aria-hidden="true"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search templates..."
            className="w-full rounded-md border border-gray-300 py-2 pl-10 pr-3 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label="Search templates"
          />
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <p className="text-sm text-gray-600">Loading templates...</p>
        </div>
      )}

      {/* Empty State */}
      {!loading && templates.length === 0 && (
        <div className="py-12 text-center">
          <p className="text-sm text-gray-600">No templates yet</p>
          <button
            type="button"
            onClick={() => setCreateModalOpen(true)}
            className="mt-2 text-sm font-medium text-blue-600 hover:text-blue-700"
          >
            Create your first template
          </button>
        </div>
      )}

      {/* No Search Results */}
      {!loading && templates.length > 0 && filteredTemplates.length === 0 && (
        <div className="py-12 text-center">
          <p className="text-sm text-gray-600">No templates match your search</p>
        </div>
      )}

      {/* Template List */}
      {!loading && filteredTemplates.length > 0 && (
        <div className="grid gap-4 p-6 sm:grid-cols-2 lg:grid-cols-3">
          {filteredTemplates.map((template) => (
            <MappingTemplateCard
              key={template.id}
              template={template}
              currentUserId={currentUserId}
              onApply={onApply}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* Create Template Modal */}
      <Dialog.Root open={createModalOpen} onOpenChange={setCreateModalOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
          <Dialog.Content className="fixed left-1/2 top-1/2 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border border-gray-200 bg-white p-6 shadow-xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]">
            <Dialog.Title className="text-lg font-semibold text-gray-900">
              Create New Template
            </Dialog.Title>
            <Dialog.Description className="mt-2 text-sm text-gray-600">
              Create a new reusable column mapping template
            </Dialog.Description>

            <div className="mt-4 space-y-4">
              {/* Template Name */}
              <div>
                <label
                  htmlFor="new-template-name"
                  className="block text-sm font-medium text-gray-700"
                >
                  Template Name
                </label>
                <input
                  id="new-template-name"
                  type="text"
                  value={newTemplateName}
                  onChange={(e) => setNewTemplateName(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Standard BOM Format"
                  required
                />
              </div>

              {/* Template Description */}
              <div>
                <label
                  htmlFor="new-template-description"
                  className="block text-sm font-medium text-gray-700"
                >
                  Description (Optional)
                </label>
                <textarea
                  id="new-template-description"
                  value={newTemplateDescription}
                  onChange={(e) => setNewTemplateDescription(e.target.value)}
                  rows={3}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Brief description of this template"
                />
              </div>

              {/* Sharing Toggle */}
              <div className="flex items-center gap-2">
                <input
                  id="new-template-shared"
                  type="checkbox"
                  checked={newTemplateShared}
                  onChange={(e) => setNewTemplateShared(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500"
                />
                <label
                  htmlFor="new-template-shared"
                  className="text-sm text-gray-700"
                >
                  Share with organization (requires admin permissions)
                </label>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="mt-6 flex items-center justify-end gap-3">
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                  disabled={creating}
                >
                  Cancel
                </button>
              </Dialog.Close>

              <button
                type="button"
                onClick={handleCreate}
                disabled={!newTemplateName.trim() || creating}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {creating ? 'Creating...' : 'Create Template'}
              </button>
            </div>

            <Dialog.Close asChild>
              <button
                type="button"
                className="absolute right-4 top-4 rounded-md p-1 text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                aria-label="Close"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </Dialog.Close>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
};

MappingTemplateManager.displayName = 'MappingTemplateManager';
