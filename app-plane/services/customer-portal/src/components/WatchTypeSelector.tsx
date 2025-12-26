/**
 * Watch Type Selector Component
 *
 * Popover content for selecting which alert types to watch for a component.
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Checkbox,
  FormControlLabel,
  Button,
  Divider,
  Stack,
  FormGroup,
  Chip,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  History as LifecycleIcon,
  TrendingUp as RiskIcon,
  AttachMoney as PriceIcon,
  Inventory as AvailabilityIcon,
  Gavel as ComplianceIcon,
  Article as PcnIcon,
  LocalShipping as SupplyChainIcon,
  Close as CloseIcon,
  CheckCircle as CheckIcon,
} from '@mui/icons-material';
import { WatchType } from '../hooks/useComponentWatch';

export interface WatchTypeSelectorProps {
  /** Component ID being watched */
  componentId: string;
  /** MPN for display */
  mpn?: string;
  /** Manufacturer for display */
  manufacturer?: string;
  /** Initial watch types (for editing existing watch) */
  initialWatchTypes?: WatchType[];
  /** Callback when save is clicked */
  onSave: (watchTypes: WatchType[]) => Promise<void> | void;
  /** Callback when remove is clicked (only shown if editing) */
  onRemove?: () => Promise<void> | void;
  /** Callback when cancel is clicked */
  onCancel: () => void;
}

interface WatchTypeOption {
  type: WatchType;
  label: string;
  description: string;
  icon: React.ReactNode;
}

const WATCH_TYPE_OPTIONS: WatchTypeOption[] = [
  {
    type: 'lifecycle',
    label: 'Lifecycle Changes',
    description: 'EOL, NRND, or other lifecycle status changes',
    icon: <LifecycleIcon sx={{ fontSize: 20 }} />,
  },
  {
    type: 'risk',
    label: 'Risk Score',
    description: 'Risk score exceeds threshold',
    icon: <RiskIcon sx={{ fontSize: 20 }} />,
  },
  {
    type: 'price',
    label: 'Price Changes',
    description: 'Significant price changes',
    icon: <PriceIcon sx={{ fontSize: 20 }} />,
  },
  {
    type: 'availability',
    label: 'Stock Availability',
    description: 'Stock level changes or shortages',
    icon: <AvailabilityIcon sx={{ fontSize: 20 }} />,
  },
  {
    type: 'compliance',
    label: 'Compliance Updates',
    description: 'RoHS, REACH, or regulatory changes',
    icon: <ComplianceIcon sx={{ fontSize: 20 }} />,
  },
  {
    type: 'pcn',
    label: 'PCN/PDN Notifications',
    description: 'Product Change or Discontinuation Notices',
    icon: <PcnIcon sx={{ fontSize: 20 }} />,
  },
  {
    type: 'supply_chain',
    label: 'Supply Chain',
    description: 'Supply chain disruptions or alerts',
    icon: <SupplyChainIcon sx={{ fontSize: 20 }} />,
  },
];

export const WatchTypeSelector: React.FC<WatchTypeSelectorProps> = ({
  componentId,
  mpn,
  manufacturer,
  initialWatchTypes = [],
  onSave,
  onRemove,
  onCancel,
}) => {
  const [selectedTypes, setSelectedTypes] = useState<Set<WatchType>>(
    new Set(initialWatchTypes)
  );
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);

  // Update selected types when initial types change
  useEffect(() => {
    setSelectedTypes(new Set(initialWatchTypes));
  }, [initialWatchTypes]);

  const handleToggle = (type: WatchType) => {
    setSelectedTypes(prev => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    setSelectedTypes(new Set(WATCH_TYPE_OPTIONS.map(opt => opt.type)));
  };

  const handleSelectNone = () => {
    setSelectedTypes(new Set());
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(Array.from(selectedTypes));
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async () => {
    if (onRemove) {
      setRemoving(true);
      try {
        await onRemove();
      } finally {
        setRemoving(false);
      }
    }
  };

  const allSelected = selectedTypes.size === WATCH_TYPE_OPTIONS.length;
  const noneSelected = selectedTypes.size === 0;
  const isEditing = initialWatchTypes.length > 0;

  return (
    <Box sx={{ p: 2, minWidth: 380, maxWidth: 420 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h6" sx={{ fontSize: 16, fontWeight: 600 }}>
            {isEditing ? 'Edit Watch Settings' : 'Watch Component'}
          </Typography>
          {(mpn || manufacturer) && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {mpn && <strong>{mpn}</strong>}
              {mpn && manufacturer && ' • '}
              {manufacturer}
            </Typography>
          )}
        </Box>
        <IconButton onClick={onCancel} size="small">
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>

      <Divider sx={{ mb: 2 }} />

      {/* Instructions */}
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Select the types of alerts you want to receive for this component:
      </Typography>

      {/* Quick Actions */}
      <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
        <Button
          size="small"
          variant={allSelected ? 'contained' : 'outlined'}
          onClick={handleSelectAll}
          disabled={allSelected}
        >
          Select All
        </Button>
        <Button
          size="small"
          variant="outlined"
          onClick={handleSelectNone}
          disabled={noneSelected}
        >
          Clear All
        </Button>
        {selectedTypes.size > 0 && (
          <Chip
            label={`${selectedTypes.size} selected`}
            size="small"
            color="primary"
            variant="outlined"
          />
        )}
      </Stack>

      {/* Watch Type Checkboxes */}
      <FormGroup sx={{ mb: 2 }}>
        {WATCH_TYPE_OPTIONS.map((option) => {
          const isChecked = selectedTypes.has(option.type);
          return (
            <FormControlLabel
              key={option.type}
              control={
                <Checkbox
                  checked={isChecked}
                  onChange={() => handleToggle(option.type)}
                  icon={option.icon}
                  checkedIcon={<CheckIcon color="primary" />}
                />
              }
              label={
                <Box sx={{ ml: 1 }}>
                  <Typography variant="body2" sx={{ fontWeight: isChecked ? 600 : 400 }}>
                    {option.label}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {option.description}
                  </Typography>
                </Box>
              }
              sx={{
                alignItems: 'flex-start',
                py: 0.75,
                px: 1,
                mx: -1,
                borderRadius: 1,
                '&:hover': {
                  bgcolor: 'action.hover',
                },
                transition: 'background-color 0.2s',
              }}
            />
          );
        })}
      </FormGroup>

      <Divider sx={{ mb: 2 }} />

      {/* Actions */}
      <Stack direction="row" spacing={1} justifyContent="flex-end">
        {isEditing && onRemove && (
          <Button
            onClick={handleRemove}
            disabled={saving || removing}
            color="error"
            variant="outlined"
            size="small"
          >
            {removing ? 'Removing...' : 'Remove Watch'}
          </Button>
        )}
        <Box sx={{ flex: 1 }} />
        <Button onClick={onCancel} disabled={saving || removing} size="small">
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          disabled={noneSelected || saving || removing}
          variant="contained"
          color="primary"
          size="small"
        >
          {saving ? 'Saving...' : isEditing ? 'Update' : 'Watch'}
        </Button>
      </Stack>

      {/* Warning if no types selected */}
      {noneSelected && (
        <Typography variant="caption" color="error" sx={{ display: 'block', mt: 1, textAlign: 'center' }}>
          Please select at least one alert type
        </Typography>
      )}
    </Box>
  );
};
