/**
 * PageTransition Component - Usage Examples
 *
 * Real-world examples demonstrating various use cases and patterns.
 */

import { Suspense } from 'react';
import { useLocation, useNavigationType, Outlet } from 'react-router-dom';
import {
  PageTransition,
  usePageTransition,
  PAGE_TRANSITIONS,
  type AnimationVariant,
  PageLoading,
} from '@/components/shared';

/* ========================================
 * EXAMPLE 1: Basic Page Wrapper
 * Simple fade transition for any page
 * ======================================== */
export function BasicPageExample() {
  return (
    <PageTransition variant="fade" duration="normal">
      <div className="container mx-auto py-8">
        <h1 className="text-3xl font-bold mb-4">Welcome to Dashboard</h1>
        <p className="text-muted-foreground">
          This page fades in smoothly when you navigate to it.
        </p>
      </div>
    </PageTransition>
  );
}

/* ========================================
 * EXAMPLE 2: Route-Based Transitions
 * Automatically animate on route changes
 * ======================================== */
export function RouteTransitionExample() {
  const location = useLocation();

  return (
    <PageTransition
      variant="slide-left"
      duration="normal"
      transitionKey={location.pathname}
      onTransitionComplete={(state) => {
        // Analytics tracking
        if (state === 'entered') {
          console.log('[Analytics] Page view:', location.pathname);
        }
      }}
    >
      <Outlet />
    </PageTransition>
  );
}

/* ========================================
 * EXAMPLE 3: Smart Navigation Transitions
 * Different animations for forward/back
 * ======================================== */
export function SmartNavigationExample() {
  const location = useLocation();
  const navigationType = useNavigationType();

  // Detect back navigation
  const isBackNavigation = navigationType === 'POP';

  return (
    <PageTransition
      variant={isBackNavigation ? 'slide-right' : 'slide-left'}
      duration="normal"
      transitionKey={location.pathname}
    >
      <div className="page-content">
        <Outlet />
      </div>
    </PageTransition>
  );
}

/* ========================================
 * EXAMPLE 4: Modal/Dialog Transitions
 * Scale animation for overlays
 * ======================================== */
export function ModalTransitionExample({ isOpen, onClose, children }: {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center">
      <PageTransition
        variant="scale"
        duration="fast"
        transitionKey={isOpen ? 'open' : 'closed'}
      >
        <div className="bg-card rounded-lg p-6 max-w-md w-full">
          {children}
          <button onClick={onClose} className="mt-4">
            Close
          </button>
        </div>
      </PageTransition>
    </div>
  );
}

/* ========================================
 * EXAMPLE 5: Async Content Loading
 * Transition while loading data
 * ======================================== */
export function AsyncContentExample({ ContentComponent }: { ContentComponent: React.ComponentType }) {
  const location = useLocation();

  return (
    <PageTransition
      variant="fade"
      duration="fast"
      transitionKey={location.pathname}
    >
      <Suspense fallback={<PageLoading />}>
        <ContentComponent />
      </Suspense>
    </PageTransition>
  );
}

/* ========================================
 * EXAMPLE 6: Programmatic Transitions
 * Using the usePageTransition hook
 * ======================================== */
export function ProgrammaticTransitionExample() {
  const { state, isTransitioning, triggerTransition } = usePageTransition();

  const handleSaveAndContinue = async () => {
    // Save data
    await saveFormData();

    // Trigger transition, then navigate
    triggerTransition(() => {
      window.location.href = '/next-step';
    }, 'normal');
  };

  return (
    <div>
      <h2>Form Step 1</h2>
      <button
        onClick={handleSaveAndContinue}
        disabled={isTransitioning}
        className="btn-primary"
      >
        {isTransitioning ? 'Saving...' : 'Save & Continue'}
      </button>
      <p className="text-sm text-muted-foreground">
        Transition state: {state}
      </p>
    </div>
  );
}

// Mock function for example
async function saveFormData() {
  return new Promise(resolve => setTimeout(resolve, 1000));
}

/* ========================================
 * EXAMPLE 7: Pre-built Transition Presets
 * Using PAGE_TRANSITIONS constants
 * ======================================== */
