import React, { useCallback, useEffect, useState } from 'react';
import { Box, Card, CardContent, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Button } from '@mui/material';

const CNS_API_BASE_URL = process.env.NEXT_PUBLIC_CNS_API_URL || 'http://localhost:27800/api';
const ADMIN_API_TOKEN = process.env.NEXT_PUBLIC_ADMIN_API_TOKEN || '';

export const WorkflowMonitor: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [gaps, setGaps] = useState<any | null>(null);
  const [events, setEvents] = useState<any[]>([]);

  const fetchGaps = useCallback(async () => {
    try {
      const headers: Record<string, string> = {};
      if (ADMIN_API_TOKEN) headers['Authorization'] = `Bearer ${ADMIN_API_TOKEN}`;
      const res = await fetch(`${CNS_API_BASE_URL}/admin/mapping-gaps`, { headers });
      if (!res.ok) {
        setGaps(null);
        return;
      }
      const json = await res.json();
      setGaps(json);
    } catch (err) {
      console.error('Failed to fetch mapping gaps', err);
      setGaps(null);
    }
  }, []);

  const fetchEvents = useCallback(async () => {
    try {
      const headers: Record<string, string> = {};
      if (ADMIN_API_TOKEN) headers['Authorization'] = `Bearer ${ADMIN_API_TOKEN}`;
      const res = await fetch(`${CNS_API_BASE_URL}/admin/audit/logs?time_range=24h&limit=50`, { headers });
      if (!res.ok) {
        setEvents([]);
        return;
      }
      const json = await res.json();
      setEvents((json || []).filter((ev: any) => ev.routing_key && ev.routing_key.startsWith('admin.')));
    } catch (err) {
      console.error('Failed to fetch admin events', err);
      setEvents([]);
    }
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await Promise.all([fetchGaps(), fetchEvents()]);
      setLoading(false);
    })();
  }, [fetchGaps, fetchEvents]);

  return (
    <Box p={3}>
      <Typography variant="h4" gutterBottom>Workflow Monitor</Typography>
      <Typography variant="body2" color="textSecondary" gutterBottom>Monitoring mapping gap reports and admin workflow events.</Typography>

      <Box mt={2} display="grid" gridTemplateColumns="1fr 2fr" gap={20}>
        <Card>
          <CardContent>
            <Typography variant="h6">Mapping Gaps</Typography>
            <Typography variant="body2" color="textSecondary">Summary of detected mapping gaps</Typography>
            <Box mt={2}>
              <Typography variant="h3">{gaps ? gaps.rows_count.toLocaleString() : '—'}</Typography>
              <Typography color="textSecondary">Last modified: {gaps && gaps.last_modified ? new Date(gaps.last_modified).toLocaleString() : '—'}</Typography>
              <Box mt={2}>
                {gaps && gaps.sample_rows && gaps.sample_rows.length > 0 ? (
                  <TableContainer component={Paper} variant="outlined">
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Source ID</TableCell>
                          <TableCell>Source Path</TableCell>
                          <TableCell>Gap Reason</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {gaps.sample_rows.map((r: any, i: number) => (
                          <TableRow key={i} hover>
                            <TableCell>{r.source_id || '-'}</TableCell>
                            <TableCell>{r.source_path || '-'}</TableCell>
                            <TableCell>{r.gap_reason || '-'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                ) : (
                  <Typography variant="body2" color="textSecondary">No sample rows</Typography>
                )}
              </Box>

              <Box mt={2} display="flex" gap={2}>
                <Button variant="contained" color="primary" size="small" href={`${CNS_API_BASE_URL}/admin/mapping-gaps/download`} target="_blank">Download CSV</Button>
              </Box>
            </Box>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Typography variant="h6">Worker/Admin Events</Typography>
            <Typography variant="body2" color="textSecondary">Recent admin events (mapping gap notifications, workflow signals)</Typography>

            <Box mt={2}>
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Timestamp</TableCell>
                      <TableCell>Event Type</TableCell>
                      <TableCell>Routing Key</TableCell>
                      <TableCell>Details</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {events.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} align="center">No admin events in the last 24 hours</TableCell>
                      </TableRow>
                    ) : (
                      events.map((ev, i) => (
                        <TableRow key={i} hover>
                          <TableCell>{ev.timestamp ? new Date(ev.timestamp).toLocaleString() : '-'}</TableCell>
                          <TableCell>{ev.event_type}</TableCell>
                          <TableCell>{ev.routing_key}</TableCell>
                          <TableCell>{ev.event_data ? JSON.stringify(ev.event_data) : '-'}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          </CardContent>
        </Card>
      </Box>
    </Box>
  );
};

export default WorkflowMonitor;
