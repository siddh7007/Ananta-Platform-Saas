/**
 * AdminAuditLog
 *
 * Recent activity log with timeline display.
 */

import React from 'react';
import {
  Card,
  CardContent,
  Box,
  Typography,
  Avatar,
  Divider,
  Button,
  Skeleton,
} from '@mui/material';
import HistoryIcon from '@mui/icons-material/History';
import { formatRelativeTime } from '../../utils/dateUtils';

export interface AuditLogEntry {
  id: string;
  action: string;
  actor_email: string;
  target_type: string;
  target_id: string;
  details: string;
  created_at: string;
}

interface AdminAuditLogProps {
  entries: AuditLogEntry[];
  loading?: boolean;
  onExport?: () => void;
}

export function AdminAuditLog({ entries, loading = false, onExport }: AdminAuditLogProps) {
  return (
    <Card>
      <CardContent>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            mb: 2,
          }}
        >
          <Typography variant="h6" fontWeight={600}>
            Recent Activity
          </Typography>
          {onExport && (
            <Button variant="text" size="small" onClick={onExport}>
              Export Logs
            </Button>
          )}
        </Box>

        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 1 }}>
              <Skeleton variant="circular" width={32} height={32} />
              <Box sx={{ flex: 1 }}>
                <Skeleton variant="text" width="60%" />
                <Skeleton variant="text" width="40%" />
              </Box>
            </Box>
          ))
        ) : entries.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <HistoryIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
            <Typography color="text.secondary">No audit log entries yet</Typography>
          </Box>
        ) : (
          <Box>
            {entries.map((log, index) => (
              <Box key={log.id}>
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, py: 1.5 }}>
                  <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.100' }}>
                    <HistoryIcon sx={{ fontSize: 16, color: 'primary.main' }} />
                  </Avatar>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="body2">
                      <strong>{log.actor_email || 'System'}</strong>{' '}
                      {log.action.toLowerCase().replace(/_/g, ' ')}{' '}
                      {log.target_type && <span>on {log.target_type}</span>}
                    </Typography>
                    {log.details && (
                      <Typography variant="caption" color="text.secondary">
                        {log.details}
                      </Typography>
                    )}
                    <Typography
                      variant="caption"
                      color="text.disabled"
                      sx={{ display: 'block' }}
                    >
                      {formatRelativeTime(log.created_at)}
                    </Typography>
                  </Box>
                </Box>
                {index < entries.length - 1 && <Divider />}
              </Box>
            ))}
          </Box>
        )}
      </CardContent>
    </Card>
  );
}

export default AdminAuditLog;
