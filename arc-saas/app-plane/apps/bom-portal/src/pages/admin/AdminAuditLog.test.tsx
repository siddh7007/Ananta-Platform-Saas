/**
 * AdminAuditLog Tests
 *
 * Tests for audit log display and formatting.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '../../test/test-utils';
import { AdminAuditLog, type AuditLogEntry } from './AdminAuditLog';

const createMockEntry = (overrides: Partial<AuditLogEntry> = {}): AuditLogEntry => ({
  id: '1',
  action: 'BOM_UPLOADED',
  actor_email: 'user@test.com',
  target_type: 'BOM',
  target_id: 'bom-123',
  details: 'Uploaded test-bom.csv',
  created_at: new Date().toISOString(),
  ...overrides,
});

describe('AdminAuditLog', () => {
  it('renders title', () => {
    render(<AdminAuditLog entries={[]} />);

    expect(screen.getByText('Recent Activity')).toBeInTheDocument();
  });

  it('shows empty state when no entries', () => {
    render(<AdminAuditLog entries={[]} />);

    expect(screen.getByText(/no audit log entries/i)).toBeInTheDocument();
  });

  it('renders audit entries', () => {
    const entries = [
      createMockEntry({ actor_email: 'admin@test.com', action: 'USER_INVITED' }),
    ];

    render(<AdminAuditLog entries={entries} />);

    expect(screen.getByText('admin@test.com')).toBeInTheDocument();
  });

  it('formats action text with spaces', () => {
    const entries = [
      createMockEntry({ action: 'BOM_UPLOADED' }),
    ];

    render(<AdminAuditLog entries={entries} />);

    // Should convert BOM_UPLOADED to "bom uploaded"
    expect(screen.getByText(/bom uploaded/i)).toBeInTheDocument();
  });

  it('shows entry details', () => {
    const entries = [
      createMockEntry({ details: 'Uploaded components.csv with 100 rows' }),
    ];

    render(<AdminAuditLog entries={entries} />);

    expect(screen.getByText(/uploaded components\.csv/i)).toBeInTheDocument();
  });

  it('shows relative time', () => {
    const entries = [
      createMockEntry({ created_at: new Date().toISOString() }),
    ];

    render(<AdminAuditLog entries={entries} />);

    expect(screen.getByText(/just now/i)).toBeInTheDocument();
  });

  it('shows "System" when actor_email is empty', () => {
    const entries = [
      createMockEntry({ actor_email: '' }),
    ];

    render(<AdminAuditLog entries={entries} />);

    expect(screen.getByText('System')).toBeInTheDocument();
  });

  it('shows loading state', () => {
    const { container } = render(<AdminAuditLog entries={[]} loading />);

    expect(container.querySelectorAll('.MuiSkeleton-root').length).toBeGreaterThan(0);
  });

  it('renders export button when onExport is provided', () => {
    const onExport = vi.fn();
    render(<AdminAuditLog entries={[]} onExport={onExport} />);

    const exportButton = screen.getByText(/export logs/i);
    expect(exportButton).toBeInTheDocument();

    fireEvent.click(exportButton);
    expect(onExport).toHaveBeenCalled();
  });

  it('does not render export button when onExport is not provided', () => {
    render(<AdminAuditLog entries={[]} />);

    expect(screen.queryByText(/export logs/i)).not.toBeInTheDocument();
  });

  it('renders multiple entries in order', () => {
    const entries = [
      createMockEntry({ id: '1', action: 'FIRST_ACTION' }),
      createMockEntry({ id: '2', action: 'SECOND_ACTION' }),
      createMockEntry({ id: '3', action: 'THIRD_ACTION' }),
    ];

    render(<AdminAuditLog entries={entries} />);

    expect(screen.getByText(/first action/i)).toBeInTheDocument();
    expect(screen.getByText(/second action/i)).toBeInTheDocument();
    expect(screen.getByText(/third action/i)).toBeInTheDocument();
  });
});