export function PresetTransitionsExample() {
  const location = useLocation();

  // Choose preset based on route
  const getTransitionPreset = (path: string) => {
    if (path.includes('/modal')) return PAGE_TRANSITIONS.scale;
    if (path.includes('/details')) return PAGE_TRANSITIONS.forward;
    if (path.includes('/settings')) return PAGE_TRANSITIONS.subtle;
    return PAGE_TRANSITIONS.fade;
  };

  const preset = getTransitionPreset(location.pathname);

  return (
    <PageTransition {...preset} transitionKey={location.pathname}>
      <Outlet />
    </PageTransition>
  );
}

/* ========================================
 * EXAMPLE 8: Nested Transitions
 * Parent and child components with different animations
 * ======================================== */
export function NestedTransitionsExample() {
  const location = useLocation();

  return (
    <PageTransition
      variant="fade"
      duration="normal"
      transitionKey={location.pathname}
    >
      <div className="page-layout">
        <header className="page-header">
          <h1>Dashboard</h1>
        </header>

        {/* Child transition for content area */}
        <PageTransition
          variant="slide-up"
          duration="fast"
          transitionKey={location.pathname + '-content'}
        >
          <main className="page-content">
            <Outlet />
          </main>
        </PageTransition>
      </div>
    </PageTransition>
  );
}

/* ========================================
 * EXAMPLE 9: Conditional Animations
 * Based on device/preferences
 * ======================================== */
export function AdaptiveTransitionExample() {
  const location = useLocation();
  const isMobile = window.matchMedia('(max-width: 768px)').matches;
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  return (
    <PageTransition
      variant={isMobile ? 'fade' : 'slide-left'}
      duration={isMobile ? 'fast' : 'normal'}
      disabled={prefersReducedMotion}
      transitionKey={location.pathname}
    >
      <Outlet />
    </PageTransition>
  );
}

/* ========================================
 * EXAMPLE 10: Tab Transitions
 * Smooth transitions between tab panels
 * ======================================== */
export function TabTransitionExample() {
  const [activeTab, setActiveTab] = useState('overview');

  const tabContent = {
    overview: <OverviewTab />,
    analytics: <AnalyticsTab />,
    settings: <SettingsTab />,
  };

  return (
    <div>
      <div className="flex gap-2 mb-4">
        {Object.keys(tabContent).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={activeTab === tab ? 'btn-primary' : 'btn-secondary'}
          >
            {tab}
          </button>
        ))}
      </div>

      <PageTransition
        variant="fade"
        duration="fast"
        transitionKey={activeTab}
      >
        {tabContent[activeTab as keyof typeof tabContent]}
      </PageTransition>
    </div>
  );
}

// Mock tab components
function OverviewTab() {
  return <div>Overview content</div>;
}
function AnalyticsTab() {
  return <div>Analytics content</div>;
}
function SettingsTab() {
  return <div>Settings content</div>;
}

/* ========================================
 * EXAMPLE 11: Focus Management
 * Manage focus after transitions
 * ======================================== */
export function AccessibleTransitionExample() {
  const location = useLocation();

  return (
    <PageTransition
      variant="fade"
      duration="normal"
      transitionKey={location.pathname}
      onTransitionComplete={(state) => {
        if (state === 'entered') {
          // Focus main heading
          const heading = document.querySelector('h1');
          if (heading && 'focus' in heading) {
            (heading as HTMLElement).focus();
          }
        }
      }}
    >
      <div>
        {/* Make heading focusable */}
        <h1 tabIndex={-1} className="focus:outline-none focus:ring-2">
          Page Title
        </h1>
        <div aria-live="polite" className="sr-only">
          Navigated to {location.pathname}
        </div>
        <main>
          <Outlet />
        </main>
      </div>
    </PageTransition>
  );
}

/* ========================================
 * EXAMPLE 12: Multi-Step Form Wizard
 * Different transitions for steps
 * ======================================== */
