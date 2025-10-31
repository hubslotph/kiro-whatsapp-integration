# Notification Service

The notification service handles workspace event notifications sent to users via WhatsApp. It consists of three main components:

## Components

### 1. Notification Dispatcher (`notification-dispatcher.service.ts`)

Handles notification queuing, batching, and delivery.

**Key Features:**
- **Notification Queue**: Uses Redis to queue notifications for delivery
- **Batching**: Groups notifications within a 30-second window to avoid spam
- **Priority Handling**: Urgent notifications bypass batching and are sent immediately
- **Retry Logic**: Failed deliveries are automatically retried
- **Formatting**: Formats notifications with appropriate emojis and styling

**Usage:**
```typescript
import { notificationDispatcher } from './services/notification-dispatcher.service';

// Queue a notification
await notificationDispatcher.queueNotification(
  userId,
  phoneNumber,
  NotificationType.BUILD_COMPLETE,
  'Build Complete',
  'Your build finished successfully',
  NotificationPriority.MEDIUM
);

// Queue from workspace event
await notificationDispatcher.queueNotificationFromEvent(
  userId,
  phoneNumber,
  workspaceEvent
);
```

### 2. Notification Settings Service (`notification-settings.service.ts`)

Manages user notification preferences and filtering.

**Key Features:**
- **Settings Management**: Enable/disable notifications globally or by type
- **Caching**: Settings are cached in Redis for fast access
- **Filtering**: Checks user preferences before sending notifications

**Usage:**
```typescript
import { notificationSettingsService } from './services/notification-settings.service';

// Get user settings
const settings = await notificationSettingsService.getSettings(userId);

// Update settings
await notificationSettingsService.updateSettings(
  userId,
  true, // enabled
  [NotificationType.BUILD_COMPLETE, NotificationType.ERROR]
);

// Check if notification should be sent
const shouldSend = await notificationSettingsService.shouldSendNotification(
  userId,
  NotificationType.BUILD_COMPLETE
);
```

### 3. Notification Service (`notification.service.ts`)

High-level service that combines dispatcher and settings for easy use.

**Key Features:**
- **Automatic Filtering**: Checks user preferences before queuing notifications
- **Simple Interface**: Single method to send notifications with filtering
- **Event Handling**: Converts workspace events to notifications

**Usage:**
```typescript
import { notificationService } from './services/notification.service';

// Send notification (automatically filtered based on user settings)
await notificationService.sendNotification(
  userId,
  phoneNumber,
  NotificationType.ERROR,
  'Error Detected',
  'An error occurred in your workspace',
  NotificationPriority.HIGH
);

// Send from workspace event
await notificationService.sendNotificationFromEvent(
  userId,
  phoneNumber,
  workspaceEvent
);
```

## API Endpoints

The notification routes (`notification.routes.ts`) provide REST API endpoints for managing settings:

### Get Settings
```
GET /api/notifications/settings
Authorization: Bearer <token>
```

### Update Settings
```
PUT /api/notifications/settings
Authorization: Bearer <token>
Content-Type: application/json

{
  "enabled": true,
  "types": ["BUILD_COMPLETE", "ERROR"]
}
```

### Enable/Disable Notifications
```
POST /api/notifications/enable
POST /api/notifications/disable
Authorization: Bearer <token>
```

### Manage Notification Types
```
POST /api/notifications/types/enable
POST /api/notifications/types/disable
Authorization: Bearer <token>
Content-Type: application/json

{
  "types": ["BUILD_COMPLETE", "ERROR"]
}
```

### Get Available Types
```
GET /api/notifications/types
Authorization: Bearer <token>
```

## Notification Types

- `BUILD_COMPLETE`: Build completion notifications
- `ERROR`: Error and failure notifications
- `GIT_OPERATION`: Git operation notifications
- `FILE_CHANGED`: File change notifications

## Notification Priorities

- `LOW`: Batched, low priority
- `MEDIUM`: Batched, normal priority
- `HIGH`: Batched, high priority
- `URGENT`: Sent immediately, bypasses batching

## Batching Behavior

- Notifications are batched within a 30-second window
- Multiple notifications to the same user are combined into a single message
- Urgent priority notifications bypass batching and are sent immediately
- Batches are formatted with numbered lists for readability

## Integration with Workspace Manager

To integrate with the workspace manager, subscribe to workspace events and send notifications:

```typescript
import { notificationService } from './services/notification.service';
import { workspaceManager } from './services/workspace-manager.service';

// Subscribe to workspace events
workspaceManager.subscribeToEvents(async (event) => {
  // Get user info from session
  const user = await getUserFromWorkspace(event.workspaceId);
  
  // Send notification
  await notificationService.sendNotificationFromEvent(
    user.id,
    user.phoneNumber,
    event
  );
});
```

## Configuration

Environment variables:
- `REDIS_HOST`: Redis host (default: localhost)
- `REDIS_PORT`: Redis port (default: 6379)
- `REDIS_PASSWORD`: Redis password (optional)

## Architecture

```
Workspace Event
    ↓
Notification Service (checks settings)
    ↓
Notification Dispatcher (queues & batches)
    ↓
Redis Queue
    ↓
Batch Timer (30s window)
    ↓
WhatsApp Sender
    ↓
User receives notification
```

## Error Handling

- Failed deliveries are automatically retried
- Errors are logged for debugging
- Circuit breaker pattern prevents cascading failures
- Graceful degradation if Redis is unavailable

## Testing

To test the notification system:

1. Start the backend service
2. Authenticate a user
3. Update notification settings via API
4. Trigger workspace events
5. Verify notifications are received on WhatsApp

## Performance Considerations

- Notifications are queued in Redis for scalability
- Settings are cached to reduce database queries
- Batching reduces WhatsApp API calls
- Processor runs every 5 seconds to handle queue
