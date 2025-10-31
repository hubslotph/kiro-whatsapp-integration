import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import { testConnection, disconnectDatabase } from './db/prisma';
import { testRedisConnection, disconnectRedis } from './db/redis';
import authRoutes from './routes/auth.routes';
import whatsappRoutes from './routes/whatsapp.routes';
import notificationRoutes from './routes/notification.routes';
import settingsRoutes from './routes/settings.routes';
import auditRoutes from './routes/audit.routes';
import { notificationDispatcher } from './services/notification-dispatcher.service';
import { SettingsService } from './services/settings.service';
import { SettingsBroadcasterService } from './services/settings-broadcaster.service';
import { workspaceManagerService } from './services/workspace-manager-wrapper.service';
import { prisma } from './db/prisma';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/whatsapp', whatsappRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/audit', auditRoutes);

// Health check endpoint
app.get('/health', async (_req: Request, res: Response) => {
  const dbConnected = await testConnection();
  const redisConnected = await testRedisConnection();
  
  res.status(dbConnected && redisConnected ? 200 : 503).json({
    status: dbConnected && redisConnected ? 'ok' : 'degraded',
    database: dbConnected ? 'connected' : 'disconnected',
    redis: redisConnected ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString(),
  });
});

// Graceful shutdown handler
async function gracefulShutdown(signal: string) {
  console.log(`\n${signal} received, shutting down gracefully...`);
  await notificationDispatcher.cleanup();
  await disconnectDatabase();
  await disconnectRedis();
  process.exit(0);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Initialize settings broadcaster
const settingsService = new SettingsService(prisma);
// Settings broadcaster is initialized but not directly used - it listens to events internally
new SettingsBroadcasterService(
  settingsService,
  workspaceManagerService
);

// Start server
async function startServer() {
  try {
    // Test database connection on startup
    const dbConnected = await testConnection();
    if (!dbConnected) {
      console.warn('Warning: Database connection failed. Server starting anyway...');
    }

    // Test Redis connection on startup
    const redisConnected = await testRedisConnection();
    if (!redisConnected) {
      console.warn('Warning: Redis connection failed. Server starting anyway...');
    }

    app.listen(PORT, () => {
      console.log(`Backend service running on port ${PORT}`);
      console.log('Settings broadcaster initialized');
    });

    // Start notification processor
    notificationDispatcher.startProcessor();

    // Initialize event subscriptions for active users
    // This reconnects workspace event listeners on server restart
    const { initializeEventSubscriptions } = await import('./services/notification-integration.service');
    await initializeEventSubscriptions();
    console.log('Event subscriptions initialized');
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

// Session cleanup job - runs every hour
setInterval(async () => {
  try {
    const { cleanupExpiredSessions } = await import('./services/auth.service');
    const count = await cleanupExpiredSessions();
    if (count > 0) {
      console.log(`Cleaned up ${count} expired sessions`);
    }
  } catch (error) {
    console.error('Error in session cleanup job:', error);
  }
}, 60 * 60 * 1000); // Run every hour

// Audit log cleanup job - runs daily
setInterval(async () => {
  try {
    const { cleanupOldAuditLogs } = await import('./services/audit-log.service');
    const daysToKeep = parseInt(process.env.AUDIT_LOG_RETENTION_DAYS || '90');
    const count = await cleanupOldAuditLogs(daysToKeep);
    if (count > 0) {
      console.log(`Cleaned up ${count} old audit logs (keeping ${daysToKeep} days)`);
    }
  } catch (error) {
    console.error('Error in audit log cleanup job:', error);
  }
}, 24 * 60 * 60 * 1000); // Run every 24 hours
