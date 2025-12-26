/**
 * Complete Example: Unified BOM Upload Component
 *
 * This example demonstrates how to use all three workflow hooks together
 * to create a comprehensive BOM upload and processing interface.
 *
 * Features:
 * - File upload with progress
 * - Multi-phase processing visualization
 * - Queue position and estimated time
 * - Workflow controls (pause/resume/cancel)
 * - Real-time SSE updates during enrichment
 * - Error handling and retry
 */

import React, { useState } from 'react';
import {
  useBomUploadStatus,
  useProcessingQueue,
  useWorkflowStatus,
  type BomProcessingPhase,
} from '@/hooks';
import { uploadBom } from '@/services/bom.service';

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function UnifiedBomUpload() {
  const [bomId, setBomId] = useState<string | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Handle file upload
  const handleUpload = async () => {
    if (!uploadFile) return;

    try {
      setIsUploading(true);
      const result = await uploadBom({
        file: uploadFile,
        name: uploadFile.name,
      });

      setBomId(result.bomId);
      console.log('Upload complete, BOM ID:', result.bomId);
    } catch (error) {
      console.error('Upload failed:', error);
      alert('Upload failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setIsUploading(false);
    }
  };

  // If no BOM uploaded yet, show upload form
  if (!bomId) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <h1 className="text-2xl font-bold mb-6">Upload BOM</h1>

        <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
          <input
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
            className="mb-4"
          />

          <button
            onClick={handleUpload}
            disabled={!uploadFile || isUploading}
            className="px-6 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
          >
            {isUploading ? 'Uploading...' : 'Upload BOM'}
          </button>
        </div>
      </div>
    );
  }

  // Once uploaded, show processing status
  return <BomProcessingStatus bomId={bomId} />;
}

// ============================================================================
// BOM PROCESSING STATUS COMPONENT
// ============================================================================

interface BomProcessingStatusProps {
  bomId: string;
}

