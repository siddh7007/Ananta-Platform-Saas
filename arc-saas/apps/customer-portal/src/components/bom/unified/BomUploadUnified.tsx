/**
 * BomUploadUnified Component
 *
 * Unified BOM Upload page with vertical stepper UI matching the screenshot design:
 * - Left sidebar: Vertical stepper (7 workflow steps)
 * - Right content: Progressive queue cards (Upload → Enrichment → Analysis → Complete)
 *
 * Features:
 * - Auto-scroll to current step in vertical stepper
 * - Pause/resume processing at any point
 * - Navigate back to any completed step
 * - Real-time progress updates via SSE/polling
 * - End-to-end Temporal workflow integration
 *
 * Layout:
 * ┌──────────────────┬─────────────────────────────────────┐
 * │ Vertical Stepper │ Project Selector                    │
 * │                  ├─────────────────────────────────────┤
 * │ 1. Files Select  │ Upload Queue Card                   │
 * │ 2. Upload Queue  │  - File upload progress             │
 * │ 3. Processing    │  - 4-column status grid             │
 * │ 4. Enrichment    ├─────────────────────────────────────┤
 * │ 5. Analysis      │ Enrichment Queue Card (progressive) │
 * │ 6. Complete      │  - Component queue list             │
 * │ 7. Summary       │  - Success rate                     │
 * │                  ├─────────────────────────────────────┤
 * │                  │ Analysis Queue Card (progressive)   │
 * │                  │  - Risk analysis status             │
 * │                  ├─────────────────────────────────────┤
 * │                  │ Complete Summary Card (final)       │
 * │                  │  - 3-column stats                   │
 * └──────────────────┴─────────────────────────────────────┘
 */

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import {
  FileText,
  Upload,
  FileSearch,
  Sparkles,
  BarChart3,
  CheckCircle,
  FileBarChart,
  FolderOpen,
  X,
  AlertCircle,
  Columns3,
  Save,
  RotateCcw,
  Clock,
  Bell,
  Cloud,
  CloudOff,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { VerticalStepper, WorkflowStep } from '../stepper/VerticalStepper';
import { UnifiedQueueCards } from './UnifiedQueueCards';
import { useToast } from '@/hooks/useToast';
import { useProcessingStatus } from '@/hooks/useProcessingStatus';
import { useWorkflowStatePersistence } from '@/hooks/useWorkflowStatePersistence';
import type { BomQueueItem as S3BomQueueItem, ActiveWorkflow } from '@/hooks/useWorkflowStatePersistence';
import { useTenant } from '@/contexts/TenantContext';
import { uploadBom, downloadRawFile } from '@/services/bom.service';
import { parseBOMFile } from '@/utils/bomParser';
import { cn, createLogger, isValidUUID } from '@/lib/utils';
import type { ProcessingStage } from '@/components/bom/ProcessingQueueView';

// Create logger for this component
const log = createLogger('BomUploadUnified');

// Storage key for persisted workflow state
const WORKFLOW_STORAGE_KEY = 'cbp_unified_workflow_state';
const BOM_QUEUE_STORAGE_KEY = 'cbp_bom_upload_queue';

// Interface for a single BOM in the queue
export interface BomQueueItem {
  bomId: string;
  bomName: string;
  fileName: string;
  totalComponents: number;
  projectId?: string;
  projectName?: string;
  addedAt: number; // timestamp when added to queue
  isActive: boolean; // is this the currently uploading item
}

// Interface for persisted workflow state
interface PersistedWorkflowState {
  bomId: string;
  bomName: string;
  fileName: string;
  totalComponents: number;
  currentStepId: string;
  projectId?: string;
  projectName?: string;
  timestamp: number; // For staleness check
}

// Helper to load BOM queue from localStorage
function loadBomQueue(): BomQueueItem[] {
  try {
    const stored = localStorage.getItem(BOM_QUEUE_STORAGE_KEY);
    if (!stored) return [];
    const queue = JSON.parse(stored) as BomQueueItem[];
    // Filter out stale items (older than 24 hours)
    const STALE_THRESHOLD = 24 * 60 * 60 * 1000;
    return queue.filter(item => Date.now() - item.addedAt < STALE_THRESHOLD);
  } catch {
    return [];
  }
}

// Helper to save BOM queue to localStorage
function saveBomQueue(queue: BomQueueItem[]): void {
  try {
    localStorage.setItem(BOM_QUEUE_STORAGE_KEY, JSON.stringify(queue));
  } catch (err) {
    log.warn('Failed to save BOM queue', { error: err instanceof Error ? err.message : String(err) });
  }
}

// Helper to load persisted state
function loadPersistedState(): PersistedWorkflowState | null {
  try {
    const stored = localStorage.getItem(WORKFLOW_STORAGE_KEY);
    if (!stored) {
      log.debug('No persisted workflow state found');
      return null;
    }

    const state = JSON.parse(stored) as PersistedWorkflowState;

    // Validate required fields exist
    if (!state.bomId || !state.bomName || typeof state.timestamp !== 'number') {
      log.warn('Invalid persisted state - missing required fields', { bomId: state.bomId });
      localStorage.removeItem(WORKFLOW_STORAGE_KEY);
      return null;
    }

    // Check if state is stale (older than 4 hours - reduced from 24 per UX review)
    const STALE_THRESHOLD = 4 * 60 * 60 * 1000; // 4 hours
    const ageHours = (Date.now() - state.timestamp) / (60 * 60 * 1000);
    if (Date.now() - state.timestamp > STALE_THRESHOLD) {
      log.info('Persisted state is stale, removing', { bomId: state.bomId, ageHours: ageHours.toFixed(1) });
      localStorage.removeItem(WORKFLOW_STORAGE_KEY);
      return null;
    }

    log.info('Loaded persisted workflow state', {
      bomId: state.bomId,
      bomName: state.bomName,
      step: state.currentStepId,
      ageMinutes: Math.round((Date.now() - state.timestamp) / (60 * 1000)),
    });
    return state;
  } catch (err) {
    // Clear corrupt data on parse error
    log.error('Failed to parse persisted state', err);
    localStorage.removeItem(WORKFLOW_STORAGE_KEY);
    return null;
  }
}

// Helper to save workflow state
function savePersistedState(state: Omit<PersistedWorkflowState, 'timestamp'>): void {
  try {
    const fullState: PersistedWorkflowState = {
      ...state,
      timestamp: Date.now(),
    };
    localStorage.setItem(WORKFLOW_STORAGE_KEY, JSON.stringify(fullState));
    log.debug('Saved workflow state', { bomId: state.bomId, step: state.currentStepId });
  } catch (err) {
    log.warn('Failed to save workflow state to localStorage', { error: err instanceof Error ? err.message : String(err) });
  }
}

// Helper to clear workflow state
function clearPersistedState(): void {
  try {
    localStorage.removeItem(WORKFLOW_STORAGE_KEY);
    log.debug('Cleared persisted workflow state');
  } catch (err) {
    log.warn('Failed to clear workflow state', { error: err instanceof Error ? err.message : String(err) });
  }
}

/**
 * QueueCardWrapper - Wrapper component for individual BOM queue items
 *
 * Each item in the queue gets its own processing status hook
 * and displays as a stacked card with position indicator
 */
interface QueueCardWrapperProps {
  queueItem: BomQueueItem;
  queuePosition: number;
  isActive: boolean;
  onViewBomDetails: () => void;
  onViewRiskDashboard: () => void;
  onViewAlerts: () => void;
  onViewAlertPreferences: () => void;
  onViewCriticalAlerts: () => void;
  onExportResults: () => void;
  onUploadAnother: () => void;
  onPause: () => void;
  onResume: () => void;
  onRemoveFromQueue: (bomId: string) => void;
  onDownloadRawFile: () => void;
  /** Called when processing completes for this BOM */
  onProcessingComplete: (bomId: string) => void;
}

function QueueCardWrapper({
  queueItem,
  queuePosition,
  isActive,
  onViewBomDetails,
  onViewRiskDashboard,
  onViewAlerts,
  onViewAlertPreferences,
  onViewCriticalAlerts,
  onExportResults,
  onUploadAnother,
  onPause,
  onResume,
  onRemoveFromQueue,
  onDownloadRawFile,
  onProcessingComplete,
}: QueueCardWrapperProps) {
  const { toast } = useToast();

  // Each queue item gets its own processing status hook
  const {
    status: processingStatus,
    currentStage,
    componentQueue,
    riskAnalysis,
    componentStatus,
    alertsCount,
    isPaused,
    pause,
    resume,
    cancel,
  } = useProcessingStatus({
    bomId: queueItem.bomId,
    enabled: true,
    onComplete: (status) => {
      toast({
        title: `${queueItem.bomName} Complete`,
        description: `Enriched ${status.enriched_items} of ${status.total_items} components`,
      });
      // Mark this BOM as no longer active so the upload zone appears
      onProcessingComplete(queueItem.bomId);
    },
    onError: (err) => {
      toast({
        title: `Error processing ${queueItem.bomName}`,
        description: err.message,
        variant: 'destructive',
      });
    },
  });

  const enrichedCount = processingStatus?.enriched_items ?? 0;
  const failedCount = processingStatus?.failed_items ?? 0;
  const totalComponents = processingStatus?.total_items ?? queueItem.totalComponents;

  return (
    <div className="relative">
      {/* Queue position badge */}
      {queuePosition > 1 && (
        <div className="absolute -left-3 -top-3 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground shadow-lg">
          #{queuePosition}
        </div>
      )}

      {/* Remove from queue button for completed/failed items */}
      {(processingStatus?.status === 'completed' || processingStatus?.status === 'failed') && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-2 top-2 z-10 h-6 w-6"
          onClick={() => onRemoveFromQueue(queueItem.bomId)}
          title="Remove from queue"
        >
          <X className="h-4 w-4" />
        </Button>
      )}

      <UnifiedQueueCards
        bomId={queueItem.bomId}
        fileName={queueItem.fileName}
        currentStage={currentStage}
        totalComponents={totalComponents}
        enrichedCount={enrichedCount}
        failedCount={failedCount}
        componentQueue={componentQueue}
        riskAnalysis={riskAnalysis}
        componentStatus={componentStatus}
        alertsCount={alertsCount}
        isPaused={isPaused}
        onPause={pause}
        onResume={resume}
        onViewBomDetails={onViewBomDetails}
        onViewRiskDashboard={onViewRiskDashboard}
        onViewAlerts={onViewAlerts}
        onViewAlertPreferences={onViewAlertPreferences}
        onViewCriticalAlerts={onViewCriticalAlerts}
        onExportResults={onExportResults}
        onUploadAnother={onUploadAnother}
        onCancel={cancel}
        onDownloadRawFile={onDownloadRawFile}
        defaultExpandedComplete={false}
      />
    </div>
  );
}

