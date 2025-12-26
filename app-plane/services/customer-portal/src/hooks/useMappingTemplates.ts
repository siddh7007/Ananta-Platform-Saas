/**
 * React hook for mapping template CRUD operations
 * Provides tenant-scoped template management
 * @module hooks/useMappingTemplates
 */

import { useState, useEffect, useCallback } from 'react';
import {
  getMappingTemplates,
  createMappingTemplate,
  updateMappingTemplate,
  deleteMappingTemplate,
  type MappingTemplate,
  type CreateMappingTemplateRequest,
  type UpdateMappingTemplateRequest,
} from '../services/column-mapping.service';

export interface UseMappingTemplatesOptions {
  /** Tenant ID for filtering templates */
  tenantId: string;
  /** Whether to auto-load templates on mount */
  autoLoad?: boolean;
}

export interface UseMappingTemplatesResult {
  /** List of available templates */
  templates: MappingTemplate[];
  /** Loading state */
  loading: boolean;
  /** Error if operation failed */
  error: Error | null;
  /** Refresh templates list */
  refresh: () => Promise<void>;
  /** Create a new template */
  create: (template: CreateMappingTemplateRequest) => Promise<MappingTemplate>;
  /** Update an existing template */
  update: (
    id: string,
    updates: UpdateMappingTemplateRequest
  ) => Promise<MappingTemplate>;
  /** Delete a template */
  remove: (id: string) => Promise<void>;
}

/**
 * Hook for managing mapping templates
 *
 * @example
 * ```tsx
 * const { templates, loading, create, update, remove } = useMappingTemplates({
 *   tenantId: 'tenant-123',
 *   autoLoad: true,
 * });
 *
 * const handleCreate = async () => {
 *   await create({
 *     name: 'My Template',
 *     tenantId: 'tenant-123',
 *     mappings: [...],
 *     createdBy: 'user-123',
 *     isShared: false,
 *   });
 * };
 *
 * const handleUpdate = async (id: string) => {
 *   await update(id, { name: 'Updated Name' });
 * };
 *
 * const handleDelete = async (id: string) => {
 *   await remove(id);
 * };
 * ```
 */
export function useMappingTemplates({
  tenantId,
  autoLoad = true,
}: UseMappingTemplatesOptions): UseMappingTemplatesResult {
  const [templates, setTemplates] = useState<MappingTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  /**
   * Load templates from API
   */
  const loadTemplates = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await getMappingTemplates(tenantId);
      setTemplates(data);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to load templates');
      setError(error);
      console.error('[useMappingTemplates] Load error:', error);
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  /**
   * Refresh templates list
   */
  const refresh = useCallback(async () => {
    await loadTemplates();
  }, [loadTemplates]);

  /**
   * Create a new template
   */
  const create = useCallback(
    async (template: CreateMappingTemplateRequest): Promise<MappingTemplate> => {
      setError(null);

      try {
        const newTemplate = await createMappingTemplate(template);

        // Optimistically update local state
        setTemplates((prev) => [...prev, newTemplate]);

        return newTemplate;
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to create template');
        setError(error);
        console.error('[useMappingTemplates] Create error:', error);
        throw error;
      }
    },
    []
  );

  /**
   * Update an existing template
   */
  const update = useCallback(
    async (
      id: string,
      updates: UpdateMappingTemplateRequest
    ): Promise<MappingTemplate> => {
      setError(null);

      try {
        const updatedTemplate = await updateMappingTemplate(id, updates);

        // Optimistically update local state
        setTemplates((prev) =>
          prev.map((t) => (t.id === id ? updatedTemplate : t))
        );

        return updatedTemplate;
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to update template');
        setError(error);
        console.error('[useMappingTemplates] Update error:', error);
        throw error;
      }
    },
    []
  );

  /**
   * Delete a template
   */
  const remove = useCallback(async (id: string): Promise<void> => {
    setError(null);

    try {
      await deleteMappingTemplate(id);

      // Optimistically update local state
      setTemplates((prev) => prev.filter((t) => t.id !== id));
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to delete template');
      setError(error);
      console.error('[useMappingTemplates] Delete error:', error);
      throw error;
    }
  }, []);

  /**
   * Auto-load templates on mount if enabled
   */
  useEffect(() => {
    if (autoLoad) {
      loadTemplates();
    }
  }, [autoLoad, loadTemplates]);

  return {
    templates,
    loading,
    error,
    refresh,
    create,
    update,
    remove,
  };
}
