/**
 * Mapping Row Component
 * Displays a single column mapping with AI suggestions
 * @module components/bom/MappingRow
 */

import React from 'react';
import * as Select from '@radix-ui/react-select';
import { ChevronDown, Check } from 'lucide-react';
import { ConfidenceBadge } from './ConfidenceBadge';
import { AIReasoningTooltip } from './AIReasoningTooltip';
import type { ColumnSuggestion, TargetFieldOption } from '../../types/column-mapping';

export interface MappingRowProps {
  /** Column suggestion data */
  suggestion: ColumnSuggestion;
  /** Available target field options */
  targetOptions: TargetFieldOption[];
  /** Sample data preview (first few values) */
  sampleData?: unknown[];
  /** Selected target field */
  selectedTarget: string;
  /** Change handler */
  onChange: (target: string) => void;
  /** Optional CSS class name */
  className?: string;
}

/**
 * Format sample data for preview
 */
function formatSampleData(data: unknown[]): string {
  if (!data || data.length === 0) return 'No data';

  const validData = data.filter((d) => d !== null && d !== undefined && d !== '');
  if (validData.length === 0) return 'Empty values';

  // Show first 3 non-empty values
  const preview = validData.slice(0, 3).map(String).join(', ');
  const remaining = validData.length - 3;

  return remaining > 0 ? `${preview}, +${remaining} more` : preview;
}

/**
 * Truncate text with ellipsis
 */
function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}...`;
}

/**
 * Mapping Row Component
 *
 * Displays a single column mapping row with:
 * - Source column name
 * - AI confidence badge
 * - Sample data preview
 * - Target field selector
 * - Alternative suggestions
 * - AI reasoning tooltip
 *
 * @example
 * ```tsx
 * <MappingRow
 *   suggestion={suggestion}
 *   targetOptions={TARGET_OPTIONS}
 *   sampleData={['ABC123', 'DEF456']}
 *   selectedTarget="manufacturer_part_number"
 *   onChange={(target) => handleChange(target)}
 * />
 * ```
 */
export const MappingRow: React.FC<MappingRowProps> = ({
  suggestion,
  targetOptions,
  sampleData = [],
  selectedTarget,
  onChange,
  className = '',
}) => {
  const { sourceColumn, confidence, matchReason, alternatives } = suggestion;

  return (
    <div
      className={`grid grid-cols-12 items-center gap-4 border-b border-gray-200 py-3 ${className}`}
    >
      {/* Source Column */}
      <div className="col-span-3">
        <p className="font-medium text-gray-900" title={sourceColumn}>
          {truncate(sourceColumn, 30)}
        </p>
        <p className="text-xs text-gray-500" title={formatSampleData(sampleData)}>
          {truncate(formatSampleData(sampleData), 40)}
        </p>
      </div>

      {/* Confidence Badge */}
      <div className="col-span-2 flex items-center gap-2">
        <ConfidenceBadge confidence={confidence} />
        <AIReasoningTooltip
          matchReason={matchReason}
          sourceColumn={sourceColumn}
          targetField={selectedTarget}
        />
      </div>

      {/* Target Field Selector */}
      <div className="col-span-4">
        <Select.Root value={selectedTarget} onValueChange={onChange}>
          <Select.Trigger
            className="inline-flex w-full items-center justify-between rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm hover:bg-gray-50 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label={`Map ${sourceColumn} to`}
          >
            <Select.Value />
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
                {targetOptions.map((option) => (
                  <Select.Item
                    key={option.value}
                    value={option.value}
                    className="relative flex cursor-pointer select-none items-center rounded px-8 py-2 text-sm text-gray-900 outline-none hover:bg-blue-50 focus:bg-blue-50 data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
                  >
                    <Select.ItemIndicator className="absolute left-2 inline-flex items-center">
                      <Check className="h-4 w-4 text-blue-600" aria-hidden="true" />
                    </Select.ItemIndicator>
                    <Select.ItemText>{option.label}</Select.ItemText>
                  </Select.Item>
                ))}
              </Select.Viewport>
            </Select.Content>
          </Select.Portal>
        </Select.Root>
      </div>

      {/* Alternative Suggestions */}
      <div className="col-span-3">
        {alternatives.length > 0 ? (
          <div className="text-xs text-gray-600">
            <p className="mb-1 font-medium">Alternatives:</p>
            <ul className="space-y-0.5">
              {alternatives.map((alt) => {
                const label = targetOptions.find((o) => o.value === alt.target)?.label;
                return (
                  <li key={alt.target} className="flex items-center justify-between">
                    <span className="truncate" title={label}>
                      {truncate(label || alt.target, 20)}
                    </span>
                    <span className="ml-2 text-gray-500">{alt.confidence}%</span>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : (
          <p className="text-xs text-gray-400">No alternatives</p>
        )}
      </div>
    </div>
  );
};

MappingRow.displayName = 'MappingRow';
