/**
 * Test Utilities
 *
 * Common test helpers and custom render functions.
 */

import React, { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { BrowserRouter } from 'react-router-dom';

// Default MUI theme for tests
const theme = createTheme();

// Wrapper with all providers
interface AllProvidersProps {
  children: React.ReactNode;
}

function AllProviders({ children }: AllProvidersProps) {
  return (
    <BrowserRouter>
      <ThemeProvider theme={theme}>{children}</ThemeProvider>
    </BrowserRouter>
  );
}

// Custom render with providers
function customRender(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) {
  return render(ui, { wrapper: AllProviders, ...options });
}

// Re-export everything from testing-library
export * from '@testing-library/react';
export { customRender as render };

// Mock data factories
export const createMockComponent = (overrides = {}) => ({
  id: 'comp-1',
  mpn: 'ATMEGA328P-PU',
  manufacturer: 'Microchip',
  description: '8-bit Microcontroller',
  category: 'Integrated Circuits > Microcontrollers',
  quality_score: 95,
  lifecycle_status: 'Active',
  unit_price: 2.5,
  stock_quantity: 1000,
  lead_time_days: 7,
  rohs_compliant: true,
  ...overrides,
});

export const createMockBom = (overrides = {}) => ({
  id: 'bom-1',
  name: 'Test BOM',
  component_count: 50,
  status: 'completed',
  created_at: new Date().toISOString(),
  ...overrides,
});

export const createMockProject = (overrides = {}) => ({
  id: 'proj-1',
  name: 'Test Project',
  description: 'Test project description',
  total_boms: 5,
  completed_boms: 3,
  total_components: 100,
  status: 'active',
  ...overrides,
});

export const createMockAuditEntry = (overrides = {}) => ({
  id: 'audit-1',
  action: 'BOM_UPLOADED',
  actor_email: 'user@test.com',
  target_type: 'BOM',
  target_id: 'bom-1',
  details: 'Uploaded test.csv',
  created_at: new Date().toISOString(),
  ...overrides,
});

export const createMockInvite = (overrides = {}) => ({
  id: 'invite-1',
  email: 'newuser@test.com',
  role: 'engineer',
  invited_at: new Date().toISOString(),
  invited_by: 'admin@test.com',
  expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  ...overrides,
});
