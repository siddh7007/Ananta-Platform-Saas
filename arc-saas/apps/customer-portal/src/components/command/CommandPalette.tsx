/**
 * CommandPalette Component (Cmd+K)
 *
 * Global command palette for quick navigation and actions
 * Accessible via Cmd+K (Mac) or Ctrl+K (Windows/Linux)
 *
 * Features:
 * - Search across navigation items, quick actions, and recent items
 * - Keyboard navigation (arrow keys, Enter, Escape)
 * - Grouped results by category
 * - Recent items persistence in localStorage
 * - Responsive design with mobile support
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  CommandItem,
  CommandGroup,
  CommandEmpty,
  type CommandItemData,
} from './CommandItem';
import { useKeyboardShortcuts, formatShortcut } from '@/hooks/useKeyboardShortcuts';
import { getNavigationForRole, type NavItem } from '@/config/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/contexts/TenantContext';
import type { AppRole } from '@/config/auth';
import { createLogger } from '@/lib/utils';
import {
  Home,
  FileText,
  Cpu,
  FolderKanban,
  AlertTriangle,
  Bell,
  Settings,
  Upload,
  Plus,
  UserPlus,
  Clock,
} from 'lucide-react';

const log = createLogger('CommandPalette');

const RECENT_ITEMS_KEY = 'cbp:command-palette:recent';
const MAX_RECENT_ITEMS = 5;

interface CommandPaletteProps {
  /** Whether the palette is open */
  open?: boolean;
  /** Callback when open state changes */
  onOpenChange?: (open: boolean) => void;
}

