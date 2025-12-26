/**
 * useBOMWorkflow Hook
 *
 * Manages the complete BOM upload workflow state and API interactions.
 * Extracted from StaffBOMWorkflow for better separation of concerns.
 *
 * Features:
 * - File queue management (add, remove, update status)
 * - Column mapping state
 * - Enrichment coordination
 * - Risk analysis
 * - Phase progression (upload → enriching → analyzing → complete)
 *
 * @module hooks/useBOMWorkflow
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
import { CNS_API_URL, CNS_STAFF_ORGANIZATION_ID, getAuthHeaders } from '../config/api';
import { useEnrichmentPolling } from './useEnrichmentPolling';
import type { QueueItem, QueueItemStatus, ColumnMapping, QueueMetrics } from '../bom/workflow';

// ============================================================
// Types
// ============================================================

export type WorkflowPhase = 'upload' | 'enriching' | 'analyzing' | 'complete';

export interface RiskMetrics {
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  score: number;
  lifecycleRisk: number;
  supplyChainRisk: number;
  complianceRisk: number;
  highRiskCount: number;
  alertCount: number;
}

export interface EnrichmentComponent {
  id: string;
  mpn: string;
  manufacturer?: string;
  status: 'pending' | 'enriching' | 'enriched' | 'failed' | 'not_found';
  qualityScore?: number;
  riskScore?: number;
  supplier?: string;
  error?: string;
}

export interface UseBOMWorkflowOptions {
  /** Resume from existing BOM ID */
  resumeBomId?: string | null;
  /** Organization ID for staff operations */
  organizationId?: string;
}

export interface UseBOMWorkflowReturn {
  // State
  phase: WorkflowPhase;
  queue: QueueItem[];
  queueMetrics: QueueMetrics;
  enrichingBomId: string | null;
  enrichmentState: ReturnType<typeof useEnrichmentPolling>['state'];
  enrichmentMetrics: QueueMetrics;
  components: EnrichmentComponent[];
  riskMetrics: RiskMetrics | null;
  riskLoading: boolean;
  isStartingEnrichment: boolean;
  dragActive: boolean;

  // File Operations
  handleDrag: (e: React.DragEvent) => void;
  handleDrop: (e: React.DragEvent) => void;
  handleFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  addFileToQueue: (file: File) => void;

  // Queue Operations
  updateMapping: (itemId: string, source: string, target: string) => void;
  toggleExpand: (itemId: string) => void;
  deleteItem: (itemId: string) => void;
  downloadFile: (item: QueueItem) => void;
  confirmAndEnrich: (itemId: string) => Promise<void>;

  // Enrichment Operations
  startEnrichmentManually: () => Promise<void>;
  runRiskAnalysis: () => Promise<void>;

  // Workflow Control
  handleReset: () => void;
  setPhase: (phase: WorkflowPhase) => void;

  // Computed
  currentQueueStatus: QueueItemStatus | null;
  activeStep: number;
}

// ============================================================
// Helper Functions
// ============================================================

function normalizeField(field: string): ColumnMapping['target'] | null {
  const normalized = field.toLowerCase().replace(/[_\s-]/g, '');
  if (['partnumber', 'mpn', 'pn', 'partno', 'mfpn'].includes(normalized)) return 'mpn';
  if (['manufacturer', 'mfr', 'mfg', 'vendor', 'make'].includes(normalized)) return 'manufacturer';
  if (['quantity', 'qty', 'count', 'amount'].includes(normalized)) return 'quantity';
  if (['reference', 'refdes', 'designator', 'ref'].includes(normalized)) return 'reference';
  if (['description', 'desc', 'name', 'partdesc'].includes(normalized)) return 'description';
  return null;
}

function getActiveStep(phase: WorkflowPhase, queueStatus: QueueItemStatus | null): number {
  if (phase === 'complete') return 6;
  if (phase === 'analyzing') return 5;
  if (phase === 'enriching') return 4;

  switch (queueStatus) {
    case 'pending': return 0;
    case 'parsing':
    case 'uploading': return 1;
    case 'mapping': return 2;
    case 'confirming':
    case 'saving': return 3;
    case 'completed': return 4;
    case 'error': return -1;
    default: return 0;
  }
}

const ALLOWED_EXTENSIONS = ['csv', 'xlsx', 'xls', 'txt'];

// ============================================================
// Hook Implementation
// ============================================================

