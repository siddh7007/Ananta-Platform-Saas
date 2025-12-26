/**
 * Command Palette Component
 *
 * Quick navigation and actions via Cmd/Ctrl+K shortcut.
 * Features:
 * - Fuzzy search across pages, actions, and recent items
 * - Keyboard navigation (arrow keys, enter, escape)
 * - Categorized results (Navigation, Actions, Recent)
 * - Accessible with ARIA attributes
 */

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  Box,
  TextField,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
  Chip,
  InputAdornment,
  Divider,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import DashboardIcon from '@mui/icons-material/Dashboard';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import FolderIcon from '@mui/icons-material/Folder';
import ListAltIcon from '@mui/icons-material/ListAlt';
import MemoryIcon from '@mui/icons-material/Memory';
import NotificationsIcon from '@mui/icons-material/Notifications';
import SettingsIcon from '@mui/icons-material/Settings';
import PersonIcon from '@mui/icons-material/Person';
import BusinessIcon from '@mui/icons-material/Business';
import PaymentIcon from '@mui/icons-material/Payment';
import SecurityIcon from '@mui/icons-material/Security';
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined';
import HistoryIcon from '@mui/icons-material/History';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import PeopleIcon from '@mui/icons-material/People';
import KeyboardReturnIcon from '@mui/icons-material/KeyboardReturn';

