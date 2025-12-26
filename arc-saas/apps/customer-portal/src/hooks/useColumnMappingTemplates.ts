/**
 * Column Mapping Templates Hooks
 * React hooks for managing BOM column mapping templates
 */

import { useState, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useOrganizationId } from '@/contexts/TenantContext';
import { useToast } from '@/hooks/useToast';
import {
  columnMappingService,
  type ColumnMappingTemplate,
} from '@/services/column-mapping.service';
import { BomColumnMapping } from '@/types/bom';

/**
 * Query key factory for column mapping templates
 */
const templateKeys = {
  all: (orgId: string) => ['column-mapping-templates', orgId] as const,
  detail: (orgId: string, id: string) => ['column-mapping-templates', orgId, id] as const,
};

/**
 * Hook to fetch all column mapping templates
 */
export function useColumnMappingTemplates() {
  const organizationId = useOrganizationId();
  const { toast } = useToast();

  const query = useQuery<ColumnMappingTemplate[]>({
    queryKey: organizationId ? templateKeys.all(organizationId) : ['column-mapping-templates'],
    queryFn: async () => {
      if (!organizationId) {
        throw new Error('Organization ID is required');
      }
      return columnMappingService.getTemplates(organizationId);
    },
    enabled: !!organizationId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Handle error with effect (TanStack Query v5 removed onError from useQuery)
  useEffect(() => {
    if (query.error) {
      console.error('[useColumnMappingTemplates] Query failed:', query.error);
      toast({
        title: 'Failed to load templates',
        description: query.error.message,
        variant: 'destructive',
      });
    }
  }, [query.error, toast]);

  // Sort templates: default first, then by last used, then by name
  const sortedTemplates = query.data
    ? [...query.data].sort((a: ColumnMappingTemplate, b: ColumnMappingTemplate) => {
        if (a.isDefault && !b.isDefault) return -1;
        if (!a.isDefault && b.isDefault) return 1;

        if (a.lastUsedAt && b.lastUsedAt) {
          return b.lastUsedAt.getTime() - a.lastUsedAt.getTime();
        }
        if (a.lastUsedAt) return -1;
        if (b.lastUsedAt) return 1;

        return a.name.localeCompare(b.name);
      })
    : [];

  return {
    ...query,
    templates: sortedTemplates,
    defaultTemplate: sortedTemplates.find((t: ColumnMappingTemplate) => t.isDefault),
  };
}

/**
 * Hook to save a new template
 */
export function useSaveTemplate() {
  const organizationId = useOrganizationId();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      name,
      mappings,
    }: {
      name: string;
      mappings: BomColumnMapping;
    }) => {
      if (!organizationId) {
        throw new Error('Organization ID is required');
      }
      return columnMappingService.saveTemplate(organizationId, name, mappings);
    },
    onSuccess: (template: ColumnMappingTemplate) => {
      if (organizationId) {
        queryClient.invalidateQueries({ queryKey: templateKeys.all(organizationId) });
      }
      toast({
        title: 'Template saved',
        description: `"${template.name}" has been saved successfully.`,
      });
    },
    onError: (error: Error) => {
      console.error('[useSaveTemplate] Mutation failed:', error);
      toast({
        title: 'Failed to save template',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

/**
 * Hook to update an existing template
 */
export function useUpdateTemplate() {
  const organizationId = useOrganizationId();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: Partial<Pick<ColumnMappingTemplate, 'name' | 'mappings' | 'isDefault'>>;
    }) => {
      if (!organizationId) {
        throw new Error('Organization ID is required');
      }
      return columnMappingService.updateTemplate(organizationId, id, data);
    },
    onSuccess: (template: ColumnMappingTemplate) => {
      if (organizationId) {
        queryClient.invalidateQueries({ queryKey: templateKeys.all(organizationId) });
      }
      toast({
        title: 'Template updated',
        description: `"${template.name}" has been updated successfully.`,
      });
    },
    onError: (error: Error) => {
      console.error('[useUpdateTemplate] Mutation failed:', error);
      toast({
        title: 'Failed to update template',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

/**
 * Hook to delete a template
 */
export function useDeleteTemplate() {
  const organizationId = useOrganizationId();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      if (!organizationId) {
        throw new Error('Organization ID is required');
      }
      await columnMappingService.deleteTemplate(organizationId, id);
      return id;
    },
    onSuccess: () => {
      if (organizationId) {
        queryClient.invalidateQueries({ queryKey: templateKeys.all(organizationId) });
      }
      toast({
        title: 'Template deleted',
        description: 'The template has been removed.',
      });
    },
    onError: (error: Error) => {
      console.error('[useDeleteTemplate] Mutation failed:', error);
      toast({
        title: 'Failed to delete template',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

/**
 * Hook to set a template as default
 */
export function useSetDefaultTemplate() {
  const organizationId = useOrganizationId();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      if (!organizationId) {
        throw new Error('Organization ID is required');
      }
      await columnMappingService.setDefault(organizationId, id);
      return id;
    },
    onSuccess: () => {
      if (organizationId) {
        queryClient.invalidateQueries({ queryKey: templateKeys.all(organizationId) });
      }
      toast({
        title: 'Default template updated',
        description: 'This template will be auto-loaded for new uploads.',
      });
    },
    onError: (error: Error) => {
      console.error('[useSetDefaultTemplate] Mutation failed:', error);
      toast({
        title: 'Failed to set default',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

/**
 * Hook to apply a template to current mapping
 * Returns the mapped BomColumnMapping
 */
export function useApplyTemplate() {
  const organizationId = useOrganizationId();
  const { toast } = useToast();

  return useCallback(
    async (templateId: string): Promise<BomColumnMapping | null> => {
      if (!organizationId) {
        toast({
          title: 'Error',
          description: 'Organization context required',
          variant: 'destructive',
        });
        return null;
      }

      try {
        const template = await columnMappingService.getTemplate(organizationId, templateId);

        if (!template) {
          toast({
            title: 'Template not found',
            description: 'The selected template could not be loaded.',
            variant: 'destructive',
          });
          return null;
        }

        // Mark as used
        await columnMappingService.markAsUsed(organizationId, templateId);

        const mapping = columnMappingService.templateToMapping(template);

        toast({
          title: 'Template applied',
          description: `Column mapping loaded from "${template.name}".`,
        });

        return mapping;
      } catch (error) {
        console.error('[useApplyTemplate] Failed to apply template:', error);
        toast({
          title: 'Failed to apply template',
          description: error instanceof Error ? error.message : 'Unknown error',
          variant: 'destructive',
        });
        return null;
      }
    },
    [organizationId, toast]
  );
}

/**
 * Hook to manage template auto-load on mount
 */
export function useAutoLoadTemplate(
  onTemplateLoaded: (mapping: BomColumnMapping) => void
) {
  const { defaultTemplate, isLoading } = useColumnMappingTemplates();
  const organizationId = useOrganizationId();
  const [hasAutoLoaded, setHasAutoLoaded] = useState(false);

  useEffect(() => {
    if (
      !isLoading &&
      !hasAutoLoaded &&
      defaultTemplate &&
      organizationId
    ) {
      const mapping = columnMappingService.templateToMapping(defaultTemplate);
      onTemplateLoaded(mapping);
      setHasAutoLoaded(true);

      // Mark as used
      columnMappingService.markAsUsed(organizationId, defaultTemplate.id).catch(err => {
        console.warn('[useAutoLoadTemplate] Failed to mark template as used:', err);
      });
    }
  }, [defaultTemplate, isLoading, hasAutoLoaded, organizationId, onTemplateLoaded]);

  return { isAutoLoading: isLoading, defaultTemplate };
}
