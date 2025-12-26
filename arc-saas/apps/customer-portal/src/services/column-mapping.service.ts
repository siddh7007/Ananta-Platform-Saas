/**
 * Column Mapping Template Service
 * Manages saved column mapping templates for BOM uploads
 * Supports dual storage: CNS API (primary) and localStorage (fallback)
 */

import { cnsApi } from '@/lib/axios';
import { BomColumnMapping } from '@/types/bom';

export interface ColumnMappingTemplate {
  id: string;
  organizationId: string;
  name: string;
  description?: string;
  mappings: Record<string, string>;
  createdAt: Date;
  updatedAt: Date;
  isDefault?: boolean;
  lastUsedAt?: Date;
}

interface ColumnMappingTemplateDTO {
  id: string;
  organization_id?: string;  // Not in backend response (uses camelCase)
  name: string;
  description?: string;
  mappings: Record<string, string>;
  created_at?: string;  // Backend uses camelCase
  updated_at?: string;  // Backend uses camelCase
  createdAt?: string;  // Backend response format (camelCase)
  updatedAt?: string;  // Backend response format (camelCase)
  is_default?: boolean;  // Request format
  isDefault?: boolean;  // Response format
  last_used_at?: string;  // Not in backend yet
  lastUsedAt?: string;  // Future backend format
}

const STORAGE_KEY_PREFIX = 'cbp:column-templates';

/**
 * Convert DTO to domain model
 * Handles both snake_case (storage) and camelCase (backend response)
 */
function fromDTO(dto: ColumnMappingTemplateDTO): ColumnMappingTemplate {
  // Extract organization ID (we'll get it from context, not from backend response)
  const organizationId = dto.organization_id || '';

  // Handle both camelCase (backend response) and snake_case (localStorage)
  const createdAt = dto.createdAt || dto.created_at;
  const updatedAt = dto.updatedAt || dto.updated_at;
  const isDefault = dto.isDefault !== undefined ? dto.isDefault : dto.is_default;
  const lastUsedAt = dto.lastUsedAt || dto.last_used_at;

  return {
    id: dto.id,
    organizationId,
    name: dto.name,
    description: dto.description,
    mappings: dto.mappings,
    createdAt: createdAt ? new Date(createdAt) : new Date(),
    updatedAt: updatedAt ? new Date(updatedAt) : new Date(),
    isDefault: isDefault || false,
    lastUsedAt: lastUsedAt ? new Date(lastUsedAt) : undefined,
  };
}

/**
 * Convert domain model to DTO for API requests
 * Backend expects snake_case for create/update requests
 */
function toDTO(
  template: Omit<ColumnMappingTemplate, 'id' | 'createdAt' | 'updatedAt'>
): Partial<ColumnMappingTemplateDTO> {
  return {
    name: template.name,
    description: template.description,
    mappings: template.mappings,
    is_default: template.isDefault,
  };
}

/**
 * Get localStorage key for organization
 */
function getStorageKey(organizationId: string): string {
  return `${STORAGE_KEY_PREFIX}:${organizationId}`;
}

/**
 * Get templates from localStorage
 */
function getLocalTemplates(organizationId: string): ColumnMappingTemplate[] {
  try {
    const key = getStorageKey(organizationId);
    const data = localStorage.getItem(key);
    if (!data) return [];

    const parsed = JSON.parse(data);
    return parsed.map((t: ColumnMappingTemplateDTO) => fromDTO(t));
  } catch (error) {
    console.error('[ColumnMappingService] Failed to read from localStorage:', error);
    return [];
  }
}

/**
 * Save templates to localStorage
 */
function saveLocalTemplates(
  organizationId: string,
  templates: ColumnMappingTemplate[]
): void {
  try {
    const key = getStorageKey(organizationId);
    const dtos = templates.map(t => ({
      id: t.id,
      organization_id: t.organizationId,
      name: t.name,
      mappings: t.mappings,
      created_at: t.createdAt.toISOString(),
      updated_at: t.updatedAt.toISOString(),
      is_default: t.isDefault,
      last_used_at: t.lastUsedAt?.toISOString(),
    }));
    localStorage.setItem(key, JSON.stringify(dtos));
  } catch (error) {
    console.error('[ColumnMappingService] Failed to save to localStorage:', error);
  }
}

