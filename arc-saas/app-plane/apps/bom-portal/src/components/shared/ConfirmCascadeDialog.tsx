/**
 * ConfirmCascadeDialog
 *
 * Dialog for confirming destructive actions with dependency preview.
 * Shows cascading data that will be affected before deletion.
 *
 * Features:
 * - Dependency counts from API
 * - Preview of affected resources
 * - Type-to-confirm for critical actions
 * - Warning levels (warning, error)
 */

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Alert,
  TextField,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Chip,
  CircularProgress,
  Divider,
  Collapse,
  IconButton,
} from '@mui/material';
import WarningIcon from '@mui/icons-material/Warning';
import ErrorIcon from '@mui/icons-material/Error';
import DeleteIcon from '@mui/icons-material/Delete';
import FolderIcon from '@mui/icons-material/Folder';
import DescriptionIcon from '@mui/icons-material/Description';
import PeopleIcon from '@mui/icons-material/People';
import NotificationsIcon from '@mui/icons-material/Notifications';
import MemoryIcon from '@mui/icons-material/Memory';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';

export interface CascadeDependency {
  type: 'project' | 'bom' | 'component' | 'alert' | 'member' | 'custom';
  count: number;
  label: string;
  items?: { id: string; name: string }[];
}

export interface ConfirmCascadeDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  title: string;
  message: string;
  targetName: string;
  targetType: string;
  dependencies?: CascadeDependency[];
  loadDependencies?: () => Promise<CascadeDependency[]>;
  severity?: 'warning' | 'error';
  requireTypedConfirmation?: boolean;
  confirmButtonText?: string;
}

const TYPE_ICONS: Record<CascadeDependency['type'], React.ReactNode> = {
  project: <FolderIcon />,
  bom: <DescriptionIcon />,
  component: <MemoryIcon />,
  alert: <NotificationsIcon />,
  member: <PeopleIcon />,
  custom: <WarningIcon />,
};

