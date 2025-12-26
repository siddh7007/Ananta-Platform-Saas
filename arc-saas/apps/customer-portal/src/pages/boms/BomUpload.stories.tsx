import type { Meta, StoryObj } from '@storybook/react';
import { within, expect } from '@storybook/test';
import { BrowserRouter } from 'react-router-dom';
import { TenantProvider } from '@/contexts/TenantContext';
import { BomUploadPage } from './BomUpload';

/**
 * BomUpload Wizard Component
 *
 * A multi-step wizard for uploading and configuring BOM files.
 * The wizard guides users through:
 * 1. File selection (drag & drop)
 * 2. Data preview
 * 3. Column mapping
 * 4. Enrichment options
 * 5. Review & upload
 * 6. Completion
 */

// Mock the services and contexts
const MockedBomUpload = () => {
  return (
    <BrowserRouter>
      <TenantProvider>
        <div className="p-6 bg-background min-h-screen">
          <BomUploadPage />
        </div>
      </TenantProvider>
    </BrowserRouter>
  );
};

const meta: Meta<typeof BomUploadPage> = {
  title: 'Pages/BOM/Upload Wizard',
  component: BomUploadPage,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: `
# BOM Upload Wizard

A comprehensive multi-step wizard for importing Bill of Materials files.

## Features
- **Drag & Drop**: Support for CSV, XLS, and XLSX files up to 10MB
- **Auto-detection**: Automatically detects column mappings (MPN, Manufacturer, Quantity, etc.)
- **Data Preview**: Shows first 10 rows for verification before upload
- **Column Mapping**: Manual adjustment of auto-detected mappings
- **Enrichment Options**: Configure automatic component enrichment levels
- **Progress Tracking**: Visual step indicator and upload progress

## Steps
1. **Select File** - Drag & drop or browse for BOM file
2. **Preview Data** - View detected data and headers
3. **Map Columns** - Assign columns to BOM fields (MPN required)
4. **Configure Options** - Set BOM name, description, and enrichment level
5. **Review Summary** - Final check before upload
6. **Upload** - Progress bar during file processing
7. **Complete** - Success message with navigation options
        `,
      },
    },
  },
  decorators: [
    (Story) => (
      <BrowserRouter>
        <TenantProvider>
          <div className="p-6 bg-background min-h-screen">
            <Story />
          </div>
        </TenantProvider>
      </BrowserRouter>
    ),
  ],
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Initial state - file selection step with drag & drop zone
 */
export const FileSelection: Story = {
  render: () => <MockedBomUpload />,
  parameters: {
    docs: {
      description: {
        story: 'Initial state showing the file drop zone. Supports CSV, XLS, and XLSX formats up to 10MB.',
      },
    },
  },
};

/**
 * Interactive test: verify drop zone is visible
 */
export const FileSelectionInteractive: Story = {
  render: () => <MockedBomUpload />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Verify the upload zone is visible
    const heading = await canvas.findByText('Upload Your BOM');
    expect(heading).toBeInTheDocument();

    // Verify supported formats are shown
    const csvText = await canvas.findByText(/CSV/);
    expect(csvText).toBeInTheDocument();

    const xlsText = await canvas.findByText(/XLS/);
    expect(xlsText).toBeInTheDocument();
  },
};
