/**
 * Hook for parsing BOM files using Web Worker
 * Provides non-blocking file parsing with progress updates
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import type { ParsedBOM, WorkerResponse } from '@/workers/bom-parser.worker';

interface UseBomParserState {
  isLoading: boolean;
  progress: number;
  progressMessage: string;
  error: string | null;
  result: ParsedBOM | null;
}

interface UseBomParserReturn extends UseBomParserState {
  parseFile: (file: File) => Promise<ParsedBOM>;
  abort: () => void;
  reset: () => void;
}

// Debounce progress updates to avoid render thrash (50ms)
const PROGRESS_DEBOUNCE_MS = 50;

/**
 * Parse BOM files in a Web Worker to avoid blocking the UI
 * Falls back to main thread parsing if Web Workers aren't supported
 */
export function useBomParser(): UseBomParserReturn {
  const [state, setState] = useState<UseBomParserState>({
    isLoading: false,
    progress: 0,
    progressMessage: '',
    error: null,
    result: null,
  });

  const workerRef = useRef<Worker | null>(null);
  const isMountedRef = useRef(true);
  const lastProgressUpdateRef = useRef(0);
  const progressTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Track mounted state for safe setState
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      // Cleanup on unmount
      if (workerRef.current) {
        workerRef.current.postMessage({ type: 'abort' });
        workerRef.current.terminate();
        workerRef.current = null;
      }
      if (progressTimeoutRef.current) {
        clearTimeout(progressTimeoutRef.current);
      }
    };
  }, []);

  // Safe setState that checks if still mounted
  const safeSetState = useCallback((
    updater: UseBomParserState | ((prev: UseBomParserState) => UseBomParserState)
  ) => {
    if (isMountedRef.current) {
      setState(updater);
    }
  }, []);

  // Debounced progress update
  const updateProgress = useCallback((progress: number, message: string) => {
    const now = Date.now();
    const timeSinceLastUpdate = now - lastProgressUpdateRef.current;

    if (timeSinceLastUpdate >= PROGRESS_DEBOUNCE_MS) {
      // Update immediately if enough time has passed
      lastProgressUpdateRef.current = now;
      safeSetState((prev) => ({
        ...prev,
        progress,
        progressMessage: message,
      }));
    } else {
      // Debounce rapid updates
      if (progressTimeoutRef.current) {
        clearTimeout(progressTimeoutRef.current);
      }
      progressTimeoutRef.current = setTimeout(() => {
        lastProgressUpdateRef.current = Date.now();
        safeSetState((prev) => ({
          ...prev,
          progress,
          progressMessage: message,
        }));
      }, PROGRESS_DEBOUNCE_MS - timeSinceLastUpdate);
    }
  }, [safeSetState]);

  const abort = useCallback(() => {
    if (workerRef.current) {
      workerRef.current.postMessage({ type: 'abort' });
      workerRef.current.terminate();
      workerRef.current = null;
    }
    if (progressTimeoutRef.current) {
      clearTimeout(progressTimeoutRef.current);
    }
    safeSetState({
      isLoading: false,
      progress: 0,
      progressMessage: '',
      error: 'Parsing cancelled',
      result: null,
    });
  }, [safeSetState]);

  const parseFile = useCallback(async (file: File): Promise<ParsedBOM> => {
    // Abort any existing operation
    if (workerRef.current) {
      workerRef.current.postMessage({ type: 'abort' });
      workerRef.current.terminate();
      workerRef.current = null;
    }

    safeSetState({
      isLoading: true,
      progress: 0,
      progressMessage: 'Starting...',
      error: null,
      result: null,
    });

    return new Promise((resolve, reject) => {
      // Check if Web Workers are supported
      if (typeof Worker === 'undefined') {
        // Fall back to main thread parsing
        safeSetState((prev) => ({
          ...prev,
          progressMessage: 'Web Workers not supported, parsing on main thread...',
        }));

        import('@/utils/bomParser')
          .then(({ parseBOMFile }) => parseBOMFile(file))
          .then((result) => {
            safeSetState({
              isLoading: false,
              progress: 100,
              progressMessage: 'Complete',
              error: null,
              result,
            });
            resolve(result);
          })
          .catch((error) => {
            const errorMsg = error instanceof Error ? error.message : 'Parsing failed';
            safeSetState({
              isLoading: false,
              progress: 0,
              progressMessage: '',
              error: errorMsg,
              result: null,
            });
            reject(new Error(errorMsg));
          });
        return;
      }

      // Create Web Worker
      const worker = new Worker(
        new URL('../workers/bom-parser.worker.ts', import.meta.url),
        { type: 'module' }
      );
      workerRef.current = worker;

      // Handle worker messages
      worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
        const { type, payload } = event.data;

        if (type === 'progress') {
          const progressPayload = payload as { progress: number; message: string };
          updateProgress(progressPayload.progress, progressPayload.message);
        } else if (type === 'success') {
          const result = payload as ParsedBOM;
          safeSetState({
            isLoading: false,
            progress: 100,
            progressMessage: 'Complete',
            error: null,
            result,
          });
          worker.terminate();
          workerRef.current = null;
          resolve(result);
        } else if (type === 'error') {
          const errorPayload = payload as { error: string };
          // Don't update state if aborted (already handled by abort())
          if (errorPayload.error !== 'Operation aborted by user') {
            safeSetState({
              isLoading: false,
              progress: 0,
              progressMessage: '',
              error: errorPayload.error,
              result: null,
            });
          }
          worker.terminate();
          workerRef.current = null;
          reject(new Error(errorPayload.error));
        }
      };

      worker.onerror = (error) => {
        const errorMsg = error.message || 'Worker error';
        safeSetState({
          isLoading: false,
          progress: 0,
          progressMessage: '',
          error: errorMsg,
          result: null,
        });
        worker.terminate();
        workerRef.current = null;
        reject(new Error(errorMsg));
      };

      // Read file and send to worker
      const reader = new FileReader();
      reader.onload = () => {
        // Check if component is still mounted
        if (!isMountedRef.current || !workerRef.current) {
          return;
        }

        if (reader.result instanceof ArrayBuffer) {
          worker.postMessage({
            type: 'parse',
            payload: {
              file: reader.result,
              fileName: file.name,
              fileType: file.type,
            },
          });
        }
      };
      reader.onerror = () => {
        const errorMsg = 'Failed to read file';
        safeSetState({
          isLoading: false,
          progress: 0,
          progressMessage: '',
          error: errorMsg,
          result: null,
        });
        worker.terminate();
        workerRef.current = null;
        reject(new Error(errorMsg));
      };
      reader.readAsArrayBuffer(file);
    });
  }, [safeSetState, updateProgress]);

  const reset = useCallback(() => {
    if (workerRef.current) {
      workerRef.current.postMessage({ type: 'abort' });
      workerRef.current.terminate();
      workerRef.current = null;
    }
    if (progressTimeoutRef.current) {
      clearTimeout(progressTimeoutRef.current);
    }
    safeSetState({
      isLoading: false,
      progress: 0,
      progressMessage: '',
      error: null,
      result: null,
    });
  }, [safeSetState]);

  return {
    ...state,
    parseFile,
    abort,
    reset,
  };
}

export default useBomParser;