interface CommandItem {
  id: string;
  title: string;
  description?: string;
  icon: React.ReactNode;
  action: () => void;
  category: 'navigation' | 'actions' | 'recent' | 'settings';
  keywords?: string[];
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Fuzzy match score - returns higher score for better matches
 */
function fuzzyMatch(query: string, text: string): number {
  const q = query.toLowerCase();
  const t = text.toLowerCase();

  // Exact match
  if (t === q) return 100;

  // Starts with query
  if (t.startsWith(q)) return 90;

  // Contains query as substring
  if (t.includes(q)) return 70;

  // Check if all characters appear in order
  let qIdx = 0;
  let score = 0;
  for (let i = 0; i < t.length && qIdx < q.length; i++) {
    if (t[i] === q[qIdx]) {
      score += 10;
      qIdx++;
    }
  }

  return qIdx === q.length ? score : 0;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({ open, onClose }) => {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Define all available commands
  const allCommands: CommandItem[] = useMemo(() => {
    const nav = (path: string) => () => {
      navigate(path);
      onClose();
    };

    return [
      // Navigation
      { id: 'dashboard', title: 'Dashboard', description: 'Go to main dashboard', icon: <DashboardIcon />, action: nav('/'), category: 'navigation', keywords: ['home', 'main'] },
      { id: 'portfolio', title: 'Portfolio Dashboard', description: 'View portfolio metrics', icon: <DashboardIcon color="success" />, action: nav('/portfolio'), category: 'navigation', keywords: ['analytics', 'metrics'] },
      { id: 'projects', title: 'Projects', description: 'View all projects', icon: <FolderIcon />, action: nav('/projects'), category: 'navigation', keywords: ['folders'] },
      { id: 'boms', title: 'BOMs', description: 'View all Bills of Materials', icon: <ListAltIcon />, action: nav('/boms'), category: 'navigation', keywords: ['bill of materials', 'parts'] },
      { id: 'components-search', title: 'Search Components', description: 'Search component catalog', icon: <SearchOutlinedIcon />, action: nav('/components/search'), category: 'navigation', keywords: ['find', 'lookup', 'parts'] },
      { id: 'components-vault', title: 'My Components', description: 'View saved components', icon: <MemoryIcon />, action: nav('/components/vault'), category: 'navigation', keywords: ['saved', 'library'] },
      { id: 'alerts', title: 'Alert Center', description: 'View notifications and alerts', icon: <NotificationsIcon />, action: nav('/alerts'), category: 'navigation', keywords: ['notifications', 'warnings'] },
      { id: 'inbox', title: 'Inbox', description: 'View all notifications', icon: <NotificationsIcon color="primary" />, action: nav('/inbox'), category: 'navigation', keywords: ['notifications', 'messages', 'unread'] },
      { id: 'risk', title: 'Risk Dashboard', description: 'Component risk analysis', icon: <SecurityIcon />, action: nav('/risk'), category: 'navigation', keywords: ['security', 'analysis'] },

      // Actions
      { id: 'upload-bom', title: 'Upload BOM', description: 'Upload a new Bill of Materials', icon: <UploadFileIcon color="primary" />, action: nav('/bom/upload'), category: 'actions', keywords: ['import', 'new', 'add'] },
      { id: 'enrichment', title: 'Enrichment Queue', description: 'View BOM enrichment status', icon: <AutoFixHighIcon />, action: nav('/bom/enrichment'), category: 'actions', keywords: ['process', 'status'] },
      { id: 'recent-uploads', title: 'Recent Uploads', description: 'View recent BOM uploads', icon: <HistoryIcon />, action: nav('/bom_uploads'), category: 'actions', keywords: ['history', 'past'] },

      // Settings
      { id: 'account', title: 'Account Settings', description: 'Manage your account', icon: <PersonIcon />, action: nav('/account/settings'), category: 'settings', keywords: ['profile', 'user'] },
      { id: 'organization', title: 'Organization', description: 'Organization settings', icon: <BusinessIcon />, action: nav('/organizations'), category: 'settings', keywords: ['company', 'team'] },
      { id: 'billing', title: 'Billing', description: 'Manage billing and subscription', icon: <PaymentIcon />, action: nav('/billing'), category: 'settings', keywords: ['payment', 'subscription', 'invoice'] },
      { id: 'alert-prefs', title: 'Alert Preferences', description: 'Configure notification settings', icon: <NotificationsIcon />, action: nav('/alerts/preferences'), category: 'settings', keywords: ['notifications', 'configure'] },
      { id: 'admin', title: 'Admin Console', description: 'System administration', icon: <AdminPanelSettingsIcon />, action: nav('/admin/console'), category: 'settings', keywords: ['admin', 'system'] },
      { id: 'users', title: 'Users', description: 'Manage system users', icon: <PeopleIcon />, action: nav('/users'), category: 'settings', keywords: ['team', 'members'] },
    ];
  }, [navigate, onClose]);

  // Filter and sort commands based on query
  const filteredCommands = useMemo(() => {
    if (!query.trim()) {
      // Show all commands grouped by category when no query
      return allCommands;
    }

    // Score and filter commands
    const scored = allCommands
      .map(cmd => {
        const titleScore = fuzzyMatch(query, cmd.title);
        const descScore = cmd.description ? fuzzyMatch(query, cmd.description) * 0.5 : 0;
        const keywordScore = cmd.keywords
          ? Math.max(...cmd.keywords.map(k => fuzzyMatch(query, k))) * 0.7
          : 0;
        return {
          ...cmd,
          score: Math.max(titleScore, descScore, keywordScore),
        };
      })
      .filter(cmd => cmd.score > 0)
      .sort((a, b) => b.score - a.score);

    return scored;
  }, [query, allCommands]);

  // Group commands by category for display
  const groupedCommands = useMemo(() => {
    const groups: Record<string, CommandItem[]> = {
      navigation: [],
      actions: [],
      settings: [],
      recent: [],
    };

    filteredCommands.forEach(cmd => {
      groups[cmd.category].push(cmd);
    });

    return groups;
  }, [filteredCommands]);

  // Reset selection when query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Focus input when dialog opens
  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [open]);

  // Scroll selected item into view
  useEffect(() => {
    const selectedElement = listRef.current?.querySelector(`[data-index="${selectedIndex}"]`);
    if (selectedElement && typeof selectedElement.scrollIntoView === 'function') {
      selectedElement.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    const totalItems = filteredCommands.length;

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        setSelectedIndex(prev => (prev + 1) % totalItems);
        break;
      case 'ArrowUp':
        event.preventDefault();
        setSelectedIndex(prev => (prev - 1 + totalItems) % totalItems);
        break;
      case 'Enter':
        event.preventDefault();
        if (filteredCommands[selectedIndex]) {
          filteredCommands[selectedIndex].action();
        }
        break;
      case 'Escape':
        event.preventDefault();
        onClose();
        break;
    }
  }, [filteredCommands, selectedIndex, onClose]);

  const categoryLabels: Record<string, string> = {
    navigation: 'Navigation',
    actions: 'Actions',
    settings: 'Settings',
    recent: 'Recent',
  };

  // Render command items with category headers
  const renderCommands = () => {
    if (filteredCommands.length === 0) {
      return (
        <Box sx={{ p: 4, textAlign: 'center' }}>
          <Typography color="text.secondary">
            No results found for "{query}"
          </Typography>
        </Box>
      );
    }

    let globalIndex = 0;
    const elements: React.ReactNode[] = [];

    ['navigation', 'actions', 'settings'].forEach((category, catIdx) => {
      const items = groupedCommands[category];
      if (items.length === 0) return;

      if (catIdx > 0 && elements.length > 0) {
        elements.push(<Divider key={`divider-${category}`} sx={{ my: 1 }} />);
      }

      elements.push(
        <Typography
          key={`header-${category}`}
          variant="caption"
          sx={{ px: 2, py: 1, display: 'block', color: 'text.secondary', fontWeight: 600 }}
        >
          {categoryLabels[category]}
        </Typography>
      );

      items.forEach(cmd => {
        const isSelected = globalIndex === selectedIndex;
        const currentIndex = globalIndex;
        globalIndex++;

        elements.push(
          <ListItem key={cmd.id} disablePadding data-index={currentIndex}>
            <ListItemButton
              selected={isSelected}
              onClick={() => cmd.action()}
              sx={{
                py: 1.5,
                px: 2,
                '&.Mui-selected': {
                  bgcolor: 'primary.50',
                  '&:hover': { bgcolor: 'primary.100' },
                },
              }}
            >
              <ListItemIcon sx={{ minWidth: 40 }}>
                {cmd.icon}
              </ListItemIcon>
              <ListItemText
                primary={cmd.title}
                secondary={cmd.description}
                primaryTypographyProps={{ fontWeight: isSelected ? 600 : 400 }}
              />
              {isSelected && (
                <Chip
                  icon={<KeyboardReturnIcon sx={{ fontSize: 14 }} />}
                  label="Enter"
                  size="small"
                  sx={{ height: 24, '& .MuiChip-label': { px: 1 } }}
                />
              )}
            </ListItemButton>
          </ListItem>
        );
      });
    });

    return elements;
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          position: 'fixed',
          top: '15%',
          m: 0,
          maxHeight: '70vh',
          borderRadius: 2,
        },
      }}
      aria-labelledby="command-palette-title"
    >
      <Box sx={{ p: 0 }}>
        {/* Search Input */}
        <TextField
          inputRef={inputRef}
          fullWidth
          placeholder="Search commands..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          autoComplete="off"
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon color="action" />
              </InputAdornment>
            ),
            endAdornment: (
              <InputAdornment position="end">
                <Chip
                  label="ESC"
                  size="small"
                  sx={{
                    height: 22,
                    fontSize: 11,
                    bgcolor: 'action.hover',
                    '& .MuiChip-label': { px: 1 },
                  }}
                />
              </InputAdornment>
            ),
            sx: {
              '& fieldset': { border: 'none' },
              bgcolor: 'background.paper',
              fontSize: '1.1rem',
            },
          }}
          sx={{
            '& .MuiInputBase-root': {
              py: 1.5,
              px: 2,
              borderBottom: '1px solid',
              borderColor: 'divider',
            },
          }}
          aria-label="Search commands"
          id="command-palette-search"
        />

        {/* Command List */}
        <List
          ref={listRef}
          sx={{
            maxHeight: 'calc(70vh - 70px)',
            overflow: 'auto',
            py: 1,
          }}
          role="listbox"
          aria-labelledby="command-palette-title"
        >
          {renderCommands()}
        </List>

        {/* Footer */}
        <Box
          sx={{
            px: 2,
            py: 1.5,
            borderTop: '1px solid',
            borderColor: 'divider',
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            bgcolor: 'grey.50',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Chip label="↑↓" size="small" sx={{ height: 20, fontSize: 10 }} />
            <Typography variant="caption" color="text.secondary">Navigate</Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Chip label="↵" size="small" sx={{ height: 20, fontSize: 10 }} />
            <Typography variant="caption" color="text.secondary">Select</Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Chip label="ESC" size="small" sx={{ height: 20, fontSize: 10 }} />
            <Typography variant="caption" color="text.secondary">Close</Typography>
          </Box>
        </Box>
      </Box>
    </Dialog>
  );
};

/**
 * Hook to manage command palette state with Cmd/Ctrl+K shortcut
 */
export const useCommandPalette = () => {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Cmd+K (Mac) or Ctrl+K (Windows/Linux)
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        event.preventDefault();
        setOpen(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return {
    open,
    setOpen,
    onClose: () => setOpen(false),
  };
};

export default CommandPalette;
