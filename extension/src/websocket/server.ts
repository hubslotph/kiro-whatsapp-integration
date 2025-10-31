import * as vscode from 'vscode';
import { Server as SocketIOServer, Socket } from 'socket.io';
import * as jwt from 'jsonwebtoken';
import * as http from 'http';
import { WorkspaceController } from '../workspace/controller';
import { WorkspaceCommand } from '../types/workspace.types';
import { EventListenerManager, EventBroadcaster, WorkspaceEvent } from '../events';

interface ConnectionInfo {
  socket: Socket;
  userId: string;
  workspaceId: string;
  connectedAt: Date;
}

interface ServerStatus {
  isRunning: boolean;
  port: number;
  activeConnections: number;
  uptime: string;
}

/**
 * WebSocket Server Manager
 * Manages WebSocket server lifecycle and connections
 */
export class WebSocketServerManager {
  private server: SocketIOServer | undefined;
  private httpServer: http.Server | undefined;
  private connections: Map<string, ConnectionInfo> = new Map();
  private startTime: Date | undefined;
  private workspaceController: WorkspaceController;
  private eventListenerManager: EventListenerManager;
  private eventBroadcaster: EventBroadcaster;

  constructor(context: vscode.ExtensionContext) {
    this.workspaceController = new WorkspaceController();
    this.eventListenerManager = new EventListenerManager();
    this.eventBroadcaster = new EventBroadcaster();

    // Register event listeners
    this.eventListenerManager.register(context);

    // Subscribe to events and broadcast them
    this.eventListenerManager.subscribe((event: WorkspaceEvent) => {
      this.handleWorkspaceEvent(event);
    });
  }

