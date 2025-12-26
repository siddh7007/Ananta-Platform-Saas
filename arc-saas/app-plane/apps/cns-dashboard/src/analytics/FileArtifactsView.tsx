import React, { useEffect, useState, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  CircularProgress,
  Typography,
  Stack,
  TextField,
  MenuItem,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import SearchIcon from '@mui/icons-material/Search';

import { CNS_API_URL, getAdminAuthHeaders } from '../config/api';

interface ArtifactRecord {
  id: string;
  filename_disk?: string;
  filename_download?: string;
  title?: string;
  description?: string;
  type?: string;
  created_on?: string;
  uploaded_on?: string;
  metadata: Record<string, string>;
  download_url?: string | null;
  download_expires_in?: number | null;
}

interface ArtifactResponse {
  items: ArtifactRecord[];
  count: number;
}

const defaultFilters = {
  bomId: '',
  organizationId: '',
  artifactKind: '',
  limit: 50,
};

const artifactKindOptions = [
  { value: '', label: 'All' },
  { value: 'raw', label: 'Raw Upload' },
  { value: 'parsed', label: 'Parsed Snapshot' },
  { value: 'audit', label: 'Audit CSV' },
];

export const FileArtifactsView: React.FC = () => {
  const [artifacts, setArtifacts] = useState<ArtifactRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState(defaultFilters);
  const [formState, setFormState] = useState(defaultFilters);

  const fetchArtifacts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const headers: Record<string, string> = { Accept: 'application/json' };
      const authHeaders = getAdminAuthHeaders();
      if (authHeaders instanceof Headers) {
        authHeaders.forEach((value, key) => (headers[key] = value));
      } else if (Array.isArray(authHeaders)) {
        authHeaders.forEach(([key, value]) => (headers[key] = value));
      } else if (authHeaders) {
        Object.assign(headers, authHeaders);
      }

      const params = new URLSearchParams();
      params.set('limit', String(filters.limit || 50));
      if (filters.bomId) params.set('bom_id', filters.bomId);
      if (filters.organizationId) params.set('organization_id', filters.organizationId);
      if (filters.artifactKind) params.set('artifact_kind', filters.artifactKind);

      const response = await fetch(`${CNS_API_URL}/admin/directus/artifacts?${params.toString()}`, {
        headers,
      });

      if (!response.ok) {
        throw new Error(`Artifact request failed (${response.status})`);
      }

      const data: ArtifactResponse = await response.json();
      setArtifacts(data.items ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load artifacts');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    void fetchArtifacts();
  }, [fetchArtifacts]);

  const handleApplyFilters = () => {
    setFilters(formState);
  };

  const handleResetFilters = () => {
    setFormState(defaultFilters);
    setFilters(defaultFilters);
  };

  const renderMetadataChips = (metadata: Record<string, string>) => {
    const chips: { label: string; color?: 'default' | 'primary' | 'secondary' }[] = [];
    if (metadata.artifact_kind) {
      chips.push({ label: metadata.artifact_kind.toUpperCase(), color: 'primary' });
    }
    if (metadata.source) {
      chips.push({ label: metadata.source });
    }
    if (metadata.organization_id) {
      chips.push({ label: metadata.organization_id.slice(0, 8) });
    }
    return (
      <Stack direction="row" spacing={1} flexWrap="wrap">
        {chips.map((chip) => (
          <Chip key={`${chip.label}-${chip.color}`} label={chip.label} color={chip.color} size="small" />
        ))}
      </Stack>
    );
  };

  if (loading) {
    return (
      <Box p={3} display="flex" justifyContent="center" alignItems="center" minHeight="340px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box p={3}>
      <Box mb={3}>
        <Typography variant="h4" gutterBottom>
          File Artifacts
        </Typography>
        <Typography variant="body2" color="textSecondary">
          Raw uploads, parsed snapshots, and audit CSVs registered in Directus. Filter by BOM, tenant, or artifact type to
          trace the files stored in MinIO/S3.
        </Typography>
      </Box>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
            <TextField
              label="BOM ID"
              value={formState.bomId}
              onChange={(e) => setFormState({ ...formState, bomId: e.target.value })}
              fullWidth
            />
            <TextField
              label="Organization ID"
              value={formState.organizationId}
              onChange={(e) => setFormState({ ...formState, organizationId: e.target.value })}
              fullWidth
            />
            <TextField
              label="Artifact Type"
              select
              fullWidth
              value={formState.artifactKind}
              onChange={(e) => setFormState({ ...formState, artifactKind: e.target.value })}
            >
              {artifactKindOptions.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Limit"
              type="number"
              inputProps={{ min: 1, max: 200 }}
              value={formState.limit}
              onChange={(e) => setFormState({ ...formState, limit: Number(e.target.value) })}
              fullWidth
            />
          </Stack>
          <Stack direction="row" spacing={2} justifyContent="flex-end" mt={2}>
            <Button variant="outlined" onClick={handleResetFilters}>
              Reset
            </Button>
            <Button
              variant="contained"
              startIcon={<SearchIcon />}
              onClick={handleApplyFilters}
            >
              Apply Filters
            </Button>
            <Button variant="text" startIcon={<RefreshIcon />} onClick={fetchArtifacts}>
              Refresh
            </Button>
          </Stack>
        </CardContent>
      </Card>

      {error && (
        <Box mb={3}>
          <Card>
            <CardContent>
              <Typography variant="h6" color="error" gutterBottom>
                Failed to load artifacts
              </Typography>
              <Typography variant="body2" color="textSecondary">
                {error}
              </Typography>
            </CardContent>
          </Card>
        </Box>
      )}

      <TableContainer component={Card}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>File</TableCell>
              <TableCell>Title</TableCell>
              <TableCell>Metadata</TableCell>
              <TableCell>Bucket / Key</TableCell>
              <TableCell>Created</TableCell>
              <TableCell>Download</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {artifacts.map((artifact) => {
              const metadata = artifact.metadata || {};
              const sourceBucket = metadata.source_bucket || 'bulk-uploads';
              const sourceKey = metadata.source_key || artifact.filename_disk;
              return (
                <TableRow key={artifact.id} hover>
                  <TableCell>
                    <Stack spacing={0.5}>
                      <Typography variant="subtitle2">{artifact.filename_download || artifact.title || 'File'}</Typography>
                      <Typography variant="caption" color="textSecondary">
                        {artifact.type || 'unknown'}
                      </Typography>
                    </Stack>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{artifact.title || '—'}</Typography>
                    <Typography variant="caption" color="textSecondary">
                      {artifact.description || '—'}
                    </Typography>
                  </TableCell>
                  <TableCell>{renderMetadataChips(metadata)}</TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                      {sourceBucket}
                    </Typography>
                    <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
                      {sourceKey}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {artifact.created_on ? new Date(artifact.created_on).toLocaleString() : '—'}
                    </Typography>
                    <Typography variant="caption" color="textSecondary">
                      ID: {artifact.id}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {artifact.download_url ? (
                      <Button
                        variant="outlined"
                        size="small"
                        component="a"
                        href={artifact.download_url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Download
                      </Button>
                    ) : (
                      <Typography variant="caption" color="textSecondary">
                        Not available
                      </Typography>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
            {artifacts.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} align="center">
                  <Typography variant="body2" color="textSecondary">
                    No artifacts found for the selected filters.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

export default FileArtifactsView;
