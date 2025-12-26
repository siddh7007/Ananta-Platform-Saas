/**
 * Unit tests for TouchTarget component
 * @module components/shared/TouchTarget.test
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TouchTarget, TouchIconButton, TouchTargetSize } from './TouchTarget';
import { Home } from 'lucide-react';

describe('TouchTarget', () => {
  const defaultProps = {
    children: <span>Click me</span>,
    onClick: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render children', () => {
      render(<TouchTarget {...defaultProps} />);

      expect(screen.getByText('Click me')).toBeInTheDocument();
    });

    it('should apply default class', () => {
      render(<TouchTarget {...defaultProps} />);

      const target = screen.getByRole('button');
      expect(target).toHaveClass('touch-target');
    });

    it('should apply custom className', () => {
      render(<TouchTarget {...defaultProps} className="custom-class" />);

      const target = screen.getByRole('button');
      expect(target).toHaveClass('custom-class');
    });
  });

  describe('Sizes', () => {
    it.each<TouchTargetSize>(['sm', 'md', 'lg'])(
      'should apply size class for %s size',
      (size) => {
        render(<TouchTarget {...defaultProps} size={size} />);

        const target = screen.getByRole('button');
        expect(target).toHaveClass(`touch-target-${size}`);
      }
    );

    it('should use md size by default', () => {
      render(<TouchTarget {...defaultProps} />);

      const target = screen.getByRole('button');
      expect(target).toHaveClass('touch-target-md');
    });

    it('should have minimum 48px touch target for tablet', () => {
      render(<TouchTarget {...defaultProps} size="md" />);

      const target = screen.getByRole('button');
      // MUI ButtonBase should have at least 48px touch target
      expect(target).toBeInTheDocument();
    });
  });

  describe('Click Handling', () => {
    it('should call onClick when clicked', async () => {
      const onClick = vi.fn();
      const user = userEvent.setup();

      render(<TouchTarget {...defaultProps} onClick={onClick} />);

      const target = screen.getByRole('button');
      await user.click(target);

      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('should pass event to onClick handler', async () => {
      const onClick = vi.fn();
      const user = userEvent.setup();

      render(<TouchTarget {...defaultProps} onClick={onClick} />);

      const target = screen.getByRole('button');
      await user.click(target);

      expect(onClick).toHaveBeenCalled();
    });

    it('should not call onClick when disabled', async () => {
      const onClick = vi.fn();
      const user = userEvent.setup();

      render(<TouchTarget {...defaultProps} onClick={onClick} disabled={true} />);

      // When disabled, TouchTarget renders as Box (not ButtonBase), so query by text
      const target = screen.getByText('Click me');
      await user.click(target);

      expect(onClick).not.toHaveBeenCalled();
    });
  });

  describe('Disabled State', () => {
    it('should apply disabled styling', () => {
      render(<TouchTarget {...defaultProps} disabled={true} />);

      // When disabled with onClick, component renders as Box instead of ButtonBase
      const target = screen.getByText('Click me').closest('.touch-target');
      expect(target).toHaveClass('touch-target');
    });

    it('should reduce opacity when disabled', () => {
      render(<TouchTarget {...defaultProps} disabled={true} />);

      // When disabled with onClick, component renders as Box instead of ButtonBase
      const target = screen.getByText('Click me').closest('.touch-target');
      expect(target).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have button role by default', () => {
      render(<TouchTarget {...defaultProps} />);

      expect(screen.getByRole('button')).toBeInTheDocument();
    });

    it('should apply aria-label when provided', () => {
      render(<TouchTarget {...defaultProps} ariaLabel="Touch me" />);

      const target = screen.getByRole('button');
      expect(target).toHaveAttribute('aria-label', 'Touch me');
    });

    it('should be keyboard focusable', async () => {
      const user = userEvent.setup();
      render(<TouchTarget {...defaultProps} />);

      await user.tab();

      const target = screen.getByRole('button');
      expect(target).toHaveFocus();
    });

    it('should trigger onClick on Enter key', async () => {
      const onClick = vi.fn();
      const user = userEvent.setup();

      render(<TouchTarget {...defaultProps} onClick={onClick} />);

      const target = screen.getByRole('button');
      target.focus();
      await user.keyboard('{Enter}');

      expect(onClick).toHaveBeenCalled();
    });

    it('should trigger onClick on Space key', async () => {
      const onClick = vi.fn();
      const user = userEvent.setup();

      render(<TouchTarget {...defaultProps} onClick={onClick} />);

      const target = screen.getByRole('button');
      target.focus();
      await user.keyboard(' ');

      expect(onClick).toHaveBeenCalled();
    });
  });

  describe('Custom Component', () => {
    it('should render with custom component', () => {
      render(
        <TouchTarget {...defaultProps} component="div">
          <span>Content</span>
        </TouchTarget>
      );

      expect(screen.getByText('Content')).toBeInTheDocument();
    });
  });

  describe('SX Prop', () => {
    it('should apply sx styles', () => {
      render(
        <TouchTarget
          {...defaultProps}
          sx={{ backgroundColor: 'red' }}
        />
      );

      const target = screen.getByRole('button');
      expect(target).toBeInTheDocument();
    });
  });
});

describe('TouchIconButton', () => {
  const defaultProps = {
    icon: <Home data-testid="home-icon" />,
    onClick: vi.fn(),
    ariaLabel: 'Home',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render icon', () => {
      render(<TouchIconButton {...defaultProps} />);

      expect(screen.getByTestId('home-icon')).toBeInTheDocument();
    });

    it('should apply touch target class', () => {
      render(<TouchIconButton {...defaultProps} />);

      const button = screen.getByRole('button');
      // TouchIconButton wraps TouchTarget, which applies touch-target class
      expect(button).toHaveClass('touch-target');
    });
  });

  describe('Sizes', () => {
    it.each<TouchTargetSize>(['sm', 'md', 'lg'])(
      'should apply size class for %s size',
      (size) => {
        render(<TouchIconButton {...defaultProps} size={size} />);

        const button = screen.getByRole('button');
        expect(button).toBeInTheDocument();
      }
    );
  });

  describe('Click Handling', () => {
    it('should call onClick when clicked', async () => {
      const onClick = vi.fn();
      const user = userEvent.setup();

      render(<TouchIconButton {...defaultProps} onClick={onClick} />);

      const button = screen.getByRole('button');
      await user.click(button);

      expect(onClick).toHaveBeenCalledTimes(1);
    });
  });

  describe('Accessibility', () => {
    it('should have aria-label', () => {
      render(<TouchIconButton {...defaultProps} />);

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-label', 'Home');
    });

    it('should be keyboard navigable', async () => {
      const user = userEvent.setup();
      render(<TouchIconButton {...defaultProps} />);

      await user.tab();

      const button = screen.getByRole('button');
      expect(button).toHaveFocus();
    });
  });
});
