/**
 * ProjectBomFilterPanel Component
 *
 * Filter panel for Customer Portal Component Search that allows filtering
 * components by Project and BOM (Bill of Materials).
 *
 * Hierarchy:
 * - Workspace -> Projects -> BOMs
 * - When a Project is selected, BOMs are filtered to that project
 * - When a BOM is selected, components shown are from that BOM's line items
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Tooltip,
  Typography,
  IconButton,
  Collapse,
  Paper,
  Divider,
} from '@mui/material';
import ClearIcon from '@mui/icons-material/Clear';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import FolderIcon from '@mui/icons-material/Folder';
import ListAltIcon from '@mui/icons-material/ListAlt';
import FilterListIcon from '@mui/icons-material/FilterList';
import AsyncAutocomplete, { Option } from '../../components/AsyncAutocomplete';
import { API_CONFIG, getAuthHeaders } from '../../config/api';

export interface ProjectBomFilterPanelProps {
  /** Current tenant/organization ID for API scoping */
  tenantId: string | null;
  /** Current workspace ID for project scoping */
  workspaceId: string | null;
  /** Selected project ID */
  selectedProjectId: string | null;
  /** Selected BOM ID */
  selectedBomId: string | null;
  /** Callback when project selection changes */
  onProjectChange: (projectId: string | null) => void;
  /** Callback when BOM selection changes */
  onBomChange: (bomId: string | null) => void;
  /** When true, the filter panel is collapsed */
  collapsed?: boolean;
  /** Callback when collapsed state changes */
  onCollapsedChange?: (collapsed: boolean) => void;
}

