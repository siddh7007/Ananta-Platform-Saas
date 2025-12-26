/**
 * TouchTarget Component Tests
 *
 * P1-5: Tests for touch-friendly button component.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TouchTarget, TouchTargetWrapper } from './TouchTarget';

describe('TouchTarget', () => {
  const mockOnClick = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders children content', () => {
      render(<TouchTarget>Click me</TouchTarget>);
      expect(screen.getByText('Click me')).toBeInTheDocument();
    });

    it('renders with default minimum size of 48px', () => {
      render(<TouchTarget data-testid="touch-target">Content</TouchTarget>);
      const element = screen.getByTestId('touch-target');
      expect(element).toHaveStyle({ minWidth: '48px', minHeight: '48px' });
    });

    it('renders with custom minimum size', () => {
      render(
        <TouchTarget minSize={64} data-testid="touch-target">
          Content
        </TouchTarget>
      );
      const element = screen.getByTestId('touch-target');
      expect(element).toHaveStyle({ minWidth: '64px', minHeight: '64px' });
    });

    it('applies aria-label for accessibility', () => {
      render(<TouchTarget aria-label="Upload file">Upload</TouchTarget>);
      expect(screen.getByRole('button', { name: 'Upload file' })).toBeInTheDocument();
    });
  });

  describe('Variants', () => {
    it('renders default variant', () => {
      render(
        <TouchTarget variant="default" data-testid="touch-target">
          Default
        </TouchTarget>
      );
      expect(screen.getByTestId('touch-target')).toBeInTheDocument();
    });

    it('renders filled variant', () => {
      render(
        <TouchTarget variant="filled" data-testid="touch-target">
          Filled
        </TouchTarget>
      );
      expect(screen.getByTestId('touch-target')).toBeInTheDocument();
    });

    it('renders outlined variant', () => {
      render(
        <TouchTarget variant="outlined" data-testid="touch-target">
          Outlined
        </TouchTarget>
      );
      expect(screen.getByTestId('touch-target')).toBeInTheDocument();
    });
  });

  describe('Colors', () => {
    const colors: Array<'primary' | 'secondary' | 'success' | 'error' | 'warning' | 'info'> = [
      'primary',
      'secondary',
      'success',
      'error',
      'warning',
      'info',
    ];

    colors.forEach((color) => {
      it(`renders with ${color} color`, () => {
        render(
          <TouchTarget color={color} data-testid="touch-target">
            {color}
          </TouchTarget>
        );
        expect(screen.getByTestId('touch-target')).toBeInTheDocument();
      });
    });
  });

  describe('Interactions', () => {
    it('calls onClick when clicked', async () => {
      const user = userEvent.setup();
      render(<TouchTarget onClick={mockOnClick}>Click</TouchTarget>);

      await user.click(screen.getByRole('button'));
      expect(mockOnClick).toHaveBeenCalledTimes(1);
    });

    it('does not call onClick when disabled', () => {
      render(
        <TouchTarget onClick={mockOnClick} disabled>
          Disabled
        </TouchTarget>
      );

      // Use fireEvent for disabled elements (userEvent respects pointer-events: none)
      fireEvent.click(screen.getByRole('button'));
      expect(mockOnClick).not.toHaveBeenCalled();
    });

    it('has reduced opacity when disabled', () => {
      render(
        <TouchTarget disabled data-testid="touch-target">
          Disabled
        </TouchTarget>
      );
      expect(screen.getByTestId('touch-target')).toHaveStyle({ opacity: '0.5' });
    });
  });

  describe('Full Width', () => {
    it('expands to full width when fullWidth is true', () => {
      render(
        <TouchTarget fullWidth data-testid="touch-target">
          Full Width
        </TouchTarget>
      );
      expect(screen.getByTestId('touch-target')).toHaveStyle({ width: '100%' });
    });
  });

  describe('Accessibility', () => {
    it('is focusable via keyboard', async () => {
      const user = userEvent.setup();
      render(<TouchTarget onClick={mockOnClick}>Focusable</TouchTarget>);

      await user.tab();
      expect(screen.getByRole('button')).toHaveFocus();
    });

    it('can be activated with Enter key', async () => {
      const user = userEvent.setup();
      render(<TouchTarget onClick={mockOnClick}>Enter Key</TouchTarget>);

      const button = screen.getByRole('button');
      button.focus();
      await user.keyboard('{Enter}');

      expect(mockOnClick).toHaveBeenCalledTimes(1);
    });

    it('can be activated with Space key', async () => {
      const user = userEvent.setup();
      render(<TouchTarget onClick={mockOnClick}>Space Key</TouchTarget>);

      const button = screen.getByRole('button');
      button.focus();
      await user.keyboard(' ');

      expect(mockOnClick).toHaveBeenCalledTimes(1);
    });
  });
});

describe('TouchTargetWrapper', () => {
  const mockOnClick = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders children', () => {
    render(
      <TouchTargetWrapper>
        <span>Wrapped content</span>
      </TouchTargetWrapper>
    );
    expect(screen.getByText('Wrapped content')).toBeInTheDocument();
  });

  it('applies minimum size to wrapper', () => {
    render(
      <TouchTargetWrapper minSize={56} data-testid="wrapper">
        <span>Content</span>
      </TouchTargetWrapper>
    );
    expect(screen.getByTestId('wrapper')).toHaveStyle({
      minWidth: '56px',
      minHeight: '56px',
    });
  });

  it('is interactive when onClick is provided', async () => {
    const user = userEvent.setup();
    render(
      <TouchTargetWrapper onClick={mockOnClick} aria-label="Interactive wrapper">
        <span>Click me</span>
      </TouchTargetWrapper>
    );

    await user.click(screen.getByText('Click me'));
    expect(mockOnClick).toHaveBeenCalledTimes(1);
  });

  it('is not interactive when onClick is not provided', () => {
    render(
      <TouchTargetWrapper data-testid="wrapper">
        <span>Not clickable</span>
      </TouchTargetWrapper>
    );

    // Should be a Box, not a ButtonBase
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
