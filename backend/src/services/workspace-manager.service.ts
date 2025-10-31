/**
 * Workspace Manager Client Service
 * Handles WebSocket communication with Kiro IDE extension
 */

import { io, Socket } from 'socket.io-client';
import { EventEmitter } from 'events';
import {
  ConnectionState,
  ConnectionOptions,
  MessageType,
  CommandMessage,
  CommandResponseMessage,
  EventMessage,
  WorkspaceEvent,
  CommandResult,
  EventCallback,
} from '../types/workspace.types';
import { Command } from '../types/command.types';

/**
 * Workspace Manager Client
 * Manages WebSocket connection to Kiro IDE extension
 */
export class WorkspaceManagerClient extends EventEmitter {
  private socket: Socket | null = null;
  private connectionState: ConnectionState = ConnectionState.DISCONNECTED;
  private options: ConnectionOptions;
  private reconnectAttempts = 0;
  private maxReconnectAttempts: number;
  private reconnectDelay: number;
  private commandTimeout: number;
  private pendingCommands: Map<
    string,
    {
      resolve: (result: CommandResult) => void;
      reject: (error: Error) => void;
      timeout: NodeJS.Timeout;
    }
  > = new Map();
  private eventCallbacks: Set<EventCallback> = new Set();

  constructor(options: ConnectionOptions) {
    super();
    this.options = options;
    this.maxReconnectAttempts = options.reconnectAttempts || 5;
    this.reconnectDelay = options.reconnectDelay || 1000;
    this.commandTimeout = options.timeout || 10000; // 10 seconds default
  }

  /**
   * Connect to Kiro IDE extension
   */
  async connect(): Promise<void> {
    if (
      this.connectionState === ConnectionState.CONNECTED ||
      this.connectionState === ConnectionState.CONNECTING
    ) {
      return;
    }

    this.connectionState = ConnectionState.CONNECTING;
    this.emit('stateChange', ConnectionState.CONNECTING);

    return new Promise((resolve, reject) => {
      try {
        // Create Socket.io client
        this.socket = io(this.options.url, {
          auth: {
            token: this.options.token,
            workspaceId: this.options.workspaceId,
          },
          reconnection: false, // We handle reconnection manually
          timeout: this.commandTimeout,
        });

        // Connection successful
        this.socket.on('connect', () => {
          this.connectionState = ConnectionState.CONNECTED;
          this.reconnectAttempts = 0;
          this.emit('stateChange', ConnectionState.CONNECTED);
          this.emit('connected');
          resolve();
        });

        // Authentication success
        this.socket.on(MessageType.AUTH_SUCCESS, () => {
          console.log('Authentication successful');
        });

        // Authentication failure
        this.socket.on(MessageType.AUTH_FAILURE, (data: any) => {
          console.error('Authentication failed:', data);
          this.connectionState = ConnectionState.ERROR;
          this.emit('stateChange', ConnectionState.ERROR);
          this.emit('authError', data);
          reject(new Error('Authentication failed'));
        });

        // Command response
        this.socket.on(
          MessageType.COMMAND_RESPONSE,
          (message: CommandResponseMessage) => {
            this.handleCommandResponse(message);
          }
        );

        // Workspace events
        this.socket.on(MessageType.EVENT, (message: EventMessage) => {
          this.handleWorkspaceEvent(message);
        });

        // Connection error
        this.socket.on('connect_error', (error: Error) => {
          console.error('Connection error:', error);
          this.connectionState = ConnectionState.ERROR;
          this.emit('stateChange', ConnectionState.ERROR);
          this.emit('error', error);

          if (this.options.reconnect !== false) {
            this.scheduleReconnect();
          } else {
            reject(error);
          }
        });

        // Disconnection
        this.socket.on('disconnect', (reason: string) => {
          console.log('Disconnected:', reason);
          this.connectionState = ConnectionState.DISCONNECTED;
          this.emit('stateChange', ConnectionState.DISCONNECTED);
          this.emit('disconnected', reason);

          // Reject all pending commands
          this.rejectAllPendingCommands(
            new Error('Connection lost: ' + reason)
          );

          if (
            this.options.reconnect !== false &&
            reason !== 'io client disconnect'
          ) {
            this.scheduleReconnect();
          }
        });

        // Pong response for ping
        this.socket.on(MessageType.PONG, () => {
          this.emit('pong');
        });
      } catch (error) {
        this.connectionState = ConnectionState.ERROR;
        this.emit('stateChange', ConnectionState.ERROR);
        reject(error);
      }
    });
  }

