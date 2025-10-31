/**
 * Notification Dispatcher Service
 * Handles notification queuing, batching, and delivery via WhatsApp
 */

import { v4 as uuidv4 } from 'uuid';
import { getRedisClient } from '../db/redis';
import { whatsappSender } from './whatsapp-sender.service';
import {
  Notification,
  NotificationType,
  NotificationPriority,
  BatchedNotifications,
  NotificationQueueItem,
} from '../types/notification.types';
import { WorkspaceEvent } from '../types/workspace.types';

const NOTIFICATION_QUEUE_KEY = 'notification_queue';
const NOTIFICATION_BATCH_KEY_PREFIX = 'notification_batch:';
const BATCH_WINDOW_MS = 30000; // 30 seconds
const RETRY_DELAY_MS = 5000; // 5 seconds

class NotificationDispatcher {
  private batchTimers: Map<string, NodeJS.Timeout> = new Map();
  private isProcessing = false;

  /**
   * Queue a notification for delivery
   * @param userId User ID
   * @param phoneNumber User's phone number
   * @param type Notification type
   * @param title Notification title
   * @param message Notification message
   * @param priority Notification priority
   * @param metadata Additional metadata
   */
  async queueNotification(
    userId: string,
    phoneNumber: string,
    type: NotificationType,
    title: string,
    message: string,
    priority: NotificationPriority = NotificationPriority.MEDIUM,
    metadata?: Record<string, any>
  ): Promise<string> {
    const notification: Notification = {
      id: uuidv4(),
      userId,
      phoneNumber,
      type,
      priority,
      title,
      message,
      timestamp: new Date(),
      metadata,
    };

    const redis = await getRedisClient();
    const queueItem: NotificationQueueItem = {
      notification,
      retryCount: 0,
      scheduledAt: new Date(),
    };

    // Add to Redis queue
    await redis.rPush(NOTIFICATION_QUEUE_KEY, JSON.stringify(queueItem));

    // Add to user's batch
    await this.addToBatch(userId, notification);

    console.log(`Notification queued: ${notification.id} for user ${userId}`);
    return notification.id;
  }

  /**
   * Queue a notification from a workspace event
   * @param userId User ID
   * @param phoneNumber User's phone number
   * @param event Workspace event
   */
  async queueNotificationFromEvent(
    userId: string,
    phoneNumber: string,
    event: WorkspaceEvent
  ): Promise<string> {
    const { title, message, priority } = this.formatEventNotification(event);
    const type = this.mapEventTypeToNotificationType(event.type);

    return await this.queueNotification(
      userId,
      phoneNumber,
      type,
      title,
      message,
      priority,
      event.payload
    );
  }

  /**
   * Add notification to user's batch
   * @param userId User ID
   * @param notification Notification to add
   */
  private async addToBatch(userId: string, notification: Notification): Promise<void> {
    const redis = await getRedisClient();
    const batchKey = `${NOTIFICATION_BATCH_KEY_PREFIX}${userId}`;

    // Get existing batch or create new one
    const existingBatch = await redis.get(batchKey);
    let notifications: Notification[] = [];

    if (existingBatch) {
      const batch: BatchedNotifications = JSON.parse(existingBatch);
      notifications = batch.notifications;
    }

    notifications.push(notification);

    const batch: BatchedNotifications = {
      userId,
      phoneNumber: notification.phoneNumber,
      notifications,
      batchedAt: new Date(),
    };

    // Store batch with TTL
    await redis.setEx(batchKey, Math.ceil(BATCH_WINDOW_MS / 1000), JSON.stringify(batch));

    // Set timer to process batch if not already set
    if (!this.batchTimers.has(userId)) {
      const timer = setTimeout(() => {
        this.processBatch(userId);
      }, BATCH_WINDOW_MS);

      this.batchTimers.set(userId, timer);
    }
  }

  /**
   * Process a user's notification batch
   * @param userId User ID
   */
  private async processBatch(userId: string): Promise<void> {
    try {
      const redis = await getRedisClient();
      const batchKey = `${NOTIFICATION_BATCH_KEY_PREFIX}${userId}`;

      // Get batch
      const batchData = await redis.get(batchKey);
      if (!batchData) {
        console.log(`No batch found for user ${userId}`);
        return;
      }

      const batch: BatchedNotifications = JSON.parse(batchData);

      // Delete batch from Redis
      await redis.del(batchKey);

      // Clear timer
      const timer = this.batchTimers.get(userId);
      if (timer) {
        clearTimeout(timer);
        this.batchTimers.delete(userId);
      }

      // Format and send batched notifications
      const formattedMessage = this.formatBatchedNotifications(batch);
      const success = await whatsappSender.sendMessage(
        batch.phoneNumber,
        formattedMessage
      );

      if (success) {
        console.log(`Batch delivered to user ${userId}: ${batch.notifications.length} notifications`);
      } else {
        console.error(`Failed to deliver batch to user ${userId}`);
        // Re-queue individual notifications for retry
        for (const notification of batch.notifications) {
          await this.requeueNotification(notification);
        }
      }
    } catch (error) {
      console.error(`Error processing batch for user ${userId}:`, error);
    }
  }

