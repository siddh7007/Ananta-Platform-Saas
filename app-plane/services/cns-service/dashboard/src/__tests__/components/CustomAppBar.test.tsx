import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import AppBar from '../../layout/AppBar';
import { AdminContext } from 'react-admin';
import { ThemeContextProvider } from '../../contexts/ThemeContext';

// Mock TenantSelector component
vi.mock('../../components/TenantSelector', () => ({
  default: () => <div data-testid="tenant-selector">Tenant Selector</div>,
}));

// Mock react-admin AppBar
vi.mock('react-admin', async () => {
  const actual = await vi.importActual('react-admin');
  return {
    ...actual,
    AppBar: ({ children, ...props }: any) => (
      <div data-testid="app-bar" {...props}>
        {children}
      </div>
    ),
    UserMenu: () => <div data-testid="user-menu">User Menu</div>,
  };
});

describe('AppBar (layout)', () => {
  const renderWithAdmin = (component: React.ReactElement) => {
    return render(
      <ThemeContextProvider>
        <AdminContext>
          {component}
        </AdminContext>
      </ThemeContextProvider>
    );
  };

  it('should render the AppBar', () => {
    renderWithAdmin(<AppBar />);
    expect(screen.getByTestId('app-bar')).toBeInTheDocument();
  });

  it('should display Super Admin badge', () => {
    renderWithAdmin(<AppBar />);
    expect(screen.getByText('Super Admin')).toBeInTheDocument();
  });

  it('should render TenantSelector component', () => {
    renderWithAdmin(<AppBar />);
    expect(screen.getByTestId('tenant-selector')).toBeInTheDocument();
  });

  it('should render UserMenu', () => {
    renderWithAdmin(<AppBar />);
    expect(screen.getByTestId('user-menu')).toBeInTheDocument();
  });

  it('should render theme toggle control', () => {
    renderWithAdmin(<AppBar />);
    expect(screen.getByLabelText(/change theme/i)).toBeInTheDocument();
  });

  it('should have correct structure with spacer', () => {
    renderWithAdmin(<AppBar />);
    const appBar = screen.getByTestId('app-bar');

    // Check that all expected elements are present
    expect(appBar).toContainElement(screen.getByText('Super Admin'));
    expect(appBar).toContainElement(screen.getByTestId('tenant-selector'));
  });
});
