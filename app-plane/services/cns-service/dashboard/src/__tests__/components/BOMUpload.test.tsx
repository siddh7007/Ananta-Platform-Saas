import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BOMUpload } from '../../bom/BOMUpload';
import { BrowserRouter } from 'react-router-dom';
import userEvent from '@testing-library/user-event';

// Mock fetch
global.fetch = vi.fn();

// Mock navigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('BOMUpload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderBOMUpload = () => {
    return render(
      <BrowserRouter>
        <BOMUpload />
      </BrowserRouter>
    );
  };

  it('should render upload interface', () => {
    renderBOMUpload();
    expect(screen.getByText(/upload/i)).toBeInTheDocument();
  });

  it('should allow file selection via input', async () => {
    const user = userEvent.setup();
    renderBOMUpload();

    const file = new File(['content'], 'test.csv', { type: 'text/csv' });
    const input = screen.getByLabelText(/upload/i) || document.querySelector('input[type="file"]');

    if (input) {
      await user.upload(input as HTMLInputElement, file);
      expect(screen.getByText(/test.csv/i)).toBeInTheDocument();
    }
  });

  it('should validate file extension', () => {
    renderBOMUpload();

    const invalidFile = new File(['content'], 'test.pdf', { type: 'application/pdf' });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;

    if (input) {
      fireEvent.change(input, { target: { files: [invalidFile] } });

      // Should show error for unsupported file type
      waitFor(() => {
        expect(screen.getByText(/unsupported file type/i)).toBeInTheDocument();
      });
    }
  });

  it('should accept valid CSV file', () => {
    renderBOMUpload();

    const validFile = new File(['content'], 'test.csv', { type: 'text/csv' });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;

    if (input) {
      fireEvent.change(input, { target: { files: [validFile] } });

      waitFor(() => {
        expect(screen.queryByText(/unsupported file type/i)).not.toBeInTheDocument();
      });
    }
  });

  it('should accept valid Excel files', () => {
    renderBOMUpload();

    const xlsxFile = new File(['content'], 'test.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;

    if (input) {
      fireEvent.change(input, { target: { files: [xlsxFile] } });

      waitFor(() => {
        expect(screen.queryByText(/unsupported file type/i)).not.toBeInTheDocument();
      });
    }
  });

  it('should reject files exceeding size limit', () => {
    renderBOMUpload();

    // Create a large file (>10MB)
    const largeContent = 'a'.repeat(11 * 1024 * 1024);
    const largeFile = new File([largeContent], 'large.csv', { type: 'text/csv' });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;

    if (input) {
      fireEvent.change(input, { target: { files: [largeFile] } });

      waitFor(() => {
        expect(screen.getByText(/exceeds.*limit/i)).toBeInTheDocument();
      });
    }
  });

  it('should handle successful upload', async () => {
    const mockResponse = {
      job_id: 'test-job-123',
      filename: 'test.csv',
      total_items: 50,
      status: 'queued',
      message: 'Upload successful',
    };

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    });

    renderBOMUpload();

    const file = new File(['content'], 'test.csv', { type: 'text/csv' });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;

    if (input) {
      fireEvent.change(input, { target: { files: [file] } });

      // Find and click upload button
      const uploadButton = screen.getByRole('button', { name: /upload/i });
      fireEvent.click(uploadButton);

      await waitFor(() => {
        expect(screen.getByText(/successful/i)).toBeInTheDocument();
      });
    }
  });

  it('should handle upload errors', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ error: 'Server error' }),
    });

    renderBOMUpload();

    const file = new File(['content'], 'test.csv', { type: 'text/csv' });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;

    if (input) {
      fireEvent.change(input, { target: { files: [file] } });

      const uploadButton = screen.getByRole('button', { name: /upload/i });
      fireEvent.click(uploadButton);

      await waitFor(() => {
        expect(screen.getByText(/error/i)).toBeInTheDocument();
      });
    }
  });

  it('should show upload progress during upload', async () => {
    (global.fetch as any).mockImplementation(() => new Promise(() => {}));

    renderBOMUpload();

    const file = new File(['content'], 'test.csv', { type: 'text/csv' });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;

    if (input) {
      fireEvent.change(input, { target: { files: [file] } });

      const uploadButton = screen.getByRole('button', { name: /upload/i });
      fireEvent.click(uploadButton);

      await waitFor(() => {
        expect(screen.getByRole('progressbar')).toBeInTheDocument();
      });
    }
  });

  it('should support drag and drop', () => {
    renderBOMUpload();

    const dropZone = screen.getByText(/drag/i).closest('div');
    const file = new File(['content'], 'test.csv', { type: 'text/csv' });

    if (dropZone) {
      fireEvent.dragEnter(dropZone);
      // Check for active drag state visual feedback
      expect(dropZone).toHaveClass(/drag.*active/i);

      fireEvent.drop(dropZone, {
        dataTransfer: { files: [file] },
      });

      waitFor(() => {
        expect(screen.getByText(/test.csv/i)).toBeInTheDocument();
      });
    }
  });
});
