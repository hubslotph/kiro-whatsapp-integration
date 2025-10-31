/**
 * Notification Service
 * High-level service that combines dispatcher and settings
 * Provides a simple interface for sending notifications with automatic filtering
 */

import { notificationDispatcher } from './notification-dispatcher.service';
import { notificationSettingsService } from './notification-settings.service';
import { NotificationType, NotificationPriority } from '../types/notification.types';
import { WorkspaceEvent } from '../types/workspace.types';

class NotificationService {
  /**
   * Send a notification to a user (with automatic filtering based on settings)
   * @param userId User ID
   * @param phoneNumber User's phone number
   * @param type Notification type
   * @param title Notification title
   * @param message Notification message
   * @param priority Notification priority
   * @param metadata Additional metadata
   * @returns Notification ID if sent, null if filtered out
   */
  async sendNotification(
    userId: string,
    phoneNumber: string,
    type: NotificationType,
    title: string,
    message: string,
    priority: NotificationPriority = NotificationPriority.MEDIUM,
    metadata?: Record<string, any>
  ): Promise<string | null> {
    // Check if user should receive this notification
    const shouldSend = await notificationSettingsService.shouldSendNotification(
      userId,
      type
    );

    if (!shouldSend) {
      console.log(`Notification filtered out for user ${userId}: ${type}`);
      return null;
    }

    // Queue the notification
    const notificationId = await notificationDispatcher.queueNotification(
      userId,
      phoneNumber,
      type,
      title,
      message,
      priority,
      metadata
    );

    return notificationId;
  }

  /**
   * Send a notification from a workspace event (with automatic filtering)
   * @param userId User ID
   * @param phoneNumber User's phone number
   * @param event Workspace event
   * @returns Notification ID if sent, null if filtered out
   */
  async sendNotificationFromEvent(
    userId: string,
    phoneNumber: string,
    event: WorkspaceEvent
  ): Promise<string | null> {
    // Map event type to notification type
    const type = this.mapEventTypeToNotificationType(event.type);

    // Check if user should receive this notification
    const shouldSend = await notificationSettingsService.shouldSendNotification(
      userId,
      type
    );

    if (!shouldSend) {
      console.log(`Event notification filtered out for user ${userId}: ${event.type}`);
      return null;
    }

    // Queue the notification
    const notificationId = await notificationDispatcher.queueNotificationFromEvent(
      userId,
      phoneNumber,
      event
    );

    return notificationId;
  }

  /**
   * Map workspace event type to notification type
   * @param eventType Workspace event type
   * @returns Notification type
   */
  private mapEventTypeToNotificationType(eventType: string): NotificationType {
    switch (eventType) {
      case 'BUILD_COMPLETE':
        return NotificationType.BUILD_COMPLETE;
      case 'ERROR':
        return NotificationType.ERROR;
      case 'GIT_OPERATION':
        return NotificationType.GIT_OPERATION;
      case 'FILE_CHANGED':
        return NotificationType.FILE_CHANGED;
      default:
        return NotificationType.ERROR;
    }
  }
}

// Export singleton instance
export const notificationService = new NotificationService();
