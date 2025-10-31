import { db } from '../db/prisma';
import { Command } from '../types/command.types';

/**
 * Audit Log Service
 * Handles logging of all command executions and system events
 */

export interface AuditLogEntry {
  userId: string;
  commandType: string;
  commandPayload?: any;
  status: 'SUCCESS' | 'FAILURE' | 'DENIED';
  errorMessage?: string;
}

export interface AuditLogQuery {
  userId?: string;
  commandType?: string;
  status?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

export interface AuditLogResult {
  id: string;
  userId: string;
  commandType: string;
  commandPayload: any;
  status: string;
  errorMessage: string | null;
  createdAt: Date;
}

/**
 * Create an audit log entry
 */
export async function createAuditLog(entry: AuditLogEntry): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        userId: entry.userId,
        commandType: entry.commandType,
        commandPayload: entry.commandPayload || {},
        status: entry.status,
        errorMessage: entry.errorMessage || null,
      },
    });
  } catch (error) {
    console.error('Error creating audit log:', error);
    // Don't throw - audit logging should not break the main flow
  }
}

/**
 * Log command execution
 */
export async function logCommandExecution(
  userId: string,
  command: Command,
  success: boolean,
  errorMessage?: string
): Promise<void> {
  const entry: AuditLogEntry = {
    userId,
    commandType: command.type,
    commandPayload: command,
    status: success ? 'SUCCESS' : 'FAILURE',
    errorMessage,
  };

  await createAuditLog(entry);
}

/**
 * Log access denied event
 */
export async function logAccessDenied(
  userId: string,
  commandType: string,
  reason: string,
  commandPayload?: any
): Promise<void> {
  const entry: AuditLogEntry = {
    userId,
    commandType,
    commandPayload,
    status: 'DENIED',
    errorMessage: reason,
  };

  await createAuditLog(entry);
}

/**
 * Query audit logs with filters
 */
export async function queryAuditLogs(query: AuditLogQuery): Promise<{
  logs: AuditLogResult[];
  total: number;
}> {
  try {
    const where: any = {};

    if (query.userId) {
      where.userId = query.userId;
    }

    if (query.commandType) {
      where.commandType = query.commandType;
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.startDate || query.endDate) {
      where.createdAt = {};
      if (query.startDate) {
        where.createdAt.gte = query.startDate;
      }
      if (query.endDate) {
        where.createdAt.lte = query.endDate;
      }
    }

    const [logs, total] = await Promise.all([
      db.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: query.limit || 100,
        skip: query.offset || 0,
      }),
      db.auditLog.count({ where }),
    ]);

    return {
      logs: logs as AuditLogResult[],
      total,
    };
  } catch (error) {
    console.error('Error querying audit logs:', error);
    return { logs: [], total: 0 };
  }
}

/**
 * Get audit logs for a specific user
 */
export async function getUserAuditLogs(
  userId: string,
  limit: number = 50
): Promise<AuditLogResult[]> {
  try {
    const logs = await db.auditLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return logs as AuditLogResult[];
  } catch (error) {
    console.error('Error getting user audit logs:', error);
    return [];
  }
}

/**
 * Get audit log statistics
 */
export async function getAuditLogStats(userId?: string): Promise<{
  totalCommands: number;
  successfulCommands: number;
  failedCommands: number;
  deniedCommands: number;
  commandsByType: { commandType: string; count: number }[];
}> {
  try {
    const where = userId ? { userId } : {};

    const [total, successful, failed, denied, byType] = await Promise.all([
      db.auditLog.count({ where }),
      db.auditLog.count({ where: { ...where, status: 'SUCCESS' } }),
      db.auditLog.count({ where: { ...where, status: 'FAILURE' } }),
      db.auditLog.count({ where: { ...where, status: 'DENIED' } }),
      db.auditLog.groupBy({
        by: ['commandType'],
        where,
        _count: { commandType: true },
        orderBy: { _count: { commandType: 'desc' } },
      }),
    ]);

    return {
      totalCommands: total,
      successfulCommands: successful,
      failedCommands: failed,
      deniedCommands: denied,
      commandsByType: byType.map((item) => ({
        commandType: item.commandType,
        count: item._count.commandType,
      })),
    };
  } catch (error) {
    console.error('Error getting audit log stats:', error);
    return {
      totalCommands: 0,
      successfulCommands: 0,
      failedCommands: 0,
      deniedCommands: 0,
      commandsByType: [],
    };
  }
}

/**
 * Clean up old audit logs
 * Deletes logs older than the specified number of days
 */
export async function cleanupOldAuditLogs(daysToKeep: number = 90): Promise<number> {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const result = await db.auditLog.deleteMany({
      where: {
        createdAt: {
          lt: cutoffDate,
        },
      },
    });

    console.log(`Cleaned up ${result.count} audit logs older than ${daysToKeep} days`);
    return result.count;
  } catch (error) {
    console.error('Error cleaning up audit logs:', error);
    return 0;
  }
}

/**
 * Schedule periodic cleanup of old audit logs
 * Runs cleanup job at specified interval
 */
export function scheduleAuditLogCleanup(
  daysToKeep: number = 90,
  intervalHours: number = 24
): NodeJS.Timeout {
  const intervalMs = intervalHours * 60 * 60 * 1000;

  // Run cleanup immediately
  cleanupOldAuditLogs(daysToKeep);

  // Schedule periodic cleanup
  return setInterval(() => {
    cleanupOldAuditLogs(daysToKeep);
  }, intervalMs);
}

/**
 * Audit Log Service class for dependency injection
 */
export class AuditLogService {
  async createAuditLog(entry: AuditLogEntry): Promise<void> {
    return createAuditLog(entry);
  }

  async logCommandExecution(
    userId: string,
    command: Command,
    success: boolean,
    errorMessage?: string
  ): Promise<void> {
    return logCommandExecution(userId, command, success, errorMessage);
  }

  async logAccessDenied(
    userId: string,
    commandType: string,
    reason: string,
    commandPayload?: any
  ): Promise<void> {
    return logAccessDenied(userId, commandType, reason, commandPayload);
  }

  async queryAuditLogs(query: AuditLogQuery): Promise<{
    logs: AuditLogResult[];
    total: number;
  }> {
    return queryAuditLogs(query);
  }

  async getUserAuditLogs(userId: string, limit?: number): Promise<AuditLogResult[]> {
    return getUserAuditLogs(userId, limit);
  }

  async getAuditLogStats(userId?: string): Promise<{
    totalCommands: number;
    successfulCommands: number;
    failedCommands: number;
    deniedCommands: number;
    commandsByType: { commandType: string; count: number }[];
  }> {
    return getAuditLogStats(userId);
  }

  async cleanupOldAuditLogs(daysToKeep?: number): Promise<number> {
    return cleanupOldAuditLogs(daysToKeep);
  }

  scheduleAuditLogCleanup(daysToKeep?: number, intervalHours?: number): NodeJS.Timeout {
    return scheduleAuditLogCleanup(daysToKeep, intervalHours);
  }
}

// Export singleton instance
export const auditLogService = new AuditLogService();
