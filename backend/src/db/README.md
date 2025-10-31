# Database Module

This module provides database connectivity and utilities for the Kiro-WhatsApp Integration backend.

## Usage

### Basic Usage

```typescript
import { db } from './db/prisma';

// Query users
const users = await db.user.findMany();

// Create a new user
const user = await db.user.create({
  data: {
    phoneNumber: '+1234567890',
    workspaceId: 'workspace-123',
  },
});

// Update user
await db.user.update({
  where: { id: user.id },
  data: { lastActive: new Date() },
});
```

### Connection Management

```typescript
import { testConnection, disconnectDatabase } from './db/prisma';

// Test connection
const isConnected = await testConnection();

// Disconnect (for graceful shutdown)
await disconnectDatabase();
```

## Database Models

### User
- `id`: UUID (primary key)
- `phoneNumber`: String (unique)
- `workspaceId`: String
- `createdAt`: DateTime
- `lastActive`: DateTime

### Session
- `id`: UUID (primary key)
- `userId`: UUID (foreign key)
- `token`: String (unique)
- `expiresAt`: DateTime
- `createdAt`: DateTime

### Settings
- `id`: UUID (primary key)
- `userId`: UUID (foreign key, unique)
- `notificationEnabled`: Boolean
- `notificationTypes`: JSON array
- `accessibleDirectories`: JSON array
- `readOnlyMode`: Boolean
- `createdAt`: DateTime
- `updatedAt`: DateTime

### AuditLog
- `id`: UUID (primary key)
- `userId`: UUID (foreign key)
- `commandType`: String
- `commandPayload`: JSON (optional)
- `status`: String
- `errorMessage`: String (optional)
- `createdAt`: DateTime

## Connection Pooling

The Prisma client automatically manages connection pooling. Default settings:
- Connection pool size: Based on database URL parameters
- Connection timeout: 10 seconds
- Query timeout: 10 seconds

To customize, add parameters to your `DATABASE_URL`:
```
DATABASE_URL=postgresql://user:pass@localhost:5432/db?connection_limit=10&pool_timeout=20
```

## Best Practices

1. **Always use the singleton instance**: Import `db` from this module
2. **Handle errors**: Wrap database calls in try-catch blocks
3. **Use transactions**: For operations that need atomicity
4. **Close connections**: Call `disconnectDatabase()` on shutdown
5. **Monitor performance**: Enable query logging in development

## Example: Transaction

```typescript
import { db } from './db/prisma';

const result = await db.$transaction(async (tx) => {
  const user = await tx.user.create({
    data: { phoneNumber: '+1234567890', workspaceId: 'ws-1' },
  });
  
  await tx.settings.create({
    data: { userId: user.id, notificationEnabled: true },
  });
  
  return user;
});
```

## Troubleshooting

### Connection Errors
- Verify `DATABASE_URL` in `.env`
- Check PostgreSQL is running
- Ensure database exists

### Query Performance
- Enable query logging: Set `log: ['query']` in PrismaClient options
- Add indexes for frequently queried fields (already configured)
- Use `select` to limit returned fields

### Migration Issues
- Run `npm run prisma:generate` after schema changes
- Use `npm run prisma:migrate` to create migrations
- Check migration history with `npx prisma migrate status`
