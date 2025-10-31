import { PrismaClient } from '@prisma/client';

// Prisma client singleton with connection pooling
let prismaInstance: PrismaClient;

/**
 * Get or create Prisma client instance
 * Implements singleton pattern to reuse database connections
 */
export function getPrismaClient(): PrismaClient {
  if (!prismaInstance) {
    prismaInstance = new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
      datasources: {
        db: {
          url: process.env.DATABASE_URL,
        },
      },
    });

    // Handle graceful shutdown
    process.on('beforeExit', async () => {
      await prismaInstance.$disconnect();
    });
  }

  return prismaInstance;
}

/**
 * Test database connection
 * @returns Promise<boolean> - true if connection successful
 */
export async function testConnection(): Promise<boolean> {
  try {
    const client = getPrismaClient();
    await client.$connect();
    await client.$queryRaw`SELECT 1`;
    console.log('Database connection successful');
    return true;
  } catch (error) {
    console.error('Database connection failed:', error);
    return false;
  }
}

/**
 * Disconnect from database
 * Should be called during application shutdown
 */
export async function disconnectDatabase(): Promise<void> {
  if (prismaInstance) {
    await prismaInstance.$disconnect();
    console.log('Database disconnected');
  }
}

// Export singleton instance
export const db = getPrismaClient();
export const prisma = db;
