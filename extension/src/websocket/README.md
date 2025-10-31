# WebSocket Server Module

This module implements the WebSocket server for the Kiro WhatsApp Integration extension.

## Components

### WebSocketServerManager

The main class that manages the WebSocket server lifecycle and connections.

#### Features

- **Server Lifecycle Management**: Start and stop the WebSocket server
- **Connection Authentication**: JWT-based authentication for incoming connections
- **Connection Management**: Track and manage active WebSocket connections
- **Message Routing**: Handle different message types from connected clients
- **Broadcasting**: Send messages to all connected clients or specific connections

#### Configuration

The server uses VS Code configuration settings:

- `kiroWhatsapp.websocketPort`: Port for the WebSocket server (default: 3001)
- `kiroWhatsapp.autoStart`: Auto-start server on extension activation (default: true)

#### Authentication Flow

1. Client connects to WebSocket server
2. Client must send authentication message within 10 seconds
3. Server validates JWT token and workspace ID
4. On success, connection is established and tracked
5. Client can now send commands and receive events

#### Message Types

**Client → Server:**
- `auth`: Authentication message with JWT token
- `ping`: Keep-alive ping
- `command`: Execute workspace command

**Server → Client:**
- `auth_response`: Authentication result
- `pong`: Ping response
- `command_response`: Command execution result
- `error`: Error message

#### Connection Management

Each connection is tracked with:
- WebSocket instance
- User ID
- Workspace ID
- Connection timestamp

#### Security

- JWT token validation
- Workspace ID verification
- 10-second authentication timeout
- Automatic cleanup of closed connections

## Usage

```typescript
import { WebSocketServerManager } from './websocket/server';

// Initialize
const wsManager = new WebSocketServerManager(context);

// Start server
await wsManager.start();

// Get status
const status = wsManager.getStatus();

// Broadcast message
wsManager.broadcast({ type: 'event', data: {...} });

// Stop server
await wsManager.stop();
```

## Requirements Satisfied

- **Requirement 6.1**: Settings interface for configuring integration preferences
- **Requirement 4.1**: Command execution through workspace manager