export function useBOMWorkflow(options: UseBOMWorkflowOptions = {}): UseBOMWorkflowReturn {
  const { resumeBomId = null, organizationId = CNS_STAFF_ORGANIZATION_ID } = options;

  // State
  const [phase, setPhase] = useState<WorkflowPhase>('upload');
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [enrichingBomId, setEnrichingBomId] = useState<string | null>(null);
  const [components, setComponents] = useState<EnrichmentComponent[]>([]);
  const [riskMetrics, setRiskMetrics] = useState<RiskMetrics | null>(null);
  const [riskLoading, setRiskLoading] = useState(false);
  const [isStartingEnrichment, setIsStartingEnrichment] = useState(false);

  // Resume from URL params
  useEffect(() => {
    if (resumeBomId) {
      setEnrichingBomId(resumeBomId);
      setPhase('enriching');
    }
  }, [resumeBomId]);

  // Enrichment polling
  const { state: enrichmentState } = useEnrichmentPolling({
    bomId: enrichingBomId || '',
    enabled: !!enrichingBomId && (phase === 'enriching' || phase === 'analyzing' || phase === 'complete'),
    pollInterval: 2000,
  });

  // Auto-advance phases based on enrichment state
  useEffect(() => {
    if (enrichmentState?.status === 'completed' && phase === 'enriching') {
      setPhase('analyzing');
      runRiskAnalysis();
    }
  }, [enrichmentState?.status, phase]);

  // Calculate queue metrics
  const queueMetrics: QueueMetrics = useMemo(() => ({
    pending: queue.filter(q => q.status === 'pending').length,
    processing: queue.filter(q => ['parsing', 'uploading', 'mapping', 'confirming', 'saving'].includes(q.status)).length,
    completed: queue.filter(q => q.status === 'completed').length,
    failed: queue.filter(q => q.status === 'error').length,
  }), [queue]);

  // Enrichment metrics
  const enrichmentMetrics = useMemo(() => ({
    pending: enrichmentState?.pending_items || 0,
    processing: 1, // Current enriching
    completed: enrichmentState?.enriched_items || 0,
    failed: (enrichmentState?.failed_items || 0) + (enrichmentState?.not_found_items || 0),
  }), [enrichmentState]);

  // Get current status for stepper
  const currentQueueStatus = queue.length > 0 ? queue[0].status : null;
  const activeStep = getActiveStep(phase, currentQueueStatus);

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
    files.forEach(file => addFileToQueue(file));
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    files.forEach(file => addFileToQueue(file));
    e.target.value = '';
  }, []);

  const addFileToQueue = useCallback((file: File) => {
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

    setQueue(prev => [...prev, newItem]);

    // Auto-start parsing
    setTimeout(() => parseFile(newItem.id, file), 100);
  }, []);

  // ============================================================
  // API Calls
  // ============================================================

  const parseFile = async (itemId: string, file: File) => {
    setQueue(prev => prev.map(q => q.id === itemId ? { ...q, status: 'parsing' } : q));

    if (!file) return;

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('source', 'staff');
      formData.append('organization_id', organizationId);

      const response = await fetch(`${CNS_API_URL}/bom/upload`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Parse failed');
      }

      const result = await response.json();

      // Build column mappings with sample data
      const mappings: ColumnMapping[] = [];

      if (result.detected_columns) {
        Object.entries(result.detected_columns).forEach(([field, sourceCol]) => {
          if (sourceCol) {
            const normalizedField = normalizeField(field);
            const samples = result.preview_data?.slice(0, 3).map((row: Record<string, unknown>) => String(row[sourceCol as string] || '')) || [];
            mappings.push({
              source: sourceCol as string,
              target: normalizedField || 'ignore',
              sampleData: samples,
            });
          }
        });
      }

      if (result.unmapped_columns) {
        result.unmapped_columns.forEach((col: string) => {
          const samples = result.preview_data?.slice(0, 3).map((row: Record<string, unknown>) => String(row[col] || '')) || [];
          mappings.push({ source: col, target: 'ignore', sampleData: samples });
        });
      }

      setQueue(prev => prev.map(q => q.id === itemId ? {
        ...q,
        status: 'mapping',
        totalRows: result.total_items,
        detectedColumns: result.detected_columns,
        unmappedColumns: result.unmapped_columns,
        previewData: result.preview_data,
        columnMappings: mappings,
        expanded: true,
      } : q));

    } catch (err) {
      setQueue(prev => prev.map(q => q.id === itemId ? {
        ...q,
        status: 'error',
        error: err instanceof Error ? err.message : 'Parse failed',
      } : q));
    }
  };

  const confirmAndEnrich = async (itemId: string) => {
    const item = queue.find(q => q.id === itemId);
    if (!item?.file || !item.columnMappings) return;

    setQueue(prev => prev.map(q => q.id === itemId ? { ...q, status: 'saving' } : q));

    try {
      const formData = new FormData();
      formData.append('file', item.file);
      formData.append('bom_name', `BOM Upload - ${item.file.name}`);
      formData.append('organization_id', organizationId);
      formData.append('source', 'staff_bulk');
      formData.append('priority', 'normal');
      formData.append('start_enrichment', 'true');
      formData.append('uploaded_by', localStorage.getItem('username') || 'cns-dashboard');

      // Column mappings: {canonical: csv_column}
      const mappingsObj: Record<string, string> = {};
      item.columnMappings.forEach(m => {
        if (m.target !== 'ignore') {
          mappingsObj[m.target] = m.source;
        }
      });
      formData.append('column_mappings', JSON.stringify(mappingsObj));

      const response = await fetch(`${CNS_API_URL}/boms/upload`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Upload failed');
      }

      const result = await response.json();
      const bomId = result.bom_id;

      setQueue(prev => prev.map(q => q.id === itemId ? {
        ...q,
        status: 'completed',
        bomId,
        expanded: false,
      } : q));

      // Start enrichment phase
      setEnrichingBomId(bomId);
      setPhase('enriching');

      // Initialize components list from line items
      if (result.line_items) {
        setComponents(result.line_items.map((li: { id: string; mpn: string; manufacturer?: string }) => ({
          id: li.id,
          mpn: li.mpn,
          manufacturer: li.manufacturer,
          status: 'pending',
        })));
      }

    } catch (err) {
      setQueue(prev => prev.map(q => q.id === itemId ? {
        ...q,
        status: 'error',
        error: err instanceof Error ? err.message : 'Upload failed',
      } : q));
    }
  };

  const startEnrichmentManually = async () => {
    if (!enrichingBomId) return;

    setIsStartingEnrichment(true);
    try {
      // First, get the BOM's organization_id from the status endpoint
      const statusResponse = await fetch(`${CNS_API_URL}/boms/${enrichingBomId}/enrichment/status`, {
        headers: getAuthHeaders(),
      });

      // Extract organization_id from BOM - fallback to configured org if not found
      let orgId = organizationId;
      if (statusResponse.ok) {
        const statusData = await statusResponse.json();
        if (statusData.organization_id) {
          orgId = statusData.organization_id;
        }
      }

      console.log(`[useBOMWorkflow] Starting enrichment for BOM ${enrichingBomId} with org ${orgId}`);

      const response = await fetch(`${CNS_API_URL}/boms/${enrichingBomId}/enrichment/start`, {
        method: 'POST',
        headers: {
          ...(getAuthHeaders() || {}),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          organization_id: orgId,
          priority: 7,
        }),
      });

      if (response.status === 409) {
        console.log('[useBOMWorkflow] Enrichment already in progress');
      } else if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Failed to start enrichment');
      } else {
        console.log('[useBOMWorkflow] Enrichment started successfully');
      }
    } catch (err) {
      console.error('[useBOMWorkflow] Error starting enrichment:', err);
    } finally {
      setIsStartingEnrichment(false);
    }
  };

  const runRiskAnalysis = async () => {
    if (!enrichingBomId) return;

    setRiskLoading(true);

    try {
      const response = await fetch(`${CNS_API_URL}/risk/boms/${enrichingBomId}`, {
        headers: { ...(getAuthHeaders() || {}), 'Content-Type': 'application/json' },
      });

      if (response.ok) {
        const data = await response.json();
        setRiskMetrics({
          grade: data.risk_grade || 'C',
          score: data.risk_score || 50,
          lifecycleRisk: data.lifecycle_risk || 30,
          supplyChainRisk: data.supply_chain_risk || 40,
          complianceRisk: data.compliance_risk || 20,
          highRiskCount: data.high_risk_count || 0,
          alertCount: data.alert_count || 0,
        });
      }
    } catch (err) {
      console.error('Risk analysis failed:', err);
    } finally {
      setRiskLoading(false);
      setPhase('complete');
    }
  };

  // ============================================================
  // Queue Operations
  // ============================================================

  const updateMapping = useCallback((itemId: string, source: string, target: string) => {
    setQueue(prev => prev.map(q => {
      if (q.id !== itemId) return q;
      return {
        ...q,
        columnMappings: q.columnMappings?.map(m =>
          m.source === source ? { ...m, target: target as ColumnMapping['target'] } : m
        ),
      };
    }));
  }, []);

  const toggleExpand = useCallback((itemId: string) => {
    setQueue(prev => prev.map(q =>
      q.id === itemId ? { ...q, expanded: !q.expanded } : q
    ));
  }, []);

  const deleteItem = useCallback((itemId: string) => {
    setQueue(prev => prev.filter(q => q.id !== itemId));
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

  const handleReset = useCallback(() => {
    setPhase('upload');
    setQueue([]);
    setEnrichingBomId(null);
    setComponents([]);
    setRiskMetrics(null);
  }, []);

  return {
    // State
    phase,
    queue,
    queueMetrics,
    enrichingBomId,
    enrichmentState,
    enrichmentMetrics,
    components,
    riskMetrics,
    riskLoading,
    isStartingEnrichment,
    dragActive,

    // File Operations
    handleDrag,
    handleDrop,
    handleFileSelect,
    addFileToQueue,

    // Queue Operations
    updateMapping,
    toggleExpand,
    deleteItem,
    downloadFile,
    confirmAndEnrich,

    // Enrichment Operations
    startEnrichmentManually,
    runRiskAnalysis,

    // Workflow Control
    handleReset,
    setPhase,

    // Computed
    currentQueueStatus,
    activeStep,
  };
}

export default useBOMWorkflow;
