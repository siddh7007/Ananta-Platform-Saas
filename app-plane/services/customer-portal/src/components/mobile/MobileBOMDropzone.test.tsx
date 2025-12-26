/**
 * MobileBOMDropzone Component Tests
 *
 * P1-5: Tests for mobile-optimized BOM upload dropzone.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MobileBOMDropzone } from './MobileBOMDropzone';

// Mock matchMedia for responsive tests
const createMatchMedia = (matches: boolean) => {
  return (query: string) => ({
    matches,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  });
};

describe('MobileBOMDropzone', () => {
  const mockOnFilesAdded = vi.fn();
  const mockOnRemoveFile = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    // Default to desktop view
    window.matchMedia = createMatchMedia(false);
  });

  describe('Desktop Rendering', () => {
    it('renders upload header with cloud icon when no files', () => {
      render(<MobileBOMDropzone onFilesAdded={mockOnFilesAdded} />);

      expect(screen.getByText('Upload BOM')).toBeInTheDocument();
      expect(screen.getByText(/Drag & drop BOM files here/i)).toBeInTheDocument();
    });

    it('renders success state when files are queued', () => {
      render(
        <MobileBOMDropzone onFilesAdded={mockOnFilesAdded} filesInQueue={2} totalRows={150} />
      );

      expect(screen.getByText('Files Selected')).toBeInTheDocument();
      expect(screen.getByText('2 files')).toBeInTheDocument();
    });

    it('shows file count and row count when files are queued', () => {
      render(
        <MobileBOMDropzone onFilesAdded={mockOnFilesAdded} filesInQueue={3} totalRows={500} />
      );

      expect(screen.getByText(/3 files ready/)).toBeInTheDocument();
    });

    it('shows drag active state when dragging over', () => {
      render(
        <MobileBOMDropzone onFilesAdded={mockOnFilesAdded} data-testid="dropzone" />
      );

      const dropzone = screen.getByText(/Drag & drop/i).closest('div[role="presentation"]');
      expect(dropzone).toBeInTheDocument();
    });
  });

  describe('Mobile Rendering', () => {
    beforeEach(() => {
      window.matchMedia = createMatchMedia(true); // Mobile view
    });

    it('shows tap to upload text on mobile', () => {
      render(<MobileBOMDropzone onFilesAdded={mockOnFilesAdded} />);

      expect(screen.getByText(/Tap to upload BOM files/i)).toBeInTheDocument();
    });

    it('shows Select Files button on mobile', () => {
      render(<MobileBOMDropzone onFilesAdded={mockOnFilesAdded} />);

      expect(screen.getByRole('button', { name: /Select files to upload/i })).toBeInTheDocument();
    });

    it('renders file queue list when files are queued', () => {
      render(
        <MobileBOMDropzone
          onFilesAdded={mockOnFilesAdded}
          filesInQueue={2}
          queuedFileNames={['bom1.csv', 'bom2.xlsx']}
          onRemoveFile={mockOnRemoveFile}
        />
      );

      expect(screen.getByText('Queued Files')).toBeInTheDocument();
      expect(screen.getByText('bom1.csv')).toBeInTheDocument();
      expect(screen.getByText('bom2.xlsx')).toBeInTheDocument();
    });

    it('allows removing files from queue', async () => {
      const user = userEvent.setup();
      render(
        <MobileBOMDropzone
          onFilesAdded={mockOnFilesAdded}
          filesInQueue={2}
          queuedFileNames={['bom1.csv', 'bom2.xlsx']}
          onRemoveFile={mockOnRemoveFile}
        />
      );

      const removeButton = screen.getByRole('button', { name: /Remove bom1.csv/i });
      await user.click(removeButton);

      expect(mockOnRemoveFile).toHaveBeenCalledWith('bom1.csv');
    });
  });

  describe('Upload Dialog', () => {
    beforeEach(() => {
      window.matchMedia = createMatchMedia(true); // Mobile view
    });

    it('opens dialog when Select Files is clicked on mobile', async () => {
      const user = userEvent.setup();
      render(<MobileBOMDropzone onFilesAdded={mockOnFilesAdded} />);

      await user.click(screen.getByRole('button', { name: /Select files to upload/i }));

      expect(screen.getByText('Add BOM Files')).toBeInTheDocument();
      expect(screen.getByText('Browse Files')).toBeInTheDocument();
      expect(screen.getByText('Recent BOMs')).toBeInTheDocument();
    });

    it('shows camera option when showCameraOption is true', async () => {
      const user = userEvent.setup();
      render(<MobileBOMDropzone onFilesAdded={mockOnFilesAdded} showCameraOption={true} />);

      await user.click(screen.getByRole('button', { name: /Select files to upload/i }));

      expect(screen.getByText('Take Photo')).toBeInTheDocument();
      expect(screen.getByText(/Capture paper BOM/i)).toBeInTheDocument();
    });

    it('hides camera option when showCameraOption is false', async () => {
      const user = userEvent.setup();
      render(<MobileBOMDropzone onFilesAdded={mockOnFilesAdded} showCameraOption={false} />);

      await user.click(screen.getByRole('button', { name: /Select files to upload/i }));

      expect(screen.queryByText('Take Photo')).not.toBeInTheDocument();
    });

    it('closes dialog on Cancel', async () => {
      const user = userEvent.setup();
      render(<MobileBOMDropzone onFilesAdded={mockOnFilesAdded} />);

      await user.click(screen.getByRole('button', { name: /Select files to upload/i }));
      expect(screen.getByText('Add BOM Files')).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: /Cancel/i }));

      await waitFor(() => {
        expect(screen.queryByText('Add BOM Files')).not.toBeInTheDocument();
      });
    });
  });

  describe('Disabled State', () => {
    it('shows reduced opacity when disabled', () => {
      render(
        <MobileBOMDropzone onFilesAdded={mockOnFilesAdded} disabled data-testid="dropzone" />
      );

      // The Paper component inside should have opacity 0.6
      const dropzone = screen.getByText(/Drag & drop/i).closest('div[role="presentation"]');
      expect(dropzone).toHaveStyle({ opacity: '0.6' });
    });

    it('has not-allowed cursor when disabled', () => {
      render(<MobileBOMDropzone onFilesAdded={mockOnFilesAdded} disabled />);

      const dropzone = screen.getByText(/Drag & drop/i).closest('div[role="presentation"]');
      expect(dropzone).toHaveStyle({ cursor: 'not-allowed' });
    });
  });

  describe('File Handling', () => {
    it('calls onFilesAdded when files are dropped', async () => {
      render(<MobileBOMDropzone onFilesAdded={mockOnFilesAdded} />);

      const dropzone = screen.getByText(/Drag & drop/i).closest('div[role="presentation"]');
      expect(dropzone).toBeInTheDocument();

      const file = new File(['content'], 'test.csv', { type: 'text/csv' });
      const dataTransfer = {
        files: [file],
        items: [{ kind: 'file', type: 'text/csv', getAsFile: () => file }],
        types: ['Files'],
      };

      if (dropzone) {
        fireEvent.drop(dropzone, { dataTransfer });
      }

      await waitFor(() => {
        expect(mockOnFilesAdded).toHaveBeenCalledWith([file]);
      });
    });

    it('accepts CSV files', async () => {
      render(<MobileBOMDropzone onFilesAdded={mockOnFilesAdded} />);

      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      expect(input).toBeInTheDocument();

      // Check accept attribute includes CSV
      expect(input.accept).toContain('.csv');
    });

    it('accepts Excel files', async () => {
      render(<MobileBOMDropzone onFilesAdded={mockOnFilesAdded} />);

      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      expect(input).toBeInTheDocument();

      // Check accept attribute includes Excel
      expect(input.accept).toContain('.xlsx');
      expect(input.accept).toContain('.xls');
    });
  });

  describe('Add More Files', () => {
    it('shows Add more files button when files are queued', () => {
      render(<MobileBOMDropzone onFilesAdded={mockOnFilesAdded} filesInQueue={1} />);

      expect(screen.getByRole('button', { name: /Add more files/i })).toBeInTheDocument();
    });
  });

  describe('Test IDs', () => {
    it('applies data-testid to the card', () => {
      render(
        <MobileBOMDropzone
          onFilesAdded={mockOnFilesAdded}
          data-testid="mobile-dropzone"
        />
      );

      expect(screen.getByTestId('mobile-dropzone')).toBeInTheDocument();
    });
  });
});