  /**
   * Start the WebSocket server
   */
  async start(): Promise<void> {
    if (this.server) {
      throw new Error('WebSocket server is already running');
    }

    const config = vscode.workspace.getConfiguration('kiroWhatsapp');
    const port = config.get<number>('websocketPort', 3001);

    return new Promise((resolve, reject) => {
      try {
        // Create HTTP server for Socket.IO
        this.httpServer = http.createServer();

        // Create Socket.IO server
        this.server = new SocketIOServer(this.httpServer, {
          cors: {
            origin: '*',
            methods: ['GET', 'POST'],
          },
        });

        // Set up connection handler
        this.server.on('connection', (socket) => {
          this.handleConnection(socket);
        });

        // Set up error handler
        this.server.on('error', (error) => {
          console.error('Socket.IO server error:', error);
          vscode.window.showErrorMessage(`Socket.IO server error: ${error.message}`);
        });

        // Start listening
        this.httpServer.listen(port, () => {
          this.startTime = new Date();
          console.log(`Socket.IO server started on port ${port}`);
          resolve();
        });

        this.httpServer.on('error', (error: NodeJS.ErrnoException) => {
          if (error.code === 'EADDRINUSE') {
            reject(new Error(`Port ${port} is already in use`));
          } else {
            reject(error);
          }
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Stop the WebSocket server
   */
  async stop(): Promise<void> {
    if (!this.server) {
      return;
    }

    // Close all active connections
    for (const [connectionId, connection] of this.connections) {
      connection.socket.disconnect(true);
      this.connections.delete(connectionId);
    }

    // Dispose event system
    this.eventListenerManager.dispose();
    this.eventBroadcaster.dispose();

    // Close the server
    return new Promise((resolve, reject) => {
      this.server!.close((error) => {
        if (error) {
          reject(error);
        } else {
          this.server = undefined;
          this.startTime = undefined;

          if (this.httpServer) {
            this.httpServer.close();
            this.httpServer = undefined;
          }

          console.log('WebSocket server stopped');
          resolve();
        }
      });
    });
  }

  /**
   * Handle new Socket.IO connection
   */
  private handleConnection(socket: Socket): void {
    console.log('New Socket.IO connection attempt');

    // Get authentication data from handshake
    const token = socket.handshake.auth.token;
    const workspaceId = socket.handshake.auth.workspaceId;

    if (!token || !workspaceId) {
      socket.emit('AUTH_FAILURE', { error: 'Missing authentication credentials' });
      socket.disconnect();
      return;
    }

    // Authenticate connection
    this.authenticateConnection(token, workspaceId)
      .then((authResult) => {
        if (!authResult.success) {
          socket.emit('AUTH_FAILURE', { error: authResult.error });
          socket.disconnect();
          return;
        }

        // Authentication successful
        const connectionId = this.generateConnectionId();
        this.connections.set(connectionId, {
          socket,
          userId: authResult.userId!,
          workspaceId: authResult.workspaceId!,
          connectedAt: new Date(),
        });

        socket.emit('AUTH_SUCCESS', { connectionId });
        console.log(`Client authenticated: ${authResult.userId}`);

        // Set up message handlers for authenticated connection
        this.setupMessageHandlers(socket, connectionId, authResult.userId!);
      })
      .catch((error) => {
        console.error('Authentication error:', error);
        socket.emit('AUTH_FAILURE', { error: 'Authentication failed' });
        socket.disconnect();
      });

    // Handle disconnection
    socket.on('disconnect', () => {
      this.removeConnection(socket);
    });

    // Handle errors
    socket.on('error', (error) => {
      console.error('Socket.IO connection error:', error);
      this.removeConnection(socket);
    });
  }

  /**
   * Authenticate a connection using JWT token
   */
  private async authenticateConnection(
    token: string,
    requestedWorkspaceId: string
  ): Promise<{
    success: boolean;
    userId?: string;
    workspaceId?: string;
    error?: string;
  }> {
    try {
      // Get JWT secret from environment
      const jwtSecret = process.env.JWT_SECRET || 'development-secret-key';

      // Verify JWT token
      const decoded = jwt.verify(token, jwtSecret) as {
        userId: string;
        workspaceId: string;
      };

      // Get workspace folder
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders || workspaceFolders.length === 0) {
        return {
          success: false,
          error: 'No workspace folder open',
        };
      }

      // Validate workspace ID matches
      const currentWorkspaceId = workspaceFolders[0].uri.fsPath;
      if (decoded.workspaceId !== currentWorkspaceId && requestedWorkspaceId !== currentWorkspaceId) {
        return {
          success: false,
          error: 'Workspace ID mismatch',
        };
      }

      return {
        success: true,
        userId: decoded.userId,
        workspaceId: decoded.workspaceId,
      };
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        return {
          success: false,
          error: 'Invalid token',
        };
      } else if (error instanceof jwt.TokenExpiredError) {
        return {
          success: false,
          error: 'Token expired',
        };
      } else {
        return {
          success: false,
          error: 'Authentication failed',
        };
      }
    }
  }

  /**
   * Set up message handlers for authenticated connection
   */
  private setupMessageHandlers(socket: Socket, _connectionId: string, userId: string): void {
    // Handle ping
    socket.on('PING', () => {
      socket.emit('PONG');
    });

    // Handle command execution
    socket.on('COMMAND', async (message: any) => {
      await this.handleCommand(socket, message);
    });

    // Handle any other custom events as needed
    socket.on('disconnect', (reason) => {
      console.log(`Client ${userId} disconnected: ${reason}`);
    });
  }

  /**
   * Handle command execution
   */
  private async handleCommand(socket: Socket, message: any): Promise<void> {
    const { payload } = message;
    const commandId = payload?.id;
    const command: WorkspaceCommand = payload?.command;

    try {
      // Validate command
      if (!command || !command.type) {
        socket.emit('COMMAND_RESPONSE', {
          type: 'COMMAND_RESPONSE',
          payload: {
            id: commandId,
            success: false,
            error: 'Invalid command format',
            executionTime: 0,
          },
          timestamp: Date.now(),
        });
        return;
      }

      // Execute command through workspace controller
      const result = await this.workspaceController.executeCommand(command);

      // Send response
      socket.emit('COMMAND_RESPONSE', {
        type: 'COMMAND_RESPONSE',
        payload: {
          id: commandId,
          success: result.success,
          data: result.data,
          error: result.error,
          executionTime: result.executionTime,
        },
        timestamp: Date.now(),
      });
    } catch (error) {
      socket.emit('COMMAND_RESPONSE', {
        type: 'COMMAND_RESPONSE',
        payload: {
          id: commandId,
          success: false,
          error: `Command execution failed: ${error instanceof Error ? error.message : String(error)}`,
          executionTime: 0,
        },
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Remove a connection
   */
  private removeConnection(socket: Socket): void {
    for (const [connectionId, connection] of this.connections) {
      if (connection.socket === socket) {
        this.connections.delete(connectionId);
        console.log(`Connection removed: ${connectionId}`);
        break;
      }
    }
  }

  /**
   * Generate a unique connection ID
   */
  private generateConnectionId(): string {
    return `conn_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * Get server status
   */
  getStatus(): ServerStatus {
    const config = vscode.workspace.getConfiguration('kiroWhatsapp');
    const port = config.get<number>('websocketPort', 3001);

    let uptime = 'Not running';
    if (this.startTime) {
      const uptimeMs = Date.now() - this.startTime.getTime();
      const uptimeSeconds = Math.floor(uptimeMs / 1000);
      const hours = Math.floor(uptimeSeconds / 3600);
      const minutes = Math.floor((uptimeSeconds % 3600) / 60);
      const seconds = uptimeSeconds % 60;
      uptime = `${hours}h ${minutes}m ${seconds}s`;
    }

    return {
      isRunning: this.server !== undefined,
      port,
      activeConnections: this.connections.size,
      uptime
    };
  }

  /**
   * Handle workspace event
   * Broadcasts events to all connected backend clients
   */
  private handleWorkspaceEvent(event: WorkspaceEvent): void {
    console.log(`Workspace event received: ${event.type}`);

    // Update broadcaster with current connections
    const broadcastConnections = Array.from(this.connections.values()).map((conn) => ({
      socket: conn.socket,
      userId: conn.userId,
      workspaceId: conn.workspaceId,
    }));

    this.eventBroadcaster.setConnections(broadcastConnections);

    // Broadcast event to all connected backend clients
    // This sends the event through WebSocket to the backend
    this.eventBroadcaster.broadcast(event);

    console.log(`Event broadcasted to ${broadcastConnections.length} connected clients`);
  }

  /**
   * Broadcast message to all connected clients
   */
  broadcast(message: any): void {
    for (const connection of this.connections.values()) {
      if (connection.socket.connected) {
        connection.socket.emit(message.type || 'message', message);
      }
    }
  }

  /**
   * Send message to specific connection
   */
  sendToConnection(connectionId: string, message: any): boolean {
    const connection = this.connections.get(connectionId);
    if (connection && connection.socket.connected) {
      connection.socket.emit(message.type || 'message', message);
      return true;
    }
    return false;
  }

  /**
   * Get all active connections
   */
  getConnections(): ConnectionInfo[] {
    return Array.from(this.connections.values());
  }

  /**
   * Get event broadcaster
   */
  getEventBroadcaster(): EventBroadcaster {
    return this.eventBroadcaster;
  }

  /**
   * Get event listener manager
   */
  getEventListenerManager(): EventListenerManager {
    return this.eventListenerManager;
  }
}
