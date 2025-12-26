/**
 * Accept All High-Confidence Button Component
 * Bulk accepts all mappings with high confidence (>=90%)
 * @module components/bom/AcceptAllButton
 */

import React from 'react';
import { CheckCheck } from 'lucide-react';

export interface AcceptAllButtonProps {
  /** Number of high-confidence suggestions */
  highConfidenceCount: number;
  /** Click handler */
  onClick: () => void;
  /** Disabled state */
  disabled?: boolean;
  /** Loading state */
  loading?: boolean;
  /** Optional CSS class name */
  className?: string;
}

/**
 * Accept All High-Confidence Button
 *
 * Displays a button to bulk accept all high-confidence (>=90%) mappings.
 * Automatically disabled when no high-confidence suggestions are available.
 *
 * @example
 * ```tsx
 * <AcceptAllButton
 *   highConfidenceCount={5}
 *   onClick={() => handleAcceptAll()}
 * />
 * ```
 */
export const AcceptAllButton: React.FC<AcceptAllButtonProps> = ({
  highConfidenceCount,
  onClick,
  disabled = false,
  loading = false,
  className = '',
}) => {
  const isDisabled = disabled || highConfidenceCount === 0;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isDisabled || loading}
      className={`inline-flex items-center gap-2 rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      aria-label={
        highConfidenceCount > 0
          ? `Accept ${highConfidenceCount} high-confidence suggestion${highConfidenceCount !== 1 ? 's' : ''}`
          : 'No high-confidence suggestions to accept'
      }
    >
      <CheckCheck className="h-4 w-4" aria-hidden="true" />
      <span>
        {loading
          ? 'Accepting...'
          : highConfidenceCount > 0
            ? `Accept All (${highConfidenceCount})`
            : 'Accept All'}
      </span>
    </button>
  );
};

AcceptAllButton.displayName = 'AcceptAllButton';
