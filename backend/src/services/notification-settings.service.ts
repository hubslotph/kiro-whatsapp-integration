/**
 * Notification Settings Service
 * Manages user notification preferences and filtering
 */

import { db } from '../db/prisma';
import { getRedisClient } from '../db/redis';
import { NotificationType } from '../types/notification.types';

const SETTINGS_CACHE_PREFIX = 'notification_settings:';
const SETTINGS_CACHE_TTL = 3600; // 1 hour

export interface NotificationSettings {
  userId: string;
  notificationEnabled: boolean;
  notificationTypes: NotificationType[];
}

class NotificationSettingsService {
  /**
   * Get user's notification settings
   * @param userId User ID
   * @returns Notification settings
   */
  async getSettings(userId: string): Promise<NotificationSettings | null> {
    try {
      // Try to get from cache first
      const cached = await this.getFromCache(userId);
      if (cached) {
        return cached;
      }

      // Get from database
      const settings = await db.settings.findUnique({
        where: { userId },
      });

      if (!settings) {
        return null;
      }

      const notificationSettings: NotificationSettings = {
        userId,
        notificationEnabled: settings.notificationEnabled,
        notificationTypes: (settings.notificationTypes as string[]).map(
          (type) => type as NotificationType
        ),
      };

      // Cache the settings
      await this.cacheSettings(userId, notificationSettings);

      return notificationSettings;
    } catch (error) {
      console.error('Error getting notification settings:', error);
      return null;
    }
  }

  /**
   * Update user's notification settings
   * @param userId User ID
   * @param enabled Whether notifications are enabled
   * @param types Array of notification types to enable
   * @returns Updated settings
   */
  async updateSettings(
    userId: string,
    enabled?: boolean,
    types?: NotificationType[]
  ): Promise<NotificationSettings | null> {
    try {
      // Build update data
      const updateData: any = {};

      if (enabled !== undefined) {
        updateData.notificationEnabled = enabled;
      }

      if (types !== undefined) {
        updateData.notificationTypes = types;
      }

      if (Object.keys(updateData).length === 0) {
        // No updates provided
        return await this.getSettings(userId);
      }

      // Update in database
      const settings = await db.settings.upsert({
        where: { userId },
        update: updateData,
        create: {
          userId,
          notificationEnabled: enabled ?? true,
          notificationTypes: types ?? [],
        },
      });

      const notificationSettings: NotificationSettings = {
        userId,
        notificationEnabled: settings.notificationEnabled,
        notificationTypes: (settings.notificationTypes as string[]).map(
          (type) => type as NotificationType
        ),
      };

      // Invalidate cache
      await this.invalidateCache(userId);

      // Cache new settings
      await this.cacheSettings(userId, notificationSettings);

      return notificationSettings;
    } catch (error) {
      console.error('Error updating notification settings:', error);
      return null;
    }
  }

  /**
   * Enable notifications for a user
   * @param userId User ID
   * @returns Updated settings
   */
  async enableNotifications(userId: string): Promise<NotificationSettings | null> {
    return await this.updateSettings(userId, true);
  }

  /**
   * Disable notifications for a user
   * @param userId User ID
   * @returns Updated settings
   */
  async disableNotifications(userId: string): Promise<NotificationSettings | null> {
    return await this.updateSettings(userId, false);
  }

  /**
   * Enable specific notification types
   * @param userId User ID
   * @param types Notification types to enable
   * @returns Updated settings
   */
  async enableNotificationTypes(
    userId: string,
    types: NotificationType[]
  ): Promise<NotificationSettings | null> {
    const currentSettings = await this.getSettings(userId);
    if (!currentSettings) {
      return await this.updateSettings(userId, true, types);
    }

    // Merge with existing types
    const existingTypes = new Set(currentSettings.notificationTypes);
    types.forEach((type) => existingTypes.add(type));

    return await this.updateSettings(userId, undefined, Array.from(existingTypes));
  }

  /**
   * Disable specific notification types
   * @param userId User ID
   * @param types Notification types to disable
   * @returns Updated settings
   */
  async disableNotificationTypes(
    userId: string,
    types: NotificationType[]
  ): Promise<NotificationSettings | null> {
    const currentSettings = await this.getSettings(userId);
    if (!currentSettings) {
      return null;
    }

    // Remove specified types
    const typesToDisable = new Set(types);
    const remainingTypes = currentSettings.notificationTypes.filter(
      (type) => !typesToDisable.has(type)
    );

    return await this.updateSettings(userId, undefined, remainingTypes);
  }

  /**
   * Check if a user should receive a notification
   * @param userId User ID
   * @param type Notification type
   * @returns True if notification should be sent
   */
  async shouldSendNotification(
    userId: string,
    type: NotificationType
  ): Promise<boolean> {
    try {
      const settings = await this.getSettings(userId);

      // If no settings found, default to enabled with all types
      if (!settings) {
        return true;
      }

      // Check if notifications are enabled
      if (!settings.notificationEnabled) {
        return false;
      }

      // Check if this notification type is enabled
      // If notificationTypes is empty, allow all types
      if (settings.notificationTypes.length === 0) {
        return true;
      }

      return settings.notificationTypes.includes(type);
    } catch (error) {
      console.error('Error checking notification permission:', error);
      // Default to allowing notification on error
      return true;
    }
  }

  /**
   * Get settings from cache
   * @param userId User ID
   * @returns Cached settings or null
   */
  private async getFromCache(userId: string): Promise<NotificationSettings | null> {
    try {
      const redis = await getRedisClient();
      const key = `${SETTINGS_CACHE_PREFIX}${userId}`;
      const cached = await redis.get(key);

      if (cached) {
        return JSON.parse(cached);
      }

      return null;
    } catch (error) {
      console.error('Error getting settings from cache:', error);
      return null;
    }
  }

  /**
   * Cache settings
   * @param userId User ID
   * @param settings Settings to cache
   */
  private async cacheSettings(
    userId: string,
    settings: NotificationSettings
  ): Promise<void> {
    try {
      const redis = await getRedisClient();
      const key = `${SETTINGS_CACHE_PREFIX}${userId}`;
      await redis.setEx(key, SETTINGS_CACHE_TTL, JSON.stringify(settings));
    } catch (error) {
      console.error('Error caching settings:', error);
    }
  }

  /**
   * Invalidate cached settings
   * @param userId User ID
   */
  private async invalidateCache(userId: string): Promise<void> {
    try {
      const redis = await getRedisClient();
      const key = `${SETTINGS_CACHE_PREFIX}${userId}`;
      await redis.del(key);
    } catch (error) {
      console.error('Error invalidating cache:', error);
    }
  }

  /**
   * Get default notification types
   * @returns Array of all notification types
   */
  getDefaultNotificationTypes(): NotificationType[] {
    return [
      NotificationType.BUILD_COMPLETE,
      NotificationType.ERROR,
      NotificationType.GIT_OPERATION,
      NotificationType.FILE_CHANGED,
    ];
  }
}

// Export singleton instance
export const notificationSettingsService = new NotificationSettingsService();
