import { PrismaClient } from '@prisma/client';
import { redis } from '../db/redis';
import {
  UserSettings,
  UpdateSettingsRequest,
  SettingsChangeEvent,
} from '../types/settings.types';
import { EventEmitter } from 'events';

/**
 * Settings service for managing user settings
 */
export class SettingsService extends EventEmitter {
  private prisma: PrismaClient;
  private readonly CACHE_PREFIX = 'settings:';
  private readonly CACHE_TTL = 3600; // 1 hour

  constructor(prisma: PrismaClient) {
    super();
    this.prisma = prisma;
  }

  /**
   * Get user settings by user ID
   */
  async getSettings(userId: string): Promise<UserSettings | null> {
    // Try to get from cache first
    const cached = await this.getFromCache(userId);
    if (cached) {
      return cached;
    }

    // Get from database
    const settings = await this.prisma.settings.findUnique({
      where: { userId },
    });

    if (!settings) {
      return null;
    }

    const userSettings = this.mapToUserSettings(settings);

    // Cache the result
    await this.saveToCache(userId, userSettings);

    return userSettings;
  }

  /**
   * Get or create settings for a user
   */
  async getOrCreateSettings(userId: string): Promise<UserSettings> {
    let settings = await this.getSettings(userId);

    if (!settings) {
      // Create default settings
      const created = await this.prisma.settings.create({
        data: {
          userId,
          notificationEnabled: true,
          notificationTypes: JSON.stringify([]),
          accessibleDirectories: JSON.stringify([]),
          readOnlyMode: true,
        },
      });

      settings = this.mapToUserSettings(created);
      await this.saveToCache(userId, settings);
    }

    return settings;
  }

  /**
   * Update user settings
   */
  async updateSettings(
    userId: string,
    updates: UpdateSettingsRequest
  ): Promise<UserSettings> {
    // Get current settings
    const currentSettings = await this.getOrCreateSettings(userId);

    // Prepare update data
    const updateData: any = {};

    if (updates.notificationEnabled !== undefined) {
      updateData.notificationEnabled = updates.notificationEnabled;
    }

    if (updates.notificationTypes !== undefined) {
      updateData.notificationTypes = JSON.stringify(updates.notificationTypes);
    }

    if (updates.accessibleDirectories !== undefined) {
      updateData.accessibleDirectories = JSON.stringify(
        updates.accessibleDirectories
      );
    }

    if (updates.readOnlyMode !== undefined) {
      updateData.readOnlyMode = updates.readOnlyMode;
    }

    // Update in database
    const updated = await this.prisma.settings.update({
      where: { userId },
      data: updateData,
    });

    const newSettings = this.mapToUserSettings(updated);

    // Update cache
    await this.saveToCache(userId, newSettings);

    // Emit settings change event
    const changedFields = Object.keys(updates);
    const changeEvent: SettingsChangeEvent = {
      userId,
      previousSettings: currentSettings,
      newSettings,
      changedFields,
      timestamp: new Date(),
    };

    this.emit('settingsChanged', changeEvent);

    return newSettings;
  }

  /**
   * Delete user settings
   */
  async deleteSettings(userId: string): Promise<void> {
    await this.prisma.settings.delete({
      where: { userId },
    });

    // Remove from cache
    await this.removeFromCache(userId);
  }

  /**
   * Check if directory is accessible based on user settings
   */
  async isDirectoryAccessible(
    userId: string,
    directory: string
  ): Promise<boolean> {
    const settings = await this.getOrCreateSettings(userId);

    // If no directories specified, all are accessible
    if (settings.accessibleDirectories.length === 0) {
      return true;
    }

    // Check if directory matches any accessible directory
    return settings.accessibleDirectories.some((accessibleDir) => {
      return (
        directory === accessibleDir ||
        directory.startsWith(accessibleDir + '/') ||
        directory.startsWith(accessibleDir + '\\')
      );
    });
  }

  /**
   * Check if user is in read-only mode
   */
  async isReadOnlyMode(userId: string): Promise<boolean> {
    const settings = await this.getOrCreateSettings(userId);
    return settings.readOnlyMode;
  }

  /**
   * Get notification types for user
   */
  async getNotificationTypes(userId: string): Promise<string[]> {
    const settings = await this.getOrCreateSettings(userId);
    return settings.notificationTypes;
  }

  /**
   * Check if notifications are enabled for user
   */
  async areNotificationsEnabled(userId: string): Promise<boolean> {
    const settings = await this.getOrCreateSettings(userId);
    return settings.notificationEnabled;
  }

  /**
   * Map database model to UserSettings type
   */
  private mapToUserSettings(settings: any): UserSettings {
    return {
      id: settings.id,
      userId: settings.userId,
      notificationEnabled: settings.notificationEnabled,
      notificationTypes: JSON.parse(settings.notificationTypes as string),
      accessibleDirectories: JSON.parse(
        settings.accessibleDirectories as string
      ),
      readOnlyMode: settings.readOnlyMode,
      createdAt: settings.createdAt,
      updatedAt: settings.updatedAt,
    };
  }

  /**
   * Get settings from cache
   */
  private async getFromCache(userId: string): Promise<UserSettings | null> {
    try {
      const key = `${this.CACHE_PREFIX}${userId}`;
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
   * Save settings to cache
   */
  private async saveToCache(
    userId: string,
    settings: UserSettings
  ): Promise<void> {
    try {
      const key = `${this.CACHE_PREFIX}${userId}`;
      await redis.setEx(key, this.CACHE_TTL, JSON.stringify(settings));
    } catch (error) {
      console.error('Error saving settings to cache:', error);
    }
  }

  /**
   * Remove settings from cache
   */
  private async removeFromCache(userId: string): Promise<void> {
    try {
      const key = `${this.CACHE_PREFIX}${userId}`;
      await redis.del(key);
    } catch (error) {
      console.error('Error removing settings from cache:', error);
    }
  }
}
