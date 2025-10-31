# Event System

The event system enables the Kiro WhatsApp Integration extension to monitor workspace events and broadcast them to connected clients via WebSocket.

## Architecture

The event system consists of three main components:

### 1. Event Types (`event-types.ts`)

Defines all workspace event types and their payload structures:

- **BUILD_COMPLETE**: Emitted when a build/task completes
- **ERROR**: Emitted when errors or diagnostics are detected
- **GIT_OPERATION**: Emitted when Git operations occur
- **FILE_CHANGED**: Emitted when files are created, modified, or deleted

### 2. Event Listener Manager (`event-listeners.ts`)

Registers listeners for VS Code events and converts them to workspace events:

- **Diagnostic Listeners**: Monitors error diagnostics and emits ERROR events
- **Git Listeners**: Monitors Git repository state changes and emits GIT_OPERATION events
- **File Change Listeners**: Monitors file system changes and emits FILE_CHANGED events
- **Task Listeners**: Monitors task execution and emits BUILD_COMPLETE events

### 3. Event Broadcaster (`event-broadcaster.ts`)

Handles event serialization, throttling, and broadcasting to WebSocket clients:

- **Event Serialization**: Converts events to JSON for transmission
- **Event Throttling**: Prevents event spam by limiting events per time window
- **Broadcasting**: Sends events to all connected WebSocket clients

## Usage

The event system is automatically initialized when the WebSocket server starts:

```typescript
// In WebSocketServerManager constructor
this.eventListenerManager = new EventListenerManager();
this.eventBroadcaster = new EventBroadcaster();

// Register event listeners
this.eventListenerManager.register(context);

// Subscribe to events and broadcast them
this.eventListenerManager.subscribe((event: WorkspaceEvent) => {
  this.handleWorkspaceEvent(event);
});
```

## Event Throttling

To prevent event spam, the broadcaster implements throttling for each event type:

| Event Type | Window | Max Events |
|------------|--------|------------|
| BUILD_COMPLETE | 5 seconds | 2 |
| ERROR | 10 seconds | 5 |
| GIT_OPERATION | 3 seconds | 3 |
| FILE_CHANGED | 30 seconds | 10 |

Throttling can be configured using `EventBroadcaster.updateThrottleConfig()`.

## Event Flow

```
VS Code Event → Event Listener → Workspace Event → Event Broadcaster → WebSocket Clients
```

1. VS Code emits an event (e.g., diagnostic change, task completion)
2. Event Listener Manager captures the event and converts it to a WorkspaceEvent
3. Event is passed to subscribed callbacks
4. WebSocket Server receives the event and passes it to Event Broadcaster
5. Event Broadcaster checks throttling rules
6. If not throttled, event is serialized and sent to all connected WebSocket clients

## Event Message Format

Events are sent to WebSocket clients in the following format:

```json
{
  "type": "event",
  "event": {
    "type": "BUILD_COMPLETE",
    "timestamp": "2025-10-30T12:34:56.789Z",
    "payload": {
      "status": "success",
      "duration": 1234,
      "errors": 0,
      "warnings": 2
    }
  }
}
```

## Requirements Satisfied

This implementation satisfies the following requirements:

- **Requirement 3.1**: Build complete notifications sent within 5 seconds
- **Requirement 3.2**: Error notifications sent within 5 seconds
- **Requirement 3.4**: Git operation notifications sent to linked accounts
- **Requirement 3.5**: Notification batching (via throttling mechanism)

## Future Enhancements

- User-configurable throttling settings
- Event filtering based on user preferences
- Event persistence for offline clients
- Event acknowledgment from clients
