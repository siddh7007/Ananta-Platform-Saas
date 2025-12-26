/**
 * Audit Logs Viewer Page
 *
 * Shows audit trail for security and compliance:
 * - Filterable by action, actor, target, date range
 * - Paginated table view
 * - Detail modal for individual log entries
 * - Admin/owner access only
 */

import { useEffect, useState } from 'react';
import { Shield, Filter, Search, Calendar, ChevronLeft, ChevronRight, AlertTriangle } from 'lucide-react';
import { getAuditLogs, getAuditLogsCount } from '@/services/audit-logs.service';
import type { AuditLog, AuditLogFilterParams } from '@/types/audit-log';
import {
  formatActionName,
  formatAuditTimestamp,
  getStatusColor,
  getActionCategory,
} from '@/types/audit-log';

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [actionFilter, setActionFilter] = useState('');
  const [targetTypeFilter, setTargetTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'success' | 'failure' | ''>('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Selected log for detail view
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  // Load audit logs
  useEffect(() => {
    async function loadAuditLogs() {
      setIsLoading(true);
      setError(null);

      try {
        const params: AuditLogFilterParams = {
          limit,
          offset: (page - 1) * limit,
        };

        if (actionFilter) params.action = actionFilter;
        if (targetTypeFilter) params.targetType = targetTypeFilter;
        if (statusFilter) params.status = statusFilter;
        if (startDate) params.startDate = new Date(startDate).toISOString();
        if (endDate) params.endDate = new Date(endDate).toISOString();

        const [logsData, count] = await Promise.all([
          getAuditLogs(params).then(r => r.data),
          getAuditLogsCount(params),
        ]);

        setLogs(logsData);
        setTotal(count);
      } catch (err) {
        console.error('Failed to load audit logs:', err);
        setError('Failed to load audit logs');
      } finally {
        setIsLoading(false);
      }
    }

    loadAuditLogs();
  }, [page, limit, actionFilter, targetTypeFilter, statusFilter, startDate, endDate]);

  const totalPages = Math.ceil(total / limit);

  const handleClearFilters = () => {
    setActionFilter('');
    setTargetTypeFilter('');
    setStatusFilter('');
    setStartDate('');
    setEndDate('');
    setPage(1);
  };

  // Render log status badge
  const renderStatusBadge = (status?: string) => {
    const color = getStatusColor(status);
    const bgColors = {
      green: 'bg-green-100 text-green-800',
      red: 'bg-red-100 text-red-800',
      gray: 'bg-gray-100 text-gray-800',
    };

    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${bgColors[color]}`}>
        {status || 'unknown'}
      </span>
    );
  };

  // Render log detail modal
  const renderDetailModal = () => {
    if (!selectedLog) return null;

    return (
      <div
        className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
        onClick={() => setSelectedLog(null)}
      >
        <div
          className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-start justify-between mb-4">
            <h2 className="text-xl font-semibold">Audit Log Details</h2>
            <button
              onClick={() => setSelectedLog(null)}
              className="text-gray-500 hover:text-gray-700"
            >
              &times;
            </button>
          </div>

          <div className="space-y-3 text-sm">
            <div>
              <span className="font-medium text-gray-600">ID:</span>
              <span className="ml-2 font-mono text-xs">{selectedLog.id}</span>
            </div>
            <div>
              <span className="font-medium text-gray-600">Action:</span>
              <span className="ml-2">{formatActionName(selectedLog.action)}</span>
              <span className="ml-2 text-xs text-gray-500">({selectedLog.action})</span>
            </div>
            <div>
              <span className="font-medium text-gray-600">Category:</span>
              <span className="ml-2">{getActionCategory(selectedLog.action)}</span>
            </div>
            <div>
              <span className="font-medium text-gray-600">Actor ID:</span>
              <span className="ml-2 font-mono text-xs">{selectedLog.actorId}</span>
            </div>
            {selectedLog.actorType && (
              <div>
                <span className="font-medium text-gray-600">Actor Type:</span>
                <span className="ml-2">{selectedLog.actorType}</span>
              </div>
            )}
            {selectedLog.targetId && (
              <div>
                <span className="font-medium text-gray-600">Target ID:</span>
                <span className="ml-2 font-mono text-xs">{selectedLog.targetId}</span>
              </div>
            )}
            {selectedLog.targetType && (
              <div>
                <span className="font-medium text-gray-600">Target Type:</span>
                <span className="ml-2">{selectedLog.targetType}</span>
              </div>
            )}
            <div>
              <span className="font-medium text-gray-600">Timestamp:</span>
              <span className="ml-2">{new Date(selectedLog.timestamp).toLocaleString()}</span>
            </div>
            <div>
              <span className="font-medium text-gray-600">Status:</span>
              <span className="ml-2">{renderStatusBadge(selectedLog.status)}</span>
            </div>
            {selectedLog.ipAddress && (
              <div>
                <span className="font-medium text-gray-600">IP Address:</span>
                <span className="ml-2 font-mono text-xs">{selectedLog.ipAddress}</span>
              </div>
            )}
            {selectedLog.userAgent && (
              <div>
                <span className="font-medium text-gray-600">User Agent:</span>
                <span className="ml-2 text-xs text-gray-700">{selectedLog.userAgent}</span>
              </div>
            )}
            {selectedLog.errorMessage && (
              <div>
                <span className="font-medium text-gray-600">Error:</span>
                <span className="ml-2 text-red-600">{selectedLog.errorMessage}</span>
              </div>
            )}
            {selectedLog.details && (
              <div>
                <span className="font-medium text-gray-600">Details:</span>
                <pre className="mt-2 p-3 bg-gray-50 rounded text-xs overflow-x-auto">
                  {JSON.stringify(selectedLog.details, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Shield className="h-6 w-6" />
          Audit Logs
        </h1>
        <p className="text-muted-foreground">
          Security and compliance audit trail
        </p>
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
          <AlertTriangle className="h-5 w-5 text-red-600" />
          <p className="text-red-700">{error}</p>
          <button
            onClick={() => setError(null)}
            className="ml-auto text-red-700 hover:text-red-900"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="bg-card border rounded-lg p-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="h-4 w-4" />
          <h3 className="font-medium text-sm">Filters</h3>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {/* Action filter */}
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Action</label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="e.g., tenant.created"
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value)}
                className="w-full pl-8 pr-3 py-2 border rounded-md text-sm"
              />
            </div>
          </div>

          {/* Target type filter */}
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Target Type</label>
            <select
              value={targetTypeFilter}
              onChange={(e) => setTargetTypeFilter(e.target.value)}
              className="w-full px-3 py-2 border rounded-md text-sm"
            >
              <option value="">All Types</option>
              <option value="tenant">Tenant</option>
              <option value="user">User</option>
              <option value="subscription">Subscription</option>
              <option value="invoice">Invoice</option>
              <option value="plan">Plan</option>
              <option value="payment">Payment</option>
            </select>
          </div>

          {/* Status filter */}
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'success' | 'failure' | '')}
              className="w-full px-3 py-2 border rounded-md text-sm"
            >
              <option value="">All Statuses</option>
              <option value="success">Success</option>
              <option value="failure">Failure</option>
            </select>
          </div>

          {/* Start date */}
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Start Date</label>
            <div className="relative">
              <Calendar className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full pl-8 pr-3 py-2 border rounded-md text-sm"
              />
            </div>
          </div>

          {/* End date */}
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">End Date</label>
            <div className="relative">
              <Calendar className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full pl-8 pr-3 py-2 border rounded-md text-sm"
              />
            </div>
          </div>

          {/* Clear filters button */}
          <div className="flex items-end">
            <button
              onClick={handleClearFilters}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm hover:bg-gray-50"
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {/* Audit logs table */}
      <div className="bg-card border rounded-lg overflow-hidden">
        {/* Loading state */}
        {isLoading && (
          <div className="p-8 text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent" />
            <p className="mt-2 text-sm text-muted-foreground">Loading audit logs...</p>
          </div>
        )}

        {/* Table */}
        {!isLoading && logs.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Timestamp</th>
                  <th className="px-4 py-3 text-left font-medium">Action</th>
                  <th className="px-4 py-3 text-left font-medium">Actor</th>
                  <th className="px-4 py-3 text-left font-medium">Target</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {logs.map((log) => (
                  <tr
                    key={log.id}
                    onClick={() => setSelectedLog(log)}
                    className="hover:bg-muted/50 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatAuditTimestamp(log.timestamp)}
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <div className="font-medium">{formatActionName(log.action)}</div>
                        <div className="text-xs text-muted-foreground">{getActionCategory(log.action)}</div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-mono text-xs">{log.actorId.slice(0, 8)}...</div>
                      {log.actorType && (
                        <div className="text-xs text-muted-foreground">{log.actorType}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {log.targetId ? (
                        <div>
                          <div className="font-mono text-xs">{log.targetId.slice(0, 8)}...</div>
                          {log.targetType && (
                            <div className="text-xs text-muted-foreground">{log.targetType}</div>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {renderStatusBadge(log.status)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Empty state */}
        {!isLoading && logs.length === 0 && (
          <div className="p-12 text-center">
            <Shield className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="font-medium text-lg mb-1">No audit logs found</h3>
            <p className="text-sm text-muted-foreground">
              {actionFilter || targetTypeFilter || statusFilter || startDate || endDate
                ? 'Try adjusting your filters'
                : 'Audit logs will appear here as actions are performed'}
            </p>
          </div>
        )}

        {/* Pagination */}
        {!isLoading && logs.length > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t bg-muted/50">
            <div className="text-sm text-muted-foreground">
              Showing {(page - 1) * limit + 1} to {Math.min(page * limit, total)} of {total} logs
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-2 border rounded-md hover:bg-background disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-sm">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-2 border rounded-md hover:bg-background disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Detail modal */}
      {renderDetailModal()}
    </div>
  );
}