/**
 * Generate a unique ID for templates
 */
function generateId(): string {
  return `tmpl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Convert BomColumnMapping to Record<string, string>
 */
function mappingToRecord(mapping: BomColumnMapping): Record<string, string> {
  const record: Record<string, string> = {};

  if (mapping.mpn) record.mpn = mapping.mpn;
  if (mapping.manufacturer) record.manufacturer = mapping.manufacturer;
  if (mapping.quantity) record.quantity = mapping.quantity;
  if (mapping.description) record.description = mapping.description;
  if (mapping.referenceDesignator) record.referenceDesignator = mapping.referenceDesignator;
  if (mapping.designator) record.designator = mapping.designator;
  if (mapping.footprint) record.footprint = mapping.footprint;

  return record;
}

/**
 * Convert Record<string, string> to BomColumnMapping
 */
function recordToMapping(record: Record<string, string>): BomColumnMapping {
  return {
    mpn: record.mpn || '',
    manufacturer: record.manufacturer,
    quantity: record.quantity,
    description: record.description,
    referenceDesignator: record.referenceDesignator,
    designator: record.designator,
    footprint: record.footprint,
  };
}

export const columnMappingService = {
  /**
   * Get all templates for current organization
   */
  async getTemplates(organizationId: string): Promise<ColumnMappingTemplate[]> {
    try {
      // Try API first - using correct endpoint with org_id in path
      const response = await cnsApi.get(`/organizations/${organizationId}/column-templates`);

      // Backend returns { templates: [...], defaultTemplateId: "..." }
      const templates = response.data.templates?.map(fromDTO) || [];

      // Sync to localStorage as backup
      saveLocalTemplates(organizationId, templates);

      return templates;
    } catch (error) {
      console.warn('[ColumnMappingService] API failed, using localStorage:', error);
      // Fallback to localStorage
      return getLocalTemplates(organizationId);
    }
  },

  /**
   * Get a specific template
   */
  async getTemplate(
    organizationId: string,
    id: string
  ): Promise<ColumnMappingTemplate | null> {
    try {
      // Get from the list endpoint - backend doesn't have a GET single endpoint
      const templates = await columnMappingService.getTemplates(organizationId);
      return templates.find(t => t.id === id) || null;
    } catch (error) {
      console.warn('[ColumnMappingService] API failed, using localStorage:', error);
      const localTemplates = getLocalTemplates(organizationId);
      return localTemplates.find(t => t.id === id) || null;
    }
  },

  /**
   * Save a new template
   */
  async saveTemplate(
    organizationId: string,
    name: string,
    mappings: BomColumnMapping
  ): Promise<ColumnMappingTemplate> {
    const mappingRecord = mappingToRecord(mappings);

    try {
      // Try API first - use correct endpoint with org_id in path
      const response = await cnsApi.post(
        `/organizations/${organizationId}/column-templates`,
        {
          name,
          mappings: mappingRecord,
          isDefault: false,
        }
      );
      const template = fromDTO(response.data);

      // Update localStorage
      const localTemplates = getLocalTemplates(organizationId);
      saveLocalTemplates(organizationId, [...localTemplates, template]);

      return template;
    } catch (error) {
      console.warn('[ColumnMappingService] API failed, using localStorage:', error);

      // Fallback to localStorage
      const newTemplate: ColumnMappingTemplate = {
        id: generateId(),
        organizationId,
        name,
        mappings: mappingRecord,
        createdAt: new Date(),
        updatedAt: new Date(),
        isDefault: false,
      };

      const localTemplates = getLocalTemplates(organizationId);
      saveLocalTemplates(organizationId, [...localTemplates, newTemplate]);

      return newTemplate;
    }
  },

  /**
   * Update existing template
   */
  async updateTemplate(
    organizationId: string,
    id: string,
    data: Partial<Pick<ColumnMappingTemplate, 'name' | 'mappings' | 'isDefault'>>
  ): Promise<ColumnMappingTemplate> {
    try {
      // Try API first - using PUT method as per backend
      const dto: Partial<ColumnMappingTemplateDTO> = {};
      if (data.name) dto.name = data.name;
      if (data.mappings) dto.mappings = data.mappings;
      if (data.isDefault !== undefined) dto.is_default = data.isDefault;

      const response = await cnsApi.put(
        `/organizations/${organizationId}/column-templates/${id}`,
        dto
      );
      const template = fromDTO(response.data);

      // Update localStorage
      const localTemplates = getLocalTemplates(organizationId);
      const updatedTemplates = localTemplates.map(t => t.id === id ? template : t);
      saveLocalTemplates(organizationId, updatedTemplates);

      return template;
    } catch (error) {
      console.warn('[ColumnMappingService] API failed, using localStorage:', error);

      // Fallback to localStorage
      const localTemplates = getLocalTemplates(organizationId);
      const existingTemplate = localTemplates.find(t => t.id === id);

      if (!existingTemplate) {
        throw new Error('Template not found');
      }

      const updatedTemplate: ColumnMappingTemplate = {
        ...existingTemplate,
        ...data,
        updatedAt: new Date(),
      };

      const updatedTemplates = localTemplates.map(t =>
        t.id === id ? updatedTemplate : t
      );
      saveLocalTemplates(organizationId, updatedTemplates);

      return updatedTemplate;
    }
  },

  /**
   * Delete a template
   */
  async deleteTemplate(organizationId: string, id: string): Promise<void> {
    try {
      // Try API first - using correct endpoint with org_id in path
      await cnsApi.delete(`/organizations/${organizationId}/column-templates/${id}`);

      // Update localStorage
      const localTemplates = getLocalTemplates(organizationId);
      const filteredTemplates = localTemplates.filter(t => t.id !== id);
      saveLocalTemplates(organizationId, filteredTemplates);
    } catch (error) {
      console.warn('[ColumnMappingService] API failed, using localStorage:', error);

      // Fallback to localStorage
      const localTemplates = getLocalTemplates(organizationId);
      const filteredTemplates = localTemplates.filter(t => t.id !== id);
      saveLocalTemplates(organizationId, filteredTemplates);
    }
  },

  /**
   * Set a template as default
   * Only one template can be default per organization
   */
  async setDefault(organizationId: string, id: string): Promise<void> {
    try {
      // Try API first - using correct endpoint with org_id in path
      await cnsApi.post(
        `/organizations/${organizationId}/column-templates/${id}/set-default`
      );

      // Update localStorage - clear other defaults
      const localTemplates = getLocalTemplates(organizationId);
      const updatedTemplates = localTemplates.map(t => ({
        ...t,
        isDefault: t.id === id,
        updatedAt: t.id === id ? new Date() : t.updatedAt,
      }));
      saveLocalTemplates(organizationId, updatedTemplates);
    } catch (error) {
      console.warn('[ColumnMappingService] API failed, using localStorage:', error);

      // Fallback to localStorage
      const localTemplates = getLocalTemplates(organizationId);
      const updatedTemplates = localTemplates.map(t => ({
        ...t,
        isDefault: t.id === id,
        updatedAt: t.id === id ? new Date() : t.updatedAt,
      }));
      saveLocalTemplates(organizationId, updatedTemplates);
    }
  },

  /**
   * Update last used timestamp
   * Note: Backend doesn't have a mark-used endpoint yet, so this only updates localStorage
   */
  async markAsUsed(organizationId: string, id: string): Promise<void> {
    try {
      // Update localStorage tracking (backend doesn't support this yet)
      const localTemplates = getLocalTemplates(organizationId);
      const updatedTemplates = localTemplates.map(t =>
        t.id === id ? { ...t, lastUsedAt: new Date() } : t
      );
      saveLocalTemplates(organizationId, updatedTemplates);
    } catch (error) {
      console.warn('[ColumnMappingService] Failed to mark as used:', error);
    }
  },

  /**
   * Convert template mappings to BomColumnMapping
   */
  templateToMapping(template: ColumnMappingTemplate): BomColumnMapping {
    return recordToMapping(template.mappings);
  },
};

export default columnMappingService;
