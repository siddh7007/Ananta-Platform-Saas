import React, { useEffect, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  CircularProgress,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  Collapse,
  Chip,
  Stack,
} from '@mui/material';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';

import { CNS_API_URL, getAuthHeaders } from '../config/api';

interface SupplierResponseRow {
  id: string;
  job_id?: string;
  line_id?: string;
  mpn: string;
  manufacturer?: string;
  vendor?: string;
  payload: Record<string, unknown>;
  normalized?: Record<string, unknown>;
  created_at?: string;
}

const SupplierResponsesView = () => {
  const [rows, setRows] = useState<SupplierResponseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);

  useEffect(() => {
    const fetchResponses = async () => {
      try {
        setLoading(true);
        setError(null);

        const headers: Record<string, string> = { Accept: 'application/json' };
        const authHeaders = getAuthHeaders();
        if (authHeaders instanceof Headers) {
          authHeaders.forEach((value, key) => {
            headers[key] = value;
          });
        } else if (Array.isArray(authHeaders)) {
          authHeaders.forEach(([key, value]) => {
            headers[key] = value;
          });
        } else if (authHeaders) {
          Object.assign(headers, authHeaders);
        }

        const response = await fetch(`${CNS_API_URL}/admin/supplier-responses?limit=200`, {
          headers,
        });

        if (!response.ok) {
          throw new Error(`Supplier responses request failed (${response.status})`);
        }

        const data = await response.json();
        setRows(data?.data ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load supplier responses');
      } finally {
        setLoading(false);
      }
    };

    fetchResponses();
  }, []);

  if (loading) {
    return (
      <Box p={3} display="flex" justifyContent="center" alignItems="center" minHeight="300px">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box p={3}>
        <Card>
          <CardContent>
            <Typography variant="h6" color="error" gutterBottom>
              Failed to load supplier responses
            </Typography>
            <Typography variant="body2" color="textSecondary">
              {error}
            </Typography>
          </CardContent>
        </Card>
      </Box>
    );
  }

  return (
    <Box p={3}>
      <Box mb={3}>
        <Typography variant="h4" gutterBottom>
          Supplier Responses
        </Typography>
        <Typography variant="body2" color="textSecondary">
          Raw supplier API payloads captured during enrichment. Expand a row to compare supplier data against normalized output.
        </Typography>
      </Box>

      <TableContainer component={Card}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell />
              <TableCell>MPN</TableCell>
              <TableCell>Vendor</TableCell>
              <TableCell>Manufacturer</TableCell>
              <TableCell>Job</TableCell>
              <TableCell>Line</TableCell>
              <TableCell>Captured</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row) => {
              const isExpanded = expandedRowId === row.id;
              return (
                <React.Fragment key={row.id}>
                  <TableRow key={row.id} hover>
                    <TableCell padding="checkbox">
                      <IconButton size="small" onClick={() => setExpandedRowId(isExpanded ? null : row.id)}>
                        {isExpanded ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
                      </IconButton>
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <span>{row.mpn}</span>
                        <Chip label={row.vendor || 'unknown'} size="small" />
                      </Stack>
                    </TableCell>
                    <TableCell>{row.vendor || '—'}</TableCell>
                    <TableCell>{row.manufacturer || '—'}</TableCell>
                    <TableCell>{row.job_id || '—'}</TableCell>
                    <TableCell>{row.line_id || '—'}</TableCell>
                    <TableCell>{row.created_at ? new Date(row.created_at).toLocaleString() : '—'}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={7}>
                      <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                        <Box margin={2}>
                          <Stack direction={{ xs: 'column', md: 'row' }} spacing={3}>
                            <Box flex={1} minWidth={0}>
                              <Typography variant="subtitle1" gutterBottom>
                                Supplier Payload
                              </Typography>
                              <Card variant="outlined">
                                <CardContent>
                                  <pre style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(row.payload, null, 2)}</pre>
                                </CardContent>
                              </Card>
                            </Box>
                            <Box flex={1} minWidth={0}>
                              <Typography variant="subtitle1" gutterBottom>
                                Normalized Snapshot
                              </Typography>
                              <Card variant="outlined">
                                <CardContent>
                                  {row.normalized ? (
                                    <pre style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(row.normalized, null, 2)}</pre>
                                  ) : (
                                    <Typography variant="body2" color="textSecondary">
                                      No normalized data captured
                                    </Typography>
                                  )}
                                </CardContent>
                              </Card>
                            </Box>
                          </Stack>
                        </Box>
                      </Collapse>
                    </TableCell>
                  </TableRow>
                </React.Fragment>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

export default SupplierResponsesView;
