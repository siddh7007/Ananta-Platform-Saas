/**
 * VerticalStepper Component (MUI version)
 *
 * Left sidebar vertical stepper showing the BOM upload workflow:
 * 1. Select File
 * 2. Preview Data
 * 3. Map Columns
 * 4. Review & Configure
 * 5. Results
 *
 * Features:
 * - Auto-scroll to active step
 * - Visual status indicators (pending, active, complete, error)
 * - Icon-based step identification
 * - Progress summary at bottom with progress bar
 *
 * Adapted from CBP VerticalStepper for Material-UI.
 */

import React, { useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  LinearProgress,
  styled,
  alpha,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import ErrorIcon from '@mui/icons-material/Error';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import TableChartIcon from '@mui/icons-material/TableChart';
import SettingsIcon from '@mui/icons-material/Settings';
import RateReviewIcon from '@mui/icons-material/RateReview';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import SyncIcon from '@mui/icons-material/Sync';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import type { BomUploadStep } from '../../hooks/useBomUploadPersistence';

export type StepStatus = 'pending' | 'active' | 'complete' | 'error';

export interface WorkflowStep {
  id: BomUploadStep;
  title: string;
  description?: string;
  icon: React.ReactNode;
  status: StepStatus;
}

export interface VerticalStepperProps {
  /** Current active step ID */
  currentStepId: BomUploadStep;
  /** All workflow steps with their status */
  steps: WorkflowStep[];
  /** Click handler for step navigation */
  onStepClick?: (stepId: BomUploadStep) => void;
  /** Whether to allow clicking on completed steps */
  allowNavigateBack?: boolean;
  /** Auto-scroll to active step */
  autoScroll?: boolean;
}

// Styled components for the stepper
const StepperContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(0.5),
  padding: theme.spacing(2),
}));

const StepItem = styled(Box, {
  shouldForwardProp: (prop) => !['status', 'clickable', 'isLast'].includes(prop as string),
})<{ status: StepStatus; clickable: boolean; isLast: boolean }>(({ theme, status, clickable, isLast }) => ({
  display: 'flex',
  alignItems: 'flex-start',
  gap: theme.spacing(1.5),
  padding: theme.spacing(1.5),
  borderRadius: theme.shape.borderRadius,
  cursor: clickable ? 'pointer' : 'default',
  transition: 'all 0.2s ease',
  position: 'relative',

  // Background based on status
  backgroundColor: status === 'active'
    ? alpha(theme.palette.primary.main, 0.08)
    : status === 'complete'
    ? alpha(theme.palette.success.main, 0.04)
    : status === 'error'
    ? alpha(theme.palette.error.main, 0.08)
    : 'transparent',

  // Border for active step
  border: status === 'active'
    ? `1px solid ${alpha(theme.palette.primary.main, 0.3)}`
    : '1px solid transparent',

  '&:hover': clickable ? {
    backgroundColor: status === 'active'
      ? alpha(theme.palette.primary.main, 0.12)
      : alpha(theme.palette.action.hover, 1),
  } : {},

  // Connecting line to next step
  '&::after': !isLast ? {
    content: '""',
    position: 'absolute',
    left: 28, // Center of the icon (12px padding + 16px half-icon)
    top: 44,  // Below the icon
    width: 2,
    height: 16,
    backgroundColor: status === 'complete'
      ? theme.palette.success.main
      : theme.palette.divider,
    borderRadius: 1,
  } : {},
}));

const IconWrapper = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'status',
})<{ status: StepStatus }>(({ theme, status }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 32,
  height: 32,
  borderRadius: '50%',
  flexShrink: 0,

  // Colors based on status
  backgroundColor: status === 'complete'
    ? theme.palette.success.main
    : status === 'active'
    ? theme.palette.primary.main
    : status === 'error'
    ? theme.palette.error.main
    : theme.palette.grey[200],

  color: status === 'pending'
    ? theme.palette.grey[500]
    : theme.palette.common.white,

  '& svg': {
    fontSize: 18,
  },
}));

const StepContent = styled(Box)({
  flex: 1,
  minWidth: 0,
});

