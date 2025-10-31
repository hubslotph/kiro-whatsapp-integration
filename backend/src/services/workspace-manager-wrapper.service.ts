/**
 * Workspace Manager Service Wrapper
 * Provides high-level interface for workspace operations
 */

import { WorkspaceManagerClient, WorkspaceManagerFactory } from './workspace-manager.service';
import { Command } from '../types/command.types';
import { CommandResult, WorkspaceEvent } from '../types/workspace.types';

/**
 * Workspace Manager Service
 * Manages workspace connections and operations
 */
export class WorkspaceManagerService {
  private clients: Map<string, WorkspaceManagerClient> = new Map();

  /**
   * Get or create workspace client for user
   */
  async getClient(userId: string, workspaceId: string, token: string): Promise<WorkspaceManagerClient> {
    const key = `${userId}:${workspaceId}`;
    
    let client = this.clients.get(key);
    if (!client || !client.isConnected()) {
      // Get extension WebSocket URL from environment
      const extensionUrl = process.env.EXTENSION_WS_URL || 'http://localhost:8080';
      
      client = WorkspaceManagerFactory.getClient({
        url: extensionUrl,
        workspaceId,
        token,
        reconnect: true,
        reconnectAttempts: 5,
        reconnectDelay: 1000,
        timeout: 10000,
      });

      await client.connect();
      this.clients.set(key, client);
    }

    return client;
  }

  /**
   * Execute command for user
   */
  async executeCommand(userId: string, workspaceId: string, token: string, command: Command): Promise<CommandResult> {
    const client = await this.getClient(userId, workspaceId, token);
    return client.executeCommand(command);
  }

  /**
   * Send event to user's workspace extension
   */
  async sendEvent(userId: string, event: WorkspaceEvent): Promise<void> {
    // Find client for this user
    for (const [key, client] of this.clients.entries()) {
      if (key.startsWith(`${userId}:`)) {
        if (client.isConnected()) {
          // Emit event through the client's socket
          (client as any).socket?.emit('event', {
            type: 'EVENT',
            payload: event,
            timestamp: Date.now(),
          });
        }
      }
    }
  }

  /**
   * Disconnect client for user
   */
  disconnectClient(userId: string, workspaceId: string): void {
    const key = `${userId}:${workspaceId}`;
    const client = this.clients.get(key);
    
    if (client) {
      client.disconnect();
      this.clients.delete(key);
    }
  }

  /**
   * Disconnect all clients
   */
  disconnectAll(): void {
    this.clients.forEach(client => client.disconnect());
    this.clients.clear();
  }

  /**
   * Get any connected client (for simple operations)
   * Returns the first connected client found
   */
  getAnyConnectedClient(): WorkspaceManagerClient | null {
    for (const client of this.clients.values()) {
      if (client.isConnected()) {
        return client;
      }
    }
    return null;
  }

  /**
   * Check if any client is connected
   */
  hasConnectedClient(): boolean {
    for (const client of this.clients.values()) {
      if (client.isConnected()) {
        return true;
      }
    }
    return false;
  }

  /**
   * Get all connected clients
   */
  getConnectedClients(): WorkspaceManagerClient[] {
    const connected: WorkspaceManagerClient[] = [];
    for (const client of this.clients.values()) {
      if (client.isConnected()) {
        connected.push(client);
      }
    }
    return connected;
  }
}

// Export singleton instance
export const workspaceManagerService = new WorkspaceManagerService();