function BomProcessingStatus({ bomId }: BomProcessingStatusProps) {
  // Unified status hook (combines all phases)
  const {
    overallProgress,
    currentPhase,
    status,
    stages,
    isComplete,
    error,
    pause,
    resume,
    cancel,
    canPause,
    canResume,
    canCancel,
    isPaused,
    totalItems,
    enrichedItems,
    failedItems,
    healthGrade,
    enrichmentProgress,
    retry,
  } = useBomUploadStatus(bomId, {
    enableSSE: true,
    enableWorkflowPolling: true,
    pollInterval: 2000,
    onComplete: () => {
      console.log('BOM processing complete!');
      // Navigate to BOM detail page
      // window.location.href = `/boms/${bomId}`;
    },
    onError: (err) => {
      console.error('Processing error:', err);
    },
    onPhaseChange: (phase) => {
      console.log('Phase changed to:', phase);
    },
  });

  // Queue position tracking
  const {
    getJobPosition,
    getEstimatedWaitTime,
    queueLength,
    runningJobs,
  } = useProcessingQueue({
    enabled: true,
    pollInterval: 5000,
  });

  const queuePosition = getJobPosition(bomId);
  const estimatedWaitTime = getEstimatedWaitTime(bomId);

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">BOM Processing</h1>
        <StatusBadge status={status} isPaused={isPaused} />
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-red-800">Error</h3>
              <p className="text-red-600">{error}</p>
            </div>
            <button
              onClick={retry}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Overall Progress */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Overall Progress</h2>
          <span className="text-2xl font-bold text-blue-600">
            {Math.round(overallProgress)}%
          </span>
        </div>

        <ProgressBar value={overallProgress} />

        <div className="mt-4 flex items-center justify-between text-sm text-gray-600">
          <span>Current Phase: {formatPhase(currentPhase)}</span>
          <span>Status: {status}</span>
        </div>
      </div>

      {/* Multi-Phase Breakdown */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4">Processing Stages</h2>

        <div className="grid grid-cols-5 gap-4">
          {stages &&
            Object.entries(stages).map(([stageName, stage]) => (
              <StageCard
                key={stageName}
                name={stageName}
                stage={stage}
                isActive={stageName === stages[currentPhase]?.stage}
              />
            ))}
        </div>
      </div>

      {/* Queue Information */}
      {(queuePosition || estimatedWaitTime) && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-semibold text-blue-800 mb-2">Queue Information</h3>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <div className="text-gray-600">Your Position</div>
              <div className="text-2xl font-bold text-blue-600">
                #{queuePosition || '-'}
              </div>
            </div>
            <div>
              <div className="text-gray-600">Estimated Wait</div>
              <div className="text-2xl font-bold text-blue-600">
                {estimatedWaitTime ? formatTime(estimatedWaitTime) : '-'}
              </div>
            </div>
            <div>
              <div className="text-gray-600">Queue Length</div>
              <div className="text-2xl font-bold text-blue-600">
                {queueLength} jobs
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Real-Time Enrichment Updates (during enrichment phase) */}
      {currentPhase === 'enrichment' && enrichmentProgress && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Enrichment Progress</h2>

          <div className="grid grid-cols-4 gap-4 mb-4">
            <MetricCard
              label="Total Items"
              value={enrichmentProgress.total_items}
            />
            <MetricCard
              label="Enriched"
              value={enrichmentProgress.enriched_items}
              color="text-green-600"
            />
            <MetricCard
              label="Failed"
              value={enrichmentProgress.failed_items}
              color="text-red-600"
            />
            <MetricCard
              label="Pending"
              value={enrichmentProgress.pending_items}
              color="text-gray-600"
            />
          </div>

          {/* Current Item Being Processed */}
          {enrichmentProgress.current_item && (
            <div className="bg-gray-50 rounded p-3">
              <div className="text-sm text-gray-600">Currently Processing</div>
              <div className="font-mono font-semibold">
                {enrichmentProgress.current_item.mpn}
              </div>
              <div className="text-sm">
                Status: {enrichmentProgress.current_item.status}
                {enrichmentProgress.current_item.message && (
                  <span className="text-gray-600 ml-2">
                    - {enrichmentProgress.current_item.message}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Workflow Controls */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4">Workflow Controls</h2>

        <div className="flex gap-3">
          {canPause && (
            <button
              onClick={pause}
              className="px-6 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700"
            >
              Pause Processing
            </button>
          )}

          {canResume && (
            <button
              onClick={resume}
              className="px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700"
            >
              Resume Processing
            </button>
          )}

          {canCancel && (
            <button
              onClick={cancel}
              className="px-6 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              Cancel Processing
            </button>
          )}

          {!canPause && !canResume && !canCancel && (
            <div className="text-gray-500 italic">
              No actions available at this time
            </div>
          )}
        </div>
      </div>

      {/* Final Summary (when complete) */}
      {isComplete && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-6">
          <h2 className="text-xl font-bold text-green-800 mb-4">
            Processing Complete!
          </h2>

          <div className="grid grid-cols-4 gap-4 mb-4">
            <MetricCard label="Total Items" value={totalItems} />
            <MetricCard
              label="Enriched"
              value={enrichedItems}
              color="text-green-600"
            />
            <MetricCard
              label="Failed"
              value={failedItems}
              color="text-red-600"
            />
            {healthGrade && (
              <MetricCard
                label="Health Grade"
                value={healthGrade}
                color="text-blue-600"
              />
            )}
          </div>

          <button
            onClick={() => (window.location.href = `/boms/${bomId}`)}
            className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold"
          >
            View BOM Details
          </button>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// UTILITY COMPONENTS
// ============================================================================

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="w-full bg-gray-200 rounded-full h-4">
      <div
        className="bg-blue-600 h-4 rounded-full transition-all duration-300"
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}

function StatusBadge({
  status,
  isPaused,
}: {
  status: string;
  isPaused: boolean;
}) {
  const colors = {
    pending: 'bg-gray-100 text-gray-800',
    running: isPaused ? 'bg-yellow-100 text-yellow-800' : 'bg-blue-100 text-blue-800',
    completed: 'bg-green-100 text-green-800',
    failed: 'bg-red-100 text-red-800',
    cancelled: 'bg-gray-100 text-gray-800',
  };

  const displayStatus = isPaused ? 'Paused' : status;
  const colorClass = colors[status as keyof typeof colors] || colors.pending;

  return (
    <span className={`px-3 py-1 rounded-full text-sm font-semibold ${colorClass}`}>
      {displayStatus}
    </span>
  );
}

interface StageCardProps {
  name: string;
  stage: any;
  isActive: boolean;
}

function StageCard({ name, stage, isActive }: StageCardProps) {
  const stageLabels: Record<string, string> = {
    raw_upload: 'Upload',
    parsing: 'Parse',
    enrichment: 'Enrich',
    risk_analysis: 'Risk',
    complete: 'Done',
  };

  const statusColors = {
    pending: 'text-gray-400',
    in_progress: 'text-blue-600',
    completed: 'text-green-600',
    failed: 'text-red-600',
  };

  return (
    <div
      className={`border rounded-lg p-3 ${
        isActive ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
      }`}
    >
      <div className="text-sm font-semibold mb-2">{stageLabels[name] || name}</div>
      <ProgressBar value={stage.progress || 0} />
      <div
        className={`text-xs mt-2 ${
          statusColors[stage.status as keyof typeof statusColors] || 'text-gray-500'
        }`}
      >
        {stage.status}
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  color = 'text-blue-600',
}: {
  label: string;
  value: number | string;
  color?: string;
}) {
  return (
    <div className="bg-gray-50 rounded-lg p-4">
      <div className="text-sm text-gray-600 mb-1">{label}</div>
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
    </div>
  );
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function formatPhase(phase: BomProcessingPhase): string {
  const labels: Record<BomProcessingPhase, string> = {
    idle: 'Idle',
    upload: 'Uploading File',
    parsing: 'Parsing File',
    enrichment: 'Enriching Components',
    risk_analysis: 'Analyzing Risk',
    complete: 'Complete',
  };

  return labels[phase] || phase;
}

function formatTime(seconds: number): string {
  if (seconds < 60) {
    return `${Math.round(seconds)}s`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);

  if (minutes < 60) {
    return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  return `${hours}h ${remainingMinutes}m`;
}

export default UnifiedBomUpload;
