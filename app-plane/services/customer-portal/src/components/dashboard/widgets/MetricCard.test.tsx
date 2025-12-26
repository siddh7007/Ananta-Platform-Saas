/**
 * Unit tests for MetricCard component
 * @module components/dashboard/widgets/MetricCard.test
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MetricCard, MetricCardProps } from './MetricCard';
import type { TrendData } from '../../../types/dashboard';

describe('MetricCard', () => {
  const defaultProps: MetricCardProps = {
    value: 47,
    label: 'Total BOMs',
  };

  describe('Rendering', () => {
    it('should render value and label', () => {
      render(<MetricCard {...defaultProps} />);

      expect(screen.getByText('47')).toBeInTheDocument();
      expect(screen.getByText('Total BOMs')).toBeInTheDocument();
    });

    it('should apply custom className', () => {
      render(<MetricCard {...defaultProps} className="custom-metric" />);

      const card = document.querySelector('.metric-card');
      expect(card).toHaveClass('custom-metric');
    });

    it('should render with fade-in animation class', () => {
      render(<MetricCard {...defaultProps} />);

      const card = document.querySelector('.metric-card');
      expect(card).toHaveClass('fade-in');
    });
  });

  describe('Value Formatting', () => {
    it('should use default formatter (toString)', () => {
      render(<MetricCard {...defaultProps} value={1234} />);

      expect(screen.getByText('1234')).toBeInTheDocument();
    });

    it('should apply custom formatValue function', () => {
      const formatCurrency = (v: number | string) => `$${Number(v).toLocaleString()}`;

      render(<MetricCard {...defaultProps} value={2340} formatValue={formatCurrency} />);

      expect(screen.getByText('$2,340')).toBeInTheDocument();
    });

    it('should format percentage values', () => {
      const formatPercent = (v: number | string) => `${v}%`;

      render(<MetricCard {...defaultProps} value={92} formatValue={formatPercent} />);

      expect(screen.getByText('92%')).toBeInTheDocument();
    });

    it('should handle string values', () => {
      render(<MetricCard {...defaultProps} value="High" />);

      expect(screen.getByText('High')).toBeInTheDocument();
    });
  });

  describe('Trend Indicator', () => {
    it('should display upward trend', () => {
      const trend: TrendData = {
        value: 3,
        direction: 'up',
        period: 'this week',
      };

      render(<MetricCard {...defaultProps} trend={trend} />);

      expect(screen.getByText('+3 this week')).toBeInTheDocument();
      // Icon should be present (TrendingUp)
      expect(document.querySelector('.metric-trend-icon.up')).toBeInTheDocument();
    });

    it('should display downward trend without plus sign', () => {
      const trend: TrendData = {
        value: 2,
        direction: 'down',
        period: 'this week',
      };

      render(<MetricCard {...defaultProps} trend={trend} />);

      expect(screen.getByText('2 this week')).toBeInTheDocument();
      expect(document.querySelector('.metric-trend-icon.down')).toBeInTheDocument();
    });

    it('should display flat trend', () => {
      const trend: TrendData = {
        value: 0,
        direction: 'flat',
        period: 'this week',
      };

      render(<MetricCard {...defaultProps} trend={trend} />);

      expect(screen.getByText('0 this week')).toBeInTheDocument();
      expect(document.querySelector('.metric-trend-icon.flat')).toBeInTheDocument();
    });

    it('should not render trend when not provided', () => {
      render(<MetricCard {...defaultProps} />);

      expect(document.querySelector('.metric-trend')).not.toBeInTheDocument();
    });
  });

  describe('Comparison Text', () => {
    it('should display comparison text', () => {
      render(<MetricCard {...defaultProps} comparison="across all projects" />);

      expect(screen.getByText('across all projects')).toBeInTheDocument();
    });

    it('should not render comparison when not provided', () => {
      render(<MetricCard {...defaultProps} />);

      expect(document.querySelector('.metric-comparison')).not.toBeInTheDocument();
    });

    it('should have aria-label for comparison', () => {
      render(<MetricCard {...defaultProps} comparison="vs $2,100 budget" />);

      const comparison = document.querySelector('.metric-comparison');
      expect(comparison).toHaveAttribute('aria-label', 'Compared to vs $2,100 budget');
    });
  });

  describe('Accessibility', () => {
    it('should have article role', () => {
      render(<MetricCard {...defaultProps} />);

      expect(screen.getByRole('article')).toBeInTheDocument();
    });

    it('should have default aria-label combining label and value', () => {
      render(<MetricCard {...defaultProps} />);

      const card = screen.getByRole('article');
      expect(card).toHaveAttribute('aria-label', 'Total BOMs: 47');
    });

    it('should use custom ariaLabel when provided', () => {
      render(<MetricCard {...defaultProps} ariaLabel="Custom metric description" />);

      const card = screen.getByRole('article');
      expect(card).toHaveAttribute('aria-label', 'Custom metric description');
    });

    it('should have aria-live on metric value', () => {
      render(<MetricCard {...defaultProps} />);

      const valueElement = document.querySelector('.metric-value');
      expect(valueElement).toHaveAttribute('aria-live', 'polite');
    });

    it('should have aria-live on trend indicator', () => {
      const trend: TrendData = {
        value: 3,
        direction: 'up',
        period: 'this week',
      };

      render(<MetricCard {...defaultProps} trend={trend} />);

      const trendElement = document.querySelector('.metric-trend');
      expect(trendElement).toHaveAttribute('aria-live', 'polite');
    });

    it('should have aria-hidden on trend icons', () => {
      const trend: TrendData = {
        value: 3,
        direction: 'up',
        period: 'this week',
      };

      render(<MetricCard {...defaultProps} trend={trend} />);

      const icon = document.querySelector('.metric-trend-icon svg');
      // Lucide icons have aria-hidden on their container
      expect(document.querySelector('.metric-trend-icon')).toBeInTheDocument();
    });
  });

  describe('Display Name', () => {
    it('should have displayName set', () => {
      expect(MetricCard.displayName).toBe('MetricCard');
    });
  });
});
