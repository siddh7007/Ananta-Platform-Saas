import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  CardHeader,
  Grid,
  TextField,
  Button,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Chip,
  LinearProgress,
  Tooltip,
  IconButton,
  Collapse,
  Paper,
  Stack,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
  Link,
} from '@mui/material';
import type { ChipProps } from '@mui/material/Chip';
import RefreshIcon from '@mui/icons-material/Refresh';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import StopIcon from '@mui/icons-material/Stop';
import SearchIcon from '@mui/icons-material/Search';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import TimelineIcon from '@mui/icons-material/Timeline';
import InfoIcon from '@mui/icons-material/Info';
import DescriptionIcon from '@mui/icons-material/Description';
import MemoryIcon from '@mui/icons-material/Memory';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import CancelIcon from '@mui/icons-material/Cancel';
import DownloadIcon from '@mui/icons-material/Download';
import { supabase } from '../supabaseClient';
import { useTenant } from '../contexts/TenantContext';
import { API_CONFIG, getAuthHeaders } from '../config/api';
import AsyncAutocomplete, { Option } from '../components/AsyncAutocomplete';
import { useNotification } from '../contexts/NotificationContext';

interface BOMRow {
  id: string;
  tenant_id: string;
  project_id?: string;
  name?: string;
  filename?: string;
  status?: string;
  created_at?: string;
  percent_complete?: number;
  s3_key?: string;
  s3_bucket?: string;
}

interface LineItem {
  id: string;
  bom_id: string;
  line_number: number;
  manufacturer_part_number?: string;
  manufacturer?: string;
  quantity: number;
  reference_designator?: string;
  description?: string;
  enrichment_status: string;
  component_id?: string | null;
  enrichment_error?: string | null;
}

interface ComponentDetail {
  id: string;
  mpn: string;
  manufacturer: string;
  category?: string;
  description?: string;
  datasheet_url?: string;
  image_url?: string;
  lifecycle?: string;
  rohs?: string;
  reach?: string;
  specifications?: Record<string, any>;
  parameters?: Record<string, any>;
  pricing?: Array<{ quantity: number; price: number; currency?: string }>;
  quality_score?: number;
  enrichment_source?: string;
  last_enriched_at?: string;
  stock_status?: string;
  stock_quantity?: number;
  lead_time_days?: number;
  unit_price?: number;
  currency?: string;
  moq?: number;
  aec_qualified?: boolean;
  halogen_free?: boolean;
}

