/**
 * SupplierChip - Supplier badge with brand color
 */
import React from 'react';
import { Chip, Tooltip, Box } from '@mui/material';
import type { ChipProps } from '@mui/material/Chip';
import { getSupplierColor } from '../../theme';

export type SupplierName = 'mouser' | 'digikey' | 'element14' | 'octopart' | 'newark' | 'arrow' | 'avnet';

export interface SupplierChipProps {
  supplier: string;
  count?: number;
  showIcon?: boolean;
  size?: ChipProps['size'];
  variant?: ChipProps['variant'];
}

// Supplier display names
const supplierDisplayNames: Record<string, string> = {
  mouser: 'Mouser',
  digikey: 'DigiKey',
  'digi-key': 'DigiKey',
  element14: 'Element14',
  farnell: 'Element14',
  octopart: 'Octopart',
  newark: 'Newark',
  arrow: 'Arrow',
  avnet: 'Avnet',
};

function getSupplierDisplayName(supplier: string): string {
  const normalized = supplier.toLowerCase().replace(/[^a-z0-9]/g, '');
  for (const [key, name] of Object.entries(supplierDisplayNames)) {
    if (normalized.includes(key.replace('-', ''))) {
      return name;
    }
  }
  // Capitalize first letter of each word
  return supplier
    .split(/[\s_-]+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

export const SupplierChip: React.FC<SupplierChipProps> = ({
  supplier,
  count,
  size = 'small',
  variant = 'outlined',
}) => {
  const color = getSupplierColor(supplier);
  const displayName = getSupplierDisplayName(supplier);
  const label = count !== undefined ? `${displayName} (${count})` : displayName;

  return (
    <Tooltip title={`Supplier: ${displayName}${count !== undefined ? ` - ${count} components` : ''}`} arrow>
      <Chip
        label={label}
        size={size}
        variant={variant}
        sx={{
          backgroundColor: variant === 'filled' ? color : 'transparent',
          color: variant === 'filled' ? '#fff' : color,
          borderColor: color,
          fontWeight: 600,
        }}
      />
    </Tooltip>
  );
};

// Multi-supplier display component
export interface SupplierChipsProps {
  suppliers: string[];
  max?: number;
  size?: ChipProps['size'];
}

export const SupplierChips: React.FC<SupplierChipsProps> = ({
  suppliers,
  max = 3,
  size = 'small',
}) => {
  const displayed = suppliers.slice(0, max);
  const remaining = suppliers.length - max;

  return (
    <Box display="flex" gap={0.5} flexWrap="wrap" alignItems="center">
      {displayed.map((supplier, index) => (
        <SupplierChip key={index} supplier={supplier} size={size} />
      ))}
      {remaining > 0 && (
        <Tooltip title={suppliers.slice(max).join(', ')} arrow>
          <Chip
            label={`+${remaining}`}
            size={size}
            variant="outlined"
            sx={{ fontWeight: 600 }}
          />
        </Tooltip>
      )}
    </Box>
  );
};

export default SupplierChip;