  /**
   * Disconnect from Kiro IDE extension
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.connectionState = ConnectionState.DISCONNECTED;
    this.emit('stateChange', ConnectionState.DISCONNECTED);
    this.rejectAllPendingCommands(new Error('Client disconnected'));
  }

  /**
   * Schedule reconnection with exponential backoff
   */
  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      this.connectionState = ConnectionState.ERROR;
      this.emit('stateChange', ConnectionState.ERROR);
      this.emit('reconnectFailed');
      return;
    }

    this.connectionState = ConnectionState.RECONNECTING;
    this.emit('stateChange', ConnectionState.RECONNECTING);

    // Exponential backoff: delay * 2^attempts
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts);
    this.reconnectAttempts++;

    console.log(
      `Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`
    );

    setTimeout(() => {
      this.connect().catch((error) => {
        console.error('Reconnection failed:', error);
        this.scheduleReconnect();
      });
    }, delay);
  }

  /**
   * Handle command response from extension
   */
  private handleCommandResponse(message: CommandResponseMessage): void {
    const { id, success, data, error, executionTime } = message.payload;

    const pending = this.pendingCommands.get(id);
    if (!pending) {
      console.warn('Received response for unknown command:', id);
      return;
    }

    // Clear timeout
    clearTimeout(pending.timeout);
    this.pendingCommands.delete(id);

    // Resolve or reject the promise
    if (success) {
      pending.resolve({ success, data, executionTime });
    } else {
      pending.reject(new Error(error || 'Command execution failed'));
    }
  }

  /**
   * Handle workspace event from extension
   */
  private handleWorkspaceEvent(message: EventMessage): void {
    const event: WorkspaceEvent = message.payload;

    // Emit to internal listeners
    this.emit('workspaceEvent', event);

    // Call registered callbacks
    this.eventCallbacks.forEach((callback) => {
      try {
        callback(event);
      } catch (error) {
        console.error('Error in event callback:', error);
      }
    });
  }

  /**
   * Reject all pending commands
   */
  private rejectAllPendingCommands(error: Error): void {
    this.pendingCommands.forEach((pending) => {
      clearTimeout(pending.timeout);
      pending.reject(error);
    });
    this.pendingCommands.clear();
  }

  /**
   * Get current connection state
   */
  getConnectionState(): ConnectionState {
    return this.connectionState;
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.connectionState === ConnectionState.CONNECTED;
  }

  /**
   * Send ping to check connection
   */
  ping(): void {
    if (this.socket && this.isConnected()) {
      this.socket.emit(MessageType.PING);
    }
  }

  /**
   * Execute a command via WebSocket
   * @param command - The command to execute
   * @returns Promise that resolves with command result
   */
  async executeCommand(command: Command): Promise<CommandResult> {
    if (!this.isConnected()) {
      throw new Error('Not connected to workspace');
    }

    if (!this.socket) {
      throw new Error('Socket not initialized');
    }

    // Generate unique command ID
    const commandId = this.generateCommandId();

    // Check cache for frequently accessed data
    const cacheKey = this.getCacheKey(command);
    const cachedResult = await this.getFromCache(cacheKey);
    if (cachedResult) {
      return cachedResult;
    }

    // Create promise for command execution
    return new Promise<CommandResult>((resolve, reject) => {
      // Set timeout for command execution
      const timeout = setTimeout(() => {
        this.pendingCommands.delete(commandId);
        reject(new Error(`Command timeout after ${this.commandTimeout}ms`));
      }, this.commandTimeout);

      // Store pending command
      this.pendingCommands.set(commandId, {
        resolve: async (result: CommandResult) => {
          // Cache successful results for frequently accessed data
          if (result.success && this.shouldCache(command)) {
            await this.setCache(cacheKey, result);
          }
          resolve(result);
        },
        reject,
        timeout,
      });

      // Send command via WebSocket
      const message: CommandMessage = {
        type: MessageType.COMMAND,
        payload: {
          id: commandId,
          command,
        },
        timestamp: Date.now(),
      };

      this.socket!.emit(MessageType.COMMAND, message);
    });
  }

  /**
   * Subscribe to workspace events
   * @param callback - Function to call when events are received
   * @returns Unsubscribe function
   */
  subscribeToEvents(callback: EventCallback): () => void {
    this.eventCallbacks.add(callback);

    // Return unsubscribe function
    return () => {
      this.eventCallbacks.delete(callback);
    };
  }

  /**
   * Subscribe to workspace events with filtering
   * @param callback - Function to call when events are received
   * @param userId - User ID for settings-based filtering
   * @returns Unsubscribe function
   */
  subscribeToEventsWithFilter(
    callback: EventCallback,
    userId: string
  ): () => void {
    // Create filtered callback
    const filteredCallback: EventCallback = async (event: WorkspaceEvent) => {
      try {
        // Check if user wants this event type
        const shouldNotify = await this.shouldNotifyUser(userId, event);
        if (shouldNotify) {
          callback(event);
        }
      } catch (error) {
        console.error('Error filtering event:', error);
        // On error, pass through the event
        callback(event);
      }
    };

    this.eventCallbacks.add(filteredCallback);

    // Return unsubscribe function
    return () => {
      this.eventCallbacks.delete(filteredCallback);
    };
  }

  /**
   * Check if user should be notified about an event based on settings
   */
  private async shouldNotifyUser(
    userId: string,
    event: WorkspaceEvent
  ): Promise<boolean> {
    try {
      // Import prisma client
      const { prisma } = await import('../db/prisma');

      // Get user settings
      const settings = await prisma.settings.findUnique({
        where: { userId },
      });

      if (!settings) {
        // Default: notify all events if no settings found
        return true;
      }

      // Check if notifications are enabled
      if (!settings.notificationEnabled) {
        return false;
      }

      // Check if this event type is in the allowed list
      const notificationTypes = settings.notificationTypes as string[];
      if (
        notificationTypes &&
        notificationTypes.length > 0 &&
        !notificationTypes.includes(event.type)
      ) {
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error checking user notification settings:', error);
      // On error, default to notifying
      return true;
    }
  }

  /**
   * Get all active event subscriptions count
   */
  getSubscriptionCount(): number {
    return this.eventCallbacks.size;
  }

  /**
   * Clear all event subscriptions
   */
  clearAllSubscriptions(): void {
    this.eventCallbacks.clear();
  }

  /**
   * Generate unique command ID
   */
  private generateCommandId(): string {
    return `cmd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get cache key for command
   */
  private getCacheKey(command: Command): string {
    switch (command.type) {
      case 'FILE_READ':
        return `file:${command.path}`;
      case 'FILE_LIST':
        return `list:${command.directory}`;
      case 'STATUS':
        return 'status:workspace';
      default:
        return '';
    }
  }

  /**
   * Check if command result should be cached
   */
  private shouldCache(command: Command): boolean {
    // Cache file reads and directory listings
    return command.type === 'FILE_READ' || command.type === 'FILE_LIST';
  }

  /**
   * Get result from cache
   */
  private async getFromCache(key: string): Promise<CommandResult | null> {
    if (!key) return null;

    try {
      // Import redis client
      const { getRedisClient } = await import('../db/redis');
      const redisClient = await getRedisClient();

      const cached = await redisClient.get(`workspace:cache:${key}`);
      if (cached) {
        const result = JSON.parse(cached);
        // Add cache hit indicator
        result.fromCache = true;
        return result;
      }
    } catch (error) {
      console.error('Cache get error:', error);
    }

    return null;
  }

  /**
   * Set result in cache
   */
  private async setCache(
    key: string,
    result: CommandResult
  ): Promise<void> {
    if (!key) return;

    try {
      // Import redis client
      const { getRedisClient } = await import('../db/redis');
      const redisClient = await getRedisClient();

      // Cache for 5 minutes
      await redisClient.setEx(
        `workspace:cache:${key}`,
        300,
        JSON.stringify(result)
      );
    } catch (error) {
      console.error('Cache set error:', error);
    }
  }

  /**
   * Clear cache for specific key or all cache
   */
  async clearCache(key?: string): Promise<void> {
    try {
      const { getRedisClient } = await import('../db/redis');
      const redisClient = await getRedisClient();

      if (key) {
        await redisClient.del(`workspace:cache:${key}`);
      } else {
        // Clear all workspace cache
        const keys = await redisClient.keys('workspace:cache:*');
        if (keys.length > 0) {
          await redisClient.del(keys);
        }
      }
    } catch (error) {
      console.error('Cache clear error:', error);
    }
  }
}

/**
 * Workspace Manager Client Factory
 * Creates and manages workspace manager client instances
 */
export class WorkspaceManagerFactory {
  private static instances: Map<string, WorkspaceManagerClient> = new Map();

  /**
   * Get or create a workspace manager client
   */
  static getClient(options: ConnectionOptions): WorkspaceManagerClient {
    const key = `${options.workspaceId}:${options.url}`;

    let client = this.instances.get(key);
    if (!client) {
      client = new WorkspaceManagerClient(options);
      this.instances.set(key, client);
    }

    return client;
  }

  /**
   * Remove a client instance
   */
  static removeClient(workspaceId: string, url: string): void {
    const key = `${workspaceId}:${url}`;
    const client = this.instances.get(key);

    if (client) {
      client.disconnect();
      this.instances.delete(key);
    }
  }

  /**
   * Disconnect all clients
   */
  static disconnectAll(): void {
    this.instances.forEach((client) => client.disconnect());
    this.instances.clear();
  }
}

