/**
 * Notification Routes
 * API endpoints for managing notification settings
 */

import { Router, Request, Response } from 'express';
import { notificationSettingsService } from '../services/notification-settings.service';
import { NotificationType } from '../types/notification.types';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

// Apply authentication middleware to all routes
router.use(authMiddleware);

/**
 * GET /api/notifications/settings
 * Get current notification settings
 */
router.get('/settings', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;

    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'User not authenticated',
      });
      return;
    }

    const settings = await notificationSettingsService.getSettings(userId);

    if (!settings) {
      // Return default settings if none exist
      res.status(200).json({
        success: true,
        data: {
          userId,
          notificationEnabled: true,
          notificationTypes: notificationSettingsService.getDefaultNotificationTypes(),
        },
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: settings,
    });
  } catch (error) {
    console.error('Error getting notification settings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get notification settings',
    });
  }
});

/**
 * PUT /api/notifications/settings
 * Update notification settings
 */
router.put('/settings', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;

    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'User not authenticated',
      });
      return;
    }

    const { enabled, types } = req.body;

    // Validate types if provided
    if (types !== undefined) {
      if (!Array.isArray(types)) {
        res.status(400).json({
          success: false,
          error: 'Notification types must be an array',
        });
        return;
      }

      // Validate each type
      const validTypes = Object.values(NotificationType);
      for (const type of types) {
        if (!validTypes.includes(type)) {
          res.status(400).json({
            success: false,
            error: `Invalid notification type: ${type}`,
          });
          return;
        }
      }
    }

    // Validate enabled if provided
    if (enabled !== undefined && typeof enabled !== 'boolean') {
      res.status(400).json({
        success: false,
        error: 'Enabled must be a boolean',
      });
      return;
    }

    const settings = await notificationSettingsService.updateSettings(
      userId,
      enabled,
      types
    );

    if (!settings) {
      res.status(500).json({
        success: false,
        error: 'Failed to update notification settings',
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Notification settings updated',
      data: settings,
    });
  } catch (error) {
    console.error('Error updating notification settings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update notification settings',
    });
  }
});

/**
 * POST /api/notifications/enable
 * Enable notifications
 */
router.post('/enable', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;

    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'User not authenticated',
      });
      return;
    }

    const settings = await notificationSettingsService.enableNotifications(userId);

    if (!settings) {
      res.status(500).json({
        success: false,
        error: 'Failed to enable notifications',
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Notifications enabled',
      data: settings,
    });
  } catch (error) {
    console.error('Error enabling notifications:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to enable notifications',
    });
  }
});

/**
 * POST /api/notifications/disable
 * Disable notifications
 */
router.post('/disable', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;

    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'User not authenticated',
      });
      return;
    }

    const settings = await notificationSettingsService.disableNotifications(userId);

    if (!settings) {
      res.status(500).json({
        success: false,
        error: 'Failed to disable notifications',
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Notifications disabled',
      data: settings,
    });
  } catch (error) {
    console.error('Error disabling notifications:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to disable notifications',
    });
  }
});

/**
 * POST /api/notifications/types/enable
 * Enable specific notification types
 */
router.post('/types/enable', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;

    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'User not authenticated',
      });
      return;
    }

    const { types } = req.body;

    if (!types || !Array.isArray(types)) {
      res.status(400).json({
        success: false,
        error: 'Types must be provided as an array',
      });
      return;
    }

    // Validate types
    const validTypes = Object.values(NotificationType);
    for (const type of types) {
      if (!validTypes.includes(type)) {
        res.status(400).json({
          success: false,
          error: `Invalid notification type: ${type}`,
        });
        return;
      }
    }

    const settings = await notificationSettingsService.enableNotificationTypes(
      userId,
      types
    );

    if (!settings) {
      res.status(500).json({
        success: false,
        error: 'Failed to enable notification types',
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Notification types enabled',
      data: settings,
    });
  } catch (error) {
    console.error('Error enabling notification types:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to enable notification types',
    });
  }
});

/**
 * POST /api/notifications/types/disable
 * Disable specific notification types
 */
router.post('/types/disable', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;

    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'User not authenticated',
      });
      return;
    }

    const { types } = req.body;

    if (!types || !Array.isArray(types)) {
      res.status(400).json({
        success: false,
        error: 'Types must be provided as an array',
      });
      return;
    }

    // Validate types
    const validTypes = Object.values(NotificationType);
    for (const type of types) {
      if (!validTypes.includes(type)) {
        res.status(400).json({
          success: false,
          error: `Invalid notification type: ${type}`,
        });
          return;
      }
    }

    const settings = await notificationSettingsService.disableNotificationTypes(
      userId,
      types
    );

    if (!settings) {
      res.status(500).json({
        success: false,
        error: 'Failed to disable notification types',
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Notification types disabled',
      data: settings,
    });
  } catch (error) {
    console.error('Error disabling notification types:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to disable notification types',
    });
  }
});

/**
 * GET /api/notifications/types
 * Get available notification types
 */
router.get('/types', async (_req: Request, res: Response): Promise<void> => {
  try {
    const types = Object.values(NotificationType);

    res.status(200).json({
      success: true,
      data: {
        types,
        descriptions: {
          [NotificationType.BUILD_COMPLETE]: 'Notifications when builds complete',
          [NotificationType.ERROR]: 'Notifications when errors occur',
          [NotificationType.GIT_OPERATION]: 'Notifications for Git operations',
          [NotificationType.FILE_CHANGED]: 'Notifications when files change',
        },
      },
    });
  } catch (error) {
    console.error('Error getting notification types:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get notification types',
    });
  }
});

export default router;
