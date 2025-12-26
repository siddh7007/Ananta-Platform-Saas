/**
 * ProcessingStep Component
 *
 * Handles 3 sub-states of BOM processing:
 * 1. "uploading" - File upload progress
 * 2. "processing" - Backend parsing/validation
 * 3. "enriching" - Real-time SSE component matching with workflow controls
 *
 * Extracted from BomUpload.tsx renderUploading(), renderProcessing(), renderEnriching()
 */

import {
  Upload,
  Loader2,
  Cpu,
  Sparkles,
  Pause,
  Play,
  XCircle,
  CheckCircle2,
  AlertTriangle,
  Activity,
  FileCheck,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';

export interface ProcessingStepProps {
  currentStep: 'uploading' | 'processing' | 'enriching';
  uploadProgress: number;
  jobId: string | null;
  workflowId: string | null;
  // SSE enrichment progress
  enrichmentProgress: {
    processed: number;
    total: number;
    matched: number;
    failed: number;
    currentItem?: string;
  } | null;
  // Workflow status (from Temporal or backend)
  workflowStatus: {
    status: string;
    current_stage?: string;
    stages?: Record<string, { status: string; progress: number }>;
  } | null;
  error: string | null;
  // Workflow controls
  onPause: () => void;
  onResume: () => void;
  onCancel: () => void;
  isPaused: boolean;
}

export function ProcessingStep({
  currentStep,
  uploadProgress,
  jobId,
  workflowId,
  enrichmentProgress,
  workflowStatus,
  error,
  onPause,
  onResume,
  onCancel,
  isPaused,
}: ProcessingStepProps) {
  // Helper to get phase icon and title
  const getPhaseInfo = () => {
    switch (currentStep) {
      case 'uploading':
        return {
          icon: Upload,
          title: 'Uploading Your BOM',
          subtitle: 'Transferring file to server...',
        };
      case 'processing':
        return {
          icon: Cpu,
          title: 'Analyzing Your BOM File',
          subtitle: 'Parsing file structure and validating data format...',
        };
      case 'enriching':
        return {
          icon: Sparkles,
          title: 'Enriching Components',
          subtitle: 'Matching components with catalog database...',
        };
    }
  };

  const phaseInfo = getPhaseInfo();
  const PhaseIcon = phaseInfo.icon;

  return (
    <Card className="mx-auto max-w-2xl">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div
            className={cn(
              'flex h-12 w-12 items-center justify-center rounded-full',
              currentStep === 'uploading' && 'bg-blue-100',
              currentStep === 'processing' && 'bg-purple-100',
              currentStep === 'enriching' && 'bg-amber-100'
            )}
          >
            <PhaseIcon
              className={cn(
                'h-6 w-6',
                currentStep === 'uploading' && 'text-blue-600 animate-pulse',
                currentStep === 'processing' && 'text-purple-600 animate-pulse',
                currentStep === 'enriching' && 'text-amber-600 animate-pulse'
              )}
            />
          </div>
          <div>
            <CardTitle>{phaseInfo.title}</CardTitle>
            <p className="text-sm text-muted-foreground">{phaseInfo.subtitle}</p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* UPLOADING: Upload progress bar */}
        {currentStep === 'uploading' && (
          <div className="space-y-4">
            <div className="text-center">
              <Loader2 className="mx-auto h-16 w-16 animate-spin text-primary" />
            </div>
            <div className="space-y-2">
              <Progress value={uploadProgress} className="h-2" />
              <p className="text-center text-sm text-muted-foreground">
                {uploadProgress}% complete
              </p>
            </div>
          </div>
        )}

        {/* PROCESSING: Indeterminate spinner with stage checklist */}
        {currentStep === 'processing' && (
          <div className="space-y-6">
            <div className="text-center">
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-blue-100">
                <FileCheck className="h-10 w-10 text-blue-600 animate-pulse" />
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">File parsing</span>
                <CheckCircle2 className="h-4 w-4 text-green-600" />
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Data validation</span>
                <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Preparing enrichment</span>
                <span className="h-4 w-4 rounded-full border-2 border-muted" />
              </div>
            </div>
          </div>
        )}

        {/* ENRICHING: Detailed progress with workflow controls */}
        {currentStep === 'enriching' && (
          <div className="space-y-6">
            {/* Workflow Controls (pause/resume) */}
            {workflowId && (
              <div className="flex items-center justify-between rounded-lg border bg-muted/30 p-3">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">
                    {isPaused ? 'Processing Paused' : 'Processing Active'}
                  </span>
                  {isPaused && (
                    <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-700">
                      Paused
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant={isPaused ? 'default' : 'outline'}
                    onClick={isPaused ? onResume : onPause}
                    className={cn(
                      'gap-1.5',
                      isPaused && 'bg-green-100 text-green-700 hover:bg-green-200',
                      !isPaused && 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                    )}
                  >
                    {isPaused ? (
                      <>
                        <Play className="h-3.5 w-3.5" />
                        Resume
                      </>
                    ) : (
                      <>
                        <Pause className="h-3.5 w-3.5" />
                        Pause
                      </>
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={onCancel}
                    className="gap-1.5 text-red-600 hover:bg-red-50 hover:text-red-700"
                  >
                    <XCircle className="h-3.5 w-3.5" />
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {/* Enrichment Progress Details */}
            {enrichmentProgress && (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div className="rounded-lg border bg-muted/20 p-3">
                    <div className="text-2xl font-bold text-green-600">
                      {enrichmentProgress.matched}
                    </div>
                    <div className="text-xs text-muted-foreground">Matched</div>
                  </div>
                  <div className="rounded-lg border bg-muted/20 p-3">
                    <div className="text-2xl font-bold text-blue-600">
                      {enrichmentProgress.processed}
                    </div>
                    <div className="text-xs text-muted-foreground">Processed</div>
                  </div>
                  <div className="rounded-lg border bg-muted/20 p-3">
                    <div className="text-2xl font-bold text-red-600">
                      {enrichmentProgress.failed}
                    </div>
                    <div className="text-xs text-muted-foreground">Failed</div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Overall Progress</span>
                    <span className="font-medium">
                      {enrichmentProgress.processed} / {enrichmentProgress.total}
                    </span>
                  </div>
                  <Progress
                    value={(enrichmentProgress.processed / enrichmentProgress.total) * 100}
                    className="h-2"
                  />
                </div>

                {enrichmentProgress.currentItem && (
                  <div className="rounded-lg border bg-muted/20 p-3">
                    <div className="flex items-center gap-2 text-sm">
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      <span className="text-muted-foreground">Processing:</span>
                      <span className="font-mono font-medium">
                        {enrichmentProgress.currentItem}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Workflow Stage Indicators */}
            {workflowStatus?.stages && (
              <div className="space-y-3">
                <div className="text-sm font-medium">Processing Stages</div>
                <div className="space-y-2">
                  {Object.entries(workflowStatus.stages).map(([stageName, stageData]) => {
                    const isActive = workflowStatus.current_stage === stageName;
                    const isComplete = stageData.status === 'completed';
                    const isFailed = stageData.status === 'failed';

                    return (
                      <div
                        key={stageName}
                        className={cn(
                          'flex items-center justify-between rounded-lg border p-3',
                          isActive && 'border-primary bg-primary/5',
                          isComplete && 'bg-green-50 border-green-200',
                          isFailed && 'bg-red-50 border-red-200'
                        )}
                      >
                        <div className="flex items-center gap-2">
                          {isComplete && (
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                          )}
                          {isFailed && <XCircle className="h-4 w-4 text-red-600" />}
                          {isActive && !isComplete && !isFailed && (
                            <Loader2 className="h-4 w-4 animate-spin text-primary" />
                          )}
                          {!isActive && !isComplete && !isFailed && (
                            <span className="h-4 w-4 rounded-full border-2 border-muted" />
                          )}
                          <span
                            className={cn(
                              'text-sm',
                              isActive && 'font-medium',
                              isComplete && 'text-green-700',
                              isFailed && 'text-red-700'
                            )}
                          >
                            {stageName.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                          </span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {stageData.progress}%
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="ml-2">
              <p className="font-medium">Processing Error</p>
              <p className="text-sm">{error}</p>
            </AlertDescription>
          </Alert>
        )}

        {/* Job/Workflow IDs (for debugging) */}
        {(jobId || workflowId) && (
          <div className="space-y-1 text-xs text-muted-foreground">
            {jobId && (
              <div className="flex justify-between">
                <span>Job ID:</span>
                <code className="rounded bg-muted px-1 font-mono">{jobId}</code>
              </div>
            )}
            {workflowId && (
              <div className="flex justify-between">
                <span>Workflow ID:</span>
                <code className="rounded bg-muted px-1 font-mono">{workflowId}</code>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
