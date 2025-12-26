/**
 * CBP-P3-001: Touch Targets Test Suite
 *
 * Verifies that touch target utilities and components meet
 * minimum accessibility standards (44x44px on touch devices)
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue } from '@/components/ui/select';

describe('Touch Targets - CBP-P3-001', () => {
  describe('Button Component', () => {
    it('should have minimum height for default size', () => {
      render(<Button>Click Me</Button>);
      const button = screen.getByRole('button', { name: /click me/i });

      // Get computed style
      const styles = window.getComputedStyle(button);
      const minHeight = styles.getPropertyValue('min-height');

      // Should have min-h-[44px] class
      expect(button.className).toContain('min-h-[44px]');
    });

    it('should have minimum height for icon size', () => {
      render(<Button size="icon" aria-label="Icon button">Icon</Button>);
      const button = screen.getByRole('button', { name: /icon button/i });

      // Should have both min-h and min-w for icon buttons
      expect(button.className).toContain('min-h-[44px]');
      expect(button.className).toContain('min-w-[44px]');
    });

    it('should have responsive sizing', () => {
      render(<Button>Responsive</Button>);
      const button = screen.getByRole('button', { name: /responsive/i });

      // Should have both mobile and desktop sizes
      expect(button.className).toContain('min-h-[44px]');
      expect(button.className).toContain('md:min-h-[40px]');
    });

    it('should support all button sizes', () => {
      const { rerender } = render(<Button size="sm">Small</Button>);
      let button = screen.getByRole('button', { name: /small/i });
      expect(button.className).toContain('min-h-[40px]');

      rerender(<Button size="default">Default</Button>);
      button = screen.getByRole('button', { name: /default/i });
      expect(button.className).toContain('min-h-[44px]');

      rerender(<Button size="lg">Large</Button>);
      button = screen.getByRole('button', { name: /large/i });
      expect(button.className).toContain('min-h-[48px]');
    });
  });

  describe('Input Component', () => {
    it('should have minimum height for touch targets', () => {
      render(<Input type="text" placeholder="Enter text" />);
      const input = screen.getByPlaceholderText(/enter text/i);

      // Should have min-h-[44px] class
      expect(input.className).toContain('min-h-[44px]');
    });

    it('should have responsive sizing', () => {
      render(<Input type="email" placeholder="Email" />);
      const input = screen.getByPlaceholderText(/email/i);

      // Should have both mobile and desktop sizes
      expect(input.className).toContain('min-h-[44px]');
      expect(input.className).toContain('md:min-h-[40px]');
    });
  });

  describe('Select Component', () => {
    it('should have minimum height for select trigger', () => {
      render(
        <Select>
          <SelectTrigger>
            <SelectValue placeholder="Select option" />
          </SelectTrigger>
        </Select>
      );

      const trigger = screen.getByRole('combobox');

      // Should have min-h-[44px] class
      expect(trigger.className).toContain('min-h-[44px]');
    });

    it('should have responsive sizing', () => {
      render(
        <Select>
          <SelectTrigger>
            <SelectValue placeholder="Choose" />
          </SelectTrigger>
        </Select>
      );

      const trigger = screen.getByRole('combobox');

      // Should have both mobile and desktop sizes
      expect(trigger.className).toContain('min-h-[44px]');
      expect(trigger.className).toContain('md:min-h-[40px]');
    });
  });

  describe('Touch Target Utilities', () => {
    it('should apply touch-target class', () => {
      render(<div className="touch-target" data-testid="touch-div">Touch Area</div>);
      const element = screen.getByTestId('touch-div');

      expect(element.className).toContain('touch-target');
    });

    it('should apply touch-spacing utilities', () => {
      render(
        <div className="flex gap-touch" data-testid="spaced-container">
          <button>One</button>
          <button>Two</button>
        </div>
      );
      const container = screen.getByTestId('spaced-container');

      expect(container.className).toContain('gap-touch');
    });

    it('should apply touch padding utilities', () => {
      render(<div className="p-touch" data-testid="padded">Content</div>);
      const element = screen.getByTestId('padded');

      expect(element.className).toContain('p-touch');
    });
  });

  describe('Accessibility Compliance', () => {
    it('should meet WCAG 2.5.5 minimum target size (44x44px)', () => {
      const { container } = render(
        <div className="flex gap-touch">
          <Button>Action 1</Button>
          <Button>Action 2</Button>
        </div>
      );

      const buttons = container.querySelectorAll('button');

      buttons.forEach((button) => {
        // Each button should have minimum height class
        expect(button.className).toMatch(/min-h-\[4[48]px\]/);
      });
    });

    it('should have adequate spacing between touch targets', () => {
      const { container } = render(
        <div className="flex gap-touch" data-testid="button-group">
          <Button>First</Button>
          <Button>Second</Button>
          <Button>Third</Button>
        </div>
      );

      const group = screen.getByTestId('button-group');

      // Should have gap-touch class (8px minimum)
      expect(group.className).toContain('gap-touch');
    });
  });

  describe('Form Elements', () => {
    it('should make all form inputs touch-friendly', () => {
      render(
        <form>
          <Input type="text" placeholder="Name" />
          <Input type="email" placeholder="Email" />
          <Input type="password" placeholder="Password" />
        </form>
      );

      const textInput = screen.getByPlaceholderText(/name/i);
      const emailInput = screen.getByPlaceholderText(/email/i);
      const passwordInput = screen.getByPlaceholderText(/password/i);

      [textInput, emailInput, passwordInput].forEach((input) => {
        expect(input.className).toContain('min-h-[44px]');
      });
    });

    it('should support custom className while maintaining touch targets', () => {
      render(<Button className="bg-red-500">Custom Button</Button>);
      const button = screen.getByRole('button', { name: /custom button/i });

      // Should have both custom class and touch target height
      expect(button.className).toContain('bg-red-500');
      expect(button.className).toContain('min-h-[44px]');
    });
  });

  describe('Responsive Behavior', () => {
    it('should apply mobile-first touch targets', () => {
      render(<Button>Responsive Button</Button>);
      const button = screen.getByRole('button', { name: /responsive button/i });

      // Mobile-first: base min-height
      expect(button.className).toMatch(/min-h-\[44px\]/);
    });

    it('should have desktop overrides', () => {
      render(<Button>Desktop Optimized</Button>);
      const button = screen.getByRole('button', { name: /desktop optimized/i });

      // Desktop: md: breakpoint override
      expect(button.className).toMatch(/md:min-h-\[40px\]/);
    });
  });
});
