import { createClient, RedisClientType } from 'redis';

// Redis client singleton
let redisClient: RedisClientType | null = null;

/**
 * Get or create Redis client instance
 * Implements singleton pattern to reuse Redis connections
 */
export async function getRedisClient(): Promise<RedisClientType> {
  if (!redisClient) {
    redisClient = createClient({
      socket: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
      },
      password: process.env.REDIS_PASSWORD || undefined,
    });

    redisClient.on('error', (err) => {
      console.error('Redis Client Error:', err);
    });

    redisClient.on('connect', () => {
      console.log('Redis client connected');
    });

    await redisClient.connect();
  }

  return redisClient;
}

/**
 * Test Redis connection
 * @returns Promise<boolean> - true if connection successful
 */
export async function testRedisConnection(): Promise<boolean> {
  try {
    const client = await getRedisClient();
    await client.ping();
    console.log('Redis connection successful');
    return true;
  } catch (error) {
    console.error('Redis connection failed:', error);
    return false;
  }
}

/**
 * Disconnect from Redis
 * Should be called during application shutdown
 */
export async function disconnectRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    console.log('Redis disconnected');
  }
}

/**
 * Get Redis client synchronously (for services that need immediate access)
 * Note: This assumes Redis is already connected
 */
export function getRedisClientSync(): RedisClientType {
  if (!redisClient) {
    throw new Error('Redis client not initialized. Call getRedisClient() first.');
  }
  return redisClient;
}

// Export a promise-based client getter for convenience
let clientPromise: Promise<RedisClientType> | null = null;

export const redis = new Proxy({} as RedisClientType, {
  get: (_target, prop) => {
    if (!clientPromise) {
      clientPromise = getRedisClient();
    }
    return (...args: any[]) => {
      return clientPromise!.then((client) => {
        const method = (client as any)[prop];
        if (typeof method === 'function') {
          return method.apply(client, args);
        }
        return method;
      });
    };
  },
});
