/**
 * AlertFilters Component
 *
 * Filter toolbar for Alert Center with tabs and dropdowns.
 * Handles tab selection, severity filter, and alert type filter.
 */

import React from 'react';
import {
  Box,
  Tabs,
  Tab,
  Badge,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import type { AlertType, AlertSeverity } from '../../services/alertService';

interface AlertFiltersProps {
  tabValue: number;
  onTabChange: (newValue: number) => void;
  filterSeverity: AlertSeverity | '';
  onSeverityChange: (value: AlertSeverity | '') => void;
  filterType: AlertType | '';
  onTypeChange: (value: AlertType | '') => void;
  totalCount: number;
  unreadCount: number;
}

// Alert type options for dropdown
const ALERT_TYPE_OPTIONS: { value: AlertType | ''; label: string }[] = [
  { value: '', label: 'All Types' },
  { value: 'LIFECYCLE', label: 'Lifecycle' },
  { value: 'RISK', label: 'Risk Score' },
  { value: 'PRICE', label: 'Price' },
  { value: 'AVAILABILITY', label: 'Availability' },
  { value: 'COMPLIANCE', label: 'Compliance' },
  { value: 'PCN', label: 'PCN/PDN' },
  { value: 'SUPPLY_CHAIN', label: 'Supply Chain' },
];

// Severity options for dropdown
const SEVERITY_OPTIONS: { value: AlertSeverity | ''; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'info', label: 'Info' },
  { value: 'warning', label: 'Warning' },
  { value: 'critical', label: 'Critical' },
];

export function AlertFilters({
  tabValue,
  onTabChange,
  filterSeverity,
  onSeverityChange,
  filterType,
  onTypeChange,
  totalCount,
  unreadCount,
}: AlertFiltersProps) {
  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    onTabChange(newValue);
  };

  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
      {/* Tabs */}
      <Tabs value={tabValue} onChange={handleTabChange}>
        <Tab
          label={
            <Badge badgeContent={totalCount} color="primary" max={99}>
              All
            </Badge>
          }
        />
        <Tab
          label={
            <Badge badgeContent={unreadCount} color="warning" max={99}>
              Unread
            </Badge>
          }
        />
        <Tab label="Read" />
      </Tabs>

      {/* Filter Dropdowns */}
      <Box sx={{ display: 'flex', gap: 2 }}>
        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel>Severity</InputLabel>
          <Select
            value={filterSeverity}
            label="Severity"
            onChange={(e) => onSeverityChange(e.target.value as AlertSeverity | '')}
          >
            {SEVERITY_OPTIONS.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel>Type</InputLabel>
          <Select
            value={filterType}
            label="Type"
            onChange={(e) => onTypeChange(e.target.value as AlertType | '')}
          >
            {ALERT_TYPE_OPTIONS.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>
    </Box>
  );
}

export default AlertFilters;