export default function CustomerBOMs() {
  const { tenantId, adminModeAllTenants } = useTenant();
  const { showSuccess, showError } = useNotification();
  const [rows, setRows] = useState<BOMRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [tenantFilter, setTenantFilter] = useState('');
  const [projectFilter, setProjectFilter] = useState('');
  const [nameFilter, setNameFilter] = useState('');
  const [total, setTotal] = useState<number | null>(null);
  const [lastBatchCount, setLastBatchCount] = useState<number>(0);
  const [tenantOpt, setTenantOpt] = useState<Option | null>(null);
  const [projectOpt, setProjectOpt] = useState<Option | null>(null);
  const [bomOpt, setBomOpt] = useState<Option | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [statusFilters, setStatusFilters] = useState<string[]>([]);
  const requestSeqRef = useRef(0);
  const activeControllerRef = useRef<AbortController | null>(null);
  const isDev = Boolean((import.meta as any)?.env?.DEV ?? false);

  // Line items state for expandable rows
  const [expandedBomId, setExpandedBomId] = useState<string | null>(null);
  const [lineItems, setLineItems] = useState<Record<string, LineItem[]>>({});
  const [lineItemsLoading, setLineItemsLoading] = useState<Record<string, boolean>>({});

  // Component detail dialog state
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [componentDetail, setComponentDetail] = useState<ComponentDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const devLog = (...args: unknown[]) => {
    if (isDev) console.log(...args);
  };
  const devWarn = (...args: unknown[]) => {
    if (isDev) console.warn(...args);
  };

  const STATUS_OPTIONS: Array<{ value: string; label: string; color: ChipProps['color'] }> = [
    { value: 'enriching', label: 'Enriching', color: 'info' },
    { value: 'completed', label: 'Completed', color: 'success' },
    { value: 'paused', label: 'Paused', color: 'warning' },
    { value: 'failed', label: 'Failed', color: 'error' },
    { value: 'pending', label: 'Pending', color: 'default' },
  ];

  const toggleStatusFilter = (value: string) => {
    setStatusFilters((prev) => (prev.includes(value) ? prev.filter((s) => s !== value) : [...prev, value]));
  };

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (nameFilter.trim()) count += 1;
    if (adminModeAllTenants && (tenantOpt?.id || tenantFilter)) count += 1;
    if (projectOpt?.id || projectFilter) count += 1;
    if (bomOpt?.id) count += 1;
    if (statusFilters.length) count += 1;
    return count;
  }, [nameFilter, adminModeAllTenants, tenantOpt, tenantFilter, projectOpt, projectFilter, bomOpt, statusFilters]);

  useEffect(() => () => {
    activeControllerRef.current?.abort();
  }, []);

  const load = async (overrides?: {
    page?: number;
    tenantId?: string;
    projectId?: string;
    bomId?: string;
    nameTerm?: string;
  }) => {
    const nextSeq = requestSeqRef.current + 1;
    requestSeqRef.current = nextSeq;
    activeControllerRef.current?.abort();
    const controller = new AbortController();
    activeControllerRef.current = controller;
    setLoading(true);
    try {
      const adminHeaders = getAuthHeaders();
      const adminRequestOptions: RequestInit = { signal: controller.signal };
      if (adminHeaders) {
        adminRequestOptions.headers = adminHeaders;
      }
      const envPrefersAdmin = ((import.meta as any).env?.VITE_CNS_USE_ADMIN_DATA || 'false') === 'true';
      const sanitize = (value?: string | null) => {
        if (value == null) {
          return undefined;
        }
        const trimmed = String(value).trim();
        return trimmed.length ? trimmed : undefined;
      };
      let usedAdmin = false;
      const pageIndex = overrides?.page ?? page;
      const tenantOverride = overrides?.tenantId;
      const projectOverride = overrides?.projectId;
      const bomOverride = overrides?.bomId;
      const nameOverride = overrides?.nameTerm;

      const tenantForQuery = sanitize(adminModeAllTenants
        ? tenantOverride ?? tenantOpt?.id ?? tenantFilter
        : tenantId);
      const projectForQuery = sanitize(projectOverride ?? projectOpt?.id ?? projectFilter);
      const bomForQuery = sanitize(bomOverride ?? bomOpt?.id);
      const nameValue = sanitize(nameOverride ?? nameFilter);

      devLog('[CustomerBOMs] load start', {
        source: envPrefersAdmin || adminHeaders ? 'admin-api' : 'supabase',
        pageIndex,
        tenantForQuery,
        projectForQuery,
        bomForQuery,
        nameValue,
        statusFilters,
      });

      if (envPrefersAdmin || adminHeaders) {
        try {
          const url = new URL(`${API_CONFIG.BASE_URL}/admin/boms`, window.location.origin);
          if (tenantForQuery) url.searchParams.set('tenant_id', tenantForQuery);
          if (projectForQuery) url.searchParams.set('project_id', projectForQuery);
          if (bomForQuery) url.searchParams.set('bom_id', bomForQuery);
          if (nameValue) url.searchParams.set('search', nameValue);
          if (statusFilters.length) statusFilters.forEach((status) => url.searchParams.append('status', status));
          url.searchParams.set('limit', String(rowsPerPage));
          url.searchParams.set('offset', String(pageIndex * rowsPerPage));
          const res = await fetch(url.toString(), adminRequestOptions);
          if (!res.ok) throw new Error(await res.text());
          const data = await res.json();
          let mapped: BOMRow[] = (data || []).map((b: any) => ({
            id: b.id || b.bom_id,
            tenant_id: b.tenant_id || b.organization_id,
            project_id: b.project_id,
            name: b.name || b.bom_name,
            filename: b.filename || b.bom_filename,
            status: String(b.enrichment_status || b.status || 'unknown').toLowerCase(),
            created_at: b.created_at,
            percent_complete: b.percent_complete,
            s3_key: b.s3_key,
            s3_bucket: b.s3_bucket || 'bulk-uploads',
          }));
          if (requestSeqRef.current !== nextSeq) return;
          if (statusFilters.length) {
            mapped = mapped.filter((row) => statusFilters.includes((row.status || '').toLowerCase()));
          }
          if (requestSeqRef.current !== nextSeq) return;
          setRows(mapped);
          if (requestSeqRef.current === nextSeq) {
            setLastBatchCount(mapped.length);
          }
          usedAdmin = true;

          try {
            const countUrl = new URL(`${API_CONFIG.BASE_URL}/admin/boms/count`, window.location.origin);
            if (tenantForQuery) countUrl.searchParams.set('tenant_id', tenantForQuery);
            if (projectForQuery) countUrl.searchParams.set('project_id', projectForQuery);
            if (bomForQuery) countUrl.searchParams.set('bom_id', bomForQuery);
            if (nameValue) countUrl.searchParams.set('search', nameValue);
            if (statusFilters.length) statusFilters.forEach((status) => countUrl.searchParams.append('status', status));
            const cRes = await fetch(countUrl.toString(), adminRequestOptions);
            if (cRes.ok) {
              const cJson = await cRes.json();
              if (requestSeqRef.current === nextSeq) {
                setTotal(typeof cJson?.total === 'number' ? cJson.total : null);
              }
            } else {
              if (requestSeqRef.current === nextSeq) {
                setTotal(null);
              }
            }
          } catch {
            if (requestSeqRef.current === nextSeq) {
              setTotal(null);
            }
          }

          devLog('[CustomerBOMs] admin load success', {
            count: mapped.length,
            tenantForQuery,
            projectForQuery,
            bomForQuery,
            nameValue,
            statusFilters,
          });
        } catch (adminErr) {
          devWarn('[CustomerBOMs] admin API load failed, falling back to Supabase', adminErr);
        }
      }

      if (!usedAdmin) {
        let query = supabase
          .from('boms')
          .select('id, tenant_id, project_id, name, status, created_at')
          .order('created_at', { ascending: false })
          .limit(rowsPerPage)
          .range(pageIndex * rowsPerPage, pageIndex * rowsPerPage + rowsPerPage - 1);

        if (tenantForQuery) {
          query = query.eq('tenant_id', tenantForQuery);
        }
        if (projectForQuery) query = query.eq('project_id', projectForQuery);
        if (bomForQuery) query = query.eq('id', bomForQuery);
        if (nameValue) {
          const pattern = `%${nameValue}%`;
          const anyQ: any = query as any;
          query = typeof anyQ.ilike === 'function'
            ? anyQ.ilike('name', pattern)
            : query.eq('name', nameValue);
        }

        const anySupabaseQuery: any = query as any;
        if (statusFilters.length) {
          query = typeof anySupabaseQuery.in === 'function'
            ? anySupabaseQuery.in('status', statusFilters)
            : query.eq('status', statusFilters[0]);
        }

        const { data, error } = await query;
        if (error) throw error;

        const baseRows: BOMRow[] = data || [];
        if (requestSeqRef.current !== nextSeq) return;
        setLastBatchCount(baseRows.length);
        setTotal(null);

        const ids = baseRows.map((r) => r.id);
        if (ids.length > 0) {
          const { data: evts } = await supabase
            .from('enrichment_events')
            .select('bom_id, state, created_at')
            .in('bom_id', ids)
            .order('created_at', { ascending: false })
            .limit(1000);

          const latest = new Map<string, { status?: string; percent_complete?: number }>();
          (evts || []).forEach((e: any) => {
            if (!latest.has(e.bom_id)) {
              latest.set(e.bom_id, {
                status: e.state?.status,
                percent_complete: e.state?.percent_complete,
              });
            }
          });
          const augmented = baseRows.map((r) => {
            const l = latest.get(r.id);
            return l
              ? { ...r, status: String(l.status || r.status || 'unknown').toLowerCase(), percent_complete: l.percent_complete }
              : { ...r, status: String(r.status || 'unknown').toLowerCase() };
          });
          if (requestSeqRef.current !== nextSeq) return;
          setRows(statusFilters.length ? augmented.filter((r) => statusFilters.includes((r.status || '').toLowerCase())) : augmented);
          devLog('[CustomerBOMs] supabase load success (augmented)', {
            count: augmented.length,
            tenantForQuery,
            projectForQuery,
            bomForQuery,
            nameValue,
            statusFilters,
          });
        } else {
          const normalized = baseRows.map((r) => ({ ...r, status: String(r.status || 'unknown').toLowerCase() }));
          if (requestSeqRef.current !== nextSeq) return;
          setRows(statusFilters.length ? normalized.filter((r) => statusFilters.includes((r.status || '').toLowerCase())) : normalized);
          devLog('[CustomerBOMs] supabase load success', {
            count: normalized.length,
            tenantForQuery,
            projectForQuery,
            bomForQuery,
            nameValue,
            statusFilters,
          });
        }
      }
    } catch (e) {
      if ((e as any)?.name === 'AbortError' || controller.signal.aborted) {
        return;
      }
      if (requestSeqRef.current !== nextSeq) {
        return;
      }
      if (isDev) {
        console.error('CustomerBOMs load error', e);
      }
      setRows([]);
    } finally {
      if (requestSeqRef.current === nextSeq) {
        setLoading(false);
        activeControllerRef.current = null;
      }
    }
  };

  const handleSearch = () => {
    const tenantOverride = adminModeAllTenants ? tenantOpt?.id || tenantFilter || undefined : undefined;
    const projectOverride = projectOpt?.id || projectFilter || undefined;
    const bomOverride = bomOpt?.id || undefined;
    devLog('[CustomerBOMs] search submit', {
      tenantOverride,
      projectOverride,
      bomOverride,
      nameFilter,
      statusFilters,
    });
    if (page !== 0) setPage(0);
    void load({
      page: 0,
      tenantId: tenantOverride,
      projectId: projectOverride,
      bomId: bomOverride,
      nameTerm: nameFilter,
    });
  };

  const handleClear = () => {
    setNameFilter('');
    setTenantOpt(null);
    setTenantFilter('');
    setProjectOpt(null);
    setProjectFilter('');
    setBomOpt(null);
    setStatusFilters([]);
    devLog('[CustomerBOMs] filters cleared');
    if (page !== 0) setPage(0);
    void load({ page: 0, tenantId: '', projectId: '', bomId: '', nameTerm: '' });
  };

  useEffect(() => {
    devLog('[CustomerBOMs] load triggered', {
      adminModeAllTenants,
      tenantId,
      page,
      rowsPerPage,
      statusFilters,
    });
    void load();
  }, [adminModeAllTenants, tenantId, page, rowsPerPage, statusFilters]);

  useEffect(() => {
    setPage(0);
  }, [statusFilters]);

  const filtered = useMemo(() => rows, [rows]);
  const totalPages = total != null ? Math.max(1, Math.ceil(total / rowsPerPage)) : null;
  const disablePrev = loading || page === 0;
  const disableNext = loading || (totalPages != null ? page >= totalPages - 1 : filtered.length < rowsPerPage || lastBatchCount < rowsPerPage);

  const statusChip = (s?: string) => {
    const map: Record<string, { label: string; color: ChipProps['color'] }> = {
      enriching: { label: 'Enriching', color: 'info' },
      completed: { label: 'Completed', color: 'success' },
      paused: { label: 'Paused', color: 'warning' },
      failed: { label: 'Failed', color: 'error' },
      pending: { label: 'Pending', color: 'default' },
    };
    const cfg: { label: string; color: ChipProps['color'] } = s && map[s]
      ? map[s]
      : { label: s || 'Unknown', color: 'default' };
    return <Chip label={cfg.label} color={cfg.color} size="small" />;
  };

  const post = async (url: string, body?: any, successMsg?: string) => {
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      const adminHeaders = getAuthHeaders() as Record<string, string> | undefined;
      if (adminHeaders) Object.assign(headers, adminHeaders);

      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!res.ok) throw new Error(await res.text());
      if (successMsg) showSuccess(successMsg);
    } catch (e: any) {
      showError(typeof e?.message === 'string' ? e.message : 'Action failed');
      throw e;
    }
  };

  const start = async (id: string) => {
    await post(`${API_CONFIG.BASE_URL}/boms/${id}/enrichment/start`, { tenant_id: tenantId, priority: 7 }, 'Enrichment started');
    void load();
  };
  const pause = async (id: string) => { await post(`${API_CONFIG.BASE_URL}/boms/${id}/enrichment/pause`, { bom_id: id }, 'Paused'); void load(); };
  const resume = async (id: string) => { await post(`${API_CONFIG.BASE_URL}/boms/${id}/enrichment/resume`, undefined, 'Resumed'); void load(); };
  const stop = async (id: string) => { await post(`${API_CONFIG.BASE_URL}/boms/${id}/enrichment/stop`, { bom_id: id }, 'Stopped'); void load(); };

  // Fetch line items for a BOM
  const fetchLineItems = async (bomId: string, forceRefresh = false) => {
    if (lineItems[bomId] && !forceRefresh) return; // Already loaded

    setLineItemsLoading((prev) => ({ ...prev, [bomId]: true }));
    try {
      const headers: Record<string, string> = {};
      const authHeaders = getAuthHeaders();
      if (authHeaders) Object.assign(headers, authHeaders);

      const res = await fetch(`${API_CONFIG.BASE_URL}/boms/${bomId}/line_items?page=1&page_size=500`, { headers });
      if (!res.ok) throw new Error(await res.text());

      const data = await res.json();
      const items: LineItem[] = (data.items || []).map((item: any) => ({
        id: item.id,
        bom_id: item.bom_id,
        line_number: item.line_number,
        manufacturer_part_number: item.manufacturer_part_number,
        manufacturer: item.manufacturer,
        quantity: item.quantity || 1,
        reference_designator: item.reference_designator,
        description: item.description,
        enrichment_status: item.enrichment_status || 'pending',
        component_id: item.component_id,
        enrichment_error: item.enrichment_error,
      }));

      setLineItems((prev) => ({ ...prev, [bomId]: items }));
    } catch (err) {
      console.error('[CustomerBOMs] Failed to fetch line items:', err);
      showError('Failed to load line items');
    } finally {
      setLineItemsLoading((prev) => ({ ...prev, [bomId]: false }));
    }
  };

  const toggleExpandRow = (bomId: string) => {
    if (expandedBomId === bomId) {
      setExpandedBomId(null);
    } else {
      setExpandedBomId(bomId);
      void fetchLineItems(bomId);
    }
  };

  // Refresh line items for a BOM (clears cache and re-fetches)
  const refreshLineItems = (bomId: string) => {
    void fetchLineItems(bomId, true);
  };

  // Invalidate line items cache for active enrichments on main refresh
  const invalidateActiveEnrichmentsCache = () => {
    const activeStatuses = ['enriching', 'pending'];
    setLineItems((prev) => {
      const newCache: Record<string, LineItem[]> = {};
      // Only keep cached items for completed/failed BOMs
      Object.entries(prev).forEach(([bomId, items]) => {
        const bomRow = rows.find((r) => r.id === bomId);
        if (bomRow && !activeStatuses.includes((bomRow.status || '').toLowerCase())) {
          newCache[bomId] = items;
        }
      });
      return newCache;
    });
  };

  // Line item status icon
  const lineItemStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
        return <CheckCircleIcon fontSize="small" color="success" />;
      case 'failed':
        return <ErrorIcon fontSize="small" color="error" />;
      case 'enriching':
        return <CircularProgress size={16} />;
      default:
        return <HourglassEmptyIcon fontSize="small" color="disabled" />;
    }
  };

  // Calculate line item stats for a BOM
  const getLineItemStats = (bomId: string) => {
    const items = lineItems[bomId] || [];
    const total = items.length;
    const completed = items.filter((i) => i.enrichment_status === 'completed').length;
    const failed = items.filter((i) => i.enrichment_status === 'failed').length;
    const pending = items.filter((i) => i.enrichment_status === 'pending').length;
    return { total, completed, failed, pending };
  };

  // Fetch component details
  const fetchComponentDetail = async (componentId: string) => {
    setDetailLoading(true);
    try {
      const headers: Record<string, string> = {};
      const authHeaders = getAuthHeaders();
      if (authHeaders) Object.assign(headers, authHeaders);

      const res = await fetch(`${API_CONFIG.BASE_URL}/catalog/component/id/${componentId}`, { headers });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setComponentDetail(data);
    } catch (err) {
      console.error('[CustomerBOMs] Failed to fetch component details:', err);
      showError('Failed to load component details');
      setComponentDetail(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const openComponentDetail = (componentId: string | null | undefined) => {
    if (!componentId) return;
    setDetailDialogOpen(true);
    void fetchComponentDetail(componentId);
  };

  const closeComponentDetail = () => {
    setDetailDialogOpen(false);
    setComponentDetail(null);
  };

  // Helper functions for component detail display
  const qualityScoreChip = (score?: number) => {
    if (score == null) return <Typography variant="caption" color="text.secondary">-</Typography>;
    let color: ChipProps['color'] = 'default';
    if (score >= 80) color = 'success';
    else if (score >= 60) color = 'warning';
    else color = 'error';
    return <Chip label={`${Math.round(score)}`} color={color} size="small" />;
  };

  const lifecycleChip = (s?: string) => {
    if (!s) return <Typography variant="caption" color="text.secondary">-</Typography>;
    const lower = s.toLowerCase();
    let color: ChipProps['color'] = 'default';
    if (lower.includes('active') || lower.includes('production')) color = 'success';
    else if (lower.includes('nrnd') || lower.includes('not recommended')) color = 'warning';
    else if (lower.includes('obsolete') || lower.includes('discontinued')) color = 'error';
    return <Chip label={s} color={color} size="small" variant="outlined" />;
  };

  const complianceIcon = (value?: boolean) => {
    if (value === true) return <CheckCircleIcon fontSize="small" color="success" />;
    if (value === false) return <CancelIcon fontSize="small" color="error" />;
    return <Typography variant="caption" color="text.secondary">-</Typography>;
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="h5">Customer BOMs</Typography>
        <Button onClick={() => { invalidateActiveEnrichmentsCache(); void load(); }} startIcon={<RefreshIcon />} disabled={loading} variant="outlined">Refresh</Button>
      </Box>

      <Card sx={{ mb: 2 }}>
        <CardHeader
          title="Filters"
          subheader={activeFilterCount ? `${activeFilterCount} active filter${activeFilterCount > 1 ? 's' : ''}` : undefined}
          action={(
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Button variant="contained" onClick={handleSearch} startIcon={<SearchIcon />} disabled={loading}>Search</Button>
              <Button variant="outlined" onClick={handleClear} disabled={loading || (!activeFilterCount && !nameFilter.trim())}>Clear</Button>
              <IconButton
                size="small"
                onClick={() => setFiltersOpen((open) => !open)}
                aria-label="Toggle filters"
                sx={{ transform: filtersOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease' }}
              >
                <ExpandMoreIcon fontSize="small" />
              </IconButton>
            </Box>
          )}
          sx={{ '& .MuiCardHeader-action': { alignSelf: 'center' } }}
        />
        <Collapse in={filtersOpen} timeout="auto" unmountOnExit>
          <CardContent>
            <Grid container spacing={2}>
              <Grid item xs={12} md={3}>
                <AsyncAutocomplete
                  label="Tenant"
                  value={adminModeAllTenants ? tenantOpt : null}
                  onChange={(opt)=>{ setTenantOpt(opt); setTenantFilter(opt?.id || ''); setProjectOpt(null); setProjectFilter(''); setBomOpt(null); }}
                  disabled={!adminModeAllTenants}
                  loadOptions={async (query) => {
                    if (!adminModeAllTenants) return [];
                    const url = new URL(`${API_CONFIG.BASE_URL}/admin/tenants`, window.location.origin);
                    if (query) url.searchParams.set('search', query);
                    url.searchParams.set('limit', '50');
                    try {
                      const res = await fetch(url.toString(), { headers: getAuthHeaders() });
                      if (res.ok) {
                        const data = await res.json();
                        return Array.isArray(data) ? (data as any[]).map((t:any)=>({ id: t.id, label: t.name ? `${t.name} · ${t.id}`: t.id })) : [];
                      }
                    } catch {}
                    // Fallback to Supabase organizations if admin endpoint unavailable
                    try {
                      const { data } = await supabase
                        .from('organizations')
                        .select('id,name')
                        .ilike('name', `%${query||''}%`)
                        .limit(50);
                      return Array.isArray(data) ? (data as any[]).map((t:any)=>({ id: t.id, label: t.name ? `${t.name} · ${t.id}`: t.id })) : [];
                    } catch {
                      return [];
                    }
                  }}
                />
              </Grid>
              <Grid item xs={12} md={3}>
                <AsyncAutocomplete
                  label="Project"
                  value={projectOpt}
                  onChange={(opt)=>{ setProjectOpt(opt); setProjectFilter(opt?.id || ''); setBomOpt(null); }}
                  disabled={false}
                  loadOptions={async (query) => {
                    try {
                      const url = new URL(`${API_CONFIG.BASE_URL}/admin/projects`, window.location.origin);
                      const t = tenantOpt?.id || tenantFilter || tenantId;
                      if (t) url.searchParams.set('tenant_id', t);
                      if (query) url.searchParams.set('search', query);
                      url.searchParams.set('limit', '50');
                      const res = await fetch(url.toString(), { headers: getAuthHeaders() });
                      if (!res.ok) return [];
                      const data = await res.json();
                      return Array.isArray(data) ? (data as any[]).map((p:any)=>({ id: p.id, label: p.name ? `${p.name} · ${p.id}`: p.id })) : [];
                    } catch (err) {
                      console.warn('[CustomerBOMs] Failed to load projects', err);
                      return [];
                    }
                  }}
                />
              </Grid>
              <Grid item xs={12} md={3}>
                <AsyncAutocomplete
                  label="BOM"
                  value={bomOpt}
                  onChange={(opt)=>{ setBomOpt(opt); }}
                  disabled={false}
                  loadOptions={async (query) => {
                    try {
                      const url = new URL(`${API_CONFIG.BASE_URL}/admin/boms`, window.location.origin);
                      const t = tenantOpt?.id || tenantFilter || tenantId;
                      if (t) url.searchParams.set('tenant_id', t);
                      if (projectOpt?.id) url.searchParams.set('project_id', projectOpt.id);
                      if (query) url.searchParams.set('search', query);
                      url.searchParams.set('limit', '50');
                      const res = await fetch(url.toString(), { headers: getAuthHeaders() });
                      if (!res.ok) return [];
                      const data = await res.json();
                      return Array.isArray(data) ? (data as any[]).map((b:any)=>({ id: b.id, label: b.name || b.filename || b.id })) : [];
                    } catch (err) {
                      console.warn('[CustomerBOMs] Failed to load BOMs', err);
                      return [];
                    }
                  }}
                />
              </Grid>
              <Grid item xs={12} md={3}>
                <TextField fullWidth size="small" label="BOM Name" value={nameFilter} onChange={(e)=>setNameFilter(e.target.value)} />
              </Grid>
              <Grid item xs={12}>
                <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
                  <Typography variant="subtitle2" sx={{ mr: 1 }}>Status</Typography>
                  {STATUS_OPTIONS.map((opt) => {
                    const active = statusFilters.includes(opt.value);
                    return (
                      <Chip
                        key={opt.value}
                        label={opt.label}
                        variant={active ? 'filled' : 'outlined'}
                        color={active ? opt.color : 'default'}
                        onClick={()=>toggleStatusFilter(opt.value)}
                        clickable
                        size="small"
                      />
                    );
                  })}
                  <Button size="small" onClick={()=>setStatusFilters([])} disabled={!statusFilters.length}>Reset Status</Button>
                </Box>
              </Grid>
            </Grid>
          </CardContent>
        </Collapse>
      </Card>

      <Card>
        {loading && <LinearProgress />}
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
            <Box />
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <TextField
                select
                size="small"
                label="Rows"
                SelectProps={{ native: true }}
                value={rowsPerPage}
                onChange={(e)=>{ setRowsPerPage(parseInt(e.target.value as any, 10)); setPage(0); }}
              >
                {[10,25,50,100,200].map((n)=> (<option key={n} value={n}>{n}</option>))}
              </TextField>
              <Button size="small" onClick={()=>setPage(0)} disabled={disablePrev}>First</Button>
              <Button size="small" onClick={()=>setPage(Math.max(0, page-1))} disabled={disablePrev}>Prev</Button>
              <Box sx={{ mx: 1, alignSelf: 'center' }}>
                Page {page+1}{totalPages ? ` of ${totalPages}` : ''}{total != null ? ` (Total ${total})` : ''}
              </Box>
              <TextField
                type="number"
                size="small"
                label="Go"
                inputProps={{ min: 1, value: page+1, style: { width: 70 } }}
                onChange={(e)=>{
                  const v = Math.max(1, parseInt(e.target.value || '1', 10));
                  const max = totalPages != null ? totalPages : v;
                  setPage(Math.min(max, v) - 1);
                }}
              />
              <Button size="small" onClick={()=>setPage(page+1)} disabled={disableNext}>Next</Button>
              <Button size="small" onClick={()=> totalPages!=null && setPage(totalPages-1)} disabled={disableNext || totalPages==null}>Last</Button>
            </Box>
          </Box>
          <Table size="small" aria-label="Customer BOMs table">
            <TableHead>
              <TableRow sx={{ bgcolor: 'grey.100' }}>
                <TableCell padding="checkbox" />
                <TableCell>Name</TableCell>
                <TableCell>Filename</TableCell>
                <TableCell>Status</TableCell>
                <TableCell sx={{ minWidth: 140 }}>% Complete</TableCell>
                <TableCell>Tenant</TableCell>
                <TableCell>Project</TableCell>
                <TableCell>Created</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.map((r) => {
                const isExpanded = expandedBomId === r.id;
                const bomLineItems = lineItems[r.id] || [];
                const isLoadingItems = lineItemsLoading[r.id];
                const stats = getLineItemStats(r.id);

                return (
                  <Fragment key={r.id}>
                    <TableRow hover sx={{ '& > *': { borderBottom: isExpanded ? 'none' : undefined } }}>
                      {/* Expand Button */}
                      <TableCell padding="checkbox">
                        <Tooltip title={isExpanded ? 'Collapse' : 'View Line Items'}>
                          <IconButton size="small" onClick={() => toggleExpandRow(r.id)}> aria-label={isExpanded ? "Collapse line items" : "View line items"}
                            {isExpanded ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                      <TableCell>{r.name || '-'}</TableCell>
                      <TableCell>{r.filename || '-'}</TableCell>
                      <TableCell>{statusChip(r.status)}</TableCell>
                      <TableCell>
                        {typeof r.percent_complete === 'number' ? (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Box sx={{ flex: 1, minWidth: 60 }}>
                              <LinearProgress
                                variant="determinate"
                                value={Math.max(0, Math.min(100, Math.round(r.percent_complete)))}
                                color={r.status === 'failed' ? 'error' : r.status === 'completed' ? 'success' : 'primary'}
                              />
                            </Box>
                            <Typography variant="caption" sx={{ minWidth: 35 }}>{Math.round(r.percent_complete)}%</Typography>
                          </Box>
                        ) : '-'}
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
                          {r.tenant_id ? r.tenant_id.slice(0, 8) + '...' : '-'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
                          {r.project_id ? r.project_id.slice(0, 8) + '...' : '-'}
                        </Typography>
                      </TableCell>
                      <TableCell>{r.created_at ? new Date(r.created_at).toLocaleString() : '-'}</TableCell>
                      <TableCell align="right">
                        {/* Raw Download */}
                        {r.s3_key && (
                          <Tooltip title="Download Raw BOM">
                            <IconButton
                              size="small"
                              component="a"
                              aria-label="Download raw BOM"
                              href={`${API_CONFIG.BASE_URL}/files/download?s3_key=${encodeURIComponent(r.s3_key)}&bucket=${encodeURIComponent(r.s3_bucket || 'bulk-uploads')}`}
                              target="_blank"
                            >
                              <DownloadIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                        {/* Show Start when not enriching and not paused */}
                        {r.status !== 'enriching' && r.status !== 'paused' && (
                          <Tooltip title="Start enrichment"><span><IconButton size="small" onClick={()=>start(r.id)} aria-label="Start enrichment"><PlayArrowIcon fontSize="small" /></IconButton></span></Tooltip>
                        )}
                        {/* Show Resume only when paused */}
                        {r.status === 'paused' && (
                          <Tooltip title="Resume"><span><IconButton size="small" onClick={()=>resume(r.id)} aria-label="Resume enrichment"><PlayArrowIcon fontSize="small" /></IconButton></span></Tooltip>
                        )}
                        {/* Show Pause and Stop only when enriching */}
                        {r.status === 'enriching' && (
                          <>
                            <Tooltip title="Pause"><span><IconButton size="small" onClick={()=>pause(r.id)} aria-label="Pause enrichment"><PauseIcon fontSize="small" /></IconButton></span></Tooltip>
                            <Tooltip title="Stop"><span><IconButton size="small" onClick={()=>stop(r.id)} aria-label="Stop enrichment"><StopIcon fontSize="small" /></IconButton></span></Tooltip>
                          </>
                        )}
                      </TableCell>
                    </TableRow>

                    {/* Expanded Row - Line Items */}
                    <TableRow>
                      <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={9}>
                        <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                          <Box sx={{ margin: 2 }}>
                            {/* Line Item Stats */}
                            <Stack direction="row" spacing={2} sx={{ mb: 2 }} alignItems="center">
                              <TimelineIcon color="primary" />
                              <Typography variant="subtitle1" fontWeight={600}>
                                Line Items
                              </Typography>
                              <Tooltip title="Refresh line items">
                                <IconButton size="small" onClick={() => refreshLineItems(r.id)} disabled={isLoadingItems}>
                                  aria-label="Refresh line items"
                                  <RefreshIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              {bomLineItems.length > 0 && (
                                <Stack direction="row" spacing={1}>
                                  <Chip label={`Total: ${stats.total}`} size="small" variant="outlined" />
                                  <Chip label={`Completed: ${stats.completed}`} size="small" color="success" variant="outlined" />
                                  <Chip label={`Failed: ${stats.failed}`} size="small" color="error" variant="outlined" />
                                  <Chip label={`Pending: ${stats.pending}`} size="small" variant="outlined" />
                                </Stack>
                              )}
                            </Stack>

                            {isLoadingItems ? (
                              <Box display="flex" justifyContent="center" py={3}>
                                <CircularProgress size={24} />
                              </Box>
                            ) : bomLineItems.length === 0 ? (
                              <Typography color="text.secondary" align="center" py={2}>
                                No line items found
                              </Typography>
                            ) : (
                              <Paper variant="outlined" sx={{ maxHeight: 400, overflow: 'auto' }}>
                                <Table size="small">
                                  <TableHead>
                                    <TableRow sx={{ bgcolor: 'grey.50' }}>
                                      <TableCell sx={{ width: 40 }} align="center">#</TableCell>
                                      <TableCell align="center" sx={{ width: 40 }}>Status</TableCell>
                                      <TableCell>Input MPN</TableCell>
                                      <TableCell>Input Manufacturer</TableCell>
                                      <TableCell>Qty</TableCell>
                                      <TableCell>Description</TableCell>
                                      <TableCell>Error</TableCell>
                                      <TableCell align="center" sx={{ width: 60 }}>Actions</TableCell>
                                    </TableRow>
                                  </TableHead>
                                  <TableBody>
                                    {bomLineItems.map((item) => (
                                      <TableRow
                                        key={item.id}
                                        sx={{
                                          bgcolor: item.enrichment_status === 'failed' ? 'error.light' :
                                                   item.enrichment_status === 'completed' ? 'success.light' : undefined,
                                          '&:hover': { bgcolor: 'action.hover' }
                                        }}
                                      >
                                        <TableCell align="center">{item.line_number}</TableCell>
                                        <TableCell align="center">
                                          <Tooltip title={item.enrichment_status}>
                                            {lineItemStatusIcon(item.enrichment_status)}
                                          </Tooltip>
                                        </TableCell>
                                        <TableCell>
                                          <Typography variant="body2" fontWeight={500}>
                                            {item.manufacturer_part_number || '-'}
                                          </Typography>
                                        </TableCell>
                                        <TableCell>{item.manufacturer || '-'}</TableCell>
                                        <TableCell>{item.quantity}</TableCell>
                                        <TableCell>
                                          <Typography
                                            variant="body2"
                                            color="text.secondary"
                                            sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                                          >
                                            {item.description || '-'}
                                          </Typography>
                                        </TableCell>
                                        <TableCell>
                                          {item.enrichment_error && (
                                            <Tooltip title={item.enrichment_error}>
                                              <Typography
                                                variant="caption"
                                                color="error"
                                                sx={{ maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}
                                              >
                                                {item.enrichment_error}
                                              </Typography>
                                            </Tooltip>
                                          )}
                                        </TableCell>
                                        <TableCell align="center">
                                          {item.component_id && item.enrichment_status === 'completed' && (
                                            <Tooltip title="View Component Details">
                                              <IconButton size="small" onClick={() => openComponentDetail(item.component_id)}>
                                                aria-label="View component details"
                                                <InfoIcon fontSize="small" color="info" />
                                              </IconButton>
                                            </Tooltip>
                                          )}
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </Paper>
                            )}
                          </Box>
                        </Collapse>
                      </TableCell>
                    </TableRow>
                  </Fragment>
                );
              })}
              {filtered.length === 0 && !loading && (
                <TableRow>
                  <TableCell colSpan={9} align="center">No BOMs match the current filters. Adjust filters or run a new enrichment to populate results.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Component Detail Dialog */}
      <Dialog open={detailDialogOpen} onClose={closeComponentDetail} maxWidth="md" fullWidth aria-labelledby="component-detail-title">
        <DialogTitle id="component-detail-title" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <MemoryIcon color="primary" />
          Component Details
        </DialogTitle>
        <DialogContent dividers>
          {detailLoading ? (
            <Box display="flex" justifyContent="center" py={4}>
              <CircularProgress />
            </Box>
          ) : componentDetail ? (
            <Grid container spacing={2}>
              {/* Basic Info */}
              <Grid item xs={12}>
                <Typography variant="subtitle2" color="primary" gutterBottom>
                  Basic Information
                </Typography>
                <Divider sx={{ mb: 1 }} />
              </Grid>
              <Grid item xs={6} md={4}>
                <Typography variant="caption" color="text.secondary">MPN</Typography>
                <Typography variant="body2" fontWeight={500}>{componentDetail.mpn || '-'}</Typography>
              </Grid>
              <Grid item xs={6} md={4}>
                <Typography variant="caption" color="text.secondary">Manufacturer</Typography>
                <Typography variant="body2">{componentDetail.manufacturer || '-'}</Typography>
              </Grid>
              <Grid item xs={6} md={4}>
                <Typography variant="caption" color="text.secondary">Category</Typography>
                <Typography variant="body2">{componentDetail.category || '-'}</Typography>
              </Grid>
              <Grid item xs={12}>
                <Typography variant="caption" color="text.secondary">Description</Typography>
                <Typography variant="body2">{componentDetail.description || '-'}</Typography>
              </Grid>

              {/* Status & Quality */}
              <Grid item xs={12} sx={{ mt: 1 }}>
                <Typography variant="subtitle2" color="primary" gutterBottom>
                  Status & Quality
                </Typography>
                <Divider sx={{ mb: 1 }} />
              </Grid>
              <Grid item xs={6} md={3}>
                <Typography variant="caption" color="text.secondary">Quality Score</Typography>
                <Box>{qualityScoreChip(componentDetail.quality_score)}</Box>
              </Grid>
              <Grid item xs={6} md={3}>
                <Typography variant="caption" color="text.secondary">Lifecycle</Typography>
                <Box>{lifecycleChip(componentDetail.lifecycle)}</Box>
              </Grid>
              <Grid item xs={6} md={3}>
                <Typography variant="caption" color="text.secondary">Source</Typography>
                <Typography variant="body2">{componentDetail.enrichment_source || '-'}</Typography>
              </Grid>
              <Grid item xs={6} md={3}>
                <Typography variant="caption" color="text.secondary">Last Enriched</Typography>
                <Typography variant="body2">
                  {componentDetail.last_enriched_at ? new Date(componentDetail.last_enriched_at).toLocaleDateString() : '-'}
                </Typography>
              </Grid>

              {/* Compliance */}
              <Grid item xs={12} sx={{ mt: 1 }}>
                <Typography variant="subtitle2" color="primary" gutterBottom>
                  Compliance
                </Typography>
                <Divider sx={{ mb: 1 }} />
              </Grid>
              <Grid item xs={3}>
                <Typography variant="caption" color="text.secondary">RoHS</Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  {complianceIcon(componentDetail.rohs === 'Compliant' || componentDetail.rohs === 'Yes')}
                  <Typography variant="caption">{componentDetail.rohs || '-'}</Typography>
                </Box>
              </Grid>
              <Grid item xs={3}>
                <Typography variant="caption" color="text.secondary">REACH</Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  {complianceIcon(componentDetail.reach === 'Compliant' || componentDetail.reach === 'Yes')}
                  <Typography variant="caption">{componentDetail.reach || '-'}</Typography>
                </Box>
              </Grid>
              <Grid item xs={3}>
                <Typography variant="caption" color="text.secondary">AEC-Q</Typography>
                <Box>{complianceIcon(componentDetail.aec_qualified)}</Box>
              </Grid>
              <Grid item xs={3}>
                <Typography variant="caption" color="text.secondary">Halogen Free</Typography>
                <Box>{complianceIcon(componentDetail.halogen_free)}</Box>
              </Grid>

              {/* Stock & Pricing */}
              <Grid item xs={12} sx={{ mt: 1 }}>
                <Typography variant="subtitle2" color="primary" gutterBottom>
                  Stock & Pricing
                </Typography>
                <Divider sx={{ mb: 1 }} />
              </Grid>
              <Grid item xs={4}>
                <Typography variant="caption" color="text.secondary">Stock Quantity</Typography>
                <Typography variant="body2">
                  {componentDetail.stock_quantity != null ? componentDetail.stock_quantity.toLocaleString() : '-'}
                </Typography>
              </Grid>
              <Grid item xs={4}>
                <Typography variant="caption" color="text.secondary">Lead Time</Typography>
                <Typography variant="body2">
                  {componentDetail.lead_time_days != null ? `${componentDetail.lead_time_days} days` : '-'}
                </Typography>
              </Grid>
              <Grid item xs={4}>
                <Typography variant="caption" color="text.secondary">MOQ</Typography>
                <Typography variant="body2">{componentDetail.moq || '-'}</Typography>
              </Grid>
              {componentDetail.pricing && componentDetail.pricing.length > 0 && (
                <Grid item xs={12}>
                  <Typography variant="caption" color="text.secondary">Price Breaks</Typography>
                  <Stack direction="row" spacing={1} sx={{ mt: 0.5, flexWrap: 'wrap', gap: 0.5 }}>
                    {componentDetail.pricing.slice(0, 5).map((pb, idx) => (
                      <Chip
                        key={idx}
                        label={`${pb.quantity}+ @ ${pb.currency || '$'}${pb.price.toFixed(4)}`}
                        size="small"
                        variant="outlined"
                      />
                    ))}
                    {componentDetail.pricing.length > 5 && (
                      <Chip label={`+${componentDetail.pricing.length - 5} more`} size="small" />
                    )}
                  </Stack>
                </Grid>
              )}

              {/* Parameters */}
              {componentDetail.parameters && Object.keys(componentDetail.parameters).length > 0 && (
                <>
                  <Grid item xs={12} sx={{ mt: 1 }}>
                    <Typography variant="subtitle2" color="primary" gutterBottom>
                      Parameters
                    </Typography>
                    <Divider sx={{ mb: 1 }} />
                  </Grid>
                  <Grid item xs={12}>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                      {Object.entries(componentDetail.parameters).slice(0, 12).map(([key, value]) => (
                        <Chip
                          key={key}
                          label={`${key}: ${value}`}
                          size="small"
                          variant="outlined"
                          sx={{ maxWidth: 200 }}
                        />
                      ))}
                      {Object.keys(componentDetail.parameters).length > 12 && (
                        <Chip label={`+${Object.keys(componentDetail.parameters).length - 12} more`} size="small" />
                      )}
                    </Box>
                  </Grid>
                </>
              )}

              {/* Datasheet Link */}
              {componentDetail.datasheet_url && (
                <Grid item xs={12} sx={{ mt: 1 }}>
                  <Link
                    href={componentDetail.datasheet_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
                  >
                    <DescriptionIcon fontSize="small" />
                    View Datasheet
                    <OpenInNewIcon fontSize="small" />
                  </Link>
                </Grid>
              )}
            </Grid>
          ) : (
            <Typography color="text.secondary" align="center" py={2}>
              No component details available
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={closeComponentDetail}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
