import { platformApi } from '@/lib/axios';
import type {
  AuditLog,
  AuditLogFilterParams,
  PaginatedAuditLogs,
} from '@/types/audit-log';

/**
 * Audit Logs Service
 * Provides access to audit trail for security and compliance
 */

/**
 * Get audit logs with filtering and pagination
 */
export async function getAuditLogs(
  params?: AuditLogFilterParams
): Promise<PaginatedAuditLogs> {
  try {
    // Build LoopBack filter
    const filter: Record<string, unknown> = {};

    // Where clause
    const where: Record<string, unknown> = {};

    if (params?.action) {
      where.action = params.action;
    }
    if (params?.actorId) {
      where.actorId = params.actorId;
    }
    if (params?.targetId) {
      where.targetId = params.targetId;
    }
    if (params?.targetType) {
      where.targetType = params.targetType;
    }
    if (params?.status) {
      where.status = params.status;
    }

    // Date range filtering
    if (params?.startDate || params?.endDate) {
      where.timestamp = {};
      if (params.startDate) {
        (where.timestamp as Record<string, unknown>).gte = params.startDate;
      }
      if (params.endDate) {
        (where.timestamp as Record<string, unknown>).lte = params.endDate;
      }
    }

    if (Object.keys(where).length > 0) {
      filter.where = where;
    }

    // Pagination
    filter.limit = params?.limit || 20;
    filter.offset = params?.offset || 0;

    // Order by timestamp descending (newest first)
    filter.order = ['timestamp DESC'];

    const response = await platformApi.get('/audit-logs', {
      params: { filter: JSON.stringify(filter) },
    });

    const logs = response.data;
    const total = logs.length; // TODO: Get actual count from /audit-logs/count endpoint

    return {
      data: logs,
      total,
      page: Math.floor((params?.offset || 0) / (params?.limit || 20)) + 1,
      limit: params?.limit || 20,
    };
  } catch (error: unknown) {
    if ((error as { response?: { status?: number } })?.response?.status === 404) {
      return {
        data: [],
        total: 0,
        page: 1,
        limit: params?.limit || 20,
      };
    }
    throw error;
  }
}

/**
 * Get single audit log by ID
 */
export async function getAuditLog(id: string): Promise<AuditLog | null> {
  try {
    const response = await platformApi.get(`/audit-logs/${id}`);
    return response.data;
  } catch (error: unknown) {
    if ((error as { response?: { status?: number } })?.response?.status === 404) {
      return null;
    }
    throw error;
  }
}

/**
 * Get audit logs by action
 */
export async function getAuditLogsByAction(action: string, limit: number = 20): Promise<AuditLog[]> {
  try {
    const response = await platformApi.get(`/audit-logs/by-action/${action}`, {
      params: { limit },
    });
    return response.data;
  } catch (error: unknown) {
    if ((error as { response?: { status?: number } })?.response?.status === 404) {
      return [];
    }
    throw error;
  }
}

/**
 * Get audit logs by target entity
 */
export async function getAuditLogsByTarget(
  targetType: string,
  targetId?: string,
  limit: number = 20
): Promise<AuditLog[]> {
  try {
    const response = await platformApi.get('/audit-logs/by-target', {
      params: {
        targetType,
        targetId,
        limit,
      },
    });
    return response.data;
  } catch (error: unknown) {
    if ((error as { response?: { status?: number } })?.response?.status === 404) {
      return [];
    }
    throw error;
  }
}

/**
 * Get audit logs by actor (user)
 */
export async function getAuditLogsByActor(actorId: string, limit: number = 20): Promise<AuditLog[]> {
  try {
    const response = await platformApi.get('/audit-logs/by-actor', {
      params: {
        actorId,
        limit,
      },
    });
    return response.data;
  } catch (error: unknown) {
    if ((error as { response?: { status?: number } })?.response?.status === 404) {
      return [];
    }
    throw error;
  }
}

/**
 * Get audit log count
 */
export async function getAuditLogsCount(params?: AuditLogFilterParams): Promise<number> {
  try {
    const where: Record<string, unknown> = {};

    if (params?.action) {
      where.action = params.action;
    }
    if (params?.actorId) {
      where.actorId = params.actorId;
    }
    if (params?.targetId) {
      where.targetId = params.targetId;
    }
    if (params?.targetType) {
      where.targetType = params.targetType;
    }
    if (params?.status) {
      where.status = params.status;
    }

    const response = await platformApi.get('/audit-logs/count', {
      params: Object.keys(where).length > 0 ? { where: JSON.stringify(where) } : undefined,
    });

    return response.data.count || 0;
  } catch (error: unknown) {
    return 0;
  }
}

export default {
  getAuditLogs,
  getAuditLog,
  getAuditLogsByAction,
  getAuditLogsByTarget,
  getAuditLogsByActor,
  getAuditLogsCount,
};
