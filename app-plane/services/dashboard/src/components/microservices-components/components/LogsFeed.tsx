/**
 * Logs Feed Component
 *
 * Real-time logs display with filtering and search
 */

import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Collapse,
} from '@mui/material';
import {
  FilterList,
  Search,
  ExpandMore,
  Code,
  Info,
  Warning,
  Error as ErrorIcon,
  BugReport,
} from '@mui/icons-material';
import { LogEntry, LogSeverity } from '../../../microservices-lib/types';

interface LogsFeedProps {
  logs: LogEntry[];
  compact?: boolean;
}

const getSeverityColor = (severity: LogSeverity): string => {
  switch (severity) {
    case 'debug': return '#9e9e9e';
    case 'info': return '#4fc3f7';
    case 'warning': return '#ff9800';
    case 'error': return '#f44336';
    case 'critical': return '#d32f2f';
    default: return '#9e9e9e';
  }
};

const getSeverityIcon = (severity: LogSeverity) => {
  switch (severity) {
    case 'debug': return <Code sx={{ fontSize: 16 }} />;
    case 'info': return <Info sx={{ fontSize: 16 }} />;
    case 'warning': return <Warning sx={{ fontSize: 16 }} />;
    case 'error': return <ErrorIcon sx={{ fontSize: 16 }} />;
    case 'critical': return <BugReport sx={{ fontSize: 16 }} />;
    default: return <Info sx={{ fontSize: 16 }} />;
  }
};

