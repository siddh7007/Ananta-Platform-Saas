/**
 * React hook for column mapping suggestions
 * Provides AI-powered suggestions with loading/error states
 * @module hooks/useColumnSuggestions
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  analyzeColumns,
  type ColumnAnalysisRequest,
  type ColumnAnalysisResponse,
  type ColumnSuggestion,
} from '../services/column-mapping.service';

export interface UseColumnSuggestionsOptions {
  /** Column headers to analyze */
  headers: string[];
  /** Sample data rows for pattern analysis */
  sampleRows: Record<string, unknown>[];
  /** Tenant ID for template matching */
  tenantId: string;
  /** Whether to auto-trigger analysis on mount */
  autoAnalyze?: boolean;
}

export interface UseColumnSuggestionsResult {
  /** AI-generated suggestions */
  suggestions: ColumnSuggestion[];
  /** Matched template if found */
  matchedTemplate?: {
    id: string;
    name: string;
    matchScore: number;
  };
  /** Loading state */
  loading: boolean;
  /** Error if analysis failed */
  error: Error | null;
  /** Manually trigger re-analysis */
  reAnalyze: () => Promise<void>;
}

/**
 * Hook for AI-powered column mapping suggestions
 *
 * @example
 * ```tsx
 * const { suggestions, loading, error, reAnalyze } = useColumnSuggestions({
 *   headers: ['Part Number', 'Qty', 'Mfr'],
 *   sampleRows: [{ 'Part Number': 'ABC123', 'Qty': '10', 'Mfr': 'Acme' }],
 *   tenantId: 'tenant-123',
 *   autoAnalyze: true,
 * });
 *
 * if (loading) return <Spinner />;
 * if (error) return <ErrorMessage error={error} />;
 *
 * return (
 *   <div>
 *     {suggestions.map(s => (
 *       <MappingRow key={s.sourceColumn} suggestion={s} />
 *     ))}
 *     <button onClick={reAnalyze}>Re-analyze</button>
 *   </div>
 * );
 * ```
 */
export function useColumnSuggestions({
  headers,
  sampleRows,
  tenantId,
  autoAnalyze = true,
}: UseColumnSuggestionsOptions): UseColumnSuggestionsResult {
  const [suggestions, setSuggestions] = useState<ColumnSuggestion[]>([]);
  const [matchedTemplate, setMatchedTemplate] = useState<{
    id: string;
    name: string;
    matchScore: number;
  }>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Track if initial analysis has been done to prevent duplicate calls
  const hasAnalyzed = useRef(false);

  // Store analyze function in ref to use in useEffect without dependency issues
  const analyzeRef = useRef<() => Promise<void>>();

  /**
   * Perform column analysis
   */
  const analyze = useCallback(async () => {
    if (headers.length === 0) {
      setSuggestions([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const request: ColumnAnalysisRequest = {
        headers,
        sampleRows,
        tenantId,
      };

      const response: ColumnAnalysisResponse = await analyzeColumns(request);

      setSuggestions(response.suggestions);
      setMatchedTemplate(response.matchedTemplate);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Analysis failed');
      setError(error);
      console.error('[useColumnSuggestions] Analysis error:', error);
    } finally {
      setLoading(false);
    }
  }, [headers, sampleRows, tenantId]);

  // Keep ref updated with latest analyze function
  useEffect(() => {
    analyzeRef.current = analyze;
  }, [analyze]);

  /**
   * Manually trigger re-analysis
   */
  const reAnalyze = useCallback(async () => {
    await analyze();
  }, [analyze]);

  /**
   * Auto-trigger analysis on mount if enabled
   * Uses hasAnalyzed ref to prevent duplicate calls when dependencies change
   */
  useEffect(() => {
    if (autoAnalyze && headers.length > 0 && !hasAnalyzed.current) {
      hasAnalyzed.current = true;
      analyzeRef.current?.();
    }
    // Reset hasAnalyzed when headers change (new file uploaded)
    return () => {
      // Only reset if headers actually changed, not on unmount
    };
  }, [autoAnalyze, headers.length]);

  // Reset analysis state when headers change (new file)
  useEffect(() => {
    hasAnalyzed.current = false;
  }, [headers]);

  return {
    suggestions,
    matchedTemplate,
    loading,
    error,
    reAnalyze,
  };
}
