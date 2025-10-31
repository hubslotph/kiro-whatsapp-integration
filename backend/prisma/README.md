# Database Setup Guide

This directory contains the Prisma schema and database utilities for the Kiro-WhatsApp Integration backend.

## Prerequisites

- PostgreSQL 12 or higher
- Node.js 18 or higher

## Quick Start

1. **Set up your database URL**
   
   Copy `.env.example` to `.env` and update the `DATABASE_URL`:
   ```
   DATABASE_URL=postgresql://user:password@localhost:5432/kiro_whatsapp
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Generate Prisma Client**
   ```bash
   npm run prisma:generate
   ```

4. **Run migrations**
   ```bash
   npm run prisma:migrate
   ```

5. **Seed the database (optional, for development)**
   ```bash
   npm run prisma:seed
   ```

## Available Scripts

- `npm run prisma:generate` - Generate Prisma Client from schema
- `npm run prisma:migrate` - Create and apply a new migration
- `npm run prisma:migrate:deploy` - Apply migrations in production
- `npm run prisma:studio` - Open Prisma Studio (database GUI)
- `npm run prisma:seed` - Seed database with test data
- `npm run db:setup` - Complete setup (generate + migrate + seed)

## Database Schema

### Users Table
Stores WhatsApp user information and workspace associations.

### Sessions Table
Manages authentication sessions with JWT tokens and expiration tracking.

### Settings Table
User preferences including notification settings and accessible directories.

### Audit Logs Table
Tracks all command executions for security and debugging purposes.

## Connection Pooling

The database connection utility (`src/db/prisma.ts`) implements:
- Singleton pattern for connection reuse
- Automatic connection pooling via Prisma
- Graceful shutdown handling
- Connection health checks

## Development

### Creating a New Migration

```bash
npm run prisma:migrate
```

This will:
1. Prompt you for a migration name
2. Generate SQL migration files
3. Apply the migration to your database
4. Update Prisma Client

### Viewing Data

Use Prisma Studio to browse and edit data:
```bash
npm run prisma:studio
```

### Resetting the Database

```bash
npx prisma migrate reset
```

This will:
1. Drop the database
2. Create a new database
3. Apply all migrations
4. Run seed script

## Production Deployment

1. Set `DATABASE_URL` environment variable
2. Run migrations:
   ```bash
   npm run prisma:migrate:deploy
   ```
3. Generate Prisma Client:
   ```bash
   npm run prisma:generate
   ```

**Note:** Do not run the seed script in production!

## Troubleshooting

### Connection Issues

If you see connection errors:
1. Verify PostgreSQL is running
2. Check `DATABASE_URL` format
3. Ensure database exists
4. Verify user permissions

### Migration Conflicts

If migrations fail:
1. Check for schema conflicts
2. Review migration history
3. Consider using `prisma migrate resolve`

### Performance

For production:
- Configure connection pool size via `DATABASE_URL` parameters
- Monitor query performance with Prisma logging
- Use indexes for frequently queried fields (already configured)
