import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import {
  queryAuditLogs,
  getUserAuditLogs,
  getAuditLogStats,
  AuditLogQuery,
} from '../services/audit-log.service';

const router = Router();

/**
 * GET /api/audit/logs
 * Query audit logs with filters
 * Requires authentication
 */
router.get('/logs', authMiddleware, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const query: AuditLogQuery = {
      userId: req.query.userId as string,
      commandType: req.query.commandType as string,
      status: req.query.status as string,
      startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
      endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string) : 100,
      offset: req.query.offset ? parseInt(req.query.offset as string) : 0,
    };

    // Users can only query their own logs unless they're admin
    // For now, restrict to own logs
    query.userId = req.user.userId;

    const result = await queryAuditLogs(query);

    res.json({
      success: true,
      data: result.logs,
      total: result.total,
      limit: query.limit,
      offset: query.offset,
    });
  } catch (error) {
    console.error('Error querying audit logs:', error);
    res.status(500).json({
      error: 'Failed to query audit logs',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/audit/logs/me
 * Get current user's audit logs
 * Requires authentication
 */
router.get('/logs/me', authMiddleware, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
    const logs = await getUserAuditLogs(req.user.userId, limit);

    res.json({
      success: true,
      data: logs,
      count: logs.length,
    });
  } catch (error) {
    console.error('Error getting user audit logs:', error);
    res.status(500).json({
      error: 'Failed to get audit logs',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/audit/stats
 * Get audit log statistics
 * Requires authentication
 */
router.get('/stats', authMiddleware, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Get stats for current user only
    const stats = await getAuditLogStats(req.user.userId);

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error('Error getting audit log stats:', error);
    res.status(500).json({
      error: 'Failed to get audit log statistics',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/audit/stats/all
 * Get audit log statistics for all users (admin only)
 * Requires authentication and admin privileges
 */
router.get('/stats/all', authMiddleware, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // TODO: Add admin check when admin role is implemented
    // For now, return user's own stats
    const stats = await getAuditLogStats(req.user.userId);

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error('Error getting audit log stats:', error);
    res.status(500).json({
      error: 'Failed to get audit log statistics',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
