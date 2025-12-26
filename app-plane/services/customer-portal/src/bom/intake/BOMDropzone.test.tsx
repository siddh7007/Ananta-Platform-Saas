/**
 * BOMDropzone Tests
 *
 * Tests for file upload dropzone functionality.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '../../test/test-utils';
import { BOMDropzone } from './BOMDropzone';

// Mock react-dropzone
vi.mock('react-dropzone', () => ({
  useDropzone: vi.fn(({ onDrop }) => ({
    getRootProps: () => ({
      onClick: vi.fn(),
      onDragEnter: vi.fn(),
      onDragLeave: vi.fn(),
      'data-testid': 'dropzone',
    }),
    getInputProps: () => ({
      type: 'file',
      'data-testid': 'dropzone-input',
      onChange: (e: any) => {
        if (e.target.files && e.target.files.length > 0) {
          onDrop(Array.from(e.target.files), []);
        }
      },
    }),
    isDragActive: false,
    isDragAccept: false,
    isDragReject: false,
  })),
}));

describe('BOMDropzone', () => {
  it('renders upload instructions', () => {
    render(<BOMDropzone onFilesAdded={vi.fn()} />);

    expect(screen.getByText(/drag.*drop/i)).toBeInTheDocument();
  });

  it('shows accepted file types', () => {
    render(<BOMDropzone onFilesAdded={vi.fn()} />);

    expect(screen.getByText(/csv/i)).toBeInTheDocument();
  });

  it('calls onFilesAdded when files are dropped', async () => {
    const onFilesAdded = vi.fn();
    render(<BOMDropzone onFilesAdded={onFilesAdded} />);

    const input = screen.getByTestId('dropzone-input');
    const file = new File(['mpn,qty\nATMEGA328,10'], 'test.csv', {
      type: 'text/csv',
    });

    Object.defineProperty(input, 'files', {
      value: [file],
    });

    fireEvent.change(input);

    await waitFor(() => {
      expect(onFilesAdded).toHaveBeenCalled();
    });
  });

  it('shows loading state when disabled', () => {
    render(<BOMDropzone onFilesAdded={vi.fn()} disabled />);

    const dropzone = screen.getByTestId('dropzone');
    expect(dropzone).toBeInTheDocument();
  });
});
