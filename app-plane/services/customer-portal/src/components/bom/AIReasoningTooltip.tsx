/**
 * AI Reasoning Tooltip Component
 * Shows why AI made a particular suggestion
 * @module components/bom/AIReasoningTooltip
 */

import React from 'react';
import * as Tooltip from '@radix-ui/react-tooltip';
import { HelpCircle } from 'lucide-react';
import type { MatchReason } from '../../types/column-mapping';

export interface AIReasoningTooltipProps {
  /** Reason for the match */
  matchReason: MatchReason;
  /** Source column name */
  sourceColumn: string;
  /** Target field that was suggested */
  targetField: string;
  /** Optional CSS class name */
  className?: string;
}

/**
 * Get human-readable explanation for match reason
 */
function getReasoningExplanation(
  matchReason: MatchReason,
  sourceColumn: string,
  targetField: string
): { title: string; description: string } {
  switch (matchReason) {
    case 'exact_match':
      return {
        title: 'Exact Match',
        description: `Column name "${sourceColumn}" exactly matches known patterns for ${targetField.replace(/_/g, ' ')}.`,
      };
    case 'fuzzy_match':
      return {
        title: 'Fuzzy Match',
        description: `Column name "${sourceColumn}" is very similar to known patterns for ${targetField.replace(/_/g, ' ')}.`,
      };
    case 'pattern_match':
      return {
        title: 'Pattern Match',
        description: `Column name pattern suggests this is ${targetField.replace(/_/g, ' ')}.`,
      };
    case 'sample_analysis':
      return {
        title: 'Sample Analysis',
        description: `Sample data values indicate this column contains ${targetField.replace(/_/g, ' ')} data.`,
      };
  }
}

/**
 * AI Reasoning Tooltip Component
 *
 * Displays an info icon with tooltip explaining why the AI
 * made a particular mapping suggestion.
 *
 * @example
 * ```tsx
 * <AIReasoningTooltip
 *   matchReason="exact_match"
 *   sourceColumn="Part Number"
 *   targetField="manufacturer_part_number"
 * />
 * ```
 */
export const AIReasoningTooltip: React.FC<AIReasoningTooltipProps> = ({
  matchReason,
  sourceColumn,
  targetField,
  className = '',
}) => {
  const { title, description } = getReasoningExplanation(
    matchReason,
    sourceColumn,
    targetField
  );

  return (
    <Tooltip.Provider delayDuration={300}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <button
            type="button"
            className={`inline-flex items-center justify-center rounded-full p-1 text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${className}`}
            aria-label={`Why this suggestion: ${title}`}
          >
            <HelpCircle className="h-4 w-4" aria-hidden="true" />
            <span className="sr-only">Why this suggestion</span>
          </button>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            className="max-w-xs select-none rounded-md bg-gray-900 px-3 py-2 text-sm text-white shadow-lg"
            sideOffset={5}
          >
            <p className="mb-1 font-semibold">{title}</p>
            <p className="text-gray-300">{description}</p>
            <Tooltip.Arrow className="fill-gray-900" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
};

AIReasoningTooltip.displayName = 'AIReasoningTooltip';
