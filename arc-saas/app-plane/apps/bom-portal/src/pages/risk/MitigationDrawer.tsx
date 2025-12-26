/**
 * MitigationDrawer Component
 *
 * Drawer for assigning mitigation actions to high-risk components.
 * Allows setting owner, due date, status, and notes.
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Autocomplete,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import PersonIcon from '@mui/icons-material/Person';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import { NextActionDrawer } from '../../components/shared';
import type { ComponentRiskScore } from '../../services/riskService';

// Mitigation status options
const MITIGATION_STATUS = [
  { value: 'pending', label: 'Pending', color: '#9E9E9E' },
  { value: 'in_progress', label: 'In Progress', color: '#2196F3' },
  { value: 'awaiting_approval', label: 'Awaiting Approval', color: '#FF9800' },
  { value: 'completed', label: 'Completed', color: '#4CAF50' },
  { value: 'deferred', label: 'Deferred', color: '#795548' },
];

// Priority options
const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low', color: '#4CAF50' },
  { value: 'medium', label: 'Medium', color: '#FF9800' },
  { value: 'high', label: 'High', color: '#f44336' },
  { value: 'critical', label: 'Critical', color: '#9C27B0' },
];

// Mock team members (in real app, fetch from API)
const TEAM_MEMBERS = [
  { id: '1', name: 'Alice Engineer', email: 'alice@company.com', role: 'engineer' },
  { id: '2', name: 'Bob Manager', email: 'bob@company.com', role: 'manager' },
  { id: '3', name: 'Carol Analyst', email: 'carol@company.com', role: 'analyst' },
  { id: '4', name: 'David Designer', email: 'david@company.com', role: 'designer' },
];

export interface MitigationFormData {
  componentId: string;
  assignee: typeof TEAM_MEMBERS[0] | null;
  dueDate: Date | null;
  status: string;
  priority: string;
  notes: string;
  tags: string[];
}

interface MitigationDrawerProps {
  open: boolean;
  onClose: () => void;
  component: ComponentRiskScore | null;
  onSave: (data: MitigationFormData) => Promise<void>;
}

export function MitigationDrawer({
  open,
  onClose,
  component,
  onSave,
}: MitigationDrawerProps) {
  const [formData, setFormData] = useState<MitigationFormData>({
    componentId: '',
    assignee: null,
    dueDate: null,
    status: 'pending',
    priority: 'medium',
    notes: '',
    tags: [],
  });
  const [saving, setSaving] = useState(false);
  const [tagInput, setTagInput] = useState('');

  // Reset form when component changes
  useEffect(() => {
    if (component) {
      setFormData({
        componentId: component.component_id,
        assignee: null,
        dueDate: null,
        status: 'pending',
        priority: component.risk_level === 'critical' ? 'critical' : component.risk_level === 'high' ? 'high' : 'medium',
        notes: '',
        tags: [],
      });
    }
  }, [component]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(formData);
      onClose();
    } catch (error) {
      console.error('Failed to save mitigation:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleAddTag = () => {
    if (tagInput.trim() && !formData.tags.includes(tagInput.trim())) {
      setFormData({
        ...formData,
        tags: [...formData.tags, tagInput.trim()],
      });
      setTagInput('');
    }
  };

  const handleRemoveTag = (tag: string) => {
    setFormData({
      ...formData,
      tags: formData.tags.filter(t => t !== tag),
    });
  };

  if (!component) return null;

  return (
    <NextActionDrawer
      open={open}
      onClose={onClose}
      title="Assign Mitigation"
      subtitle={`${component.mpn || 'Component'} - ${component.manufacturer || 'Unknown'}`}
      primaryAction={{
        label: saving ? 'Saving...' : 'Save Mitigation',
        onClick: handleSave,
        disabled: saving || !formData.assignee,
      }}
      secondaryAction={{
        label: 'Cancel',
        onClick: onClose,
      }}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {/* Component Info Summary */}
        <Box sx={{ p: 2, bgcolor: 'background.paper', borderRadius: 1 }}>
          <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
            <Chip
              label={component.risk_level.toUpperCase()}
              size="small"
              color={
                component.risk_level === 'critical' ? 'secondary' :
                component.risk_level === 'high' ? 'error' :
                component.risk_level === 'medium' ? 'warning' : 'success'
              }
            />
            <Chip
              label={`Score: ${component.total_risk_score}`}
              size="small"
              variant="outlined"
            />
          </Box>
          <Box sx={{ display: 'flex', gap: 2, fontSize: '0.875rem', color: 'text.secondary' }}>
            <span>L: {component.lifecycle_risk}</span>
            <span>S: {component.supply_chain_risk}</span>
            <span>C: {component.compliance_risk}</span>
            <span>O: {component.obsolescence_risk}</span>
            <span>SS: {component.single_source_risk}</span>
          </Box>
        </Box>

        {/* Assignee */}
        <Autocomplete
          options={TEAM_MEMBERS}
          getOptionLabel={(option) => option.name}
          value={formData.assignee}
          onChange={(_, newValue) => setFormData({ ...formData, assignee: newValue })}
          renderOption={(props, option) => (
            <li {...props}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <PersonIcon fontSize="small" color="action" />
                <Box>
                  <Box>{option.name}</Box>
                  <Box sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>{option.email}</Box>
                </Box>
              </Box>
            </li>
          )}
          renderInput={(params) => (
            <TextField
              {...params}
              label="Assign To"
              required
              placeholder="Select team member"
            />
          )}
        />

        {/* Due Date */}
        <LocalizationProvider dateAdapter={AdapterDateFns}>
          <DatePicker
            label="Due Date"
            value={formData.dueDate}
            onChange={(newValue) => setFormData({ ...formData, dueDate: newValue })}
            slotProps={{
              textField: {
                fullWidth: true,
              },
            }}
          />
        </LocalizationProvider>

        {/* Status */}
        <FormControl fullWidth>
          <InputLabel>Status</InputLabel>
          <Select
            value={formData.status}
            label="Status"
            onChange={(e) => setFormData({ ...formData, status: e.target.value })}
          >
            {MITIGATION_STATUS.map((status) => (
              <MenuItem key={status.value} value={status.value}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box
                    sx={{
                      width: 12,
                      height: 12,
                      borderRadius: '50%',
                      bgcolor: status.color,
                    }}
                  />
                  {status.label}
                </Box>
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* Priority */}
        <FormControl fullWidth>
          <InputLabel>Priority</InputLabel>
          <Select
            value={formData.priority}
            label="Priority"
            onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
          >
            {PRIORITY_OPTIONS.map((priority) => (
              <MenuItem key={priority.value} value={priority.value}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box
                    sx={{
                      width: 12,
                      height: 12,
                      borderRadius: '50%',
                      bgcolor: priority.color,
                    }}
                  />
                  {priority.label}
                </Box>
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* Tags */}
        <Box>
          <TextField
            label="Tags"
            placeholder="Add tag and press Enter"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
            fullWidth
            helperText="Press Enter to add tags"
          />
          {formData.tags.length > 0 && (
            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 1 }}>
              {formData.tags.map((tag) => (
                <Chip
                  key={tag}
                  label={tag}
                  size="small"
                  onDelete={() => handleRemoveTag(tag)}
                />
              ))}
            </Box>
          )}
        </Box>

        {/* Notes */}
        <TextField
          label="Notes"
          multiline
          rows={4}
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          placeholder="Add any additional notes or context..."
          fullWidth
        />
      </Box>
    </NextActionDrawer>
  );
}

export default MitigationDrawer;
