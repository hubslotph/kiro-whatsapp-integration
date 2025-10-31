/**
 * Notification-related types
 */

import { WorkspaceEventType } from './workspace.types';

/**
 * Notification types that can be sent to users
 */
export enum NotificationType {
  BUILD_COMPLETE = 'BUILD_COMPLETE',
  ERROR = 'ERROR',
  GIT_OPERATION = 'GIT_OPERATION',
  FILE_CHANGED = 'FILE_CHANGED',
}

/**
 * Notification priority levels
 */
export enum NotificationPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
}

/**
 * Notification payload
 */
export interface Notification {
  id: string;
  userId: string;
  phoneNumber: string;
  type: NotificationType;
  priority: NotificationPriority;
  title: string;
  message: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

/**
 * Batched notifications
 */
export interface BatchedNotifications {
  userId: string;
  phoneNumber: string;
  notifications: Notification[];
  batchedAt: Date;
}

/**
 * Notification queue item
 */
export interface NotificationQueueItem {
  notification: Notification;
  retryCount: number;
  scheduledAt: Date;
}

/**
 * Notification delivery result
 */
export interface NotificationDeliveryResult {
  success: boolean;
  notificationId: string;
  error?: string;
  deliveredAt?: Date;
}

/**
 * Map workspace event types to notification types
 */
export function mapEventTypeToNotificationType(
  eventType: WorkspaceEventType
): NotificationType {
  switch (eventType) {
    case WorkspaceEventType.BUILD_COMPLETE:
      return NotificationType.BUILD_COMPLETE;
    case WorkspaceEventType.ERROR:
      return NotificationType.ERROR;
    case WorkspaceEventType.GIT_OPERATION:
      return NotificationType.GIT_OPERATION;
    case WorkspaceEventType.FILE_CHANGED:
      return NotificationType.FILE_CHANGED;
    default:
      return NotificationType.ERROR;
  }
}