const StepTitle = styled(Typography, {
  shouldForwardProp: (prop) => prop !== 'status',
})<{ status: StepStatus }>(({ theme, status }) => ({
  fontSize: '0.875rem',
  fontWeight: status === 'active' ? 600 : 500,
  color: status === 'pending'
    ? theme.palette.text.secondary
    : status === 'error'
    ? theme.palette.error.main
    : theme.palette.text.primary,
  lineHeight: 1.4,
}));

const StepDescription = styled(Typography)(({ theme }) => ({
  fontSize: '0.75rem',
  color: theme.palette.text.secondary,
  marginTop: 2,
  lineHeight: 1.3,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}));

const ProgressSection = styled(Box)(({ theme }) => ({
  marginTop: theme.spacing(3),
  paddingTop: theme.spacing(3),
  borderTop: `1px solid ${theme.palette.divider}`,
}));

// Step icon mapping
const stepIconMap: Record<BomUploadStep, React.ReactNode> = {
  select_file: <CloudUploadIcon />,
  preview_data: <TableChartIcon />,
  map_columns: <SettingsIcon />,
  review_summary: <RateReviewIcon />,
  uploading: <CloudUploadIcon />,
  processing: <SyncIcon />,
  enriching: <AutoAwesomeIcon />,
  results: <DoneAllIcon />,
};

/**
 * Get the appropriate icon for a step based on its status
 */
function getStepIcon(step: WorkflowStep): React.ReactNode {
  if (step.status === 'complete') {
    return <CheckCircleIcon />;
  }
  if (step.status === 'error') {
    return <ErrorIcon />;
  }
  if (step.status === 'pending') {
    return <RadioButtonUncheckedIcon />;
  }
  // Active - show the step's own icon
  return step.icon;
}

export function VerticalStepper({
  currentStepId,
  steps,
  onStepClick,
  allowNavigateBack = true,
  autoScroll = true,
}: VerticalStepperProps) {
  const activeStepRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to active step
  useEffect(() => {
    if (autoScroll && activeStepRef.current) {
      activeStepRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [currentStepId, autoScroll]);

  const handleStepClick = (step: WorkflowStep) => {
    if (!onStepClick) return;

    // Allow navigation to completed steps if enabled
    if (allowNavigateBack && (step.status === 'complete' || step.status === 'active')) {
      onStepClick(step.id);
    }
  };

  const completedCount = steps.filter((s) => s.status === 'complete').length;
  const progressPercent = (completedCount / steps.length) * 100;

  return (
    <StepperContainer>
      {/* Header */}
      <Box mb={2}>
        <Typography
          variant="overline"
          sx={{
            color: 'text.secondary',
            fontWeight: 600,
            letterSpacing: '0.1em',
          }}
        >
          Workflow Steps
        </Typography>
      </Box>

      {/* Steps */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        {steps.map((step, index) => {
          const isClickable = allowNavigateBack && (step.status === 'complete' || step.status === 'active');
          const isLast = index === steps.length - 1;
          const isActive = step.id === currentStepId;

          return (
            <StepItem
              key={step.id}
              ref={isActive ? activeStepRef : undefined}
              status={step.status}
              clickable={isClickable}
              isLast={isLast}
              onClick={() => handleStepClick(step)}
              role="button"
              aria-current={isActive ? 'step' : undefined}
              tabIndex={isClickable ? 0 : -1}
            >
              <IconWrapper status={step.status}>
                {getStepIcon(step)}
              </IconWrapper>
              <StepContent>
                <StepTitle status={step.status}>
                  {step.title}
                </StepTitle>
                {step.description && (
                  <StepDescription>
                    {step.description}
                  </StepDescription>
                )}
              </StepContent>
            </StepItem>
          );
        })}
      </Box>

      {/* Progress summary */}
      <ProgressSection>
        <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
          <Typography variant="caption" color="text.secondary">
            Progress
          </Typography>
          <Typography variant="caption" fontWeight={600}>
            {completedCount} / {steps.length}
          </Typography>
        </Box>
        <LinearProgress
          variant="determinate"
          value={progressPercent}
          sx={{
            height: 8,
            borderRadius: 4,
            backgroundColor: 'grey.200',
            '& .MuiLinearProgress-bar': {
              borderRadius: 4,
            },
          }}
        />
      </ProgressSection>
    </StepperContainer>
  );
}

export default VerticalStepper;
