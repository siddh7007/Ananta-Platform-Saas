/**
 * Storybook stories for OnboardingOverlay
 * Visual testing and documentation for the onboarding flow
 */

import type { Meta, StoryObj } from '@storybook/react';
import { OnboardingProvider, OnboardingOverlay } from './index';
import { Button } from '@/components/ui/button';
import { Upload, Search, BarChart3 } from 'lucide-react';
import { useOnboarding } from './OnboardingProvider';

const meta = {
  title: 'Components/Onboarding/OnboardingOverlay',
  component: OnboardingOverlay,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: 'First-time user onboarding flow with spotlight effect and step-by-step guidance.',
      },
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof OnboardingOverlay>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Demo app with target elements for onboarding
 */
function DemoApp() {
  const { startOnboarding, resetOnboarding, hasCompletedOnboarding } = useOnboarding();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold">CBP Demo</h1>
            <input
              data-onboarding="component-search"
              className="rounded-md border px-3 py-2 text-sm"
              placeholder="Search components..."
            />
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                resetOnboarding();
                startOnboarding();
              }}
            >
              {hasCompletedOnboarding ? 'Restart Tour' : 'Start Tour'}
            </Button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="container px-4 py-8">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {/* BOM Upload Card */}
          <div className="rounded-lg border bg-card p-6">
            <h2 className="mb-4 text-lg font-semibold">Upload BOM</h2>
            <p className="mb-4 text-sm text-muted-foreground">
              Upload your Bill of Materials to start enrichment
            </p>
            <Button data-onboarding="bom-upload-button" className="w-full">
              <Upload className="h-4 w-4" />
              Upload File
            </Button>
          </div>

          {/* Enrichment Status Card */}
          <div
            data-onboarding="enrichment-status"
            className="rounded-lg border bg-card p-6"
          >
            <h2 className="mb-4 text-lg font-semibold">Enrichment Status</h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span>Processing</span>
                <span className="font-medium">75%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                <div className="h-full w-3/4 bg-primary transition-all" />
              </div>
              <p className="text-xs text-muted-foreground">
                45 of 60 components enriched
              </p>
            </div>
          </div>

          {/* Component Comparison Card */}
          <div className="rounded-lg border bg-card p-6">
            <h2 className="mb-4 text-lg font-semibold">Component Comparison</h2>
            <p className="mb-4 text-sm text-muted-foreground">
              Compare pricing and availability across suppliers
            </p>
            <Button data-onboarding="compare-button" variant="outline" className="w-full">
              <BarChart3 className="h-4 w-4" />
              Compare Selected (3)
            </Button>
          </div>
        </div>

        {/* Search Section */}
        <div className="mt-8 rounded-lg border bg-card p-6">
          <h2 className="mb-4 text-lg font-semibold">Component Search</h2>
          <div className="flex gap-2">
            <input
              data-onboarding="component-search"
              className="flex-1 rounded-md border px-3 py-2 text-sm"
              placeholder="Search by MPN, manufacturer, or category..."
            />
            <Button>
              <Search className="h-4 w-4" />
              Search
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}

/**
 * Default story - Onboarding active with demo app
 */
export const Default: Story = {
  render: () => (
    <OnboardingProvider autoStartDelay={500}>
      <DemoApp />
      <OnboardingOverlay />
    </OnboardingProvider>
  ),
};

/**
 * Completed state - Tour already completed
 */
export const Completed: Story = {
  render: () => {
    // Simulate completed onboarding
    if (typeof window !== 'undefined') {
      localStorage.setItem('cbp-onboarding-completed', 'true');
    }

    return (
      <OnboardingProvider autoStartDelay={0}>
        <DemoApp />
        <OnboardingOverlay />
      </OnboardingProvider>
    );
  },
  parameters: {
    docs: {
      description: {
        story: 'Onboarding is marked as completed. Click "Restart Tour" to see it again.',
      },
    },
  },
};

/**
 * New user - Auto-starts immediately
 */
export const NewUser: Story = {
  render: () => {
    // Clear completed flag
    if (typeof window !== 'undefined') {
      localStorage.removeItem('cbp-onboarding-completed');
    }

    return (
      <OnboardingProvider autoStartDelay={0}>
        <DemoApp />
        <OnboardingOverlay />
      </OnboardingProvider>
    );
  },
  parameters: {
    docs: {
      description: {
        story: 'Simulates a first-time user. Onboarding starts automatically.',
      },
    },
  },
};

/**
 * Custom steps - Different onboarding flow
 */
export const CustomSteps: Story = {
  render: () => {
    const customSteps = [
      {
        id: 'welcome',
        title: 'Welcome to Custom Tour',
        description: 'This is a custom onboarding flow with different steps.',
        position: 'center' as const,
      },
      {
        id: 'search',
        title: 'Try Searching',
        description: 'Use the search bar to find components quickly.',
        targetSelector: '[data-onboarding="component-search"]',
        position: 'bottom' as const,
        spotlightPadding: 12,
      },
      {
        id: 'done',
        title: 'All Done!',
        description: 'You can customize the onboarding steps to fit your needs.',
        position: 'center' as const,
      },
    ];

    if (typeof window !== 'undefined') {
      localStorage.removeItem('cbp-onboarding-completed');
    }

    return (
      <OnboardingProvider steps={customSteps} autoStartDelay={0}>
        <DemoApp />
        <OnboardingOverlay />
      </OnboardingProvider>
    );
  },
  parameters: {
    docs: {
      description: {
        story: 'Custom onboarding steps can be provided to the OnboardingProvider.',
      },
    },
  },
};

/**
 * Spotlight positions - Different tooltip placements
 */
export const SpotlightPositions: Story = {
  render: () => {
    const positionSteps = [
      {
        id: 'center',
        title: 'Center Position',
        description: 'Tooltip appears in the center when no target is specified.',
        position: 'center' as const,
      },
      {
        id: 'top',
        title: 'Top Position',
        description: 'Tooltip appears above the target element.',
        targetSelector: '[data-onboarding="bom-upload-button"]',
        position: 'top' as const,
        spotlightPadding: 8,
      },
      {
        id: 'bottom',
        title: 'Bottom Position',
        description: 'Tooltip appears below the target element.',
        targetSelector: '[data-onboarding="bom-upload-button"]',
        position: 'bottom' as const,
        spotlightPadding: 8,
      },
      {
        id: 'left',
        title: 'Left Position',
        description: 'Tooltip appears to the left of the target element.',
        targetSelector: '[data-onboarding="compare-button"]',
        position: 'left' as const,
        spotlightPadding: 8,
      },
      {
        id: 'right',
        title: 'Right Position',
        description: 'Tooltip appears to the right of the target element.',
        targetSelector: '[data-onboarding="enrichment-status"]',
        position: 'right' as const,
        spotlightPadding: 8,
      },
    ];

    if (typeof window !== 'undefined') {
      localStorage.removeItem('cbp-onboarding-completed');
    }

    return (
      <OnboardingProvider steps={positionSteps} autoStartDelay={0}>
        <DemoApp />
        <OnboardingOverlay />
      </OnboardingProvider>
    );
  },
  parameters: {
    docs: {
      description: {
        story: 'Demonstrates different tooltip positions relative to target elements.',
      },
    },
  },
};
