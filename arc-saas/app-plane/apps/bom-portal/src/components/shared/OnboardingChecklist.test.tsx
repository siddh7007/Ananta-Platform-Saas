/**
 * OnboardingChecklist Tests
 *
 * Tests for onboarding progress checklist component.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '../../test/test-utils';
import { OnboardingChecklist } from './OnboardingChecklist';

// Mock the services
vi.mock('../../services/onboardingService', () => ({
  onboardingService: {
    getStatus: vi.fn(),
  },
}));

vi.mock('../../services/analytics', () => ({
  analytics: {
    isBannerDismissed: vi.fn().mockReturnValue(false),
    dismissBanner: vi.fn(),
    trackOnboardingSkipped: vi.fn(),
    trackOnboardingComplete: vi.fn(),
    trackFeatureDiscovery: vi.fn(),
  },
}));

// Import mocked modules
import { onboardingService } from '../../services/onboardingService';
import { analytics } from '../../services/analytics';

const mockOnboardingStatus = {
  organization_id: 'test-org-id',
  organization_name: 'Test Organization',
  user_welcome_sent: true,
  user_first_login_at: new Date().toISOString(),
  checklist: {
    first_bom_uploaded: false,
    first_enrichment_complete: false,
    team_member_invited: false,
    alert_preferences_configured: false,
    risk_thresholds_set: false,
  },
  onboarding_completed_at: null,
  trial_days_remaining: 14,
};

describe('OnboardingChecklist', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(onboardingService.getStatus).mockResolvedValue(mockOnboardingStatus);
    vi.mocked(analytics.isBannerDismissed).mockReturnValue(false);
  });

  it('renders loading state initially', () => {
    const { container } = render(<OnboardingChecklist />);

    // Should show skeleton loaders (MuiCard with MuiSkeleton)
    expect(container.querySelector('.MuiCard-root')).toBeInTheDocument();
    expect(container.querySelector('.MuiSkeleton-root')).toBeInTheDocument();
  });

  it('renders checklist after loading', async () => {
    render(<OnboardingChecklist />);

    await waitFor(() => {
      expect(screen.getByText('Get Started')).toBeInTheDocument();
    });

    expect(screen.getByText('Upload your first BOM')).toBeInTheDocument();
    expect(screen.getByText('Complete first enrichment')).toBeInTheDocument();
    expect(screen.getByText('Invite a team member')).toBeInTheDocument();
  });

  it('shows progress count', async () => {
    vi.mocked(onboardingService.getStatus).mockResolvedValue({
      ...mockOnboardingStatus,
      checklist: {
        ...mockOnboardingStatus.checklist,
        first_bom_uploaded: true,
        first_enrichment_complete: true,
      },
    });

    render(<OnboardingChecklist />);

    await waitFor(() => {
      expect(screen.getByText('2/5')).toBeInTheDocument();
    });
  });

  it('shows trial days remaining', async () => {
    render(<OnboardingChecklist showTrialBanner />);

    await waitFor(() => {
      expect(screen.getByText(/14 days/)).toBeInTheDocument();
    });
  });

  it('shows warning when trial is almost expired', async () => {
    vi.mocked(onboardingService.getStatus).mockResolvedValue({
      ...mockOnboardingStatus,
      trial_days_remaining: 2,
    });

    render(<OnboardingChecklist showTrialBanner />);

    await waitFor(() => {
      expect(screen.getByText(/2 days/)).toBeInTheDocument();
    });

    // Should show warning alert
    const alert = screen.getByRole('alert');
    expect(alert).toBeInTheDocument();
  });

  it('calls onDismiss when dismissed', async () => {
    const onDismiss = vi.fn();
    render(<OnboardingChecklist onDismiss={onDismiss} dismissible />);

    await waitFor(() => {
      expect(screen.getByText('Get Started')).toBeInTheDocument();
    });

    const dismissButton = screen.getByRole('button', { name: /dismiss/i });
    fireEvent.click(dismissButton);

    expect(analytics.dismissBanner).toHaveBeenCalledWith('onboarding_checklist');
    expect(analytics.trackOnboardingSkipped).toHaveBeenCalled();
    expect(onDismiss).toHaveBeenCalled();
  });

  it('hides when already dismissed', async () => {
    vi.mocked(analytics.isBannerDismissed).mockReturnValue(true);

    const { container } = render(<OnboardingChecklist />);

    // Should render nothing
    expect(container.firstChild).toBeNull();
  });

  it('navigates when step action is clicked', async () => {
    render(<OnboardingChecklist />);

    await waitFor(() => {
      expect(screen.getByText('Upload your first BOM')).toBeInTheDocument();
    });

    const uploadButton = screen.getByRole('button', { name: /upload bom/i });
    fireEvent.click(uploadButton);

    expect(analytics.trackFeatureDiscovery).toHaveBeenCalledWith('onboarding_first_bom_uploaded');
  });

  it('shows completed steps with checkmark', async () => {
    vi.mocked(onboardingService.getStatus).mockResolvedValue({
      ...mockOnboardingStatus,
      checklist: {
        ...mockOnboardingStatus.checklist,
        first_bom_uploaded: true,
      },
    });

    render(<OnboardingChecklist />);

    await waitFor(() => {
      expect(screen.getByText('Upload your first BOM')).toBeInTheDocument();
    });

    // Completed step should not have an action button
    expect(screen.queryByRole('button', { name: /upload bom/i })).not.toBeInTheDocument();
  });

  it('expands and collapses checklist', async () => {
    render(<OnboardingChecklist />);

    await waitFor(() => {
      expect(screen.getByText('Upload your first BOM')).toBeInTheDocument();
    });

    // Find expand/collapse button and click to collapse
    const buttons = screen.getAllByRole('button');
    const expandButton = buttons.find((btn) =>
      btn.querySelector('[data-testid="ExpandLessIcon"]') ||
      btn.querySelector('[data-testid="ExpandMoreIcon"]')
    );

    if (expandButton) {
      fireEvent.click(expandButton);
      // Content should be hidden in collapse
    }
  });

  it('renders compact mode correctly', async () => {
    render(<OnboardingChecklist compact />);

    await waitFor(() => {
      expect(screen.getByText('Getting Started')).toBeInTheDocument();
    });

    // Should show progress chip
    expect(screen.getByText('0/5')).toBeInTheDocument();

    // Should not show full step list in compact mode
    expect(screen.queryByText('Upload your first BOM')).not.toBeInTheDocument();
  });

  it('shows error state when loading fails', async () => {
    vi.mocked(onboardingService.getStatus).mockRejectedValue(new Error('Network error'));

    render(<OnboardingChecklist />);

    await waitFor(() => {
      expect(screen.getByText(/unable to load onboarding status/i)).toBeInTheDocument();
    });
  });

  it('tracks completion when all steps are done', async () => {
    vi.mocked(onboardingService.getStatus).mockResolvedValue({
      ...mockOnboardingStatus,
      checklist: {
        first_bom_uploaded: true,
        first_enrichment_complete: true,
        team_member_invited: true,
        alert_preferences_configured: true,
        risk_thresholds_set: true,
      },
      onboarding_completed_at: null, // Not yet marked complete
      trial_days_remaining: 14,
    });

    render(<OnboardingChecklist />);

    await waitFor(() => {
      expect(analytics.trackOnboardingComplete).toHaveBeenCalled();
    });
  });

  it('hides when already completed', async () => {
    vi.mocked(onboardingService.getStatus).mockResolvedValue({
      ...mockOnboardingStatus,
      checklist: {
        first_bom_uploaded: true,
        first_enrichment_complete: true,
        team_member_invited: true,
        alert_preferences_configured: true,
        risk_thresholds_set: true,
      },
      onboarding_completed_at: '2024-01-01T00:00:00Z',
      trial_days_remaining: 14,
    });

    const { container } = render(<OnboardingChecklist />);

    await waitFor(() => {
      // Should render nothing when completed
      expect(container.querySelector('.MuiCard-root')).not.toBeInTheDocument();
    });
  });

  it('does not show dismiss button when not dismissible', async () => {
    render(<OnboardingChecklist dismissible={false} />);

    await waitFor(() => {
      expect(screen.getByText('Get Started')).toBeInTheDocument();
    });

    expect(screen.queryByRole('button', { name: /dismiss/i })).not.toBeInTheDocument();
  });
});
