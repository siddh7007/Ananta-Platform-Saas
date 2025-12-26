/**
 * BOMQueueItem Tests
 *
 * Tests for BOM queue item display and interactions.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '../../test/test-utils';
import { BOMQueueItem, type QueueItemData } from './BOMQueueItem';

// Mock child components to simplify testing
vi.mock('./BOMColumnMapper', () => ({
  BOMColumnMapper: ({ onConfirm }: any) => (
    <div data-testid="mock-column-mapper">
      <button onClick={onConfirm}>Confirm</button>
    </div>
  ),
}));

vi.mock('./BOMUploadComplete', () => ({
  BOMUploadComplete: ({ onStartEnrichment, onSkip, onViewDetails }: any) => (
    <div data-testid="mock-upload-complete">
      <button onClick={onStartEnrichment}>Start Enrichment</button>
      <button onClick={onSkip}>Skip</button>
      <button onClick={onViewDetails}>View Details</button>
    </div>
  ),
}));

const createMockFile = (name: string = 'test-bom.csv'): File => {
  return new File(['content'], name, { type: 'text/csv' });
};

const createMockItem = (overrides: Partial<QueueItemData> = {}): QueueItemData => ({
  file: createMockFile(),
  status: 'pending',
  ...overrides,
});

describe('BOMQueueItem', () => {
  const defaultProps = {
    index: 0,
    onMappingChange: vi.fn(),
    onConfirmMappings: vi.fn(),
    onStartEnrichment: vi.fn(),
    onRetry: vi.fn(),
    onSkip: vi.fn(),
    onViewDetails: vi.fn(),
  };

  it('renders filename', () => {
    const item = createMockItem({ file: createMockFile('my-components.csv') });
    render(<BOMQueueItem item={item} {...defaultProps} />);

    expect(screen.getByText('my-components.csv')).toBeInTheDocument();
  });

  it('renders row count when provided', () => {
    const item = createMockItem({ totalRows: 250 });
    render(<BOMQueueItem item={item} {...defaultProps} />);

    expect(screen.getByText(/250 rows/)).toBeInTheDocument();
  });

  describe('Status display', () => {
    it('shows pending status', () => {
      const item = createMockItem({ status: 'pending' });
      render(<BOMQueueItem item={item} {...defaultProps} />);

      expect(screen.getByText('pending')).toBeInTheDocument();
    });

    it('shows parsing status', () => {
      const item = createMockItem({ status: 'parsing' });
      render(<BOMQueueItem item={item} {...defaultProps} />);

      expect(screen.getByText('parsing')).toBeInTheDocument();
    });

    it('shows completed status', () => {
      const item = createMockItem({ status: 'completed', uploadId: 'upload-123' });
      render(<BOMQueueItem item={item} {...defaultProps} />);

      expect(screen.getByText('completed')).toBeInTheDocument();
    });
  });

  it('renders progress bar when processing', () => {
    const item = createMockItem({ status: 'parsing' });
    const { container } = render(<BOMQueueItem item={item} {...defaultProps} />);

    expect(container.querySelector('.MuiLinearProgress-root')).toBeInTheDocument();
  });

  it('shows error message when there is an error', () => {
    const item = createMockItem({ error: 'Upload failed: Invalid file format' });
    render(<BOMQueueItem item={item} {...defaultProps} />);

    // Multiple elements match "upload failed", so use getAllByText
    expect(screen.getAllByText(/upload failed/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/invalid file format/i)).toBeInTheDocument();
  });

  it('shows retry button when there is an error', () => {
    const onRetry = vi.fn();
    const item = createMockItem({ error: 'Upload failed' });
    render(<BOMQueueItem item={item} {...defaultProps} onRetry={onRetry} />);

    const retryButton = screen.getByRole('button', { name: /retry/i });
    fireEvent.click(retryButton);

    expect(onRetry).toHaveBeenCalledWith(0);
  });

  it('shows column mapper when status is mapping', () => {
    const item = createMockItem({
      status: 'mapping',
      uploadId: 'upload-123',
      columnMappings: [{ source: 'MPN', target: 'manufacturer_part_number', confidence: 1 }],
      previewData: [{ MPN: 'ATMEGA328P' }],
    });
    render(<BOMQueueItem item={item} {...defaultProps} />);

    expect(screen.getByTestId('mock-column-mapper')).toBeInTheDocument();
  });

  it('shows upload complete when status is completed', () => {
    const item = createMockItem({
      status: 'completed',
      uploadId: 'upload-123',
    });
    render(<BOMQueueItem item={item} {...defaultProps} />);

    expect(screen.getByTestId('mock-upload-complete')).toBeInTheDocument();
  });

  it('shows debug IDs when showDebugIds is true', () => {
    const item = createMockItem({ uploadId: 'abc12345-longer-id' });
    render(<BOMQueueItem item={item} {...defaultProps} showDebugIds />);

    expect(screen.getByText(/ID: abc12345/)).toBeInTheDocument();
  });
});
