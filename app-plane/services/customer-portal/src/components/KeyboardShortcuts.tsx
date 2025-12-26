/**
 * Keyboard Shortcuts Component
 *
 * Provides global keyboard shortcuts for quick navigation:
 * - d/h = Dashboard
 * - u = Upload BOM
 * - p = Projects
 * - c = Components
 * - a = Alerts
 * - b = BOMs
 * - ? = Show shortcuts help
 * - Cmd/Ctrl+K = Quick navigation (future)
 */

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  Box,
  Typography,
  Chip,
  Divider,
  IconButton,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import KeyboardIcon from '@mui/icons-material/Keyboard';

interface Shortcut {
  key: string;
  description: string;
  action: () => void;
  category: string;
}

export const KeyboardShortcuts: React.FC = () => {
  const navigate = useNavigate();
  const [helpOpen, setHelpOpen] = useState(false);

  const shortcuts: Shortcut[] = [
    // Navigation
    { key: 'd', description: 'Go to Dashboard', action: () => navigate('/'), category: 'Navigation' },
    { key: 'h', description: 'Go to Dashboard (Home)', action: () => navigate('/'), category: 'Navigation' },
    { key: 'p', description: 'Go to Projects', action: () => navigate('/projects'), category: 'Navigation' },
    { key: 'b', description: 'Go to BOMs', action: () => navigate('/boms'), category: 'Navigation' },
    { key: 'c', description: 'Go to Components', action: () => navigate('/components'), category: 'Navigation' },
    { key: 'a', description: 'Go to Alerts', action: () => navigate('/alerts'), category: 'Navigation' },

    // Actions
    { key: 'u', description: 'Upload BOM', action: () => navigate('/bom/upload'), category: 'Actions' },

    // Help
    { key: '?', description: 'Show keyboard shortcuts', action: () => setHelpOpen(true), category: 'Help' },
  ];

  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      // Ignore if user is typing in an input, textarea, or contenteditable
      const target = event.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      // Ignore if modifier keys are pressed (except for Shift for '?')
      if (event.ctrlKey || event.metaKey || event.altKey) {
        return;
      }

      const key = event.key.toLowerCase();
      const shortcut = shortcuts.find(s => s.key === key);

      if (shortcut) {
        event.preventDefault();
        shortcut.action();
      }
    };

    window.addEventListener('keydown', handleKeyPress);

    return () => {
      window.removeEventListener('keydown', handleKeyPress);
    };
  }, [navigate]);

  const groupedShortcuts = shortcuts.reduce((acc, shortcut) => {
    if (!acc[shortcut.category]) {
      acc[shortcut.category] = [];
    }
    acc[shortcut.category].push(shortcut);
    return acc;
  }, {} as Record<string, Shortcut[]>);

  return (
    <Dialog
      open={helpOpen}
      onClose={() => setHelpOpen(false)}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <KeyboardIcon />
            <Typography variant="h6">Keyboard Shortcuts</Typography>
          </Box>
          <IconButton onClick={() => setHelpOpen(false)} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          Use these keyboard shortcuts for quick navigation
        </Typography>

        {Object.entries(groupedShortcuts).map(([category, categoryShortcuts], index) => (
          <Box key={category} sx={{ mt: 2 }}>
            {index > 0 && <Divider sx={{ my: 2 }} />}
            <Typography variant="subtitle2" fontWeight={600} gutterBottom>
              {category}
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {categoryShortcuts.map((shortcut) => (
                <Box
                  key={shortcut.key}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    py: 0.5,
                  }}
                >
                  <Typography variant="body2" color="text.secondary">
                    {shortcut.description}
                  </Typography>
                  <Chip
                    label={shortcut.key.toUpperCase()}
                    size="small"
                    sx={{
                      fontFamily: 'monospace',
                      fontWeight: 700,
                      minWidth: 32,
                      bgcolor: 'action.hover',
                      color: 'text.primary',
                    }}
                  />
                </Box>
              ))}
            </Box>
          </Box>
        ))}

        <Box sx={{ mt: 3, p: 2, bgcolor: 'info.50', borderRadius: 1 }}>
          <Typography variant="caption" color="text.secondary">
            💡 Tip: Shortcuts work from anywhere in the app (except when typing in input fields)
          </Typography>
        </Box>
      </DialogContent>
    </Dialog>
  );
};
