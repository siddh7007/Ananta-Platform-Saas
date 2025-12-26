/**
 * Tests for OnboardingProvider
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OnboardingProvider, useOnboarding } from './OnboardingProvider';

const STORAGE_KEY = 'cbp-onboarding-completed';

// Test component that uses the hook
function TestComponent() {
  const {
    isActive,
    currentStepIndex,
    currentStep,
    totalSteps,
    startOnboarding,
    stopOnboarding,
    nextStep,
    previousStep,
    skipOnboarding,
    completeOnboarding,
    hasCompletedOnboarding,
    resetOnboarding,
  } = useOnboarding();

  return (
    <div>
      <div data-testid="is-active">{String(isActive)}</div>
      <div data-testid="current-step-index">{currentStepIndex}</div>
      <div data-testid="current-step-title">{currentStep?.title || 'none'}</div>
      <div data-testid="total-steps">{totalSteps}</div>
      <div data-testid="has-completed">{String(hasCompletedOnboarding)}</div>

      <button onClick={startOnboarding}>Start</button>
      <button onClick={stopOnboarding}>Stop</button>
      <button onClick={nextStep}>Next</button>
      <button onClick={previousStep}>Previous</button>
      <button onClick={skipOnboarding}>Skip</button>
      <button onClick={completeOnboarding}>Complete</button>
      <button onClick={resetOnboarding}>Reset</button>
    </div>
  );
}

describe('OnboardingProvider', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    vi.clearAllTimers();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('provides onboarding context to children', () => {
    render(
      <OnboardingProvider autoStartDelay={0}>
        <TestComponent />
      </OnboardingProvider>
    );

    expect(screen.getByTestId('is-active')).toHaveTextContent('false');
    expect(screen.getByTestId('current-step-index')).toHaveTextContent('0');
    expect(screen.getByTestId('total-steps')).toHaveTextContent('6');
  });

  it('auto-starts for new users', async () => {
    render(
      <OnboardingProvider autoStartDelay={100}>
        <TestComponent />
      </OnboardingProvider>
    );

    // Initially inactive
    expect(screen.getByTestId('is-active')).toHaveTextContent('false');

    // Wait for auto-start
    await waitFor(
      () => {
        expect(screen.getByTestId('is-active')).toHaveTextContent('true');
      },
      { timeout: 200 }
    );

    expect(screen.getByTestId('current-step-title')).toHaveTextContent('Welcome to CBP');
  });

  it('does not auto-start for returning users', async () => {
    localStorage.setItem(STORAGE_KEY, 'true');

    render(
      <OnboardingProvider autoStartDelay={100}>
        <TestComponent />
      </OnboardingProvider>
    );

    expect(screen.getByTestId('has-completed')).toHaveTextContent('true');

    // Wait to ensure it doesn't auto-start
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(screen.getByTestId('is-active')).toHaveTextContent('false');
  });

  it('starts onboarding manually', async () => {
    const user = userEvent.setup();

    render(
      <OnboardingProvider autoStartDelay={0}>
        <TestComponent />
      </OnboardingProvider>
    );

    expect(screen.getByTestId('is-active')).toHaveTextContent('false');

    await user.click(screen.getByText('Start'));

    expect(screen.getByTestId('is-active')).toHaveTextContent('true');
    expect(screen.getByTestId('current-step-index')).toHaveTextContent('0');
  });

  it('advances to next step', async () => {
    const user = userEvent.setup();

    render(
      <OnboardingProvider autoStartDelay={0}>
        <TestComponent />
      </OnboardingProvider>
    );

    await user.click(screen.getByText('Start'));

    expect(screen.getByTestId('current-step-index')).toHaveTextContent('0');
    expect(screen.getByTestId('current-step-title')).toHaveTextContent('Welcome to CBP');

    await user.click(screen.getByText('Next'));

    expect(screen.getByTestId('current-step-index')).toHaveTextContent('1');
    expect(screen.getByTestId('current-step-title')).toHaveTextContent('Upload Your First BOM');
  });

  it('goes to previous step', async () => {
    const user = userEvent.setup();

    render(
      <OnboardingProvider autoStartDelay={0}>
        <TestComponent />
      </OnboardingProvider>
    );

    await user.click(screen.getByText('Start'));
    await user.click(screen.getByText('Next')); // Step 1
    await user.click(screen.getByText('Next')); // Step 2

    expect(screen.getByTestId('current-step-index')).toHaveTextContent('2');

    await user.click(screen.getByText('Previous'));

    expect(screen.getByTestId('current-step-index')).toHaveTextContent('1');
  });

  it('completes onboarding on last step next', async () => {
    const user = userEvent.setup();

    render(
      <OnboardingProvider autoStartDelay={0}>
        <TestComponent />
      </OnboardingProvider>
    );

    await user.click(screen.getByText('Start'));

    // Navigate to last step (index 5)
    for (let i = 0; i < 5; i++) {
      await user.click(screen.getByText('Next'));
    }

    expect(screen.getByTestId('current-step-index')).toHaveTextContent('5');
    expect(screen.getByTestId('is-active')).toHaveTextContent('true');

    // Next on last step completes
    await user.click(screen.getByText('Next'));

    expect(screen.getByTestId('is-active')).toHaveTextContent('false');
    expect(screen.getByTestId('has-completed')).toHaveTextContent('true');
    expect(localStorage.getItem(STORAGE_KEY)).toBe('true');
  });

  it('skips onboarding and marks as completed', async () => {
    const user = userEvent.setup();

    render(
      <OnboardingProvider autoStartDelay={0}>
        <TestComponent />
      </OnboardingProvider>
    );

    await user.click(screen.getByText('Start'));

    expect(screen.getByTestId('is-active')).toHaveTextContent('true');

    await user.click(screen.getByText('Skip'));

    expect(screen.getByTestId('is-active')).toHaveTextContent('false');
    expect(screen.getByTestId('has-completed')).toHaveTextContent('true');
    expect(localStorage.getItem(STORAGE_KEY)).toBe('true');
  });

  it('completes onboarding manually', async () => {
    const user = userEvent.setup();

    render(
      <OnboardingProvider autoStartDelay={0}>
        <TestComponent />
      </OnboardingProvider>
    );

    await user.click(screen.getByText('Start'));
    await user.click(screen.getByText('Complete'));

    expect(screen.getByTestId('is-active')).toHaveTextContent('false');
    expect(screen.getByTestId('has-completed')).toHaveTextContent('true');
    expect(localStorage.getItem(STORAGE_KEY)).toBe('true');
  });

  it('resets onboarding state', async () => {
    const user = userEvent.setup();

    render(
      <OnboardingProvider autoStartDelay={0}>
        <TestComponent />
      </OnboardingProvider>
    );

    await user.click(screen.getByText('Start'));
    await user.click(screen.getByText('Complete'));

    expect(screen.getByTestId('has-completed')).toHaveTextContent('true');
    expect(localStorage.getItem(STORAGE_KEY)).toBe('true');

    await user.click(screen.getByText('Reset'));

    expect(screen.getByTestId('has-completed')).toHaveTextContent('false');
    expect(screen.getByTestId('is-active')).toHaveTextContent('false');
    expect(screen.getByTestId('current-step-index')).toHaveTextContent('0');
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('stops onboarding without marking as completed', async () => {
    const user = userEvent.setup();

    render(
      <OnboardingProvider autoStartDelay={0}>
        <TestComponent />
      </OnboardingProvider>
    );

    await user.click(screen.getByText('Start'));

    expect(screen.getByTestId('is-active')).toHaveTextContent('true');

    await user.click(screen.getByText('Stop'));

    expect(screen.getByTestId('is-active')).toHaveTextContent('false');
    expect(screen.getByTestId('has-completed')).toHaveTextContent('false');
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('accepts custom steps', () => {
    const customSteps = [
      {
        id: 'step1',
        title: 'Custom Step 1',
        description: 'Description 1',
      },
      {
        id: 'step2',
        title: 'Custom Step 2',
        description: 'Description 2',
      },
    ];

    render(
      <OnboardingProvider steps={customSteps} autoStartDelay={0}>
        <TestComponent />
      </OnboardingProvider>
    );

    expect(screen.getByTestId('total-steps')).toHaveTextContent('2');
  });

  it('throws error when useOnboarding is used outside provider', () => {
    // Suppress console.error for this test
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      render(<TestComponent />);
    }).toThrow('useOnboarding must be used within OnboardingProvider');

    consoleSpy.mockRestore();
  });
});
