/**
 * ContextualBanner Tests
 *
 * Tests for contextual banner components and variants.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '../../test/test-utils';
import {
  ContextualBanner,
  FeatureBanner,
  TipBanner,
  WarningBanner,
  SuccessBanner,
  TrialExpirationBanner,
  MfaRecommendationBanner,
} from './ContextualBanner';

// Mock analytics service
vi.mock('../../services/analytics', () => ({
  analytics: {
    isBannerDismissed: vi.fn().mockReturnValue(false),
    dismissBanner: vi.fn(),
    track: vi.fn(),
  },
}));

import { analytics } from '../../services/analytics';

describe('ContextualBanner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    vi.mocked(analytics.isBannerDismissed).mockReturnValue(false);
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  it('renders banner with title', () => {
    render(
      <ContextualBanner
        id="test-banner"
        title="Test Banner"
      />
    );

    expect(screen.getByText('Test Banner')).toBeInTheDocument();
  });

  it('renders banner with description', () => {
    render(
      <ContextualBanner
        id="test-banner"
        title="Test Banner"
        description="This is a description"
      />
    );

    expect(screen.getByText('This is a description')).toBeInTheDocument();
  });

  it('does not render when previously dismissed', () => {
    vi.mocked(analytics.isBannerDismissed).mockReturnValue(true);

    const { container } = render(
      <ContextualBanner
        id="dismissed-banner"
        title="Test Banner"
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it('calls onDismiss and tracks dismissal when closed', () => {
    const onDismiss = vi.fn();
    render(
      <ContextualBanner
        id="test-banner"
        title="Test Banner"
        onDismiss={onDismiss}
        dismissible
      />
    );

    const dismissButton = screen.getByRole('button', { name: /dismiss/i });
    fireEvent.click(dismissButton);

    expect(analytics.dismissBanner).toHaveBeenCalledWith('test-banner');
    expect(onDismiss).toHaveBeenCalled();
  });

  it('does not show dismiss button when not dismissible', () => {
    render(
      <ContextualBanner
        id="test-banner"
        title="Test Banner"
        dismissible={false}
      />
    );

    expect(screen.queryByRole('button', { name: /dismiss/i })).not.toBeInTheDocument();
  });

  it('renders action button and handles click', () => {
    const onClick = vi.fn();
    render(
      <ContextualBanner
        id="test-banner"
        title="Test Banner"
        action={{ label: 'Click Me', onClick }}
      />
    );

    const actionButton = screen.getByRole('button', { name: /click me/i });
    fireEvent.click(actionButton);

    expect(onClick).toHaveBeenCalled();
    expect(analytics.track).toHaveBeenCalledWith(
      'navigation',
      'banner_action_clicked',
      { label: 'test-banner' }
    );
  });

  it('renders link when provided', () => {
    render(
      <ContextualBanner
        id="test-banner"
        title="Test Banner"
        link={{ label: 'Learn More', href: '/docs' }}
      />
    );

    const link = screen.getByRole('link', { name: /learn more/i });
    expect(link).toHaveAttribute('href', '/docs');
  });

  it('renders external link with target blank', () => {
    render(
      <ContextualBanner
        id="test-banner"
        title="Test Banner"
        link={{ label: 'External', href: 'https://example.com', external: true }}
      />
    );

    const link = screen.getByRole('link', { name: /external/i });
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('uses custom icon when provided', () => {
    render(
      <ContextualBanner
        id="test-banner"
        title="Test Banner"
        icon={<span data-testid="custom-icon">★</span>}
      />
    );

    expect(screen.getByTestId('custom-icon')).toBeInTheDocument();
  });

  it('respects showOnce and stores in sessionStorage', () => {
    const { unmount } = render(
      <ContextualBanner
        id="once-banner"
        title="Show Once"
        showOnce
      />
    );

    expect(screen.getByText('Show Once')).toBeInTheDocument();
    expect(sessionStorage.getItem('banner_shown_once-banner')).toBe('true');

    unmount();

    // Render again - should not show
    const { container } = render(
      <ContextualBanner
        id="once-banner"
        title="Show Once"
        showOnce
      />
    );

    expect(container.querySelector('[class*="MuiPaper"]')).not.toBeInTheDocument();
  });

  it('renders compact mode', () => {
    render(
      <ContextualBanner
        id="test-banner"
        title="Compact Banner"
        description="This should not show in compact"
        compact
      />
    );

    expect(screen.getByText('Compact Banner')).toBeInTheDocument();
    // Description should not be visible in compact mode
    expect(screen.queryByText('This should not show in compact')).not.toBeInTheDocument();
  });

  describe('Banner Variants', () => {
    it('renders info variant', () => {
      const { container } = render(
        <ContextualBanner
          id="info-banner"
          variant="info"
          title="Info Banner"
        />
      );

      expect(container.querySelector('[data-testid="InfoOutlinedIcon"]')).toBeInTheDocument();
    });

    it('renders tip variant', () => {
      const { container } = render(
        <ContextualBanner
          id="tip-banner"
          variant="tip"
          title="Tip Banner"
        />
      );

      expect(container.querySelector('[data-testid="TipsAndUpdatesIcon"]')).toBeInTheDocument();
    });

    it('renders warning variant', () => {
      const { container } = render(
        <ContextualBanner
          id="warning-banner"
          variant="warning"
          title="Warning Banner"
        />
      );

      expect(container.querySelector('[data-testid="WarningAmberIcon"]')).toBeInTheDocument();
    });

    it('renders success variant', () => {
      const { container } = render(
        <ContextualBanner
          id="success-banner"
          variant="success"
          title="Success Banner"
        />
      );

      expect(container.querySelector('[data-testid="CheckCircleOutlineIcon"]')).toBeInTheDocument();
    });
  });
});

describe('FeatureBanner', () => {
  beforeEach(() => {
    vi.mocked(analytics.isBannerDismissed).mockReturnValue(false);
  });

  it('renders with "New:" prefix', () => {
    render(
      <FeatureBanner
        id="feature-1"
        featureName="Dark Mode"
        description="Try our new dark theme"
      />
    );

    expect(screen.getByText('New: Dark Mode')).toBeInTheDocument();
    expect(screen.getByText('Try our new dark theme')).toBeInTheDocument();
  });

  it('renders learn more link when URL provided', () => {
    render(
      <FeatureBanner
        id="feature-1"
        featureName="Dark Mode"
        learnMoreUrl="https://docs.example.com/dark-mode"
      />
    );

    const link = screen.getByRole('link', { name: /learn more/i });
    expect(link).toHaveAttribute('href', 'https://docs.example.com/dark-mode');
  });
});

describe('TipBanner', () => {
  beforeEach(() => {
    vi.mocked(analytics.isBannerDismissed).mockReturnValue(false);
  });

  it('renders tip text', () => {
    render(
      <TipBanner
        id="tip-1"
        tip="Here's a helpful tip"
      />
    );

    expect(screen.getByText("Here's a helpful tip")).toBeInTheDocument();
  });

  it('renders action when provided', () => {
    const onClick = vi.fn();
    render(
      <TipBanner
        id="tip-1"
        tip="Tip with action"
        action={{ label: 'Do It', onClick }}
      />
    );

    const actionButton = screen.getByRole('button', { name: /do it/i });
    fireEvent.click(actionButton);

    expect(onClick).toHaveBeenCalled();
  });
});

describe('WarningBanner', () => {
  beforeEach(() => {
    vi.mocked(analytics.isBannerDismissed).mockReturnValue(false);
  });

  it('renders warning message', () => {
    render(
      <WarningBanner
        id="warning-1"
        message="This is a warning"
        details="Some additional details"
      />
    );

    expect(screen.getByText('This is a warning')).toBeInTheDocument();
    expect(screen.getByText('Some additional details')).toBeInTheDocument();
  });
});

describe('SuccessBanner', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(analytics.isBannerDismissed).mockReturnValue(false);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders success message', () => {
    render(
      <SuccessBanner
        id="success-1"
        message="Operation successful"
        details="Everything went well"
      />
    );

    expect(screen.getByText('Operation successful')).toBeInTheDocument();
    expect(screen.getByText('Everything went well')).toBeInTheDocument();
  });

  it('auto-dismisses after 5 seconds when autoDismiss is true', () => {
    const onDismiss = vi.fn();
    render(
      <SuccessBanner
        id="success-auto"
        message="Auto dismiss"
        autoDismiss
        onDismiss={onDismiss}
      />
    );

    expect(screen.getByText('Auto dismiss')).toBeInTheDocument();

    // Advance past the 5 second timer
    act(() => {
      vi.advanceTimersByTime(5001);
    });

    // onDismiss should be called
    expect(onDismiss).toHaveBeenCalled();
  });

  it('does not auto-dismiss when autoDismiss is false', () => {
    const onDismiss = vi.fn();
    render(
      <SuccessBanner
        id="success-no-auto"
        message="No auto dismiss"
        autoDismiss={false}
        onDismiss={onDismiss}
      />
    );

    act(() => {
      vi.advanceTimersByTime(10000);
    });

    expect(screen.getByText('No auto dismiss')).toBeInTheDocument();
    expect(onDismiss).not.toHaveBeenCalled();
  });
});

describe('TrialExpirationBanner', () => {
  beforeEach(() => {
    vi.mocked(analytics.isBannerDismissed).mockReturnValue(false);
  });

  it('shows reminder for 14 days remaining', () => {
    render(
      <TrialExpirationBanner
        daysRemaining={14}
        onUpgrade={vi.fn()}
      />
    );

    expect(screen.getByText('14 days left in your trial')).toBeInTheDocument();
  });

  it('shows urgent warning for 3 days or less', () => {
    render(
      <TrialExpirationBanner
        daysRemaining={2}
        onUpgrade={vi.fn()}
      />
    );

    expect(screen.getByText(/expires in 2 days/i)).toBeInTheDocument();
  });

  it('handles singular day correctly', () => {
    render(
      <TrialExpirationBanner
        daysRemaining={1}
        onUpgrade={vi.fn()}
      />
    );

    expect(screen.getByText(/expires in 1 day!/i)).toBeInTheDocument();
  });

  it('calls onUpgrade when upgrade button clicked', () => {
    const onUpgrade = vi.fn();
    render(
      <TrialExpirationBanner
        daysRemaining={7}
        onUpgrade={onUpgrade}
      />
    );

    const upgradeButton = screen.getByRole('button', { name: /upgrade now/i });
    fireEvent.click(upgradeButton);

    expect(onUpgrade).toHaveBeenCalled();
  });

  it('is not dismissible when urgent', () => {
    render(
      <TrialExpirationBanner
        daysRemaining={2}
        onUpgrade={vi.fn()}
      />
    );

    // Urgent banners should not have dismiss button
    expect(screen.queryByRole('button', { name: /dismiss/i })).not.toBeInTheDocument();
  });
});

describe('MfaRecommendationBanner', () => {
  beforeEach(() => {
    vi.mocked(analytics.isBannerDismissed).mockReturnValue(false);
  });

  it('renders MFA recommendation', () => {
    render(
      <MfaRecommendationBanner
        onEnable={vi.fn()}
      />
    );

    expect(screen.getByText('Secure your account with MFA')).toBeInTheDocument();
  });

  it('calls onEnable when enable button clicked', () => {
    const onEnable = vi.fn();
    render(
      <MfaRecommendationBanner
        onEnable={onEnable}
      />
    );

    const enableButton = screen.getByRole('button', { name: /enable mfa/i });
    fireEvent.click(enableButton);

    expect(onEnable).toHaveBeenCalled();
  });
});
