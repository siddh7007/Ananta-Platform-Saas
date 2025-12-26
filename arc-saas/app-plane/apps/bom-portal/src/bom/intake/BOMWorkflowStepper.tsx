/**
 * BOMWorkflowStepper Component
 *
 * Vertical stepper showing unified BOM workflow stages:
 * Upload → Parse → Map → Save → Enrich → Results
 */

import React from 'react';
import {
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Typography,
  Box,
  CircularProgress,
  LinearProgress,
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import TableViewIcon from '@mui/icons-material/TableView';
import MapIcon from '@mui/icons-material/Map';
import SaveIcon from '@mui/icons-material/Save';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import AssessmentIcon from '@mui/icons-material/Assessment';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { workflowStatusColors } from '../../theme';

// Extended status type to include enrichment phases
export type BOMWorkflowStatus =
  | 'pending'
  | 'parsing'
  | 'uploading'
  | 'mapping'
  | 'confirming'
  | 'saving'
  | 'completed'       // Upload completed, ready for enrichment
  | 'enriching'       // Enrichment in progress
  | 'analyzing'       // Risk analysis in progress
  | 'enriched'        // Workflow complete
  | 'error';

interface WorkflowStep {
  label: string;
  description: string;
  icon: React.ReactNode;
}

const WORKFLOW_STEPS: WorkflowStep[] = [
  {
    label: 'Select Files',
    description: 'Drop or select your BOM file (CSV, Excel)',
    icon: <CloudUploadIcon />,
  },
  {
    label: 'Upload & Parse',
    description: 'Uploading file and detecting columns',
    icon: <TableViewIcon />,
  },
  {
    label: 'Map Columns',
    description: 'Match your columns to standard fields',
    icon: <MapIcon />,
  },
  {
    label: 'Save BOM',
    description: 'Creating BOM and saving line items',
    icon: <SaveIcon />,
  },
  {
    label: 'Enrich Components',
    description: 'Fetching pricing, stock, and datasheets from suppliers',
    icon: <AutoFixHighIcon />,
  },
  {
    label: 'Risk Analysis',
    description: 'Calculating risk scores and lifecycle analysis',
    icon: <AssessmentIcon />,
  },
  {
    label: 'Complete',
    description: 'Workflow complete - view results and export',
    icon: <CheckCircleIcon />,
  },
];

interface EnrichmentProgress {
  percent: number;
  enriched: number;
  total: number;
}

interface BOMWorkflowStepperProps {
  /** Current status of the active upload */
  currentStatus: BOMWorkflowStatus | null;
  /** Whether any file is currently processing */
  isProcessing?: boolean;
  /** Orientation of the stepper */
  orientation?: 'vertical' | 'horizontal';
  /** Whether to show step descriptions */
  showDescriptions?: boolean;
  /** Enrichment progress (when in enriching phase) */
  enrichmentProgress?: EnrichmentProgress | null;
  /** Callback when a completed step is clicked (for navigation) */
  onStepClick?: (stepIndex: number, stepLabel: string) => void;
  /** Whether step navigation is enabled */
  allowNavigation?: boolean;
}

/**
 * Get active step index from status
 *
 * Steps:
 * 0 - Select Files (drag & drop)
 * 1 - Upload & Parse (uploading, parsing)
 * 2 - Map Columns (mapping)
 * 3 - Save BOM (confirming, saving)
 * 4 - Enrich Components (completed = ready, enriching = in progress)
 * 5 - Risk Analysis (analyzing)
 * 6 - Complete (enriched)
 */
function getActiveStep(status: BOMWorkflowStatus | null): number {
  if (!status) return 0;

  switch (status) {
    case 'pending':
      // Files selected, step 0 complete, ready to start step 1
      return 1;
    case 'parsing':
    case 'uploading':
      return 1; // Upload & Parse step
    case 'mapping':
      return 2;
    case 'confirming':
    case 'saving':
      return 3;
    case 'completed':
      return 4; // Ready for enrichment
    case 'enriching':
      return 4; // Enrichment in progress
    case 'analyzing':
      return 5; // Risk analysis in progress
    case 'enriched':
      return 6; // Workflow complete
    case 'error':
      return -1;
    default:
      return 0;
  }
}

/**
 * Check if a step is complete
 */
function isStepComplete(stepIndex: number, status: BOMWorkflowStatus | null): boolean {
  if (!status) return false;
  const activeStep = getActiveStep(status);
  if (status === 'enriched') return stepIndex <= 6; // All steps complete
  if (status === 'analyzing') return stepIndex < 5;  // Steps 0-4 complete
  if (status === 'enriching') return stepIndex < 4;  // Steps 0-3 complete
  if (status === 'completed') return stepIndex < 4;  // Steps 0-3 complete
  // When files are pending, step 0 (Select Files) is complete
  if (status === 'pending') return stepIndex < 1;
  return stepIndex < activeStep;
}

/**
 * Check if a step is currently active
 */
function isStepActive(stepIndex: number, status: BOMWorkflowStatus | null): boolean {
  if (!status) return stepIndex === 0;
  return getActiveStep(status) === stepIndex;
}

export function BOMWorkflowStepper({
  currentStatus,
  isProcessing = false,
  orientation = 'vertical',
  showDescriptions = true,
  enrichmentProgress,
  onStepClick,
  allowNavigation = true,
}: BOMWorkflowStepperProps) {
  const activeStep = getActiveStep(currentStatus);

  const handleStepClick = (index: number, label: string) => {
    // Only allow clicking completed steps (going back) when navigation is enabled
    const isComplete = isStepComplete(index, currentStatus);
    if (allowNavigation && isComplete && onStepClick) {
      onStepClick(index, label);
    }
  };

  return (
    <Stepper
      activeStep={activeStep}
      orientation={orientation}
      sx={{
        '& .MuiStepLabel-root': {
          py: orientation === 'vertical' ? 0.5 : 1,
        },
        '& .MuiStepContent-root': {
          borderColor: 'divider',
        },
      }}
    >
      {WORKFLOW_STEPS.map((step, index) => {
        const isComplete = isStepComplete(index, currentStatus);
        const isActive = isStepActive(index, currentStatus);
        const isError = currentStatus === 'error' && isActive;
        const isEnrichmentStep = index === 4 && currentStatus === 'enriching';
        const isAnalyzingStep = index === 5 && currentStatus === 'analyzing';
        const isClickable = allowNavigation && isComplete && onStepClick;

        return (
          <Step
            key={step.label}
            completed={isComplete}
            sx={{
              cursor: isClickable ? 'pointer' : 'default',
              '&:hover': isClickable ? {
                '& .MuiStepLabel-label': {
                  color: 'primary.main',
                },
              } : {},
            }}
            onClick={() => handleStepClick(index, step.label)}
          >
            <StepLabel
              error={isError}
              StepIconComponent={() => (
                <Box
                  sx={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    bgcolor: isComplete
                      ? workflowStatusColors.completed
                      : isActive
                      ? workflowStatusColors.processing
                      : isError
                      ? workflowStatusColors.failed
                      : 'action.disabledBackground',
                    color: isComplete || isActive || isError ? 'white' : 'text.secondary',
                    transition: 'all 0.3s ease',
                  }}
                >
                  {(isActive && isProcessing) || isEnrichmentStep || isAnalyzingStep ? (
                    <CircularProgress size={16} color="inherit" />
                  ) : isComplete ? (
                    <CheckCircleIcon sx={{ fontSize: 18 }} />
                  ) : (
                    React.cloneElement(step.icon as React.ReactElement, {
                      sx: { fontSize: 16 },
                    })
                  )}
                </Box>
              )}
            >
              <Typography
                variant="body2"
                fontWeight={isActive ? 600 : 400}
                color={isComplete ? 'text.primary' : isActive ? 'primary.main' : 'text.secondary'}
              >
                {step.label}
              </Typography>
            </StepLabel>
            {orientation === 'vertical' && showDescriptions && (
              <StepContent>
                <Typography variant="caption" color="text.secondary">
                  {step.description}
                </Typography>
                {/* Enrichment progress bar */}
                {isEnrichmentStep && enrichmentProgress && (
                  <Box sx={{ mt: 1 }}>
                    <LinearProgress
                      variant="determinate"
                      value={enrichmentProgress.percent}
                      sx={{ height: 6, borderRadius: 1 }}
                    />
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                      {enrichmentProgress.enriched} / {enrichmentProgress.total} components
                    </Typography>
                  </Box>
                )}
              </StepContent>
            )}
          </Step>
        );
      })}
    </Stepper>
  );
}

export default BOMWorkflowStepper;