const LogsFeed: React.FC<LogsFeedProps> = ({ logs, compact = false }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [severityFilter, setSeverityFilter] = useState<LogSeverity | 'all'>('all');
  const [serviceFilter, setServiceFilter] = useState('all');
  const [expandedLog, setExpandedLog] = useState<string | null>(null);

  // Get unique services
  const services = Array.from(new Set(logs.map(log => log.serviceName)));

  // Filter logs
  const filteredLogs = logs.filter(log => {
    const matchesSearch = log.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         log.serviceName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSeverity = severityFilter === 'all' || log.severity === severityFilter;
    const matchesService = serviceFilter === 'all' || log.serviceName === serviceFilter;

    return matchesSearch && matchesSeverity && matchesService;
  });

  const toggleExpand = (logId: string) => {
    setExpandedLog(expandedLog === logId ? null : logId);
  };

  if (compact) {
    return (
      <Box sx={{ maxHeight: 400, overflow: 'auto' }}>
        {filteredLogs.map(log => (
          <Box
            key={log.id}
            sx={{
              p: 1.5,
              borderBottom: '1px solid #2a2f3e',
              '&:hover': { bgcolor: '#0a0e1a' },
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
              <Box sx={{ color: getSeverityColor(log.severity) }}>
                {getSeverityIcon(log.severity)}
              </Box>
              <Chip
                label={log.serviceName}
                size="small"
                sx={{ bgcolor: '#4fc3f720', color: '#4fc3f7', fontSize: '0.7rem' }}
              />
              <Typography variant="caption" sx={{ color: '#8b92a7' }}>
                {new Date(log.timestamp).toLocaleTimeString()}
              </Typography>
            </Box>
            <Typography variant="body2" sx={{ color: '#fff' }}>
              {log.message}
            </Typography>
          </Box>
        ))}
      </Box>
    );
  }

  return (
    <Box>
      {/* Filters */}
      <Paper sx={{ p: 2, mb: 3, bgcolor: '#1a1f2e' }}>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <TextField
            placeholder="Search logs..."
            size="small"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: <Search sx={{ color: '#8b92a7', mr: 1 }} />,
            }}
            sx={{
              flex: 1,
              minWidth: 200,
              '& .MuiInputBase-root': { color: '#fff', bgcolor: '#0a0e1a' },
            }}
          />

          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel sx={{ color: '#8b92a7' }}>Severity</InputLabel>
            <Select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value as any)}
              label="Severity"
              sx={{ color: '#fff', bgcolor: '#0a0e1a' }}
            >
              <MenuItem value="all">All Severities</MenuItem>
              <MenuItem value="debug">Debug</MenuItem>
              <MenuItem value="info">Info</MenuItem>
              <MenuItem value="warning">Warning</MenuItem>
              <MenuItem value="error">Error</MenuItem>
              <MenuItem value="critical">Critical</MenuItem>
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel sx={{ color: '#8b92a7' }}>Service</InputLabel>
            <Select
              value={serviceFilter}
              onChange={(e) => setServiceFilter(e.target.value)}
              label="Service"
              sx={{ color: '#fff', bgcolor: '#0a0e1a' }}
            >
              <MenuItem value="all">All Services</MenuItem>
              {services.map(service => (
                <MenuItem key={service} value={service}>{service}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>

        <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
          <Typography variant="body2" sx={{ color: '#8b92a7' }}>
            Showing {filteredLogs.length} of {logs.length} logs
          </Typography>
        </Box>
      </Paper>

      {/* Logs Table */}
      <TableContainer component={Paper} sx={{ bgcolor: '#1a1f2e' }}>
        <Table>
          <TableHead>
            <TableRow sx={{ bgcolor: '#0a0e1a' }}>
              <TableCell sx={{ color: '#8b92a7', width: 40 }}></TableCell>
              <TableCell sx={{ color: '#8b92a7', width: 120 }}>Timestamp</TableCell>
              <TableCell sx={{ color: '#8b92a7', width: 80 }}>Severity</TableCell>
              <TableCell sx={{ color: '#8b92a7', width: 150 }}>Service</TableCell>
              <TableCell sx={{ color: '#8b92a7' }}>Message</TableCell>
              <TableCell sx={{ color: '#8b92a7', width: 100 }}>Trace ID</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredLogs.map(log => (
              <React.Fragment key={log.id}>
                <TableRow
                  sx={{
                    '&:hover': { bgcolor: '#0a0e1a' },
                    cursor: log.details ? 'pointer' : 'default',
                  }}
                  onClick={() => log.details && toggleExpand(log.id)}
                >
                  <TableCell>
                    {log.details && (
                      <IconButton size="small">
                        <ExpandMore
                          sx={{
                            color: '#8b92a7',
                            transform: expandedLog === log.id ? 'rotate(180deg)' : 'none',
                            transition: 'transform 0.3s',
                          }}
                        />
                      </IconButton>
                    )}
                  </TableCell>
                  <TableCell sx={{ color: '#8b92a7', fontSize: '0.75rem' }}>
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </TableCell>
                  <TableCell>
                    <Chip
                      icon={getSeverityIcon(log.severity)}
                      label={log.severity}
                      size="small"
                      sx={{
                        bgcolor: `${getSeverityColor(log.severity)}20`,
                        color: getSeverityColor(log.severity),
                        fontWeight: 600,
                        fontSize: '0.7rem',
                      }}
                    />
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={log.serviceName}
                      size="small"
                      sx={{ bgcolor: '#4fc3f720', color: '#4fc3f7' }}
                    />
                  </TableCell>
                  <TableCell sx={{ color: '#fff' }}>
                    {log.message}
                  </TableCell>
                  <TableCell sx={{ color: '#8b92a7', fontFamily: 'monospace', fontSize: '0.7rem' }}>
                    {log.traceId ? log.traceId.substring(0, 8) : '-'}
                  </TableCell>
                </TableRow>

                {log.details && (
                  <TableRow>
                    <TableCell colSpan={6} sx={{ py: 0, border: 0 }}>
                      <Collapse in={expandedLog === log.id}>
                        <Box sx={{ p: 2, bgcolor: '#0a0e1a', m: 1, borderRadius: 1 }}>
                          <Typography variant="subtitle2" sx={{ color: '#fff', mb: 1 }}>
                            Details:
                          </Typography>
                          <Box
                            component="pre"
                            sx={{
                              color: '#4fc3f7',
                              fontFamily: 'monospace',
                              fontSize: '0.75rem',
                              overflow: 'auto',
                              maxHeight: 200,
                            }}
                          >
                            {JSON.stringify(log.details, null, 2)}
                          </Box>
                        </Box>
                      </Collapse>
                    </TableCell>
                  </TableRow>
                )}
              </React.Fragment>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

export default LogsFeed;
