import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EmptyState } from '../../components/shared/EmptyState';

describe('EmptyState', () => {
  it('should render title and message', () => {
    render(
      <EmptyState
        title="No Data"
        message="There are no items to display"
      />
    );

    expect(screen.getByText('No Data')).toBeInTheDocument();
    expect(screen.getByText('There are no items to display')).toBeInTheDocument();
  });

  it('should render icon when provided', () => {
    const TestIcon = () => <div data-testid="test-icon">Icon</div>;

    render(
      <EmptyState
        title="Empty"
        message="No items"
        icon={<TestIcon />}
      />
    );

    expect(screen.getByTestId('test-icon')).toBeInTheDocument();
  });

  it('should render action button when provided', () => {
    const handleAction = vi.fn();

    render(
      <EmptyState
        title="Empty"
        message="No items"
        actionLabel="Add Item"
        onAction={handleAction}
      />
    );

    const button = screen.getByRole('button', { name: /add item/i });
    expect(button).toBeInTheDocument();
  });

  it('should call onAction when button is clicked', () => {
    const handleAction = vi.fn();

    render(
      <EmptyState
        title="Empty"
        message="No items"
        actionLabel="Add Item"
        onAction={handleAction}
      />
    );

    const button = screen.getByRole('button', { name: /add item/i });
    fireEvent.click(button);

    expect(handleAction).toHaveBeenCalledTimes(1);
  });

  it('should not render button when onAction is not provided', () => {
    render(
      <EmptyState
        title="Empty"
        message="No items"
        actionLabel="Add Item"
      />
    );

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('should not render button when actionLabel is not provided', () => {
    const handleAction = vi.fn();

    render(
      <EmptyState
        title="Empty"
        message="No items"
        onAction={handleAction}
      />
    );

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('should render with default styling', () => {
    render(
      <EmptyState
        title="Empty"
        message="No items"
      />
    );

    const container = screen.getByText('Empty').parentElement;
    expect(container).toBeInTheDocument();
  });
});
