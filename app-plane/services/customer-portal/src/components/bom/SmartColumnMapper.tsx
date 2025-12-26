/**
 * Smart Column Mapper Component
 * AI-powered column mapping with template support
 * @module components/bom/SmartColumnMapper
 */

import React, { useState, useEffect, useMemo } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import * as Select from '@radix-ui/react-select';
import { Save, RefreshCw, ChevronDown, Check, X, Sparkles } from 'lucide-react';
import { useColumnSuggestions } from '../../hooks/useColumnSuggestions';
import { useMappingTemplates } from '../../hooks/useMappingTemplates';
import { applyTemplate } from '../../services/column-mapping.service';
import { MappingRow } from './MappingRow';
import { AcceptAllButton } from './AcceptAllButton';
import type { ColumnSuggestion, TargetFieldOption } from '../../types/column-mapping';

export interface SmartColumnMapperProps {
  /** Column headers from uploaded file */
  headers: string[];
  /** Sample data rows for analysis */
  sampleRows: Record<string, unknown>[];
  /** Tenant ID for template management */
  tenantId: string;
  /** Current user ID for template ownership */
  currentUserId: string;
  /** Confirm handler - receives final mappings */
  onConfirm: (mappings: Record<string, string>) => void;
  /** Cancel handler */
  onCancel?: () => void;
  /** Optional CSS class name */
  className?: string;
}

/**
 * Target field options for dropdowns
 */
const TARGET_FIELD_OPTIONS: TargetFieldOption[] = [
  { value: 'ignore', label: 'Ignore' },
  { value: 'manufacturer_part_number', label: 'Part Number (MPN)' },
  { value: 'manufacturer', label: 'Manufacturer' },
  { value: 'quantity', label: 'Quantity' },
  { value: 'reference_designator', label: 'Reference Designator' },
  { value: 'description', label: 'Description' },
];

/**
 * Smart Column Mapper Component
 *
 * Main component for AI-powered column mapping with:
 * - Auto-detection of column types
 * - Confidence indicators
 * - Template support
 * - Bulk accept high-confidence mappings
 * - Sample data preview
 *
 * @example
 * ```tsx
 * <SmartColumnMapper
 *   headers={['Part Number', 'Qty', 'Mfr']}
 *   sampleRows={[{ 'Part Number': 'ABC123', 'Qty': '10', 'Mfr': 'Acme' }]}
 *   tenantId="tenant-123"
 *   currentUserId="user-123"
 *   onConfirm={(mappings) => console.log(mappings)}
 * />
 * ```
 */
