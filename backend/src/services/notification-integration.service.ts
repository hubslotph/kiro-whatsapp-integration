/**
 * Notification Integration Service
 * Wires together notification flow components:
 * - Extension event emitter → Backend event subscriber
 * - Event subscriber → Notification service
 * - Notification dispatcher → WhatsApp sender
 */

import { WorkspaceEvent } from '../types/workspace.types';
import { notificationService } from './notification.service';
import { workspaceManagerService } from './workspace-manager-wrapper.service';
import { db } from '../db/prisma';

/**
 * Subscribe to workspace events and route to notification service
 * Integrates: Extension events → Backend event subscriber → Notification service
 */
export async function subscribeToWorkspaceEvents(
  userId: string,
  workspaceId: string,
  token: string
): Promise<() => void> {
  try {
    // Get workspace manager client
    const client = await workspaceManagerService.getClient(userId, workspaceId, token);

    // Get user's phone number for notifications
    const user = await db.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Subscribe to events with filtering based on user settings
    const unsubscribe = client.subscribeToEventsWithFilter(
      async (event: WorkspaceEvent) => {
        await handleWorkspaceEvent(userId, user.phoneNumber, event);
      },
      userId
    );

    console.log(`Subscribed to workspace events for user ${userId}`);

    return unsubscribe;
  } catch (error) {
    console.error('Error subscribing to workspace events:', error);
    throw error;
  }
}

/**
 * Handle workspace event and send notification
 * Integrates: Workspace event → Notification service → WhatsApp sender
 */
async function handleWorkspaceEvent(
  userId: string,
  phoneNumber: string,
  event: WorkspaceEvent
): Promise<void> {
  try {
    console.log(`Handling workspace event for user ${userId}: ${event.type}`);

    // Send notification via notification service
    // The notification service will handle filtering based on user settings
    const notificationId = await notificationService.sendNotificationFromEvent(
      userId,
      phoneNumber,
      event
    );

    if (notificationId) {
      console.log(`Notification queued: ${notificationId}`);
    } else {
      console.log(`Notification filtered out for user ${userId}: ${event.type}`);
    }
  } catch (error) {
    console.error('Error handling workspace event:', error);
  }
}

/**
 * Initialize event subscriptions for all active users
 * Called on server startup to reconnect event subscriptions
 */
export async function initializeEventSubscriptions(): Promise<void> {
  try {
    // Get all users with active sessions
    const users = await db.user.findMany({
      include: {
        sessions: {
          where: {
            expiresAt: {
              gt: new Date(),
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
          take: 1,
        },
      },
    });

    console.log(`Initializing event subscriptions for ${users.length} users`);

    // Subscribe to events for each user
    for (const user of users) {
      if (user.sessions.length > 0) {
        const session = user.sessions[0];
        try {
          await subscribeToWorkspaceEvents(user.id, user.workspaceId, session.token);
          console.log(`Event subscription initialized for user ${user.id}`);
        } catch (error) {
          console.error(`Failed to initialize event subscription for user ${user.id}:`, error);
        }
      }
    }

    console.log('Event subscriptions initialization complete');
  } catch (error) {
    console.error('Error initializing event subscriptions:', error);
  }
}

/**
 * Unsubscribe from workspace events for a user
 */
export async function unsubscribeFromWorkspaceEvents(
  userId: string,
  workspaceId: string
): Promise<void> {
  try {
    // Disconnect the workspace manager client
    workspaceManagerService.disconnectClient(userId, workspaceId);
    console.log(`Unsubscribed from workspace events for user ${userId}`);
  } catch (error) {
    console.error('Error unsubscribing from workspace events:', error);
  }
}

/**
 * Broadcast event to all connected workspace clients
 * Used for testing or manual event triggering
 */
export async function broadcastEventToWorkspaces(event: WorkspaceEvent): Promise<void> {
  try {
    const clients = workspaceManagerService.getConnectedClients();
    
    console.log(`Broadcasting event to ${clients.length} connected workspaces`);

    for (const client of clients) {
      try {
        // Emit event through the client
        (client as any).emit('workspaceEvent', event);
      } catch (error) {
        console.error('Error broadcasting event to client:', error);
      }
    }
  } catch (error) {
    console.error('Error broadcasting event to workspaces:', error);
  }
}

/**
 * Handle event from extension WebSocket
 * This is called when the extension sends an event to the backend
 */
export async function handleEventFromExtension(
  userId: string,
  event: WorkspaceEvent
): Promise<void> {
  try {
    // Get user's phone number
    const user = await db.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      console.error(`User not found: ${userId}`);
      return;
    }

    // Handle the event
    await handleWorkspaceEvent(userId, user.phoneNumber, event);
  } catch (error) {
    console.error('Error handling event from extension:', error);
  }
}