  /**
   * Process the notification queue
   * Processes notifications that are ready to be sent
   */
  async processQueue(): Promise<void> {
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;

    try {
      const redis = await getRedisClient();

      while (true) {
        // Get next item from queue
        const item = await redis.lPop(NOTIFICATION_QUEUE_KEY);
        if (!item) {
          break;
        }

        const queueItem: NotificationQueueItem = JSON.parse(item);
        const { notification } = queueItem;

        // Check if notification should be sent immediately (high priority)
        if (notification.priority === NotificationPriority.URGENT) {
          await this.sendImmediately(notification);
        }
        // Otherwise, it's already in the batch and will be sent when batch window expires
      }
    } catch (error) {
      console.error('Error processing notification queue:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Send a notification immediately (bypassing batch)
   * @param notification Notification to send
   */
  private async sendImmediately(notification: Notification): Promise<void> {
    const formattedMessage = this.formatSingleNotification(notification);
    const success = await whatsappSender.sendMessage(
      notification.phoneNumber,
      formattedMessage
    );

    if (success) {
      console.log(`Urgent notification sent immediately: ${notification.id}`);
    } else {
      console.error(`Failed to send urgent notification: ${notification.id}`);
      await this.requeueNotification(notification);
    }
  }

  /**
   * Re-queue a notification for retry
   * @param notification Notification to re-queue
   */
  private async requeueNotification(notification: Notification): Promise<void> {
    const redis = await getRedisClient();
    const queueItem: NotificationQueueItem = {
      notification,
      retryCount: 0,
      scheduledAt: new Date(Date.now() + RETRY_DELAY_MS),
    };

    await redis.rPush(NOTIFICATION_QUEUE_KEY, JSON.stringify(queueItem));
    console.log(`Notification re-queued: ${notification.id}`);
  }

  /**
   * Format a single notification for display
   * @param notification Notification to format
   * @returns Formatted message
   */
  private formatSingleNotification(notification: Notification): string {
    const emoji = this.getEmojiForType(notification.type);
    return `${emoji} *${notification.title}*\n\n${notification.message}`;
  }

  /**
   * Format batched notifications for display
   * @param batch Batched notifications
   * @returns Formatted message
   */
  private formatBatchedNotifications(batch: BatchedNotifications): string {
    if (batch.notifications.length === 1) {
      return this.formatSingleNotification(batch.notifications[0]);
    }

    let message = `🔔 *${batch.notifications.length} Workspace Updates*\n\n`;

    for (let i = 0; i < batch.notifications.length; i++) {
      const notification = batch.notifications[i];
      const emoji = this.getEmojiForType(notification.type);
      message += `${i + 1}. ${emoji} *${notification.title}*\n`;
      message += `   ${notification.message}\n\n`;
    }

    return message.trim();
  }

  /**
   * Format a workspace event into notification content
   * @param event Workspace event
   * @returns Formatted notification content
   */
  private formatEventNotification(event: WorkspaceEvent): {
    title: string;
    message: string;
    priority: NotificationPriority;
  } {
    switch (event.type) {
      case 'BUILD_COMPLETE':
        return {
          title: 'Build Complete',
          message: event.payload?.success
            ? `Build completed successfully in ${event.payload?.duration || 'unknown'}ms`
            : `Build failed: ${event.payload?.error || 'Unknown error'}`,
          priority: event.payload?.success
            ? NotificationPriority.LOW
            : NotificationPriority.HIGH,
        };

      case 'ERROR':
        return {
          title: 'Error Detected',
          message: event.payload?.message || 'An error occurred in your workspace',
          priority: NotificationPriority.HIGH,
        };

      case 'GIT_OPERATION':
        return {
          title: 'Git Operation',
          message: `${event.payload?.operation || 'Operation'} completed: ${event.payload?.message || ''}`,
          priority: NotificationPriority.MEDIUM,
        };

      case 'FILE_CHANGED':
        return {
          title: 'File Changed',
          message: `File modified: ${event.payload?.path || 'Unknown file'}`,
          priority: NotificationPriority.LOW,
        };

      default:
        return {
          title: 'Workspace Update',
          message: 'An update occurred in your workspace',
          priority: NotificationPriority.MEDIUM,
        };
    }
  }

  /**
   * Get emoji for notification type
   * @param type Notification type
   * @returns Emoji string
   */
  private getEmojiForType(type: NotificationType): string {
    switch (type) {
      case NotificationType.BUILD_COMPLETE:
        return '✅';
      case NotificationType.ERROR:
        return '❌';
      case NotificationType.GIT_OPERATION:
        return '🔀';
      case NotificationType.FILE_CHANGED:
        return '📝';
      default:
        return '🔔';
    }
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

  /**
   * Start the notification processor
   * Processes queue at regular intervals
   */
  startProcessor(intervalMs: number = 5000): void {
    setInterval(() => {
      this.processQueue();
    }, intervalMs);

    console.log(`Notification processor started (interval: ${intervalMs}ms)`);
  }

  /**
   * Cleanup method for graceful shutdown
   */
  async cleanup(): Promise<void> {
    // Clear all batch timers
    for (const [userId, timer] of this.batchTimers.entries()) {
      clearTimeout(timer);
      // Process any pending batches
      await this.processBatch(userId);
    }
    this.batchTimers.clear();

    console.log('Notification dispatcher cleaned up');
  }
}

// Export singleton instance
export const notificationDispatcher = new NotificationDispatcher();
