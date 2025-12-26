/**
 * useFileQueue Hook
 *
 * Handles file upload queue management for BOM workflow.
 * Part of the split useBOMWorkflow hook.
 *
 * @module hooks/bom-workflow/useFileQueue
 */

import { useState, useCallback, useMemo } from 'react';
import type { QueueItem, QueueItemStatus, ColumnMapping, QueueMetrics } from '../../bom/workflow';

// ============================================================
// Constants
// ============================================================

const ALLOWED_EXTENSIONS = ['csv', 'xlsx', 'xls', 'txt'];

// ============================================================
// Types
// ============================================================

export interface UseFileQueueReturn {
  // State
  queue: QueueItem[];
  queueMetrics: QueueMetrics;
  dragActive: boolean;
  currentQueueStatus: QueueItemStatus | null;

  // File operations
  handleDrag: (e: React.DragEvent) => void;
  handleDrop: (e: React.DragEvent) => void;
  handleFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  addFileToQueue: (file: File, onAdd?: (item: QueueItem) => void) => void;

  // Queue operations
  updateQueueItem: (itemId: string, updates: Partial<QueueItem>) => void;
  updateMapping: (itemId: string, source: string, target: string) => void;
  toggleExpand: (itemId: string) => void;
  deleteItem: (itemId: string) => void;
  downloadFile: (item: QueueItem) => void;
  getQueueItem: (itemId: string) => QueueItem | undefined;

  // Reset
  resetQueue: () => void;
}

// ============================================================
// Hook Implementation
// ============================================================

export function useFileQueue(): UseFileQueueReturn {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [dragActive, setDragActive] = useState(false);

  // Calculate queue metrics
  const queueMetrics: QueueMetrics = useMemo(
    () => ({
      pending: queue.filter((q) => q.status === 'pending').length,
      processing: queue.filter((q) =>
        ['parsing', 'uploading', 'mapping', 'confirming', 'saving'].includes(q.status)
      ).length,
      completed: queue.filter((q) => q.status === 'completed').length,
      failed: queue.filter((q) => q.status === 'error').length,
    }),
    [queue]
  );

  // Get current status for stepper
  const currentQueueStatus = queue.length > 0 ? queue[0].status : null;

  // ============================================================
  // File Handling
  // ============================================================

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(e.type === 'dragenter' || e.type === 'dragover');
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = Array.from(e.dataTransfer.files);
    files.forEach((file) => addFileToQueue(file));
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    files.forEach((file) => addFileToQueue(file));
    e.target.value = '';
  }, []);

  const addFileToQueue = useCallback((file: File, onAdd?: (item: QueueItem) => void) => {
    const ext = file.name.split('.').pop()?.toLowerCase();

    if (!ext || !ALLOWED_EXTENSIONS.includes(ext)) {
      return; // Skip invalid files
    }

    const newItem: QueueItem = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      file,
      status: 'pending',
      expanded: false,
    };

    setQueue((prev) => [...prev, newItem]);

    // Call callback if provided (for auto-parsing)
    if (onAdd) {
      setTimeout(() => onAdd(newItem), 100);
    }
  }, []);

  // ============================================================
  // Queue Operations
  // ============================================================

  const updateQueueItem = useCallback((itemId: string, updates: Partial<QueueItem>) => {
    setQueue((prev) => prev.map((q) => (q.id === itemId ? { ...q, ...updates } : q)));
  }, []);

  const updateMapping = useCallback((itemId: string, source: string, target: string) => {
    setQueue((prev) =>
      prev.map((q) => {
        if (q.id !== itemId) return q;
        return {
          ...q,
          columnMappings: q.columnMappings?.map((m) =>
            m.source === source ? { ...m, target: target as ColumnMapping['target'] } : m
          ),
        };
      })
    );
  }, []);

  const toggleExpand = useCallback((itemId: string) => {
    setQueue((prev) => prev.map((q) => (q.id === itemId ? { ...q, expanded: !q.expanded } : q)));
  }, []);

  const deleteItem = useCallback((itemId: string) => {
    setQueue((prev) => prev.filter((q) => q.id !== itemId));
  }, []);

  const downloadFile = useCallback((item: QueueItem) => {
    const url = URL.createObjectURL(item.file);
    const link = document.createElement('a');
    link.href = url;
    link.download = item.file.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, []);

  const getQueueItem = useCallback(
    (itemId: string) => {
      return queue.find((q) => q.id === itemId);
    },
    [queue]
  );

  const resetQueue = useCallback(() => {
    setQueue([]);
  }, []);

  return {
    // State
    queue,
    queueMetrics,
    dragActive,
    currentQueueStatus,

    // File operations
    handleDrag,
    handleDrop,
    handleFileSelect,
    addFileToQueue,

    // Queue operations
    updateQueueItem,
    updateMapping,
    toggleExpand,
    deleteItem,
    downloadFile,
    getQueueItem,

    // Reset
    resetQueue,
  };
}

export default useFileQueue;
