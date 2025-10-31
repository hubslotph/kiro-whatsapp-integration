import { Router, Request, Response } from 'express';
import { SettingsService } from '../services/settings.service';
import { authMiddleware } from '../middleware/auth.middleware';
import { prisma } from '../db/prisma';

const router = Router();
const settingsService = new SettingsService(prisma);

/**
 * Get user settings
 * GET /api/settings
 */
router.get('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;

    const settings = await settingsService.getOrCreateSettings(userId);

    return res.json(settings);
  } catch (error) {
    console.error('Error getting settings:', error);
    return res.status(500).json({
      error: 'Failed to get settings',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Update user settings
 * PUT /api/settings
 */
router.put('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const updates = req.body;

    // Validate request body
    if (!updates || typeof updates !== 'object') {
      return res.status(400).json({
        error: 'Invalid request body',
      });
    }

    // Validate notification types if provided
    if (updates.notificationTypes) {
      if (!Array.isArray(updates.notificationTypes)) {
        return res.status(400).json({
          error: 'notificationTypes must be an array',
        });
      }

      const validTypes = [
        'BUILD_COMPLETE',
        'ERROR',
        'GIT_OPERATION',
        'FILE_CHANGED',
      ];
      const invalidTypes = updates.notificationTypes.filter(
        (type: string) => !validTypes.includes(type)
      );

      if (invalidTypes.length > 0) {
        return res.status(400).json({
          error: 'Invalid notification types',
          invalidTypes,
        });
      }
    }

    // Validate accessible directories if provided
    if (updates.accessibleDirectories) {
      if (!Array.isArray(updates.accessibleDirectories)) {
        return res.status(400).json({
          error: 'accessibleDirectories must be an array',
        });
      }

      // Check for invalid paths
      for (const dir of updates.accessibleDirectories) {
        if (typeof dir !== 'string' || dir.trim() === '') {
          return res.status(400).json({
            error: 'Directory paths must be non-empty strings',
          });
        }

        if (dir.includes('..')) {
          return res.status(400).json({
            error: 'Directory paths cannot contain ".."',
          });
        }
      }
    }

    const settings = await settingsService.updateSettings(userId, updates);

    return res.json(settings);
  } catch (error) {
    console.error('Error updating settings:', error);
    return res.status(500).json({
      error: 'Failed to update settings',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Delete user settings (reset to defaults)
 * DELETE /api/settings
 */
router.delete('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;

    await settingsService.deleteSettings(userId);

    // Create new default settings
    const settings = await settingsService.getOrCreateSettings(userId);

    return res.json({
      message: 'Settings reset to defaults',
      settings,
    });
  } catch (error) {
    console.error('Error deleting settings:', error);
    return res.status(500).json({
      error: 'Failed to delete settings',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
