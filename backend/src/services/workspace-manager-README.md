# Workspace Manager Client

The Workspace Manager Client handles WebSocket communication between the backend service and the Kiro IDE extension.

## Features

### 1. WebSocket Connection Management
- Socket.io-client based connection
- JWT token authentication
- Automatic reconnection with exponential backoff
- Connection state tracking (DISCONNECTED, CONNECTING, CONNECTED, RECONNECTING, ERROR)

### 2. Command Execution
- Send commands to Kiro extension via WebSocket
- 10-second timeout per command
- Response parsing and error handling
- Command result caching for frequently accessed data (5-minute TTL)

### 3. Event Subscription
- Subscribe to workspace events (BUILD_COMPLETE, ERROR, GIT_OPERATION, etc.)
- Event filtering based on user notification settings
- Multiple subscribers support
- Unsubscribe functionality

## Usage

### Basic Connection

```typescript
import { WorkspaceManagerClient } from './services/workspace-manager.service';
import { ConnectionOptions } from './types/workspace.types';

const options: ConnectionOptions = {
  workspaceId: 'workspace-123',
  token: 'jwt-token-here',
  url: 'http://localhost:3001',
  reconnect: true,
  reconnectAttempts: 5,
  reconnectDelay: 1000,
  timeout: 10000,
};

const client = new WorkspaceManagerClient(options);

// Connect to workspace
await client.connect();

// Check connection state
console.log(client.getConnectionState());
console.log(client.isConnected());
```

### Execute Commands

```typescript
import { Command } from './types/command.types';

// Read a file
const fileReadCommand: Command = {
  type: 'FILE_READ',
  path: 'src/index.ts',
  raw: 'read src/index.ts',
};

const result = await client.executeCommand(fileReadCommand);
console.log(result.data);

// List directory
const fileListCommand: Command = {
  type: 'FILE_LIST',
  directory: 'src/components',
  raw: 'list src/components',
};

const listResult = await client.executeCommand(fileListCommand);
console.log(listResult.data);

// Search workspace
const searchCommand: Command = {
  type: 'SEARCH',
  query: 'function main',
  raw: 'search "function main"',
};

const searchResult = await client.executeCommand(searchCommand);
console.log(searchResult.data);
```

### Subscribe to Events

```typescript
import { WorkspaceEvent } from './types/workspace.types';

// Basic subscription
const unsubscribe = client.subscribeToEvents((event: WorkspaceEvent) => {
  console.log('Workspace event:', event.type, event.payload);
});

// Later, unsubscribe
unsubscribe();

// Subscription with user settings filtering
const unsubscribeFiltered = client.subscribeToEventsWithFilter(
  (event: WorkspaceEvent) => {
    // This callback only fires for events the user wants
    console.log('Filtered event:', event.type);
  },
  'user-id-123'
);
```

### Connection Events

```typescript
// Listen to connection state changes
client.on('stateChange', (state) => {
  console.log('Connection state:', state);
});

client.on('connected', () => {
  console.log('Connected to workspace');
});

client.on('disconnected', (reason) => {
  console.log('Disconnected:', reason);
});

client.on('error', (error) => {
  console.error('Connection error:', error);
});

client.on('reconnectFailed', () => {
  console.error('Failed to reconnect after max attempts');
});

client.on('workspaceEvent', (event) => {
  console.log('Workspace event received:', event);
});
```

### Cache Management

```typescript
// Clear specific cache entry
await client.clearCache('file:src/index.ts');

// Clear all cache
await client.clearCache();
```

### Disconnect

```typescript
// Disconnect from workspace
client.disconnect();
```

## Factory Pattern

Use the factory to manage multiple workspace connections:

```typescript
import { WorkspaceManagerFactory } from './services/workspace-manager.service';

// Get or create a client
const client = WorkspaceManagerFactory.getClient(options);

// Remove a specific client
WorkspaceManagerFactory.removeClient('workspace-123', 'http://localhost:3001');

// Disconnect all clients
WorkspaceManagerFactory.disconnectAll();
```

## Connection Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `workspaceId` | string | required | Unique workspace identifier |
| `token` | string | required | JWT authentication token |
| `url` | string | required | WebSocket server URL |
| `reconnect` | boolean | true | Enable automatic reconnection |
| `reconnectAttempts` | number | 5 | Maximum reconnection attempts |
| `reconnectDelay` | number | 1000 | Initial reconnection delay (ms) |
| `timeout` | number | 10000 | Command execution timeout (ms) |

## Reconnection Strategy

The client uses exponential backoff for reconnection:
- Attempt 1: 1 second delay
- Attempt 2: 2 seconds delay
- Attempt 3: 4 seconds delay
- Attempt 4: 8 seconds delay
- Attempt 5: 16 seconds delay

After max attempts, the connection enters ERROR state and stops trying.

## Caching Strategy

Command results are cached in Redis with the following rules:

### Cached Commands
- `FILE_READ`: Cached for 5 minutes
- `FILE_LIST`: Cached for 5 minutes
- `STATUS`: Cached for 5 minutes

### Not Cached
- `SEARCH`: Results not cached (dynamic)
- `HELP`: Handled locally (no workspace call)

Cache keys format:
- File read: `workspace:cache:file:<path>`
- Directory list: `workspace:cache:list:<directory>`
- Status: `workspace:cache:status:workspace`

## Error Handling

The client handles various error scenarios:

1. **Connection Errors**: Automatic reconnection with exponential backoff
2. **Authentication Errors**: Emits `authError` event and rejects connection
3. **Command Timeout**: Rejects command promise after timeout period
4. **Disconnection**: Rejects all pending commands and attempts reconnection
5. **Cache Errors**: Logs error but continues operation (cache is optional)

## Integration with Command Service

```typescript
import { commandService } from './services/command.service';
import { WorkspaceManagerClient } from './services/workspace-manager.service';

// Create and connect workspace client
const client = new WorkspaceManagerClient(options);
await client.connect();

// Set workspace client in command service
commandService.setWorkspaceClient(client);

// Now commands will be executed via workspace
const result = await commandService.executeCommand('read src/index.ts', 'user-id');
```

## Requirements Satisfied

This implementation satisfies the following requirements:

- **Requirement 4.1**: Command execution via WebSocket with proper parsing
- **Requirement 4.2**: Command results returned within 10 seconds (timeout enforced)
- **Requirement 4.3**: Error messages sent on command failure
- **Requirement 3.1**: Build complete events delivered within 5 seconds
- **Requirement 3.2**: Error events delivered within 5 seconds
- **Requirement 3.4**: Git operation events delivered

## Next Steps

The workspace manager client is ready for integration with:
1. Notification service (Task 7) - for routing workspace events
2. Kiro IDE extension (Task 8-10) - for handling commands and emitting events