export default function ProjectBomFilterPanel({
  tenantId,
  workspaceId,
  selectedProjectId,
  selectedBomId,
  onProjectChange,
  onBomChange,
  collapsed: collapsedProp,
  onCollapsedChange,
}: ProjectBomFilterPanelProps) {
  // Local collapsed state (if not controlled)
  const [localCollapsed, setLocalCollapsed] = useState(false);
  const collapsed = collapsedProp ?? localCollapsed;

  // Selected options for display labels
  const [projectOption, setProjectOption] = useState<Option | null>(null);
  const [bomOption, setBomOption] = useState<Option | null>(null);

  // Error states
  const [projectError, setProjectError] = useState<string | null>(null);
  const [bomError, setBomError] = useState<string | null>(null);

  // AbortController refs
  const projectAbortRef = useRef<AbortController | null>(null);
  const bomAbortRef = useRef<AbortController | null>(null);

  // Count active filters
  const activeFilterCount = (selectedProjectId ? 1 : 0) + (selectedBomId ? 1 : 0);

  // Fetch projects scoped to the selected workspace
  const loadProjects = useCallback(
    async (query: string): Promise<Option[]> => {
      if (!tenantId || !workspaceId) return [];

      // Cancel any in-flight request
      if (projectAbortRef.current) {
        projectAbortRef.current.abort();
      }
      projectAbortRef.current = new AbortController();
      const { signal } = projectAbortRef.current;

      setProjectError(null);

      try {
        const url = new URL(`${API_CONFIG.BASE_URL}/projects`, window.location.origin);
        url.searchParams.set('organization_id', tenantId);
        url.searchParams.set('workspace_id', workspaceId);
        if (query) url.searchParams.set('search', query);
        url.searchParams.set('limit', '50');

        const response = await fetch(url.toString(), {
          headers: getAuthHeaders(),
          signal,
        });

        if (signal.aborted) return [];

        if (!response.ok) {
          const errorMsg = `API error: ${response.status} ${response.statusText}`;
          console.error('Failed to fetch projects:', errorMsg);
          setProjectError(errorMsg);
          return [];
        }

        const data = await response.json();

        // Handle various response formats
        let projects: unknown[];
        if (Array.isArray(data)) {
          projects = data;
        } else if (data && typeof data === 'object') {
          const itemsArray = data.items ?? data.data ?? data.projects ?? data.results;
          projects = Array.isArray(itemsArray) ? itemsArray : [];
        } else {
          projects = [];
        }

        return projects
          .filter((p): p is { id: string; name?: string; key?: string } => {
            return p !== null && typeof p === 'object' && 'id' in p;
          })
          .map((p) => ({
            id: p.id,
            label: p.name || p.key || p.id.substring(0, 8),
          }));
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') return [];
        const errorMsg = error instanceof Error ? error.message : 'Network error';
        console.error('Error loading projects:', errorMsg);
        setProjectError(errorMsg);
        return [];
      }
    },
    [tenantId, workspaceId]
  );

  // Fetch BOMs scoped to the selected project
  const loadBoms = useCallback(
    async (query: string): Promise<Option[]> => {
      if (!tenantId || !selectedProjectId) return [];

      // Cancel any in-flight request
      if (bomAbortRef.current) {
        bomAbortRef.current.abort();
      }
      bomAbortRef.current = new AbortController();
      const { signal } = bomAbortRef.current;

      setBomError(null);

      try {
        const url = new URL(`${API_CONFIG.BASE_URL}/boms`, window.location.origin);
        url.searchParams.set('organization_id', tenantId);
        url.searchParams.set('project_id', selectedProjectId);
        if (query) url.searchParams.set('search', query);
        url.searchParams.set('limit', '50');

        const response = await fetch(url.toString(), {
          headers: getAuthHeaders(),
          signal,
        });

        if (signal.aborted) return [];

        if (!response.ok) {
          const errorMsg = `API error: ${response.status} ${response.statusText}`;
          console.error('Failed to fetch BOMs:', errorMsg);
          setBomError(errorMsg);
          return [];
        }

        const data = await response.json();

        // Handle various response formats
        let boms: unknown[];
        if (Array.isArray(data)) {
          boms = data;
        } else if (data && typeof data === 'object') {
          const itemsArray = data.items ?? data.data ?? data.boms ?? data.results;
          boms = Array.isArray(itemsArray) ? itemsArray : [];
        } else {
          boms = [];
        }

        return boms
          .filter((b): b is { id: string; name?: string; version?: string } => {
            return b !== null && typeof b === 'object' && 'id' in b;
          })
          .map((b) => ({
            id: b.id,
            label: b.name
              ? b.version
                ? `${b.name} (v${b.version})`
                : b.name
              : b.id.substring(0, 8),
          }));
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') return [];
        const errorMsg = error instanceof Error ? error.message : 'Network error';
        console.error('Error loading BOMs:', errorMsg);
        setBomError(errorMsg);
        return [];
      }
    },
    [tenantId, selectedProjectId]
  );

  // Handle project selection
  const handleProjectChange = useCallback(
    (opt: Option | null) => {
      setProjectOption(opt);
      onProjectChange(opt?.id ?? null);
      // Clear BOM when project changes
      setBomOption(null);
      onBomChange(null);
      setBomError(null);
    },
    [onProjectChange, onBomChange]
  );

  // Handle BOM selection
  const handleBomChange = useCallback(
    (opt: Option | null) => {
      setBomOption(opt);
      onBomChange(opt?.id ?? null);
    },
    [onBomChange]
  );

  // Handle collapse toggle
  const handleCollapseToggle = useCallback(() => {
    const newCollapsed = !collapsed;
    setLocalCollapsed(newCollapsed);
    onCollapsedChange?.(newCollapsed);
  }, [collapsed, onCollapsedChange]);

  // Clear all filters
  const handleClearFilters = useCallback(() => {
    setProjectOption(null);
    setBomOption(null);
    onProjectChange(null);
    onBomChange(null);
    setProjectError(null);
    setBomError(null);
  }, [onProjectChange, onBomChange]);

  // Sync state with controlled props
  useEffect(() => {
    if (selectedProjectId === null && projectOption !== null) {
      setProjectOption(null);
    }
    if (selectedBomId === null && bomOption !== null) {
      setBomOption(null);
    }
  }, [selectedProjectId, selectedBomId, projectOption, bomOption]);

  // Clear filters when workspace changes
  useEffect(() => {
    setProjectOption(null);
    setBomOption(null);
    onProjectChange(null);
    onBomChange(null);
    setProjectError(null);
    setBomError(null);
  }, [workspaceId, onProjectChange, onBomChange]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (projectAbortRef.current) projectAbortRef.current.abort();
      if (bomAbortRef.current) bomAbortRef.current.abort();
    };
  }, []);

  // Check if panel can be used (requires tenant and workspace)
  const isDisabled = !tenantId || !workspaceId;

  return (
    <Paper
      elevation={0}
      sx={{
        mb: 2,
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 1,
        overflow: 'hidden',
        opacity: isDisabled ? 0.7 : 1,
      }}
    >
      {/* Header - Always visible */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 2,
          py: 1.5,
          bgcolor: isDisabled ? 'grey.100' : 'grey.50',
          borderBottom: collapsed ? 'none' : '1px solid',
          borderColor: 'divider',
          cursor: isDisabled ? 'default' : 'pointer',
        }}
        onClick={isDisabled ? undefined : handleCollapseToggle}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <FilterListIcon sx={{ color: 'primary.main' }} />
          <Typography variant="subtitle2" fontWeight={600}>
            Project & BOM Filters
          </Typography>
          {activeFilterCount > 0 && (
            <Chip
              label={activeFilterCount}
              size="small"
              color="primary"
              sx={{ height: 20, fontSize: '0.7rem' }}
            />
          )}
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {activeFilterCount > 0 && (
            <Button
              size="small"
              startIcon={<ClearIcon />}
              onClick={(e) => {
                e.stopPropagation();
                handleClearFilters();
              }}
              sx={{ fontSize: '0.75rem' }}
            >
              Clear
            </Button>
          )}
          <IconButton size="small">
            {collapsed ? <ExpandMoreIcon /> : <ExpandLessIcon />}
          </IconButton>
        </Box>
      </Box>

      {/* Filter Content */}
      <Collapse in={!collapsed}>
        <Box sx={{ p: 2 }}>
          {/* Disabled state message */}
          {isDisabled && (
            <Box
              sx={{
                mb: 2,
                p: 1.5,
                bgcolor: 'warning.light',
                borderRadius: 1,
                display: 'flex',
                alignItems: 'center',
                gap: 1,
              }}
            >
              <Typography variant="body2" color="warning.dark">
                Select a Tenant and Workspace above to enable project and BOM filtering.
              </Typography>
            </Box>
          )}

          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={2}
            alignItems={{ xs: 'stretch', sm: 'flex-start' }}
          >
            {/* Project Filter */}
            <Box sx={{ minWidth: 280, flexGrow: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                <FolderIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                <Typography variant="caption" color="text.secondary">
                  Project
                </Typography>
              </Box>
              <AsyncAutocomplete
                label="Select Project"
                value={projectOption}
                onChange={handleProjectChange}
                loadOptions={loadProjects}
                placeholder="Search projects..."
                disabled={isDisabled}
                sx={{ width: '100%' }}
              />
              {projectError && (
                <Typography variant="caption" color="error" sx={{ display: 'block', mt: 0.5 }}>
                  {projectError}
                </Typography>
              )}
            </Box>

            {/* BOM Filter */}
            <Box sx={{ minWidth: 280, flexGrow: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                <ListAltIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                <Typography variant="caption" color="text.secondary">
                  Bill of Materials (BOM)
                </Typography>
              </Box>
              <AsyncAutocomplete
                label="Select BOM"
                value={bomOption}
                onChange={handleBomChange}
                loadOptions={loadBoms}
                placeholder="Select BOM..."
                disabled={isDisabled || !selectedProjectId}
                sx={{ width: '100%' }}
              />
              {bomError && (
                <Typography variant="caption" color="error" sx={{ display: 'block', mt: 0.5 }}>
                  {bomError}
                </Typography>
              )}
              {!isDisabled && !selectedProjectId && (
                <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mt: 0.5 }}>
                  Select a project first to filter BOMs
                </Typography>
              )}
            </Box>
          </Stack>

          {/* Active Filter Summary */}
          {(selectedProjectId || selectedBomId) && (
            <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                Active Filters:
              </Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                {projectOption && (
                  <Chip
                    icon={<FolderIcon />}
                    label={`Project: ${projectOption.label}`}
                    size="small"
                    onDelete={() => handleProjectChange(null)}
                    sx={{ mb: 0.5 }}
                  />
                )}
                {bomOption && (
                  <Chip
                    icon={<ListAltIcon />}
                    label={`BOM: ${bomOption.label}`}
                    size="small"
                    onDelete={() => handleBomChange(null)}
                    sx={{ mb: 0.5 }}
                  />
                )}
              </Stack>
            </Box>
          )}
        </Box>
      </Collapse>
    </Paper>
  );
}

// Display name for React DevTools
ProjectBomFilterPanel.displayName = 'ProjectBomFilterPanel';