export interface BomUploadUnifiedProps {
  /** Optional project context */
  projectId?: string;
  projectName?: string;
  /** Callback when upload completes */
  onComplete?: (bomId: string) => void;
  className?: string;
}

export function BomUploadUnified({
  projectId: initialProjectId,
  projectName: initialProjectName,
  onComplete,
  className,
}: BomUploadUnifiedProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  useTenant();

  // S3-based workflow state persistence (with localStorage fallback)
  const {
    state: s3State,
    isLoading: isLoadingS3State,
    loadState: loadS3State,
    saveState: saveS3State,
    scheduleSave: scheduleS3Save,
    clearState: clearS3State,
  } = useWorkflowStatePersistence({ autoSave: true, debounceMs: 2000 });

  // Track which project we've restored for - allows re-restoration when switching projects
  const restoredForProjectRef = useRef<string | null | undefined>(undefined); // undefined = not restored yet, null = global, string = projectId
  const [showResumePrompt, setShowResumePrompt] = useState(false);
  const [persistedState, setPersistedState] = useState<PersistedWorkflowState | null>(null);
  const [isS3Synced, setIsS3Synced] = useState(false); // Track if state is synced to S3

  // State management - starting step matches screenshot
  const [currentStepId, setCurrentStepId] = useState('select_files');
  const [file, setFile] = useState<File | null>(null);
  const [bomId, setBomId] = useState<string | null>(null);
  const [bomName, setBomName] = useState('');
  const [totalComponents, setTotalComponents] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Multi-BOM queue support - tracks all uploads on this page
  // IMPORTANT: Start empty - the useEffect will load project-filtered queue from S3/localStorage
  const [bomQueue, setBomQueue] = useState<BomQueueItem[]>([]);

  // Project context from props or localStorage
  const [currentProject, setCurrentProject] = useState<{ id: string; name: string } | null>(
    initialProjectId
      ? { id: initialProjectId, name: initialProjectName || 'Project' }
      : null
  );

  // Check for persisted workflow state on mount - try S3 first, then localStorage
  // IMPORTANT: Only show state that matches the current project context
  // Re-runs when switching projects (initialProjectId changes)
  useEffect(() => {
    // Check if we've already restored for this exact project context
    const currentProjectKey = initialProjectId ?? null; // null for global
    if (restoredForProjectRef.current === currentProjectKey) return;

    // When switching projects, reset local state first
    if (restoredForProjectRef.current !== undefined) {
      // Switching projects - clear current state
      log.debug('Project context changed, resetting BOM state', {
        from: restoredForProjectRef.current,
        to: currentProjectKey,
      });
      setShowResumePrompt(false);
      setPersistedState(null);
      setBomQueue([]);
      setBomId(null);
      setBomName('');
      setTotalComponents(0);
      setFile(null);
      setCurrentStepId('select_files');
      setError(null);
      setIsS3Synced(false);
    }

    restoredForProjectRef.current = currentProjectKey;

    // Helper to check if a persisted item matches current project context
    // - If initialProjectId is set, only show items for that project
    // - If initialProjectId is undefined (global upload), only show items without projectId
    const matchesCurrentProject = (itemProjectId: string | undefined): boolean => {
      if (initialProjectId) {
        return itemProjectId === initialProjectId;
      }
      // Global upload context - only show items without a projectId
      return !itemProjectId;
    };

    // Load state from S3 (with localStorage fallback built into the hook)
    loadS3State().then((s3State) => {
      if (s3State) {
        // Filter active workflow by project context
        const activeWorkflowMatchesProject = s3State.activeWorkflow
          ? matchesCurrentProject(s3State.activeWorkflow.projectId)
          : false;

        // Filter queue items by project context
        const filteredQueue = s3State.bomQueue.filter((item) =>
          matchesCurrentProject(item.projectId)
        );

        // Only show resume prompt if there's matching content
        if (activeWorkflowMatchesProject || filteredQueue.length > 0) {
          if (activeWorkflowMatchesProject && s3State.activeWorkflow) {
            setPersistedState({
              bomId: s3State.activeWorkflow.bomId,
              bomName: s3State.activeWorkflow.bomName,
              fileName: s3State.activeWorkflow.fileName,
              totalComponents: s3State.activeWorkflow.totalComponents,
              currentStepId: s3State.activeWorkflow.currentStepId,
              projectId: s3State.activeWorkflow.projectId,
              projectName: s3State.activeWorkflow.projectName,
              timestamp: Date.now(), // S3 state doesn't track timestamp same way
            });
          }
          // Load only queue items for this project
          if (filteredQueue.length > 0) {
            const loadedQueue: BomQueueItem[] = filteredQueue.map((item) => ({
              bomId: item.bomId,
              bomName: item.bomName,
              fileName: item.fileName,
              totalComponents: item.totalComponents,
              projectId: item.projectId,
              projectName: item.projectName,
              addedAt: item.addedAt,
              isActive: item.isActive,
            }));
            setBomQueue(loadedQueue);
          }
          setShowResumePrompt(true);
          setIsS3Synced(true);
          log.info('Loaded workflow state from S3 (project-filtered)', {
            hasActiveWorkflow: activeWorkflowMatchesProject,
            queueLength: filteredQueue.length,
            totalQueueInS3: s3State.bomQueue.length,
            currentProjectId: initialProjectId || 'global',
          });
        } else {
          log.debug('S3 state exists but no items match current project', {
            currentProjectId: initialProjectId || 'global',
            s3ActiveProjectId: s3State.activeWorkflow?.projectId,
            s3QueueLength: s3State.bomQueue.length,
          });
        }
      } else {
        // Fallback to localStorage if S3 returned nothing
        const saved = loadPersistedState();
        const savedQueue = loadBomQueue();

        // Filter localStorage data by project context too
        const savedMatchesProject = saved && saved.bomId
          ? matchesCurrentProject(saved.projectId)
          : false;
        const filteredLocalQueue = savedQueue.filter((item) =>
          matchesCurrentProject(item.projectId)
        );

        if (savedMatchesProject || filteredLocalQueue.length > 0) {
          if (savedMatchesProject && saved) {
            setPersistedState(saved);
          }
          if (filteredLocalQueue.length > 0) {
            setBomQueue(filteredLocalQueue);
          }
          setShowResumePrompt(true);
          log.info('Loaded workflow state from localStorage fallback (project-filtered)', {
            hasPersistedState: savedMatchesProject,
            queueLength: filteredLocalQueue.length,
            currentProjectId: initialProjectId || 'global',
          });
        }
      }
    }).catch((err) => {
      log.warn('Failed to load S3 state, using localStorage', { error: err });
      // Fallback to localStorage with project filtering
      const saved = loadPersistedState();
      const savedQueue = loadBomQueue();

      const savedMatchesProject = saved && saved.bomId
        ? matchesCurrentProject(saved.projectId)
        : false;
      const filteredLocalQueue = savedQueue.filter((item) =>
        matchesCurrentProject(item.projectId)
      );

      if (savedMatchesProject || filteredLocalQueue.length > 0) {
        if (savedMatchesProject && saved) {
          setPersistedState(saved);
        }
        if (filteredLocalQueue.length > 0) {
          setBomQueue(filteredLocalQueue);
        }
        setShowResumePrompt(true);
      }
    });
  }, [loadS3State, initialProjectId]);

  // Handle resuming a persisted workflow
  const handleResumeWorkflow = useCallback(() => {
    if (!persistedState) return;

    log.info('Resuming persisted workflow', {
      bomId: persistedState.bomId,
      bomName: persistedState.bomName,
      step: persistedState.currentStepId,
    });

    setBomId(persistedState.bomId);
    setBomName(persistedState.bomName);
    setTotalComponents(persistedState.totalComponents);
    setCurrentStepId(persistedState.currentStepId);
    if (persistedState.projectId) {
      setCurrentProject({
        id: persistedState.projectId,
        name: persistedState.projectName || 'Project',
      });
    }
    setShowResumePrompt(false);

    toast({
      title: 'Workflow Resumed',
      description: `Continuing "${persistedState.bomName}" from where you left off`,
    });
  }, [persistedState, toast]);

  // Handle starting fresh (discard persisted state AND clear queue from S3 and localStorage)
  const handleStartFresh = useCallback(() => {
    log.info('Starting fresh - discarding persisted workflow and queue');

    // Clear from S3 (also clears localStorage)
    clearS3State();

    // Also clear localStorage explicitly for immediate effect
    clearPersistedState();

    setPersistedState(null);
    setShowResumePrompt(false);
    setIsS3Synced(false);

    // Clear the BOM queue
    setBomQueue([]);
    saveBomQueue([]);

    // Reset all state
    setBomId(null);
    setBomName('');
    setTotalComponents(0);
    setFile(null);
    setCurrentStepId('select_files');
    setError(null);
  }, [clearS3State]);

  // Save workflow state when it changes (to both S3 and localStorage)
  useEffect(() => {
    if (bomId && bomName && currentStepId !== 'select_files') {
      // Save to localStorage immediately
      savePersistedState({
        bomId,
        bomName,
        fileName: file?.name || bomName,
        totalComponents,
        currentStepId,
        projectId: currentProject?.id,
        projectName: currentProject?.name,
      });

      // Also schedule save to S3 (debounced)
      const activeWorkflow: ActiveWorkflow = {
        bomId,
        bomName,
        fileName: file?.name || bomName,
        totalComponents,
        currentStepId,
        projectId: currentProject?.id,
        projectName: currentProject?.name,
      };

      // Convert current queue to S3 format
      const s3Queue: S3BomQueueItem[] = bomQueue.map((item) => ({
        bomId: item.bomId,
        bomName: item.bomName,
        fileName: item.fileName,
        totalComponents: item.totalComponents,
        projectId: item.projectId,
        projectName: item.projectName,
        addedAt: item.addedAt,
        isActive: item.isActive,
      }));

      scheduleS3Save({
        activeWorkflow,
        bomQueue: s3Queue,
      });

      setIsS3Synced(true);
    }
  }, [bomId, bomName, file?.name, totalComponents, currentStepId, currentProject, bomQueue, scheduleS3Save]);

  // Check localStorage for project context on mount
  useEffect(() => {
    if (!currentProject) {
      const projectId = localStorage.getItem('current_project_id');
      const projectName = localStorage.getItem('current_project_name');
      if (projectId) {
        setCurrentProject({ id: projectId, name: projectName || 'Unknown Project' });
      }
    }
  }, [currentProject]);

  // Real-time processing status (only active when we have a bomId)
  const {
    status: processingStatus,
    stages,
    currentStage,
    componentQueue,
    riskAnalysis,
    componentStatus,
    alertsCount,
    isPaused,
    isComplete,
    pause,
    resume,
    cancel,
    overallProgress,
  } = useProcessingStatus({
    bomId: bomId || '',
    enabled: !!bomId && currentStepId !== 'files_selected',
    onComplete: (status) => {
      setCurrentStepId('summary');
      // Clear persisted state on successful completion (both S3 and localStorage)
      clearS3State();
      clearPersistedState();
      setIsS3Synced(false);
      toast({
        title: 'Processing Complete',
        description: `BOM enrichment completed with ${status.enriched_items} items enriched`,
      });
      onComplete?.(bomId!);
    },
    onError: (err) => {
      setError(err.message);
      toast({
        title: 'Processing Error',
        description: err.message,
        variant: 'destructive',
      });
    },
  });

  // Map processing stage to workflow step ID - matches screenshot steps
  const mapStageToStepId = useCallback((stage: ProcessingStage): string => {
    const stageMap: Record<ProcessingStage, string> = {
      raw_upload: 'upload_parse',
      parsing: 'map_columns',
      enrichment: 'enrich_components',
      risk_analysis: 'risk_analysis',
      complete: 'complete', // Alerts step transitions to complete when done
    };
    return stageMap[stage] || 'select_files';
  }, []);

  // Auto-update current step based on processing stage
  useEffect(() => {
    if (bomId && currentStage) {
      const newStepId = mapStageToStepId(currentStage);
      if (newStepId !== currentStepId && currentStepId !== 'select_files') {
        setCurrentStepId(newStepId);
      }
    }
  }, [bomId, currentStage, currentStepId, mapStageToStepId]);

  // Build workflow steps with dynamic status - matches screenshot design
  const workflowSteps = useMemo((): WorkflowStep[] => {
    const getStepStatus = (stepId: string): WorkflowStep['status'] => {
      if (error && stepId !== 'select_files') return 'error';

      // Step order matching the screenshot UI exactly - NOW WITH ALERTS STEP
      const stepOrder = [
        'select_files',      // 1. Select Files
        'upload_parse',      // 2. Upload & Parse
        'map_columns',       // 3. Map Columns
        'save_bom',          // 4. Save BOM
        'enrich_components', // 5. Enrich Components
        'risk_analysis',     // 6. Risk Analysis
        'alerts',            // 7. Alerts (NEW)
        'complete',          // 8. Complete
      ];

      const currentIndex = stepOrder.indexOf(currentStepId);
      const stepIndex = stepOrder.indexOf(stepId);

      // Special case: "complete" step should show as complete when workflow is done
      if (stepId === 'complete' && isComplete) {
        return 'complete';
      }

      if (stepId === currentStepId) {
        if (isPaused) return 'pending';
        return 'active';
      }
      if (stepIndex < currentIndex) return 'complete';
      if (stepIndex > currentIndex) return 'pending';

      return 'pending';
    };

    const enrichedCount = componentQueue.filter((c) => c.status === 'done').length;

    return [
      {
        id: 'select_files',
        title: 'Select Files',
        description: file ? file.name : 'Choose BOM file to upload',
        icon: FileText,
        status: getStepStatus('select_files'),
      },
      {
        id: 'upload_parse',
        title: 'Upload & Parse',
        description: totalComponents > 0 ? `${totalComponents} rows parsed` : 'Upload and parse file',
        icon: Upload,
        status: getStepStatus('upload_parse'),
      },
      {
        id: 'map_columns',
        title: 'Map Columns',
        description: 'Auto-mapping columns',
        icon: Columns3,
        status: getStepStatus('map_columns'),
      },
      {
        id: 'save_bom',
        title: 'Save BOM',
        description: bomId ? 'BOM saved' : 'Save to database',
        icon: Save,
        status: getStepStatus('save_bom'),
      },
      {
        id: 'enrich_components',
        title: 'Enrich Components',
        description: totalComponents > 0 ? `${enrichedCount}/${totalComponents} enriched` : 'Enrich with supplier data',
        icon: Sparkles,
        status: getStepStatus('enrich_components'),
      },
      {
        id: 'risk_analysis',
        title: 'Risk Analysis',
        description: riskAnalysis?.status === 'complete' ? 'Analysis complete' : 'Analyzing risks',
        icon: BarChart3,
        status: getStepStatus('risk_analysis'),
      },
      {
        id: 'alerts',
        title: 'Alerts',
        description: alertsCount > 0 ? `${alertsCount} alerts generated` : 'Review alerts',
        icon: Bell,
        status: getStepStatus('alerts'),
      },
      {
        id: 'complete',
        title: 'Complete',
        description: isComplete ? 'Workflow complete - view results and export' : 'Processing...',
        icon: CheckCircle,
        status: getStepStatus('complete'),
      },
    ];
  }, [
    currentStepId,
    file,
    error,
    isPaused,
    isComplete,
    componentQueue,
    totalComponents,
    riskAnalysis,
    alertsCount,
    bomId,
  ]);

  // File drop handler - supports re-uploading new files at any time
  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (acceptedFiles.length === 0) {
        log.debug('No files dropped');
        return;
      }

      const uploadedFile = acceptedFiles[0];
      log.info('File dropped for upload', {
        fileName: uploadedFile.name,
        fileSize: Math.round(uploadedFile.size / 1024),
        fileType: uploadedFile.type,
      });

      // Reset all state for new upload (allows re-uploading same or different file)
      // This ensures each upload creates a NEW BOM entry
      setBomId(null);
      setError(null);
      setTotalComponents(0);
      setCurrentStepId('select_files');

      // Set file and start uploading
      setFile(uploadedFile);
      setIsUploading(true);

      try {
        // Parse file to get total components
        log.debug('Parsing BOM file', { fileName: uploadedFile.name });
        const parsed = await parseBOMFile(uploadedFile);
        log.info('BOM file parsed successfully', {
          fileName: uploadedFile.name,
          totalRows: parsed.total_rows,
        });
        setTotalComponents(parsed.total_rows);

        // Generate unique name with timestamp to ensure no filename conflicts
        const timestamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-');
        const baseName = uploadedFile.name.replace(/\.[^/.]+$/, '');
        const uniqueName = `${baseName} (${timestamp})`;
        setBomName(uniqueName);

        // Auto-upload file - always creates a NEW BOM entry
        log.info('Uploading BOM to server', {
          bomName: uniqueName,
          projectId: currentProject?.id,
          totalComponents: parsed.total_rows,
        });
        const result = await uploadBom({
          file: uploadedFile,
          name: uniqueName,
          projectId: currentProject?.id,
        });

        log.info('BOM uploaded successfully', {
          bomId: result.bomId,
          bomName: uniqueName,
          totalComponents: parsed.total_rows,
        });

        setBomId(result.bomId);
        // Progress through: select_files → upload_parse → map_columns → save_bom → enrich_components
        setCurrentStepId('save_bom'); // File is uploaded, parsed, mapped, and saved

        // Add to BOM queue for multi-BOM stacking
        const newQueueItem: BomQueueItem = {
          bomId: result.bomId,
          bomName: uniqueName,
          fileName: uploadedFile.name,
          totalComponents: parsed.total_rows,
          projectId: currentProject?.id,
          projectName: currentProject?.name,
          addedAt: Date.now(),
          isActive: true,
        };

        setBomQueue((prevQueue) => {
          // Mark all existing items as not active, add new one as active
          const updatedQueue = prevQueue.map(item => ({ ...item, isActive: false }));
          updatedQueue.push(newQueueItem);
          saveBomQueue(updatedQueue);
          log.info('Added BOM to queue', { bomId: result.bomId, queueLength: updatedQueue.length });
          return updatedQueue;
        });

        toast({
          title: 'File Uploaded Successfully',
          description: `${parsed.total_rows} components ready for enrichment`,
        });
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to process file';
        log.error('BOM upload failed', err, { fileName: uploadedFile.name });
        setError(errorMessage);
        toast({
          title: 'Upload Error',
          description: errorMessage,
          variant: 'destructive',
        });
      } finally {
        setIsUploading(false);
      }
    },
    [currentProject, toast]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
    },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024,
    // Allow re-upload: only disable during active upload, not after completion
    // User can drop a new file at any time to start a new BOM upload
    disabled: isUploading,
  });

  // Handle step navigation (can navigate back to completed steps)
  const handleStepClick = useCallback((stepId: string) => {
    // Only allow navigation to select_files to start over
    if (stepId === 'select_files') {
      setCurrentStepId(stepId);
      setFile(null);
      setBomId(null);
      setTotalComponents(0);
      setError(null);
    }
  }, []);

  // Pause/Resume handlers
  const handlePause = useCallback(async () => {
    log.info('User requested pause', { bomId });
    try {
      await pause();
      log.info('Processing paused by user', { bomId });
      toast({
        title: 'Processing Paused',
        description: 'You can resume anytime or navigate away safely.',
      });
    } catch (err) {
      log.error('Failed to pause processing', err, { bomId });
      // Error already handled by useProcessingStatus
    }
  }, [pause, toast, bomId]);

  const handleResume = useCallback(async () => {
    log.info('User requested resume', { bomId });
    try {
      await resume();
      log.info('Processing resumed by user', { bomId });
      toast({
        title: 'Processing Resumed',
        description: 'BOM processing has been resumed.',
      });
    } catch (err) {
      log.error('Failed to resume processing', err, { bomId });
      // Error already handled by useProcessingStatus
    }
  }, [resume, toast, bomId]);

  // View handlers
  const handleViewBomDetails = useCallback(() => {
    if (bomId) {
      log.info('Navigating to BOM details', { bomId });
      navigate(`/boms/${bomId}`);
    }
  }, [bomId, navigate]);

  const handleViewRiskDashboard = useCallback(() => {
    if (bomId) {
      log.info('Navigating to risk dashboard', { bomId });
      navigate(`/boms/${bomId}/risk`);
    }
  }, [bomId, navigate]);

  const handleViewAlerts = useCallback(() => {
    if (bomId) {
      log.info('Navigating to alerts', { bomId });
      navigate(`/boms/${bomId}/alerts`);
    }
  }, [bomId, navigate]);

  const handleViewAlertPreferences = useCallback(() => {
    log.info('Navigating to alert preferences');
    navigate('/settings/alerts');
  }, [navigate]);

  const handleViewCriticalAlerts = useCallback(() => {
    if (bomId) {
      log.info('Navigating to critical alerts', { bomId });
      navigate(`/boms/${bomId}/alerts?severity=critical`);
    }
  }, [bomId, navigate]);

  const handleExportResults = useCallback(() => {
    if (bomId) {
      log.info('Exporting BOM results', { bomId });
      // Navigate to export page or trigger export
      navigate(`/boms/${bomId}/export`);
    }
  }, [bomId, navigate]);

  // Download raw file handler - calls the bom.service to get presigned URL
  // Includes UUID validation to prevent injection attacks
  const handleDownloadRawFile = useCallback(async (targetBomId?: string) => {
    const bomIdToDownload = targetBomId || bomId;
    if (!bomIdToDownload) {
      log.warn('Cannot download raw file - no bomId available');
      return;
    }

    // Security: Validate bomId is a valid UUID format before making API call
    if (!isValidUUID(bomIdToDownload)) {
      log.error('Invalid BOM ID format', undefined, { bomId: bomIdToDownload });
      toast({
        title: 'Download Failed',
        description: 'Invalid BOM identifier format.',
        variant: 'destructive',
      });
      return;
    }

    log.info('Downloading raw file', { bomId: bomIdToDownload });
    try {
      await downloadRawFile(bomIdToDownload);
      toast({
        title: 'Download Started',
        description: 'Your original BOM file is being downloaded.',
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to download file';
      log.error('Failed to download raw file', err, { bomId: bomIdToDownload });
      toast({
        title: 'Download Failed',
        description: errorMessage,
        variant: 'destructive',
      });
    }
  }, [bomId, toast]);

  const handleUploadAnother = useCallback(() => {
    log.info('Starting new upload - keeping queue, allowing new upload', { previousBomId: bomId, queueLength: bomQueue.length });
    // Clear persisted state when starting a new upload
    clearPersistedState();
    // Reset to file selection state, but keep the queue intact
    setCurrentStepId('select_files');
    setFile(null);
    // Don't clear bomId - we keep it to show existing queue items
    // setBomId(null);  // REMOVED - keep existing BOM to show queue
    setTotalComponents(0);
    setError(null);
    // Mark current BOM as not active so a new one can be added
    setBomQueue((prevQueue) => {
      const updatedQueue = prevQueue.map(item => ({ ...item, isActive: false }));
      saveBomQueue(updatedQueue);
      return updatedQueue;
    });
  }, [bomId, bomQueue.length]);

  // Upload success state (when bomId is set and no error)
  const isUploadSuccess = !!bomId && !error;

  // Render file selection area with visual states for success/failure
  const renderFileSelection = () => (
    <Card>
      <CardContent className="pt-6">
        <div className="space-y-6">
          {/* Header changes based on state */}
          <div className="text-center">
            {isUploadSuccess ? (
              <>
                <CheckCircle className="mx-auto h-12 w-12 text-green-500" />
                <h3 className="mt-4 text-lg font-semibold text-green-700">Upload Successful!</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {file?.name} uploaded with {totalComponents} components
                </p>
              </>
            ) : error ? (
              <>
                <AlertCircle className="mx-auto h-12 w-12 text-destructive" />
                <h3 className="mt-4 text-lg font-semibold text-destructive">Upload Failed</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Please try again or select a different file
                </p>
              </>
            ) : isUploading ? (
              <>
                <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                <h3 className="mt-4 text-lg font-semibold">Uploading...</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {file?.name || 'Processing your file'}
                </p>
              </>
            ) : (
              <>
                <Upload className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="mt-4 text-lg font-semibold">Upload Your BOM</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Drag and drop your BOM file or click to browse
                </p>
              </>
            )}
          </div>

          {/* Dropzone with visual states - always clickable except during upload */}
          <div
            {...getRootProps()}
            className={cn(
              'cursor-pointer rounded-lg border-2 border-dashed p-12 text-center transition-all',
              // Success state - green border and background, but still clickable for new upload
              isUploadSuccess && 'border-green-500 bg-green-50 dark:bg-green-950/20 hover:border-green-600 hover:bg-green-100 dark:hover:bg-green-950/30',
              // Error state - red border and background
              error && !isUploadSuccess && 'border-destructive bg-destructive/5 hover:border-destructive/80',
              // Active drag state
              isDragActive && !error && !isUploadSuccess && 'border-primary bg-primary/5 scale-[1.02]',
              // Default state
              !isDragActive && !error && !isUploadSuccess && !isUploading && 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50',
              // Uploading state - only time it should show as disabled
              isUploading && !error && !isUploadSuccess && 'border-primary/50 bg-primary/5 animate-pulse cursor-not-allowed'
            )}
          >
            <input {...getInputProps()} />
            {isUploadSuccess ? (
              <>
                <CheckCircle className="mx-auto h-16 w-16 text-green-500" />
                <p className="mt-4 text-sm font-medium text-green-700">
                  {totalComponents} components ready for enrichment
                </p>
                <p className="mt-2 text-xs text-green-600/80">
                  Drop another file to upload a new BOM
                </p>
              </>
            ) : error ? (
              <>
                <AlertCircle className="mx-auto h-16 w-16 text-destructive/50" />
                <p className="mt-4 text-sm font-medium text-destructive">
                  Click to try again
                </p>
              </>
            ) : (
              <>
                <FileText className="mx-auto h-16 w-16 text-muted-foreground/50" />
                <p className="mt-4 text-sm text-muted-foreground">
                  Supports <strong>CSV</strong>, <strong>XLS</strong>, <strong>XLSX</strong>
                </p>
                <p className="mt-1 text-xs text-muted-foreground/75">Maximum file size: 10MB</p>
              </>
            )}
          </div>

          {/* Error alert with details */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>
      </CardContent>
    </Card>
  );

  // Get enriched/failed counts from real-time processing status (not from stages)
  // processingStatus has the actual current counts from the API polling
  const enrichedCount = processingStatus?.enriched_items ?? 0;
  const failedCount = processingStatus?.failed_items ?? 0;

  return (
    <div className={cn('min-h-screen bg-muted/20', className)}>
      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6 p-6">
        {/* Left Sidebar - Vertical Stepper */}
        <aside className="lg:sticky lg:top-6 lg:h-[calc(100vh-3rem)]">
          <Card className="h-full overflow-y-auto">
            <VerticalStepper
              currentStepId={currentStepId}
              steps={workflowSteps}
              onStepClick={handleStepClick}
              allowNavigateBack={true}
              autoScroll={true}
            />
          </Card>
        </aside>

        {/* Right Content Area */}
        <main className="space-y-6">
          {/* Unified Pipeline Header - matches screenshot design */}
          <div className="rounded-lg border bg-gradient-to-r from-blue-50 to-purple-50 p-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              <span className="text-blue-700">Unified Pipeline:</span>
              <span className="text-muted-foreground">
                Upload → Enrich → Analyze all on one page.
              </span>
            </div>
          </div>

          {/* Resume Workflow Prompt - shows if there's persisted state OR queue items */}
          {showResumePrompt && (persistedState || bomQueue.length > 0) && (
            <Card className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30">
              <CardContent className="pt-4">
                <div className="flex items-start gap-4">
                  <div className="rounded-lg bg-amber-100 dark:bg-amber-900/50 p-2">
                    <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-amber-800 dark:text-amber-200">
                        {persistedState ? 'Resume Previous Workflow?' : 'Previous BOMs in Queue'}
                      </h3>
                      {/* Cloud sync indicator */}
                      {isS3Synced ? (
                        <Badge variant="outline" className="text-xs flex items-center gap-1 bg-green-50 text-green-700 border-green-300 dark:bg-green-900/30 dark:text-green-300 dark:border-green-700">
                          <Cloud className="h-3 w-3" />
                          Synced
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs flex items-center gap-1 bg-gray-50 text-gray-500 border-gray-300 dark:bg-gray-900/30 dark:text-gray-400 dark:border-gray-600">
                          <CloudOff className="h-3 w-3" />
                          Local
                        </Badge>
                      )}
                    </div>
                    {persistedState ? (
                      <>
                        <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                          You have an in-progress BOM workflow: <strong>{persistedState.bomName}</strong>
                        </p>
                        <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                          {persistedState.totalComponents} components • Last step: {persistedState.currentStepId.replace(/_/g, ' ')}
                        </p>
                      </>
                    ) : (
                      <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                        You have <strong>{bomQueue.length} BOM{bomQueue.length > 1 ? 's' : ''}</strong> from a previous session.
                        Click "Start Fresh" to clear and upload new files.
                      </p>
                    )}
                    {isS3Synced && (
                      <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                        State saved to cloud - resume from any device
                      </p>
                    )}
                    <div className="flex gap-3 mt-3">
                      {persistedState && (
                        <Button
                          size="sm"
                          onClick={handleResumeWorkflow}
                          className="bg-amber-600 hover:bg-amber-700 text-white"
                        >
                          <RotateCcw className="h-4 w-4 mr-2" />
                          Resume Workflow
                        </Button>
                      )}
                      {!persistedState && bomQueue.length > 0 && (
                        <Button
                          size="sm"
                          onClick={() => setShowResumePrompt(false)}
                          className="bg-amber-600 hover:bg-amber-700 text-white"
                        >
                          <RotateCcw className="h-4 w-4 mr-2" />
                          Continue with Queue
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleStartFresh}
                        className="border-amber-600 text-amber-700 hover:bg-amber-100 dark:border-amber-500 dark:text-amber-400 dark:hover:bg-amber-900/50"
                      >
                        Start Fresh
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Project Context Banner */}
          {currentProject && (
            <Card>
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-primary/10 p-2">
                      <FolderOpen className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">
                        Uploading to Project
                      </p>
                      <p className="text-lg font-semibold text-primary">{currentProject.name}</p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate('/projects')}
                  >
                    Change Project
                  </Button>
                </div>
              </CardHeader>
            </Card>
          )}

          {/* Main Content - Progressive Queue Cards */}
          {/* File selection - shown when in select_files mode OR when queue exists but user wants to add more */}
          {(currentStepId === 'select_files' || (bomQueue.length > 0 && !bomQueue.some(item => item.isActive))) && renderFileSelection()}

          {/* Queue Cards - render all BOMs in the queue, stacked vertically */}
          {bomQueue.length > 0 && (
            <div className="space-y-6">
              {bomQueue.map((queueItem, index) => (
                <QueueCardWrapper
                  key={queueItem.bomId}
                  queueItem={queueItem}
                  queuePosition={bomQueue.length - index} // newest at top
                  isActive={queueItem.isActive}
                  onViewBomDetails={handleViewBomDetails}
                  onViewRiskDashboard={handleViewRiskDashboard}
                  onViewAlerts={handleViewAlerts}
                  onViewAlertPreferences={handleViewAlertPreferences}
                  onViewCriticalAlerts={handleViewCriticalAlerts}
                  onExportResults={handleExportResults}
                  onUploadAnother={handleUploadAnother}
                  onPause={handlePause}
                  onResume={handleResume}
                  onRemoveFromQueue={(bomIdToRemove) => {
                    setBomQueue((prevQueue) => {
                      const updatedQueue = prevQueue.filter(item => item.bomId !== bomIdToRemove);
                      saveBomQueue(updatedQueue);
                      return updatedQueue;
                    });
                    // If removing the active BOM, clear state
                    if (bomId === bomIdToRemove) {
                      setBomId(null);
                    }
                  }}
                  onDownloadRawFile={() => handleDownloadRawFile(queueItem.bomId)}
                  onProcessingComplete={(completedBomId) => {
                    // Mark the completed BOM as no longer active so the upload zone appears
                    setBomQueue((prevQueue) => {
                      const updatedQueue = prevQueue.map(item =>
                        item.bomId === completedBomId ? { ...item, isActive: false } : item
                      );
                      saveBomQueue(updatedQueue);
                      return updatedQueue;
                    });
                  }}
                />
              ))}
            </div>
          )}

          {/* Fallback: Show single card when bomId is set but queue is empty (shouldn't happen, but safe) */}
          {bomId && bomQueue.length === 0 && (
            <UnifiedQueueCards
              bomId={bomId}
              fileName={file?.name || bomName}
              currentStage={currentStage}
              totalComponents={processingStatus?.total_items ?? totalComponents}
              enrichedCount={enrichedCount}
              failedCount={failedCount}
              componentQueue={componentQueue}
              riskAnalysis={riskAnalysis}
              componentStatus={componentStatus}
              alertsCount={alertsCount}
              isPaused={isPaused}
              onPause={handlePause}
              onResume={handleResume}
              onViewBomDetails={handleViewBomDetails}
              onViewRiskDashboard={handleViewRiskDashboard}
              onViewAlerts={handleViewAlerts}
              onViewAlertPreferences={handleViewAlertPreferences}
              onViewCriticalAlerts={handleViewCriticalAlerts}
              onExportResults={handleExportResults}
              onUploadAnother={handleUploadAnother}
              onCancel={cancel}
              onDownloadRawFile={() => handleDownloadRawFile()}
              defaultExpandedComplete={false}
            />
          )}
        </main>
      </div>
    </div>
  );
}

export default BomUploadUnified;