export function WizardTransitionExample() {
  const [currentStep, setCurrentStep] = useState(0);
  const [direction, setDirection] = useState<'forward' | 'back'>('forward');

  const steps = [
    { id: 'personal', component: <PersonalInfoStep /> },
    { id: 'billing', component: <BillingInfoStep /> },
    { id: 'review', component: <ReviewStep /> },
  ];

  const goNext = () => {
    setDirection('forward');
    setCurrentStep((prev) => Math.min(prev + 1, steps.length - 1));
  };

  const goBack = () => {
    setDirection('back');
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <div className="flex justify-between">
          {steps.map((step, index) => (
            <div
              key={step.id}
              className={index === currentStep ? 'font-bold' : 'text-muted-foreground'}
            >
              Step {index + 1}
            </div>
          ))}
        </div>
      </div>

      <PageTransition
        variant={direction === 'forward' ? 'slide-left' : 'slide-right'}
        duration="normal"
        transitionKey={currentStep.toString()}
      >
        {steps[currentStep].component}
      </PageTransition>

      <div className="flex gap-4 mt-8">
        <button
          onClick={goBack}
          disabled={currentStep === 0}
          className="btn-secondary"
        >
          Back
        </button>
        <button
          onClick={goNext}
          disabled={currentStep === steps.length - 1}
          className="btn-primary"
        >
          {currentStep === steps.length - 1 ? 'Finish' : 'Next'}
        </button>
      </div>
    </div>
  );
}

// Mock step components
function PersonalInfoStep() {
  return <div>Personal Information Form</div>;
}
function BillingInfoStep() {
  return <div>Billing Information Form</div>;
}
function ReviewStep() {
  return <div>Review & Submit</div>;
}

/* ========================================
 * EXAMPLE 13: Custom Transition Classes
 * Combining with Tailwind utilities
 * ======================================== */
export function CustomStyledTransitionExample() {
  return (
    <PageTransition
      variant="slide-up"
      duration="normal"
      className="min-h-screen bg-gradient-to-b from-background to-muted/20 p-8"
    >
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-4">Beautiful Page</h1>
        <p className="text-lg text-muted-foreground">
          Custom styling combined with smooth transitions.
        </p>
      </div>
    </PageTransition>
  );
}

/* ========================================
 * EXAMPLE 14: Error State Transitions
 * Graceful transitions for error states
 * ======================================== */
export function ErrorStateTransitionExample({ error }: { error?: Error }) {
  if (error) {
    return (
      <PageTransition variant="scale" duration="fast">
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-destructive mb-2">
              Something went wrong
            </h1>
            <p className="text-muted-foreground">{error.message}</p>
            <button onClick={() => window.location.reload()} className="btn-primary mt-4">
              Retry
            </button>
          </div>
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition variant="fade">
      <div>Normal content</div>
    </PageTransition>
  );
}

/* ========================================
 * EXAMPLE 15: Layout Component Integration
 * Complete app layout with transitions
 * ======================================== */
export function AppLayoutWithTransitions() {
  const location = useLocation();
  const navigationType = useNavigationType();

  // Determine animation based on navigation
  const getVariant = (): AnimationVariant => {
    // Modal routes
    if (location.pathname.includes('/modal')) return 'scale';

    // Back navigation
    if (navigationType === 'POP') return 'slide-right';

    // Forward navigation
    return 'slide-left';
  };

  return (
    <div className="flex min-h-screen">
      {/* Sidebar - no transition */}
      <aside className="w-64 bg-sidebar">
        <nav>{/* Navigation items */}</nav>
      </aside>

      {/* Main content - with transitions */}
      <main className="flex-1 overflow-auto">
        <PageTransition
          variant={getVariant()}
          duration="normal"
          transitionKey={location.pathname}
          className="min-h-full"
        >
          <Suspense fallback={<PageLoading />}>
            <Outlet />
          </Suspense>
        </PageTransition>
      </main>
    </div>
  );
}

/* ========================================
 * UTILITY: Custom Hook for Route Transitions
 * Reusable hook for common patterns
 * ======================================== */
export function useRouteTransition() {
  const location = useLocation();
  const navigationType = useNavigationType();

  const variant: AnimationVariant =
    navigationType === 'POP' ? 'slide-right' : 'slide-left';

  const transitionKey = location.pathname;

  return { variant, transitionKey, duration: 'normal' as const };
}

// Usage:
export function RouteTransitionHookExample() {
  const transitionProps = useRouteTransition();

  return (
    <PageTransition {...transitionProps}>
      <Outlet />
    </PageTransition>
  );
}

/* ========================================
 * Helper: Import useState for examples
 * ======================================== */
import { useState } from 'react';
