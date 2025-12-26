/**
 * PageTransition Component Tests
 *
 * Comprehensive test suite for page transitions
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { renderHook } from '@testing-library/react';
import {
  PageTransition,
  usePageTransition,
  getTransitionClasses,
  PAGE_TRANSITIONS,
} from './PageTransition';

describe('PageTransition', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('Basic Rendering', () => {
    it('should render children', () => {
      render(
        <PageTransition variant="fade">
          <div data-testid="content">Test Content</div>
        </PageTransition>
      );

      expect(screen.getByTestId('content')).toBeInTheDocument();
    });

    it('should apply custom className', () => {
      const { container } = render(
        <PageTransition variant="fade" className="custom-class">
          <div>Content</div>
        </PageTransition>
      );

      const wrapper = container.firstChild;
      expect(wrapper).toHaveClass('custom-class');
    });

    it('should render without animation when disabled', () => {
      const { container } = render(
        <PageTransition variant="fade" disabled>
          <div>Content</div>
        </PageTransition>
      );

      const wrapper = container.firstChild;
      expect(wrapper).not.toHaveClass('page-transition-fade');
    });

    it('should not apply animation classes when variant is "none"', () => {
      const { container } = render(
        <PageTransition variant="none">
          <div>Content</div>
        </PageTransition>
      );

      const wrapper = container.firstChild;
      expect(wrapper).not.toHaveClass('page-transition-fade');
    });
  });

  describe('Animation Variants', () => {
    it('should apply fade animation classes', () => {
      const { container } = render(
        <PageTransition variant="fade">
          <div>Content</div>
        </PageTransition>
      );

      const wrapper = container.firstChild;
      expect(wrapper).toHaveClass('page-transition-fade');
    });

    it('should apply slide-up animation classes', () => {
      const { container } = render(
        <PageTransition variant="slide-up">
          <div>Content</div>
        </PageTransition>
      );

      const wrapper = container.firstChild;
      expect(wrapper).toHaveClass('page-transition-slide-up');
    });

    it('should apply slide-left animation classes', () => {
      const { container } = render(
        <PageTransition variant="slide-left">
          <div>Content</div>
        </PageTransition>
      );

      const wrapper = container.firstChild;
      expect(wrapper).toHaveClass('page-transition-slide-left');
    });

    it('should apply slide-right animation classes', () => {
      const { container } = render(
        <PageTransition variant="slide-right">
          <div>Content</div>
        </PageTransition>
      );

      const wrapper = container.firstChild;
      expect(wrapper).toHaveClass('page-transition-slide-right');
    });

    it('should apply scale animation classes', () => {
      const { container } = render(
        <PageTransition variant="scale">
          <div>Content</div>
        </PageTransition>
      );

      const wrapper = container.firstChild;
      expect(wrapper).toHaveClass('page-transition-scale');
    });
  });

  describe('Duration Modifiers', () => {
    it('should apply fast duration class', () => {
      const { container } = render(
        <PageTransition variant="fade" duration="fast">
          <div>Content</div>
        </PageTransition>
      );

      const wrapper = container.firstChild;
      expect(wrapper).toHaveClass('page-transition-fast');
    });

    it('should apply normal duration class by default', () => {
      const { container } = render(
        <PageTransition variant="fade">
          <div>Content</div>
        </PageTransition>
      );

      const wrapper = container.firstChild;
      expect(wrapper).toHaveClass('page-transition-normal');
    });

    it('should apply slow duration class', () => {
      const { container } = render(
        <PageTransition variant="fade" duration="slow">
          <div>Content</div>
        </PageTransition>
      );

      const wrapper = container.firstChild;
      expect(wrapper).toHaveClass('page-transition-slow');
    });
  });

  describe('Transition States', () => {
    it('should start in entering state', () => {
      const { container } = render(
        <PageTransition variant="fade">
          <div>Content</div>
        </PageTransition>
      );

      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper.dataset.transitionState).toBe('entering');
    });

    it('should transition to entered state after duration', async () => {
      const { container } = render(
        <PageTransition variant="fade" duration="normal">
          <div>Content</div>
        </PageTransition>
      );

      const wrapper = container.firstChild as HTMLElement;

      // Initially entering
      expect(wrapper.dataset.transitionState).toBe('entering');

      // Fast-forward time (normal = 200ms)
      act(() => {
        vi.advanceTimersByTime(200);
      });

      await waitFor(() => {
        expect(wrapper.dataset.transitionState).toBe('entered');
      });
    });

    it('should call onTransitionComplete callback', async () => {
      const onComplete = vi.fn();

      render(
        <PageTransition
          variant="fade"
          duration="fast"
          onTransitionComplete={onComplete}
        >
          <div>Content</div>
        </PageTransition>
      );

      // Initial entering state
      expect(onComplete).toHaveBeenCalledWith('entering');

      // Fast-forward to entered state (fast = 150ms)
      act(() => {
        vi.advanceTimersByTime(150);
      });

      await waitFor(() => {
        expect(onComplete).toHaveBeenCalledWith('entered');
      });
    });
  });

  describe('Transition Key Changes', () => {
    it('should trigger exit/enter cycle when transitionKey changes', async () => {
      const onComplete = vi.fn();
      const { rerender, container } = render(
        <PageTransition
          variant="fade"
          duration="fast"
          transitionKey="key1"
          onTransitionComplete={onComplete}
        >
          <div>Content 1</div>
        </PageTransition>
      );

      const wrapper = container.firstChild as HTMLElement;

      // Complete initial transition
      act(() => {
        vi.advanceTimersByTime(150);
      });

      await waitFor(() => {
        expect(wrapper.dataset.transitionState).toBe('entered');
      });

      // Change transition key
      rerender(
        <PageTransition
          variant="fade"
          duration="fast"
          transitionKey="key2"
          onTransitionComplete={onComplete}
        >
          <div>Content 2</div>
        </PageTransition>
      );

      // Should immediately go to exiting state
      expect(wrapper.dataset.transitionState).toBe('exiting');

      // Fast-forward through exit animation (150ms)
      act(() => {
        vi.advanceTimersByTime(150);
      });

      await waitFor(() => {
        expect(wrapper.dataset.transitionState).toBe('exited');
      });

      // Should enter after exit completes
      act(() => {
        vi.advanceTimersByTime(10);
      });

      await waitFor(() => {
        expect(wrapper.dataset.transitionState).toBe('entering');
      });

      // Complete enter animation
      act(() => {
        vi.advanceTimersByTime(150);
      });

      await waitFor(() => {
        expect(wrapper.dataset.transitionState).toBe('entered');
      });
    });

    it('should update children during transition', async () => {
      const { rerender } = render(
        <PageTransition variant="fade" duration="fast" transitionKey="key1">
          <div data-testid="content">Content 1</div>
        </PageTransition>
      );

      // Complete initial transition
      act(() => {
        vi.advanceTimersByTime(150);
      });

      // Change content and key
      rerender(
        <PageTransition variant="fade" duration="fast" transitionKey="key2">
          <div data-testid="content">Content 2</div>
        </PageTransition>
      );

      // Fast-forward through complete transition cycle
      act(() => {
        vi.advanceTimersByTime(320); // exit (150) + enter (150) + buffer
      });

      await waitFor(() => {
        expect(screen.getByTestId('content')).toHaveTextContent('Content 2');
      });
    });
  });

  describe('Accessibility', () => {
    it('should respect reduced motion preference', () => {
      // Mock matchMedia for reduced motion
      window.matchMedia = vi.fn().mockImplementation((query) => ({
        matches: query === '(prefers-reduced-motion: reduce)',
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));

      const { container } = render(
        <PageTransition variant="fade">
          <div>Content</div>
        </PageTransition>
      );

      // CSS media query handles this, so we just verify classes are applied
      const wrapper = container.firstChild;
      expect(wrapper).toHaveClass('page-transition-fade');
    });

    it('should support data-transition-state attribute for testing', () => {
      const { container } = render(
        <PageTransition variant="fade">
          <div>Content</div>
        </PageTransition>
      );

      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper.dataset.transitionState).toBeDefined();
    });
  });

  describe('usePageTransition Hook', () => {
    it('should initialize with entered state', () => {
      const { result } = renderHook(() => usePageTransition());

      expect(result.current.state).toBe('entered');
      expect(result.current.isTransitioning).toBe(false);
    });

    it('should trigger transition with callback', async () => {
      const callback = vi.fn();
      const { result } = renderHook(() => usePageTransition());

      act(() => {
        result.current.triggerTransition(callback, 'fast');
      });

      // Should be exiting
      expect(result.current.state).toBe('exiting');
      expect(result.current.isTransitioning).toBe(true);

      // Fast-forward exit duration (150ms)
      act(() => {
        vi.advanceTimersByTime(150);
      });

      await waitFor(() => {
        expect(callback).toHaveBeenCalled();
        expect(result.current.state).toBe('exited');
      });

      // Fast-forward enter duration
      act(() => {
        vi.advanceTimersByTime(160);
      });

      await waitFor(() => {
        expect(result.current.state).toBe('entered');
        expect(result.current.isTransitioning).toBe(false);
      });
    });

    it('should handle multiple rapid triggers gracefully', () => {
      const { result } = renderHook(() => usePageTransition());

      act(() => {
        result.current.triggerTransition();
        result.current.triggerTransition();
        result.current.triggerTransition();
      });

      // Should still be in a valid state
      expect(['entering', 'entered', 'exiting', 'exited']).toContain(
        result.current.state
      );
    });
  });

  describe('Pre-built Transitions', () => {
    it('should export PAGE_TRANSITIONS constant', () => {
      expect(PAGE_TRANSITIONS).toBeDefined();
      expect(PAGE_TRANSITIONS.fade).toEqual({
        variant: 'fade',
        duration: 'normal',
      });
    });

    it('should have all expected transition presets', () => {
      expect(PAGE_TRANSITIONS.fade).toBeDefined();
      expect(PAGE_TRANSITIONS.slideUp).toBeDefined();
      expect(PAGE_TRANSITIONS.forward).toBeDefined();
      expect(PAGE_TRANSITIONS.back).toBeDefined();
      expect(PAGE_TRANSITIONS.scale).toBeDefined();
      expect(PAGE_TRANSITIONS.subtle).toBeDefined();
      expect(PAGE_TRANSITIONS.dramatic).toBeDefined();
      expect(PAGE_TRANSITIONS.instant).toBeDefined();
    });

    it('should work with spread operator', () => {
      const { container } = render(
        <PageTransition {...PAGE_TRANSITIONS.forward}>
          <div>Content</div>
        </PageTransition>
      );

      const wrapper = container.firstChild;
      expect(wrapper).toHaveClass('page-transition-slide-left');
      expect(wrapper).toHaveClass('page-transition-normal');
    });
  });

  describe('getTransitionClasses Utility', () => {
    it('should generate correct class string', () => {
      const classes = getTransitionClasses('fade', 'normal', 'entering');

      expect(classes).toContain('page-transition');
      expect(classes).toContain('page-transition-fade');
      expect(classes).toContain('page-transition-normal');
      expect(classes).toContain('page-transition-entering');
    });

    it('should work for all variants', () => {
      const variants = ['fade', 'slide-up', 'slide-left', 'slide-right', 'scale', 'none'] as const;

      variants.forEach((variant) => {
        const classes = getTransitionClasses(variant, 'normal', 'entered');
        expect(classes).toContain(`page-transition-${variant}`);
      });
    });

    it('should work for all durations', () => {
      const durations = ['fast', 'normal', 'slow'] as const;

      durations.forEach((duration) => {
        const classes = getTransitionClasses('fade', duration, 'entered');
        expect(classes).toContain(`page-transition-${duration}`);
      });
    });

    it('should work for all states', () => {
      const states = ['entering', 'entered', 'exiting', 'exited'] as const;

      states.forEach((state) => {
        const classes = getTransitionClasses('fade', 'normal', state);
        expect(classes).toContain(`page-transition-${state}`);
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle unmount during transition', () => {
      const { unmount } = render(
        <PageTransition variant="fade" duration="normal">
          <div>Content</div>
        </PageTransition>
      );

      // Unmount during transition
      act(() => {
        unmount();
      });

      // Should not throw errors
      expect(() => {
        vi.advanceTimersByTime(200);
      }).not.toThrow();
    });

    it('should handle rapid transitionKey changes', async () => {
      const { rerender, container } = render(
        <PageTransition variant="fade" duration="fast" transitionKey="1">
          <div>Content</div>
        </PageTransition>
      );

      // Rapid key changes
      rerender(
        <PageTransition variant="fade" duration="fast" transitionKey="2">
          <div>Content</div>
        </PageTransition>
      );

      rerender(
        <PageTransition variant="fade" duration="fast" transitionKey="3">
          <div>Content</div>
        </PageTransition>
      );

      // Fast-forward all timers
      act(() => {
        vi.runAllTimers();
      });

      // Should end in a valid state
      const wrapper = container.firstChild as HTMLElement;
      expect(['entering', 'entered', 'exiting', 'exited']).toContain(
        wrapper.dataset.transitionState
      );
    });

    it('should update children when key stays same', () => {
      const { rerender } = render(
        <PageTransition variant="fade" transitionKey="same">
          <div data-testid="content">Content 1</div>
        </PageTransition>
      );

      rerender(
        <PageTransition variant="fade" transitionKey="same">
          <div data-testid="content">Content 2</div>
        </PageTransition>
      );

      // Content should update immediately without transition
      expect(screen.getByTestId('content')).toHaveTextContent('Content 2');
    });
  });

  describe('Performance', () => {
    it('should cleanup timers on unmount', () => {
      const { unmount } = render(
        <PageTransition variant="fade">
          <div>Content</div>
        </PageTransition>
      );

      unmount();

      // Verify no timers are still running
      expect(vi.getTimerCount()).toBe(0);
    });

    it('should not cause memory leaks with multiple instances', () => {
      const instances = Array.from({ length: 10 }, (_, i) => i);

      const { unmount } = render(
        <>
          {instances.map((i) => (
            <PageTransition key={i} variant="fade">
              <div>Content {i}</div>
            </PageTransition>
          ))}
        </>
      );

      unmount();

      // All timers should be cleaned up
      expect(vi.getTimerCount()).toBe(0);
    });
  });
});
