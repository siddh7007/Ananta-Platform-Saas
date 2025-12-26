/**
 * Sidebar Context
 * CBP-P1-006: Collapsible Sidebar Navigation
 */

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';

interface SidebarContextValue {
  isCollapsed: boolean;
  toggle: () => void;
  expand: () => void;
  collapse: () => void;
}

const SidebarContext = createContext<SidebarContextValue | undefined>(undefined);

const STORAGE_KEY = 'cbp-sidebar-collapsed';

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [isCollapsed, setIsCollapsed] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored === 'true';
    } catch {
      // Fallback for SSR or private browsing where localStorage may not be available
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, String(isCollapsed));
    } catch {
      // Silently fail if localStorage is not available
    }
  }, [isCollapsed]);

  const toggle = useCallback(() => setIsCollapsed((prev) => !prev), []);
  const expand = useCallback(() => setIsCollapsed(false), []);
  const collapse = useCallback(() => setIsCollapsed(true), []);

  return (
    <SidebarContext.Provider value={{ isCollapsed, toggle, expand, collapse }}>
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error('useSidebar must be used within SidebarProvider');
  }
  return context;
}
