/**
 * VerticalStepper Component
 *
 * Left sidebar vertical stepper showing the BOM upload workflow:
 * 1. Files Selected
 * 2. Upload Queue
 * 3. Processing
 * 4. Enrichment Queue
 * 5. Analysis Queue
 * 6. BOM Processing Complete
 * 7. Summary/Results
 *
 * Features:
 * - Auto-scroll to active step
 * - Click to navigate to completed steps
 * - Visual status indicators (pending, active, complete, error)
 * - Icon-based step identification
 */

import { useEffect, useRef } from 'react';
import {
  FileText,
  Upload,
  FileSearch,
  Sparkles,
  BarChart3,
  CheckCircle,
  FileBarChart,
  LucideIcon,
} from 'lucide-react';
import { StepIndicator, StepStatus } from './StepIndicator';
import { cn } from '@/lib/utils';

export interface WorkflowStep {
  id: string;
  title: string;
  description?: string;
  icon: LucideIcon;
  status: StepStatus;
}

export interface VerticalStepperProps {
  /** Current active step ID */
  currentStepId: string;
  /** All workflow steps with their status */
  steps: WorkflowStep[];
  /** Click handler for step navigation */
  onStepClick?: (stepId: string) => void;
  /** Whether to allow clicking on completed steps */
  allowNavigateBack?: boolean;
  /** Auto-scroll to active step */
  autoScroll?: boolean;
  className?: string;
}

/**
 * Default BOM upload workflow steps
 */
export const DEFAULT_BOM_UPLOAD_STEPS: WorkflowStep[] = [
  {
    id: 'files_selected',
    title: 'Files Selected',
    description: 'Choose BOM file to upload',
    icon: FileText,
    status: 'pending',
  },
  {
    id: 'upload_queue',
    title: 'Upload Queue',
    description: 'File upload in progress',
    icon: Upload,
    status: 'pending',
  },
  {
    id: 'processing',
    title: 'Processing',
    description: 'Parsing and validating',
    icon: FileSearch,
    status: 'pending',
  },
  {
    id: 'enrichment_queue',
    title: 'Enrichment Queue',
    description: 'Component enrichment',
    icon: Sparkles,
    status: 'pending',
  },
  {
    id: 'analysis_queue',
    title: 'Analysis Queue',
    description: 'Risk analysis',
    icon: BarChart3,
    status: 'pending',
  },
  {
    id: 'complete',
    title: 'BOM Processing Complete',
    description: 'All tasks finished',
    icon: CheckCircle,
    status: 'pending',
  },
  {
    id: 'summary',
    title: 'Summary/Results',
    description: 'View final report',
    icon: FileBarChart,
    status: 'pending',
  },
];

export function VerticalStepper({
  currentStepId,
  steps,
  onStepClick,
  allowNavigateBack = true,
  autoScroll = true,
  className,
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

  const handleStepClick = (step: WorkflowStep, index: number) => {
    if (!onStepClick) return;

    // Allow navigation to completed steps if enabled
    if (allowNavigateBack && (step.status === 'complete' || step.status === 'active')) {
      onStepClick(step.id);
    }
  };

  return (
    <div
      className={cn(
        'flex flex-col gap-2 p-4',
        className
      )}
      role="navigation"
      aria-label="Workflow steps"
    >
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Workflow Steps
        </h2>
      </div>

      <div className="space-y-0">
        {steps.map((step, index) => (
          <StepIndicator
            key={step.id}
            stepNumber={index + 1}
            title={step.title}
            icon={step.icon}
            status={step.status}
            description={step.description}
            isLast={index === steps.length - 1}
            onClick={() => handleStepClick(step, index)}
            clickable={allowNavigateBack && (step.status === 'complete' || step.status === 'active')}
            scrollRef={step.id === currentStepId ? activeStepRef : undefined}
          />
        ))}
      </div>

      {/* Workflow progress summary */}
      <div className="mt-6 pt-6 border-t">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Progress</span>
            <span className="font-medium">
              {steps.filter((s) => s.status === 'complete').length} / {steps.length}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-primary transition-all duration-500"
              style={{
                width: `${(steps.filter((s) => s.status === 'complete').length / steps.length) * 100}%`,
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default VerticalStepper;
