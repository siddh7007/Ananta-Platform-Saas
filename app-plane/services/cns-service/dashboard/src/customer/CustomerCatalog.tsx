import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  CardHeader,
  Typography,
  TextField,
  Grid,
  Button,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Chip,
  LinearProgress,
  Collapse,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
  Stack,
  Link,
  Paper,
} from '@mui/material';
import type { ChipProps } from '@mui/material/Chip';
import RefreshIcon from '@mui/icons-material/Refresh';
import SearchIcon from '@mui/icons-material/Search';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import MemoryIcon from '@mui/icons-material/Memory';
import DescriptionIcon from '@mui/icons-material/Description';
import InfoIcon from '@mui/icons-material/Info';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import { supabase } from '../supabaseClient';
import { useTenant } from '../contexts/TenantContext';
import AsyncAutocomplete, { Option } from '../components/AsyncAutocomplete';
import { API_CONFIG, getAuthHeaders } from '../config/api';

interface CatalogRow {
  id: string;
  tenant_id?: string;
  project_id?: string;
  bom_id?: string;
  line_number?: number;
  manufacturer_part_number?: string;
  manufacturer?: string;
  description?: string;
  enrichment_status?: string;
  component_id?: string | null;
  // Enhanced fields from component catalog
  image_url?: string;
  datasheet_url?: string;
  quality_score?: number;
  lifecycle_status?: string;
  category?: string;
  rohs_compliant?: boolean;
  reach_compliant?: boolean;
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

export default function CustomerCatalog() {
  const { tenantId, adminModeAllTenants } = useTenant();
  const [rows, setRows] = useState<CatalogRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(50);
  const [total, setTotal] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [tenantFilter, setTenantFilter] = useState('');
  const [projectFilter, setProjectFilter] = useState('');
  const [bomFilter, setBomFilter] = useState('');
  const [tenantOpt, setTenantOpt] = useState<Option | null>(null);
  const [projectOpt, setProjectOpt] = useState<Option | null>(null);
  const [bomOpt, setBomOpt] = useState<Option | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [statusFilters, setStatusFilters] = useState<string[]>([]);
  const autoLoadSkipRef = useRef(true);

  // Component detail dialog state
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [componentDetail, setComponentDetail] = useState<ComponentDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const STATUS_OPTIONS: Array<{ value: string; label: string; color: ChipProps['color'] }> = [
    { value: 'production', label: 'Production', color: 'success' },
    { value: 'staging', label: 'Staging', color: 'warning' },
    { value: 'rejected', label: 'Rejected', color: 'error' },
    { value: 'pending', label: 'Pending', color: 'info' },
  ];

  const toggleStatusFilter = (value: string) => {
    setStatusFilters((prev) => (prev.includes(value) ? prev.filter((s) => s !== value) : [...prev, value]));
  };

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (search.trim()) count += 1;
    if (adminModeAllTenants && (tenantOpt?.id || tenantFilter)) count += 1;
    if (projectOpt?.id || projectFilter) count += 1;
    if (bomOpt?.id || bomFilter) count += 1;
    if (statusFilters.length) count += 1;
    return count;
  }, [search, adminModeAllTenants, tenantOpt, tenantFilter, projectOpt, projectFilter, bomOpt, bomFilter, statusFilters]);

  const load = async (overrides?: {
    page?: number;
    tenantId?: string;
    projectId?: string;
    bomId?: string;
    searchTerm?: string;
  }) => {
    setLoading(true);
    try {
      const adminHeaders = getAuthHeaders();
      const adminRequestOptions: RequestInit = adminHeaders ? { headers: adminHeaders } : {};
      const envPrefersAdmin = ((import.meta as any).env?.VITE_CNS_USE_ADMIN_DATA || 'false') === 'true';
      const sanitizeQueryValue = (value?: string | null) => {
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
      const searchOverride = overrides?.searchTerm;

      const tenantForQuery = sanitizeQueryValue(adminModeAllTenants
        ? tenantOverride ?? tenantOpt?.id ?? tenantFilter
        : tenantId);
      const projectForQuery = sanitizeQueryValue(projectOverride ?? projectOpt?.id ?? projectFilter);
      const bomForQuery = sanitizeQueryValue(bomOverride ?? bomOpt?.id ?? bomFilter);
      const searchValue = searchOverride ?? search;

      console.log('[CustomerCatalog] load start', {
        source: envPrefersAdmin || adminHeaders ? 'admin-api' : 'supabase',
        pageIndex,
        tenantForQuery,
        projectForQuery,
        bomForQuery,
        searchValue,
        statusFilters,
      });

      if (envPrefersAdmin || adminHeaders) {
        try {
          const url = new URL(`${API_CONFIG.BASE_URL}/admin/line-items`, window.location.origin);
          if (tenantForQuery) url.searchParams.set('tenant_id', tenantForQuery);
          if (projectForQuery) url.searchParams.set('project_id', projectForQuery);
          if (bomForQuery) url.searchParams.set('bom_id', bomForQuery);
          if (searchValue) url.searchParams.set('search', searchValue);
          url.searchParams.set('limit', String(rowsPerPage));
          url.searchParams.set('offset', String(pageIndex * rowsPerPage));
          const res = await fetch(url.toString(), adminRequestOptions);
          if (!res.ok) throw new Error(await res.text());
          const raw: CatalogRow[] = await res.json();
          let mapped: CatalogRow[] = (raw || []).map((row: CatalogRow) => ({
            ...row,
            enrichment_status: typeof row.enrichment_status === 'string'
              ? row.enrichment_status.toLowerCase()
              : row.enrichment_status,
          }));
          if (statusFilters.length) {
            mapped = mapped.filter((row: CatalogRow) => statusFilters.includes((row.enrichment_status || '').toLowerCase()));
          }
          setRows(mapped || []);
          usedAdmin = true;
          console.log('[CustomerCatalog] admin load success', {
            count: mapped.length,
            tenantForQuery,
            projectForQuery,
            bomForQuery,
            searchValue,
            statusFilters,
          });
          try {
            const cUrl = new URL(`${API_CONFIG.BASE_URL}/admin/line-items/count`, window.location.origin);
            if (tenantForQuery) cUrl.searchParams.set('tenant_id', tenantForQuery);
            if (projectForQuery) cUrl.searchParams.set('project_id', projectForQuery);
            if (bomForQuery) cUrl.searchParams.set('bom_id', bomForQuery);
            if (searchValue) cUrl.searchParams.set('search', searchValue);
            const cRes = await fetch(cUrl.toString(), adminRequestOptions);
            if (cRes.ok) {
              const cj = await cRes.json();
              setTotal(typeof cj?.total === 'number' ? cj.total : null);
            } else {
              setTotal(null);
            }
          } catch {
            setTotal(null);
          }
        } catch (adminErr) {
          console.warn('[CustomerCatalog] admin API load failed, falling back to Supabase', adminErr);
        }
      }

      if (!usedAdmin) {
        let query = supabase
          .from('bom_line_items')
          .select(`
            id,
            bom_id,
            line_number,
            manufacturer_part_number,
            manufacturer,
            description,
            enrichment_status,
            component_id,
            boms!inner(tenant_id, project_id)
          `)
          .order('created_at', { ascending: false })
          .range(pageIndex * rowsPerPage, pageIndex * rowsPerPage + rowsPerPage - 1);
        console.log('[CustomerCatalog] supabase query built', {
          tenantForQuery,
          projectForQuery,
          bomForQuery,
          searchValue,
          statusFilters,
        });

        if (tenantForQuery) {
          query = query.eq('boms.tenant_id', tenantForQuery);
        }

        if (projectForQuery) {
          query = query.eq('boms.project_id', projectForQuery);
        }
        if (bomForQuery) query = query.eq('bom_id', bomForQuery);
        if (searchValue) {
          const pattern = `%${searchValue}%`;
          const anyQ: any = query as any;
          if (typeof anyQ.or === 'function') {
            query = anyQ.or(
              `manufacturer_part_number.ilike.${pattern},manufacturer.ilike.${pattern},description.ilike.${pattern}`
            );
          } else {
            query = query.like('manufacturer_part_number', pattern);
          }
        }
        if (statusFilters.length) {
          const anyQ: any = query as any;
          if (typeof anyQ.in === 'function') {
            query = anyQ.in('enrichment_status', statusFilters);
          } else {
            query = query.eq('enrichment_status', statusFilters[0]);
          }
        }

        const { data, error } = await query;
        if (error) throw error;
        const normalized = (data || []).map((row: any) => {
          const nested = row.boms || {};
          const statusValue = typeof row.enrichment_status === 'string'
            ? row.enrichment_status.toLowerCase()
            : row.enrichment_status;
          return {
            id: row.id,
            bom_id: row.bom_id,
            line_number: row.line_number,
            manufacturer_part_number: row.manufacturer_part_number,
            manufacturer: row.manufacturer,
            description: row.description,
            enrichment_status: statusValue,
            component_id: row.component_id,
            tenant_id: nested?.tenant_id,
            project_id: nested?.project_id,
          } as CatalogRow;
        });
        setRows(normalized);
        console.log('[CustomerCatalog] supabase load success', {
          count: normalized.length,
          tenantForQuery,
          projectForQuery,
          bomForQuery,
          searchValue,
          statusFilters,
        });
      }
    } catch (e) {
      console.error('CustomerCatalog load error', e);
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    const tenantOverride = adminModeAllTenants ? tenantOpt?.id || tenantFilter || undefined : undefined;
    const projectOverride = projectOpt?.id || projectFilter || undefined;
    const bomOverride = bomOpt?.id || bomFilter || undefined;
    console.log('[CustomerCatalog] search submit', {
      tenantOverride,
      projectOverride,
      bomOverride,
      search,
      statusFilters,
    });
    if (page !== 0) setPage(0);
    void load({
      page: 0,
      tenantId: tenantOverride,
      projectId: projectOverride,
      bomId: bomOverride,
      searchTerm: search,
    });
  };

  const handleClear = () => {
    setTenantOpt(null);
    setTenantFilter('');
    setProjectOpt(null);
    setProjectFilter('');
    setBomOpt(null);
    setBomFilter('');
    setSearch('');
    console.log('[CustomerCatalog] filters cleared');
    if (page !== 0) setPage(0);
    setStatusFilters([]);
    void load({ page: 0, tenantId: '', projectId: '', bomId: '', searchTerm: '' });
  };

  useEffect(() => {
    load();
  }, [adminModeAllTenants, tenantId, page, rowsPerPage, statusFilters]);

  useEffect(() => {
    setPage(0);
  }, [statusFilters]);

  useEffect(() => {
    if (autoLoadSkipRef.current) {
      autoLoadSkipRef.current = false;
      return;
    }

    const tenantOverride = adminModeAllTenants ? tenantOpt?.id || tenantFilter || undefined : tenantId;
    const projectOverride = projectOpt?.id || projectFilter || undefined;
    const bomOverride = bomOpt?.id || bomFilter || undefined;

    console.log('[CustomerCatalog] auto-load triggered', {
      tenantOverride,
      projectOverride,
      bomOverride,
      statusFilters,
    });

    if (page !== 0) {
      setPage(0);
    }

    void load({
      page: 0,
      tenantId: tenantOverride,
      projectId: projectOverride,
      bomId: bomOverride,
    });
  }, [adminModeAllTenants, tenantId, tenantOpt, tenantFilter, projectOpt, projectFilter, bomOpt, bomFilter]);
  const totalPages = total != null ? Math.max(1, Math.ceil(total / rowsPerPage)) : null;
  const disablePrev = loading || page === 0;

  const filtered = useMemo(() => {
    if (!statusFilters.length) return rows;
    return rows.filter((r) => statusFilters.includes((r.enrichment_status || '').toLowerCase()));
  }, [rows, statusFilters]);

  const disableNext = loading || (totalPages != null ? page >= totalPages - 1 : filtered.length < rowsPerPage);

  const statusChip = (s?: string) => {
    const map: Record<string, { label: string; color: ChipProps['color'] }>= {
      production: { label: 'Production', color: 'success' },
      staging: { label: 'Staging', color: 'warning' },
      rejected: { label: 'Rejected', color: 'error' },
      pending: { label: 'Pending', color: 'default' },
    };
    const cfg: { label: string; color: ChipProps['color'] } = s && map[s]
      ? map[s]
      : { label: s || 'Unknown', color: 'default' };
    return <Chip label={cfg.label} color={cfg.color} size="small" />;
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

  const qualityScoreChip = (score?: number) => {
    if (score == null) return <Typography variant="caption" color="text.secondary">-</Typography>;
    let color: ChipProps['color'] = 'default';
    if (score >= 80) color = 'success';
    else if (score >= 60) color = 'warning';
    else color = 'error';
    return <Chip label={`${Math.round(score)}`} color={color} size="small" />;
  };

  const complianceIcon = (value?: boolean) => {
    if (value === true) return <CheckCircleIcon fontSize="small" color="success" />;
    if (value === false) return <CancelIcon fontSize="small" color="error" />;
    return <Typography variant="caption" color="text.secondary">-</Typography>;
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
      console.error('[CustomerCatalog] Failed to fetch component details:', err);
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

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="h5">Customer Component Catalog</Typography>
        <Box>
          <Button onClick={()=>load()} startIcon={<RefreshIcon />} disabled={loading} variant="outlined">Refresh</Button>
        </Box>
      </Box>

      <Card sx={{ mb: 2 }}>
        <CardHeader
          title="Filters"
          subheader={activeFilterCount ? `${activeFilterCount} active filter${activeFilterCount > 1 ? 's' : ''}` : undefined}
          action={(
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Button variant="contained" onClick={handleSearch} startIcon={<SearchIcon />} disabled={loading}>Search</Button>
              <Button variant="outlined" onClick={handleClear} disabled={loading || (!activeFilterCount && !search.trim())}>Clear</Button>
              <IconButton
                size="small"
                onClick={()=>setFiltersOpen((open)=>!open)}
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
              <Grid item xs={12} md={2}>
                <AsyncAutocomplete
                  label="Tenant"
                  value={adminModeAllTenants ? tenantOpt : null}
                  onChange={(opt)=>{ setTenantOpt(opt); setTenantFilter(opt?.id || ''); setProjectOpt(null); setProjectFilter(''); setBomOpt(null); setBomFilter(''); }}
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
                    try {
                      const { data } = await supabase
                        .from('organizations')
                        .select('id,name')
                        .ilike('name', `%${query||''}%`)
                        .limit(50);
                      return (data||[]).map((t:any)=>({ id: t.id, label: t.name ? `${t.name} · ${t.id}`: t.id }));
                    } catch {
                      return [];
                    }
                  }}
                />
              </Grid>
              <Grid item xs={12} md={2}>
                <AsyncAutocomplete
                  label="Project"
                  value={projectOpt}
                  onChange={(opt)=>{ setProjectOpt(opt); setProjectFilter(opt?.id || ''); setBomOpt(null); setBomFilter(''); }}
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
                      console.warn('[CustomerCatalog] Failed to load projects', err);
                      return [];
                    }
                  }}
                />
              </Grid>
              <Grid item xs={12} md={2}>
                <AsyncAutocomplete
                  label="BOM"
                  value={bomOpt}
                  onChange={(opt)=>{ setBomOpt(opt); setBomFilter(opt?.id || ''); }}
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
                      console.warn('[CustomerCatalog] Failed to load BOMs', err);
                      return [];
                    }
                  }}
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField fullWidth size="small" label="Search (MPN, Manufacturer, Description)" value={search} onChange={(e)=>setSearch(e.target.value)} InputProps={{ endAdornment: <SearchIcon fontSize="small" /> }} />
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
                {[25,50,100,250,500].map((n)=> (<option key={n} value={n}>{n}</option>))}
              </TextField>
              <Button size="small" onClick={()=>setPage(0)} disabled={disablePrev}>First</Button>
              <Button size="small" onClick={()=>setPage(Math.max(0, page-1))} disabled={disablePrev}>Prev</Button>
              <Box component="span" sx={{ mx: 1 }}>Page {page+1}{totalPages ? ` of ${totalPages}`: ''}{total != null ? ` (Total ${total})` : ''}</Box>
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
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: 'grey.100' }}>
                <TableCell sx={{ width: 50 }} align="center">Image</TableCell>
                <TableCell>MPN</TableCell>
                <TableCell>Manufacturer</TableCell>
                <TableCell sx={{ maxWidth: 200 }}>Description</TableCell>
                <TableCell align="center">Quality</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Lifecycle</TableCell>
                <TableCell align="center">RoHS</TableCell>
                <TableCell>Tenant</TableCell>
                <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.map((r)=> (
                <TableRow key={r.id} hover sx={{ '&:nth-of-type(odd)': { bgcolor: 'grey.50' } }}>
                  {/* Image Column */}
                  <TableCell align="center" sx={{ p: 0.5 }}>
                    {r.image_url ? (
                      <Box
                        component="img"
                        src={r.image_url}
                        alt={r.manufacturer_part_number || 'Component'}
                        sx={{ width: 36, height: 36, objectFit: 'contain', borderRadius: 1, bgcolor: 'grey.100' }}
                        onError={(e: React.SyntheticEvent<HTMLImageElement>) => { e.currentTarget.style.display = 'none'; }}
                      />
                    ) : (
                      <Box sx={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'grey.100', borderRadius: 1 }}>
                        <MemoryIcon sx={{ fontSize: 18, color: 'grey.400' }} />
                      </Box>
                    )}
                  </TableCell>
                  {/* MPN Column */}
                  <TableCell>
                    <Typography variant="body2" fontWeight={600}>{r.manufacturer_part_number || '-'}</Typography>
                  </TableCell>
                  <TableCell>{r.manufacturer || '-'}</TableCell>
                  <TableCell sx={{ maxWidth: 200 }}>
                    <Typography variant="body2" color="text.secondary" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.description || '-'}
                    </Typography>
                  </TableCell>
                  <TableCell align="center">{qualityScoreChip(r.quality_score)}</TableCell>
                  <TableCell>{statusChip(r.enrichment_status)}</TableCell>
                  <TableCell>{lifecycleChip(r.lifecycle_status)}</TableCell>
                  <TableCell align="center">{complianceIcon(r.rohs_compliant)}</TableCell>
                  <TableCell>
                    <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
                      {r.tenant_id ? r.tenant_id.slice(0, 8) + '...' : '-'}
                    </Typography>
                  </TableCell>
                  {/* Actions Column */}
                  <TableCell align="center">
                    {r.component_id && (
                      <Tooltip title="View Details">
                        <IconButton size="small" onClick={() => openComponentDetail(r.component_id)}>
                          <InfoIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                    {r.datasheet_url && (
                      <Tooltip title="View Datasheet">
                        <IconButton size="small" onClick={() => window.open(r.datasheet_url, '_blank')}>
                          <DescriptionIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && !loading && (
                <TableRow>
                  <TableCell colSpan={10} align="center">No catalog entries match the current filters. Adjust filters or run a new enrichment to populate results.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Component Detail Dialog */}
      <Dialog open={detailDialogOpen} onClose={closeComponentDetail} maxWidth="md" fullWidth>
        <DialogTitle>
          <Typography variant="h6">Component Details</Typography>
          {componentDetail && (
            <Typography variant="subtitle2" color="text.secondary">
              {componentDetail.mpn} • {componentDetail.manufacturer}
            </Typography>
          )}
        </DialogTitle>
        <DialogContent dividers>
          {detailLoading ? (
            <Box display="flex" justifyContent="center" alignItems="center" minHeight={200}>
              <LinearProgress sx={{ width: '100%' }} />
            </Box>
          ) : !componentDetail ? (
            <Typography color="text.secondary" align="center">No component details available</Typography>
          ) : (
            <Stack spacing={3}>
              {/* Basic Information */}
              <Box>
                <Typography variant="subtitle1" fontWeight={600} gutterBottom>Basic Information</Typography>
                <Grid container spacing={2}>
                  <Grid item xs={6} md={3}>
                    <Typography variant="caption" color="text.secondary">MPN</Typography>
                    <Typography variant="body1" fontWeight={500}>{componentDetail.mpn}</Typography>
                  </Grid>
                  <Grid item xs={6} md={3}>
                    <Typography variant="caption" color="text.secondary">Manufacturer</Typography>
                    <Typography variant="body1">{componentDetail.manufacturer}</Typography>
                  </Grid>
                  <Grid item xs={6} md={3}>
                    <Typography variant="caption" color="text.secondary">Category</Typography>
                    <Typography variant="body1">{componentDetail.category || '-'}</Typography>
                  </Grid>
                  <Grid item xs={6} md={3}>
                    <Typography variant="caption" color="text.secondary">Quality Score</Typography>
                    <Box mt={0.5}>{qualityScoreChip(componentDetail.quality_score)}</Box>
                  </Grid>
                  <Grid item xs={12}>
                    <Typography variant="caption" color="text.secondary">Description</Typography>
                    <Typography variant="body2">{componentDetail.description || '-'}</Typography>
                  </Grid>
                </Grid>
              </Box>

              <Divider />

              {/* Lifecycle & Compliance */}
              <Box>
                <Typography variant="subtitle1" fontWeight={600} gutterBottom>Lifecycle & Compliance</Typography>
                <Grid container spacing={2}>
                  <Grid item xs={6} md={3}>
                    <Typography variant="caption" color="text.secondary">Lifecycle Status</Typography>
                    <Box mt={0.5}>{lifecycleChip(componentDetail.lifecycle)}</Box>
                  </Grid>
                  <Grid item xs={6} md={3}>
                    <Typography variant="caption" color="text.secondary">Enrichment Source</Typography>
                    <Typography variant="body2">{componentDetail.enrichment_source || '-'}</Typography>
                  </Grid>
                  <Grid item xs={3} md={2}>
                    <Typography variant="caption" color="text.secondary" display="flex" alignItems="center" gap={0.5}>
                      RoHS
                    </Typography>
                    <Typography variant="body2">{componentDetail.rohs || 'Unknown'}</Typography>
                  </Grid>
                  <Grid item xs={3} md={2}>
                    <Typography variant="caption" color="text.secondary" display="flex" alignItems="center" gap={0.5}>
                      REACH
                    </Typography>
                    <Typography variant="body2">{componentDetail.reach || 'Unknown'}</Typography>
                  </Grid>
                  <Grid item xs={3} md={2}>
                    <Typography variant="caption" color="text.secondary">AEC-Q</Typography>
                    <Box>{complianceIcon(componentDetail.aec_qualified)}</Box>
                  </Grid>
                </Grid>
              </Box>

              <Divider />

              {/* Stock & Availability */}
              <Box>
                <Typography variant="subtitle1" fontWeight={600} gutterBottom>Stock & Availability</Typography>
                <Grid container spacing={2}>
                  <Grid item xs={6} md={3}>
                    <Typography variant="caption" color="text.secondary">Stock Status</Typography>
                    <Typography variant="body1">{componentDetail.stock_status || '-'}</Typography>
                  </Grid>
                  <Grid item xs={6} md={3}>
                    <Typography variant="caption" color="text.secondary">Stock Quantity</Typography>
                    <Typography variant="body1">{componentDetail.stock_quantity ?? '-'}</Typography>
                  </Grid>
                  <Grid item xs={6} md={3}>
                    <Typography variant="caption" color="text.secondary">Lead Time</Typography>
                    <Typography variant="body1">{componentDetail.lead_time_days ? `${componentDetail.lead_time_days} days` : '-'}</Typography>
                  </Grid>
                  <Grid item xs={6} md={3}>
                    <Typography variant="caption" color="text.secondary">MOQ</Typography>
                    <Typography variant="body1">{componentDetail.moq ?? '-'}</Typography>
                  </Grid>
                </Grid>
              </Box>

              <Divider />

              {/* Specifications */}
              {componentDetail.specifications && Object.keys(componentDetail.specifications).length > 0 && (
                <Box>
                  <Typography variant="subtitle1" fontWeight={600} gutterBottom>Specifications</Typography>
                  <Paper variant="outlined" sx={{ maxHeight: 200, overflow: 'auto' }}>
                    <Table size="small">
                      <TableBody>
                        {Object.entries(componentDetail.specifications).map(([key, value]) => (
                          <TableRow key={key}>
                            <TableCell component="th" sx={{ fontWeight: 500, width: '40%' }}>
                              {key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                            </TableCell>
                            <TableCell>{typeof value === 'object' ? JSON.stringify(value) : String(value)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </Paper>
                </Box>
              )}

              {/* Parameters */}
              {componentDetail.parameters && Object.keys(componentDetail.parameters).length > 0 && (
                <Box>
                  <Typography variant="subtitle1" fontWeight={600} gutterBottom>Technical Parameters</Typography>
                  <Paper variant="outlined" sx={{ maxHeight: 200, overflow: 'auto' }}>
                    <Table size="small">
                      <TableBody>
                        {Object.entries(componentDetail.parameters).map(([key, value]) => (
                          <TableRow key={key}>
                            <TableCell component="th" sx={{ fontWeight: 500, width: '40%' }}>
                              {key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                            </TableCell>
                            <TableCell>{typeof value === 'object' ? JSON.stringify(value) : String(value)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </Paper>
                </Box>
              )}

              {/* Pricing */}
              {componentDetail.pricing && componentDetail.pricing.length > 0 && (
                <Box>
                  <Typography variant="subtitle1" fontWeight={600} gutterBottom>Pricing</Typography>
                  <Paper variant="outlined">
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Quantity</TableCell>
                          <TableCell align="right">Price</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {componentDetail.pricing.map((priceBreak, idx) => (
                          <TableRow key={idx}>
                            <TableCell>{priceBreak.quantity}+</TableCell>
                            <TableCell align="right">
                              {priceBreak.currency || '$'}{priceBreak.price.toFixed(4)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </Paper>
                </Box>
              )}

              {/* Resources */}
              {(componentDetail.datasheet_url || componentDetail.image_url) && (
                <Box>
                  <Typography variant="subtitle1" fontWeight={600} gutterBottom>Resources</Typography>
                  <Stack direction="row" spacing={2}>
                    {componentDetail.datasheet_url && (
                      <Link
                        href={componentDetail.datasheet_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        underline="hover"
                        sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
                      >
                        <DescriptionIcon fontSize="small" /> Datasheet <OpenInNewIcon fontSize="small" />
                      </Link>
                    )}
                    {componentDetail.image_url && (
                      <Link
                        href={componentDetail.image_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        underline="hover"
                        sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
                      >
                        <MemoryIcon fontSize="small" /> Product Image <OpenInNewIcon fontSize="small" />
                      </Link>
                    )}
                  </Stack>
                </Box>
              )}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={closeComponentDetail}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
