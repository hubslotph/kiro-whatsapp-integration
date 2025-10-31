# Settings Management System

## Overview

The settings management system provides a comprehensive interface for users to configure their Kiro WhatsApp integration preferences. It includes a webview-based UI in the Kiro IDE extension, backend API endpoints for CRUD operations, Redis caching for performance, and real-time synchronization between the extension and backend.

## Architecture

### Components

1. **Extension Settings Panel** (`extension/src/settings/settings-panel.ts`)
   - Webview-based UI for managing settings
   - Form validation and user interaction
   - Communication with backend API

2. **Settings Validator** (`extension/src/settings/settings-validator.ts`)
   - Client-side validation logic
   - Data sanitization
   - Error message generation

3. **Settings Service** (`backend/src/services/settings.service.ts`)
   - Core business logic for settings management
   - Database operations via Prisma
   - Redis caching for performance
   - Event emission for settings changes

4. **Settings API Routes** (`backend/src/routes/settings.routes.ts`)
   - RESTful API endpoints
   - Request validation
   - Authentication middleware integration

5. **Settings Broadcaster** (`backend/src/services/settings-broadcaster.service.ts`)
   - Real-time settings synchronization
   - WebSocket event broadcasting
   - Connection management

## Features

### Settings Configuration

Users can configure the following settings:

1. **Notifications**
   - Enable/disable WhatsApp notifications
   - Select notification types:
     - Build Complete
     - Errors
     - Git Operations
     - File Changes

2. **Workspace Access**
   - Read-only mode toggle
   - Accessible directories list
   - Directory access control

### API Endpoints

#### GET /api/settings
Get current user settings (creates defaults if none exist)

**Response:**
```json
{
  "id": "uuid",
  "userId": "uuid",
  "notificationEnabled": true,
  "notificationTypes": ["BUILD_COMPLETE", "ERROR"],
  "accessibleDirectories": ["src", "tests"],
  "readOnlyMode": true,
  "createdAt": "2024-01-01T00:00:00Z",
  "updatedAt": "2024-01-01T00:00:00Z"
}
```

#### PUT /api/settings
Update user settings

**Request Body:**
```json
{
  "notificationEnabled": true,
  "notificationTypes": ["BUILD_COMPLETE", "ERROR", "GIT_OPERATION"],
  "accessibleDirectories": ["src", "tests", "docs"],
  "readOnlyMode": false
}
```

**Response:**
```json
{
  "id": "uuid",
  "userId": "uuid",
  "notificationEnabled": true,
  "notificationTypes": ["BUILD_COMPLETE", "ERROR", "GIT_OPERATION"],
  "accessibleDirectories": ["src", "tests", "docs"],
  "readOnlyMode": false,
  "createdAt": "2024-01-01T00:00:00Z",
  "updatedAt": "2024-01-01T00:00:00Z"
}
```

#### DELETE /api/settings
Reset settings to defaults

**Response:**
```json
{
  "message": "Settings reset to defaults",
  "settings": {
    "id": "uuid",
    "userId": "uuid",
    "notificationEnabled": true,
    "notificationTypes": [],
    "accessibleDirectories": [],
    "readOnlyMode": true,
    "createdAt": "2024-01-01T00:00:00Z",
    "updatedAt": "2024-01-01T00:00:00Z"
  }
}
```

## Validation Rules

### Notification Types
- Must be one of: `BUILD_COMPLETE`, `ERROR`, `GIT_OPERATION`, `FILE_CHANGED`
- At least one type must be selected when notifications are enabled

### Accessible Directories
- Must be relative paths (no absolute paths)
- Cannot contain `..` (parent directory references)
- Cannot be empty strings
- No duplicates allowed

### Read-Only Mode
- Boolean value
- When enabled, restricts WhatsApp commands to read-only operations

## Caching Strategy

Settings are cached in Redis with the following characteristics:

- **Cache Key Format:** `settings:{userId}`
- **TTL:** 1 hour (3600 seconds)
- **Cache Invalidation:** Automatic on updates/deletes
- **Fallback:** Database query if cache miss

## Real-Time Synchronization

When settings are updated:

1. Settings are saved to database
2. Cache is updated
3. `settingsChanged` event is emitted
4. Settings broadcaster sends WebSocket event to connected extension
5. Extension receives `SETTINGS_UPDATED` event with new settings

### Event Types

- `SETTINGS_UPDATED`: Sent when settings are modified
- `SETTINGS_LOADED`: Sent when extension connects (initial sync)

## Usage Examples

### Opening Settings Panel in Extension

```typescript
// Via command palette
vscode.commands.executeCommand('kiro-whatsapp.openSettingsPanel');

// Programmatically
import { SettingsPanel } from './settings/settings-panel';

const panel = SettingsPanel.createOrShow(context.extensionUri);
await panel.loadSettings();
```

### Listening for Settings Changes

```typescript
const panel = SettingsPanel.createOrShow(context.extensionUri);

panel.onSettingsChanged((settings) => {
  console.log('Settings updated:', settings);
  // React to settings changes
});
```

### Checking Settings in Backend

```typescript
import { SettingsService } from './services/settings.service';

const settingsService = new SettingsService(prisma);

// Check if directory is accessible
const isAccessible = await settingsService.isDirectoryAccessible(userId, 'src/components');

// Check if read-only mode
const isReadOnly = await settingsService.isReadOnlyMode(userId);

// Get notification types
const notificationTypes = await settingsService.getNotificationTypes(userId);
```

## Security Considerations

1. **Authentication Required:** All API endpoints require valid JWT token
2. **User Isolation:** Users can only access their own settings
3. **Path Validation:** Directory paths are validated to prevent directory traversal
4. **Input Sanitization:** All inputs are validated and sanitized

## Error Handling

### Common Errors

- **401 Unauthorized:** Missing or invalid authentication token
- **400 Bad Request:** Invalid request body or validation errors
- **500 Internal Server Error:** Database or Redis connection issues

### Error Response Format

```json
{
  "error": "Error message",
  "message": "Detailed error description",
  "invalidTypes": ["INVALID_TYPE"] // Optional, for validation errors
}
```

## Testing

### Manual Testing

1. Open Kiro IDE with extension installed
2. Run command: "Kiro WhatsApp: Open Settings Panel"
3. Modify settings and save
4. Verify settings are persisted
5. Check backend logs for event broadcasting

### API Testing

```bash
# Get settings
curl -H "Authorization: Bearer <token>" http://localhost:3000/api/settings

# Update settings
curl -X PUT -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"notificationEnabled": true, "notificationTypes": ["ERROR"]}' \
  http://localhost:3000/api/settings

# Reset settings
curl -X DELETE -H "Authorization: Bearer <token>" \
  http://localhost:3000/api/settings
```

## Future Enhancements

1. Settings versioning and history
2. Settings import/export
3. Team-level settings (shared across users)
4. Settings templates
5. Advanced notification filtering rules
6. Settings backup and restore