export function CommandPalette({ open: controlledOpen, onOpenChange }: CommandPaletteProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const [internalOpen, setInternalOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Use controlled or internal state
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = onOpenChange || setInternalOpen;

  // Get navigation items for user role
  const userRole = (user?.role || 'analyst') as AppRole;
  const navigation = getNavigationForRole(userRole);

  // Load recent items from localStorage
  const [recentItems, setRecentItems] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem(RECENT_ITEMS_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  // Save recent item
  const saveRecentItem = useCallback((path: string) => {
    setRecentItems((prev) => {
      const updated = [path, ...prev.filter((p) => p !== path)].slice(
        0,
        MAX_RECENT_ITEMS
      );
      try {
        localStorage.setItem(RECENT_ITEMS_KEY, JSON.stringify(updated));
      } catch (error) {
        // Handle quota exceeded or other localStorage errors gracefully
        if (error instanceof DOMException && error.name === 'QuotaExceededError') {
          log.warn('localStorage quota exceeded, clearing old recent items');
          try {
            localStorage.removeItem(RECENT_ITEMS_KEY);
            localStorage.setItem(RECENT_ITEMS_KEY, JSON.stringify(updated.slice(0, 3)));
          } catch {
            // If still failing, just continue without persistence
            log.warn('Unable to save recent items to localStorage');
          }
        } else {
          log.error('Failed to save recent items', error);
        }
      }
      return updated;
    });
  }, []);

  // Build command items from navigation
  const navItems = useMemo((): CommandItemData[] => {
    const items: CommandItemData[] = [];

    const addNavItem = (item: NavItem, parent?: NavItem) => {
      items.push({
        id: item.name,
        label: item.label,
        icon: item.icon,
        description: parent ? `${parent.label} > ${item.label}` : undefined,
        category: 'navigation',
        onSelect: () => {
          navigate(item.href);
          saveRecentItem(item.href);
          setOpen(false);
        },
      });

      // Add children recursively
      if (item.children) {
        item.children.forEach((child) => addNavItem(child, item));
      }
    };

    navigation.forEach((item) => addNavItem(item));
    return items;
  }, [navigation, navigate, saveRecentItem, setOpen]);

  // Quick actions
  const quickActions = useMemo((): CommandItemData[] => {
    return [
      {
        id: 'upload-bom',
        label: 'Upload BOM',
        icon: Upload,
        description: 'Upload a new bill of materials',
        category: 'actions',
        shortcut: 'u',
        onSelect: () => {
          navigate('/boms/upload');
          saveRecentItem('/boms/upload');
          setOpen(false);
        },
      },
      {
        id: 'create-project',
        label: 'Create Project',
        icon: Plus,
        description: 'Start a new project',
        category: 'actions',
        shortcut: 'p',
        onSelect: () => {
          navigate('/projects/create');
          saveRecentItem('/projects/create');
          setOpen(false);
        },
      },
      {
        id: 'invite-team',
        label: 'Invite Team Member',
        icon: UserPlus,
        description: 'Send an invitation to join your team',
        category: 'actions',
        onSelect: () => {
          navigate('/team/invitations');
          setOpen(false);
        },
      },
    ].filter((action) => {
      // Filter based on user role
      if (action.id === 'upload-bom' && userRole === 'analyst') return false;
      if (action.id === 'create-project' && userRole === 'analyst') return false;
      if (action.id === 'invite-team' && !['admin', 'owner', 'super_admin'].includes(userRole))
        return false;
      return true;
    });
  }, [navigate, saveRecentItem, setOpen, userRole]);

  // Recent items
  const recentItemsList = useMemo((): CommandItemData[] => {
    const items: CommandItemData[] = [];

    for (const path of recentItems) {
      // Find matching nav item
      const findNavItem = (navItems: NavItem[]): NavItem | undefined => {
        for (const item of navItems) {
          if (item.href === path) return item;
          if (item.children) {
            const child = findNavItem(item.children);
            if (child) return child;
          }
        }
        return undefined;
      };

      const navItem = findNavItem(navigation);
      if (navItem) {
        items.push({
          id: `recent-${navItem.name}`,
          label: navItem.label,
          icon: navItem.icon || Clock,
          description: 'Recent',
          category: 'recent',
          onSelect: () => {
            navigate(navItem.href);
            setOpen(false);
          },
        });
      }
    }

    return items;
  }, [recentItems, navigation, navigate, setOpen]);

  // Filter and combine all items based on search
  const filteredItems = useMemo(() => {
    const allItems = [...recentItemsList, ...navItems, ...quickActions];

    if (!search.trim()) {
      return allItems;
    }

    const query = search.toLowerCase();
    return allItems.filter(
      (item) =>
        item.label.toLowerCase().includes(query) ||
        item.description?.toLowerCase().includes(query)
    );
  }, [search, recentItemsList, navItems, quickActions]);

  // Group items by category
  const groupedItems = useMemo(() => {
    const groups: Record<string, CommandItemData[]> = {
      recent: [],
      navigation: [],
      actions: [],
    };

    filteredItems.forEach((item) => {
      const category = item.category || 'navigation';
      if (!groups[category]) groups[category] = [];
      groups[category].push(item);
    });

    return groups;
  }, [filteredItems]);

  // Reset selected index when search changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [search]);

  // Keyboard shortcuts for opening/closing
  useKeyboardShortcuts([
    {
      id: 'open-command-palette',
      key: 'k',
      ctrlOrCmd: true,
      callback: () => setOpen(!open),
      description: 'Toggle command palette',
    },
    {
      id: 'close-command-palette',
      key: 'Escape',
      callback: () => {
        if (open) setOpen(false);
      },
      enabled: open,
      description: 'Close command palette',
    },
  ]);

  // Keyboard navigation within the palette
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const totalItems = filteredItems.length;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) => (prev + 1) % totalItems);
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) => (prev - 1 + totalItems) % totalItems);
          break;
        case 'Enter':
          e.preventDefault();
          if (filteredItems[selectedIndex]) {
            filteredItems[selectedIndex].onSelect();
          }
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, filteredItems, selectedIndex]);

  // Reset state when closing
  useEffect(() => {
    if (!open) {
      setSearch('');
      setSelectedIndex(0);
    }
  }, [open]);

  // Log when palette opens
  useEffect(() => {
    if (open) {
      log.info('Command palette opened', { path: location.pathname });
    }
  }, [open, location.pathname]);

  const handleItemClick = (item: CommandItemData) => {
    log.debug('Command palette item selected', { id: item.id, label: item.label });
    item.onSelect();
  };

  const renderGroup = (category: string, items: CommandItemData[]) => {
    if (items.length === 0) return null;

    const headings: Record<string, string> = {
      recent: 'Recent',
      navigation: 'Navigation',
      actions: 'Quick Actions',
    };

    let itemIndex = 0;
    // Calculate the starting index for this group
    for (const cat in groupedItems) {
      if (cat === category) break;
      itemIndex += groupedItems[cat].length;
    }

    return (
      <CommandGroup key={category} heading={headings[category] || category}>
        {items.map((item, index) => (
          <CommandItem
            key={item.id}
            item={item}
            isSelected={itemIndex + index === selectedIndex}
            onClick={() => handleItemClick(item)}
          />
        ))}
      </CommandGroup>
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        className="max-w-2xl p-0 gap-0"
        showCloseButton={false}
        onOpenAutoFocus={(e) => {
          // Focus search input when dialog opens
          e.preventDefault();
          const input = document.querySelector(
            '[data-command-palette-input]'
          ) as HTMLInputElement;
          if (input) input.focus();
        }}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>Command Palette</DialogTitle>
        </DialogHeader>

        {/* Search input */}
        <div className="border-b p-4">
          <Input
            data-command-palette-input
            type="text"
            placeholder="Search or type a command..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-11 border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
            autoComplete="off"
            aria-label="Search commands"
          />
        </div>

        {/* Results */}
        <ScrollArea className="max-h-[400px]">
          <div className="py-2">
            {filteredItems.length === 0 ? (
              <CommandEmpty query={search} />
            ) : (
              <>
                {renderGroup('recent', groupedItems.recent || [])}
                {renderGroup('navigation', groupedItems.navigation || [])}
                {renderGroup('actions', groupedItems.actions || [])}
              </>
            )}
          </div>
        </ScrollArea>

        {/* Footer with keyboard hints */}
        <div className="border-t bg-muted/50 px-4 py-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1">
                <kbd className="rounded border bg-background px-1.5 py-0.5 font-mono">↑↓</kbd>
                <span>Navigate</span>
              </div>
              <div className="flex items-center gap-1">
                <kbd className="rounded border bg-background px-1.5 py-0.5 font-mono">↵</kbd>
                <span>Select</span>
              </div>
              <div className="flex items-center gap-1">
                <kbd className="rounded border bg-background px-1.5 py-0.5 font-mono">Esc</kbd>
                <span>Close</span>
              </div>
            </div>
            {currentTenant && (
              <span className="hidden sm:inline">
                Workspace: <span className="font-medium">{currentTenant.name}</span>
              </span>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * CommandPaletteTrigger Component
 *
 * Button to open the command palette
 * Shows the keyboard shortcut hint
 */
interface CommandPaletteTriggerProps {
  onClick?: () => void;
  className?: string;
}

export function CommandPaletteTrigger({ onClick, className }: CommandPaletteTriggerProps) {
  const isMac =
    typeof navigator !== 'undefined' &&
    /Mac|iPhone|iPad|iPod/.test(navigator.platform);

  return (
    <button
      onClick={onClick}
      className={className}
      aria-label="Open command palette"
      title={`Command palette (${isMac ? 'Cmd' : 'Ctrl'}+K)`}
    >
      <span className="sr-only">Open command palette</span>
      <kbd className="pointer-events-none inline-flex h-8 select-none items-center gap-1 rounded border bg-muted px-2 font-mono text-xs font-medium text-muted-foreground">
        <span className="text-xs">{isMac ? '⌘' : 'Ctrl'}</span>K
      </kbd>
    </button>
  );
}
