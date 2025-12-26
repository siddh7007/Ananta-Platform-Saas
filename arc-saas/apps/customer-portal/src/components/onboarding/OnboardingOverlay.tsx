/**
 * OnboardingOverlay Component
 * Renders the spotlight effect and tooltip for onboarding steps
 *
 * Features:
 * - Spotlight highlights target elements with customizable padding
 * - Tooltip with step information positioned intelligently
 * - Progress indicator dots
 * - Next/Skip/Complete buttons with keyboard navigation
 * - Smooth transitions between steps with reduced-motion support
 * - Accessibility: Focus management, ARIA labels, keyboard navigation
 */

import { useEffect, useState, useRef } from 'react';
import { X, ChevronRight, ChevronLeft } from 'lucide-react';
import { useOnboarding } from './OnboardingProvider';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface SpotlightPosition {
  top: number;
  left: number;
  width: number;
  height: number;
}

export function OnboardingOverlay() {
  const {
    isActive,
    currentStep,
    currentStepIndex,
    totalSteps,
    nextStep,
    previousStep,
    skipOnboarding,
    completeOnboarding,
  } = useOnboarding();

  const [spotlightPosition, setSpotlightPosition] = useState<SpotlightPosition | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const tooltipRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<MutationObserver | null>(null);

  // Update spotlight and tooltip positions when step changes or window resizes
  useEffect(() => {
    if (!isActive || !currentStep) {
      setSpotlightPosition(null);
      return;
    }

    const updatePositions = () => {
      if (currentStep.targetSelector) {
        const targetElement = document.querySelector(currentStep.targetSelector) as HTMLElement;
        if (targetElement) {
          const rect = targetElement.getBoundingClientRect();
          const padding = currentStep.spotlightPadding || 8;

          setSpotlightPosition({
            top: rect.top - padding,
            left: rect.left - padding,
            width: rect.width + padding * 2,
            height: rect.height + padding * 2,
          });

          // Calculate tooltip position based on preferred position
          calculateTooltipPosition(rect, currentStep.position || 'bottom');

          // Scroll target into view if not visible
          targetElement.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
            inline: 'center',
          });
        } else {
          // Target not found - center the tooltip
          setSpotlightPosition(null);
          centerTooltip();
        }
      } else {
        // No target - center the tooltip
        setSpotlightPosition(null);
        centerTooltip();
      }
    };

    const calculateTooltipPosition = (targetRect: DOMRect, position: string) => {
      // Wait for tooltip to render and get its dimensions
      setTimeout(() => {
        if (!tooltipRef.current) return;

        const tooltipRect = tooltipRef.current.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const gap = 16; // Gap between tooltip and target

        let top = 0;
        let left = 0;

        switch (position) {
          case 'top':
            top = targetRect.top - tooltipRect.height - gap;
            left = targetRect.left + targetRect.width / 2 - tooltipRect.width / 2;
            break;
          case 'bottom':
            top = targetRect.bottom + gap;
            left = targetRect.left + targetRect.width / 2 - tooltipRect.width / 2;
            break;
          case 'left':
            top = targetRect.top + targetRect.height / 2 - tooltipRect.height / 2;
            left = targetRect.left - tooltipRect.width - gap;
            break;
          case 'right':
            top = targetRect.top + targetRect.height / 2 - tooltipRect.height / 2;
            left = targetRect.right + gap;
            break;
          case 'center':
          default:
            centerTooltip();
            return;
        }

        // Ensure tooltip stays within viewport
        if (left < gap) left = gap;
        if (left + tooltipRect.width > viewportWidth - gap) {
          left = viewportWidth - tooltipRect.width - gap;
        }
        if (top < gap) top = gap;
        if (top + tooltipRect.height > viewportHeight - gap) {
          top = viewportHeight - tooltipRect.height - gap;
        }

        setTooltipPosition({ top, left });
      }, 0);
    };

    const centerTooltip = () => {
      setTimeout(() => {
        if (!tooltipRef.current) return;

        const tooltipRect = tooltipRef.current.getBoundingClientRect();
        setTooltipPosition({
          top: window.innerHeight / 2 - tooltipRect.height / 2,
          left: window.innerWidth / 2 - tooltipRect.width / 2,
        });
      }, 0);
    };

    updatePositions();

    // Update on window resize
    window.addEventListener('resize', updatePositions);

    // Observe DOM changes to update positions if target moves
    observerRef.current = new MutationObserver(updatePositions);
    observerRef.current.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'style'],
    });

    return () => {
      window.removeEventListener('resize', updatePositions);
      observerRef.current?.disconnect();
    };
  }, [isActive, currentStep]);

  // Keyboard navigation
  useEffect(() => {
    if (!isActive) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        skipOnboarding();
      } else if (e.key === 'ArrowRight' || e.key === 'Enter') {
        e.preventDefault();
        nextStep();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        if (currentStepIndex > 0) {
          previousStep();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isActive, currentStepIndex, nextStep, previousStep, skipOnboarding]);

  // Focus management - focus tooltip when it appears
  useEffect(() => {
    if (isActive && tooltipRef.current) {
      tooltipRef.current.focus();
    }
  }, [isActive, currentStepIndex]);

  if (!isActive || !currentStep) {
    return null;
  }

  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === totalSteps - 1;

  return (
    <div
      className="fixed inset-0 z-50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-title"
      aria-describedby="onboarding-description"
    >
      {/* Backdrop with spotlight effect */}
      <div className="absolute inset-0">
        {/* Dark overlay */}
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300" />

        {/* Spotlight cutout */}
        {spotlightPosition && (
          <div
            className={cn(
              'absolute rounded-lg ring-4 ring-primary/50 transition-all duration-300',
              'motion-reduce:transition-none'
            )}
            style={{
              top: `${spotlightPosition.top}px`,
              left: `${spotlightPosition.left}px`,
              width: `${spotlightPosition.width}px`,
              height: `${spotlightPosition.height}px`,
              boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.6)',
            }}
          />
        )}
      </div>

      {/* Tooltip */}
      <div
        ref={tooltipRef}
        className={cn(
          'absolute max-w-md rounded-lg border bg-background p-6 shadow-lg',
          'transition-all duration-300 motion-reduce:transition-none',
          'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2'
        )}
        style={{
          top: `${tooltipPosition.top}px`,
          left: `${tooltipPosition.left}px`,
        }}
        tabIndex={-1}
      >
        {/* Close button */}
        <button
          onClick={skipOnboarding}
          className={cn(
            'absolute right-2 top-2 rounded-sm p-1 opacity-70 ring-offset-background',
            'transition-opacity hover:opacity-100',
            'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2'
          )}
          aria-label="Skip onboarding"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>

        {/* Content */}
        <div className="space-y-4">
          <div className="space-y-2">
            <h2 id="onboarding-title" className="text-lg font-semibold leading-none tracking-tight">
              {currentStep.title}
            </h2>
            <p id="onboarding-description" className="text-sm text-muted-foreground">
              {currentStep.description}
            </p>
          </div>

          {/* Progress indicator dots */}
          <div className="flex items-center justify-center gap-1.5" role="progressbar" aria-valuenow={currentStepIndex + 1} aria-valuemin={1} aria-valuemax={totalSteps}>
            {Array.from({ length: totalSteps }, (_, i) => (
              <div
                key={i}
                className={cn(
                  'h-1.5 w-1.5 rounded-full transition-all duration-200',
                  i === currentStepIndex
                    ? 'w-6 bg-primary'
                    : i < currentStepIndex
                    ? 'bg-primary/50'
                    : 'bg-muted-foreground/30'
                )}
                aria-label={`Step ${i + 1}${i === currentStepIndex ? ' (current)' : ''}`}
              />
            ))}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs text-muted-foreground">
              {currentStepIndex + 1} / {totalSteps}
            </div>

            <div className="flex gap-2">
              {!isFirstStep && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={previousStep}
                  aria-label="Previous step"
                >
                  <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                  Back
                </Button>
              )}

              {!isLastStep ? (
                <Button size="sm" onClick={nextStep} aria-label="Next step">
                  Next
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </Button>
              ) : (
                <Button size="sm" onClick={completeOnboarding} aria-label="Complete onboarding">
                  Get Started
                </Button>
              )}
            </div>
          </div>

          {/* Skip button for non-last steps */}
          {!isLastStep && (
            <div className="text-center">
              <button
                onClick={skipOnboarding}
                className="text-xs text-muted-foreground underline-offset-4 hover:underline focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded"
                aria-label="Skip onboarding tour"
              >
                Skip tour
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
