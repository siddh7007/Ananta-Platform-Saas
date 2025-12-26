import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import {
  EmptyState,
  NoResultsState,
  ErrorState,
  NoPermissionState,
  NoBOMsState,
  NoComponentsState,
  NoFilteredResultsState,
} from './EmptyState';
import { Search } from 'lucide-react';

// Wrapper for components that use Link
function Wrapper({ children }: { children: React.ReactNode }) {
  return <BrowserRouter>{children}</BrowserRouter>;
}

describe('EmptyState', () => {
  describe('Basic rendering', () => {
    it('renders title', () => {
      render(<EmptyState title="No items" />);
      expect(screen.getByText('No items')).toBeInTheDocument();
    });

    it('renders description when provided', () => {
      render(<EmptyState title="No items" description="Nothing to show" />);
      expect(screen.getByText('Nothing to show')).toBeInTheDocument();
    });

    it('does not render description when not provided', () => {
      render(<EmptyState title="No items" />);
      expect(screen.queryByText('Nothing to show')).not.toBeInTheDocument();
    });

    it('renders custom children', () => {
      render(
        <EmptyState title="No items">
          <div>Custom content</div>
        </EmptyState>
      );
      expect(screen.getByText('Custom content')).toBeInTheDocument();
    });
  });

  describe('Variants', () => {
    it('renders default variant with Package icon', () => {
      const { container } = render(<EmptyState variant="default" title="No items" />);
      // Check that an svg icon is rendered
      expect(container.querySelector('svg')).toBeInTheDocument();
    });

    it('renders search variant', () => {
      render(<EmptyState variant="search" title="No results" />);
      expect(screen.getByText('No results')).toBeInTheDocument();
    });

    it('renders error variant', () => {
      render(<EmptyState variant="error" title="Error" />);
      expect(screen.getByText('Error')).toBeInTheDocument();
    });

    it('renders no-permission variant', () => {
      render(<EmptyState variant="no-permission" title="Access denied" />);
      expect(screen.getByText('Access denied')).toBeInTheDocument();
    });

    it('uses custom icon when provided', () => {
      const { container } = render(
        <EmptyState icon={Search} variant="default" title="Custom" />
      );
      expect(container.querySelector('svg')).toBeInTheDocument();
    });
  });

  describe('Sizes', () => {
    it('renders small size', () => {
      const { container } = render(<EmptyState size="sm" title="Small" />);
      expect(container.querySelector('.py-8')).toBeInTheDocument();
    });

    it('renders medium size (default)', () => {
      const { container } = render(<EmptyState size="md" title="Medium" />);
      expect(container.querySelector('.py-12')).toBeInTheDocument();
    });

    it('renders large size with background', () => {
      const { container } = render(<EmptyState size="lg" title="Large" />);
      expect(container.querySelector('.py-16')).toBeInTheDocument();
      expect(container.querySelector('.bg-muted\\/50')).toBeInTheDocument();
    });
  });

  describe('Actions', () => {
    it('renders primary action button', () => {
      const handleClick = vi.fn();
      render(
        <EmptyState
          title="No items"
          action={{ label: 'Add item', onClick: handleClick }}
        />
      );
      expect(screen.getByRole('button', { name: 'Add item' })).toBeInTheDocument();
    });

    it('calls onClick when action button is clicked', async () => {
      const user = userEvent.setup();
      const handleClick = vi.fn();
      render(
        <EmptyState
          title="No items"
          action={{ label: 'Add item', onClick: handleClick }}
        />
      );

      await user.click(screen.getByRole('button', { name: 'Add item' }));
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('renders action as link when href is provided', () => {
      render(
        <EmptyState
          title="No items"
          action={{ label: 'Go to settings', href: '/settings' }}
        />,
        { wrapper: Wrapper }
      );

      const link = screen.getByRole('link');
      expect(link).toHaveAttribute('href', '/settings');
    });

    it('renders both primary and secondary actions', () => {
      render(
        <EmptyState
          title="No items"
          action={{ label: 'Primary', onClick: vi.fn() }}
          secondaryAction={{ label: 'Secondary', onClick: vi.fn() }}
        />
      );

      expect(screen.getByRole('button', { name: 'Primary' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Secondary' })).toBeInTheDocument();
    });

    it('applies correct variant to secondary action', () => {
      render(
        <EmptyState
          title="No items"
          secondaryAction={{ label: 'Secondary', onClick: vi.fn(), variant: 'outline' }}
        />
      );

      const button = screen.getByRole('button', { name: 'Secondary' });
      expect(button).toHaveClass('border');
    });
  });

  describe('Accessibility', () => {
    it('has role="status"', () => {
      const { container } = render(<EmptyState title="No items" />);
      expect(container.querySelector('[role="status"]')).toBeInTheDocument();
    });

    it('has aria-labelledby pointing to title', () => {
      const { container } = render(<EmptyState title="No items" />);
      const statusDiv = container.querySelector('[role="status"]');
      const labelledBy = statusDiv?.getAttribute('aria-labelledby');

      expect(labelledBy).toBeTruthy();
      expect(screen.getByText('No items')).toHaveAttribute('id', labelledBy!);
    });

    it('marks icon as decorative with aria-hidden', () => {
      const { container } = render(<EmptyState title="No items" />);
      const icon = container.querySelector('svg');
      expect(icon).toHaveAttribute('aria-hidden', 'true');
    });
  });

  describe('Custom styling', () => {
    it('applies custom className', () => {
      const { container } = render(
        <EmptyState title="No items" className="custom-class" />
      );
      expect(container.querySelector('.custom-class')).toBeInTheDocument();
    });
  });
});

describe('NoResultsState', () => {
  it('renders with query', () => {
    render(<NoResultsState query="electronics" />);
    expect(
      screen.getByText(/No results found for "electronics"/)
    ).toBeInTheDocument();
  });

  it('renders without query', () => {
    render(<NoResultsState />);
    expect(
      screen.getByText(/Try adjusting your search terms or filters/)
    ).toBeInTheDocument();
  });

  it('renders clear button when onClear is provided', () => {
    const handleClear = vi.fn();
    render(<NoResultsState onClear={handleClear} />);
    expect(screen.getByRole('button', { name: 'Clear search' })).toBeInTheDocument();
  });

  it('calls onClear when button is clicked', async () => {
    const user = userEvent.setup();
    const handleClear = vi.fn();
    render(<NoResultsState onClear={handleClear} />);

    await user.click(screen.getByRole('button', { name: 'Clear search' }));
    expect(handleClear).toHaveBeenCalledTimes(1);
  });
});

describe('ErrorState', () => {
  it('renders default error message', () => {
    render(<ErrorState />);
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(
      screen.getByText(/An error occurred while loading the data/)
    ).toBeInTheDocument();
  });

  it('renders custom error message', () => {
    render(<ErrorState error="Connection timeout" />);
    expect(screen.getByText('Connection timeout')).toBeInTheDocument();
  });

  it('renders retry button when onRetry is provided', () => {
    const handleRetry = vi.fn();
    render(<ErrorState onRetry={handleRetry} />);
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('calls onRetry when button is clicked', async () => {
    const user = userEvent.setup();
    const handleRetry = vi.fn();
    render(<ErrorState onRetry={handleRetry} />);

    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(handleRetry).toHaveBeenCalledTimes(1);
  });
});

describe('NoPermissionState', () => {
  it('renders default permission message', () => {
    render(<NoPermissionState />);
    expect(screen.getByText('Access denied')).toBeInTheDocument();
    expect(
      screen.getByText(/You don't have permission to view this content/)
    ).toBeInTheDocument();
  });

  it('renders with resource name', () => {
    render(<NoPermissionState resource="billing information" />);
    expect(
      screen.getByText(/You don't have permission to view billing information/)
    ).toBeInTheDocument();
  });
});

describe('NoBOMsState', () => {
  it('renders BOM empty state', () => {
    render(<NoBOMsState />);
    expect(screen.getByText('No BOMs yet')).toBeInTheDocument();
    expect(
      screen.getByText(/Get started by uploading your first Bill of Materials/)
    ).toBeInTheDocument();
  });

  it('shows supported formats', () => {
    render(<NoBOMsState />);
    expect(screen.getByText(/Supported formats: CSV, Excel/)).toBeInTheDocument();
  });

  it('renders upload button when onUpload is provided', () => {
    const handleUpload = vi.fn();
    render(<NoBOMsState onUpload={handleUpload} />);
    expect(screen.getByRole('button', { name: 'Upload BOM' })).toBeInTheDocument();
  });

  it('calls onUpload when button is clicked', async () => {
    const user = userEvent.setup();
    const handleUpload = vi.fn();
    render(<NoBOMsState onUpload={handleUpload} />);

    await user.click(screen.getByRole('button', { name: 'Upload BOM' }));
    expect(handleUpload).toHaveBeenCalledTimes(1);
  });
});

describe('NoComponentsState', () => {
  it('renders components empty state', () => {
    render(<NoComponentsState />);
    expect(screen.getByText('No components found')).toBeInTheDocument();
    expect(
      screen.getByText(/Search for components to add to your BOM/)
    ).toBeInTheDocument();
  });

  it('renders search button when onSearch is provided', () => {
    const handleSearch = vi.fn();
    render(<NoComponentsState onSearch={handleSearch} />);
    expect(
      screen.getByRole('button', { name: 'Search components' })
    ).toBeInTheDocument();
  });
});

describe('NoFilteredResultsState', () => {
  it('renders filtered results empty state', () => {
    render(<NoFilteredResultsState />);
    expect(screen.getByText('No matches found')).toBeInTheDocument();
    expect(
      screen.getByText(/No items match the current filters/)
    ).toBeInTheDocument();
  });

  it('renders clear filters button when onClearFilters is provided', () => {
    const handleClear = vi.fn();
    render(<NoFilteredResultsState onClearFilters={handleClear} />);
    expect(screen.getByRole('button', { name: 'Clear filters' })).toBeInTheDocument();
  });
});
