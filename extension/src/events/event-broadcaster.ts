/**
 * Event broadcasting system
 * Broadcasts workspace events to connected WebSocket clients
 */

import { Socket } from 'socket.io';
import { WorkspaceEvent, WorkspaceEventType } from './event-types';

/**
 * Event throttle configuration
 */
interface ThrottleConfig {
  enabled: boolean;
  windowMs: number; // Time window in milliseconds
  maxEvents: number; // Maximum events per window
}

/**
 * Throttle state for an event type
 */
interface ThrottleState {
  events: WorkspaceEvent[];
  lastBroadcast: number;
}

/**
 * Connection info for broadcasting
 */
interface BroadcastConnection {
  socket: Socket;
  userId: string;
  workspaceId: string;
}

/**
 * Event broadcaster
 * Handles serialization, throttling, and broadcasting of events
 */
export class EventBroadcaster {
  private throttleConfig: Map<WorkspaceEventType, ThrottleConfig> = new Map();
  private throttleState: Map<WorkspaceEventType, ThrottleState> = new Map();
  private connections: BroadcastConnection[] = [];

  constructor() {
    this.initializeThrottleConfig();
  }

  /**
   * Initialize throttle configuration for different event types
   */
  private initializeThrottleConfig(): void {
    // Build events - throttle to prevent spam during continuous builds
    this.throttleConfig.set(WorkspaceEventType.BUILD_COMPLETE, {
      enabled: true,
      windowMs: 5000, // 5 seconds
      maxEvents: 2, // Max 2 build events per 5 seconds
    });

    // Error events - throttle to prevent error spam
    this.throttleConfig.set(WorkspaceEventType.ERROR, {
      enabled: true,
      windowMs: 10000, // 10 seconds
      maxEvents: 5, // Max 5 errors per 10 seconds
    });

    // Git events - moderate throttling
    this.throttleConfig.set(WorkspaceEventType.GIT_OPERATION, {
      enabled: true,
      windowMs: 3000, // 3 seconds
      maxEvents: 3, // Max 3 git events per 3 seconds
    });

    // File change events - aggressive throttling to prevent spam
    this.throttleConfig.set(WorkspaceEventType.FILE_CHANGED, {
      enabled: true,
      windowMs: 30000, // 30 seconds
      maxEvents: 10, // Max 10 file changes per 30 seconds
    });
  }

  /**
   * Set connections for broadcasting
   */
  setConnections(connections: BroadcastConnection[]): void {
    this.connections = connections;
  }

  /**
   * Broadcast an event to all connected clients
   */
  broadcast(event: WorkspaceEvent): void {
    // Check if event should be throttled
    if (this.shouldThrottle(event)) {
      console.log(`Event throttled: ${event.type}`);
      return;
    }

    // Serialize event
    const serializedEvent = this.serializeEvent(event);

    // Broadcast to all connected clients
    let successCount = 0;
    let failureCount = 0;

    for (const connection of this.connections) {
      if (connection.socket.connected) {
        try {
          connection.socket.emit('EVENT', JSON.parse(serializedEvent));
          successCount++;
        } catch (error) {
          console.error(`Failed to send event to ${connection.userId}:`, error);
          failureCount++;
        }
      }
    }

    console.log(
      `Event broadcast: ${event.type} - Success: ${successCount}, Failed: ${failureCount}`
    );

    // Update throttle state
    this.updateThrottleState(event);
  }

  /**
   * Broadcast an event to a specific connection
   */
  broadcastToConnection(userId: string, event: WorkspaceEvent): void {
    const connection = this.connections.find((conn) => conn.userId === userId);

    if (!connection) {
      console.error(`Connection not found for user: ${userId}`);
      return;
    }

    if (!connection.socket.connected) {
      console.error(`Connection not open for user: ${userId}`);
      return;
    }

    // Serialize event
    const serializedEvent = this.serializeEvent(event);

    try {
      connection.socket.emit('EVENT', JSON.parse(serializedEvent));
      console.log(`Event sent to ${userId}: ${event.type}`);
    } catch (error) {
      console.error(`Failed to send event to ${userId}:`, error);
    }
  }

  /**
   * Serialize event for transmission
   */
  private serializeEvent(event: WorkspaceEvent): string {
    const message = {
      type: 'event',
      event: {
        type: event.type,
        timestamp: event.timestamp.toISOString(),
        payload: event.payload,
      },
    };

    return JSON.stringify(message);
  }

  /**
   * Check if event should be throttled
   */
  private shouldThrottle(event: WorkspaceEvent): boolean {
    const config = this.throttleConfig.get(event.type);

    // If throttling is not configured or disabled, don't throttle
    if (!config || !config.enabled) {
      return false;
    }

    const state = this.throttleState.get(event.type);
    const now = Date.now();

    // If no state exists, don't throttle
    if (!state) {
      return false;
    }

    // Check if we're within the throttle window
    const timeSinceLastBroadcast = now - state.lastBroadcast;
    if (timeSinceLastBroadcast > config.windowMs) {
      // Window has passed, reset state
      return false;
    }

    // Check if we've exceeded max events in window
    const eventsInWindow = state.events.filter(
      (e) => now - e.timestamp.getTime() < config.windowMs
    );

    return eventsInWindow.length >= config.maxEvents;
  }

  /**
   * Update throttle state after broadcasting
   */
  private updateThrottleState(event: WorkspaceEvent): void {
    const config = this.throttleConfig.get(event.type);

    if (!config || !config.enabled) {
      return;
    }

    const now = Date.now();
    let state = this.throttleState.get(event.type);

    if (!state) {
      state = {
        events: [],
        lastBroadcast: now,
      };
      this.throttleState.set(event.type, state);
    }

    // Add event to state
    state.events.push(event);
    state.lastBroadcast = now;

    // Clean up old events outside the window
    state.events = state.events.filter(
      (e) => now - e.timestamp.getTime() < config.windowMs
    );
  }

  /**
   * Update throttle configuration for an event type
   */
  updateThrottleConfig(
    eventType: WorkspaceEventType,
    config: Partial<ThrottleConfig>
  ): void {
    const currentConfig = this.throttleConfig.get(eventType) || {
      enabled: true,
      windowMs: 5000,
      maxEvents: 5,
    };

    this.throttleConfig.set(eventType, {
      ...currentConfig,
      ...config,
    });
  }

  /**
   * Get throttle statistics
   */
  getThrottleStats(): Map<WorkspaceEventType, { eventsInWindow: number; lastBroadcast: number }> {
    const stats = new Map<
      WorkspaceEventType,
      { eventsInWindow: number; lastBroadcast: number }
    >();

    const now = Date.now();

    for (const [eventType, state] of this.throttleState) {
      const config = this.throttleConfig.get(eventType);
      if (!config) continue;

      const eventsInWindow = state.events.filter(
        (e) => now - e.timestamp.getTime() < config.windowMs
      ).length;

      stats.set(eventType, {
        eventsInWindow,
        lastBroadcast: state.lastBroadcast,
      });
    }

    return stats;
  }

  /**
   * Reset throttle state
   */
  resetThrottleState(): void {
    this.throttleState.clear();
  }

  /**
   * Dispose broadcaster
   */
  dispose(): void {
    this.connections = [];
    this.throttleState.clear();
  }
}
