/**
 * Confidence Badge Component
 * Displays confidence level with color-coding and tooltip
 * @module components/bom/ConfidenceBadge
 */

import React from 'react';
import * as Tooltip from '@radix-ui/react-tooltip';
import type { ConfidenceLevel } from '../../types/column-mapping';

export interface ConfidenceBadgeProps {
  /** Confidence score 0-100 */
  confidence: number;
  /** Optional CSS class name */
  className?: string;
}

/**
 * Get confidence level category from score
 */
function getConfidenceLevel(confidence: number): ConfidenceLevel {
  if (confidence >= 90) return 'high';
  if (confidence >= 70) return 'medium';
  return 'low';
}

/**
 * Get badge colors based on confidence level
 */
function getBadgeColors(level: ConfidenceLevel): {
  bg: string;
  text: string;
  border: string;
} {
  switch (level) {
    case 'high':
      return {
        bg: 'bg-green-100',
        text: 'text-green-800',
        border: 'border-green-300',
      };
    case 'medium':
      return {
        bg: 'bg-yellow-100',
        text: 'text-yellow-800',
        border: 'border-yellow-300',
      };
    case 'low':
      return {
        bg: 'bg-red-100',
        text: 'text-red-800',
        border: 'border-red-300',
      };
  }
}

/**
 * Get label for confidence level
 */
function getConfidenceLabel(level: ConfidenceLevel): string {
  switch (level) {
    case 'high':
      return 'High confidence';
    case 'medium':
      return 'Medium confidence';
    case 'low':
      return 'Low confidence';
  }
}

/**
 * Confidence Badge Component
 *
 * Displays confidence score with appropriate color-coding:
 * - Green (>=90%): High confidence
 * - Yellow (70-89%): Medium confidence
 * - Red (<70%): Low confidence
 *
 * @example
 * ```tsx
 * <ConfidenceBadge confidence={95} />
 * <ConfidenceBadge confidence={75} />
 * <ConfidenceBadge confidence={50} />
 * ```
 */
export const ConfidenceBadge: React.FC<ConfidenceBadgeProps> = ({
  confidence,
  className = '',
}) => {
  const level = getConfidenceLevel(confidence);
  const colors = getBadgeColors(level);
  const label = getConfidenceLabel(level);

  return (
    <Tooltip.Provider delayDuration={300}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <span
            className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors ${colors.bg} ${colors.text} ${colors.border} ${className}`}
            aria-label={`${label}: ${confidence}%`}
          >
            <span className="sr-only">{label}</span>
            <span aria-hidden="true">{confidence}%</span>
          </span>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            className="select-none rounded-md bg-gray-900 px-3 py-2 text-sm text-white shadow-lg"
            sideOffset={5}
          >
            <p className="font-medium">{label}</p>
            <p className="text-gray-300">Confidence: {confidence}%</p>
            <Tooltip.Arrow className="fill-gray-900" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
};

ConfidenceBadge.displayName = 'ConfidenceBadge';