export const SmartColumnMapper: React.FC<SmartColumnMapperProps> = ({
  headers,
  sampleRows,
  tenantId,
  currentUserId,
  onConfirm,
  onCancel,
  className = '',
}) => {
  // AI suggestions
  const {
    suggestions: aiSuggestions,
    matchedTemplate,
    loading: analyzingColumns,
    error: analysisError,
    reAnalyze,
  } = useColumnSuggestions({
    headers,
    sampleRows,
    tenantId,
    autoAnalyze: true,
  });

  // Templates
  const {
    templates,
    loading: loadingTemplates,
    create: createTemplate,
  } = useMappingTemplates({
    tenantId,
    autoLoad: true,
  });

  // Selected mappings (source -> target)
  const [mappings, setMappings] = useState<Record<string, string>>({});

  // Template save modal state
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templateDescription, setTemplateDescription] = useState('');
  const [templateShared, setTemplateShared] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);

  // Initialize mappings from AI suggestions
  useEffect(() => {
    if (aiSuggestions.length > 0) {
      const initialMappings: Record<string, string> = {};
      aiSuggestions.forEach((suggestion) => {
        initialMappings[suggestion.sourceColumn] = suggestion.suggestedTarget;
      });
      setMappings(initialMappings);
    }
  }, [aiSuggestions]);

  /**
   * Get sample data for a specific column
   */
  const getSampleData = (column: string): unknown[] => {
    return sampleRows.map((row) => row[column]);
  };

  /**
   * Handle mapping change for a column
   */
  const handleMappingChange = (sourceColumn: string, targetField: string) => {
    setMappings((prev) => ({
      ...prev,
      [sourceColumn]: targetField,
    }));
  };

  /**
   * Count high-confidence suggestions
   */
  const highConfidenceCount = useMemo(() => {
    return aiSuggestions.filter((s) => s.confidence >= 90).length;
  }, [aiSuggestions]);

  /**
   * Accept all high-confidence suggestions
   */
  const handleAcceptAll = () => {
    const newMappings: Record<string, string> = { ...mappings };

    aiSuggestions.forEach((suggestion) => {
      if (suggestion.confidence >= 90) {
        newMappings[suggestion.sourceColumn] = suggestion.suggestedTarget;
      }
    });

    setMappings(newMappings);
  };

  /**
   * Apply a saved template
   */
  const handleApplyTemplate = async (templateId: string) => {
    try {
      const suggestions = await applyTemplate(templateId, headers);

      const newMappings: Record<string, string> = {};
      suggestions.forEach((suggestion) => {
        newMappings[suggestion.sourceColumn] = suggestion.suggestedTarget;
      });

      setMappings(newMappings);
    } catch (error) {
      console.error('[SmartColumnMapper] Failed to apply template:', error);
    }
  };

  /**
   * Save current mappings as template
   */
  const handleSaveTemplate = async () => {
    if (!templateName.trim()) return;

    setSavingTemplate(true);

    try {
      await createTemplate({
        name: templateName.trim(),
        description: templateDescription.trim() || undefined,
        tenantId,
        createdBy: currentUserId,
        isShared: templateShared,
        mappings: Object.entries(mappings).map(([pattern, target]) => ({
          pattern: pattern.toLowerCase().replace(/[^a-z0-9]/g, ''),
          target,
        })),
      });

      // Reset form and close modal
      setTemplateName('');
      setTemplateDescription('');
      setTemplateShared(false);
      setSaveModalOpen(false);
    } catch (error) {
      console.error('[SmartColumnMapper] Failed to save template:', error);
    } finally {
      setSavingTemplate(false);
    }
  };

  /**
   * Confirm mappings
   */
  const handleConfirm = () => {
    onConfirm(mappings);
  };

  return (
    <div className={`rounded-lg border border-gray-200 bg-white shadow-sm ${className}`}>
      {/* Header */}
      <div className="border-b border-gray-200 bg-gray-50 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              <Sparkles className="mr-2 inline-block h-5 w-5 text-blue-600" aria-hidden="true" />
              Smart Column Mapping
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              AI-powered suggestions to map your columns automatically
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Template Selector */}
            {templates.length > 0 && (
              <Select.Root onValueChange={handleApplyTemplate}>
                <Select.Trigger
                  className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm hover:bg-gray-50 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={loadingTemplates}
                  aria-label="Select template"
                >
                  <Select.Value placeholder="Apply Template" />
                  <Select.Icon>
                    <ChevronDown className="h-4 w-4 text-gray-500" aria-hidden="true" />
                  </Select.Icon>
                </Select.Trigger>

                <Select.Portal>
                  <Select.Content
                    className="overflow-hidden rounded-md border border-gray-200 bg-white shadow-lg"
                    position="popper"
                    sideOffset={5}
                  >
                    <Select.Viewport className="p-1">
                      {templates.map((template) => (
                        <Select.Item
                          key={template.id}
                          value={template.id}
                          className="relative flex cursor-pointer select-none items-center rounded px-8 py-2 text-sm text-gray-900 outline-none hover:bg-blue-50 focus:bg-blue-50"
                        >
                          <Select.ItemIndicator className="absolute left-2">
                            <Check className="h-4 w-4 text-blue-600" aria-hidden="true" />
                          </Select.ItemIndicator>
                          <Select.ItemText>{template.name}</Select.ItemText>
                        </Select.Item>
                      ))}
                    </Select.Viewport>
                  </Select.Content>
                </Select.Portal>
              </Select.Root>
            )}

            {/* Re-analyze Button */}
            <button
              type="button"
              onClick={reAnalyze}
              disabled={analyzingColumns}
              className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Re-analyze columns"
            >
              <RefreshCw
                className={`h-4 w-4 ${analyzingColumns ? 'animate-spin' : ''}`}
                aria-hidden="true"
              />
              Re-analyze
            </button>
          </div>
        </div>

        {/* Matched Template Banner */}
        {matchedTemplate && (
          <div className="mt-3 rounded-md bg-blue-50 p-3">
            <p className="text-sm text-blue-800">
              <strong>Template Match:</strong> "{matchedTemplate.name}" ({matchedTemplate.matchScore}% match)
            </p>
          </div>
        )}
      </div>

      {/* Loading State */}
      {analyzingColumns && (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <RefreshCw className="mx-auto h-8 w-8 animate-spin text-blue-600" aria-hidden="true" />
            <p className="mt-2 text-sm text-gray-600">Analyzing columns...</p>
          </div>
        </div>
      )}

      {/* Error State */}
      {analysisError && (
        <div className="m-6 rounded-md bg-red-50 p-4">
          <p className="text-sm text-red-800">
            Failed to analyze columns: {analysisError.message}
          </p>
        </div>
      )}

      {/* Mapping Table */}
      {!analyzingColumns && !analysisError && aiSuggestions.length > 0 && (
        <>
          {/* Actions Bar */}
          <div className="border-b border-gray-200 bg-gray-50 px-6 py-3">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-600">
                {headers.length} columns detected
              </p>
              <AcceptAllButton
                highConfidenceCount={highConfidenceCount}
                onClick={handleAcceptAll}
              />
            </div>
          </div>

          {/* Table Header */}
          <div className="grid grid-cols-12 gap-4 border-b border-gray-200 bg-gray-100 px-6 py-3 text-xs font-semibold uppercase tracking-wide text-gray-700">
            <div className="col-span-3">Source Column</div>
            <div className="col-span-2">Confidence</div>
            <div className="col-span-4">Map To</div>
            <div className="col-span-3">Alternatives</div>
          </div>

          {/* Mapping Rows */}
          <div className="max-h-96 overflow-y-auto px-6">
            {aiSuggestions.map((suggestion) => (
              <MappingRow
                key={suggestion.sourceColumn}
                suggestion={suggestion}
                targetOptions={TARGET_FIELD_OPTIONS}
                sampleData={getSampleData(suggestion.sourceColumn)}
                selectedTarget={mappings[suggestion.sourceColumn] || 'ignore'}
                onChange={(target) =>
                  handleMappingChange(suggestion.sourceColumn, target)
                }
              />
            ))}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-gray-200 bg-gray-50 px-6 py-4">
            <button
              type="button"
              onClick={() => setSaveModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              <Save className="h-4 w-4" aria-hidden="true" />
              Save as Template
            </button>

            <div className="flex items-center gap-3">
              {onCancel && (
                <button
                  type="button"
                  onClick={onCancel}
                  className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                >
                  Cancel
                </button>
              )}

              <button
                type="button"
                onClick={handleConfirm}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                Confirm Mapping
              </button>
            </div>
          </div>
        </>
      )}

      {/* Save Template Modal */}
      <Dialog.Root open={saveModalOpen} onOpenChange={setSaveModalOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
          <Dialog.Content className="fixed left-1/2 top-1/2 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border border-gray-200 bg-white p-6 shadow-xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]">
            <Dialog.Title className="text-lg font-semibold text-gray-900">
              Save as Template
            </Dialog.Title>
            <Dialog.Description className="mt-2 text-sm text-gray-600">
              Save current column mappings as a reusable template
            </Dialog.Description>

            <div className="mt-4 space-y-4">
              {/* Template Name */}
              <div>
                <label
                  htmlFor="template-name"
                  className="block text-sm font-medium text-gray-700"
                >
                  Template Name
                </label>
                <input
                  id="template-name"
                  type="text"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Standard BOM Format"
                  required
                />
              </div>

              {/* Template Description */}
              <div>
                <label
                  htmlFor="template-description"
                  className="block text-sm font-medium text-gray-700"
                >
                  Description (Optional)
                </label>
                <textarea
                  id="template-description"
                  value={templateDescription}
                  onChange={(e) => setTemplateDescription(e.target.value)}
                  rows={3}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Brief description of this template"
                />
              </div>

              {/* Sharing Toggle */}
              <div className="flex items-center gap-2">
                <input
                  id="template-shared"
                  type="checkbox"
                  checked={templateShared}
                  onChange={(e) => setTemplateShared(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500"
                />
                <label htmlFor="template-shared" className="text-sm text-gray-700">
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
                  disabled={savingTemplate}
                >
                  Cancel
                </button>
              </Dialog.Close>

              <button
                type="button"
                onClick={handleSaveTemplate}
                disabled={!templateName.trim() || savingTemplate}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {savingTemplate ? 'Saving...' : 'Save Template'}
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

SmartColumnMapper.displayName = 'SmartColumnMapper';
