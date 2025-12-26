/**
 * Accessibility Components Tests
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SkipLinks } from './SkipLinks';
import { FocusTrap } from './FocusTrap';
import { VisuallyHidden } from './VisuallyHidden';

describe('SkipLinks', () => {
  it('should render skip links', () => {
    render(<SkipLinks />);
    expect(screen.getByText('Skip to main content')).toBeInTheDocument();
    expect(screen.getByText('Skip to navigation')).toBeInTheDocument();
  });

  it('should render custom links', () => {
    const customLinks = [
      { id: 'custom-section', label: 'Skip to custom section' },
    ];
    render(<SkipLinks links={customLinks} />);
    expect(screen.getByText('Skip to custom section')).toBeInTheDocument();
  });

  it('should have correct href attributes', () => {
    render(<SkipLinks />);
    const mainContentLink = screen.getByText('Skip to main content');
    expect(mainContentLink).toHaveAttribute('href', '#main-content');
  });

  it('should have navigation role', () => {
    render(<SkipLinks />);
    expect(screen.getByRole('navigation', { name: /skip links/i })).toBeInTheDocument();
  });
});

describe('FocusTrap', () => {
  it('should render children', () => {
    render(
      <FocusTrap>
        <button>Button 1</button>
        <button>Button 2</button>
      </FocusTrap>
    );
    expect(screen.getByText('Button 1')).toBeInTheDocument();
    expect(screen.getByText('Button 2')).toBeInTheDocument();
  });

  it('should focus first element when active', async () => {
    render(
      <FocusTrap active={true}>
        <button>First Button</button>
        <button>Second Button</button>
      </FocusTrap>
    );

    // Wait for focus to be set
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(document.activeElement).toBe(screen.getByText('First Button'));
  });

  it('should call onEscape when Escape is pressed', async () => {
    const onEscape = vi.fn();
    render(
      <FocusTrap active={true} onEscape={onEscape}>
        <button>Button</button>
      </FocusTrap>
    );

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onEscape).toHaveBeenCalled();
  });

  it('should trap focus on Tab', async () => {
    const user = userEvent.setup();
    render(
      <FocusTrap active={true}>
        <button>First</button>
        <button>Last</button>
      </FocusTrap>
    );

    // Wait for initial focus
    await new Promise(resolve => setTimeout(resolve, 50));

    // Tab from first to last
    await user.tab();
    expect(document.activeElement).toBe(screen.getByText('Last'));

    // Tab from last should wrap to first
    await user.tab();
    expect(document.activeElement).toBe(screen.getByText('First'));
  });

  it('should not trap focus when inactive', async () => {
    render(
      <FocusTrap active={false}>
        <button>Button</button>
      </FocusTrap>
    );

    // Focus should not be automatically set
    expect(document.activeElement).not.toBe(screen.getByText('Button'));
  });

  it('should have region role when active', () => {
    render(
      <FocusTrap active={true}>
        <button>Button</button>
      </FocusTrap>
    );
    expect(screen.getByRole('region')).toBeInTheDocument();
  });
});

describe('VisuallyHidden', () => {
  it('should render children', () => {
    render(<VisuallyHidden>Hidden text</VisuallyHidden>);
    expect(screen.getByText('Hidden text')).toBeInTheDocument();
  });

  it('should be visually hidden but accessible', () => {
    render(<VisuallyHidden>Screen reader text</VisuallyHidden>);
    const element = screen.getByText('Screen reader text');

    // Element should exist in DOM
    expect(element).toBeInTheDocument();

    // Check for visually hidden styles
    const styles = window.getComputedStyle(element);
    expect(styles.position).toBe('absolute');
    expect(styles.width).toBe('1px');
    expect(styles.height).toBe('1px');
    expect(styles.overflow).toBe('hidden');
  });

  it('should accept custom element type', () => {
    render(<VisuallyHidden as="h1">Hidden heading</VisuallyHidden>);
    expect(screen.getByRole('heading', { name: 'Hidden heading' })).toBeInTheDocument();
  });

  it('should pass through additional props', () => {
    render(<VisuallyHidden id="test-id">Content</VisuallyHidden>);
    expect(screen.getByText('Content')).toHaveAttribute('id', 'test-id');
  });
});
