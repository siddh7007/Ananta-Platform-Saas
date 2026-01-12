/**
 * OnboardingProvider Component
 * Manages first-time user onboarding flow for BOM management tool
 *
 * Features:
 * - Auto-starts for new users after 1 second delay
 * - Persists completion state in localStorage
 * - Step-by-step progression through key features
 * - Can be restarted from settings
 */

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

export interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  targetSelector?: string;
  spotlightPadding?: number;
  position?: 'top' | 'bottom' | 'left' | 'right' | 'center';
  action?: {
    label: string;
    onClick?: () => void;
  };
}

interface OnboardingContextType {
  isActive: boolean;
  currentStepIndex: number;
  currentStep: OnboardingStep | null;
  totalSteps: number;
  /** Start the onboarding flow */
  startOnboarding: () => void;
  /** Stop the onboarding flow */
  stopOnboarding: () => void;
  /** Move to the next step */
  nextStep: () => void;
  /** Move to the previous step */
  previousStep: () => void;
  /** Skip the onboarding flow */
  skipOnboarding: () => void;
  /** Complete the onboarding flow */
  completeOnboarding: () => void;
  /** Check if user has completed onboarding */
  hasCompletedOnboarding: boolean;
  /** Reset onboarding state (for testing/settings) */
  resetOnboarding: () => void;
}

const OnboardingContext = createContext<OnboardingContextType | null>(null);

const STORAGE_KEY = 'cbp-onboarding-completed';

/**
 * Onboarding steps for electronics BOM management tool
 */
const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to Ananta Platform',
    description: 'Your intelligent electronics BOM management platform. Let us show you around in just a few steps.',
    position: 'center',
  },
  {
    id: 'upload-bom',
    title: 'Upload Your First BOM',
    description: 'Start by uploading a Bill of Materials. We support Excel (.xlsx, .xls) and CSV formats. Our intelligent parser will automatically detect columns and map components.',
    targetSelector: '[data-onboarding="bom-upload-button"]',
    position: 'bottom',
    spotlightPadding: 8,
  },
  {
    id: 'enrichment',
    title: 'Automatic Enrichment',
    description: 'Once uploaded, we automatically enrich your BOM with real-time pricing, stock availability, and technical specifications from multiple suppliers. Watch the progress in real-time.',
    targetSelector: '[data-onboarding="enrichment-status"]',
    position: 'bottom',
    spotlightPadding: 8,
  },
  {
    id: 'component-search',
    title: 'Component Search',
    description: 'Search millions of components with parametric filters. Filter by manufacturer, category, specifications, and more to find the perfect match for your design.',
    targetSelector: '[data-onboarding="component-search"]',
    position: 'bottom',
    spotlightPadding: 8,
  },
  {
    id: 'compare-components',
    title: 'Compare Components',
    description: 'Select multiple components to compare pricing, availability, and specifications side-by-side. Make data-driven sourcing decisions with confidence.',
    targetSelector: '[data-onboarding="compare-button"]',
    position: 'bottom',
    spotlightPadding: 8,
  },
  {
    id: 'complete',
    title: "You're All Set!",
    description: "You're ready to start managing your BOMs efficiently. Explore risk analysis, supplier comparison, and collaboration features at your own pace.",
    position: 'center',
  },
];

interface OnboardingProviderProps {
  children: ReactNode;
  /** Auto-start delay in milliseconds (default: 1000) */
  autoStartDelay?: number;
  /** Custom steps (optional - overrides default) */
  steps?: OnboardingStep[];
}

export function OnboardingProvider({
  children,
  autoStartDelay = 1000,
  steps = ONBOARDING_STEPS,
}: OnboardingProviderProps) {
  const [isActive, setIsActive] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);

  // Load completion state from localStorage on mount
  useEffect(() => {
    const completed = localStorage.getItem(STORAGE_KEY) === 'true';
    setHasCompletedOnboarding(completed);

    // Auto-start for new users after delay
    if (!completed) {
      const timer = setTimeout(() => {
        setIsActive(true);
      }, autoStartDelay);

      return () => clearTimeout(timer);
    }
  }, [autoStartDelay]);

  const startOnboarding = useCallback(() => {
    setCurrentStepIndex(0);
    setIsActive(true);
  }, []);

  const stopOnboarding = useCallback(() => {
    setIsActive(false);
  }, []);

  const completeOnboarding = useCallback(() => {
    setIsActive(false);
    localStorage.setItem(STORAGE_KEY, 'true');
    setHasCompletedOnboarding(true);
  }, []);

  const nextStep = useCallback(() => {
    if (currentStepIndex < steps.length - 1) {
      setCurrentStepIndex((prev) => prev + 1);
    } else {
      completeOnboarding();
    }
  }, [currentStepIndex, steps.length, completeOnboarding]);

  const previousStep = useCallback(() => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex((prev) => prev - 1);
    }
  }, [currentStepIndex]);

  const skipOnboarding = useCallback(() => {
    setIsActive(false);
    // Mark as completed so it doesn't auto-start again
    localStorage.setItem(STORAGE_KEY, 'true');
    setHasCompletedOnboarding(true);
  }, []);

  const resetOnboarding = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setHasCompletedOnboarding(false);
    setCurrentStepIndex(0);
    setIsActive(false);
  }, []);

  const currentStep = isActive ? steps[currentStepIndex] : null;

  return (
    <OnboardingContext.Provider
      value={{
        isActive,
        currentStepIndex,
        currentStep,
        totalSteps: steps.length,
        startOnboarding,
        stopOnboarding,
        nextStep,
        previousStep,
        skipOnboarding,
        completeOnboarding,
        hasCompletedOnboarding,
        resetOnboarding,
      }}
    >
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  const context = useContext(OnboardingContext);
  if (!context) {
    throw new Error('useOnboarding must be used within OnboardingProvider');
  }
  return context;
}