export function ConfirmCascadeDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  targetName,
  targetType,
  dependencies: providedDependencies,
  loadDependencies,
  severity = 'warning',
  requireTypedConfirmation = false,
  confirmButtonText = 'Delete',
}: ConfirmCascadeDialogProps) {
  const [dependencies, setDependencies] = useState<CascadeDependency[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [typedConfirmation, setTypedConfirmation] = useState('');
  const [expandedTypes, setExpandedTypes] = useState<Set<string>>(new Set());

  // Load dependencies when dialog opens
  useEffect(() => {
    if (open) {
      setTypedConfirmation('');
      setExpandedTypes(new Set());

      if (providedDependencies) {
        setDependencies(providedDependencies);
      } else if (loadDependencies) {
        setLoading(true);
        setLoadError(null);
        loadDependencies()
          .then(setDependencies)
          .catch((err) => {
            setLoadError(err.message || 'Failed to load dependencies');
            setDependencies([]);
          })
          .finally(() => setLoading(false));
      }
    }
  }, [open, providedDependencies, loadDependencies]);

  const handleConfirm = async () => {
    setConfirming(true);
    try {
      await onConfirm();
      onClose();
    } catch (err) {
      console.error('Confirm action failed:', err);
    } finally {
      setConfirming(false);
    }
  };

  const handleToggleExpand = (type: string) => {
    setExpandedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  };

  const totalAffected = dependencies.reduce((sum, dep) => sum + dep.count, 0);
  const isConfirmDisabled =
    requireTypedConfirmation && typedConfirmation !== targetName;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        {severity === 'error' ? (
          <ErrorIcon color="error" />
        ) : (
          <WarningIcon color="warning" />
        )}
        <Typography variant="h6" component="span">
          {title}
        </Typography>
      </DialogTitle>

      <DialogContent>
        {/* Main Warning Message */}
        <Alert severity={severity} sx={{ mb: 2 }}>
          {message}
        </Alert>

        {/* Target Information */}
        <Box
          sx={{
            p: 2,
            bgcolor: 'action.hover',
            borderRadius: 1,
            mb: 2,
            display: 'flex',
            alignItems: 'center',
            gap: 2,
          }}
        >
          <DeleteIcon color="action" />
          <Box>
            <Typography variant="body2" color="text.secondary">
              {targetType}
            </Typography>
            <Typography variant="subtitle1" fontWeight={600}>
              {targetName}
            </Typography>
          </Box>
        </Box>

        {/* Loading State */}
        {loading && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 2 }}>
            <CircularProgress size={20} />
            <Typography variant="body2" color="text.secondary">
              Loading affected resources...
            </Typography>
          </Box>
        )}

        {/* Load Error */}
        {loadError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {loadError}
          </Alert>
        )}

        {/* Dependencies List */}
        {!loading && dependencies.length > 0 && (
          <Box sx={{ mb: 2 }}>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                mb: 1,
              }}
            >
              <Typography variant="subtitle2" color="text.secondary">
                This action will also affect:
              </Typography>
              <Chip
                label={`${totalAffected} resources`}
                size="small"
                color={severity}
              />
            </Box>

            <List dense disablePadding>
              {dependencies.map((dep) => (
                <Box key={dep.type}>
                  <ListItem
                    sx={{
                      bgcolor: 'background.paper',
                      borderRadius: 1,
                      mb: 0.5,
                    }}
                    secondaryAction={
                      dep.items &&
                      dep.items.length > 0 && (
                        <IconButton
                          size="small"
                          onClick={() => handleToggleExpand(dep.type)}
                        >
                          {expandedTypes.has(dep.type) ? (
                            <ExpandLessIcon />
                          ) : (
                            <ExpandMoreIcon />
                          )}
                        </IconButton>
                      )
                    }
                  >
                    <ListItemIcon sx={{ minWidth: 36 }}>
                      {TYPE_ICONS[dep.type]}
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Box
                          sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
                        >
                          <Typography variant="body2">{dep.label}</Typography>
                          <Chip
                            label={dep.count}
                            size="small"
                            color={dep.count > 0 ? 'error' : 'default'}
                            sx={{ height: 20 }}
                          />
                        </Box>
                      }
                    />
                  </ListItem>

                  {/* Expandable Items Preview */}
                  {dep.items && (
                    <Collapse in={expandedTypes.has(dep.type)}>
                      <Box
                        sx={{
                          pl: 6,
                          pr: 2,
                          py: 1,
                          bgcolor: 'background.paper',
                          borderRadius: 1,
                          mb: 0.5,
                        }}
                      >
                        {dep.items.slice(0, 5).map((item) => (
                          <Typography
                            key={item.id}
                            variant="caption"
                            color="text.secondary"
                            sx={{ display: 'block' }}
                          >
                            • {item.name}
                          </Typography>
                        ))}
                        {dep.items.length > 5 && (
                          <Typography variant="caption" color="text.disabled">
                            ... and {dep.items.length - 5} more
                          </Typography>
                        )}
                      </Box>
                    </Collapse>
                  )}
                </Box>
              ))}
            </List>
          </Box>
        )}

        {/* No Dependencies */}
        {!loading && dependencies.length === 0 && !loadError && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            No dependent resources will be affected.
          </Typography>
        )}

        <Divider sx={{ my: 2 }} />

        {/* Type to Confirm */}
        {requireTypedConfirmation && (
          <Box>
            <Typography variant="body2" gutterBottom>
              Type <strong>{targetName}</strong> to confirm:
            </Typography>
            <TextField
              fullWidth
              size="small"
              value={typedConfirmation}
              onChange={(e) => setTypedConfirmation(e.target.value)}
              placeholder={targetName}
              error={
                typedConfirmation.length > 0 &&
                typedConfirmation !== targetName
              }
              helperText={
                typedConfirmation.length > 0 &&
                typedConfirmation !== targetName
                  ? 'Text does not match'
                  : undefined
              }
            />
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={confirming}>
          Cancel
        </Button>
        <Button
          variant="contained"
          color="error"
          onClick={handleConfirm}
          disabled={confirming || loading || isConfirmDisabled}
          startIcon={
            confirming ? <CircularProgress size={16} color="inherit" /> : <DeleteIcon />
          }
        >
          {confirming ? 'Deleting...' : confirmButtonText}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default ConfirmCascadeDialog;
